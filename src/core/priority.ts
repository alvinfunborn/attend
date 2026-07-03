import { type AlignmentModel, scoreAlignment } from "./alignment.js";
import {
  AVOIDANCE_REVIEW_MIN_MINUTES,
  AVOIDANCE_REVIEW_MIN_VISITS,
  classifyPattern,
} from "./pattern.js";
import type { Brief, Pattern, Telemetry } from "./types.js";

export interface PriorityResult {
  score: number;
  reason: string;
  pattern: Pattern;
}

export function patternScoreNudge(pattern: Pattern): number {
  if (pattern === "avoidance") return 1;
  return 0;
}

/** Blocker present in `next`. Refines daemon.py's bare-"等" check so that a
 *  trailing "等" inside parentheticals (e.g. "(作品B 等)") no longer false-fires;
 *  "等" only counts when followed by concrete content. */
function hasBlocker(next: string): boolean {
  const lower = next.toLowerCase();
  if (lower.includes("block") || lower.includes("stuck") || next.includes("卡")) return true;
  return /等[^\s)）.。,，]/.test(next);
}

function fmtDwell(minutes: number): string {
  return minutes >= 60 ? `${(minutes / 60).toFixed(1)}h` : `${Math.round(minutes)}m`;
}

/** Cosine→score scale for memory alignment. Memory now *leads* the rank (user
 *  redirect 2026-05-31): "priority comes from the whole memory; pattern is a
 *  session observation, not the ranking." So alignment carries the weight and
 *  the pattern weights below are deliberately small nudges that can no longer
 *  overpower it. */
const ALIGN_WEIGHT = 12;
const ALIGN_MIN_COSINE = 0.05;

/**
 * Heuristic priority, memory-led: memory alignment is the primary driver; the
 * behavioral pattern (avoidance) only nudges it, and brief status (deferred /
 * done) and an explicit blocker still apply as overrides. Returns a composed,
 * human-readable reason carrying the evidence (DESIGN.md: no opaque scores —
 * the user must be able to audit and override the rank).
 */
export function evaluatePriority(
  brief: Brief,
  tel: Telemetry,
  model: AlignmentModel | null,
): PriorityResult {
  const blob = `${brief.name} ${brief.what} ${brief.next}`;
  let score = 0;
  const reasons: string[] = [];

  if (model) {
    const align = scoreAlignment(model, blob);
    if (align.cosine >= ALIGN_MIN_COSINE) {
      score += align.cosine * ALIGN_WEIGHT;
      const terms = align.topTerms.length ? ` (${align.topTerms.join(", ")})` : "";
      reasons.push(`memory aligned${terms}`);
    }
  }

  // Pattern is a session-level observation; it only nudges the memory-led rank
  // (small weights) so a behavioral signal can't outrank what memory says matters.
  const pattern = classifyPattern(tel);
  score += patternScoreNudge(pattern);
  if (pattern === "avoidance") {
    if (
      tel.reviewVisits >= AVOIDANCE_REVIEW_MIN_VISITS &&
      tel.reviewMinutes >= AVOIDANCE_REVIEW_MIN_MINUTES
    ) {
      reasons.push(
        `avoidance signal (${tel.reviewVisits} review visits over ${fmtDwell(tel.reviewMinutes)}) — repeatedly re-read with meaningful scroll and no send, a decision point not more work`,
      );
    } else {
      reasons.push(
        `avoidance signal (${tel.visits} visits over ${fmtDwell(tel.totalMinutes)}, ${tel.prompts} prompts) — returned to repeatedly without advancing, a decision point not more work`,
      );
    }
  }

  if (brief.status === "deferred") {
    reasons.push(
      brief.deferUntil ? `deferred until ${brief.deferUntil}` : "deferred without condition",
    );
    score -= 2;
  } else if (brief.status === "done") {
    score = -100;
    reasons.push("done");
  }

  if (hasBlocker(brief.next)) {
    score += 1;
    reasons.push("explicit blocker in next");
  }

  return { score, reason: reasons.join("; ") || "no signal", pattern };
}
