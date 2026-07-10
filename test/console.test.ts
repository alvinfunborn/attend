import { describe, expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

const view: ConsoleView = {
  sessions: [],
  knownDirs: [],
  scopeRoots: [],
  sessionsPerHour: 0,
  charsPerHour: 0,
  vendors: [],
  claudeModels: [],
  codexModels: [],
  tags: [],
};

describe("renderConsole", () => {
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
      "['pattern','patternset','patternReason','patternData','avoidancePrompt','state','stateset','score','reason','etaMin','brief','priorityset','etaset','unread','seen','userPromptTs']",
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
    expect(html).toContain("if(cur===s){ onEvent(ev, String(s.sessionId||'')); return; }");
    expect(html).toContain("cacheTranscriptAssistantText(s, ev.text)");
    expect(html).toContain(
      "function reduceLatestLiveSnapshotEvent(sessionId, clientSessionId, ev)",
    );
    expect(html).toContain("reduceLatestLiveSnapshotEvent(sessionId, clientSessionId, ev);");
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
    expect(forkBody).toContain("branch.providerSessionId=res.session; branch.pendingFork=null;");
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
    expect(html).toContain('id="sessionsPerHour"');
    expect(html).toContain('id="charsPerHour"');
    expect(html).toContain("function applyStats(stats)");
    expect(html).toContain("applyStats(res && res.stats);");
    expect(html).not.toContain("fetch('/stats')");
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
    expect(html).toContain("font-variant-ligatures: none;");
    expect(html).toContain('font-feature-settings: "liga" 0, "clig" 0, "dlig" 0;');
    expect(html).toContain("text-rendering: auto;");
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
    expect(html).not.toContain("statusBreathe");
  });

  it("renders daemon handoff state badges separately from attention dots", () => {
    const html = renderConsole(view);
    expect(html).toContain("function stateBadge(s)");
    expect(html).toContain(".state.needs_decision");
    // state badge shares the priority/ETA row (not the tag row)
    expect(html).toContain("var msb=stateBadge(s); if(msb) meta.appendChild(msb);");
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

  it("dismisses stuck tab hover cards when pointer state is lost", () => {
    const html = renderConsole(view);
    expect(html).toContain("var tabTipAnchor=null;");
    expect(html).toContain("function maybeDismissTabTip(ev)");
    expect(html).toContain("document.addEventListener('mousemove', maybeDismissTabTip, true);");
    expect(html).toContain("window.addEventListener('scroll', hideTabTip, true);");
    expect(html).toContain("showTabTip(s, ev, item);");
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
