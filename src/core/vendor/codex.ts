import type { RawSession } from "../types.js";
import type { SessionSource } from "./index.js";

/**
 * Codex CLI transcripts live at ~/.codex/sessions/YYYY/MM/DD/*.jsonl. The schema
 * is not yet confirmed (DESIGN.md v0→v1: "need a sample of Codex's schema").
 *
 * This is a deliberate clean stub: it returns no sessions rather than inventing
 * data (DESIGN.md invariant 3 — telemetry must never fabricate). When a real
 * sample is available, implement `scan()` here exactly like ClaudeSource; the
 * rest of the pipeline already treats sessions vendor-neutrally.
 */
export class CodexSource implements SessionSource {
  readonly vendor = "codex";

  constructor(private readonly sessionsDir: string) {}

  scan(): RawSession[] {
    void this.sessionsDir;
    return [];
  }
}
