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
  /** ready-to-send user message when the next move is obvious/mechanical; null/absent
   *  when the human must decide (so the console shows nothing rather than a nudge) */
  nextStep?: string | null;
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
}

function normalizeAnalyses(value: unknown): Record<string, Analysis> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, Analysis>;
}
