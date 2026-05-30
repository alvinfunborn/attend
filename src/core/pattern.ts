import type { Pattern, Telemetry } from "./types.js";

/**
 * Map telemetry to a behavioral pattern. Thresholds ported 1:1 from daemon.py
 * `classify_pattern`. Labels are descriptive observations, never verdicts
 * (DESIGN.md invariant 3, Steel 2007).
 */
export function classifyPattern(tel: Telemetry): Pattern {
  const { sessions, actions, prompts, avgSessionMin, lastTouchAgeDays } = tel;
  if (sessions === 0) return "fresh";
  if (prompts >= 5 && actions === 0) return "avoidance";
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
