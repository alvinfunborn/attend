import fs from "node:fs";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { AttendConfig } from "./config.js";
import { type AlignmentModel, buildAlignmentModel } from "./core/alignment.js";
import { parseBrief, scanVault } from "./core/brief.js";
import { type ForkVendor, launchFork } from "./core/fork.js";
import { discoverMemorySources, loadMemoryDocs } from "./core/memory.js";
import { evaluatePriority } from "./core/priority.js";
import { patternCounts, rankBriefs } from "./core/rank.js";
import { spawnCommand } from "./core/spawn.js";
import { matchSessions, telemetryForBrief } from "./core/telemetry.js";
import type { RawSession } from "./core/types.js";
import { collectSessions } from "./core/vendor/index.js";
import { renderDetail } from "./ui/detail.js";
import { renderFeed } from "./ui/feed.js";

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

/** Injectable so tests can assert fork wiring without spawning a real terminal. */
export interface AppDeps {
  forkLauncher: (vendor: ForkVendor, sessionId: string, cwd: string) => string;
}

export function createApp(
  config: AttendConfig,
  deps: AppDeps = { forkLauncher: launchFork },
): Hono {
  const getSessions = ttlCache(30_000, () => collectSessions(config));
  const getModel = ttlCache(60_000, (): AlignmentModel => {
    const sources = config.memorySources.length
      ? config.memorySources
      : discoverMemorySources(config.claudeProjects);
    return buildAlignmentModel(loadMemoryDocs(sources));
  });

  const app = new Hono();

  app.get("/", (c) => {
    const briefs = scanVault(config.vaultRoots, config.scanDepth);
    const ranked = rankBriefs(briefs, getSessions(), getModel());
    return c.html(renderFeed(ranked, patternCounts(ranked), getModel().vocabSize));
  });

  app.get("/brief", (c) => {
    const path = c.req.query("path");
    if (!path) return c.text("missing path", 400);
    if (!fs.existsSync(path)) return c.text("not found", 404);
    const brief = parseBrief(path);
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

  // Fork (split) a session into a new branch via the vendor CLI, in a terminal.
  app.post("/fork", (c) => {
    const vendor = c.req.query("vendor");
    const id = c.req.query("id");
    const cwd = c.req.query("cwd");
    if (vendor !== "claude" && vendor !== "codex") {
      return c.json({ ok: false, error: "unknown vendor" }, 400);
    }
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
      return c.json({ ok: false, error: "invalid session id" }, 400);
    }
    if (!cwd || !fs.existsSync(cwd)) {
      return c.json({ ok: false, error: "cwd not found" }, 400);
    }
    try {
      const command = deps.forkLauncher(vendor, id, cwd);
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
