import type { Pattern } from "../core/types.js";
import { esc } from "./escape.js";

export interface SessionBriefRef {
  name: string;
  path: string;
  score: number;
  reason: string;
  pattern: Pattern;
}

export interface SessionView {
  vendor: string;
  sessionId: string | null;
  title: string;
  cwd: string | null;
  project: string;
  ageDays: number | null;
  prompts: number;
  actions: number;
  brief: SessionBriefRef | null;
}

export interface SessionsView {
  sessions: SessionView[];
  knownDirs: string[];
  briefCount: number;
  memoryTerms: number;
}

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
    max-width: 1000px; margin: 1.5rem auto; padding: 0 1rem; color: #1f2937; background: #fafafa; }
  a { color: #2563eb; text-decoration: none; }
  .topbar { display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 0.4rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb; }
  h1 { font-size: 1.05rem; font-weight: 600; margin: 0; }
  h1 .accent { color: #6b7280; font-weight: 400; font-size: 0.85rem; margin-left: 0.5rem; }
  .links { font-size: 0.85rem; }
  .links button { margin-left: 0.4rem; }
  button { background: white; border: 1px solid #d1d5db; padding: 0.3rem 0.7rem; cursor: pointer;
    border-radius: 4px; font-size: 0.85rem; color: #1f2937; }
  button:hover { background: #f3f4f6; }
  button:disabled { opacity: 0.6; cursor: default; }
  .newbar { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.7rem 0.9rem;
    margin: 0.9rem 0 1.1rem; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
  .newbar .lab { font-size: 0.72rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; width: 100%; }
  .newbar select, .newbar input { font-size: 0.85rem; padding: 0.3rem 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; background: white; }
  .newbar input.path { flex: 1; min-width: 200px; }
  .newbar input.prompt { flex: 2; min-width: 220px; }
  .newbar .go { background: #1f2937; color: white; border-color: #1f2937; }
  .newbar .go:hover { background: #111827; }
  .nmsg { width: 100%; font-size: 0.78rem; color: #6b7280; font-family: ui-monospace, monospace; }
  .sess { background: white; border: 1px solid #e5e7eb; border-left: 3px solid #d1d5db;
    border-radius: 0 6px 6px 0; padding: 0.6rem 0.9rem; margin-bottom: 0.6rem; }
  .sess.claude { border-left-color: #7c3aed; }
  .sess.codex { border-left-color: #0891b2; }
  .srow1 { display: flex; justify-content: space-between; align-items: baseline; gap: 0.6rem; }
  .title { font-weight: 600; font-size: 0.92rem; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title.empty { color: #9ca3af; font-weight: 400; font-style: italic; }
  .vendor { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.08rem 0.4rem;
    border-radius: 3px; background: #ede9fe; color: #5b21b6; }
  .sess.codex .vendor { background: #cffafe; color: #155e75; }
  .acts { display: inline-flex; gap: 0.35rem; flex-shrink: 0; }
  .acts button { padding: 0.15rem 0.5rem; font-size: 0.74rem; }
  .acts button.ok { color: #166534; border-color: #bbf7d0; background: #f0fdf4; }
  .acts button.err { color: #9a3412; border-color: #fed7aa; background: #fffbeb; }
  .meta { font-size: 0.74rem; color: #6b7280; margin-top: 0.3rem; font-family: ui-monospace, "Cascadia Mono", monospace;
    display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
  .proj { color: #374151; }
  .brieftag { font-size: 0.72rem; padding: 0.05rem 0.4rem; border-radius: 3px; background: #f1f5f9; color: #334155; }
  .brieftag.avoidance { background: #fed7aa; color: #9a3412; }
  .brieftag.stalled { background: #d1d5db; color: #1f2937; }
  .brieftag.healthy { background: #bbf7d0; color: #166534; }
  .brieftag.active { background: #ddd6fe; color: #5b21b6; }
  .brieftag.fresh { background: #bfdbfe; color: #1e3a8a; }
  .empty { color: #9ca3af; padding: 2.5rem 1rem; text-align: center; border: 1px dashed #d1d5db;
    background: white; border-radius: 6px; }
  code { background: #eef2ff; color: #3730a3; padding: 0.05rem 0.35rem; border-radius: 3px; }
`;

function sessionCard(s: SessionView): string {
  const hasId = !!s.sessionId && !!s.cwd;
  const data = `data-vendor="${esc(s.vendor)}" data-cwd="${esc(s.cwd ?? "")}" data-id="${esc(s.sessionId ?? "")}"`;
  const acts = hasId
    ? `<span class="acts">
        <button ${data} onclick="act(this,'resume')" title="continue this session in a terminal">continue ▸</button>
        <button ${data} onclick="act(this,'fork')" title="branch this session into a fork">split ⑂</button>
      </span>`
    : `<span class="acts"><button disabled title="no session id">no id</button></span>`;
  const brief = s.brief
    ? `<a class="brieftag ${esc(s.brief.pattern)}" href="/brief?path=${encodeURIComponent(s.brief.path)}" title="${esc(s.brief.reason)}">▸ ${esc(s.brief.name)} · ${s.brief.score.toFixed(1)}</a>`
    : `<span class="brieftag">no brief</span>`;
  const age = s.ageDays !== null ? `${s.ageDays}d ago` : "—";
  const title = s.title
    ? `<span class="title">${esc(s.title)}</span>`
    : `<span class="title empty">(no prompt)</span>`;
  return `
<div class="sess ${esc(s.vendor)}">
  <div class="srow1">
    ${title}
    ${acts}
  </div>
  <div class="meta">
    <span class="vendor">${esc(s.vendor)}</span>
    <span class="proj">${esc(s.project)}</span>
    <span>${s.prompts}p / ${s.actions}a</span>
    <span>${age}</span>
    ${brief}
  </div>
</div>`;
}

export function renderSessions(v: SessionsView): string {
  const dirOptions = v.knownDirs
    .map((d) => `<option value="${esc(d)}">${esc(d)}</option>`)
    .join("");
  const list = v.sessions.length
    ? v.sessions.map(sessionCard).join("")
    : `<div class="empty">No sessions found in your Claude / Codex transcript folders.<br>Start one below, or with <code>claude</code> / <code>codex</code> in a project.</div>`;

  return `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="utf-8"><title>attend — sessions</title><style>${STYLE}</style></head>
<body>
<div class="topbar">
  <h1>attend <span class="accent">${v.sessions.length} sessions · ${v.briefCount} briefs · memory terms: ${v.memoryTerms}</span></h1>
  <span class="links"><a href="/briefs">briefs ▸</a><button onclick="location.reload()">↻ refresh</button></span>
</div>

<div class="newbar">
  <span class="lab">new session</span>
  <select id="nv"><option value="claude">claude</option><option value="codex">codex</option></select>
  <select id="ndsel"><option value="">— pick a project dir —</option>${dirOptions}</select>
  <input class="path" id="ndfree" placeholder="…or paste an absolute path (overrides dropdown)">
  <input class="prompt" id="np" placeholder="optional first prompt">
  <button class="go" id="nbtn" onclick="newSession()">new session ▸</button>
  <div class="nmsg" id="nmsg"></div>
</div>

${list}

<script>
function post(params) {
  return fetch('/launch?' + new URLSearchParams(params), { method: 'POST' }).then(r => r.json());
}
function act(btn, action) {
  const d = btn.dataset;
  btn.disabled = true;
  post({ action, vendor: d.vendor, cwd: d.cwd, id: d.id }).then(res => {
    btn.classList.add(res.ok ? 'ok' : 'err');
    btn.textContent = res.ok ? 'opened ✓' : (res.error || 'failed');
    if (!res.ok) { btn.disabled = false; setTimeout(() => { btn.classList.remove('err'); }, 2000); }
  });
}
function newSession() {
  const vendor = document.getElementById('nv').value;
  const free = document.getElementById('ndfree').value.trim();
  const cwd = free || document.getElementById('ndsel').value;
  const prompt = document.getElementById('np').value;
  const msg = document.getElementById('nmsg');
  if (!cwd) { msg.textContent = 'pick or paste a directory first'; return; }
  const btn = document.getElementById('nbtn');
  btn.disabled = true;
  post({ action: 'new', vendor, cwd, prompt }).then(res => {
    msg.textContent = res.ok ? ('opened in terminal: ' + res.command) : ('error: ' + res.error);
    btn.disabled = false;
  });
}
</script>
</body>
</html>`;
}
