import type { RawSession } from "../types.js";
import { ClaudeSource } from "./claude.js";
import { CodexSource } from "./codex.js";
import { CursorSource } from "./cursor.js";
import type { ScanCache } from "./scan-cache.js";

/** Persistent per-vendor parse caches, so rebuilding the sources each scan (to
 *  keep config late-bound) doesn't throw away the mtime memoization. */
export interface SourceCaches {
  claude?: ScanCache;
  codex?: ScanCache;
  cursor?: ScanCache;
}

/**
 * A vendor transcript backend. New vendors = new implementation; everything
 * downstream (telemetry, priority, UI) is vendor-neutral (DESIGN.md invariant 4).
 */
export interface SessionSource {
  readonly vendor: string;
  scan(): RawSession[];
}

export interface SessionSourceConfig {
  claudeProjects: string;
  codexSessions: string;
  cursorProjects: string;
  cursorSessions: string;
}

export function buildSources(
  config: SessionSourceConfig,
  caches: SourceCaches = {},
): SessionSource[] {
  return [
    new ClaudeSource(config.claudeProjects, caches.claude),
    new CodexSource(config.codexSessions, caches.codex),
    new CursorSource(config.cursorProjects, config.cursorSessions, caches.cursor),
  ];
}

/** Collect sessions from every vendor source. */
export function collectSessions(config: SessionSourceConfig): RawSession[] {
  return buildSources(config).flatMap((s) => s.scan());
}

export { ClaudeSource } from "./claude.js";
export { CodexSource } from "./codex.js";
export { CursorSource } from "./cursor.js";
