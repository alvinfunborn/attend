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
  /** epoch ms used only for "recent" sorting; may include a recent view touch */
  sortTs?: number | null;
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
  /** user-managed labels for filtering / grouping tabs */
  tags: string[];
  /** persisted unfinished state: bright-green dot — a background turn ended and you haven't opened it */
  unread?: boolean;
  /** persisted unfinished state: hollow-green dot — tracked / still in progress */
  seen?: boolean;
  /** live-only UI state, refreshed from /chat/live while the page is open */
  generating?: boolean;
  generatingStartedAt?: number | null;
}

export interface ConsoleView {
  sessions: SessionView[];
  knownDirs: string[];
  scopeRoots: string[];
  /** sessions touched in the trailing 24h, as an hourly rate */
  sessionsPerHour: number;
  /** characters processed in the trailing 24h, as an hourly rate */
  charsPerHour: number;
  /** locally-detected vendor CLIs — populates the "+ new" provider picker */
  vendors: VendorAvailability[];
  /** global tag list used by the sidebar manager + per-session assignment */
  tags: string[];
}

const STYLE = `
  :root {
    --accent: #4f46e5; --accent-soft: #eef2ff; --accent-ring: rgba(99,102,241,0.35);
    --ink: #111827; --ink-2: #374151; --ink-3: #6b7280; --ink-4: #9ca3af;
    --line: #e5e7eb; --line-2: #d1d5db;
    --surface: #ffffff; --surface-2: #fafafa; --canvas: #f3f4f6;
    --radius: 8px; --radius-sm: 6px; --radius-pill: 999px;
    --shadow-sm: 0 1px 2px rgba(15,23,42,0.06);
    --shadow-md: 0 6px 18px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.06);
    --shadow-pop: 0 14px 34px rgba(15,23,42,0.16), 0 4px 12px rgba(15,23,42,0.08);
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { font-family: ui-sans-serif, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
    color: var(--ink-2); background: var(--canvas); display: flex; height: 100vh; overflow: hidden;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
  button { cursor: pointer; border-radius: var(--radius-sm); border: 1px solid var(--line-2); background: var(--surface);
    color: var(--ink-2); font-size: 0.8rem; font-weight: 500; padding: 0.3rem 0.65rem;
    box-shadow: var(--shadow-sm); transition: background 0.15s, border-color 0.15s, box-shadow 0.15s, color 0.15s, transform 0.05s; }
  button:hover { background: #f8fafc; border-color: #c7ccd6; }
  button:active { transform: translateY(0.5px); }
  button:focus-visible { outline: 2px solid var(--accent-ring); outline-offset: 1px; }
  button:disabled { cursor: default; box-shadow: none; opacity: 0.6; }
  input, textarea, select { font-family: inherit; }
  input:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb { background: #d4d8e0; border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
  ::-webkit-scrollbar-thumb:hover { background: #b9bfcc; background-clip: content-box; }
  ::-webkit-scrollbar-track { background: transparent; }
  * { scrollbar-width: thin; scrollbar-color: #d4d8e0 transparent; }
  /* sidebar */
  .side { width: 320px; flex-shrink: 0; background: var(--surface-2); border-right: 1px solid var(--line); display: flex; flex-direction: column; }
  /* draggable divider to widen/narrow the sidebar */
  .resizer { width: 6px; flex-shrink: 0; cursor: col-resize; background: transparent; transition: background 0.15s; }
  .resizer:hover, .resizer.dragging { background: #c7d2fe; }
  .side h1 { font-size: 0.98rem; font-weight: 700; letter-spacing: -0.01em; margin: 0; padding: 0.85rem 0.95rem 0.55rem; color: var(--ink); display: flex; flex-direction: column; gap: 0.15rem; }
  .side h1 .accent { color: var(--ink-4); font-weight: 500; font-size: 0.68rem; letter-spacing: 0; font-variant-numeric: tabular-nums; }
  .side .topnav { padding: 0 0.95rem 0.7rem; display: flex; gap: 0.45rem; border-bottom: 1px solid var(--line); }
  .side .topnav a { font-size: 0.78rem; color: var(--accent); text-decoration: none; align-self: center; margin-left: auto; }
  #newToggle { flex-shrink: 0; font-weight: 600; color: var(--accent); border-color: #c7d2fe; background: var(--accent-soft); }
  #newToggle:hover { background: #e0e7ff; border-color: #a5b4fc; }
  .tagbar { padding: 0.7rem 0.95rem; border-bottom: 1px solid var(--line); background: var(--surface); display: flex; flex-direction: column; gap: 0.5rem; }
  .tagbar .taghead { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
  .tagbar .tagttl { font-size: 0.66rem; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; }
  .tagbar .taghint { font-size: 0.66rem; color: var(--ink-4); text-align: right; line-height: 1.3; }
  .tagchips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .tagempty { font-size: 0.72rem; color: var(--ink-4); }
  .gtag { display: inline-flex; align-items: stretch; border: 1px solid var(--line-2); border-radius: var(--radius-pill); overflow: hidden; background: var(--surface); box-shadow: var(--shadow-sm); transition: box-shadow 0.15s, transform 0.05s; }
  .gtag:hover { box-shadow: var(--shadow-md); }
  .gtag.on { border-color: #0f766e; box-shadow: inset 0 0 0 1px #0f766e; }
  .gtagbtn, .gtagdel { border: 0; border-radius: 0; font-size: 0.7rem; background: transparent; padding: 0.18rem 0.55rem; box-shadow: none; }
  .gtagbtn { color: #0f172a; }
  .gtag.on .gtagbtn { background: #ccfbf1; color: #115e59; }
  .gtagdel { color: var(--ink-4); border-left: 1px solid var(--line); padding: 0.18rem 0.4rem; }
  .gtagdel:hover { background: #fef2f2; color: #b91c1c; }
  .gtag.auto .gtagbtn { font-weight: 600; }
  .tagadd-compact { font-size: 0.66rem; border-style: dashed; color: #0f766e; padding: 0.1rem 0.46rem; border-radius: var(--radius-pill); box-shadow: none; background: var(--surface); }
  .tagadd-compact:hover { background: #f0fdfa; border-color: #5eead4; }
  .tagcreate-inline { position: relative; flex: 1 1 14rem; min-width: min(14rem, 100%); }
  .tagcreate-inline .tagedit-row { align-items: stretch; }
  .tagcreate-inline .tagedit-input { font-size: 0.74rem; }
  .searchbox { flex: 1; min-width: 0; font-size: 0.78rem; padding: 0.32rem 0.6rem; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--surface); }
  .newbox { padding: 0.75rem 0.95rem; border-bottom: 1px solid var(--line); display: none; flex-direction: column; gap: 0.5rem; background: linear-gradient(180deg, #f5f7ff 0%, var(--surface) 100%); box-shadow: inset 0 -1px 0 var(--line); }
  .newbox.open { display: flex; animation: newboxIn 0.18s ease; }
  @keyframes newboxIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .newbox input, .newbox textarea, .newbox select { font-size: 0.8rem; padding: 0.4rem 0.55rem; border: 1px solid var(--line-2); border-radius: var(--radius-sm); width: 100%; box-sizing: border-box; background-color: var(--surface); color: var(--ink-2); }
  .newbox textarea { resize: vertical; min-height: 2.4rem; font: inherit; font-size: 0.8rem; }
  .newhead { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .newttl { font-size: 0.72rem; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; }
  .newclose { width: 1.75rem; height: 1.75rem; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; padding: 0; color: var(--ink-3); background: transparent; box-shadow: none; }
  .newclose:hover { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
  .newrow { display: flex; gap: 0.5rem; align-items: flex-end; }
  .newrow .pickgrp { flex: 1; min-width: 0; }
  .newrow .pickgrp.vendor { flex: 1.35; }
  .newrow .pickgrp.effort { max-width: 8.25rem; }
  .pickgrp { display: flex; flex-direction: column; gap: 0.25rem; }
  .picklbl { font-size: 0.68rem; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; }
  .chooser { position: relative; }
  .chooser-row { display: flex; gap: 0; }
  .chooser-input { flex: 1; min-width: 0; font-size: 0.8rem; padding: 0.4rem 0.55rem; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--surface); color: var(--ink-2); }
  .chooser-select { appearance: none; -webkit-appearance: none; -moz-appearance: none; cursor: pointer; }
  .chooser-drop { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 50; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow-pop); padding: 0.25rem; max-height: 15rem; overflow-y: auto; }
  .chooser-drop[hidden] { display: none; }
  .chooser-opt { display: flex; flex-direction: column; gap: 0.12rem; padding: 0.38rem 0.5rem; border-radius: var(--radius-sm); cursor: pointer; }
  .chooser-opt:hover, .chooser-opt.on { background: var(--accent-soft); }
  .chooser-opt-line { display: flex; align-items: center; gap: 0.38rem; min-width: 0; }
  .chooser-opt-label { font-size: 0.78rem; color: var(--ink); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chooser-opt-meta { font-size: 0.68rem; color: var(--ink-4); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chooser-opt-note { flex-shrink: 0; font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #0f766e; background: #ccfbf1; border-radius: 3px; padding: 0.04rem 0.34rem; }
  .chooser-empty { padding: 0.45rem 0.5rem; font-size: 0.74rem; color: var(--ink-4); }
  .newbox .nmsg { font-size: 0.72rem; color: var(--ink-4); }
  .nbtn-primary { color: #fff; background: var(--ink); border-color: var(--ink); box-shadow: var(--shadow-md); }
  .nbtn-primary:hover { background: #0b1220; border-color: #0b1220; }
  #list { overflow-y: auto; flex: 1; padding: 0.3rem 0; }
  #list .empty { padding: 1.2rem 0.9rem; color: #9ca3af; font-size: 0.8rem; text-align: center; }
  .item { padding: 0.6rem 0.95rem; border-bottom: 1px solid #f1f2f4; cursor: pointer; border-left: 3px solid transparent; transition: background 0.12s, border-color 0.12s; }
  .item:hover { background: #f1f5f9; }
  .item.active { background: var(--accent-soft); border-left-color: var(--accent); }
  .it-titlerow { display: flex; align-items: center; gap: 0.45rem; }
  .it-title { font-size: 0.84rem; font-weight: 600; color: var(--ink); letter-spacing: -0.005em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
  .it-age { flex-shrink: 0; font-size: 0.66rem; color: #9ca3af; font-family: ui-monospace, monospace; white-space: nowrap; }
  .it-status { flex-shrink: 0; width: 0.5em; height: 0.5em; border-radius: 50%; background: #d1d5db; cursor: pointer; transition: transform 0.1s; }
  .it-status:hover { transform: scale(1.45); }
  .it-status.generating { background: #10b981; animation: gpulse 1s ease-in-out infinite; }
  .it-status.unread { background: #10b981; }
  /* seen = you opened it but haven't replied: a hollow green ring keeps it in the
     "your turn" pool (distinct from bright unread) until you actually advance it. */
  .it-status.seen { background: #d1fae5; box-shadow: inset 0 0 0 1.5px #10b981; }
  .it-status.read { background: #d1d5db; }
  .it-firstline { font-size: 0.72rem; color: #6b7280; margin-top: 0.1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .it-meta { font-size: 0.7rem; color: #6b7280; margin-top: 0.2rem; font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem; }
  .it-tags { margin-top: 0.4rem; display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .it-tag { display: inline-flex; align-items: center; gap: 0.24rem; font-size: 0.66rem; color: #115e59; background: #ccfbf1; border: 1px solid #99f6e4; border-radius: var(--radius-pill); padding: 0.1rem 0.46rem; }
  .it-tag.auto { font-weight: 600; }
  .it-tag button { border: 0; background: transparent; color: #0f766e; font-size: 0.78rem; padding: 0; line-height: 1; box-shadow: none; }
  .it-tag button:hover { color: #b91c1c; background: transparent; }
  .it-tagadd { font-size: 0.66rem; border-style: dashed; color: #0f766e; padding: 0.1rem 0.46rem; border-radius: var(--radius-pill); box-shadow: none; }
  .it-tagadd:hover { background: #f0fdfa; border-color: #5eead4; }
  /* per-tab tag editor + custom suggestion dropdown (replaces the native datalist) */
  .tagedit { position: relative; margin-top: 0.4rem; }
  .tagedit-row { display: flex; gap: 0.35rem; }
  .tagedit-input { flex: 1; min-width: 0; font-size: 0.74rem; padding: 0.3rem 0.5rem; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--surface); }
  .tagedit-cancel { flex-shrink: 0; width: 1.7rem; height: 1.7rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: #94a3b8; background: #fff; border: 1px solid #e2e8f0; border-radius: 999px; box-shadow: none; }
  .tagedit-cancel:hover { color: #64748b; background: #f8fafc; border-color: #cbd5e1; }
  .tagedit-cancel svg { width: 0.72rem; height: 0.72rem; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; }
  .tagsug { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 40; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow-pop); padding: 0.25rem; max-height: 13rem; overflow-y: auto; }
  .tagsug[hidden] { display: none; }
  .tagsug-opt { display: flex; align-items: center; gap: 0.4rem; font-size: 0.76rem; color: var(--ink-2); padding: 0.3rem 0.5rem; border-radius: var(--radius-sm); cursor: pointer; }
  .tagsug-opt:hover, .tagsug-opt.on { background: var(--accent-soft); color: #3730a3; }
  .tagsug-create { color: var(--ink-3); }
  .tagsug-new { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #0f766e; background: #ccfbf1; border-radius: 3px; padding: 0.04rem 0.34rem; }
  .tabtip { position: fixed; z-index: 60; width: min(420px, calc(100vw - 24px)); pointer-events: none; opacity: 0; transform: translateY(6px) scale(0.98); transition: opacity 0.14s ease, transform 0.14s ease; }
  .tabtip.show { opacity: 1; transform: translateY(0) scale(1); }
  .tabtip-card { border-radius: 16px; background: rgba(255,255,255,0.96); border: 1px solid rgba(203,213,225,0.95); box-shadow: 0 18px 40px rgba(15,23,42,0.16), 0 6px 16px rgba(15,23,42,0.08); backdrop-filter: blur(14px); padding: 0.85rem 0.95rem 0.9rem; }
  .tabtip-title { font-size: 0.9rem; font-weight: 700; color: #0f172a; line-height: 1.35; word-break: break-word; overflow-wrap: anywhere; }
  .tabtip-sub { margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.3rem; }
  .tabtip-line { font-size: 0.74rem; color: #475569; line-height: 1.45; word-break: break-word; overflow-wrap: anywhere; }
  .tabtip-line .k { color: #94a3b8; font-weight: 700; text-transform: uppercase; font-size: 0.66rem; letter-spacing: 0.04em; margin-right: 0.38rem; }
  .tabtip-meta, .tabtip-tags { margin-top: 0.65rem; display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .tabtip-note { margin-top: 0.65rem; font-size: 0.7rem; color: #94a3b8; word-break: break-word; overflow-wrap: anywhere; }
  .pat { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; min-height: 1.08rem; font-size: 0.58rem; line-height: 1; font-weight: 700; text-transform: uppercase; letter-spacing: 0.045em; padding: 0.14rem 0.38rem 0.12rem; border-radius: 4px; background: #e5e7eb; color: #374151; }
  .pat.avoidance { background: #fed7aa; color: #9a3412; }
  .pat.stalled { background: #d1d5db; color: #1f2937; }
  .pat.healthy { background: #bbf7d0; color: #166534; }
  .it-reason { font-size: 0.68rem; color: #9ca3af; margin-top: 0.2rem; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .it-title.pending { color: #9ca3af; font-weight: 500; }
  .b-pri { flex-shrink: 0; font-weight: 600; color: #b91c1c; background: #fef2f2; padding: 0.04rem 0.36rem; border-radius: 4px; cursor: pointer; font-variant-numeric: tabular-nums; }
  .b-pri:hover { background: #fee2e2; }
  .b-eta { flex-shrink: 0; color: #b45309; background: #fffbeb; padding: 0.04rem 0.36rem; border-radius: 4px; cursor: pointer; font-variant-numeric: tabular-nums; }
  .b-eta:hover { background: #fef3c7; }
  .vtag, .ptag { flex-shrink: 0; display: inline-flex; align-items: center; border-radius: 999px; padding: 0.06rem 0.46rem; font-size: 0.66rem; font-family: ui-sans-serif, -apple-system, "Segoe UI", sans-serif; border: 1px solid transparent; }
  .vtag { font-weight: 700; letter-spacing: 0.01em; }
  .vtag.claude { color: #c2410c; background: #fff7ed; border-color: #fdba74; }
  .vtag.codex { color: #3730a3; background: #eef2ff; border-color: #a5b4fc; }
  .ptag { font-weight: 600; }
  #h-sig .score, #h-sig .eta { cursor: pointer; }
  /* a manually-pinned priority/ETA: dashed underline marks it as user-set */
  .b-pri.edited, .b-eta.edited, #h-sig .score.edited, #h-sig .eta.edited { text-decoration: underline dashed; text-underline-offset: 2px; }
  /* inline editor that replaces a badge while editing */
  .badge-edit { width: 3rem; font-size: 0.7rem; padding: 0 0.25rem; border: 1px solid #6366f1; border-radius: 3px; }
  .b-ctx { overflow: hidden; text-overflow: ellipsis; }
  .sortsel { font-size: 0.72rem; border: 1px solid #d1d5db; border-radius: 4px; padding: 0.1rem 0.3rem; background: white; }
  /* main */
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: white; }
  .head { padding: 0.75rem 1.1rem; border-bottom: 1px solid var(--line); display: flex; justify-content: flex-start; gap: 0.6rem; align-items: center; background: linear-gradient(180deg, #fcfcfd 0%, #ffffff 100%); }
  .backbtn { display: none; flex-shrink: 0; color: var(--accent); }
  .headmain { min-width: 0; flex: 1; display: flex; flex-direction: column; }
  .headrow { display: flex; align-items: center; gap: 0.45rem; min-width: 0; }
  .headstatus { flex-shrink: 0; width: 0.56rem; height: 0.56rem; border-radius: 50%; background: #d1d5db; cursor: pointer; transition: transform 0.1s; }
  .headstatus:hover { transform: scale(1.45); }
  .headstatus.generating { background: #10b981; animation: gpulse 1s ease-in-out infinite; }
  .headstatus.unread { background: #10b981; }
  .headstatus.seen { background: #d1fae5; box-shadow: inset 0 0 0 1.5px #10b981; }
  .headstatus.read { background: #d1d5db; }
  .headbtn { margin-left: auto; width: 1.9rem; height: 1.9rem; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; color: #3730a3; border-color: #c7d2fe; background: #f8faff; padding: 0; line-height: 1; border-radius: 999px; }
  .headbtn:hover:not(:disabled) { background: #e0e7ff; border-color: #a5b4fc; }
  .headbtn:disabled { color: #94a3b8; border-color: #e2e8f0; background: #f8fafc; }
  .headbtn svg { width: 0.92rem; height: 0.92rem; stroke: currentColor; stroke-width: 1.9; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .headbtn.busy svg { animation: spin 0.85s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .head .t { min-width: 0; flex: 1; font-weight: 700; font-size: 0.98rem; letter-spacing: -0.01em; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .head .s { font-size: 0.72rem; color: #9ca3af; font-family: ui-monospace, monospace; }
  .head .s .sub-line { white-space: normal; overflow-wrap: anywhere; max-height: 4.5rem; overflow-y: auto; }
  .head .s .sub-line + .sub-line { margin-top: 0.1rem; }
  .head .s.brief { font-family: inherit; color: #4b5563; font-size: 0.78rem; max-width: 70ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #h-sig { display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; margin-top: 0.3rem; font-size: 0.72rem; }
  #h-sig .score { font-weight: 600; color: #374151; }
  #h-sig .brieftag { padding: 0.05rem 0.4rem; border-radius: 3px; background: #eef2ff; color: #3730a3; text-decoration: none; }
  #h-sig .brieftag:hover { background: #e0e7ff; }
  #h-sig .eta { color: #b45309; background: #fffbeb; padding: 0.05rem 0.4rem; border-radius: 3px; }
  #h-sig .briefref { color: #3730a3; background: #eef2ff; padding: 0.05rem 0.4rem; border-radius: 3px; }
  #h-sig .sig-reason { color: #9ca3af; font-style: italic; }
  /* compact meta bits (prompts · age) so the open header mirrors the sidebar tab */
  #h-sig .h-meta { color: #6b7280; font-family: ui-monospace, monospace; }
  #h-sig .it-tag { margin: 0; }
  #h-tags { margin-top: 0.45rem; display: flex; flex-direction: column; gap: 0.35rem; }
  .headtag-row { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
  .headtag-row .it-tag { margin: 0; }
  .headtag-row .it-tag.auto { font-weight: 600; }
  .headtag-row .it-tag button { border: 0; background: transparent; color: inherit; font-size: 0.78rem; padding: 0; line-height: 1; box-shadow: none; }
  .headtag-row .it-tag button:hover { color: #b91c1c; background: transparent; }
  .headtag-add { font-size: 0.68rem; border-style: dashed; color: #0f766e; padding: 0.12rem 0.5rem; border-radius: var(--radius-pill); box-shadow: none; }
  .headtag-add:hover { background: #f0fdfa; border-color: #5eead4; }
  .headtagedit { max-width: 28rem; }
  .sig { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; margin-top: 0.3rem; font-size: 0.72rem; color: #6b7280; }
  .sig .score { font-weight: 600; color: #374151; }
  .sig .reason { font-style: italic; }
  .sig .briefref { color: #2563eb; text-decoration: none; background: #eff6ff; padding: 0.05rem 0.4rem; border-radius: 3px; }
  .sig .eta { color: #047857; background: #ecfdf5; padding: 0.05rem 0.4rem; border-radius: 3px; }
  .latestpin { display: none; border-bottom: 1px solid var(--line); background: linear-gradient(180deg, #eff2ff 0%, #fafbff 100%); padding: 0.5rem 1.1rem 0.6rem; box-shadow: 0 4px 10px -8px rgba(15,23,42,0.3); }
  .latestpin.show { display: block; }
  .latestpin-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
  .latestpin-tag { display: inline-flex; align-items: center; gap: 0.38rem; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); }
  .latestpin-tag::before { content: ""; width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.18); }
  .latestpin-jump { margin-left: auto; flex-shrink: 0; border: 1px solid #c7d2fe; background: #fff; color: #3730a3; border-radius: var(--radius-pill); padding: 0.16rem 0.72rem; font: inherit; font-size: 0.7rem; font-weight: 600; cursor: pointer; box-shadow: var(--shadow-sm); }
  .latestpin-jump:hover { background: var(--accent-soft); border-color: #a5b4fc; }
  .latestpin-body { max-height: 5.5rem; overflow: auto; }
  /* the pinned preview is a cloned user bubble with no .msg ancestor, so it gets
     no .msg styling — give it a clean, light "quote card" look of its own. */
  .latestpin-body .bubble { max-width: 100%; background: #fff; color: var(--ink-2); border: 1px solid #dfe3f3; border-radius: var(--radius-sm); box-shadow: none; padding: 0.42rem 0.62rem; font-size: 0.82rem; line-height: 1.5; white-space: normal; word-break: break-word; overflow-wrap: anywhere; }
  .latestpin-body .bubble > :first-child { margin-top: 0; }
  .latestpin-body .bubble > :last-child { margin-bottom: 0; }
  .latestpin-body .bubble p { margin: 0; }
  .latestpin-body .bubble p + p { margin-top: 0.5em; }
  .latestpin-body .bubble a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
  .latestpin-body .bubble code { font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.92em; background: #eef2ff; color: #3730a3; border-radius: 4px; padding: 0.05em 0.3em; }
  .latestpin-body .bubble .filepath { color: var(--accent); }
  #msgs { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
  .msg { display: flex; }
  .msg.user { justify-content: flex-end; align-items: center; gap: 0.4rem; }
  /* hover-revealed ✎ that opens the in-place editor (left of the user bubble) */
  .msg-edit { flex-shrink: 0; order: -1; opacity: 0; pointer-events: none; border: 1px solid var(--line-2); background: #fff; color: var(--ink-3); border-radius: var(--radius-sm); font-size: 0.74rem; line-height: 1; padding: 0.22rem 0.4rem; box-shadow: var(--shadow-sm); transition: opacity 0.12s, color 0.12s, border-color 0.12s; }
  .msg.user:hover .msg-edit { opacity: 1; pointer-events: auto; }
  .msg-edit:hover { color: var(--accent); border-color: #c7d2fe; background: var(--accent-soft); }
  .msg.editing { justify-content: stretch; }
  .msg.editing .msg-edit { display: none; }
  .msg.editing .inline-edit { width: 100%; }
  /* shared in-place editor (sent-message resend + queued-draft edit) */
  .inline-edit { display: flex; flex-direction: column; gap: 0.4rem; width: 100%; }
  .inline-edit-ta { width: 100%; box-sizing: border-box; resize: vertical; min-height: 2.2rem; font: inherit; font-size: 0.86rem; line-height: 1.5; padding: 0.5rem 0.65rem; border: 1px solid var(--accent); border-radius: var(--radius-sm); background: #fff; color: var(--ink); box-shadow: 0 0 0 3px var(--accent-ring); }
  .inline-edit-bar { display: flex; gap: 0.4rem; justify-content: flex-end; }
  .inline-edit-save { color: #fff; background: var(--ink); border-color: var(--ink); font-weight: 600; }
  .inline-edit-save:hover { background: #0b1220; border-color: #0b1220; }
  .msg .bubble { max-width: 76%; padding: 0.55rem 0.8rem; border-radius: 12px; font-size: 0.88rem; line-height: 1.55; white-space: normal; word-break: break-word; overflow-wrap: anywhere; box-shadow: var(--shadow-sm); }
  .msg.user .bubble { background: var(--accent); color: white; border-bottom-right-radius: 4px; }
  .msg.assistant .bubble { background: #f5f6f8; color: var(--ink); border: 1px solid #eceef1; border-bottom-left-radius: 4px; }
  .msg .bubble > :first-child { margin-top: 0; }
  .msg .bubble > :last-child { margin-bottom: 0; }
  .msg .bubble p { margin: 0; }
  .msg .bubble p + p { margin-top: 0.7em; }
  .msg .bubble ul, .msg .bubble ol { margin: 0.55em 0 0 1.2em; padding: 0; }
  .msg .bubble li + li { margin-top: 0.22em; }
  .msg .bubble blockquote { margin: 0.7em 0 0; padding-left: 0.8em; border-left: 3px solid rgba(148, 163, 184, 0.65); color: inherit; opacity: 0.92; }
  .msg .bubble pre { margin: 0.7em 0 0; padding: 0.65em 0.8em; border-radius: 8px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
  .msg.assistant .bubble pre { background: #e5e7eb; color: #111827; }
  .msg.user .bubble pre { background: rgba(255,255,255,0.16); color: white; }
  .msg .bubble code { font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.92em; border-radius: 4px; padding: 0.08em 0.28em; }
  .msg.assistant .bubble code { background: #e5e7eb; color: #111827; }
  .msg.user .bubble code { background: rgba(255,255,255,0.18); color: white; }
  .msg .bubble pre code { background: transparent; padding: 0; border-radius: 0; }
  .msg .bubble a { text-decoration: underline; text-underline-offset: 2px; }
  .msg.assistant .bubble a { color: #4338ca; }
  .msg.user .bubble a { color: #e0e7ff; }
  .msg .bubble h1, .msg .bubble h2, .msg .bubble h3, .msg .bubble h4, .msg .bubble h5, .msg .bubble h6 { margin: 0.85em 0 0.35em; line-height: 1.25; }
  .msg .bubble h1 { font-size: 1.25em; }
  .msg .bubble h2 { font-size: 1.15em; }
  .msg .bubble h3 { font-size: 1.05em; }
  .msg .bubble hr { border: 0; border-top: 1px solid rgba(148, 163, 184, 0.45); margin: 0.75em 0; }
  .msg .bubble table { border-collapse: collapse; margin: 0.7em 0 0; font-size: 0.92em; display: block; max-width: 100%; overflow-x: auto; }
  .msg .bubble th, .msg .bubble td { border: 1px solid rgba(148, 163, 184, 0.5); padding: 0.3em 0.55em; text-align: left; vertical-align: top; }
  .msg .bubble thead th { background: rgba(148, 163, 184, 0.18); font-weight: 600; }
  .msg.user .bubble th, .msg.user .bubble td { border-color: rgba(255, 255, 255, 0.35); }
  .msg.user .bubble thead th { background: rgba(255, 255, 255, 0.16); }
  /* file paths mentioned in a message → click to reveal in Finder/Explorer */
  .msg .bubble .filepath { cursor: pointer; text-decoration: underline dotted; text-underline-offset: 2px; }
  .msg.assistant .bubble .filepath { color: #1d4ed8; }
  .msg.user .bubble .filepath { color: #e0e7ff; }
  .msg .bubble .filepath:hover { text-decoration: underline; }
  .msg .bubble .filepath.badpath { color: #b91c1c; text-decoration: line-through; }
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
  .toolc .diff-file { padding: 0.38rem 0.6rem 0.34rem; background: #f5f3ff; border-bottom: 1px solid #ede9fe; }
  .toolc .diff-file + .diff-file { border-top: 1px dashed #ddd6fe; }
  .toolc .diff-file-title { font-weight: 700; color: #4c1d95; }
  .toolc .diff-file-meta { margin-top: 0.16rem; font-size: 0.68rem; color: #7c3aed; }
  .toolc .diff-sep { height: 0.45rem; background: #f5f3ff; border-top: 1px dashed #ddd6fe; border-bottom: 1px dashed #ddd6fe; }
  .dline { display: flex; align-items: flex-start; padding: 0 0.4rem; line-height: 1.45; }
  .dline .dsign { width: 1.4ch; flex-shrink: 0; text-align: center; user-select: none; opacity: 0.7; }
  .dline .dtext { white-space: pre-wrap; word-break: break-word; flex: 1; min-width: 0; }
  .dline.add { background: #e6f7ec; color: #14532d; }
  .dline.add .dsign { color: #15803d; }
  .dline.del { background: #fde8e8; color: #7f1d1d; }
  .dline.del .dsign { color: #b91c1c; }
  .dline.ctx { color: #6b7280; }
  .dline.meta { background: #faf5ff; color: #6d28d9; }
  .dline.meta .dsign { color: #8b5cf6; }
  /* rich renders for interactive tools: todos / plan / questions */
  .rt, .rq, .rplan { background: #fff; border-top: 1px solid #ede9fe; padding: 0.45rem 0.65rem; }
  .rt { display: flex; flex-direction: column; gap: 0.18rem; }
  .rt-note { font-size: 0.74rem; color: #6b7280; font-style: italic; margin-bottom: 0.2rem; }
  .todo-row { display: flex; gap: 0.45rem; align-items: flex-start; font-size: 0.8rem; line-height: 1.45; font-family: ui-sans-serif, -apple-system, sans-serif; }
  .todo-ic { flex-shrink: 0; width: 1em; text-align: center; }
  .todo-row.done .todo-tx { color: #9ca3af; text-decoration: line-through; }
  .todo-row.done .todo-ic { color: #16a34a; }
  .todo-row.doing .todo-tx { color: #111827; font-weight: 600; }
  .todo-row.doing .todo-ic { color: #2563eb; }
  .todo-row.todo .todo-ic { color: #9ca3af; }
  .rq { display: flex; flex-direction: column; gap: 0.3rem; }
  .q-card { border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa; padding: 0.45rem 0.5rem; display: flex; flex-direction: column; gap: 0.35rem; }
  .q-head { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em; color: #6366f1; font-weight: 700; }
  .q-text { font-size: 0.82rem; color: #111827; line-height: 1.45; }
  .q-opt { border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.3rem 0.5rem; background: #fff; }
  .q-choice { display: flex; gap: 0.45rem; align-items: flex-start; cursor: pointer; }
  .q-choice input { margin-top: 0.18rem; }
  .q-choice-body { display: block; flex: 1; min-width: 0; }
  .q-opt-label { font-weight: 600; font-size: 0.8rem; color: #1f2937; display: block; }
  .q-opt-desc { font-size: 0.74rem; color: #6b7280; display: block; margin-top: 0.12rem; line-height: 1.4; }
  .q-free { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 6px; padding: 0.38rem 0.5rem; font: inherit; font-size: 0.78rem; background: #fff; }
  .q-actions { display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; }
  .q-submit { background: #1f2937; color: #fff; border: 1px solid #1f2937; border-radius: 6px; padding: 0.34rem 0.7rem; font: inherit; font-size: 0.76rem; cursor: pointer; }
  .q-submit:disabled { opacity: 0.65; cursor: default; }
  .q-err { font-size: 0.74rem; color: #b91c1c; }
  .rq.busy { opacity: 0.8; }
  .rplan { white-space: pre-wrap; word-break: break-word; font-size: 0.8rem; line-height: 1.5; color: #1f2937; max-height: 420px; overflow: auto; }
  .placeholder { margin: auto; color: #9ca3af; text-align: center; font-size: 0.9rem; max-width: 32ch; line-height: 1.5; }
  .foot { border-top: 1px solid var(--line); padding: 0.7rem 1.1rem; display: flex; gap: 0.5rem; align-items: flex-end; background: #fcfcfd; }
  .composer { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.35rem; padding: 0.35rem; margin: -0.35rem; border: 1px dashed transparent; border-radius: 12px; transition: border-color 0.15s, background 0.15s, box-shadow 0.15s; }
  .composer.drop { border-color: #818cf8; background: #f8faff; box-shadow: 0 0 0 4px rgba(99,102,241,0.12); }
  .composer textarea { width: 100%; resize: none; height: 2.5rem; padding: 0.55rem 0.7rem; border: 1px solid var(--line-2); border-radius: var(--radius); font: inherit; font-size: 0.88rem; background: var(--surface); box-shadow: var(--shadow-sm); }
  .attachtray { display: none; flex-wrap: wrap; gap: 0.35rem; }
  .attachtray.show { display: flex; }
  .attachchip { display: inline-flex; align-items: center; gap: 0.34rem; min-width: 0; max-width: 100%; padding: 0.18rem 0.45rem; border-radius: 999px; border: 1px solid #cbd5e1; background: #fff; color: #334155; font-size: 0.72rem; box-shadow: var(--shadow-sm); }
  .attachchip .kind { flex-shrink: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #4338ca; background: #eef2ff; border-radius: 999px; padding: 0.04rem 0.28rem; }
  .attachchip .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .attachchip button { border: 0; background: transparent; color: #64748b; box-shadow: none; padding: 0; font-size: 0.88rem; line-height: 1; }
  .attachchip button:hover { color: #b91c1c; background: transparent; }
  .attachmsg { display: none; font-size: 0.72rem; line-height: 1.4; color: #64748b; }
  .attachmsg.show { display: block; }
  .attachmsg.err { color: #b91c1c; }
  .foot button.send { min-height: 2.6rem; background: var(--ink); color: white; border-color: var(--ink); padding: 0 1.1rem; font-weight: 600; box-shadow: var(--shadow-md); }
  .foot button.send:hover { background: #0b1220; border-color: #0b1220; }
  .foot button.send.stopping { background: #b91c1c; border-color: #b91c1c; }
  .foot button.send.stopping:hover { background: #991b1b; }
  /* messages typed mid-turn: queued client-side, pinned above the composer
   *  (Codex-style), each editable/removable, and sendable on demand. */
  #queue { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.4rem 1rem 0; }
  #queue:empty { display: none; }
  .qitem { display: flex; align-items: center; gap: 0.45rem; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 0.3rem 0.4rem 0.3rem 0.55rem; }
  .qitem .qtag { font-size: 0.62rem; color: #4338ca; background: #e0e7ff; border-radius: 3px; padding: 0.05rem 0.32rem; flex-shrink: 0; }
  .qitem .qtext { flex: 1; min-width: 0; font-size: 0.82rem; color: #312e81; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .qitem button { font-size: 0.72rem; padding: 0.1rem 0.45rem; flex-shrink: 0; }
  .qitem button.qsend { color: #ffffff; background: #312e81; border-color: #312e81; font-weight: 600; }
  .qitem button.qsend:hover:not(:disabled) { background: #1f1b5b; border-color: #1f1b5b; }
  .qitem button.qsend:disabled { color: #c7d2fe; background: #6366f1; border-color: #6366f1; }
  .qitem button.qdel { color: #b91c1c; border-color: #fecaca; }
  .qitem button.qdel:hover { background: #fef2f2; }
  .qitem.editing { display: block; padding: 0.45rem; }
  .qitem.editing .qeditbox { display: flex; flex-direction: column; gap: 0.42rem; }
  .qitem.editing .qedithead { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
  .qitem.editing .qeditactions { margin-left: auto; display: flex; align-items: center; gap: 0.35rem; }
  .qitem.editing .qeditactions button { font-size: 0.72rem; padding: 0.16rem 0.5rem; }
  .qitem.editing .qeditgo { color: #fff; background: #312e81; border-color: #312e81; font-weight: 600; }
  .qitem.editing .qeditgo:hover:not(:disabled) { background: #1f1b5b; border-color: #1f1b5b; }
  .qitem.editing .qeditgo:disabled { color: #c7d2fe; background: #6366f1; border-color: #6366f1; }
  .qitem.editing .qeditta { width: 100%; box-sizing: border-box; resize: vertical; min-height: 2.4rem; font: inherit; font-size: 0.84rem; line-height: 1.5; padding: 0.52rem 0.64rem; border: 1px solid var(--accent); border-radius: var(--radius-sm); background: #fff; color: var(--ink); box-shadow: 0 0 0 3px var(--accent-ring); }
  .foot button.splitbtn { min-height: 2.6rem; color: #5b21b6; border-color: #ddd6fe; background: #f5f3ff; padding: 0 0.9rem; }
  .foot button.splitbtn:hover:not(:disabled) { background: #ede9fe; }
  .foot button.splitbtn:disabled { color: #c4b5fd; background: #faf5ff; cursor: default; }
  .pill { font-size: 0.66rem; padding: 0.05rem 0.4rem; border-radius: 3px; background: #ede9fe; color: #5b21b6; }
  /* Mobile: one page at a time — the session list, or the chat. Selecting a
     session slides to chat (body.show-chat); the back button returns to the list. */
  @media (max-width: 760px) {
    body { height: 100dvh; }
    .resizer { display: none; }
    .side { width: 100% !important; }          /* beat the resizer's inline width */
    .main { width: 100%; display: none; }       /* chat hidden until a session opens */
    body.show-chat .side { display: none; }
    body.show-chat .main { display: flex; }
    .newrow { flex-direction: column; align-items: stretch; }
    .newrow .pickgrp.effort { max-width: none; }
    .backbtn { display: inline-flex; align-items: center; }
    .head .s .sub-line { max-height: 3rem; }
    .msg .bubble { max-width: 88%; }
  }
`;

export function renderConsole(v: ConsoleView): string {
  const sessJson = JSON.stringify(v.sessions).replace(/</g, "\\u003c");
  const dirsJson = JSON.stringify(v.knownDirs).replace(/</g, "\\u003c");
  const rootsJson = JSON.stringify(v.scopeRoots).replace(/</g, "\\u003c");
  const vendorsJson = JSON.stringify(v.vendors).replace(/</g, "\\u003c");
  const tagsJson = JSON.stringify(v.tags).replace(/</g, "\\u003c");

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
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Attend — console</title><style>${STYLE}</style></head>
<body>
<div class="side">
  <h1>Attend <span class="accent">24h · ${sph} sessions/hr · ${cph} chars/hr</span></h1>
  <div class="topnav">
    <button id="newToggle" aria-expanded="false">+ new</button>
    <input id="search" class="searchbox" placeholder="Search sessions…" autocomplete="off">
  </div>
  <div class="newbox" id="newbox">
    <div class="newhead">
      <div class="newttl">New session</div>
      <button id="newClose" class="newclose" type="button" aria-label="close new session form">✕</button>
    </div>
    <div class="newrow">
      <div class="pickgrp vendor">
        <div class="picklbl">vendor</div>
        <div class="chooser" id="nvendorBox">
          <div class="chooser-row">
            <input id="nvendor" class="chooser-input" placeholder="pick a vendor" autocomplete="off" spellcheck="false">
          </div>
          <div class="chooser-drop" id="nvendorSug" hidden></div>
        </div>
      </div>
      <div class="pickgrp">
        <div class="picklbl">model</div>
        <select id="nmodel" class="chooser-select" aria-label="model"></select>
      </div>
      <div class="pickgrp effort">
        <div class="picklbl">effort</div>
        <select id="neffort" class="chooser-select" aria-label="effort"></select>
      </div>
    </div>
      <div class="pickgrp">
        <div class="picklbl">project dir</div>
        <div class="chooser" id="ndirBox">
          <div class="chooser-row">
            <input id="ndir" class="chooser-input" placeholder="pick a project dir, or type a vault-relative / absolute path" autocomplete="off" spellcheck="false">
          </div>
          <div class="chooser-drop" id="ndirSug" hidden></div>
        </div>
      </div>
    <textarea id="np" rows="2" placeholder="first message (optional · Enter to start · Shift+Enter for newline)"></textarea>
    <button id="nbtn" class="send nbtn-primary">start session ▸</button>
    <div class="nmsg" id="nmsg"></div>
  </div>
  <div class="tagbar">
    <div class="taghead">
      <span class="tagttl">tags</span>
      <span class="taghint">multi-select = OR · vendor/dir are auto tags · x deletes user tags globally</span>
    </div>
    <div class="tagchips" id="tagFilters"></div>
  </div>
  <div id="list"></div>
</div>
<div class="resizer" id="resizer"></div>
<div class="main">
  <div class="head">
    <button class="backbtn" id="backbtn" title="back to sessions">‹ sessions</button>
    <div class="headmain">
      <div class="headrow">
        <span class="headstatus read" id="h-status" title="read"></span>
        <div class="t" id="h-title">Attend</div>
        <button class="headbtn" id="refreshBtn" title="refresh this chat from transcript" disabled aria-label="refresh this chat">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13 3.5v3h-3"></path>
            <path d="M12.2 6.2A5 5 0 1 0 13 8.9"></path>
          </svg>
        </button>
      </div>
      <div class="s" id="h-sub">Select a session, or + new</div><div class="sig" id="h-sig"></div><div id="h-tags"></div>
    </div>
  </div>
  <div class="latestpin" id="latestPin" aria-hidden="true">
    <div class="latestpin-head">
      <span class="latestpin-tag">Latest you</span>
      <button class="latestpin-jump" id="latestPinJump" type="button">jump</button>
    </div>
    <div class="latestpin-body" id="latestPinBody"></div>
  </div>
  <div id="msgs"><div class="placeholder" id="ph">Pick a session on the left to see its chat, then type below to continue it — all in the browser.</div></div>
  <div id="queue"></div>
  <div class="foot">
    <div class="composer" id="composer">
      <div class="attachtray" id="attachTray"></div>
      <div class="attachmsg" id="attachMsg"></div>
      <textarea id="input" placeholder="message (Enter to send · Shift+Enter for newline · drag files/images here)"></textarea>
    </div>
    <button class="splitbtn" id="forkBtn" title="branch this session into a fork (uses your draft as the opening turn)" disabled>fork ⑂</button>
    <button class="send" id="send">send</button>
  </div>
</div>
<div class="tabtip" id="tabtip" aria-hidden="true"></div>
<script>
window.__SESSIONS__ = ${sessJson};
window.__DIRS__ = ${dirsJson};
window.__ROOTS__ = ${rootsJson};
window.__VENDORS__ = ${vendorsJson};
window.__TAGS__ = ${tagsJson};
</script>
<script>
(function(){
  var SESS = window.__SESSIONS__ || [];
  var DIRS = window.__DIRS__ || [];
  var ROOTS = window.__ROOTS__ || [];
  var TAGS = window.__TAGS__ || [];
  var VENDORS = window.__VENDORS__ || [];
  var NEW_PREFS_KEY = 'attend.newSessionPrefs.v1';
  var NEW_MODEL_OPTIONS = {
    claude: [
      { value:'', label:'current CLI model' },
      { value:'sonnet', label:'sonnet' },
      { value:'opus', label:'opus' },
      { value:'haiku', label:'haiku' },
      { value:'claude-sonnet-4-6', label:'claude-sonnet-4-6' },
      { value:'claude-opus-4-8', label:'claude-opus-4-8' }
    ],
    codex: [
      { value:'', label:'current CLI model' },
      { value:'gpt-5.3-codex', label:'gpt-5.3-codex' },
      { value:'gpt-5.2-codex', label:'gpt-5.2-codex' },
      { value:'gpt-5.1-codex', label:'gpt-5.1-codex' },
      { value:'gpt-5.1-codex-max', label:'gpt-5.1-codex-max' },
      { value:'codex-mini-latest', label:'codex-mini-latest' }
    ]
  };
  var NEW_EFFORT_OPTIONS = {
    claude: [
      { value:'low', label:'low' },
      { value:'medium', label:'medium' },
      { value:'high', label:'high' },
      { value:'xhigh', label:'xhigh' },
      { value:'max', label:'max' }
    ],
    codex: [
      { value:'low', label:'low' },
      { value:'medium', label:'medium' },
      { value:'high', label:'high' },
      { value:'xhigh', label:'xhigh' }
    ]
  };
  function loadNewPrefs(){
    try{
      var raw=localStorage.getItem(NEW_PREFS_KEY);
      if(!raw) return {};
      var parsed=JSON.parse(raw);
      return parsed && typeof parsed==='object' ? parsed : {};
    }catch(e){ return {}; }
  }
  var newPrefs = loadNewPrefs();
  var appliedNewVendor = '';
  var cur = null, es = null, assistantEl = null;
  var genEl = null, genTimer = null, genStart = 0, turnActive = false;
  var activeTags = [];
  var globalTagEditing = false;
  var editingTagSession = null;
  var headerTagEditing = false;
  var newSessionPending = false;
  var localPendingMsgs = {};
  var PROJECT_COLORS = [
    { fg:'#9a3412', bg:'#fff7ed', border:'#fdba74' },
    { fg:'#0f766e', bg:'#f0fdfa', border:'#99f6e4' },
    { fg:'#1d4ed8', bg:'#eff6ff', border:'#93c5fd' },
    { fg:'#7c2d12', bg:'#fef2f2', border:'#fca5a5' },
    { fg:'#5b21b6', bg:'#f5f3ff', border:'#c4b5fd' },
    { fg:'#166534', bg:'#f0fdf4', border:'#86efac' },
    { fg:'#9d174d', bg:'#fdf2f8', border:'#f9a8d4' },
    { fg:'#92400e', bg:'#fffbeb', border:'#fcd34d' },
    { fg:'#0f766e', bg:'#ecfeff', border:'#67e8f9' },
    { fg:'#334155', bg:'#f8fafc', border:'#cbd5e1' },
    { fg:'#0f766e', bg:'#f0fdfa', border:'#5eead4' },
    { fg:'#3730a3', bg:'#eef2ff', border:'#a5b4fc' }
  ];
  // Messages typed while a turn is generating. We don't block input anymore: the
  // draft is queued (Codex-style) so you can edit it, send it manually, or let a
  // naturally-finished turn advance into it automatically. Stopping a turn keeps
  // the queue intact.
  var pendingQueue = [];
  var editingQueueIdx = -1; // which queued draft is open in its inline editor (-1 = none)
  var stopRequested = false;
  var sessionDrafts = {};
  var sessionAttachments = {};
  var sessionQueues = {};
  var sessionQueueEditing = {};
  var transcriptCache = {};
  var draftAttachments = [];
  var refreshBusy = false;
  var attachmentMsg = '';
  var attachmentMsgErr = false;
  var attachmentReadPending = 0;
  var composerDragDepth = 0;
  var renderTarget = null;
  var suppressScroll = false;
  // Catch-up dedup: when you (re)open a session whose turn is still live, the
  // server replays the run's buffered events on top of the JSONL/rollout history
  // we just rendered — re-adding assistant blocks that are already on screen
  // (the "重复/错乱" bug). We count each rendered assistant block; while the replay
  // window is open (until the 'sync' marker), an assistant_text whose text is
  // already accounted for is dropped. Genuinely-new blocks end the window.
  var catchupCounts = {};   // assistant block text - remaining count to absorb
  var catchup = false;      // are we still inside the replay catch-up window?
  var latestUserMsgEl = null;
  var latestPinRaf = 0;
  var viewVisit = null;
  function byId(id){ return document.getElementById(id); }
  function el(tag, cls, txt){ var e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e; }
  var IMAGE_ATTACHMENT_TYPES = { 'image/jpeg':true, 'image/png':true, 'image/gif':true, 'image/webp':true };
  var TEXT_ATTACHMENT_EXTS = {
    txt:true, md:true, markdown:true, json:true, js:true, jsx:true, ts:true, tsx:true,
    css:true, html:true, htm:true, xml:true, yml:true, yaml:true, csv:true, tsv:true,
    log:true, py:true, java:true, go:true, rs:true, sh:true, sql:true, ini:true
  };
  function attachmentId(){ return 'att-'+Date.now()+'-'+Math.random().toString(36).slice(2,8); }
  function fileExt(name){
    var s=String(name||''); var i=s.lastIndexOf('.');
    return i>=0 ? s.slice(i+1).toLowerCase() : '';
  }
  function looksTextFile(file){
    if(!file) return false;
    if(file.type && /^text\\//i.test(file.type)) return true;
    if(file.type && /^(application\\/json|application\\/xml|application\\/javascript)$/i.test(file.type)) return true;
    return !!TEXT_ATTACHMENT_EXTS[fileExt(file.name)];
  }
  function dataUrlPayload(url){
    var s=String(url||''); var i=s.indexOf(',');
    return i>=0 ? s.slice(i+1) : s;
  }
  function attachmentBadge(att){
    return att.kind==='image' ? 'img' : att.kind==='document' ? 'pdf' : 'txt';
  }
  function attachmentLine(att){
    return '- '+(att.kind==='image' ? 'image' : att.kind==='document' ? 'pdf' : 'text')+': '+att.name;
  }
  function attachmentSummary(atts){
    if(!atts || !atts.length) return '';
    return 'Attachments:\\n'+atts.map(attachmentLine).join('\\n');
  }
  function composeTurnText(text, atts){
    var body=String(text||'').trim();
    var summary=attachmentSummary(atts);
    if(body && summary) return body+'\\n\\n'+summary;
    return body || summary;
  }
  function turnText(turn){ return turn && typeof turn==='object' ? String(turn.text||'') : String(turn||''); }
  function turnAttachments(turn){ return turn && typeof turn==='object' && Array.isArray(turn.attachments) ? turn.attachments : []; }
  function turnPreview(turn){
    var text=turnText(turn).replace(/\\s+/g,' ').trim();
    if(text) return text;
    var atts=turnAttachments(turn);
    return atts.length ? attachmentSummary(atts).replace(/\\n/g,' ') : '';
  }
  function cloneTurn(turn){
    return { text: turnText(turn), attachments: turnAttachments(turn).map(function(att){ return Object.assign({}, att); }) };
  }
  function setAttachmentMsg(msg, isErr){
    attachmentMsg = msg ? String(msg) : '';
    attachmentMsgErr = !!isErr;
    var node=byId('attachMsg');
    if(!node) return;
    node.textContent = attachmentMsg;
    node.className = 'attachmsg'+(attachmentMsg ? ' show' : '')+(attachmentMsgErr ? ' err' : '');
  }
  function renderAttachments(){
    var tray=byId('attachTray'); if(!tray) return;
    tray.innerHTML='';
    draftAttachments.forEach(function(att){
      var chip=el('span','attachchip');
      chip.appendChild(el('span','kind',attachmentBadge(att)));
      var name=el('span','name',att.name);
      name.title=att.name;
      chip.appendChild(name);
      var del=el('button',null,'×');
      del.title='Remove attachment';
      del.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); removeAttachment(att.id); };
      chip.appendChild(del);
      tray.appendChild(chip);
    });
    tray.className='attachtray'+(draftAttachments.length ? ' show' : '');
    if(draftAttachments.length && !attachmentMsg){
      if(cur && cur.vendor==='codex') setAttachmentMsg('Codex currently receives attachment names in text only; Claude receives the actual file/image blocks.', false);
      else setAttachmentMsg('Send with or without extra text. Drag more files here to add them.', false);
    } else if(!draftAttachments.length && !attachmentReadPending){
      setAttachmentMsg('', false);
    }
  }
  function clearAttachments(){
    draftAttachments = [];
    if(cur) delete sessionAttachments[draftKey(cur)];
    renderAttachments();
  }
  function removeAttachment(id){
    draftAttachments = draftAttachments.filter(function(att){ return att.id!==id; });
    if(cur) stashAttachmentState(cur);
    renderAttachments();
  }
  function stashAttachmentState(s){
    var key=draftKey(s);
    if(!key) return;
    if(draftAttachments.length) sessionAttachments[key]=draftAttachments.map(function(att){ return Object.assign({}, att); });
    else delete sessionAttachments[key];
  }
  function restoreAttachmentState(s){
    var key=draftKey(s);
    draftAttachments = key && sessionAttachments[key] ? sessionAttachments[key].map(function(att){ return Object.assign({}, att); }) : [];
    renderAttachments();
  }
  function setComposerDrop(on){
    var box=byId('composer'); if(box) box.classList.toggle('drop', !!on);
  }
  function readImageOrPdf(file, kind){
    return new Promise(function(resolve, reject){
      var fr=new FileReader();
      fr.onload=function(){ resolve({ kind:kind, name:file.name, mediaType: kind==='image' ? file.type : 'application/pdf', data:dataUrlPayload(fr.result), id:attachmentId() }); };
      fr.onerror=function(){ reject(new Error('read failed')); };
      fr.readAsDataURL(file);
    });
  }
  function readTextAttachment(file){
    return file.text().then(function(text){
      return { kind:'text', name:file.name, text:text, id:attachmentId() };
    });
  }
  function loadAttachment(file){
    if(!file || !file.name) return Promise.reject(new Error('unsupported item'));
    if(file.type && IMAGE_ATTACHMENT_TYPES[file.type]){
      if(file.size > 5*1024*1024) return Promise.reject(new Error(file.name+' is too large (max 5 MB per image)'));
      return readImageOrPdf(file, 'image');
    }
    if(file.type==='application/pdf' || fileExt(file.name)==='pdf'){
      if(file.size > 8*1024*1024) return Promise.reject(new Error(file.name+' is too large (max 8 MB per PDF)'));
      return readImageOrPdf(file, 'document');
    }
    if(looksTextFile(file)){
      if(file.size > 1024*1024) return Promise.reject(new Error(file.name+' is too large (max 1 MB per text file)'));
      return readTextAttachment(file);
    }
    return Promise.reject(new Error(file.name+' is not a supported file type yet'));
  }
  function addAttachments(files){
    var list=(files||[]).filter(function(file){ return !!file; });
    if(!list.length) return Promise.resolve();
    attachmentReadPending++;
    setAttachmentMsg('Reading '+list.length+' attachment'+(list.length>1?'s':'')+'…', false);
    return Promise.allSettled(list.map(loadAttachment)).then(function(results){
      var added=0, errs=[];
      results.forEach(function(res){
        if(res.status==='fulfilled'){
          var att=res.value;
          if(!draftAttachments.some(function(x){ return x.name===att.name && x.kind===att.kind && (x.data||x.text)===(att.data||att.text); })){
            draftAttachments.push(att); added++;
          }
        } else if(res.reason) errs.push(res.reason.message || String(res.reason));
      });
      if(cur) stashAttachmentState(cur);
      renderAttachments();
      if(errs.length) setAttachmentMsg(errs[0], true);
      else if(added) setAttachmentMsg('Attached '+added+' file'+(added>1?'s':''), false);
    }).finally(function(){
      attachmentReadPending=Math.max(0, attachmentReadPending-1);
    });
  }
  function bindComposerDrop(){
    var box=byId('composer'), input=byId('input');
    if(!box || !input) return;
    function fileDrag(ev){
      var dt=ev.dataTransfer;
      return !!(dt && Array.prototype.some.call(dt.types||[], function(t){ return t==='Files'; }));
    }
    box.addEventListener('dragenter', function(ev){
      if(!fileDrag(ev)) return;
      ev.preventDefault();
      composerDragDepth++;
      setComposerDrop(true);
    });
    box.addEventListener('dragover', function(ev){
      if(!fileDrag(ev)) return;
      ev.preventDefault();
      setComposerDrop(true);
    });
    box.addEventListener('dragleave', function(ev){
      if(!fileDrag(ev)) return;
      composerDragDepth=Math.max(0, composerDragDepth-1);
      if(composerDragDepth===0) setComposerDrop(false);
    });
    box.addEventListener('drop', function(ev){
      if(!fileDrag(ev)) return;
      ev.preventDefault();
      composerDragDepth=0;
      setComposerDrop(false);
      addAttachments(Array.prototype.slice.call((ev.dataTransfer&&ev.dataTransfer.files)||[])).catch(function(){});
      try{ input.focus(); }catch(e){}
    });
  }
  function isImeConfirming(ev){ return !!(ev && (ev.isComposing || ev.keyCode===229 || ev.which===229)); }
  function normalizeTag(name){ return String(name||'').trim().replace(/\\s+/g,' '); }
  function userTagDef(tag){
    var name=normalizeTag(tag);
    return name ? { key:'tag:'+name, kind:'user', label:name, value:name, title:name, deletable:true } : null;
  }
  function autoTagDefsForSession(s){
    var defs=[];
    if(!s) return defs;
    if(s.vendor){
      defs.push({
        key:'vendor:'+s.vendor,
        kind:'vendor',
        label:s.vendor,
        value:s.vendor,
        title:'vendor · '+s.vendor,
        deletable:false
      });
    }
    var cwd=s.cwd||'';
    var project=s.project||basename(cwd)||cwd;
    if(cwd || project){
      defs.push({
        key:'cwd:'+(cwd||project),
        kind:'cwd',
        label:project,
        value:project,
        title:cwd || project,
        deletable:false
      });
    }
    return defs;
  }
  function allTagDefsForSession(s){
    var defs=autoTagDefsForSession(s);
    (s&&s.tags||[]).forEach(function(tag){
      var def=userTagDef(tag);
      if(def) defs.push(def);
    });
    return defs;
  }
  function sessionTagKeys(s){
    return allTagDefsForSession(s).map(function(def){ return def.key; });
  }
  function filterTagDefs(){
    var defs=[], seen={};
    ['claude','codex'].forEach(function(vendor){
      var exists=SESS.some(function(s){ return s && s.vendor===vendor; });
      if(!exists) return;
      var def={ key:'vendor:'+vendor, kind:'vendor', label:vendor, value:vendor, title:'vendor · '+vendor, deletable:false };
      defs.push(def); seen[def.key]=true;
    });
    SESS.forEach(function(s){
      autoTagDefsForSession(s).forEach(function(def){
        if(seen[def.key]) return;
        seen[def.key]=true;
        defs.push(def);
      });
    });
    TAGS.forEach(function(tag){
      var def=userTagDef(tag);
      if(!def || seen[def.key]) return;
      seen[def.key]=true;
      defs.push(def);
    });
    return defs;
  }
  function tagTheme(def){
    if(def && def.kind==='vendor') return vendorTheme(def.value||def.label);
    if(def && def.kind==='cwd') return projectTheme(def.value||def.label);
    return { fg:'#115e59', bg:'#ccfbf1', border:'#99f6e4' };
  }
  function styleFilterTagChip(chip, btn, del, def, active){
    var theme=tagTheme(def);
    styleTheme(chip, theme);
    chip.style.boxShadow = active ? ('inset 0 0 0 1px '+theme.fg) : '';
    chip.classList.toggle('on', !!active);
    chip.classList.toggle('auto', def && def.kind!=='user');
    if(btn){
      btn.style.color = active ? '#ffffff' : theme.fg;
      btn.style.backgroundColor = active ? theme.fg : 'transparent';
    }
    if(del){
      del.style.color = theme.fg;
      del.style.borderLeftColor = theme.border;
      del.style.backgroundColor = 'transparent';
    }
  }
  function styleSessionTagChip(chip, def){
    var theme=tagTheme(def);
    styleTheme(chip, theme);
    chip.classList.toggle('auto', def && def.kind!=='user');
  }
  function activeTagLabels(){
    var byKey={};
    filterTagDefs().forEach(function(def){ byKey[def.key]=def.label; });
    return activeTags.map(function(key){ return byKey[key] || key; });
  }
  function findSessionById(sessionId){
    for(var i=0;i<SESS.length;i++){ if(SESS[i] && SESS[i].sessionId===sessionId) return SESS[i]; }
    return null;
  }
  function patchSessionView(next){
    if(!next || !next.sessionId) return;
    var s=findSessionById(next.sessionId);
    if(!s) return;
    ['pattern','score','reason','etaMin','brief','ageDays','lastTs','sortTs','priorityset','etaset','unread','seen'].forEach(function(k){
      if(next[k]!==undefined) s[k]=next[k];
    });
    if(cur && cur.sessionId===s.sessionId){ syncOpenHeader(); }
    renderSidebar();
  }
  function beginVisit(s){
    if(!s || !s.sessionId || s.pendingFork) return;
    viewVisit = {
      sessionId: s.sessionId,
      startedAt: Date.now(),
      lastScrollTop: null,
      scrollPx: 0,
      hadMeaningfulScroll: false,
      hadSend: false,
      ignoreScrollUntil: Date.now() + 800
    };
  }
  function markVisitSend(){
    if(viewVisit && cur && viewVisit.sessionId===cur.sessionId) viewVisit.hadSend = true;
  }
  function trackVisitScroll(ev){
    if(!viewVisit || !cur || viewVisit.sessionId!==cur.sessionId) return;
    if(ev && ev.isTrusted===false) return;
    if(Date.now() < viewVisit.ignoreScrollUntil) return;
    var m=byId('msgs'); if(!m) return;
    var overflow=m.scrollHeight - m.clientHeight;
    if(overflow < 120) return;
    var top=m.scrollTop;
    if(viewVisit.lastScrollTop==null){ viewVisit.lastScrollTop = top; return; }
    viewVisit.scrollPx += Math.abs(top - viewVisit.lastScrollTop);
    viewVisit.lastScrollTop = top;
    if(viewVisit.scrollPx >= Math.min(Math.max(m.clientHeight * 0.5, 160), 480)){
      viewVisit.hadMeaningfulScroll = true;
    }
  }
  function postVisit(payload, useBeacon){
    var url='/session/engagement?session='+encodeURIComponent(payload.sessionId);
    var body=JSON.stringify({
      viewedMs: payload.viewedMs,
      endedAt: payload.endedAt,
      hadMeaningfulScroll: payload.hadMeaningfulScroll,
      hadSend: payload.hadSend
    });
    if(useBeacon && navigator.sendBeacon){
      try {
        var blob=new Blob([body], {type:'application/json'});
        navigator.sendBeacon(url, blob);
        return Promise.resolve();
      } catch(e){}
    }
    return fetch(url,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:body
    }).then(function(r){ return r.json(); }).then(function(res){
      if(res && res.ok && res.view) patchSessionView(res.view);
    }).catch(function(){});
  }
  function postSessionStatus(s, state){
    if(!s || !s.sessionId || s.pendingFork) return Promise.resolve();
    return fetch('/session/status?session='+encodeURIComponent(s.sessionId),{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({ state: state, updatedAt: Date.now() })
    }).then(function(r){ return r.json(); }).then(function(res){
      if(res && res.ok && res.view) patchSessionView(res.view);
    }).catch(function(){});
  }
  function flushVisit(useBeacon){
    if(!viewVisit) return Promise.resolve();
    var v=viewVisit; viewVisit=null;
    var viewedMs=Math.max(0, Date.now() - v.startedAt);
    if(!v.sessionId || viewedMs < 1000) return Promise.resolve();
    return postVisit({
      sessionId: v.sessionId,
      viewedMs: viewedMs,
      endedAt: Date.now(),
      hadMeaningfulScroll: !!v.hadMeaningfulScroll,
      hadSend: !!v.hadSend
    }, !!useBeacon);
  }
  function rememberPendingUserMsg(sessionId, text){
    if(!sessionId || !text) return;
    var list=localPendingMsgs[sessionId] || (localPendingMsgs[sessionId]=[]);
    list.push(String(text));
  }
  function transcriptCacheKey(file, vendor){
    return file ? String(vendor||'claude')+'|'+String(file) : '';
  }
  function cloneTranscriptMsgs(msgs){
    return Array.isArray(msgs) ? msgs.map(function(m){
      return {
        role: m && m.role || 'assistant',
        text: m && m.text || '',
        tools: Array.isArray(m && m.tools) ? m.tools.map(function(t){ return Object.assign({}, t); }) : []
      };
    }) : [];
  }
  function cacheTranscript(s, msgs){
    var copy=cloneTranscriptMsgs(msgs);
    if(s && s.sessionId) transcriptCache['sid:'+s.sessionId]=copy;
    if(s && s.file) transcriptCache[transcriptCacheKey(s.file, s.vendor)] = copy;
    return copy;
  }
  function ensureTranscriptState(s){
    if(!s || !s.sessionId) return null;
    var sidKey='sid:'+s.sessionId;
    var fileKey=transcriptCacheKey(s.file, s.vendor);
    var state=transcriptCache[sidKey] || (fileKey && transcriptCache[fileKey]);
    if(!state){
      state = [];
      transcriptCache[sidKey] = state;
    } else {
      transcriptCache[sidKey] = state;
    }
    if(fileKey) transcriptCache[fileKey] = state;
    return state;
  }
  function ensureAssistantTranscriptMsg(s){
    var state=ensureTranscriptState(s);
    if(!state) return null;
    var last=state[state.length-1];
    if(last && last.role==='assistant') return last;
    last = { role:'assistant', text:'', tools:[] };
    state.push(last);
    return last;
  }
  function cacheTranscriptUserMsg(s, text){
    var state=ensureTranscriptState(s);
    if(!state) return;
    state.push({ role:'user', text:String(text||''), tools:[] });
  }
  function cacheTranscriptAssistantText(s, text){
    if(!text) return;
    var msg=ensureAssistantTranscriptMsg(s);
    if(msg) msg.text = String(msg.text||'') + String(text);
  }
  function cacheTranscriptToolUse(s, tc){
    if(!tc) return;
    var msg=ensureAssistantTranscriptMsg(s);
    if(!msg) return;
    msg.tools.push({
      id: tc.id ?? null,
      name: tc.name,
      input: tc.input,
      result: tc.result,
      isError: tc.isError === true
    });
  }
  function cacheTranscriptToolResult(s, id, text, isError){
    var state=ensureTranscriptState(s);
    if(!state) return;
    for(var i=state.length-1;i>=0;i--){
      var tools=state[i] && state[i].tools;
      if(!tools || !tools.length) continue;
      for(var j=tools.length-1;j>=0;j--){
        if((tools[j].id||null)===(id||null)){
          tools[j].result = text;
          tools[j].isError = !!isError;
          return;
        }
      }
    }
  }
  function cachedTranscriptFor(s){
    if(!s) return null;
    if(s.sessionId && transcriptCache['sid:'+s.sessionId]) return cloneTranscriptMsgs(transcriptCache['sid:'+s.sessionId]);
    var key=transcriptCacheKey(s.file, s.vendor);
    if(key && transcriptCache[key]) return cloneTranscriptMsgs(transcriptCache[key]);
    return null;
  }
  function sameTranscript(a, b){
    return JSON.stringify(a||[])===JSON.stringify(b||[]);
  }
  function forgetPendingUserMsg(sessionId, text){
    var list=localPendingMsgs[sessionId];
    if(!sessionId || !list || !list.length) return;
    for(var i=list.length-1;i>=0;i--){
      if(list[i]===String(text)){ list.splice(i,1); break; }
    }
    if(!list.length) delete localPendingMsgs[sessionId];
  }
  // Reconcile optimistically-rendered sends against the freshly-read transcript.
  // localPendingMsgs holds user messages we showed immediately (before the JSONL
  // caught up). We must re-append only those NOT yet in the transcript — without
  // re-appending ones that are. The old code matched the pending list as a
  // CONTIGUOUS suffix of transcript user msgs; an aborted send that never persisted
  // (send 1 → Stop → send 2) punched a hole, the suffix match failed, and BOTH got
  // re-appended at the bottom (the "重复" bug). Instead, match each pending message
  // as an in-order SUBSEQUENCE and drop everything up to and including the last
  // confirmed one: if a LATER pending msg reached the transcript, an earlier missing
  // one was aborted and never will — so it's settled too, not still-pending.
  function transcriptPendingTail(sessionId, msgs){
    var pending=localPendingMsgs[sessionId];
    if(!sessionId || !pending || !pending.length) return [];
    var users=msgs.filter(function(m){ return m && m.role==='user' && m.text; }).map(function(m){ return m.text; });
    var u=0, lastConfirmed=-1;
    for(var i=0;i<pending.length;i++){
      for(var j=u;j<users.length;j++){
        if(users[j]===pending[i]){ lastConfirmed=i; u=j+1; break; }
      }
    }
    var leftover=pending.slice(lastConfirmed+1);
    if(leftover.length) localPendingMsgs[sessionId]=leftover; else delete localPendingMsgs[sessionId];
    return leftover.slice();
  }
  function replaceMessages(node){
    var m=byId('msgs'); if(!m) return;
    // Capture intent BEFORE we touch scrollTop: setting it fires a 'scroll' event
    // that recomputes stick, so reading it later is unreliable.
    var pinToBottom = stick;
    m.style.visibility='hidden';
    m.replaceChildren(node);
    keepGenLast();
    scroll();
    // The synchronous scroll above can land a few px short of the true bottom:
    // bubble/markdown layout (and a possible follow-up re-render from select()'s
    // transcript fetch) isn't fully settled in this tick, so scrollHeight grows
    // after we read it. Re-pin across the next two frames — idempotent if nothing
    // moved, but it closes the "差一点点" gap on tab switch. Guarded by pinToBottom
    // so a scrolled-up session isn't yanked to the bottom.
    requestAnimationFrame(function(){
      if(pinToBottom){ m.scrollTop=m.scrollHeight; }
      m.style.visibility='';
      requestAnimationFrame(function(){ if(pinToBottom){ m.scrollTop=m.scrollHeight; } });
    });
    scheduleLatestPin();
  }
  function renderPersistedAndPending(msgs, sessionId){
    var frag=document.createDocumentFragment();
    var prevTarget=renderTarget, prevSuppress=suppressScroll;
    renderTarget=frag; suppressScroll=true;
    if(!msgs.length) addMsg('assistant','(no history yet)');
    msgs.forEach(function(m){ if(m.text) addMsg(m.role, m.text); (m.tools||[]).forEach(function(t){ addTool(t); }); });
    transcriptPendingTail(sessionId, msgs).forEach(function(text){ addMsg('user', text); });
    renderTarget=prevTarget; suppressScroll=prevSuppress;
    replaceMessages(frag);
    primeCatchup();
  }
  function renderSessionHistory(s, msgs){
    cacheTranscript(s, msgs);
    renderPersistedAndPending(msgs, s && s.sessionId);
  }
  function hideLatestPin(){
    var pin=byId('latestPin'), body=byId('latestPinBody');
    if(!pin || !body) return;
    pin.classList.remove('show');
    pin.setAttribute('aria-hidden','true');
    body.innerHTML='';
  }
  function refreshLatestUserMsg(){
    var msgs=byId('msgs'); if(!msgs) return null;
    var nodes=msgs.querySelectorAll('.msg.user');
    latestUserMsgEl = nodes.length ? nodes[nodes.length-1] : null;
    return latestUserMsgEl;
  }
  function showLatestPinFrom(msgEl){
    var pin=byId('latestPin'), body=byId('latestPinBody');
    if(!pin || !body || !msgEl) return;
    var bubble=msgEl.querySelector('.bubble');
    if(!bubble) return hideLatestPin();
    body.innerHTML='';
    body.appendChild(bubble.cloneNode(true));
    pin.classList.add('show');
    pin.setAttribute('aria-hidden','false');
  }
  function updateLatestPin(){
    latestPinRaf = 0;
    var m=byId('msgs'); if(!m || !cur || cur.pendingFork) return hideLatestPin();
    var msgEl=refreshLatestUserMsg();
    if(!msgEl) return hideLatestPin();
    var box=msgEl.getBoundingClientRect(), frame=m.getBoundingClientRect();
    if(box.bottom < frame.top + 10) showLatestPinFrom(msgEl);
    else hideLatestPin();
  }
  function scheduleLatestPin(){
    if(latestPinRaf) return;
    latestPinRaf = requestAnimationFrame(updateLatestPin);
  }
  function escapeHtml(s){
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }
  function escapeAttr(s){ return escapeHtml(s); }
  function localLinkPath(url){
    var u=String(url||'').trim();
    return /^(?:~\\/|\\/|[A-Za-z]:[\\\\/])/i.test(u) ? u : '';
  }
  function sanitizeUrl(url){
    var u=String(url||'').trim();
    return /^(https?:|mailto:|\\/|#)/i.test(u) ? u : '';
  }
  function parseInline(text){
    var src=String(text||'');
    var codes=[];
    var anchors=[];
    src = src.replace(/\x60([^\x60]+)\x60/g, function(_, code){
      var idx=codes.push('<code>'+escapeHtml(code)+'</code>')-1;
      return '\u0000'+idx+'\u0000';
    });
    src = escapeHtml(src);
    src = src.replace(/\\[([^\\]]+)\\]\\(([^)\\s]+)\\)/g, function(_, label, href){
      var local=localLinkPath(href);
      if(local){
        return '<a href="#" class="filepath" data-path="'+escapeAttr(local)+'" title="Reveal in file manager">'+parseInline(label)+'</a>';
      }
      var safe=sanitizeUrl(href);
      if(!safe) return label;
      return '<a href="'+escapeAttr(safe)+'" target="_blank" rel="noreferrer">'+parseInline(label)+'</a>';
    });
    src = src.replace(/<a\\b[^>]*>.*?<\\/a>/g, function(anchor){
      var idx=anchors.push(anchor)-1;
      return '\u0001'+idx+'\u0001';
    });
    src = src.replace(/(^|[\\s(])((?:https?:\\/\\/)[^\\s<]+)/g, function(_, lead, url){
      var trimmed=String(url||'').replace(/[),.!?:;]+$/,'');
      var tail=String(url||'').slice(trimmed.length);
      var safe=sanitizeUrl(trimmed);
      if(!safe) return lead+url;
      return lead+'<a href="'+escapeAttr(safe)+'" target="_blank" rel="noreferrer">'+trimmed+'</a>'+tail;
    });
    src = src.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
    src = src.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    src = src.replace(/(^|[\\s(])\\*([^*]+)\\*(?=[\\s).,!?:;]|$)/g, '$1<em>$2</em>');
    src = src.replace(/(^|[\\s(])_([^_]+)_(?=[\\s).,!?:;]|$)/g, '$1<em>$2</em>');
    src = src.replace(/\u0001(\\d+)\u0001/g, function(_, idx){ return anchors[Number(idx)] || ''; });
    src = src.replace(/\u0000(\\d+)\u0000/g, function(_, idx){ return codes[Number(idx)] || ''; });
    return src;
  }
  function isBlockStart(line){
    return /^(?:#{1,6}\\s|\x60\x60\x60|[-*_]{3,}\\s*$|>\\s?|\\d+\\.\\s+|[-+*]\\s+)/.test(line);
  }
  // A GFM table delimiter row: pipes separating cells of dashes (optional : align).
  function isTableDelim(line){
    var t=String(line||'').trim();
    if(t.indexOf('|')<0) return false;
    return /^\\|?\\s*:?-+:?\\s*(\\|\\s*:?-+:?\\s*)*\\|?\\s*$/.test(t);
  }
  // A table starts where a row of cells is immediately followed by a delimiter row.
  function isTableStart(lines, i){
    return i+1<lines.length && String(lines[i]||'').indexOf('|')>=0 && isTableDelim(lines[i+1]);
  }
  function splitRow(line){
    var t=String(line||'').trim().replace(/^\\|/,'').replace(/\\|\\s*$/,'');
    return t.split('|').map(function(c){ return c.trim(); });
  }
  function renderMarkdown(md){
    var lines=String(md||'').replace(/\\r/g,'').split('\\n');
    var out=[];
    var i=0;
    while(i<lines.length){
      var line=lines[i];
      if(!line.trim()){ i++; continue; }
      var fence=/^\x60\x60\x60([^\x60]*)\\s*$/.exec(line);
      if(fence){
        var lang=(fence[1]||'').trim();
        var code=[]; i++;
        while(i<lines.length && !/^\x60\x60\x60/.test(lines[i])){ code.push(lines[i]); i++; }
        if(i<lines.length) i++;
        out.push('<pre><code'+(lang?' class="lang-'+escapeAttr(lang)+'"':'')+'>'+escapeHtml(code.join('\\n'))+'</code></pre>');
        continue;
      }
      var heading=/^(#{1,6})\\s+(.*)$/.exec(line);
      if(heading){
        var level=Math.min(heading[1].length,6);
        out.push('<h'+level+'>'+parseInline(heading[2])+'</h'+level+'>');
        i++;
        continue;
      }
      if(/^[-*_]{3,}\\s*$/.test(line.trim())){ out.push('<hr>'); i++; continue; }
      if(/^>\\s?/.test(line)){
        var quote=[];
        while(i<lines.length && /^>\\s?/.test(lines[i])){ quote.push(lines[i].replace(/^>\\s?/,'')); i++; }
        out.push('<blockquote>'+renderMarkdown(quote.join('\\n'))+'</blockquote>');
        continue;
      }
      if(/^\\d+\\.\\s+/.test(line)){
        var ol=[];
        while(i<lines.length && /^\\d+\\.\\s+/.test(lines[i])){ ol.push(lines[i].replace(/^\\d+\\.\\s+/,'')); i++; }
        out.push('<ol>'+ol.map(function(item){ return '<li>'+parseInline(item)+'</li>'; }).join('')+'</ol>');
        continue;
      }
      if(/^[-+*]\\s+/.test(line)){
        var ul=[];
        while(i<lines.length && /^[-+*]\\s+/.test(lines[i])){ ul.push(lines[i].replace(/^[-+*]\\s+/,'')); i++; }
        out.push('<ul>'+ul.map(function(item){ return '<li>'+parseInline(item)+'</li>'; }).join('')+'</ul>');
        continue;
      }
      if(isTableStart(lines, i)){
        var header=splitRow(line);
        i+=2; // skip the header + delimiter rows
        var body=[];
        while(i<lines.length && lines[i].trim() && lines[i].indexOf('|')>=0 && !isTableDelim(lines[i])){
          body.push(splitRow(lines[i])); i++;
        }
        var cols=header.length;
        var thead='<thead><tr>'+header.map(function(c){ return '<th>'+parseInline(c)+'</th>'; }).join('')+'</tr></thead>';
        var tbody='<tbody>'+body.map(function(r){
          var cells='';
          for(var c=0;c<cols;c++){ cells+='<td>'+parseInline(r[c]||'')+'</td>'; }
          return '<tr>'+cells+'</tr>';
        }).join('')+'</tbody>';
        out.push('<table>'+thead+tbody+'</table>');
        continue;
      }
      var para=[];
      while(i<lines.length && lines[i].trim() && !isBlockStart(lines[i]) && !isTableStart(lines, i)){ para.push(lines[i]); i++; }
      out.push('<p>'+para.map(parseInline).join('<br>')+'</p>');
    }
    return out.join('');
  }
  function setBubbleText(bubble, text, markdown){
    if(!bubble) return;
    var raw=String(text||'');
    bubble.setAttribute('data-raw', raw);
    if(markdown){ bubble.innerHTML = renderMarkdown(raw); linkifyPaths(bubble); }
    else bubble.textContent = raw;
  }
  // A path-like token: absolute (/…, C:\\…, ~/…) or a relative path / bare filename
  // with a real extension. Deliberately liberal — clicks 404 server-side if the
  // file doesn't exist, so a false positive (e.g. "claude.ai") just does nothing.
  function pathRegex(){
    return /[A-Za-z]:\\\\[^\\s<>"']+|~\\/[^\\s<>"']+|\\/[\\w.\\-]+(?:\\/[\\w.\\-]+)*|[\\w.\\-]+(?:\\/[\\w.\\-]+)+|[\\w][\\w.\\-]*\\.[A-Za-z][A-Za-z0-9]{1,7}/g;
  }
  // Wrap file-path mentions in clickable spans. Walks text nodes only (never inside
  // <a>/<code>/<pre>), so code, links and the raw HTML are left untouched.
  function linkifyPaths(root){
    if(!root || typeof document.createTreeWalker!=='function') return;
    var walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node){
        for(var p=node.parentNode; p && p!==root; p=p.parentNode){
          var tag=p.nodeName;
          if(tag==='A'||tag==='CODE'||tag==='PRE') return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var targets=[], n;
    while((n=walker.nextNode())){ if(pathRegex().test(n.nodeValue)) targets.push(n); }
    targets.forEach(replacePathTextNode);
  }
  function replacePathTextNode(node){
    var text=node.nodeValue, re=pathRegex(), frag=document.createDocumentFragment(), last=0, m;
    while((m=re.exec(text))){
      var raw=m[0].replace(/[.,:;)\\]]+$/,''); // trailing sentence punctuation isn't part of the path
      if(raw.length<2) continue;
      var start=m.index, end=start+raw.length;
      if(start>last) frag.appendChild(document.createTextNode(text.slice(last,start)));
      var span=document.createElement('span');
      span.className='filepath';
      span.setAttribute('data-path', raw);
      span.title='Reveal in file manager';
      span.textContent=raw;
      frag.appendChild(span);
      last=end; re.lastIndex=end;
    }
    if(!last) return;
    if(last<text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  function openLocalPath(p, span){
    if(!p) return;
    var cwd=(cur&&cur.cwd)||'';
    fetch('/open?path='+encodeURIComponent(p)+'&cwd='+encodeURIComponent(cwd),{method:'POST'})
      .then(function(r){ return r.json(); })
      .then(function(res){
        if(res&&res.ok) return;
        if(span){ span.classList.add('badpath'); span.title=(res&&res.error)||'not found';
          setTimeout(function(){ span.classList.remove('badpath'); }, 1600); }
      })
      .catch(function(){});
  }
  document.addEventListener('click', function(ev){
    var t=ev.target && ev.target.closest ? ev.target.closest('.filepath') : ev.target;
    if(t&&t.classList&&t.classList.contains('filepath')){
      ev.preventDefault();
      openLocalPath(t.getAttribute('data-path'), t);
    }
  });
  // Snapshot the assistant blocks already on screen (from loaded history) so the
  // imminent buffer replay can be absorbed instead of duplicated. Empty bubbles
  // (e.g. the live "生成中…" placeholder) are ignored.
  function primeCatchup(){
    catchupCounts = {}; catchup = false;
    var msgs=byId('msgs'); if(!msgs) return;
    var bubbles=msgs.querySelectorAll('.msg.assistant .bubble');
    Array.prototype.forEach.call(bubbles, function(b){
      var raw=String(b.getAttribute('data-raw')||'');
      if(raw){ catchupCounts[raw]=(catchupCounts[raw]||0)+1; catchup=true; }
    });
  }
  function endCatchup(){ catchup=false; catchupCounts={}; }
  // True ⇒ this replayed assistant block is already shown by history; drop it.
  // The first block NOT in the snapshot is genuinely new content → end the window
  // so everything after it renders normally.
  function consumeCatchup(text){
    if(!catchup) return false;
    var key=String(text||'');
    if(catchupCounts[key]>0){ catchupCounts[key]--; return true; }
    endCatchup();
    return false;
  }
  function basename(p){ return String(p||'').split(/[\\\\/]/).filter(Boolean).pop() || String(p||''); }
  function hashText(s){
    var h=2166136261;
    s=String(s||'');
    for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
    return (h>>>0);
  }
  function projectTheme(name){ return PROJECT_COLORS[hashText(name)%PROJECT_COLORS.length]; }
  function styleTheme(node, theme){
    if(!node || !theme) return;
    node.style.color=theme.fg;
    node.style.backgroundColor=theme.bg;
    node.style.borderColor=theme.border;
  }
  function isAbsolutePathLike(p){ return /^(?:~\\/|\\/|[A-Za-z]:[\\\\/])/.test(String(p||'')); }
  function normalizePathish(p){ return String(p||'').replace(/\\\\/g,'/'); }
  function relativeToRoot(dir){
    var full=normalizePathish(dir).replace(/\\/+$/,'');
    for(var i=0;i<ROOTS.length;i++){
      var root=normalizePathish(ROOTS[i]).replace(/\\/+$/,'');
      if(!root) continue;
      if(full===root) return '.';
      if(full.indexOf(root+'/')===0) return full.slice(root.length+1);
    }
    return '';
  }
  function dirDisplayLabel(dir){
    var rel=relativeToRoot(dir);
    return rel || String(dir||'');
  }
  function vendorTheme(vendor){
    return vendor==='claude'
      ? { fg:'#c2410c', bg:'#fff7ed', border:'#fdba74' }
      : { fg:'#3730a3', bg:'#eef2ff', border:'#a5b4fc' };
  }
  function vendorBadge(vendor){
    return el('span','vtag '+vendor,vendor);
  }
  function projectBadge(project){
    var badge=el('span','ptag',project);
    styleTheme(badge, projectTheme(project));
    return badge;
  }
  function metaPatBadge(pattern){
    return el('span','pat '+pattern, pattern);
  }
  function tabTooltipMeta(s){
    var meta=[];
    if(s.score!=null) meta.push(priBadge(s,'b-pri'));
    if(s.etaMin!=null) meta.push(etaBadge(s,'b-eta'));
    if(s.pattern && s.pattern!=='unknown') meta.push(metaPatBadge(s.pattern));
    meta.push(vendorBadge(s.vendor));
    meta.push(projectBadge(s.project));
    meta.push(el('span','ptag', s.prompts+'p'));
    return meta;
  }
  function vendorChoices(q){
    var query=String(q||'').trim().toLowerCase();
    return VENDORS.filter(function(v){ return v && v.available && (!query || v.vendor.toLowerCase().indexOf(query)>=0); });
  }
  function saveNewPrefs(){
    try{ localStorage.setItem(NEW_PREFS_KEY, JSON.stringify(newPrefs)); }catch(e){}
  }
  function optionListWithCurrent(options, current){
    var list=(options||[]).slice();
    if(!current) return list;
    for(var i=0;i<list.length;i++) if(list[i].value===current) return list;
    list.splice(1, 0, { value:current, label:'custom: '+current });
    return list;
  }
  function populateSelect(id, options, current){
    var sel=byId(id); if(!sel) return;
    var list=optionListWithCurrent(options, current);
    sel.innerHTML='';
    list.forEach(function(opt){
      var node=document.createElement('option');
      node.value=opt.value;
      node.textContent=opt.label;
      sel.appendChild(node);
    });
    sel.value=current||'';
    if(sel.value!==String(current||'')) sel.value='';
  }
  function applyNewSessionPrefs(force){
    var vendor=((byId('nvendor')||{}).value||'').trim().toLowerCase();
    if(!vendorInfo(vendor)) return;
    if(!force && appliedNewVendor===vendor) return;
    var remembered=newPrefs[vendor] || {};
    var fallbackEffort = vendor==='codex' ? 'medium' : 'high';
    populateSelect('nmodel', NEW_MODEL_OPTIONS[vendor] || [{ value:'', label:'current CLI model' }], remembered.model || '');
    populateSelect('neffort', NEW_EFFORT_OPTIONS[vendor] || [], remembered.effort || fallbackEffort);
    appliedNewVendor=vendor;
  }
  function rememberNewSessionPrefs(vendor, model, effort){
    if(!vendor) return;
    newPrefs.vendor=vendor;
    newPrefs[vendor]={ model:model||'', effort:effort||'' };
    saveNewPrefs();
  }
  function selectedNewModel(){
    var sel=byId('nmodel');
    return sel && sel.value ? sel.value.trim() : '';
  }
  function selectedNewEffort(){
    var sel=byId('neffort');
    return sel && sel.value ? sel.value.trim().toLowerCase() : '';
  }
  function dirChoices(q){
    var query=String(q||'').trim().toLowerCase();
    return DIRS.filter(function(dir){
      if(!query) return true;
      var abs=String(dir||'').toLowerCase();
      var rel=dirDisplayLabel(dir).toLowerCase();
      return abs.indexOf(query)>=0 || rel.indexOf(query)>=0 || basename(dir).toLowerCase().indexOf(query)>=0;
    });
  }
  function setupVendorChooser(){
    var input=byId('nvendor'), drop=byId('nvendorSug');
    if(!input || !drop) return;
    var active=-1;
    function items(){ return drop.querySelectorAll('.chooser-opt'); }
    function hide(){ active=-1; drop.hidden=true; }
    function choose(vendor, keepOpenUntilClick){
      input.value=vendor||'';
      applyNewSessionPrefs(true);
      if(keepOpenUntilClick) window.setTimeout(hide, 0);
      else hide();
    }
    function render(open, query){
      var hits=vendorChoices(query==null ? input.value : query);
      drop.innerHTML='';
      hits.forEach(function(info){
        var opt=el('div','chooser-opt');
        opt.setAttribute('data-value', info.vendor);
        var line=el('div','chooser-opt-line');
        var label=el('div','chooser-opt-label', info.vendor);
        line.appendChild(label);
        if(info.chat===false) line.appendChild(el('span','chooser-opt-note','terminal'));
        opt.appendChild(line);
        opt.appendChild(el('div','chooser-opt-meta', info.chat===false ? 'opens a real terminal session' : 'starts in-browser chat'));
        opt.onmousedown=function(ev){ ev.preventDefault(); ev.stopPropagation(); choose(info.vendor, true); };
        opt.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); };
        drop.appendChild(opt);
      });
      if(!hits.length) drop.appendChild(el('div','chooser-empty','No available vendors'));
      drop.hidden = !open && !hits.length;
      if(open) drop.hidden=false;
      if(active>=items().length) active=items().length-1;
      Array.prototype.forEach.call(items(), function(node, idx){ node.classList.toggle('on', idx===active); });
    }
    input.addEventListener('click', function(ev){ ev.stopPropagation(); });
    input.addEventListener('focus', function(){ render(true, ''); });
    input.addEventListener('input', function(){ active=-1; render(true, input.value); });
    input.addEventListener('keydown', function(ev){
      if(isImeConfirming(ev)) return;
      var opts=items(), n=opts.length;
      if(ev.key==='ArrowDown'){ ev.preventDefault(); render(true, drop.hidden ? '' : input.value); opts=items(); n=opts.length; if(n){ active=(active+1)%n; Array.prototype.forEach.call(opts, function(node, idx){ node.classList.toggle('on', idx===active); }); } }
      else if(ev.key==='ArrowUp'){ ev.preventDefault(); render(true, drop.hidden ? '' : input.value); opts=items(); n=opts.length; if(n){ active=(active-1+n)%n; Array.prototype.forEach.call(opts, function(node, idx){ node.classList.toggle('on', idx===active); }); } }
      else if(ev.key==='Enter'){ var val=input.value.trim(); var info=vendorInfo(val); if(!val) return; if(n && active>=0 && opts[active]) choose(opts[active].getAttribute('data-value')); else if(info) choose(info.vendor); }
      else if(ev.key==='Escape'){ hide(); }
    });
    input.addEventListener('blur', function(){ var info=vendorInfo(input.value.trim()); if(info) choose(info.vendor); });
    drop.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
    drop.addEventListener('click', function(ev){ ev.stopPropagation(); });
    document.addEventListener('click', function(ev){ if(!byId('nvendorBox') || byId('nvendorBox').contains(ev.target)) return; hide(); });
    var remembered=vendorInfo(newPrefs.vendor);
    var first=remembered || vendorChoices('')[0];
    if(first) choose(first.vendor);
  }
  function setupDirChooser(){
    var input=byId('ndir'), drop=byId('ndirSug');
    if(!input || !drop) return;
    var active=-1;
    function items(){ return drop.querySelectorAll('.chooser-opt'); }
    function hide(){ active=-1; drop.hidden=true; }
    function choose(dir, keepOpenUntilClick){
      input.value=dir||'';
      if(keepOpenUntilClick) window.setTimeout(hide, 0);
      else hide();
    }
    function render(open, query){
      var hits=dirChoices(query==null ? input.value : query).slice(0, 16);
      drop.innerHTML='';
      hits.forEach(function(dir){
        var opt=el('div','chooser-opt');
        opt.setAttribute('data-value', dir);
        opt.appendChild(el('div','chooser-opt-label', dirDisplayLabel(dir)));
        opt.appendChild(el('div','chooser-opt-meta', dir));
        opt.onmousedown=function(ev){ ev.preventDefault(); ev.stopPropagation(); choose(dir, true); };
        opt.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); };
        drop.appendChild(opt);
      });
      if(!hits.length){
        var tip=isAbsolutePathLike(input.value) ? 'Press Enter to use this absolute path' : 'Press Enter to use this path; relative inputs resolve against your vault roots';
        drop.appendChild(el('div','chooser-empty', tip));
      }
      drop.hidden = !open && !hits.length;
      if(open) drop.hidden=false;
      if(active>=items().length) active=items().length-1;
      Array.prototype.forEach.call(items(), function(node, idx){ node.classList.toggle('on', idx===active); });
    }
    input.addEventListener('click', function(ev){ ev.stopPropagation(); });
    input.addEventListener('focus', function(){ render(true, ''); });
    input.addEventListener('input', function(){ active=-1; render(true, input.value); });
    input.addEventListener('keydown', function(ev){
      if(isImeConfirming(ev)) return;
      var opts=items(), n=opts.length;
      if(ev.key==='ArrowDown'){ ev.preventDefault(); render(true, drop.hidden ? '' : input.value); opts=items(); n=opts.length; if(n){ active=(active+1)%n; Array.prototype.forEach.call(opts, function(node, idx){ node.classList.toggle('on', idx===active); }); } }
      else if(ev.key==='ArrowUp'){ ev.preventDefault(); render(true, drop.hidden ? '' : input.value); opts=items(); n=opts.length; if(n){ active=(active-1+n)%n; Array.prototype.forEach.call(opts, function(node, idx){ node.classList.toggle('on', idx===active); }); } }
      else if(ev.key==='Enter' && n && active>=0 && opts[active]){ ev.preventDefault(); choose(opts[active].getAttribute('data-value')); }
      else if(ev.key==='Escape'){ hide(); }
    });
    drop.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
    drop.addEventListener('click', function(ev){ ev.stopPropagation(); });
    document.addEventListener('click', function(ev){ if(!byId('ndirBox') || byId('ndirBox').contains(ev.target)) return; hide(); });
    if(DIRS[0]) input.value=DIRS[0];
  }
  function tooltipRoot(){ return byId('tabtip'); }
  function hideTabTip(){
    var tip=tooltipRoot(); if(!tip) return;
    tip.classList.remove('show');
    tip.setAttribute('aria-hidden','true');
  }
  function positionTabTip(ev){
    var tip=tooltipRoot(); if(!tip) return;
    var pad=14;
    var tw=tip.offsetWidth || 320, th=tip.offsetHeight || 180;
    var x=ev.clientX + 16, y=ev.clientY + 18;
    if(x + tw > window.innerWidth - pad) x = window.innerWidth - tw - pad;
    if(y + th > window.innerHeight - pad) y = ev.clientY - th - 16;
    if(x < pad) x = pad;
    if(y < pad) y = pad;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  function showTabTip(s, ev){
    var tip=tooltipRoot(); if(!tip || !s) return;
    tip.innerHTML='';
    var card=el('div','tabtip-card');
    card.appendChild(el('div','tabtip-title', briefText(s)));
    var sub=el('div','tabtip-sub');
    if(s.title){
      var first=el('div','tabtip-line');
      first.innerHTML='<span class="k">First</span>'+escapeHtml(s.title);
      sub.appendChild(first);
    }
    if(s.lastPrompt && s.lastPrompt!==s.title){
      var latest=el('div','tabtip-line');
      latest.innerHTML='<span class="k">Latest</span>'+escapeHtml(s.lastPrompt);
      sub.appendChild(latest);
    }
    if(sub.childNodes.length) card.appendChild(sub);
    var meta=el('div','tabtip-meta');
    tabTooltipMeta(s).forEach(function(node){ meta.appendChild(node); });
    card.appendChild(meta);
    if(s.reason && s.reason!=='no signal'){
      var reason=el('div','tabtip-line');
      reason.innerHTML='<span class="k">Why</span>'+escapeHtml(s.reason);
      card.appendChild(reason);
    }
    if(s.tags && s.tags.length){
      var tags=el('div','tabtip-tags');
      s.tags.forEach(function(tag){ var chip=el('span','it-tag'); chip.appendChild(el('span',null,tag)); tags.appendChild(chip); });
      card.appendChild(tags);
    }
    var note=el('div','tabtip-note', [s.cwd||'', ageLabel(s)].filter(Boolean).join(' · '));
    if(note.textContent) card.appendChild(note);
    tip.appendChild(card);
    tip.setAttribute('aria-hidden','false');
    tip.classList.add('show');
    positionTabTip(ev);
  }
  function setNewPending(on, msg){
    newSessionPending = on;
    var btn=byId('nbtn'), vend=byId('nvendor'), model=byId('nmodel'), effort=byId('neffort'), dir=byId('ndir'), np=byId('np');
    if(btn){ btn.disabled=on; btn.textContent=on?'starting…':'start session ▸'; }
    if(vend) vend.disabled=on;
    if(model) model.disabled=on;
    if(effort) effort.disabled=on;
    if(dir) dir.disabled=on;
    if(np) np.disabled=on;
    if(msg!=null) byId('nmsg').textContent=msg;
  }
  function newBoxOpen(){ var box=byId('newbox'); return !!(box && box.classList.contains('open')); }
  function closeNewBox(){
    var box=byId('newbox'); if(box) box.classList.remove('open');
    var btn=byId('newToggle'); if(btn) btn.setAttribute('aria-expanded','false');
  }
  function openNewBox(){
    var box=byId('newbox'); if(box) box.classList.add('open');
    var btn=byId('newToggle'); if(btn) btn.setAttribute('aria-expanded','true');
  }
  function toggleNewBox(){ if(newBoxOpen()) closeNewBox(); else openNewBox(); }
  function closeGlobalTagEditor(){ globalTagEditing = false; renderTagFilters(); }
  function openGlobalTagEditor(){ globalTagEditing = true; renderTagFilters(); }
  function buildGlobalTagEditor(){
    var wrap=el('div','tagcreate-inline');
    var row=el('div','tagedit-row');
    var input=document.createElement('input');
    input.className='tagedit-input';
    input.id='tagInput';
    input.placeholder='tag name · Enter';
    var cancel=el('button','tagedit-cancel','✕');
    cancel.id='tagAddCancel';
    cancel.title='Close';
    row.appendChild(input);
    row.appendChild(cancel);
    wrap.appendChild(row);
    cancel.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); closeGlobalTagEditor(); };
    input.addEventListener('keydown', function(ev){
      if(isImeConfirming(ev)) return;
      if(ev.key==='Enter' && !ev.shiftKey){ ev.preventDefault(); addGlobalTag(); }
      else if(ev.key==='Escape'){ ev.preventDefault(); closeGlobalTagEditor(); }
    });
    setTimeout(function(){ try{ input.focus(); }catch(e){} }, 0);
    return wrap;
  }
  function renderTagFilters(){
    var wrap=byId('tagFilters'); if(!wrap) return; wrap.innerHTML='';
    var defs=filterTagDefs();
    if(!defs.length) wrap.appendChild(el('div','tagempty','No tags yet'));
    defs.forEach(function(def){
      var active=activeTags.indexOf(def.key)>=0;
      var chip=el('span','gtag'+(active?' on':'')+(def.kind!=='user'?' auto':''));
      var btn=el('button','gtagbtn',def.label);
      btn.title=def.title || 'Toggle filter';
      btn.onclick=function(ev){ ev.stopPropagation(); toggleFilterTag(def.key); };
      chip.appendChild(btn);
      if(def.deletable){
        var del=el('button','gtagdel','×');
        del.title='Delete this tag from every tab';
        del.onclick=function(ev){ ev.stopPropagation(); deleteGlobalTag(def.value); };
        chip.appendChild(del);
        styleFilterTagChip(chip, btn, del, def, active);
      } else {
        btn.title=def.title || ('Toggle '+def.label);
        styleFilterTagChip(chip, btn, null, def, active);
      }
      wrap.appendChild(chip);
    });
    if(globalTagEditing) wrap.appendChild(buildGlobalTagEditor());
    else {
      var add=el('button','tagadd-compact','+ tag');
      add.type='button';
      add.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); openGlobalTagEditor(); };
      wrap.appendChild(add);
    }
  }
  function setGlobalTags(tags){
    TAGS = Array.isArray(tags) ? tags.slice() : [];
    var available={};
    filterTagDefs().forEach(function(def){ available[def.key]=true; });
    activeTags = activeTags.filter(function(tag){ return !!available[tag]; });
    SESS.forEach(function(s){ if(Array.isArray(s.tags)) s.tags = s.tags.filter(function(tag){ return TAGS.indexOf(tag)>=0; }); });
    renderTagFilters();
    renderSidebar();
  }
  function addGlobalTag(){
    var inp=byId('tagInput'); if(!inp) return;
    var name=normalizeTag(inp.value);
    if(!name) return;
    fetch('/tags',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:name})})
      .then(function(r){return r.json();}).then(function(res){ if(!res.ok) return; inp.value=''; globalTagEditing = false; setGlobalTags(res.tags||[]); })
      .catch(function(){});
  }
  function deleteGlobalTag(tag){
    if(!tag) return;
    if(!window.confirm('Delete tag "'+tag+'" from all tabs?')) return;
    fetch('/tags?name='+encodeURIComponent(tag),{method:'DELETE'})
      .then(function(r){return r.json();}).then(function(res){ if(!res.ok) return; setGlobalTags(res.tags||[]); })
      .catch(function(){});
  }
  function toggleFilterTag(tag){
    var i=activeTags.indexOf(tag);
    if(i>=0) activeTags.splice(i,1);
    else activeTags.push(tag);
    renderTagFilters();
    renderSidebar();
  }
  function saveSessionTags(s, tags){
    if(!s || !s.sessionId) return;
    fetch('/session/tags?session='+encodeURIComponent(s.sessionId),
      {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tags:tags})})
      .then(function(r){return r.json();}).then(function(res){
        if(!res.ok) return;
        s.tags = res.sessionTags || [];
        setGlobalTags(res.tags || TAGS);
        if(cur && cur.sessionId===s.sessionId){ cur.tags = s.tags.slice(); syncOpenHeader(); }
      }).catch(function(){});
  }
  function removeSessionTag(s, tag){
    if(!s || !s.sessionId) return;
    saveSessionTags(s, (s.tags||[]).filter(function(x){ return x!==tag; }));
  }
  function addSessionTag(s, raw){
    if(!s || !s.sessionId) return;
    var tag=normalizeTag(raw);
    if(!tag) return;
    var next=(s.tags||[]).slice();
    if(next.indexOf(tag)<0) next.push(tag);
    editingTagSession = null;
    headerTagEditing = false;
    saveSessionTags(s, next);
  }
  // Per-tab tag editor with a custom (non-native) suggestion dropdown: filters the
  // existing global tags as you type, offers to create the typed one, and supports
  // ↑/↓ + Enter. Replaces the old <datalist>, whose popup couldn't be styled.
  function buildTagEditor(s){
    var assigned={};
    (s.tags||[]).forEach(function(t){ assigned[normalizeTag(t).toLowerCase()]=true; });
    var editor=el('div','tagedit');
    // Hovering the editor must not resurrect the tab's hover tooltip behind it.
    editor.onmouseenter=hideTabTip; editor.onmousemove=function(ev){ ev.stopPropagation(); };
    var row=el('div','tagedit-row');
    var input=document.createElement('input');
    input.className='tagedit-input';
    input.placeholder='tag name (pick below or type to create · Enter)';
    var cancel=el('button','tagedit-cancel');
    cancel.innerHTML='<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7"></path></svg>';
    cancel.title='Close (Esc)';
    row.appendChild(input); row.appendChild(cancel);
    var sug=el('div','tagsug'); sug.hidden=true;
    editor.appendChild(row); editor.appendChild(sug);
    var active=-1;
    function optEls(){ return sug.querySelectorAll('.tagsug-opt'); }
    function highlight(){ optEls().forEach(function(e,i){ e.classList.toggle('on', i===active); }); }
    function renderSug(){
      var q=normalizeTag(input.value).toLowerCase();
      var hits=TAGS.filter(function(t){
        var k=normalizeTag(t).toLowerCase();
        return !assigned[k] && (!q || k.indexOf(q)>=0);
      });
      sug.innerHTML='';
      hits.forEach(function(t){
        var opt=el('div','tagsug-opt',t);
        opt.setAttribute('data-val', t);
        opt.onmousedown=function(ev){ ev.preventDefault(); ev.stopPropagation(); addSessionTag(s, t); };
        sug.appendChild(opt);
      });
      var typed=normalizeTag(input.value);
      var exists=typed && TAGS.some(function(t){ return normalizeTag(t).toLowerCase()===typed.toLowerCase(); });
      if(typed && !exists && !assigned[typed.toLowerCase()]){
        var create=el('div','tagsug-opt tagsug-create');
        create.setAttribute('data-val', typed);
        create.appendChild(el('span','tagsug-new','new'));
        create.appendChild(el('span',null,typed));
        create.onmousedown=function(ev){ ev.preventDefault(); ev.stopPropagation(); addSessionTag(s, typed); };
        sug.appendChild(create);
      }
      var n=optEls().length;
      sug.hidden = n===0;
      if(active>=n) active=n-1;
      highlight();
    }
    function commit(){
      var els=optEls();
      if(active>=0 && els[active]){ addSessionTag(s, els[active].getAttribute('data-val')); return; }
      var typed=normalizeTag(input.value);
      if(typed) addSessionTag(s, typed);
    }
    input.onclick=function(ev){ ev.stopPropagation(); };
    input.oninput=function(){ active=-1; renderSug(); };
    input.onkeydown=function(ev){
      ev.stopPropagation();
      if(isImeConfirming(ev)) return;
      var n=optEls().length;
      if(ev.key==='ArrowDown'){ ev.preventDefault(); if(n){ active=(active+1)%n; highlight(); } }
      else if(ev.key==='ArrowUp'){ ev.preventDefault(); if(n){ active=(active-1+n)%n; highlight(); } }
      else if(ev.key==='Enter'){ ev.preventDefault(); commit(); }
      else if(ev.key==='Escape'){ ev.preventDefault(); editingTagSession=null; headerTagEditing=false; if(cur===s) syncOpenHeader(); renderSidebar(); }
    };
    cancel.onclick=function(ev){ ev.stopPropagation(); editingTagSession=null; headerTagEditing=false; if(cur===s) syncOpenHeader(); renderSidebar(); };
    setTimeout(renderSug, 0);
    return editor;
  }
  // Auto-scroll is "sticky": we only pull to the bottom while the user is already
  // there. If they scroll up to read mid-turn, streamed chunks must NOT yank them
  // back down — scroll(force=true) is reserved for the user's own actions (sending).
  var stick = true;
  function nearBottom(){ var m=byId('msgs'); if(!m) return true; return (m.scrollHeight - m.scrollTop - m.clientHeight) < 80; }
  function scroll(force){ var m=byId('msgs'); if(!m) return; if(force||stick){ m.scrollTop=m.scrollHeight; } }
  (function(){ var m=byId('msgs'); if(m) m.addEventListener('scroll', function(ev){ stick = nearBottom(); trackVisitScroll(ev); scheduleLatestPin(); }); })();
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
      if(b) b.textContent = 'Generating… '+s+'s'; };
    tick(); genTimer=setInterval(tick,1000);
    clearPh(); byId('msgs').appendChild(genEl); scroll();
  }
  function keepGenLast(){ if(genEl) byId('msgs').appendChild(genEl); }
  function clearGen(){ if(genTimer){ clearInterval(genTimer); genTimer=null; } if(genEl){ genEl.remove(); genEl=null; } }
  // The input stays typeable even mid-turn now — drafts queue instead of being
  // blocked — so this only swaps the placeholder hint and (optionally) refocuses.
  function setInputEnabled(on){ var i=byId('input'); if(!i) return; i.disabled=false;
    i.placeholder = on ? 'message'
                       : 'Generating… Enter queues your message';
    if(on){ try{ i.focus(); }catch(e){} } }
  function draftKey(s){ return s && s.sessionId ? String(s.sessionId) : ''; }
  function setDraftForSession(s, text){
    var key=draftKey(s);
    if(!key) return;
    var val=String(text||'');
    if(val) sessionDrafts[key]=val;
    else delete sessionDrafts[key];
  }
  function stashComposerDraft(s){
    var inp=byId('input');
    if(!inp || !s) return;
    setDraftForSession(s, inp.value);
  }
  function restoreComposerDraft(s){
    var inp=byId('input');
    if(!inp) return;
    var key=draftKey(s);
    inp.value = key && sessionDrafts[key] ? sessionDrafts[key] : '';
  }
  function stashQueueState(s){
    var key=draftKey(s);
    if(!key) return;
    if(pendingQueue.length) sessionQueues[key]=pendingQueue.map(cloneTurn);
    else delete sessionQueues[key];
    if(editingQueueIdx>=0) sessionQueueEditing[key]=editingQueueIdx;
    else delete sessionQueueEditing[key];
  }
  function restoreQueueState(s){
    var key=draftKey(s);
    pendingQueue = key && sessionQueues[key] ? sessionQueues[key].map(cloneTurn) : [];
    editingQueueIdx =
      key && sessionQueueEditing[key]!=null && sessionQueueEditing[key] < pendingQueue.length
        ? sessionQueueEditing[key]
        : -1;
  }
  function syncQueueState(){
    if(!cur) return;
    stashQueueState(cur);
  }
  function makeQueuedEditor(turn, i){
    var text=turnText(turn), atts=turnAttachments(turn);
    var box=el('div','qeditbox');
    var head=el('div','qedithead');
    head.appendChild(el('span','qtag','queued'));
    if(atts.length) head.appendChild(el('span','qtag', atts.length+' file'+(atts.length>1?'s':'')));
    var actions=el('div','qeditactions');
    var go=el('button','qeditgo', turnActive ? 'waiting' : 'send');
    go.disabled=!!turnActive;
    go.title=turnActive ? 'Stop the current turn first, then send this queued message' : 'Send this edited queued message now';
    var cancel=el('button','inline-edit-cancel','cancel');
    var del=el('button','qdel','delete');
    actions.appendChild(go); actions.appendChild(cancel); actions.appendChild(del);
    head.appendChild(actions);
    var ta=el('textarea','qeditta'); ta.value=String(text||'');
    ta.rows=Math.min(8, Math.max(2, String(text||'').split('\\n').length));
    box.appendChild(head); box.appendChild(ta);
    function closeEditor(){ editingQueueIdx=-1; syncQueueState(); renderQueue(); }
    function commit(sendNow){
      var next=ta.value.trim();
      if(!next){ delQueued(i); return; }
      pendingQueue[i]=Object.assign({}, pendingQueue[i], {text: next});
      editingQueueIdx=-1;
      syncQueueState();
      renderQueue();
      if(sendNow && !turnActive) sendQueued(i);
    }
    go.onclick=function(ev){ ev.stopPropagation(); commit(true); };
    cancel.onclick=function(ev){ ev.stopPropagation(); closeEditor(); };
    del.onclick=function(ev){ ev.stopPropagation(); delQueued(i); };
    box.onclick=function(ev){ ev.stopPropagation(); };
    ta.onkeydown=function(ev){ ev.stopPropagation();
      if(isImeConfirming(ev)) return;
      if(ev.key==='Enter' && !ev.shiftKey){ ev.preventDefault(); commit(true); }
      else if(ev.key==='Escape'){ ev.preventDefault(); closeEditor(); }
    };
    setTimeout(function(){ try{ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }catch(e){} }, 0);
    return box;
  }
  // The send button doubles as Stop while a turn is in flight.
  function updateSendLabel(){ var b=byId('send'); if(!b) return;
    b.textContent = turnActive ? '■ stop' : 'send';
    b.title = turnActive ? 'Stop the current generation (Esc)' : '';
    b.classList.toggle('stopping', turnActive); }
  function beginTurn(startedAt){
    stopRequested=false;
    endCatchup();
    reviveAttention(cur);
    turnActive=true;
    setInputEnabled(false);
    updateSendLabel();
    startGen(startedAt);
    markCurGenerating(true);
    refreshForkButton();
    renderQueue();
  }
  function endTurn(){ clearGen(); turnActive=false; setInputEnabled(true); updateSendLabel(); markCurGenerating(false); refreshForkButton(); }
  function markCurGenerating(on){ if(!cur) return; cur.generating=on; applyGenerating(cur); }
  // A turn finished: if it ended naturally, advance into the next queued draft.
  // If it ended because the user hit Stop, leave the queue parked for manual send.
  function turnEnded(){
    if(stopRequested){ stopRequested=false; endTurn(); renderQueue(); if(cur) refreshAnalysis(cur); }
    else if(pendingQueue.length){ var next=pendingQueue.shift(); syncQueueState(); renderQueue(); promoteAndSend(next); }
    else { endTurn(); if(cur) refreshAnalysis(cur); }
  }
  // Render the pinned "queued" list (above the composer). Each row: the text plus
  // a Send/Edit/Delete control set — Codex-style.
  function renderQueue(){
    var q=byId('queue'); if(!q) return; q.innerHTML='';
    pendingQueue.forEach(function(turn,i){
      var text=turnText(turn), atts=turnAttachments(turn), preview=turnPreview(turn);
      if(i===editingQueueIdx){
        var erow=el('div','qitem editing'); erow.appendChild(makeQueuedEditor(turn, i)); q.appendChild(erow);
        return;
      }
      var row=el('div','qitem');
      row.appendChild(el('span','qtag','queued'));
      if(atts.length) row.appendChild(el('span','qtag', atts.length+' file'+(atts.length>1?'s':'')));
      var tx=el('div','qtext',preview); tx.title=preview; row.appendChild(tx);
      var sb=el('button','qsend', turnActive ? 'waiting' : 'send');
      sb.disabled=!!turnActive;
      sb.title=turnActive ? 'Stop the current turn first, then send this queued message' : 'Send this queued message now';
      sb.onclick=function(){ sendQueued(i); };
      var eb=el('button','qedit','edit'); eb.onclick=function(){ editQueued(i); };
      var db=el('button','qdel','delete'); db.onclick=function(){ delQueued(i); };
      row.appendChild(sb); row.appendChild(eb); row.appendChild(db);
      q.appendChild(row);
    });
  }
  // Edit a queued draft in place (NOT back in the bottom composer, which may hold
  // an unrelated draft): the row becomes an inline textarea; saving updates the
  // queued item (empty → removes it), cancel leaves it untouched.
  function editQueued(i){ if(pendingQueue[i]==null) return; editingQueueIdx=i; syncQueueState(); renderQueue(); }
  function sendQueued(i){
    if(turnActive || pendingQueue[i]==null) return;
    var turn=pendingQueue.splice(i,1)[0];
    if(editingQueueIdx===i) editingQueueIdx=-1;
    else if(editingQueueIdx>i) editingQueueIdx--;
    syncQueueState(); renderQueue();
    promoteAndSend(turn);
  }
  function delQueued(i){ pendingQueue.splice(i,1); if(editingQueueIdx===i) editingQueueIdx=-1; syncQueueState(); renderQueue(); }
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
  function tagChip(def, removable, onRemove){
    var chip=el('span','it-tag'+(def&&def.kind!=='user'?' auto':''));
    chip.appendChild(el('span',null,def.label));
    styleSessionTagChip(chip, def);
    if(removable && onRemove){
      var rm=el('button',null,'×');
      rm.title='Remove tag';
      rm.onclick=function(ev){ ev.stopPropagation(); onRemove(); };
      chip.appendChild(rm);
    }
    return chip;
  }
  function renderHeaderTags(s){
    var wrap=byId('h-tags'); if(!wrap) return;
    wrap.innerHTML='';
    if(!s) return;
    var row=el('div','headtag-row');
    allTagDefsForSession(s).forEach(function(def){
      row.appendChild(tagChip(def, def.kind==='user' && !!(s.sessionId && !s.pendingFork), function(){ removeSessionTag(s, def.value); }));
    });
    if(s.sessionId && !s.pendingFork){
      var add=el('button','headtag-add','+ tag');
      add.type='button';
      add.onclick=function(ev){ ev.stopPropagation(); headerTagEditing = !headerTagEditing; editingTagSession=null; renderHeaderTags(s); renderSidebar(); };
      row.appendChild(add);
    }
    if(row.childNodes.length) wrap.appendChild(row);
    if(headerTagEditing && s.sessionId && !s.pendingFork){
      var editor=buildTagEditor(s);
      editor.classList.add('headtagedit');
      wrap.appendChild(editor);
      var input=editor.querySelector('input');
      if(input) setTimeout(function(){ try{ input.focus(); }catch(e){} }, 0);
    }
  }
  // The open header mirrors the full sidebar tab: priority · ETA (both click-to-edit)
  // · pattern · vendor · directory · prompts · age · reason.
  function headerSig(s){
    var sig=byId('h-sig'); if(!sig) return; sig.innerHTML='';
    if(s.score!=null) sig.appendChild(priBadge(s,'score'));
    if(s.etaMin!=null) sig.appendChild(etaBadge(s,'eta'));
    if(s.pattern && s.pattern!=='unknown') sig.appendChild(el('span','pat '+s.pattern, s.pattern));
    sig.appendChild(vendorBadge(s.vendor));               // 服务商
    var proj=projectBadge(s.project);                     // 目录 (basename; full cwd on hover)
    if(s.cwd) proj.title=s.cwd;
    sig.appendChild(proj);
    sig.appendChild(el('span','h-meta', (s.prompts||0)+'p'));  // prompts 数量
    var age=ageLabel(s);                                  // 时间
    if(age) sig.appendChild(el('span','h-meta', age));
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
    if(!s||!s.sessionId) return; // both Claude and Codex sessions get a daemon verdict
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

  function syncOpenHeader(){
    if(!cur) return;
    byId('h-title').textContent = briefText(cur);
    syncHeaderStatus(cur);
    var sub=byId('h-sub'); sub.innerHTML=''; sub.className='s';
    if(cur.title) sub.appendChild(el('div','sub-line','First · '+cur.title));
    if(cur.lastPrompt && cur.lastPrompt!==cur.title) sub.appendChild(el('div','sub-line','Latest · '+cur.lastPrompt));
    if(!sub.childNodes.length) sub.appendChild(el('div','sub-line', cur.vendor+' · '+(cur.cwd||'')));
    headerSig(cur);
    renderHeaderTags(cur);
    var rb=byId('refreshBtn');
    if(rb){ rb.disabled = !(cur && (cur.sessionId || cur.pendingFork)); }
  }
  function syncRefreshButton(){
    var rb=byId('refreshBtn');
    if(!rb) return;
    var enabled = !!(cur && (cur.sessionId || cur.pendingFork));
    rb.disabled = !enabled || refreshBusy;
    rb.classList.toggle('busy', !!refreshBusy);
    rb.title = refreshBusy ? 'refreshing chat…' : 'refresh this chat from transcript';
  }
  function setRefreshBusy(on){
    refreshBusy = !!on;
    syncRefreshButton();
  }
  function resetOpenHeader(){
    byId('h-title').textContent = 'Attend';
    var sub=byId('h-sub');
    if(sub){ sub.className='s'; sub.textContent='Select a session, or + new'; }
    var sig=byId('h-sig'); if(sig) sig.innerHTML='';
    var tags=byId('h-tags'); if(tags) tags.innerHTML='';
    syncHeaderStatus(null);
    refreshBusy = false;
    syncRefreshButton();
  }

  function noteUserTurn(s, text){
    if(!s || !text) return;
    s.lastPrompt = String(text);
    s.prompts = Math.max(0, Number(s.prompts||0)) + 1;
    s.lastTs = Date.now();
    s.ageDays = 0;
    if(cur===s) syncOpenHeader();
  }
  function hydrateSessionSource(s, opts){
    opts = opts || {};
    var force = !!opts.force;
    if(!s || !s.sessionId || s.pendingFork || s._resolvingSource) return Promise.resolve(s);
    if(s.file && !force) return Promise.resolve(s);
    s._resolvingSource = true;
    return fetch('/session/source?session='+encodeURIComponent(s.sessionId)+'&vendor='+encodeURIComponent(s.vendor||''))
      .then(function(r){ return r.json(); })
      .then(function(res){
        var found=res&&res.session;
        if(found){
          if(found.file) s.file = found.file;
          if(found.cwd) s.cwd = found.cwd;
          if(found.project) s.project = found.project;
          if(found.vendor) s.vendor = found.vendor;
          if(found.title && (!s.title || s.title==='(new session)')) s.title = found.title;
          if(found.lastPrompt) s.lastPrompt = found.lastPrompt;
          if(found.lastTs!=null) s.lastTs = found.lastTs;
          if(found.prompts!=null) s.prompts = found.prompts;
        }
        return s;
      })
      .catch(function(){ return s; })
      .finally(function(){ s._resolvingSource = false; });
  }
  function warmTranscriptCache(s){
    if(!s || !s.sessionId || s.pendingFork || s._warmingTranscript) return Promise.resolve();
    s._warmingTranscript = true;
    return hydrateSessionSource(s).then(function(found){
      if(!found || !found.file) return;
      return fetch('/chat/messages?file='+encodeURIComponent(found.file)+'&vendor='+encodeURIComponent(found.vendor||''))
        .then(function(r){ return r.json(); })
        .then(function(msgs){
          if(Array.isArray(msgs)) cacheTranscript(found, msgs);
        })
        .catch(function(){});
    }).catch(function(){})
      .finally(function(){ s._warmingTranscript = false; });
  }

  function sessionSortTs(s){ return s ? (s.sortTs!=null ? s.sortTs : s.lastTs) : null; }
  function sortSessions(){
    var mode=(byId('sort')||{}).value||'recent';
    if(mode==='priority'){ SESS.sort(function(a,b){ return (b.score||0)-(a.score||0); }); }
    // 'recent' = most-recent activity first, by precise timestamp (coarse ageDays
    // can't distinguish same-day sessions, so they'd never reorder on interaction).
    else { SESS.sort(function(a,b){ return (sessionSortTs(b)||0)-(sessionSortTs(a)||0); }); }
  }
  // Bump a session to the top on interaction (WeChat/Codex-style: the conversation
  // you just acted in floats up). No-op visually in 'priority' sort mode.
  function touchSession(s){ if(!s) return; s.sortTs=Date.now(); sortSessions(); renderSidebar(); }
  var titleEls={}; // sessionId -> .it-title node, so a late daemon brief can patch it in place
  var statusEls={}; // sessionId -> .it-status dot, so live generating state can patch in place
  var filterQ=''; // sidebar search query (matches brief / 首 / 新 / project / vendor / reason)
  function matchesFilter(s){
    if(activeTags.length){
      var tags=sessionTagKeys(s);
      var hit=false;
      for(var i=0;i<activeTags.length;i++){ if(tags.indexOf(activeTags[i])>=0){ hit=true; break; } }
      if(!hit) return false;
    }
    if(!filterQ) return true;
    var hay=[s.brief,s.title,s.lastPrompt,s.project,s.vendor,s.reason,s.cwd]
      .concat(allTagDefsForSession(s).map(function(def){ return def.label; }))
      .filter(Boolean).join(' ').toLowerCase();
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
  // Sidebar status dot — two orthogonal axes folded into one indicator:
  //   generating (pulse green) = a turn is running (not your turn)
  //   unread     (solid green) = a turn ended in the background            → "new, look at me"
  //   seen       (ring green)  = tracked / in progress                     → "still open"
  //   read       (gray)        = manually dismissed / parked
  // Key rule: sessions stay green until you explicitly click them gray. Opening,
  // replying, or a new run only changes *which* green state they're in.
  function attentionState(s){
    if(s&&s.unread) return 'unread';
    if(s&&s.seen) return 'seen';
    return 'read';
  }
  function setAttentionState(s, next, persist){
    if(!s) return;
    var prev=attentionState(s);
    s.unread = next==='unread';
    s.seen = next==='seen';
    applyGenerating(s);
    if(persist!==false && prev!==next) postSessionStatus(s, next);
  }
  function statusState(s){
    if(s&&s.generating) return 'generating';
    return attentionState(s);
  }
  function statusTitle(st){
    var base = st==='generating' ? 'generating'
      : st==='unread' ? 'new reply'
      : st==='seen' ? 'in progress'
      : 'read';
    if(st==='generating') return base;
    return base + (st==='read' ? ' · click to flag for follow-up' : ' · click to dismiss');
  }
  function applyGenerating(s){
    var d=s&&s.sessionId&&statusEls[s.sessionId]; if(!d) return;
    var st=statusState(s);
    d.className='it-status '+st;
    d.title=statusTitle(st);
    if(cur && s && cur.sessionId===s.sessionId) syncHeaderStatus(s);
  }
  function syncHeaderStatus(s){
    var dot=byId('h-status'); if(!dot) return;
    var st=s ? statusState(s) : 'read';
    dot.className='headstatus '+st;
    dot.title=statusTitle(st);
    dot.onclick = null;
    if(s && s.sessionId && !s.pendingFork){
      dot.onclick=function(ev){ ev.stopPropagation(); toggleStatus(s); };
    }
  }
  // Open/view: demote a bright unread to the hollow "seen" ring (you've laid eyes on
  // it but it still stays in-progress. force=true means a turn just ended in the
  // session you're viewing → set seen directly. A gray (read) session opened without
  // force stays gray.
  function markSeen(s, force){
    if(!s) return;
    if(force) setAttentionState(s, 'seen');
    else if(s.unread) setAttentionState(s, 'seen');
  }
  // A background turn ended: bright green, unseen (a fresh turn supersedes any prior seen).
  function markUnread(s){
    setAttentionState(s, 'unread');
  }
  // A fresh turn re-opens a previously dismissed session. Gray is only sticky
  // until the next real activity; after that, only another explicit dot-click
  // can park it again.
  function reviveAttention(s){
    if(!s) return;
    if(attentionState(s)==='read') setAttentionState(s, 'seen');
  }
  // You advanced the conversation (sent / answered): keep it tracked as an open
  // session until you explicitly dismiss it to gray.
  function markReplied(s){
    setAttentionState(s, 'seen');
  }
  // Manual override of the attention dot, by clicking it: dismiss a green session
  // (parked / not actionable — doesn't need you) → gray and delete its persisted
  // unfinished marker, or re-flag a gray one for follow-up → hollow green.
  // Reversible; a later turn-end still re-arms green.
  // No-op mid-turn — the pulse isn't a state you can toggle.
  function toggleStatus(s){
    if(!s || s.generating) return;
    if(s.unread || s.seen) setAttentionState(s, 'read'); // dismiss → read
    else setAttentionState(s, 'seen');                   // flag → seen
  }
  function renderSidebar(){
    var list=byId('list'); list.innerHTML=''; titleEls={}; statusEls={};
    var shown=0;
    SESS.forEach(function(s){
      if(!matchesFilter(s)) return;
      shown++;
      var taggable=!!(s.sessionId && !s.pendingFork);
      var item=el('div','item'+(cur&&cur.sessionId===s.sessionId?' active':''));
      // title row: a live-status dot + the daemon's brief (falls back to first prompt)
      var trow=el('div','it-titlerow');
      var st=statusState(s);
      var dot=el('span','it-status '+st);
      dot.title=statusTitle(st);
      if(s.sessionId) statusEls[s.sessionId]=dot;
      // click the dot to dismiss (green→gray) or re-flag (gray→green) without opening
      // the session — stopPropagation keeps the row's own open handler from firing.
      if(s.sessionId && !s.pendingFork){
        dot.onclick=function(ev){ ev.stopPropagation(); toggleStatus(s); };
      }
      trow.appendChild(dot);
      var t=el('div','it-title', briefText(s));
      if(!s.brief) t.classList.add('pending');
      if(s.sessionId) titleEls[s.sessionId]=t;
      trow.appendChild(t);
      // age sits at the right of the title row (not the meta row, where it gets
      // pushed off / truncated). it-title is flex:1 so this floats to the edge.
      var age=ageLabel(s);
      if(age) trow.appendChild(el('span','it-age', age));
      item.appendChild(trow);
      // two subtitles: my first message, then my latest message
      if(s.title) item.appendChild(el('div','it-firstline', 'First · '+s.title));
      if(s.lastPrompt && s.lastPrompt!==s.title) item.appendChild(el('div','it-firstline', 'Latest · '+s.lastPrompt));
      // badges: enough to judge without opening — priority, ETA, pattern, then context
      var meta=el('div','it-meta');
      if(s.score!=null) meta.appendChild(priBadge(s,'b-pri'));
      if(s.etaMin!=null) meta.appendChild(etaBadge(s,'b-eta'));
      if(s.pattern && s.pattern!=='unknown') meta.appendChild(el('span','pat '+s.pattern, s.pattern));
      meta.appendChild(vendorBadge(s.vendor));
      meta.appendChild(projectBadge(s.project));
      var ctx=s.prompts+'p';
      meta.appendChild(el('span','b-ctx', ctx));
      item.appendChild(meta);
      if((s.tags&&s.tags.length) || taggable){
        var tagrow=el('div','it-tags');
        (s.tags||[]).forEach(function(tag){
          var chip=el('span','it-tag');
          chip.appendChild(el('span',null,tag));
          if(taggable){
            var rm=el('button',null,'×');
            rm.title='Remove tag';
            rm.onclick=function(ev){ ev.stopPropagation(); removeSessionTag(s, tag); };
            chip.appendChild(rm);
          }
          tagrow.appendChild(chip);
        });
        if(taggable){
          var add=el('button','it-tagadd','+ tag');
          add.onclick=function(ev){ ev.stopPropagation(); hideTabTip(); headerTagEditing=false; editingTagSession = editingTagSession===s.sessionId ? null : s.sessionId; if(cur===s) syncOpenHeader(); renderSidebar(); };
          tagrow.appendChild(add);
        }
        item.appendChild(tagrow);
      }
      if(taggable && editingTagSession===s.sessionId){
        item.appendChild(buildTagEditor(s));
      }
      // reason is intentionally not shown on the tab (it still appears in the chat
      // header when the session is open); the tooltip mirrors the tab.
      // Tabs truncate (brief / 首 / 新 / context can each overflow one line), so the
      // hover tooltip is the complete, untruncated view of everything on the tab.
      var tip=['▎'+briefText(s)];
      if(s.title) tip.push('First · '+s.title);
      if(s.lastPrompt && s.lastPrompt!==s.title) tip.push('Latest · '+s.lastPrompt);
      var sig=[]; if(s.score!=null) sig.push('priority '+Number(s.score).toFixed(1));
      if(s.etaMin!=null) sig.push('~'+s.etaMin+'m');
      if(s.pattern && s.pattern!=='unknown') sig.push(s.pattern);
      sig.push(s.vendor); sig.push(s.project); sig.push(ctx); if(age) sig.push(age); tip.push(sig.join(' · '));
      if(s.tags && s.tags.length) tip.push('tags · '+s.tags.join(', '));
      item.removeAttribute('title');
      // While this tab's tag editor is open, suppress its hover tooltip entirely —
      // otherwise the detail card pops up over the suggestion dropdown.
      if(!(taggable && editingTagSession===s.sessionId)){
        item.onmouseenter=function(ev){ showTabTip(s, ev); };
        item.onmousemove=function(ev){ positionTabTip(ev); };
      }
      item.onmouseleave=hideTabTip;
      item.onclick=function(){ select(s); };
      list.appendChild(item);
    });
    if(shown===0){
      var empty=el('div','empty');
      empty.textContent=(filterQ||activeTags.length)
        ? ('No matches'+(filterQ?(' for “'+filterQ+'”'):'')+(activeTags.length?(' · tags: '+activeTagLabels().join(', ')):''))
        : 'No sessions yet';
      list.appendChild(empty);
    }
    if(editingTagSession){
      var activeInput=list.querySelector('.tagedit input');
      if(activeInput) setTimeout(function(){ try{ activeInput.focus(); }catch(e){} }, 0);
    }
  }
  function setForkEnabled(on, title){
    var b=byId('forkBtn'); if(!b) return; b.disabled=!on; if(title!=null) b.title=title;
  }
  // Can the *currently open* session be forked? In-browser fork is Claude/Codex
  // only and needs a real (non-pending) session. Forking mid-generation is allowed
  // — the fork just snapshots the transcript as it currently stands.
  function canForkCur(){
    return !!(cur && cur.sessionId && (cur.vendor==='claude'||cur.vendor==='codex') && !cur.pendingFork);
  }
  function refreshForkButton(){
    var ok=canForkCur();
    setForkEnabled(ok, ok ? 'branch this session into a fork' : 'select a session to split');
  }
  // A small in-place editor (textarea + save/cancel) reused by the sent-message
  // edit and the queued-message edit. Enter saves, Shift+Enter newlines, Esc cancels.
  function makeInlineEditor(text, onCommit, onCancel){
    var box=el('div','inline-edit');
    var ta=el('textarea','inline-edit-ta'); ta.value=String(text||'');
    ta.rows=Math.min(8, Math.max(1, String(text||'').split('\\n').length));
    var bar=el('div','inline-edit-bar');
    var save=el('button','inline-edit-save','save ▸');
    var cancel=el('button','inline-edit-cancel','cancel');
    bar.appendChild(save); bar.appendChild(cancel);
    box.appendChild(ta); box.appendChild(bar);
    function commit(){ onCommit(ta.value.trim()); }
    save.onclick=function(ev){ ev.stopPropagation(); commit(); };
    cancel.onclick=function(ev){ ev.stopPropagation(); onCancel(); };
    box.onclick=function(ev){ ev.stopPropagation(); };
    ta.onkeydown=function(ev){ ev.stopPropagation();
      if(isImeConfirming(ev)) return;
      if(ev.key==='Enter' && !ev.shiftKey){ ev.preventDefault(); commit(); }
      else if(ev.key==='Escape'){ ev.preventDefault(); onCancel(); }
    };
    setTimeout(function(){ try{ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }catch(e){} }, 0);
    return box;
  }
  // Edit a message you already sent, then resubmit it as a fresh turn — no detour
  // through the bottom composer. Saving replaces this bubble's text, drops anything
  // that came after it (the interrupted/old reply), and dispatches the new turn.
  // (Backend history isn't rewound — a reload shows the full record — but the live
  // view matches what the agent now acts on.)
  function editSentMessage(msgEl, bubble){
    if(turnActive || !cur || !cur.sessionId || cur.pendingFork) return;
    if(msgEl.classList.contains('editing')) return;
    var raw=bubble.getAttribute('data-raw') || bubble.textContent || '';
    msgEl.classList.add('editing');
    var editor=makeInlineEditor(raw, function(v){
      msgEl.classList.remove('editing');
      if(!v){ editor.replaceWith(bubble); return; } // empty → just cancel, don't send
      editor.replaceWith(bubble);
      setBubbleText(bubble, v, true);
      // drop everything after this message (interrupted partial reply / later turns)
      while(msgEl.nextSibling) msgEl.parentNode.removeChild(msgEl.nextSibling);
      latestUserMsgEl=msgEl;
      rememberPendingUserMsg(cur.sessionId, v);
      markVisitSend();
      noteUserTurn(cur, v);
      cacheTranscriptUserMsg(cur, v);
      dispatchSend({ text:v, attachments:[] }, v); // reuses this bubble; dispatchSend adds none
    }, function(){
      msgEl.classList.remove('editing');
      editor.replaceWith(bubble);
    });
    bubble.replaceWith(editor);
  }
  function addMsg(role, text, markdown){
    clearPh();
    var m=el('div','msg '+role);
    var b=el('div','bubble');
    setBubbleText(b, text||'', markdown!==false && (role==='user' || role==='assistant'));
    // A user message can be edited & resent in place (hover to reveal the ✎).
    // Deliberately NOT routed through the bottom composer — that may hold an
    // unrelated draft — so the edit happens right on the bubble (Codex-style).
    if(role==='user'){
      var eb=el('button','msg-edit','✎'); eb.title='Edit & resend this message';
      eb.onclick=function(ev){ ev.stopPropagation(); editSentMessage(m, b); };
      m.appendChild(eb);
    }
    m.appendChild(b);
    var target=renderTarget || byId('msgs');
    target.appendChild(m);
    if(role==='user' && !renderTarget) latestUserMsgEl = m;
    if(!suppressScroll){
      keepGenLast();
      scroll(role==='user');
      scheduleLatestPin();
    }
    return m;
  }
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
  function parseApplyPatch(input){
    if(typeof input!=='string') return null;
    var raw=String(input||'');
    if(raw.indexOf('*** Begin Patch')<0) return null;
    var lines=raw.replace(/\\r/g,'').split('\\n');
    var files=[], cur=null;
    function pushCur(){ if(cur) files.push(cur); cur=null; }
    function ensureCur(){
      if(cur) return cur;
      cur={title:'Patch', meta:[], rows:[]};
      return cur;
    }
    for(var i=0;i<lines.length;i++){
      var line=lines[i];
      if(!line || line==='*** Begin Patch' || line==='*** End Patch') continue;
      if(line.indexOf('*** Add File: ')===0){
        pushCur();
        cur={title:line.slice(14), meta:['new file'], rows:[]};
        continue;
      }
      if(line.indexOf('*** Delete File: ')===0){
        pushCur();
        cur={title:line.slice(17), meta:['deleted file'], rows:[{t:'-',s:'(file deleted)'}]};
        continue;
      }
      if(line.indexOf('*** Update File: ')===0){
        pushCur();
        cur={title:line.slice(17), meta:['updated file'], rows:[]};
        continue;
      }
      if(line.indexOf('*** Move to: ')===0){
        ensureCur().meta.push('move to '+line.slice(13));
        continue;
      }
      if(line==='*** End of File'){
        ensureCur().meta.push('end of file');
        continue;
      }
      if(line.indexOf('@@')===0){
        ensureCur().rows.push({t:'@',s:line});
        continue;
      }
      var sign=line.charAt(0);
      if(sign==='+'||sign==='-'||sign===' '){
        ensureCur().rows.push({t:sign,s:line.slice(1)});
        continue;
      }
      ensureCur().rows.push({t:'@',s:line});
    }
    pushCur();
    return files.length ? files : null;
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
  function renderApplyPatch(files){
    var wrap=el('div','diff');
    files.forEach(function(file, idx){
      if(idx>0) wrap.appendChild(el('div','diff-sep'));
      var head=el('div','diff-file');
      head.appendChild(el('div','diff-file-title', file.title||'Patch'));
      if(file.meta && file.meta.length) head.appendChild(el('div','diff-file-meta', file.meta.join(' · ')));
      wrap.appendChild(head);
      (file.rows||[]).forEach(function(r){
        var cls = r.t==='+' ? 'add' : r.t==='-' ? 'del' : r.t==='@' ? 'meta' : 'ctx';
        var sign = r.t==='@' ? '@' : r.t;
        var row=el('div','dline '+cls);
        row.appendChild(el('span','dsign', sign));
        row.appendChild(el('span','dtext', r.s));
        wrap.appendChild(row);
      });
    });
    return wrap;
  }
  // Structured/interactive tool calls (todos, plans, questions) render as real UI
  // rather than raw JSON. Covers Claude's TodoWrite / ExitPlanMode / AskUserQuestion
  // and Codex's update_plan (its plan/todo tool). Returns {label, el} or null.
  function statusIcon(st){
    if(st==='completed'||st==='done') return {ic:'✔', cls:'done'};
    if(st==='in_progress'||st==='doing') return {ic:'▸', cls:'doing'};
    return {ic:'○', cls:'todo'};
  }
  function renderTodos(items, explanation){
    var wrap=el('div','rt');
    if(explanation) wrap.appendChild(el('div','rt-note', explanation));
    var done=0;
    items.forEach(function(t){
      var st=t.status||'pending';
      if(st==='completed'||st==='done') done++;
      var si=statusIcon(st);
      var row=el('div','todo-row '+si.cls);
      row.appendChild(el('span','todo-ic', si.ic));
      row.appendChild(el('span','todo-tx', (st==='in_progress'&&t.activeForm)?t.activeForm:(t.content||t.step||'')));
      wrap.appendChild(row);
    });
    return {label:'✓ Todos — '+done+'/'+items.length, el:wrap};
  }
  function questionAnswerSummary(qs, answers){
    var pairs=[];
    qs.forEach(function(q){
      if(answers[q.question]) pairs.push('"'+q.question+'"="'+answers[q.question]+'"');
    });
    return 'Your questions have been answered: '+pairs.join('. ') + '. You can now continue with these answers in mind.';
  }
  function collectQuestionAnswers(root, qs){
    var answers={}, freeform=[];
    for(var i=0;i<qs.length;i++){
      var q=qs[i], vals=[];
      var picks=root.querySelectorAll('input.q-pick[data-qindex="'+i+'"]:checked');
      for(var j=0;j<picks.length;j++){ if(picks[j].value) vals.push(picks[j].value); }
      var other=root.querySelector('.q-free[data-qindex="'+i+'"]');
      var typed=other&&other.value ? other.value.trim() : '';
      if(typed){ vals.push(typed); freeform.push(typed); }
      if(!vals.length) return {ok:false, error:'Please answer every question before submitting.'};
      answers[q.question]=q.multiSelect ? vals.join(', ') : vals[0];
    }
    return {ok:true, answers:answers, response:freeform.length ? freeform.join('\\n') : undefined};
  }
  function setQuestionBusy(root, on, label){
    root.classList.toggle('busy', !!on);
    var controls=root.querySelectorAll('input, button');
    for(var i=0;i<controls.length;i++) controls[i].disabled=!!on;
    var submit=root.querySelector('.q-submit');
    if(submit) submit.textContent=label || 'submit answer';
  }
  function submitQuestionAnswer(toolId, qs, root){
    if(!cur || !cur.sessionId) return;
    var picked=collectQuestionAnswers(root, qs);
    var err=root.querySelector('.q-err');
    if(err) err.textContent='';
    if(!picked.ok){
      if(err) err.textContent=picked.error;
      return;
    }
    var toolUseResult={questions:qs.map(function(q){
      return {
        question:q.question||'',
        header:q.header||'Question',
        options:Array.isArray(q.options)?q.options:[],
        multiSelect:!!q.multiSelect
      };
    }), answers:picked.answers};
    if(picked.response) toolUseResult.response=picked.response;
    setQuestionBusy(root, true, 'submitting…');
    markReplied(cur); // answering keeps the session in-progress until you dismiss it
    beginTurn();
    touchSession(cur);
    fetch('/chat/answer?session='+encodeURIComponent(cur.sessionId)+'&cwd='+encodeURIComponent(cur.cwd||'')+'&vendor='+encodeURIComponent(cur.vendor||'claude'),{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        toolUseId:toolId,
        text:questionAnswerSummary(qs, picked.answers),
        toolUseResult:toolUseResult
      })
    }).then(function(r){ return r.json(); }).then(function(res){
      if(res.ok){ if(!es) openStream(cur.sessionId, cur.vendor||'claude'); }
      else {
        if(err) err.textContent=res.error||'answer failed';
        setQuestionBusy(root, false, 'submit answer');
        endTurn();
      }
    }).catch(function(e){
      if(err) err.textContent='network error: '+(e&&e.message?e.message:e);
      setQuestionBusy(root, false, 'submit answer');
      endTurn();
    });
  }
  function renderQuestions(qs, meta){
    var wrap=el('div','rq');
    qs.forEach(function(q, qi){
      var card=el('div','q-card');
      if(q.header||q.multiSelect) card.appendChild(el('div','q-head', (q.header||'Question')+(q.multiSelect?' · multi-select':'')));
      if(q.question) card.appendChild(el('div','q-text', q.question));
      (q.options||[]).forEach(function(o){
        var row=el('label','q-opt q-choice');
        var pick=document.createElement('input');
        pick.className='q-pick';
        pick.type=q.multiSelect ? 'checkbox' : 'radio';
        pick.name='qpick-'+qi;
        pick.value=o.label||'';
        pick.setAttribute('data-qindex', String(qi));
        row.appendChild(pick);
        var body=el('span','q-choice-body');
        body.appendChild(el('span','q-opt-label', o.label||''));
        if(o.description) body.appendChild(el('span','q-opt-desc', o.description));
        row.appendChild(body);
        card.appendChild(row);
      });
      if(meta && meta.id && !meta.result){
        var other=document.createElement('input');
        other.className='q-free';
        other.placeholder='Or type your own answer';
        other.setAttribute('data-qindex', String(qi));
        card.appendChild(other);
      }
      wrap.appendChild(card);
    });
    if(meta && meta.id && !meta.result){
      var actions=el('div','q-actions');
      var submit=el('button','q-submit','submit answer');
      submit.type='button';
      submit.onclick=function(){ submitQuestionAnswer(meta.id, qs, wrap); };
      actions.appendChild(submit);
      actions.appendChild(el('div','q-err'));
      wrap.appendChild(actions);
    }
    return {label:'❓ '+(qs.length>1?(qs.length+' questions'):'Question'), el:wrap};
  }
  function renderPlan(plan){
    var wrap=el('div','rplan'); wrap.textContent=String(plan);
    return {label:'📋 Plan', el:wrap};
  }
  function richTool(name, input, meta){
    if(!input||typeof input!=='object') return null;
    if(name==='TodoWrite' && Array.isArray(input.todos)) return renderTodos(input.todos);
    if(name==='update_plan' && Array.isArray(input.plan)) return renderTodos(input.plan, input.explanation);
    if(name==='AskUserQuestion' && Array.isArray(input.questions)) return renderQuestions(input.questions, meta);
    if((name==='ExitPlanMode'||name==='exit_plan_mode') && input.plan!=null) return renderPlan(input.plan);
    return null;
  }
  function lockQuestionTool(d){
    if(!d) return;
    var body=d.querySelector('.rq');
    if(body) setQuestionBusy(body, true, 'answered');
  }
  // tc = { id?, name, input, result?, isError? }
  function addTool(tc){
    if(tc.id && toolEls[tc.id]) return toolEls[tc.id];
    clearPh();
    var d=el('details','toolc');
    if(tc.id) d.setAttribute('data-tool-id', tc.id);
    var autoExpandPatch = tc.name==='apply_patch' && typeof tc.input==='string' && !!tc.input.trim();
    var parsedPatch = autoExpandPatch ? parseApplyPatch(tc.input) : null;
    // Interactive tools (todos / plan / questions) get a rich body, expanded;
    // Edit-family tools render as a git-style diff; everything else collapses to JSON.
    var rich=richTool(tc.name, tc.input, tc);
    if(rich){
      d.appendChild(el('summary',null, rich.label));
      d.open=true; d.appendChild(rich.el);
    } else {
      var prev=toolPreview(tc.name, tc.input);
      d.appendChild(el('summary',null,'⚙ '+tc.name+(prev?(' — '+prev):'')));
      var diff=editsFromInput(tc.name, tc.input);
      if(diff){
        d.open=true;
        d.appendChild(renderDiff(diff));
      } else if(parsedPatch){
        d.open=true;
        d.appendChild(renderApplyPatch(parsedPatch));
      } else if(tc.input!=null && !(typeof tc.input==='object' && Object.keys(tc.input).length===0)){
        if(autoExpandPatch) d.open=true;
        d.appendChild(el('pre','tool-in', fmt(tc.input)));
      }
    }
    var out=el('pre','tool-out'+(tc.isError?' err':''));
    if(tc.result!=null && tc.result!==''){ out.textContent=String(tc.result).slice(0,8000); } else { out.style.display='none'; }
    d.appendChild(out);
    if(tc.name==='AskUserQuestion' && tc.result) lockQuestionTool(d);
    var target=renderTarget || byId('msgs');
    target.appendChild(d);
    if(tc.id) toolEls[tc.id]=d;
    if(!suppressScroll){ keepGenLast(); scroll(); scheduleLatestPin(); }
    return d;
  }

  function select(s, opts){
    opts = opts || {};
    var isRefresh = !!opts.refresh;
    if(!isRefresh && refreshBusy) setRefreshBusy(false);
    hideTabTip();
    flushVisit(false);
    stashComposerDraft(cur);
    stashAttachmentState(cur);
    stashQueueState(cur);
    cur=s; editingTagSession=null; headerTagEditing=false; markSeen(s); renderSidebar();
    document.body.classList.add('show-chat'); // mobile: slide to the chat page (no-op on desktop)
    // top mirrors the tab: brief as title, my first + latest message as subtitles
    // — each on its own line (like the sidebar tab).
    syncOpenHeader();
    // in-browser fork works for Claude + Codex; gated to a settled turn (see
    // refreshForkButton — forking mid-generation corrupts both parent and branch).
    refreshForkButton();
    stick=true; assistantEl=null; toolEls={}; endCatchup(); restoreQueueState(s); renderQueue();
    hideLatestPin(); latestUserMsgEl=null;
    restoreComposerDraft(s);
    restoreAttachmentState(s);
    var cached=cachedTranscriptFor(s);
    if(cached) renderPersistedAndPending(cached, s.sessionId);
    else {
      var loading=el('div','placeholder','Loading…'); loading.id='ph'; replaceMessages(loading);
    }
    if(es){ es.close(); es=null; }
    clearGen(); turnActive=false; setInputEnabled(true); updateSendLabel();
    if(s.pendingFork){
      var parent=findSessionById(s.pendingFork.parent) || {
        sessionId:s.pendingFork.parent,
        vendor:s.vendor||'claude',
        cwd:s.pendingFork.cwd||'',
        file:''
      };
      hydrateSessionSource(parent).then(function(){
        if(parent.file){
          fetch('/chat/messages?file='+encodeURIComponent(parent.file)+'&vendor='+encodeURIComponent(parent.vendor||s.vendor||'')).then(function(r){return r.json();}).then(function(msgs){
            cacheTranscript(parent, msgs);
            renderPersistedAndPending(msgs, null);
            addMsg('assistant','(forked — type your next message to continue this branch in a new direction)');
            if(cur===s) beginVisit(s);
            if(isRefresh) setRefreshBusy(false);
          }).catch(function(){
            var fallback=cachedTranscriptFor(parent) || [];
            renderPersistedAndPending(fallback, null);
            addMsg('assistant','(forked — type your next message to continue this branch in a new direction)');
            if(cur===s) beginVisit(s);
            if(isRefresh) setRefreshBusy(false);
          });
        } else {
          renderPersistedAndPending(cachedTranscriptFor(parent) || [], null);
          addMsg('assistant','(forked — type your next message to continue this branch in a new direction)');
          if(cur===s) beginVisit(s);
          if(isRefresh) setRefreshBusy(false);
        }
        if(cur===s) syncOpenHeader();
      }).catch(function(){ if(isRefresh) setRefreshBusy(false); });
      return;
    }
    // Always (re)attach to the live stream after loading history: if a turn is
    // generating server-side (e.g. you just refreshed mid-turn), the engine
    // replays its buffer and a 'sync' event restores the 生成中… state — no more
    // manual refreshing. If nothing is live the stream just idles harmlessly.
    var startLive=function(){
      if(s.sessionId && (s.vendor==='claude'||s.vendor==='codex')){
        openStream(s.sessionId, s.vendor);
        syncCurrentLiveState(s);
      }
    };
    var finishRefresh=function(){ if(isRefresh) setRefreshBusy(false); };
    var fetchHistory=function(sourceRetried){
      if(!s.file){
        if(!cached) renderSessionHistory(s, []);
        startLive();
        if(cur===s) beginVisit(s);
        finishRefresh();
        return;
      }
      var boundFile=s.file;
      var boundVendor=s.vendor||'';
      startLive();
      if(cur===s) beginVisit(s);
      fetch('/chat/messages?file='+encodeURIComponent(boundFile)+'&vendor='+encodeURIComponent(boundVendor)).then(function(r){return r.json();}).then(function(msgs){
        if(cur!==s) return;
        if((!Array.isArray(msgs) || !msgs.length) && !sourceRetried && s.sessionId){
          return hydrateSessionSource(s, {force:true}).then(function(found){
            if(cur!==s) return;
            var nextFile=found&&found.file||'';
            var nextVendor=found&&found.vendor||s.vendor||'';
            if(nextFile && (nextFile!==boundFile || nextVendor!==boundVendor)) return fetchHistory(true);
            msgs = Array.isArray(msgs) ? msgs : [];
            var prevAfterRetry=cachedTranscriptFor(s);
            if(!prevAfterRetry || !sameTranscript(prevAfterRetry, msgs)) renderSessionHistory(s, msgs);
            else cacheTranscript(s, msgs);
            finishRefresh();
          }).catch(function(){
            if(cur!==s) return;
            msgs = Array.isArray(msgs) ? msgs : [];
            var prevAfterFail=cachedTranscriptFor(s);
            if(!prevAfterFail || !sameTranscript(prevAfterFail, msgs)) renderSessionHistory(s, msgs);
            else cacheTranscript(s, msgs);
            finishRefresh();
          });
        }
        msgs = Array.isArray(msgs) ? msgs : [];
        var prev=cachedTranscriptFor(s);
        if(!prev || !sameTranscript(prev, msgs)) renderSessionHistory(s, msgs);
        else cacheTranscript(s, msgs);
        finishRefresh();
      }).catch(function(){
        if(cur!==s) return;
        if(!cachedTranscriptFor(s)) renderSessionHistory(s, []);
        finishRefresh();
      });
    };
    hydrateSessionSource(s, {force:isRefresh}).then(function(){
      if(cur!==s) return;
      fetchHistory();
      if(cur===s) syncOpenHeader();
      renderSidebar();
    }).catch(function(){ if(isRefresh) setRefreshBusy(false); });
  }
  function refreshCurrentChat(){
    if(!cur) return;
    setRefreshBusy(true);
    select(cur, {refresh:true});
  }
  function liveStartedAt(res, sessionId){
    if(!res || !res.startedAt || !sessionId) return 0;
    var n=Number(res.startedAt[sessionId]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  var LIVE_END_GRACE_MS = 1500;
  function canRecoverTurnEnd(){
    return !!(!genStart || (Date.now() - genStart) >= LIVE_END_GRACE_MS);
  }
  function recoverCurrentTurnFromLive(active){
    if(!cur || !cur.sessionId || !turnActive) return;
    if(active[cur.sessionId]) return;
    // Right after beginTurn(), /chat/live can briefly lag the real run creation.
    // Give it a short grace window so we don't collapse a just-started turn, but
    // do recover if a background tab missed the SSE result event.
    if(!canRecoverTurnEnd()) return;
    turnEnded();
  }
  function recoverCurrentTurnFromSync(ev){
    if(!cur || !cur.sessionId || !turnActive || ev.turnActive) return;
    // Same race as /chat/live: a reconnect can briefly report turnActive:false
    // before the just-started run is indexed. After a short grace window, treat
    // sync=false as authoritative so a missed result/error doesn't strand the UI
    // in Generating… / Stopping….
    if(!canRecoverTurnEnd()) return;
    turnEnded();
  }
  function applyLiveSnapshot(res){
    var active={}; (res.active||[]).forEach(function(id){ active[id]=true; });
    SESS.forEach(function(s){
      if(!s.sessionId) return;
      var wasGenerating=!!s.generating;
      var live=!!active[s.sessionId];
      var startedAt=live ? liveStartedAt(res, s.sessionId) : 0;
      var keepLocal = s===cur && turnActive;
      var g=live || keepLocal;
      s.generatingStartedAt = g ? (startedAt || s.generatingStartedAt || null) : null;
      if(g!==wasGenerating){
        s.generating=g;
        if(!g && wasGenerating){
          if(s===cur) markSeen(s, true);
          else { markUnread(s); warmTranscriptCache(s); }
        } else {
          reviveAttention(s);
          applyGenerating(s);
        }
      }
    });
    recoverCurrentTurnFromLive(active);
    if(cur && cur.sessionId && active[cur.sessionId] && !turnActive){
      beginTurn(liveStartedAt(res, cur.sessionId) || Date.now());
    }
  }
  function syncCurrentLiveState(s){
    if(!s || !s.sessionId) return;
    fetch('/chat/live').then(function(r){ return r.json(); }).then(function(res){
      if(!cur || cur!==s) return;
      applyLiveSnapshot(res||{});
    }).catch(function(){});
  }
  function openStream(id,vendor){ if(es) es.close(); es=new EventSource('/chat/stream?session='+encodeURIComponent(id)+(vendor?('&vendor='+encodeURIComponent(vendor)):'')); es.onmessage=function(e){ onEvent(JSON.parse(e.data)); }; }
  function onEvent(ev){
    if(ev.kind==='assistant_text'){
      if(consumeCatchup(ev.text)) return; // replay of a block history already shows → drop
      cacheTranscriptAssistantText(cur, ev.text);
      if(!assistantEl) assistantEl=addMsg('assistant','');
      var b=assistantEl.querySelector('.bubble');
      setBubbleText(b, (b&&b.getAttribute('data-raw')||'') + ev.text, true);
      scroll();
      scheduleLatestPin();
    }
    else if(ev.kind==='tool_use'){
      assistantEl=null; // catch-up persists across tools (tools dedup by id below)
      cacheTranscriptToolUse(cur, {id:ev.id,name:ev.name,input:ev.input});
      var d=ev.id&&toolEls[ev.id] ? toolEls[ev.id] : addTool({id:ev.id,name:ev.name,input:ev.input});
      if(ev.id) toolEls[ev.id]=d;
      if(ev.name==='AskUserQuestion' && turnActive) endTurn();
    }
    else if(ev.kind==='tool_result'){ assistantEl=null; var t=ev.id?toolEls[ev.id]:null;
      cacheTranscriptToolResult(cur, ev.id, String(ev.text||'').slice(0,8000), ev.isError);
      if(t){ var o=t.querySelector('.tool-out'); o.textContent=String(ev.text||'').slice(0,8000); o.style.display=''; if(ev.isError) o.className='tool-out err'; lockQuestionTool(t); }
      else { addTool({name:'result',input:null,result:ev.text,isError:ev.isError}); }
      keepGenLast(); scroll(); scheduleLatestPin(); }
    else if(ev.kind==='result'){ assistantEl=null; turnEnded(); }
    else if(ev.kind==='error'){ endCatchup(); assistantEl=null; addMsg('error','⚠ '+ev.message); turnEnded(); }
    // reconnect snapshot: restore the 生成中… state if the server is mid-turn.
    // Only ever STARTS the indicator — never ends it: turn-end is owned by the
    // 'result' event. (A self-initiated send parks its SSE before the run exists,
    // so it gets a stale sync{turnActive:false} right after we begin the turn;
    // ending on it would wrongly kill the indicator and desync turnActive.)
    else if(ev.kind==='sync'){
      endCatchup();
      if(ev.turnActive && !turnActive) beginTurn(ev.startedAt);
      else if(!ev.turnActive) recoverCurrentTurnFromSync(ev);
    }
  }
  function send(){
    if(!cur) return;
    var turn=currentComposerTurn();
    if(!turn.text && !turn.attachments.length) return;
    if(cur.pendingFork){
      materializeFork(cur, turn); return;
    }
    if(!cur.sessionId) return;
    clearComposer();
    // Mid-turn: queue the draft instead of blocking it. A naturally-finished
    // turn auto-advances into the queue; a manually-stopped one leaves it parked.
    if(turnActive){ enqueue(turn); return; }
    var shown=shownTurnText(turn);
    rememberPendingUserMsg(cur.sessionId, shown);
    markVisitSend();
    noteUserTurn(cur, shown);
    cacheTranscriptUserMsg(cur, shown);
    addMsg('user',shown); assistantEl=null;
    dispatchSend(turn, shown);
  }
  // Queue a draft (rendered in the pinned region below) to send when the turn ends.
  function currentComposerTurn(){
    var inp=byId('input');
    return {
      text: inp && inp.value ? inp.value.trim() : '',
      attachments: draftAttachments.map(function(att){ return Object.assign({}, att); })
    };
  }
  function clearComposer(){
    var inp=byId('input');
    if(inp) inp.value='';
    if(cur) setDraftForSession(cur, '');
    draftAttachments = [];
    if(cur) stashAttachmentState(cur);
    renderAttachments();
  }
  function shownTurnText(turn){ return composeTurnText(turn.text, turn.attachments); }
  function enqueue(turn){ pendingQueue.push(cloneTurn(turn)); syncQueueState(); renderQueue(); }
  // Promote a queued draft to a real user message in the transcript, then send it.
  function promoteAndSend(turn){
    var shown=shownTurnText(turn);
    if(cur&&cur.sessionId) rememberPendingUserMsg(cur.sessionId, shown);
    markVisitSend();
    noteUserTurn(cur, shown);
    cacheTranscriptUserMsg(cur, shown);
    addMsg('user',shown);
    dispatchSend(turn, shown);
  }
  // POST the turn and (re)attach the stream. The stream is opened once per
  // session in select(); only reopen if it somehow isn't (avoids replaying the
  // buffer and double-rendering the history).
  function dispatchSend(turn, shownText){
    if(!cur||!cur.sessionId){ endTurn(); return; }
    markReplied(cur); // you advanced it → keep it tracked; only a manual gray clears it
    assistantEl=null; beginTurn();
    touchSession(cur); // sending is an interaction → float this session to the top
    var id=cur.sessionId, cwd=cur.cwd||'', vendor=cur.vendor||'claude';
    fetch('/chat/send?session='+encodeURIComponent(id)+'&cwd='+encodeURIComponent(cwd)+'&vendor='+encodeURIComponent(vendor),{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({ text: shownText, attachments: turn.attachments || [] })
    })
      .then(function(r){return r.json();}).then(function(res){ if(res.ok){ if(!es) openStream(id,vendor); } else { forgetPendingUserMsg(id, shownText); addMsg('error','⚠ '+(res.error||'send failed')); turnEnded(); } })
      .catch(function(e){ forgetPendingUserMsg(id, shownText); addMsg('error','⚠ network error: '+(e&&e.message?e.message:e)); turnEnded(); });
  }
  // Stop: interrupt the in-flight turn. Keep queued drafts intact; when the abort result arrives, turnEnded
  // will leave them parked so you can edit or send one explicitly.
  function stopTurn(){
    if(!cur||!cur.sessionId) return;
    var stopping=cur;
    stopRequested=true;
    renderQueue();
    var b=genEl&&genEl.querySelector('.bubble'); if(b){ b.textContent='Stopping…'; }
    fetch('/chat/abort?session='+encodeURIComponent(cur.sessionId)+'&vendor='+encodeURIComponent(cur.vendor||'claude'),{method:'POST'})
      .then(function(r){ return r.json().catch(function(){ return {}; }); })
      .then(function(){
        if(cur===stopping && stopRequested) syncCurrentLiveState(stopping);
      })
      .catch(function(){
        if(cur===stopping && stopRequested) syncCurrentLiveState(stopping);
      });
  }
  function fork(){
    if(!cur||!cur.sessionId){ alert('Pick a session on the left before splitting.'); return; }
    if(cur.pendingFork){ byId('input').focus(); return; }
    // Forking a still-generating session is fine: the fork snapshots the parent's
    // transcript as it stands now (history up to the latest generated token) and
    // diverges from there — the parent keeps running untouched.
    // Open the branch immediately, empty and ready. The real fork is materialized
    // lazily on the first message: both backends need a turn to diverge on (Claude
    // mints the new id on first input; Codex copies the parent's rollout then
    // resumes it), so we defer the actual /chat/fork until send().
    // A just-created fork is in-progress, not parked → seed it 'seen' (hollow green
    // dot), never the default gray "read".
    // If you'd already typed something, that becomes the branch's opening turn —
    // "I typed this, but it's better off as a split" — and we materialize now.
    var inp=byId('input'); var firstTurn=currentComposerTurn();
    var ns={vendor:cur.vendor,sessionId:'pending-'+Date.now(),pendingFork:{parent:cur.sessionId,cwd:cur.cwd||''},title:'(fork) '+(cur.title||''),lastPrompt:null,cwd:cur.cwd,project:cur.project,file:'',ageDays:0,lastTs:Date.now(),prompts:0,brief:null,seen:true,tags:(cur.tags||[]).slice()};
    SESS.unshift(ns); select(ns);
    if(firstTurn.text || firstTurn.attachments.length){ materializeFork(ns, firstTurn); } else { inp.focus(); }
  }
  // Turn a pending fork into a real session using its first message. The fork
  // inherits the parent's full history (the SDK fork appends the parent's entries
  // to the new session id), so we render + cache the parent transcript as the
  // fork's base instead of starting from a blank panel — otherwise the branch
  // looks empty and a reload finds no context.
  function materializeFork(branch,turn){
    var shown=shownTurnText(turn);
    var parent=findSessionById(branch.pendingFork.parent);
    var parentHistory=(parent && cachedTranscriptFor(parent)) || [];
    var inp=byId('input');
    if(parentHistory.length) renderPersistedAndPending(parentHistory, null);
    else byId('msgs').innerHTML='';
    noteUserTurn(branch, shown); addMsg('user',shown);
    if(inp) inp.value=''; setDraftForSession(branch, ''); draftAttachments=[]; stashAttachmentState(branch); renderAttachments(); assistantEl=null;
    beginTurn();
    var vendor=branch.vendor||'claude';
    fetch('/chat/fork?session='+encodeURIComponent(branch.pendingFork.parent)+'&cwd='+encodeURIComponent(branch.pendingFork.cwd)+'&vendor='+encodeURIComponent(vendor),
      {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:shown, attachments:turn.attachments || []})})
      .then(function(r){return r.json();}).then(function(res){ if(!res.ok){ addMsg('error','⚠ '+(res.error||'fork failed')); endTurn(); return; }
        branch.sessionId=res.session; branch.pendingFork=null;
        branch.file='';
        // Seed the fork's transcript cache UNDER ITS REAL id (parent history + the
        // opening turn) so later streamed assistant text appends to the same record
        // and a re-select shows the whole conversation, not just this turn.
        cacheTranscript(branch, parentHistory.concat([{ role:'user', text:String(shown||''), tools:[] }]));
        markReplied(branch);
        rememberPendingUserMsg(branch.sessionId, shown);
        if(cur===branch){ renderSidebar(); refreshForkButton(); }
        openStream(res.session, vendor);
        // Best-effort: resolve the fork's own JSONL so a full page reload (which
        // drops the in-memory cache) can reload its complete history from disk.
        warmTranscriptCache(branch); })
      .catch(function(e){ addMsg('error','⚠ fork failed: '+(e&&e.message?e.message:e)); endTurn(); });
  }
  function vendorInfo(id){
    var want=String(id||'').trim().toLowerCase();
    for(var i=0;i<VENDORS.length;i++){ if(String(VENDORS[i].vendor||'').toLowerCase()===want) return VENDORS[i]; }
    return null;
  }
  function newSession(){
    if(newSessionPending) return;
    var dir=(byId('ndir')||{}).value ? byId('ndir').value.trim() : '';
    var text=byId('np').value.trim();
    if(!dir){ byId('nmsg').textContent='pick or type a directory'; return; }
    var vendor=(byId('nvendor')||{}).value ? byId('nvendor').value.trim().toLowerCase() : '';
    if(!vendor){ byId('nmsg').textContent='pick a vendor'; return; }
    var info=vendorInfo(vendor);
    if(info && !info.available){ byId('nmsg').textContent=vendor+' CLI not detected'; return; }
    if(!info){ byId('nmsg').textContent='unknown vendor: '+vendor; return; }
    var model=selectedNewModel();
    var effort=selectedNewEffort();
    var launchQs=(model?('&model='+encodeURIComponent(model)):'')+(effort?('&effort='+encodeURIComponent(effort)):'');
    // A vendor without in-browser chat (terminal-only) launches a real terminal.
    if(info && info.chat===false){
      setNewPending(true,'Opening terminal…');
      fetch('/launch?action=new&vendor='+encodeURIComponent(vendor)+'&cwd='+encodeURIComponent(dir)+launchQs+(text?('&prompt='+encodeURIComponent(text)):''),{method:'POST'})
        .then(function(r){return r.json();}).then(function(res){
          if(!res.ok){ setNewPending(false, res.error||'failed'); return; }
          rememberNewSessionPrefs(vendor, model, effort);
          byId('np').value='';
          if(res.cwd) byId('ndir').value=res.cwd;
          setNewPending(false, 'Launched in terminal: '+res.command); })
        .catch(function(e){ setNewPending(false, e&&e.message?e.message:'failed'); });
      return;
    }
    setNewPending(true,'Starting session…');
    // In-browser chat. Claude can open empty (first message optional); Codex only
    // mints a thread id once a turn runs, so default its opening message to a greeting.
    if(vendor==='codex' && !text){ text='hello'; }
    fetch('/chat/new?cwd='+encodeURIComponent(dir)+'&vendor='+encodeURIComponent(vendor),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text, model:model||undefined, effort:effort||undefined})})
      .then(function(r){return r.json();}).then(function(res){ if(!res.ok){ setNewPending(false, res.error||'failed'); return; }
        rememberNewSessionPrefs(vendor, model, effort);
        var cwd=res.cwd||dir;
        var ns={vendor:vendor,sessionId:res.session,title:text||'(new session)',lastPrompt:null,cwd:cwd,project:basename(cwd),file:'',ageDays:0,lastTs:Date.now(),prompts:0,brief:null,tags:[]};
        SESS.unshift(ns); select(ns); markReplied(ns);
        if(text){ rememberPendingUserMsg(res.session, text); noteUserTurn(ns, text); addMsg('user',text); beginTurn(); openStream(res.session,vendor); }
        byId('np').value=''; byId('nmsg').textContent=''; byId('ndir').value=cwd; closeNewBox();
        setNewPending(false, '');
      }).catch(function(e){ setNewPending(false, e&&e.message?e.message:'failed'); });
  }

  // Poll the server for which sessions are mid-turn, so background tabs (ones
  // we're not streaming) show their generating dot too. The open session's own
  // turn is authoritative locally (turnActive), so don't let a lagging poll
  // flip its dot off mid-turn. If the open tab missed SSE turn-end while hidden,
  // the same snapshot also closes the local turn and advances the queued drafts.
  function pollLive(){
    fetch('/chat/live').then(function(r){return r.json();}).then(function(res){ applyLiveSnapshot(res||{}); }).catch(function(){});
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
  renderTagFilters();
  renderSidebar();
  resetOpenHeader();
  setupVendorChooser();
  setupDirChooser();
  bindComposerDrop();
  renderAttachments();
  syncRefreshButton();
  // The send button is also the Stop button mid-turn.
  byId('send').onclick=function(){ if(turnActive) stopTurn(); else send(); };
  byId('refreshBtn').onclick=refreshCurrentChat;
  byId('latestPinJump').onclick=function(){
    var m=byId('msgs'), target=latestUserMsgEl || refreshLatestUserMsg();
    if(!m || !target) return;
    // Scroll by the on-screen gap between the target and the scroll viewport's top
    // (robust to whatever the offsetParent is), landing the message ~18px below the
    // fold so its whole top edge clears — far enough that the pin's show-condition
    // (target bottom above the viewport top) is false and it dismisses cleanly.
    var delta = target.getBoundingClientRect().top - m.getBoundingClientRect().top;
    m.scrollTop = Math.max(0, m.scrollTop + delta - 18);
    hideLatestPin();
    scheduleLatestPin();
  };
  // mobile: back from the chat page to the session list
  byId('backbtn').onclick=function(){ document.body.classList.remove('show-chat'); };
  byId('forkBtn').onclick=fork;
  byId('nbtn').onclick=newSession;
  // Enter starts the session; Shift+Enter inserts a newline (IME-safe).
  byId('np').addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey&&!isImeConfirming(e)){ e.preventDefault(); newSession(); }
  });
  byId('newToggle').onclick=function(ev){ ev.stopPropagation(); toggleNewBox(); };
  byId('newClose').onclick=function(ev){ ev.stopPropagation(); closeNewBox(); };
  // Live-filter the sidebar as you type; Esc clears the search.
  byId('search').addEventListener('input',function(){ filterQ=this.value.trim().toLowerCase(); renderSidebar(); });
  byId('search').addEventListener('keydown',function(e){ if(e.key==='Escape'){ this.value=''; filterQ=''; renderSidebar(); } });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape' && newBoxOpen() && !newSessionPending){ closeNewBox(); }
  });
  document.addEventListener('click',function(ev){
    var box=byId('newbox'), btn=byId('newToggle');
    if(!newBoxOpen() || newSessionPending || !box || !btn) return;
    if(box.contains(ev.target) || btn.contains(ev.target)) return;
    closeNewBox();
  });
  byId('input').addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey&&!isImeConfirming(e)){ e.preventDefault(); send(); }
  });
  byId('input').addEventListener('input',function(){ if(cur) setDraftForSession(cur, this.value); });
  document.addEventListener('visibilitychange', function(){
    if(document.hidden) flushVisit(true);
    else if(cur && cur.sessionId && !cur.pendingFork){
      if(!viewVisit) beginVisit(cur);
      syncCurrentLiveState(cur);
    }
  });
  window.addEventListener('pagehide', function(){ flushVisit(true); });
  window.addEventListener('beforeunload', function(){ flushVisit(true); });
})();
</script>
</body>
</html>`;
}
