import type { Pattern } from "../core/types.js";

export interface SessionBriefRef {
  name: string;
  path: string;
}

export interface SessionView {
  vendor: string;
  sessionId: string | null;
  title: string;
  cwd: string | null;
  project: string;
  file: string;
  ageDays: number | null;
  prompts: number;
  actions: number;
  /** per-session behavioral signals (the model now follows the session, not a brief) */
  pattern: Pattern;
  score: number;
  reason: string;
  /** estimated minutes to re-engage (re-read last turn + re-orient) */
  etaMin: number;
  /** optional task this session belongs to, if a brief.md matched its dir */
  brief: SessionBriefRef | null;
}

export interface ConsoleView {
  sessions: SessionView[];
  knownDirs: string[];
  briefCount: number;
  memoryTerms: number;
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
  .side h1 { font-size: 0.95rem; margin: 0; padding: 0.8rem 0.9rem 0.5rem; }
  .side h1 .accent { color: #9ca3af; font-weight: 400; font-size: 0.72rem; }
  .side .topnav { padding: 0 0.9rem 0.6rem; display: flex; gap: 0.4rem; border-bottom: 1px solid #e5e7eb; }
  .side .topnav a { font-size: 0.78rem; color: #2563eb; text-decoration: none; align-self: center; margin-left: auto; }
  .newbox { padding: 0.6rem 0.9rem; border-bottom: 1px solid #e5e7eb; display: none; flex-direction: column; gap: 0.4rem; background: #fff; }
  .newbox.open { display: flex; }
  .newbox select, .newbox input { font-size: 0.8rem; padding: 0.3rem 0.45rem; border: 1px solid #d1d5db; border-radius: 4px; width: 100%; }
  .newbox .nmsg { font-size: 0.72rem; color: #9ca3af; }
  #list { overflow-y: auto; flex: 1; }
  .item { padding: 0.55rem 0.9rem; border-bottom: 1px solid #f0f0f0; cursor: pointer; }
  .item:hover { background: #f1f5f9; }
  .item.active { background: #eef2ff; border-left: 3px solid #6366f1; padding-left: calc(0.9rem - 3px); }
  .it-title { font-size: 0.84rem; font-weight: 600; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .it-firstline { font-size: 0.72rem; color: #6b7280; margin-top: 0.1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .it-meta { font-size: 0.7rem; color: #6b7280; margin-top: 0.2rem; font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem; }
  .pat { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.03em; padding: 0.02rem 0.3rem; border-radius: 3px; background: #e5e7eb; color: #374151; flex-shrink: 0; }
  .pat.avoidance { background: #fed7aa; color: #9a3412; }
  .pat.stalled { background: #d1d5db; color: #1f2937; }
  .pat.healthy { background: #bbf7d0; color: #166534; }
  .pat.active { background: #ddd6fe; color: #5b21b6; }
  .pat.fresh { background: #bfdbfe; color: #1e3a8a; }
  .it-reason { font-size: 0.68rem; color: #9ca3af; margin-top: 0.2rem; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sortsel { font-size: 0.72rem; border: 1px solid #d1d5db; border-radius: 4px; padding: 0.1rem 0.3rem; background: white; }
  /* main */
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: white; }
  .head { padding: 0.7rem 1rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
  .head .t { font-weight: 600; font-size: 0.95rem; }
  .head .s { font-size: 0.72rem; color: #9ca3af; font-family: ui-monospace, monospace; }
  #h-sig { display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; margin-top: 0.3rem; font-size: 0.72rem; }
  #h-sig .score { font-weight: 600; color: #374151; }
  #h-sig .brieftag { padding: 0.05rem 0.4rem; border-radius: 3px; background: #eef2ff; color: #3730a3; text-decoration: none; }
  #h-sig .brieftag:hover { background: #e0e7ff; }
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
  .placeholder { margin: auto; color: #9ca3af; text-align: center; font-size: 0.9rem; }
  .foot { border-top: 1px solid #e5e7eb; padding: 0.6rem 1rem; display: flex; gap: 0.5rem; }
  .foot textarea { flex: 1; resize: none; height: 2.4rem; padding: 0.5rem 0.6rem; border: 1px solid #d1d5db; border-radius: 6px; font: inherit; font-size: 0.88rem; }
  .foot button.send { background: #1f2937; color: white; border-color: #1f2937; padding: 0 1rem; }
  .foot button.splitbtn { color: #5b21b6; border-color: #ddd6fe; background: #f5f3ff; padding: 0 0.8rem; }
  .foot button.splitbtn:hover:not(:disabled) { background: #ede9fe; }
  .foot button.splitbtn:disabled { color: #c4b5fd; background: #faf5ff; cursor: default; }
  .pill { font-size: 0.66rem; padding: 0.05rem 0.4rem; border-radius: 3px; background: #ede9fe; color: #5b21b6; }
`;

export function renderConsole(v: ConsoleView): string {
  const sessJson = JSON.stringify(v.sessions).replace(/</g, "\\u003c");
  const dirsJson = JSON.stringify(v.knownDirs).replace(/</g, "\\u003c");
  const dirOptions = v.knownDirs
    .map((d) => `<option value="${d.replace(/"/g, "&quot;")}">${d.replace(/</g, "&lt;")}</option>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="utf-8"><title>attend — console</title><style>${STYLE}</style></head>
<body>
<div class="side">
  <h1>attend <span class="accent">${v.sessions.length} sessions · ${v.briefCount} briefs</span></h1>
  <div class="topnav">
    <button id="newToggle">+ new</button>
    <a href="/briefs" title="your brief.md tasks, ranked by what needs attention">tasks ▸</a>
  </div>
  <div class="newbox" id="newbox">
    <select id="ndsel"><option value="">— pick a project dir —</option>${dirOptions}</select>
    <input id="ndfree" placeholder="…or paste an absolute path">
    <input id="np" placeholder="first message">
    <button id="nbtn" class="send" style="color:white;background:#1f2937;border-color:#1f2937">start session ▸</button>
    <div class="nmsg" id="nmsg"></div>
  </div>
  <div id="list"></div>
</div>
<div class="main">
  <div class="head">
    <div><div class="t" id="h-title">attend</div><div class="s" id="h-sub">select a session, or + new</div><div class="sig" id="h-sig"></div></div>
  </div>
  <div id="msgs"><div class="placeholder" id="ph">Pick a session on the left to see its chat, then type below to continue it — all in the browser.</div></div>
  <div class="foot">
    <textarea id="input" placeholder="message (Enter to send · Shift+Enter for newline)"></textarea>
    <button class="splitbtn" id="forkBtn" title="branch this session into a fork (uses your draft as the opening turn)" disabled>fork ⑂</button>
    <button class="send" id="send">send</button>
  </div>
</div>
<script>
window.__SESSIONS__ = ${sessJson};
window.__DIRS__ = ${dirsJson};
</script>
<script>
(function(){
  var SESS = window.__SESSIONS__ || [];
  var cur = null, es = null, assistantEl = null;
  function byId(id){ return document.getElementById(id); }
  function el(tag, cls, txt){ var e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e; }
  function scroll(){ var m=byId('msgs'); m.scrollTop=m.scrollHeight; }
  function clearPh(){ var p=byId('ph'); if(p) p.remove(); }

  function sortSessions(){
    var mode=(byId('sort')||{}).value||'recent';
    if(mode==='priority'){ SESS.sort(function(a,b){ return (b.score||0)-(a.score||0); }); }
    else { SESS.sort(function(a,b){ return (a.ageDays==null?1e9:a.ageDays)-(b.ageDays==null?1e9:b.ageDays); }); }
  }
  function renderSidebar(){
    var list=byId('list'); list.innerHTML='';
    SESS.forEach(function(s){
      var item=el('div','item'+(cur&&cur.sessionId===s.sessionId?' active':''));
      item.title = s.reason || '';
      // title = brief (easy to locate by task); fall back to first prompt
      item.appendChild(el('div','it-title', (s.brief?s.brief.name:(s.title||'(no prompt)'))));
      // keep the session's first sentence visible as a subtitle when a brief took the title
      if(s.brief && s.title) item.appendChild(el('div','it-firstline', s.title));
      var meta=el('div','it-meta');
      if(s.pattern && s.pattern!=='unknown') meta.appendChild(el('span','pat '+s.pattern, s.pattern));
      meta.appendChild(el('span',null, (s.score!=null?Number(s.score).toFixed(1)+' · ':'')+s.vendor+' · '+s.project+' · '+s.prompts+'p/'+s.actions+'a'+(s.ageDays!=null?(' · '+s.ageDays+'d'):'')));
      item.appendChild(meta);
      if(s.reason) item.appendChild(el('div','it-reason', s.reason));
      item.onclick=function(){ select(s); };
      list.appendChild(item);
    });
  }
  function setForkEnabled(on, title){
    var b=byId('forkBtn'); if(!b) return; b.disabled=!on; if(title!=null) b.title=title;
  }
  function addMsg(role, text){ clearPh(); var m=el('div','msg '+role); var b=el('div','bubble',text||''); m.appendChild(b); byId('msgs').appendChild(m); scroll(); return m; }
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
  // tc = { name, input, result?, isError? }
  function addTool(tc){
    clearPh();
    var d=el('details','toolc');
    var prev=toolPreview(tc.name, tc.input);
    d.appendChild(el('summary',null,'⚙ '+tc.name+(prev?(' — '+prev):'')));
    if(tc.input!=null && !(typeof tc.input==='object' && Object.keys(tc.input).length===0)){
      d.appendChild(el('pre','tool-in', fmt(tc.input)));
    }
    var out=el('pre','tool-out'+(tc.isError?' err':''));
    if(tc.result!=null && tc.result!==''){ out.textContent=String(tc.result).slice(0,8000); } else { out.style.display='none'; }
    d.appendChild(out);
    byId('msgs').appendChild(d); scroll();
    return d;
  }

  function select(s){
    cur=s; renderSidebar();
    // top shows BOTH: brief as the title (locate by task), first sentence as subtitle
    byId('h-title').textContent = s.brief ? s.brief.name : (s.title || s.project || 'session');
    byId('h-sub').textContent = s.title || (s.vendor+' · '+(s.cwd||''));
    // signals inline (no click needed): brief · pattern · priority · reason
    var sig=byId('h-sig'); sig.innerHTML='';
    sig.appendChild(el('span','briefref', s.brief ? ('task: '+s.brief.name) : 'no task brief'));
    if(s.pattern && s.pattern!=='unknown') sig.appendChild(el('span','pat '+s.pattern, s.pattern));
    if(s.score!=null) sig.appendChild(el('span','score','priority '+s.score.toFixed(1)));
    if(s.etaMin!=null) sig.appendChild(el('span','eta','~'+s.etaMin+'m to handle'));
    if(s.reason && s.reason!=='no signal') sig.appendChild(el('span','reason', s.reason));
    // in-browser fork only works for Claude sessions; Codex must use the terminal launcher
    var canFork = !!(s && s.sessionId && s.vendor==='claude' && !s.pendingFork);
    var ftitle = canFork ? 'branch this session into a fork'
      : (s && s.vendor!=='claude' ? 'in-browser split is Claude-only — use the terminal launcher for Codex' : 'select a Claude session to split');
    setForkEnabled(canFork, ftitle);
    byId('msgs').innerHTML=''; assistantEl=null;
    if(es){ es.close(); es=null; }
    if(s.pendingFork){
      addMsg('assistant','(forked — type your next message to continue this branch in a new direction)');
    } else if(s.file){
      fetch('/chat/messages?file='+encodeURIComponent(s.file)).then(function(r){return r.json();}).then(function(msgs){
        if(!msgs.length) addMsg('assistant','(no history yet)');
        msgs.forEach(function(m){ if(m.text) addMsg(m.role, m.text); (m.tools||[]).forEach(function(t){ addTool(t); }); });
      });
    }
  }
  function openStream(id){ if(es) es.close(); es=new EventSource('/chat/stream?session='+encodeURIComponent(id)); es.onmessage=function(e){ onEvent(JSON.parse(e.data)); }; }
  function onEvent(ev){
    if(ev.kind==='assistant_text'){ if(!assistantEl) assistantEl=addMsg('assistant',''); var b=assistantEl.querySelector('.bubble'); b.textContent+=ev.text; scroll(); }
    else if(ev.kind==='tool_use'){ assistantEl=null; var d=addTool({name:ev.name,input:ev.input}); if(ev.id) toolEls[ev.id]=d; }
    else if(ev.kind==='tool_result'){ assistantEl=null; var t=ev.id?toolEls[ev.id]:null;
      if(t){ var o=t.querySelector('.tool-out'); o.textContent=String(ev.text||'').slice(0,8000); o.style.display=''; if(ev.isError) o.className='tool-out err'; }
      else { addTool({name:'result',input:null,result:ev.text,isError:ev.isError}); }
      scroll(); }
    else if(ev.kind==='result'){ assistantEl=null; }
    else if(ev.kind==='error'){ assistantEl=null; addMsg('error','⚠ '+ev.message); }
  }
  function send(){
    var inp=byId('input'); var text=inp.value.trim(); if(!text||!cur) return;
    if(cur.pendingFork){ materializeFork(cur,text); return; }
    if(!cur.sessionId) return;
    addMsg('user',text); inp.value=''; assistantEl=null;
    var id=cur.sessionId, cwd=cur.cwd||'';
    fetch('/chat/send?session='+encodeURIComponent(id)+'&cwd='+encodeURIComponent(cwd),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text})})
      .then(function(r){return r.json();}).then(function(res){ if(res.ok){ if(!es) openStream(id); } else { addMsg('error','⚠ '+(res.error||'send failed')); } });
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
    var ns={vendor:'claude',sessionId:'pending-'+Date.now(),pendingFork:{parent:cur.sessionId,cwd:cur.cwd||''},title:'(fork) '+(cur.title||''),cwd:cur.cwd,project:cur.project,file:'',ageDays:0,prompts:0,actions:0,brief:cur.brief};
    SESS.unshift(ns); select(ns);
    if(text){ materializeFork(ns,text); } else { inp.focus(); }
  }
  // Turn a pending fork into a real session using its first message.
  function materializeFork(branch,text){
    var inp=byId('input'); byId('msgs').innerHTML=''; addMsg('user',text); inp.value=''; assistantEl=null;
    fetch('/chat/fork?session='+encodeURIComponent(branch.pendingFork.parent)+'&cwd='+encodeURIComponent(branch.pendingFork.cwd),
      {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text})})
      .then(function(r){return r.json();}).then(function(res){ if(!res.ok){ addMsg('error','⚠ '+(res.error||'fork failed')); return; }
        branch.sessionId=res.session; branch.pendingFork=null;
        if(cur===branch){ renderSidebar(); setForkEnabled(true,'branch this session into a fork'); }
        openStream(res.session); })
      .catch(function(e){ addMsg('error','⚠ fork failed: '+(e&&e.message?e.message:e)); });
  }
  function newSession(){
    var dir=byId('ndfree').value.trim()||byId('ndsel').value; var text=byId('np').value.trim();
    if(!dir){ byId('nmsg').textContent='pick or paste a directory'; return; }
    if(!text){ byId('nmsg').textContent='type a first message'; return; }
    fetch('/chat/new?cwd='+encodeURIComponent(dir),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text})})
      .then(function(r){return r.json();}).then(function(res){ if(!res.ok){ byId('nmsg').textContent=res.error||'failed'; return; }
        var ns={vendor:'claude',sessionId:res.session,title:text,cwd:dir,project:(dir.split(/[\\\\/]/).pop()),file:'',ageDays:0,prompts:1,actions:0,brief:null};
        SESS.unshift(ns); select(ns); addMsg('user',text); openStream(res.session);
        byId('np').value=''; byId('nmsg').textContent=''; byId('newbox').classList.remove('open'); });
  }

  sortSessions();
  renderSidebar();
  byId('send').onclick=send;
  byId('forkBtn').onclick=fork;
  byId('nbtn').onclick=newSession;
  byId('newToggle').onclick=function(){ byId('newbox').classList.toggle('open'); };
  byId('input').addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){ e.preventDefault(); send(); } });
})();
</script>
</body>
</html>`;
}
