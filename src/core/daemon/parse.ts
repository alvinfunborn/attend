import {
  type CollaborationTurnLabel,
  isCollaborationFeedbackTarget,
  isCollaborationIntent,
  isCollaborationSteering,
  parseCollaborationHandoff,
} from "../collaboration.js";
import type { Analysis, AnalysisState } from "./cache.js";

/**
 * Extract the daemon's structured verdict from its free-text reply. The daemon is
 * told to emit a single JSON object; we take the *last* balanced `{...}` block so
 * a leading prose preamble or a ```json fence doesn't break parsing. Returns null
 * when nothing parseable (with a non-empty `brief`) is found — we never fabricate
 * an analysis (DESIGN invariant 3: the Codex stub returns nothing rather than
 * fake data; the daemon parser holds the same line).
 */
export function parseAnalysis(text: string): Analysis | null {
  const json = lastJsonObject(text);
  if (!json) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
  const brief = typeof obj.brief === "string" ? obj.brief.trim() : "";
  if (!brief) return null;
  const out: Analysis = {
    brief: shorten(brief, 80),
    state: parseState(obj.state),
    priority: clampNum(obj.priority, 0, 10),
    etaMin: obj.etaMin == null ? 0 : Math.max(0, Math.round(clampNum(obj.etaMin, 0, 600))),
    reason: typeof obj.reason === "string" ? shorten(obj.reason.trim(), 200) : "",
  };
  if ("avoidancePrompt" in obj)
    out.avoidancePrompt = parseAvoidancePromptValue(obj.avoidancePrompt);
  // nextStep is part of the regular verdict (same shorten/empty→null shape); when
  // the daemon emits "" (a decision is needed) this stores null so the UI hides it.
  if ("nextStep" in obj) out.nextStep = parseAvoidancePromptValue(obj.nextStep);
  // probe is the scrutiny-lane counterpart to nextStep — same shape, independent.
  if ("probe" in obj) out.probe = parseAvoidancePromptValue(obj.probe);
  return out;
}

export function parseAvoidancePrompt(text: string): string | null {
  const json = lastJsonObject(text);
  if (!json) return null;
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    return parseAvoidancePromptValue(obj.avoidancePrompt);
  } catch {
    return null;
  }
}

/** Parse turn classifications independently so a malformed item never discards session analysis. */
export function parseCollaborationLabels(
  text: string,
  allowedTurnIds: ReadonlySet<string>,
): CollaborationTurnLabel[] {
  const json = lastJsonObject(text);
  if (!json) return [];
  let turns: unknown;
  try {
    turns = (JSON.parse(json) as Record<string, unknown>).turns;
  } catch {
    return [];
  }
  if (!Array.isArray(turns)) return [];
  const labels: CollaborationTurnLabel[] = [];
  const seen = new Set<string>();
  for (const raw of turns) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const turnId = typeof item.turnId === "string" ? item.turnId.trim() : "";
    if (!turnId || seen.has(turnId) || !allowedTurnIds.has(turnId)) continue;
    if (
      !isCollaborationIntent(item.intent) ||
      !isCollaborationSteering(item.steering) ||
      !isCollaborationFeedbackTarget(item.feedbackTarget)
    )
      continue;
    const researchSource =
      item.intent === "research" &&
      (item.researchSource === "official" ||
        item.researchSource === "community" ||
        item.researchSource === "repository" ||
        item.researchSource === "other")
        ? item.researchSource
        : undefined;
    const confidence = Number(item.confidence);
    labels.push({
      turnId,
      intent: item.intent,
      ...(researchSource ? { researchSource } : {}),
      steering: item.steering,
      feedbackTarget: item.feedbackTarget,
      handoff: parseCollaborationHandoff(item.handoff),
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    });
    seen.add(turnId);
  }
  return labels;
}

function parseAvoidancePromptValue(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? shorten(v.trim(), 500) : null;
}

const ANALYSIS_STATES = new Set<AnalysisState>([
  "continue_ready",
  "needs_decision",
  "needs_input",
  "blocked",
  "needs_review",
  "followup_suggested",
  "done",
]);

function parseState(v: unknown): AnalysisState | null {
  if (typeof v !== "string") return null;
  const state = v.trim() as AnalysisState;
  return ANALYSIS_STATES.has(state) ? state : null;
}

function clampNum(v: unknown, lo: number, hi: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n * 10) / 10));
}

function shorten(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Last balanced top-level `{...}` in the text (string-aware so braces inside
 *  quoted values don't throw off the depth count). */
function lastJsonObject(text: string): string | null {
  let depth = 0;
  let start = -1;
  let best: string | null = null;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"' && depth > 0) inStr = true;
    else if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) best = text.slice(start, i + 1);
    }
  }
  return best;
}
