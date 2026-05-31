import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { ChatEngine } from "./chat/engine.js";
import { readClaudeTranscript } from "./chat/transcript.js";
import type { AttendConfig } from "./config.js";
import { type AlignmentModel, buildAlignmentModel } from "./core/alignment.js";
import { parseBrief, scanVault } from "./core/brief.js";
import { type LaunchAction, type LaunchVendor, launchSession } from "./core/launch.js";
import { discoverMemorySources, loadMemoryDocs } from "./core/memory.js";
import { evaluatePriority } from "./core/priority.js";
import { patternCounts, rankBriefs } from "./core/rank.js";
import { spawnCommand } from "./core/spawn.js";
import { matchSessions, telemetryForBrief } from "./core/telemetry.js";
import type { Brief, RankedBrief, RawSession, Telemetry } from "./core/types.js";
import { collectSessions } from "./core/vendor/index.js";
import { type ConsoleView, type SessionView, renderConsole } from "./ui/console.js";
import { renderDetail } from "./ui/detail.js";
import { renderFeed } from "./ui/feed.js";

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
}

/** Map each session to the highest-priority brief whose dir contains it (or vice versa). */
function briefBySession(ranked: RankedBrief[], sessions: RawSession[]): Map<string, RankedBrief> {
  const map = new Map<string, RankedBrief>();
  const sorted = [...ranked].sort((a, b) => b.score - a.score);
  for (const r of sorted) {
    for (const s of matchSessions(r.brief, sessions)) {
      if (!map.has(s.path)) map.set(s.path, r);
    }
  }
  return map;
}

function knownDirs(ranked: RankedBrief[], sessions: RawSession[]): string[] {
  const set = new Set<string>();
  for (const r of ranked) set.add(path.resolve(r.brief.projectDir));
  for (const s of sessions) if (s.cwd) set.add(path.resolve(s.cwd));
  return [...set].filter((d) => fs.existsSync(d)).sort();
}

/** Telemetry for a single session (so pattern/priority can be computed per-session). */
function sessionTelemetry(s: RawSession, now: number): Telemetry {
  const dwell = s.firstTs !== null && s.lastTs !== null ? (s.lastTs - s.firstTs) / 60_000 : null;
  const ageDays = s.lastTs !== null ? Math.floor((now - s.lastTs) / DAY_MS) : null;
  return {
    sessions: 1,
    prompts: s.prompts,
    actions: s.actions,
    totalMinutes: dwell ?? 0,
    avgSessionMin: dwell,
    lastActionAgeDays: s.actions > 0 ? ageDays : null,
    lastTouch: s.lastTs !== null ? new Date(s.lastTs).toISOString() : null,
    lastTouchAgeDays: ageDays,
  };
}

function toSessionViews(
  sessions: RawSession[],
  ranked: RankedBrief[],
  model: AlignmentModel | null,
  now: number,
): SessionView[] {
  const byPath = briefBySession(ranked, sessions);
  return [...sessions]
    .sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0))
    .map((s) => {
      const r = byPath.get(s.path);
      const tel = sessionTelemetry(s, now);
      // Per-session signals: treat the session's title as its "what" and score it
      // exactly like a brief, so pattern/priority/reason follow the session.
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
      const { score, reason, pattern } = evaluatePriority(synthetic, tel, model);
      return {
        vendor: s.vendor,
        sessionId: s.sessionId,
        title: s.title ?? "",
        cwd: s.cwd,
        file: s.path,
        project: s.cwd ? path.basename(s.cwd) : "—",
        ageDays: s.lastTs !== null ? Math.floor((now - s.lastTs) / DAY_MS) : null,
        prompts: s.prompts,
        actions: s.actions,
        pattern,
        score,
        reason,
        brief: r ? { name: r.brief.name, path: r.brief.path } : null,
      };
    });
}

export function createApp(
  config: AttendConfig,
  deps: AppDeps = { launcher: launchSession, engine: new ChatEngine() },
): Hono {
  const engine = deps.engine;
  const getSessions = ttlCache(30_000, () => collectSessions(config));
  const getModel = ttlCache(60_000, (): AlignmentModel => {
    const sources = config.memorySources.length
      ? config.memorySources
      : discoverMemorySources(config.claudeProjects);
    return buildAlignmentModel(loadMemoryDocs(sources));
  });

  const app = new Hono();

  // Main view: slock-style console — all sessions aggregated, chat in-browser.
  app.get("/", (c) => {
    const sessions = getSessions();
    const briefs = scanVault(config.vaultRoots, config.scanDepth);
    const ranked = rankBriefs(briefs, sessions, getModel());
    const view: ConsoleView = {
      sessions: toSessionViews(sessions, ranked, getModel(), Date.now()),
      knownDirs: knownDirs(ranked, sessions),
      briefCount: briefs.length,
      memoryTerms: getModel().vocabSize,
    };
    return c.html(renderConsole(view));
  });

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

  // Start a brand-new session in a directory.
  app.post("/chat/new", async (c) => {
    const cwd = c.req.query("cwd");
    const body = (await c.req.json().catch(() => ({}))) as { text?: string };
    const text = body.text;
    if (!cwd || !fs.existsSync(cwd))
      return c.json({ ok: false, error: "directory not found" }, 400);
    if (!text || !text.trim()) return c.json({ ok: false, error: "empty message" }, 400);
    try {
      const session = await engine.start({ cwd, firstText: text });
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
      return c.json({ ok: true, session });
    } catch (err) {
      return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  // Brief-priority view (the original feed).
  app.get("/briefs", (c) => {
    const briefs = scanVault(config.vaultRoots, config.scanDepth);
    const ranked = rankBriefs(briefs, getSessions(), getModel());
    return c.html(renderFeed(ranked, patternCounts(ranked), getModel().vocabSize));
  });

  app.get("/brief", (c) => {
    const briefPath = c.req.query("path");
    if (!briefPath) return c.text("missing path", 400);
    if (!fs.existsSync(briefPath)) return c.text("not found", 404);
    const brief = parseBrief(briefPath);
    if (!brief) return c.text("parse failed", 500);

    const sessions = getSessions();
    const telemetry = telemetryForBrief(brief, sessions);
    const { score, reason, pattern } = evaluatePriority(brief, telemetry, getModel());
    const matched = matchSessions(brief, sessions)
      .sort((a: RawSession, b: RawSession) => (b.lastTs ?? 0) - (a.lastTs ?? 0))
      .slice(0, 10);

    return c.html(
      renderDetail({
        brief,
        telemetry,
        pattern,
        score,
        reason,
        sessions: matched,
        spawnClaude: spawnCommand(brief, "claude"),
        spawnCodex: spawnCommand(brief, "codex"),
      }),
    );
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
