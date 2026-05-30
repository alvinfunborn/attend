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

/**
 * Heuristic priority: memory alignment ×2 + pattern weight + blocker bonus
 * − defer/done penalty. Returns a composed, human-readable reason so the user
 * can override (DESIGN.md: no opaque scores). Ported from daemon.py.
 */
export function evaluatePriority(
  brief: Brief,
  tel: Telemetry,
  memoryKeywords: string[],
): PriorityResult {
  const blob = `${brief.name} ${brief.what} ${brief.next}`.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  const kwHits = memoryKeywords.reduce((n, k) => (blob.includes(k.toLowerCase()) ? n + 1 : n), 0);
  if (kwHits > 0) {
    score += Math.min(kwHits, 5) * 2;
    reasons.push(`memory aligned (${kwHits})`);
  }

  const pattern = classifyPattern(tel);
  if (pattern === "avoidance") {
    score += 4;
    reasons.push("avoidance signal — needs decision, not work");
  } else if (pattern === "stalled") {
    score += 3;
    reasons.push("stalled — needs unblock or kill");
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
