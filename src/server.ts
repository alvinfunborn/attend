import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { ClaudeAnalyzer } from "./chat/analyzer/claude.js";
import { CodexAnalyzer } from "./chat/analyzer/codex.js";
import { DaemonOrchestrator } from "./chat/daemon.js";
import { ChatEngine } from "./chat/engine.js";
import { readClaudeTranscript } from "./chat/transcript.js";
import type { AttendConfig } from "./config.js";
import { type AlignmentModel, buildAlignmentModel, scoreAlignment } from "./core/alignment.js";
import { AnalysisCache } from "./core/daemon/cache.js";
import { OverrideStore } from "./core/daemon/overrides.js";
import { DaemonRegistry } from "./core/daemon/registry.js";
import { type LaunchAction, type LaunchVendor, launchSession } from "./core/launch.js";
import { discoverMemorySources, loadMemoryDocs } from "./core/memory.js";
import { evaluatePriority } from "./core/priority.js";
import type { Brief, RawSession, Telemetry } from "./core/types.js";
import { detectVendors } from "./core/vendor/detect.js";
import { collectSessions } from "./core/vendor/index.js";
import { type ConsoleView, type SessionView, renderConsole } from "./ui/console.js";

const DAY_MS = 86_400_000;

/** Memoize an expensive scan so browser refreshes don't re-read every JSONL. */
function ttlCache<T>(ttlMs: number, fn: () => T): () => T {
  let stamp = 0;
  let value: T;
  let primed = false;
  return () => {
    const now = Date.now();
    if (primed && now - stamp < ttlMs) return value;
    value = fn();
    stamp = now;
    primed = true;
    return value;
  };
}

/** Injectable so tests can assert wiring without spawning terminals or hitting the SDK. */
export interface AppDeps {
  launcher: (
    action: LaunchAction,
    vendor: LaunchVendor,
    cwd: string,
    opts: { sessionId?: string; prompt?: string },
  ) => string;
  engine: ChatEngine;
  orchestrator: DaemonOrchestrator;
}

/**
 * Project dirs offered in the "+ new" picker, ordered by **most-recent session
 * activity** (the dir of your latest active session floats to the top) — so the
 * one you're likeliest to start in is the default.
 */
function knownDirs(sessions: RawSession[]): string[] {
  const lastTouch = new Map<string, number>();
  for (const s of sessions) {
    if (!s.cwd) continue;
    const d = path.resolve(s.cwd);
    const ts = s.lastTs ?? 0;
    const prev = lastTouch.get(d);
    if (prev === undefined || ts > prev) lastTouch.set(d, ts);
  }
  return [...lastTouch.entries()]
    .filter(([d]) => fs.existsSync(d))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([d]) => d);
}

/** Telemetry for a single session (so pattern/priority can be computed per-session). */
function sessionTelemetry(s: RawSession, now: number): Telemetry {
  const dwell = s.firstTs !== null && s.lastTs !== null ? (s.lastTs - s.firstTs) / 60_000 : null;
  const ageDays = s.lastTs !== null ? Math.floor((now - s.lastTs) / DAY_MS) : null;
  return {
    sessions: 1,
    prompts: s.prompts,
    actions: s.actions,
    visits: s.visits,
    totalMinutes: dwell ?? 0,
    avgSessionMin: dwell,
    lastActionAgeDays: s.actions > 0 ? ageDays : null,
    lastTouch: s.lastTs !== null ? new Date(s.lastTs).toISOString() : null,
    lastTouchAgeDays: ageDays,
  };
}

function toSessionViews(
  sessions: RawSession[],
  model: AlignmentModel | null,
  now: number,
  orchestrator: DaemonOrchestrator,
  overrides: OverrideStore,
): SessionView[] {
  return [...sessions]
    .sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0))
    .map((s) => {
      const tel = sessionTelemetry(s, now);
      // Pattern stays a *session-derived observation* (DESIGN v2.3 #1). Brief /
      // priority / ETA come from the session's daemon when it has one; otherwise
      // (historical / terminal-launched sessions) fall back to the heuristic.
      const synthetic: Brief = {
        path: "",
        projectDir: s.cwd ?? "",
        name: s.title || (s.cwd ? path.basename(s.cwd) : "session"),
        frontMatter: {},
        what: s.title ?? "",
        accept: "",
        next: "",
        status: "active",
        deferUntil: null,
      };
      const heuristic = evaluatePriority(synthetic, tel, model);
      const a = s.sessionId ? orchestrator.analysis(s.sessionId) : null;
      // A manual override (clicked on the tab) wins over daemon/heuristic and is
      // never clobbered by the daemon's turn-end rewrite (separate store).
      const ov = s.sessionId ? overrides.get(s.sessionId) : null;
      const baseScore = a ? a.priority : heuristic.score;
      const baseEta = a ? a.etaMin : estimateEtaFromMemory(model, synthetic.what || synthetic.name);
      return {
        vendor: s.vendor,
        sessionId: s.sessionId,
        title: s.title ?? "",
        lastPrompt: s.lastPrompt ?? null,
        cwd: s.cwd,
        file: s.path,
        project: s.cwd ? path.basename(s.cwd) : "—",
        ageDays: s.lastTs !== null ? Math.floor((now - s.lastTs) / DAY_MS) : null,
        lastTs: s.lastTs,
        prompts: s.prompts,
        pattern: heuristic.pattern,
        score: ov?.priority ?? baseScore,
        reason: a ? a.reason : heuristic.reason,
        etaMin: ov?.etaMin ?? baseEta,
        brief: a ? a.brief : null,
        priorityset: ov?.priority !== undefined,
        etaset: ov?.etaMin !== undefined,
      };
    });
}

/**
 * Throughput readout for the console header: real activity over the trailing 24h,
 * normalized to an hourly rate. Descriptive, not judgmental (DESIGN invariant 3) —
 * it reports what flowed through, it doesn't nag about a backlog.
 */
const THROUGHPUT_WINDOW_HOURS = 24;
export function hourlyThroughput(
  sessions: RawSession[],
  now: number,
): { sessionsPerHour: number; charsPerHour: number } {
  const since = now - THROUGHPUT_WINDOW_HOURS * 60 * 60 * 1000;
  const recent = sessions.filter((s) => (s.lastTs ?? 0) >= since);
  const chars = recent.reduce((n, s) => n + s.chars, 0);
  return {
    sessionsPerHour: recent.length / THROUGHPUT_WINDOW_HOURS,
    charsPerHour: chars / THROUGHPUT_WINDOW_HOURS,
  };
}

const ETA_BASE_MIN = 2;
const ETA_DEPTH_MIN = 28;
const ETA_DEPTH_TAU = 0.12;

/**
 * Estimate minutes to re-engage a session — now *memory-derived* (user redirect
 * 2026-05-31): cost, like priority, is a judgment that needs the whole memory,
 * not one session's bytes. A session whose topic your memory is deeply invested
 * in costs more to reload + reply to thoughtfully; one your memory barely
 * mentions is cheap. The transcript-size model was deliberately dropped. The
 * exp() saturates so the estimate stays bounded for any cosine magnitude.
 */
function estimateEtaFromMemory(model: AlignmentModel | null, text: string): number {
  if (!model) return ETA_BASE_MIN;
  const { cosine } = scoreAlignment(model, text);
  const depth = 1 - Math.exp(-cosine / ETA_DEPTH_TAU);
  return Math.max(1, Math.round(ETA_BASE_MIN + ETA_DEPTH_MIN * depth));
}

export function createApp(
  config: AttendConfig,
  deps: AppDeps = {
    launcher: launchSession,
    engine: new ChatEngine(),
    orchestrator: new DaemonOrchestrator(
      new DaemonRegistry(config.daemonRegistry),
      new AnalysisCache(config.analysisCache),
      [new ClaudeAnalyzer(config.claudeProjects), new CodexAnalyzer()],
    ),
  },
): Hono {
  const engine = deps.engine;
  const orchestrator = deps.orchestrator;
  const overrides = new OverrideStore(config.overrides);
  const getSessions = ttlCache(30_000, () => collectSessions(config));
  const getModel = ttlCache(60_000, (): AlignmentModel => {
    const sources = config.memorySources.length
      ? config.memorySources
      : discoverMemorySources(config.claudeProjects);
    return buildAlignmentModel(loadMemoryDocs(sources));
  });
  // Which vendor CLIs are installed locally — gates the "+ new" provider picker.
  // Cached longer than sessions: a CLI is rarely (un)installed mid-run.
  const getVendors = ttlCache(300_000, () => detectVendors());
  // Hide daemon sessions from every listing: they're real Claude sessions we
  // spawned to analyze the task sessions (DESIGN v2.3 #2 — same cwd, so filtered
  // by id, not directory).
  const visibleSessions = (): RawSession[] => {
    const daemons = orchestrator.daemonIds();
    return getSessions().filter((s) => !s.sessionId || !daemons.has(s.sessionId));
  };

  // When a task turn ends, re-run its daemon analysis (DESIGN v2.3 #3 — triggered
  // on completion, not polled). Daemon turns are ignored to avoid recursion.
  engine.onTurnEnd((sid) => {
    if (orchestrator.isDaemon(sid) || !orchestrator.hasDaemon(sid)) return;
    orchestrator.analyzeTask(sid, engine.get(sid)?.cwd ?? "").catch(() => {});
  });

  const app = new Hono();

  // Main view: slock-style console — all sessions aggregated, chat in-browser.
  app.get("/", (c) => {
    const sessions = visibleSessions();
    const throughput = hourlyThroughput(sessions, Date.now());
    const view: ConsoleView = {
      sessions: toSessionViews(sessions, getModel(), Date.now(), orchestrator, overrides),
      knownDirs: knownDirs(sessions),
      sessionsPerHour: throughput.sessionsPerHour,
      charsPerHour: throughput.charsPerHour,
      vendors: getVendors(),
    };
    return c.html(renderConsole(view));
  });

  // Latest daemon analysis for a session (brief/priority/eta/reason), or null.
  // The console polls this shortly after a turn ends to pick up the daemon's
  // fresh verdict without a full reload.
  app.get("/session/analysis", (c) => {
    const id = c.req.query("session");
    return c.json({ analysis: id ? orchestrator.analysis(id) : null });
  });

  // Manually pin a session's priority and/or ETA (set by clicking its tab). A
  // numeric field is clamped + pinned; an explicit null clears that pin and lets
  // the value fall back to the daemon/heuristic again.
  app.post("/session/override", async (c) => {
    const id = c.req.query("session");
    if (!id) return c.json({ ok: false, error: "missing session" }, 400);
    const body = (await c.req.json().catch(() => ({}))) as {
      priority?: number | null;
      etaMin?: number | null;
    };
    const patch: { priority?: number | null; etaMin?: number | null } = {};
    if ("priority" in body) patch.priority = body.priority;
    if ("etaMin" in body) patch.etaMin = body.etaMin;
    if (patch.priority === undefined && patch.etaMin === undefined) {
      return c.json({ ok: false, error: "nothing to set" }, 400);
    }
    const override = overrides.set(id, patch);
    return c.json({ ok: true, override });
  });

  // Session ids currently generating a turn — the sidebar polls this so a tab
  // shows its live status even while you're looking at a different session.
  app.get("/chat/live", (c) => c.json({ active: engine.activeSessions() }));

  // Static transcript of a session (history shown when you open it).
  app.get("/chat/messages", (c) => {
    const file = c.req.query("file");
    if (!file || !file.endsWith(".jsonl") || !fs.existsSync(file)) return c.json([]);
    return c.json(readClaudeTranscript(file));
  });

  // Live event stream for a session (SSE). Replays buffered events, then streams.
  app.get("/chat/stream", (c) => {
    const id = c.req.query("session");
    if (!id) return c.text("missing session", 400);
    return streamSSE(c, async (stream) => {
      await new Promise<void>((resolve) => {
        const unsub = engine.subscribe(id, (ev) => {
          stream.writeSSE({ data: JSON.stringify(ev) }).catch(() => {});
        });
        stream.onAbort(() => {
          unsub();
          resolve();
        });
      });
    });
  });

  // Send a user turn; starts (resumes) a live run if one isn't already running.
  app.post("/chat/send", async (c) => {
    const id = c.req.query("session");
    const cwd = c.req.query("cwd");
    const body = (await c.req.json().catch(() => ({}))) as { text?: string };
    const text = body.text;
    if (!id) return c.json({ ok: false, error: "missing session" }, 400);
    if (!cwd || !fs.existsSync(cwd))
      return c.json({ ok: false, error: "directory not found" }, 400);
    if (!text || !text.trim()) return c.json({ ok: false, error: "empty message" }, 400);
    if (!engine.get(id)) engine.start({ resume: id, cwd }).catch(() => {});
    const sent = engine.send(id, text);
    return c.json({ ok: sent, session: id });
  });

  // Interrupt the in-flight turn (the Stop button). No-op (ok:false) if the
  // session isn't live or its query can't be interrupted.
  app.post("/chat/abort", async (c) => {
    const id = c.req.query("session");
    if (!id) return c.json({ ok: false, error: "missing session" }, 400);
    const stopped = await engine.interrupt(id);
    return c.json({ ok: stopped, session: id });
  });

  // Start a brand-new session in a directory.
  app.post("/chat/new", async (c) => {
    const cwd = c.req.query("cwd");
    const body = (await c.req.json().catch(() => ({}))) as { text?: string };
    const text = body.text;
    if (!cwd || !fs.existsSync(cwd))
      return c.json({ ok: false, error: "directory not found" }, 400);
    // First message is optional: start the run empty and ready, and only feed a
    // first turn if one was typed. The SDK emits its init message (and thus the
    // session id) for a fresh session without needing input, so start() resolves.
    try {
      const session = await engine.start(text?.trim() ? { cwd, firstText: text } : { cwd });
      // Product-created session → give it an analyzer daemon (DESIGN v2.3 #5).
      // In-browser chat is Claude-only, so the task vendor is "claude".
      orchestrator.ensureDaemon(session, "claude", cwd).catch(() => {});
      return c.json({ ok: true, session });
    } catch (err) {
      return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  // Fork (split) a session into a new branch. A fork needs a first turn to
  // diverge: the real Agent SDK only emits the new session id (in its init
  // message) once it receives input, so a fork with no first message would hang
  // forever waiting on an init that never comes.
  app.post("/chat/fork", async (c) => {
    const id = c.req.query("session");
    const cwd = c.req.query("cwd");
    const body = (await c.req.json().catch(() => ({}))) as { text?: string };
    const text = body.text;
    if (!id) return c.json({ ok: false, error: "missing session" }, 400);
    if (!cwd || !fs.existsSync(cwd))
      return c.json({ ok: false, error: "directory not found" }, 400);
    if (!text || !text.trim())
      return c.json({ ok: false, error: "type a message to branch with" }, 400);
    try {
      const session = await engine.start({ resume: id, forkSession: true, cwd, firstText: text });
      // A fork is also a product-created session → its own analyzer daemon.
      orchestrator.ensureDaemon(session, "claude", cwd).catch(() => {});
      return c.json({ ok: true, session });
    } catch (err) {
      return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  // Launch a vendor action in a terminal: resume / fork an existing session, or start a new one.
  app.post("/launch", (c) => {
    const action = c.req.query("action");
    const vendor = c.req.query("vendor");
    const cwd = c.req.query("cwd");
    const id = c.req.query("id");
    const prompt = c.req.query("prompt");

    if (action !== "resume" && action !== "fork" && action !== "new") {
      return c.json({ ok: false, error: "unknown action" }, 400);
    }
    if (vendor !== "claude" && vendor !== "codex") {
      return c.json({ ok: false, error: "unknown vendor" }, 400);
    }
    if (!cwd || !fs.existsSync(cwd)) {
      return c.json({ ok: false, error: "directory not found" }, 400);
    }
    if ((action === "resume" || action === "fork") && (!id || !/^[A-Za-z0-9_-]+$/.test(id))) {
      return c.json({ ok: false, error: "invalid session id" }, 400);
    }
    try {
      const command = deps.launcher(action, vendor, cwd, { sessionId: id, prompt });
      return c.json({ ok: true, command });
    } catch (err) {
      return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  return app;
}

export interface RunningServer {
  url: string;
  port: number;
  close: () => void;
}

/**
 * Start the HTTP server; resolves once it is listening. If the port is already
 * in use, rolls forward to the next free port (up to `maxAttempts`) instead of
 * crashing — and logs the bump so the printed URL is always the real one.
 */
export function startServer(config: AttendConfig, maxAttempts = 10): Promise<RunningServer> {
  const app = createApp(config);
  const listen = (port: number, attemptsLeft: number): Promise<RunningServer> =>
    new Promise((resolve, reject) => {
      const server = serve({ fetch: app.fetch, hostname: config.host, port }, () => {
        resolve({ url: `http://${config.host}:${port}`, port, close: () => server.close() });
      });
      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
          process.stderr.write(`port ${port} in use, trying ${port + 1}…\n`);
          resolve(listen(port + 1, attemptsLeft - 1));
        } else {
          reject(err);
        }
      });
    });
  return listen(config.port, maxAttempts - 1);
}
