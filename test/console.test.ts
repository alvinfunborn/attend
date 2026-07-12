import { describe, expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

const view: ConsoleView = {
  sessions: [],
  knownDirs: [],
  scopeRoots: [],
  changelogMarkdown: "# Changelog\n\n## 1.0.0\n\n- First release.",
  sessions1h: 2,
  prompts1h: 5,
  chars1h: 1_250,
  vendors: [],
  claudeModels: [],
  codexModels: [],
  cursorModels: [],
  tags: [],
};

describe("renderConsole", () => {
  it("attaches hidden comment threads to assistant messages and pins only on send", () => {
    const html = renderConsole(view);
    expect(html).toContain('class="commentdrawer" id="commentDrawer"');
    expect(html).toContain(
      ".commentanchor { margin: 0.65rem 0.9rem 0; min-width: 0; }",
    );
    expect(html).not.toContain(".commentanchor::before");
    expect(html).not.toContain("-webkit-line-clamp: 3;");
    expect(html).toContain('id="commentAnchorLabel">REFERENCE</span>');
    expect(html).toContain('id="commentAnchorToggle">hide</span>');
    expect(html).toContain('id="commentAnchorContent"');
    expect(html).toContain("function commentAnchorDataFromBlock(block)");
    expect(html).toContain("function renderCommentAnchorBlock(text,key,data)");
    expect(html).toContain("function toggleCommentAnchor()");
    expect(html).toContain("data&&data.kind==='tool'?'TOOL REFERENCE':'REFERENCE'");
    expect(html).toContain("addTool(data.tool,{reference:true,target:content})");
    expect(html).toContain("if(opts.reference){");
    expect(html).toContain(".commenthead { flex: 0 0 3rem; height: 3rem; display: flex; align-items: center;");
    expect(html).toContain(".commentactions { flex-shrink: 0; display: flex; align-items: center;");
    expect(html).toContain(".commentpromote { height: 1.75rem; min-height: 1.75rem;");
    expect(html).toContain(".commentclose { width: 1.75rem; height: 1.75rem;");
    expect(html).toContain('<div class="commentactions">');
    expect(html).not.toContain("border-bottom: 1px solid var(--line-2); background: transparent; color: var(--ink-3); font-size: 0.73rem;");
    expect(html).toContain("setIconButton(cb,'comment','Comment on this response');");
    expect(html).toContain(
      "if(commentDrawerState.anchorMsg) ensureMessagePinned(commentDrawerState.anchorMsg);",
    );
    expect(html).toContain(
      "function commentThreadForAnchor(parentSessionId, anchorKey, anchorText)",
    );
    expect(html).toContain("function normalizedCommentAnchor(text)");
    expect(html).toContain("currentText.indexOf(savedText)===0");
    const bootstrap = html.slice(
      html.indexOf("function applyBootstrap(view)"),
      html.indexOf("function startUnlockFlow()"),
    );
    expect(bootstrap).toContain(
      "commentThreads = VAULT_STATE.commentThreads && typeof VAULT_STATE.commentThreads==='object' ? VAULT_STATE.commentThreads : {};",
    );
    expect(html).toContain("var cb=el('button','pincomment '+String(thread.status||''),label);");
    expect(html).toContain("fetch('/comments/send'");
    expect(html).toContain("if(onCommentBusEvent(message)) return;");
    expect(html).toContain("status=el('div','msg assistant thinking')");
    expect(html).toContain("commentDrawerState.generating?'■ stop'");
    expect(html).not.toContain("commentDrawerState.generating?'queue':'send'");
    expect(html).toContain("if(open) setCommentGenerating(true,ev.startedAt);");
    expect(html).not.toContain("if(input) input.disabled=!!on;");
    expect(html).toContain('id="commentInput" rows="1" placeholder="message"');
    expect(html).not.toContain("resizeCommentInput");
    expect(html).toContain(
      "if(ev.key==='Enter'&&!ev.shiftKey&&!isImeConfirming(ev)){ ev.preventDefault(); sendComment(); }",
    );
    expect(html).toContain(".foot button.send, .commentfoot button.send");
    expect(html).toContain(".foot button.send.stopping, .commentfoot button.send.stopping");
    expect(html).toContain('class="composer commentcomposer"');
    expect(html).toContain("var node=el('div','msg '+role), bubble=el('div','bubble');");
    expect(html).toContain("setBubbleText(bubble,text||'',role==='user'||role==='assistant');");
    expect(html).toContain("commentSend.onclick=commentPrimaryAction;");
    expect(html).toContain("function stopCommentTurn(){");
    expect(html).toContain(
      "fetch('/chat/abort?session='+encodeURIComponent(thread.providerSessionId)",
    );
    expect(html).toContain("var commentMessageCache = {};");
    expect(html).toContain(
      "renderCommentMessages(thread&&commentMessageCache[thread.id]||[],false);",
    );
    expect(html).toContain("cacheOpenCommentMessages();");
    expect(html).toContain('id="commentPromote" type="button">promote to session</button>');
    expect(html).not.toContain("button.hidden=!thread;");
    expect(html).toContain("button.disabled=!thread||commentDrawerState.busy");
    expect(html).toContain("function promoteCommentThread(){");
    expect(html).toContain("fetch('/comments/promote'");
    expect(html).toContain("commentPromote.onclick=promoteCommentThread;");
  });

  it("pins and comments on structured tool blocks using the shared block controls", () => {
    const html = renderConsole(view);
    expect(html).toContain("function toolBlockKey(tc)");
    expect(html).toContain("block.setAttribute('data-msg-key',toolBlockKey(tc));");
    expect(html).toContain("setIconButton(pin,'pin','Pin this tool block to the top');");
    expect(html).toContain("setIconButton(comment,'comment','Comment on this tool block');");
    expect(html).toContain("openCommentsForMessage(block);");
    expect(html).toContain("if(msgEl && msgEl.classList && msgEl.classList.contains('toolc'))");
    expect(html).toContain("return toolBlockSnapshot(msgEl);");
    expect(html).toContain("msgs.querySelectorAll('.msg, .toolc')");
    expect(html).toContain("msgs.querySelectorAll('.msg.assistant, .toolc')");
    expect(html).toContain("updateToolBlockResult(t,ev.text,ev.isError);");
    expect(html).toContain("refreshPinnedToolSnapshot(block);");
    expect(html).toContain("commentDrawerState.anchorMsg.hasAttribute('data-tool-pending')");
    expect(html).toContain(".toolrow:hover > .msg-pin, .toolrow:hover > .msg-comment");
    expect(html).toContain("var row=el('div','toolrow'); row.appendChild(d);");
    expect(html).toContain("row.appendChild(pin); syncMessagePinState(block);");
  });

  it("anchors a new session's first user turn before replaying app-server events", () => {
    const html = renderConsole(view);
    const start = html.indexOf("var ns={vendor:vendor");
    const end = html.indexOf("SESS.unshift(ns); drainOrphanBusEvents(ns);", start);
    const newSessionBody = html.slice(start, end);
    expect(newSessionBody.indexOf("cacheTranscript(ns, []);")).toBeGreaterThan(-1);
    expect(
      newSessionBody.indexOf("rememberPendingUserMsg(res.session, shown, attachments);"),
    ).toBeGreaterThan(newSessionBody.indexOf("cacheTranscript(ns, []);"));
    expect(
      newSessionBody.indexOf("cacheTranscriptUserMsg(ns, shown, attachments);"),
    ).toBeGreaterThan(
      newSessionBody.indexOf("rememberPendingUserMsg(res.session, shown, attachments);"),
    );
    expect(newSessionBody).not.toContain("cacheTranscript(ns, shown ?");
  });

  it("keeps the new-session form open while the user works elsewhere in the console", () => {
    const html = renderConsole(view);
    expect(html).toContain(
      "byId('newClose').onclick=function(ev){ ev.stopPropagation(); closeNewBox(); };",
    );
    expect(html).toContain(
      "if(e.key==='Escape' && newBoxOpen() && !newSessionPending){ closeNewBox(); }",
    );
    expect(html).not.toContain("if(box.contains(ev.target) || btn.contains(ev.target)) return;");
  });

  it("uses the sidebar session-row hierarchy in the open chat header", () => {
    const html = renderConsole(view);
    expect(html).toContain('<div class="headrow it-titlerow">');
    expect(html).toContain('class="headstatus it-status read"');
    expect(html).toContain('class="it-age" id="h-age"');
    expect(html).toContain('class="it-meta" id="h-sig"');
    expect(html).toContain("renderSessionSignals(sig,s);");
    expect(html).toContain("renderSessionSignals(meta,s);");
    expect(html).toContain("reasonEl.setAttribute('data-hover-tip',reason);");
    expect(html).toContain("host.appendChild(reasonEl);");
    expect(html).toContain("var row=el('div','headtag-row it-footrow');");
    expect(html).toContain("var tags=el('div','it-tags');");
    expect(html.indexOf('id="h-sig"')).toBeLessThan(html.indexOf('id="h-sub"'));
    const sidebar = html.slice(html.indexOf("function renderSidebar(){"));
    expect(sidebar.indexOf("renderSessionSignals(meta,s);")).toBeLessThan(
      sidebar.indexOf("sessionPromptLine('it-firstline','First',s.title)"),
    );
  });

  it("forks completed edits but resends the latest message from a user-stopped turn", () => {
    const html = renderConsole(view);
    expect(html).toContain("function editAndForkFromMessage(msgEl, bubble)");
    expect(html).toContain("function editUserMessage(msgEl, bubble)");
    expect(html).toContain("function canResendStoppedLatest(msgEl)");
    expect(html).toContain("cur.lastGenerationStoppedByUser");
    expect(html).toContain("if(cur && stoppedByUser) cur.lastGenerationStoppedByUser=true;");
    expect(html).toContain("if(cur) cur.lastGenerationStoppedByUser=false;");
    expect(html).toContain(
      "if(canResendStoppedLatest(msgEl)) editStoppedLatestAndResend(msgEl, bubble);",
    );
    expect(html).toContain("else editAndForkFromMessage(msgEl, bubble);");
    expect(html).toContain("dispatchSend({ text:v, attachments:[] }, v);");
    expect(html).toContain("'resend ▸'");
    expect(html).toContain("if(!cur || !cur.sessionId || cur.pendingFork) return;");
    expect(html).toContain("startForkFromPrefix(prefix, { text:v, attachments:[] });");
    expect(html).toContain(".inline-edit { position: relative;");
    expect(html).toContain(".inline-edit-bar { position: absolute;");
    expect(html).toContain("box.classList.toggle('single-line', rows===1);");
    expect(html).toContain("prefixHistory:cloneTranscriptMsgs(prefixHistory)");
    expect(html).toContain("var domHistory=domHistoryBeforeMsg(msgEl);");
    expect(html).toContain("if(domHistory) return cloneTranscriptMsgs(domHistory);");
    expect(html).toContain("if(hasPrefix) body.contextMessages=parentHistory;");
  });

  it("keeps composer forks on the parent while edited-message forks open the branch", () => {
    const html = renderConsole(view);
    const prefixFork = html.slice(
      html.indexOf("function startForkFromPrefix(prefixHistory, firstTurn){"),
      html.indexOf("function startFork(config){"),
    );
    const composerFork = html.slice(
      html.indexOf("function startFork(config){"),
      html.indexOf("function fork(){"),
    );
    expect(prefixFork).toContain("select(ns);");
    expect(prefixFork).toContain("materializeFork(ns, firstTurn);");
    expect(composerFork).not.toContain("select(ns);");
    expect(composerFork).toContain("materializeFork(ns, firstTurn, {background:true});");
    expect(html).toContain("var background=!!(opts&&opts.background&&cur!==branch);");
    expect(html).toContain("if(!background) addMsg('user', shown, true, turn.attachments);");
  });

  it("renders attachment controls for new sessions and submits their payload", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="newAttachDrop"');
    expect(html).toContain('id="nfile" type="file" multiple hidden');
    expect(html).toContain("bindNewAttachments();");
    expect(html).toContain("body:JSON.stringify({text:text, attachments:attachments");
    expect(html).toContain("cacheTranscript(ns, []);");
    expect(html).toContain("rememberPendingUserMsg(res.session, shown, attachments);");
    expect(html).toContain("cacheTranscriptUserMsg(ns, shown, attachments);");
    expect(html).toContain("SESS.unshift(ns); drainOrphanBusEvents(ns); select(ns);");
  });

  it("supports Excel attachments in the browser uploader", () => {
    const html = renderConsole(view);
    expect(html).toContain(
      "xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'",
    );
    expect(html).toContain("return readBinaryAttachment(file, 'file', xlsType);");
    expect(html).not.toContain("Attached '+added+' file");
  });

  it("renders attachment controls for existing chat composer", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="attach" class="attachpick"');
    expect(html).toContain('id="file" type="file" multiple hidden');
    expect(html).toContain(".attachpick { position: absolute;");
    expect(html).toContain(".attachpick:hover { color: var(--ink); background: transparent;");
    expect(html).toContain(".attachpick:active { transform: translateY(-50%); }");
    expect(html).toContain('<svg viewBox="0 0 16 16" aria-hidden="true">');
    expect(html).toContain(
      "var box=byId('composer'), input=byId('input'), pick=byId('attach'), fileInput=byId('file');",
    );
    expect(html).toContain(
      "fileInput.onchange=function(){ addAttachments(Array.prototype.slice.call(fileInput.files||[])).catch(function(){}); fileInput.value=''; };",
    );
  });

  it("hides the chat composer until a session is selected", () => {
    const html = renderConsole(view);
    expect(html).toContain('<body class="no-session">');
    expect(html).toContain(
      "body.no-session #queue, body.no-session .foot, body.no-session .chat-scrollbottom { display: none; }",
    );
    expect(html).toContain("document.body.classList.add('no-session');");
    expect(html).toContain("document.body.classList.remove('no-session');");
    expect(html).toContain("cur = null;");
  });

  it("shows the changelog when no chat session is selected", () => {
    const html = renderConsole(view);
    expect(html).toContain('class="changelog" id="ph"');
    expect(html).toContain('id="changelogContent"');
    expect(html).toContain('window.__CHANGELOG__ = "# Changelog\\n\\n## 1.0.0');
    expect(html).toContain("changelogContent.innerHTML = renderMarkdown(CHANGELOG_MARKDOWN);");
    expect(html).not.toContain("Conversations, without losing focus");
    expect(html).toContain(
      "var noSessionChangelog = byId('ph') ? byId('ph').cloneNode(true) : null;",
    );
    expect(html).toContain("replaceMessages(noSessionChangelog.cloneNode(true));");
    expect(html).toContain("sub.textContent='Recent changes';");
    expect(html).not.toContain(
      "Pick a session on the left to see its chat, then type below to continue it",
    );
  });

  it("supports pasted clipboard files in both attachment composers", () => {
    const html = renderConsole(view);
    expect(html).toContain("function clipboardFiles(ev)");
    expect(html).toContain("bindAttachmentPaste(input);");
    expect(html).toContain("bindAttachmentPaste(input, 'new');");
    expect(html).toContain("namedClipboardFile(file, out.length)");
  });

  it("renders sent attachments as cards with image previews", () => {
    const html = renderConsole(view);
    expect(html).toContain("function appendAttachmentCards(bubble, atts)");
    expect(html).toContain("card.className='attcard '+(att.kind==='image' ? 'image' : att.kind)");
    expect(html).toContain("img.src=href;");
    expect(html).toContain("function openMediaPreview(opts)");
    expect(html).toContain("function openImagePreview(src, name)");
    expect(html).toContain(
      "card.onclick=function(ev){ ev.preventDefault(); openImagePreview(href, att.name||'image'); };",
    );
    expect(html).not.toContain("card.download=att.name||'attachment';");
    expect(html).toContain('id="imgPreview"');
    expect(html).toContain('id="imgPreviewViewport"');
    expect(html).not.toContain('id="imgPreviewZoomIn"');
    expect(html).not.toContain('id="imgPreviewClose"');
    expect(html).toContain("attachments: cloneAttachments(m && m.attachments)");
    expect(html).toContain("cacheTranscriptUserMsg(cur, shown, turn.attachments);");
  });

  it("anchors pending local user messages instead of appending them after replies", () => {
    const html = renderConsole(view);
    expect(html).toContain("afterMsgs:Array.isArray(state) ? state.length : null");
    expect(html).toContain("afterTail:pendingAfterTail(state)");
    expect(html).toContain("sentAt:Date.now()");
    expect(html).toContain("function findTailEndIndex(msgs, tail)");
    expect(html).toContain("function timestampConfirmsPending(user, entry, afterWindow)");
    expect(html).toContain(
      "var startAt=Math.max(minMsgIndex, anchorEnd!=null ? anchorEnd : entries[i].afterMsgs);",
    );
    expect(html).toContain(
      "if(users[j].msgIndex < startAt && !timestampConfirmsPending(users[j], entries[i], afterWindow)) continue;",
    );
    expect(html).toContain("function insertPendingUserMsgs(pending, beforeIndex)");
    expect(html).toContain("insertPendingUserMsgs(pending, i);");
  });

  it("keeps live-cache assistant text after tools below the tool blocks", () => {
    const html = renderConsole(view);
    expect(html).toContain("function ensureAssistantTranscriptMsg(s, forceNew)");
    expect(html).toContain(
      "last && last.role==='assistant' && Array.isArray(last.tools) && last.tools.length",
    );
    expect(html).toContain("var msg=ensureAssistantTranscriptMsg(s, afterTool);");
  });

  it("keeps optimistic latest prompt while transcript source is stale", () => {
    const html = renderConsole(view);
    expect(html).toContain("function latestPendingUserText(sessionId)");
    expect(html).toContain("var pendingLatest=latestPendingUserText(s.sessionId);");
    expect(html).toContain(
      "if(found.lastPrompt && !pendingLatest) s.lastPrompt = found.lastPrompt;",
    );
  });

  it("re-sorts the sidebar when session activity timestamps change", () => {
    const html = renderConsole(view);
    expect(html).toContain("function syncActivitySortTs(s, ts)");
    expect(html).toContain("function syncActivityLastTs(s, ts)");
    expect(html).toContain(
      "['pattern','patternset','patternReason','patternData','avoidancePrompt','state','stateset','score','reason','etaMin','brief','customTitle','forkParentId','priorityset','etaset','unread','seen','userPromptTs']",
    );
    expect(html).toContain("syncActivitySortTs(s, next.sortTs!=null ? next.sortTs : next.lastTs);");
    expect(html).toContain("syncActivitySortTs(s, s.lastTs);");
    expect(html).toContain("syncActivityLastTs(s, found.lastTs);");
  });

  it("routes every session through one ordered global SSE event bus", () => {
    const html = renderConsole(view);
    expect(html).toContain("liveEs=new EventSource('/chat/live-stream');");
    expect(html).toContain("function onBusSessionEvent(message)");
    expect(html).toContain("message.kind==='session_event'");
    expect(html).toContain("liveEventChain=liveEventChain.then(function()");
    expect(html).toContain(
      "if(cur===s){ onEvent(ev, String(s.sessionId||''), emittedAt); return; }",
    );
    expect(html).toContain("cacheTranscriptAssistantText(s, ev.text)");
    expect(html).toContain(
      "function reduceLatestLiveSnapshotEvent(sessionId, clientSessionId, ev, emittedAt)",
    );
    expect(html).toContain(
      "reduceLatestLiveSnapshotEvent(sessionId, clientSessionId, ev, emittedAt);",
    );
    expect(html).toContain("findSessionByClientId(clientSessionId)");
    expect(html).not.toContain("new EventSource('/chat/stream?");
    expect(html).not.toContain("function openStream(id,vendor)");
  });

  it("clears the local generating state as soon as Stop returns", () => {
    const html = renderConsole(view);
    expect(html).toContain(
      "if(cur===stopping && stopRequested){ turnEnded(); syncCurrentLiveState(stopping); }",
    );
  });

  it("projects the latest global SSE snapshot instead of polling while connected", () => {
    const html = renderConsole(view);
    const syncBody = html.slice(
      html.indexOf("function syncCurrentLiveState(s){"),
      html.indexOf("function fetchLiveSnapshot(onOk){"),
    );
    expect(html).toContain("latestLiveSnapshot=res||{};");
    expect(syncBody).toContain("if(liveStateConnected && latestLiveSnapshot){");
    expect(syncBody).toContain("applyLiveSnapshot(latestLiveSnapshot);");
    expect(syncBody).toContain("fetchLiveSnapshot(function(res)");
  });

  it("renders restored queued drafts after clearing stale selected-session turn state", () => {
    const html = renderConsole(view);
    const selectBody = html.slice(
      html.indexOf("function select(s, opts){"),
      html.indexOf("if(s.pendingFork){"),
    );
    expect(selectBody.indexOf("turnActive=false")).toBeGreaterThan(-1);
    expect(selectBody.indexOf("renderQueue();")).toBeGreaterThan(
      selectBody.indexOf("turnActive=false"),
    );
  });

  it("does not change recent ordering merely because a session was opened", () => {
    const html = renderConsole(view);
    expect(html).toContain("if(s && s.sortTs==null && s.lastTs!=null) s.sortTs=s.lastTs;");
    expect(html).toContain("hydrateSessionSource(s, {force:isRefresh,preserveSort:!isRefresh})");
    expect(html).toContain(
      "if(!preserveSort){ syncActivitySortTs(s, found.lastTs); sortSessions(); }",
    );
  });

  it("projects composer drafts only after the composer loses focus", () => {
    const html = renderConsole(view);
    expect(html).toContain("function draftTextForSession(s)");
    expect(html).toContain("function composerOwnsDraftForSession(s)");
    expect(html).toContain("document.activeElement===input");
    expect(html).toContain("function appendLatestPrompt(host, s, cls)");
    expect(html).toContain(
      "var draft=composerOwnsDraftForSession(s) ? '' : draftTextForSession(s);",
    );
    expect(html).toContain("draft?'Draft':'Latest'");
    expect(html).not.toContain("draft-latest");
    expect(html).toContain("setIconButton(edit,'edit','Edit draft');");
    expect(html).toContain("if(cur!==s) select(s);");
    expect(html).toContain(".draft-edit { display: inline-flex;");
    expect(html).toContain("background: transparent; color: #dc2626;");
    expect(html).toContain("line.appendChild(el('span','prompt-line-text',String(value||'')));");
    expect(html).toContain("appendLatestPrompt(item, s, 'it-firstline');");
    expect(html).toContain(
      "else if(!hasDraft && hadDraft) renderSidebar();\n    syncOpenHeader();",
    );
    expect(html).toContain("byId('input').addEventListener('focus',function(){");
    expect(html).toContain("byId('input').addEventListener('blur',function(){");
  });

  it("clears the parent draft after using it as a fork opening turn", () => {
    const html = renderConsole(view);
    expect(html).toContain("function forkTitleFromSession(s, userMsg)");
    expect(html).toContain("title:forkTitleFromSession(cur, firstTurn.text)");
    expect(html).toContain(
      "if(String(turn&&turn.text||'').trim()) branch.title=forkTitleFromSession(parent, turn.text);",
    );
    expect(html).toContain("var message=String(userMsg||'').trim();");
    expect(html).toContain("stripForkPrefix(message || (s && s.brief)");
    expect(html).toContain("function clearDraftForSession(s)");
    expect(html).toContain("consumeParentDraft:!!(firstTurn.text || firstTurn.attachments.length)");
    expect(html).toContain(
      "if(branch.pendingFork.consumeParentDraft) clearDraftForSession(parent);",
    );
    expect(html).toContain("if(background && parent && cur===parent) syncOpenHeader();");
  });

  it("renders a fork opener before the stale parent answer it is replacing", () => {
    const html = renderConsole(view);
    expect(html).toContain("function forkBaseHistory(msgs, openingText)");
    expect(html).toContain("return String(m.text||'').trim()===needle ? base.slice(0, i) : base;");
    expect(html).toContain(
      "var hasPrefix=!!(branch.pendingFork && Object.prototype.hasOwnProperty.call(branch.pendingFork, 'prefixHistory'));",
    );
    expect(html).toContain(
      ": forkBaseHistory((parent && cachedTranscriptFor(parent)) || [], shown);",
    );
    expect(html).toContain("if(res.cwd) branch.cwd=res.cwd;");
    expect(html).toContain("else if(res.cwd) branch.project=basename(res.cwd);");
  });

  it("anchors a materialized fork opener before adding it to the transcript cache", () => {
    const html = renderConsole(view);
    const forkBody = html.slice(
      html.indexOf("function materializeFork(branch,turn,opts){"),
      html.indexOf("function vendorInfo(id){"),
    );
    const cacheParent = forkBody.indexOf("cacheTranscript(branch, parentHistory);");
    const rememberOpener = forkBody.indexOf(
      "rememberPendingUserMsg(branch.sessionId, shown, turn.attachments);",
    );
    const cacheOpener = forkBody.indexOf(
      "cacheTranscriptUserMsg(branch, shown, turn.attachments);",
    );
    expect(cacheParent).toBeGreaterThan(-1);
    expect(rememberOpener).toBeGreaterThan(cacheParent);
    expect(cacheOpener).toBeGreaterThan(rememberOpener);
    expect(forkBody).not.toContain("parentHistory.concat([{ role:'user'");
    expect(forkBody).toContain(
      "if(latestLiveSnapshot && (!background || snapshotActive.indexOf(res.session)>=0)) applyLiveSnapshot(latestLiveSnapshot);",
    );
    expect(forkBody).toContain("clientSessionId:branch.clientBranchId");
    expect(forkBody).toContain("branch.providerSessionId=res.session;");
    expect(forkBody).toContain("rememberForkRelation(res.session,branch.forkParentId);");
    expect(forkBody).toContain("branch.pendingFork=null;");
    expect(forkBody).not.toContain("branch.sessionId=res.session");
    expect(html).toContain("sessionId:clientBranchId");
    expect(html).toContain("clientBranchId:clientBranchId");
    expect(html).toContain("providerSessionId:null");
    expect(html).toContain("function providerSessionId(s)");
  });

  it("uses one vendor/model/effort config and forks directly", () => {
    const html = renderConsole(view);
    expect(html).not.toContain('id="forkPop"');
    expect(html).toContain('id="rvendor"');
    expect(html).toContain("function refreshRunConfigControls(changedVendor)");
    expect(html).toContain("if(sel.id==='rvendor') return vendorTheme");
    expect(html).toContain(
      "styleSelectTheme(ctrl.button, customSelectTheme(sel, sel.value), true);",
    );
    expect(html).toContain("startFork(currentForkDefaults());");
    expect(html).toContain("b.disabled = !turnActive && composerVendorChanged();");
    expect(html).toContain("if(composerVendorChanged()) return;");
    expect(html).toContain('class="runconfig-anchor"');
    expect(html).toContain(".runpop { right: 0;");
    expect(html).toContain(".runpop .selectmenu { top: auto; bottom: calc(100% + 4px); }");
    expect(html).not.toContain('id="runCancel"');
    expect(html).not.toContain('id="runApply"');
    expect(html).toContain("reffort.addEventListener('change', applyRunConfig)");
    expect(html).toContain("refreshRunConfigControls(true); applyRunConfig();");
  });

  it("does not steal focus when an async chat turn ends", () => {
    const html = renderConsole(view);
    const start = html.indexOf("function setInputEnabled(on)");
    const end = html.indexOf("function draftKey", start);
    expect(start).toBeGreaterThan(-1);
    expect(html.slice(start, end)).not.toContain(".focus(");
  });

  it("applies same-session run config immediately and submits it on send", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="runPop"');
    expect(html).toContain('id="runCfgBtn"');
    expect(html).toContain("function applyRunConfig()");
    expect(html).toContain("config.model || cliDefault(config.vendor, 'model') || 'CLI default'");
    expect(html).toContain("cliDefault(config.vendor, 'effort') || 'CLI default'");
    expect(html).toContain("if(cur.runConfigDirty)");
    expect(html).toContain("body.runConfig=true;");
  });

  it("links each model picker to that model's last-used effort", () => {
    const html = renderConsole(view);
    expect(html).toContain("var parsed=VAULT_STATE && VAULT_STATE.modelPrefs;");
    expect(html).toContain("saveVaultUiState({modelPrefs:newPrefs});");
    expect(html).toContain("function rememberedModelEffort(vendor, model)");
    expect(html).toContain("function linkedEffortFor(vendor, model)");
    expect(html).toContain("newPrefs.modelEfforts[vendor][modelEffortKey(model)]");
    expect(html).toContain("nmodel.addEventListener('change', syncNewEffortToModel)");
    expect(html).toContain("rmodel.addEventListener('change', syncRunEffortToModel)");
    expect(html).toContain("refreshNewEffortOptions(linkedEffortFor(vendor, model));");
    expect(html).toContain("refreshRunEffortOptions(linkedEffortFor(vendor, model));");
    expect(html).not.toContain("current CLI effort");
  });

  it("lets users persist a custom session title in the vault", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="titleEditBtn"');
    expect(html).toContain('class="headbtn title-edit-btn" id="titleEditBtn"');
    expect(html).toContain(".title-edit-btn svg { width: 0.68rem; height: 0.68rem;");
    expect(html).toContain("function startTitleEdit()");
    expect(html).toContain("function saveSessionCustomTitle(s, value)");
    expect(html).toContain("saveVaultUiState({sessionTitles:titles});");
    expect(html).toContain("function renderSessionTitle(node, s, baseClass)");
    expect(html).not.toContain(".session-title.manual .session-title-main");
    expect(html).not.toContain("--user-title:");
    expect(html).toContain(
      ".title-edit-input { width: 100%; box-sizing: border-box; font: inherit; font-size: 0.84rem; font-weight: 600; color: var(--ink);",
    );
    expect(html).toContain("node.setAttribute('data-hover-tip',tip);");
    expect(html).toContain("title.removeAttribute('data-hover-tip');");
    expect(html).toContain("ht.removeAttribute('data-hover-tip');");
    expect(html).toContain("renderSessionTitle(byId('h-title'), cur, 't it-title');");
    expect(html).toContain("renderSessionTitle(t, s, 'it-title');");
    expect(html).toContain("textHasSearch(s.customTitle)");
    expect(html).toContain("applyVaultSessionTitles();");
  });

  it("refreshes vendor model snapshots after first render without reloading the page", () => {
    const html = renderConsole(view);
    expect(html).toContain("function refreshClaudeModels()");
    expect(html).toContain("fetch('/models/claude', { cache:'no-store' })");
    expect(html).toContain("applyClaudeModelSnapshot(res && res.models);");
    expect(html).toContain("var claudeModelRefreshTimer=window.setInterval");
    expect(html).toContain("function refreshCodexModels()");
    expect(html).toContain("fetch('/models/codex', { cache:'no-store' })");
    expect(html).toContain("applyCodexModelSnapshot(res && res.models);");
    expect(html).toContain("var codexModelRefreshTimer=window.setInterval");
    expect(html).toContain("if(codexModelRefreshCount>=12)");
    expect(html).toContain('id="nmodelWarning"');
    expect(html).toContain('id="rmodelWarning"');
    expect(html).toContain("applyModelWarning('claude', res && res.warning);");
    expect(html).toContain("applyModelWarning('codex', res && res.warning);");
  });

  it("remembers model effort when new, chat, and fork configs are used", () => {
    const html = renderConsole(view);
    expect(html).toContain(
      "newPrefs[vendor]={ model:String(model||'').trim(), effort:String(effort||'').trim() };",
    );
    expect(html).toContain("rememberModelEffort(vendor, model, effort);");
    expect(html).toContain("rememberModelEffort(config.vendor, config.model, config.effort);");
    expect(html).toContain("rememberModelEffort(vendor, cur.model||'', cur.effort||'');");
  });

  it("cascades a changed chat vendor to its most recently used model and effort", () => {
    const html = renderConsole(view);
    expect(html).toContain("var recent=newPrefs[vendor] || {};");
    expect(html).toContain(
      "var model=(keep ? defaults.model : String(recent.model||'').trim()) || cliDefault(vendor, 'model');",
    );
    expect(html).toContain("var effort=keep ? defaults.effort : linkedEffortFor(vendor, model);");
  });

  it("uses the server as the queued-draft source of truth", () => {
    const html = renderConsole(view);
    expect(html).toContain("function refreshServerQueue(s)");
    expect(html).toContain("fetch('/chat/queue?session='");
    expect(html).toContain("fetch('/chat/queue/send?session='");
    expect(html).toContain("method:'PATCH'");
    expect(html).toContain("method:'DELETE'");
    expect(html).toContain("if(ev.kind==='queued_turn_started'){");
    expect(html).toContain("function syncQueuedEditShape(){");
    expect(html).toContain("ta.oninput=syncQueuedEditShape;");
    const queueEditorStart = html.indexOf("function makeQueuedEditor(turn, i)");
    const queueEditorEnd = html.indexOf("// The send button doubles as Stop", queueEditorStart);
    expect(html.slice(queueEditorStart, queueEditorEnd)).not.toContain(
      "ta.oninput=syncInlineEditShape;",
    );
    expect(html).not.toContain("function advanceQueuedIfIdle()");
    expect(html).not.toContain("function pumpQueuedDrafts()");
    expect(html).not.toContain("setInterval(pumpQueuedDrafts, 1000);");
  });

  it("does not report generation progress watching as avoidance review", () => {
    const html = renderConsole(view);
    expect(html).toContain("wasGenerating: !!s.generating");
    expect(html).toContain("wasGenerating: payload.wasGenerating");
    expect(html).toContain(
      "wasGenerating: !!v.wasGenerating || !!(cur && cur.sessionId===v.sessionId && cur.generating)",
    );
  });

  it("keeps transcript loading independent from the always-on event bus", () => {
    const html = renderConsole(view);
    expect(html).toContain("var finishHistoryLoad=function(){");
    expect(html).toContain("syncCurrentLiveState(s);");
    expect(html).toContain("finishHistoryLoad();");
    expect(html).not.toContain("var liveStarted=false;");
    expect(html).not.toContain("startLive();");
  });

  it("does not apply selected-stream replay dedupe to bus events", () => {
    const html = renderConsole(view);
    expect(html).not.toContain("primeCatchup();");
    expect(html).not.toContain("if(consumeCatchup(ev.text)) return;");
  });

  it("only marks AskUserQuestion as answered when a non-empty result arrives", () => {
    const html = renderConsole(view);
    expect(html).toContain("function isQuestionTool(name, input)");
    expect(html).toContain("base==='request_user_input'");
    expect(html).toContain(
      "if(isQuestionTool(tc.name, tc.input) && hasQuestionAnswerResult(tc.result, tc.isError)) lockQuestionTool(d);",
    );
    expect(html).toContain("if(hasQuestionAnswerResult(ev.text, ev.isError)) lockQuestionTool(t);");
  });

  it("themes the new-session choosers and commits dropdown picks on click", () => {
    const html = renderConsole(view);
    expect(html).toContain(
      "--vendor-cursor-fg: #18181b; --vendor-cursor-bg: #f4f4f5; --vendor-cursor-border: #a1a1aa;",
    );
    expect(html).toContain(
      "--vendor-cursor-fg: #f4f4f5; --vendor-cursor-bg: #27272a; --vendor-cursor-border: #71717a;",
    );
    expect(html).toContain(
      "? { fg:'var(--vendor-cursor-fg)', bg:'var(--vendor-cursor-bg)', border:'var(--vendor-cursor-border)' }",
    );
    expect(html).toContain(
      ".vtag.cursor { color: var(--vendor-cursor-fg); background: var(--vendor-cursor-bg); border-color: var(--vendor-cursor-border); }",
    );
    expect(html).toContain("applyVendorChooserTheme(input.value);");
    expect(html).toContain("applyDirChooserTheme(input.value);");
    expect(html).toContain(".chooser-opt-label { font-size: 0.78rem; color: inherit;");
    expect(html).toContain(".chooser-opt-meta { font-size: 0.68rem; color: inherit;");
    expect(html).toContain(
      "opt.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); choose(info.vendor); };",
    );
    expect(html).toContain(
      "opt.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); choose(choice.value); };",
    );
    expect(html).toContain(
      "document.addEventListener('pointerdown', function(ev){ if(!byId('nvendorBox') || byId('nvendorBox').contains(ev.target)) return; hide(); });",
    );
    expect(html).toContain(
      "document.addEventListener('pointerdown', function(ev){ if(!byId('ndirBox') || byId('ndirBox').contains(ev.target)) return; hide(); });",
    );
    const vendorChooser = html.slice(
      html.indexOf("function setupVendorChooser()"),
      html.indexOf("function setupDirChooser()"),
    );
    const dirChooser = html.slice(
      html.indexOf("function setupDirChooser()"),
      html.indexOf("function setNewPending("),
    );
    expect(vendorChooser).not.toContain("styleTheme(opt");
    expect(vendorChooser).not.toContain("opt.appendChild(el('div','chooser-opt-meta'");
    expect(vendorChooser).toContain("var label=el('div','chooser-opt-label', info.vendor);");
    expect(dirChooser).not.toContain("styleTheme(opt");
    expect(vendorChooser).toContain("styleSelectTheme(opt, vendorTheme(info.vendor), false);");
    expect(dirChooser).toContain(
      "styleSelectTheme(opt, projectTheme(choice.label || choice.value), false);",
    );
  });

  it("shows full model names when hovering truncated model selectors", () => {
    const html = renderConsole(view);
    expect(html).toContain("var isModel=sel.id==='nmodel'||sel.id==='rmodel';");
    expect(html).toContain("if(isModel && fullText) item.setAttribute('data-hover-tip',fullText);");
    expect(html).toContain(
      "if((sel.id==='nmodel'||sel.id==='rmodel') && selectedText) ctrl.button.setAttribute('data-hover-tip',selectedText);",
    );
  });

  it("renders a persisted one-click dark theme toggle", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="themeToggle"');
    expect(html).toContain("saveVaultUiState({theme:next});");
    expect(html).toContain('html[data-theme="dark"]');
    expect(html).toContain("function toggleTheme()");
    expect(html).toContain("byId('themeToggle').onclick=toggleTheme;");
  });

  it("renders a clear brand and refreshes throughput stats without reloading", () => {
    const html = renderConsole(view);
    expect(html).toContain('<span class="brand-name">Attend</span>');
    expect(html).not.toContain("brand-dot");
    expect(html).toContain('id="sessions1h" class="statval">2</span>');
    expect(html).toContain('id="prompts1h" class="statval">5</span>');
    expect(html).toContain('id="chars1h" class="statval">1.3k</span>');
    expect(html).toContain('class="statlbl">sessions/1h</span>');
    expect(html).toContain('class="statlbl">pushes/1h</span>');
    expect(html).toContain('class="statlbl">chars/1h</span>');
    expect(html).toContain("function applyStats(stats)");
    expect(html).toContain("applyStats(res && res.stats);");
    expect(html).not.toContain("fetch('/stats')");
  });

  it("opens a centered work-pattern dashboard from the full throughput row", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="workStatsBtn" class="brand-stats"');
    expect(html).toContain('id="workStats" hidden aria-hidden="true"');
    expect(html).toContain('role="dialog" aria-modal="true"');
    expect(html).toContain("fetch('/stats/work?range='+encodeURIComponent(workStatsRange)");
    expect(html).toContain("var workStatsRange = loadWorkStatsRange();");
    expect(html).toContain("localStorage.setItem(WORK_STATS_RANGE_KEY,workStatsRange)");
    expect(html).toContain('data-range="1h"');
    expect(html).toContain('data-range="3h"');
    expect(html).toContain('data-range="6h"');
    expect(html).toContain('data-range="12h"');
    expect(html).toContain('data-range="today" aria-pressed="true">Today</button>');
    expect(html).toContain('data-range="24h"');
    expect(html).toContain('data-range="3d"');
    expect(html).toContain('data-range="7d"');
    expect(html).toContain('data-range="15d"');
    expect(html).not.toContain('data-range="30d"');
    expect(html).toContain("function workStatsReadout(modes)");
    expect(html).toContain("function openWorkStatsSession(item)");
    expect(html).toContain("bar height = prompted hours");
    expect(html).toContain("natural-hour samples");
    expect(html).toContain("Breadth and real generation overlap are separate signals.");
    expect(html).toContain("A comparison needs at least 5 prompted hours in two breadth modes.");
    expect(html).not.toContain("currently leads both");
    expect(html).toContain("Needs attention");
    expect(html).toContain("Waiting on resources");
  });

  it("renders and syncs the browser tab title from the active directory", () => {
    const html = renderConsole({
      ...view,
      pageTitle: "Attend — demo <repo>",
      sessions: [
        {
          vendor: "claude",
          sessionId: "s1",
          title: "first",
          lastPrompt: null,
          cwd: "/tmp/demo-repo",
          project: "demo-repo",
          file: "/tmp/session.jsonl",
          ageDays: 0,
          lastTs: 1,
          prompts: 1,
          pattern: "unknown",
          state: null,
          score: 0,
          reason: "",
          etaMin: 0,
          brief: null,
          tags: [],
        },
      ],
    });
    expect(html).toContain("<title>Attend — demo &lt;repo&gt;</title>");
    expect(html).toContain(
      '<span class="brand-scope" title="Attend — demo &lt;repo&gt;">demo &lt;repo&gt;</span>',
    );
    expect(html).toContain('window.__PAGE_TITLE__ = "Attend — demo \\u003crepo>"');
    expect(html).toContain("function syncPageTitle(s)");
    expect(html).toContain("document.title = label ? 'Attend — '+label : PAGE_TITLE;");
    expect(html).toContain("syncPageTitle(s);");
  });

  it("makes the latest-user preview itself jump without extra chrome", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="latestPin"');
    expect(html).toContain("function jumpToLatestPin()");
    expect(html).toContain("byId('latestPin').onclick=jumpToLatestPin;");
    expect(html).toContain(".latestpin-text {");
    expect(html).toContain("letter-spacing: 0; text-transform: none; font-variant: normal;");
    expect(html).toContain("font-family: inherit; font-size: 0.86rem;");
    expect(html).toContain("text-rendering: optimizeLegibility;");
    expect(html).toContain(
      "body.appendChild(el('span','latestpin-text',previewTextFromMsg(msgEl)));",
    );
    expect(html).toContain("body.appendChild(el('span','latestpin-k','YOU'));");
    expect(html).toContain(".latestpin-k { flex-shrink: 0; color: #3730a3; border: 0; background: transparent; padding: 0;");
    expect(html).toContain(".pinrole { flex-shrink: 0;");
    expect(html).toContain("color: #64748b; border: 0; background: transparent; padding: 0;");
    expect(html).not.toContain("Latest you");
    expect(html).not.toContain("latest · you");
    expect(html).not.toContain("latestPinJump");
    expect(html).not.toContain("latestpin-jump");
  });

  it("pins comment messages and shows their scrolled latest user message as YOU", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="commentTopStack"');
    expect(html).toContain('id="commentPinTray"');
    expect(html).toContain('id="commentLatestPin"');
    expect(html).toContain("node.setAttribute('data-msg-key','comment:'+(commentMsgOrdinal++));");
    expect(html).toContain("setIconButton(pin,'pin','Pin this comment message to the top');");
    expect(html).toContain("return block&&block.closest&&block.closest('#commentMsgs') ? commentPinSession() : cur;");
    expect(html).toContain("return String(thread&&thread.vendor||cur&&cur.vendor||'assistant');");
    expect(html).toContain("function renderCommentPinTray()");
    expect(html).toContain("function updateCommentLatestPin()");
    expect(html).toContain("body.appendChild(el('span','latestpin-k','YOU'));");
    expect(html).toContain("commentLatestPin.onclick=jumpToCommentLatestPin;");
    expect(html).toContain("scheduleCommentLatestPin();");
  });

  it("shows shared scroll-to-bottom controls when chat or comments leave the bottom", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="chatScrollBottom"');
    expect(html).toContain('id="commentScrollBottom"');
    expect(html).toContain("setIconButton(chatScrollBottom,'down','Scroll to bottom')");
    expect(html).toContain("setIconButton(commentScrollBottom,'down','Scroll comments to bottom')");
    expect(html).toContain("function nearScrollBottom(node)");
    expect(html).toContain("chatScrollBottom.onclick=scrollChatToBottom;");
    expect(html).toContain("commentScrollBottom.onclick=scrollCommentsToBottom;");
    expect(html).toContain("if(host&&commentStick) host.scrollTop=host.scrollHeight;");
    expect(html).toContain("commentStick=nearScrollBottom(commentMsgs)");
    expect(html).toContain(".scrollbottom[hidden] { display: none; }");
  });

  it("floats the comment composer and keeps messages, queues, and scroll control above it", () => {
    const html = renderConsole(view);
    expect(html).toContain("--comment-composer-overlay-height: 4rem; --comment-queue-overlay-height: 0px;");
    expect(html).toContain(".commentfoot { position: absolute; left: 0; right: 0; bottom: 0;");
    expect(html).toContain("padding: 0 0.9rem 0.75rem; border-top: 0; background: transparent;");
    expect(html).toContain("calc(var(--comment-composer-overlay-height) + var(--comment-queue-overlay-height) + 0.8rem)");
    expect(html).toContain("bottom: calc(var(--comment-composer-overlay-height) + var(--comment-queue-overlay-height) + 0.55rem)");
    expect(html).toContain("function syncCommentOverlayOffsets()");
    expect(html).toContain("scheduleCommentOverlayOffsets();");
    expect(html).toContain("new ResizeObserver(scheduleCommentOverlayOffsets).observe(commentFoot)");
  });

  it("orders pinned message previews by their actual chat position", () => {
    const html = renderConsole(view);
    expect(html).toContain("function msgDomOrder()");
    expect(html).toContain("var nodes=msgs.querySelectorAll('.msg, .toolc');");
    expect(html).toContain(
      "Object.prototype.hasOwnProperty.call(order, ak) ? order[ak] : msgKeyIndex(ak)",
    );
    expect(html).toContain("var pins=sortPinsInChatOrder(currentPins());");
    expect(html).toContain("savePins(scope,inComments?sortCommentPins(pins):sortPinsInChatOrder(pins));");
  });

  it("uses safe text rendering for pinned message previews", () => {
    const html = renderConsole(view);
    expect(html).toContain(".pintext {");
    expect(html).toContain("font-family: inherit; font-size: 0.86rem;");
    expect(html).toContain(
      "font-weight: 400; letter-spacing: 0; text-transform: none; font-variant: normal;",
    );
    expect(html).not.toContain('font-feature-settings: "liga" 0, "clig" 0, "dlig" 0;');
    expect(html).toContain("item.appendChild(el('div','pintext',pin.text));");
  });

  it("renders distinct status light styles for active session states", () => {
    const html = renderConsole(view);
    expect(html).toContain("--status-generating:");
    expect(html).toContain("--status-seen:");
    expect(html).toContain("--status-seen: #0284c7;");
    expect(html).toContain("--status-seen: #38bdf8;");
    expect(html).toContain("@keyframes statusSpin");
    expect(html).toContain(".it-status.generating { background: transparent;");
    expect(html).toContain(".it-status.unread { background: var(--status-unread);");
    expect(html).toContain(".it-status.seen { background: transparent;");
    expect(html).toContain(".forktree-node-dot.it-status:hover { transform: none;");
    expect(html).not.toContain("statusBreathe");
  });

  it("keeps live and completed generation timing in the fixed-height title row", () => {
    const html = renderConsole(view);
    expect(html).toContain(".it-live { flex-shrink: 0;");
    expect(html).toContain("host.appendChild(liveEntry.row);");
    expect(html).not.toContain("trow.appendChild(live);");
    expect(html).not.toContain("item.appendChild(live);");
    expect(html).toContain("function liveClock(ms)");
    expect(html).toContain("entry.totalLabel.textContent='generating';");
    expect(html).toContain("entry.totalLabel.textContent=outcome;");
    expect(html).toContain("entry.quietLabel.textContent=hasOutput?'quiet':'waiting';");
    expect(html).toContain("quietSec>=300?' hot':quietSec>=120?' warm':''");
    expect(html).toContain("function finishGenerationTiming(s, endedAt, outcome)");
    expect(html).toContain("if(!s.generating && s.analysisPending)");
    expect(html).toContain("if(!s.generating && !s.analysisPending && s.etaMin!=null)");
    expect(html).toContain("@container (max-width: 360px)");
    expect(html).toContain("window.setInterval(tickLiveTimings,1000);");
    expect(html).toContain("var emittedAt=Number(message&&message.emittedAt)||Date.now();");
    expect(html).toContain("var lastAssistantAt=res&&res.lastAssistantAt||{};");
    expect(html).toContain("ev.kind==='tool_use' || ev.kind==='tool_result'");
    expect(html).toContain("if(activity) lastAssistantAt[sessionId]");
  });

  it("clears turn-scoped ETA and state while preserving priority", () => {
    const html = renderConsole(view);
    expect(html).toContain("function clearTurnScopedSignals(s)");
    expect(html).toContain("s.etaMin=null;");
    expect(html).toContain("s.etaset=false;");
    expect(html).toContain("s.state=null;");
    expect(html).toContain("s.stateset=false;");
    expect(html).toContain("clearTurnScopedSignals(s);");
    expect(html).toContain(
      "var turnScoped=k==='state'||k==='stateset'||k==='etaMin'||k==='etaset';",
    );
    expect(html).toContain("!(s.generating&&turnScoped)");
    expect(html).toContain("if(!s.generating && !s.analysisPending && s.etaMin!=null)");
    expect(html).toContain("if(!s.generating && !s.analysisPending){ var badge=stateBadge(s);");
    expect(html).not.toContain("s.priorityset=false;");
  });

  it("shows full First and Latest text through lightweight hover tips", () => {
    const html = renderConsole(view);
    expect(html).toContain("function sessionPromptLine(cls, label, value, leading)");
    expect(html).toContain("line.setAttribute('data-hover-tip',text);");
    expect(html).toContain("reasonEl.setAttribute('data-hover-tip',reason);");
    expect(html).toContain(".prompt-line-label { color: var(--ink-4); font-weight: 700;");
    expect(html).toContain(
      ".prompt-line-latest ~ .prompt-line-text, .prompt-line-draft ~ .prompt-line-text { font-style: italic; }",
    );
    expect(html).toContain(".it-reason { flex: 1 1 5rem;");
    expect(html).toContain("font-style: normal;");
    expect(html).not.toContain("--latest-label:");
    expect(html).toContain("sessionPromptLine('it-firstline','First',s.title)");
    expect(html).toContain("appendLatestPrompt(item, s, 'it-firstline')");
    expect(html).toContain("sessionPromptLine('sub-line it-firstline','First',cur.title)");
    expect(html).toContain("appendLatestPrompt(sub, cur, 'sub-line it-firstline')");
    expect(html).not.toContain('id="tabtip"');
    expect(html).not.toContain("function showTabTip");
    expect(html).not.toContain("function bindSessionTip");
  });

  it("renders navigable zoomable fork trees from the sidebar and chat header", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="forkTreeBtn"');
    expect(html.indexOf('id="forkTreeBtn"')).toBeLessThan(html.indexOf('id="refreshBtn"'));
    expect(html).toContain('id="forkTreeViewport"');
    expect(html).toContain("function forkTreeLayout(s)");
    expect(html).toContain("var nodeW=300,nodeH=112,columnStep=364,rowStep=134;");
    expect(html).toContain(
      ".forktree-node { position: absolute; width: 300px; height: 112px; box-sizing: border-box; padding: 0;",
    );
    expect(html).toContain(
      ".forktree-node-content { width: var(--forktree-content-size, 100%); height: var(--forktree-content-size, 100%); box-sizing: border-box; display: flex; flex-direction: column; padding: 0.38rem 0.65rem;",
    );
    expect(html).toContain("function forkTreeMini(s)");
    expect(html).toContain('html[data-theme="dark"] .forktree-mini circle.current');
    expect(html).toContain("filter: drop-shadow(0 0 2px rgba(129,140,248,0.95));");
    expect(html).toContain("configureForkTreeTrigger(treeButton,s);");
    expect(html).toContain("syncHeaderForkTree();");
    expect(html).toContain("zoomForkTree(ev.deltaY<0?1.12:1/1.12");
    expect(html).toContain('id="forkTreePan"');
    expect(html).toContain("stage.style.transform='scale('+scale+')';");
    expect(html).toContain("--forktree-content-scale',String(1/scale)");
    expect(html).toContain("--forktree-content-size',String(scale*100)+'%'");
    expect(html).toContain("var content=el('div','forktree-node-content');");
    expect(html).toContain("button.appendChild(content);");
    expect(html).not.toContain("stage.style.zoom");
    expect(html).toContain("var st=session ? statusState(session) : 'read';");
    expect(html).toContain("var dot=el('span','forktree-node-dot it-status '+st);");
    expect(html).toContain("renderSessionTitle(titleNode,session,'forktree-node-title');");
    expect(html).toContain("renderSessionSignals(signals,session);");
    expect(html).toContain("sessionPromptLine('it-firstline','First',session.title)");
    expect(html).toContain("foot.appendChild(sessionContextRow(session));");
    expect(html).toContain("syncForkTreeNodeStatus(s);");
    expect(html).toContain("forkTreeView.x=forkTreeView.ox+(ev.clientX-forkTreeView.sx);");
    expect(html).toContain("selectForkTreeSession(node.id)");
    expect(html).toContain("rememberForkRelation(res.session,branch.forkParentId);");
  });

  it("renders daemon handoff state badges separately from attention dots", () => {
    const html = renderConsole(view);
    expect(html).toContain("function stateBadge(s)");
    expect(html).toContain(".state.needs_decision");
    // state badge shares the priority/ETA row (not the tag row)
    expect(html).toContain("var badge=stateBadge(s); if(badge) host.appendChild(badge);");
    expect(html).toContain("function sessionContextRow(s)");
    expect(html).toContain("foot.appendChild(sessionContextRow(s));");
    expect(html).toContain("prompts.setAttribute('data-hover-tip',count+' user message'+(count===1?'':'s')+' in this session');");
    expect(html).toContain(".it-context .ctx-prompts { color: var(--ink-4);");
    expect(html).not.toContain(".it-context .ctx-prompts { color: #7c3aed;");
    expect(html).not.toContain('html[data-theme="dark"] .it-context .ctx-prompts');
    expect(html).toContain("(!s.stateset && (a.state||null)!==(s.state||null))");
  });

  it("uses a text priority badge and shared signal menu for editable signals", () => {
    const html = renderConsole(view);
    expect(html).toContain("function priorityMeter(score, cls, edited)");
    expect(html).toContain(".prilabel");
    expect(html).toContain(".prilabel.l1");
    expect(html).toContain(".prilabel.l5");
    expect(html).toContain("var PRIORITY_LEVELS=[9,7,5,3,1];");
    expect(html).toContain("if(n>=9) return 1;");
    expect(html).toContain(".sigmenu { position: fixed; z-index: 80; width: min(9.75rem");
    expect(html).toContain("function showSignalMenu(anchor, s, field, options)");
    expect(html).toContain(
      "if(signalMenu && signalMenuKey===key && signalMenuAnchor===anchor){ closeSignalMenu(); return; }",
    );
    expect(html).toContain("document.addEventListener('click', signalMenuDocClose);");
    expect(html).toContain("showSignalMenu(sp, s, 'priority'");
    expect(html).toContain("showSignalMenu(badge, s, 'state'");
    expect(html).toContain(".state.editable:hover { filter: brightness(0.96); transform: none; }");
    expect(html).toContain(".prilabel:hover { filter: brightness(0.96); transform: none; }");
    expect(html).toContain("font-variant-numeric: tabular-nums; transition: none; }");
    expect(html).not.toContain("transform: translateY(-1px)");
    expect(html).not.toContain("transition: filter 0.12s, transform 0.08s");
    expect(html).toContain('id="avoidPanel" hidden');
    expect(html).toContain("function renderAvoidancePanel()");
    expect(html).toContain("function avoidanceStats(s)");
    expect(html).toContain("function draftAvoidancePrompt(s)");
    expect(html).toContain(
      "panel.appendChild(el('div','avoidpanel-draft',avoidanceNudgeText(cur)));",
    );
    expect(html).toContain("var draft=el('button','avoidpanel-draftbtn','edit & send');");
    expect(html).toContain("if(s&&s.avoidancePrompt) return String(s.avoidancePrompt);");
    expect(html).toContain("var clear=el('button','avoidpanel-clear','clear');");
    expect(html).toContain("saveOverride(cur, 'pattern', 'unknown');");
    expect(html).not.toContain(".avoid-rail");
  });

  it("commits per-tab tag suggestions from keyboard and pointer/click events", () => {
    const html = renderConsole(view);
    expect(html).toContain("function submitChoice(raw)");
    expect(html).toContain("opt.onpointerdown=choose;");
    expect(html).toContain("opt.onclick=choose;");
    expect(html).toContain("if(typed) submitChoice(typed);");
    expect(html).toContain("applySessionTagsLocal(s, next);");
  });

  it("keeps the open header tag row to user tags only", () => {
    const html = renderConsole(view);
    expect(html).toContain("(s.tags||[]).forEach(function(tag){");
    expect(html).toContain("var def=userTagDef(tag);");
    expect(html).toContain("row.appendChild(sessionContextRow(s));");
    expect(html).not.toContain("sig.appendChild(vendorBadge(s.vendor));");
    expect(html).not.toContain("sig.appendChild(projectBadge(s.project));");
    expect(html).not.toContain(
      "allTagDefsForSession(s).forEach(function(def){\n      row.appendChild(tagChip(def",
    );
  });

  it("replaces slow native title hints with a fast delegated hover tooltip", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="hoverTip" role="tooltip" hidden');
    expect(html).toContain("var HOVER_TIP_DELAY_MS=80;");
    expect(html).toContain("function normalizeHoverTitles(root)");
    expect(html).toContain("setupHoverTips();");
    expect(html).toContain("attributeFilter:['title']");
    expect(html).toContain("btn.title = dark ? 'switch to light theme' : 'switch to dark theme';");
  });

  it("shows custom tag activity on the actual hovered tag button", () => {
    const html = renderConsole(view);
    expect(html).toContain(
      "var activityTip = (def.title || def.label) + ' · ' + count + ' user message'",
    );
    expect(html).toContain("chip.title = activityTip;");
    expect(html).toContain("if(btn) btn.title = activityTip;");
  });

  it("keeps chat composer controls visually stable and state badges editable", () => {
    const html = renderConsole(view);
    expect(html).toContain(".newbox textarea { resize: none;");
    expect(html).toContain(".composeractions { position: absolute;");
    expect(html).toContain("padding: 0.3rem 0.35rem 2.55rem;");
    expect(html).toContain("function syncComposerHeight()");
    expect(html).toContain("syncComposerHeight();\n    if(!cur) return;");
    expect(html).toContain(".foot button.runbtn.dirty:hover:not(:disabled)");
    expect(html).toContain(".foot button.splitbtn:hover:not(:disabled)");
    expect(html).toContain('html[data-theme="dark"] .foot button.splitbtn { color: #ddd6fe;');
    expect(html).toContain("background: rgba(139,92,246,0.2); border-color: #a78bfa;");
    expect(html).toContain("badge.classList.add('editable');");
    expect(html).toContain("badge.onkeydown=function(ev)");
    expect(html).toContain('html[data-theme="dark"] .tagadd-compact:hover,');
    expect(html).toContain('html[data-theme="dark"] .it-tagadd:hover { color: #99f6e4; background: rgba(20,184,166,0.16);');
  });

  it("keeps tag-filter switching cheap when many filters are active", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="viewTabs"');
    expect(html).toContain('id="tagModeToggle"');
    expect(html).toContain('id="tagModeValue">any</span>');
    expect(html).toContain('id="tagSearch" class="searchbox" placeholder="Search tags…"');
    expect(html).toContain('id="tagSearchClear" class="search-clear"');
    expect(html).toContain(".tagsearchwrap .searchbox { width: 100%; height: 1.25rem;");
    expect(html.indexOf('<span class="tagttl">tags</span>')).toBeLessThan(
      html.indexOf('id="tagSearch"'),
    );
    expect(html.indexOf('id="tagSearch"')).toBeLessThan(html.indexOf('id="tagModeToggle"'));
    expect(html).toContain("var tagSearchQ='';");
    expect(html).toContain("function tagDefMatchesSearch(def)");
    expect(html).toContain("function sessionMatchesTagSearch(s)");
    expect(html).toContain("var defs=filterTagDefs().filter(tagDefMatchesSearch);");
    expect(html).toContain("function tagSessionCounts()");
    expect(html).toContain("var tagCounts=tagSessionCounts();");
    expect(html).toContain("btn.appendChild(el('span','gtagcount',String(count)));");
    expect(html).toContain(".gtagcount { margin-left: 0.32rem; font-size: 0.58rem;");
    expect(html).toContain(".gtag.deletable .gtagbtn { padding-right: 0.18rem; }");
    expect(html).toContain("(def.deletable?' deletable':'')");
    expect(html).toContain("if(!sessionMatchesTagSearch(s)) return false;");
    expect(html).toContain("byId('tagSearch').addEventListener('input'");
    expect(html).toContain("byId('tagSearchClear').onclick=function()");
    expect(html).toContain("renderTagFilters(); reconcileCurrentSessionToFilter();");
    expect(html).toContain(
      ".tagbar .taghead { display: flex; flex-wrap: wrap; align-items: flex-end;",
    );
    expect(html).toContain(
      ".tagmode-toggle { appearance: none; align-self: flex-end; min-width: 0; padding: 0.05rem 0;",
    );
    expect(html).toContain(
      ".instant-tip:hover::after, .instant-tip:focus-visible::after { opacity: 1; visibility: visible; }",
    );
    expect(html).toContain("function setTagView(view)");
    expect(html).toContain("Show every session without changing Focus tags");
    expect(html).toContain("var scopedTagFilters = { active: [], unread: [] };");
    expect(html).toContain("var TAG_FILTER_MODE_KEY = 'attend.tagFilterMode.v1';");
    expect(html).toContain("var tagFilterMode = loadTagFilterMode();");
    expect(html).toContain("function toggleTagFilterMode()");
    expect(html).toContain("function currentFilterTags()");
    expect(html).toContain("function activateFocusWithTags(tags)");
    expect(html).toContain("function sessionMatchesTagFilter(s, filterTags)");
    expect(html).toContain("if(tagFilterMode==='and'){");
    expect(html).toContain("var filterTags=currentFilterTags();");
    expect(html).toContain("var active=filterTags.indexOf(def.key)>=0;");
    expect(html).toContain("saveVaultUiState({focusViews:focusViews});");
    expect(html).toContain("attend.activeFocusView.v1");
    expect(html).toContain("function addFocusView()");
    expect(html).toContain("function removeFocusView(id)");
    expect(html).toContain("+ focus");
    expect(html).not.toContain("tagclear-compact");
    expect(html).not.toContain("clear focus");
    expect(html).toContain("function clearFilterTags()");
    expect(html).toContain("cur.sessionId && s.sessionId===cur.sessionId");
    expect(html).toContain("function reconcileCurrentSessionToFilter()");
    expect(html).toContain("if(cur && matchesFilter(cur)){");
    expect(html).toContain("if(!next || (sessionSortTs(s)||0)>(sessionSortTs(next)||0)) next=s;");
    expect(html).toContain("if(next){\n      select(next);");
    expect(html).not.toContain("if(!isCur && !sessionMatchesTagFilter(s, currentFilterTags()))");
    expect(html).toContain("function applySessionTagsLocal(s, tags)");
    expect(html).toContain("byId('tagModeToggle').onclick=function(ev)");
  });

  it("switches session rows before live rerenders can swallow the click", () => {
    const html = renderConsole(view);
    expect(html).toContain("function isSessionRowControl(target, row)");
    expect(html).toContain("item.onpointerdown=function(ev)");
    expect(html).toContain("ev.pointerType!=='mouse'");
    expect(html).toContain("ev.button!==0 || isSessionRowControl(ev.target,item)");
    expect(html).toContain("typeof node.onclick==='function'");
    expect(html).toContain(
      "item.onclick=function(ev){ if(!isSessionRowControl(ev.target,item) && cur!==s) select(s); };",
    );
  });

  it("patches streamed sidebar activity without rebuilding every session row", () => {
    const html = renderConsole(view);
    expect(html).toContain("function sessionEventNeedsSidebarRebuild(ev)");
    expect(html).toContain("if(sessionEventNeedsSidebarRebuild(ev)){");
    expect(html).toContain(
      "if(ev.kind==='user_turn_started' || ev.kind==='queued_turn_started') sortSessions();",
    );
    const start = html.indexOf("function onBusSessionEvent(message)");
    const end = html.indexOf("function onCommentBusEvent(message)", start);
    const body = html.slice(start, end);
    expect(body).toContain("applyGenerating(s);");
    expect(body).not.toContain("applyGenerating(s);\n    renderSidebar();");
  });

  it("reorders a composer draft once instead of rebuilding on every keystroke", () => {
    const html = renderConsole(view);
    expect(html).toContain("var hadDraft=!!draftTextForSession(cur);");
    expect(html).toContain("if(hasDraft && !hadDraft) touchSession(cur);");
    expect(html).toContain("else if(!hasDraft && hadDraft) renderSidebar();");
    expect(html).not.toContain("if(String(this.value||'').trim()) touchSession(cur);");
  });

  it("preserves tag-editor input and dropdown scroll across live rerenders", () => {
    const html = renderConsole(view);
    expect(html).toContain("var globalTagDraft = '';");
    expect(html).toContain("var sessionTagEditorState = {};");
    expect(html).toContain("input.value=state.value;");
    expect(html).toContain("state.value=input.value;");
    expect(html).toContain("var restoreScroll=state.scrollTop;");
    expect(html).toContain("sug.scrollTop=restoreScroll;");
    expect(html).toContain("sug.onscroll=function(){ state.scrollTop=sug.scrollTop; };");
    expect(html).toContain("input.setSelectionRange(state.start,state.end)");
  });

  it("closes tag editors with Escape and matches suggestions beyond prefixes", () => {
    const html = renderConsole(view);
    expect(html).toContain("function closeSessionTagEditor(s)");
    expect(html).toContain("ev.stopImmediatePropagation(); closeSessionTagEditor(s);");
    expect(html).toContain("ev.stopImmediatePropagation(); closeGlobalTagEditor();");
    expect(html).toContain("function tagSuggestionMatches(tag, query)");
    expect(html).toContain("hay.indexOf(term)>=0");
    expect(html).toContain("!assigned[k] && tagSuggestionMatches(k, q)");
  });

  it("keeps a multi-select priority tag first and formats its selected levels", () => {
    const html = renderConsole(view);
    expect(html).toContain("var PRIORITY_FILTER_KEY = 'attend.priorityFilter.v1';");
    expect(html).toContain("var priorityFilter = loadPriorityFilter();");
    expect(html).toContain("function priorityFilterLabel(levels)");
    expect(html).toContain("function priorityFilterGradient(levels)");
    expect(html).toContain("function stylePriorityFilterChip(chip, btn, levels, active)");
    expect(html).toContain("chip.style.backgroundImage=priorityFilterGradient(levels);");
    expect(html).toContain("check.style.accentColor='var(--priority-'+level+'-fg)';");
    expect(html).toContain(
      "var option=el('button','prioritytagopt sigmenu-opt'+(selected?' on':''));",
    );
    expect(html).toContain("option.appendChild(priorityMeter(11-level*2,'',false));");
    expect(html).toContain("return 'P'+levels[0]+'-P'+levels[levels.length-1];");
    expect(html).toContain("return levels.map(function(level){ return 'P'+level; }).join(',');");
    expect(html).toContain(
      "wrap.appendChild(priorityChip);\n    var defs=filterTagDefs().filter(tagDefMatchesSearch);",
    );
    expect(html).toContain("[5,4,3,2,1].forEach(function(level)");
    expect(html).toContain(
      "priorityBtn.onclick=function(ev){\n      ev.preventDefault(); ev.stopPropagation();\n      closeSignalMenu();",
    );
    expect(html).toContain("if(!sessionMatchesPriorityFilter(s)) return false;");
    expect(html).toContain(
      "return sessionMatchesPriorityFilter(s) && sessionMatchesTagFilter(s, currentFilterTags()) && sessionMatchesTagSearch(s) && sessionMatchesSidebarSearch(s);",
    );
  });

  it("renders a scoped archive button for seen sessions", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="bulkArchiveSeen"');
    expect(html).toContain(
      ".bulkarchive { align-self: flex-end; flex-shrink: 0; min-width: 0; font-size: 0.62rem;",
    );
    expect(html).toContain("function sessionMatchesBulkArchiveScope(s)");
    expect(html).toContain("function sessionMatchesSidebarSearch(s)");
    expect(html).toContain("sessionMatchesTagSearch(s) && sessionMatchesSidebarSearch(s)");
    expect(html).toContain("if(activeTagView==='unread') return false;");
    expect(html).toContain("attentionState(s)==='seen'");
    expect(html).toContain(
      "btn.textContent='archive '+count+' seen session'+(count===1?'':'s')+' in this view';",
    );
    expect(html).toContain(
      "Immediately archive all '+count+' seen session'+(count===1?'':'s')+' matching the current view and focus filters",
    );
    expect(html).toContain("byId('bulkArchiveSeen').onclick=function(ev)");
    expect(html).toContain("postSessionStatus(s, 'read')");
  });

  it("deletes global tags without a browser confirmation dialog", () => {
    const html = renderConsole(view);
    expect(html).toContain("function deleteGlobalTag(tag)");
    expect(html).toContain("var prevTags=TAGS.slice();");
    expect(html).not.toContain("window.confirm");
  });

  it("supports dragging global tags to reorder them", () => {
    const html = renderConsole(view);
    expect(html).toContain("function reorderGlobalTag(source, target, after)");
    expect(html).toContain("function bindGlobalTagDrag(chip, def)");
    expect(html).toContain("function bindGlobalTagDropZone(wrap)");
    expect(html).toContain("function globalTagDragSource(ev)");
    expect(html).toContain("chip.draggable=true;");
    expect(html).toContain("fetch('/tags/order'");
    expect(html).toContain("if(Date.now()<suppressTagClickUntil) return;");
  });

  it("injects discovered Codex models for the new-session model picker", () => {
    const html = renderConsole({
      ...view,
      codexModels: [
        { value: "gpt-5.5", label: "gpt-5.5" },
        { value: "gpt-5.4", label: "gpt-5.4" },
      ],
    });
    expect(html).toContain('window.__CODEX_MODELS__ = [{"value":"gpt-5.5","label":"gpt-5.5"}');
    expect(html).toContain("function codexModelOptions()");
  });

  it("injects discovered Claude models for the new-session model picker", () => {
    const html = renderConsole({
      ...view,
      claudeModels: [{ value: "vendor-model", label: "Vendor Model", efforts: ["vendor-effort"] }],
    });
    expect(html).toContain(
      'window.__CLAUDE_MODELS__ = [{"value":"vendor-model","label":"Vendor Model","efforts":["vendor-effort"]}',
    );
    expect(html).toContain("function claudeModelOptions()");
  });

  it("injects concrete CLI model and effort defaults", () => {
    const html = renderConsole({
      ...view,
      modelDefaults: { codex: { model: "gpt-current", effort: "high" } },
    });
    expect(html).toContain(
      'window.__MODEL_DEFAULTS__ = {"codex":{"model":"gpt-current","effort":"high"}}',
    );
    expect(html).toContain("function optionsWithDefault(options, value, suffix)");
    expect(html).toContain("opt.label=opt.label+' ('+suffix+')';");
    expect(html).not.toContain("vendor default");
  });

  it("keeps defaults inside the vendor model and effort lists", () => {
    const html = renderConsole(view);
    expect(html).not.toContain("NEW_MODEL_OPTIONS");
    expect(html).not.toContain("NEW_EFFORT_OPTIONS");
    expect(html).not.toContain("vendor default");
    expect(html).not.toContain("function defaultModelOption(");
    expect(html).not.toContain("function defaultEffortOption(");
    expect(html).toContain(
      "return optionsWithDefault(dynamic, cliDefault('claude', 'model'), 'CLI default');",
    );
    expect(html).toContain("label:(meta.effortLabels && meta.effortLabels[e]) || e");
    expect(html).toContain("if(vendor==='cursor') return cursorModelOptions();");
  });

  it("does not split URL paths into local file links", () => {
    const html = renderConsole(view);
    expect(html).toContain("function isUrlPathContinuation(text, start, raw)");
    expect(html).toContain("if(isUrlPathContinuation(text, m.index, raw)) continue;");
    expect(html).toContain("(?:https?|ftp):\\/{1,2}$");
  });

  it("renders mermaid and PlantUML fenced blocks as diagrams", () => {
    const html = renderConsole(view);
    expect(html).toContain("function isMermaidLang(lang){ return lang==='mermaid'; }");
    expect(html).toContain(
      "function isPlantUmlLang(lang){ return lang==='plantuml' || lang==='puml'; }",
    );
    expect(html).toContain('class="diagram diagram-');
    expect(html).toContain("renderDiagrams(bubble);");
    expect(html).toContain("https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js");
    expect(html).toContain("https://www.plantuml.com/plantuml/svg/");
    expect(html).toContain("function openDiagramPreview(node)");
    expect(html).toContain("function enableDiagramPreview(node)");
    expect(html).toContain(
      "node.onclick=function(ev){ if(isDiagramControlClick(ev)) return; openDiagramPreview(node); };",
    );
    expect(html).toContain(
      "node.onkeydown=function(ev){ if(ev.key==='Enter' || ev.key===' '){ ev.preventDefault(); openDiagramPreview(node); } };",
    );
    expect(html).toContain('diagram[data-rendered="ok"] { cursor: zoom-in; }');
    expect(html).toContain("enableDiagramPreview(node);");
    expect(html).not.toContain("function addDiagramOpenButton(node)");
    expect(html).not.toContain("diagram-open");
  });

  it("searches transcript content asynchronously from the sidebar box", () => {
    const html = renderConsole(view);
    expect(html).toContain("function scheduleContentSearch()");
    expect(html).toContain("fetch('/search?q='+encodeURIComponent(q))");
    expect(html).toContain("function searchMatchRank(s)");
    expect(html).toContain("if(primaryFieldSearchHit(s)) return 3;");
    expect(html).toContain("return contentSearchHit(s) ? 1 : 0;");
    expect(html).toContain("return sidebarFieldSearchHit(s) || !!contentSearchHit(s);");
    expect(html).toContain(".searchbox.filtering");
    expect(html).toContain("function syncSearchFilterState(input)");
    expect(html).toContain(
      "function applySessionSearch(input){ filterQ=input.value.trim().toLowerCase(); syncSearchFilterState(input); sortSessions(); renderSidebar();",
    );
    expect(html).toContain('id="searchClear" class="search-clear"');
    expect(html).toContain("byId('searchClear').onclick=function()");
    expect(html).toContain("item.appendChild(el('div','it-searchhit', hitText));");
    expect(html).toContain("scheduleContentSearch();");
  });

  // Regression guard: the whole page (inline <script> included) is one template
  // literal, so node eats single backslashes — a regex written `/\/x/` or `/\b/`
  // in source reaches the browser as `//x/` / a backspace char and the resulting
  // SyntaxError aborts the ENTIRE script, leaving the sidebar blank ("no sessions").
  // This has shipped twice. `new Function` parses each script block without
  // executing it (no DOM touched), so any such syntax error fails the test here.
  it("emits inline scripts that parse as valid JS", () => {
    const html = renderConsole(view);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? "");
    expect(scripts.length).toBeGreaterThan(0);
    for (const body of scripts) {
      expect(() => new Function(body)).not.toThrow();
    }
  });
});
