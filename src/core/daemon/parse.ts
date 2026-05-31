import type { Analysis } from "./cache.js";

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
  return {
    brief: shorten(brief, 80),
    priority: clampNum(obj.priority, 0, 10),
    etaMin: Math.max(1, Math.round(clampNum(obj.etaMin, 0, 600))),
    reason: typeof obj.reason === "string" ? shorten(obj.reason.trim(), 200) : "",
  };
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
    if (ch === '"') inStr = true;
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
