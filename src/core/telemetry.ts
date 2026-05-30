import path from "node:path";
import type { Brief, RawSession, Telemetry } from "./types.js";

const DAY_MS = 86_400_000;
const MIN_MS = 60_000;

/** True if `child` is the same as or nested under `parent`. */
function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** Sessions match a brief when its project dir contains, or is contained by, the session cwd. */
export function matchSessions(brief: Brief, sessions: RawSession[]): RawSession[] {
  const proj = path.resolve(brief.projectDir);
  const matched: RawSession[] = [];
  for (const s of sessions) {
    if (!s.cwd) continue;
    const cwd = path.resolve(s.cwd);
    if (isInside(cwd, proj) || isInside(proj, cwd)) matched.push(s);
  }
  return matched;
}

const EMPTY: Telemetry = {
  sessions: 0,
  prompts: 0,
  actions: 0,
  totalMinutes: 0,
  avgSessionMin: null,
  lastActionAgeDays: null,
  lastTouch: null,
  lastTouchAgeDays: null,
};

export function telemetryForBrief(
  brief: Brief,
  sessions: RawSession[],
  now: number = Date.now(),
): Telemetry {
  const matched = matchSessions(brief, sessions);
  if (matched.length === 0) return { ...EMPTY };

  let totalMinutes = 0;
  const durations: number[] = [];
  let lastActionTs: number | null = null;
  let lastTouchTs: number | null = null;
  let prompts = 0;
  let actions = 0;

  for (const s of matched) {
    prompts += s.prompts;
    actions += s.actions;
    if (s.firstTs !== null && s.lastTs !== null) {
      const d = (s.lastTs - s.firstTs) / MIN_MS;
      totalMinutes += d;
      durations.push(d);
    }
    if (s.lastTs !== null && (lastTouchTs === null || s.lastTs > lastTouchTs)) {
      lastTouchTs = s.lastTs;
    }
    if (s.actions > 0 && s.lastTs !== null && (lastActionTs === null || s.lastTs > lastActionTs)) {
      lastActionTs = s.lastTs;
    }
  }

  return {
    sessions: matched.length,
    prompts,
    actions,
    totalMinutes,
    avgSessionMin: durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null,
    lastActionAgeDays: lastActionTs !== null ? Math.floor((now - lastActionTs) / DAY_MS) : null,
    lastTouch: lastTouchTs !== null ? new Date(lastTouchTs).toISOString() : null,
    lastTouchAgeDays: lastTouchTs !== null ? Math.floor((now - lastTouchTs) / DAY_MS) : null,
  };
}
