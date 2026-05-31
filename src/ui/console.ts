import type { Pattern } from "../core/types.js";

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
  file: string;
  ageDays: number | null;
  prompts: number;
  actions: number;
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
  .it-meta { font-size: 0.7rem; color: #6b7280; margin-top: 0.15rem; font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* main */
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: white; }
  .head { padding: 0.7rem 1rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
  .head .t { font-weight: 600; font-size: 0.95rem; }
  .head .s { font-size: 0.72rem; color: #9ca3af; font-family: ui-monospace, monospace; }
  #msgs { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
  .msg { display: flex; }
  .msg.user { justify-content: flex-end; }
  .msg .bubble { max-width: 76%; padding: 0.5rem 0.75rem; border-radius: 10px; font-size: 0.88rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .msg.user .bubble { background: #4f46e5; color: white; border-bottom-right-radius: 3px; }
  .msg.assistant .bubble { background: #f3f4f6; color: #111827; border-bottom-left-radius: 3px; }
  .msg.error .bubble { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .tool { align-self: flex-start; font-family: ui-monospace, monospace; font-size: 0.72rem; color: #5b21b6; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; padding: 0.2rem 0.5rem; }
  .placeholder { margin: auto; color: #9ca3af; text-align: center; font-size: 0.9rem; }
  .foot { border-top: 1px solid #e5e7eb; padding: 0.6rem 1rem; display: flex; gap: 0.5rem; }
  .foot textarea { flex: 1; resize: none; height: 2.4rem; padding: 0.5rem 0.6rem; border: 1px solid #d1d5db; border-radius: 6px; font: inherit; font-size: 0.88rem; }
  .foot button.send { background: #1f2937; color: white; border-color: #1f2937; padding: 0 1rem; }
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
    <a href="/briefs">briefs ▸</a>
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
    <div><div class="t" id="h-title">attend</div><div class="s" id="h-sub">select a session, or + new</div></div>
    <button id="forkBtn" title="branch this session into a fork">split ⑂</button>
  </div>
  <div id="msgs"><div class="placeholder" id="ph">Pick a session on the left to see its chat, then type below to continue it — all in the browser.</div></div>
  <div class="foot">
    <textarea id="input" placeholder="message (Ctrl/Cmd+Enter to send)"></textarea>
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

  function renderSidebar(){
    var list=byId('list'); list.innerHTML='';
    SESS.forEach(function(s){
      var item=el('div','item'+(cur&&cur.sessionId===s.sessionId?' active':''));
      item.appendChild(el('div','it-title', s.title || '(no prompt)'));
      item.appendChild(el('div','it-meta', s.vendor+' · '+s.project+' · '+s.prompts+'p/'+s.actions+'a'+(s.ageDays!=null?(' · '+s.ageDays+'d'):'')));
      item.onclick=function(){ select(s); };
      list.appendChild(item);
    });
  }
  function addMsg(role, text){ clearPh(); var m=el('div','msg '+role); var b=el('div','bubble',text||''); m.appendChild(b); byId('msgs').appendChild(m); scroll(); return m; }
  function addTool(name){ clearPh(); byId('msgs').appendChild(el('div','tool','⚙ '+name)); scroll(); }

  function select(s){
    cur=s; renderSidebar();
    byId('h-title').textContent = s.title || s.project || 'session';
    byId('h-sub').textContent = s.vendor+' · '+(s.cwd||'');
    byId('msgs').innerHTML=''; assistantEl=null;
    if(es){ es.close(); es=null; }
    if(s.file){
      fetch('/chat/messages?file='+encodeURIComponent(s.file)).then(function(r){return r.json();}).then(function(msgs){
        if(!msgs.length) addMsg('assistant','(no history yet)');
        msgs.forEach(function(m){ if(m.text) addMsg(m.role, m.text); (m.tools||[]).forEach(function(t){ addTool(t); }); });
      });
    }
  }
  function openStream(id){ if(es) es.close(); es=new EventSource('/chat/stream?session='+encodeURIComponent(id)); es.onmessage=function(e){ onEvent(JSON.parse(e.data)); }; }
  function onEvent(ev){
    if(ev.kind==='assistant_text'){ if(!assistantEl) assistantEl=addMsg('assistant',''); var b=assistantEl.querySelector('.bubble'); b.textContent+=ev.text; scroll(); }
    else if(ev.kind==='tool_use'){ assistantEl=null; addTool(ev.name); }
    else if(ev.kind==='result'){ assistantEl=null; }
    else if(ev.kind==='error'){ assistantEl=null; addMsg('error','⚠ '+ev.message); }
  }
  function send(){
    var inp=byId('input'); var text=inp.value.trim(); if(!text||!cur||!cur.sessionId) return;
    addMsg('user',text); inp.value=''; assistantEl=null;
    var id=cur.sessionId, cwd=cur.cwd||'';
    fetch('/chat/send?session='+encodeURIComponent(id)+'&cwd='+encodeURIComponent(cwd),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text})})
      .then(function(r){return r.json();}).then(function(res){ if(res.ok){ if(!es) openStream(id); } else { addMsg('error','⚠ '+(res.error||'send failed')); } });
  }
  function fork(){
    if(!cur||!cur.sessionId) return;
    fetch('/chat/fork?session='+encodeURIComponent(cur.sessionId)+'&cwd='+encodeURIComponent(cur.cwd||''),{method:'POST'})
      .then(function(r){return r.json();}).then(function(res){ if(!res.ok){ alert(res.error||'fork failed'); return; }
        var ns={vendor:'claude',sessionId:res.session,title:'(fork) '+(cur.title||''),cwd:cur.cwd,project:cur.project,file:'',ageDays:0,prompts:0,actions:0,brief:cur.brief};
        SESS.unshift(ns); select(ns); openStream(res.session); });
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

  renderSidebar();
  byId('send').onclick=send;
  byId('forkBtn').onclick=fork;
  byId('nbtn').onclick=newSession;
  byId('newToggle').onclick=function(){ byId('newbox').classList.toggle('open'); };
  byId('input').addEventListener('keydown',function(e){ if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); send(); } });
})();
</script>
</body>
</html>`;
}
