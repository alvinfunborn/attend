import type { AlignmentModel } from "./alignment.js";
import { evaluatePriority } from "./priority.js";
import { telemetryForBrief } from "./telemetry.js";
import type { Brief, Pattern, RankedBrief, RawSession } from "./types.js";

/** Compute telemetry + priority for each brief and sort by descending score. */
export function rankBriefs(
  briefs: Brief[],
  sessions: RawSession[],
  model: AlignmentModel | null,
  now: number = Date.now(),
): RankedBrief[] {
  const ranked = briefs.map((brief) => {
    const telemetry = telemetryForBrief(brief, sessions, now);
    const { score, reason, pattern } = evaluatePriority(brief, telemetry, model);
    return { brief, telemetry, score, reason, pattern };
  });
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

export function patternCounts(ranked: RankedBrief[]): Record<Pattern, number> {
  const counts = {} as Record<Pattern, number>;
  for (const r of ranked) counts[r.pattern] = (counts[r.pattern] ?? 0) + 1;
  return counts;
}
