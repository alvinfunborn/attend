import type { Analysis } from "../../core/daemon/cache.js";
import type { SessionAnalyzer } from "./index.js";

/**
 * Codex session analyzer — a deliberate stub, mirroring `CodexSource`. Codex has
 * no resumable programmatic session we can drive as a daemon yet, so we return
 * nothing rather than fabricate an analysis (DESIGN invariant 3). A Codex session
 * therefore keeps the heuristic fallback until Codex exposes a daemon mechanism;
 * wire it here when it does — nothing else changes.
 */
export class CodexAnalyzer implements SessionAnalyzer {
  readonly vendor = "codex";

  async spawn(): Promise<string | null> {
    return null;
  }

  async analyze(): Promise<Analysis | null> {
    return null;
  }
}
