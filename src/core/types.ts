/** Shared domain types. session = cache, brief = state. */

export type Pattern = "avoidance" | "unknown";

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

/** One vendor session normalized for the rest of Attend. */
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
  /** cumulative characters parsed from this session; vendors expose different
   *  assistant detail, so this is not used for cross-vendor throughput. */
  chars: number;
  cwd: string | null;
  /** epoch ms, or null when no timestamps were found */
  firstTs: number | null;
  lastTs: number | null;
  /** epoch ms of the latest assistant/tool activity, used for live quiet timing. */
  lastAssistantTs?: number | null;
  /** epoch ms timestamps for real user-authored prompts, newest not guaranteed. */
  userPromptTs?: number[];
  /** timestamp + text length for exact prompt throughput windows. */
  userPromptActivity?: Array<{ at: number; chars: number }>;
  /** timestamp + visible assistant text length for exact total char throughput. */
  assistantTextActivity?: Array<{ at: number; chars: number }>;
  prompts: number;
  actions: number;
  /** distinct engagement bursts — activity separated by a long idle gap counts as
   *  a fresh "visit" (you left and came back). Drives the avoidance pattern. */
  visits: number;
  /** true when the vendor transcript says the latest turn has started but has
   *  not emitted a terminal event. This covers externally-running sessions that
   *  Attend did not launch and therefore cannot track in its live engine. */
  active?: boolean;
  activeStartedAt?: number | null;
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
  /** repeated long read-only reviews: meaningful scroll + long dwell + no send */
  reviewVisits: number;
  reviewMinutes: number;
}

export interface RankedBrief {
  brief: Brief;
  telemetry: Telemetry;
  score: number;
  reason: string;
  pattern: Pattern;
}
