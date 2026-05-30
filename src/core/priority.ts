import { type AlignmentModel, scoreAlignment } from "./alignment.js";
import { classifyPattern } from "./pattern.js";
import type { Brief, Pattern, Telemetry } from "./types.js";

export interface PriorityResult {
  score: number;
  reason: string;
  pattern: Pattern;
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

/** Cosine→score scale for memory alignment. Capped so a strong pattern signal
 *  (avoidance +4, stalled +3) still competes — alignment shouldn't dominate. */
const ALIGN_WEIGHT = 6;
const ALIGN_MIN_COSINE = 0.05;

/**
 * Heuristic priority: memory alignment + pattern weight + blocker bonus −
 * defer/done penalty. Returns a composed, human-readable reason carrying the
 * evidence (DESIGN.md: no opaque scores — the user must be able to audit and
 * override the rank).
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

  const pattern = classifyPattern(tel);
  if (pattern === "avoidance") {
    score += 4;
    reasons.push(
      `avoidance signal (${tel.prompts} prompts, 0 actions over ${fmtDwell(tel.totalMinutes)}) — needs decision, not work`,
    );
  } else if (pattern === "stalled") {
    score += 3;
    const touch = tel.lastTouchAgeDays !== null ? `, last touch ${tel.lastTouchAgeDays}d` : "";
    reasons.push(`stalled (${tel.prompts} prompts, 0 actions${touch}) — needs unblock or kill`);
  } else if (pattern === "fresh") {
    score += 1;
    reasons.push("fresh — no entries yet");
  } else if (pattern === "active") {
    score += 0.5;
  } else if (pattern === "healthy") {
    score -= 1;
    reasons.push("healthy — in flow, don't interrupt");
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
