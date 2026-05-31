import type { Brief, Pattern, RawSession, Telemetry } from "../core/types.js";
import { esc } from "./escape.js";

const STYLE = `
  * { box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
    max-width: 820px; margin: 1.5rem auto; padding: 0 1rem;
    color: #1f2937; background: #fafafa;
  }
  a { color: #1d4ed8; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .back { font-size: 0.85rem; color: #6b7280; }
  h1 { font-size: 1.2rem; margin: 0.5rem 0 0.2rem; display: flex; justify-content: space-between; align-items: baseline; }
  .pattern {
    text-transform: uppercase; font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 3px;
    background: #e5e7eb; color: #374151; letter-spacing: 0.05em; font-weight: 500;
  }
  .pattern.avoidance { background: #fed7aa; color: #9a3412; }
  .pattern.stalled   { background: #d1d5db; color: #1f2937; }
  .pattern.healthy   { background: #bbf7d0; color: #166534; }
  .pattern.active    { background: #ddd6fe; color: #5b21b6; }
  .pattern.fresh     { background: #bfdbfe; color: #1e3a8a; }
  .reason { color: #6b7280; font-size: 0.85rem; margin-bottom: 1.2rem; }
  .card { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.8rem 1rem; margin-bottom: 1rem; }
  .label { font-size: 0.72rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.3rem; }
  pre {
    background: #f3f4f6; padding: 0.6rem 0.8rem; border-radius: 4px; overflow-x: auto;
    font-size: 0.8rem; margin: 0.3rem 0; font-family: ui-monospace, "Cascadia Mono", monospace;
  }
  button {
    background: #1f2937; color: white; border: none; padding: 0.4rem 0.9rem;
    cursor: pointer; border-radius: 4px; font-size: 0.85rem; margin-right: 0.4rem;
  }
  button:hover { background: #111827; }
  .telemetry-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.5rem; margin-top: 0.5rem; }
  .metric { background: #f9fafb; padding: 0.5rem; border-radius: 4px; border: 1px solid #f3f4f6; }
  .metric .v { font-size: 1.05rem; font-weight: 600; }
  .metric .k { font-size: 0.7rem; color: #6b7280; text-transform: uppercase; }
  .session-row {
    display: flex; justify-content: space-between; padding: 0.3rem 0; border-bottom: 1px solid #f3f4f6;
    font-size: 0.82rem; font-family: ui-monospace, "Cascadia Mono", monospace;
  }
  .session-row:last-child { border-bottom: none; }
  .session-row .when { color: #6b7280; }
  .session-right { display: inline-flex; align-items: center; gap: 0.5rem; }
  .fork-btn {
    background: #fff; color: #1f2937; border: 1px solid #d1d5db;
    padding: 0.1rem 0.45rem; font-size: 0.72rem; border-radius: 4px; cursor: pointer;
  }
  .fork-btn:hover { background: #f3f4f6; }
  .fork-btn.ok  { color: #166534; border-color: #bbf7d0; background: #f0fdf4; }
  .fork-btn.err { color: #9a3412; border-color: #fed7aa; background: #fffbeb; }
  .hint { font-size: 0.72rem; color: #9ca3af; margin-top: 0.4rem; }
  .path { font-family: ui-monospace, monospace; font-size: 0.78rem; color: #6b7280; }
  .body { white-space: pre-wrap; line-height: 1.5; }
`;

export interface DetailView {
  brief: Brief;
  telemetry: Telemetry;
  pattern: Pattern;
  score: number;
  reason: string;
  sessions: RawSession[];
  spawnClaude: string;
  spawnCodex: string;
}

function metric(value: string, key: string): string {
  return `<div class="metric"><div class="v">${value}</div><div class="k">${key}</div></div>`;
}

function baseName(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] ?? p;
}

function sessionRow(s: RawSession): string {
  const when = s.lastTs !== null ? new Date(s.lastTs).toISOString().slice(0, 10) : "";
  const forkBtn =
    s.sessionId && s.cwd
      ? `<button class="fork-btn" data-vendor="${esc(s.vendor)}" data-id="${esc(s.sessionId)}" data-cwd="${esc(s.cwd)}" onclick="forkSession(this)" title="branch this session into a new fork (opens a terminal)">split ⑂</button>`
      : "";
  return `<div class="session-row">
    <span>${esc(baseName(s.path))}</span>
    <span class="session-right"><span class="when">${when} · ${s.prompts}p / ${s.actions}a</span>${forkBtn}</span>
  </div>`;
}

export function renderDetail(v: DetailView): string {
  const t = v.telemetry;
  const avg = t.avgSessionMin ? `${Math.round(t.avgSessionMin)}m` : "—";
  const lastAction = t.lastActionAgeDays !== null ? `${t.lastActionAgeDays}d` : "—";
  const lastTouch = t.lastTouchAgeDays !== null ? `${t.lastTouchAgeDays}d` : "—";
  const sessionsCard = v.sessions.length
    ? `<div class="card">
  <div class="label">recent sessions (${v.sessions.length})</div>
  ${v.sessions.map(sessionRow).join("")}
  <div class="hint">split ⑂ forks a session into a new branch via the vendor CLI in a new terminal; the fork appears here on refresh.</div>
</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>${esc(v.brief.name)} — attend</title>
<style>${STYLE}</style>
</head>
<body>
<div class="back"><a href="/">← all briefs</a></div>
<h1>${esc(v.brief.name)} <span class="pattern ${v.pattern}">${esc(v.pattern)}</span></h1>
<div class="reason">score ${v.score.toFixed(1)} · ${esc(v.reason)}</div>

<div class="card"><div class="label">what</div><div class="body">${esc(v.brief.what)}</div></div>
<div class="card"><div class="label">accept</div><div class="body">${esc(v.brief.accept)}</div></div>
<div class="card"><div class="label">next</div><div class="body">${esc(v.brief.next)}</div></div>

<div class="card">
  <div class="label">telemetry</div>
  <div class="telemetry-grid">
    ${metric(String(t.sessions), "sessions")}
    ${metric(String(t.prompts), "prompts")}
    ${metric(String(t.actions), "actions")}
    ${metric(avg, "avg dwell")}
    ${metric(lastAction, "last action")}
    ${metric(lastTouch, "last touch")}
  </div>
</div>

${sessionsCard}

<div class="card">
  <div class="label">spawn (copy to terminal)</div>
  <div style="margin: 0.5rem 0;">
    <button onclick="copyCmd('claude-cmd')">copy claude</button>
    <button onclick="copyCmd('codex-cmd')">copy codex</button>
  </div>
  <pre id="claude-cmd">${esc(v.spawnClaude)}</pre>
  <pre id="codex-cmd">${esc(v.spawnCodex)}</pre>
</div>

<div class="card"><div class="label">file</div><div class="path">${esc(v.brief.path)}</div></div>

<script>
function forkSession(btn) {
  const q = new URLSearchParams({
    vendor: btn.dataset.vendor,
    id: btn.dataset.id,
    cwd: btn.dataset.cwd,
  });
  btn.disabled = true;
  const orig = btn.textContent;
  fetch("/fork?" + q.toString(), { method: "POST" })
    .then((r) => r.json())
    .then((res) => {
      if (res.ok) {
        btn.textContent = "forked ✓";
        btn.classList.add("ok");
      } else {
        btn.textContent = res.error || "failed";
        btn.classList.add("err");
        btn.disabled = false;
      }
    })
    .catch(() => {
      btn.textContent = "failed";
      btn.classList.add("err");
      btn.disabled = false;
    });
  void orig;
}
function copyCmd(id) {
  const text = document.getElementById(id).textContent;
  navigator.clipboard.writeText(text).then(() => {
    document.querySelectorAll("button").forEach(b => {
      if (b.getAttribute("onclick") === "copyCmd('" + id + "')") {
        const orig = b.textContent;
        b.textContent = "copied ✓";
        setTimeout(() => { b.textContent = orig; }, 1200);
      }
    });
  });
}
</script>
</body>
</html>`;
}
