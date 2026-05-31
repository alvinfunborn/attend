/** Shared domain types. session = cache, brief = state. */

export type Pattern = "fresh" | "avoidance" | "stalled" | "healthy" | "active" | "unknown";

export interface BriefFrontMatter {
  status?: string;
  defer_until?: string | null;
  last_touch?: string | null;
  [key: string]: unknown;
}

export interface Brief {
  path: string;
  projectDir: string;
  name: string;
  frontMatter: BriefFrontMatter;
  what: string;
  accept: string;
  next: string;
  /** active | deferred | done */
  status: string;
  deferUntil: string | null;
}

/** One vendor session, normalized across Claude / Codex. */
export interface RawSession {
  path: string;
  vendor: string;
  /** vendor session id, used to resume/fork the session; null if not found */
  sessionId: string | null;
  /** first user prompt, used as a human-readable title; null if none */
  title: string | null;
  /** latest user prompt — the second subtitle ("where the conversation is now") */
  lastPrompt: string | null;
  /** char length of the last assistant turn. Was the ETA "how much to re-read"
   *  proxy; ETA is memory-derived since v2.2, so this is parsed but unused for now. */
  lastTurnChars: number;
  /** cumulative characters processed in this session (user prompts + assistant
   *  text). Drives the console's throughput readout (字/小时). */
  chars: number;
  cwd: string | null;
  /** epoch ms, or null when no timestamps were found */
  firstTs: number | null;
  lastTs: number | null;
  prompts: number;
  actions: number;
  /** distinct engagement bursts — activity separated by a long idle gap counts as
   *  a fresh "visit" (you left and came back). Drives the avoidance pattern. */
  visits: number;
}

export interface Telemetry {
  sessions: number;
  prompts: number;
  actions: number;
  /** distinct engagement bursts (see RawSession.visits) — "多次停留" for avoidance. */
  visits: number;
  totalMinutes: number;
  avgSessionMin: number | null;
  lastActionAgeDays: number | null;
  /** ISO string of most recent touch, or null */
  lastTouch: string | null;
  lastTouchAgeDays: number | null;
}

export interface RankedBrief {
  brief: Brief;
  telemetry: Telemetry;
  score: number;
  reason: string;
  pattern: Pattern;
}
