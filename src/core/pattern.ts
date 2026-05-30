import type { Pattern, Telemetry } from "./types.js";

/**
 * `avoidance` requires not just many prompts with no actions, but a *sustained*
 * one. This operationalizes Rosenbaum's pre-crastination caveat (a short
 * easy-task detour to free working memory is healthy; only a long, output-less
 * stretch looks like decision-avoidance) and keeps a brief, output-less planning
 * session from being mislabeled (PM-A: a single false "avoidance" call destroys
 * trust in every badge). Uses task-internal dwell — not recency — so it does not
 * reintroduce the rejected hot/warm/cold-by-time model.
 */
export const AVOIDANCE_MIN_MINUTES = 60;

/**
 * Map telemetry to a behavioral pattern. Labels are descriptive observations,
 * never verdicts (DESIGN.md invariant 3, Steel 2007).
 */
export function classifyPattern(tel: Telemetry): Pattern {
  const { sessions, actions, prompts, avgSessionMin, lastTouchAgeDays, totalMinutes } = tel;
  if (sessions === 0) return "fresh";
  if (prompts >= 5 && actions === 0 && totalMinutes >= AVOIDANCE_MIN_MINUTES) return "avoidance";
  if (actions === 0 && lastTouchAgeDays !== null && lastTouchAgeDays >= 7) return "stalled";
  if (
    actions > 0 &&
    avgSessionMin !== null &&
    avgSessionMin >= 10 &&
    lastTouchAgeDays !== null &&
    lastTouchAgeDays <= 3
  ) {
    return "healthy";
  }
  if (actions > 0) return "active";
  return "unknown";
}
