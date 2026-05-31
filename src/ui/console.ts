import type { Pattern } from "../core/types.js";
import type { VendorAvailability } from "../core/vendor/detect.js";

export interface SessionView {
  vendor: string;
  sessionId: string | null;
  /** first user prompt — the first subtitle */
  title: string;
  /** latest user prompt — the second subtitle */
  lastPrompt: string | null;
  cwd: string | null;
  project: string;
  file: string;
  ageDays: number | null;
  /** epoch ms of last activity — lets the tab show fine-grained "刚刚/Xm前/Xh前" */
  lastTs: number | null;
  prompts: number;
  /** behavioral observation, session-derived */
  pattern: Pattern;
  /** priority — from the session's daemon analyzer, else heuristic fallback */
  score: number;
  reason: string;
  /** minutes to handle — from the daemon, else memory-derived fallback */
  etaMin: number;
  /** true when the score is a manual override (pinned by clicking the tab) */
  priorityset?: boolean;
  /** true when the ETA is a manual override (pinned by clicking the tab) */
  etaset?: boolean;
  /** the daemon's ≤8-word brief (the tab title); null until analyzed (→ first prompt fallback) */
  brief: string | null;
}

export interface ConsoleView {
  sessions: SessionView[];
  knownDirs: string[];
  /** sessions touched in the trailing 24h, as an hourly rate */
  sessionsPerHour: number;
  /** characters processed in the trailing 24h, as an hourly rate */
  charsPerHour: number;
  /** locally-detected vendor CLIs — populates the "+ new" provider picker */
  vendors: VendorAvailability[];
}

const STYLE = `
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { font-family: ui-sans-serif, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
    color: #1f2937; background: #f3f4f6; display: flex; height: 100vh; overflow: hidden; }
  button { cursor: pointer; border-radius: 5px; border: 1px solid #d1d5db; background: white; font-size: 0.8rem; padding: 0.25rem 0.6rem; }
  button:hover { background: #f3f4f6; }
  /* sidebar */
  .side { width: 320px; flex-shrink: 0; background: #fafafa; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; }
  /* draggable divider to widen/narrow the sidebar */
  .resizer { width: 6px; flex-shrink: 0; cursor: col-resize; background: transparent; transition: background 0.15s; }
  .resizer:hover, .resizer.dragging { background: #c7d2fe; }
  .side h1 { font-size: 0.95rem; margin: 0; padding: 0.8rem 0.9rem 0.5rem; }
  .side h1 .accent { color: #9ca3af; font-weight: 400; font-size: 0.72rem; }
  .side .topnav { padding: 0 0.9rem 0.6rem; display: flex; gap: 0.4rem; border-bottom: 1px solid #e5e7eb; }
  .side .topnav a { font-size: 0.78rem; color: #2563eb; text-decoration: none; align-self: center; margin-left: auto; }
  .searchbox { flex: 1; min-width: 0; font-size: 0.78rem; padding: 0.25rem 0.5rem; border: 1px solid #d1d5db; border-radius: 5px; }
  .searchbox:focus { outline: none; border-color: #6366f1; }
  .newbox { padding: 0.6rem 0.9rem; border-bottom: 1px solid #e5e7eb; display: none; flex-direction: column; gap: 0.4rem; background: #fff; }
  .newbox.open { display: flex; }
  .newbox select, .newbox input, .newbox textarea { font-size: 0.8rem; padding: 0.3rem 0.45rem; border: 1px solid #d1d5db; border-radius: 4px; width: 100%; box-sizing: border-box; }
  .newbox textarea { resize: vertical; min-height: 2.2rem; font: inherit; font-size: 0.8rem; }
  .newbox .nmsg { font-size: 0.72rem; color: #9ca3af; }
  #list { overflow-y: auto; flex: 1; }
  #list .empty { padding: 1.2rem 0.9rem; color: #9ca3af; font-size: 0.8rem; text-align: center; }
  .item { padding: 0.55rem 0.9rem; border-bottom: 1px solid #f0f0f0; cursor: pointer; }
  .item:hover { background: #f1f5f9; }
  .item.active { background: #eef2ff; border-left: 3px solid #6366f1; padding-left: calc(0.9rem - 3px); }
  .it-titlerow { display: flex; align-items: center; gap: 0.45rem; }
  .it-title { font-size: 0.84rem; font-weight: 600; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
  .it-status { flex-shrink: 0; width: 0.5em; height: 0.5em; border-radius: 50%; background: #d1d5db; }
  .it-status.on { background: #10b981; animation: gpulse 1s ease-in-out infinite; }
  .it-firstline { font-size: 0.72rem; color: #6b7280; margin-top: 0.1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .it-meta { font-size: 0.7rem; color: #6b7280; margin-top: 0.2rem; font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem; }
  .pat { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.03em; padding: 0.02rem 0.3rem; border-radius: 3px; background: #e5e7eb; color: #374151; flex-shrink: 0; }
  .pat.avoidance { background: #fed7aa; color: #9a3412; }
  .pat.stalled { background: #d1d5db; color: #1f2937; }
  .pat.healthy { background: #bbf7d0; color: #166534; }
  .pat.active { background: #ddd6fe; color: #5b21b6; }
  .pat.fresh { background: #bfdbfe; color: #1e3a8a; }
  .it-reason { font-size: 0.68rem; color: #9ca3af; margin-top: 0.2rem; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .it-title.pending { color: #9ca3af; font-weight: 500; }
  .b-pri { flex-shrink: 0; font-weight: 600; color: #b91c1c; background: #fef2f2; padding: 0.02rem 0.32rem; border-radius: 3px; cursor: pointer; }
  .b-eta { flex-shrink: 0; color: #b45309; background: #fffbeb; padding: 0.02rem 0.32rem; border-radius: 3px; cursor: pointer; }
  #h-sig .score, #h-sig .eta { cursor: pointer; }
  /* a manually-pinned priority/ETA: dashed underline marks it as user-set */
  .b-pri.edited, .b-eta.edited, #h-sig .score.edited, #h-sig .eta.edited { text-decoration: underline dashed; text-underline-offset: 2px; }
  /* inline editor that replaces a badge while editing */
  .badge-edit { width: 3rem; font-size: 0.7rem; padding: 0 0.25rem; border: 1px solid #6366f1; border-radius: 3px; }
  .b-ctx { overflow: hidden; text-overflow: ellipsis; }
  .sortsel { font-size: 0.72rem; border: 1px solid #d1d5db; border-radius: 4px; padding: 0.1rem 0.3rem; background: white; }
  /* main */
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: white; }
  .head { padding: 0.7rem 1rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
  .head .t { font-weight: 600; font-size: 0.95rem; }
  .head .s { font-size: 0.72rem; color: #9ca3af; font-family: ui-monospace, monospace; }
  .head .s.brief { font-family: inherit; color: #4b5563; font-size: 0.78rem; max-width: 70ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #h-sig { display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; margin-top: 0.3rem; font-size: 0.72rem; }
  #h-sig .score { font-weight: 600; color: #374151; }
  #h-sig .brieftag { padding: 0.05rem 0.4rem; border-radius: 3px; background: #eef2ff; color: #3730a3; text-decoration: none; }
  #h-sig .brieftag:hover { background: #e0e7ff; }
  #h-sig .eta { color: #b45309; background: #fffbeb; padding: 0.05rem 0.4rem; border-radius: 3px; }
  #h-sig .briefref { color: #3730a3; background: #eef2ff; padding: 0.05rem 0.4rem; border-radius: 3px; }
  #h-sig .sig-reason { color: #9ca3af; font-style: italic; }
  .sig { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; margin-top: 0.3rem; font-size: 0.72rem; color: #6b7280; }
  .sig .score { font-weight: 600; color: #374151; }
  .sig .reason { font-style: italic; }
  .sig .briefref { color: #2563eb; text-decoration: none; background: #eff6ff; padding: 0.05rem 0.4rem; border-radius: 3px; }
  .sig .eta { color: #047857; background: #ecfdf5; padding: 0.05rem 0.4rem; border-radius: 3px; }
  #msgs { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
  .msg { display: flex; }
  .msg.user { justify-content: flex-end; }
  .msg .bubble { max-width: 76%; padding: 0.5rem 0.75rem; border-radius: 10px; font-size: 0.88rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .msg.user .bubble { background: #4f46e5; color: white; border-bottom-right-radius: 3px; }
  .msg.assistant .bubble { background: #f3f4f6; color: #111827; border-bottom-left-radius: 3px; }
  .msg.thinking .bubble { color: #6b7280; font-style: italic; background: #f9fafb; border: 1px dashed #e5e7eb; }
  .msg.thinking .bubble::after { content: ""; display: inline-block; width: 0.5em; height: 0.5em; margin-left: 0.4em; border-radius: 50%; background: #9ca3af; animation: gpulse 1s ease-in-out infinite; }
  @keyframes gpulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
  .msg.error .bubble { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .tool { align-self: flex-start; font-family: ui-monospace, monospace; font-size: 0.72rem; color: #5b21b6; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; padding: 0.2rem 0.5rem; }
  .toolc { align-self: flex-start; max-width: 88%; font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.74rem; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; }
  .toolc > summary { cursor: pointer; padding: 0.28rem 0.6rem; color: #5b21b6; list-style: none; user-select: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .toolc > summary::-webkit-details-marker { display: none; }
  .toolc > summary::before { content: "▸ "; color: #a78bda; }
  .toolc[open] > summary::before { content: "▾ "; }
  .toolc[open] > summary { border-bottom: 1px solid #ede9fe; }
  .toolc pre { margin: 0; padding: 0.45rem 0.6rem; white-space: pre-wrap; word-break: break-word; max-height: 340px; overflow: auto; }
  .toolc .tool-in { color: #4b5563; }
  .toolc .tool-out { color: #111827; background: #fbfbfe; border-top: 1px solid #ede9fe; }
  .toolc .tool-out.err { color: #991b1b; background: #fef2f2; }
  /* git-diff-style rendering for Edit / MultiEdit / Write (expanded by default) */
  .toolc .diff { background: #fbfbfe; border-top: 1px solid #ede9fe; overflow: auto; max-height: 460px; font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.74rem; }
  .toolc .diff-sep { height: 0.45rem; background: #f5f3ff; border-top: 1px dashed #ddd6fe; border-bottom: 1px dashed #ddd6fe; }
  .dline { display: flex; align-items: flex-start; padding: 0 0.4rem; line-height: 1.45; }
  .dline .dsign { width: 1.4ch; flex-shrink: 0; text-align: center; user-select: none; opacity: 0.7; }
  .dline .dtext { white-space: pre-wrap; word-break: break-word; flex: 1; min-width: 0; }
  .dline.add { background: #e6f7ec; color: #14532d; }
  .dline.add .dsign { color: #15803d; }
  .dline.del { background: #fde8e8; color: #7f1d1d; }
  .dline.del .dsign { color: #b91c1c; }
  .dline.ctx { color: #6b7280; }
  .placeholder { margin: auto; color: #9ca3af; text-align: center; font-size: 0.9rem; }
  .foot { border-top: 1px solid #e5e7eb; padding: 0.6rem 1rem; display: flex; gap: 0.5rem; }
  .foot textarea { flex: 1; resize: none; height: 2.4rem; padding: 0.5rem 0.6rem; border: 1px solid #d1d5db; border-radius: 6px; font: inherit; font-size: 0.88rem; }
  .foot button.send { background: #1f2937; color: white; border-color: #1f2937; padding: 0 1rem; }
  .foot button.send.stopping { background: #b91c1c; border-color: #b91c1c; }
  .foot button.send.stopping:hover { background: #991b1b; }
  /* messages typed mid-turn: queued client-side, pinned above the composer
   *  (Codex-style), each editable/removable, auto-sent one per turn on turn end. */
  #queue { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.4rem 1rem 0; }
  #queue:empty { display: none; }
  .qitem { display: flex; align-items: center; gap: 0.45rem; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 0.3rem 0.4rem 0.3rem 0.55rem; }
  .qitem .qtag { font-size: 0.62rem; color: #4338ca; background: #e0e7ff; border-radius: 3px; padding: 0.05rem 0.32rem; flex-shrink: 0; }
  .qitem .qtext { flex: 1; min-width: 0; font-size: 0.82rem; color: #312e81; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .qitem button { font-size: 0.72rem; padding: 0.1rem 0.45rem; flex-shrink: 0; }
  .qitem button.qdel { color: #b91c1c; border-color: #fecaca; }
  .qitem button.qdel:hover { background: #fef2f2; }
  .foot button.splitbtn { color: #5b21b6; border-color: #ddd6fe; background: #f5f3ff; padding: 0 0.8rem; }
  .foot button.splitbtn:hover:not(:disabled) { background: #ede9fe; }
  .foot button.splitbtn:disabled { color: #c4b5fd; background: #faf5ff; cursor: default; }
  .pill { font-size: 0.66rem; padding: 0.05rem 0.4rem; border-radius: 3px; background: #ede9fe; color: #5b21b6; }
`;

export function renderConsole(v: ConsoleView): string {
  const sessJson = JSON.stringify(v.sessions).replace(/</g, "\\u003c");
  const dirsJson = JSON.stringify(v.knownDirs).replace(/</g, "\\u003c");
  const vendorsJson = JSON.stringify(v.vendors).replace(/</g, "\\u003c");
  const dirOptions = v.knownDirs
    .map((d) => `<option value="${d.replace(/"/g, "&quot;")}">${d.replace(/</g, "&lt;")}</option>`)
    .join("");
  // Provider picker: only installed CLIs are selectable; missing ones show
  // disabled with a "not detected" hint, Codex is tagged "terminal" (terminal-only).
  const firstAvail = v.vendors.find((x) => x.available);
  const vendorOptions = v.vendors
    .map((x) => {
      const tag = x.available ? (x.chat ? "" : " · terminal") : " · not detected";
      const sel = firstAvail && x.vendor === firstAvail.vendor ? " selected" : "";
      const dis = x.available ? "" : " disabled";
      return `<option value="${x.vendor}"${sel}${dis}>${x.vendor}${tag}</option>`;
    })
    .join("");

  // Throughput readout: compact hourly rates. Sub-10 session rates keep a decimal
  // (so "0.4/hr" doesn't round to a misleading 0); chars get k/M abbreviation.
  const sph =
    v.sessionsPerHour >= 10 ? String(Math.round(v.sessionsPerHour)) : v.sessionsPerHour.toFixed(1);
  const cph =
    v.charsPerHour >= 1_000_000
      ? `${(v.charsPerHour / 1_000_000).toFixed(1)}M`
      : v.charsPerHour >= 1_000
        ? `${(v.charsPerHour / 1_000).toFixed(1)}k`
        : String(Math.round(v.charsPerHour));

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Attend — console</title><style>${STYLE}</style></head>
<body>
<div class="side">
  <h1>Attend <span class="accent">${sph} sessions/hr · ${cph} chars/hr</span></h1>
  <div class="topnav">
    <button id="newToggle">+ new</button>
    <input id="search" class="searchbox" placeholder="Search sessions…" autocomplete="off">
  </div>
  <div class="newbox" id="newbox">
    <select id="nvendor">${vendorOptions}</select>
    <select id="ndsel"><option value="">— pick a project dir —</option>${dirOptions}</select>
    <input id="ndfree" placeholder="…or paste an absolute path">
    <textarea id="np" rows="2" placeholder="first message (optional · Enter to start · Shift+Enter for newline)"></textarea>
    <button id="nbtn" class="send" style="color:white;background:#1f2937;border-color:#1f2937">start session ▸</button>
    <div class="nmsg" id="nmsg"></div>
  </div>
  <div id="list"></div>
</div>
<div class="resizer" id="resizer"></div>
<div class="main">
  <div class="head">
    <div><div class="t" id="h-title">attend</div><div class="s" id="h-sub">select a session, or + new</div><div class="sig" id="h-sig"></div></div>
  </div>
  <div id="msgs"><div class="placeholder" id="ph">Pick a session on the left to see its chat, then type below to continue it — all in the browser.</div></div>
  <div id="queue"></div>
  <div class="foot">
    <textarea id="input" placeholder="message (Enter to send · Shift+Enter for newline)"></textarea>
    <button class="splitbtn" id="forkBtn" title="branch this session into a fork (uses your draft as the opening turn)" disabled>fork ⑂</button>
    <button class="send" id="send">send</button>
  </div>
</div>
<script>
window.__SESSIONS__ = ${sessJson};
window.__DIRS__ = ${dirsJson};
window.__VENDORS__ = ${vendorsJson};
</script>
<script>
(function(){
  var SESS = window.__SESSIONS__ || [];
  var cur = null, es = null, assistantEl = null;
  var genEl = null, genTimer = null, genStart = 0, turnActive = false;
  // Messages typed while a turn is generating. We don't block input anymore: the
  // draft is queued (Codex-style) and auto-sent the moment the current turn ends,
  // one per turn, in order. The Stop button discards anything still queued.
  var pendingQueue = [];
  function byId(id){ return document.getElementById(id); }
  function el(tag, cls, txt){ var e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e; }
  // Auto-scroll is "sticky": we only pull to the bottom while the user is already
  // there. If they scroll up to read mid-turn, streamed chunks must NOT yank them
  // back down — scroll(force=true) is reserved for the user's own actions (sending).
  var stick = true;
  function nearBottom(){ var m=byId('msgs'); if(!m) return true; return (m.scrollHeight - m.scrollTop - m.clientHeight) < 80; }
  function scroll(force){ var m=byId('msgs'); if(!m) return; if(force||stick){ m.scrollTop=m.scrollHeight; } }
  (function(){ var m=byId('msgs'); if(m) m.addEventListener('scroll', function(){ stick = nearBottom(); }); })();
  function clearPh(){ var p=byId('ph'); if(p) p.remove(); }

  // A persistent "生成中…" indicator pinned to the BOTTOM of the chat (the append
  // point) for the whole turn — before the first token, between text chunks, and
  // through tool calls. addMsg/addTool call keepGenLast() so it always trails the
  // stream instead of sitting at the top.
  function startGen(startedAt){
    clearGen();
    genEl=el('div','msg assistant thinking'); genEl.appendChild(el('div','bubble',''));
    // startedAt (epoch ms, from the server's sync) lets a reconnecting/ tab-switched
    // page resume the timer from the true turn start rather than restarting at 0.
    genStart=startedAt||Date.now();
    var tick=function(){ var s=Math.round((Date.now()-genStart)/1000); var b=genEl&&genEl.querySelector('.bubble');
      if(b) b.textContent = s<20 ? ('Generating… '+s+'s') : ('Generating… '+s+'s (still waiting for a reply)'); };
    tick(); genTimer=setInterval(tick,1000);
    clearPh(); byId('msgs').appendChild(genEl); scroll();
  }
  function keepGenLast(){ if(genEl) byId('msgs').appendChild(genEl); }
  function clearGen(){ if(genTimer){ clearInterval(genTimer); genTimer=null; } if(genEl){ genEl.remove(); genEl=null; } }
  // The input stays typeable even mid-turn now — drafts queue instead of being
  // blocked — so this only swaps the placeholder hint and (optionally) refocuses.
  function setInputEnabled(on){ var i=byId('input'); if(!i) return; i.disabled=false;
    i.placeholder = on ? 'message (Enter to send · Shift+Enter for newline)'
                       : 'Generating… Enter queues your message; it sends when this turn ends (Esc to stop)';
    if(on){ try{ i.focus(); }catch(e){} } }
  // The send button doubles as Stop while a turn is in flight.
  function updateSendLabel(){ var b=byId('send'); if(!b) return;
    b.textContent = turnActive ? '■ stop' : 'send';
    b.title = turnActive ? 'Stop the current generation (Esc)' : '';
    b.classList.toggle('stopping', turnActive); }
  function beginTurn(startedAt){ turnActive=true; setInputEnabled(false); updateSendLabel(); startGen(startedAt); markCurGenerating(true); }
  function endTurn(){ clearGen(); turnActive=false; setInputEnabled(true); updateSendLabel(); markCurGenerating(false); }
  function markCurGenerating(on){ if(!cur) return; cur.generating=on; applyGenerating(cur); }
  // A turn finished (result/error/abort): if drafts are queued, send the next one
  // (chaining turns); otherwise the turn truly ends and input frees up.
  function turnEnded(){
    if(pendingQueue.length){ var next=pendingQueue.shift(); renderQueue(); promoteAndSend(next); }
    else { endTurn(); if(cur) refreshAnalysis(cur); }
  }
  // Render the pinned "queued" list (above the composer). Each row: the text plus
  // an Edit (pull back into the composer) and Delete (drop) button — Codex-style.
  function renderQueue(){
    var q=byId('queue'); if(!q) return; q.innerHTML='';
    pendingQueue.forEach(function(text,i){
      var row=el('div','qitem');
      row.appendChild(el('span','qtag','queued'));
      var tx=el('div','qtext',text); tx.title=text; row.appendChild(tx);
      var eb=el('button','qedit','edit'); eb.onclick=function(){ editQueued(i); };
      var db=el('button','qdel','delete'); db.onclick=function(){ delQueued(i); };
      row.appendChild(eb); row.appendChild(db);
      q.appendChild(row);
    });
  }
  // Edit: lift the queued text back into the composer (ahead of any current draft)
  // and drop it from the queue. Re-pressing Enter mid-turn re-queues the edited text.
  function editQueued(i){ var t=pendingQueue[i]; if(t==null) return; var inp=byId('input');
    inp.value = inp.value ? (t+'\\n'+inp.value) : t; pendingQueue.splice(i,1); renderQueue(); inp.focus(); }
  function delQueued(i){ pendingQueue.splice(i,1); renderQueue(); }
  // Click priority / ETA to edit it inline: the badge becomes an <input>, commits
  // on Enter/blur (Esc cancels), POSTs the override, and pins it (wins over the
  // daemon). field is 'priority' or 'eta'.
  function editBadge(span, s, field){
    if(!s||!s.sessionId) return;
    var isPri=field==='priority';
    var curVal=isPri ? (s.score!=null?Number(s.score).toFixed(1):'') : (s.etaMin!=null?String(s.etaMin):'');
    var inp=el('input','badge-edit'); inp.value=curVal;
    inp.onclick=function(ev){ ev.stopPropagation(); };
    span.replaceWith(inp); inp.focus(); inp.select();
    var done=false;
    function finish(save){
      if(done) return; done=true;
      if(save){ var v=parseFloat(inp.value); if(!isNaN(v)) saveOverride(s, field, v); }
      renderSidebar();
      // Rebuild the header signals (priority/ETA/pattern/reason) only when the edited
      // session is the open one. Pass the session object s — not the old shadowed
      // badge value, which used to wipe the whole row.
      if(cur && cur.sessionId===s.sessionId) headerSig(s);
    }
    inp.addEventListener('keydown',function(ev){ ev.stopPropagation();
      if(ev.key==='Enter'){ ev.preventDefault(); finish(true); }
      else if(ev.key==='Escape'){ ev.preventDefault(); finish(false); } });
    inp.addEventListener('blur',function(){ finish(true); });
  }
  function saveOverride(s, field, value){
    var body={};
    if(field==='priority'){ value=Math.max(0,Math.min(10,value)); s.score=value; s.priorityset=true; body.priority=value; }
    else { value=Math.max(1,Math.round(value)); s.etaMin=value; s.etaset=true; body.etaMin=value; }
    fetch('/session/override?session='+encodeURIComponent(s.sessionId),
      {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).catch(function(){});
  }
  // Build a clickable priority/ETA badge (used in both the sidebar and the header).
  function priBadge(s, cls){
    var sp=el('span',cls+(s.priorityset?' edited':''),'priority '+Number(s.score).toFixed(1));
    sp.title='Click to set priority (0–10)'+(s.priorityset?' · manually pinned':'');
    if(s.sessionId) sp.onclick=function(ev){ ev.stopPropagation(); editBadge(sp,s,'priority'); };
    return sp;
  }
  function etaBadge(s, cls){
    var sp=el('span',cls+(s.etaset?' edited':''),'~'+s.etaMin+'m');
    sp.title='Click to set ETA (minutes)'+(s.etaset?' · manually pinned':'');
    if(s.sessionId) sp.onclick=function(ev){ ev.stopPropagation(); editBadge(sp,s,'eta'); };
    return sp;
  }
  // signals inline: priority · ETA (both click-to-edit) · pattern · reason
  function headerSig(s){
    var sig=byId('h-sig'); if(!sig) return; sig.innerHTML='';
    if(s.score!=null) sig.appendChild(priBadge(s,'score'));
    if(s.etaMin!=null) sig.appendChild(etaBadge(s,'eta'));
    if(s.pattern && s.pattern!=='unknown') sig.appendChild(el('span','pat '+s.pattern, s.pattern));
    if(s.reason && s.reason!=='no signal') sig.appendChild(el('span','reason', s.reason));
  }
  // Patch a session's brief/priority/eta into its tab (and the header if open).
  function applyAnalysis(s, a){
    if(!a) return;
    // A manually-pinned priority/ETA wins — don't let the daemon's verdict overwrite it.
    s.brief=a.brief; s.reason=a.reason;
    if(!s.priorityset) s.score=a.priority;
    if(!s.etaset) s.etaMin=a.etaMin;
    var t=s.sessionId&&titleEls[s.sessionId];
    if(t){ t.textContent=briefText(s); t.classList.remove('pending'); }
    if(cur&&cur.sessionId===s.sessionId){ byId('h-title').textContent=briefText(s); headerSig(s); }
  }
  // The daemon analyzes on turn-end (server-side); poll a few times for its verdict.
  function refreshAnalysis(s){
    if(!s||!s.sessionId||s.vendor!=='claude') return;
    var tries=0, prev=s.brief;
    var poll=function(){
      tries++;
      fetch('/session/analysis?session='+encodeURIComponent(s.sessionId)).then(function(r){return r.json();})
        .then(function(res){ var a=res&&res.analysis;
          if(a && a.brief!==prev){ applyAnalysis(s,a); return; }
          if(tries<4) setTimeout(poll, 4000);
        }).catch(function(){ if(tries<4) setTimeout(poll,4000); });
    };
    setTimeout(poll, 3500);
  }

  function sortSessions(){
    var mode=(byId('sort')||{}).value||'recent';
    if(mode==='priority'){ SESS.sort(function(a,b){ return (b.score||0)-(a.score||0); }); }
    else { SESS.sort(function(a,b){ return (a.ageDays==null?1e9:a.ageDays)-(b.ageDays==null?1e9:b.ageDays); }); }
  }
  var titleEls={}; // sessionId -> .it-title node, so a late daemon brief can patch it in place
  var statusEls={}; // sessionId -> .it-status dot, so live generating state can patch in place
  var filterQ=''; // sidebar search query (matches brief / 首 / 新 / project / vendor / reason)
  function matchesFilter(s){
    if(!filterQ) return true;
    var hay=[s.brief,s.title,s.lastPrompt,s.project,s.vendor,s.reason].filter(Boolean).join(' ').toLowerCase();
    return hay.indexOf(filterQ)>=0;
  }
  function briefText(s){ return s.brief || s.title || '(no prompt)'; }
  // Fine-grained "time since last activity": same-day sessions get just now/Xm ago/Xh ago
  // instead of a coarse "0d". Falls back to the server's day count if no timestamp.
  function ageLabel(s){
    var t=s.lastTs;
    if(t==null) return s.ageDays!=null?(s.ageDays+'d ago'):'';
    var ms=Date.now()-t; if(ms<0) ms=0;
    var m=Math.floor(ms/60000);
    if(m<1) return 'just now';
    if(m<60) return m+'m ago';
    var h=Math.floor(m/60);
    if(h<24) return h+'h ago';
    return Math.floor(h/24)+'d ago';
  }
  // Reflect a session's live state on its tab dot (green pulse = generating, else idle).
  function applyGenerating(s){
    var d=s&&s.sessionId&&statusEls[s.sessionId]; if(!d) return;
    d.className='it-status'+(s.generating?' on':'');
    d.title=s.generating?'generating':'idle';
  }
  function renderSidebar(){
    var list=byId('list'); list.innerHTML=''; titleEls={}; statusEls={};
    var shown=0;
    SESS.forEach(function(s){
      if(!matchesFilter(s)) return;
      shown++;
      var item=el('div','item'+(cur&&cur.sessionId===s.sessionId?' active':''));
      // title row: a live-status dot + the daemon's brief (falls back to first prompt)
      var trow=el('div','it-titlerow');
      var dot=el('span','it-status'+(s.generating?' on':''));
      dot.title=s.generating?'generating':'idle';
      if(s.sessionId) statusEls[s.sessionId]=dot;
      trow.appendChild(dot);
      var t=el('div','it-title', briefText(s));
      if(!s.brief) t.classList.add('pending');
      if(s.sessionId) titleEls[s.sessionId]=t;
      trow.appendChild(t);
      item.appendChild(trow);
      // two subtitles: my first message, then my latest message
      if(s.title) item.appendChild(el('div','it-firstline', 'first · '+s.title));
      if(s.lastPrompt && s.lastPrompt!==s.title) item.appendChild(el('div','it-firstline', 'latest · '+s.lastPrompt));
      // badges: enough to judge without opening — priority, ETA, pattern, then context
      var meta=el('div','it-meta');
      if(s.score!=null) meta.appendChild(priBadge(s,'b-pri'));
      if(s.etaMin!=null) meta.appendChild(etaBadge(s,'b-eta'));
      if(s.pattern && s.pattern!=='unknown') meta.appendChild(el('span','pat '+s.pattern, s.pattern));
      var age=ageLabel(s);
      var ctx=s.vendor+' · '+s.project+' · '+s.prompts+'p'+(age?(' · '+age):'');
      meta.appendChild(el('span','b-ctx', ctx));
      item.appendChild(meta);
      if(s.reason) item.appendChild(el('div','it-reason', s.reason));
      // Tabs truncate (brief / 首 / 新 / context can each overflow one line), so the
      // hover tooltip is the complete, untruncated view of everything on the tab.
      var tip=['▎'+briefText(s)];
      if(s.title) tip.push('first · '+s.title);
      if(s.lastPrompt && s.lastPrompt!==s.title) tip.push('latest · '+s.lastPrompt);
      var sig=[]; if(s.score!=null) sig.push('priority '+Number(s.score).toFixed(1));
      if(s.etaMin!=null) sig.push('~'+s.etaMin+'m');
      if(s.pattern && s.pattern!=='unknown') sig.push(s.pattern);
      sig.push(ctx); tip.push(sig.join(' · '));
      if(s.reason) tip.push(s.reason);
      item.title=tip.join('\\n');
      item.onclick=function(){ select(s); };
      list.appendChild(item);
    });
    if(shown===0){
      var empty=el('div','empty'); empty.textContent=filterQ?('No matches for “'+filterQ+'”'):'No sessions yet';
      list.appendChild(empty);
    }
  }
  function setForkEnabled(on, title){
    var b=byId('forkBtn'); if(!b) return; b.disabled=!on; if(title!=null) b.title=title;
  }
  function addMsg(role, text){ clearPh(); var m=el('div','msg '+role); var b=el('div','bubble',text||''); m.appendChild(b); byId('msgs').appendChild(m); keepGenLast(); scroll(role==='user'); return m; }
  var toolEls = {}; // tool_use id -> details element (to attach the result later)
  function toolPreview(name, input){
    try {
      if(!input || typeof input!=='object') return '';
      if(name==='Bash' && input.command) return String(input.command).split('\\n')[0].slice(0,90);
      if(input.file_path) return String(input.file_path);
      if(input.path) return String(input.path);
      if(input.pattern) return String(input.pattern);
      var k=Object.keys(input)[0]; return k?(k+': '+String(input[k]).slice(0,70)):'';
    } catch(e){ return ''; }
  }
  function fmt(v){ try { return typeof v==='string'?v:JSON.stringify(v,null,2); } catch(e){ return String(v); } }
  // Normalize an edit-family tool's input into {file, edits:[{old,new}]} so it can
  // render as a diff. Edit / MultiEdit / Write only; anything else → null (JSON).
  function editsFromInput(name, input){
    if(!input || typeof input!=='object') return null;
    var file=input.file_path||input.path||'';
    if(name==='Edit' && (input.old_string!=null || input.new_string!=null))
      return {file:file, edits:[{old:input.old_string||'', new:input.new_string||''}]};
    if(name==='MultiEdit' && Array.isArray(input.edits))
      return {file:file, edits:input.edits.map(function(e){ return {old:e.old_string||'', new:e.new_string||''}; })};
    if(name==='Write' && input.content!=null)
      return {file:file, edits:[{old:'', new:String(input.content)}]};
    return null;
  }
  // Line-level diff (LCS) → [{t:' '|'-'|'+', s:line}], git style. A new file
  // (empty old) is pure additions; oversized pairs fall back to a block replace.
  function diffLines(oldS, newS){
    var a=(oldS==null?'':String(oldS)).split('\\n');
    var b=(newS==null?'':String(newS)).split('\\n');
    if(a.length>1 && a[a.length-1]==='') a.pop();
    if(b.length>1 && b[b.length-1]==='') b.pop();
    if(oldS==null || oldS===''){ return b.map(function(s){ return {t:'+',s:s}; }); }
    var n=a.length, m=b.length;
    if(n*m>120000){ return a.map(function(s){return {t:'-',s:s};}).concat(b.map(function(s){return {t:'+',s:s};})); }
    var dp=[]; for(var i=0;i<=n;i++){ dp.push(new Array(m+1).fill(0)); }
    for(var i=n-1;i>=0;i--){ for(var j=m-1;j>=0;j--){ dp[i][j]= a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]); } }
    var out=[], i=0, j=0;
    while(i<n && j<m){ if(a[i]===b[j]){ out.push({t:' ',s:a[i]}); i++; j++; }
      else if(dp[i+1][j]>=dp[i][j+1]){ out.push({t:'-',s:a[i]}); i++; }
      else { out.push({t:'+',s:b[j]}); j++; } }
    while(i<n){ out.push({t:'-',s:a[i]}); i++; }
    while(j<m){ out.push({t:'+',s:b[j]}); j++; }
    return out;
  }
  function renderDiff(diff){
    var wrap=el('div','diff');
    diff.edits.forEach(function(ed, idx){
      if(idx>0) wrap.appendChild(el('div','diff-sep'));
      diffLines(ed.old, ed.new).forEach(function(r){
        var row=el('div','dline '+(r.t==='+'?'add':r.t==='-'?'del':'ctx'));
        row.appendChild(el('span','dsign', r.t));
        row.appendChild(el('span','dtext', r.s));
        wrap.appendChild(row);
      });
    });
    return wrap;
  }
  // tc = { name, input, result?, isError? }
  function addTool(tc){
    clearPh();
    var d=el('details','toolc');
    var prev=toolPreview(tc.name, tc.input);
    d.appendChild(el('summary',null,'⚙ '+tc.name+(prev?(' — '+prev):'')));
    // Edit-family tools render as a git-style diff, expanded by default; others
    // keep the collapsed JSON input.
    var diff=editsFromInput(tc.name, tc.input);
    if(diff){
      d.open=true;
      d.appendChild(renderDiff(diff));
    } else if(tc.input!=null && !(typeof tc.input==='object' && Object.keys(tc.input).length===0)){
      d.appendChild(el('pre','tool-in', fmt(tc.input)));
    }
    var out=el('pre','tool-out'+(tc.isError?' err':''));
    if(tc.result!=null && tc.result!==''){ out.textContent=String(tc.result).slice(0,8000); } else { out.style.display='none'; }
    d.appendChild(out);
    byId('msgs').appendChild(d); keepGenLast(); scroll();
    return d;
  }

  function select(s){
    cur=s; renderSidebar();
    // top mirrors the tab: brief as title, my first + latest message as subtitles.
    byId('h-title').textContent = briefText(s);
    var sub=byId('h-sub');
    var subParts=[]; if(s.title) subParts.push('first · '+s.title); if(s.lastPrompt && s.lastPrompt!==s.title) subParts.push('latest · '+s.lastPrompt);
    sub.textContent = subParts.join('   ·   ') || (s.vendor+' · '+(s.cwd||'')); sub.className='s';
    headerSig(s);
    // in-browser fork only works for Claude sessions; Codex must use the terminal launcher
    var canFork = !!(s && s.sessionId && s.vendor==='claude' && !s.pendingFork);
    var ftitle = canFork ? 'branch this session into a fork'
      : (s && s.vendor!=='claude' ? 'in-browser split is Claude-only — use the terminal launcher for Codex' : 'select a Claude session to split');
    setForkEnabled(canFork, ftitle);
    byId('msgs').innerHTML=''; stick=true; assistantEl=null; pendingQueue=[]; renderQueue();
    if(es){ es.close(); es=null; }
    clearGen(); turnActive=false; setInputEnabled(true); updateSendLabel();
    if(s.pendingFork){
      addMsg('assistant','(forked — type your next message to continue this branch in a new direction)');
      return;
    }
    // Always (re)attach to the live stream after loading history: if a turn is
    // generating server-side (e.g. you just refreshed mid-turn), the engine
    // replays its buffer and a 'sync' event restores the 生成中… state — no more
    // manual refreshing. If nothing is live the stream just idles harmlessly.
    var startLive=function(){ if(s.vendor==='claude' && s.sessionId){ openStream(s.sessionId); } };
    if(s.file){
      fetch('/chat/messages?file='+encodeURIComponent(s.file)).then(function(r){return r.json();}).then(function(msgs){
        if(!msgs.length) addMsg('assistant','(no history yet)');
        msgs.forEach(function(m){ if(m.text) addMsg(m.role, m.text); (m.tools||[]).forEach(function(t){ addTool(t); }); });
        startLive();
      }).catch(startLive);
    } else { startLive(); }
  }
  function openStream(id){ if(es) es.close(); es=new EventSource('/chat/stream?session='+encodeURIComponent(id)); es.onmessage=function(e){ onEvent(JSON.parse(e.data)); }; }
  function onEvent(ev){
    if(ev.kind==='assistant_text'){ if(!assistantEl) assistantEl=addMsg('assistant',''); var b=assistantEl.querySelector('.bubble'); b.textContent+=ev.text; scroll(); }
    else if(ev.kind==='tool_use'){ assistantEl=null; var d=addTool({name:ev.name,input:ev.input}); if(ev.id) toolEls[ev.id]=d; }
    else if(ev.kind==='tool_result'){ assistantEl=null; var t=ev.id?toolEls[ev.id]:null;
      if(t){ var o=t.querySelector('.tool-out'); o.textContent=String(ev.text||'').slice(0,8000); o.style.display=''; if(ev.isError) o.className='tool-out err'; }
      else { addTool({name:'result',input:null,result:ev.text,isError:ev.isError}); }
      keepGenLast(); scroll(); }
    else if(ev.kind==='result'){ assistantEl=null; turnEnded(); }
    else if(ev.kind==='error'){ assistantEl=null; addMsg('error','⚠ '+ev.message); turnEnded(); }
    // reconnect snapshot: restore the 生成中… state if the server is mid-turn.
    // Only ever STARTS the indicator — never ends it: turn-end is owned by the
    // 'result' event. (A self-initiated send parks its SSE before the run exists,
    // so it gets a stale sync{turnActive:false} right after we begin the turn;
    // ending on it would wrongly kill the indicator and desync turnActive.)
    else if(ev.kind==='sync'){ if(ev.turnActive && !turnActive) beginTurn(ev.startedAt); }
  }
  function send(){
    var inp=byId('input'); var text=inp.value.trim(); if(!text||!cur) return;
    if(cur.pendingFork){ materializeFork(cur,text); return; }
    if(!cur.sessionId) return;
    inp.value='';
    // Mid-turn: queue the draft instead of blocking it. It auto-sends when the
    // current turn ends (turnEnded), so a follow-up never lands under a tail.
    if(turnActive){ enqueue(text); return; }
    addMsg('user',text); assistantEl=null;
    dispatchSend(text);
  }
  // Queue a draft (rendered in the pinned region below) to send when the turn ends.
  function enqueue(text){ pendingQueue.push(text); renderQueue(); }
  // Promote a queued draft to a real user message in the transcript, then send it.
  function promoteAndSend(text){ addMsg('user',text); dispatchSend(text); }
  // POST the turn and (re)attach the stream. The stream is opened once per
  // session in select(); only reopen if it somehow isn't (avoids replaying the
  // buffer and double-rendering the history).
  function dispatchSend(text){
    if(!cur||!cur.sessionId){ endTurn(); return; }
    assistantEl=null; beginTurn();
    var id=cur.sessionId, cwd=cur.cwd||'';
    fetch('/chat/send?session='+encodeURIComponent(id)+'&cwd='+encodeURIComponent(cwd),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text})})
      .then(function(r){return r.json();}).then(function(res){ if(res.ok){ if(!es) openStream(id); } else { addMsg('error','⚠ '+(res.error||'send failed')); turnEnded(); } })
      .catch(function(e){ addMsg('error','⚠ network error: '+(e&&e.message?e.message:e)); turnEnded(); });
  }
  // Stop: interrupt the in-flight turn and drop any still-queued drafts (full
  // stop). The server-side abort makes the SDK emit a result → turnEnded clears
  // the 生成中… state through the normal path.
  function stopTurn(){
    if(!cur||!cur.sessionId) return;
    pendingQueue=[]; renderQueue();
    var b=genEl&&genEl.querySelector('.bubble'); if(b){ b.textContent='Stopping…'; }
    fetch('/chat/abort?session='+encodeURIComponent(cur.sessionId),{method:'POST'}).catch(function(){});
  }
  function fork(){
    if(!cur||!cur.sessionId){ alert('Pick a session on the left before splitting.'); return; }
    if(cur.vendor!=='claude'){ alert('In-browser split is Claude-only. Use the terminal launcher to fork a Codex session.'); return; }
    if(cur.pendingFork){ byId('input').focus(); return; }
    // Open the branch immediately, empty and ready. The real fork is materialized
    // lazily on the first message: the Agent SDK only mints the new session id once
    // it has a turn to diverge on, so we defer the actual /chat/fork until send().
    // If you'd already typed something, that becomes the branch's opening turn —
    // "I typed this, but it's better off as a split" — and we materialize now.
    var inp=byId('input'); var text=inp.value.trim();
    var ns={vendor:'claude',sessionId:'pending-'+Date.now(),pendingFork:{parent:cur.sessionId,cwd:cur.cwd||''},title:'(fork) '+(cur.title||''),lastPrompt:null,cwd:cur.cwd,project:cur.project,file:'',ageDays:0,lastTs:Date.now(),prompts:0,brief:null};
    SESS.unshift(ns); select(ns);
    if(text){ materializeFork(ns,text); } else { inp.focus(); }
  }
  // Turn a pending fork into a real session using its first message.
  function materializeFork(branch,text){
    var inp=byId('input'); byId('msgs').innerHTML=''; addMsg('user',text); inp.value=''; assistantEl=null;
    beginTurn();
    fetch('/chat/fork?session='+encodeURIComponent(branch.pendingFork.parent)+'&cwd='+encodeURIComponent(branch.pendingFork.cwd),
      {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text})})
      .then(function(r){return r.json();}).then(function(res){ if(!res.ok){ addMsg('error','⚠ '+(res.error||'fork failed')); endTurn(); return; }
        branch.sessionId=res.session; branch.pendingFork=null;
        if(cur===branch){ renderSidebar(); setForkEnabled(true,'branch this session into a fork'); }
        openStream(res.session); })
      .catch(function(e){ addMsg('error','⚠ fork failed: '+(e&&e.message?e.message:e)); endTurn(); });
  }
  var VENDORS = window.__VENDORS__ || [];
  function vendorInfo(id){ for(var i=0;i<VENDORS.length;i++){ if(VENDORS[i].vendor===id) return VENDORS[i]; } return null; }
  function newSession(){
    var dir=byId('ndfree').value.trim()||byId('ndsel').value; var text=byId('np').value.trim();
    if(!dir){ byId('nmsg').textContent='pick or paste a directory'; return; }
    var vendor=(byId('nvendor')||{}).value||'claude';
    var info=vendorInfo(vendor);
    if(info && !info.available){ byId('nmsg').textContent=vendor+' CLI not detected'; return; }
    // Codex has no streaming SDK → no in-browser chat (DESIGN.md): start it via the
    // terminal launcher instead. It'll surface in the list on the next scan.
    if(info && info.chat===false){
      byId('nmsg').textContent='Opening terminal…';
      fetch('/launch?action=new&vendor='+encodeURIComponent(vendor)+'&cwd='+encodeURIComponent(dir)+(text?('&prompt='+encodeURIComponent(text)):''),{method:'POST'})
        .then(function(r){return r.json();}).then(function(res){
          if(!res.ok){ byId('nmsg').textContent=res.error||'failed'; return; }
          byId('nmsg').textContent='Launched in terminal: '+res.command;
          byId('np').value=''; });
      return;
    }
    // Claude: in-browser. First message is optional — with no text we just open an
    // empty session ready for input; with text we send it as the opening turn.
    fetch('/chat/new?cwd='+encodeURIComponent(dir),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text})})
      .then(function(r){return r.json();}).then(function(res){ if(!res.ok){ byId('nmsg').textContent=res.error||'failed'; return; }
        var ns={vendor:'claude',sessionId:res.session,title:text||'(new session)',lastPrompt:null,cwd:dir,project:(dir.split(/[\\\\/]/).pop()),file:'',ageDays:0,lastTs:Date.now(),prompts:text?1:0,brief:null};
        SESS.unshift(ns); select(ns);
        if(text){ addMsg('user',text); beginTurn(); openStream(res.session); }
        byId('np').value=''; byId('nmsg').textContent=''; byId('newbox').classList.remove('open'); });
  }

  // Poll the server for which sessions are mid-turn, so background tabs (ones
  // we're not streaming) show their generating dot too. The open session's own
  // turn is authoritative locally (turnActive), so don't let a lagging poll
  // flip its dot off mid-turn.
  function pollLive(){
    fetch('/chat/live').then(function(r){return r.json();}).then(function(res){
      var active={}; (res.active||[]).forEach(function(id){ active[id]=true; });
      SESS.forEach(function(s){
        if(!s.sessionId) return;
        var g=!!active[s.sessionId] || (s===cur && turnActive);
        if(g!==!!s.generating){ s.generating=g; applyGenerating(s); }
      });
    }).catch(function(){});
  }
  setInterval(pollLive, 3000);

  // Drag the divider to resize the sidebar; width persists across reloads.
  (function(){
    var rz=byId('resizer'), side=document.querySelector('.side'); if(!rz||!side) return;
    var saved=parseInt(localStorage.getItem('attend.sideW')||'',10);
    if(saved>=200 && saved<=720) side.style.width=saved+'px';
    var dragging=false;
    rz.addEventListener('mousedown',function(e){ dragging=true; rz.classList.add('dragging'); document.body.style.userSelect='none'; e.preventDefault(); });
    window.addEventListener('mousemove',function(e){ if(!dragging) return; var w=Math.min(Math.max(e.clientX,200),720); side.style.width=w+'px'; });
    window.addEventListener('mouseup',function(){ if(!dragging) return; dragging=false; rz.classList.remove('dragging'); document.body.style.userSelect='';
      try{ localStorage.setItem('attend.sideW', String(parseInt(side.style.width,10))); }catch(e){} });
  })();

  sortSessions();
  renderSidebar();
  // The send button is also the Stop button mid-turn.
  byId('send').onclick=function(){ if(turnActive) stopTurn(); else send(); };
  byId('forkBtn').onclick=fork;
  byId('nbtn').onclick=newSession;
  // Enter starts the session; Shift+Enter inserts a newline (IME-safe).
  byId('np').addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){ e.preventDefault(); newSession(); }
  });
  byId('newToggle').onclick=function(){ byId('newbox').classList.toggle('open'); };
  // Live-filter the sidebar as you type; Esc clears the search.
  byId('search').addEventListener('input',function(){ filterQ=this.value.trim().toLowerCase(); renderSidebar(); });
  byId('search').addEventListener('keydown',function(e){ if(e.key==='Escape'){ this.value=''; filterQ=''; renderSidebar(); } });
  byId('input').addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){ e.preventDefault(); send(); }
    else if(e.key==='Escape'&&turnActive){ e.preventDefault(); stopTurn(); }
  });
})();
</script>
</body>
</html>`;
}
