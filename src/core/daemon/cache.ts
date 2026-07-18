import { JsonFile, type JsonRepository } from "../json-file.js";
import { SqliteDocument } from "../state-database.js";

export type AnalysisState =
  | "continue_ready"
  | "needs_decision"
  | "needs_input"
  | "blocked"
  | "needs_review"
  | "followup_suggested"
  | "done";

/** The daemon's structured verdict for one task session. */
export interface Analysis {
  /** ≤8-word headline — the tab title */
  brief: string;
  /** why the assistant handed control back, or null for older cached verdicts */
  state: AnalysisState | null;
  /** 0–10, higher = more deserving of attention now */
  priority: number;
  /** estimated minutes to re-engage (re-read last turn + reply) */
  etaMin: number;
  /** one short, descriptive observation (never judgmental) */
  reason: string;
  /** editable user message that lowers the friction to resume an avoidance session */
  avoidancePrompt?: string | null;
  /** predicted next user message for the latest completed assistant turn; discarded
   *  as soon as another user turn starts */
  nextStep?: string | null;
  /** scrutiny-lane counterpart to nextStep: a ready-to-send message that questions or
   *  asks the assistant to explain THIS turn; discarded on the next user turn */
  probe?: string | null;
}

/**
 * Latest daemon analysis per task session, overwritten every round (on turn-end),
 * so the tab always shows the most recent verdict. Persisted so it survives a
 * restart — the daemon session is the source, this is its cached output (no
 * lastTs gating: freshness is maintained by re-running on each turn).
 */
export class AnalysisCache {
  private readonly data: JsonRepository<Record<string, Analysis>>;

  constructor(file: string, databaseFile?: string) {
    this.data = databaseFile
      ? new SqliteDocument(databaseFile, "analysis-cache", file, normalizeAnalyses)
      : new JsonFile(file, normalizeAnalyses);
  }

  get(taskId: string): Analysis | null {
    return this.data.read()[taskId] ?? null;
  }

  set(taskId: string, a: Analysis): void {
    this.data.update((analyses) => {
      analyses[taskId] = a;
    });
  }

  /** `nextStep` and `probe` describe only the latest completed assistant turn.
   *  Keep the durable handoff fields, but invalidate both drafts once the human
   *  advances the session so a refresh cannot resurrect stale suggestions. */
  discardTurnDrafts(taskId: string): Analysis | null {
    let next: Analysis | null = null;
    this.data.update((analyses) => {
      const current = analyses[taskId];
      if (!current) return;
      next = { ...current, nextStep: null, probe: null };
      analyses[taskId] = next;
    });
    return next;
  }
}

function normalizeAnalyses(value: unknown): Record<string, Analysis> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, Analysis>;
}
