import fs from "node:fs";
import path from "node:path";

/** A user's manual override for a session's rank, set by clicking its tab. Each
 *  field is optional: only the ones the user edited are pinned, the rest still
 *  come from the daemon / heuristic. */
export interface Override {
  /** pinned priority (0–10), wins over daemon/heuristic until cleared */
  priority?: number;
  /** pinned ETA in minutes, wins over daemon/heuristic until cleared */
  etaMin?: number;
}

const PRIORITY_MIN = 0;
const PRIORITY_MAX = 10;
const ETA_MIN = 1;
const ETA_MAX = 600;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Per-session manual overrides, persisted to disk. Deliberately separate from
 * `AnalysisCache`: the daemon rewrites its analysis on every turn-end, so a user
 * value stored there would be lost — keeping overrides in their own store lets
 * them win in the view (DESIGN.md: the user must be able to override the rank)
 * without the daemon ever clobbering them.
 */
export class OverrideStore {
  private map = new Map<string, Override>();
  private loaded = false;

  constructor(private readonly file: string) {}

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const obj = JSON.parse(fs.readFileSync(this.file, "utf-8")) as Record<string, Override>;
      for (const [k, v] of Object.entries(obj)) this.map.set(k, v);
    } catch {
      // missing/corrupt — start empty
    }
  }

  get(sessionId: string): Override | null {
    this.load();
    return this.map.get(sessionId) ?? null;
  }

  /**
   * Merge a patch into a session's override and persist. A field set to a finite
   * number is clamped and pinned; a field explicitly `null` clears that pin. The
   * merged override is returned (or null once it becomes empty).
   */
  set(
    sessionId: string,
    patch: { priority?: number | null; etaMin?: number | null },
  ): Override | null {
    this.load();
    const next: Override = { ...(this.map.get(sessionId) ?? {}) };
    if (patch.priority === null) next.priority = undefined;
    else if (typeof patch.priority === "number" && Number.isFinite(patch.priority))
      next.priority = clamp(patch.priority, PRIORITY_MIN, PRIORITY_MAX);
    if (patch.etaMin === null) next.etaMin = undefined;
    else if (typeof patch.etaMin === "number" && Number.isFinite(patch.etaMin))
      next.etaMin = clamp(Math.round(patch.etaMin), ETA_MIN, ETA_MAX);

    if (next.priority === undefined && next.etaMin === undefined) {
      this.map.delete(sessionId);
      this.persist();
      return null;
    }
    this.map.set(sessionId, next);
    this.persist();
    return next;
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const obj: Record<string, Override> = {};
      for (const [k, v] of this.map) obj[k] = v;
      fs.writeFileSync(this.file, JSON.stringify(obj, null, 2));
    } catch {
      // best-effort persistence
    }
  }
}
