import type { CollaborationTurnFact, CollaborationTurnLabel } from "../../core/collaboration.js";
import type { Analysis } from "../../core/daemon/cache.js";

export interface AnalyzerVerdict {
  analysis: Analysis;
  observedTurns: CollaborationTurnFact[];
  labels: CollaborationTurnLabel[];
}

/**
 * The analyzer seam — the daemon side of `SessionSource`. A session is analyzed
 * by *its own vendor's* analyzer (a Claude session → a Claude daemon, a Codex
 * session → a Codex daemon), so the prompt/contract is never hardcoded to one
 * vendor (invariant 4: vendor-neutral data — the normalized `Analysis` — but
 * vendor-locked execution). A new vendor = one new `SessionAnalyzer` impl.
 */
export interface SessionAnalyzer {
  readonly vendor: string;
  /**
   * Create the analyzer daemon session for a task in `cwd` (it shares the cwd so
   * it sees the same context). Returns its session id, or null if this vendor
   * can't spawn one yet (→ no daemon; the session keeps the heuristic fallback).
   */
  spawn(cwd: string): Promise<string | null>;
  /**
   * Run one analysis round against the daemon for task `taskId` and return the
   * parsed verdict, or null when unsupported / unparseable. The analyzer owns its
   * own contract + parsing; it never fabricates (null over fake data).
   */
  analyze(
    daemonId: string,
    cwd: string,
    taskId: string,
    knownTurnIds?: ReadonlySet<string>,
    analysisFromAt?: number | null,
    uiContext?: string,
  ): Promise<AnalyzerVerdict | null>;
  /**
   * Optional one-shot prompt generation for sessions already flagged as avoidance
   * by local telemetry. This is intentionally separate from regular analysis so
   * token cost is paid only when the UI can actually use the draft.
   */
  avoidancePrompt?(
    daemonId: string,
    cwd: string,
    taskId: string,
    uiContext?: string,
  ): Promise<string | null>;
}
