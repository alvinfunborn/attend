import type { Pattern, RankedBrief } from "../core/types.js";
import { esc } from "./escape.js";

const STYLE = `
  * { box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
    max-width: 980px; margin: 1.5rem auto; padding: 0 1rem;
    color: #1f2937; background: #fafafa;
  }
  .topbar {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 0.4rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb;
  }
  h1 { font-size: 1.05rem; font-weight: 600; margin: 0; letter-spacing: -0.01em; }
  h1 .accent { color: #6b7280; font-weight: 400; font-size: 0.85rem; margin-left: 0.5rem; }
  .help { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.9rem; }
  .help code { background: #eef2ff; color: #3730a3; padding: 0.05rem 0.35rem; border-radius: 3px; }
  button {
    background: white; border: 1px solid #d1d5db; padding: 0.3rem 0.7rem;
    cursor: pointer; border-radius: 4px; font-size: 0.85rem; color: #1f2937;
  }
  button:hover { background: #f3f4f6; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem; }
  .chip { font-size: 0.76rem; padding: 0.2rem 0.6rem; border-radius: 999px; }
  .chip.active { background: #1f2937; color: white; border-color: #1f2937; }
  a.brief {
    display: block; text-decoration: none; color: inherit;
    border-left: 3px solid #d1d5db; padding: 0.7rem 1rem; margin-bottom: 0.7rem;
    background: white; border-radius: 0 6px 6px 0;
    transition: box-shadow 0.12s ease, transform 0.12s ease;
  }
  a.brief:hover { box-shadow: 0 2px 10px rgba(0,0,0,0.08); transform: translateX(2px); }
  a.brief:hover .open { opacity: 1; }
  .brief.avoidance { border-color: #d97706; background: #fffbeb; }
  .brief.stalled   { border-color: #6b7280; background: #f9fafb; }
  .brief.healthy   { border-color: #059669; background: #f0fdf4; }
  .brief.active    { border-color: #7c3aed; background: #faf5ff; }
  .brief.fresh     { border-color: #2563eb; background: #eff6ff; }
  .brief.unknown   { border-color: #d1d5db; }
  .brief.done      { opacity: 0.45; }
  .title { font-weight: 600; font-size: 0.98rem; display: flex; justify-content: space-between; align-items: baseline; }
  .name { color: #111827; }
  a.brief:hover .name { text-decoration: underline; }
  .badges { font-size: 0.75rem; color: #6b7280; font-weight: 400; display: inline-flex; align-items: baseline; gap: 0.4rem; }
  .badges .pattern {
    text-transform: uppercase; letter-spacing: 0.04em; padding: 0.1rem 0.4rem;
    border-radius: 3px; background: #e5e7eb; color: #374151;
  }
  .open { color: #2563eb; font-weight: 500; opacity: 0.5; transition: opacity 0.12s ease; }
  .brief.avoidance .pattern { background: #fed7aa; color: #9a3412; }
  .brief.stalled   .pattern { background: #d1d5db; color: #1f2937; }
  .brief.healthy   .pattern { background: #bbf7d0; color: #166534; }
  .brief.active    .pattern { background: #ddd6fe; color: #5b21b6; }
  .brief.fresh     .pattern { background: #bfdbfe; color: #1e3a8a; }
  .brief.done      .pattern { background: #e5e7eb; color: #6b7280; }
  .what { color: #4b5563; font-size: 0.9rem; margin: 0.3rem 0 0.2rem; }
  .next {
    color: #1f2937; font-size: 0.9rem; margin: 0.3rem 0; padding: 0.35rem 0.6rem;
    background: rgba(0,0,0,0.04); border-radius: 3px;
  }
  .next::before { content: "next · "; color: #6b7280; font-size: 0.75rem; }
  .meta { font-size: 0.75rem; color: #6b7280; margin-top: 0.4rem; font-family: ui-monospace, "Cascadia Mono", monospace; }
  .reason { color: #4b5563; font-style: italic; }
  .empty {
    color: #9ca3af; padding: 3rem 1rem; text-align: center;
    border: 1px dashed #d1d5db; background: white; border-radius: 6px;
  }
  .empty code { background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 3px; }
`;

const PILL_ORDER: Pattern[] = ["avoidance", "stalled", "active", "fresh", "healthy", "unknown"];

function metaLine(r: RankedBrief): string {
  const t = r.telemetry;
  if (!t.sessions) return `no sessions yet · <span class="reason">${esc(r.reason)}</span>`;
  const bits = [`${t.sessions} sessions · ${t.prompts} prompts · ${t.actions} actions`];
  if (t.avgSessionMin) bits.push(`avg ${Math.round(t.avgSessionMin)}m`);
  if (t.lastTouchAgeDays !== null) bits.push(`touched ${t.lastTouchAgeDays}d ago`);
  return `${bits.join(" · ")} · <span class="reason">${esc(r.reason)}</span>`;
}

function card(r: RankedBrief): string {
  const b = r.brief;
  const isDone = b.status === "done";
  const badge = isDone ? "done" : r.pattern;
  return `
<a class="brief ${r.pattern}${isDone ? " done" : ""}" href="/brief?path=${encodeURIComponent(b.path)}" data-pattern="${isDone ? "done" : r.pattern}">
  <div class="title">
    <span class="name">${esc(b.name)}</span>
    <span class="badges"><span class="pattern">${esc(badge)}</span>score ${r.score.toFixed(1)}<span class="open">open →</span></span>
  </div>
  ${b.what ? `<div class="what">${esc(b.what)}</div>` : ""}
  ${b.next ? `<div class="next">${esc(b.next)}</div>` : ""}
  <div class="meta">${metaLine(r)}</div>
</a>`;
}

export function renderFeed(
  ranked: RankedBrief[],
  counts: Record<Pattern, number>,
  memoryTerms: number,
): string {
  const chips = [
    `<button class="chip active" data-f="all">all ${ranked.length}</button>`,
    ...PILL_ORDER.filter((p) => counts[p]).map(
      (p) => `<button class="chip" data-f="${p}">${p} ${counts[p]}</button>`,
    ),
  ].join("");
  const body = ranked.length
    ? ranked.map(card).join("")
    : `<div class="empty">No <code>brief.md</code> found in any vault root.<br>Create one with <code>attend new &lt;name&gt;</code> to start.</div>`;
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>attend</title>
<style>${STYLE}</style>
</head>
<body>
<div class="topbar">
  <h1>attend <span class="accent">${ranked.length} briefs · memory terms: ${memoryTerms}</span></h1>
  <button onclick="location.reload()">↻ refresh</button>
</div>
<div class="help">Ranked by what needs you next. <b>Click a brief</b> to see telemetry + spawn/split actions. New brief: <code>attend new &lt;name&gt;</code></div>
<div class="chips">${chips}</div>
${body}
<script>
  const chips = Array.from(document.querySelectorAll('.chip'));
  const cards = Array.from(document.querySelectorAll('a.brief'));
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      for (const c of chips) c.classList.remove('active');
      chip.classList.add('active');
      const f = chip.dataset.f;
      for (const card of cards) {
        card.style.display = f === 'all' || card.dataset.pattern === f ? '' : 'none';
      }
    });
  }
</script>
</body>
</html>`;
}
