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
  it("resubmits edited messages with a concrete turn payload", () => {
    const html = renderConsole(view);
    expect(html).toContain("dispatchSend({ text:v, attachments:[] }, v);");
  });

  it("renders attachment controls for new sessions and submits their payload", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="newAttachDrop"');
    expect(html).toContain('id="nfile" type="file" multiple hidden');
    expect(html).toContain("bindNewAttachments();");
    expect(html).toContain("body:JSON.stringify({text:text, attachments:attachments");
    expect(html).toContain("cacheTranscript(ns, []);");
    expect(html).toContain(
      "if(shown){ rememberPendingUserMsg(res.session, shown, attachments); noteUserTurn(ns, shown); cacheTranscriptUserMsg(ns, shown, attachments); addMsg('user', shown, true, attachments);",
    );
  });

  it("supports Excel attachments in the browser uploader", () => {
    const html = renderConsole(view);
    expect(html).toContain(
      "xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'",
    );
    expect(html).toContain("return readBinaryAttachment(file, 'file', xlsType);");
    expect(html).toContain(
      "Codex supports text, image, and Excel attachments here; PDFs are rejected.",
    );
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
    expect(html).toContain("function openImagePreview(src, name)");
    expect(html).toContain(
      "card.onclick=function(ev){ ev.preventDefault(); openImagePreview(href, att.name||'image'); };",
    );
    expect(html).not.toContain("card.download=att.name||'attachment';");
    expect(html).toContain('id="imgPreview"');
    expect(html).toContain("attachments: cloneAttachments(m && m.attachments)");
    expect(html).toContain("cacheTranscriptUserMsg(cur, shown, turn.attachments);");
  });

  it("anchors pending local user messages instead of appending them after replies", () => {
    const html = renderConsole(view);
    expect(html).toContain("afterMsgs:Array.isArray(state) ? state.length : null");
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
      "['pattern','patternset','patternReason','state','stateset','score','reason','etaMin','brief','priorityset','etaset','unread','seen']",
    );
    expect(html).toContain("syncActivitySortTs(s, next.sortTs!=null ? next.sortTs : next.lastTs);");
    expect(html).toContain("syncActivitySortTs(s, s.lastTs);");
    expect(html).toContain("syncActivityLastTs(s, found.lastTs);");
  });

  it("ignores late SSE messages from a previously selected session", () => {
    const html = renderConsole(view);
    expect(html).toContain("var streamSessionId=String(id||'');");
    expect(html).toContain("onEvent(JSON.parse(e.data), streamSessionId);");
    expect(html).toContain(
      "if(!cur || !cur.sessionId || String(cur.sessionId)!==String(streamSessionId||'')) return;",
    );
  });

  it("clears the local generating state as soon as Stop returns", () => {
    const html = renderConsole(view);
    expect(html).toContain(
      "if(cur===stopping && stopRequested){ turnEnded(); syncCurrentLiveState(stopping); }",
    );
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
    expect(html).toContain("function clearDraftForSession(s)");
    expect(html).toContain("consumeParentDraft:!!(firstTurn.text || firstTurn.attachments.length)");
    expect(html).toContain(
      "if(branch.pendingFork.consumeParentDraft) clearDraftForSession(parent);",
    );
  });

  it("renders fork run-config controls and submits their payload", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="forkPop"');
    expect(html).toContain('id="fvendor"');
    expect(html).toContain("function refreshForkConfigControls(changedVendor)");
    expect(html).toContain("if(sel.id==='fvendor') return vendorTheme");
    expect(html).toContain(
      "styleSelectTheme(ctrl.button, customSelectTheme(sel, sel.value), true);",
    );
    expect(html).toContain(
      "body:JSON.stringify({text:shown, attachments:turn.attachments || [], model:model||undefined, effort:effort||undefined})",
    );
  });

  it("renders same-session run-config controls and submits dirty config on send", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="runPop"');
    expect(html).toContain('id="runCfgBtn"');
    expect(html).toContain("function applyRunConfig()");
    expect(html).toContain("if(cur.runConfigDirty)");
    expect(html).toContain("body.runConfig=true;");
  });

  it("advances restored queued drafts when live polling confirms the session is idle", () => {
    const html = renderConsole(view);
    expect(html).toContain("function advanceQueuedIfIdle()");
    expect(html).toContain(
      "if(cur && cur.sessionId && !active[cur.sessionId] && !cur.generating) advanceQueuedIfIdle();",
    );
    expect(html).toContain(
      "if(stopRequested){ stopRequested=false; if(cur) setQueueParked(cur, true);",
    );
  });

  it("opens live replay only after transcript history has rendered", () => {
    const html = renderConsole(view);
    expect(html).toContain("var liveStarted=false;");
    expect(html).toContain("var finishHistoryLoad=function(){");
    expect(html).toContain("finishHistoryLoad();");
    const beforeHistoryFetch = html.slice(
      html.indexOf("var boundVendor=s.vendor||'';"),
      html.indexOf("fetch('/chat/messages?file="),
    );
    expect(beforeHistoryFetch).not.toContain("startLive();");
  });

  it("clears live replay dedupe when a locally-started turn begins", () => {
    const html = renderConsole(view);
    const beginTurn = html.slice(
      html.indexOf("function beginTurn("),
      html.indexOf("function endTurn("),
    );
    expect(beginTurn).toContain("endCatchup();");
    expect(html).toContain("if(consumeCatchup(ev.text)) return;");
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
    expect(html).toContain(
      "opt.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); choose(info.vendor); };",
    );
    expect(html).toContain(
      "opt.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); choose(dir); };",
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
    expect(dirChooser).not.toContain("styleTheme(opt");
    expect(vendorChooser).toContain("styleSelectTheme(opt, vendorTheme(info.vendor), false);");
    expect(dirChooser).toContain(
      "styleSelectTheme(opt, projectTheme(dirDisplayLabel(dir) || dir), false);",
    );
  });

  it("renders a persisted one-click dark theme toggle", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="themeToggle"');
    expect(html).toContain("attend.theme.v1");
    expect(html).toContain('html[data-theme="dark"]');
    expect(html).toContain("function toggleTheme()");
    expect(html).toContain("byId('themeToggle').onclick=toggleTheme;");
  });

  it("makes the latest-user preview itself jump without extra chrome", () => {
    const html = renderConsole(view);
    expect(html).toContain('id="latestPin"');
    expect(html).toContain("function jumpToLatestPin()");
    expect(html).toContain("byId('latestPin').onclick=jumpToLatestPin;");
    expect(html).not.toContain("Latest you");
    expect(html).not.toContain("latestPinJump");
    expect(html).not.toContain("latestpin-jump");
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
    expect(html).toContain("var sb=stateBadge(s); if(sb) meta.appendChild(sb);");
    expect(html).toContain("(!s.stateset && (a.state||null)!==(s.state||null))");
  });

  it("uses a grid priority meter and shared signal menu for editable signals", () => {
    const html = renderConsole(view);
    expect(html).toContain("function priorityMeter(score, cls, edited)");
    expect(html).toContain(".prigrid");
    expect(html).toContain(".sigmenu { position: fixed; z-index: 80; width: min(9.75rem");
    expect(html).toContain("function showSignalMenu(anchor, s, field, options)");
    expect(html).toContain(
      "if(signalMenu && signalMenuKey===key && signalMenuAnchor===anchor){ closeSignalMenu(); return; }",
    );
    expect(html).toContain("document.addEventListener('click', signalMenuDocClose);");
    expect(html).toContain("showSignalMenu(sp, s, 'priority'");
    expect(html).toContain("showSignalMenu(badge, s, 'state'");
    expect(html).toContain("function showAvoidanceInfo(anchor, s)");
    expect(html).toContain(".avoid-rail");
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
    expect(html).toContain("function setTagView(view)");
    expect(html).toContain("Show every session without changing Focus tags");
    expect(html).toContain("activeTagView==='focus' && activeTags.length");
    expect(html).toContain("attend.focusViews.v1");
    expect(html).toContain("attend.activeFocusView.v1");
    expect(html).toContain("function addFocusView()");
    expect(html).toContain("function removeFocusView(id)");
    expect(html).toContain("+ focus");
    expect(html).not.toContain("tagclear-compact");
    expect(html).not.toContain("clear focus");
    expect(html).toContain("function clearFilterTags()");
    expect(html).toContain("cur.sessionId && s.sessionId===cur.sessionId");
  });

  it("deletes global tags without a browser confirmation dialog", () => {
    const html = renderConsole(view);
    expect(html).toContain("function deleteGlobalTag(tag)");
    expect(html).toContain("var prevTags=TAGS.slice();");
    expect(html).not.toContain("window.confirm");
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

  it("injects configured Claude models for the new-session model picker", () => {
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
  });

  it("searches transcript content asynchronously from the sidebar box", () => {
    const html = renderConsole(view);
    expect(html).toContain("function scheduleContentSearch()");
    expect(html).toContain("fetch('/search?q='+encodeURIComponent(q))");
    expect(html).toContain("return hay.indexOf(filterQ)>=0 || !!contentSearchHit(s);");
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
