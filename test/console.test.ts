import { describe, expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

const view: ConsoleView = {
  sessions: [],
  knownDirs: [],
  scopeRoots: [],
  sessions24h: 0,
  prompts24h: 0,
  vendors: [],
  claudeModels: [],
  codexModels: [],
  tags: [],
};

describe("renderConsole", () => {
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

  it("resends the latest edited user message and forks historical edits", () => {
    const html = renderConsole(view);
    expect(html).toContain("function isLatestUserMessage(msgEl)");
    expect(html).toContain("function editLatestAndResend(msgEl, bubble)");
    expect(html).toContain("dispatchSend({ text:v, attachments:[] }, v);");
    expect(html).toContain(
      "if(isLatestUserMessage(msgEl) && !turnActive) editLatestAndResend(msgEl, bubble);",
    );
    expect(html).toContain("function editAndForkFromMessage(msgEl, bubble)");
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

  it("renders attachment controls for new sessions and submits their payload", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="newAttachDrop"');
    expect(html).toContain('id="nfile" type="file" multiple hidden');
    expect(html).toContain("bindNewAttachments();");
    expect(html).toContain("body:JSON.stringify({text:text, attachments:attachments");
    expect(html).toContain("cacheTranscript(ns, shown ? [{role:'user'");
    expect(html).toContain(
      "if(shown){ rememberPendingUserMsg(res.session, shown, attachments); noteUserTurn(ns, shown); }",
    );
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
    expect(html).toContain("body.no-session #queue, body.no-session .foot { display: none; }");
    expect(html).toContain("document.body.classList.add('no-session');");
    expect(html).toContain("document.body.classList.remove('no-session');");
    expect(html).toContain("cur = null;");
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

  it("clears the parent draft after using it as a fork opening turn", () => {
    const html = renderConsole(view);
    expect(html).toContain("function forkTitleFromSession(s)");
    expect(html).toContain("title:forkTitleFromSession(cur)");
    expect(html).toContain("(s && s.brief) || (s && s.title) || (s && s.lastPrompt)");
    expect(html).toContain("function clearDraftForSession(s)");
    expect(html).toContain("consumeParentDraft:!!(firstTurn.text || firstTurn.attachments.length)");
    expect(html).toContain(
      "if(branch.pendingFork.consumeParentDraft) clearDraftForSession(parent);",
    );
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
      html.indexOf("function materializeFork(branch,turn){"),
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
    expect(forkBody).toContain("if(latestLiveSnapshot) applyLiveSnapshot(latestLiveSnapshot);");
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

  it("applies same-session run config immediately and submits it on send", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="runPop"');
    expect(html).toContain('id="runCfgBtn"');
    expect(html).toContain("function applyRunConfig()");
    expect(html).toContain("return (config.model || 'current model')+' · '+config.effort;");
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
  });

  it("remembers model effort when new, chat, and fork configs are used", () => {
    const html = renderConsole(view);
    expect(html).toContain("rememberModelEffort(vendor, model, effort);");
    expect(html).toContain("rememberModelEffort(config.vendor, config.model, config.effort);");
    expect(html).toContain("rememberModelEffort(vendor, cur.model||'', cur.effort||'');");
  });

  it("uses the server as the queued-draft source of truth", () => {
    const html = renderConsole(view);
    expect(html).toContain("function refreshServerQueue(s)");
    expect(html).toContain("fetch('/chat/queue?session='");
    expect(html).toContain("fetch('/chat/queue/send?session='");
    expect(html).toContain("method:'PATCH'");
    expect(html).toContain("method:'DELETE'");
    expect(html).toContain("if(ev.kind==='queued_turn_started'){");
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
    expect(html).toContain('id="sessions24h"');
    expect(html).toContain('id="prompts24h"');
    expect(html).toContain('class="statlbl">pushes/24h</span>');
    expect(html).not.toContain('class="statlbl">chars/H</span>');
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
    expect(html).not.toContain("Latest you");
    expect(html).not.toContain("latestPinJump");
    expect(html).not.toContain("latestpin-jump");
  });

  it("orders pinned message previews by their actual chat position", () => {
    const html = renderConsole(view);
    expect(html).toContain("function msgDomOrder()");
    expect(html).toContain("var nodes=msgs.querySelectorAll('.msg');");
    expect(html).toContain(
      "Object.prototype.hasOwnProperty.call(order, ak) ? order[ak] : msgKeyIndex(ak)",
    );
    expect(html).toContain("var pins=sortPinsInChatOrder(currentPins());");
    expect(html).toContain("savePins(cur, sortPinsInChatOrder(pins));");
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
    expect(html).toContain("function sessionPromptLine(cls, label, value)");
    expect(html).toContain("line.setAttribute('data-hover-tip',text);");
    expect(html).toContain("reasonEl.setAttribute('data-hover-tip',reason);");
    expect(html).toContain(".prompt-line-label { color: var(--ink-4); font-weight: 700;");
    expect(html).toContain(".prompt-line-latest { color: var(--latest-label);");
    expect(html).toContain("--latest-label: #4f46e5;");
    expect(html).toContain("--latest-label: #a5b4fc;");
    expect(html).toContain("sessionPromptLine('it-firstline','First',s.title)");
    expect(html).toContain("sessionPromptLine('it-firstline','Latest',s.lastPrompt)");
    expect(html).toContain("sessionPromptLine('sub-line it-firstline','First',cur.title)");
    expect(html).toContain("sessionPromptLine('sub-line it-firstline','Latest',cur.lastPrompt)");
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
    expect(html).toContain("function forkTreeMini(s)");
    expect(html).toContain('html[data-theme="dark"] .forktree-mini circle.current');
    expect(html).toContain("filter: drop-shadow(0 0 2px rgba(129,140,248,0.95));");
    expect(html).toContain("configureForkTreeTrigger(treeButton,s);");
    expect(html).toContain("syncHeaderForkTree();");
    expect(html).toContain("zoomForkTree(ev.deltaY<0?1.12:1/1.12");
    expect(html).toContain("--forktree-text-scale");
    expect(html).toContain("stage.style.setProperty('--forktree-text-width'");
    expect(html).toContain("var st=session ? statusState(session) : 'read';");
    expect(html).toContain("var dot=el('span','forktree-node-dot it-status '+st);");
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
    expect(html).toContain("html[data-theme=\"dark\"] .foot button.splitbtn { color: #ddd6fe;");
    expect(html).toContain("background: rgba(139,92,246,0.2); border-color: #a78bfa;");
    expect(html).toContain("badge.classList.add('editable');");
    expect(html).toContain("badge.onkeydown=function(ev)");
  });

  it("keeps tag-filter switching cheap when many filters are active", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="viewTabs"');
    expect(html).toContain('id="tagModeToggle"');
    expect(html).toContain('id="tagModeValue">any</span>');
    expect(html).toContain(
      ".tagmode-toggle:hover { color: var(--ink); background: transparent; box-shadow: none; text-decoration: underline;",
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
    expect(html).toContain("wrap.appendChild(priorityChip);\n    var defs=filterTagDefs();");
    expect(html).toContain("[5,4,3,2,1].forEach(function(level)");
    expect(html).toContain(
      "priorityBtn.onclick=function(ev){\n      ev.preventDefault(); ev.stopPropagation();\n      closeSignalMenu();",
    );
    expect(html).toContain("if(!sessionMatchesPriorityFilter(s)) return false;");
    expect(html).toContain(
      "return sessionMatchesPriorityFilter(s) && sessionMatchesTagFilter(s, currentFilterTags());",
    );
  });

  it("renders a scoped archive button for seen sessions", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="bulkArchiveSeen"');
    expect(html).toContain(".bulkarchive { align-self: flex-end; flex-shrink: 0; min-width: 0; font-size: 0.62rem;");
    expect(html).toContain("function sessionMatchesBulkArchiveScope(s)");
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
      claudeModels: [
        { value: "fable", label: "fable" },
        { value: "claude-fable-5", label: "claude-fable-5" },
      ],
    });
    expect(html).toContain('window.__CLAUDE_MODELS__ = [{"value":"fable","label":"fable"}');
    expect(html).toContain("function claudeModelOptions()");
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
      "filterQ=this.value.trim().toLowerCase(); syncSearchFilterState(this); sortSessions(); renderSidebar();",
    );
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
