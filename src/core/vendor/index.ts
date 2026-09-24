import type { RawSession } from "../types.js";
import { AntigravitySource } from "./antigravity.js";
import { ClaudeSource } from "./claude.js";
import { CodexSource } from "./codex.js";
import { CopilotSource } from "./copilot.js";
import { CursorSource } from "./cursor.js";
import { OpencodeSource } from "./opencode.js";
import type { ScanCache } from "./scan-cache.js";
import type { TranscriptPathWriter } from "./transcript-index.js";

/** Persistent per-vendor parse caches, so rebuilding the sources each scan (to
 *  keep config late-bound) doesn't throw away the mtime memoization. */
export interface SourceCaches {
  claude?: ScanCache;
  codex?: ScanCache;
  cursor?: ScanCache;
  cursorCaptured?: ScanCache;
  antigravity?: ScanCache;
  copilot?: ScanCache;
  opencode?: ScanCache;
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
  antigravityBrain: string;
  antigravityCapturedSessions: string;
  copilotSessions: string;
  copilotCapturedSessions: string;
  opencodeData: string;
  opencodeSessions: string;
}

export function buildSources(
  config: SessionSourceConfig,
  caches: SourceCaches = {},
  transcriptIndex?: TranscriptPathWriter,
): SessionSource[] {
  return [
    new ClaudeSource(config.claudeProjects, caches.claude, transcriptIndex),
    new CodexSource(config.codexSessions, caches.codex, transcriptIndex),
    new CursorSource(
      config.cursorProjects,
      config.cursorSessions,
      caches.cursor,
      caches.cursorCaptured,
      transcriptIndex,
    ),
    new AntigravitySource(
      config.antigravityBrain,
      config.antigravityCapturedSessions,
      caches.antigravity,
      transcriptIndex,
    ),
    new CopilotSource(
      config.copilotSessions,
      config.copilotCapturedSessions,
      caches.copilot,
      transcriptIndex,
    ),
    new OpencodeSource(
      config.opencodeData,
      config.opencodeSessions,
      caches.opencode,
      transcriptIndex,
    ),
  ];
}

/** Collect sessions from every vendor source. */
export function collectSessions(config: SessionSourceConfig): RawSession[] {
  return buildSources(config).flatMap((s) => s.scan());
}

export { ClaudeSource } from "./claude.js";
export { CodexSource } from "./codex.js";
export { CursorSource } from "./cursor.js";
export { AntigravitySource } from "./antigravity.js";
export { CopilotSource } from "./copilot.js";
export { OpencodeSource } from "./opencode.js";
