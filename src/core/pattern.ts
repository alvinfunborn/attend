import type { Pattern, Telemetry } from "./types.js";

/** A gap longer than this between consecutive activity = you left and came back,
 *  so the next burst counts as a fresh "visit" (used when parsing transcripts). */
export const VISIT_GAP_MINUTES = 30;

/**
 * `avoidance` is now a *user-engagement* observation, not an AI-output one (user
 * redirect 2026-05-31): you keep returning to a task over a long span but it
 * isn't moving forward — the signature of being stuck on a decision. Operationally:
 *   - 多次停留 — `visits >= AVOIDANCE_MIN_VISITS` distinct engagement bursts
 *   - 时间长   — `totalMinutes >= AVOIDANCE_MIN_SPAN_MINUTES` wall-clock span
 *   - 没推进   — `prompts <= visits`: you keep opening it without adding new input
 * It deliberately ignores AI actions (those are the model's doing, not yours).
 * The high visit + span floor keeps a single long sitting, or a brief revisit,
 * from being mislabeled (PM-A: one false "avoidance" call destroys trust).
 */
export const AVOIDANCE_MIN_VISITS = 3;
export const AVOIDANCE_MIN_SPAN_MINUTES = 60;
export const AVOIDANCE_REVIEW_MIN_VISITS = 2;
export const AVOIDANCE_REVIEW_MIN_MINUTES = 20;

/**
 * Map telemetry to the one behavioral pattern we still surface: avoidance.
 * Everything else is folded into `unknown` so the UI doesn't dilute the wedge
 * with generic badges.
 * Labels are descriptive observations, never verdicts (DESIGN.md invariant 3,
 * Steel 2007).
 */
export function classifyPattern(tel: Telemetry): Pattern {
  const { sessions, prompts, visits, totalMinutes, reviewVisits, reviewMinutes } = tel;
  if (sessions === 0) return "unknown";
  if (
    reviewVisits >= AVOIDANCE_REVIEW_MIN_VISITS &&
    reviewMinutes >= AVOIDANCE_REVIEW_MIN_MINUTES
  ) {
    return "avoidance";
  }
  if (
    visits >= AVOIDANCE_MIN_VISITS &&
    totalMinutes >= AVOIDANCE_MIN_SPAN_MINUTES &&
    prompts <= visits
  ) {
    return "avoidance";
  }
  return "unknown";
}
