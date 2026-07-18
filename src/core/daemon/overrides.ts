import { JsonFile, type JsonRepository } from "../json-file.js";
import { SqliteDocument } from "../state-database.js";
import type { Pattern } from "../types.js";
import type { AnalysisState } from "./cache.js";

/** A user's manual override for a session's rank, set by clicking its tab. Each
 *  field is optional: only the ones the user edited are pinned, the rest still
 *  come from the daemon / heuristic. */
export interface Override {
  /** pinned priority (0–10), wins over daemon/heuristic until cleared */
  priority?: number;
  /** pinned ETA in minutes, wins over daemon/heuristic until cleared */
  etaMin?: number;
  /** pinned daemon handoff state, wins over daemon until cleared */
  state?: AnalysisState;
  /** pinned behavioral pattern, wins over telemetry heuristic until cleared */
  pattern?: Pattern;
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
  private readonly data: JsonRepository<Record<string, Override>>;

  constructor(file: string, databaseFile?: string) {
    this.data = databaseFile
      ? new SqliteDocument(databaseFile, "overrides", file, normalizeOverrides)
      : new JsonFile(file, normalizeOverrides);
  }

  get(sessionId: string): Override | null {
    return this.data.read()[sessionId] ?? null;
  }

  /**
   * Merge a patch into a session's override and persist. A field set to a finite
   * number is clamped and pinned; a field explicitly `null` clears that pin. The
   * merged override is returned (or null once it becomes empty).
   */
  set(
    sessionId: string,
    patch: {
      priority?: number | null;
      etaMin?: number | null;
      state?: AnalysisState | null;
      pattern?: Pattern | null;
    },
  ): Override | null {
    return this.data.update((overrides) => {
      const next: Override = { ...(overrides[sessionId] ?? {}) };
      if (patch.priority === null) next.priority = undefined;
      else if (typeof patch.priority === "number" && Number.isFinite(patch.priority))
        next.priority = clamp(patch.priority, PRIORITY_MIN, PRIORITY_MAX);
      if (patch.etaMin === null) next.etaMin = undefined;
      else if (typeof patch.etaMin === "number" && Number.isFinite(patch.etaMin))
        next.etaMin = clamp(Math.round(patch.etaMin), ETA_MIN, ETA_MAX);
      if (patch.state === null) next.state = undefined;
      else if (isAnalysisState(patch.state)) next.state = patch.state;
      if (patch.pattern === null) next.pattern = undefined;
      else if (isPattern(patch.pattern)) next.pattern = patch.pattern;

      if (
        next.priority === undefined &&
        next.etaMin === undefined &&
        next.state === undefined &&
        next.pattern === undefined
      ) {
        delete overrides[sessionId];
        return null;
      }
      overrides[sessionId] = next;
      return next;
    });
  }
}

function normalizeOverrides(value: unknown): Record<string, Override> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, Override>;
}

const ANALYSIS_STATES = new Set<AnalysisState>([
  "continue_ready",
  "needs_decision",
  "needs_input",
  "blocked",
  "needs_review",
  "followup_suggested",
  "done",
]);

function isAnalysisState(v: unknown): v is AnalysisState {
  return typeof v === "string" && ANALYSIS_STATES.has(v as AnalysisState);
}

function isPattern(v: unknown): v is Pattern {
  return v === "avoidance" || v === "unknown";
}
