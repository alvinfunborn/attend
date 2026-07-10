import type { AnalysisState } from "../core/daemon/cache.js";
import type { ModelOption } from "../core/model-options.js";
import type { Pattern } from "../core/types.js";
import type { VaultUiState } from "../core/ui-state.js";
import type { VendorAvailability } from "../core/vendor/detect.js";

export interface SessionView {
  vendor: string;
  sessionId: string | null;
  /** Stable UI identity for a locally-created branch. Never changes after creation. */
  clientBranchId?: string;
  /** Vendor UUID used for resume/transcript/backend operations once materialized. */
  providerSessionId?: string | null;
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
  /** epoch ms timestamps for real user-authored prompts. Drives tag heat color. */
  userPromptTs?: number[];
  prompts: number;
  /** behavioral observation, session-derived */
  pattern: Pattern;
  /** true when the pattern is a manual override */
  patternset?: boolean;
  /** evidence for an avoidance observation, if present */
  patternReason?: string | null;
  /** structured avoidance evidence for the popover */
  patternData?: {
    kind: "review" | "revisit";
    visits: number;
    minutes: number;
    prompts: number | null;
  } | null;
  /** daemon-proposed editable user message for lowering avoidance friction */
  avoidancePrompt?: string | null;
  /** daemon-classified handoff state; null until a new-format analysis exists */
  state: AnalysisState | null;
  /** true when the state is a manual override */
  stateset?: boolean;
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
  /** live-only UI state, refreshed from /chat/live-stream while the page is open */
  generating?: boolean;
  generatingStartedAt?: number | null;
  /** client-created sessions can remember their run overrides for later forks */
  model?: string;
  effort?: string;
  /** local-only: next send should restart/resume this session with model/effort */
  runConfigDirty?: boolean;
  /** local-only: selected composer vendor; a different vendor can only be forked */
  runVendor?: string;
  runModel?: string;
  runEffort?: string;
}

export interface ConsoleView {
  sessions: SessionView[];
  knownDirs: string[];
  scopeRoots: string[];
  /** browser tab title; usually derived from the launch/scope directory */
  pageTitle?: string;
  /** sessions touched in the trailing 24h, as an hourly rate */
  sessionsPerHour: number;
  /** characters processed in the trailing 24h, as an hourly rate */
  charsPerHour: number;
  /** locally-detected vendor CLIs — populates the "+ new" provider picker */
  vendors: VendorAvailability[];
  /** Claude models discovered from local Claude Code state, or configured overrides. */
  claudeModels: ModelOption[];
  /** Codex models discovered from ~/.codex/models_cache.json, when present. */
  codexModels: ModelOption[];
  /** global tag list used by the sidebar manager + per-session assignment */
  tags: string[];
  /** vault-owned browser-independent preferences and message UI state. */
  vaultState?: VaultUiState;
  /** Application-layer encryption mode for remote tunnels. */
  e2ee?: { enabled: boolean };
}

const STYLE = `
  :root {
    --priority-1-fg: #b91c1c; --priority-1-bg: #fef2f2;
    --priority-2-fg: #b45309; --priority-2-bg: #fffbeb;
    --priority-3-fg: #0f766e; --priority-3-bg: #ecfdf5;
    --priority-4-fg: #2563eb; --priority-4-bg: #eff6ff;
    --priority-5-fg: #64748b; --priority-5-bg: #f1f5f9;
    color-scheme: light;
    --accent: #4f46e5; --accent-soft: #eef2ff; --accent-ring: rgba(99,102,241,0.35);
    --ink: #111827; --ink-2: #374151; --ink-3: #6b7280; --ink-4: #9ca3af;
    --line: #e5e7eb; --line-2: #d1d5db;
    --surface: #ffffff; --surface-2: #fafafa; --canvas: #f3f4f6;
    --button-hover: #f8fafc; --button-hover-border: #c7ccd6;
    --scroll-thumb: #d4d8e0; --scroll-thumb-hover: #b9bfcc; --resizer-hover: #c7d2fe;
    --panel-gradient: linear-gradient(180deg, #fcfcfd 0%, #ffffff 100%);
    --newbox-gradient: linear-gradient(180deg, #f5f7ff 0%, var(--surface) 100%);
    --latest-gradient: linear-gradient(180deg, #eff2ff 0%, #fafbff 100%);
    --row-line: #f1f2f4; --item-hover: #f1f5f9;
    --soft-card: #f9fafb; --assistant-bg: #f5f6f8; --assistant-border: #eceef1;
    --msg-control-bg: rgba(255,255,255,0.72); --msg-control-hover-bg: #f8fafc;
    --msg-control-border: rgba(148,163,184,0.3); --msg-control-active-bg: #eef2ff;
    --msg-control-active-border: #c7d2fe;
    --code-bg: #e5e7eb; --input-bg: #ffffff; --danger-soft: #fef2f2;
    --warning: #f59e0b; --warning-ring: rgba(245,158,11,0.24); --warning-soft: #fffbeb;
    --tabtip-bg: rgba(255,255,255,0.96); --tabtip-border: rgba(203,213,225,0.95);
    --drop-bg: #f8faff; --primary-bg: #111827; --primary-fg: #ffffff; --primary-hover: #0b1220;
    --status-generating: #6366f1; --status-generating-soft: rgba(99,102,241,0.26);
    --status-unread: #059669; --status-unread-soft: rgba(16,185,129,0.24);
    --status-seen: #0284c7; --status-seen-soft: rgba(14,165,233,0.18);
    --status-read: #cbd5e1;
    --radius: 8px; --radius-sm: 6px; --radius-pill: 999px;
    --shadow-sm: 0 1px 2px rgba(15,23,42,0.06);
    --shadow-md: 0 6px 18px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.06);
    --shadow-pop: 0 14px 34px rgba(15,23,42,0.16), 0 4px 12px rgba(15,23,42,0.08);
  }
  html[data-theme="dark"] {
    --priority-1-fg: #fca5a5; --priority-1-bg: rgba(220,38,38,0.14);
    --priority-2-fg: #fbbf24; --priority-2-bg: rgba(245,158,11,0.14);
    --priority-3-fg: #5eead4; --priority-3-bg: rgba(16,185,129,0.14);
    --priority-4-fg: #93c5fd; --priority-4-bg: rgba(37,99,235,0.14);
    --priority-5-fg: #cbd5e1; --priority-5-bg: rgba(100,116,139,0.16);
    color-scheme: dark;
    --accent: #818cf8; --accent-soft: #1e1b4b; --accent-ring: rgba(129,140,248,0.34);
    --ink: #f8fafc; --ink-2: #dbe4ee; --ink-3: #a7b4c4; --ink-4: #748196;
    --line: #263241; --line-2: #3a4657;
    --surface: #111827; --surface-2: #0f172a; --canvas: #07101f;
    --button-hover: #1e293b; --button-hover-border: #4b5563;
    --scroll-thumb: #465468; --scroll-thumb-hover: #64748b; --resizer-hover: #374151;
    --panel-gradient: linear-gradient(180deg, #151f31 0%, #111827 100%);
    --newbox-gradient: linear-gradient(180deg, #151f31 0%, var(--surface) 100%);
    --latest-gradient: linear-gradient(180deg, #1e1b4b 0%, #141b2b 100%);
    --row-line: #1f2937; --item-hover: #172033;
    --soft-card: #172033; --assistant-bg: #172033; --assistant-border: #263241;
    --msg-control-bg: rgba(15,23,42,0.52); --msg-control-hover-bg: #172033;
    --msg-control-border: rgba(148,163,184,0.22); --msg-control-active-bg: rgba(99,102,241,0.2);
    --msg-control-active-border: rgba(129,140,248,0.44);
    --code-bg: #0b1220; --input-bg: #0f172a; --danger-soft: #3b121a;
    --warning: #fbbf24; --warning-ring: rgba(251,191,36,0.22); --warning-soft: #2f2410;
    --tabtip-bg: rgba(17,24,39,0.96); --tabtip-border: rgba(71,85,105,0.9);
    --drop-bg: #151f31; --primary-bg: #6366f1; --primary-fg: #ffffff; --primary-hover: #4f46e5;
    --status-generating: #a5b4fc; --status-generating-soft: rgba(129,140,248,0.34);
    --status-unread: #34d399; --status-unread-soft: rgba(52,211,153,0.24);
    --status-seen: #38bdf8; --status-seen-soft: rgba(56,189,248,0.2);
    --status-read: #475569;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.28);
    --shadow-md: 0 8px 22px rgba(0,0,0,0.34), 0 2px 8px rgba(0,0,0,0.28);
    --shadow-pop: 0 18px 40px rgba(0,0,0,0.48), 0 6px 16px rgba(0,0,0,0.34);
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { font-family: ui-sans-serif, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
    color: var(--ink-2); background: var(--canvas); display: flex; height: 100vh; overflow: hidden;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
  button { cursor: pointer; border-radius: var(--radius-sm); border: 1px solid var(--line-2); background: var(--surface);
    color: var(--ink-2); font-size: 0.8rem; font-weight: 500; padding: 0.3rem 0.65rem;
    box-shadow: var(--shadow-sm); transition: background 0.15s, border-color 0.15s, box-shadow 0.15s, color 0.15s, transform 0.05s; }
  button:hover { background: var(--button-hover); border-color: var(--button-hover-border); }
  button:active { transform: translateY(0.5px); }
  button:focus-visible { outline: 2px solid var(--accent-ring); outline-offset: 1px; }
  button:disabled { cursor: default; box-shadow: none; opacity: 0.6; }
  input, textarea, select { font-family: inherit; }
  input:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb { background: var(--scroll-thumb); border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
  ::-webkit-scrollbar-thumb:hover { background: var(--scroll-thumb-hover); background-clip: content-box; }
  ::-webkit-scrollbar-track { background: transparent; }
  * { scrollbar-width: thin; scrollbar-color: var(--scroll-thumb) transparent; }
  /* sidebar */
  .side { width: 320px; flex-shrink: 0; background: var(--surface-2); border-right: 1px solid var(--line); display: flex; flex-direction: column; container-type: inline-size; }
  /* draggable divider to widen/narrow the sidebar */
  .resizer { width: 6px; flex-shrink: 0; cursor: col-resize; background: transparent; transition: background 0.15s; }
  .resizer:hover, .resizer.dragging { background: var(--resizer-hover); }
  /* brand header */
  .side .brand { display: flex; align-items: center; gap: 0.5rem; padding: 0.72rem 0.85rem 0.68rem; }
  .brand-id { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 0.5rem; overflow: hidden; }
  .brand-name { flex-shrink: 0; font-size: 1.32rem; font-weight: 800; letter-spacing: 0; color: var(--ink); line-height: 1; }
  .brand-scope { display: none; min-width: 0; max-width: 14rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; font-weight: 600; color: var(--ink-4); }
  .side .brand .theme-toggle { margin-left: auto; }
  /* compact throughput stats */
  .brand-stats { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 0.55rem; overflow: visible; }
  .statcard { flex-shrink: 0; min-width: 0; display: inline-flex; align-items: baseline; gap: 0.2rem; color: var(--ink-4); }
  .statval { font-size: 0.78rem; font-weight: 760; letter-spacing: 0; color: var(--ink-2); line-height: 1; font-variant-numeric: tabular-nums; }
  .statlbl { font-size: 0.64rem; font-weight: 600; letter-spacing: 0; color: var(--ink-4); white-space: nowrap; }
  .side .topnav { padding: 0.75rem 1rem 0.85rem; display: flex; gap: 0.55rem; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .side .topnav a { font-size: 0.78rem; color: var(--accent); text-decoration: none; align-self: center; margin-left: auto; }
  .searchwrap { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; }
  .search-ico { position: absolute; left: 0.7rem; width: 0.9rem; height: 0.9rem; stroke: var(--ink-4); stroke-width: 1.7; fill: none; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
  #newToggle { flex-shrink: 0; font-weight: 700; color: var(--primary-fg); border-color: var(--primary-hover); background: var(--primary-hover); box-shadow: var(--shadow-sm); padding: 0.4rem 0.85rem; }
  #newToggle:hover { background: var(--primary-bg); border-color: var(--primary-bg); box-shadow: 0 4px 14px var(--accent-ring); }
  .theme-toggle { width: 2rem; height: 2rem; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; padding: 0; color: var(--ink-3); background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-sm); }
  .theme-toggle:hover { color: var(--ink); }
  .theme-toggle svg { width: 0.88rem; height: 0.88rem; stroke: currentColor; stroke-width: 1.9; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .theme-toggle .theme-sun { display: none; }
  html[data-theme="dark"] .theme-toggle .theme-sun { display: block; }
  html[data-theme="dark"] .theme-toggle .theme-moon { display: none; }
  @container (min-width: 420px) {
    .brand-scope { display: inline-block; flex: 0 1 auto; }
  }
  .tagbar { padding: 0.7rem 0.95rem; border-bottom: 1px solid var(--line); background: var(--surface); display: flex; flex-direction: column; gap: 0.5rem; }
  .tagbar .taghead { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .tagbar .tagttl { font-size: 0.66rem; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; }
  .taghead-label { display: flex; align-items: baseline; gap: 0.4rem; }
  .tagmode-toggle { appearance: none; min-width: 0; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; color: var(--ink-4); font-size: 0.61rem; text-transform: lowercase; cursor: pointer; }
  .tagmode-toggle:hover { color: var(--ink); background: transparent; box-shadow: none; text-decoration: underline; text-underline-offset: 2px; }
  .tagmode-toggle:focus-visible { outline: 1px solid var(--focus); outline-offset: 2px; }
  .instant-tip { position: relative; }
  .instant-tip::after { content: attr(data-tooltip); position: absolute; z-index: 80; top: calc(100% + 0.4rem); width: max-content; max-width: min(19rem, calc(100vw - 2rem)); padding: 0.38rem 0.5rem; border: 1px solid var(--tabtip-border); border-radius: var(--radius); background: var(--tabtip-bg); box-shadow: var(--shadow-md); color: var(--ink-2); font-size: 0.67rem; font-weight: 500; line-height: 1.35; text-align: left; text-transform: none; white-space: normal; opacity: 0; visibility: hidden; pointer-events: none; }
  .instant-tip:hover::after, .instant-tip:focus-visible::after { opacity: 1; visibility: visible; }
  .instant-tip-left::after { left: 0; }
  .instant-tip-right::after { right: 0; }
  .viewrow { display: flex; align-items: center; }
  .viewtabs { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
  .viewtab { font-size: 0.68rem; color: var(--ink-3); padding: 0.16rem 0.58rem; border-radius: var(--radius-pill); box-shadow: none; background: var(--surface); border: 1px solid var(--line-2); }
  .viewtab:hover { color: var(--ink); background: var(--button-hover); }
  .viewtab.on { color: #3730a3; background: #eef2ff; border-color: #a5b4fc; box-shadow: 0 0 0 1px rgba(165,180,252,0.56); }
  .bulkarchive { align-self: flex-end; flex-shrink: 0; min-width: 0; font-size: 0.68rem; font-weight: 740; color: #be123c; padding: 0.05rem 0; border: 0; background: transparent; box-shadow: none; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
  .bulkarchive:hover:not(:disabled) { color: #9f1239; background: transparent; text-decoration: underline; text-underline-offset: 2px; box-shadow: none; }
  .bulkarchive:disabled { color: var(--ink-4); background: transparent; box-shadow: none; opacity: 0.62; cursor: default; }
  .viewtabgroup { display: inline-flex; align-items: stretch; border: 1px solid var(--line-2); border-radius: var(--radius-pill); overflow: hidden; background: var(--surface); }
  .viewtabgroup .viewtab { border: 0; border-radius: 0; }
  .viewtabgroup .viewtab:focus-visible, .viewtabgroup .viewtabx:focus-visible { outline: none; }
  .viewtabgroup:has(.viewtab:focus-visible), .viewtabgroup:has(.viewtabx:focus-visible) { box-shadow: 0 0 0 3px var(--accent-ring); }
  .viewtabgroup.on { border-color: #818cf8; background: #eef2ff; box-shadow: 0 0 0 1px rgba(129,140,248,0.22); }
  .viewtabgroup.on:has(.viewtab:focus-visible), .viewtabgroup.on:has(.viewtabx:focus-visible) { box-shadow: 0 0 0 1px rgba(129,140,248,0.22), 0 0 0 4px var(--accent-ring); }
  .viewtabgroup.on .viewtab.on { background: transparent; box-shadow: none; }
  .viewtabgroup.on .viewtabx { border-left-color: rgba(99,102,241,0.28); }
  .viewtabx { border: 0; border-left: 1px solid var(--line); border-radius: 0; color: var(--ink-4); background: transparent; padding: 0.16rem 0.4rem; box-shadow: none; }
  .viewtabx:hover { color: #b91c1c; background: #fef2f2; }
  .tagchips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .tagempty { font-size: 0.72rem; color: var(--ink-4); }
  .gtag { display: inline-flex; align-items: stretch; border: 1px solid var(--line-2); border-radius: var(--radius-pill); overflow: hidden; background: var(--surface); box-shadow: var(--shadow-sm); transition: box-shadow 0.15s, transform 0.05s; }
  .gtag:hover { box-shadow: var(--shadow-md); }
  .gtag[draggable="true"] { cursor: grab; }
  .gtag[draggable="true"]:active { cursor: grabbing; }
  .gtag.dragging { opacity: 0.56; transform: scale(0.98); }
  .gtag.drop-before { box-shadow: -3px 0 0 var(--accent), var(--shadow-md); }
  .gtag.drop-after { box-shadow: 3px 0 0 var(--accent), var(--shadow-md); }
  .gtag.on { border-color: #0f766e; background: #ccfbf1; box-shadow: inset 0 0 0 1px #0f766e; }
  .gtagbtn, .gtagdel { border: 0; border-radius: 0; font-size: 0.7rem; background: transparent; padding: 0.18rem 0.55rem; box-shadow: none; }
  .gtagbtn { color: #0f172a; display: inline-flex; align-items: center; }
  .gtag.on .gtagbtn { background: transparent; color: #115e59; }
  .gtagdel { color: var(--ink-4); padding: 0.18rem 0.46rem; margin-left: 0; }
  .gtag.on .gtagdel { border-left: 1px solid rgba(15,118,110,0.24); }
  .gtagdel:hover { background: #fef2f2; color: #b91c1c; }
  .gtag.auto .gtagbtn { font-weight: 600; }
  .prioritytag { position: relative; overflow: visible; }
  .prioritytag .gtagbtn::after { content: '⌄'; margin-left: 0.32rem; font-size: 0.62rem; opacity: 0.66; }
  .prioritytagmenu { position: absolute; z-index: 55; top: calc(100% + 5px); left: 0; min-width: 7.25rem; padding: 0.3rem; border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-pop); }
  .prioritytagopt { display: flex; align-items: center; gap: 0.45rem; width: 100%; padding: 0.32rem 0.48rem; border: 0; border-radius: var(--radius-sm); background: transparent; box-shadow: none; color: var(--ink-2); font-size: 0.72rem; text-align: left; }
  .prioritytagopt:hover { background: var(--button-hover); }
  .prioritytagopt input { margin: 0; pointer-events: none; }
  .prioritytagopt .prilabel { margin-left: 0.05rem; cursor: default; }
  /* custom (user) filter tags stay quiet until selected; heat is a soft wash. */
  .gtag:not(.auto):not(.on) { border-style: solid; border-color: var(--line-2); background: transparent; box-shadow: none; }
  .gtag:not(.auto):not(.on) .gtagbtn { color: #0f766e; }
  .gtag:not(.auto):not(.on):hover { background: var(--button-hover); box-shadow: none; }
  .gtag.hot:not(.on) { background: linear-gradient(90deg, var(--tag-heat-soft), var(--tag-heat-fade) 58%, transparent); }
  .gtag.hot:not(.on):hover { background: linear-gradient(90deg, var(--tag-heat-soft), var(--tag-heat-fade) 58%, transparent), var(--button-hover); }
  .tagadd-compact { font-size: 0.66rem; border: 1px solid transparent; color: #0f766e; padding: 0.1rem 0.46rem; border-radius: var(--radius-pill); box-shadow: none; background: transparent; }
  .tagadd-compact:hover { background: #f0fdfa; border-color: transparent; }
  .tagcreate-inline { position: relative; flex: 1 1 14rem; min-width: min(14rem, 100%); }
  .tagcreate-inline .tagedit-row { align-items: stretch; }
  .tagcreate-inline .tagedit-input { font-size: 0.74rem; }
  .searchbox { flex: 1; min-width: 0; font-size: 0.8rem; padding: 0.5rem 0.7rem 0.5rem 2.1rem; border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--input-bg); color: var(--ink-2); }
  .searchbox.filtering { border-color: var(--warning); background: var(--warning-soft); box-shadow: 0 0 0 1px var(--warning-ring); }
  .searchbox.filtering:focus { border-color: var(--warning); box-shadow: 0 0 0 3px var(--warning-ring); }
  .searchwrap.filtering .search-ico { stroke: var(--warning); }
  .newbox { margin: 0.85rem 1rem; padding: 0.9rem; border: 1px solid var(--line-2); border-radius: var(--radius); display: none; flex-direction: column; gap: 0.6rem; background: var(--newbox-gradient); box-shadow: var(--shadow-sm); }
  .newbox.open { display: flex; animation: newboxIn 0.18s ease; }
  @keyframes newboxIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .newbox input, .newbox textarea, .newbox select { font-size: 0.8rem; padding: 0.4rem 0.55rem; border: 1px solid var(--line-2); border-radius: var(--radius-sm); width: 100%; box-sizing: border-box; background-color: var(--surface); color: var(--ink-2); }
  .newbox textarea { resize: vertical; min-height: 2.4rem; font: inherit; font-size: 0.8rem; }
  .newattach { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.35rem; margin: -0.35rem; border: 1px dashed transparent; border-radius: var(--radius); transition: border-color 0.15s, background 0.15s, box-shadow 0.15s; }
  .newattach.drop { border-color: #818cf8; background: var(--drop-bg); box-shadow: 0 0 0 4px rgba(99,102,241,0.12); }
  .newmsgrow { position: relative; display: flex; align-items: stretch; }
  .newmsgrow textarea { flex: 1; min-width: 0; padding-right: 2.15rem; }
  .attachpick { position: absolute; right: 0.35rem; top: 50%; transform: translateY(-50%); width: 1.5rem; height: 1.5rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--ink-3); background: transparent; border-color: transparent; box-shadow: none; }
  .attachpick:hover { color: var(--ink); background: transparent; border-color: transparent; box-shadow: none; }
  .attachpick:active { transform: translateY(-50%); }
  .attachpick svg { width: 0.74rem; height: 0.74rem; stroke: currentColor; stroke-width: 1.65; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .newhead { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .newttl { font-size: 0.95rem; font-weight: 700; color: var(--ink); letter-spacing: -0.01em; }
  .newclose { width: 1.75rem; height: 1.75rem; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; padding: 0; color: var(--ink-3); border: 0; background: transparent; box-shadow: none; }
  .newclose:hover { color: #b91c1c; background: transparent; }
  .newrow { display: flex; gap: 0.5rem; align-items: flex-end; }
  .newrow .pickgrp { flex: 1; min-width: 0; }
  .newrow .pickgrp.vendor { flex: 1.35; }
  .newrow .pickgrp.effort { max-width: 8.25rem; }
  .pickgrp { display: flex; flex-direction: column; gap: 0.25rem; }
  .picklbl { font-size: 0.68rem; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; }
  .chooser, .selectwrap { position: relative; }
  .chooser-row { display: flex; gap: 0; }
  .chooser-input, .selectbtn { min-height: 2.05rem; font-size: 0.8rem; padding: 0.4rem 1.65rem 0.4rem 0.55rem; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--surface); color: var(--ink-2); box-sizing: border-box; }
  .chooser-input { flex: 1; min-width: 0; }
  .selectbtn { position: relative; width: 100%; display: flex; align-items: center; min-width: 0; text-align: left; box-shadow: none; cursor: pointer; }
  .selectbtn::after { content: ""; position: absolute; right: 0.62rem; top: 50%; width: 0.42rem; height: 0.42rem; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: translateY(-62%) rotate(45deg); color: var(--ink-4); pointer-events: none; }
  .selectbtn:hover { background: var(--surface); border-color: var(--line-2); }
  .selectbtn:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
  .selecttxt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chooser-select.is-enhanced { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .chooser-drop, .selectmenu { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 50; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow-pop); padding: 0.25rem; max-height: 15rem; overflow-y: auto; }
  .chooser-drop[hidden], .selectmenu[hidden] { display: none; }
  .chooser-opt, .selectopt { display: flex; flex-direction: column; gap: 0.12rem; padding: 0.38rem 0.5rem; cursor: pointer; color: var(--ink-2); }
  .chooser-opt { border-radius: 0; }
  .selectopt { border-radius: var(--radius-sm); }
  .selectopt { font-size: 0.78rem; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .selectopt[aria-selected="true"] { color: var(--ink); font-weight: 600; }
  .chooser-opt:hover, .chooser-opt.on { background: var(--accent-soft); }
  .selectopt:hover, .selectopt.on { background: var(--accent-soft); color: var(--ink); }
  .chooser-opt:hover .chooser-opt-label, .chooser-opt.on .chooser-opt-label { color: inherit; }
  .chooser-opt:hover .chooser-opt-meta, .chooser-opt.on .chooser-opt-meta { color: inherit; opacity: 0.76; }
  .chooser-opt-line { display: flex; align-items: center; gap: 0.38rem; min-width: 0; }
  .chooser-opt-label { font-size: 0.78rem; color: inherit; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chooser-opt-meta { font-size: 0.68rem; color: inherit; opacity: 0.72; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chooser-opt-note { flex-shrink: 0; font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #0f766e; background: #ccfbf1; border-radius: 3px; padding: 0.04rem 0.34rem; }
  .chooser-empty { padding: 0.45rem 0.5rem; font-size: 0.74rem; color: var(--ink-4); }
  .newbox .nmsg { font-size: 0.72rem; color: var(--ink-4); }
  .nbtn-primary { color: var(--primary-fg); background: var(--primary-hover); border-color: var(--primary-hover); box-shadow: var(--shadow-sm); }
  .nbtn-primary:hover:not(:disabled) { background: var(--primary-bg); border-color: var(--primary-bg); box-shadow: 0 4px 14px var(--accent-ring); }
  #list { overflow-y: auto; flex: 1; padding: 0.3rem 0; }
  #list .empty { padding: 1.2rem 0.9rem; color: var(--ink-4); font-size: 0.8rem; text-align: center; }
  .item { position: relative; padding: 0.6rem 0.95rem; border-bottom: 1px solid var(--row-line); cursor: pointer; border-left: 3px solid transparent; transition: background 0.12s, border-color 0.12s; }
  .item:hover { background: var(--item-hover); }
  .item.active { background: var(--accent-soft); border-left-color: var(--accent); }
  .item.avoidance { border-left-color: #f59e0b; }
  .it-titlerow { display: flex; align-items: center; gap: 0.45rem; }
  .it-title { font-size: 0.84rem; font-weight: 600; color: var(--ink); letter-spacing: -0.005em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
  .it-age { flex-shrink: 0; font-size: 0.66rem; color: #9ca3af; font-family: ui-monospace, monospace; white-space: nowrap; }
  .it-status { flex-shrink: 0; width: 0.58rem; height: 0.58rem; border-radius: 50%; border: 1.5px solid transparent; background: var(--status-read); cursor: pointer; transition: transform 0.1s, background 0.15s, border-color 0.15s, box-shadow 0.15s; }
  .it-status:hover { transform: scale(1.45); }
  .it-status.generating { background: transparent; border-color: var(--status-generating-soft); border-top-color: var(--status-generating); border-right-color: var(--status-generating); box-shadow: 0 0 0 2px var(--status-generating-soft); animation: statusSpin 0.82s linear infinite; }
  .it-status.unread { background: var(--status-unread); border-color: var(--status-unread); box-shadow: 0 0 0 3px var(--status-unread-soft), 0 0 12px var(--status-unread-soft); }
  /* seen = you opened it but haven't replied: calm sky hollow ring = still open. */
  .it-status.seen { background: transparent; border-color: var(--status-seen); box-shadow: none; }
  .it-status.read { background: var(--status-read); border-color: transparent; box-shadow: none; opacity: 0.72; }
  .it-firstline { font-size: 0.72rem; color: #6b7280; margin-top: 0.1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .it-searchhit { font-size: 0.72rem; color: #4338ca; margin-top: 0.12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .it-meta { font-size: 0.7rem; color: #6b7280; margin-top: 0.2rem; font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem; }
  .it-footrow { margin-top: 0.4rem; display: flex; align-items: center; gap: 0.45rem; min-width: 0; }
  .it-tags { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; }
  .it-tag { display: inline-flex; align-items: center; gap: 0.24rem; font-size: 0.66rem; color: #115e59; background: #ccfbf1; border: 1px solid #99f6e4; border-radius: var(--radius-pill); padding: 0.1rem 0.46rem; }
  .it-tag.auto { font-weight: 600; }
  /* custom (user) session-row tags: quiet frame, heat is a soft wash. */
  .it-tag:not(.auto) { border-style: solid; border-color: var(--line-2); background: transparent; color: #0f766e; }
  .it-tag.hot:not(.auto) { background: linear-gradient(90deg, var(--tag-heat-soft), var(--tag-heat-fade) 58%, transparent); }
  .it-tag button { border: 0; background: transparent; color: #0f766e; font-size: 0.78rem; padding: 0; line-height: 1; box-shadow: none; }
  .it-tag button:hover { color: #b91c1c; background: transparent; }
  .it-tagadd { font-size: 0.66rem; border: 1px solid transparent; color: #0f766e; padding: 0.1rem 0.46rem; border-radius: var(--radius-pill); box-shadow: none; background: transparent; }
  .it-tagadd:hover { background: #f0fdfa; border-color: transparent; }
  .it-context { margin-left: auto; min-width: 0; max-width: 58%; display: inline-flex; align-items: center; justify-content: flex-end; gap: 0.34rem; overflow: hidden; white-space: nowrap; font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.68rem; font-weight: 700; }
  .it-context .ctx-sep { color: var(--ink-4); flex-shrink: 0; opacity: 0.72; }
  .it-context .ctx-prompts { color: #7c3aed; flex-shrink: 0; }
  .it-context .vtag, .it-context .ptag { padding: 0; border: 0; background: transparent; border-radius: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .it-context .vtag.claude { color: #d97706; background: transparent; border-color: transparent; }
  .it-context .vtag.codex { color: #6366f1; background: transparent; border-color: transparent; }
  .it-context .ptag { color: var(--project-fg, #64748b); font-weight: 700; }
  /* per-tab tag editor + custom suggestion dropdown (replaces the native datalist) */
  .tagedit { position: relative; margin-top: 0.4rem; }
  .tagedit-row { display: flex; gap: 0.35rem; }
  .tagedit-input { flex: 1; min-width: 0; font-size: 0.74rem; padding: 0.3rem 0.5rem; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--input-bg); color: var(--ink-2); }
  .tagedit-cancel { flex-shrink: 0; width: 1.7rem; height: 1.7rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--ink-4); background: var(--surface); border: 1px solid var(--line); border-radius: 999px; box-shadow: none; }
  .tagedit-cancel:hover { color: #64748b; background: #f8fafc; border-color: #cbd5e1; }
  .tagedit-cancel svg { width: 0.72rem; height: 0.72rem; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; }
  .tagsug { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 40; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow-pop); padding: 0.25rem; max-height: 13rem; overflow-y: auto; }
  .tagsug[hidden] { display: none; }
  .tagsug-opt { display: flex; align-items: center; gap: 0.4rem; font-size: 0.76rem; color: var(--ink-2); padding: 0.3rem 0.5rem; border-radius: var(--radius-sm); cursor: pointer; }
  .tagsug-opt:hover, .tagsug-opt.on { background: var(--accent-soft); color: #3730a3; }
  .tagsug-create { color: var(--ink-3); }
  .tagsug-new { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #0f766e; background: #ccfbf1; border-radius: 3px; padding: 0.04rem 0.34rem; }
  .tabtip { position: fixed; z-index: 60; width: min(460px, calc(100vw - 24px)); pointer-events: none; opacity: 0; transform: translateY(6px) scale(0.98); transition: opacity 0.14s ease, transform 0.14s ease; }
  .tabtip.show { opacity: 1; transform: translateY(0) scale(1); }
  .tabtip-card { border-radius: 12px; background: var(--tabtip-bg); border: 1px solid var(--tabtip-border); box-shadow: var(--shadow-pop); backdrop-filter: blur(14px); padding: 0.9rem 0.95rem; display: flex; flex-direction: column; gap: 0.6rem; max-height: calc(100vh - 28px); overflow: auto; }
  .tabtip-title { font-size: 0.9rem; font-weight: 700; color: var(--ink); line-height: 1.36; word-break: break-word; overflow-wrap: anywhere; }
  /* mirror the tab, but with full (untruncated) text */
  .tabtip-lines { display: flex; flex-direction: column; gap: 0.22rem; }
  .tabtip-firstline { font-size: 0.75rem; color: var(--ink-3); line-height: 1.5; word-break: break-word; overflow-wrap: anywhere; }
  .tabtip-signal { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
  .tabtip-footrow { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; min-width: 0; }
  .tabtip-footrow .it-context { max-width: none; }
  .tabtip-why { border: 1px solid rgba(148,163,184,0.26); border-radius: 8px; background: rgba(148,163,184,0.07); padding: 0.58rem 0.65rem; display: flex; flex-direction: column; gap: 0.32rem; }
  .tabtip-sectionlabel { color: #94a3b8; font-size: 0.62rem; line-height: 1; font-weight: 850; text-transform: uppercase; letter-spacing: 0.055em; }
  .tabtip-whytext { color: var(--ink-2); font-size: 0.75rem; line-height: 1.45; word-break: break-word; overflow-wrap: anywhere; }
  .tabtip-note { padding-top: 0.68rem; border-top: 1px solid rgba(148,163,184,0.22); font-size: 0.7rem; line-height: 1.4; color: #94a3b8; word-break: break-word; overflow-wrap: anywhere; }
  .state { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; min-height: 1.28rem; font-size: 0.68rem; line-height: 1; font-weight: 800; letter-spacing: 0; padding: 0.18rem 0.55rem 0.16rem; border-radius: 7px; background: #f8fafc; color: #475569; border: 1px solid #64748b; font-family: ui-monospace, "Cascadia Mono", monospace; text-decoration: underline; text-underline-offset: 2px; box-shadow: inset 0 0 0 1px rgba(100,116,139,0.16); }
  .state.continue_ready { background: #ecfdf5; color: #059669; border-color: #047857; box-shadow: inset 0 0 0 1px rgba(4,120,87,0.18); }
  .state.needs_decision { background: #fff7ed; color: #ea580c; border-color: #c2410c; box-shadow: inset 0 0 0 1px rgba(194,65,12,0.18); }
  .state.needs_input { background: #fffbeb; color: #b45309; border-color: #92400e; box-shadow: inset 0 0 0 1px rgba(146,64,14,0.18); }
  .state.blocked { background: #fef2f2; color: #dc2626; border-color: #b91c1c; box-shadow: inset 0 0 0 1px rgba(185,28,28,0.18); }
  .state.needs_review { background: #ecfdf5; color: #0f766e; border-color: #0f766e; box-shadow: inset 0 0 0 1px rgba(15,118,110,0.18); }
  .state.followup_suggested { background: #eff6ff; color: #0284c7; border-color: #0369a1; box-shadow: inset 0 0 0 1px rgba(3,105,161,0.18); }
  .state.done { background: #f1f5f9; color: #475569; border-color: #64748b; box-shadow: inset 0 0 0 1px rgba(100,116,139,0.18); }
  .it-reason { font-size: 0.68rem; color: #9ca3af; margin-top: 0.2rem; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .it-title.pending { color: #9ca3af; font-weight: 500; }
  .prilabel { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; min-height: 1.08rem; min-width: 1.7rem; padding: 0.08rem 0.28rem; border-radius: 4px; background: transparent; color: var(--ink-3); cursor: pointer; font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.68rem; line-height: 1; font-weight: 800; letter-spacing: 0; font-variant-numeric: tabular-nums; }
  .prilabel.l1 { color: var(--priority-1-fg); background: var(--priority-1-bg); }
  .prilabel.l2 { color: var(--priority-2-fg); background: var(--priority-2-bg); }
  .prilabel.l3 { color: var(--priority-3-fg); background: var(--priority-3-bg); }
  .prilabel.l4 { color: var(--priority-4-fg); background: var(--priority-4-bg); }
  .prilabel.l5 { color: var(--priority-5-fg); background: var(--priority-5-bg); }
  .prilabel:hover { box-shadow: inset 0 0 0 1px rgba(100,116,139,0.28); }
  .b-eta { flex-shrink: 0; color: #b45309; background: #fffbeb; padding: 0.04rem 0.36rem; border-radius: 4px; cursor: pointer; font-variant-numeric: tabular-nums; }
  .b-eta:hover { background: #fef3c7; }
  .vtag, .ptag { flex-shrink: 0; display: inline-flex; align-items: center; border-radius: 999px; padding: 0.06rem 0.46rem; font-size: 0.66rem; font-family: ui-sans-serif, -apple-system, "Segoe UI", sans-serif; border: 1px solid transparent; }
  .vtag { font-weight: 700; letter-spacing: 0.01em; }
  .vtag.claude { color: #c2410c; background: #fff7ed; border-color: #fdba74; }
  .vtag.codex { color: #3730a3; background: #eef2ff; border-color: #a5b4fc; }
  .ptag { font-weight: 600; }
  #h-sig .score, #h-sig .eta { cursor: pointer; }
  /* a manually-pinned priority/ETA: dashed underline marks it as user-set */
  .prilabel.edited, .b-eta.edited, #h-sig .score.edited, #h-sig .eta.edited, .state.edited { text-decoration: underline dashed; text-underline-offset: 2px; }
  /* inline editor that replaces a badge while editing */
  .badge-edit { width: 3rem; font-size: 0.7rem; padding: 0 0.25rem; border: 1px solid #6366f1; border-radius: 3px; background: var(--input-bg); color: var(--ink); }
  .sigmenu { position: fixed; z-index: 80; width: min(9.75rem, calc(100vw - 20px)); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow-pop); padding: 0.25rem; }
  .sigmenu.info { width: min(24rem, calc(100vw - 20px)); }
  .sigmenu-opt { display: flex; align-items: center; gap: 0.45rem; min-width: 0; font-size: 0.76rem; color: var(--ink-2); padding: 0.35rem 0.5rem; border-radius: var(--radius-sm); cursor: pointer; }
  .sigmenu-opt:hover, .sigmenu-opt.on { background: var(--accent-soft); color: #3730a3; }
  .sigmenu-opt .prilabel { cursor: pointer; }
  .sigmenu-title { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #b45309; padding: 0.35rem 0.45rem 0.15rem; }
  .sigmenu-line { font-size: 0.74rem; line-height: 1.45; color: var(--ink-2); padding: 0.28rem 0.45rem 0.4rem; max-width: 24rem; white-space: normal; }
  .avoid-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.35rem; padding: 0.38rem 0.45rem 0.3rem; }
  .avoid-stat { min-width: 0; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 0.32rem 0.36rem; background: var(--surface-2); }
  .avoid-stat-k { font-size: 0.58rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-4); }
  .avoid-stat-v { margin-top: 0.1rem; font-size: 0.82rem; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #avoidPanel:not([hidden]) { position: absolute; left: 0; right: 0; bottom: calc(var(--composer-overlay-height) + var(--queue-overlay-height)); z-index: 22; }
  .avoidpanel { margin: 0 1.1rem; border: 1px solid var(--line); border-left: 3px solid #f59e0b; border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-sm); padding: 0.38rem 0.5rem; display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; align-items: center; gap: 0.55rem; }
  .avoidpanel-title { font-size: 0.62rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #b45309; white-space: nowrap; }
  .avoidpanel .avoid-stats { display: flex; gap: 0.45rem; padding: 0; }
  .avoidpanel .avoid-stat { display: inline-flex; align-items: baseline; gap: 0.18rem; border: 0; background: transparent; padding: 0; }
  .avoidpanel .avoid-stat-k { font-size: 0.58rem; color: var(--ink-4); }
  .avoidpanel .avoid-stat-v { margin: 0; font-size: 0.72rem; font-weight: 800; color: var(--ink-2); }
  .avoidpanel-draft { min-width: 0; padding: 0.26rem 0.42rem; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--ink-2); font-size: 0.72rem; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .avoidpanel-actions { display: flex; justify-content: flex-end; align-items: center; gap: 0.35rem; }
  .avoidpanel-draftbtn { font-size: 0.7rem; color: #0f766e; background: #ccfbf1; border-color: #99f6e4; box-shadow: none; padding: 0.18rem 0.5rem; }
  .avoidpanel-draftbtn:hover { color: #115e59; background: #99f6e4; border-color: #5eead4; }
  .avoidpanel-clear { font-size: 0.7rem; color: var(--ink-3); background: transparent; border-color: transparent; box-shadow: none; padding: 0.18rem 0.45rem; }
  .avoidpanel-clear:hover { color: #b91c1c; background: #fef2f2; border-color: transparent; }
  .b-ctx { overflow: hidden; text-overflow: ellipsis; }
  .sortsel { font-size: 0.72rem; border: 1px solid var(--line-2); border-radius: 4px; padding: 0.1rem 0.3rem; background: var(--input-bg); color: var(--ink-2); }
  /* main */
  .main { --composer-overlay-height: 8.5rem; --queue-overlay-height: 0px; --avoid-overlay-height: 0px; position: relative; flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--surface); }
  .head { padding: 0.75rem 1.1rem; border-bottom: 1px solid var(--line); display: flex; justify-content: flex-start; gap: 0.6rem; align-items: center; background: var(--panel-gradient); }
  .backbtn { display: none; flex-shrink: 0; color: var(--accent); }
  .headmain { min-width: 0; flex: 1; display: flex; flex-direction: column; }
  .headrow { display: flex; align-items: center; gap: 0.45rem; min-width: 0; }
  .headstatus { flex-shrink: 0; width: 0.68rem; height: 0.68rem; border-radius: 50%; border: 1.5px solid transparent; background: var(--status-read); cursor: pointer; transition: transform 0.1s, background 0.15s, border-color 0.15s, box-shadow 0.15s; }
  .headstatus:hover { transform: scale(1.45); }
  .headstatus.generating { background: transparent; border-color: var(--status-generating-soft); border-top-color: var(--status-generating); border-right-color: var(--status-generating); box-shadow: 0 0 0 2px var(--status-generating-soft); animation: statusSpin 0.82s linear infinite; }
  .headstatus.unread { background: var(--status-unread); border-color: var(--status-unread); box-shadow: 0 0 0 3px var(--status-unread-soft), 0 0 12px var(--status-unread-soft); }
  .headstatus.seen { background: transparent; border-color: var(--status-seen); box-shadow: none; }
  .headstatus.read { background: var(--status-read); border-color: transparent; box-shadow: none; opacity: 0.72; }
  .headbtn { margin-left: auto; width: 2.1rem; height: 2.1rem; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--ink-3); border: 0; background: transparent; padding: 0; line-height: 1; border-radius: var(--radius-sm); box-shadow: none; }
  .headbtn:hover:not(:disabled) { color: var(--accent); background: transparent; }
  .headbtn:disabled { color: var(--ink-4); background: transparent; }
  .headbtn svg { width: 1.08rem; height: 1.08rem; stroke: currentColor; stroke-width: 1.45; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .headbtn.busy svg { animation: spin 0.85s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes statusSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .head .t { min-width: 0; flex: 1; font-weight: 700; font-size: 0.98rem; letter-spacing: -0.01em; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .head .s { font-size: 0.72rem; color: #9ca3af; font-family: ui-monospace, monospace; }
  .head .s .sub-line { white-space: normal; overflow-wrap: anywhere; max-height: 4.5rem; overflow-y: auto; }
  .head .s .sub-line + .sub-line { margin-top: 0.1rem; }
  .head .s.brief { font-family: inherit; color: var(--ink-3); font-size: 0.78rem; max-width: 70ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #h-sig { display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; margin-top: 0.3rem; font-size: 0.72rem; }
  #h-sig .score { font-weight: 600; color: var(--ink-2); }
  #h-sig .brieftag { padding: 0.05rem 0.4rem; border-radius: 3px; background: #eef2ff; color: #3730a3; text-decoration: none; }
  #h-sig .brieftag:hover { background: #e0e7ff; }
  #h-sig .eta { color: #b45309; background: #fffbeb; padding: 0.05rem 0.4rem; border-radius: 3px; }
  #h-sig .briefref { color: #3730a3; background: #eef2ff; padding: 0.05rem 0.4rem; border-radius: 3px; }
  #h-sig .sig-reason { color: var(--ink-4); font-style: italic; }
  #h-sig .h-meta { color: var(--ink-3); font-family: ui-monospace, monospace; }
  #h-sig .it-tag { margin: 0; }
  #h-tags { margin-top: 0.45rem; display: flex; flex-direction: column; gap: 0.35rem; }
  .headtag-row { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; min-width: 0; }
  .headtag-row .it-tag { margin: 0; }
  .headtag-row .it-tag.auto { font-weight: 600; }
  .headtag-row .it-tag button { border: 0; background: transparent; color: inherit; font-size: 0.78rem; padding: 0; line-height: 1; box-shadow: none; }
  .headtag-row .it-tag button:hover { color: #b91c1c; background: transparent; }
  .headtag-row .it-context { max-width: min(38rem, 58%); }
  .headtag-add { font-size: 0.68rem; border: 1px solid transparent; color: #0f766e; padding: 0.12rem 0.5rem; border-radius: var(--radius-pill); box-shadow: none; background: transparent; }
  .headtag-add:hover { background: #f0fdfa; border-color: transparent; }
  .headtagedit { max-width: 28rem; }
  .sig { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; margin-top: 0.3rem; font-size: 0.72rem; color: var(--ink-3); }
  .sig .score { font-weight: 600; color: var(--ink-2); }
  .sig .reason { font-style: italic; }
  .sig .briefref { color: #2563eb; text-decoration: none; background: #eff6ff; padding: 0.05rem 0.4rem; border-radius: 3px; }
  .sig .eta { color: #047857; background: #ecfdf5; padding: 0.05rem 0.4rem; border-radius: 3px; }
  .topstack { display: none; margin: 0.65rem 1.1rem 0.5rem; padding: 0.42rem; border: 1px solid rgba(99,102,241,0.48); border-radius: 13px; background: rgba(238,242,255,0.42); box-shadow: 0 8px 20px -18px rgba(15,23,42,0.45), inset 0 0 0 1px rgba(255,255,255,0.38); flex-direction: column; gap: 0.4rem; }
  .topstack.show { display: flex; }
  .latestpin { display: none; border: 1px dashed rgba(99,102,241,0.58); border-radius: 10px; background: rgba(99,102,241,0.08); padding: 0.55rem 0.65rem; cursor: pointer; }
  .latestpin.show { display: flex; }
  .latestpin:focus-visible { outline: 2px solid var(--accent-ring); outline-offset: -3px; }
  .latestpin-body { flex: 1; min-width: 0; display: flex; align-items: center; gap: 0.65rem; overflow: hidden; }
  .latestpin-k { flex-shrink: 0; color: #3730a3; border: 1px solid rgba(79,70,229,0.42); background: rgba(99,102,241,0.12); border-radius: 8px; padding: 0.2rem 0.52rem; font-size: 0.64rem; line-height: 1; font-weight: 850; letter-spacing: 0.11em; text-transform: uppercase; font-family: ui-monospace, "Cascadia Mono", monospace; }
  .latestpin-arrow { margin-left: auto; flex-shrink: 0; color: #64748b; font-family: ui-monospace, "Cascadia Mono", monospace; }
  .latestpin-text { flex: 1; min-width: 0; max-width: none; background: transparent; color: var(--ink-2); border: 0; border-radius: 0; box-shadow: none; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", "Microsoft YaHei", sans-serif; font-size: 0.82rem; font-style: normal; font-weight: 500; line-height: 1.35; letter-spacing: 0; text-transform: none; font-variant: normal; font-variant-ligatures: none; font-feature-settings: "liga" 0, "clig" 0, "dlig" 0; text-rendering: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Back-compat for previews rendered by an older open tab before the next refresh. */
  .latestpin-body .bubble { flex: 1; min-width: 0; max-width: none; background: transparent; color: var(--ink-2); border: 0; border-radius: 0; box-shadow: none; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", "Microsoft YaHei", sans-serif; font-size: 0.82rem; line-height: 1.35; font-variant-ligatures: none; font-feature-settings: "liga" 0, "clig" 0, "dlig" 0; text-rendering: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .latestpin:hover { border-color: var(--accent); background: rgba(99,102,241,0.12); }
  .latestpin-body .bubble > :first-child { margin-top: 0; }
  .latestpin-body .bubble > :last-child { margin-bottom: 0; }
  .latestpin-body .bubble p { margin: 0; }
  .latestpin-body .bubble p + p { margin-top: 0.5em; }
  .latestpin-body .bubble a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
  .latestpin-body .bubble code { font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.92em; background: var(--accent-soft); color: var(--accent); border-radius: 4px; padding: 0.05em 0.3em; }
  .latestpin-body .bubble .filepath { color: var(--accent); }
  .pintray { display: none; flex-direction: column; gap: 0.52rem; }
  .pintray.show { display: flex; }
  .pinitem { width: 100%; min-width: 0; display: flex; align-items: center; gap: 0.65rem; border: 1px solid rgba(148,163,184,0.34); border-radius: 9px; background: rgba(255,255,255,0.56); padding: 0.4rem 0.58rem; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.22); }
  .pinitem:hover { border-color: var(--accent); }
  .pinrole { flex-shrink: 0; font-size: 0.66rem; line-height: 1; font-weight: 850; letter-spacing: 0.09em; text-transform: uppercase; color: #64748b; border: 1px solid rgba(148,163,184,0.34); border-radius: 8px; padding: 0.28rem 0.52rem; font-family: ui-monospace, "Cascadia Mono", monospace; }
  .pintext { flex: 1; min-width: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", "Microsoft YaHei", sans-serif; font-size: 0.86rem; line-height: 1.35; font-weight: 650; color: var(--ink-2); font-variant-ligatures: none; font-feature-settings: "liga" 0, "clig" 0, "dlig" 0; text-rendering: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pinx { flex-shrink: 0; border: 0; background: transparent; color: var(--ink-4); box-shadow: none; padding: 0.08rem 0.22rem; line-height: 1; font-size: 1.1rem; }
  .pinx:hover { color: #b91c1c; background: transparent; }
  #msgs { flex: 1; overflow-y: auto; padding: 1rem 1rem calc(var(--composer-overlay-height) + var(--queue-overlay-height) + var(--avoid-overlay-height) + 1rem); display: flex; flex-direction: column; gap: 0.6rem; }
  .msg { display: flex; align-items: center; gap: 0.28rem; }
  .msg.user { justify-content: flex-end; align-items: center; gap: 0.28rem; }
  /* hover-revealed controls for user/assistant bubbles */
  .msg-edit, .msg-pin, .msg-fold { flex-shrink: 0; opacity: 0; pointer-events: none; width: 1.72rem; height: 1.72rem; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 7px; background: var(--msg-control-bg); color: var(--ink-4); padding: 0; box-shadow: none; line-height: 1; transition: opacity 0.12s, color 0.12s, border-color 0.12s, background 0.12s, box-shadow 0.12s; }
  .msg-edit { order: -3; }
  .msg-fold { order: -1; }
  .msg-pin { order: 1; }
  .msg.user .msg-pin { order: -2; }
  .msg.assistant .msg-pin { order: 1; }
  .msg-edit svg, .msg-pin svg, .msg-fold svg { width: 0.98rem; height: 0.98rem; stroke: currentColor; stroke-width: 1.9; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .msg-pin .pin-body { fill: transparent; transition: fill 0.12s; }
  .msg:hover .msg-edit, .msg:hover .msg-pin, .msg:hover .msg-fold, .msg:focus-within .msg-edit, .msg:focus-within .msg-pin, .msg:focus-within .msg-fold, .msg-pin.on { opacity: 1; pointer-events: auto; }
  .msg-edit:hover, .msg-pin:hover, .msg-fold:hover { color: var(--ink); border-color: var(--msg-control-border); background: var(--msg-control-hover-bg); box-shadow: var(--shadow-sm); }
  .msg-pin.on { color: var(--accent); border-color: var(--msg-control-active-border); background: var(--msg-control-active-bg); }
  .msg-pin.on .pin-body { fill: rgba(79,70,229,0.16); }
  .msg.editing { justify-content: stretch; }
  .msg.editing .msg-edit { display: none; }
  .msg.editing .msg-pin { display: none; }
  .msg.editing .msg-fold { display: none; }
  .msg.editing .inline-edit { width: 100%; }
  /* shared in-place editor (sent-message resend + queued-draft edit) */
  .inline-edit { position: relative; width: 100%; --inline-edit-actions-space: 9.4rem; }
  .inline-edit-ta { display: block; width: 100%; box-sizing: border-box; resize: vertical; min-height: 2.2rem; font: inherit; font-size: 0.86rem; line-height: 1.5; padding: 0.5rem var(--inline-edit-actions-space) 0.5rem 0.65rem; border: 1px solid var(--accent); border-radius: var(--radius-sm); background: var(--input-bg); color: var(--ink); box-shadow: 0 0 0 3px var(--accent-ring); }
  .inline-edit.single-line .inline-edit-ta { min-height: calc(1.55em + 1.1rem); font-size: 0.88rem; line-height: 1.55; padding: calc(0.55rem - 1px) var(--inline-edit-actions-space) calc(0.55rem - 1px) 0.8rem; border-radius: 12px; border-bottom-right-radius: 4px; }
  .inline-edit-bar { position: absolute; right: 0.45rem; top: 50%; transform: translateY(-50%); display: flex; gap: 0.35rem; align-items: center; justify-content: flex-end; max-width: calc(100% - 0.9rem); }
  .inline-edit .inline-edit-save,
  .inline-edit .inline-edit-cancel { height: 1.62rem; min-height: 1.62rem; padding: 0 0.58rem; font-size: 0.78rem; line-height: 1; white-space: nowrap; box-shadow: var(--shadow-sm); }
  .inline-edit .inline-edit-save { color: var(--primary-fg); background: var(--primary-hover); border-color: var(--primary-hover); font-weight: 600; }
  .inline-edit .inline-edit-save:hover:not(:disabled) { background: var(--primary-bg); border-color: var(--primary-bg); box-shadow: 0 4px 14px var(--accent-ring); }
  .msg .bubble { min-width: 0; max-width: 76%; padding: 0.55rem 0.8rem; border-radius: 12px; font-size: 0.88rem; line-height: 1.55; white-space: normal; word-break: break-word; overflow-wrap: anywhere; box-shadow: var(--shadow-sm); }
  .msg.user .bubble { background: var(--accent); color: white; border-bottom-right-radius: 4px; }
  .msg.assistant .bubble { max-width: calc(100% - 2.4rem); background: var(--assistant-bg); color: var(--ink); border: 1px solid var(--assistant-border); border-bottom-left-radius: 4px; }
  .msg .bubble > :first-child { margin-top: 0; }
  .msg .bubble > :last-child { margin-bottom: 0; }
  .msg .bubble p { margin: 0; }
  .msg .bubble p + p { margin-top: 0.7em; }
  .msg .bubble ul, .msg .bubble ol { margin: 0.55em 0 0 1.2em; padding: 0; }
  .msg .bubble li + li { margin-top: 0.22em; }
  .msg .bubble blockquote { margin: 0.7em 0 0; padding-left: 0.8em; border-left: 3px solid rgba(148, 163, 184, 0.65); color: inherit; opacity: 0.92; }
  .msg .bubble pre { margin: 0.7em 0 0; padding: 0.65em 0.8em; border-radius: 8px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
  .msg.assistant .bubble pre { background: var(--code-bg); color: var(--ink); }
  .msg.user .bubble pre { background: rgba(255,255,255,0.16); color: white; }
  .msg .bubble code { font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.92em; border-radius: 4px; padding: 0.08em 0.28em; }
  .msg.assistant .bubble code { background: var(--code-bg); color: var(--ink); }
  .msg.user .bubble code { background: rgba(255,255,255,0.18); color: white; }
  .msg .bubble pre code { background: transparent; padding: 0; border-radius: 0; }
  .msg .bubble .diagram { position: relative; margin: 0.7em 0 0; padding: 0.65em 0.8em; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.38); background: #fff; overflow: auto; }
  .msg .bubble .diagram[data-rendered="ok"] { cursor: zoom-in; }
  .msg.user .bubble .diagram { border-color: rgba(255,255,255,0.35); background: rgba(255,255,255,0.12); }
  .msg .bubble .diagram svg, .msg .bubble .diagram img { display: block; max-width: 100%; height: auto; }
  .msg .bubble .diagram-status, .msg .bubble .diagram-error { color: #6b7280; font-size: 0.78rem; font-style: italic; }
  .msg.user .bubble .diagram-status, .msg.user .bubble .diagram-error { color: rgba(255,255,255,0.82); }
  .msg .bubble .diagram-error { color: #b91c1c; }
  .msg.user .bubble .diagram-error { color: #fecaca; }
  .msg .bubble .diagram-fallback { margin-top: 0.45em; }
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
  .msg.thinking .bubble { color: var(--ink-3); font-style: italic; background: var(--soft-card); border: 1px dashed var(--line); }
  .msg.thinking .bubble::after { content: ""; display: inline-block; width: 0.5em; height: 0.5em; margin-left: 0.4em; border-radius: 50%; background: #9ca3af; animation: gpulse 1s ease-in-out infinite; }
  @keyframes gpulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
  .msg.error .bubble { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .folded-away { display: none !important; }
  .turnfold-row { display: flex; justify-content: flex-end; }
  .turnfold-card { max-width: min(34rem, 76%); min-width: min(18rem, 76%); display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.55rem; padding: 0.46rem 0.62rem; border: 1px dashed rgba(99,102,241,0.52); border-radius: 10px; background: rgba(99,102,241,0.07); color: var(--ink-2); box-shadow: none; text-align: left; }
  .turnfold-card:hover { border-color: var(--accent); background: rgba(99,102,241,0.11); }
  .turnfold-card:focus-visible { outline: 2px solid var(--accent-ring); outline-offset: -2px; }
  .turnfold-ico { color: var(--accent); font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.86rem; line-height: 1; }
  .turnfold-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.82rem; line-height: 1.35; font-weight: 650; color: var(--ink); }
  .turnfold-meta { flex-shrink: 0; font-size: 0.64rem; line-height: 1; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-4); font-family: ui-monospace, "Cascadia Mono", monospace; white-space: nowrap; }
  .toast-host { position: fixed; right: 1rem; bottom: 1rem; z-index: 140; display: flex; flex-direction: column; gap: 0.45rem; align-items: flex-end; pointer-events: none; }
  .toast { max-width: min(24rem, calc(100vw - 2rem)); border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--surface); color: var(--ink); box-shadow: var(--shadow-pop); padding: 0.62rem 0.75rem; font-size: 0.78rem; line-height: 1.35; opacity: 0.98; transform: translateY(0); transition: opacity 0.18s, transform 0.18s; }
  .toast.warn { border-color: #f59e0b; background: #fffbeb; color: #92400e; }
  .toast.ok { border-color: #34d399; background: #ecfdf5; color: #065f46; }
  .toast.hide { opacity: 0; transform: translateY(0.35rem); }
  .unlock { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; background: var(--canvas); color: var(--ink); padding: 1rem; }
  .unlock[hidden] { display: none; }
  .unlock-panel { width: min(25rem, 100%); border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-pop); padding: 1rem; }
  .unlock-title { font-size: 1rem; font-weight: 800; margin-bottom: 0.35rem; }
  .unlock-sub { font-size: 0.78rem; line-height: 1.4; color: var(--ink-3); margin-bottom: 0.75rem; }
  .unlock-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.5rem; }
  .unlock-input { min-width: 0; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); color: var(--ink); padding: 0.55rem 0.65rem; font-size: 0.88rem; }
  .unlock-btn { border: 1px solid var(--accent); border-radius: var(--radius-sm); background: var(--accent); color: white; padding: 0.55rem 0.75rem; font-weight: 800; cursor: pointer; }
  .unlock-msg { min-height: 1.1rem; margin-top: 0.55rem; color: #b91c1c; font-size: 0.76rem; }
  .tool { align-self: flex-start; font-family: ui-monospace, monospace; font-size: 0.72rem; color: #5b21b6; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; padding: 0.2rem 0.5rem; }
  .toolc { align-self: flex-start; max-width: 88%; font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.74rem; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; }
  .toolc > summary { cursor: pointer; padding: 0.28rem 0.6rem; color: #5b21b6; list-style: none; user-select: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .toolc > summary::-webkit-details-marker { display: none; }
  .toolc > summary::before { content: "▸ "; color: #a78bda; }
  .toolc[open] > summary::before { content: "▾ "; }
  .toolc[open] > summary { border-bottom: 1px solid #ede9fe; }
  .toolc pre { margin: 0; padding: 0.45rem 0.6rem; white-space: pre-wrap; word-break: break-word; max-height: 340px; overflow: auto; }
  .toolc .tool-in { color: #4b5563; }
  .toolc .tool-out { color: var(--ink); background: var(--surface); border-top: 1px solid #ede9fe; }
  .toolc .tool-out.err { color: #991b1b; background: #fef2f2; }
  /* git-diff-style rendering for Edit / MultiEdit / Write (expanded by default) */
  .toolc .diff { background: var(--surface); border-top: 1px solid #ede9fe; overflow: auto; max-height: 460px; font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.74rem; }
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
  .rt, .rq, .rplan { background: var(--surface); border-top: 1px solid #ede9fe; padding: 0.45rem 0.65rem; }
  .rt { display: flex; flex-direction: column; gap: 0.18rem; }
  .rt-note { font-size: 0.74rem; color: #6b7280; font-style: italic; margin-bottom: 0.2rem; }
  .todo-row { display: flex; gap: 0.45rem; align-items: flex-start; font-size: 0.8rem; line-height: 1.45; font-family: ui-sans-serif, -apple-system, sans-serif; }
  .todo-ic { flex-shrink: 0; width: 1em; text-align: center; }
  .todo-row.done .todo-tx { color: #9ca3af; text-decoration: line-through; }
  .todo-row.done .todo-ic { color: #16a34a; }
  .todo-row.doing .todo-tx { color: var(--ink); font-weight: 600; }
  .todo-row.doing .todo-ic { color: #2563eb; }
  .todo-row.todo .todo-ic { color: #9ca3af; }
  .rq { display: flex; flex-direction: column; gap: 0.3rem; }
  .q-card { border: 1px solid var(--line); border-radius: 8px; background: var(--soft-card); padding: 0.45rem 0.5rem; display: flex; flex-direction: column; gap: 0.35rem; }
  .q-head { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em; color: #6366f1; font-weight: 700; }
  .q-text { font-size: 0.82rem; color: var(--ink); line-height: 1.45; }
  .q-opt { border: 1px solid var(--line); border-radius: 6px; padding: 0.3rem 0.5rem; background: var(--surface); }
  .q-choice { display: flex; gap: 0.45rem; align-items: flex-start; cursor: pointer; }
  .q-choice input { margin-top: 0.18rem; }
  .q-choice-body { display: block; flex: 1; min-width: 0; }
  .q-opt-label { font-weight: 600; font-size: 0.8rem; color: var(--ink); display: block; }
  .q-opt-desc { font-size: 0.74rem; color: var(--ink-3); display: block; margin-top: 0.12rem; line-height: 1.4; }
  .q-free { width: 100%; box-sizing: border-box; border: 1px solid var(--line-2); border-radius: 6px; padding: 0.38rem 0.5rem; font: inherit; font-size: 0.78rem; background: var(--input-bg); color: var(--ink); }
  .q-actions { display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; }
  .q-submit { background: var(--primary-bg); color: var(--primary-fg); border: 1px solid var(--primary-bg); border-radius: 6px; padding: 0.34rem 0.7rem; font: inherit; font-size: 0.76rem; cursor: pointer; }
  .q-submit:disabled { opacity: 0.65; cursor: default; }
  .q-err { font-size: 0.74rem; color: #b91c1c; }
  .rq.busy { opacity: 0.8; }
  .rplan { white-space: pre-wrap; word-break: break-word; font-size: 0.8rem; line-height: 1.5; color: var(--ink-2); max-height: 420px; overflow: auto; }
  .placeholder { margin: auto; color: #9ca3af; text-align: center; font-size: 0.9rem; max-width: 32ch; line-height: 1.5; }
  .foot { position: absolute; left: 0; right: 0; bottom: 0; z-index: 20; border-top: 0; padding: 0 1.1rem 1rem; background: transparent; }
  body.no-session #queue, body.no-session .foot { display: none; }
  .composer { min-width: 0; display: flex; flex-direction: column; gap: 0.35rem; border: 1px solid var(--line-2); border-radius: var(--radius); padding: 0.45rem; background: var(--input-bg); box-shadow: var(--shadow-sm); transition: background 0.15s, box-shadow 0.15s, border-color 0.15s; }
  .composer:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
  .composer.drop { border-color: #818cf8; background: var(--drop-bg); box-shadow: 0 0 0 4px rgba(99,102,241,0.12), 0 0 0 1px #818cf8; }
  .composerrow { display: flex; flex-direction: column; gap: 0.38rem; align-items: stretch; }
  .composer textarea { flex: 0 0 2rem; min-width: 0; width: 100%; resize: none; height: 2rem; min-height: 2rem; max-height: 2rem; padding: 0.3rem 0.35rem; border: 0; border-radius: var(--radius-sm); font: inherit; font-size: 0.88rem; line-height: 1.45; background: transparent; color: var(--ink); box-shadow: none; overflow-y: auto; }
  .composer textarea:focus { box-shadow: none; }
  .composeractions { display: flex; justify-content: flex-end; align-items: center; gap: 0.32rem; min-width: 0; flex-wrap: wrap; }
  .runconfig-anchor { position: relative; flex: 1 1 7rem; min-width: 0; max-width: 13rem; }
  .composer .attachpick { position: static; transform: none; width: 1.5rem; height: 1.5rem; flex-shrink: 0; color: var(--ink-3); }
  .composer .attachpick svg { width: 0.74rem; height: 0.74rem; stroke-width: 1.65; }
  .composer .attachpick:active { transform: translateY(0.5px); }
  .attachtray { display: none; flex-wrap: wrap; gap: 0.35rem; }
  .attachtray.show { display: flex; }
  .attachchip { display: inline-flex; align-items: center; gap: 0.34rem; min-width: 0; max-width: 100%; padding: 0.18rem 0.45rem; border-radius: 999px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink-2); font-size: 0.72rem; box-shadow: var(--shadow-sm); }
  .attachchip .kind { flex-shrink: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #4338ca; background: #eef2ff; border-radius: 999px; padding: 0.04rem 0.28rem; }
  .attachchip .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .attachchip button { border: 0; background: transparent; color: #64748b; box-shadow: none; padding: 0; font-size: 0.88rem; line-height: 1; }
  .attachchip button:hover { color: #b91c1c; background: transparent; }
  .attachmsg { display: none; font-size: 0.72rem; line-height: 1.4; color: #64748b; }
  .attachmsg.show { display: block; }
  .attachmsg.err { color: #b91c1c; }
  .msg .attachments { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-top: 0.55rem; }
  .msg .attcard { display: inline-flex; align-items: center; gap: 0.45rem; max-width: min(18rem, 100%); min-width: 0; border: 1px solid rgba(148, 163, 184, 0.42); border-radius: 8px; padding: 0.36rem 0.48rem; color: inherit; text-decoration: none; background: rgba(255,255,255,0.14); }
  .msg.assistant .attcard { background: var(--surface); color: var(--ink-2); }
  .msg .attcard:hover { border-color: rgba(99,102,241,0.62); }
  .msg .attcard .kind { flex-shrink: 0; font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #4338ca; background: #eef2ff; border-radius: 999px; padding: 0.08rem 0.32rem; }
  .msg .attcard .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.76rem; }
  .msg .attcard.image { flex-direction: column; align-items: flex-start; gap: 0.32rem; width: 10.5rem; padding: 0.38rem; }
  .msg .attcard.image img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 6px; background: rgba(15,23,42,0.12); }
  .msg .attcard.image .attmeta { display: flex; align-items: center; gap: 0.35rem; width: 100%; min-width: 0; }
  .imgpreview { position: fixed; inset: 0; z-index: 120; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.65rem; padding: 1.25rem; background: rgba(2,6,23,0.82); }
  .imgpreview[hidden] { display: none; }
  .imgpreview-viewport { width: min(96vw, 1280px); height: min(82vh, calc(100vh - 5.5rem)); overflow: hidden; display: flex; align-items: center; justify-content: center; cursor: grab; touch-action: none; }
  .imgpreview-viewport.dragging { cursor: grabbing; }
  .imgpreview-stage { max-width: 100%; max-height: 100%; transform-origin: center center; will-change: transform; }
  .imgpreview img, .imgpreview-html > svg { display: block; max-width: min(96vw, 1280px); max-height: min(82vh, calc(100vh - 5.5rem)); width: auto; height: auto; object-fit: contain; border-radius: 8px; background: rgba(255,255,255,0.04); box-shadow: 0 22px 60px rgba(0,0,0,0.46); }
  .imgpreview-html:empty { display: none; }
  .imgpreview-html > svg { background: #fff; padding: 0.5rem; box-sizing: border-box; }
  .imgpreview-bar { width: min(96vw, 1280px); display: flex; align-items: center; gap: 0.75rem; color: #e5e7eb; }
  .imgpreview-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.82rem; }
  .foot button.send { height: 1.8rem; min-height: 1.8rem; background: var(--primary-hover); color: var(--primary-fg); border-color: var(--primary-hover); padding: 0 0.78rem; font-weight: 600; box-shadow: var(--shadow-sm); }
  .foot button.send:hover:not(:disabled) { background: var(--primary-bg); border-color: var(--primary-bg); box-shadow: 0 4px 14px var(--accent-ring); }
  .foot button.send.stopping { background: #b91c1c; border-color: #b91c1c; }
  .foot button.send.stopping:hover { background: #991b1b; }
  .foot button.runbtn { width: 100%; height: 1.8rem; min-height: 1.8rem; max-width: 13rem; color: #334155; border-color: #cbd5e1; background: var(--surface); padding: 0 0.58rem; font-size: 0.72rem; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .foot button.runbtn:hover:not(:disabled) { background: var(--surface-2); border-color: #94a3b8; }
  .foot button.runbtn.dirty { color: #3730a3; border-color: #a5b4fc; background: #eef2ff; }
  .foot button.runbtn:disabled { color: #cbd5e1; background: var(--surface-2); cursor: default; }
  /* messages typed mid-turn: queued client-side, pinned above the composer
   *  (Codex-style), each editable/removable, and sendable on demand. */
  #queue { position: absolute; left: 0; right: 0; bottom: var(--composer-overlay-height); z-index: 21; display: flex; flex-direction: column; gap: 0.3rem; max-height: 30vh; overflow-y: auto; padding: 0.4rem 1rem 0; }
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
  .qitem.editing .qeditta { width: 100%; box-sizing: border-box; resize: vertical; min-height: 2.4rem; font: inherit; font-size: 0.84rem; line-height: 1.5; padding: 0.52rem 0.64rem; border: 1px solid var(--accent); border-radius: var(--radius-sm); background: var(--input-bg); color: var(--ink); box-shadow: 0 0 0 3px var(--accent-ring); }
  .foot button.splitbtn { height: 1.8rem; min-height: 1.8rem; color: #5b21b6; border-color: #ddd6fe; background: #f5f3ff; padding: 0 0.68rem; }
  .foot button.splitbtn:hover:not(:disabled) { background: #ede9fe; }
  .foot button.splitbtn:disabled { color: #c4b5fd; background: #faf5ff; cursor: default; }
  .forkpop { position: absolute; right: 1.1rem; bottom: calc(100% + 0.55rem); z-index: 55; width: min(390px, calc(100vw - 2rem)); border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-pop); padding: 0.75rem; display: flex; flex-direction: column; gap: 0.55rem; }
  .forkpop[hidden] { display: none; }
  .forkpop::after { content: ""; position: absolute; right: 2.1rem; bottom: -0.42rem; width: 0.75rem; height: 0.75rem; background: var(--surface); border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); transform: rotate(45deg); }
  .forkhead { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
  .forkttl { font-size: 0.72rem; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; }
  .forkhint { font-size: 0.7rem; color: var(--ink-4); text-align: right; line-height: 1.35; }
  .forkpop select { font-size: 0.8rem; padding: 0.4rem 0.55rem; border: 1px solid var(--line-2); border-radius: var(--radius-sm); width: 100%; background-color: var(--surface); color: var(--ink-2); }
  .forkpop .newrow { align-items: flex-end; }
  .forkpop .pickgrp.vendor { flex: 1.15; }
  .forkmsg { min-height: 1rem; font-size: 0.72rem; color: var(--ink-4); line-height: 1.35; }
  .forkmsg.err { color: #b91c1c; }
  .forkactions { display: flex; gap: 0.45rem; justify-content: flex-end; }
  .forkprimary { color: var(--primary-fg); background: var(--primary-bg); border-color: var(--primary-bg); font-weight: 600; }
  .forkprimary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
  .runpop { right: 0; width: min(330px, calc(100vw - 2rem)); }
  .runpop::after { right: 2.2rem; }
  .runpop .selectmenu { top: auto; bottom: calc(100% + 4px); }
  .pill { font-size: 0.66rem; padding: 0.05rem 0.4rem; border-radius: 3px; background: #ede9fe; color: #5b21b6; }
  html[data-theme="dark"] .viewtab.on,
  html[data-theme="dark"] .viewtabgroup.on,
  html[data-theme="dark"] #h-sig .brieftag,
  html[data-theme="dark"] #h-sig .briefref,
  html[data-theme="dark"] .sig .briefref { color: #c7d2fe; background: #1e1b4b; border-color: #6366f1; }
  html[data-theme="dark"] .viewtabgroup.on { box-shadow: 0 0 0 1px rgba(129,140,248,0.24); }
  html[data-theme="dark"] .viewtabgroup.on .viewtab.on { background: transparent; box-shadow: none; }
  html[data-theme="dark"] .viewtabgroup.on .viewtabx { border-left-color: rgba(129,140,248,0.26); }
  html[data-theme="dark"] .viewtabgroup.on .viewtabx:hover { color: #fecdd3; background: rgba(127,29,29,0.28); }
  html[data-theme="dark"] .prilabel:hover { box-shadow: inset 0 0 0 1px rgba(203,213,225,0.28); }
  html[data-theme="dark"] .prilabel.l1 { color: #fca5a5; background: rgba(220,38,38,0.14); }
  html[data-theme="dark"] .prilabel.l2 { color: #fbbf24; background: rgba(245,158,11,0.14); }
  html[data-theme="dark"] .prilabel.l3 { color: #5eead4; background: rgba(16,185,129,0.14); }
  html[data-theme="dark"] .prilabel.l4 { color: #93c5fd; background: rgba(37,99,235,0.14); }
  html[data-theme="dark"] .prilabel.l5 { color: #cbd5e1; background: rgba(100,116,139,0.16); }
  html[data-theme="dark"] .b-eta,
  html[data-theme="dark"] #h-sig .eta { color: #fde68a; background: #3a2608; }
  html[data-theme="dark"] .sig .eta { color: #86efac; background: #052e1c; }
  html[data-theme="dark"] .state { background: rgba(100,116,139,0.16); color: #cbd5e1; border-color: #64748b; box-shadow: inset 0 0 0 1px rgba(148,163,184,0.18); }
  html[data-theme="dark"] .state.continue_ready { background: rgba(16,185,129,0.14); color: #34d399; border-color: #0f766e; box-shadow: inset 0 0 0 1px rgba(45,212,191,0.16); }
  html[data-theme="dark"] .state.needs_decision { background: rgba(249,115,22,0.14); color: #fdba74; border-color: #c2410c; box-shadow: inset 0 0 0 1px rgba(251,146,60,0.16); }
  html[data-theme="dark"] .state.needs_input { background: rgba(245,158,11,0.14); color: #fbbf24; border-color: #b45309; box-shadow: inset 0 0 0 1px rgba(251,191,36,0.16); }
  html[data-theme="dark"] .state.blocked { background: rgba(220,38,38,0.14); color: #fca5a5; border-color: #b91c1c; box-shadow: inset 0 0 0 1px rgba(248,113,113,0.16); }
  html[data-theme="dark"] .state.needs_review { background: rgba(20,184,166,0.14); color: #5eead4; border-color: #0f766e; box-shadow: inset 0 0 0 1px rgba(94,234,212,0.16); }
  html[data-theme="dark"] .state.followup_suggested { background: rgba(14,165,233,0.14); color: #38bdf8; border-color: #0369a1; box-shadow: inset 0 0 0 1px rgba(56,189,248,0.16); }
  html[data-theme="dark"] .state.done { background: rgba(100,116,139,0.16); color: #94a3b8; border-color: #64748b; box-shadow: inset 0 0 0 1px rgba(148,163,184,0.16); }
  html[data-theme="dark"] .bulkarchive { color: #fda4af; background: transparent; box-shadow: none; }
  html[data-theme="dark"] .bulkarchive:hover:not(:disabled) { color: #fecdd3; background: transparent; box-shadow: none; }
  html[data-theme="dark"] .bulkarchive:disabled { color: var(--ink-4); background: transparent; box-shadow: none; }
  html[data-theme="dark"] .it-context .vtag.claude { color: #f0ab8a; }
  html[data-theme="dark"] .it-context .vtag.codex { color: #c4b5fd; }
  html[data-theme="dark"] .it-context .ptag { color: var(--project-fg-dark, #cbd5e1); }
  html[data-theme="dark"] .it-context .ctx-prompts { color: #d8b4fe; }
  html[data-theme="dark"] .tabtip-line { color: #cbd5e1; }
  html[data-theme="dark"] .tipmeta,
  html[data-theme="dark"] .tabtip-why { background: rgba(148,163,184,0.08); border-color: rgba(148,163,184,0.22); }
  html[data-theme="dark"] .tipmeta-v,
  html[data-theme="dark"] .tabtip-whytext { color: #dbe4ee; }
  html[data-theme="dark"] .tipmeta .vtag.claude { color: #f0ab8a; background: transparent; border-color: transparent; }
  html[data-theme="dark"] .tipmeta .vtag.codex { color: #c4b5fd; background: transparent; border-color: transparent; }
  html[data-theme="dark"] .tipmeta .ptag { color: var(--project-fg-dark, #cbd5e1); }
  html[data-theme="dark"] .msg.error .bubble,
  html[data-theme="dark"] .toolc .tool-out.err { background: #451a1a; color: #fecaca; border-color: #7f1d1d; }
  html[data-theme="dark"] .tool,
  html[data-theme="dark"] .toolc,
  html[data-theme="dark"] .toolc .diff-file,
  html[data-theme="dark"] .toolc .diff-sep { background: #1e1b4b; border-color: #4c1d95; color: #c4b5fd; }
  html[data-theme="dark"] .toolc > summary,
  html[data-theme="dark"] .toolc .diff-file-title,
  html[data-theme="dark"] .toolc .diff-file-meta { color: #c4b5fd; }
  html[data-theme="dark"] .dline.add { background: #052e1c; color: #bbf7d0; }
  html[data-theme="dark"] .dline.del { background: #451a1a; color: #fecaca; }
  html[data-theme="dark"] .dline.ctx { color: var(--ink-3); }
  html[data-theme="dark"] .dline.meta { background: #1e1b4b; color: #c4b5fd; }
  html[data-theme="dark"] .qitem { background: #1e1b4b; border-color: #4f46e5; }
  html[data-theme="dark"] .qitem .qtag { color: #c7d2fe; background: #312e81; }
  html[data-theme="dark"] .qitem .qtext { color: #ddd6fe; }
  html[data-theme="dark"] .qitem button.qsend { background: #4f46e5; border-color: #4f46e5; }
  html[data-theme="dark"] .qitem button.qdel { color: #fecaca; border-color: #7f1d1d; }
  html[data-theme="dark"] .foot button.runbtn { color: #cbd5e1; border-color: #475569; background: #172033; }
  html[data-theme="dark"] .foot button.runbtn:hover:not(:disabled) { background: #1e293b; border-color: #64748b; }
  html[data-theme="dark"] .foot button.runbtn.dirty { color: #dbe4ff; border-color: #818cf8; background: rgba(99,102,241,0.22); }
  html[data-theme="dark"] .topstack { background: rgba(30,41,59,0.72); border-color: rgba(99,102,241,0.58); box-shadow: 0 18px 34px -24px rgba(0,0,0,0.72), inset 0 0 0 1px rgba(99,102,241,0.18); }
  html[data-theme="dark"] .topstack-title { color: #748196; }
  html[data-theme="dark"] .topstack-title::before { color: #a5b4fc; }
  html[data-theme="dark"] .latestpin { background: rgba(49,46,129,0.22); border-color: rgba(99,102,241,0.62); }
  html[data-theme="dark"] .latestpin:hover { background: rgba(49,46,129,0.34); border-color: #818cf8; }
  html[data-theme="dark"] .latestpin-k { color: #c7d2fe; border-color: rgba(129,140,248,0.54); background: rgba(99,102,241,0.22); }
  html[data-theme="dark"] .latestpin-arrow { color: #94a3b8; }
  html[data-theme="dark"] .pinitem { background: rgba(30,41,59,0.72); border-color: #2f3a4a; box-shadow: inset 0 0 0 1px rgba(148,163,184,0.08); }
  html[data-theme="dark"] .pinitem:hover { border-color: #818cf8; }
  html[data-theme="dark"] .pinrole { color: #94a3b8; border-color: #344256; background: rgba(15,23,42,0.22); }
  html[data-theme="dark"] .pintext { color: #dbe4ee; }
  html[data-theme="dark"] .msg-pin.on .pin-body { fill: rgba(129,140,248,0.2); }
  html[data-theme="dark"] .gtagdel:hover,
  html[data-theme="dark"] .it-tag button:hover,
  html[data-theme="dark"] .qitem button.qdel:hover { background: #451a1a; color: #fecaca; border-color: #7f1d1d; }
  /* custom tags + "+ tag" buttons: brighter teal on dark so the text stays legible */
  html[data-theme="dark"] .gtag:not(.auto):not(.on) .gtagbtn,
  html[data-theme="dark"] .it-tag:not(.auto),
  html[data-theme="dark"] .tagadd-compact,
  html[data-theme="dark"] .it-tagadd,
  html[data-theme="dark"] .headtag-add { color: #5eead4; }
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
    .forkpop { right: 1rem; left: 1rem; width: auto; }
    .runpop { right: 0; left: auto; width: min(330px, calc(100vw - 2rem)); }
    .forkpop::after { right: 5.6rem; }
    .runpop::after { right: 9.6rem; }
    .backbtn { display: inline-flex; align-items: center; }
    .head .s .sub-line { max-height: 3rem; }
    .msg .bubble { max-width: 88%; }
    .msg.assistant .bubble { max-width: calc(100% - 2.4rem); }
    .turnfold-card { max-width: 88%; min-width: min(18rem, 88%); }
  }
`;

function formatSessionsPerHour(value: number): string {
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1);
}

function formatCharsPerHour(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pathBaseName(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/\/+$/g, "");
  if (!normalized) return "";
  return normalized.slice(normalized.lastIndexOf("/") + 1) || normalized;
}

function fallbackPageTitle(roots: string[]): string {
  if (!roots.length) return "Attend — console";
  const first = pathBaseName(roots[0] ?? "") || roots[0] || "console";
  return roots.length === 1 ? `Attend — ${first}` : `Attend — ${first} +${roots.length - 1}`;
}

function brandScopeLabel(pageTitle: string): string {
  return pageTitle.replace(/^Attend\s*[—-]\s*/, "").trim() || "console";
}

export function renderConsole(v: ConsoleView): string {
  const sessJson = JSON.stringify(v.sessions).replace(/</g, "\\u003c");
  const dirsJson = JSON.stringify(v.knownDirs).replace(/</g, "\\u003c");
  const rootsJson = JSON.stringify(v.scopeRoots).replace(/</g, "\\u003c");
  const pageTitle = (v.pageTitle ?? "").trim() || fallbackPageTitle(v.scopeRoots);
  const brandScope = brandScopeLabel(pageTitle);
  const pageTitleJson = JSON.stringify(pageTitle).replace(/</g, "\\u003c");
  const vendorsJson = JSON.stringify(v.vendors).replace(/</g, "\\u003c");
  const claudeModelsJson = JSON.stringify(v.claudeModels).replace(/</g, "\\u003c");
  const codexModelsJson = JSON.stringify(v.codexModels).replace(/</g, "\\u003c");
  const tagsJson = JSON.stringify(v.tags).replace(/</g, "\\u003c");
  const vaultStateJson = JSON.stringify(v.vaultState ?? {}).replace(/</g, "\\u003c");
  const e2eeJson = JSON.stringify(v.e2ee ?? { enabled: false }).replace(/</g, "\\u003c");

  const sph = formatSessionsPerHour(v.sessionsPerHour);
  const cph = formatCharsPerHour(v.charsPerHour);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtmlText(pageTitle)}</title><script>
(function(){
  var saved = ${JSON.stringify(v.vaultState?.theme ?? "")};
  var dark = saved ? saved === 'dark' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
</script><style>${STYLE}</style></head>
<body class="no-session">
<div class="side">
  <header class="brand">
    <div class="brand-id">
      <span class="brand-name">Attend</span>
      <span class="brand-scope" title="${escapeHtmlText(pageTitle)}">${escapeHtmlText(brandScope)}</span>
      <div class="brand-stats" aria-label="24 hour throughput">
        <span class="statcard" title="sessions / hr · 24h">
          <span id="sessionsPerHour" class="statval">${sph}</span>
          <span class="statlbl">sessions/H</span>
        </span>
        <span class="statcard" title="chars / hr · 24h">
          <span id="charsPerHour" class="statval">${cph}</span>
          <span class="statlbl">chars/H</span>
        </span>
      </div>
    </div>
    <button id="themeToggle" class="theme-toggle" type="button" title="toggle dark theme" aria-label="toggle dark theme" aria-pressed="false">
      <svg class="theme-moon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M13.2 10.2A5.6 5.6 0 0 1 5.8 2.8a5.7 5.7 0 1 0 7.4 7.4z"></path>
      </svg>
      <svg class="theme-sun" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="3.2"></circle>
        <path d="M8 1.2v1.3M8 13.5v1.3M1.2 8h1.3M13.5 8h1.3M3.2 3.2l.9.9M11.9 11.9l.9.9M12.8 3.2l-.9.9M4.1 11.9l-.9.9"></path>
      </svg>
    </button>
  </header>
  <div class="topnav">
    <div class="searchwrap">
      <svg class="search-ico" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="7" cy="7" r="4.2"></circle>
        <path d="M10.2 10.2 14 14"></path>
      </svg>
      <input id="search" class="searchbox" placeholder="Search sessions…" autocomplete="off">
    </div>
    <button id="newToggle" aria-expanded="false">+ new</button>
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
    <div class="newattach" id="newAttachDrop">
      <div class="attachtray" id="newAttachTray"></div>
      <div class="newmsgrow">
        <textarea id="np" rows="2" placeholder="first message (optional · Enter to start · Shift+Enter for newline · drag files/images here)"></textarea>
        <button id="nattach" class="attachpick" type="button" title="Attach files" aria-label="Attach files">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6.2 8.9l3.9-3.9a2.1 2.1 0 0 1 3 3l-5.2 5.2a3.4 3.4 0 0 1-4.8-4.8l5.7-5.7a4.6 4.6 0 0 1 6.5 6.5l-5.8 5.8"></path>
          </svg>
        </button>
        <input id="nfile" type="file" multiple hidden>
      </div>
      <div class="attachmsg" id="newAttachMsg"></div>
    </div>
    <button id="nbtn" class="send nbtn-primary">start session ▸</button>
    <div class="nmsg" id="nmsg"></div>
  </div>
  <div class="tagbar">
    <div class="viewrow">
      <div class="viewtabs" id="viewTabs"></div>
    </div>
    <div class="taghead">
      <div class="taghead-label">
        <span class="tagttl">tags</span>
        <button id="tagModeToggle" class="tagmode-toggle instant-tip instant-tip-left" type="button" aria-pressed="false" data-tooltip="Show sessions matching any selected tag. Click to require all selected tags.">show sessions with <span id="tagModeValue">any</span> <span id="tagModeNoun">tag</span></button>
      </div>
      <button id="bulkArchiveSeen" class="bulkarchive instant-tip instant-tip-right" type="button" disabled data-tooltip="No seen sessions matching the current view and focus filters to archive">archive 0 seen sessions in this view</button>
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
  <div class="topstack" id="topStack" aria-hidden="true">
    <div class="pintray" id="pinTray" aria-hidden="true"></div>
    <div class="latestpin" id="latestPin" aria-hidden="true" role="button" tabindex="0" aria-label="jump to latest user message">
      <div class="latestpin-body" id="latestPinBody"></div>
    </div>
  </div>
  <div id="msgs"><div class="placeholder" id="ph">Pick a session on the left to see its chat, then type below to continue it — all in the browser.</div></div>
  <div id="avoidPanel" hidden></div>
  <div id="queue"></div>
  <div class="foot">
    <div class="composer" id="composer">
      <div class="attachtray" id="attachTray"></div>
      <div class="composerrow">
        <textarea id="input" placeholder="message (Enter to send · Shift+Enter for newline · drag/paste files/images here)"></textarea>
        <div class="composeractions">
          <button id="attach" class="attachpick" type="button" title="Attach files" aria-label="Attach files">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6.2 8.9l3.9-3.9a2.1 2.1 0 0 1 3 3l-5.2 5.2a3.4 3.4 0 0 1-4.8-4.8l5.7-5.7a4.6 4.6 0 0 1 6.5 6.5l-5.8 5.8"></path>
            </svg>
          </button>
          <input id="file" type="file" multiple hidden>
          <div class="runconfig-anchor">
            <button class="runbtn" id="runCfgBtn" title="change vendor, model, or effort for the next action" disabled>model · effort</button>
            <div class="forkpop runpop" id="runPop" hidden>
              <div class="forkhead">
                <div class="forkttl">Run config</div>
                <div class="forkhint">this session</div>
              </div>
              <div class="newrow">
                <div class="pickgrp vendor">
                  <div class="picklbl">vendor</div>
                  <select id="rvendor" class="chooser-select" aria-label="session vendor"></select>
                </div>
                <div class="pickgrp">
                  <div class="picklbl">model</div>
                  <select id="rmodel" class="chooser-select" aria-label="session model"></select>
                </div>
                <div class="pickgrp effort">
                  <div class="picklbl">effort</div>
                  <select id="reffort" class="chooser-select" aria-label="session effort"></select>
                </div>
              </div>
              <div class="forkmsg" id="runMsg"></div>
            </div>
          </div>
          <button class="splitbtn" id="forkBtn" title="branch this session into a fork (uses your draft as the opening turn)" disabled>fork ⑂</button>
          <button class="send" id="send">send</button>
        </div>
      </div>
      <div class="attachmsg" id="attachMsg"></div>
    </div>
  </div>
</div>
<div class="tabtip" id="tabtip" aria-hidden="true"></div>
<div class="imgpreview" id="imgPreview" hidden aria-hidden="true">
  <div class="imgpreview-bar">
    <div class="imgpreview-name" id="imgPreviewName"></div>
  </div>
  <div class="imgpreview-viewport" id="imgPreviewViewport">
    <div class="imgpreview-stage" id="imgPreviewStage">
      <img id="imgPreviewImg" alt="">
      <div class="imgpreview-html" id="imgPreviewHtml"></div>
    </div>
  </div>
</div>
<div class="toast-host" id="toastHost" aria-live="polite" aria-atomic="true"></div>
<div class="unlock" id="unlock" ${v.e2ee?.enabled ? "" : "hidden"}>
  <form class="unlock-panel" id="unlockForm">
    <div class="unlock-title">Unlock Attend</div>
    <div class="unlock-sub">Enter the same passphrase used to start the local server.</div>
    <div class="unlock-row">
      <input class="unlock-input" id="unlockPass" type="password" autocomplete="current-password" spellcheck="false" placeholder="passphrase">
      <button class="unlock-btn" id="unlockBtn" type="submit">unlock</button>
    </div>
    <div class="unlock-msg" id="unlockMsg"></div>
  </form>
</div>
<script>
window.__SESSIONS__ = ${sessJson};
window.__DIRS__ = ${dirsJson};
window.__ROOTS__ = ${rootsJson};
window.__PAGE_TITLE__ = ${pageTitleJson};
window.__VENDORS__ = ${vendorsJson};
window.__CLAUDE_MODELS__ = ${claudeModelsJson};
window.__CODEX_MODELS__ = ${codexModelsJson};
window.__TAGS__ = ${tagsJson};
window.__VAULT_STATE__ = ${vaultStateJson};
window.__E2EE__ = ${e2eeJson};
</script>
<script>
(function(){
  var SESS = window.__SESSIONS__ || [];
  var DIRS = window.__DIRS__ || [];
  var ROOTS = window.__ROOTS__ || [];
  var PAGE_TITLE = window.__PAGE_TITLE__ || 'Attend — console';
  var TAGS = window.__TAGS__ || [];
  var VAULT_STATE = window.__VAULT_STATE__ || {};
  var VENDORS = window.__VENDORS__ || [];
  var CLAUDE_MODELS = window.__CLAUDE_MODELS__ || [];
  var CODEX_MODELS = window.__CODEX_MODELS__ || [];
  var E2EE = {
    enabled: !!(window.__E2EE__ && window.__E2EE__.enabled),
    unlocked: false,
    key: null,
    rawFetch: window.fetch.bind(window)
  };
  var E2EE_SALT = 'attend-e2ee-v1';
  var E2EE_ITERATIONS = 150000;
  var textEncoder = new TextEncoder();
  var textDecoder = new TextDecoder();
  function bytesToBase64(bytes){
    var s='', chunk=0x8000;
    for(var i=0;i<bytes.length;i+=chunk) s+=String.fromCharCode.apply(null, bytes.subarray(i,i+chunk));
    return btoa(s);
  }
  function base64ToBytes(value){
    var raw=atob(value), out=new Uint8Array(raw.length);
    for(var i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
    return out;
  }
  function deriveE2eeKey(passphrase){
    return crypto.subtle.importKey('raw', textEncoder.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
      .then(function(baseKey){
        return crypto.subtle.deriveKey(
          { name:'PBKDF2', salt:textEncoder.encode(E2EE_SALT), iterations:E2EE_ITERATIONS, hash:'SHA-256' },
          baseKey,
          { name:'AES-GCM', length:256 },
          false,
          ['encrypt','decrypt']
        );
      });
  }
  function e2eeEncrypt(value){
    var iv=crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name:'AES-GCM', iv:iv }, E2EE.key, textEncoder.encode(JSON.stringify(value)))
      .then(function(buf){ return bytesToBase64(iv)+':'+bytesToBase64(new Uint8Array(buf)); });
  }
  function e2eeDecrypt(box){
    if(!box || typeof box!=='string') return Promise.reject(new Error('missing encrypted payload'));
    var parts=box.split(':');
    if(parts.length!==2) return Promise.reject(new Error('invalid encrypted payload'));
    return crypto.subtle.decrypt({ name:'AES-GCM', iv:base64ToBytes(parts[0]) }, E2EE.key, base64ToBytes(parts[1]))
      .then(function(buf){ return JSON.parse(textDecoder.decode(buf)); });
  }
  function e2eeEventData(data){
    return E2EE.enabled ? e2eeDecrypt(data) : Promise.resolve(JSON.parse(data));
  }
  function installEncryptedFetch(){
    if(!E2EE.enabled || !E2EE.unlocked) return;
    window.fetch=function(input, init){
      init = init || {};
      var url = typeof input === 'string' ? input : (input && input.url ? input.url : String(input||''));
      var parsed;
      try{ parsed = new URL(url, location.href); }catch(e){ return E2EE.rawFetch(input, init); }
      if(parsed.origin !== location.origin || parsed.pathname.indexOf('/e2ee/')===0){
        return E2EE.rawFetch(input, init);
      }
      var method = String(init.method || (input && input.method) || 'GET').toUpperCase();
      var body = init.body == null ? null : String(init.body);
      var contentType = '';
      try{
        var h = new Headers(init.headers || (input && input.headers) || {});
        contentType = h.get('content-type') || '';
      }catch(e){}
      return e2eeEncrypt({
        method: method,
        path: parsed.pathname + parsed.search,
        body: body,
        contentType: contentType
      }).then(function(payload){
        return E2EE.rawFetch('/e2ee/fetch', {
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({ payload:payload })
        });
      }).then(function(r){ return r.json(); }).then(function(wrapper){
        return e2eeDecrypt(wrapper && wrapper.payload);
      }).then(function(res){
        return new Response(res.body || '', {
          status: res.status || 200,
          headers: { 'content-type': res.contentType || 'application/json' }
        });
      });
    };
  }
  function applyBootstrap(view){
    view = view || {};
    SESS = view.sessions || [];
    DIRS = view.knownDirs || [];
    ROOTS = view.scopeRoots || [];
    PAGE_TITLE = view.pageTitle || PAGE_TITLE;
    VENDORS = view.vendors || [];
    CLAUDE_MODELS = view.claudeModels || [];
    CODEX_MODELS = view.codexModels || [];
    TAGS = view.tags || [];
    VAULT_STATE = view.vaultState || {};
    newPrefs = loadNewPrefs();
    focusViews = loadFocusViews();
    activeFocusId = loadActiveFocusId(focusViews);
    setTheme(VAULT_STATE.theme || currentTheme(), false);
    var sph=byId('sessionsPerHour'), cph=byId('charsPerHour');
    if(sph) sph.textContent=formatSessionsPerHour(view.sessionsPerHour || 0);
    if(cph) cph.textContent=formatCharsPerHour(view.charsPerHour || 0);
    document.title = PAGE_TITLE;
  }
  function unlockE2ee(passphrase){
    return deriveE2eeKey(passphrase).then(function(key){
      E2EE.key = key;
      return e2eeEncrypt({ kind:'unlock', at:Date.now() });
    }).then(function(payload){
      return E2EE.rawFetch('/e2ee/unlock', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({ payload:payload })
      });
    }).then(function(r){
      if(!r.ok) throw new Error('wrong passphrase');
      return r.json();
    }).then(function(res){
      return e2eeDecrypt(res && res.payload);
    }).then(function(res){
      E2EE.unlocked = true;
      installEncryptedFetch();
      applyBootstrap(res && res.bootstrap);
    });
  }
  function startUnlockFlow(){
    var form=byId('unlockForm'), input=byId('unlockPass'), msg=byId('unlockMsg'), btn=byId('unlockBtn');
    if(!form || !input) return;
    input.focus();
    form.onsubmit=function(ev){
      ev.preventDefault();
      var pass=String(input.value||'');
      if(!pass){ if(msg) msg.textContent='passphrase required'; return; }
      if(btn) btn.disabled=true;
      if(msg) msg.textContent='unlocking...';
      unlockE2ee(pass).then(function(){
        var overlay=byId('unlock');
        if(overlay) overlay.hidden=true;
        if(msg) msg.textContent='';
        initApp();
      }).catch(function(err){
        if(msg) msg.textContent=(err&&err.message)||'unlock failed';
      }).finally(function(){ if(btn) btn.disabled=false; });
    };
  }
  var NEW_MODEL_OPTIONS = {
    claude: [
      { value:'', label:'current CLI model' },
      { value:'fable', label:'fable' },
      { value:'sonnet', label:'sonnet' },
      { value:'opus', label:'opus' },
      { value:'haiku', label:'haiku' }
    ],
    codex: [
      { value:'', label:'current CLI model' },
      { value:'gpt-5.5', label:'gpt-5.5' },
      { value:'gpt-5.4', label:'gpt-5.4' },
      { value:'gpt-5.4-mini', label:'gpt-5.4-mini' },
      { value:'gpt-5.3-codex-spark', label:'gpt-5.3-codex-spark' },
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
    var parsed=VAULT_STATE && VAULT_STATE.modelPrefs;
    return parsed && typeof parsed==='object' ? parsed : {};
  }
  var FOCUS_ACTIVE_KEY = 'attend.activeFocusView.v1';
  var TAG_FILTER_MODE_KEY = 'attend.tagFilterMode.v1';
  var PRIORITY_FILTER_KEY = 'attend.priorityFilter.v1';
  function loadTagFilterMode(){
    try{ return localStorage.getItem(TAG_FILTER_MODE_KEY)==='and' ? 'and' : 'or'; }
    catch(e){ return 'or'; }
  }
  function saveTagFilterMode(){
    try{ localStorage.setItem(TAG_FILTER_MODE_KEY, tagFilterMode); }catch(e){}
  }
  function normalizePriorityFilter(levels){
    var seen={};
    var out=(Array.isArray(levels) ? levels : []).map(function(level){ return Number(level); }).filter(function(level){
      if(level<1 || level>5 || Math.floor(level)!==level || seen[level]) return false;
      seen[level]=true;
      return true;
    }).sort(function(a,b){ return b-a; });
    return out.length ? out : [5,4,3,2,1];
  }
  function loadPriorityFilter(){
    try{
      var raw=localStorage.getItem(PRIORITY_FILTER_KEY);
      return raw ? normalizePriorityFilter(JSON.parse(raw)) : [5,4,3,2,1];
    }catch(e){ return [5,4,3,2,1]; }
  }
  function savePriorityFilter(){
    try{ localStorage.setItem(PRIORITY_FILTER_KEY, JSON.stringify(priorityFilter)); }catch(e){}
  }
  function makeFocusId(){
    return 'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  }
  function fallbackFocusViews(){
    return [{ id:'focus-1', name:'Focus 1', tags:[] }];
  }
  function loadFocusViews(){
    try{
      var parsed=VAULT_STATE && VAULT_STATE.focusViews;
      if(!Array.isArray(parsed)) return fallbackFocusViews();
      var out=[];
      parsed.forEach(function(view, i){
        if(!view || typeof view!=='object') return;
        var id=String(view.id||'').trim() || makeFocusId();
        var name=String(view.name||'').trim() || ('Focus '+(i+1));
        var seen={};
        var tags=Array.isArray(view.tags) ? view.tags.map(function(tag){ return String(tag||'').trim(); }).filter(function(tag){
          if(!tag || seen[tag]) return false;
          seen[tag]=true;
          return true;
        }) : [];
        out.push({ id:id, name:name, tags:tags });
      });
      return out.length ? out : fallbackFocusViews();
    }catch(e){ return fallbackFocusViews(); }
  }
  function loadActiveFocusId(views){
    try{
      var raw=localStorage.getItem(FOCUS_ACTIVE_KEY);
      if(raw && views.some(function(view){ return view && view.id===raw; })) return raw;
    }catch(e){}
    return views[0] ? views[0].id : 'focus-1';
  }
  function saveFocusViews(){
    try{
      localStorage.setItem(FOCUS_ACTIVE_KEY, activeFocusId);
    }catch(e){}
    VAULT_STATE.focusViews=focusViews;
    saveVaultUiState({focusViews:focusViews});
  }
  var newPrefs = loadNewPrefs();
  var appliedNewVendor = '';
  var DIR_SUGGEST_LIMIT = 24;
  var focusViews = loadFocusViews();
  var activeFocusId = loadActiveFocusId(focusViews);
  var cur = null, liveEs = null, liveFallbackTimer = null, liveStateConnected = false, liveFallbackActive = false, liveEventChain = Promise.resolve(), latestLiveSnapshot = null, assistantEl = null;
  var genEl = null, genTimer = null, genStart = 0, turnActive = false;
  var activeTags = (focusById(activeFocusId) || focusViews[0] || { tags:[] }).tags.slice();
  var activeTagView = 'all';
  var tagFilterMode = loadTagFilterMode();
  var priorityFilter = loadPriorityFilter();
  var priorityMenuOpen = false;
  var scopedTagFilters = { active: [], unread: [] };
  var bulkArchiveSeenBusy = false;
  var globalTagEditing = false;
  var draggedGlobalTag = null;
  var suppressTagClickUntil = 0;
  var editingTagSession = null;
  var headerTagEditing = false;
  var newSessionPending = false;
  var localPendingMsgs = {};
  var orphanBusEvents = {};
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
  var sessionQueueEditing = {};
  var queueParked = false;
  var transcriptCache = {};
  var draftAttachments = [];
  var newAttachments = [];
  var refreshBusy = false;
  var attachmentMsg = '';
  var attachmentMsgErr = false;
  var attachmentReadPending = 0;
  var newAttachmentMsg = '';
  var newAttachmentMsgErr = false;
  var newAttachmentReadPending = 0;
  var composerDragDepth = 0;
  var newAttachDragDepth = 0;
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
  var overlayLayoutRaf = 0;
  var msgOrdinal = 0;
  var viewVisit = null;
  var applyingTurnFolds = false;
  function byId(id){ return document.getElementById(id); }
  function el(tag, cls, txt){ var e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e; }
  function svgIcon(name){
    var ns='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    function path(d, cls){
      var p=document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      if(cls) p.setAttribute('class', cls);
      svg.appendChild(p);
    }
    if(name==='edit'){
      path('M21.2 6.8a2.8 2.8 0 0 0-4-4L4 16v4h4L21.2 6.8z');
      path('M15.5 4.5l4 4');
    } else if(name==='pin'){
      path('M7 17h10', 'pin-base');
      path('M12 17v4', 'pin-base');
      path('M8 17v-5H6l3-4V3h6v5l3 4h-2v5H8z', 'pin-body');
    } else if(name==='collapse'){
      path('M6 12h12');
    }
    return svg;
  }
  function setIconButton(btn, iconName, label){
    btn.type='button';
    btn.title=label;
    btn.setAttribute('aria-label', label);
    btn.textContent='';
    btn.appendChild(svgIcon(iconName));
  }
  function formatSessionsPerHour(value){
    var n=Number(value)||0;
    return n>=10 ? String(Math.round(n)) : n.toFixed(1);
  }
  function formatCharsPerHour(value){
    var n=Number(value)||0;
    if(n>=1000000) return (n/1000000).toFixed(1)+'M';
    if(n>=1000) return (n/1000).toFixed(1)+'k';
    return String(Math.round(n));
  }
  function applyStats(stats){
    if(!stats) return;
    var sph=byId('sessionsPerHour'), cph=byId('charsPerHour');
    if(sph) sph.textContent=formatSessionsPerHour(stats.sessionsPerHour);
    if(cph) cph.textContent=formatCharsPerHour(stats.charsPerHour);
  }
  function overlayHeight(node){
    if(!node || node.hidden) return 0;
    var rect=node.getBoundingClientRect();
    return Math.max(0, Math.ceil(rect.height || 0));
  }
  function syncOverlayOffsets(){
    overlayLayoutRaf=0;
    var main=document.querySelector('.main');
    if(!main) return;
    var foot=document.querySelector('.foot');
    var queue=byId('queue');
    var avoid=byId('avoidPanel');
    var footH=overlayHeight(foot) || 136;
    var queueH=(queue && queue.childElementCount) ? overlayHeight(queue) : 0;
    var avoidH=(avoid && !avoid.hidden) ? overlayHeight(avoid) : 0;
    main.style.setProperty('--composer-overlay-height', footH+'px');
    main.style.setProperty('--queue-overlay-height', queueH+'px');
    main.style.setProperty('--avoid-overlay-height', avoidH+'px');
  }
  function scheduleOverlayOffsets(){
    if(overlayLayoutRaf) return;
    overlayLayoutRaf=requestAnimationFrame(syncOverlayOffsets);
  }
  function showToast(text, kind){
    var host=byId('toastHost');
    if(!host) return;
    var node=el('div','toast '+(kind||''),text);
    host.appendChild(node);
    setTimeout(function(){
      node.classList.add('hide');
      setTimeout(function(){ if(node.parentNode) node.parentNode.removeChild(node); }, 220);
    }, 4200);
  }
  function currentTheme(){
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  function setTheme(theme, persist){
    var next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    var btn=byId('themeToggle');
    if(btn){
      var dark = next === 'dark';
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.title = dark ? 'switch to light theme' : 'switch to dark theme';
      btn.setAttribute('aria-label', btn.title);
    }
    if(persist){
      VAULT_STATE.theme=next;
      saveVaultUiState({theme:next});
    }
  }
  function toggleTheme(){
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
    clearTagHeatCache();
    renderTagFilters();
    renderSidebar();
    if(cur) renderHeaderTags(cur);
  }
  var IMAGE_ATTACHMENT_TYPES = { 'image/jpeg':true, 'image/png':true, 'image/gif':true, 'image/webp':true };
  var TEXT_ATTACHMENT_EXTS = {
    txt:true, md:true, markdown:true, json:true, js:true, jsx:true, ts:true, tsx:true,
    css:true, html:true, htm:true, xml:true, yml:true, yaml:true, csv:true, tsv:true,
    log:true, py:true, java:true, go:true, rs:true, sh:true, sql:true, ini:true
  };
  var EXCEL_ATTACHMENT_TYPES = {
    'application/vnd.ms-excel':true,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':true,
    'application/vnd.ms-excel.sheet.macroEnabled.12':true,
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12':true,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.template':true,
    'application/vnd.ms-excel.template.macroEnabled.12':true,
    'application/vnd.ms-excel.addin.macroEnabled.12':true
  };
  var EXCEL_MEDIA_BY_EXT = {
    xls:'application/vnd.ms-excel',
    xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xlsm:'application/vnd.ms-excel.sheet.macroEnabled.12',
    xlsb:'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
    xltx:'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    xltm:'application/vnd.ms-excel.template.macroEnabled.12',
    xlam:'application/vnd.ms-excel.addin.macroEnabled.12'
  };
  function attachmentId(){ return 'att-'+Date.now()+'-'+Math.random().toString(36).slice(2,8); }
  function fileExt(name){
    var s=String(name||''); var i=s.lastIndexOf('.');
    return i>=0 ? s.slice(i+1).toLowerCase() : '';
  }
  function mediaExt(type){
    return type==='image/jpeg' ? 'jpg'
      : type==='image/png' ? 'png'
      : type==='image/gif' ? 'gif'
      : type==='image/webp' ? 'webp'
      : type==='application/pdf' ? 'pdf'
      : EXCEL_ATTACHMENT_TYPES[type] ? 'xlsx'
      : type && /^text\\//i.test(type) ? 'txt'
      : 'bin';
  }
  function namedClipboardFile(file, index){
    if(!file) return file;
    if(file.name) return file;
    var ext=mediaExt(file.type||'');
    var prefix=file.type && IMAGE_ATTACHMENT_TYPES[file.type] ? 'pasted-image' : 'pasted-file';
    try{
      return new File([file], prefix+'-'+Date.now()+'-'+(index+1)+'.'+ext, {
        type:file.type||'',
        lastModified:file.lastModified||Date.now()
      });
    }catch(e){
      file.name = prefix+'-'+Date.now()+'-'+(index+1)+'.'+ext;
      return file;
    }
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
  function excelMediaType(file){
    if(file && file.type && EXCEL_ATTACHMENT_TYPES[file.type]) return file.type;
    return EXCEL_MEDIA_BY_EXT[fileExt(file && file.name)];
  }
  function attachmentBadge(att){
    return att.kind==='image' ? 'img' : att.kind==='document' ? 'pdf' : att.kind==='file' ? 'xls' : 'txt';
  }
  function attachmentLine(att){
    return '- '+(att.kind==='image' ? 'image' : att.kind==='document' ? 'pdf' : att.kind==='file' ? 'file' : 'text')+': '+att.name;
  }
  function attachmentSummary(atts){
    if(!atts || !atts.length) return '';
    return 'Attachments:\\n'+atts.map(attachmentLine).join('\\n');
  }
  function cloneAttachments(atts){
    return Array.isArray(atts) ? atts.map(function(att){ return Object.assign({}, att); }) : [];
  }
  function attachmentDisplayText(text, atts){
    var raw=String(text||'');
    var summary=attachmentSummary(atts);
    if(summary && raw.slice(-summary.length)===summary) return raw.slice(0, -summary.length).trim();
    return raw;
  }
  function attachmentUrl(att){
    if(!att) return '';
    if(att.kind==='text') return 'data:text/plain;charset=utf-8,'+encodeURIComponent(att.text||'');
    var media=att.mediaType || 'application/octet-stream';
    return 'data:'+media+';base64,'+(att.data||'');
  }
  function appendAttachmentCards(bubble, atts){
    if(!bubble || !atts || !atts.length) return;
    var wrap=el('div','attachments');
    atts.forEach(function(att){
      var href=attachmentUrl(att);
      var isImage=att.kind==='image';
      var card=document.createElement(isImage ? 'a' : 'div');
      card.className='attcard '+(att.kind==='image' ? 'image' : att.kind);
      card.title='Open '+(att.name||'attachment');
      if(isImage){
        card.href=href;
        card.setAttribute('role', 'button');
        card.onclick=function(ev){ ev.preventDefault(); openImagePreview(href, att.name||'image'); };
        var img=document.createElement('img');
        img.src=href;
        img.alt=att.name||'attached image';
        img.loading='lazy';
        card.appendChild(img);
        var meta=el('div','attmeta');
        meta.appendChild(el('span','kind','img'));
        var name=el('span','name',att.name||'image');
        name.title=att.name||'image';
        meta.appendChild(name);
        card.appendChild(meta);
      } else {
        card.title='Original file location is not available from browser attachment data';
        card.appendChild(el('span','kind',attachmentBadge(att)));
        var label=el('span','name',att.name||'attachment');
        label.title=att.name||'attachment';
        card.appendChild(label);
      }
      wrap.appendChild(card);
    });
    bubble.appendChild(wrap);
  }
  var mediaPreview = { scale:1, x:0, y:0, dragging:false, sx:0, sy:0, ox:0, oy:0 };
  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
  function mediaPreviewStage(){ return byId('imgPreviewStage'); }
  function applyMediaPreviewTransform(){
    var stage=mediaPreviewStage();
    if(!stage) return;
    stage.style.transform='translate('+mediaPreview.x+'px, '+mediaPreview.y+'px) scale('+mediaPreview.scale+')';
  }
  function resetMediaPreviewTransform(){
    mediaPreview.scale=1; mediaPreview.x=0; mediaPreview.y=0;
    applyMediaPreviewTransform();
  }
  function zoomMediaPreview(mult){
    mediaPreview.scale=clamp(mediaPreview.scale*mult, 0.2, 8);
    applyMediaPreviewTransform();
  }
  function openMediaPreview(opts){
    var modal=byId('imgPreview'), img=byId('imgPreviewImg'), html=byId('imgPreviewHtml'), label=byId('imgPreviewName');
    if(!modal || !img || !html) return;
    resetMediaPreviewTransform();
    img.hidden=true;
    img.src='';
    html.innerHTML='';
    if(opts && opts.svg){
      html.hidden=false;
      html.innerHTML=opts.svg;
    } else {
      img.hidden=false;
      img.src=(opts && opts.src) || '';
      img.alt=(opts && opts.alt) || (opts && opts.name) || 'preview image';
      html.hidden=true;
    }
    if(label) label.textContent=(opts && opts.name) || 'preview';
    modal.hidden=false;
    modal.setAttribute('aria-hidden','false');
  }
  function openImagePreview(src, name){
    openMediaPreview({ src:src, name:name||'image', alt:name||'attached image' });
  }
  function closeImagePreview(){
    var modal=byId('imgPreview'), img=byId('imgPreviewImg'), html=byId('imgPreviewHtml');
    if(!modal) return;
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    resetMediaPreviewTransform();
    if(img) img.src='';
    if(html) html.innerHTML='';
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
    return Object.assign({}, turn && typeof turn==='object' ? turn : {}, {
      text:turnText(turn), attachments:cloneAttachments(turnAttachments(turn))
    });
  }
  function attachmentTargetState(target){
    return target==='new'
      ? { atts:newAttachments, msg:newAttachmentMsg, pending:newAttachmentReadPending, tray:'newAttachTray', msgNode:'newAttachMsg' }
      : { atts:draftAttachments, msg:attachmentMsg, pending:attachmentReadPending, tray:'attachTray', msgNode:'attachMsg' };
  }
  function setAttachmentMsg(msg, isErr, target){
    if(target==='new'){
      newAttachmentMsg = msg ? String(msg) : '';
      newAttachmentMsgErr = !!isErr;
    } else {
      attachmentMsg = msg ? String(msg) : '';
      attachmentMsgErr = !!isErr;
    }
    var node=byId(target==='new'?'newAttachMsg':'attachMsg');
    if(!node) return;
    var text=target==='new' ? newAttachmentMsg : attachmentMsg;
    var err=target==='new' ? newAttachmentMsgErr : attachmentMsgErr;
    node.textContent = text;
    node.className = 'attachmsg'+(text ? ' show' : '')+(err ? ' err' : '');
  }
  function removeAttachment(id, target){
    if(target==='new') newAttachments = newAttachments.filter(function(att){ return att.id!==id; });
    else draftAttachments = draftAttachments.filter(function(att){ return att.id!==id; });
    if(target!=='new' && cur) stashAttachmentState(cur);
    renderAttachments(target);
  }
  function renderAttachments(target){
    var state=attachmentTargetState(target);
    var tray=byId(state.tray); if(!tray) return;
    tray.innerHTML='';
    state.atts.forEach(function(att){
      var chip=el('span','attachchip');
      chip.appendChild(el('span','kind',attachmentBadge(att)));
      var name=el('span','name',att.name);
      name.title=att.name;
      chip.appendChild(name);
      var del=el('button',null,'×');
      del.title='Remove attachment';
      del.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); removeAttachment(att.id, target); };
      chip.appendChild(del);
      tray.appendChild(chip);
    });
    tray.className='attachtray'+(state.atts.length ? ' show' : '');
    if(!state.atts.length && !state.pending){
      setAttachmentMsg('', false, target);
    }
    if(target!=='new') scheduleOverlayOffsets();
  }
  function clearAttachments(){
    draftAttachments = [];
    if(cur) delete sessionAttachments[draftKey(cur)];
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
  function readBinaryAttachment(file, kind, mediaType){
    return new Promise(function(resolve, reject){
      var fr=new FileReader();
      fr.onload=function(){ resolve({ kind:kind, name:file.name, mediaType:mediaType, data:dataUrlPayload(fr.result), id:attachmentId() }); };
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
    var xlsType=excelMediaType(file);
    if(xlsType){
      if(file.size > 15*1024*1024) return Promise.reject(new Error(file.name+' is too large (max 15 MB per Excel file)'));
      return readBinaryAttachment(file, 'file', xlsType);
    }
    if(looksTextFile(file)){
      if(file.size > 1024*1024) return Promise.reject(new Error(file.name+' is too large (max 1 MB per text file)'));
      return readTextAttachment(file);
    }
    return Promise.reject(new Error(file.name+' is not a supported file type yet'));
  }
  function addAttachments(files, target){
    var list=(files||[]).filter(function(file){ return !!file; });
    if(!list.length) return Promise.resolve();
    if(target==='new') newAttachmentReadPending++;
    else attachmentReadPending++;
    setAttachmentMsg('Reading '+list.length+' attachment'+(list.length>1?'s':'')+'…', false, target);
    return Promise.allSettled(list.map(loadAttachment)).then(function(results){
      var added=0, errs=[];
      results.forEach(function(res){
        if(res.status==='fulfilled'){
          var att=res.value;
          var atts=target==='new' ? newAttachments : draftAttachments;
          if(!atts.some(function(x){ return x.name===att.name && x.kind===att.kind && (x.data||x.text)===(att.data||att.text); })){
            atts.push(att); added++;
          }
        } else if(res.reason) errs.push(res.reason.message || String(res.reason));
      });
      if(target!=='new' && cur) stashAttachmentState(cur);
      renderAttachments(target);
      if(errs.length) setAttachmentMsg(errs[0], true, target);
      else setAttachmentMsg('', false, target);
    }).finally(function(){
      if(target==='new') newAttachmentReadPending=Math.max(0, newAttachmentReadPending-1);
      else attachmentReadPending=Math.max(0, attachmentReadPending-1);
    });
  }
  function clipboardFiles(ev){
    var dt=ev && ev.clipboardData;
    if(!dt) return [];
    var out=[];
    var seen=[];
    function add(file){
      if(!file) return;
      var key=[file.name||'', file.type||'', file.size||0, file.lastModified||0].join('|');
      if(seen.indexOf(key)>=0) return;
      seen.push(key);
      out.push(namedClipboardFile(file, out.length));
    }
    if(dt.items && dt.items.length){
      Array.prototype.forEach.call(dt.items, function(item){
        if(item && item.kind==='file'){
          try{ add(item.getAsFile()); }catch(e){}
        }
      });
    }
    if(!out.length && dt.files && dt.files.length){
      Array.prototype.forEach.call(dt.files, add);
    }
    return out;
  }
  function bindAttachmentPaste(input, target){
    if(!input) return;
    input.addEventListener('paste', function(ev){
      var files=clipboardFiles(ev);
      if(!files.length) return;
      ev.preventDefault();
      addAttachments(files, target).catch(function(){});
    });
  }
  function bindComposerDrop(){
    var box=byId('composer'), input=byId('input'), pick=byId('attach'), fileInput=byId('file');
    if(!box || !input) return;
    bindAttachmentPaste(input);
    if(pick && fileInput){
      pick.onclick=function(ev){ ev.preventDefault(); fileInput.click(); };
      fileInput.onchange=function(){ addAttachments(Array.prototype.slice.call(fileInput.files||[])).catch(function(){}); fileInput.value=''; };
    }
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
  function bindNewAttachments(){
    var box=byId('newAttachDrop'), input=byId('np'), pick=byId('nattach'), fileInput=byId('nfile');
    if(!box || !input) return;
    bindAttachmentPaste(input, 'new');
    function setDrop(on){ box.classList.toggle('drop', !!on); }
    function fileDrag(ev){
      var dt=ev.dataTransfer;
      return !!(dt && Array.prototype.some.call(dt.types||[], function(t){ return t==='Files'; }));
    }
    if(pick && fileInput){
      pick.onclick=function(ev){ ev.preventDefault(); if(!newSessionPending) fileInput.click(); };
      fileInput.onchange=function(){ addAttachments(Array.prototype.slice.call(fileInput.files||[]), 'new').catch(function(){}); fileInput.value=''; };
    }
    box.addEventListener('dragenter', function(ev){
      if(!fileDrag(ev)) return;
      ev.preventDefault();
      newAttachDragDepth++;
      setDrop(true);
    });
    box.addEventListener('dragover', function(ev){
      if(!fileDrag(ev)) return;
      ev.preventDefault();
      setDrop(true);
    });
    box.addEventListener('dragleave', function(ev){
      if(!fileDrag(ev)) return;
      newAttachDragDepth=Math.max(0, newAttachDragDepth-1);
      if(newAttachDragDepth===0) setDrop(false);
    });
    box.addEventListener('drop', function(ev){
      if(!fileDrag(ev)) return;
      ev.preventDefault();
      newAttachDragDepth=0;
      setDrop(false);
      addAttachments(Array.prototype.slice.call((ev.dataTransfer&&ev.dataTransfer.files)||[]), 'new').catch(function(){});
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
    SESS.forEach(function(session){
      var vendor=String(session&&session.vendor||'').trim().toLowerCase();
      if(!vendor || seen['vendor:'+vendor]) return;
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
  var TAG_HEAT_WINDOW_MS = 24 * 60 * 60 * 1000;
  var tagHeatCache = null;
  function clearTagHeatCache(){ tagHeatCache = null; }
  function validPromptTs(s){
    if(!s || !Array.isArray(s.userPromptTs)) return [];
    return s.userPromptTs.map(function(ts){ return Number(ts); }).filter(function(ts){ return isFinite(ts) && ts > 0; });
  }
  function computeTagHeatStats(){
    var latest=0;
    SESS.forEach(function(s){
      validPromptTs(s).forEach(function(ts){ if(ts>latest) latest=ts; });
    });
    if(!latest) return { counts:{}, max:0, latest:0, since:0 };
    var since=latest-TAG_HEAT_WINDOW_MS;
    var counts={}, max=0;
    SESS.forEach(function(s){
      var n=0;
      validPromptTs(s).forEach(function(ts){ if(ts>=since && ts<=latest) n++; });
      if(!n) return;
      (s.tags||[]).forEach(function(tag){
        var def=userTagDef(tag);
        if(!def) return;
        counts[def.key]=(counts[def.key]||0)+n;
        if(counts[def.key]>max) max=counts[def.key];
      });
    });
    return { counts:counts, max:max, latest:latest, since:since };
  }
  function tagHeatStats(){
    if(!tagHeatCache) tagHeatCache = computeTagHeatStats();
    return tagHeatCache;
  }
  function tagHeatHue(heat){
    heat=Math.max(0, Math.min(1, Number(heat)||0));
    return 60 + (0-60) * heat;
  }
  function applyTagHeatStyle(chip, btn, del, def, active, stats){
    if(!def || def.kind!=='user') return;
    stats = stats || tagHeatStats();
    var count = stats.counts[def.key] || 0;
    if(!count || !stats.max) return;
    var heat=count/stats.max;
    var hue=tagHeatHue(heat);
    var dark=document.documentElement.getAttribute('data-theme')==='dark';
    var softAlpha=(dark?0.05:0.035)+(dark?0.12:0.08)*heat;
    var fadeAlpha=(dark?0.015:0.01)+(dark?0.04:0.028)*heat;
    var heatColor='hsl('+hue+' 100% 50% / '+(dark?'0.72':'0.82')+')';
    var heatSoft='hsl('+hue+' 100% 50% / '+softAlpha.toFixed(3)+')';
    var heatFade='hsl('+hue+' 100% 50% / '+fadeAlpha.toFixed(3)+')';
    chip.classList.add('hot');
    chip.style.setProperty('--tag-heat-soft', heatSoft);
    chip.style.setProperty('--tag-heat-fade', heatFade);
    if(active){
      var selectedColor='hsl('+hue+' 72% '+(dark?'36%':'44%')+')';
      chip.style.borderStyle='solid';
      chip.style.borderColor=selectedColor;
      chip.style.backgroundColor=selectedColor;
      chip.style.color='#ffffff';
      chip.style.boxShadow='inset 0 0 0 1px '+selectedColor;
      if(btn) btn.style.color='#ffffff';
      if(del) del.style.color='#ffffff';
    } else {
      chip.style.borderStyle='';
      chip.style.borderColor='';
      chip.style.backgroundColor='';
      chip.style.color='';
      if(btn) btn.style.color='';
      if(del) del.style.color='';
      chip.style.boxShadow='';
    }
    chip.title = (def.title || def.label) + ' · ' + count + ' user message' + (count===1?'':'s') + ' in latest-action 24h';
  }
  function styleFilterTagChip(chip, btn, del, def, active){
    var theme=tagTheme(def);
    var isUser = def && def.kind==='user';
    styleTheme(chip, theme);
    chip.classList.toggle('on', !!active);
    chip.classList.toggle('auto', !isUser);
    if(active){
      chip.style.color = '#ffffff';
      chip.style.backgroundColor = theme.fg;
      chip.style.borderColor = theme.fg;
      chip.style.boxShadow = 'inset 0 0 0 1px '+theme.fg;
    } else if(isUser){
      // +tag look: drop the inline fill/border/shadow so the gray dashed CSS shows through
      chip.style.backgroundColor='';
      chip.style.borderColor='';
      chip.style.boxShadow='';
    } else {
      chip.style.boxShadow = '';
    }
    if(btn){
      // unselected custom tags take their (theme-aware) color from CSS, not inline
      btn.style.color = (isUser && !active) ? '' : (active ? '#ffffff' : theme.fg);
      btn.style.backgroundColor = 'transparent';
    }
    if(del){
      del.style.color = (isUser && !active) ? '' : (active ? '#ffffff' : theme.fg);
      del.style.backgroundColor = 'transparent';
    }
    applyTagHeatStyle(chip, btn, del, def, active);
  }
  function styleSessionTagChip(chip, def){
    var theme=tagTheme(def);
    var isUser = def && def.kind==='user';
    styleTheme(chip, theme);
    chip.classList.toggle('auto', !isUser);
    // custom tags: drop the inline fill/border/color so the gray dashed CSS (with its
    // theme-aware readable teal text) shows through
    if(isUser){ chip.style.backgroundColor=''; chip.style.borderColor=''; chip.style.color=''; }
    applyTagHeatStyle(chip, null, chip.querySelector('button'), def, false);
  }
  function activeTagLabels(){
    return tagLabels(currentFilterTags());
  }
  function focusById(id){
    for(var i=0;i<focusViews.length;i++){ if(focusViews[i] && focusViews[i].id===id) return focusViews[i]; }
    return null;
  }
  function activeFocus(){
    var view=focusById(activeFocusId);
    if(view) return view;
    if(!focusViews.length) focusViews=fallbackFocusViews();
    activeFocusId=focusViews[0].id;
    return focusViews[0];
  }
  function syncActiveTagsFromFocus(){
    var view=activeFocus();
    activeTags = view && Array.isArray(view.tags) ? view.tags.slice() : [];
  }
  function persistActiveFocusTags(){
    var view=activeFocus();
    if(!view) return;
    view.tags = activeTags.slice();
    saveFocusViews();
  }
  function uniqueTagKeys(tags){
    var out=[], seen={};
    (tags||[]).forEach(function(tag){
      tag=String(tag||'').trim();
      if(!tag || seen[tag]) return;
      seen[tag]=true;
      out.push(tag);
    });
    return out;
  }
  function tagSetsEqual(a,b){
    a=uniqueTagKeys(a); b=uniqueTagKeys(b);
    if(a.length!==b.length) return false;
    var seen={};
    a.forEach(function(tag){ seen[tag]=true; });
    for(var i=0;i<b.length;i++){ if(!seen[b[i]]) return false; }
    return true;
  }
  function tagLabels(tags){
    var byKey={};
    filterTagDefs().forEach(function(def){ byKey[def.key]=def.label; });
    return (tags||[]).map(function(key){ return byKey[key] || key; });
  }
  function currentFilterTags(){
    if(activeTagView==='focus') return activeTags;
    if(activeTagView==='active' || activeTagView==='unread') return scopedTagFilters[activeTagView] || [];
    return [];
  }
  function syncTagFilterModeToggle(){
    var btn=byId('tagModeToggle'); if(!btn) return;
    var isAnd=tagFilterMode==='and';
    var value=byId('tagModeValue'); if(value) value.textContent=isAnd ? 'all' : 'any';
    var noun=byId('tagModeNoun'); if(noun) noun.textContent=isAnd ? 'tags' : 'tag';
    btn.setAttribute('aria-pressed', isAnd ? 'true' : 'false');
    var tip=isAnd
      ? 'Show sessions matching all selected tags. Click to match any selected tag.'
      : 'Show sessions matching any selected tag. Click to require all selected tags.';
    btn.setAttribute('data-tooltip', tip);
    btn.setAttribute('aria-label', isAnd ? 'Match all selected tags. Click to match any.' : 'Match any selected tag. Click to match all.');
  }
  function setTagFilterMode(mode){
    var next=mode==='and' ? 'and' : 'or';
    if(tagFilterMode===next){ syncTagFilterModeToggle(); return; }
    tagFilterMode=next;
    saveTagFilterMode();
    syncTagFilterModeToggle();
    reconcileCurrentSessionToFilter();
  }
  function toggleTagFilterMode(){
    setTagFilterMode(tagFilterMode==='and' ? 'or' : 'and');
  }
  function setScopedFilterTags(view, tags){
    if(view!=='active' && view!=='unread') return;
    scopedTagFilters[view]=uniqueTagKeys(tags);
  }
  function findFocusByTags(tags){
    for(var i=0;i<focusViews.length;i++){
      if(focusViews[i] && tagSetsEqual(focusViews[i].tags || [], tags)) return focusViews[i];
    }
    return null;
  }
  function emptyFocusView(){
    for(var i=0;i<focusViews.length;i++){
      if(focusViews[i] && !(focusViews[i].tags||[]).length) return focusViews[i];
    }
    return null;
  }
  function activateFocusWithTags(tags){
    tags=uniqueTagKeys(tags);
    var view=findFocusByTags(tags) || (tags.length ? emptyFocusView() : null);
    if(!view){
      view={ id:makeFocusId(), name:'Focus '+(focusViews.length+1), tags:[] };
      focusViews.push(view);
    }
    activeFocusId=view.id;
    activeTags=tags.slice();
    view.tags=tags.slice();
    activeTagView='focus';
    saveFocusViews();
  }
  function focusViewLabel(view){
    var prefix=(view&&view.name)||'Focus';
    var current=view && view.id===activeFocusId;
    var tags=current ? activeTags : ((view&&view.tags)||[]);
    var labels=tagLabels(tags);
    if(!labels.length) return prefix;
    var shown=labels.slice(0,2).join(', ');
    return prefix+': '+shown+(labels.length>2 ? ' +'+(labels.length-2) : '');
  }
  function setTagView(view){
    if(view && view.indexOf('focus:')===0){
      activeFocusId=view.slice(6);
      syncActiveTagsFromFocus();
      activeTagView = 'focus';
      saveFocusViews();
    } else activeTagView = view || 'all';
    renderTagFilters();
    reconcileCurrentSessionToFilter();
  }
  function addFocusView(){
    var view={ id:makeFocusId(), name:'Focus '+(focusViews.length+1), tags:[] };
    focusViews.push(view);
    activeFocusId=view.id;
    activeTags=[];
    activeTagView='focus';
    saveFocusViews();
    renderTagFilters();
    reconcileCurrentSessionToFilter();
  }
  function removeFocusView(id){
    if(focusViews.length<=1) return;
    var idx=-1;
    for(var i=0;i<focusViews.length;i++){ if(focusViews[i] && focusViews[i].id===id){ idx=i; break; } }
    if(idx<0) return;
    focusViews.splice(idx,1);
    if(activeFocusId===id){
      var next=focusViews[Math.min(idx, focusViews.length-1)] || focusViews[0];
      activeFocusId=next.id;
      syncActiveTagsFromFocus();
      if(activeTagView==='focus') activeTagView='focus';
    }
    saveFocusViews();
    renderTagFilters();
    reconcileCurrentSessionToFilter();
  }
  function renderViewTabs(){
    var wrap=byId('viewTabs'); if(!wrap) return; wrap.innerHTML='';
    function tab(id, label, title, disabled){
      var btn=el('button','viewtab'+(activeTagView===id?' on':''),label);
      btn.type='button';
      btn.title=title || label;
      btn.disabled=!!disabled;
      btn.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); setTagView(id); };
      wrap.appendChild(btn);
    }
    tab('all','All','Show every session without changing Focus tags');
    tab('active','Active','Generating, unread, and in-progress sessions');
    tab('unread','Unread','Sessions generating now or with an unseen reply');
    focusViews.forEach(function(view){
      var on=activeTagView==='focus' && view.id===activeFocusId;
      var group=el('span','viewtabgroup'+(on?' on':''));
      var btn=el('button','viewtab'+(on?' on':''),focusViewLabel(view));
      btn.type='button';
      btn.title='Show sessions matching this Focus tab';
      btn.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); setTagView('focus:'+view.id); };
      group.appendChild(btn);
      if(focusViews.length>1){
        var close=el('button','viewtabx','×');
        close.type='button';
        close.title='Close this Focus tab';
        close.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); removeFocusView(view.id); };
        group.appendChild(close);
      }
      wrap.appendChild(group);
    });
    var add=el('button','viewtab','+ focus');
    add.type='button';
    add.title='Add another Focus tab';
    add.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); addFocusView(); };
    wrap.appendChild(add);
    syncBulkArchiveSeenButton();
  }
  function sessionMatchesTagFilter(s, filterTags){
    if(!filterTags || !filterTags.length) return true;
    var tags=sessionTagKeys(s);
    if(tagFilterMode==='and'){
      for(var a=0;a<filterTags.length;a++){ if(tags.indexOf(filterTags[a])<0) return false; }
      return true;
    }
    for(var i=0;i<filterTags.length;i++){ if(tags.indexOf(filterTags[i])>=0) return true; }
    return false;
  }
  function sessionMatchesBulkArchiveScope(s){
    if(!s) return false;
    if(activeTagView==='unread') return false;
    if(activeTagView==='active' && !(s.generating || s.unread || s.seen)) return false;
    return sessionMatchesPriorityFilter(s) && sessionMatchesTagFilter(s, currentFilterTags());
  }
  function bulkArchiveSeenTargets(){
    return SESS.filter(function(s){
      return !!(s && s.sessionId && !s.pendingFork && !s.generating && attentionState(s)==='seen' && sessionMatchesBulkArchiveScope(s));
    });
  }
  function syncBulkArchiveSeenButton(){
    var btn=byId('bulkArchiveSeen'); if(!btn) return;
    var count=bulkArchiveSeenTargets().length;
    btn.textContent='archive '+count+' seen session'+(count===1?'':'s')+' in this view';
    btn.disabled=bulkArchiveSeenBusy || count===0;
    var tip=count
      ? ('Immediately archive all '+count+' seen session'+(count===1?'':'s')+' matching the current view and focus filters')
      : 'No seen sessions matching the current view and focus filters to archive';
    btn.setAttribute('data-tooltip', tip);
    btn.setAttribute('aria-label', tip);
  }
  function archiveSeenInView(){
    if(bulkArchiveSeenBusy) return;
    var targets=bulkArchiveSeenTargets();
    if(!targets.length){ syncBulkArchiveSeenButton(); return; }
    bulkArchiveSeenBusy=true;
    syncBulkArchiveSeenButton();
    targets.forEach(function(s){ setAttentionState(s, 'read', false); });
    renderSidebar();
    Promise.all(targets.map(function(s){ return postSessionStatus(s, 'read'); }))
      .then(function(){ showToast('Archived '+targets.length+' seen session'+(targets.length===1?'':'s'), 'ok'); })
      .finally(function(){
        bulkArchiveSeenBusy=false;
        syncBulkArchiveSeenButton();
        renderSidebar();
      });
  }
  function findSessionById(sessionId){
    for(var i=0;i<SESS.length;i++){
      var s=SESS[i];
      if(s && (s.sessionId===sessionId || s.clientBranchId===sessionId || providerSessionId(s)===sessionId)) return s;
    }
    return null;
  }
  function findSessionByClientId(clientSessionId){
    for(var i=0;i<SESS.length;i++){
      if(SESS[i] && SESS[i].clientBranchId===clientSessionId) return SESS[i];
    }
    return null;
  }
  function providerSessionId(s){
    if(!s) return '';
    if(s.providerSessionId) return String(s.providerSessionId);
    return s.clientBranchId ? '' : String(s.sessionId||'');
  }
  function makeClientBranchId(){
    try{
      if(crypto && typeof crypto.randomUUID==='function') return 'branch-'+crypto.randomUUID();
    }catch(e){}
    return 'branch-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);
  }
  function syncActivitySortTs(s, ts){
    if(!s || ts==null) return;
    var n=Number(ts);
    if(!isFinite(n)) return;
    s.sortTs = s.sortTs==null ? n : Math.max(Number(s.sortTs)||0, n);
  }
  function syncActivityLastTs(s, ts){
    if(!s || ts==null) return;
    var n=Number(ts);
    if(!isFinite(n)) return;
    var prev=s.lastTs==null ? null : Number(s.lastTs);
    if(prev==null || !isFinite(prev) || n>=prev){
      s.lastTs = n;
      s.ageDays = Math.floor(Math.max(0, Date.now()-n)/86400000);
    }
  }
  function patchSessionView(next){
    if(!next || !next.sessionId) return;
    var s=findSessionById(next.sessionId);
    if(!s) return;
    ['pattern','patternset','patternReason','patternData','avoidancePrompt','state','stateset','score','reason','etaMin','brief','priorityset','etaset','unread','seen','userPromptTs'].forEach(function(k){
      if(next[k]!==undefined) s[k]=next[k];
    });
    if(next.lastTs!==undefined) syncActivityLastTs(s, next.lastTs);
    else if(next.ageDays!==undefined && s.lastTs==null) s.ageDays=next.ageDays;
    syncActivitySortTs(s, next.sortTs!=null ? next.sortTs : next.lastTs);
    sortSessions();
    if(cur && cur.sessionId===s.sessionId){ syncOpenHeader(); renderAvoidancePanel(); }
    renderSidebar();
  }
  function beginVisit(s){
    if(!s || !s.sessionId || s.pendingFork) return;
    viewVisit = {
      sessionId: s.sessionId,
      providerSessionId: providerSessionId(s),
      startedAt: Date.now(),
      lastScrollTop: null,
      scrollPx: 0,
      hadMeaningfulScroll: false,
      hadSend: false,
      wasGenerating: !!s.generating,
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
      hadSend: payload.hadSend,
      wasGenerating: payload.wasGenerating
    });
    if(!E2EE.enabled && useBeacon && navigator.sendBeacon){
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
    var id=providerSessionId(s);
    if(!s || !id || s.pendingFork) return Promise.resolve();
    return fetch('/session/status?session='+encodeURIComponent(id)+(s.cwd?('&cwd='+encodeURIComponent(s.cwd)):''),{
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
    if(!v.providerSessionId || viewedMs < 1000) return Promise.resolve();
    return postVisit({
      sessionId: v.providerSessionId,
      viewedMs: viewedMs,
      endedAt: Date.now(),
      hadMeaningfulScroll: !!v.hadMeaningfulScroll,
      hadSend: !!v.hadSend,
      wasGenerating: !!v.wasGenerating || !!(cur && cur.sessionId===v.sessionId && cur.generating)
    }, !!useBeacon);
  }
  function transcriptTs(m){
    var n=Number(m&&m.ts);
    return isFinite(n) && n>0 ? Math.floor(n) : null;
  }
  function transcriptMsgSig(m){
    return String(m&&m.role||'')+'\\u0000'+String(m&&m.text||'');
  }
  function pendingAfterTail(state){
    if(!Array.isArray(state) || !state.length) return [];
    return state.slice(Math.max(0, state.length-8)).map(transcriptMsgSig);
  }
  function rememberPendingUserMsg(sessionId, text, attachments){
    if(!sessionId || !text) return;
    var list=localPendingMsgs[sessionId] || (localPendingMsgs[sessionId]=[]);
    var state=transcriptCache['sid:'+sessionId];
    list.push({
      text:String(text),
      attachments:cloneAttachments(attachments),
      afterMsgs:Array.isArray(state) ? state.length : null,
      afterTail:pendingAfterTail(state),
      sentAt:Date.now()
    });
  }
  function latestPendingUserText(sessionId){
    var list=sessionId && localPendingMsgs[sessionId];
    if(!list || !list.length) return '';
    return pendingEntryText(list[list.length-1]);
  }
  function transcriptCacheKey(file, vendor){
    return file ? String(vendor||'claude')+'|'+String(file) : '';
  }
  function cloneTranscriptMsgs(msgs){
    return Array.isArray(msgs) ? msgs.map(function(m){
      var ts=transcriptTs(m);
      return {
        role: m && m.role || 'assistant',
        text: m && m.text || '',
        attachments: cloneAttachments(m && m.attachments),
        tools: Array.isArray(m && m.tools) ? m.tools.map(function(t){ return Object.assign({}, t); }) : [],
        ts: ts || undefined
      };
    }) : [];
  }
  function forkBaseHistory(msgs, openingText){
    var base=cloneTranscriptMsgs(msgs);
    var needle=String(openingText||'').trim();
    if(!needle) return base;
    for(var i=base.length-1;i>=0;i--){
      var m=base[i];
      if(!m || m.role!=='user' || !String(m.text||'').trim()) continue;
      return String(m.text||'').trim()===needle ? base.slice(0, i) : base;
    }
    return base;
  }
  function msgIndexFromKey(key){
    var m=String(key||'').match(/:(\d+)$/);
    return m ? Number(m[1]) : -1;
  }
  function domHistoryBeforeMsg(msgEl){
    var msgs=byId('msgs');
    if(!msgs || !msgEl) return null;
    var out=[], node=msgs.firstChild;
    while(node && node!==msgEl){
      if(node.nodeType===1 && node.classList){
        if(node.classList.contains('msg') && (node.classList.contains('user') || node.classList.contains('assistant'))){
          out.push({
            role: node.classList.contains('user') ? 'user' : 'assistant',
            text: previewTextFromMsg(node),
            attachments: [],
            tools: []
          });
        } else if(node.classList.contains('toolc') && out.length){
          var sum=node.querySelector('summary');
          var label=sum ? String(sum.textContent||'').replace(/^\\s*[⚙▸▾?✓📋]+\\s*/, '').split(' — ')[0].trim() : 'tool';
          out[out.length-1].tools.push({ name:label||'tool', input:null });
        }
      }
      node=node.nextSibling;
    }
    return node===msgEl ? out : null;
  }
  function historyBeforeMsg(msgEl){
    if(!msgEl) return null;
    var domHistory=domHistoryBeforeMsg(msgEl);
    if(domHistory) return cloneTranscriptMsgs(domHistory);
    var idx=msgIndexFromKey(msgEl.getAttribute('data-msg-key'));
    if(idx<0) return null;
    var history=cur ? (cachedTranscriptFor(cur) || []) : [];
    if(history.length>=idx) return cloneTranscriptMsgs(history.slice(0, idx));
    return null;
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
  function ensureAssistantTranscriptMsg(s, forceNew){
    var state=ensureTranscriptState(s);
    if(!state) return null;
    var last=state[state.length-1];
    if(last && last.role==='assistant' && !forceNew) return last;
    last = { role:'assistant', text:'', tools:[], ts:Date.now() };
    state.push(last);
    return last;
  }
  function cacheTranscriptUserMsg(s, text, attachments){
    var state=ensureTranscriptState(s);
    if(!state) return;
    state.push({ role:'user', text:String(text||''), attachments:cloneAttachments(attachments), tools:[], ts:Date.now() });
  }
  function cacheTranscriptAssistantText(s, text){
    if(!text) return;
    var state=ensureTranscriptState(s);
    var last=state && state[state.length-1];
    // Live UI renders assistant text after a tool call as a fresh bubble. Keep the
    // optimistic transcript cache in the same order; otherwise tab-switching first
    // renders cached "final text + tools", placing shell/exec blocks at the bottom
    // until the slower transcript fetch corrects it.
    var afterTool = !!(last && last.role==='assistant' && Array.isArray(last.tools) && last.tools.length);
    var msg=ensureAssistantTranscriptMsg(s, afterTool);
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
      if(pendingEntryText(list[i])===String(text)){ list.splice(i,1); break; }
    }
    if(!list.length) delete localPendingMsgs[sessionId];
  }
  function pendingEntryText(entry){
    return entry && typeof entry==='object' ? String(entry.text||'') : String(entry||'');
  }
  function pendingEntryAttachments(entry){
    return entry && typeof entry==='object' ? cloneAttachments(entry.attachments) : [];
  }
  function pendingEntryAfterMsgs(entry, fallback){
    if(entry && typeof entry==='object' && typeof entry.afterMsgs==='number' && isFinite(entry.afterMsgs)){
      return Math.max(0, Math.floor(entry.afterMsgs));
    }
    return fallback;
  }
  function pendingEntryAfterTail(entry){
    return entry && typeof entry==='object' && Array.isArray(entry.afterTail)
      ? entry.afterTail.map(function(x){ return String(x||''); }).filter(Boolean)
      : [];
  }
  function pendingEntrySentAt(entry){
    var n=Number(entry && typeof entry==='object' ? entry.sentAt : null);
    return isFinite(n) && n>0 ? Math.floor(n) : null;
  }
  function findTailEndIndex(msgs, tail){
    if(!Array.isArray(msgs) || !msgs.length || !Array.isArray(tail) || !tail.length) return null;
    var sigs=msgs.map(transcriptMsgSig);
    var maxTake=Math.min(tail.length, sigs.length);
    for(var take=maxTake; take>=1; take--){
      if(take<2 && tail.length>=2) break;
      var suffix=tail.slice(tail.length-take);
      for(var start=sigs.length-take; start>=0; start--){
        var ok=true;
        for(var i=0;i<take;i++){
          if(sigs[start+i]!==suffix[i]){ ok=false; break; }
        }
        if(ok) return start+take;
      }
    }
    return null;
  }
  function timestampConfirmsPending(user, entry, afterWindow){
    if(!afterWindow || !entry.sentAt || !user.ts) return false;
    // /chat/messages returns a bounded tail, so afterMsgs can point past EOF in
    // long sessions. A persisted row timestamp from the same turn proves this is
    // the new send, not an older identical prompt in the truncated window.
    return user.ts >= entry.sentAt - 120000;
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
  // Confirmation still has to respect afterMsgs: a stale transcript can contain
  // the same text from an older turn, but that must not delete the just-sent bubble.
  function transcriptPendingTail(sessionId, msgs){
    var pending=localPendingMsgs[sessionId];
    if(!sessionId || !pending || !pending.length) return [];
    var entries=pending.map(function(entry){
      return {
        text: pendingEntryText(entry),
        attachments: pendingEntryAttachments(entry),
        afterMsgs: pendingEntryAfterMsgs(entry, msgs.length),
        afterTail: pendingEntryAfterTail(entry),
        sentAt: pendingEntrySentAt(entry)
      };
    }).filter(function(entry){ return !!entry.text; });
    var users=[];
    msgs.forEach(function(m, idx){
      if(m && m.role==='user' && m.text) users.push({ text:m.text, msgIndex:idx, ts:transcriptTs(m) });
    });
    var minMsgIndex=0, lastConfirmed=-1;
    for(var i=0;i<entries.length;i++){
      var anchorEnd=findTailEndIndex(msgs, entries[i].afterTail);
      var afterWindow=entries[i].afterMsgs>=msgs.length;
      var startAt=Math.max(minMsgIndex, anchorEnd!=null ? anchorEnd : entries[i].afterMsgs);
      for(var j=0;j<users.length;j++){
        if(users[j].text!==entries[i].text) continue;
        if(users[j].msgIndex < startAt && !timestampConfirmsPending(users[j], entries[i], afterWindow)) continue;
        lastConfirmed=i; minMsgIndex=users[j].msgIndex+1; break;
      }
    }
    var leftover=entries.slice(lastConfirmed+1);
    if(leftover.length) localPendingMsgs[sessionId]=leftover; else delete localPendingMsgs[sessionId];
    return leftover.slice();
  }
  function insertPendingUserMsgs(pending, beforeIndex){
    pending.forEach(function(entry){
      if(entry.afterMsgs===beforeIndex) addMsg('user', entry.text, true, entry.attachments);
    });
  }
  function replaceMessages(node){
    var m=byId('msgs'); if(!m) return;
    // Capture intent BEFORE we touch scrollTop: setting it fires a 'scroll' event
    // that recomputes stick, so reading it later is unreliable.
    var pinToBottom = stick;
    m.style.visibility='hidden';
    m.replaceChildren(node);
    keepGenLast();
    applyCollapsedTurns();
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
    renderPinTray();
    scheduleLatestPin();
  }
  function renderPersistedAndPending(msgs, sessionId){
    var frag=document.createDocumentFragment();
    var prevTarget=renderTarget, prevSuppress=suppressScroll;
    renderTarget=frag; suppressScroll=true; msgOrdinal=0;
    var pending=transcriptPendingTail(sessionId, msgs).map(function(entry){
      return { text:entry.text, attachments:entry.attachments, afterMsgs:Math.min(entry.afterMsgs, msgs.length) };
    });
    if(!msgs.length && !pending.length) addMsg('assistant','(no history yet)');
    for(var i=0;i<=msgs.length;i++){
      insertPendingUserMsgs(pending, i);
      if(i<msgs.length){
        var m=msgs[i];
        if(m.text) addMsg(m.role, m.text, true, m.attachments);
        (m.tools||[]).forEach(function(t){ addTool(t); });
      }
    }
    renderTarget=prevTarget; suppressScroll=prevSuppress;
    replaceMessages(frag);
  }
  function renderSessionHistory(s, msgs){
    cacheTranscript(s, msgs);
    renderPersistedAndPending(msgs, s && s.sessionId);
  }
  function syncTopStack(){
    var stack=byId('topStack'); if(!stack) return;
    var latest=byId('latestPin'), tray=byId('pinTray');
    var show=!!((latest && latest.classList.contains('show')) || (tray && tray.classList.contains('show')));
    stack.classList.toggle('show', show);
    stack.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
  function pinStorageKey(s){
    var id=s && s.sessionId ? String(s.sessionId) : '';
    return id ? 'attend.pins.v1:'+id : '';
  }
  function loadPins(s){
    var key=pinStorageKey(s);
    if(!key) return [];
    var raw=VAULT_STATE.pins && VAULT_STATE.pins[key];
    return Array.isArray(raw) ? raw.filter(function(p){ return p && p.key && p.text; }) : [];
  }
  function savePins(s, pins){
    var key=pinStorageKey(s);
    if(!key) return;
    if(!VAULT_STATE.pins || typeof VAULT_STATE.pins!=='object') VAULT_STATE.pins={};
    if(pins && pins.length) VAULT_STATE.pins[key]=pins;
    else delete VAULT_STATE.pins[key];
    saveVaultUiState({pins:VAULT_STATE.pins});
  }
  function currentPins(){ return loadPins(cur); }
  function isPinnedKey(key){
    if(!key) return false;
    return currentPins().some(function(p){ return p.key===key; });
  }
  function syncMessagePinState(msgEl){
    if(!msgEl) return;
    var btn=msgEl.querySelector('.msg-pin');
    if(!btn) return;
    var on=isPinnedKey(msgEl.getAttribute('data-msg-key'));
    btn.classList.toggle('on', on);
    btn.title=on ? 'Unpin this message' : 'Pin this message to the top';
    btn.setAttribute('aria-label', btn.title);
  }
  function syncAllMessagePinStates(){
    var msgs=byId('msgs'); if(!msgs) return;
    Array.prototype.forEach.call(msgs.querySelectorAll('.msg'), syncMessagePinState);
  }
  function findMsgByKey(key){
    var msgs=byId('msgs'); if(!msgs || !key) return null;
    var nodes=msgs.querySelectorAll('.msg');
    for(var i=0;i<nodes.length;i++){
      if(nodes[i].getAttribute('data-msg-key')===key) return nodes[i];
    }
    return null;
  }
  function scrollToMsgKey(key){
    var m=byId('msgs'), target=findMsgByKey(key);
    if(!m || !target) return;
    if(target.classList.contains('folded-away')){
      target=findFoldSummaryByKey(key) || target;
    }
    var delta=target.getBoundingClientRect().top - m.getBoundingClientRect().top;
    m.scrollTop=Math.max(0, m.scrollTop + delta - 18);
    scheduleLatestPin();
  }
  function msgKeyIndex(key){
    var m=String(key||'').match(/:(\d+)$/);
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
  }
  function msgDomOrder(){
    var order={};
    var msgs=byId('msgs'); if(!msgs) return order;
    var nodes=msgs.querySelectorAll('.msg');
    for(var i=0;i<nodes.length;i++){
      var key=nodes[i].getAttribute('data-msg-key');
      if(key) order[key]=i;
    }
    return order;
  }
  function sortPinsInChatOrder(pins){
    var order=msgDomOrder();
    return (pins||[]).slice().sort(function(a,b){
      var ak=a&&a.key, bk=b&&b.key;
      var ai=Object.prototype.hasOwnProperty.call(order, ak) ? order[ak] : msgKeyIndex(ak);
      var bi=Object.prototype.hasOwnProperty.call(order, bk) ? order[bk] : msgKeyIndex(bk);
      if(ai!==bi) return ai-bi;
      return (a.pinnedAt||0)-(b.pinnedAt||0);
    });
  }
  function previewTextFromMsg(msgEl){
    var bubble=msgEl && msgEl.querySelector('.bubble');
    return (bubble && (bubble.getAttribute('data-raw') || bubble.textContent) || '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function foldedTurnStorageKey(s){
    var id=s && s.sessionId ? String(s.sessionId) : '';
    return id ? 'attend.foldedTurns.v1:'+id : '';
  }
  function loadFoldedTurns(s){
    var key=foldedTurnStorageKey(s);
    if(!key) return [];
    try {
      var raw=JSON.parse(localStorage.getItem(key)||'[]');
      return Array.isArray(raw) ? raw.filter(function(k){ return typeof k==='string' && k; }) : [];
    } catch(e){ return []; }
  }
  function saveFoldedTurns(s, keys){
    var key=foldedTurnStorageKey(s);
    if(!key) return;
    try {
      var clean=(keys||[]).filter(function(k, i, arr){ return k && arr.indexOf(k)===i; });
      if(clean.length) localStorage.setItem(key, JSON.stringify(clean));
      else localStorage.removeItem(key);
    } catch(e){}
  }
  function setTurnFolded(msgKey, folded){
    if(!cur || !msgKey) return;
    var keys=loadFoldedTurns(cur);
    var i=keys.indexOf(msgKey);
    if(folded && i<0) keys.push(msgKey);
    if(!folded && i>=0) keys.splice(i,1);
    saveFoldedTurns(cur, keys);
  }
  function findFoldSummaryByKey(key){
    var msgs=byId('msgs'); if(!msgs || !key) return null;
    var rows=msgs.querySelectorAll('.turnfold-row');
    for(var i=0;i<rows.length;i++){
      if(rows[i].getAttribute('data-fold-key')===key) return rows[i];
    }
    return null;
  }
  function collectTurnFoldNodes(userMsg){
    var nodes=[];
    if(!userMsg) return nodes;
    var node=userMsg;
    while(node){
      if(node.nodeType===1){
        if(node!==userMsg && node.classList.contains('msg') && node.classList.contains('user')) break;
        if(!node.classList.contains('turnfold-row')) nodes.push(node);
      }
      node=node.nextSibling;
    }
    return nodes;
  }
  function turnFoldMeta(nodes){
    var reply=false, tools=0;
    for(var i=1;i<nodes.length;i++){
      var n=nodes[i];
      if(!n || !n.classList) continue;
      if(n.classList.contains('toolc')) tools++;
      if(n.classList.contains('msg') && (n.classList.contains('assistant') || n.classList.contains('thinking') || n.classList.contains('error'))) reply=true;
    }
    if(reply && tools) return 'reply + '+tools+' tool'+(tools===1?'':'s');
    if(reply) return 'reply hidden';
    if(tools) return tools+' tool'+(tools===1?'':'s')+' hidden';
    return 'waiting';
  }
  function makeTurnFoldSummary(userMsg, nodes){
    var key=userMsg && userMsg.getAttribute('data-msg-key');
    var row=el('div','turnfold-row');
    if(key) row.setAttribute('data-fold-key', key);
    var card=el('button','turnfold-card');
    card.type='button';
    card.title='Expand this turn';
    card.onclick=function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      setTurnFolded(key, false);
      applyCollapsedTurns();
      scheduleLatestPin();
    };
    card.appendChild(el('span','turnfold-ico','▸'));
    card.appendChild(el('span','turnfold-text', previewTextFromMsg(userMsg) || '(empty message)'));
    card.appendChild(el('span','turnfold-meta', turnFoldMeta(nodes)));
    row.appendChild(card);
    return row;
  }
  function applyCollapsedTurns(){
    if(applyingTurnFolds) return;
    var msgs=byId('msgs'); if(!msgs || !cur) return;
    applyingTurnFolds=true;
    try {
      Array.prototype.forEach.call(msgs.querySelectorAll('.turnfold-row'), function(row){ row.remove(); });
      Array.prototype.forEach.call(msgs.querySelectorAll('.folded-away'), function(node){
        node.classList.remove('folded-away');
        node.removeAttribute('data-folded-by');
      });
      var keys=loadFoldedTurns(cur);
      keys.forEach(function(key){
        var userMsg=findMsgByKey(key);
        if(!userMsg || !userMsg.classList.contains('user')) return;
        var nodes=collectTurnFoldNodes(userMsg);
        if(!nodes.length) return;
        var summary=makeTurnFoldSummary(userMsg, nodes);
        userMsg.parentNode.insertBefore(summary, userMsg);
        nodes.forEach(function(node){
          if(node.classList){
            node.classList.add('folded-away');
            node.setAttribute('data-folded-by', key);
          }
        });
      });
    } finally {
      applyingTurnFolds=false;
    }
  }
  function toggleTurnFold(msgEl){
    if(!msgEl) return;
    var key=msgEl.getAttribute('data-msg-key');
    if(!key) return;
    var folded=loadFoldedTurns(cur).indexOf(key)>=0;
    setTurnFolded(key, !folded);
    applyCollapsedTurns();
    scheduleLatestPin();
  }
  function pinRoleLabel(pin){
    var role=String(pin&&pin.role||'').trim();
    if(role==='agent') return (cur&&cur.vendor)||'agent';
    return role || 'msg';
  }
  function renderPinTray(){
    var tray=byId('pinTray'); if(!tray) return;
    var pins=sortPinsInChatOrder(currentPins());
    tray.innerHTML='';
    tray.classList.toggle('show', !!pins.length);
    tray.setAttribute('aria-hidden', pins.length ? 'false' : 'true');
    pins.forEach(function(pin){
      var item=el('div','pinitem');
      item.title='Jump to pinned message';
      item.appendChild(el('span','pinrole',pinRoleLabel(pin)));
      item.appendChild(el('div','pintext',pin.text));
      var x=el('button','pinx','×');
      x.title='Unpin';
      x.onclick=function(ev){
        ev.stopPropagation();
        savePins(cur, currentPins().filter(function(p){ return p.key!==pin.key; }));
        renderPinTray();
        syncAllMessagePinStates();
      };
      item.onclick=function(){ scrollToMsgKey(pin.key); };
      item.appendChild(x);
      tray.appendChild(item);
    });
    syncAllMessagePinStates();
    syncTopStack();
  }
  function togglePinnedMessage(msgEl){
    if(!cur || !msgEl) return;
    var key=msgEl.getAttribute('data-msg-key');
    if(!key) return;
    var pins=currentPins();
    var i=pins.findIndex(function(p){ return p.key===key; });
    if(i>=0) pins.splice(i,1);
    else {
      var text=previewTextFromMsg(msgEl);
      if(!text) return;
      pins.push({ key:key, role:msgEl.classList.contains('user') ? 'you' : ((cur&&cur.vendor)||'agent'), text:text.slice(0, 1200), pinnedAt:Date.now() });
    }
    savePins(cur, sortPinsInChatOrder(pins));
    renderPinTray();
    syncMessagePinState(msgEl);
  }
  function hideLatestPin(){
    var pin=byId('latestPin'), body=byId('latestPinBody');
    if(!pin || !body) return;
    pin.classList.remove('show');
    pin.setAttribute('aria-hidden','true');
    body.innerHTML='';
    syncTopStack();
  }
  function refreshLatestUserMsg(){
    var msgs=byId('msgs'); if(!msgs) return null;
    var frame=msgs.getBoundingClientRect();
    var nodes=msgs.querySelectorAll('.msg.user');
    latestUserMsgEl = null;
    Array.prototype.forEach.call(nodes, function(node){
      if(node.classList.contains('folded-away')) return;
      var box=node.getBoundingClientRect();
      if(box.bottom < frame.top + 10) latestUserMsgEl = node;
    });
    return latestUserMsgEl;
  }
  function showLatestPinFrom(msgEl){
    var pin=byId('latestPin'), body=byId('latestPinBody');
    if(!pin || !body || !msgEl) return;
    var bubble=msgEl.querySelector('.bubble');
    if(!bubble) return hideLatestPin();
    body.innerHTML='';
    body.appendChild(el('span','latestpin-k','latest · you'));
    body.appendChild(el('span','latestpin-text',previewTextFromMsg(msgEl)));
    body.appendChild(el('span','latestpin-arrow','→'));
    pin.classList.add('show');
    pin.setAttribute('aria-hidden','false');
    syncTopStack();
  }
  function updateLatestPin(){
    latestPinRaf = 0;
    var m=byId('msgs'); if(!m || !cur || cur.pendingFork) return hideLatestPin();
    var msgEl=refreshLatestUserMsg();
    if(!msgEl) return hideLatestPin();
    showLatestPinFrom(msgEl);
  }
  function scheduleLatestPin(){
    if(latestPinRaf) return;
    latestPinRaf = requestAnimationFrame(updateLatestPin);
  }
  function jumpToLatestPin(){
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
  function fenceLang(raw){
    return String(raw||'').trim().split(/\\s+/)[0].toLowerCase();
  }
  function isMermaidLang(lang){ return lang==='mermaid'; }
  function isPlantUmlLang(lang){ return lang==='plantuml' || lang==='puml'; }
  function diagramBlock(lang, code){
    var type=isMermaidLang(lang) ? 'mermaid' : 'plantuml';
    var label=type==='mermaid' ? 'Mermaid' : 'PlantUML';
    return '<div class="diagram diagram-'+type+'" data-diagram="'+type+'" data-source="'+escapeAttr(code)+'"><div class="diagram-status">Rendering '+label+' diagram...</div></div>';
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
        var lang=fenceLang(fence[1]||'');
        var code=[]; i++;
        while(i<lines.length && !/^\x60\x60\x60/.test(lines[i])){ code.push(lines[i]); i++; }
        if(i<lines.length) i++;
        if(isMermaidLang(lang) || isPlantUmlLang(lang)){
          out.push(diagramBlock(lang, code.join('\\n')));
          continue;
        }
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
  var diagramSeq = 0;
  var MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
  var PAKO_CDN = 'https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js';
  var PLANTUML_SVG_BASE = 'https://www.plantuml.com/plantuml/svg/';
  function loadScriptOnce(key, src){
    if(window[key]) return window[key];
    window[key] = new Promise(function(resolve, reject){
      var existing=document.querySelector('script[data-attend-lib="'+key+'"]');
      if(existing){
        existing.addEventListener('load', resolve, { once:true });
        existing.addEventListener('error', function(){ reject(new Error('failed to load '+src)); }, { once:true });
        return;
      }
      var script=document.createElement('script');
      script.src=src;
      script.async=true;
      script.setAttribute('data-attend-lib', key);
      script.onload=function(){ resolve(); };
      script.onerror=function(){ reject(new Error('failed to load '+src)); };
      document.head.appendChild(script);
    });
    return window[key];
  }
  function loadMermaid(){
    return loadScriptOnce('__attendMermaidReady', MERMAID_CDN).then(function(){
      if(!window.mermaid) throw new Error('mermaid unavailable');
      if(!window.__attendMermaidInit){
        window.mermaid.initialize({ startOnLoad:false, securityLevel:'strict' });
        window.__attendMermaidInit = true;
      }
      return window.mermaid;
    });
  }
  function loadPako(){
    return loadScriptOnce('__attendPakoReady', PAKO_CDN).then(function(){
      if(!window.pako || typeof window.pako.deflateRaw!=='function') throw new Error('pako unavailable');
      return window.pako;
    });
  }
  function showDiagramFallback(node, title, source, err){
    if(!node) return;
    var msg=title+(err && err.message ? ': '+err.message : '');
    node.removeAttribute('data-rendering');
    node.setAttribute('data-rendered', 'error');
    node.innerHTML='<div class="diagram-error">'+escapeHtml(msg)+'</div><pre class="diagram-fallback"><code>'+escapeHtml(source)+'</code></pre>';
  }
  function diagramPreviewName(type){
    return type==='mermaid' ? 'Mermaid diagram' : 'PlantUML diagram';
  }
  function openDiagramPreview(node){
    if(!node) return;
    var type=node.getAttribute('data-diagram') || 'diagram';
    if(type==='plantuml'){
      var img=node.querySelector('img');
      if(img && img.src) openMediaPreview({ src:img.src, name:diagramPreviewName(type), alt:diagramPreviewName(type) });
      return;
    }
    var svg=node.querySelector('svg');
    if(svg) openMediaPreview({ svg:svg.outerHTML, name:diagramPreviewName(type) });
  }
  function isDiagramControlClick(ev){
    var target=ev && ev.target;
    return !!(target && target.closest && target.closest('a,button,input,textarea,select,label'));
  }
  function enableDiagramPreview(node){
    if(!node || node.getAttribute('data-preview-bound')) return;
    node.setAttribute('data-preview-bound', '1');
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.title='Open diagram preview';
    node.onclick=function(ev){ if(isDiagramControlClick(ev)) return; openDiagramPreview(node); };
    node.onkeydown=function(ev){ if(ev.key==='Enter' || ev.key===' '){ ev.preventDefault(); openDiagramPreview(node); } };
  }
  function renderMermaidDiagram(node){
    if(!node || node.getAttribute('data-rendering') || node.getAttribute('data-rendered')) return;
    var source=node.getAttribute('data-source') || '';
    node.setAttribute('data-rendering', '1');
    loadMermaid().then(function(mermaid){
      var id='attend-mermaid-'+(++diagramSeq);
      return Promise.resolve(mermaid.render(id, source));
    }).then(function(res){
      node.removeAttribute('data-rendering');
      node.setAttribute('data-rendered', 'ok');
      node.innerHTML=(res && res.svg) ? res.svg : '';
      enableDiagramPreview(node);
    }).catch(function(err){
      showDiagramFallback(node, 'Mermaid render failed', source, err);
    });
  }
  function encodePlantUml6Bit(b){
    if(b<10) return String.fromCharCode(48+b);
    b-=10;
    if(b<26) return String.fromCharCode(65+b);
    b-=26;
    if(b<26) return String.fromCharCode(97+b);
    b-=26;
    return b===0 ? '-' : b===1 ? '_' : '?';
  }
  function appendPlantUml3Bytes(b1, b2, b3){
    var c1=b1>>2;
    var c2=((b1&0x3)<<4)|(b2>>4);
    var c3=((b2&0xf)<<2)|(b3>>6);
    var c4=b3&0x3f;
    return encodePlantUml6Bit(c1&0x3f)+encodePlantUml6Bit(c2&0x3f)+encodePlantUml6Bit(c3&0x3f)+encodePlantUml6Bit(c4&0x3f);
  }
  function encodePlantUmlBytes(bytes){
    var out='';
    for(var i=0;i<bytes.length;i+=3){
      var b1=bytes[i];
      var b2=i+1<bytes.length ? bytes[i+1] : 0;
      var b3=i+2<bytes.length ? bytes[i+2] : 0;
      out += appendPlantUml3Bytes(b1, b2, b3);
    }
    return out;
  }
  function plantUmlSvgUrl(source, pako){
    var input=new TextEncoder().encode(source);
    var deflated=pako.deflateRaw(input, { level:9 });
    return PLANTUML_SVG_BASE+encodePlantUmlBytes(deflated);
  }
  function renderPlantUmlDiagram(node){
    if(!node || node.getAttribute('data-rendering') || node.getAttribute('data-rendered')) return;
    var source=node.getAttribute('data-source') || '';
    node.setAttribute('data-rendering', '1');
    loadPako().then(function(pako){
      var img=new Image();
      img.alt='PlantUML diagram';
      img.loading='lazy';
      img.onload=function(){
        node.removeAttribute('data-rendering');
        node.setAttribute('data-rendered', 'ok');
        enableDiagramPreview(node);
      };
      img.onerror=function(){ showDiagramFallback(node, 'PlantUML render failed', source); };
      node.innerHTML='';
      node.appendChild(img);
      img.src=plantUmlSvgUrl(source, pako);
    }).catch(function(err){
      showDiagramFallback(node, 'PlantUML render failed', source, err);
    });
  }
  function renderDiagrams(root){
    if(!root || typeof root.querySelectorAll!=='function') return;
    root.querySelectorAll('.diagram[data-diagram]').forEach(function(node){
      var type=node.getAttribute('data-diagram');
      if(type==='mermaid') renderMermaidDiagram(node);
      else if(type==='plantuml') renderPlantUmlDiagram(node);
    });
  }
  function setBubbleText(bubble, text, markdown){
    if(!bubble) return;
    var raw=String(text||'');
    bubble.setAttribute('data-raw', raw);
    if(markdown){ bubble.innerHTML = renderMarkdown(raw); linkifyPaths(bubble); renderDiagrams(bubble); }
    else bubble.textContent = raw;
  }
  // A path-like token: absolute (/…, C:\\…, ~/…) or a relative path / bare filename
  // with a real extension. Deliberately liberal — clicks 404 server-side if the
  // file doesn't exist, so a false positive (e.g. "claude.ai") just does nothing.
  function pathRegex(){
    return /[A-Za-z]:\\\\[^\\s<>"']+|~\\/[^\\s<>"']+|\\/[\\w.\\-]+(?:\\/[\\w.\\-]+)*|[\\w.\\-]+(?:\\/[\\w.\\-]+)+|[\\w][\\w.\\-]*\\.[A-Za-z][A-Za-z0-9]{1,7}/g;
  }
  function isUrlPathContinuation(text, start, raw){
    var before=String(text||'').slice(Math.max(0, start-24), start);
    if(/(?:https?|ftp):\\/{1,2}$/i.test(before)) return true;
    if(raw && raw.charAt(0)==='/' && /(?:https?|ftp):\\/?$/i.test(before)) return true;
    return false;
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
      if(isUrlPathContinuation(text, m.index, raw)) continue;
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
  function clearTheme(node){
    if(!node) return;
    node.style.color='';
    node.style.backgroundColor='';
    node.style.borderColor='';
    node.style.boxShadow='';
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
  function customSelectTheme(sel, optValue){
    if(!sel) return null;
    if(sel.id==='rvendor') return vendorTheme(String(optValue||sel.value||'').trim().toLowerCase());
    return null;
  }
  function styleSelectTheme(node, theme, selected){
    if(!node) return;
    if(!theme){ clearTheme(node); return; }
    var dark=document.documentElement.getAttribute('data-theme')==='dark';
    node.style.color=dark && !selected ? (theme.border || theme.fg) : theme.fg;
    if(selected){
      node.style.backgroundColor=theme.bg;
      node.style.borderColor=theme.border;
      node.style.boxShadow='inset 0 0 0 1px '+theme.border;
    } else {
      node.style.backgroundColor='';
      node.style.borderColor='';
      node.style.boxShadow='';
    }
  }
  function themeChooserInput(input, theme){
    if(!input) return;
    if(theme) styleTheme(input, theme);
    else clearTheme(input);
  }
  function applyVendorChooserTheme(value){
    var input=byId('nvendor');
    var vendor=String(value||'').trim().toLowerCase();
    themeChooserInput(input, vendorInfo(vendor) ? vendorTheme(vendor) : null);
  }
  function applyDirChooserTheme(value){
    var input=byId('ndir');
    var dir=String(value||'').trim();
    themeChooserInput(input, dir ? projectTheme(dirDisplayLabel(dir) || dir) : null);
  }
  function vendorBadge(vendor){
    return el('span','vtag '+vendor,vendor);
  }
  function projectBadge(project){
    var badge=el('span','ptag',project);
    styleTheme(badge, projectTheme(project));
    return badge;
  }
  function vendorText(vendor){
    return el('span','vtag '+vendor,vendor);
  }
  function projectText(project){
    var badge=el('span','ptag',project);
    var theme=projectTheme(project);
    if(theme){
      badge.style.setProperty('--project-fg', theme.fg);
      badge.style.setProperty('--project-fg-dark', theme.border);
    }
    return badge;
  }
  function sessionContextRow(s){
    var row=el('div','it-context');
    row.appendChild(vendorText(s.vendor));
    row.appendChild(el('span','ctx-sep','·'));
    var project=projectText(s.project);
    if(s.cwd) project.title=s.cwd;
    row.appendChild(project);
    row.appendChild(el('span','ctx-sep','·'));
    row.appendChild(el('span','ctx-prompts',(s.prompts||0)+'p'));
    return row;
  }
  var STATE_OPTIONS=['continue_ready','needs_decision','needs_input','blocked','needs_review','followup_suggested','done'];
  var PRIORITY_LEVELS=[9,7,5,3,1];
  var signalMenu=null;
  var signalMenuKey=null;
  var signalMenuAnchor=null;
  var signalMenuDocClose=null;
  function closeSignalMenu(){
    if(signalMenu){ signalMenu.remove(); }
    signalMenu=null;
    signalMenuKey=null;
    signalMenuAnchor=null;
    if(signalMenuDocClose){
      document.removeEventListener('click', signalMenuDocClose);
      signalMenuDocClose=null;
    }
  }
  function placeSignalMenu(menu, anchor){
    var r=anchor.getBoundingClientRect();
    document.body.appendChild(menu);
    var pad=10;
    var left=Math.min(Math.max(pad, r.left), window.innerWidth-(menu.offsetWidth||160)-pad);
    var top=r.bottom+6;
    if(top+(menu.offsetHeight||180)>window.innerHeight-pad) top=Math.max(pad, r.top-(menu.offsetHeight||180)-6);
    menu.style.left=left+'px';
    menu.style.top=top+'px';
  }
  function openSignalMenu(menu, anchor, key){
    menu.onclick=function(ev){ ev.stopPropagation(); };
    placeSignalMenu(menu, anchor);
    signalMenu=menu;
    signalMenuKey=key || null;
    signalMenuAnchor=anchor || null;
    setTimeout(function(){
      if(signalMenu!==menu) return;
      signalMenuDocClose=function(){ closeSignalMenu(); };
      document.addEventListener('click', signalMenuDocClose);
    },0);
  }
  function showSignalMenu(anchor, s, field, options){
    if(!s||!s.sessionId) return;
    var key=field+':'+s.sessionId;
    if(signalMenu && signalMenuKey===key && signalMenuAnchor===anchor){ closeSignalMenu(); return; }
    closeSignalMenu();
    var menu=el('div','sigmenu');
    options.forEach(function(opt){
      var item=el('div','sigmenu-opt'+(opt.on?' on':''));
      if(opt.node) item.appendChild(opt.node);
      else item.appendChild(el('span',null,opt.label||String(opt.value)));
      item.onclick=function(ev){ ev.stopPropagation(); closeSignalMenu(); saveOverride(s, field, opt.value); renderSidebar(); if(cur&&cur.sessionId===s.sessionId) headerSig(s); };
      menu.appendChild(item);
    });
    openSignalMenu(menu, anchor, key);
  }
  function fmtAvoidMinutes(min){
    var n=Number(min)||0;
    if(n>=60) return (n/60).toFixed(1)+'h';
    return Math.max(0, Math.round(n))+'m';
  }
  function avoidStat(k, v){
    var box=el('div','avoid-stat');
    box.appendChild(el('div','avoid-stat-k',k));
    box.appendChild(el('div','avoid-stat-v',v));
    return box;
  }
  function avoidanceStats(s){
    var d=s&&s.patternData;
    var wrap=el('div','avoid-stats');
    if(d){
      wrap.appendChild(avoidStat('visits', String(d.visits||0)));
      wrap.appendChild(avoidStat('dwell', fmtAvoidMinutes(d.minutes)));
    } else {
      wrap.appendChild(avoidStat('visits', '?'));
      wrap.appendChild(avoidStat('dwell', '?'));
    }
    return wrap;
  }
  function avoidanceNudgeText(s){
    if(s&&s.avoidancePrompt) return String(s.avoidancePrompt);
    var text=[s&&s.brief,s&&s.title,s&&s.lastPrompt].filter(Boolean).join(' ');
    if(/[\\u3400-\\u9fff]/.test(text)){
      return '请把这个任务接下来最难推进的部分拆小：列出最小下一步、需要我确认的信息，以及默认推荐选择。';
    }
    return 'Make this easier to resume: name the smallest next step, the info you need from me, and your recommended default choice.';
  }
  function draftAvoidancePrompt(s){
    if(!s||!s.sessionId) return;
    var text=avoidanceNudgeText(s);
    closeSignalMenu();
    var input=byId('input');
    if(input){
      input.value=text;
      setDraftForSession(s, text);
      input.focus();
      input.select();
    }
  }
  function renderAvoidancePanel(){
    var host=byId('avoidPanel');
    if(!host) return;
    host.innerHTML='';
    if(!cur || cur.pattern!=='avoidance' || cur.pendingFork){
      host.hidden=true;
      scheduleOverlayOffsets();
      return;
    }
    host.hidden=false;
    var panel=el('div','avoidpanel');
    panel.appendChild(el('div','avoidpanel-title','avoidance'));
    panel.appendChild(avoidanceStats(cur));
    panel.appendChild(el('div','avoidpanel-draft',avoidanceNudgeText(cur)));
    var actions=el('div','avoidpanel-actions');
    var draft=el('button','avoidpanel-draftbtn','edit & send');
    draft.onclick=function(ev){ ev.stopPropagation(); draftAvoidancePrompt(cur); };
    var clear=el('button','avoidpanel-clear','clear');
    clear.onclick=function(ev){
      ev.stopPropagation();
      saveOverride(cur, 'pattern', 'unknown');
      renderSidebar();
      renderAvoidancePanel();
      headerSig(cur);
    };
    actions.appendChild(draft);
    actions.appendChild(clear);
    panel.appendChild(actions);
    host.appendChild(panel);
    scheduleOverlayOffsets();
  }
  function stateLabel(state){
    return STATE_OPTIONS.indexOf(state)>=0 ? state : '';
  }
  function stateTitle(state){
    return ({
      continue_ready:'planned chunk finished; ready to continue',
      needs_decision:'waiting for a decision or approval',
      needs_input:'waiting for missing context or input',
      blocked:'blocked by resource, permission, dependency, or tooling',
      needs_review:'ready for verification or review',
      followup_suggested:'original task done; optional follow-up suggested',
      done:'task complete; no action requested'
    })[state] || '';
  }
  function stateChip(state, edited){
    var label=stateLabel(state);
    if(!label) return null;
    var badge=el('span','state '+state+(edited?' edited':''),label);
    badge.title=stateTitle(state);
    return badge;
  }
  function stateBadge(s){
    if(!s || !s.state) return null;
    var badge=stateChip(s.state, !!s.stateset);
    if(s.sessionId) badge.onclick=function(ev){ ev.stopPropagation(); showSignalMenu(badge, s, 'state', STATE_OPTIONS.map(function(st){ return {value:st,label:stateLabel(st),node:stateChip(st, false),on:st===s.state}; })); };
    return badge;
  }
  function priorityLevel(score){
    var n=Number(score);
    if(!isFinite(n)) return 5;
    if(n>=9) return 1;
    if(n>=7) return 2;
    if(n>=5) return 3;
    if(n>=3) return 4;
    return 5;
  }
  function priorityFilterLabel(levels){
    levels=normalizePriorityFilter(levels);
    if(levels.length===1) return 'P'+levels[0];
    var continuous=levels[0]-levels[levels.length-1]===levels.length-1;
    if(continuous) return 'P'+levels[0]+'-P'+levels[levels.length-1];
    return levels.map(function(level){ return 'P'+level; }).join(',');
  }
  function priorityFilterGradient(levels){
    levels=normalizePriorityFilter(levels);
    var width=100/levels.length;
    var stops=[];
    levels.forEach(function(level, idx){
      var from=(idx*width).toFixed(3)+'%';
      var to=((idx+1)*width).toFixed(3)+'%';
      stops.push('var(--priority-'+level+'-bg) '+from, 'var(--priority-'+level+'-bg) '+to);
    });
    return 'linear-gradient(90deg,'+stops.join(',')+')';
  }
  function stylePriorityFilterChip(chip, btn, levels, active){
    levels=normalizePriorityFilter(levels);
    chip.classList.toggle('on', !!active);
    chip.style.backgroundColor='transparent';
    chip.style.backgroundImage=priorityFilterGradient(levels);
    chip.style.borderColor=levels.length===1 ? 'var(--priority-'+levels[0]+'-fg)' : 'var(--line-2)';
    chip.style.boxShadow=active ? 'inset 0 0 0 1px rgba(100,116,139,0.2)' : '';
    btn.style.backgroundColor='transparent';
    btn.style.color=levels.length===1 ? 'var(--priority-'+levels[0]+'-fg)' : 'var(--ink-2)';
  }
  function sessionMatchesPriorityFilter(s){
    if(priorityFilter.length===5) return true;
    return priorityFilter.indexOf(priorityLevel(s&&s.score))>=0;
  }
  function togglePriorityFilterLevel(level){
    var next=priorityFilter.slice();
    var idx=next.indexOf(level);
    if(idx>=0){
      if(next.length===1) return;
      next.splice(idx,1);
    } else next.push(level);
    priorityFilter=normalizePriorityFilter(next);
    savePriorityFilter();
    renderTagFilters();
    reconcileCurrentSessionToFilter();
  }
  function priorityMeter(score, cls, edited){
    var lvl=priorityLevel(score);
    var meter=el('span',(cls||'')+' prilabel l'+lvl+(edited?' edited':''),'P'+lvl);
    meter.title='priority '+Number(score||0).toFixed(1);
    return meter;
  }
  function vendorChoices(q){
    var query=String(q||'').trim().toLowerCase();
    return VENDORS.filter(function(v){ return v && v.available && (!query || v.vendor.toLowerCase().indexOf(query)>=0); });
  }
  function saveNewPrefs(){
    VAULT_STATE.modelPrefs=newPrefs;
    saveVaultUiState({modelPrefs:newPrefs});
  }
  function saveVaultUiState(patch){
    fetch('/vault/ui-state',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(patch)}).catch(function(){});
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
    syncCustomSelect(sel);
  }
  var openCustomSelect=null;
  function selectedOptionText(sel){
    var opt=sel && sel.options ? sel.options[sel.selectedIndex] : null;
    return opt ? opt.textContent : '';
  }
  function closeCustomSelect(ctrl){
    if(!ctrl) ctrl=openCustomSelect;
    if(!ctrl) return;
    ctrl.menu.hidden=true;
    ctrl.button.setAttribute('aria-expanded','false');
    if(openCustomSelect===ctrl) openCustomSelect=null;
  }
  function renderCustomSelectOptions(ctrl){
    var sel=ctrl.select;
    ctrl.menu.innerHTML='';
    Array.prototype.forEach.call(sel.options || [], function(opt, idx){
      var item=el('div','selectopt', opt.textContent || opt.value || '');
      item.setAttribute('role','option');
      item.setAttribute('data-value', opt.value);
      item.setAttribute('aria-selected', opt.selected ? 'true' : 'false');
      styleSelectTheme(item, customSelectTheme(sel, opt.value), opt.selected);
      item.onmousedown=function(ev){ ev.preventDefault(); ev.stopPropagation(); };
      item.onclick=function(ev){
        ev.preventDefault(); ev.stopPropagation();
        sel.value=opt.value;
        syncCustomSelect(sel);
        closeCustomSelect(ctrl);
        sel.dispatchEvent(new Event('change', { bubbles:true }));
      };
      ctrl.menu.appendChild(item);
      if(opt.selected) ctrl.active=idx;
    });
  }
  function syncCustomSelect(sel){
    var ctrl=sel && sel._customSelect;
    if(!ctrl) return;
    ctrl.text.textContent=selectedOptionText(sel) || '';
    ctrl.button.disabled=sel.disabled;
    styleSelectTheme(ctrl.button, customSelectTheme(sel, sel.value), true);
    renderCustomSelectOptions(ctrl);
  }
  function moveCustomSelect(ctrl, delta){
    var opts=ctrl.menu.querySelectorAll('.selectopt');
    if(!opts.length) return;
    ctrl.active=(ctrl.active+delta+opts.length)%opts.length;
    Array.prototype.forEach.call(opts, function(node, idx){ node.classList.toggle('on', idx===ctrl.active); });
    opts[ctrl.active].scrollIntoView({ block:'nearest' });
  }
  function openCustomSelectMenu(ctrl){
    if(openCustomSelect && openCustomSelect!==ctrl) closeCustomSelect(openCustomSelect);
    syncCustomSelect(ctrl.select);
    ctrl.menu.hidden=false;
    ctrl.button.setAttribute('aria-expanded','true');
    openCustomSelect=ctrl;
    var selected=ctrl.menu.querySelector('.selectopt[aria-selected="true"]');
    if(selected) selected.scrollIntoView({ block:'nearest' });
  }
  function enhanceCustomSelect(id){
    var sel=byId(id); if(!sel || sel._customSelect) return;
    sel.classList.add('is-enhanced');
    var wrap=el('div','selectwrap');
    var button=el('button','selectbtn');
    button.type='button';
    button.setAttribute('aria-haspopup','listbox');
    button.setAttribute('aria-expanded','false');
    var text=el('span','selecttxt');
    button.appendChild(text);
    var menu=el('div','selectmenu');
    menu.setAttribute('role','listbox');
    menu.hidden=true;
    wrap.appendChild(button);
    wrap.appendChild(menu);
    sel.insertAdjacentElement('afterend', wrap);
    var ctrl={ select:sel, wrap:wrap, button:button, text:text, menu:menu, active:0 };
    sel._customSelect=ctrl;
    button.onclick=function(ev){
      ev.preventDefault(); ev.stopPropagation();
      if(menu.hidden) openCustomSelectMenu(ctrl);
      else closeCustomSelect(ctrl);
    };
    button.onkeydown=function(ev){
      if(ev.key==='ArrowDown'){ ev.preventDefault(); if(menu.hidden) openCustomSelectMenu(ctrl); else moveCustomSelect(ctrl, 1); }
      else if(ev.key==='ArrowUp'){ ev.preventDefault(); if(menu.hidden) openCustomSelectMenu(ctrl); else moveCustomSelect(ctrl, -1); }
      else if(ev.key==='Enter' || ev.key===' '){
        ev.preventDefault();
        if(menu.hidden) openCustomSelectMenu(ctrl);
        else {
          var opt=menu.querySelectorAll('.selectopt')[ctrl.active];
          if(opt) opt.click();
        }
      } else if(ev.key==='Escape'){ closeCustomSelect(ctrl); }
    };
    sel.addEventListener('change', function(){ syncCustomSelect(sel); });
    syncCustomSelect(sel);
  }
  function setupCustomSelects(){
    ['nmodel','neffort','rvendor','rmodel','reffort'].forEach(enhanceCustomSelect);
    // Effort choices are per-model (Codex advertises different reasoning levels per
    // model) — restore that model's last-used effort whenever the model changes.
    var nmodel=byId('nmodel'); if(nmodel) nmodel.addEventListener('change', syncNewEffortToModel);
    var rmodel=byId('rmodel'); if(rmodel) rmodel.addEventListener('change', syncRunEffortToModel);
    var reffort=byId('reffort'); if(reffort) reffort.addEventListener('change', applyRunConfig);
    document.addEventListener('pointerdown', function(ev){
      if(openCustomSelect && !openCustomSelect.wrap.contains(ev.target)) closeCustomSelect(openCustomSelect);
    });
  }
  function normalizedModelOptions(models){
    return Array.isArray(models) ? models.filter(function(opt){
      return opt && typeof opt.value==='string' && opt.value.trim();
    }).map(function(opt){
      var value=opt.value.trim();
      var label=typeof opt.label==='string' && opt.label.trim() ? opt.label.trim() : value;
      var out={ value:value, label:label };
      if(Array.isArray(opt.efforts)){
        var efs=opt.efforts.filter(function(e){ return typeof e==='string' && e.trim(); })
          .map(function(e){ return e.trim().toLowerCase(); });
        if(efs.length) out.efforts=efs;
      }
      if(typeof opt.defaultEffort==='string' && opt.defaultEffort.trim()) out.defaultEffort=opt.defaultEffort.trim().toLowerCase();
      return out;
    }) : [];
  }
  // Look up a specific model's advertised metadata (efforts/defaultEffort), if any.
  function modelMetaFor(vendor, model){
    var slug=String(model||'').trim();
    if(!slug) return null;
    var src = vendor==='claude' ? CLAUDE_MODELS : (vendor==='codex' ? CODEX_MODELS : null);
    if(!src) return null;
    var list=normalizedModelOptions(src);
    for(var i=0;i<list.length;i++){ if(list[i].value===slug) return list[i]; }
    return null;
  }
  // Effort choices for a vendor+model: the model's own levels when advertised,
  // else the static per-vendor fallback (universally-safe set).
  function effortOptionsFor(vendor, model){
    var meta=modelMetaFor(vendor, model);
    if(meta && meta.efforts && meta.efforts.length){
      return meta.efforts.map(function(e){ return { value:e, label:e }; });
    }
    return NEW_EFFORT_OPTIONS[vendor] || [];
  }
  function defaultEffortFor(vendor, model){
    var meta=modelMetaFor(vendor, model);
    if(meta && meta.defaultEffort) return meta.defaultEffort;
    return vendor==='codex' ? 'medium' : 'high';
  }
  function modelEffortKey(model){
    return String(model||'').trim() || '__current_cli_model__';
  }
  function rememberedModelEffort(vendor, model){
    var byVendor=newPrefs.modelEfforts && newPrefs.modelEfforts[vendor];
    var key=modelEffortKey(model);
    if(byVendor && Object.prototype.hasOwnProperty.call(byVendor, key)) return String(byVendor[key]||'').trim().toLowerCase();
    // Backward compatibility with v1 preferences, which only remembered the last
    // new-session model+effort pair for each vendor.
    var legacy=newPrefs[vendor];
    if(legacy && String(legacy.model||'').trim()===String(model||'').trim()) return String(legacy.effort||'').trim().toLowerCase();
    return undefined;
  }
  function linkedEffortFor(vendor, model){
    var remembered=rememberedModelEffort(vendor, model);
    if(remembered!==undefined){
      if(!remembered) return defaultEffortFor(vendor, model);
      var safe=safeEffort(vendor, model, remembered);
      if(safe) return safe;
    }
    return defaultEffortFor(vendor, model);
  }
  function rememberModelEffort(vendor, model, effort){
    vendor=String(vendor||'').trim().toLowerCase();
    if(!vendor) return;
    if(!newPrefs.modelEfforts || typeof newPrefs.modelEfforts!=='object') newPrefs.modelEfforts={};
    if(!newPrefs.modelEfforts[vendor] || typeof newPrefs.modelEfforts[vendor]!=='object') newPrefs.modelEfforts[vendor]={};
    newPrefs.modelEfforts[vendor][modelEffortKey(model)]=String(effort||'').trim().toLowerCase();
    saveNewPrefs();
  }
  function claudeModelOptions(){
    var dynamic = normalizedModelOptions(CLAUDE_MODELS);
    return dynamic.length ? [{ value:'', label:'current CLI model' }].concat(dynamic) : NEW_MODEL_OPTIONS.claude;
  }
  function codexModelOptions(){
    var dynamic = normalizedModelOptions(CODEX_MODELS);
    return dynamic.length ? [{ value:'', label:'current CLI model' }].concat(dynamic) : NEW_MODEL_OPTIONS.codex;
  }
  function applyClaudeModelSnapshot(models){
    var next=normalizedModelOptions(models);
    // Ignore a missing/partially-written cache; keep either the server-rendered
    // snapshot or the built-in fallback until Claude Code publishes a valid list.
    if(!next.length) return;
    if(JSON.stringify(next)===JSON.stringify(normalizedModelOptions(CLAUDE_MODELS))) return;
    CLAUDE_MODELS=next;
    var nvendor=((byId('nvendor')||{}).value||'').trim().toLowerCase();
    if(nvendor==='claude'){
      var nmodel=selectedNewModel();
      populateSelect('nmodel', modelOptionsFor('claude'), nmodel);
      refreshNewEffortOptions(linkedEffortFor('claude', nmodel));
    }
    var rvendor=String((byId('rvendor')||{}).value||'').trim().toLowerCase();
    if(rvendor==='claude' && runPopOpen()) refreshRunConfigControls(false);
  }
  function applyCodexModelSnapshot(models){
    var next=normalizedModelOptions(models);
    // Ignore a missing/partially-written cache; keep either the server-rendered
    // snapshot or the built-in fallback until Codex publishes a valid list.
    if(!next.length) return;
    if(JSON.stringify(next)===JSON.stringify(normalizedModelOptions(CODEX_MODELS))) return;
    CODEX_MODELS=next;
    var nvendor=((byId('nvendor')||{}).value||'').trim().toLowerCase();
    if(nvendor==='codex'){
      var nmodel=selectedNewModel();
      populateSelect('nmodel', modelOptionsFor('codex'), nmodel);
      refreshNewEffortOptions(linkedEffortFor('codex', nmodel));
    }
    var rvendor=String((byId('rvendor')||{}).value||'').trim().toLowerCase();
      if(rvendor==='codex' && runPopOpen()) refreshRunConfigControls(false);
  }
  function refreshClaudeModels(){
    fetch('/models/claude', { cache:'no-store' }).then(function(r){ return r.json(); }).then(function(res){
      applyClaudeModelSnapshot(res && res.models);
    }).catch(function(){});
  }
  function refreshCodexModels(){
    fetch('/models/codex', { cache:'no-store' }).then(function(r){ return r.json(); }).then(function(res){
      applyCodexModelSnapshot(res && res.models);
    }).catch(function(){});
  }
  function modelOptionsFor(vendor){
    if(vendor==='claude') return claudeModelOptions();
    if(vendor==='codex') return codexModelOptions();
    return NEW_MODEL_OPTIONS[vendor] || [{ value:'', label:'current CLI model' }];
  }
  function applyNewSessionPrefs(force){
    var vendor=((byId('nvendor')||{}).value||'').trim().toLowerCase();
    if(!vendorInfo(vendor)) return;
    if(!force && appliedNewVendor===vendor) return;
    var remembered=newPrefs[vendor] || {};
    populateSelect('nmodel', modelOptionsFor(vendor), remembered.model || '');
    refreshNewEffortOptions(linkedEffortFor(vendor, remembered.model || ''));
    appliedNewVendor=vendor;
  }
  // Repopulate the new-session effort dropdown for the currently-picked model.
  function refreshNewEffortOptions(preferred){
    var vendor=((byId('nvendor')||{}).value||'').trim().toLowerCase();
    var model=selectedNewModel();
    var want = preferred!==undefined ? preferred : selectedNewEffort();
    var safe = safeEffort(vendor, model, want);
    populateSelect('neffort', effortOptionsFor(vendor, model), safe || defaultEffortFor(vendor, model));
  }
  function syncNewEffortToModel(){
    var vendor=((byId('nvendor')||{}).value||'').trim().toLowerCase();
    var model=selectedNewModel();
    refreshNewEffortOptions(linkedEffortFor(vendor, model));
  }
  function rememberNewSessionPrefs(vendor, model, effort){
    if(!vendor) return;
    newPrefs.vendor=vendor;
    newPrefs[vendor]={ model:model||'', effort:effort||'' };
    rememberModelEffort(vendor, model, effort);
  }
  function selectedNewModel(){
    var sel=byId('nmodel');
    return sel && sel.value ? sel.value.trim() : '';
  }
  function selectedNewEffort(){
    var sel=byId('neffort');
    return sel && sel.value ? sel.value.trim().toLowerCase() : '';
  }
  function forkVendorChoices(){
    var seen={}, out=[];
    VENDORS.forEach(function(v){
      var vendor=String(v&&v.vendor||'').trim().toLowerCase();
      if(!vendor || seen[vendor]) return;
      if(v.available && v.chat!==false){ out.push(v); seen[vendor]=true; }
    });
    return out;
  }
  function populateRunVendorSelect(current){
    var sel=byId('rvendor'); if(!sel) return;
    var choices=forkVendorChoices();
    sel.innerHTML='';
    choices.forEach(function(info){
      var opt=document.createElement('option');
      opt.value=info.vendor;
      opt.textContent=info.vendor;
      sel.appendChild(opt);
    });
    sel.value=current || (choices[0]&&choices[0].vendor) || '';
    syncCustomSelect(sel);
  }
  function safeEffort(vendor, model, effort){
    var want=String(effort||'').trim().toLowerCase();
    if(!want) return '';
    var opts=effortOptionsFor(vendor, model);
    return opts.some(function(opt){ return opt.value===want; }) ? want : '';
  }
  function currentForkDefaults(){
    var vendor=(cur&&(cur.runVendor||cur.vendor))||'claude';
    var model=(cur&&(cur.runModel!==undefined ? cur.runModel : cur.model))||'';
    return {
      vendor:vendor,
      model:model,
      effort:(cur&&(cur.runEffort!==undefined ? cur.runEffort : cur.effort))||linkedEffortFor(vendor, model)
    };
  }
  function runConfigLabel(s){
    if(!s) return 'model · effort';
    var config=currentForkDefaults();
    return (config.model || 'current model')+' · '+config.effort;
  }
  function canConfigureRun(){
    var info=cur&&vendorInfo(cur.vendor);
    return !!(cur && cur.sessionId && info && info.available && info.chat!==false && !cur.pendingFork);
  }
  function refreshRunConfigButton(){
    var btn=byId('runCfgBtn'); if(!btn) return;
    var ok=canConfigureRun();
    btn.disabled=!ok;
    btn.textContent=ok ? runConfigLabel(cur) : 'model · effort';
    btn.title=ok ? 'change vendor, model, or effort for send/fork' : 'select a session to configure';
    btn.classList.toggle('dirty', !!(cur && (cur.runConfigDirty || cur.runVendor!==cur.vendor)));
  }
  function populateRunConfigControls(){
    if(!cur) return;
    var config=currentForkDefaults();
    populateRunVendorSelect(config.vendor);
    refreshRunConfigControls(false);
  }
  function refreshRunConfigControls(changedVendor){
    var defaults=currentForkDefaults();
    var vendor=String((byId('rvendor')||{}).value || defaults.vendor || '').trim().toLowerCase();
    var returning=!!(changedVendor && cur && vendor===cur.vendor);
    var keep=!changedVendor && vendor===defaults.vendor;
    var model=returning ? (cur.model||'') : (keep ? defaults.model : '');
    var effort=returning ? (cur.effort||linkedEffortFor(vendor, model)) : (keep ? defaults.effort : linkedEffortFor(vendor, model));
    populateSelect('rmodel', modelOptionsFor(vendor), model);
    refreshRunEffortOptions(effort);
    syncCustomSelect(byId('rvendor'));
    setRunMsg(vendor===cur.vendor ? 'Send continues this session; Fork creates a new branch.' : 'Vendor changed: Send is unavailable. Use Fork to create a '+vendor+' branch.', false);
  }
  // Repopulate the run-config effort dropdown for the currently-picked session model.
  function refreshRunEffortOptions(preferred){
    var vendor=String((byId('rvendor')||{}).value || (cur&&cur.vendor) || 'claude').trim().toLowerCase();
    var model=String((byId('rmodel')||{}).value || '').trim();
    var want = preferred!==undefined ? preferred : String((byId('reffort')||{}).value || '');
    populateSelect('reffort', effortOptionsFor(vendor, model), safeEffort(vendor, model, want) || defaultEffortFor(vendor, model));
  }
  function syncRunEffortToModel(){
    var vendor=String((byId('rvendor')||{}).value || (cur&&cur.vendor) || 'claude').trim().toLowerCase();
    var model=String((byId('rmodel')||{}).value || '').trim();
    refreshRunEffortOptions(linkedEffortFor(vendor, model));
    applyRunConfig();
  }
  function selectedRunConfig(){
    return {
      vendor:String((byId('rvendor')||{}).value || '').trim().toLowerCase(),
      model:String((byId('rmodel')||{}).value || '').trim(),
      effort:String((byId('reffort')||{}).value || '').trim().toLowerCase()
    };
  }
  function setRunMsg(msg, isErr){
    var node=byId('runMsg'); if(!node) return;
    node.textContent=msg||'';
    node.className='forkmsg'+(isErr?' err':'');
  }
  function runPopOpen(){ var pop=byId('runPop'); return !!(pop && !pop.hidden); }
  function closeRunPop(){ var pop=byId('runPop'); if(pop) pop.hidden=true; }
  function openRunPop(){
    if(!canConfigureRun()) return;
    populateRunConfigControls();
    var pop=byId('runPop'); if(pop) pop.hidden=false;
  }
  function applyRunConfig(){
    if(!cur || !canConfigureRun()) return;
    var config=selectedRunConfig();
    cur.runVendor=config.vendor;
    cur.runModel=config.model;
    cur.runEffort=config.effort;
    if(config.vendor===cur.vendor){
      cur.model=config.model;
      cur.effort=config.effort;
      cur.runConfigDirty=true;
    } else cur.runConfigDirty=false;
    rememberModelEffort(config.vendor, config.model, config.effort);
    refreshRunConfigButton();
    updateSendLabel();
    refreshForkButton();
  }
  function dirChoiceKey(value){
    return normalizePathish(value).replace(/\\/+$/,'').toLowerCase();
  }
  function dirChoiceLabel(value){
    var rel=dirDisplayLabel(value);
    if(rel && rel!=='.' && rel!==String(value||'')) return rel;
    return basename(value) || String(value||'');
  }
  function dirChoiceFromPath(dir, source){
    var value=String(dir||'').trim();
    if(!value) return null;
    return {
      value:value,
      label:dirChoiceLabel(value),
      meta:value,
      source:source || 'recent'
    };
  }
  function normalizeDirSuggestion(raw){
    if(typeof raw==='string') return dirChoiceFromPath(raw, 'folder');
    if(!raw || typeof raw!=='object') return null;
    var value=String(raw.path || raw.value || '').trim();
    if(!value) return null;
    var source=String(raw.source || 'folder');
    return {
      value:value,
      label:String(raw.label || dirChoiceLabel(value)),
      meta:String(raw.meta || value),
      source:source
    };
  }
  function addDirChoice(out, seen, choice){
    if(!choice || !choice.value) return;
    var key=dirChoiceKey(choice.value);
    if(!key || seen[key]) return;
    seen[key]=true;
    out.push(choice);
  }
  function dirChoices(q, remoteHits){
    var query=String(q||'').trim().toLowerCase();
    var out=[], seen={};
    DIRS.filter(function(dir){
      if(!query) return true;
      var abs=String(dir||'').toLowerCase();
      var rel=dirDisplayLabel(dir).toLowerCase();
      return abs.indexOf(query)>=0 || rel.indexOf(query)>=0 || basename(dir).toLowerCase().indexOf(query)>=0;
    }).forEach(function(dir){
      addDirChoice(out, seen, dirChoiceFromPath(dir, 'recent'));
    });
    (remoteHits||[]).forEach(function(choice){ addDirChoice(out, seen, choice); });
    return out.slice(0, DIR_SUGGEST_LIMIT);
  }
  function typedDirChoice(q){
    var value=String(q||'').trim();
    if(!value) return null;
    return {
      value:value,
      label:value,
      meta:isAbsolutePathLike(value) ? 'typed absolute path' : 'typed path · resolves against your vault roots',
      source:'typed'
    };
  }
  function dirSourceLabel(source){
    return source==='recent' ? 'recent' : source==='root' ? 'root' : source==='typed' ? 'typed' : 'folder';
  }
  function setupVendorChooser(){
    var input=byId('nvendor'), drop=byId('nvendorSug');
    if(!input || !drop) return;
    var active=-1;
    function items(){ return drop.querySelectorAll('.chooser-opt'); }
    function hide(){ active=-1; drop.hidden=true; }
    function choose(vendor, keepOpenUntilClick){
      input.value=vendor||'';
      applyVendorChooserTheme(input.value);
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
        opt.title=info.chat===false ? info.vendor+' opens a real terminal session' : info.vendor+' starts in-browser chat';
        styleSelectTheme(opt, vendorTheme(info.vendor), false);
        var line=el('div','chooser-opt-line');
        var label=el('div','chooser-opt-label', info.vendor);
        line.appendChild(label);
        if(info.chat===false) line.appendChild(el('span','chooser-opt-note','terminal'));
        opt.appendChild(line);
        opt.onmousedown=function(ev){ ev.preventDefault(); ev.stopPropagation(); };
        opt.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); choose(info.vendor); };
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
    input.addEventListener('input', function(){ active=-1; applyVendorChooserTheme(input.value); render(true, input.value); });
    input.addEventListener('keydown', function(ev){
      if(isImeConfirming(ev)) return;
      var opts=items(), n=opts.length;
      if(ev.key==='ArrowDown'){ ev.preventDefault(); render(true, drop.hidden ? '' : input.value); opts=items(); n=opts.length; if(n){ active=(active+1)%n; Array.prototype.forEach.call(opts, function(node, idx){ node.classList.toggle('on', idx===active); }); } }
      else if(ev.key==='ArrowUp'){ ev.preventDefault(); render(true, drop.hidden ? '' : input.value); opts=items(); n=opts.length; if(n){ active=(active-1+n)%n; Array.prototype.forEach.call(opts, function(node, idx){ node.classList.toggle('on', idx===active); }); } }
      else if(ev.key==='Enter'){ var val=input.value.trim(); var info=vendorInfo(val); if(!val) return; if(n && active>=0 && opts[active]) choose(opts[active].getAttribute('data-value')); else if(info) choose(info.vendor); }
      else if(ev.key==='Escape'){ hide(); }
    });
    input.addEventListener('blur', function(){ var info=vendorInfo(input.value.trim()); if(info) choose(info.vendor); else applyVendorChooserTheme(input.value); });
    drop.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
    drop.addEventListener('click', function(ev){ ev.stopPropagation(); });
    document.addEventListener('pointerdown', function(ev){ if(!byId('nvendorBox') || byId('nvendorBox').contains(ev.target)) return; hide(); });
    document.addEventListener('click', function(ev){ if(!byId('nvendorBox') || byId('nvendorBox').contains(ev.target)) return; hide(); });
    var remembered=vendorInfo(newPrefs.vendor);
    var first=remembered || vendorChoices('')[0];
    if(first) choose(first.vendor);
  }
  function setupDirChooser(){
    var input=byId('ndir'), drop=byId('ndirSug');
    if(!input || !drop) return;
    var active=-1;
    var wantsOpen=false;
    var remoteQuery=null;
    var remoteHits=[];
    var remoteLoading=false;
    var remoteSeq=0;
    var remoteTimer=null;
    function items(){ return drop.querySelectorAll('.chooser-opt'); }
    function hide(){ wantsOpen=false; active=-1; drop.hidden=true; }
    function choose(dir, keepOpenUntilClick){
      input.value=dir||'';
      applyDirChooserTheme(input.value);
      if(keepOpenUntilClick) window.setTimeout(hide, 0);
      else hide();
    }
    function renderDirChoice(choice, cls){
      var opt=el('div','chooser-opt'+(cls ? ' '+cls : ''));
      opt.setAttribute('data-value', choice.value);
      opt.title=choice.value;
      styleSelectTheme(opt, projectTheme(choice.label || choice.value), false);
      var line=el('div','chooser-opt-line');
      line.appendChild(el('div','chooser-opt-label', choice.label || choice.value));
      line.appendChild(el('span','chooser-opt-note', dirSourceLabel(choice.source)));
      opt.appendChild(line);
      opt.appendChild(el('div','chooser-opt-meta', choice.meta || choice.value));
      opt.onmousedown=function(ev){ ev.preventDefault(); ev.stopPropagation(); };
      opt.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); choose(choice.value); };
      drop.appendChild(opt);
    }
    function render(open, query){
      var q=String(query==null ? input.value : query);
      var remote = remoteQuery===q ? remoteHits : [];
      var hits=dirChoices(q, remote);
      drop.innerHTML='';
      hits.forEach(function(choice){ renderDirChoice(choice); });
      if(!hits.length){
        var typed=typedDirChoice(q);
        if(typed) renderDirChoice(typed, 'manual');
        var tip=remoteLoading ? 'Loading local folders...' : (isAbsolutePathLike(input.value) ? 'Type a folder path, or keep typing to browse local subfolders' : 'Type a folder path; relative inputs resolve against your vault roots');
        drop.appendChild(el('div','chooser-empty', tip));
      }
      drop.hidden = !open && !hits.length;
      if(open) drop.hidden=false;
      if(active>=items().length) active=items().length-1;
      Array.prototype.forEach.call(items(), function(node, idx){ node.classList.toggle('on', idx===active); });
    }
    function requestSuggestions(query){
      var q=String(query||'');
      if(remoteTimer) window.clearTimeout(remoteTimer);
      remoteTimer=window.setTimeout(function(){
        var seq=++remoteSeq;
        remoteLoading=true;
        if(wantsOpen) render(true, q);
        fetch('/dirs/suggest?q='+encodeURIComponent(q))
          .then(function(r){ return r.ok ? r.json() : { dirs:[] }; })
          .then(function(res){
            if(seq!==remoteSeq) return;
            remoteQuery=q;
            remoteHits=(res && Array.isArray(res.dirs) ? res.dirs : []).map(normalizeDirSuggestion).filter(Boolean);
            remoteLoading=false;
            if(wantsOpen) render(true, input.value);
          })
          .catch(function(){
            if(seq!==remoteSeq) return;
            remoteQuery=q;
            remoteHits=[];
            remoteLoading=false;
            if(wantsOpen) render(true, input.value);
          });
      }, q.trim() ? 90 : 0);
    }
    input.addEventListener('click', function(ev){ ev.stopPropagation(); });
    input.addEventListener('focus', function(){ wantsOpen=true; render(true, input.value); requestSuggestions(input.value); });
    input.addEventListener('input', function(){ wantsOpen=true; active=-1; applyDirChooserTheme(input.value); render(true, input.value); requestSuggestions(input.value); });
    input.addEventListener('keydown', function(ev){
      if(isImeConfirming(ev)) return;
      var opts=items(), n=opts.length;
      if(ev.key==='ArrowDown'){ ev.preventDefault(); wantsOpen=true; render(true, input.value); requestSuggestions(input.value); opts=items(); n=opts.length; if(n){ active=(active+1)%n; Array.prototype.forEach.call(opts, function(node, idx){ node.classList.toggle('on', idx===active); }); } }
      else if(ev.key==='ArrowUp'){ ev.preventDefault(); wantsOpen=true; render(true, input.value); requestSuggestions(input.value); opts=items(); n=opts.length; if(n){ active=(active-1+n)%n; Array.prototype.forEach.call(opts, function(node, idx){ node.classList.toggle('on', idx===active); }); } }
      else if(ev.key==='Enter' && n && active>=0 && opts[active]){ ev.preventDefault(); choose(opts[active].getAttribute('data-value')); }
      else if(ev.key==='Escape'){ hide(); }
    });
    drop.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
    drop.addEventListener('click', function(ev){ ev.stopPropagation(); });
    document.addEventListener('pointerdown', function(ev){ if(!byId('ndirBox') || byId('ndirBox').contains(ev.target)) return; hide(); });
    document.addEventListener('click', function(ev){ if(!byId('ndirBox') || byId('ndirBox').contains(ev.target)) return; hide(); });
    if(DIRS[0]) choose(DIRS[0]);
  }
  var tabTipAnchor=null;
  function tooltipRoot(){ return byId('tabtip'); }
  function tabTipVisible(){
    var tip=tooltipRoot();
    return !!(tip && tip.classList.contains('show'));
  }
  function hideTabTip(){
    tabTipAnchor=null;
    var tip=tooltipRoot(); if(!tip) return;
    tip.classList.remove('show');
    tip.setAttribute('aria-hidden','true');
  }
  function maybeDismissTabTip(ev){
    if(!tabTipVisible()) return;
    var target=ev && ev.target;
    if(tabTipAnchor && target && tabTipAnchor.contains(target)) return;
    hideTabTip();
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
  // The hover card mirrors the tab's layout (title · first/latest · signal row ·
  // tags + vendor/project/prompts), but with FULL untruncated text and the "Why"
  // reason the tab hides — since the card is non-interactive, you can't open the
  // session to read it, so it's surfaced here.
  function showTabTip(s, ev, anchor){
    var tip=tooltipRoot(); if(!tip || !s) return;
    tabTipAnchor = anchor || (ev && ev.currentTarget) || null;
    tip.innerHTML='';
    var card=el('div','tabtip-card');
    card.appendChild(el('div','tabtip-title', briefText(s)));
    var lines=el('div','tabtip-lines');
    if(s.title) lines.appendChild(el('div','tabtip-firstline', 'First · '+s.title));
    if(s.lastPrompt && s.lastPrompt!==s.title) lines.appendChild(el('div','tabtip-firstline', 'Latest · '+s.lastPrompt));
    if(lines.childNodes.length) card.appendChild(lines);
    var sig=el('div','tabtip-signal');
    if(s.score!=null) sig.appendChild(priBadge(s,'b-pri'));
    if(s.etaMin!=null) sig.appendChild(etaBadge(s,'b-eta'));
    var sb=stateBadge(s); if(sb) sig.appendChild(sb);
    if(sig.childNodes.length) card.appendChild(sig);
    var foot=el('div','tabtip-footrow');
    if(s.tags && s.tags.length){
      var tagrow=el('div','it-tags');
      s.tags.forEach(function(tag){ var chip=el('span','it-tag'); chip.appendChild(el('span',null,tag)); tagrow.appendChild(chip); });
      foot.appendChild(tagrow);
    }
    foot.appendChild(sessionContextRow(s));
    card.appendChild(foot);
    if(s.reason && s.reason!=='no signal'){
      var reason=el('div','tabtip-why');
      reason.appendChild(el('div','tabtip-sectionlabel','Why'));
      reason.appendChild(el('div','tabtip-whytext',s.reason));
      card.appendChild(reason);
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
    var btn=byId('nbtn'), vend=byId('nvendor'), model=byId('nmodel'), effort=byId('neffort'), dir=byId('ndir'), np=byId('np'), attach=byId('nattach');
    if(btn){ btn.disabled=on; btn.textContent=on?'starting…':'start session ▸'; }
    if(vend) vend.disabled=on;
    if(model) model.disabled=on;
    if(effort) effort.disabled=on;
    if(dir) dir.disabled=on;
    if(np) np.disabled=on;
    if(attach) attach.disabled=on;
    if(msg!=null) byId('nmsg').textContent=msg;
  }
  function newBoxOpen(){ var box=byId('newbox'); return !!(box && box.classList.contains('open')); }
  function closeNewBox(){
    var box=byId('newbox'); if(box) box.classList.remove('open');
    var btn=byId('newToggle'); if(btn) btn.setAttribute('aria-expanded','false');
  }
  function openNewBox(){
    refreshCodexModels();
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
  function orderedTagsEqual(a,b){
    a=Array.isArray(a) ? a : [];
    b=Array.isArray(b) ? b : [];
    if(a.length!==b.length) return false;
    for(var i=0;i<a.length;i++){ if(a[i]!==b[i]) return false; }
    return true;
  }
  function clearGlobalTagDropMarks(){
    Array.prototype.forEach.call(document.querySelectorAll('.gtag.drop-before,.gtag.drop-after'), function(node){
      node.classList.remove('drop-before','drop-after');
    });
  }
  function clearGlobalTagDragState(){
    Array.prototype.forEach.call(document.querySelectorAll('.gtag.dragging'), function(node){
      node.classList.remove('dragging');
    });
    clearGlobalTagDropMarks();
  }
  function tagDropAfter(chip, ev){
    var rect=chip.getBoundingClientRect();
    return ev.clientX >= rect.left + rect.width / 2;
  }
  function globalTagDragSource(ev){
    var source=draggedGlobalTag;
    if(!source && ev && ev.dataTransfer){
      try{ source=ev.dataTransfer.getData('text/plain'); }catch(e){}
    }
    return normalizeTag(source||'');
  }
  function saveGlobalTagOrder(next){
    if(orderedTagsEqual(TAGS, next)) return;
    var prevTags=TAGS.slice();
    setGlobalTags(next);
    fetch('/tags/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tags:next})})
      .then(function(r){return r.json();}).then(function(res){
        if(!res.ok) throw new Error('tag order failed');
        setGlobalTags(res.tags || next);
      })
      .catch(function(){ setGlobalTags(prevTags); });
  }
  function reorderGlobalTag(source, target, after){
    source=normalizeTag(source);
    target=normalizeTag(target);
    if(!source || !target || source===target) return;
    var next=[], moved=null;
    TAGS.forEach(function(tag){
      if(moved==null && normalizeTag(tag)===source) moved=tag;
      else next.push(tag);
    });
    if(moved==null) return;
    var idx=-1;
    for(var i=0;i<next.length;i++){
      if(normalizeTag(next[i])===target){ idx=i; break; }
    }
    if(idx<0) return;
    next.splice(idx+(after?1:0), 0, moved);
    saveGlobalTagOrder(next);
  }
  function bindGlobalTagDrag(chip, def){
    if(!def || def.kind!=='user') return;
    chip.draggable=true;
    chip.setAttribute('data-tag-value', def.value);
    chip.addEventListener('dragstart', function(ev){
      draggedGlobalTag=def.value;
      suppressTagClickUntil=Date.now()+350;
      chip.classList.add('dragging');
      if(ev.dataTransfer){
        ev.dataTransfer.effectAllowed='move';
        ev.dataTransfer.setData('text/plain', def.value);
      }
    });
    chip.addEventListener('dragend', function(){
      suppressTagClickUntil=Date.now()+350;
      window.setTimeout(function(){
        draggedGlobalTag=null;
        clearGlobalTagDragState();
      }, 0);
    });
    chip.addEventListener('dragover', function(ev){
      if(!draggedGlobalTag || draggedGlobalTag===def.value) return;
      ev.preventDefault();
      if(ev.dataTransfer) ev.dataTransfer.dropEffect='move';
      clearGlobalTagDropMarks();
      chip.classList.add(tagDropAfter(chip, ev) ? 'drop-after' : 'drop-before');
    });
    chip.addEventListener('dragleave', function(){
      chip.classList.remove('drop-before','drop-after');
    });
    chip.addEventListener('drop', function(ev){
      var source=globalTagDragSource(ev);
      if(!source || source===normalizeTag(def.value)) return;
      ev.preventDefault();
      ev.stopPropagation();
      var after=tagDropAfter(chip, ev);
      draggedGlobalTag=null;
      suppressTagClickUntil=Date.now()+350;
      clearGlobalTagDragState();
      reorderGlobalTag(source, def.value, after);
    });
  }
  function bindGlobalTagDropZone(wrap){
    wrap.ondragover=function(ev){
      if(!globalTagDragSource(ev)) return;
      ev.preventDefault();
      if(ev.dataTransfer) ev.dataTransfer.dropEffect='move';
    };
    wrap.ondrop=function(ev){
      var source=globalTagDragSource(ev);
      if(!source) return;
      ev.preventDefault();
      var chips=Array.prototype.slice.call(wrap.querySelectorAll('.gtag[data-tag-value]'));
      var target=null, after=false;
      for(var i=0;i<chips.length;i++){
        if(normalizeTag(chips[i].getAttribute('data-tag-value')||'')===source) continue;
        var rect=chips[i].getBoundingClientRect();
        if(ev.clientY < rect.bottom && ev.clientX < rect.left + rect.width/2){ target=chips[i]; after=false; break; }
        target=chips[i]; after=true;
      }
      if(!target) return;
      var targetTag=target.getAttribute('data-tag-value')||'';
      draggedGlobalTag=null;
      suppressTagClickUntil=Date.now()+350;
      clearGlobalTagDragState();
      reorderGlobalTag(source, targetTag, after);
    };
  }
  function renderTagFilters(){
    clearTagHeatCache();
    syncTagFilterModeToggle();
    var wrap=byId('tagFilters'); if(!wrap) return; wrap.innerHTML='';
    bindGlobalTagDropZone(wrap);
    renderViewTabs();
    var priorityNarrowed=priorityFilter.length<5;
    var priorityChip=el('span','gtag auto prioritytag'+(priorityNarrowed?' on':''));
    priorityChip.id='priorityTag';
    var priorityBtn=el('button','gtagbtn',priorityFilterLabel(priorityFilter));
    priorityBtn.type='button';
    priorityBtn.title='Filter sessions by priority';
    priorityBtn.setAttribute('aria-haspopup','true');
    priorityBtn.setAttribute('aria-expanded',priorityMenuOpen ? 'true' : 'false');
    priorityBtn.onclick=function(ev){
      ev.preventDefault(); ev.stopPropagation();
      closeSignalMenu();
      priorityMenuOpen=!priorityMenuOpen;
      renderTagFilters();
    };
    priorityChip.appendChild(priorityBtn);
    stylePriorityFilterChip(priorityChip, priorityBtn, priorityFilter, priorityNarrowed);
    if(priorityMenuOpen){
      var priorityMenu=el('div','prioritytagmenu');
      priorityMenu.setAttribute('role','menu');
      [5,4,3,2,1].forEach(function(level){
        var selected=priorityFilter.indexOf(level)>=0;
        var option=el('button','prioritytagopt sigmenu-opt'+(selected?' on':''));
        option.type='button';
        option.setAttribute('role','menuitemcheckbox');
        option.setAttribute('aria-checked',selected ? 'true' : 'false');
        var check=document.createElement('input');
        check.type='checkbox';
        check.tabIndex=-1;
        check.checked=selected;
        check.style.accentColor='var(--priority-'+level+'-fg)';
        option.appendChild(check);
        // Reuse the exact badge rendered by the session priority editor so the
        // P1-P5 colors and dark-theme treatment stay in one visual system.
        option.appendChild(priorityMeter(11-level*2,'',false));
        option.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); togglePriorityFilterLevel(level); };
        priorityMenu.appendChild(option);
      });
      priorityChip.appendChild(priorityMenu);
    }
    wrap.appendChild(priorityChip);
    var defs=filterTagDefs();
    var filterTags=currentFilterTags();
    defs.forEach(function(def){
      var active=filterTags.indexOf(def.key)>=0;
      var chip=el('span','gtag'+(active?' on':'')+(def.kind!=='user'?' auto':''));
      var btn=el('button','gtagbtn',def.label);
      btn.draggable=false;
      btn.title=def.title || 'Toggle filter';
      btn.onclick=function(ev){
        ev.stopPropagation();
        if(Date.now()<suppressTagClickUntil) return;
        toggleFilterTag(def.key);
      };
      chip.appendChild(btn);
      if(def.deletable){
        var del=el('button','gtagdel','×');
        del.draggable=false;
        del.title='Delete this tag from every tab';
        del.onclick=function(ev){
          ev.stopPropagation();
          if(Date.now()<suppressTagClickUntil) return;
          deleteGlobalTag(def.value);
        };
        chip.appendChild(del);
        styleFilterTagChip(chip, btn, del, def, active);
      } else {
        btn.title=def.title || ('Toggle '+def.label);
        styleFilterTagChip(chip, btn, null, def, active);
      }
      bindGlobalTagDrag(chip, def);
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
    var tagOrder={};
    TAGS.forEach(function(tag, idx){ tagOrder[tag]=idx; });
    function orderedKnownTags(list){
      return (Array.isArray(list) ? list : []).filter(function(tag){ return TAGS.indexOf(tag)>=0; })
        .map(function(tag, idx){ return { tag:tag, idx:idx }; })
        .sort(function(a,b){
          var ai=Object.prototype.hasOwnProperty.call(tagOrder, a.tag) ? tagOrder[a.tag] : 999999;
          var bi=Object.prototype.hasOwnProperty.call(tagOrder, b.tag) ? tagOrder[b.tag] : 999999;
          return ai===bi ? a.idx-b.idx : ai-bi;
        })
        .map(function(item){ return item.tag; });
    }
    var available={};
    filterTagDefs().forEach(function(def){ available[def.key]=true; });
    focusViews.forEach(function(view){
      if(Array.isArray(view.tags)) view.tags = view.tags.filter(function(tag){ return !!available[tag]; });
    });
    setScopedFilterTags('active', scopedTagFilters.active.filter(function(tag){ return !!available[tag]; }));
    setScopedFilterTags('unread', scopedTagFilters.unread.filter(function(tag){ return !!available[tag]; }));
    saveFocusViews();
    syncActiveTagsFromFocus();
    SESS.forEach(function(s){ if(Array.isArray(s.tags)) s.tags = orderedKnownTags(s.tags); });
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
  function restoreTagState(tags, sessionTags, focusSnapshot){
    TAGS = Array.isArray(tags) ? tags.slice() : [];
    if(focusSnapshot){
      focusViews = focusSnapshot.views.map(function(view){ return { id:view.id, name:view.name, tags:view.tags.slice() }; });
      activeFocusId = focusSnapshot.activeId;
      activeTags = focusSnapshot.activeTags.slice();
      activeTagView = focusSnapshot.activeView;
      if(focusSnapshot.scopedTags){
        setScopedFilterTags('active', focusSnapshot.scopedTags.active || []);
        setScopedFilterTags('unread', focusSnapshot.scopedTags.unread || []);
      }
      saveFocusViews();
    }
    SESS.forEach(function(s){
      if(s && s.sessionId && sessionTags && Object.prototype.hasOwnProperty.call(sessionTags, s.sessionId)){
        s.tags = sessionTags[s.sessionId].slice();
      }
    });
    if(cur && cur.sessionId && sessionTags && Object.prototype.hasOwnProperty.call(sessionTags, cur.sessionId)){
      cur.tags = sessionTags[cur.sessionId].slice();
      syncOpenHeader();
    }
    renderTagFilters();
    renderSidebar();
  }
  function deleteGlobalTag(tag){
    tag=normalizeTag(tag);
    if(!tag) return;
    var prevTags=TAGS.slice();
    var prevSessionTags={};
    SESS.forEach(function(s){ if(s && s.sessionId) prevSessionTags[s.sessionId]=(s.tags||[]).slice(); });
    var prevFocus={ views:focusViews.map(function(view){ return { id:view.id, name:view.name, tags:(view.tags||[]).slice() }; }), activeId:activeFocusId, activeTags:activeTags.slice(), activeView:activeTagView, scopedTags:{ active:scopedTagFilters.active.slice(), unread:scopedTagFilters.unread.slice() } };
    setGlobalTags(TAGS.filter(function(x){ return normalizeTag(x)!==tag; }));
    fetch('/tags?name='+encodeURIComponent(tag),{method:'DELETE'})
      .then(function(r){return r.json();}).then(function(res){ if(!res.ok) throw new Error('tag delete failed'); setGlobalTags(res.tags||TAGS); })
      .catch(function(){ restoreTagState(prevTags, prevSessionTags, prevFocus); });
  }
  function toggleFilterTag(tag){
    if(activeTagView==='all'){
      activateFocusWithTags([tag]);
    } else if(activeTagView==='active' || activeTagView==='unread'){
      var scoped=(scopedTagFilters[activeTagView] || []).slice();
      var si=scoped.indexOf(tag);
      if(si>=0) scoped.splice(si,1);
      else scoped.push(tag);
      setScopedFilterTags(activeTagView, scoped);
    } else {
      var i=activeTags.indexOf(tag);
      if(i>=0) activeTags.splice(i,1);
      else activeTags.push(tag);
      activeTags=uniqueTagKeys(activeTags);
      persistActiveFocusTags();
    }
    renderTagFilters();
    reconcileCurrentSessionToFilter();
  }
  function clearFilterTags(){
    if(activeTagView==='active' || activeTagView==='unread'){
      if(!currentFilterTags().length) return;
      setScopedFilterTags(activeTagView, []);
    } else if(activeTagView==='focus'){
      if(!activeTags.length) return;
      activeTags = [];
      persistActiveFocusTags();
    } else return;
    renderTagFilters();
    reconcileCurrentSessionToFilter();
  }
  function saveSessionTags(s, tags){
    var id=providerSessionId(s);
    if(!s || !id) return;
    return fetch('/session/tags?session='+encodeURIComponent(id),
      {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tags:tags})})
      .then(function(r){return r.json();}).then(function(res){
        if(!res.ok) return;
        s.tags = res.sessionTags || [];
        setGlobalTags(res.tags || TAGS);
        if(cur && cur.sessionId===s.sessionId){ cur.tags = s.tags.slice(); syncOpenHeader(); }
        return res;
      }).catch(function(){});
  }
  function applySessionTagsLocal(s, tags){
    if(!s) return;
    s.tags = Array.isArray(tags) ? tags.slice() : [];
    if(cur && cur.sessionId===s.sessionId){ cur.tags = s.tags.slice(); syncOpenHeader(); }
    renderTagFilters();
    reconcileCurrentSessionToFilter();
  }
  function removeSessionTag(s, tag){
    if(!s || !s.sessionId) return;
    var prev=(s.tags||[]).slice();
    var next=prev.filter(function(x){ return x!==tag; });
    if(next.length===prev.length) return;
    applySessionTagsLocal(s, next);
    saveSessionTags(s, next).then(function(res){ if(!res) applySessionTagsLocal(s, prev); });
  }
  function addSessionTag(s, raw){
    if(!s || !s.sessionId) return;
    var tag=normalizeTag(raw);
    if(!tag) return;
    var next=(s.tags||[]).slice();
    if(next.indexOf(tag)<0) next.push(tag);
    var prev=(s.tags||[]).slice();
    var prevTags=TAGS.slice();
    editingTagSession = null;
    headerTagEditing = false;
    if(TAGS.indexOf(tag)<0) TAGS.push(tag);
    applySessionTagsLocal(s, next);
    saveSessionTags(s, next).then(function(res){ if(!res){ TAGS=prevTags; applySessionTagsLocal(s, prev); } });
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
    var submitted=false;
    function optEls(){ return sug.querySelectorAll('.tagsug-opt'); }
    function highlight(){ optEls().forEach(function(e,i){ e.classList.toggle('on', i===active); }); }
    function submitChoice(raw){
      if(submitted) return;
      submitted=true;
      addSessionTag(s, raw);
    }
    function bindChoice(opt, value){
      opt.setAttribute('data-val', value);
      function choose(ev){ ev.preventDefault(); ev.stopPropagation(); submitChoice(value); }
      opt.onpointerdown=choose;
      opt.onmousedown=choose;
      opt.onclick=choose;
    }
    function renderSug(){
      var q=normalizeTag(input.value).toLowerCase();
      var hits=TAGS.filter(function(t){
        var k=normalizeTag(t).toLowerCase();
        return !assigned[k] && (!q || k.indexOf(q)>=0);
      });
      sug.innerHTML='';
      hits.forEach(function(t){
        var opt=el('div','tagsug-opt',t);
        bindChoice(opt, t);
        sug.appendChild(opt);
      });
      var typed=normalizeTag(input.value);
      var exists=typed && TAGS.some(function(t){ return normalizeTag(t).toLowerCase()===typed.toLowerCase(); });
      if(typed && !exists && !assigned[typed.toLowerCase()]){
        var create=el('div','tagsug-opt tagsug-create');
        create.setAttribute('data-val', typed);
        create.appendChild(el('span','tagsug-new','new'));
        create.appendChild(el('span',null,typed));
        bindChoice(create, typed);
        sug.appendChild(create);
      }
      var n=optEls().length;
      sug.hidden = n===0;
      if(active>=n) active=n-1;
      highlight();
    }
    function commit(){
      var els=optEls();
      if(active>=0 && els[active]){ submitChoice(els[active].getAttribute('data-val')); return; }
      var typed=normalizeTag(input.value);
      if(typed) submitChoice(typed);
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
  function clearDraftForSession(s){
    var key=draftKey(s);
    if(!key) return;
    delete sessionDrafts[key];
    delete sessionAttachments[key];
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
    if(editingQueueIdx>=0) sessionQueueEditing[key]=editingQueueIdx;
    else delete sessionQueueEditing[key];
  }
  function restoreQueueState(s){
    var key=draftKey(s);
    pendingQueue = [];
    queueParked = false;
    editingQueueIdx = -1;
    renderQueue();
    if(key) refreshServerQueue(s);
  }
  function syncQueueState(){
    if(!cur) return;
    stashQueueState(cur);
  }
  function applyServerQueue(s, res){
    if(!s || !res || !res.ok || !cur || cur.sessionId!==s.sessionId) return;
    pendingQueue = Array.isArray(res.items) ? res.items.map(cloneTurn) : [];
    queueParked = res.parked===true;
    if(editingQueueIdx>=pendingQueue.length) editingQueueIdx=-1;
    renderQueue();
  }
  function refreshServerQueue(s){
    var id=providerSessionId(s);
    if(!s || !id) return Promise.resolve();
    return fetch('/chat/queue?session='+encodeURIComponent(id))
      .then(function(r){ return r.json(); })
      .then(function(res){ applyServerQueue(s, res); })
      .catch(function(){});
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
      editingQueueIdx=-1;
      updateQueued(i, next, sendNow);
    }
    go.onclick=function(ev){ ev.stopPropagation(); commit(true); };
    cancel.onclick=function(ev){ ev.stopPropagation(); closeEditor(); };
    del.onclick=function(ev){ ev.stopPropagation(); delQueued(i); };
    box.onclick=function(ev){ ev.stopPropagation(); };
    ta.oninput=syncInlineEditShape;
    ta.onkeydown=function(ev){ ev.stopPropagation();
      if(isImeConfirming(ev)) return;
      if(ev.key==='Enter' && !ev.shiftKey){ ev.preventDefault(); commit(true); }
      else if(ev.key==='Escape'){ ev.preventDefault(); closeEditor(); }
    };
    setTimeout(function(){ try{ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }catch(e){} }, 0);
    return box;
  }
  // The send button doubles as Stop while a turn is in flight.
  function composerVendorChanged(){ return !!(cur && cur.runVendor && cur.runVendor!==cur.vendor); }
  function updateSendLabel(){ var b=byId('send'); if(!b) return;
    b.textContent = turnActive ? '■ stop' : 'send';
    b.disabled = !turnActive && composerVendorChanged();
    b.title = turnActive ? 'Stop the current generation (Esc)' : (composerVendorChanged() ? 'Vendor changed — use Fork to create a branch' : '');
    b.classList.toggle('stopping', turnActive); }
  function beginTurn(startedAt){
    endCatchup();
    stopRequested=false;
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
  function markCurGenerating(on){
    if(!cur) return;
    cur.generating=on;
    cur.generatingStartedAt=on ? (genStart || Date.now()) : null;
    if(on && viewVisit && viewVisit.sessionId===cur.sessionId) viewVisit.wasGenerating=true;
    applyGenerating(cur);
  }
  // Queue advancement is server-owned. A terminal event only updates this tab;
  // the server starts the next queued turn even when this session is in the background.
  function turnEnded(){
    stopRequested=false;
    endTurn();
    renderQueue();
    if(cur){ refreshServerQueue(cur); refreshAnalysis(cur); }
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
    scheduleOverlayOffsets();
  }
  // Edit a queued draft in place (NOT back in the bottom composer, which may hold
  // an unrelated draft): the row becomes an inline textarea; saving updates the
  // queued item (empty → removes it), cancel leaves it untouched.
  function editQueued(i){ if(pendingQueue[i]==null) return; editingQueueIdx=i; syncQueueState(); renderQueue(); }
  function sendQueued(i){
    if(turnActive || pendingQueue[i]==null) return;
    var item=pendingQueue[i];
    if(!cur || !cur.sessionId || !item.id) return;
    var target=cur;
    var id=providerSessionId(target); if(!id) return;
    fetch('/chat/queue/send?session='+encodeURIComponent(id)+'&item='+encodeURIComponent(item.id),{method:'POST'})
      .then(function(r){ return r.json(); })
      .then(function(res){ applyServerQueue(target, Object.assign({ok:true},res)); })
      .catch(function(){});
  }
  function delQueued(i){
    var item=pendingQueue[i];
    if(!cur || !cur.sessionId || !item || !item.id) return;
    var target=cur;
    var id=providerSessionId(target); if(!id) return;
    fetch('/chat/queue?session='+encodeURIComponent(id)+'&item='+encodeURIComponent(item.id),{method:'DELETE'})
      .then(function(r){ return r.json(); })
      .then(function(res){ applyServerQueue(target, res); })
      .catch(function(){});
  }
  function updateQueued(i, text, sendNow){
    var item=pendingQueue[i];
    if(!cur || !cur.sessionId || !item || !item.id) return;
    var target=cur;
    var id=providerSessionId(target); if(!id) return;
    fetch('/chat/queue?session='+encodeURIComponent(id)+'&item='+encodeURIComponent(item.id),{
      method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify({text:text})
    }).then(function(r){ return r.json(); }).then(function(res){
      applyServerQueue(target, res);
      if(sendNow && res.ok && cur===target){
        var next=(res.items||[]).findIndex(function(candidate){ return candidate.id===item.id; });
        if(next>=0) sendQueued(next);
      }
    }).catch(function(){});
  }
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
    else if(field==='state'){ s.state=value; s.stateset=true; body.state=value; }
    else if(field==='pattern'){
      if(value===null){ s.pattern='unknown'; s.patternset=false; body.pattern=null; }
      else { s.pattern=value; s.patternset=true; body.pattern=value; }
    }
    else { value=Math.max(1,Math.round(value)); s.etaMin=value; s.etaset=true; body.etaMin=value; }
    var id=providerSessionId(s); if(!id) return;
    fetch('/session/override?session='+encodeURIComponent(id),
      {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).catch(function(){});
  }
  // Build a clickable priority/ETA badge (used in both the sidebar and the header).
  function priBadge(s, cls){
    var sp=priorityMeter(s.score, cls, !!s.priorityset);
    sp.title='Click to set priority'+(s.priorityset?' · manually pinned':'');
    if(s.sessionId) sp.onclick=function(ev){ ev.stopPropagation(); showSignalMenu(sp, s, 'priority', PRIORITY_LEVELS.map(function(v){ return {value:v,node:priorityMeter(v,'',false),on:priorityLevel(v)===priorityLevel(s.score)}; })); };
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
    if(removable && onRemove){
      var rm=el('button',null,'×');
      rm.title='Remove tag';
      rm.onclick=function(ev){ ev.stopPropagation(); onRemove(); };
      chip.appendChild(rm);
    }
    styleSessionTagChip(chip, def);
    return chip;
  }
  function renderHeaderTags(s){
    var wrap=byId('h-tags'); if(!wrap) return;
    wrap.innerHTML='';
    if(!s) return;
    var row=el('div','headtag-row');
    (s.tags||[]).forEach(function(tag){
      var def=userTagDef(tag);
      if(!def) return;
      row.appendChild(tagChip(def, !!(s.sessionId && !s.pendingFork), function(){ removeSessionTag(s, def.value); }));
    });
    if(s.sessionId && !s.pendingFork){
      var add=el('button','headtag-add','+ tag');
      add.type='button';
      add.onclick=function(ev){ ev.stopPropagation(); headerTagEditing = !headerTagEditing; editingTagSession=null; renderHeaderTags(s); renderSidebar(); };
      row.appendChild(add);
    }
    row.appendChild(sessionContextRow(s));
    if(row.childNodes.length) wrap.appendChild(row);
    if(headerTagEditing && s.sessionId && !s.pendingFork){
      var editor=buildTagEditor(s);
      editor.classList.add('headtagedit');
      wrap.appendChild(editor);
      var input=editor.querySelector('input');
      if(input) setTimeout(function(){ try{ input.focus(); }catch(e){} }, 0);
    }
  }
  // The open header mirrors the sidebar tab signals; vendor/project/prompts live
  // with the tag row so their visual treatment matches the tab footer.
  function headerSig(s){
    var sig=byId('h-sig'); if(!sig) return; sig.innerHTML='';
    if(s.score!=null) sig.appendChild(priBadge(s,'score'));
    if(s.etaMin!=null) sig.appendChild(etaBadge(s,'eta'));
    var sb=stateBadge(s); if(sb) sig.appendChild(sb);
    var age=ageLabel(s);                                  // 时间
    if(age) sig.appendChild(el('span','h-meta', age));
    if(s.reason && s.reason!=='no signal') sig.appendChild(el('span','reason', s.reason));
  }
  // Patch a session's daemon verdict into its tab (and the header if open).
  function applyAnalysis(s, a){
    if(!a) return;
    // A manually-pinned priority/ETA wins — don't let the daemon's verdict overwrite it.
    s.brief=a.brief; s.reason=a.reason;
    if(!s.stateset) s.state=a.state || null;
    if(!s.priorityset) s.score=a.priority;
    if(!s.etaset) s.etaMin=a.etaMin;
    var t=s.sessionId&&titleEls[s.sessionId];
    if(t){ t.textContent=briefText(s); t.classList.remove('pending'); }
    if(cur&&cur.sessionId===s.sessionId){ byId('h-title').textContent=briefText(s); headerSig(s); }
  }
  // The daemon analyzes on turn-end (server-side); poll a few times for its verdict.
  function analysisChanged(s, a){
    if(!a) return false;
    return a.brief!==s.brief ||
      (!s.stateset && (a.state||null)!==(s.state||null)) ||
      a.reason!==s.reason ||
      (!s.priorityset && Number(a.priority)!==Number(s.score)) ||
      (!s.etaset && Number(a.etaMin)!==Number(s.etaMin));
  }
  function refreshAnalysis(s){
    var id=providerSessionId(s);
    if(!s||!id) return; // both Claude and Codex sessions get a daemon verdict
    var tries=0;
    var poll=function(){
      tries++;
      fetch('/session/analysis?session='+encodeURIComponent(id)).then(function(r){return r.json();})
        .then(function(res){ var a=res&&res.analysis;
          if(analysisChanged(s,a)){ applyAnalysis(s,a); return; }
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
  function titleDirLabel(s){
    var dir=String((s&&s.cwd)||'').replace(/\\\\/g,'/').replace(/\\/+$/,'');
    if(dir){
      var i=dir.lastIndexOf('/');
      return dir.slice(i+1) || dir;
    }
    return String((s&&s.project)||'').trim();
  }
  function syncPageTitle(s){
    var label=titleDirLabel(s);
    document.title = label ? 'Attend — '+label : PAGE_TITLE;
  }
  function resetOpenHeader(){
    document.body.classList.add('no-session');
    syncPageTitle(null);
    byId('h-title').textContent = 'Attend';
    var sub=byId('h-sub');
    if(sub){ sub.className='s'; sub.textContent='Select a session, or + new'; }
    var sig=byId('h-sig'); if(sig) sig.innerHTML='';
    var tags=byId('h-tags'); if(tags) tags.innerHTML='';
    var tray=byId('pinTray'); if(tray){ tray.innerHTML=''; tray.classList.remove('show'); tray.setAttribute('aria-hidden','true'); }
    syncHeaderStatus(null);
    refreshBusy = false;
    cur = null;
    pendingQueue = [];
    editingQueueIdx = -1;
    hideLatestPin();
    var ap=byId('avoidPanel'); if(ap){ ap.innerHTML=''; ap.hidden=true; }
    renderQueue();
    clearAttachments();
    setComposerDrop(false);
    syncRefreshButton();
  }

  function noteUserTurn(s, text){
    if(!s || !text) return;
    var now=Date.now();
    s.lastPrompt = String(text);
    s.prompts = Math.max(0, Number(s.prompts||0)) + 1;
    s.lastTs = now;
    if(!Array.isArray(s.userPromptTs)) s.userPromptTs = [];
    s.userPromptTs.push(now);
    syncActivitySortTs(s, s.lastTs);
    s.ageDays = 0;
    if(cur===s) syncOpenHeader();
  }
  function hydrateSessionSource(s, opts){
    opts = opts || {};
    var force = !!opts.force;
    var id=providerSessionId(s);
    if(!s || !id || s.pendingFork || s._resolvingSource) return Promise.resolve(s);
    if(s.file && !force) return Promise.resolve(s);
    s._resolvingSource = true;
    return fetch('/session/source?session='+encodeURIComponent(id)+'&vendor='+encodeURIComponent(s.vendor||''))
      .then(function(r){ return r.json(); })
      .then(function(res){
        var found=res&&res.session;
        if(found){
          if(found.file) s.file = found.file;
          if(found.cwd) s.cwd = found.cwd;
          if(found.project) s.project = found.project;
          if(found.vendor) s.vendor = found.vendor;
          if(found.title && (!s.title || s.title==='(new session)')) s.title = found.title;
          var pendingLatest=latestPendingUserText(s.sessionId);
          if(found.lastPrompt && !pendingLatest) s.lastPrompt = found.lastPrompt;
          if(found.lastTs!=null && !pendingLatest) {
            syncActivityLastTs(s, found.lastTs);
            syncActivitySortTs(s, found.lastTs);
            sortSessions();
          }
          if(Array.isArray(found.userPromptTs)){
            var seenTs={};
            var merged=[];
            (found.userPromptTs || []).concat(Array.isArray(s.userPromptTs) ? s.userPromptTs : []).forEach(function(ts){
              ts=Number(ts);
              if(!isFinite(ts) || ts<=0 || seenTs[ts]) return;
              seenTs[ts]=true;
              merged.push(ts);
            });
            s.userPromptTs = merged;
          }
          if(found.prompts!=null) s.prompts = pendingLatest ? Math.max(Number(s.prompts||0), found.prompts) : found.prompts;
          if(cur===s) syncPageTitle(s);
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
    if(filterQ){
      SESS.sort(function(a,b){
        var ra=searchMatchRank(a), rb=searchMatchRank(b);
        if(ra!==rb) return rb-ra;
        return (sessionSortTs(b)||0)-(sessionSortTs(a)||0);
      });
    }
    else if(mode==='priority'){ SESS.sort(function(a,b){ return (b.score||0)-(a.score||0); }); }
    // 'recent' = most-recent activity first, by precise timestamp (coarse ageDays
    // can't distinguish same-day sessions, so they'd never reorder on interaction).
    else { SESS.sort(function(a,b){ return (sessionSortTs(b)||0)-(sessionSortTs(a)||0); }); }
  }
  // Bump a session to the top on user-authored activity. Plainly opening a tab is
  // handled by engagement telemetry and must not affect recent sorting.
  function touchSession(s){ if(!s) return; s.sortTs=Date.now(); sortSessions(); renderSidebar(); }
  var titleEls={}; // sessionId -> .it-title node, so a late daemon brief can patch it in place
  var statusEls={}; // sessionId -> .it-status dot, so live generating state can patch in place
  var filterQ=''; // sidebar search query (matches brief / 首 / 新 / project / vendor / reason)
  var contentSearchQ='';
  var contentSearchTimer=null;
  var contentSearchSeq=0;
  var contentSearchResults={};
  function searchKeyFor(s){ return s && s.sessionId ? ('sid:'+s.sessionId) : (s && s.file ? ('file:'+s.file) : ''); }
  function contentSearchHit(s){
    if(!filterQ || contentSearchQ!==filterQ) return null;
    var key=searchKeyFor(s);
    return key ? contentSearchResults[key] : null;
  }
  function setContentSearchResults(q, results){
    var map={};
    (results||[]).forEach(function(r){
      if(!r) return;
      if(r.sessionId) map['sid:'+r.sessionId]=r;
      if(r.file) map['file:'+r.file]=r;
    });
    contentSearchQ=q;
    contentSearchResults=map;
  }
  function scheduleContentSearch(){
    var q=filterQ;
    contentSearchSeq++;
    var seq=contentSearchSeq;
    if(contentSearchTimer) clearTimeout(contentSearchTimer);
    if(!q){
      setContentSearchResults('', []);
      return;
    }
    contentSearchTimer=setTimeout(function(){
      fetch('/search?q='+encodeURIComponent(q))
        .then(function(r){ return r.json(); })
        .then(function(res){
          if(seq!==contentSearchSeq || q!==filterQ) return;
          setContentSearchResults(q, res && res.results);
          sortSessions();
          renderSidebar();
        })
        .catch(function(){});
    }, 300);
  }
  function textHasSearch(value){
    return !!(filterQ && String(value||'').toLowerCase().indexOf(filterQ)>=0);
  }
  function primaryFieldSearchHit(s){
    return !!(s && (textHasSearch(s.brief) || textHasSearch(s.title) || textHasSearch(s.lastPrompt)));
  }
  function sidebarFieldSearchHit(s){
    if(!s) return false;
    if(primaryFieldSearchHit(s)) return true;
    var hay=[s.project,s.vendor,s.reason,s.cwd]
      .concat(allTagDefsForSession(s).map(function(def){ return def.label; }))
      .filter(Boolean).join(' ').toLowerCase();
    return hay.indexOf(filterQ)>=0;
  }
  function searchMatchRank(s){
    if(!filterQ) return 0;
    if(primaryFieldSearchHit(s)) return 3; // brief / First / Latest before transcript content.
    if(sidebarFieldSearchHit(s)) return 2;
    return contentSearchHit(s) ? 1 : 0;
  }
  function matchesFilter(s){
    var isCur=!!(cur && s && cur.sessionId && s.sessionId===cur.sessionId);
    if(activeTagView==='unread' && !isCur && !(s && (s.generating || s.unread))) return false;
    if(activeTagView==='active' && !isCur && !(s && (s.generating || s.unread || s.seen))) return false;
    if(!sessionMatchesPriorityFilter(s)) return false;
    if(!sessionMatchesTagFilter(s, currentFilterTags())) return false;
    if(!filterQ) return true;
    return sidebarFieldSearchHit(s) || !!contentSearchHit(s);
  }
  function reconcileCurrentSessionToFilter(){
    if(cur && matchesFilter(cur)){
      renderSidebar();
      return;
    }
    var next=null;
    SESS.forEach(function(s){
      if(!matchesFilter(s)) return;
      if(!next || (sessionSortTs(s)||0)>(sessionSortTs(next)||0)) next=s;
    });
    if(next){
      select(next);
      return;
    }
    flushVisit(false);
    stashComposerDraft(cur);
    stashAttachmentState(cur);
    stashQueueState(cur);
    resetOpenHeader();
    renderSidebar();
  }
  function briefText(s){ return s.brief || s.title || '(no prompt)'; }
  function stripForkPrefix(text){
    return String(text||'').replace(/^\\s*(?:\\(fork\\)\\s*)+/i, '').trim();
  }
  function forkTitleFromSession(s){
    var base=stripForkPrefix((s && s.brief) || (s && s.title) || (s && s.lastPrompt) || '');
    return base ? '(fork) '+base : '(fork)';
  }
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
  //   generating (blue spinning ring) = a turn is running (not your turn)
  //   unread     (solid green)        = a turn ended in the background     → "new, look at me"
  //   seen       (amber breathing ring)= tracked / in progress             → "still open"
  //   read       (gray)               = manually dismissed / parked
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
    syncBulkArchiveSeenButton();
    if(persist!==false && prev!==next) postSessionStatus(s, next);
  }
  function statusState(s){
    if(s&&s.generating) return 'generating';
    return attentionState(s);
  }
  function statusLabel(st){
    return st==='generating' ? 'generating'
      : st==='unread' ? 'new reply'
      : st==='seen' ? 'in progress'
      : 'read';
  }
  function sidebarStatusTitle(st){
    var base = statusLabel(st);
    if(st==='generating') return base;
    return base + (st==='read' ? ' · click to track' : ' · click to archive');
  }
  function headerStatusTitle(st){
    var base = statusLabel(st);
    if(st==='generating') return base;
    return base + (st==='unread' ? ' · click to mark seen' : ' · click to mark unread');
  }
  function applyGenerating(s){
    var d=s&&s.sessionId&&statusEls[s.sessionId]; if(!d) return;
    var st=statusState(s);
    d.className='it-status '+st;
    d.title=sidebarStatusTitle(st);
    if(cur && s && cur.sessionId===s.sessionId) syncHeaderStatus(s);
  }
  function syncHeaderStatus(s){
    var dot=byId('h-status'); if(!dot) return;
    var st=s ? statusState(s) : 'read';
    dot.className='headstatus '+st;
    dot.title=headerStatusTitle(st);
    dot.onclick = null;
    if(s && s.sessionId && !s.pendingFork){
      dot.onclick=function(ev){ ev.stopPropagation(); toggleHeaderStatus(s); };
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
  // Sidebar dot: list management. Clicking green/unread marks the session done;
  // clicking gray puts it back in progress. Reversible; a later turn-end still
  // re-arms green.
  // No-op mid-turn — the pulse isn't a state you can toggle.
  function toggleStatus(s){
    if(!s || s.generating) return;
    if(s.unread || s.seen) setAttentionState(s, 'read'); // dismiss → read
    else setAttentionState(s, 'seen');                   // flag → seen
  }
  // Header dot: current-chat reading state. It lets you bump an already-open
  // session back to unread after opening demoted it to seen.
  function toggleHeaderStatus(s){
    if(!s || s.generating) return;
    if(s.unread) setAttentionState(s, 'seen');
    else setAttentionState(s, attentionState(s)==='read' ? 'seen' : 'unread');
  }
  function renderSidebar(){
    clearTagHeatCache();
    hideTabTip();
    var list=byId('list'); list.innerHTML=''; titleEls={}; statusEls={};
    var shown=0;
    SESS.forEach(function(s){
      if(!matchesFilter(s)) return;
      shown++;
      var taggable=!!(s.sessionId && !s.pendingFork);
      var item=el('div','item'+(s.pattern==='avoidance'?' avoidance':'')+(cur&&cur.sessionId===s.sessionId?' active':''));
      if(s.pattern==='avoidance') item.title='avoidance';
      // title row: a live-status dot + the daemon's brief (falls back to first prompt)
      var trow=el('div','it-titlerow');
      var st=statusState(s);
      var dot=el('span','it-status '+st);
      dot.title=sidebarStatusTitle(st);
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
      var contentHit=contentSearchHit(s);
      if(contentHit && contentHit.hits && contentHit.hits.length){
        var firstHit=contentHit.hits[0];
        var hitText='Content · '+firstHit.role+' · '+firstHit.text;
        if(contentHit.count>1) hitText += ' +' + (contentHit.count-1);
        item.appendChild(el('div','it-searchhit', hitText));
      }
      // badges: priority + ETA; state/context sit with the tag row below.
      // top signal row: priority · ETA · state (state moved up off the tag row)
      var meta=el('div','it-meta');
      if(s.score!=null) meta.appendChild(priBadge(s,'b-pri'));
      if(s.etaMin!=null) meta.appendChild(etaBadge(s,'b-eta'));
      var msb=stateBadge(s); if(msb) meta.appendChild(msb);
      var ctx=s.prompts+'p';
      if(meta.childNodes.length) item.appendChild(meta);
      // bottom row: tags on the left, vendor · project · prompts on the right
      var foot=el('div','it-footrow');
      var tagrow=el('div','it-tags');
      if((s.tags&&s.tags.length) || taggable){
        (s.tags||[]).forEach(function(tag){
          var def=userTagDef(tag);
          if(!def) return;
          var chip=el('span','it-tag');
          chip.appendChild(el('span',null,def.label));
          if(taggable){
            var rm=el('button',null,'×');
            rm.title='Remove tag';
            rm.onclick=function(ev){ ev.stopPropagation(); removeSessionTag(s, def.value); };
            chip.appendChild(rm);
          }
          styleSessionTagChip(chip, def);
          tagrow.appendChild(chip);
        });
        if(taggable){
          var add=el('button','it-tagadd','+ tag');
          add.onclick=function(ev){ ev.stopPropagation(); hideTabTip(); headerTagEditing=false; editingTagSession = editingTagSession===s.sessionId ? null : s.sessionId; if(cur===s) syncOpenHeader(); renderSidebar(); };
          tagrow.appendChild(add);
        }
      }
      foot.appendChild(tagrow);
      foot.appendChild(sessionContextRow(s));
      item.appendChild(foot);
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
      if(contentHit && contentHit.hits && contentHit.hits.length) tip.push('Content · '+contentHit.hits[0].text);
      var sig=[]; if(s.score!=null) sig.push('priority '+Number(s.score).toFixed(1));
      if(s.etaMin!=null) sig.push('~'+s.etaMin+'m');
      if(s.state && stateLabel(s.state)) sig.push(stateLabel(s.state));
      sig.push(s.vendor); sig.push(s.project); sig.push(ctx); if(age) sig.push(age); tip.push(sig.join(' · '));
      if(s.tags && s.tags.length) tip.push('tags · '+s.tags.join(', '));
      item.removeAttribute('title');
      // While this tab's tag editor is open, suppress its hover tooltip entirely —
      // otherwise the detail card pops up over the suggestion dropdown.
      if(!(taggable && editingTagSession===s.sessionId)){
        item.onmouseenter=function(ev){ showTabTip(s, ev, item); };
        item.onmousemove=function(ev){
          if(tabTipAnchor!==item) showTabTip(s, ev, item);
          else positionTabTip(ev);
        };
      }
      item.onmouseleave=function(){ if(tabTipAnchor===item) hideTabTip(); };
      item.onclick=function(){ select(s); };
      list.appendChild(item);
    });
    if(shown===0){
      var filterTags=currentFilterTags();
      var empty=el('div','empty');
      empty.textContent=(filterQ||activeTagView!=='all'||filterTags.length||priorityFilter.length<5)
        ? ('No matches'+(filterQ?(' for “'+filterQ+'”'):'')+(priorityFilter.length<5?(' · priority: '+priorityFilterLabel(priorityFilter)):'')+(filterTags.length?(' · tags: '+activeTagLabels().join(', ')):'')+(activeTagView==='unread'?' · Unread':'')+(activeTagView==='active'?' · Active':'')+(activeTagView==='focus'?' · Focus':''))
        : 'No sessions yet';
      list.appendChild(empty);
    }
    if(editingTagSession){
      var activeInput=list.querySelector('.tagedit input');
      if(activeInput) setTimeout(function(){ try{ activeInput.focus(); }catch(e){} }, 0);
    }
    syncBulkArchiveSeenButton();
  }
  function setForkEnabled(on, title){
    var b=byId('forkBtn'); if(!b) return; b.disabled=!on; if(title!=null) b.title=title;
  }
  // Can the *currently open* session be forked? The detected vendor must expose
  // in-browser chat and the session must be real (non-pending). Mid-generation is allowed
  // — the fork just snapshots the transcript as it currently stands.
  function canForkCur(){
    var info=cur&&vendorInfo((currentForkDefaults()).vendor);
    return !!(cur && cur.sessionId && info && info.available && info.chat!==false && !cur.pendingFork);
  }
  function refreshForkButton(){
    var ok=canForkCur();
    var config=currentForkDefaults();
    setForkEnabled(ok, ok ? 'fork directly with '+config.vendor+' · '+(config.model||'current model')+' · '+config.effort : 'select a session to split');
  }
  // A small in-place editor (textarea + primary/cancel). Enter commits,
  // Shift+Enter inserts a newline, Esc cancels.
  function makeInlineEditor(text, onCommit, onCancel, primaryLabel){
    var rawText=String(text||'');
    var box=el('div','inline-edit');
    var ta=el('textarea','inline-edit-ta'); ta.value=rawText;
    function syncInlineEditShape(){
      var rows=Math.min(8, Math.max(1, String(ta.value||'').split('\\n').length));
      ta.rows=rows;
      box.classList.toggle('single-line', rows===1);
    }
    syncInlineEditShape();
    var bar=el('div','inline-edit-bar');
    var save=el('button','inline-edit-save',primaryLabel || 'save ▸');
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
  function isLatestUserMessage(msgEl){
    var msgs=byId('msgs');
    if(!msgs || !msgEl) return false;
    var nodes=msgs.querySelectorAll('.msg.user:not(.folded-away)');
    return !!nodes.length && nodes[nodes.length-1]===msgEl;
  }
  function editLatestAndResend(msgEl, bubble){
    if(!cur || !cur.sessionId || cur.pendingFork) return;
    if(turnActive){ showToast('Stop this turn before editing the latest message.', 'warn'); return; }
    if(msgEl.classList.contains('editing')) return;
    var raw=bubble.getAttribute('data-raw') || bubble.textContent || '';
    msgEl.classList.add('editing');
    var editor=makeInlineEditor(raw, function(v){
      msgEl.classList.remove('editing');
      if(!v){ editor.replaceWith(bubble); return; }
      editor.replaceWith(bubble);
      setBubbleText(bubble, v, true);
      while(msgEl.nextSibling) msgEl.parentNode.removeChild(msgEl.nextSibling);
      latestUserMsgEl=msgEl;
      rememberPendingUserMsg(cur.sessionId, v);
      markVisitSend();
      noteUserTurn(cur, v);
      cacheTranscriptUserMsg(cur, v);
      dispatchSend({ text:v, attachments:[] }, v);
    }, function(){
      msgEl.classList.remove('editing');
      editor.replaceWith(bubble);
    }, 'send ▸');
    bubble.replaceWith(editor);
  }
  function editAndForkFromMessage(msgEl, bubble){
    if(!cur || !cur.sessionId || cur.pendingFork) return;
    if(msgEl.classList.contains('editing')) return;
    var prefix=historyBeforeMsg(msgEl);
    if(!prefix){ showToast('Could not find the transcript point for this message.', 'warn'); return; }
    var raw=bubble.getAttribute('data-raw') || bubble.textContent || '';
    msgEl.classList.add('editing');
    var editor=makeInlineEditor(raw, function(v){
      msgEl.classList.remove('editing');
      if(!v){ editor.replaceWith(bubble); return; } // empty → just cancel, don't send
      editor.replaceWith(bubble);
      startForkFromPrefix(prefix, { text:v, attachments:[] });
    }, function(){
      msgEl.classList.remove('editing');
      editor.replaceWith(bubble);
    }, 'fork ▸');
    bubble.replaceWith(editor);
  }
  function editUserMessage(msgEl, bubble){
    if(isLatestUserMessage(msgEl) && !turnActive) editLatestAndResend(msgEl, bubble);
    else editAndForkFromMessage(msgEl, bubble);
  }
  function addMsg(role, text, markdown, attachments){
    clearPh();
    var m=el('div','msg '+role);
    m.setAttribute('data-msg-key', role+':'+(msgOrdinal++));
    var b=el('div','bubble');
    var atts=cloneAttachments(attachments);
    var displayText=atts.length ? attachmentDisplayText(text, atts) : text;
    setBubbleText(b, displayText||'', markdown!==false && (role==='user' || role==='assistant'));
    appendAttachmentCards(b, atts);
    if(role==='user'){
      var eb=el('button','msg-edit');
      setIconButton(eb, 'edit', 'Edit message');
      eb.onclick=function(ev){ ev.stopPropagation(); editUserMessage(m, b); };
      m.appendChild(eb);
      var fb=el('button','msg-fold');
      setIconButton(fb, 'collapse', 'Collapse this turn');
      fb.onclick=function(ev){ ev.stopPropagation(); toggleTurnFold(m); };
      m.appendChild(fb);
    }
    if(role==='user' || role==='assistant'){
      var pb=el('button','msg-pin');
      setIconButton(pb, 'pin', 'Pin this message to the top');
      pb.onclick=function(ev){ ev.stopPropagation(); togglePinnedMessage(m); };
      m.appendChild(pb);
      syncMessagePinState(m);
    }
    m.appendChild(b);
    var target=renderTarget || byId('msgs');
    target.appendChild(m);
    if(!renderTarget) applyCollapsedTurns();
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
    var providerId=providerSessionId(cur); if(!providerId) return;
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
    var answerText=questionAnswerSummary(qs, picked.answers);
    var codexAnswer=(cur.vendor==='codex');
    if(codexAnswer){
      rememberPendingUserMsg(cur.sessionId, answerText);
      markVisitSend();
      noteUserTurn(cur, answerText);
      cacheTranscriptUserMsg(cur, answerText);
      addMsg('user', answerText);
      assistantEl=null;
    }
    beginTurn();
    touchSession(cur);
    fetch('/chat/answer?session='+encodeURIComponent(providerId)+'&cwd='+encodeURIComponent(cur.cwd||'')+'&vendor='+encodeURIComponent(cur.vendor||'claude'),{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        toolUseId:toolId,
        text:answerText,
        toolUseResult:toolUseResult
      })
    }).then(function(r){ return r.json(); }).then(function(res){
      if(res.ok){ if(res.view) patchSessionView(res.view); }
      else {
        if(codexAnswer) forgetPendingUserMsg(cur.sessionId, answerText);
        if(err) err.textContent=res.error||'answer failed';
        setQuestionBusy(root, false, 'submit answer');
        endTurn();
      }
    }).catch(function(e){
      if(codexAnswer) forgetPendingUserMsg(cur.sessionId, answerText);
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
    if(isQuestionTool(name, input)) return renderQuestions(input.questions, meta);
    if((name==='ExitPlanMode'||name==='exit_plan_mode') && input.plan!=null) return renderPlan(input.plan);
    return null;
  }
  function isQuestionTool(name, input){
    if(!input || typeof input!=='object' || !Array.isArray(input.questions)) return false;
    var base=String(name||'').split('.').pop();
    return name==='AskUserQuestion' || base==='request_user_input';
  }
  function lockQuestionTool(d){
    if(!d) return;
    var body=d.querySelector('.rq');
    if(body) setQuestionBusy(body, true, 'answered');
  }
  function hasQuestionAnswerResult(result, isError){
    return !isError && typeof result==='string' && !!result.trim();
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
    if(isQuestionTool(tc.name, tc.input) && hasQuestionAnswerResult(tc.result, tc.isError)) lockQuestionTool(d);
    var target=renderTarget || byId('msgs');
    target.appendChild(d);
    if(tc.id) toolEls[tc.id]=d;
    if(!renderTarget) applyCollapsedTurns();
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
    cur=s; editingTagSession=null; headerTagEditing=false;
    clearGen(); turnActive=false; msgOrdinal=0; setInputEnabled(true); updateSendLabel();
    markSeen(s); renderSidebar();
    document.body.classList.remove('no-session');
    document.body.classList.add('show-chat'); // mobile: slide to the chat page (no-op on desktop)
    syncPageTitle(s);
    // top mirrors the tab: brief as title, my first + latest message as subtitles
    // — each on its own line (like the sidebar tab).
    syncOpenHeader();
    // in-browser fork works for Claude + Codex; gated to a settled turn (see
    // refreshForkButton — forking mid-generation corrupts both parent and branch).
    refreshForkButton();
    closeRunPop(); refreshRunConfigButton();
    stick=true; assistantEl=null; toolEls={}; endCatchup(); restoreQueueState(s);
    hideLatestPin(); latestUserMsgEl=null;
    renderPinTray();
    restoreComposerDraft(s);
    restoreAttachmentState(s);
    renderAvoidancePanel();
    var cached=cachedTranscriptFor(s);
    if(cached) renderPersistedAndPending(cached, s.sessionId);
    else {
      var loading=el('div','placeholder','Loading…'); loading.id='ph'; replaceMessages(loading);
    }
    renderQueue();
    if(s.pendingFork){
      // A fork opened WITH an opening turn belongs to materializeFork(), which
      // runs synchronously right after this select() and renders the opener +
      // turn. The empty-fork "type your next message" hint below is only for a
      // fork still awaiting its first message — starting it here would land
      // after materializeFork and erase the opener. Skip the async path outright.
      if(s.pendingFork.opener){ if(isRefresh) setRefreshBusy(false); return; }
      var parent=findSessionById(s.pendingFork.parent) || {
        sessionId:s.pendingFork.parent,
        vendor:s.vendor||'claude',
        cwd:s.pendingFork.cwd||'',
        file:''
      };
      hydrateSessionSource(parent).then(function(){
        // Opener forks already returned above, so we're an empty fork here — but
        // the user may have typed + sent before this async resolved, in which
        // case send()→materializeFork() has taken over (setting materializing,
        // then clearing pendingFork once /chat/fork returns). Bail rather than
        // landing the placeholder on top of that opener.
        if(!s.pendingFork || s.pendingFork.materializing){ if(isRefresh) setRefreshBusy(false); return; }
        if(parent.file){
          fetch('/chat/messages?file='+encodeURIComponent(parent.file)+'&vendor='+encodeURIComponent(parent.vendor||s.vendor||'')).then(function(r){return r.json();}).then(function(msgs){
            cacheTranscript(parent, msgs);
            renderPersistedAndPending(msgs, null);
            addMsg('assistant','(forked with '+forkConfigLabel(s)+' — type your next message to continue this branch in a new direction)');
            if(cur===s) beginVisit(s);
            if(isRefresh) setRefreshBusy(false);
          }).catch(function(){
            var fallback=cachedTranscriptFor(parent) || [];
            renderPersistedAndPending(fallback, null);
            addMsg('assistant','(forked with '+forkConfigLabel(s)+' — type your next message to continue this branch in a new direction)');
            if(cur===s) beginVisit(s);
            if(isRefresh) setRefreshBusy(false);
          });
        } else {
          renderPersistedAndPending(cachedTranscriptFor(parent) || [], null);
          addMsg('assistant','(forked with '+forkConfigLabel(s)+' — type your next message to continue this branch in a new direction)');
          if(cur===s) beginVisit(s);
          if(isRefresh) setRefreshBusy(false);
        }
        if(cur===s) syncOpenHeader();
      }).catch(function(){ if(isRefresh) setRefreshBusy(false); });
      return;
    }
    var finishRefresh=function(){ if(isRefresh) setRefreshBusy(false); };
    var finishHistoryLoad=function(){
      syncCurrentLiveState(s);
      if(cur===s) beginVisit(s);
      finishRefresh();
    };
    var fetchHistory=function(sourceRetried){
      if(!s.file){
        if(!cached) renderSessionHistory(s, []);
        finishHistoryLoad();
        return;
      }
      var boundFile=s.file;
      var boundVendor=s.vendor||'';
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
            finishHistoryLoad();
          }).catch(function(){
            if(cur!==s) return;
            msgs = Array.isArray(msgs) ? msgs : [];
            var prevAfterFail=cachedTranscriptFor(s);
            if(prevAfterFail && s._busVersion) cacheTranscript(s, prevAfterFail);
            else if(!prevAfterFail || !sameTranscript(prevAfterFail, msgs)) renderSessionHistory(s, msgs);
            else cacheTranscript(s, msgs);
            finishHistoryLoad();
          });
        }
        msgs = Array.isArray(msgs) ? msgs : [];
        var prev=cachedTranscriptFor(s);
        if(prev && s._busVersion) cacheTranscript(s, prev);
        else if(!prev || !sameTranscript(prev, msgs)) renderSessionHistory(s, msgs);
        else cacheTranscript(s, msgs);
        finishHistoryLoad();
      }).catch(function(){
        if(cur!==s) return;
        if(!cachedTranscriptFor(s)) renderSessionHistory(s, []);
        finishHistoryLoad();
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
  function canRecoverSessionTurnEnd(s){
    var started=Number(s&&s.generatingStartedAt)||0;
    return !!(!started || (Date.now() - started) >= LIVE_END_GRACE_MS);
  }
  function recoverCurrentTurnFromLive(active){
    if(!cur || !cur.sessionId || !turnActive) return;
    if(active[providerSessionId(cur)]) return;
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
    // Keep the latest state received from the global bus. Session objects can be
    // added or provider-bound after this snapshot was first reduced, so opening
    // them must be able to project the same bus state by stable client identity.
    latestLiveSnapshot=res||{};
    applyStats(res && res.stats);
    var active={}; (res.active||[]).forEach(function(id){ active[id]=true; });
    var clientSessionIds=res&&res.clientSessionIds||{};
    SESS.forEach(function(s){
      if(!s.sessionId) return;
      if(s.clientBranchId && !s.providerSessionId){
        Object.keys(clientSessionIds).some(function(providerId){
          if(clientSessionIds[providerId]!==s.clientBranchId) return false;
          s.providerSessionId=providerId;
          return true;
        });
      }
      var liveId=providerSessionId(s);
      var wasGenerating=!!s.generating;
      var live=!!(liveId && active[liveId]);
      var startedAt=live ? liveStartedAt(res, liveId) : 0;
      var keepLocal = s===cur && turnActive;
      var keepGrace = s===cur && !turnActive && wasGenerating && !live && !canRecoverSessionTurnEnd(s);
      var g=live || keepLocal || keepGrace;
      s.generatingStartedAt = g ? (startedAt || s.generatingStartedAt || null) : null;
      if(g!==wasGenerating){
        s.generating=g;
        if(g && viewVisit && viewVisit.sessionId===s.sessionId) viewVisit.wasGenerating=true;
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
    if(cur && cur.sessionId && res.queues){
      var queueInfo=res.queues[providerSessionId(cur)];
      var serverCount=queueInfo ? Number(queueInfo.count||0) : 0;
      if(serverCount!==pendingQueue.length || (!!queueInfo && queueInfo.parked===true)!==queueParked) refreshServerQueue(cur);
    }
    var curLiveId=providerSessionId(cur);
    if(cur && curLiveId && active[curLiveId] && !turnActive){
      beginTurn(liveStartedAt(res, curLiveId) || Date.now());
    }
  }
  function syncCurrentLiveState(s){
    if(!s || !s.sessionId) return;
    // While the global bus is connected, its latest snapshot is authoritative.
    // Re-project it after transcript history renders so a session object that was
    // added/provider-bound since the snapshot arrived gets the same live state as every
    // existing tab. HTTP polling is only the disconnected/EventSource fallback.
    if(liveStateConnected && latestLiveSnapshot){
      applyLiveSnapshot(latestLiveSnapshot);
      return;
    }
    fetchLiveSnapshot(function(res){
      if(!cur || cur!==s) return;
      applyLiveSnapshot(res||{});
    });
  }
  function fetchLiveSnapshot(onOk){
    fetch('/chat/live').then(function(r){ return r.json(); }).then(function(res){
      if(onOk) onOk(res||{});
    }).catch(function(){});
  }
  function fallbackLiveDelay(){
    if(document.hidden) return 60000;
    if(turnActive || SESS.some(function(s){ return !!(s && s.generating); })) return 3000;
    return 30000;
  }
  function stopLiveFallback(){
    if(liveFallbackTimer){ clearTimeout(liveFallbackTimer); liveFallbackTimer=null; }
  }
  function markLiveFallback(){
    if(liveFallbackActive) return;
    liveFallbackActive=true;
    showToast('Live updates lost; using low-frequency fallback polling.', 'warn');
  }
  function markLiveRestored(){
    if(liveFallbackActive) showToast('Live updates restored.', 'ok');
    liveFallbackActive=false;
  }
  function scheduleLiveFallback(){
    if(liveFallbackTimer) return;
    markLiveFallback();
    liveFallbackTimer=setTimeout(function tick(){
      liveFallbackTimer=null;
      if(liveStateConnected) return;
      fetchLiveSnapshot(applyLiveSnapshot);
      scheduleLiveFallback();
    }, fallbackLiveDelay());
  }
  function openLiveStateStream(){
    if(!window.EventSource){
      scheduleLiveFallback();
      return;
    }
    if(liveEs) liveEs.close();
    liveEs=new EventSource('/chat/live-stream');
    liveEs.onopen=function(){
      liveStateConnected=true;
      markLiveRestored();
      stopLiveFallback();
    };
    liveEs.onmessage=function(e){
      liveStateConnected=true;
      markLiveRestored();
      stopLiveFallback();
      liveEventChain=liveEventChain.then(function(){ return e2eeEventData(e.data); }).then(function(message){
        if(message && message.kind==='session_event') onBusSessionEvent(message);
        else applyLiveSnapshot(message||{});
      }).catch(function(){});
    };
    liveEs.onerror=function(){
      liveStateConnected=false;
      scheduleLiveFallback();
    };
  }
  function reduceLatestLiveSnapshotEvent(sessionId, clientSessionId, ev){
    if(!sessionId || !ev || !latestLiveSnapshot) return;
    var starts=ev.kind==='user_turn_started' || ev.kind==='queued_turn_started';
    var ends=ev.kind==='result' || ev.kind==='error';
    if(!starts && !ends) return;
    var active=Array.isArray(latestLiveSnapshot.active) ? latestLiveSnapshot.active.slice() : [];
    var startedAt=Object.assign({}, latestLiveSnapshot.startedAt||{});
    var clientSessionIds=Object.assign({}, latestLiveSnapshot.clientSessionIds||{});
    var idx=active.indexOf(sessionId);
    if(starts){
      if(idx<0) active.push(sessionId);
      if(!startedAt[sessionId]) startedAt[sessionId]=Date.now();
      if(clientSessionId) clientSessionIds[sessionId]=clientSessionId;
    } else {
      if(idx>=0) active.splice(idx,1);
      delete startedAt[sessionId];
    }
    latestLiveSnapshot=Object.assign({}, latestLiveSnapshot, {active:active,startedAt:startedAt,clientSessionIds:clientSessionIds});
  }
  function onBusSessionEvent(message){
    var sessionId=String(message&&message.sessionId||'');
    var clientSessionId=String(message&&message.clientSessionId||'');
    var ev=message&&message.event;
    if(!sessionId || !ev) return;
    // Keep the cached SSE snapshot current with deltas between periodic snapshots.
    // In particular, result/error must remove the session immediately so opening
    // it cannot re-project an older "active" snapshot after the turn has ended.
    reduceLatestLiveSnapshotEvent(sessionId, clientSessionId, ev);
    var s=clientSessionId ? findSessionByClientId(clientSessionId) : findSessionById(sessionId);
    if(!s) s=findSessionById(sessionId);
    if(!s){
      var orphaned=orphanBusEvents[sessionId] || [];
      orphaned.push(message);
      orphanBusEvents[sessionId]=orphaned.slice(-500);
      return;
    }
    if(clientSessionId && !s.clientBranchId) s.clientBranchId=clientSessionId;
    if(!s.providerSessionId && s.clientBranchId) s.providerSessionId=sessionId;
    s._busVersion=Number(s._busVersion||0)+1;
    if(cur===s){ onEvent(ev, String(s.sessionId||'')); return; }
    if(ev.kind==='user_turn_started'){
      var userTurn={text:ev.text||'',attachments:Array.isArray(ev.attachments)?ev.attachments:[]};
      var userShown=shownTurnText(userTurn);
      if(latestPendingUserText(s.sessionId)!==userShown){
        noteUserTurn(s, userShown);
        cacheTranscriptUserMsg(s, userShown, userTurn.attachments);
      }
      s.generating=true;
      reviveAttention(s);
    } else if(ev.kind==='queued_turn_started'){
      var turn={text:ev.text||'',attachments:Array.isArray(ev.attachments)?ev.attachments:[]};
      var shown=shownTurnText(turn);
      noteUserTurn(s, shown);
      cacheTranscriptUserMsg(s, shown, turn.attachments);
      s.generating=true;
      reviveAttention(s);
    } else if(ev.kind==='assistant_text') cacheTranscriptAssistantText(s, ev.text);
    else if(ev.kind==='tool_use') cacheTranscriptToolUse(s, {id:ev.id,name:ev.name,input:ev.input});
    else if(ev.kind==='tool_result') cacheTranscriptToolResult(s, ev.id, String(ev.text||'').slice(0,8000), ev.isError);
    else if(ev.kind==='result' || ev.kind==='error'){
      s.generating=false;
      s.generatingStartedAt=null;
      markUnread(s);
      refreshAnalysis(s);
    }
    applyGenerating(s);
    renderSidebar();
  }
  function drainOrphanBusEvents(s){
    if(!s) return;
    var ids=[String(s.sessionId||''),providerSessionId(s)].filter(Boolean);
    ids.forEach(function(id){
      var pending=orphanBusEvents[id];
      if(!pending || !pending.length) return;
      delete orphanBusEvents[id];
      pending.forEach(onBusSessionEvent);
    });
  }
  function onEvent(ev, streamSessionId){
    if(!cur || !cur.sessionId || String(cur.sessionId)!==String(streamSessionId||'')) return;
    if(ev.kind==='user_turn_started'){
      var userTurn={text:ev.text||'',attachments:Array.isArray(ev.attachments)?ev.attachments:[]};
      var userShown=shownTurnText(userTurn);
      if(latestPendingUserText(cur.sessionId)!==userShown){
        noteUserTurn(cur, userShown);
        cacheTranscriptUserMsg(cur, userShown, userTurn.attachments);
        addMsg('user', userShown, true, userTurn.attachments);
      }
      assistantEl=null;
      if(!turnActive) beginTurn();
    }
    else if(ev.kind==='queued_turn_started'){
      var queueIndex=pendingQueue.findIndex(function(item){ return item.id===ev.queueId; });
      if(queueIndex>=0) pendingQueue.splice(queueIndex,1);
      queueParked=false;
      var queuedTurn={text:ev.text||'',attachments:Array.isArray(ev.attachments)?ev.attachments:[]};
      var queuedShown=shownTurnText(queuedTurn);
      rememberPendingUserMsg(cur.sessionId, queuedShown, queuedTurn.attachments);
      noteUserTurn(cur, queuedShown);
      cacheTranscriptUserMsg(cur, queuedShown, queuedTurn.attachments);
      addMsg('user', queuedShown, true, queuedTurn.attachments);
      assistantEl=null;
      if(!turnActive) beginTurn();
      renderQueue();
    }
    else if(ev.kind==='assistant_text'){
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
      if(isQuestionTool(ev.name, ev.input) && turnActive) endTurn();
    }
    else if(ev.kind==='tool_result'){ assistantEl=null; var t=ev.id?toolEls[ev.id]:null;
      cacheTranscriptToolResult(cur, ev.id, String(ev.text||'').slice(0,8000), ev.isError);
      if(t){ var o=t.querySelector('.tool-out'); o.textContent=String(ev.text||'').slice(0,8000); o.style.display=''; if(ev.isError) o.className='tool-out err'; if(hasQuestionAnswerResult(ev.text, ev.isError)) lockQuestionTool(t); }
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
    if(composerVendorChanged()) return;
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
    rememberPendingUserMsg(cur.sessionId, shown, turn.attachments);
    markVisitSend();
    noteUserTurn(cur, shown);
    cacheTranscriptUserMsg(cur, shown, turn.attachments);
    addMsg('user', shown, true, turn.attachments); assistantEl=null;
    dispatchSend(turn, shown);
  }
  // Queue a draft (rendered in the pinned region below) to send when the turn ends.
  function currentComposerTurn(){
    var inp=byId('input');
    return {
      text: inp && inp.value ? inp.value.trim() : '',
      attachments: cloneAttachments(draftAttachments)
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
  function enqueue(turn){
    if(!cur || !cur.sessionId) return;
    var target=cur;
    var providerId=providerSessionId(target); if(!providerId) return;
    var temp=Object.assign({id:'pending-'+Date.now()},cloneTurn(turn));
    pendingQueue.push(temp); renderQueue();
    fetch('/chat/queue?session='+encodeURIComponent(providerId)+'&cwd='+encodeURIComponent(target.cwd||'')+'&vendor='+encodeURIComponent(target.vendor||'claude'),{
      method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({text:turn.text,attachments:turn.attachments||[]})
    }).then(function(r){ return r.json(); }).then(function(res){
      if(cur===target) applyServerQueue(target,res);
      if(!res.ok){
        setDraftForSession(target, turn.text||'');
        showToast(res.error||'Could not queue message','warn');
      }
    }).catch(function(){
      if(cur===target){ pendingQueue=pendingQueue.filter(function(item){ return item.id!==temp.id; }); renderQueue(); }
      setDraftForSession(target, turn.text||'');
      showToast('Could not queue message','warn');
    });
  }
  // POST the turn and (re)attach the stream. The stream is opened once per
  // session in select(); only reopen if it somehow isn't (avoids replaying the
  // buffer and double-rendering the history).
  function dispatchSend(turn, shownText){
    if(!cur||!cur.sessionId){ endTurn(); return; }
    markReplied(cur); // you advanced it → keep it tracked; only a manual gray clears it
    assistantEl=null; beginTurn();
    touchSession(cur); // sending is an interaction → float this session to the top
    var uiId=cur.sessionId, id=providerSessionId(cur), cwd=cur.cwd||'', vendor=cur.vendor||'claude';
    if(!id){ endTurn(); return; }
    rememberModelEffort(vendor, cur.model||'', cur.effort||'');
    var body={ text: shownText, attachments: turn.attachments || [] };
    if(cur.runConfigDirty){
      body.runConfig=true;
      body.model=cur.model||undefined;
      body.effort=cur.effort||undefined;
    }
    fetch('/chat/send?session='+encodeURIComponent(id)+'&cwd='+encodeURIComponent(cwd)+'&vendor='+encodeURIComponent(vendor),{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(body)
    })
      .then(function(r){return r.json();}).then(function(res){ if(res.ok){ if(res.view) patchSessionView(res.view); if(cur&&cur.sessionId===uiId){ cur.runConfigDirty=false; refreshRunConfigButton(); } } else { forgetPendingUserMsg(uiId, shownText); addMsg('error','⚠ '+(res.error||'send failed')); turnEnded(); } })
      .catch(function(e){ forgetPendingUserMsg(uiId, shownText); addMsg('error','⚠ network error: '+(e&&e.message?e.message:e)); turnEnded(); });
  }
  // Stop: interrupt the in-flight turn. Keep queued drafts intact; when the abort result arrives, turnEnded
  // will leave them parked so you can edit or send one explicitly.
  function stopTurn(){
    if(!cur||!cur.sessionId) return;
    var stopping=cur;
    stopRequested=true;
    renderQueue();
    var b=genEl&&genEl.querySelector('.bubble'); if(b){ b.textContent='Stopping…'; }
    var providerId=providerSessionId(cur); if(!providerId) return;
    fetch('/chat/abort?session='+encodeURIComponent(providerId)+'&vendor='+encodeURIComponent(cur.vendor||'claude'),{method:'POST'})
      .then(function(r){ return r.json().catch(function(){ return {}; }); })
      .then(function(){
        if(cur===stopping && stopRequested){ turnEnded(); syncCurrentLiveState(stopping); }
      })
      .catch(function(){
        if(cur===stopping && stopRequested){ turnEnded(); syncCurrentLiveState(stopping); }
      });
  }
  function startForkFromPrefix(prefixHistory, firstTurn){
    if(!cur||!cur.sessionId) return;
    var config=currentForkDefaults();
    var info=vendorInfo(config.vendor);
    if(info && (!info.available || info.chat===false)){ showToast(config.vendor+' is not available for in-browser forks', 'warn'); return; }
    if(!info){ showToast('unknown vendor: '+config.vendor, 'warn'); return; }
    var clientBranchId=makeClientBranchId();
    var ns={
      vendor:config.vendor,
      model:config.model||'',
      effort:config.effort||'',
      sessionId:clientBranchId,
      clientBranchId:clientBranchId,
      providerSessionId:null,
      pendingFork:{
        parent:providerSessionId(cur),
        parentVendor:cur.vendor,
        cwd:cur.cwd||'',
        consumeParentDraft:false,
        opener:true,
        model:config.model||'',
        effort:config.effort||'',
        prefixHistory:cloneTranscriptMsgs(prefixHistory)
      },
      title:forkTitleFromSession(cur),
      lastPrompt:null,
      cwd:cur.cwd,
      project:cur.project,
      file:'',
      ageDays:0,
      lastTs:Date.now(),
      prompts:0,
      brief:null,
      state:null,
      seen:true,
      tags:(cur.tags||[]).slice()
    };
    SESS.unshift(ns);
    select(ns);
    materializeFork(ns, firstTurn);
  }
  function startFork(config){
    if(!cur||!cur.sessionId){ alert('Pick a session on the left before splitting.'); return; }
    if(cur.pendingFork){ byId('input').focus(); return; }
    config = config || currentForkDefaults();
    var info=vendorInfo(config.vendor);
    if(info && (!info.available || info.chat===false)){ showToast(config.vendor+' is not available for in-browser forks', 'warn'); return; }
    if(!info){ showToast('unknown vendor: '+config.vendor, 'warn'); return; }
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
    var clientBranchId=makeClientBranchId();
    var ns={vendor:config.vendor,model:config.model||'',effort:config.effort||'',sessionId:clientBranchId,clientBranchId:clientBranchId,providerSessionId:null,pendingFork:{parent:providerSessionId(cur),parentVendor:cur.vendor,cwd:cur.cwd||'',consumeParentDraft:!!(firstTurn.text || firstTurn.attachments.length),opener:!!(firstTurn.text || firstTurn.attachments.length),model:config.model||'',effort:config.effort||''},title:forkTitleFromSession(cur),lastPrompt:null,cwd:cur.cwd,project:cur.project,file:'',ageDays:0,lastTs:Date.now(),prompts:0,brief:null,state:null,seen:true,tags:(cur.tags||[]).slice()};
    SESS.unshift(ns); select(ns);
    if(firstTurn.text || firstTurn.attachments.length){ materializeFork(ns, firstTurn); } else { inp.focus(); }
  }
  function fork(){
    if(!cur||!cur.sessionId){ alert('Pick a session on the left before splitting.'); return; }
    if(cur.pendingFork){ byId('input').focus(); return; }
    startFork(currentForkDefaults());
  }
  // Turn a pending fork into a real session using its first message. The fork
  // renders the parent transcript as its base, except when the opener repeats the
  // parent's latest user turn: then it drops that stale turn + answer so the new
  // opener appears before the branch's fresh response.
  function materializeFork(branch,turn){
    // Opener forks skip select()'s async placeholder synchronously (pendingFork
    // .opener), so this flag only matters for the empty-fork path: if the user
    // typed + sent before select()'s in-flight placeholder render resolved,
    // mark materializing so that render stands down instead of replaceMessages()
    // -ing away the opening user turn we're about to render.
    if(branch.pendingFork) branch.pendingFork.materializing = true;
    var shown=shownTurnText(turn);
    var parent=findSessionById(branch.pendingFork.parent);
    var hasPrefix=!!(branch.pendingFork && Object.prototype.hasOwnProperty.call(branch.pendingFork, 'prefixHistory'));
    var parentHistory=hasPrefix
      ? cloneTranscriptMsgs(branch.pendingFork.prefixHistory || [])
      : forkBaseHistory((parent && cachedTranscriptFor(parent)) || [], shown);
    var inp=byId('input');
    if(parentHistory.length) renderPersistedAndPending(parentHistory, null);
    else byId('msgs').innerHTML='';
    noteUserTurn(branch, shown); addMsg('user', shown, true, turn.attachments);
    // The branch cache is keyed by its stable client identity from the start.
    // Provider events can now append safely even before /chat/fork returns.
    cacheTranscript(branch, parentHistory);
    rememberPendingUserMsg(branch.sessionId, shown, turn.attachments);
    cacheTranscriptUserMsg(branch, shown, turn.attachments);
    if(inp) inp.value=''; setDraftForSession(branch, ''); draftAttachments=[]; stashAttachmentState(branch); renderAttachments(); assistantEl=null;
    beginTurn();
    var vendor=branch.vendor||'claude';
    var model=(branch.pendingFork&&branch.pendingFork.model)||branch.model||'';
    var effort=(branch.pendingFork&&branch.pendingFork.effort)||branch.effort||'';
    rememberModelEffort(vendor, model, effort);
    var body={text:shown, attachments:turn.attachments || [], model:model||undefined, effort:effort||undefined, clientSessionId:branch.clientBranchId};
    if(hasPrefix) body.contextMessages=parentHistory;
    fetch('/chat/fork?session='+encodeURIComponent(branch.pendingFork.parent)+'&cwd='+encodeURIComponent(branch.pendingFork.cwd)+'&vendor='+encodeURIComponent(vendor),
      {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){return r.json();}).then(function(res){ if(!res.ok){ addMsg('error','⚠ '+(res.error||'fork failed')); endTurn(); return; }
        if(branch.pendingFork.consumeParentDraft) clearDraftForSession(parent);
        branch.providerSessionId=res.session; branch.pendingFork=null;
        if(res.cwd) branch.cwd=res.cwd;
        if(res.project) branch.project=res.project;
        else if(res.cwd) branch.project=basename(res.cwd);
        branch.file='';
        branch.model=model; branch.effort=effort;
        drainOrphanBusEvents(branch);
        markReplied(branch);
        // The active snapshot may have arrived while this object still had its
        // pending id. Re-project the already-received SSE state after the id bind;
        // this is local event-store reduction, not an extra live-status request.
        if(latestLiveSnapshot) applyLiveSnapshot(latestLiveSnapshot);
        if(cur===branch){ syncOpenHeader(); renderSidebar(); refreshForkButton(); }
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
    var attachments=newAttachments.map(function(att){ return Object.assign({}, att); });
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
      if(attachments.length){ byId('nmsg').textContent='attachments are only available for in-browser chat sessions'; return; }
      setNewPending(true,'Opening terminal…');
      fetch('/launch?action=new&vendor='+encodeURIComponent(vendor)+'&cwd='+encodeURIComponent(dir)+launchQs+(text?('&prompt='+encodeURIComponent(text)):''),{method:'POST'})
        .then(function(r){return r.json();}).then(function(res){
          if(!res.ok){ setNewPending(false, res.error||'failed'); return; }
          rememberNewSessionPrefs(vendor, model, effort);
          byId('np').value='';
          if(res.cwd){ byId('ndir').value=res.cwd; applyDirChooserTheme(res.cwd); }
          setNewPending(false, 'Launched in terminal: '+res.command); })
        .catch(function(e){ setNewPending(false, e&&e.message?e.message:'failed'); });
      return;
    }
    setNewPending(true,'Starting session…');
    // In-browser chat. Claude can open empty (first message optional); Codex only
    // mints a thread id once a turn runs, so default its opening message to a greeting.
    if(vendor==='codex' && !text && !attachments.length){ text='hello'; }
    fetch('/chat/new?cwd='+encodeURIComponent(dir)+'&vendor='+encodeURIComponent(vendor),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text, attachments:attachments, model:model||undefined, effort:effort||undefined})})
      .then(function(r){return r.json();}).then(function(res){ if(!res.ok){ setNewPending(false, res.error||'failed'); return; }
        rememberNewSessionPrefs(vendor, model, effort);
        var cwd=res.cwd||dir;
        var shown=composeTurnText(text, attachments);
        var ns={vendor:vendor,model:model||'',effort:effort||'',sessionId:res.session,title:shown||'(new session)',lastPrompt:null,cwd:cwd,project:basename(cwd),file:'',ageDays:0,lastTs:Date.now(),prompts:0,brief:null,state:null,tags:[],generating:!!shown};
        if(shown){ rememberPendingUserMsg(res.session, shown, attachments); noteUserTurn(ns, shown); }
        cacheTranscript(ns, shown ? [{role:'user',text:String(shown||''),attachments:cloneAttachments(attachments),tools:[]}] : []);
        SESS.unshift(ns); drainOrphanBusEvents(ns); select(ns); markReplied(ns);
        if(shown && ns.generating && !turnActive) beginTurn();
        byId('np').value=''; newAttachments=[]; renderAttachments('new'); byId('nmsg').textContent=''; byId('ndir').value=cwd; applyDirChooserTheme(cwd); closeNewBox();
        setNewPending(false, '');
      }).catch(function(e){ setNewPending(false, e&&e.message?e.message:'failed'); });
  }

  function initApp(){
  // Stream active-session snapshots so background tabs show generating state
  // without spending one request every few seconds. /chat/live remains a low-
  // frequency fallback when EventSource is unavailable or disconnected.
  openLiveStateStream();
  // Vendor CLIs can rewrite local model caches during startup. Re-read them after
  // the first render so newly advertised models appear without reloading Attend.
  refreshClaudeModels();
  var claudeModelRefreshCount=0;
  var claudeModelRefreshTimer=window.setInterval(function(){
    refreshClaudeModels();
    claudeModelRefreshCount++;
    if(claudeModelRefreshCount>=12) window.clearInterval(claudeModelRefreshTimer);
  }, 5000);
  refreshCodexModels();
  var codexModelRefreshCount=0;
  var codexModelRefreshTimer=window.setInterval(function(){
    refreshCodexModels();
    codexModelRefreshCount++;
    if(codexModelRefreshCount>=12) window.clearInterval(codexModelRefreshTimer);
  }, 5000);

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
  setupCustomSelects();
  setupVendorChooser();
  setupDirChooser();
  bindComposerDrop();
  bindNewAttachments();
  renderAttachments();
  renderAttachments('new');
  scheduleOverlayOffsets();
  window.addEventListener('resize', scheduleOverlayOffsets);
  if(window.ResizeObserver){
    var overlayObserver=new ResizeObserver(scheduleOverlayOffsets);
    ['composer','queue','avoidPanel','attachTray','attachMsg'].forEach(function(id){
      var node=byId(id);
      if(node) overlayObserver.observe(node);
    });
  }
  syncRefreshButton();
  refreshRunConfigButton();
  setTheme(currentTheme(), false);
  // The send button is also the Stop button mid-turn.
  byId('send').onclick=function(){ if(turnActive) stopTurn(); else send(); };
  byId('themeToggle').onclick=toggleTheme;
  byId('refreshBtn').onclick=refreshCurrentChat;
  byId('latestPin').onclick=jumpToLatestPin;
  byId('latestPin').onkeydown=function(e){
    if(e.key==='Enter' || e.key===' '){ e.preventDefault(); jumpToLatestPin(); }
  };
  // mobile: back from the chat page to the session list
  byId('backbtn').onclick=function(){ document.body.classList.remove('show-chat'); };
  byId('runCfgBtn').onclick=function(ev){ ev.preventDefault(); if(runPopOpen()) closeRunPop(); else openRunPop(); };
  byId('forkBtn').onclick=fork;
  byId('rvendor').onchange=function(){ refreshRunConfigControls(true); applyRunConfig(); };
  byId('nbtn').onclick=newSession;
  // Enter starts the session; Shift+Enter inserts a newline (IME-safe).
  byId('np').addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey&&!isImeConfirming(e)){ e.preventDefault(); newSession(); }
  });
  byId('newToggle').onclick=function(ev){ ev.stopPropagation(); toggleNewBox(); };
  byId('newClose').onclick=function(ev){ ev.stopPropagation(); closeNewBox(); };
  byId('tagModeToggle').onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); toggleTagFilterMode(); };
  byId('bulkArchiveSeen').onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); archiveSeenInView(); };
  // Live-filter the sidebar as you type; Esc clears the search.
  function syncSearchFilterState(input){
    var on=!!filterQ;
    input.classList.toggle('filtering', on);
    if(input.parentElement) input.parentElement.classList.toggle('filtering', on);
  }
  byId('search').addEventListener('input',function(){ filterQ=this.value.trim().toLowerCase(); syncSearchFilterState(this); sortSessions(); renderSidebar(); scheduleContentSearch(); });
  byId('search').addEventListener('keydown',function(e){ if(e.key==='Escape'){ this.value=''; filterQ=''; syncSearchFilterState(this); sortSessions(); renderSidebar(); scheduleContentSearch(); } });
  document.addEventListener('mousemove', maybeDismissTabTip, true);
  document.addEventListener('pointerdown', hideTabTip, true);
  window.addEventListener('scroll', hideTabTip, true);
  window.addEventListener('resize', hideTabTip);
  window.addEventListener('blur', hideTabTip);
  byId('imgPreview').onclick=function(ev){ if(ev.target===this) closeImagePreview(); };
  byId('imgPreviewViewport').onclick=function(ev){ if(ev.target===this) closeImagePreview(); };
  byId('imgPreviewViewport').addEventListener('wheel', function(ev){
    if(byId('imgPreview').hidden) return;
    ev.preventDefault();
    zoomMediaPreview(ev.deltaY<0 ? 1.12 : 1/1.12);
  }, { passive:false });
  byId('imgPreviewViewport').addEventListener('pointerdown', function(ev){
    if(byId('imgPreview').hidden) return;
    mediaPreview.dragging=true;
    mediaPreview.sx=ev.clientX; mediaPreview.sy=ev.clientY;
    mediaPreview.ox=mediaPreview.x; mediaPreview.oy=mediaPreview.y;
    this.classList.add('dragging');
    this.setPointerCapture(ev.pointerId);
  });
  byId('imgPreviewViewport').addEventListener('pointermove', function(ev){
    if(!mediaPreview.dragging) return;
    mediaPreview.x=mediaPreview.ox+(ev.clientX-mediaPreview.sx);
    mediaPreview.y=mediaPreview.oy+(ev.clientY-mediaPreview.sy);
    applyMediaPreviewTransform();
  });
  function endMediaPreviewDrag(ev){
    mediaPreview.dragging=false;
    byId('imgPreviewViewport').classList.remove('dragging');
    if(ev && ev.pointerId!==undefined){
      try{ byId('imgPreviewViewport').releasePointerCapture(ev.pointerId); }catch(_err){}
    }
  }
  byId('imgPreviewViewport').addEventListener('pointerup', endMediaPreviewDrag);
  byId('imgPreviewViewport').addEventListener('pointercancel', endMediaPreviewDrag);
  byId('imgPreviewViewport').addEventListener('dblclick', resetMediaPreviewTransform);
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape') hideTabTip();
    if(e.key==='Escape' && priorityMenuOpen){ priorityMenuOpen=false; renderTagFilters(); }
    if(!byId('imgPreview').hidden){
      if(e.key==='Escape') closeImagePreview();
      if(e.key==='+' || e.key==='='){ e.preventDefault(); zoomMediaPreview(1.18); }
      if(e.key==='-' || e.key==='_'){ e.preventDefault(); zoomMediaPreview(1/1.18); }
      if(e.key==='0'){ e.preventDefault(); resetMediaPreviewTransform(); }
    }
    if(e.key==='Escape' && newBoxOpen() && !newSessionPending){ closeNewBox(); }
    if(e.key==='Escape' && runPopOpen()){ closeRunPop(); }
  });
  document.addEventListener('click',function(ev){
    var priorityTag=byId('priorityTag');
    if(!priorityMenuOpen || (priorityTag && priorityTag.contains(ev.target))) return;
    priorityMenuOpen=false;
    renderTagFilters();
  });
  document.addEventListener('click',function(ev){
    var box=byId('newbox'), btn=byId('newToggle');
    if(!newBoxOpen() || newSessionPending || !box || !btn) return;
    if(box.contains(ev.target) || btn.contains(ev.target)) return;
    closeNewBox();
  });
  document.addEventListener('click',function(ev){
    var pop=byId('runPop'), btn=byId('runCfgBtn');
    if(!runPopOpen() || !pop || !btn) return;
    if(pop.contains(ev.target) || btn.contains(ev.target)) return;
    closeRunPop();
  });
  byId('input').addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey&&!isImeConfirming(e)){ e.preventDefault(); send(); }
  });
  byId('input').addEventListener('input',function(){
    if(!cur) return;
    setDraftForSession(cur, this.value);
    if(String(this.value||'').trim()) touchSession(cur);
  });
  document.addEventListener('visibilitychange', function(){
    if(document.hidden) flushVisit(true);
    else if(cur && cur.sessionId && !cur.pendingFork){
      if(!viewVisit) beginVisit(cur);
      syncCurrentLiveState(cur);
    }
  });
  window.addEventListener('pagehide', function(){ flushVisit(true); });
  window.addEventListener('beforeunload', function(){ flushVisit(true); });
  }
  if(E2EE.enabled) startUnlockFlow();
  else initApp();
})();
</script>
</body>
</html>`;
}
