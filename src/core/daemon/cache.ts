import fs from "node:fs";
import path from "node:path";

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
}

/**
 * Latest daemon analysis per task session, overwritten every round (on turn-end),
 * so the tab always shows the most recent verdict. Persisted so it survives a
 * restart — the daemon session is the source, this is its cached output (no
 * lastTs gating: freshness is maintained by re-running on each turn).
 */
export class AnalysisCache {
  private map = new Map<string, Analysis>();
  private loaded = false;

  constructor(private readonly file: string) {}

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const obj = JSON.parse(fs.readFileSync(this.file, "utf-8")) as Record<string, Analysis>;
      for (const [k, v] of Object.entries(obj)) this.map.set(k, v);
    } catch {
      // missing/corrupt — start empty
    }
  }

  get(taskId: string): Analysis | null {
    this.load();
    return this.map.get(taskId) ?? null;
  }

  set(taskId: string, a: Analysis): void {
    this.load();
    this.map.set(taskId, a);
    this.persist();
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const obj: Record<string, Analysis> = {};
      for (const [k, v] of this.map) obj[k] = v;
      fs.writeFileSync(this.file, JSON.stringify(obj, null, 2));
    } catch {
      // best-effort persistence
    }
  }
}
