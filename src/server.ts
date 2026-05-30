import fs from "node:fs";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { AttendConfig } from "./config.js";
import { type AlignmentModel, buildAlignmentModel } from "./core/alignment.js";
import { parseBrief, scanVault } from "./core/brief.js";
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

export function createApp(config: AttendConfig): Hono {
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

  return app;
}

export interface RunningServer {
  url: string;
  close: () => void;
}

/** Start the HTTP server; resolves once it is listening. */
export function startServer(config: AttendConfig): Promise<RunningServer> {
  const app = createApp(config);
  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port }, () => {
      resolve({
        url: `http://${config.host}:${config.port}`,
        close: () => server.close(),
      });
    });
  });
}
