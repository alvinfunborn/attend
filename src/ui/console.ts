import type { AnalysisState } from "../core/daemon/cache.js";
import type { ModelDefaults, ModelOption } from "../core/model-options.js";
import type { ScheduledItem } from "../core/schedules.js";
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
  /** Provider session id this session forked from, when Attend knows the relationship. */
  forkParentId?: string | null;
  /** first user prompt — the first subtitle */
  title: string;
  /** user-owned title persisted in the vault, displayed ahead of the daemon brief */
  customTitle?: string;
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
  /** daemon-drafted ready-to-send user message when the next move is obvious; null
   *  when a decision is needed (composer shows nothing rather than a nudge) */
  nextStep?: string | null;
  /** daemon-drafted scrutiny-lane message (question / explain / verify THIS turn);
   *  null when nothing warrants it. Independent of nextStep. */
  probe?: string | null;
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
  /** epoch ms of the latest assistant text/tool activity during the active turn */
  lastAssistantOutputAt?: number | null;
  /** completed duration of the latest turn, retained in the tab until the next turn */
  lastGenerationDurationMs?: number | null;
  /** terminal state paired with lastGenerationDurationMs */
  lastGenerationOutcome?: "generated" | "stopped" | "failed" | null;
  /** local-only: the latest turn ended through this UI's explicit Stop action */
  lastGenerationStoppedByUser?: boolean;
  /** turn ended and the daemon has not yet supplied the next ETA/state */
  analysisPending?: boolean;
  /** best-known session configuration; absent means historical value is unknown */
  model?: string;
  effort?: string;
  speed?: string;
  /** local-only: next send should restart/resume this session with model/effort/speed */
  runConfigDirty?: boolean;
  /** local-only: selected composer vendor; a different vendor can only be forked */
  runVendor?: string;
  runModel?: string;
  runEffort?: string;
  runSpeed?: string;
}

export interface ConsoleView {
  sessions: SessionView[];
  /** Active one-shot jobs projected into session cards and the existing queue surfaces. */
  schedules?: ScheduledItem[];
  knownDirs: string[];
  scopeRoots: string[];
  /** Most recently used directory for a new session, with a scope/launch-root fallback. */
  defaultNewDir: string;
  /** Markdown rendered in the chat pane when no session is selected. */
  changelogMarkdown: string;
  /** browser tab title; usually derived from the launch/scope directory */
  pageTitle?: string;
  /** distinct sessions with a real user prompt in the trailing hour */
  sessions1h: number;
  /** real user prompts in the trailing hour */
  prompts1h: number;
  /** visible user + assistant conversation characters in the trailing hour */
  chars1h: number;
  /** locally-detected vendor CLIs — populates the "+ new" provider picker */
  vendors: VendorAvailability[];
  /** Claude models discovered from local Claude Code state, or configured overrides. */
  claudeModels: ModelOption[];
  /** Codex models discovered through the CLI, with its internal cache as last fallback. */
  codexModels: ModelOption[];
  /** Cursor Desktop-enabled models intersected with the Cursor CLI catalog. */
  cursorModels: ModelOption[];
  /** Compatibility warnings for vendor-owned internal model sources. */
  modelWarnings?: {
    claude?: string | null;
    codex?: string | null;
    cursor?: string | null;
  };
  /** Effective model/effort/speed defaults read from each vendor's CLI. */
  modelDefaults?: Partial<Record<string, ModelDefaults>>;
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
    --surface: #fbf9f4; --surface-2: #f6f3ec; --canvas: #eeece4;
    --button-hover: #f1eee6; --button-hover-border: #cfc9bd;
    --scroll-thumb: #d4d8e0; --scroll-thumb-hover: #b9bfcc; --resizer-hover: #c7d2fe;
    --panel-gradient: linear-gradient(180deg, #fffdf8 0%, var(--surface) 100%);
    --newbox-gradient: linear-gradient(180deg, #f7f4ed 0%, var(--surface) 100%);
    --latest-gradient: linear-gradient(180deg, #f5f2eb 0%, var(--surface) 100%);
    --row-line: #f1f2f4; --item-hover: #f1f5f9;
    --item-selected-row-start: #e0e7ff; --item-selected-row-end: rgba(238,242,255,0.48);
    --item-selected-card-start: rgba(99,102,241,0.18); --item-selected-card-mid: #eef2ff; --item-selected-card-end: #f8faff;
    --item-selected-marker: #6366f1; --item-selected-row-ring: rgba(79,70,229,0.2);
    --item-selected-card-ring: rgba(79,70,229,0.42); --item-selected-shadow: rgba(79,70,229,0.26);
    --soft-card: #f6f3ec; --assistant-bg: #f1eee6; --assistant-border: #ded8cc;
    --user-msg-bg: #e0e7ff; --user-msg-border: #c7d2fe; --user-msg-fg: #1e1b4b;
    --user-msg-link: #4338ca; --user-msg-code-bg: rgba(79,70,229,0.10);
    --msg-control-bg: rgba(255,253,248,0.72); --msg-control-hover-bg: #f1eee6;
    --msg-control-border: rgba(148,163,184,0.3); --msg-control-active-bg: #eef2ff;
    --msg-control-active-border: #c7d2fe;
    --code-bg: #e8e4da; --input-bg: #fffdf8; --danger-soft: #fef2f2;
    --warning: #f59e0b; --warning-ring: rgba(245,158,11,0.24); --warning-soft: #fffbeb;
    --tabtip-bg: rgba(255,253,248,0.96); --tabtip-border: rgba(207,201,189,0.95);
    --drop-bg: #f7f4ed; --primary-bg: #4f46e5; --primary-fg: #ffffff; --primary-hover: #4338ca;
    --status-generating: #7e22ce; --status-generating-soft: rgba(126,34,206,0.22);
    --status-unread: #059669; --status-unread-soft: rgba(16,185,129,0.24);
    --status-seen: #0284c7; --status-seen-soft: rgba(14,165,233,0.18);
    --status-read: #cbd5e1;
    --tool-bg: #fbf9f4; --tool-body-bg: #f6f3ec; --tool-border: #d5cfc2;
    --tool-border-strong: #aaa292; --tool-divider: #e5e0d6; --tool-fg: #5d5a52; --tool-icon: #9b9488;
    --vendor-claude-fg: #c2410c; --vendor-claude-bg: #fff7ed; --vendor-claude-border: #fdba74;
    --vendor-claude-hover-bg: #ffedd5; --vendor-claude-hover-border: #fb923c;
    --vendor-codex-fg: #3730a3; --vendor-codex-bg: #eef2ff; --vendor-codex-border: #a5b4fc;
    --vendor-codex-hover-bg: #e0e7ff; --vendor-codex-hover-border: #818cf8;
    /* Cursor's brand is monochrome. Keep its vendor identity neutral. */
    --vendor-cursor-fg: #18181b; --vendor-cursor-bg: #f4f4f5; --vendor-cursor-border: #a1a1aa;
    --vendor-cursor-hover-bg: #e4e4e7; --vendor-cursor-hover-border: #71717a;
    --todo-fg: #b45309; --todo-bg: #fffbeb; --todo-border: #fde68a;
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
    --item-selected-row-start: rgba(129,140,248,0.24); --item-selected-row-end: rgba(79,70,229,0.1);
    --item-selected-card-start: rgba(99,102,241,0.28); --item-selected-card-mid: rgba(30,27,75,0.72); --item-selected-card-end: rgba(15,23,42,0.92);
    --item-selected-marker: #a5b4fc; --item-selected-row-ring: rgba(165,180,252,0.2);
    --item-selected-card-ring: rgba(165,180,252,0.62); --item-selected-shadow: rgba(129,140,248,0.9);
    --soft-card: #172033; --assistant-bg: #1e293b; --assistant-border: #334155;
    --user-msg-bg: #3730a3; --user-msg-border: #4f46e5; --user-msg-fg: #f8fafc;
    --user-msg-link: #e0e7ff; --user-msg-code-bg: rgba(2,6,23,0.30);
    --msg-control-bg: rgba(15,23,42,0.52); --msg-control-hover-bg: #172033;
    --msg-control-border: rgba(148,163,184,0.22); --msg-control-active-bg: rgba(99,102,241,0.2);
    --msg-control-active-border: rgba(129,140,248,0.44);
    --code-bg: #0b1220; --input-bg: #0f172a; --danger-soft: #3b121a;
    --warning: #fbbf24; --warning-ring: rgba(251,191,36,0.22); --warning-soft: #2f2410;
    --tabtip-bg: rgba(17,24,39,0.96); --tabtip-border: rgba(71,85,105,0.9);
    --drop-bg: #151f31; --primary-bg: #4f46e5; --primary-fg: #ffffff; --primary-hover: #5b5ee8;
    --status-generating: #c084fc; --status-generating-soft: rgba(192,132,252,0.28);
    --status-unread: #34d399; --status-unread-soft: rgba(52,211,153,0.24);
    --status-seen: #38bdf8; --status-seen-soft: rgba(56,189,248,0.2);
    --status-read: #475569;
    --tool-bg: #0b1220; --tool-body-bg: #0f172a; --tool-border: #334155;
    --tool-border-strong: #64748b; --tool-divider: #263241; --tool-fg: #a7b4c4; --tool-icon: #64748b;
    --vendor-claude-fg: #f0ab8a; --vendor-claude-bg: rgba(194,65,12,0.16); --vendor-claude-border: #9a3412;
    --vendor-claude-hover-bg: rgba(194,65,12,0.26); --vendor-claude-hover-border: #c2410c;
    --vendor-codex-fg: #c4b5fd; --vendor-codex-bg: rgba(79,70,229,0.18); --vendor-codex-border: #6366f1;
    --vendor-codex-hover-bg: rgba(79,70,229,0.3); --vendor-codex-hover-border: #818cf8;
    --vendor-cursor-fg: #f4f4f5; --vendor-cursor-bg: #27272a; --vendor-cursor-border: #71717a;
    --vendor-cursor-hover-bg: #3f3f46; --vendor-cursor-hover-border: #a1a1aa;
    --todo-fg: #fbbf24; --todo-bg: rgba(245,158,11,0.14); --todo-border: rgba(245,158,11,0.48);
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
  .side { position: relative; width: 320px; flex-shrink: 0; background: var(--surface-2); border-right: 1px solid var(--line); display: flex; flex-direction: column; container-type: inline-size; }
  /* draggable divider to widen/narrow the sidebar */
  .resizer { width: 6px; flex-shrink: 0; cursor: col-resize; background: transparent; transition: background 0.15s; }
  .resizer:hover, .resizer.dragging { background: var(--resizer-hover); }
  /* brand header */
  .side .brand { display: flex; align-items: center; gap: 0.5rem; padding: 0.72rem 0.85rem 0.68rem; }
  .brand-id { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 0.5rem; overflow: hidden; }
  .brand-name { flex-shrink: 0; font-size: 1.32rem; font-weight: 800; letter-spacing: 0; color: var(--ink); line-height: 1; }
  .brand-scope { display: none; min-width: 0; max-width: 14rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; font-weight: 600; color: var(--ink-4); }
  .side .brand #themeToggle { margin-left: auto; }
  /* compact throughput stats */
  .brand-stats { appearance: none; flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 0.55rem; overflow: visible; padding: 0.2rem 0.25rem; margin: -0.2rem -0.25rem; border: 0; border-radius: 4px; background: transparent; box-shadow: none; font: inherit; text-align: left; cursor: pointer; }
  .brand-stats:hover { background: var(--accent-soft); }
  .brand-stats:hover .statval { color: var(--accent); }
  .brand-stats:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .statcard { flex-shrink: 0; min-width: 0; display: inline-flex; align-items: baseline; gap: 0.2rem; color: var(--ink-4); }
  .statval { font-size: 0.78rem; font-weight: 760; letter-spacing: 0; color: var(--ink-2); line-height: 1; font-variant-numeric: tabular-nums; }
  .statlbl { font-size: 0.64rem; font-weight: 600; letter-spacing: 0; color: var(--ink-4); white-space: nowrap; }
  .side .topnav { padding: 0.75rem 1rem 0.85rem; display: flex; gap: 0.55rem; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .side .topnav a { font-size: 0.78rem; color: var(--accent); text-decoration: none; align-self: center; margin-left: auto; }
  .searchwrap { --search-range-width: 5rem; position: relative; flex: 1; min-width: 0; display: flex; align-items: center; }
  .search-ico { position: absolute; left: 0.7rem; width: 0.9rem; height: 0.9rem; stroke: var(--ink-4); stroke-width: 1.7; fill: none; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
  .search-clear { position: absolute; right: calc(var(--search-range-width) + 0.18rem); width: 1.25rem; height: 1.25rem; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 50%; background: transparent; box-shadow: none; color: var(--ink-4); font-size: 0.9rem; line-height: 1; }
  .search-clear:hover { color: var(--ink); background: var(--button-hover); box-shadow: none; }
  .search-clear[hidden] { display: none; }
  .search-range-button { position: absolute; z-index: 2; right: 0.25rem; width: var(--search-range-width); height: 1.55rem; display: flex; align-items: center; justify-content: center; gap: 0.28rem; padding: 0.12rem 0.52rem 0.12rem 0.42rem; border: 0; border-left: 1px solid var(--line); border-radius: 0 4px 4px 0; color: var(--ink-4); background: transparent; box-shadow: none; font-size: 0.64rem; font-weight: 650; white-space: nowrap; }
  .search-range-button:hover, .search-range-button[aria-expanded="true"] { color: var(--ink-2); background: color-mix(in srgb, var(--surface-2) 72%, transparent); box-shadow: none; }
  .search-range-button.active { color: var(--warning); border-left-color: color-mix(in srgb, var(--warning) 38%, var(--line)); }
  .search-range-button svg { width: 0.62rem; height: 0.62rem; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .search-range-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .search-range-clock { display: none; }
  .search-range-menu { position: absolute; z-index: 66; top: calc(100% + 0.34rem); left: 0; width: min(11rem, calc(100vw - 2rem)); padding: 0.3rem; border: 1px solid color-mix(in srgb, var(--line-2) 72%, transparent); border-radius: 10px; color: var(--ink); background: color-mix(in srgb, var(--surface) 96%, transparent); box-shadow: var(--shadow-pop); backdrop-filter: blur(12px) saturate(1.08); }
  .search-range-menu.custom { width: min(20rem, calc(100vw - 2rem)); padding: 0.42rem; }
  .search-range-menu[hidden] { display: none; }
  .search-range-option { width: 100%; min-height: 1.9rem; display: flex; align-items: center; gap: 0.45rem; padding: 0.32rem 0.48rem; border: 0; border-radius: 6px; color: var(--ink-2); background: transparent; box-shadow: none; font-size: 0.73rem; text-align: left; }
  .search-range-option + .search-range-option { margin-top: 0.05rem; }
  .search-range-option:hover, .search-range-option.on { color: var(--ink); background: color-mix(in srgb, var(--surface-2) 78%, transparent); box-shadow: none; }
  .search-range-option[aria-selected="true"] { color: var(--ink); background: var(--accent-soft); font-weight: 600; }
  .search-range-option[aria-selected="true"]:hover, .search-range-option[aria-selected="true"].on { background: var(--accent-soft); }
  .search-range-option-label { flex: 1; min-width: 0; }
  .search-range-option-check { flex-shrink: 0; color: var(--accent); font-size: 0.7rem; font-weight: 800; }
  .search-range-custom-head { display: grid; grid-template-columns: 1.7rem minmax(0,1fr) 1.7rem; align-items: center; min-height: 1.8rem; margin-bottom: 0.28rem; }
  .search-range-custom-back { width: 1.7rem; height: 1.7rem; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px; color: var(--ink-3); background: transparent; box-shadow: none; font-size: 1rem; }
  .search-range-custom-back:hover { color: var(--ink); background: var(--button-hover); box-shadow: none; }
  .search-range-custom-title { color: var(--ink); font-size: 0.73rem; font-weight: 700; text-align: center; }
  .search-range-custom-fields { display: grid; gap: 0.34rem; padding: 0.08rem; }
  .search-range-custom-field { display: grid; grid-template-columns: 2.25rem minmax(0,1fr); align-items: center; gap: 0.4rem; }
  .search-range-custom-field > span { color: var(--ink-4); font-size: 0.65rem; font-weight: 650; }
  .search-range-custom-field .scheduledatetime { min-width: 0; height: 1.9rem; }
  .search-range-custom-field .scheduledatetime input { font-size: 0.68rem; }
  .search-range-custom-picker { margin: 0.12rem 0.08rem 0; }
  .search-range-custom-error { min-height: 1rem; padding: 0.2rem 0.1rem 0; color: #b91c1c; font-size: 0.62rem; line-height: 1.25; }
  html[data-theme="dark"] .search-range-custom-error { color: #fca5a5; }
  .search-range-custom-error:empty { visibility: hidden; }
  .search-range-custom-actions { display: flex; justify-content: flex-end; padding: 0.14rem 0.08rem 0.04rem; }
  .search-range-custom-apply { min-height: 1.75rem; padding: 0.26rem 0.68rem; border-color: var(--primary-bg); border-radius: 7px; color: var(--primary-fg); background: var(--primary-bg); box-shadow: none; font-size: 0.68rem; font-weight: 700; }
  .search-range-custom-apply:hover { border-color: var(--primary-hover); background: var(--primary-hover); box-shadow: none; }
  .search-error { position: absolute; z-index: 65; left: 0; top: calc(100% + 0.3rem); max-width: 22rem; padding: 0.3rem 0.45rem; border: 1px solid #fecaca; border-radius: var(--radius-sm); background: #fef2f2; color: #991b1b; box-shadow: var(--shadow-md); font-size: 0.66rem; line-height: 1.3; }
  .search-error[hidden] { display: none; }
  #newToggle { flex-shrink: 0; font-weight: 700; color: var(--primary-fg); border-color: var(--primary-bg); background: var(--primary-bg); box-shadow: var(--shadow-sm); padding: 0.4rem 0.85rem; }
  #newToggle:hover { background: var(--primary-hover); border-color: var(--primary-hover); box-shadow: 0 4px 14px var(--accent-ring); }
  .todohub-toggle { position: relative; width: 2.05rem; height: 2.05rem; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; padding: 0; border-color: transparent; background: transparent; color: var(--ink-3); box-shadow: none; }
  .todohub-toggle:hover, .todohub-toggle[aria-expanded="true"] { border-color: transparent; background: var(--button-hover); color: var(--ink); box-shadow: none; }
  .todohub-toggle[aria-expanded="true"] { background: var(--accent-soft); color: var(--accent); }
  .todohub-toggle svg { width: 1rem; height: 1rem; fill: none; stroke: currentColor; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; }
  .todohub-count { position: absolute; top: -0.28rem; right: -0.28rem; min-width: 1.05rem; height: 1.05rem; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; padding: 0 0.22rem; border: 2px solid var(--surface-2); border-radius: 999px; background: var(--todo-fg); color: var(--surface); font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.54rem; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
  .todohub-count[hidden] { display: none; }
  .theme-toggle { width: 2rem; height: 2rem; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; padding: 0; color: var(--ink-3); background: transparent; border: 0; border-radius: var(--radius); box-shadow: none; }
  .theme-toggle:hover { color: var(--ink); background: var(--button-hover); box-shadow: none; }
  .theme-toggle svg { width: 0.88rem; height: 0.88rem; stroke: currentColor; stroke-width: 1.9; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .theme-toggle .theme-sun { display: none; }
  html[data-theme="dark"] .theme-toggle .theme-sun { display: block; }
  html[data-theme="dark"] .theme-toggle .theme-moon { display: none; }
  .panel-toggle.on { color: var(--accent); background: var(--accent-soft); }
  .panel-toggle svg { fill: none; }
  @container (min-width: 420px) {
    .brand-scope { display: inline-block; flex: 0 1 auto; }
  }
  @container (max-width: 360px) {
    .it-live-label { display: none; }
  }
  .tagbar { padding: 0.7rem 0.95rem; border-bottom: 1px solid var(--line); background: var(--surface); display: flex; flex-direction: column; gap: 0.5rem; }
  .tagbar .taghead { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.5rem; }
  .tagbar .tagttl { font-size: 0.66rem; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; }
  .taghead-label { display: contents; }
  .tagsearchwrap { flex: 0 1 7.5rem; min-width: 5rem; max-width: 8rem; }
  .tagsearchwrap .searchbox { width: 100%; height: 1.25rem; box-sizing: border-box; padding: 0.08rem 1.65rem 0.08rem 0.6rem; border-radius: var(--radius-pill); font-size: 0.65rem; line-height: 1; }
  .tagsearchwrap .search-ico { display: none; }
  .tagsearchwrap .search-clear { right: 0.16rem; width: 0.95rem; height: 0.95rem; font-size: 0.72rem; }
  .tagmode-toggle { appearance: none; align-self: flex-end; min-width: 0; padding: 0.05rem 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; color: var(--ink-4); font-size: 0.61rem; line-height: normal; text-transform: lowercase; cursor: pointer; flex-shrink: 0; white-space: nowrap; }
  .tagmode-toggle:hover { color: var(--ink); background: transparent; box-shadow: none; text-decoration: underline; text-underline-offset: 2px; }
  .tagmode-toggle:focus-visible { outline: 1px solid var(--focus); outline-offset: 2px; }
  .tagorder-toggle { white-space: nowrap; }
  .instant-tip { position: relative; }
  .instant-tip::after { content: attr(data-tooltip); position: absolute; z-index: 80; top: calc(100% + 0.4rem); width: max-content; max-width: min(19rem, calc(100vw - 2rem)); padding: 0.38rem 0.5rem; border: 1px solid var(--tabtip-border); border-radius: var(--radius); background: var(--tabtip-bg); box-shadow: var(--shadow-md); color: var(--ink-2); font-size: 0.67rem; font-weight: 500; line-height: 1.35; text-align: left; text-transform: none; white-space: normal; opacity: 0; visibility: hidden; pointer-events: none; }
  .instant-tip:hover::after, .instant-tip:focus-visible::after { opacity: 1; visibility: visible; }
  .instant-tip-left::after { left: 0; }
  .instant-tip-right::after { right: 0; }
  .hover-tip { position: fixed; z-index: 160; width: max-content; max-width: min(34rem, calc(100vw - 1.5rem)); padding: 0.38rem 0.5rem; border: 1px solid var(--tabtip-border); border-radius: var(--radius); background: var(--tabtip-bg); box-shadow: var(--shadow-md); color: var(--ink-2); font-size: 0.67rem; font-weight: 500; line-height: 1.35; white-space: normal; overflow-wrap: anywhere; pointer-events: none; opacity: 0; transform: translateY(3px); transition: opacity 0.08s ease, transform 0.08s ease; }
  .hover-tip[hidden] { display: none; }
  .hover-tip.show { opacity: 1; transform: translateY(0); }
  .viewrow { display: flex; align-items: center; }
  .viewtabs { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
  .viewtab { font-size: 0.68rem; color: var(--ink-3); padding: 0.16rem 0.58rem; border-radius: var(--radius-pill); box-shadow: none; background: var(--surface); border: 1px solid var(--line-2); }
  .viewtab:hover { color: var(--ink); background: var(--button-hover); }
  .viewtab.on { color: #3730a3; background: #eef2ff; border-color: #a5b4fc; box-shadow: 0 0 0 1px rgba(165,180,252,0.56); }
  .viewtabcount { margin-left: 0.32rem; font-size: 0.58rem; font-weight: 650; line-height: 1; opacity: 0.58; font-variant-numeric: tabular-nums; }
  .bulkarchive { align-self: flex-end; flex-shrink: 0; min-width: 0; font-size: 0.62rem; font-weight: 740; color: #be123c; padding: 0.05rem 0; border: 0; background: transparent; box-shadow: none; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; margin-left: auto; }
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
  .tagchips { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; }
  .tagempty { font-size: 0.72rem; color: var(--ink-4); }
  .gtag { display: inline-flex; align-items: stretch; min-height: 1.35rem; border: 1px solid var(--line-2); border-radius: var(--radius-pill); overflow: hidden; background: var(--surface); box-shadow: var(--shadow-sm); transition: box-shadow 0.15s, transform 0.05s; }
  .gtag:hover { box-shadow: var(--shadow-md); }
  .gtag[draggable="true"] { cursor: grab; }
  .gtag[draggable="true"]:active { cursor: grabbing; }
  .gtag.dragging { opacity: 0.38; }
  .gtag.drag-layout-source { position: absolute; visibility: hidden; pointer-events: none; }
  #tagFilters .tag-drag-placeholder { box-sizing: border-box; pointer-events: none; border: 1px dashed var(--accent); background: transparent; opacity: 0.55; box-shadow: none; }
  #tagFilters .tag-drag-placeholder .gtagbtn { color: var(--accent); white-space: nowrap; }
  .tag-pin-empty { display: inline-flex; align-items: center; padding: 0.18rem 0.3rem; border: 0; border-radius: 4px; color: var(--ink-4); background: transparent; box-shadow: none; font-size: 0.62rem; line-height: 1; white-space: nowrap; user-select: none; }
  .tag-pin-empty.drag-over { display: none; }
  .tag-pin-divider { position: relative; flex: 0 0 0.7rem; align-self: stretch; min-height: 1.35rem; }
  .tag-pin-divider::before { content: ''; position: absolute; top: 0.08rem; bottom: 0.08rem; left: 50%; width: 1px; border-radius: 1px; background: var(--ink-3); opacity: 0.82; transform: translateX(-50%); transition: width 0.15s, background 0.15s, box-shadow 0.15s; }
  .tag-hidden-divider { flex: 1 0 100%; min-width: 0; display: grid; grid-template-columns: minmax(1rem, 1fr) auto minmax(1rem, 1fr); align-items: center; gap: 0.5rem; min-height: 1rem; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; color: var(--ink-4); font-size: 0.58rem; line-height: 1; letter-spacing: 0.04em; text-transform: uppercase; }
  .tag-hidden-divider::before, .tag-hidden-divider::after { content: ''; height: 1px; background: var(--line); transition: height 0.12s, background 0.12s, box-shadow 0.12s; }
  .tag-hidden-divider:hover { border: 0; background: transparent; color: var(--ink-2); box-shadow: none; }
  .tag-hidden-divider:hover::before, .tag-hidden-divider:hover::after { background: var(--line-2); }
  .tag-hidden-divider[aria-expanded="true"] { color: var(--ink-3); }
  .tag-hidden-divider.drag-over { border: 0; background: transparent; color: var(--accent); box-shadow: none; }
  .tag-hidden-divider.drag-over::before, .tag-hidden-divider.drag-over::after { height: 2px; background: var(--accent); box-shadow: 0 0 0 2px var(--accent-ring); }
  .tag-hidden-shelf { flex: 1 0 100%; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; padding: 0.02rem 0 0.08rem; }
  .gtag.on { border-color: #0f766e; background: #ccfbf1; box-shadow: inset 0 0 0 1px #0f766e; }
  .gtagbtn, .gtagdel { border: 0; border-radius: 0; font-size: 0.7rem; background: transparent; padding: 0.18rem 0.55rem; box-shadow: none; }
  .gtagbtn { color: #0f172a; display: inline-flex; align-items: center; }
  .gtagcount { margin-left: 0.32rem; font-size: 0.58rem; font-weight: 650; line-height: 1; opacity: 0.58; font-variant-numeric: tabular-nums; }
  .gtag.deletable .gtagbtn { padding-right: 0.18rem; }
  .gtag.on .gtagbtn { background: transparent; color: #115e59; }
  .gtagdel { color: var(--ink-4); padding: 0.18rem 0.4rem 0.18rem 0.24rem; margin-left: 0; }
  .gtag.on.deletable .gtagbtn { border-right: 1px solid rgba(15,118,110,0.24); }
  .gtagdel:hover { background: #fef2f2; color: #b91c1c; }
  .gtag.auto .gtagbtn { font-weight: 600; }
  .prioritytag { position: relative; overflow: visible; }
  .prioritytag .gtagbtn::after { content: '⌄'; margin-left: 0.32rem; font-size: 0.62rem; opacity: 0.66; }
  .prioritytagmenu { position: absolute; z-index: 55; top: calc(100% + 5px); left: 0; min-width: 7.25rem; padding: 0.3rem; border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-pop); }
  .prioritytagopt { display: flex; align-items: center; gap: 0.45rem; width: 100%; padding: 0.32rem 0.48rem; border: 0; border-radius: var(--radius-sm); background: transparent; box-shadow: none; color: var(--ink-2); font-size: 0.72rem; text-align: left; }
  .prioritytagopt:hover { background: var(--button-hover); }
  .prioritytagopt input { margin: 0; pointer-events: none; }
  .prioritytagopt .prilabel { margin-left: 0.05rem; cursor: default; }
  /* "untagged" is a system filter, not a user tag: the dashed empty-slot
     treatment keeps it useful without competing with the colored taxonomy. */
  .gtag.untagged { border-style: dashed; background: transparent; box-shadow: none; }
  .gtag.untagged .gtagbtn { color: var(--ink-3); font-weight: 500; }
  .gtag.untagged:hover { background: var(--button-hover); box-shadow: none; }
  .gtag.untagged.on { border-style: solid; border-color: #475569; background: #475569; box-shadow: inset 0 0 0 1px #475569; }
  .gtag.untagged.on .gtagbtn { color: #ffffff; }
  /* custom (user) filter tags stay quiet until selected; heat is a soft wash. */
  .gtag:not(.auto):not(.on) { border-style: solid; border-color: var(--line-2); background: transparent; box-shadow: none; }
  .gtag:not(.auto):not(.on) .gtagbtn { color: #0f766e; }
  .gtag:not(.auto):not(.on):hover { background: var(--button-hover); box-shadow: none; }
  .gtag.tag-hidden:not(.on) { border-style: dashed; opacity: 0.74; }
  .gtag.tag-hidden:not(.on):hover { opacity: 1; }
  .gtag.hot:not(.on) { background: linear-gradient(90deg, var(--tag-heat-soft), var(--tag-heat-fade) 58%, transparent); }
  .gtag.hot:not(.on):hover { background: linear-gradient(90deg, var(--tag-heat-soft), var(--tag-heat-fade) 58%, transparent), var(--button-hover); }
  .tagadd-compact { font-size: 0.66rem; border: 1px solid transparent; color: #0f766e; padding: 0.1rem 0.46rem; border-radius: var(--radius-pill); box-shadow: none; background: transparent; }
  .tagadd-compact:hover { background: #f0fdfa; border-color: transparent; }
  .tagcreate-inline { position: relative; flex: 1 1 14rem; min-width: min(14rem, 100%); }
  .tagcreate-inline .tagedit-row { align-items: stretch; }
  .tagcreate-inline .tagedit-input { font-size: 0.74rem; }
  .searchbox { flex: 1; min-width: 0; font-size: 0.8rem; padding: 0.5rem calc(var(--search-range-width) + 0.4rem) 0.5rem 2.1rem; border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--input-bg); color: var(--ink-2); }
  .topnav .searchwrap.filtering .searchbox { padding-right: calc(var(--search-range-width) + 1.65rem); }
  .searchbox.filtering { border-color: var(--warning); background: var(--warning-soft); box-shadow: 0 0 0 1px var(--warning-ring); }
  .searchbox.filtering:focus { border-color: var(--warning); box-shadow: 0 0 0 3px var(--warning-ring); }
  .searchwrap.filtering .search-ico { stroke: var(--warning); }
  @container (max-width: 280px) {
    .topnav .searchwrap { --search-range-width: 1.85rem; }
    .topnav .search-range-text { display: none; }
    .topnav .search-range-button { padding: 0; }
    .topnav .search-range-button svg { width: 0.72rem; height: 0.72rem; }
    .topnav .search-range-button .search-range-clock { display: block; }
    .topnav .search-range-button .search-range-chevron { display: none; }
  }
  .newsession-anchor { position: relative; z-index: 70; }
  .side.newsession-panel-active { z-index: 70; }
  .newbox { position: absolute; z-index: 70; top: calc(100% + 0.4rem); left: 1rem; right: 1rem; max-height: calc(100dvh - 8rem); overflow-y: auto; padding: 0.9rem; border: 1px solid var(--line-2); border-radius: var(--radius); display: none; flex-direction: column; gap: 0.6rem; background: var(--newbox-gradient); box-shadow: var(--shadow-pop); }
  .newbox.panel-hosted { position: fixed; right: auto; max-width: 36rem; }
  .newbox.open { display: flex; animation: newboxIn 0.18s ease; }
  .todohub-box { position: absolute; z-index: 70; top: calc(100% + 0.4rem); left: 1rem; right: 1rem; max-height: calc(100dvh - 8rem); overflow: hidden; padding: 0.75rem; border: 1px solid var(--line-2); border-radius: var(--radius); display: none; flex-direction: column; gap: 0.55rem; background: var(--newbox-gradient); box-shadow: var(--shadow-pop); }
  .todohub-box.panel-hosted { position: fixed; right: auto; width: min(32rem, calc(100vw - 1rem)); max-width: 32rem; }
  .todohub-box.open { display: flex; animation: newboxIn 0.18s ease; }
  .todohub-add { display: flex; align-items: stretch; gap: 0.38rem; }
  .todohub-add input { flex: 1; min-width: 0; padding: 0.45rem 0.58rem; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--input-bg); color: var(--ink-2); font: inherit; font-size: 0.76rem; }
  .todohub-add button { flex-shrink: 0; min-width: 3.3rem; border-color: var(--primary-bg); background: var(--primary-bg); color: var(--primary-fg); font-size: 0.7rem; font-weight: 700; }
  .todohub-add button:hover:not(:disabled) { border-color: var(--primary-hover); background: var(--primary-hover); }
  .todohub-add button:disabled { opacity: 0.48; }
  .todohub-body { flex: 1 1 auto; min-height: 5rem; overflow-y: auto; overscroll-behavior: contain; margin: 0 -0.25rem -0.2rem; padding: 0 0.25rem 0.2rem; }
  .todohub-items { display: flex; flex-direction: column; gap: 0.14rem; }
  .todohub-item { display: grid; grid-template-columns: 1.15rem minmax(0,1fr) auto; align-items: start; gap: 0.4rem; padding: 0.42rem 0.38rem; border: 1px solid transparent; border-radius: 8px; }
  .todohub-item:hover, .todohub-item:focus-within { border-color: color-mix(in srgb, var(--line-2) 72%, transparent); background: color-mix(in srgb, var(--surface) 76%, transparent); }
  .todohub-item.done { opacity: 0.68; }
  .rail-todo-check.todohub-check { margin: 0.13rem 0 0; }
  .todohub-content { min-width: 0; }
  .todohub-text { width: 100%; display: -webkit-box; overflow: hidden; padding: 0; border: 0; background: transparent; color: var(--ink-2); box-shadow: none; text-align: left; font-size: 0.75rem; line-height: 1.38; word-break: break-word; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .todohub-text:hover { border: 0; background: transparent; color: var(--ink); box-shadow: none; }
  .todohub-item.done .todohub-text { color: var(--ink-4); text-decoration: line-through; }
  .todohub-meta { min-width: 0; display: flex; align-items: center; gap: 0.28rem; margin-top: 0.18rem; color: var(--ink-4); font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.59rem; }
  .todohub-scope { max-width: 100%; overflow: hidden; padding: 0; border: 0; background: transparent; color: var(--ink-4); box-shadow: none; text-overflow: ellipsis; white-space: nowrap; }
  .todohub-scope:hover { border: 0; background: transparent; color: var(--accent); box-shadow: none; }
  .todohub-actions { display: flex; align-items: center; gap: 0.04rem; opacity: 0; transition: opacity 0.12s; }
  .todohub-item:hover .todohub-actions, .todohub-item:focus-within .todohub-actions { opacity: 1; }
  .todohub-edit { grid-column: 2 / 4; display: flex; align-items: center; gap: 0.35rem; }
  .todohub-edit input { flex: 1; min-width: 0; padding: 0.36rem 0.5rem; border: 1px solid var(--accent); border-radius: var(--radius-sm); background: var(--input-bg); color: var(--ink); font: inherit; font-size: 0.74rem; }
  .todohub-edit button { min-height: 1.75rem; padding: 0.25rem 0.52rem; font-size: 0.65rem; }
  .todohub-empty { padding: 1.2rem 0.6rem; color: var(--ink-4); font-size: 0.72rem; line-height: 1.45; text-align: center; }
  .todohub-completed-row { display: flex; align-items: center; gap: 0.28rem; margin-top: 0.32rem; }
  .todohub-completed { flex: 1; min-width: 0; padding: 0.34rem 0.42rem; border: 0; background: transparent; color: var(--ink-4); box-shadow: none; text-align: left; font-size: 0.65rem; font-weight: 650; }
  .todohub-completed:hover { border: 0; background: var(--button-hover); color: var(--ink-2); box-shadow: none; }
  .todohub-clear-completed { flex-shrink: 0; padding: 0.26rem 0.42rem; border: 0; background: transparent; color: var(--ink-4); box-shadow: none; font-size: 0.62rem; font-weight: 650; }
  .todohub-clear-completed:hover { border: 0; background: var(--button-hover); color: var(--danger); box-shadow: none; }
  @media (max-width: 760px), (hover: none) {
    .todohub-actions { opacity: 1; }
  }
  @keyframes newboxIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .newbox input, .newbox textarea, .newbox select { font-size: 0.8rem; padding: 0.4rem 0.55rem; border: 1px solid var(--line-2); border-radius: var(--radius-sm); width: 100%; box-sizing: border-box; background-color: var(--surface); color: var(--ink-2); }
  .newbox textarea { resize: none; min-height: 2.4rem; font: inherit; font-size: 0.8rem; }
  .newattach { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.35rem; margin: -0.35rem; border: 1px dashed transparent; border-radius: var(--radius); transition: border-color 0.15s, background 0.15s, box-shadow 0.15s; }
  .newattach.drop { border-color: #818cf8; background: var(--drop-bg); box-shadow: 0 0 0 4px rgba(99,102,241,0.12); }
  /* the row is the input surface (border + fill) so the transparent textarea can float over the
     shortcut-completion ghost behind it — mirrors .composer-surface / transparent composer textarea */
  .newmsgrow { position: relative; display: flex; align-items: stretch; min-height: 3.85rem; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--surface); transition: border-color 0.15s, box-shadow 0.15s; }
  .newmsgrow:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
  .newmsgrow textarea { position: relative; z-index: 1; flex: 1; min-width: 0; height: 3.85rem; min-height: 3.85rem; padding: 0.4rem 0.55rem 1.78rem; line-height: 1.4; border: 0; background: transparent; }
  .newmsgrow textarea:focus { box-shadow: none; }
  .newmsg-shortcut-ghost { padding: 0.4rem 0.55rem 1.78rem; font-size: 0.8rem; line-height: 1.4; }
  .newmsgrow .attachtray, .newmsgrow .attachmsg { position: absolute; z-index: 1; left: 0.55rem; right: 6.35rem; bottom: 0.34rem; min-width: 0; max-width: none; }
  .newmsgrow .attachtray { flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
  .newmsgrow .attachtray::-webkit-scrollbar { display: none; }
  .newmsgrow .attachmsg { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; }
  .newmsgactions { position: absolute; z-index: 2; right: 0.35rem; bottom: 0.24rem; display: flex; align-items: center; gap: 0.24rem; }
  .newmsgactions .attachpick { position: static; transform: none; flex-shrink: 0; }
  .newmsgactions .attachpick:active { transform: translateY(0.5px); }
  .newmsgactions .goal-toggle { min-height: 1.5rem; }
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
  .newrow .pickgrp.effort, .newrow .pickgrp.speed { max-width: 8.25rem; }
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
  .chooser-drop { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 50; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow-pop); padding: 0.25rem; max-height: 15rem; overflow-y: auto; }
  .chooser-drop.dir-portal { position: fixed; z-index: 90; right: auto; top: auto; }
  /* New Session's config controls can become very narrow with a resized sidebar.
     Config menus live at the viewport level so width and clipping are independent
     from the form, while using the same floating surface as the composer rail. */
  .configmenu { position: fixed; z-index: 90; right: auto; bottom: auto; box-sizing: border-box; min-height: 0; max-height: min(38vh, 18rem); overflow-y: auto; padding: 0.3rem; border: 1px solid color-mix(in srgb, var(--line-2) 72%, transparent); border-radius: 10px; background: color-mix(in srgb, var(--surface) 96%, transparent); color: var(--ink); box-shadow: var(--shadow-pop); backdrop-filter: blur(12px) saturate(1.08); }
  .chooser-drop[hidden], .selectmenu[hidden] { display: none; }
  .chooser-opt { display: flex; flex-direction: column; gap: 0.12rem; padding: 0.38rem 0.5rem; cursor: pointer; color: var(--ink-2); }
  .chooser-opt { border-radius: 0; }
  .selectopt { width: 100%; min-height: 1.9rem; display: flex; align-items: center; gap: 0.4rem; box-sizing: border-box; padding: 0.32rem 0.48rem; border: 0; border-radius: 6px; background: transparent; color: var(--ink-2); box-shadow: none; cursor: pointer; font-size: 0.73rem; line-height: 1.3; }
  .selectopt + .selectopt { margin-top: 0.05rem; }
  .selectopt-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .selectopt-check { flex-shrink: 0; color: var(--accent); font-size: 0.7rem; font-weight: 800; line-height: 1; }
  .selectopt[aria-selected="true"] { color: var(--ink); background: var(--accent-soft); font-weight: 600; }
  .chooser-opt:hover, .chooser-opt.on { background: var(--accent-soft); }
  .selectopt:hover, .selectopt.on { background: color-mix(in srgb, var(--surface-2) 78%, transparent); color: var(--ink); }
  .selectopt[aria-selected="true"]:hover, .selectopt[aria-selected="true"].on { background: var(--accent-soft); }
  .chooser-opt:hover .chooser-opt-label, .chooser-opt.on .chooser-opt-label { color: inherit; }
  .chooser-opt:hover .chooser-opt-meta, .chooser-opt.on .chooser-opt-meta { color: inherit; opacity: 0.76; }
  .chooser-opt.unavailable { cursor: not-allowed; opacity: 0.68; }
  .chooser-opt.unavailable:hover, .chooser-opt.unavailable.on { background: var(--warning-soft); }
  .chooser-opt.unavailable .chooser-opt-meta { white-space: normal; line-height: 1.35; }
  .chooser-opt.unavailable .chooser-opt-note { color: var(--warning); background: var(--warning-soft); }
  .chooser-opt-line { display: flex; align-items: center; gap: 0.38rem; min-width: 0; }
  .chooser-opt-label { font-size: 0.78rem; color: inherit; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chooser-opt-meta { font-size: 0.68rem; color: inherit; opacity: 0.72; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chooser-opt-note { flex-shrink: 0; font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #0f766e; background: #ccfbf1; border-radius: 3px; padding: 0.04rem 0.34rem; }
  .chooser-empty { padding: 0.45rem 0.5rem; font-size: 0.74rem; color: var(--ink-4); }
  .vendor-portal .chooser-opt { min-height: 1.9rem; justify-content: center; padding: 0.32rem 0.48rem; border-radius: 6px; }
  .vendor-portal .chooser-opt + .chooser-opt { margin-top: 0.05rem; }
  .vendor-portal .chooser-opt-line { width: 100%; }
  .vendor-portal .chooser-opt-label { flex: 1; font-size: 0.73rem; }
  .chooser-vendor-mark { width: 0.46rem; height: 0.46rem; flex-shrink: 0; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 18%, transparent); }
  .vendor-portal .chooser-opt:hover, .vendor-portal .chooser-opt.on { background: color-mix(in srgb, var(--surface-2) 78%, transparent); }
  .vendor-portal .chooser-opt.selected, .vendor-portal .chooser-opt.selected:hover, .vendor-portal .chooser-opt.selected.on { background: var(--accent-soft); }
  .vendor-portal .chooser-opt.unavailable:hover, .vendor-portal .chooser-opt.unavailable.on { background: var(--warning-soft); }
  .newactions { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 0.65rem; min-height: 2rem; }
  .newaction-end { display: flex; align-items: center; flex-shrink: 0; }
  .newtagpick { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 0.3rem; }
  .newtags { display: contents; }
  .newtagchip { display: inline-flex; align-items: center; gap: 0.15rem; max-width: 8rem; padding: 0.12rem 0.2rem 0.12rem 0.48rem; border: 1px solid rgba(13,148,136,0.35); border-radius: var(--radius-pill); color: #0f766e; background: var(--surface); font-size: 0.68rem; }
  .newtagchip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .newtagchip button { width: 1rem; height: 1rem; padding: 0; border: 0; border-radius: 50%; background: transparent; box-shadow: none; color: currentColor; line-height: 1; }
  .newtagadd { padding: 0.18rem 0.45rem; border-color: transparent; background: transparent; box-shadow: none; color: #0f766e; font-size: 0.7rem; }
  .newtagadd:hover { border-color: transparent; background: var(--button-hover); }
  .newtagmenu { position: absolute; z-index: 75; left: 0; bottom: calc(100% + 0.35rem); width: min(16rem, calc(100vw - 4rem)); padding: 0.35rem; border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-pop); }
  .newtagmenu[hidden] { display: none; }
  .newtagmenu input { margin-bottom: 0.3rem; }
  .newtagsug { max-height: 9rem; overflow-y: auto; }
  .newtagopt { width: 100%; display: flex; align-items: center; gap: 0.4rem; padding: 0.32rem 0.45rem; border: 0; background: transparent; box-shadow: none; text-align: left; font-size: 0.72rem; }
  .newtagopt:hover, .newtagopt.on { background: var(--accent-soft); }
  .sessiontag-popover { position: fixed; z-index: 110; width: min(17rem, calc(100vw - 1rem)); padding: 0.35rem; border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-pop); }
  .sessiontag-popover[hidden] { display: none; }
  .sessiontag-search { position: relative; }
  .sessiontag-input { display: block; width: 100%; min-width: 0; padding: 0.38rem 2rem 0.38rem 0.58rem; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--input-bg); color: var(--ink-2); font-size: 0.74rem; }
  .sessiontag-close { position: absolute; z-index: 1; top: 50%; right: 0.24rem; transform: translateY(-50%); }
  .sessiontag-close:active { transform: translateY(calc(-50% + 0.5px)); }
  .sessiontag-list { max-height: 13rem; margin-top: 0.3rem; overflow-y: auto; }
  .sessiontag-option { width: 100%; display: flex; align-items: center; gap: 0.4rem; padding: 0.34rem 0.45rem; border: 0; border-radius: var(--radius-sm); background: transparent; box-shadow: none; color: var(--ink-2); text-align: left; font-size: 0.74rem; }
  .sessiontag-option:hover, .sessiontag-option.on { background: var(--accent-soft); color: #3730a3; }
  .sessiontag-option.selected { color: #0f766e; }
  .sessiontag-option.selected:hover, .sessiontag-option.selected.on { background: color-mix(in srgb, #14b8a6 14%, transparent); color: #0f766e; }
  .sessiontag-check { width: 1rem; flex-shrink: 0; color: currentColor; font-weight: 800; text-align: center; }
  .newbox .nmsg { font-size: 0.72rem; color: var(--ink-4); }
  .newbox .nmsg:empty { display: none; }
  .newbox .nmsg.provider-error-host { color: inherit; }
  .newbox .nmsg .provider-error-card { max-width: none; padding: 0.7rem 0.75rem; border: 1px solid #fecaca; border-radius: var(--radius); background: #fef2f2; color: #991b1b; }
  .modelwarn { padding: 0.42rem 0.55rem; border: 1px solid var(--warning); border-radius: var(--radius-sm); background: var(--warning-soft); color: var(--warning); font-size: 0.7rem; line-height: 1.4; }
  .modelwarn[hidden] { display: none; }
  .nbtn-primary { flex: 0 0 auto; width: auto; min-width: 7.75rem; color: var(--primary-fg); background: var(--primary-bg); border-color: var(--primary-bg); box-shadow: var(--shadow-sm); }
  .nbtn-primary:hover:not(:disabled) { background: var(--primary-hover); border-color: var(--primary-hover); box-shadow: 0 4px 14px var(--accent-ring); }
  #list { overflow-y: auto; flex: 1; padding: 0.3rem 0; }
  #list.virtualized { overflow-anchor: none; contain: strict; }
  #list > .session-pin-divider { position: relative; height: 13px; pointer-events: none; }
  #list > .session-pin-divider::after { content: ""; position: absolute; top: 6px; left: 0.95rem; right: 0.95rem; height: 1px; background: var(--line-2); }
  .sidebar-spacer { width: 1px; height: 0; pointer-events: none; }
  #list .empty { padding: 1.2rem 0.9rem; color: var(--ink-4); font-size: 0.8rem; text-align: center; }
  .session-panel { width: 660px; flex: 0 0 auto; overflow-y: auto; background: var(--surface-2); border-right: 1px solid var(--line); }
  .session-panel[hidden], .session-panel-resizer[hidden] { display: none; }
  .session-panel-list { min-height: 100%; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); align-content: start; align-items: start; gap: 0.55rem; padding: 0.55rem; }
  .session-panel-list.virtualized { display: block; min-height: 0; padding: 0; overflow-anchor: none; contain: layout style; }
  .session-panel-virtual-spacer { width: 100%; height: 0; pointer-events: none; }
  .session-panel-virtual-row { width: 100%; display: grid; grid-template-columns: repeat(var(--session-panel-columns, 1), minmax(0, 1fr)); align-items: start; gap: 0.55rem; padding: 0.55rem 0.55rem 0; box-sizing: border-box; }
  .session-panel-virtual-divider { position: relative; width: 100%; height: 13px; pointer-events: none; }
  .session-panel-virtual-divider::after { content: ""; position: absolute; top: 6px; left: 0.55rem; right: 0.55rem; height: 1px; background: var(--line-2); }
  .session-panel-list .empty { grid-column: 1 / -1; padding: 1.2rem 0.9rem; color: var(--ink-4); font-size: 0.8rem; text-align: center; }
  .session-panel-list > .session-pin-divider { grid-column: 1 / -1; width: 100%; height: 1px; background: var(--line-2); pointer-events: none; }
  .session-panel .item { min-width: 0; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); content-visibility: auto; contain-intrinsic-size: auto 9rem; }
  .session-panel .item.tag-editing { z-index: 45; content-visibility: visible; }
  .session-panel .item.tag-editing .tagsug { z-index: 80; }
  .session-panel .item.avoidance { border-left: 3px solid #f59e0b; }
  .session-panel .item:hover { background: var(--item-hover); }
  .session-panel .item.active {
    background: linear-gradient(135deg, var(--item-selected-card-start), var(--item-selected-card-mid) 58%, var(--item-selected-card-end));
    box-shadow: inset 0 0 0 2px var(--item-selected-card-ring), 0 8px 18px -13px var(--item-selected-shadow);
  }
  .session-panel .item.session-status-generating { border-color: var(--status-generating); }
  .session-panel .item.session-status-unread { border-color: var(--status-unread); }
  .session-panel-resizer { width: 6px; flex-shrink: 0; cursor: col-resize; background: transparent; transition: background 0.15s; }
  .session-panel-resizer:hover, .session-panel-resizer.dragging { background: var(--resizer-hover); }
  .item { position: relative; padding: 0.6rem 0.95rem; border-bottom: 1px solid var(--row-line); cursor: pointer; border-left: 3px solid transparent; transition: background 0.12s, border-color 0.12s; }
  .item:hover { background: var(--item-hover); }
  .item.active {
    background: linear-gradient(90deg, var(--item-selected-row-start), var(--item-selected-row-end));
    box-shadow: inset 3px 0 0 var(--item-selected-marker), inset 0 0 0 1px var(--item-selected-row-ring);
  }
  .item.avoidance { border-left-color: #f59e0b; }
  .session-read-progress { position: absolute; z-index: 2; right: 0; bottom: 0; width: 3px; min-height: 2px; border-radius: 3px 0 0 3px; background: var(--status-unread); opacity: 0.82; pointer-events: none; }
  .session-read-progress[hidden] { display: none; }
  .it-titlerow { display: flex; align-items: center; gap: 0.45rem; }
  .it-title { font-size: 0.84rem; font-weight: 600; color: var(--ink); letter-spacing: -0.005em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
  .session-title { display: flex; align-items: baseline; gap: 0.4rem; min-width: 0; overflow: hidden; white-space: nowrap; }
  .session-title-main { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .session-title:not(.has-aux) .session-title-main { flex: 1 1 auto; }
  .session-title.has-aux .session-title-main { flex: 0 1 auto; max-width: 68%; }
  .session-title-aux { flex: 1 1 auto; min-width: 2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.78em; font-weight: 600; color: var(--ink-4); letter-spacing: 0; }
  .it-title.session-title.has-aux .session-title-main { max-width: 62%; }
  .it-age { flex-shrink: 0; font-size: 0.62rem; color: #9ca3af; font-family: ui-monospace, monospace; letter-spacing: -0.025em; white-space: nowrap; }
  .it-pin { flex-shrink: 0; width: 1.35rem; height: 1.35rem; display: inline-flex; align-items: center; justify-content: center; margin: -0.2rem -0.28rem -0.2rem -0.28rem; padding: 0; border: 0; border-radius: 4px; background: transparent; box-shadow: none; color: var(--ink-4); opacity: 0.62; transform: none; }
  .it-pin:hover { color: var(--accent); background: var(--accent-soft); box-shadow: none; opacity: 1; transform: none; }
  .it-pin svg { width: 0.72rem; height: 0.72rem; stroke: currentColor; stroke-width: 1.7; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .it-pin.on { color: var(--accent); opacity: 1; }
  .it-pin.on svg { fill: currentColor; }
  .prompt-line.with-tail { display: flex; align-items: baseline; min-width: 0; }
  .prompt-line.with-tail .prompt-line-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .it-queue { flex-shrink: 0; display: inline-flex; align-items: baseline; gap: 0.18rem; margin-left: auto; padding: 0.04rem 0.3rem; border-radius: var(--radius-pill); background: #eef2ff; color: #4f46e5; font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.58rem; line-height: 1.15; font-variant-numeric: tabular-nums; }
  .it-queue[hidden] { display: none; }
  .it-queue-label { font-weight: 680; opacity: 0.76; }
  .it-queue-count { font-weight: 820; }
  .it-queue.parked { background: #fffbeb; color: #b45309; }
  .it-workbadges { flex-shrink: 0; display: inline-flex; align-items: baseline; gap: 0.28rem; margin-left: auto; }
  .it-workbadges .it-queue { margin-left: 0; }
  .it-todo { flex-shrink: 0; display: inline-flex; align-items: baseline; gap: 0.18rem; padding: 0.04rem 0.3rem; border: 1px solid var(--todo-border); border-radius: var(--radius-pill); background: var(--todo-bg); color: var(--todo-fg); font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.58rem; line-height: 1.15; font-variant-numeric: tabular-nums; }
  .it-todo[hidden] { display: none; }
  .it-todo-count { font-weight: 820; }
  .it-todo-label { font-weight: 680; opacity: 0.76; }
  .it-comment { flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.16rem; min-height: 1.12rem; padding: 0.08rem 0.28rem; border: 0; border-radius: var(--radius-pill); background: transparent; color: var(--status-seen); font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.6rem; font-weight: 720; line-height: 1; letter-spacing: 0.01em; font-variant-numeric: tabular-nums; white-space: nowrap; box-shadow: none; cursor: pointer; transition: color 0.12s, background 0.12s; }
  .it-comment[hidden] { display: none; }
  .comment-action-icon { width: 0.72rem; height: 0.72rem; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
  .comment-action-spinner { width: 0.58rem; height: 0.58rem; flex-shrink: 0; box-sizing: border-box; border: 1.4px solid var(--status-generating-soft); border-top-color: currentColor; border-right-color: currentColor; border-radius: 50%; animation: statusSpin 0.82s linear infinite; }
  /* A read comment still exists and remains actionable: use the breathing light's
     blue tracked/seen state, not the gray archived/read state. */
  .it-comment.read { color: var(--status-seen); }
  .it-comment.unread { color: var(--status-unread); }
  .it-comment.generating { color: var(--status-generating); }
  .it-comment:hover, .it-comment:focus-visible { color: var(--status-seen); background: var(--status-seen-soft); outline: none; }
  .it-comment.unread:hover, .it-comment.unread:focus-visible { color: var(--status-unread); background: var(--status-unread-soft); }
  .it-comment.generating:hover, .it-comment.generating:focus-visible { color: var(--status-generating); background: var(--status-generating-soft); }
  .it-comment-count { font-weight: 820; }
  .forktree-trigger { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; color: var(--ink-4); box-shadow: none; }
  .forktree-trigger:hover { color: var(--accent); background: transparent; }
  .forktree-trigger[hidden] { display: none; }
  .it-forktree { width: 2rem; height: 1.3rem; border-radius: 4px; }
  .forktree-mini { width: 1.65rem; height: 0.9rem; overflow: visible; }
  .forktree-mini path { fill: none; stroke: currentColor; stroke-width: 1.15; stroke-linecap: round; stroke-linejoin: round; opacity: 0.58; }
  .forktree-mini circle { fill: currentColor; opacity: 0.72; }
  .forktree-mini circle.current { fill: var(--ink); opacity: 1; stroke: var(--surface); stroke-width: 1.2; }
  .it-status { flex-shrink: 0; width: 0.58rem; height: 0.58rem; border-radius: 50%; border: 1.5px solid transparent; background: var(--status-read); cursor: pointer; transition: transform 0.1s, background 0.15s, border-color 0.15s, box-shadow 0.15s; }
  .it-status:hover { transform: scale(1.45); }
  .it-status.generating { background: transparent; border-color: var(--status-generating-soft); border-top-color: var(--status-generating); border-right-color: var(--status-generating); box-shadow: 0 0 0 2px var(--status-generating-soft); animation: statusSpin 0.82s linear infinite; }
  .it-status.unread { background: var(--status-unread); border-color: var(--status-unread); box-shadow: 0 0 0 3px var(--status-unread-soft), 0 0 12px var(--status-unread-soft); }
  /* seen = you opened it but haven't replied: calm sky hollow ring = still open. */
  .it-status.seen { background: transparent; border-color: var(--status-seen); box-shadow: none; }
  .it-status.read { background: var(--status-read); border-color: transparent; box-shadow: none; opacity: 0.72; }
  .it-live { flex-shrink: 0; min-width: 0; display: inline-flex; align-items: center; gap: 0.32rem; overflow: hidden; white-space: nowrap; font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.62rem; font-variant-numeric: tabular-nums; }
  .it-live[hidden] { display: none; }
  .it-live-total { color: var(--status-generating); font-weight: 750; }
  .it-live.generated .it-live-total { color: var(--status-unread); }
  .it-live.stopped .it-live-total { color: #b45309; }
  .it-live.failed .it-live-total { color: #dc2626; }
  .it-live-label { margin-right: 0.22rem; }
  .analysis-pending { color: var(--ink-4); font-size: 0.66rem; font-style: italic; }
  .it-live-sep { color: var(--ink-4); opacity: 0.72; }
  .it-live-quiet { color: var(--ink-3); font-weight: 650; transition: color 0.15s; }
  .it-live-quiet.warm { color: #b45309; }
  .it-live-quiet.hot { color: #dc2626; font-weight: 750; }
  .it-firstline { font-size: 0.72rem; color: var(--ink-3); margin-top: 0.1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .prompt-line-label { color: var(--ink-4); font-weight: 700; }
  .prompt-line-latest ~ .prompt-line-text, .prompt-line-draft ~ .prompt-line-text { font-style: italic; }
  .draft-edit { display: inline-flex; align-items: center; justify-content: center; vertical-align: -0.12rem; width: 1rem; height: 1rem; margin: 0 0.18rem 0 0; padding: 0; border: 0; border-radius: 3px; background: transparent; color: #dc2626; box-shadow: none; }
  .draft-edit svg { width: 0.72rem; height: 0.72rem; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .draft-edit:hover { color: #b91c1c; background: var(--danger-soft); box-shadow: none; }
  .it-searchhit { font-size: 0.72rem; color: #4338ca; margin-top: 0.12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .it-meta { font-size: 0.7rem; color: #6b7280; margin-top: 0.2rem; font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem; }
  .it-footrow { margin-top: 0.4rem; display: flex; align-items: center; gap: 0.45rem; min-width: 0; }
  .it-tags { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; }
  .it-tag { display: inline-flex; align-items: center; gap: 0.24rem; font-size: 0.66rem; color: #115e59; background: #ccfbf1; border: 1px solid #99f6e4; border-radius: var(--radius-pill); padding: 0.1rem 0.46rem; }
  .it-tag.auto { font-weight: 600; }
  /* custom (user) session-row tags: quiet frame, heat is a soft wash. */
  .it-tag:not(.auto) { border-style: solid; border-color: var(--line-2); background: transparent; color: #0f766e; }
  .it-tag.hot:not(.auto) { background: linear-gradient(90deg, var(--tag-heat-soft), var(--tag-heat-fade) 58%, transparent); }
  .it-tag > button { border: 0; background: transparent; color: #0f766e; font-size: 0.78rem; padding: 0; line-height: 1; box-shadow: none; }
  .it-tag > button:hover { color: #b91c1c; background: transparent; }
  .it-tagadd { font-size: 0.66rem; border: 1px solid transparent; color: #0f766e; padding: 0.1rem 0.46rem; border-radius: var(--radius-pill); box-shadow: none; background: transparent; }
  .it-tagadd:hover { background: #f0fdfa; border-color: transparent; }
  .it-context { margin-left: auto; min-width: 0; max-width: 58%; display: inline-flex; align-items: center; justify-content: flex-end; gap: 0.34rem; overflow: hidden; white-space: nowrap; font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.68rem; font-weight: 700; }
  .it-context .ctx-sep { color: var(--ink-4); flex-shrink: 0; opacity: 0.72; }
  .it-context .ctx-prompts { color: var(--ink-4); flex-shrink: 0; }
  .it-context .vtag, .it-context .ptag { padding: 0; border: 0; background: transparent; border-radius: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .it-context .vtag.claude { color: var(--vendor-claude-fg); background: transparent; border-color: transparent; }
  .it-context .vtag.codex { color: var(--vendor-codex-fg); background: transparent; border-color: transparent; }
  .it-context .vtag.cursor { color: var(--vendor-cursor-fg); background: transparent; border-color: transparent; }
  .it-context .ptag { color: var(--project-fg, #64748b); font-weight: 700; }
  /* per-tab tag editor + custom suggestion dropdown (replaces the native datalist) */
  .tagedit { position: relative; margin-top: 0.4rem; }
  .tagedit-row { position: relative; }
  .tagedit-input { display: block; width: 100%; min-width: 0; font-size: 0.74rem; padding: 0.34rem 2rem 0.34rem 0.58rem; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--input-bg); color: var(--ink-2); }
  .edit-cancel { flex-shrink: 0; width: 1.35rem; height: 1.35rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--ink-4); background: transparent; border: 1px solid transparent; border-radius: 999px; box-shadow: none; opacity: 0.72; }
  .edit-cancel:hover { color: var(--ink-2); background: var(--button-hover); border-color: transparent; box-shadow: none; opacity: 1; }
  .edit-cancel svg { width: 0.72rem; height: 0.72rem; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; }
  .tagedit-row > .edit-cancel { position: absolute; z-index: 1; top: 50%; right: 0.24rem; transform: translateY(-50%); }
  .tagedit-row > .edit-cancel:active { transform: translateY(calc(-50% + 0.5px)); }
  .tagsug { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 40; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow-pop); padding: 0.25rem; max-height: 13rem; overflow-y: auto; }
  .tagsug[hidden] { display: none; }
  .tagsug-opt { display: flex; align-items: center; gap: 0.4rem; font-size: 0.76rem; color: var(--ink-2); padding: 0.3rem 0.5rem; border-radius: var(--radius-sm); cursor: pointer; }
  .tagsug-opt:hover, .tagsug-opt.on { background: var(--accent-soft); color: #3730a3; }
  .tag-option-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tag-option-pin { width: 0.72rem; height: 0.72rem; flex-shrink: 0; fill: none; stroke: var(--ink-3); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .tagsug-create { color: var(--ink-3); }
  .tagsug-new { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #0f766e; background: #ccfbf1; border-radius: 3px; padding: 0.04rem 0.34rem; }
  .state { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; min-height: 1.28rem; font-size: 0.68rem; line-height: 1; font-weight: 800; letter-spacing: 0; padding: 0.18rem 0.55rem 0.16rem; border-radius: 7px; background: #f8fafc; color: #475569; border: 1px solid #64748b; font-family: ui-monospace, "Cascadia Mono", monospace; text-decoration: underline; text-underline-offset: 2px; box-shadow: inset 0 0 0 1px rgba(100,116,139,0.16); transition: none; }
  .state.editable { cursor: pointer; }
  .state.editable:hover { filter: brightness(0.96); transform: none; }
  .state.continue_ready { background: #ecfdf5; color: #059669; border-color: #047857; box-shadow: inset 0 0 0 1px rgba(4,120,87,0.18); }
  .state.needs_decision { background: #fff7ed; color: #ea580c; border-color: #c2410c; box-shadow: inset 0 0 0 1px rgba(194,65,12,0.18); }
  .state.needs_input { background: #fffbeb; color: #b45309; border-color: #92400e; box-shadow: inset 0 0 0 1px rgba(146,64,14,0.18); }
  .state.blocked { background: #fef2f2; color: #dc2626; border-color: #b91c1c; box-shadow: inset 0 0 0 1px rgba(185,28,28,0.18); }
  .state.needs_review { background: #ecfdf5; color: #0f766e; border-color: #0f766e; box-shadow: inset 0 0 0 1px rgba(15,118,110,0.18); }
  .state.followup_suggested { background: #eff6ff; color: #0284c7; border-color: #0369a1; box-shadow: inset 0 0 0 1px rgba(3,105,161,0.18); }
  .state.done { background: #f1f5f9; color: #475569; border-color: #64748b; box-shadow: inset 0 0 0 1px rgba(100,116,139,0.18); }
  /* Reason is the current-state explanation, not disposable metadata. Keep it
     quieter than the title, but readable; italic and underline already carry
     latest/draft and editable/manual semantics elsewhere in the row. */
  .it-reason { flex: 1 1 5rem; min-width: 3rem; font-size: 0.68rem; color: var(--ink-3); font-weight: 550; font-style: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .it-title.pending { color: #9ca3af; font-weight: 500; }
  .prilabel { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; min-height: 1.08rem; min-width: 1.7rem; padding: 0.08rem 0.28rem; border-radius: 4px; background: transparent; color: var(--ink-3); cursor: pointer; font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.68rem; line-height: 1; font-weight: 800; letter-spacing: 0; font-variant-numeric: tabular-nums; transition: none; }
  .prilabel.l1 { color: var(--priority-1-fg); background: var(--priority-1-bg); }
  .prilabel.l2 { color: var(--priority-2-fg); background: var(--priority-2-bg); }
  .prilabel.l3 { color: var(--priority-3-fg); background: var(--priority-3-bg); }
  .prilabel.l4 { color: var(--priority-4-fg); background: var(--priority-4-bg); }
  .prilabel.l5 { color: var(--priority-5-fg); background: var(--priority-5-bg); }
  .prilabel:hover { filter: brightness(0.96); transform: none; }
  .b-eta { flex-shrink: 0; color: #b45309; background: #fffbeb; padding: 0.04rem 0.36rem; border-radius: 4px; cursor: pointer; font-variant-numeric: tabular-nums; transition: none; }
  .b-eta:hover { background: #fef3c7; }
  .vtag, .ptag { flex-shrink: 0; display: inline-flex; align-items: center; border-radius: 999px; padding: 0.06rem 0.46rem; font-size: 0.66rem; font-family: ui-sans-serif, -apple-system, "Segoe UI", sans-serif; border: 1px solid transparent; }
  .vtag { font-weight: 700; letter-spacing: 0.01em; }
  .vtag.claude { color: var(--vendor-claude-fg); background: var(--vendor-claude-bg); border-color: var(--vendor-claude-border); }
  .vtag.codex { color: var(--vendor-codex-fg); background: var(--vendor-codex-bg); border-color: var(--vendor-codex-border); }
  .vtag.cursor { color: var(--vendor-cursor-fg); background: var(--vendor-cursor-bg); border-color: var(--vendor-cursor-border); }
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
  #avoidPanel:not([hidden]) { flex: 0 0 auto; }
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
  .main { --composer-overlay-height: 6.5rem; --queue-overlay-height: 0px; --avoid-overlay-height: 0px; --chat-scrollbar-width: 0px; position: relative; flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--surface); }
  .main.session-drop-target { box-shadow: inset 0 0 0 2px var(--accent); }
  .main.session-drop-target::after { content: '↳  Drop to add as chat tab'; position: absolute; z-index: 45; top: 0.72rem; left: 50%; transform: translateX(-50%); pointer-events: none; color: var(--accent); font-size: 0.68rem; font-weight: 650; letter-spacing: 0.015em; white-space: nowrap; }
  .item.session-card-dragging { opacity: 0.52; }
  .chat-tabs { flex: 0 0 auto; min-width: 0; display: flex; align-items: flex-end; gap: 0.2rem; padding: 0.35rem 0.55rem 0; overflow-x: auto; overflow-y: hidden; border-bottom: 1px solid var(--row-line); background: var(--surface-2); scrollbar-width: thin; }
  .chat-tabs[hidden] { display: none; }
  .chat-tab { flex: 0 0 auto; min-width: 7rem; max-width: 14rem; height: 2rem; display: flex; align-items: center; gap: 0.15rem; border: 1px solid transparent; border-bottom: 0; border-radius: 7px 7px 0 0; color: var(--ink-3); background: transparent; }
  .chat-tab:hover { color: var(--ink); background: var(--button-hover); }
  .chat-tab.on { color: var(--ink); border-color: var(--row-line); background: var(--surface); }
  .chat-tab-main { flex: 1; min-width: 0; height: 100%; display: flex; align-items: center; gap: 0.4rem; padding: 0 0.28rem 0 0.55rem; border: 0; border-radius: inherit; color: inherit; background: transparent; box-shadow: none; }
  .chat-tab-main:hover { color: inherit; background: transparent; box-shadow: none; }
  .chat-tab-status { width: 0.48rem; height: 0.48rem; flex-shrink: 0; box-sizing: border-box; border: 1.3px solid transparent; border-radius: 50%; background: var(--status-read); }
  .chat-tab-status.generating { background: transparent; border-color: var(--status-generating-soft); border-top-color: var(--status-generating); border-right-color: var(--status-generating); animation: statusSpin 0.82s linear infinite; }
  .chat-tab-status.unread { background: var(--status-unread); }
  .chat-tab-status.seen { background: transparent; border-color: var(--status-seen); }
  .chat-tab-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.72rem; font-weight: 650; }
  .chat-tab-close { width: 1.35rem; height: 1.35rem; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; margin-right: 0.18rem; padding: 0; border: 0; border-radius: 4px; color: var(--ink-4); background: transparent; box-shadow: none; font-size: 0.92rem; line-height: 1; }
  .chat-tab-close:hover { color: #b91c1c; background: var(--danger-soft); box-shadow: none; }
  .head { padding: 0.6rem 0.95rem; border-bottom: 1px solid var(--row-line); display: flex; justify-content: flex-start; gap: 0.6rem; align-items: center; background: var(--surface); }
  .backbtn { display: none; flex-shrink: 0; color: var(--ink-3); }
  .headmain { min-width: 0; flex: 1; display: flex; flex-direction: column; }
  .headrow { min-width: 0; }
  .head-titlegroup { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 0.22rem; }
  .head-titlegroup .it-title { flex: 0 1 auto; max-width: 100%; }
  .head-titlegroup .title-editing { flex: 1 1 auto; max-width: min(34rem, 100%); }
  .head-actions { flex-shrink: 0; display: flex; align-items: center; gap: 0.18rem; }
  .headbtn { width: 1.7rem; height: 1.7rem; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--ink-3); border: 0; background: transparent; padding: 0; line-height: 1; border-radius: 4px; box-shadow: none; }
  .headbtn:hover:not(:disabled) { color: var(--accent); background: transparent; }
  .headbtn:disabled { color: var(--ink-4); background: transparent; }
  .headbtn svg { width: 1.08rem; height: 1.08rem; stroke: currentColor; stroke-width: 1.45; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .title-edit-btn { width: 1.3rem; height: 1.3rem; }
  .title-edit-btn svg { width: 0.68rem; height: 0.68rem; stroke-width: 1.55; }
  .headbtn.forktree-trigger { color: var(--ink-4); }
  .headbtn.forktree-trigger:hover { color: var(--accent); background: transparent; }
  .headbtn .forktree-mini { width: 1.5rem; height: 1rem; stroke: none; }
  .headbtn.busy svg { animation: spin 0.85s linear infinite; }
  .headbtn.head-pin.on { color: var(--accent); }
  .headbtn.head-pin.on svg { fill: currentColor; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes statusSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .title-editing { overflow: visible; }
  .title-edit-input { width: 100%; box-sizing: border-box; font: inherit; font-size: 0.84rem; font-weight: 600; color: var(--ink); padding: 0.18rem 0.4rem; border: 1px solid var(--accent); border-radius: var(--radius-sm); background: var(--input-bg); box-shadow: 0 0 0 3px var(--accent-ring); }
  .head .s { font-size: 0.72rem; color: #6b7280; }
  .head .s .sub-line { margin-top: 0.1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .head .s .sub-line + .sub-line { margin-top: 0.1rem; }
  .head .prompt-line-jump { cursor: pointer; border-radius: 3px; outline: none; }
  .head .prompt-line-jump:hover { color: var(--ink-2); }
  .head .prompt-line-jump:hover .prompt-line-text { text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 38%, transparent); text-underline-offset: 2px; }
  .head .prompt-line-jump:focus-visible { box-shadow: 0 0 0 2px var(--focus); }
  .head .s.brief { font-family: inherit; color: var(--ink-3); font-size: 0.78rem; max-width: 70ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #h-tags { display: flex; flex-direction: column; gap: 0.35rem; }
  .headtag-row { display: flex; align-items: center; gap: 0.45rem; min-width: 0; }
  .headtag-row .it-tags { flex-wrap: wrap; }
  .headtag-row .it-tag { position: relative; margin: 0; }
  .headtag-row .it-tag.auto { font-weight: 600; }
  .headtag-row .it-tag > button { border: 0; background: transparent; color: inherit; font-size: 0.78rem; padding: 0; line-height: 1; box-shadow: none; }
  .headtag-row .it-tag > button:hover { color: #b91c1c; background: transparent; }
  .headtag-nav { cursor: pointer; border-radius: var(--radius-pill); outline: none; }
  .headtag-row .it-tag:has(.headtag-nav):hover { background: var(--button-hover); }
  .headtag-row .it-tag.hot:has(.headtag-nav):hover { background: linear-gradient(90deg, var(--tag-heat-soft), var(--tag-heat-fade) 58%, transparent), var(--button-hover); }
  .headtag-nav:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .headtag-session-menu { position: absolute; z-index: 82; top: calc(100% + 0.38rem); left: 0; width: min(20rem, calc(100vw - 2rem)); max-height: min(22rem, 52vh); overflow-y: auto; padding: 0.3rem; border: 1px solid color-mix(in srgb, var(--line-2) 72%, transparent); border-radius: 10px; background: color-mix(in srgb, var(--surface) 96%, transparent); color: var(--ink); box-shadow: var(--shadow-pop); backdrop-filter: blur(12px) saturate(1.08); }
  .headtag-session-option { width: 100%; min-width: 0; min-height: 2.8rem; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 0.5rem; padding: 0.42rem 0.5rem; border: 0; border-radius: 6px; color: var(--ink-2); background: transparent; box-shadow: none; text-align: left; }
  .headtag-session-option + .headtag-session-option { margin-top: 0.05rem; }
  .headtag-session-option:hover { color: var(--ink); background: color-mix(in srgb, var(--surface-2) 78%, transparent); box-shadow: none; }
  .headtag-session-option.on { color: var(--ink); background: var(--accent-soft); }
  .headtag-session-copy { min-width: 0; display: flex; flex-direction: column; gap: 0.16rem; }
  .headtag-session-heading { min-width: 0; display: flex; align-items: center; gap: 0.5rem; }
  .headtag-session-heading .chat-tab-status { flex-shrink: 0; }
  .headtag-session-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.73rem; font-weight: 650; line-height: 1.25; }
  .headtag-session-meta { min-width: 0; margin-left: calc(0.48rem + 0.5rem); overflow: hidden; text-overflow: ellipsis; color: var(--ink-4); font-size: 0.62rem; font-family: ui-monospace, "Cascadia Mono", monospace; line-height: 1.2; white-space: nowrap; }
  .headtag-session-current { align-self: start; margin-top: 0.08rem; color: var(--accent); font-size: 0.58rem; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; }
  .headtag-row .it-context { max-width: min(38rem, 58%); }
  .headtagedit { max-width: 28rem; }
  .topstack { display: none; margin: 0.65rem 1.1rem 0.5rem; padding: 0.35rem; border: 0; border-bottom: 1px solid color-mix(in srgb, var(--line) 62%, transparent); border-radius: 11px; background: color-mix(in srgb, var(--surface-2) 88%, var(--surface)); box-shadow: 0 8px 18px -16px rgba(15,23,42,0.28); flex-direction: column; gap: 0.12rem; }
  html[data-theme="dark"] .topstack { box-shadow: 0 8px 20px -16px rgba(0,0,0,0.72); }
  .topstack.show { display: flex; }
  .latestpin { display: none; border: 0; border-radius: 7px; background: transparent; padding: 0.55rem 0.65rem; cursor: pointer; box-shadow: none; }
  .latestpin.show { display: flex; }
  .latestpin:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
  .latestpin-body { flex: 1; min-width: 0; display: flex; align-items: center; gap: 0.65rem; overflow: hidden; }
  .latestpin-k { flex-shrink: 0; color: var(--ink-3); border: 0; background: transparent; padding: 0; font-size: 0.64rem; line-height: 1; font-weight: 850; letter-spacing: 0.11em; text-transform: uppercase; font-family: ui-monospace, "Cascadia Mono", monospace; }
  .latestpin-arrow { margin-left: auto; flex-shrink: 0; color: #64748b; font-family: ui-monospace, "Cascadia Mono", monospace; }
  .latestpin-text { flex: 1; min-width: 0; max-width: none; background: transparent; color: var(--ink-2); border: 0; border-radius: 0; box-shadow: none; padding: 0; font-family: inherit; font-size: 0.86rem; font-style: normal; font-weight: 400; line-height: 1.45; letter-spacing: 0; text-transform: none; font-variant: normal; text-rendering: optimizeLegibility; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Back-compat for previews rendered by an older open tab before the next refresh. */
  .latestpin-body .bubble { flex: 1; min-width: 0; max-width: none; background: transparent; color: var(--ink-2); border: 0; border-radius: 0; box-shadow: none; padding: 0; font-family: inherit; font-size: 0.86rem; line-height: 1.45; font-weight: 400; font-variant: normal; text-rendering: optimizeLegibility; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .latestpin:hover { background: var(--button-hover); }
  .latestpin-body .bubble > :first-child { margin-top: 0; }
  .latestpin-body .bubble > :last-child { margin-bottom: 0; }
  .latestpin-body .bubble p { margin: 0; }
  .latestpin-body .bubble p + p { margin-top: 0.5em; }
  .latestpin-body .bubble a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
  .latestpin-body .bubble code { font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.92em; background: var(--accent-soft); color: var(--accent); border-radius: 4px; padding: 0.05em 0.3em; }
  .latestpin-body .bubble .filepath { color: var(--accent); }
  .pintray { display: none; flex-direction: column; gap: 0.05rem; }
  .pintray.show { display: flex; }
  .pinitem { width: 100%; min-width: 0; display: flex; align-items: center; gap: 0.55rem; border: 0; border-radius: 7px; background: transparent; padding: 0.45rem 0.58rem; cursor: pointer; box-shadow: none; }
  .pinitem:hover { background: var(--button-hover); }
  .pinitem-icon { width: 0.72rem; height: 0.72rem; flex-shrink: 0; fill: none; stroke: var(--ink-4); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .pinrole { flex-shrink: 0; font-size: 0.66rem; line-height: 1; font-weight: 850; letter-spacing: 0.09em; text-transform: uppercase; color: #64748b; border: 0; background: transparent; padding: 0; font-family: ui-monospace, "Cascadia Mono", monospace; }
  .pintext { flex: 1; min-width: 0; max-width: none; font-family: inherit; font-size: 0.86rem; font-style: normal; line-height: 1.45; font-weight: 400; letter-spacing: 0; text-transform: none; font-variant: normal; text-rendering: optimizeLegibility; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pinx { flex-shrink: 0; border: 0; background: transparent; color: var(--ink-4); box-shadow: none; padding: 0.08rem 0.22rem; line-height: 1; font-size: 1.1rem; }
  .pinx:hover { color: #b91c1c; background: transparent; }
  #msgs { --msg-float-actions-space: 7rem; flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 1rem 1rem 1.5rem; display: flex; flex-direction: column; gap: 0.6rem; }
  #msgs.transcript-virtualized { gap: 0; overflow-anchor: none; contain: layout style; }
  .transcript-turn { flex: 0 0 auto; min-width: 0; display: flex; flex-direction: column; gap: 0.6rem; padding-bottom: 0.6rem; }
  .transcript-virtual-spacer { flex: 0 0 auto; width: 1px; height: 0; pointer-events: none; }
  .transcript-live-tail { flex: 0 0 auto; min-width: 0; display: flex; flex-direction: column; gap: 0.6rem; }
  .msg { display: flex; align-items: center; gap: 0.28rem; }
  .msg.user { justify-content: flex-end; align-items: center; gap: 0.28rem; }
  /* hover-revealed controls for user/assistant bubbles */
  .msg-edit, .msg-pin, .msg-fold, .msg-comment { flex-shrink: 0; opacity: 0; pointer-events: none; width: 1.72rem; height: 1.72rem; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 7px; background: var(--msg-control-bg); color: var(--ink-4); padding: 0; box-shadow: none; line-height: 1; transition: opacity 0.12s, color 0.12s, border-color 0.12s, background 0.12s, box-shadow 0.12s; }
  .msg-edit { order: -3; }
  .msg-fold { order: -1; }
  .msg-pin { order: 1; }
  .msg-comment { order: 2; position: relative; }
  .msg.user .msg-pin { order: -2; }
  .msg.user .msg-comment { order: -1; }
  .msg.assistant .msg-pin { order: 1; }
  .msg-edit svg, .msg-pin svg, .msg-fold svg, .msg-comment svg { width: 0.98rem; height: 0.98rem; stroke: currentColor; stroke-width: 1.9; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .msg-pin .pin-body { fill: transparent; transition: fill 0.12s; }
  .msg:hover .msg-edit, .msg:hover .msg-pin, .msg:hover .msg-fold, .msg:hover .msg-comment, .msg:focus-within .msg-edit, .msg:focus-within .msg-pin, .msg:focus-within .msg-fold, .msg:focus-within .msg-comment, .msg-pin.on, .msg-comment.has-comments { opacity: 1; pointer-events: auto; }
  .msg-edit:hover, .msg-pin:hover, .msg-fold:hover, .msg-comment:hover { color: var(--ink); border-color: var(--msg-control-border); background: var(--msg-control-hover-bg); box-shadow: var(--shadow-sm); }
  .comment-msg-edit[hidden] { display: none; }
  .msg-comment.has-comments { color: var(--accent); }
  .msg-comment-count { position: absolute; right: -0.18rem; top: -0.24rem; min-width: 0.82rem; height: 0.82rem; padding: 0 0.16rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: var(--accent); color: white; font-size: 0.52rem; font-weight: 700; line-height: 1; }
  .msg-pin.on { color: var(--accent); border-color: var(--msg-control-active-border); background: var(--msg-control-active-bg); }
  .msg-pin.on .pin-body { fill: rgba(79,70,229,0.16); }
  .msg-float-actions { position: fixed; z-index: 48; display: flex; align-items: center; gap: 0.18rem; padding: 0; border: 0; background: transparent; box-shadow: none; transform: translateY(-50%); opacity: 0; pointer-events: none; transition: opacity 0.1s; }
  .msg-float-actions.show { opacity: 1; pointer-events: auto; }
  .msg-float-actions button { position: relative; width: 1.72rem; height: 1.72rem; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 7px; background: var(--msg-control-bg); color: var(--ink-4); padding: 0; box-shadow: none; line-height: 1; transition: color 0.12s, border-color 0.12s, background 0.12s, box-shadow 0.12s; }
  .msg-float-actions.has-selection button::after { content: ""; position: absolute; top: -0.22rem; right: -0.22rem; width: 0.42rem; height: 0.42rem; border: 2px solid var(--surface); border-radius: 50%; background: var(--accent); box-sizing: border-box; }
  .msg-float-actions button:hover { color: var(--ink); border-color: var(--msg-control-border); background: var(--msg-control-hover-bg); }
  .msg-float-actions button.on { color: var(--accent); background: var(--msg-control-active-bg); }
  .msg-float-actions svg { width: 0.98rem; height: 0.98rem; stroke: currentColor; stroke-width: 1.9; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .msg-float-actions.has-selection button { color: var(--accent); background: var(--msg-control-active-bg); }
  #msgFloatReference, #commentMsgFloatReference { font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.94rem; font-weight: 850; }
  .msg-reference-composer { position: fixed; z-index: 125; width: min(21rem, calc(100vw - 1rem)); padding: 0.48rem; border: 1px solid var(--line-2); border-radius: 10px; background: color-mix(in srgb, var(--surface) 96%, transparent); box-shadow: var(--shadow-pop); backdrop-filter: blur(12px) saturate(1.08); }
  .msg-reference-composer[hidden] { display: none; }
  .msg-reference-head { display: flex; align-items: center; gap: 0.45rem; min-width: 0; padding: 0.05rem 0.08rem 0.38rem; }
  .msg-reference-mark { flex-shrink: 0; color: var(--accent); font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.78rem; font-weight: 850; }
  .msg-reference-preview { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-3); font-size: 0.68rem; }
  .msg-reference-close { width: 1.35rem; height: 1.35rem; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 50%; color: var(--ink-4); background: transparent; box-shadow: none; }
  .msg-reference-close:hover { color: var(--ink); background: var(--button-hover); box-shadow: none; }
  .msg-reference-close svg { width: 0.7rem; height: 0.7rem; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; }
  .msg-reference-input { display: block; width: 100%; height: 2.15rem; min-height: 2.15rem; padding: 0.42rem 0.58rem; border: 1px solid var(--line-2); border-radius: 7px; color: var(--ink); background: var(--input-bg); font-size: 0.78rem; line-height: 1.3; }
  .msg-reference-actions { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; padding-top: 0.42rem; }
  .msg-reference-hint { min-width: 0; color: var(--ink-4); font-size: 0.61rem; }
  .msg-reference-add { flex-shrink: 0; min-height: 1.75rem; padding: 0.26rem 0.68rem; border-color: var(--primary-bg); color: var(--primary-fg); background: var(--primary-bg); box-shadow: none; font-size: 0.68rem; font-weight: 700; }
  .msg-reference-add:hover { border-color: var(--primary-hover); background: var(--primary-hover); box-shadow: none; }
  .comment-msg-float-actions { z-index: 110; }
  .comment-msg-reference-composer { z-index: 126; width: min(19rem, calc(92vw - 1rem)); }
  @media (hover: none), (pointer: coarse) {
    #msgs { --msg-float-actions-space: 2.4rem; }
    .msg-float-actions { display: none; }
  }
  .msg.editing { justify-content: stretch; }
  .msg.editing .msg-edit { display: none; }
  .msg.editing .msg-pin { display: none; }
  .msg.editing .msg-fold { display: none; }
  .msg.editing .msg-comment { display: none; }
  .pincomment { flex-shrink: 0; min-height: 1.12rem; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: var(--radius-pill); padding: 0.16rem 0.42rem; background: transparent; color: var(--status-seen); font-size: 0.62rem; font-weight: 700; box-shadow: none; transition: color 0.12s, background 0.12s; }
  .pincomment:hover, .pincomment:focus-visible { color: var(--status-seen); background: var(--status-seen-soft); outline: none; }
  .pincomment.idle { background: transparent; color: var(--ink-4); }
  .pincomment.idle:hover, .pincomment.idle:focus-visible { background: var(--status-seen-soft); color: var(--status-seen); }
  .pincomment.generating { color: var(--status-generating); min-width: 1.3rem; padding: 0.16rem 0.36rem; }
  .pincomment.generating:hover, .pincomment.generating:focus-visible { color: var(--status-generating); background: var(--status-generating-soft); }
  .pincomment.unread { color: var(--status-unread); }
  .pincomment.unread:hover, .pincomment.unread:focus-visible { color: var(--status-unread); background: var(--status-unread-soft); }
  .commentdrawer { position: absolute; inset: 0; z-index: 95; display: flex; justify-content: flex-end; background: rgba(15,23,42,0.24); }
  .commentdrawer[hidden] { display: none; }
  .commentpanel { --comment-composer-overlay-height: 4rem; --comment-queue-overlay-height: 0px; --comment-scrollbar-width: 0px; position: relative; width: min(34rem, 92vw); height: 100%; display: flex; flex-direction: column; background: var(--surface); border-left: 1px solid var(--line); box-shadow: var(--shadow-pop); }
  .commenthead { flex: 0 0 3rem; height: 3rem; display: flex; align-items: center; gap: 0.65rem; padding: 0 0.65rem 0 0.9rem; border-bottom: 1px solid var(--line-2); }
  .commenttitle { flex: 1; min-width: 0; color: var(--ink); font-size: 0.84rem; line-height: 1; font-weight: 750; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .commentactions { flex-shrink: 0; display: flex; align-items: center; gap: 0.14rem; }
  .commentpromote { height: 1.75rem; min-height: 1.75rem; padding: 0 0.5rem; border-color: transparent; background: transparent; color: var(--accent); box-shadow: none; font-size: 0.68rem; line-height: 1; font-weight: 700; }
  .commentpromote:hover:not(:disabled) { border-color: transparent; background: var(--accent-soft); color: var(--accent); box-shadow: none; }
  .commentpromote:disabled { border-color: transparent; background: transparent; }
  .commentclose { width: 1.75rem; height: 1.75rem; min-height: 1.75rem; display: inline-flex; align-items: center; justify-content: center; padding: 0; border-color: transparent; background: transparent; color: var(--ink-3); box-shadow: none; font-size: 1.05rem; line-height: 1; }
  .commentclose:hover { border-color: transparent; background: var(--button-hover); color: var(--ink); box-shadow: none; }
  .commentanchor { margin: 0 0 0.2rem; min-width: 0; }
  .commentanchor-head { display: flex; align-items: center; gap: 0.55rem; margin-bottom: 0.38rem; }
  .commentanchor-label { flex: 1; min-width: 0; color: var(--ink-4); font-size: 0.59rem; line-height: 1; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; }
  .commentanchor-content { min-width: 0; max-height: 35vh; overflow: auto; }
  .commentanchor-content > .msg { align-items: center; }
  .commentanchor-content > .msg .bubble { max-width: 100%; }
  .commentanchor-content > .toolc { max-width: 100%; }
  .commenttopstack { margin: 0.55rem 0.9rem 0; }
  .commentmsgs { --msg-float-actions-space: 5rem; flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 0.8rem 0.9rem; display: flex; flex-direction: column; gap: 0.6rem; }
  #commentQueue { flex: 0 0 auto; z-index: 21; display: flex; flex-direction: column; gap: 0.3rem; max-height: 30vh; overflow-y: auto; padding: 0.4rem 0.9rem 0; }
  #commentQueue:empty { display: none; }
  .commentfoot { position: relative; flex: 0 0 auto; z-index: 20; margin-right: var(--comment-scrollbar-width); padding: 0 0.9rem 0.75rem; border-top: 0; background: var(--surface); }
  .commentcomposer { width: 100%; box-sizing: border-box; }
  .commentcomposer .composerrow { min-height: 2.15rem; }
  .commentcomposer .composer-shortcut-ghost { height: 2.15rem; padding: 0.42rem 5.2rem 0.42rem 0.35rem; }
  .commentfoot .commentcomposer textarea { height: 2.15rem; min-height: 2.15rem; max-height: 2.15rem; padding: 0.42rem 5.2rem 0.42rem 0.35rem; overflow-y: auto; }
  .scrollbottom { position: absolute; z-index: 24; width: 2rem; height: 2rem; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 1px solid var(--line-2); border-radius: 50%; background: var(--surface); color: var(--ink-3); box-shadow: var(--shadow-md); }
  .scrollbottom:hover { color: var(--accent); border-color: var(--accent); background: var(--surface); }
  .scrollbottom[hidden] { display: none; }
  .scrollbottom svg { width: 1rem; height: 1rem; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
  .chat-scrollbottom { right: 1.55rem; bottom: calc(var(--composer-overlay-height) + var(--queue-overlay-height) + var(--avoid-overlay-height) + 0.55rem); }
  .comment-scrollbottom { right: 1.35rem; bottom: calc(var(--comment-composer-overlay-height) + var(--comment-queue-overlay-height) + 0.55rem); }
  .msg.editing .inline-edit { width: 100%; }
  /* shared in-place editor (sent-message resend + queued-draft edit) */
  .inline-edit { position: relative; width: 100%; --inline-edit-actions-space: 9rem; }
  .inline-edit-ta { display: block; width: 100%; box-sizing: border-box; resize: none; min-height: 2.2rem; font: inherit; font-size: 0.86rem; line-height: 1.5; padding: 0.5rem var(--inline-edit-actions-space) 0.5rem 0.65rem; border: 1px solid var(--accent); border-radius: var(--radius-sm); background: var(--input-bg); color: var(--ink); box-shadow: 0 0 0 3px var(--accent-ring); }
  .inline-edit.single-line .inline-edit-ta { min-height: calc(1.55em + 1.1rem); font-size: 0.88rem; line-height: 1.55; padding: calc(0.55rem - 1px) var(--inline-edit-actions-space) calc(0.55rem - 1px) 0.8rem; border-radius: 12px; border-bottom-right-radius: 4px; }
  .inline-edit-bar { position: absolute; right: 0.45rem; top: 50%; transform: translateY(-50%); display: flex; gap: 0.35rem; align-items: center; justify-content: flex-end; max-width: calc(100% - 0.9rem); }
  .inline-edit .inline-edit-save { height: 1.62rem; min-height: 1.62rem; padding: 0 0.58rem; font-size: 0.78rem; line-height: 1; white-space: nowrap; box-shadow: var(--shadow-sm); }
  .inline-edit .schedulebtn { width: 1.62rem; height: 1.62rem; min-height: 1.62rem; flex-basis: 1.62rem; }
  .inline-edit .inline-edit-save { color: var(--primary-fg); background: var(--primary-bg); border-color: var(--primary-bg); font-weight: 600; }
  .inline-edit .inline-edit-save:hover:not(:disabled) { background: var(--primary-hover); border-color: var(--primary-hover); box-shadow: 0 4px 14px var(--accent-ring); }
  .msg .bubble { min-width: 0; max-width: 76%; padding: 0.55rem 0.8rem; border-radius: 12px; font-size: 0.88rem; line-height: 1.55; white-space: normal; word-break: break-word; overflow-wrap: anywhere; box-shadow: var(--shadow-sm); }
  .msg.user .bubble { background: var(--user-msg-bg); color: var(--user-msg-fg); border: 1px solid var(--user-msg-border); border-bottom-right-radius: 4px; }
  .msg.assistant .bubble { max-width: calc(100% - var(--msg-float-actions-space)); background: var(--assistant-bg); color: var(--ink); border: 1px solid var(--assistant-border); border-bottom-left-radius: 4px; }
  .msg .bubble > :first-child { margin-top: 0; }
  .msg .bubble > :last-child { margin-bottom: 0; }
  .msg .bubble p { margin: 0; }
  .msg .bubble p + p { margin-top: 0.7em; }
  .msg .bubble ul, .msg .bubble ol { margin: 0.55em 0 0 1.2em; padding: 0; }
  .msg .bubble li + li { margin-top: 0.22em; }
  .msg .bubble blockquote { margin: 0.7em 0 0; padding-left: 0.8em; border-left: 3px solid rgba(148, 163, 184, 0.65); color: inherit; opacity: 0.92; }
  .msg .bubble pre { margin: 0.7em 0 0; padding: 0.65em 0.8em; border-radius: 8px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
  .msg.assistant .bubble pre { background: var(--code-bg); color: var(--ink); }
  .msg.user .bubble pre { background: var(--user-msg-code-bg); color: var(--user-msg-fg); }
  .msg .bubble code { font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.92em; border-radius: 4px; padding: 0.08em 0.28em; }
  .msg.assistant .bubble code { background: var(--code-bg); color: var(--ink); }
  .msg.user .bubble code { background: var(--user-msg-code-bg); color: var(--user-msg-fg); }
  .msg .bubble pre code { background: transparent; padding: 0; border-radius: 0; }
  .msg .bubble .diagram { position: relative; margin: 0.7em 0 0; padding: 0.65em 0.8em; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.38); background: #fff; overflow: auto; }
  .msg .bubble .diagram[data-rendered="ok"] { cursor: zoom-in; }
  .msg.user .bubble .diagram { border-color: var(--user-msg-border); background: var(--surface); }
  .msg .bubble .diagram svg, .msg .bubble .diagram img { display: block; max-width: 100%; height: auto; }
  .msg .bubble .diagram-status, .msg .bubble .diagram-error { color: #6b7280; font-size: 0.78rem; font-style: italic; }
  .msg .bubble .diagram-status { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4em; }
  .msg.user .bubble .diagram-status, .msg.user .bubble .diagram-error { color: var(--ink-3); }
  .msg .bubble .diagram-btn { font-style: normal; font-size: 0.72rem; line-height: 1.2; padding: 0.14em 0.55em; border: 1px solid rgba(148,163,184,0.5); border-radius: 5px; background: rgba(148,163,184,0.12); color: #374151; cursor: pointer; }
  .msg .bubble .diagram-btn:hover { background: rgba(148,163,184,0.24); }
  .msg .bubble .diagram-btn:disabled { opacity: 0.6; cursor: default; }
  .msg.user .bubble .diagram-btn { color: var(--ink-2); }
  .msg .bubble .diagram-note { font-size: 0.72rem; }
  .msg .bubble .diagram-src { margin: 0.5em 0 0; max-height: 24em; overflow: auto; font-style: normal; }
  .msg .bubble .diagram-error { color: #b91c1c; }
  .msg.user .bubble .diagram-error { color: #b91c1c; }
  .msg .bubble .diagram-fallback { margin-top: 0.45em; }
  .msg .bubble a { text-decoration: underline; text-underline-offset: 2px; }
  .msg.assistant .bubble a { color: #4338ca; }
  .msg.user .bubble a { color: var(--user-msg-link); }
  .msg .bubble h1, .msg .bubble h2, .msg .bubble h3, .msg .bubble h4, .msg .bubble h5, .msg .bubble h6 { margin: 0.85em 0 0.35em; line-height: 1.25; }
  .msg .bubble h1 { font-size: 1.25em; }
  .msg .bubble h2 { font-size: 1.15em; }
  .msg .bubble h3 { font-size: 1.05em; }
  .msg .bubble hr { border: 0; border-top: 1px solid rgba(148, 163, 184, 0.45); margin: 0.75em 0; }
  .msg .bubble table { border-collapse: collapse; margin: 0.7em 0 0; font-size: 0.92em; display: block; max-width: 100%; overflow-x: auto; }
  .msg .bubble th, .msg .bubble td { border: 1px solid rgba(148, 163, 184, 0.5); padding: 0.3em 0.55em; text-align: left; vertical-align: top; }
  .msg .bubble thead th { background: rgba(148, 163, 184, 0.18); font-weight: 600; }
  .msg.user .bubble th, .msg.user .bubble td { border-color: var(--user-msg-border); }
  .msg.user .bubble thead th { background: var(--user-msg-code-bg); }
  /* file paths mentioned in a message → click to reveal in Finder/Explorer */
  .msg .bubble .filepath { cursor: pointer; text-decoration: underline dotted; text-underline-offset: 2px; }
  .msg.assistant .bubble .filepath { color: #1d4ed8; }
  .msg.user .bubble .filepath { color: var(--user-msg-link); }
  .msg .bubble .filepath:hover { text-decoration: underline; }
  .msg .bubble .filepath.badpath { color: #b91c1c; text-decoration: line-through; }
  .msg.thinking .bubble { max-width: none; padding: 0.08rem 0; border: 0; border-radius: 0; background: transparent; color: var(--ink-3); box-shadow: none; font-size: 0.78rem; line-height: 1.25; font-style: italic; }
  .msg.thinking .bubble::after { content: ""; display: inline-block; width: 0.42em; height: 0.42em; margin-left: 0.38em; border-radius: 50%; background: var(--status-generating); animation: gpulse 1s ease-in-out infinite; }
  @keyframes gpulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
  .msg.error .bubble { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .msg.error.provider-error .bubble { width: min(34rem, calc(100% - var(--msg-float-actions-space))); max-width: min(34rem, calc(100% - var(--msg-float-actions-space))); }
  .provider-error-title { font-size: 0.9rem; line-height: 1.3; font-weight: 750; }
  .provider-error-message { margin-top: 0.28rem; color: currentColor; font-size: 0.8rem; line-height: 1.45; opacity: 0.9; }
  .provider-error-command { display: flex; align-items: center; gap: 0.45rem; margin-top: 0.6rem; }
  .provider-error-command code { flex: 1; min-width: 0; overflow-x: auto; padding: 0.38rem 0.5rem; border: 1px solid rgba(153,27,27,0.22); border-radius: var(--radius-sm); background: rgba(255,255,255,0.6); color: inherit; font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.78rem; line-height: 1.25; white-space: nowrap; }
  .provider-error-actions { display: flex; flex-wrap: wrap; gap: 0.42rem; margin-top: 0.62rem; }
  .provider-error-button { min-height: 1.75rem; padding: 0.28rem 0.58rem; border: 1px solid rgba(153,27,27,0.3); border-radius: var(--radius-sm); background: rgba(255,255,255,0.72); color: #991b1b; font-size: 0.72rem; line-height: 1; font-weight: 700; box-shadow: none; }
  .provider-error-button:hover:not(:disabled) { border-color: #dc2626; background: #ffffff; color: #7f1d1d; box-shadow: none; }
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
  .toast.error { position: fixed; top: 1rem; left: 50%; z-index: 150; width: max-content; max-width: calc(100vw - 2rem); transform: translateX(-50%); border-color: #ef4444; background: #fef2f2; color: #991b1b; font-size: 0.86rem; font-weight: 800; text-align: center; }
  .toast.ok { border-color: #34d399; background: #ecfdf5; color: #065f46; }
  .toast.live-restored { position: fixed; top: 1rem; left: 50%; z-index: 150; width: max-content; max-width: calc(100vw - 2rem); transform: translateX(-50%); border-color: #34d399; background: #ecfdf5; color: #065f46; font-size: 0.86rem; font-weight: 800; text-align: center; }
  .toast.hide { opacity: 0; transform: translateY(0.35rem); }
  .toast.live-restored.hide { transform: translate(-50%, 0.35rem); }
  .unlock { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; background: var(--canvas); color: var(--ink); padding: 1rem; }
  .unlock[hidden] { display: none; }
  .unlock-panel { width: min(25rem, 100%); border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-pop); padding: 1rem; }
  .unlock-title { font-size: 1rem; font-weight: 800; margin-bottom: 0.35rem; }
  .unlock-sub { font-size: 0.78rem; line-height: 1.4; color: var(--ink-3); margin-bottom: 0.75rem; }
  .unlock-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.5rem; }
  .unlock-input { min-width: 0; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); color: var(--ink); padding: 0.55rem 0.65rem; font-size: 0.88rem; }
  .unlock-btn { border: 1px solid var(--primary-bg); border-radius: var(--radius-sm); background: var(--primary-bg); color: var(--primary-fg); padding: 0.55rem 0.75rem; font-weight: 800; cursor: pointer; }
  .unlock-btn:hover { border-color: var(--primary-hover); background: var(--primary-hover); }
  .unlock-msg { min-height: 1.1rem; margin-top: 0.55rem; color: #b91c1c; font-size: 0.76rem; }
  .tool { align-self: flex-start; font-family: ui-monospace, monospace; font-size: 0.72rem; color: var(--tool-fg); background: var(--tool-bg); border: 1px solid var(--tool-border); border-radius: 6px; padding: 0.2rem 0.5rem; }
  .toolrow { align-self: stretch; width: 100%; min-width: 0; display: flex; align-items: flex-start; }
  .toolrow > .toolc { width: fit-content; min-width: 0; max-width: calc(100% - var(--msg-float-actions-space)); }
  .toolc { align-self: flex-start; max-width: 88%; font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.74rem; background: var(--tool-bg); border: 1px solid var(--tool-border); border-radius: 6px; }
  .toolc > summary { cursor: pointer; padding: 0.28rem 0.6rem; color: var(--tool-fg); list-style: none; user-select: none; display: flex; align-items: center; min-width: 0; }
  .toolc > summary:hover { color: var(--ink); }
  .toolc > summary:focus-visible { outline: 1px solid var(--tool-border-strong); outline-offset: -1px; border-radius: 5px; }
  .tool-summary-text { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .toolrow:hover > .msg-pin, .toolrow:hover > .msg-comment, .toolrow:focus-within > .msg-pin, .toolrow:focus-within > .msg-comment, .toolrow > .msg-pin.on, .toolrow > .msg-comment.has-comments { opacity: 1; pointer-events: auto; }
  .toolc > summary::-webkit-details-marker { display: none; }
  .toolc > summary::before { content: "▸ "; color: var(--tool-icon); }
  .toolc[data-tool-pending="true"] { border-color: var(--status-generating); box-shadow: 0 0 0 2px var(--status-generating-soft); }
  .toolc[data-tool-pending="true"] > summary::after { content: ""; width: 0.42rem; height: 0.42rem; flex-shrink: 0; margin-left: 0.5rem; border-radius: 50%; background: var(--status-generating); animation: gpulse 1s ease-in-out infinite; }
  .toolc[data-tool-error="true"] { border-color: #dc2626; box-shadow: none; }
  .toolc[open] > summary::before { content: "▾ "; }
  .toolc[open] > summary { border-bottom: 1px solid var(--tool-divider); }
  .toolc pre { margin: 0; padding: 0.45rem 0.6rem; white-space: pre-wrap; word-break: break-word; max-height: 340px; overflow: auto; }
  .toolc .tool-in { color: var(--ink-2); background: var(--tool-body-bg); }
  .toolc .tool-out { color: var(--ink); background: var(--tool-body-bg); border-top: 1px solid var(--tool-divider); }
  .toolc .tool-out.err { color: #991b1b; background: #fef2f2; }
  /* git-diff-style rendering for Edit / MultiEdit / Write (expanded by default) */
  .toolc .diff { background: var(--tool-body-bg); border-top: 1px solid var(--tool-divider); overflow: auto; max-height: 460px; font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.74rem; }
  .toolc .diff-file { padding: 0.38rem 0.6rem 0.34rem; background: var(--tool-bg); border-bottom: 1px solid var(--tool-divider); }
  .toolc .diff-file + .diff-file { border-top: 1px dashed var(--tool-divider); }
  .toolc .diff-file-title { font-weight: 700; color: var(--tool-fg); }
  .toolc .diff-file-meta { margin-top: 0.16rem; font-size: 0.68rem; color: var(--ink-3); }
  .toolc .diff-sep { height: 0.45rem; background: var(--tool-bg); border-top: 1px dashed var(--tool-divider); border-bottom: 1px dashed var(--tool-divider); }
  .dline { display: flex; align-items: flex-start; padding: 0 0.4rem; line-height: 1.45; }
  .dline .dsign { width: 1.4ch; flex-shrink: 0; text-align: center; user-select: none; opacity: 0.7; }
  .dline .dtext { white-space: pre-wrap; word-break: break-word; flex: 1; min-width: 0; }
  .dline.add { background: #e6f7ec; color: #14532d; }
  .dline.add .dsign { color: #15803d; }
  .dline.del { background: #fde8e8; color: #7f1d1d; }
  .dline.del .dsign { color: #b91c1c; }
  .dline.ctx { color: #6b7280; }
  .dline.meta { background: var(--tool-bg); color: var(--ink-3); }
  .dline.meta .dsign { color: var(--tool-icon); }
  /* rich renders for interactive tools: todos / plan / questions */
  .rt, .rq, .rplan { background: var(--tool-body-bg); border-top: 1px solid var(--tool-divider); padding: 0.45rem 0.65rem; }
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
  .q-submit:hover:not(:disabled) { background: var(--primary-hover); border-color: var(--primary-hover); }
  .q-submit:disabled { opacity: 0.65; cursor: default; }
  .q-err { font-size: 0.74rem; color: #b91c1c; }
  .rq.busy { opacity: 0.8; }
  .rplan { white-space: pre-wrap; word-break: break-word; font-size: 0.8rem; line-height: 1.5; color: var(--ink-2); max-height: 420px; overflow: auto; }
  .placeholder { margin: auto; color: #9ca3af; text-align: center; font-size: 0.9rem; max-width: 32ch; line-height: 1.5; }
  .changelog { width: min(38rem, calc(100% - 2rem)); margin: auto; color: var(--ink); }
  .changelog-kicker { color: var(--accent); font-size: 0.66rem; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; }
  .changelog-content > h1 { margin: 0.35rem 0 0; font-size: 1.45rem; line-height: 1.2; letter-spacing: -0.025em; }
  .changelog-content > p { margin: 0.45rem 0 0; color: var(--ink-3); font-size: 0.78rem; line-height: 1.55; }
  .changelog-content h2 { margin: 1.25rem 0 0; padding-top: 1rem; border-top: 1px solid var(--line); font-size: 1rem; line-height: 1.35; }
  .changelog-content h3 { margin: 0.9rem 0 0; color: var(--ink-2); font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; }
  .changelog-content ul { margin: 0.55rem 0 0; padding-left: 1.15rem; color: var(--ink-3); font-size: 0.78rem; line-height: 1.55; }
  .changelog-content li + li { margin-top: 0.35rem; }
  .changelog-hint { margin-top: 1rem; color: var(--ink-4); font-size: 0.72rem; line-height: 1.5; }
  @media (max-width: 620px) {
    .changelog { width: calc(100% - 1rem); }
  }
  .foot { position: relative; flex: 0 0 auto; z-index: 20; margin-right: var(--chat-scrollbar-width); border-top: 0; padding: 0 1rem 1rem; background: var(--surface); }
  .foot.rail-open, .foot.pinref-open { z-index: 28; }
  body.no-session #queue, body.no-session .foot, body.no-session .chat-scrollbottom { display: none; }
  .composer { --composer-focus-border: color-mix(in srgb, var(--accent) 68%, var(--line-2)); min-width: 0; display: flex; flex-direction: column; gap: 0; }
  .composer-surface { position: relative; z-index: 1; min-width: 0; border: 1px solid var(--line-2); border-radius: 13px; padding: 0.45rem; background: var(--input-bg); box-shadow: var(--shadow-sm); transition: background 0.15s, box-shadow 0.15s, border-color 0.15s; }
  .composer-surface:focus-within { border-color: var(--composer-focus-border); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 12%, transparent), var(--shadow-sm); }
  .commentcomposer-surface { position: relative; z-index: 1; min-width: 0; border: 1px solid var(--line-2); border-radius: 13px; padding: 0.45rem; background: var(--input-bg); box-shadow: var(--shadow-sm); transition: background 0.15s, box-shadow 0.15s, border-color 0.15s; }
  .commentcomposer-surface:focus-within { border-color: var(--composer-focus-border); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 12%, transparent), var(--shadow-sm); }
  .composer.drop .composer-surface { border-color: #818cf8; background: var(--drop-bg); box-shadow: 0 0 0 4px rgba(99,102,241,0.12), 0 0 0 1px #818cf8; }
  /* One composer surface, with a compact context ribbon inside it. The ribbon is deliberately
     neutral: accent belongs to active controls and state, not to a second container outline. */
  .composerrail { position: relative; width: fit-content; max-width: 100%; min-width: 0; display: flex; align-items: center; margin: 0 0 0.12rem; padding: 0.12rem 0.24rem; border: 0; border-radius: 7px; background: color-mix(in srgb, var(--input-bg) 96%, var(--ink)); box-shadow: none; }
  .composerrail-controls { width: auto; max-width: 100%; min-width: 0; display: flex; align-items: center; gap: 0.2rem; overflow-x: auto; scrollbar-width: none; }
  .composerrail-controls::-webkit-scrollbar { display: none; }
  .rail-divider { flex: 0 0 1px; align-self: stretch; max-height: 1.2rem; margin: auto 0.18rem; background: var(--line); }
  .railbtn { flex-shrink: 0; max-width: 10rem; min-height: 1.5rem; display: inline-flex; align-items: center; gap: 0.22rem; padding: 0.1rem 0.34rem; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--ink-3); box-shadow: none; font-size: 0.67rem; line-height: 1.2; white-space: nowrap; }
  .railbtn:hover:not(:disabled) { color: var(--ink); border-color: transparent; background: color-mix(in srgb, var(--surface-2) 75%, transparent); box-shadow: none; }
  .railbtn.active, .railbtn.active:hover:not(:disabled) { color: var(--ink); border-color: transparent; background: var(--accent-soft); }
  .railbtn:disabled { color: var(--ink-4); background: transparent; }
  .railbtn-value { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  /* U+2303 sits superscript-high by default; nudge it to optical center */
  .railbtn > span[aria-hidden="true"] { display: inline-block; transform: translateY(0.14em); }
  #railVendor[data-vendor="claude"] { color: var(--vendor-claude-fg); }
  #railVendor[data-vendor="codex"] { color: var(--vendor-codex-fg); }
  #railVendor[data-vendor="cursor"] { color: var(--vendor-cursor-fg); }
  #railModel { flex: 0 1 auto; min-width: 0; }
  #railModel .railbtn-value { max-width: 8rem; }
  /* only when open todos exist: label + count carry the sidebar todo marker's amber (.it-todo); 0 stays neutral */
  #railTodos.rail-has-count .railbtn-value, #railTodos.rail-has-count .railbtn-count { color: var(--todo-fg); }
  .railbtn-count { min-width: 1rem; padding: 0.02rem 0.28rem; border-radius: 999px; background: var(--surface-2); color: var(--ink-3); font-family: ui-monospace, "Cascadia Mono", monospace; font-size: 0.61rem; font-weight: 760; text-align: center; }
  /* Daemon's suggested next message — a click drops it into the composer (fill, not send). */
  /* Lane B — the daemon's scrutiny probe: a muted, read-only-looking text that fills
     the rail's remaining width; click fills it into the composer (never sends). */
  .rail-probe { max-width: none; color: var(--ink-3); border-color: transparent; background: transparent; font-style: italic; }
  .rail-probe:hover:not(:disabled) { color: var(--ink-2); border-color: transparent; background: color-mix(in srgb, var(--surface-2) 75%, transparent); }
  .rail-probe .railbtn-value { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .rail-probe-ico { flex-shrink: 0; color: var(--ink-4); font-size: 0.72rem; font-style: normal; }
  .rail-probe[hidden] { display: none; }
  /* When a probe is present, the rail spans the composer width and the probe grows to
     fill whatever space the control buttons leave, ellipsizing at the composer edge. */
  .composerrail.rail-full { width: 100%; }
  .composerrail.rail-full .composerrail-controls { width: 100%; }
  .composerrail.rail-full .rail-probe { flex: 1 1 0; min-width: 0; max-width: none; justify-content: flex-start; }
  .composerrail.rail-full .rail-probe .railbtn-value { flex: 1 1 auto; max-width: none; text-align: left; }
  /* Hide the native placeholder while the empty composer shows the nextStep ghost (Lane A). */
  #input.nextstep-ghosting::placeholder { color: transparent; }
  .railpop { position: absolute; left: 0; bottom: calc(100% + 0.55rem); z-index: 60; width: min(20rem, calc(100vw - 1.25rem)); max-height: min(42vh, 20rem); display: flex; flex-direction: column; gap: 0.22rem; overflow: visible; border: 0; border-radius: 0; background: transparent; color: var(--ink); box-shadow: none; pointer-events: none; }
  .railpop > * { pointer-events: auto; }
  .railpop[hidden] { display: none; }
  .railpop.kind-vendor { width: min(8.5rem, calc(100vw - 1.25rem)); }
  .railpop.kind-effort, .railpop.kind-speed { width: min(6rem, calc(100vw - 1.25rem)); }
  .railpop.kind-model { width: min(10.5rem, calc(100vw - 1.25rem)); }
  .railpop-body { min-height: 0; max-height: min(38vh, 18rem); overflow-y: auto; padding: 0.3rem; border: 1px solid color-mix(in srgb, var(--line-2) 72%, transparent); border-radius: 10px; background: color-mix(in srgb, var(--surface) 96%, transparent); box-shadow: var(--shadow-pop); backdrop-filter: blur(12px) saturate(1.08); }
  .rail-option { width: 100%; min-height: 1.9rem; display: flex; align-items: center; gap: 0.4rem; padding: 0.32rem 0.48rem; border: 0; border-radius: 6px; background: transparent; color: var(--ink-2); box-shadow: none; text-align: left; font-size: 0.73rem; }
  .rail-option + .rail-option { margin-top: 0.05rem; }
  .rail-option:hover { background: color-mix(in srgb, var(--surface-2) 78%, transparent); box-shadow: none; }
  .rail-option.on { color: var(--ink); background: var(--accent-soft); }
  .rail-option-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rail-option-vendor-mark { width: 0.46rem; height: 0.46rem; flex-shrink: 0; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 18%, transparent); }
  .rail-option[data-vendor="claude"] .rail-option-label, .rail-option[data-vendor="claude"] .rail-option-vendor-mark { color: var(--vendor-claude-fg); }
  .rail-option[data-vendor="codex"] .rail-option-label, .rail-option[data-vendor="codex"] .rail-option-vendor-mark { color: var(--vendor-codex-fg); }
  .rail-option[data-vendor="cursor"] .rail-option-label, .rail-option[data-vendor="cursor"] .rail-option-vendor-mark { color: var(--vendor-cursor-fg); }
  .rail-option-note { flex-shrink: 0; color: var(--ink-4); font-size: 0.62rem; }
  .rail-empty { padding: 0.85rem 0.65rem; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink-4); box-shadow: var(--shadow-sm); font-size: 0.74rem; text-align: center; }
  .rail-items { display: flex; flex-direction: column; gap: 0.05rem; }
  .rail-item { min-width: 0; display: flex; align-items: center; gap: 0.42rem; padding: 0.38rem 0.4rem; border: 0; border-radius: 6px; background: transparent; box-shadow: none; }
  .rail-item:hover { background: color-mix(in srgb, var(--surface-2) 78%, transparent); box-shadow: none; }
  .rail-item.done .rail-item-text { color: var(--ink-4); text-decoration: line-through; }
  .rail-todo-check { appearance: none; width: 0.78rem; height: 0.78rem; margin: 0 0.04rem; flex-shrink: 0; display: grid; place-content: center; border: 1px solid var(--todo-border); border-radius: 3px; background: transparent; cursor: pointer; transition: background 0.12s, border-color 0.12s, box-shadow 0.12s; }
  .rail-todo-check::before { content: ''; width: 0.24rem; height: 0.4rem; border: solid var(--surface); border-width: 0 1.5px 1.5px 0; opacity: 0; transform: translateY(-0.04rem) rotate(45deg) scale(0.7); transition: opacity 0.1s, transform 0.1s; }
  .rail-todo-check:hover { border-color: var(--todo-fg); background: var(--todo-bg); }
  .rail-todo-check:checked { border-color: var(--todo-fg); background: var(--todo-fg); }
  .rail-todo-check:checked::before { opacity: 1; transform: translateY(-0.04rem) rotate(45deg) scale(1); }
  .rail-todo-check:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--todo-fg) 22%, transparent); }
  .rail-item-text { flex: 1; min-width: 0; min-height: 1.45rem; display: flex; align-items: center; padding: 0; border: 0; background: transparent; color: var(--ink-2); box-shadow: none; font: inherit; font-size: 0.77rem; line-height: 1.35; text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; }
  .rail-item-text:hover { color: var(--ink); background: transparent; }
  .rail-item-order { flex-shrink: 0; display: inline-flex; align-items: center; }
  .rail-item-order .qaction:disabled { color: var(--ink-4); background: transparent; opacity: 0.42; }
  .rail-item-edit { width: 100%; min-width: 0; display: flex; align-items: flex-end; gap: 0.38rem; }
  .composer .rail-item-edit textarea, .composer .rail-add textarea { flex: 1; width: auto; min-width: 0; height: auto; min-height: 1.8rem; max-height: 6rem; resize: none; overflow-y: hidden; font: inherit; font-size: 0.77rem; line-height: 1.35; }
  .composer .rail-item-edit textarea { padding: 0.34rem 0.46rem; border: 1px solid var(--accent); border-radius: 6px; background: var(--input-bg); color: var(--ink); box-shadow: 0 0 0 2px var(--accent-ring); }
  .rail-add { flex-shrink: 0; display: flex; align-items: flex-end; gap: 0.4rem; padding: 0.08rem; border: 0; background: transparent; }
  .rail-items + .rail-add { margin-top: 0.12rem; padding-top: 0.3rem; border-top: 1px solid var(--row-line); }
  .composer .rail-add textarea { padding: 0.42rem 0.55rem; border: 1px solid var(--line-2); border-radius: 8px; background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }
  .rail-add > button { align-self: stretch; display: inline-flex; align-items: center; justify-content: center; }
  .composer .rail-item-edit textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-ring); }
  .composer .rail-add textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
  .rail-add button, .rail-item-edit-save { flex-shrink: 0; min-height: 1.72rem; padding: 0 0.55rem; border-color: var(--primary-bg); background: var(--primary-bg); color: var(--primary-fg); font-size: 0.7rem; }
  .rail-add button:hover:not(:disabled), .rail-item-edit-save:hover:not(:disabled) { border-color: var(--primary-hover); background: var(--primary-hover); }
  .composerrow { position: relative; display: flex; flex-direction: column; align-items: stretch; min-height: 4.55rem; }
  .pinref-picker { position: absolute; left: 0; right: 0; bottom: calc(100% + 0.42rem); z-index: 12; max-height: min(42dvh, 21rem); overflow-y: auto; padding: 0.34rem; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); box-shadow: var(--shadow-pop); }
  .pinref-picker[hidden] { display: none; }
  .pinref-picker-head { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; padding: 0.18rem 0.35rem 0.32rem; color: var(--ink-4); font-size: 0.65rem; }
  .pinref-picker-list { display: flex; flex-direction: column; gap: 0.08rem; }
  .pinref-option { width: 100%; min-width: 0; display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 0.46rem; padding: 0.46rem 0.52rem; border: 0; border-radius: 7px; background: transparent; color: var(--ink-2); box-shadow: none; text-align: left; }
  .pinref-option:hover, .pinref-option.active { background: var(--accent-soft); color: var(--ink); box-shadow: none; }
  .pinref-option-icon { width: 0.72rem; height: 0.72rem; color: var(--ink-4); }
  .pinref-option-copy { min-width: 0; }
  .pinref-option-meta { display: flex; align-items: center; gap: 0.38rem; margin-bottom: 0.08rem; color: var(--ink-4); font-size: 0.62rem; }
  .pinref-option-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.76rem; }
  .pinref-option-comments { flex-shrink: 0; padding: 0.08rem 0.32rem; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 0.6rem; }
  .pinref-empty { padding: 0.82rem 0.6rem; color: var(--ink-4); font-size: 0.74rem; text-align: center; }
  .composer-shortcut-ghost { position: absolute; inset: 0; z-index: 0; box-sizing: border-box; width: 100%; height: 100%; padding: 0.3rem 0.35rem 2.55rem; border: 0; border-radius: var(--radius-sm); font: inherit; font-size: 0.88rem; line-height: 1.45; white-space: pre-wrap; overflow-wrap: break-word; overflow: hidden; color: transparent; pointer-events: none; }
  .composer-shortcut-ghost[hidden] { display: none; }
  .composer-shortcut-ghost-suffix { color: color-mix(in srgb, var(--ink-4) 78%, transparent); }
  .composer-shortcut-ghost-key { display: inline-block; margin-left: 0.45em; padding: 0.02em 0.34em; border: 1px solid color-mix(in srgb, var(--ink-4) 38%, transparent); border-radius: 4px; color: color-mix(in srgb, var(--ink-4) 72%, transparent); font-size: 0.68em; line-height: 1.25; vertical-align: 0.08em; }
  .composerrow > textarea { position: relative; z-index: 1; }
  .composer textarea { flex: 0 0 auto; min-width: 0; width: 100%; resize: none; height: 4.55rem; min-height: 4.55rem; max-height: 12rem; padding: 0.3rem 0.35rem 2.55rem; border: 0; border-radius: var(--radius-sm); font: inherit; font-size: 0.88rem; line-height: 1.45; overflow-wrap: break-word; background: transparent; color: var(--ink); box-shadow: none; overflow-y: hidden; }
  .composer textarea:focus { box-shadow: none; }
  .composeractions { position: absolute; left: 0.35rem; right: 0.35rem; bottom: 0.18rem; z-index: 2; display: flex; justify-content: flex-end; align-items: center; gap: 0.32rem; min-width: 0; pointer-events: none; }
  .composeractions > * { pointer-events: auto; }
  .actiongroup { flex: 0 0 auto; display: inline-flex; align-items: stretch; gap: 0; }
  .actiongroup > button { margin: 0; border-radius: 0; }
  .actiongroup > button + button { margin-left: -1px; }
  .actiongroup > button:first-child { border-top-left-radius: var(--radius-sm); border-bottom-left-radius: var(--radius-sm); }
  .actiongroup > button:last-child { border-top-right-radius: var(--radius-sm); border-bottom-right-radius: var(--radius-sm); }
  .actiongroup .splitbtn-ico { margin-left: 0.18rem; }
  .schedulebtn { width: 1.8rem; height: 1.8rem; min-height: 1.8rem; flex: 0 0 1.8rem; display: inline-flex; align-items: center; justify-content: center; padding: 0; border-color: var(--line-2); background: var(--surface); color: var(--ink-3); box-shadow: var(--shadow-sm); }
  .schedulebtn:hover:not(:disabled), .schedulebtn[aria-expanded="true"] { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); box-shadow: none; z-index: 1; }
  .schedulebtn svg { width: 0.88rem; height: 0.88rem; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .schedulepop { position: fixed; z-index: 180; width: min(22.5rem, calc(100vw - 1.5rem)); box-sizing: border-box; padding: 0.55rem; border: 1px solid color-mix(in srgb, var(--line-2) 72%, transparent); border-radius: 12px; background: color-mix(in srgb, var(--surface) 97%, transparent); color: var(--ink); box-shadow: var(--shadow-pop); backdrop-filter: blur(14px) saturate(1.08); }
  .schedulepop[hidden] { display: none; }
  .schedulepop-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin: 0.05rem 0.1rem 0.48rem; }
  .schedulepop-title { font-size: 0.75rem; font-weight: 750; color: var(--ink); }
  .schedulepop-zone { font-size: 0.64rem; color: var(--ink-4); }
  .scheduleactions { flex: 0 0 auto; display: flex; justify-content: flex-end; align-items: center; gap: 0.32rem; }
  .scheduleactions:empty { display: none; }
  .scheduleaction { flex: 0 0 auto; min-height: 1.9rem; padding: 0 0.7rem; font-size: 0.72rem; }
  .scheduleaction.primary { color: var(--primary-fg); border-color: var(--primary-bg); background: var(--primary-bg); font-weight: 650; }
  .scheduleaction.primary:hover:not(:disabled) { border-color: var(--primary-hover); background: var(--primary-hover); }
  .schedulerow { display: flex; align-items: center; gap: 0.38rem; }
  .scheduledatetime { flex: 1 1 auto; min-width: 8.6rem; height: 2rem; display: inline-flex; align-items: center; gap: 0.34rem; padding-left: 0.52rem; overflow: hidden; border: 1px solid var(--line-2); border-radius: 8px; background: var(--input-bg); color: var(--ink-3); }
  .scheduledatetime:hover, .scheduledatetime:focus-within { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-ring); color: var(--ink); }
  .scheduledatetime svg { width: 0.82rem; height: 0.82rem; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .scheduledatetime input { flex: 1; min-width: 0; height: 100%; padding: 0; border: 0; background: transparent; box-shadow: none; color: var(--ink); font: inherit; font-size: 0.7rem; font-variant-numeric: tabular-nums; }
  .scheduledatetime input:focus { border: 0; box-shadow: none; }
  .scheduledatetime-toggle { width: 1.7rem; height: 100%; flex-shrink: 0; padding: 0; border: 0; border-left: 1px solid var(--line); border-radius: 0; background: transparent; box-shadow: none; color: var(--ink-4); }
  .scheduledatetime-toggle:hover, .scheduledatetime-toggle[aria-expanded="true"] { border-color: var(--line); background: var(--button-hover); color: var(--ink); }
  .schedulepicker { margin-top: 0.48rem; padding: 0.42rem; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-2); }
  .schedulepicker[hidden] { display: none; }
  .schedulepicker-head { display: grid; grid-template-columns: 1.8rem minmax(0,1fr) 1.8rem; align-items: center; margin-bottom: 0.28rem; }
  .schedulepicker-nav { width: 1.8rem; height: 1.7rem; padding: 0; border-color: transparent; background: transparent; box-shadow: none; color: var(--ink-3); font-size: 1.05rem; }
  .schedulepicker-nav:hover { border-color: transparent; background: var(--button-hover); color: var(--ink); }
  .schedulepicker-month { text-align: center; color: var(--ink); font-size: 0.72rem; font-weight: 700; }
  .schedulepicker-week, .schedulepicker-days { display: grid; grid-template-columns: repeat(7,minmax(0,1fr)); gap: 0.12rem; }
  .schedulepicker-week span { padding: 0.18rem 0; color: var(--ink-4); font-size: 0.58rem; font-weight: 650; text-align: center; }
  .schedulepicker-day { min-width: 0; height: 1.72rem; padding: 0; border-color: transparent; background: transparent; box-shadow: none; color: var(--ink-2); font-size: 0.68rem; }
  .schedulepicker-day:hover:not(:disabled) { border-color: transparent; background: var(--button-hover); color: var(--ink); }
  .schedulepicker-day.today { color: var(--accent); font-weight: 750; }
  .schedulepicker-day.selected { border-color: var(--accent); background: var(--accent); color: white; font-weight: 750; }
  .schedulepicker-day:disabled { opacity: 0.22; }
  .schedulepicker-empty { height: 1.72rem; }
  .scheduletime { display: flex; align-items: center; justify-content: center; gap: 0.24rem; margin-top: 0.38rem; padding-top: 0.42rem; border-top: 1px solid var(--line); }
  .scheduletime-label { margin-right: 0.25rem; color: var(--ink-4); font-size: 0.64rem; }
  .scheduletime input { width: 2.35rem; height: 1.72rem; padding: 0.18rem 0.28rem; border: 1px solid var(--line-2); border-radius: 6px; background: var(--input-bg); color: var(--ink); font: inherit; font-size: 0.72rem; font-variant-numeric: tabular-nums; text-align: center; }
  .scheduletime-sep { color: var(--ink-4); font-size: 0.72rem; }
  .scheduletime-choices { display: grid; grid-template-columns: minmax(0,1fr) 5.8rem; gap: 0.45rem; margin-top: 0.42rem; }
  .scheduletime-choice-label { display: block; margin-bottom: 0.2rem; color: var(--ink-4); font-size: 0.58rem; font-weight: 650; }
  .scheduletime-hours { display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); gap: 0.1rem; }
  .scheduletime-minutes { display: grid; grid-template-columns: minmax(0,1fr); gap: 0.1rem; }
  .scheduletime-option { min-width: 0; height: 1.42rem; padding: 0; border-color: transparent; background: transparent; box-shadow: none; color: var(--ink-3); font-size: 0.61rem; font-variant-numeric: tabular-nums; }
  .scheduletime-option:hover:not(:disabled) { border-color: transparent; background: var(--button-hover); color: var(--ink); }
  .scheduletime-option.selected { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); font-weight: 750; }
  .schedulemsg { min-height: 0.9rem; margin: 0.35rem 0.1rem 0; color: var(--warning); font-size: 0.66rem; }
  /* attachments live as chips in the input's bottom-left corner; click a chip to preview it */
  .composeractions .attachtray { flex: 1 1 auto; min-width: 0; margin: 0; justify-content: flex-start; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  .composeractions .attachtray::-webkit-scrollbar { display: none; }
  .composeractions .attachchip { flex: 0 1 auto; }
  .composeractions .attachmsg { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .runconfig-anchor { position: relative; flex: 1 1 7rem; min-width: 0; max-width: 13rem; }
  .composer .attachpick { position: static; transform: none; width: 1.5rem; height: 1.5rem; flex-shrink: 0; color: var(--ink-3); }
  .composer .attachpick svg { width: 0.74rem; height: 0.74rem; stroke-width: 1.65; }
  .composer .attachpick:active { transform: translateY(0.5px); }
  /* goal rests as a plain railbtn with a hollow target glyph; armed/active layer the session
     vendor's tint on top and light the target's center. While a turn runs, an active goal's dot
     breathes with gpulse (the same "generating" language as thinking bubbles and pending tools);
     with no goal the toggle waits — dimmed but legible, never invisible. */
  .goal-toggle .goal-ico { width: 0.72rem; height: 0.72rem; flex-shrink: 0; }
  .goal-toggle .goal-ring { fill: none; stroke: currentColor; stroke-width: 1.5; }
  .goal-toggle .goal-dot { fill: currentColor; opacity: 0; transition: opacity 0.15s; }
  .goal-toggle[data-vendor="claude"] { --goal-fg: var(--vendor-claude-fg); --goal-bg: var(--vendor-claude-bg); --goal-border: var(--vendor-claude-border); --goal-hover-bg: var(--vendor-claude-hover-bg); --goal-hover-border: var(--vendor-claude-hover-border); }
  .goal-toggle[data-vendor="codex"] { --goal-fg: var(--vendor-codex-fg); --goal-bg: var(--vendor-codex-bg); --goal-border: var(--vendor-codex-border); --goal-hover-bg: var(--vendor-codex-hover-bg); --goal-hover-border: var(--vendor-codex-hover-border); }
  .goal-toggle.armed, .goal-toggle.armed:hover:not(:disabled), .goal-toggle.active, .goal-toggle.active:hover:not(:disabled) { color: var(--goal-fg); border-color: var(--goal-border); background: var(--goal-bg); }
  .goal-toggle.active, .goal-toggle.active:hover:not(:disabled) { border-color: var(--goal-hover-border); background: var(--goal-hover-bg); box-shadow: 0 0 0 2px color-mix(in srgb, var(--goal-border) 22%, transparent); }
  .goal-toggle.armed .goal-dot, .goal-toggle.active .goal-dot { opacity: 1; }
  .goal-toggle.pursuing .goal-dot { animation: gpulse 1.6s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .goal-toggle.pursuing .goal-dot { animation: none; } }
  .goal-toggle:disabled { opacity: 0.5; cursor: default; }
  .attachtray { display: none; flex-wrap: wrap; gap: 0.35rem; }
  .attachtray.show { display: flex; }
  .attachchip { display: inline-flex; align-items: center; gap: 0.34rem; min-width: 0; max-width: 100%; padding: 0.18rem 0.45rem; border-radius: 999px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink-2); font-size: 0.72rem; box-shadow: var(--shadow-sm); }
  .attachchip[role="button"] { cursor: pointer; }
  .attachchip[role="button"]:hover { border-color: var(--accent); color: var(--ink); }
  .attachchip .kind { flex-shrink: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #4338ca; background: #eef2ff; border-radius: 999px; padding: 0.04rem 0.28rem; }
  .attachchip .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .attachchip button { border: 0; background: transparent; color: #64748b; box-shadow: none; padding: 0; font-size: 0.88rem; line-height: 1; }
  .attachchip button:hover { color: #b91c1c; background: transparent; }
  .attachchip.pinrefchip { border-color: color-mix(in srgb, var(--accent) 32%, var(--line-2)); background: color-mix(in srgb, var(--accent-soft) 58%, var(--surface)); }
  .attachchip.pinrefchip .kind { color: var(--accent); background: transparent; padding: 0; font-size: 0.82rem; text-transform: none; }
  .attachchip.pinrefchip .commentmark { flex-shrink: 0; color: var(--accent); font-size: 0.62rem; }
  .msgrefs { display: flex; flex-wrap: wrap; gap: 0.28rem; margin-top: 0.48rem; padding-top: 0.42rem; border-top: 1px solid color-mix(in srgb, currentColor 16%, transparent); }
  .msgref { display: inline-flex; align-items: center; gap: 0.26rem; min-width: 0; max-width: 100%; padding: 0.14rem 0.4rem; border: 1px solid color-mix(in srgb, currentColor 24%, transparent); border-radius: var(--radius-pill); background: color-mix(in srgb, var(--surface) 46%, transparent); font-size: 0.66rem; line-height: 1.25; }
  .msgref-kind { flex-shrink: 0; color: var(--accent); font-size: 0.76rem; font-weight: 800; }
  .msgref-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .msgref-comments { flex-shrink: 0; color: var(--accent); font-size: 0.6rem; font-weight: 700; }
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
  .imgpreview-stage { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; max-width: 100%; max-height: 100%; transform-origin: center center; will-change: transform; }
  .imgpreview-html { display: flex; align-items: center; justify-content: center; max-width: 100%; max-height: 100%; }
  .imgpreview img, .imgpreview-html > svg { display: block; max-width: min(96vw, 1280px); max-height: min(82vh, calc(100vh - 5.5rem)); width: auto; height: auto; object-fit: contain; border-radius: 8px; background: rgba(255,255,255,0.04); box-shadow: 0 22px 60px rgba(0,0,0,0.46); -webkit-user-drag: none; user-select: none; }
  .imgpreview-html:empty { display: none; }
  .imgpreview-html > svg { background: #fff; padding: 0.5rem; box-sizing: border-box; }
  .imgpreview-bar { width: min(96vw, 1280px); display: flex; align-items: center; gap: 0.75rem; color: #e5e7eb; }
  .imgpreview-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.82rem; }
  .workstats { position: fixed; inset: 0; z-index: 130; display: grid; place-items: center; padding: 1rem; background: rgba(2,6,23,0.58); }
  .workstats[hidden] { display: none; }
  .tagaction { position: fixed; inset: 0; z-index: 150; display: grid; place-items: center; padding: 1rem; background: rgba(2,6,23,0.58); }
  .tagaction[hidden] { display: none; }
  .tagaction-panel { width: min(28rem, calc(100vw - 2rem)); padding: 1rem; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); color: var(--ink); box-shadow: var(--shadow-pop); }
  .tagaction-title { font-size: 0.92rem; font-weight: 800; }
  .tagaction-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.45rem; margin-top: 1rem; }
  .tagaction-actions button { font-size: 0.72rem; }
  .tagaction-clear { color: var(--ink-2); background: var(--surface-2); }
  .tagaction-delete { color: #fff; border-color: #b91c1c; background: #b91c1c; }
  .tagaction-delete:hover { border-color: #991b1b; background: #991b1b; }
  .workstats-panel { width: min(1040px, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); overflow-y: auto; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); color: var(--ink); box-shadow: var(--shadow-pop); }
  .workstats-head { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 0.8rem; padding: 0.85rem 1rem; border-bottom: 1px solid var(--line); background: var(--surface); }
  .workstats-heading { flex: 1; min-width: 0; }
  .workstats-title { font-size: 1rem; font-weight: 800; }
  .workstats-sub { margin-top: 0.15rem; color: var(--ink-3); font-size: 0.72rem; }
  .workstats-periods { display: inline-flex; flex-wrap: wrap; padding: 0.15rem; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-2); }
  .workstats-period { min-width: 2.7rem; padding: 0.3rem 0.5rem; border: 0; border-radius: 4px; background: transparent; color: var(--ink-3); box-shadow: none; font-size: 0.72rem; font-weight: 700; }
  .workstats-period[aria-pressed="true"] { background: var(--primary-bg); color: var(--primary-fg); }
  .workstats-close { width: 1.9rem; height: 1.9rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--ink-3); background: transparent; box-shadow: none; }
  .workstats-close svg { width: 0.85rem; height: 0.85rem; stroke: currentColor; stroke-width: 1.8; fill: none; stroke-linecap: round; }
  .workstats-body { padding: 1rem; }
  .workstats-loading, .workstats-error, .workstats-empty { padding: 2.5rem 1rem; text-align: center; color: var(--ink-3); font-size: 0.82rem; }
  .workstats-error { color: #b91c1c; }
  .forktree-overlay { position: fixed; inset: 0; z-index: 135; display: grid; place-items: center; padding: 1rem; background: rgba(2,6,23,0.62); }
  .forktree-overlay[hidden] { display: none; }
  .forktree-panel { width: min(1100px, calc(100vw - 2rem)); height: min(70dvh, 640px); min-height: 22rem; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-pop); }
  .forktree-head { flex-shrink: 0; display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 0.8rem 0.7rem 1rem; border-bottom: 1px solid var(--line); }
  .forktree-heading { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 0.55rem; }
  .forktree-title { color: var(--ink); font-size: 0.9rem; font-weight: 800; }
  .forktree-count { color: var(--ink-4); font-size: 0.68rem; font-family: ui-monospace, monospace; }
  .forktree-controls { display: flex; align-items: center; gap: 0.2rem; }
  .forktree-control { width: 1.9rem; height: 1.9rem; display: inline-flex; align-items: center; justify-content: center; padding: 0; color: var(--ink-3); background: transparent; border-color: transparent; box-shadow: none; }
  .forktree-control:hover { color: var(--accent); background: var(--accent-soft); border-color: transparent; }
  .forktree-control svg { width: 0.9rem; height: 0.9rem; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .forktree-viewport { position: relative; flex: 1; min-height: 0; overflow: hidden; background: var(--surface-2); cursor: grab; touch-action: none; }
  .forktree-viewport.dragging { cursor: grabbing; }
  .forktree-pan { position: absolute; left: 0; top: 0; will-change: transform; }
  .forktree-stage { position: relative; left: 0; top: 0; transform-origin: 0 0; }
  .forktree-edges { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
  .forktree-edge { fill: none; stroke: var(--line-2); stroke-width: 1.5; }
  .forktree-node { position: absolute; width: 300px; height: 112px; box-sizing: border-box; padding: 0; overflow: hidden; text-align: left; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--surface); color: var(--ink-2); box-shadow: var(--shadow-sm); }
  .forktree-node:hover { border-color: var(--accent); background: var(--surface); box-shadow: var(--shadow-md); }
  .forktree-node.current { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-ring), var(--shadow-md); }
  .forktree-node.missing { cursor: default; opacity: 0.64; }
  .forktree-node-content { width: var(--forktree-content-size, 100%); height: var(--forktree-content-size, 100%); box-sizing: border-box; display: flex; flex-direction: column; padding: 0.38rem 0.65rem; transform: scale(var(--forktree-content-scale, 1)); transform-origin: left top; }
  .forktree-node-head { display: flex; align-items: center; gap: 0.45rem; min-width: 0; }
  .forktree-node-dot { align-self: center; width: 0.56rem; height: 0.56rem; cursor: default; }
  .forktree-node-dot.it-status:hover { transform: none; }
  .forktree-node-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink); font-size: 0.82rem; font-weight: 700; }
  .forktree-node-title.session-title.has-aux .session-title-main { max-width: 62%; }
  .forktree-node-age { flex-shrink: 0; color: var(--ink-4); font-size: 0.62rem; font-family: ui-monospace, monospace; white-space: nowrap; }
  .forktree-node-signals.it-meta { min-height: 0.85rem; margin-top: 0.18rem; font-size: 0.66rem; }
  .forktree-node .it-firstline { margin-top: 0.16rem; font-size: 0.68rem; }
  .forktree-node-foot { margin-top: auto; padding-top: 0.22rem; border-top: 1px solid var(--row-line); }
  .forktree-node-foot .it-tags { flex-wrap: nowrap; overflow: hidden; }
  .forktree-node-foot .it-tag { flex-shrink: 0; font-size: 0.61rem; padding: 0.06rem 0.34rem; }
  .forktree-node-foot .it-context { max-width: 64%; font-size: 0.62rem; }
  .forktree-node-missing { margin: auto 0; color: var(--ink-4); font-size: 0.68rem; font-family: ui-monospace, monospace; }
  .work-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-bottom: 1px solid var(--line); }
  .work-kpi { min-width: 0; padding: 0 0.8rem 0.85rem; border-right: 1px solid var(--line); }
  .work-kpi:first-child { padding-left: 0; }
  .work-kpi:last-child { border-right: 0; }
  .work-kpi-value { color: var(--ink); font-size: 1.35rem; font-weight: 800; font-variant-numeric: tabular-nums; }
  .work-kpi-label { margin-top: 0.15rem; color: var(--ink-3); font-size: 0.7rem; line-height: 1.35; }
  .work-resource { display: flex; align-items: baseline; gap: 0.55rem; flex-wrap: wrap; padding: 0.7rem 0; color: var(--ink-3); font-size: 0.74rem; }
  .work-resource strong { color: var(--ink-2); font-weight: 700; }
  .work-section { padding: 0.9rem 0; border-top: 1px solid var(--line); }
  .work-section:first-of-type { border-top: 0; }
  .work-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.8rem; margin-bottom: 0.65rem; }
  .work-section-title { font-size: 0.84rem; font-weight: 800; color: var(--ink); }
  .work-section-note { color: var(--ink-4); font-size: 0.68rem; text-align: right; }
  .work-distribution { display: grid; gap: 0.45rem; }
  .work-distributions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 1.5rem; }
  .work-distribution-row { display: grid; grid-template-columns: minmax(7rem, 0.45fr) minmax(8rem, 1fr) auto; align-items: center; gap: 0.65rem; color: var(--ink-2); font-size: 0.72rem; }
  .work-distribution-track { height: 0.42rem; overflow: hidden; border-radius: 999px; background: var(--surface-3); }
  .work-distribution-fill { height: 100%; min-width: 2px; border-radius: inherit; background: var(--accent); }
  .work-distribution-value { color: var(--ink-3); font-variant-numeric: tabular-nums; }
  .work-line-scroll { overflow-x: auto; padding-bottom: 0.15rem; }
  .work-line-chart { min-width: 100%; height: 9rem; display: block; overflow: visible; border-bottom: 1px solid var(--line-2); }
  .work-line-grid { stroke: var(--line-2); stroke-width: 1; }
  .work-line-path { fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  .work-line-path.focus, .work-line-point.focus { stroke: var(--priority-3-fg); fill: var(--priority-3-fg); }
  .work-line-path.balanced, .work-line-point.balanced { stroke: var(--accent); fill: var(--accent); }
  .work-line-path.parallel, .work-line-point.parallel { stroke: var(--warning); fill: var(--warning); }
  .work-line-point { stroke: var(--surface); stroke-width: 1.5; }
  .work-line-labels { display: flex; justify-content: space-between; margin-top: 0.28rem; color: var(--ink-4); font-size: 0.62rem; white-space: nowrap; }
  .work-legend { display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap; margin-top: 0.55rem; color: var(--ink-3); font-size: 0.68rem; }
  .work-legend-item { display: inline-flex; align-items: center; gap: 0.3rem; }
  .work-swatch { width: 0.55rem; height: 0.55rem; border-radius: 2px; background: var(--status-read); }
  .work-swatch.focus { background: var(--priority-3-fg); }
  .work-swatch.balanced { background: var(--accent); }
  .work-swatch.parallel { background: var(--warning); }
  .work-table-wrap { overflow-x: auto; }
  .work-table { width: 100%; border-collapse: collapse; font-size: 0.74rem; }
  .work-table th, .work-table td { padding: 0.5rem 0.55rem; border-bottom: 1px solid var(--row-line); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .work-table th { color: var(--ink-4); font-size: 0.64rem; font-weight: 700; }
  .work-table th:first-child, .work-table td:first-child { padding-left: 0; text-align: left; }
  .work-mode-name { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--ink-2); font-weight: 700; }
  .work-mode-name .work-swatch { flex-shrink: 0; }
  .work-readout { margin-top: 0.65rem; color: var(--ink-3); font-size: 0.72rem; line-height: 1.5; }
  @media (min-width: 761px) and (max-height: 1100px) {
    .workstats { padding: 0.5rem; }
    .workstats-panel { max-height: calc(100dvh - 1rem); }
    .workstats-head { padding: 0.6rem 0.8rem; }
    .workstats-body { padding: 0.7rem 0.8rem; }
    .work-kpi { padding-bottom: 0.55rem; }
    .work-kpi-value { font-size: 1.15rem; }
    .work-resource { padding: 0.45rem 0; }
    .work-section { padding: 0.55rem 0; }
    .work-section-head { margin-bottom: 0.4rem; }
    .work-distribution { gap: 0.22rem; }
    .work-distribution-row { gap: 0.45rem; font-size: 0.68rem; }
    .work-distribution-track { height: 0.34rem; }
    .work-line-chart { height: 6rem; }
    .work-legend { margin-top: 0.35rem; }
    .work-table th, .work-table td { padding-top: 0.32rem; padding-bottom: 0.32rem; }
    .work-readout { margin-top: 0.4rem; line-height: 1.35; }
  }
  .foot button.send, .commentfoot button.send { height: 1.8rem; min-height: 1.8rem; background: var(--primary-bg); color: var(--primary-fg); border-color: var(--primary-bg); padding: 0 0.78rem; font-weight: 600; box-shadow: var(--shadow-sm); }
  .foot button.send:hover:not(:disabled), .commentfoot button.send:hover:not(:disabled) { background: var(--primary-hover); border-color: var(--primary-hover); box-shadow: 0 4px 14px var(--accent-ring); }
  .foot button.send.stopping, .commentfoot button.send.stopping { background: #b91c1c; border-color: #b91c1c; }
  .foot button.send.stopping:hover, .commentfoot button.send.stopping:hover { background: #991b1b; }
  .foot button.runbtn { width: 100%; height: 1.8rem; min-height: 1.8rem; max-width: 13rem; color: #334155; border-color: #cbd5e1; background: var(--surface); padding: 0 0.58rem; font-size: 0.72rem; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .foot button.runbtn:hover:not(:disabled) { background: var(--surface-2); border-color: #94a3b8; }
  .foot button.runbtn.dirty { color: #3730a3; border-color: #a5b4fc; background: #eef2ff; }
  .foot button.runbtn.dirty:hover:not(:disabled) { color: #312e81; border-color: #818cf8; background: #e0e7ff; box-shadow: 0 0 0 2px rgba(99,102,241,0.14); }
  .foot button.runbtn:disabled { color: #cbd5e1; background: var(--surface-2); cursor: default; }
  /* messages typed mid-turn: queued client-side, pinned above the composer
   *  (Codex-style), each editable/removable, and sendable on demand. */
  #queue { flex: 0 0 auto; z-index: 21; display: flex; flex-direction: column; gap: 0.3rem; max-height: 30vh; overflow-y: auto; padding: 0.4rem 1rem 0; }
  #queue:empty { display: none; }
  .qitem { display: flex; align-items: center; gap: 0.45rem; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 0.3rem 0.4rem 0.3rem 0.55rem; }
  .qitem .qtag { font-size: 0.62rem; color: #4338ca; background: #e0e7ff; border-radius: 3px; padding: 0.05rem 0.32rem; flex-shrink: 0; }
  .qitem .qtext { flex: 1; min-width: 0; font-size: 0.82rem; color: #312e81; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .qitem button { flex-shrink: 0; }
  .qitem .qdispatch { width: 3.4rem; box-sizing: border-box; flex-shrink: 0; font-size: 0.72rem; text-align: center; }
  .qitem .qwaiting { color: #6366f1; font-weight: 650; }
  .qitem.scheduled { background: color-mix(in srgb, var(--surface) 78%, #eef2ff); }
  .qitem.blocked { border-color: var(--warning); background: var(--warning-soft); }
  .qitem .qtime { flex-shrink: 0; color: var(--ink-4); font-size: 0.68rem; font-variant-numeric: tabular-nums; }
  .qitem button.qsend { padding: 0.1rem 0.45rem; color: var(--primary-fg); background: var(--primary-bg); border-color: var(--primary-bg); font-weight: 600; }
  .qitem button.qsend:hover:not(:disabled) { background: var(--primary-hover); border-color: var(--primary-hover); }
  .qaction { width: 1.7rem; height: 1.7rem; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; padding: 0; border-color: transparent; background: transparent; box-shadow: none; color: #6366f1; }
  .qaction:hover { color: #4338ca; border-color: transparent; background: rgba(99,102,241,0.12); box-shadow: none; }
  .qaction svg { width: 0.82rem; height: 0.82rem; stroke: currentColor; stroke-width: 1.9; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  button.qdel { color: #dc2626; }
  button.qdel:hover { color: #b91c1c; background: #fef2f2; }
  .qitem.editing .qeditbox { width: 100%; min-width: 0; display: flex; align-items: center; gap: 0.45rem; }
  .qitem.editing .qeditta { flex: 1; min-width: 0; height: 1.7rem; box-sizing: border-box; font: inherit; font-size: 0.82rem; line-height: 1.2; padding: 0.22rem 0.45rem; border: 1px solid var(--accent); border-radius: var(--radius-sm); background: var(--input-bg); color: var(--ink); box-shadow: 0 0 0 2px var(--accent-ring); }
  .foot button.splitbtn { height: 1.8rem; min-height: 1.8rem; padding: 0 0.68rem; }
  .splitbtn-ico { width: 0.82rem; height: 0.82rem; margin-left: 0.22rem; stroke: currentColor; stroke-width: 1.9; fill: none; stroke-linecap: round; stroke-linejoin: round; vertical-align: -0.15em; }
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
  html[data-theme="dark"] .viewtabgroup.on { color: #c7d2fe; background: #1e1b4b; border-color: #6366f1; }
  html[data-theme="dark"] .viewtabgroup.on { box-shadow: 0 0 0 1px rgba(129,140,248,0.24); }
  html[data-theme="dark"] .viewtabgroup.on .viewtab.on { background: transparent; box-shadow: none; }
  html[data-theme="dark"] .viewtabgroup.on .viewtabx { border-left-color: rgba(129,140,248,0.26); }
  html[data-theme="dark"] .viewtabgroup.on .viewtabx:hover { color: #fecdd3; background: rgba(127,29,29,0.28); }
  html[data-theme="dark"] .prilabel:hover { filter: brightness(1.08); box-shadow: none; }
  html[data-theme="dark"] .prilabel.l1 { color: #fca5a5; background: rgba(220,38,38,0.14); }
  html[data-theme="dark"] .prilabel.l2 { color: #fbbf24; background: rgba(245,158,11,0.14); }
  html[data-theme="dark"] .prilabel.l3 { color: #5eead4; background: rgba(16,185,129,0.14); }
  html[data-theme="dark"] .prilabel.l4 { color: #93c5fd; background: rgba(37,99,235,0.14); }
  html[data-theme="dark"] .prilabel.l5 { color: #cbd5e1; background: rgba(100,116,139,0.16); }
  html[data-theme="dark"] .b-eta { color: #fde68a; background: #3a2608; }
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
  html[data-theme="dark"] .it-context .vtag.claude { color: var(--vendor-claude-fg); }
  html[data-theme="dark"] .it-context .vtag.codex { color: var(--vendor-codex-fg); }
  html[data-theme="dark"] .it-context .vtag.cursor { color: var(--vendor-cursor-fg); }
  html[data-theme="dark"] .it-context .ptag { color: var(--project-fg-dark, #cbd5e1); }
  html[data-theme="dark"] .it-live-total { color: var(--status-generating); }
  html[data-theme="dark"] .it-live.generated .it-live-total { color: var(--status-unread); }
  html[data-theme="dark"] .it-live.stopped .it-live-total { color: #fbbf24; }
  html[data-theme="dark"] .it-live.failed .it-live-total { color: #f87171; }
  html[data-theme="dark"] .it-live-quiet.warm { color: #fbbf24; }
  html[data-theme="dark"] .it-live-quiet.hot { color: #f87171; }
  html[data-theme="dark"] .it-queue { color: #c4b5fd; background: rgba(99,102,241,0.16); }
  html[data-theme="dark"] .it-queue.parked { color: #fbbf24; background: rgba(245,158,11,0.14); }
  html[data-theme="dark"] .tipmeta { background: rgba(148,163,184,0.08); border-color: rgba(148,163,184,0.22); }
  html[data-theme="dark"] .tipmeta-v { color: #dbe4ee; }
  html[data-theme="dark"] .tipmeta .vtag.claude { color: var(--vendor-claude-fg); background: transparent; border-color: transparent; }
  html[data-theme="dark"] .tipmeta .vtag.codex { color: var(--vendor-codex-fg); background: transparent; border-color: transparent; }
  html[data-theme="dark"] .tipmeta .vtag.cursor { color: var(--vendor-cursor-fg); background: transparent; border-color: transparent; }
  html[data-theme="dark"] .tipmeta .ptag { color: var(--project-fg-dark, #cbd5e1); }
  html[data-theme="dark"] .msg.error .bubble,
  html[data-theme="dark"] .newbox .nmsg .provider-error-card,
  html[data-theme="dark"] .toolc .tool-out.err { background: #451a1a; color: #fecaca; border-color: #7f1d1d; }
  html[data-theme="dark"] .provider-error-command code { border-color: rgba(254,202,202,0.2); background: rgba(15,23,42,0.35); }
  html[data-theme="dark"] .provider-error-button { border-color: rgba(254,202,202,0.28); background: rgba(15,23,42,0.35); color: #fecaca; }
  html[data-theme="dark"] .provider-error-button:hover:not(:disabled) { border-color: #f87171; background: rgba(15,23,42,0.65); color: #ffffff; }
  html[data-theme="dark"] .msg.user .bubble .diagram-error,
  html[data-theme="dark"] .msg.user .bubble .filepath.badpath { color: #fca5a5; }
  html[data-theme="dark"] .toolc[data-tool-error="true"] { border-color: #f87171; box-shadow: none; }
  html[data-theme="dark"] .dline.add { background: #052e1c; color: #bbf7d0; }
  html[data-theme="dark"] .dline.del { background: #451a1a; color: #fecaca; }
  html[data-theme="dark"] .dline.ctx { color: var(--ink-3); }
  html[data-theme="dark"] .qitem { background: #1e1b4b; border-color: #4f46e5; }
  html[data-theme="dark"] .qitem .qtag { color: #c7d2fe; background: #312e81; }
  html[data-theme="dark"] .qitem .qtext { color: #ddd6fe; }
  html[data-theme="dark"] .qitem .qwaiting { color: #a5b4fc; }
  html[data-theme="dark"] .qaction { color: #a5b4fc; }
  html[data-theme="dark"] .qaction:hover { color: #c7d2fe; background: rgba(129,140,248,0.16); }
  html[data-theme="dark"] button.qdel { color: #fca5a5; }
  html[data-theme="dark"] .foot button.runbtn { color: #cbd5e1; border-color: #475569; background: #172033; }
  html[data-theme="dark"] .foot button.runbtn:hover:not(:disabled) { background: #1e293b; border-color: #64748b; }
  html[data-theme="dark"] .foot button.runbtn.dirty { color: #dbe4ff; border-color: #818cf8; background: rgba(99,102,241,0.22); }
  html[data-theme="dark"] .foot button.runbtn.dirty:hover:not(:disabled) { color: #eef2ff; border-color: #a5b4fc; background: rgba(99,102,241,0.36); box-shadow: 0 0 0 2px rgba(129,140,248,0.18); }
  html[data-theme="dark"] .latestpin-arrow { color: #94a3b8; }
  html[data-theme="dark"] .pinrole { color: #94a3b8; border-color: transparent; background: transparent; }
  html[data-theme="dark"] .pintext { color: #dbe4ee; }
  html[data-theme="dark"] .msg-pin.on .pin-body { fill: rgba(129,140,248,0.2); }
  html[data-theme="dark"] .gtagdel:hover,
  html[data-theme="dark"] .it-tag > button:hover,
  html[data-theme="dark"] button.qdel:hover { background: #451a1a; color: #fecaca; border-color: #7f1d1d; }
  /* custom tags + "+ tag" buttons: brighter teal on dark so the text stays legible */
  html[data-theme="dark"] .gtag:not(.auto):not(.on) .gtagbtn,
  html[data-theme="dark"] .it-tag:not(.auto),
  html[data-theme="dark"] .tagadd-compact,
  html[data-theme="dark"] .it-tagadd { color: #5eead4; }
  html[data-theme="dark"] .tagadd-compact:hover,
  html[data-theme="dark"] .it-tagadd:hover { color: #99f6e4; background: rgba(20,184,166,0.16); border-color: transparent; }
  /* Mobile: one page at a time — the session list, or the chat. Selecting a
     session slides to chat (body.show-chat); the back button returns to the list. */
  @media (max-width: 760px) {
    body { height: 100dvh; }
    .resizer, .session-panel, .session-panel-resizer, .panel-toggle { display: none !important; }
    .side { width: 100% !important; }          /* beat the resizer's inline width */
    .tagchips { max-height: 35dvh; overflow-y: auto; }
    .main { width: 100%; display: none; }       /* chat hidden until a session opens */
    body.show-chat .side { display: none; }
    body.show-chat .main { display: flex; }
    .chat-tabs { display: none !important; }
    .newrow { flex-direction: column; align-items: stretch; }
    .newrow .pickgrp.effort, .newrow .pickgrp.speed { max-width: none; }
    .forkpop { right: 1rem; left: 1rem; width: auto; }
    .runpop { right: 0; left: auto; width: min(330px, calc(100vw - 2rem)); }
    .forkpop::after { right: 5.6rem; }
    .runpop::after { right: 9.6rem; }
    .head { padding: 0.38rem 0.95rem 0.6rem; flex-direction: column; align-items: stretch; gap: 0.15rem; }
    .backbtn { width: 1.75rem; height: 1.5rem; align-self: flex-start; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 4px; background: transparent; box-shadow: none; }
    .backbtn:hover { color: var(--accent); background: transparent; box-shadow: none; }
    .backbtn svg { width: 1rem; height: 1rem; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .head .s .sub-line { max-height: 3rem; }
    .msg .bubble { max-width: 88%; }
    .msg.assistant .bubble { max-width: calc(100% - var(--msg-float-actions-space)); }
    .turnfold-card { max-width: 88%; min-width: min(18rem, 88%); }
    .workstats { padding: 0.5rem; }
    .workstats-panel { width: calc(100vw - 1rem); max-height: calc(100dvh - 1rem); }
    .workstats-head { align-items: flex-start; flex-wrap: wrap; }
    .workstats-periods { order: 3; width: 100%; }
    .workstats-period { flex: 1 0 calc(20% - 0.3rem); }
    .forktree-overlay { padding: 0.5rem; }
    .forktree-panel { width: calc(100vw - 1rem); height: calc(100dvh - 1rem); min-height: 0; }
    .forktree-head { padding-left: 0.75rem; }
    .forktree-heading { display: block; }
    .forktree-count { display: block; margin-top: 0.12rem; }
    .work-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .work-kpi { padding: 0.65rem; border-bottom: 1px solid var(--line); }
    .work-kpi:nth-child(2) { border-right: 0; }
    .work-kpi:nth-child(3), .work-kpi:nth-child(4) { border-bottom: 0; }
    .work-kpi:first-child { padding-left: 0.65rem; }
    .work-distribution-row { grid-template-columns: minmax(6rem, 0.6fr) minmax(5rem, 1fr) auto; }
    .work-distributions { grid-template-columns: 1fr; gap: 0.8rem; }
  }
`;

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

function compactThroughput(value: number): string {
  const n = Math.max(0, Number(value) || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function renderConsole(v: ConsoleView): string {
  const sessJson = JSON.stringify(v.sessions).replace(/</g, "\\u003c");
  const schedulesJson = JSON.stringify(v.schedules ?? []).replace(/</g, "\\u003c");
  const dirsJson = JSON.stringify(v.knownDirs).replace(/</g, "\\u003c");
  const rootsJson = JSON.stringify(v.scopeRoots).replace(/</g, "\\u003c");
  const defaultNewDirJson = JSON.stringify(v.defaultNewDir).replace(/</g, "\\u003c");
  const pageTitle = (v.pageTitle ?? "").trim() || fallbackPageTitle(v.scopeRoots);
  const brandScope = brandScopeLabel(pageTitle);
  const pageTitleJson = JSON.stringify(pageTitle).replace(/</g, "\\u003c");
  const vendorsJson = JSON.stringify(v.vendors).replace(/</g, "\\u003c");
  const claudeModelsJson = JSON.stringify(v.claudeModels).replace(/</g, "\\u003c");
  const codexModelsJson = JSON.stringify(v.codexModels).replace(/</g, "\\u003c");
  const cursorModelsJson = JSON.stringify(v.cursorModels).replace(/</g, "\\u003c");
  const modelWarningsJson = JSON.stringify(v.modelWarnings ?? {}).replace(/</g, "\\u003c");
  const modelDefaultsJson = JSON.stringify(v.modelDefaults ?? {}).replace(/</g, "\\u003c");
  const tagsJson = JSON.stringify(v.tags).replace(/</g, "\\u003c");
  const vaultStateJson = JSON.stringify(v.vaultState ?? {}).replace(/</g, "\\u003c");
  const e2eeJson = JSON.stringify(v.e2ee ?? { enabled: false }).replace(/</g, "\\u003c");
  const changelogJson = JSON.stringify(v.changelogMarkdown).replace(/</g, "\\u003c");
  const themeJson = JSON.stringify(v.vaultState?.theme ?? "").replace(/</g, "\\u003c");

  const sessions1h = compactThroughput(v.sessions1h);
  const prompts1h = compactThroughput(v.prompts1h);
  const chars1h = compactThroughput(v.chars1h);
  const throughputSummary = `${chars1h} chars/1h · ${prompts1h} pushes/1h · ${sessions1h} sessions/1h`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtmlText(pageTitle)}</title><script>
(function(){
  var saved = ${themeJson};
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
      <button id="workStatsBtn" class="brand-stats" type="button" title="${escapeHtmlText(throughputSummary)}" aria-label="open work statistics: ${escapeHtmlText(throughputSummary)}" aria-expanded="false">
        <span class="statcard">
          <span id="chars1h" class="statval">${chars1h}</span>
          <span class="statlbl">chars/1h</span>
        </span>
        <span class="statcard">
          <span id="prompts1h" class="statval">${prompts1h}</span>
          <span class="statlbl">pushes/1h</span>
        </span>
        <span class="statcard">
          <span id="sessions1h" class="statval">${sessions1h}</span>
          <span class="statlbl">sessions/1h</span>
        </span>
      </button>
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
    <button id="sessionPanelToggle" class="theme-toggle panel-toggle" type="button" title="open chats panel" aria-label="open chats panel" aria-expanded="false" aria-controls="sessionPanel">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1.7" y="2.2" width="12.6" height="11.6" rx="1.6"></rect>
        <path d="M6.2 2.4v11.2M8.5 5.1h3.2M8.5 8h3.2M8.5 10.9h3.2"></path>
      </svg>
    </button>
  </header>
  <div class="newsession-anchor">
  <div class="topnav">
    <div class="searchwrap">
      <svg class="search-ico" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="7" cy="7" r="4.2"></circle>
        <path d="M10.2 10.2 14 14"></path>
      </svg>
      <input id="search" class="searchbox" placeholder="Search sessions…" autocomplete="off">
      <button id="searchClear" class="search-clear" type="button" aria-label="clear session search" hidden>×</button>
      <button id="searchRangeButton" class="search-range-button" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="searchRangeMenu">
        <svg class="search-range-clock" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.2"></circle><path d="M6 3.5v2.7l1.8 1.1"></path></svg>
        <span id="searchRangeText" class="search-range-text">Today</span>
        <svg class="search-range-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m3.2 4.7 2.8 2.8 2.8-2.8"></path></svg>
      </button>
      <div id="searchRangeMenu" class="search-range-menu" role="listbox" aria-label="Search time range" hidden></div>
      <span id="searchError" class="search-error" role="alert" hidden></span>
    </div>
    <button id="newToggle" aria-expanded="false">+ new</button>
    <button id="todoHubToggle" class="todohub-toggle" type="button" aria-label="open todos" aria-haspopup="dialog" aria-expanded="false" aria-controls="todoHub">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2"></rect>
        <path d="m4.6 8 1.5 1.5 2.5-3M9.8 6.2h1.6M9.8 9.5h1.6"></path>
      </svg>
      <span id="todoHubCount" class="todohub-count" hidden>0</span>
    </button>
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
      <div class="pickgrp speed">
        <div class="picklbl">speed</div>
        <select id="nspeed" class="chooser-select" aria-label="speed"></select>
      </div>
    </div>
    <div class="modelwarn" id="nmodelWarning" hidden></div>
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
      <div class="newmsgrow">
        <div class="composer-shortcut-ghost newmsg-shortcut-ghost" id="newShortcutGhost" aria-hidden="true" hidden><span id="newShortcutGhostPrefix"></span><span class="composer-shortcut-ghost-suffix" id="newShortcutGhostSuffix"></span><span class="composer-shortcut-ghost-key">Tab</span></div>
        <textarea id="np" rows="2" aria-autocomplete="inline" placeholder="first message (optional · Enter to start · Shift+Enter for newline · drag files/images here)"></textarea>
        <div class="attachtray" id="newAttachTray"></div>
        <div class="attachmsg" id="newAttachMsg"></div>
        <div class="newmsgactions">
          <button id="nattach" class="attachpick" type="button" title="Attach files" aria-label="Attach files">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6.2 8.9l3.9-3.9a2.1 2.1 0 0 1 3 3l-5.2 5.2a3.4 3.4 0 0 1-4.8-4.8l5.7-5.7a4.6 4.6 0 0 1 6.5 6.5l-5.8 5.8"></path>
            </svg>
          </button>
          <input id="nfile" type="file" multiple hidden>
          <button class="railbtn goal-toggle" id="newGoalToggle" type="button" aria-pressed="false" title="Use the first message as a Goal"><svg class="goal-ico" viewBox="0 0 16 16" aria-hidden="true"><circle class="goal-ring" cx="8" cy="8" r="5.4"></circle><circle class="goal-dot" cx="8" cy="8" r="2.2"></circle></svg><span>goal</span></button>
        </div>
      </div>
    </div>
    <div class="newactions">
      <div class="newtagpick" id="newTagPick">
        <div class="newtags" id="newTags"></div>
        <button id="newTagAdd" class="newtagadd" type="button" aria-expanded="false">+ tag</button>
        <div id="newTagMenu" class="newtagmenu" hidden>
          <input id="newTagInput" role="combobox" aria-autocomplete="list" aria-controls="newTagSug" aria-expanded="false" placeholder="pick or create a tag" autocomplete="off">
          <div id="newTagSug" class="newtagsug" role="listbox"></div>
        </div>
      </div>
      <div class="newaction-end">
        <div class="actiongroup">
          <button id="scheduleNew" class="schedulebtn" type="button" aria-label="schedule new session" aria-expanded="false"></button>
          <button id="nbtn" class="send nbtn-primary">start session ▸</button>
        </div>
      </div>
    </div>
    <div class="nmsg" id="nmsg"></div>
  </div>
  <section class="todohub-box" id="todoHub" role="dialog" aria-modal="false" aria-labelledby="todoHubTitle">
    <div class="newhead">
      <div class="newttl" id="todoHubTitle">Todos</div>
      <button id="todoHubClose" class="newclose" type="button" aria-label="close todos">✕</button>
    </div>
    <div class="todohub-add">
      <input id="todoHubAddInput" type="text" autocomplete="off" placeholder="Add a todo…">
      <button id="todoHubAddButton" type="button" disabled>add</button>
    </div>
    <div class="todohub-body" id="todoHubBody"></div>
  </section>
  </div>
  <div class="tagbar">
    <div class="viewrow">
      <div class="viewtabs" id="viewTabs"></div>
    </div>
    <div class="taghead">
      <div class="taghead-label">
        <span class="tagttl">tags</span>
        <div class="searchwrap tagsearchwrap">
          <input id="tagSearch" class="searchbox" placeholder="Search tags…" autocomplete="off" aria-label="search tags and sessions in this view">
          <button id="tagSearchClear" class="search-clear" type="button" aria-label="clear tag search" hidden>×</button>
        </div>
        <button id="tagModeToggle" class="tagmode-toggle instant-tip instant-tip-left" type="button" aria-pressed="false" data-tooltip="Show sessions matching any selected tag. Click to require all selected tags.">sessions with <span id="tagModeValue">any</span> <span id="tagModeNoun">tag</span></button>
        <button id="tagOrderToggle" class="tagmode-toggle tagorder-toggle instant-tip instant-tip-left" type="button" aria-pressed="false" data-tooltip="Custom tags use your fixed drag-and-drop order. Click to sort them by their latest user message.">order: <span id="tagOrderValue">fixed</span></button>
      </div>
      <button id="bulkArchiveSeen" class="bulkarchive instant-tip instant-tip-right" type="button" disabled data-tooltip="No seen sessions matching the current view and focus filters to archive">archive 0 seen sessions</button>
    </div>
    <div class="tagchips" id="tagFilters"></div>
  </div>
  <div id="list"></div>
</div>
<div class="resizer" id="resizer"></div>
<section class="session-panel" id="sessionPanel" aria-label="Chats" hidden>
  <div class="session-panel-list" id="sessionPanelList"></div>
</section>
<div class="session-panel-resizer" id="sessionPanelResizer" hidden></div>
<div class="main">
  <div class="chat-tabs" id="chatTabs" role="tablist" aria-label="Open chats" hidden></div>
  <div class="head">
    <button class="backbtn" id="backbtn" type="button" title="back to sessions" aria-label="back to sessions">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3.5 6 8l4.5 4.5"></path></svg>
    </button>
    <div class="headmain">
      <div class="headrow it-titlerow">
        <span class="headstatus it-status read" id="h-status" title="read"></span>
        <div class="head-titlegroup">
          <div class="t it-title" id="h-title">Attend</div>
          <button class="headbtn title-edit-btn" id="titleEditBtn" title="edit title" disabled aria-label="edit title">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M11.7 2.6a1.9 1.9 0 0 1 2.7 2.7L6 13.7H3.3V11l8.4-8.4z"></path>
              <path d="M10.5 3.8l1.7 1.7"></path>
            </svg>
          </button>
        </div>
        <button class="forktree-trigger it-forktree" id="forkTreeBtn" title="view fork tree" aria-label="view fork tree" hidden></button>
        <span class="it-age" id="h-age"></span>
        <div class="head-actions">
          <button class="headbtn" id="refreshBtn" title="refresh this chat from transcript" disabled aria-label="refresh this chat">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M13 3.5v3h-3"></path>
              <path d="M12.2 6.2A5 5 0 1 0 13 8.9"></path>
            </svg>
          </button>
          <button class="headbtn head-pin" id="headerPinBtn" title="select a session to pin" disabled aria-label="select a session to pin" aria-pressed="false">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 2.5h6l-1 4 2 2v1H8.7L8 14l-.7-4.5H4v-1l2-2-1-4Z"></path></svg>
          </button>
        </div>
      </div>
      <div class="it-meta" id="h-sig"></div><div class="s" id="h-sub">Recent changes</div><div id="h-tags"></div>
    </div>
  </div>
  <div class="topstack" id="topStack" aria-hidden="true">
    <div class="pintray" id="pinTray" aria-hidden="true"></div>
    <div class="latestpin" id="latestPin" aria-hidden="true" role="button" tabindex="0" aria-label="jump to latest user message">
      <div class="latestpin-body" id="latestPinBody"></div>
    </div>
  </div>
  <div id="msgs">
    <section class="changelog" id="ph" aria-label="Changelog">
      <div class="changelog-kicker">What's new</div>
      <div class="changelog-content" id="changelogContent"></div>
      <div class="changelog-hint">Select a session on the left to open its chat, or choose + new to start one.</div>
    </section>
  </div>
  <div class="msg-float-actions" id="msgFloatActions" aria-hidden="true">
    <button id="msgFloatPin" type="button" aria-label="Pin this message"></button>
    <button id="msgFloatReference" type="button" aria-label="Reference this response">@</button>
    <button id="msgFloatComment" type="button" aria-label="Comment on this message"></button>
  </div>
  <div class="msg-reference-composer" id="msgReferenceComposer" role="dialog" aria-modal="false" aria-labelledby="msgReferenceMark" hidden>
    <div class="msg-reference-head">
      <span class="msg-reference-mark" id="msgReferenceMark">@ response</span>
      <span class="msg-reference-preview" id="msgReferencePreview"></span>
      <button class="msg-reference-close" id="msgReferenceClose" type="button" aria-label="Cancel reference"></button>
    </div>
    <input class="msg-reference-input" id="msgReferenceInput" type="text" autocomplete="off" placeholder="Optional: prove, challenge, or verify">
    <div class="msg-reference-actions">
      <span class="msg-reference-hint">Optional · Enter to add</span>
      <button class="msg-reference-add" id="msgReferenceAdd" type="button">add to prompt</button>
    </div>
  </div>
  <div id="avoidPanel" hidden></div>
  <div id="queue"></div>
  <button class="scrollbottom chat-scrollbottom" id="chatScrollBottom" type="button" aria-label="scroll to bottom" title="Scroll to bottom" hidden></button>
  <div class="foot">
    <div class="composer" id="composer">
      <div class="rail-run-state" hidden>
        <select id="rvendor" aria-label="session vendor"></select>
        <select id="rmodel" aria-label="session model"></select>
        <select id="reffort" aria-label="session effort"></select>
        <select id="rspeed" aria-label="session speed"></select>
        <div id="rmodelWarning" hidden></div>
        <div id="runMsg"></div>
      </div>
      <div class="composer-surface">
        <div class="composerrail" id="composerRail">
          <div class="composerrail-controls">
            <button class="railbtn" id="railVendor" type="button" aria-label="vendor" aria-expanded="false"><span class="railbtn-value">—</span><span aria-hidden="true">⌃</span></button>
            <button class="railbtn" id="railModel" type="button" aria-label="model" aria-expanded="false"><span class="railbtn-value">—</span><span aria-hidden="true">⌃</span></button>
            <button class="railbtn" id="railEffort" type="button" aria-label="effort" aria-expanded="false"><span class="railbtn-value">—</span><span aria-hidden="true">⌃</span></button>
            <button class="railbtn" id="railSpeed" type="button" aria-label="speed" aria-expanded="false"><span class="railbtn-value">—</span><span aria-hidden="true">⌃</span></button>
            <span class="rail-divider" aria-hidden="true"></span>
            <button class="railbtn" id="railShortcuts" type="button" aria-expanded="false"><span class="railbtn-value">shortcuts</span><span class="railbtn-count" hidden>0</span></button>
            <button class="railbtn" id="railNotes" type="button" aria-expanded="false"><span class="railbtn-value">notes</span><span class="railbtn-count" hidden>0</span></button>
            <button class="railbtn" id="railTodos" type="button" aria-expanded="false"><span class="railbtn-value">todo</span><span class="railbtn-count" hidden>0</span></button>
            <button class="railbtn rail-probe" id="railProbe" type="button" title="Insert this probe into the composer" hidden><span class="rail-probe-ico" aria-hidden="true">?</span><span class="railbtn-value">—</span></button>
          </div>
          <section class="railpop" id="composerRailPop" role="dialog" aria-label="Composer controls" hidden></section>
        </div>
        <div class="composerrow">
          <section class="pinref-picker" id="composerPinPicker" role="listbox" aria-label="Reference a Pin" hidden></section>
          <div class="composer-shortcut-ghost" id="composerShortcutGhost" aria-hidden="true" hidden><span id="composerShortcutGhostPrefix"></span><span class="composer-shortcut-ghost-suffix" id="composerShortcutGhostSuffix"></span><span class="composer-shortcut-ghost-key">Tab</span></div>
          <textarea id="input" role="combobox" aria-autocomplete="both" aria-haspopup="listbox" aria-controls="composerPinPicker" aria-expanded="false" placeholder="message (Enter to send · Shift+Enter for newline · drag/paste files/images here)"></textarea>
          <div class="composeractions">
            <div class="attachtray" id="attachTray"></div>
            <div class="attachmsg" id="attachMsg"></div>
            <button id="attach" class="attachpick" type="button" title="Attach files" aria-label="Attach files">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M6.2 8.9l3.9-3.9a2.1 2.1 0 0 1 3 3l-5.2 5.2a3.4 3.4 0 0 1-4.8-4.8l5.7-5.7a4.6 4.6 0 0 1 6.5 6.5l-5.8 5.8"></path>
              </svg>
            </button>
            <input id="file" type="file" multiple hidden>
            <button class="railbtn goal-toggle" id="goalToggle" type="button" aria-pressed="false" title="Use the next message as a Goal"><svg class="goal-ico" viewBox="0 0 16 16" aria-hidden="true"><circle class="goal-ring" cx="8" cy="8" r="5.4"></circle><circle class="goal-dot" cx="8" cy="8" r="2.2"></circle></svg><span>goal</span></button>
            <div class="actiongroup" id="chatActionGroup">
              <button id="scheduleChat" class="schedulebtn" type="button" aria-label="schedule action" aria-expanded="false"></button>
              <button class="splitbtn" id="forkBtn" title="branch this session into a fork (uses your draft as the opening turn)" disabled>fork<svg class="splitbtn-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12h2"></path><path d="M9 12c4 0 4-5 8-5"></path><path d="M9 12c4 0 4 5 8 5"></path><circle cx="5" cy="12" r="2"></circle><circle cx="19" cy="7" r="2"></circle><circle cx="19" cy="17" r="2"></circle></svg></button>
              <button class="send" id="send">send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
<div class="commentdrawer" id="commentDrawer" hidden aria-hidden="true">
  <section class="commentpanel" role="dialog" aria-modal="false" aria-labelledby="commentTitle">
    <header class="commenthead">
      <div class="commenttitle" id="commentTitle">Comment thread</div>
      <div class="commentactions">
        <button class="commentpromote" id="commentPromote" type="button">promote to session</button>
        <button class="commentclose" id="commentClose" type="button" aria-label="close comments">×</button>
      </div>
    </header>
    <div class="topstack commenttopstack" id="commentTopStack" aria-hidden="true">
      <div class="pintray" id="commentPinTray" aria-hidden="true"></div>
      <div class="latestpin" id="commentLatestPin" aria-hidden="true" role="button" tabindex="0" aria-label="jump to latest user comment">
        <div class="latestpin-body" id="commentLatestPinBody"></div>
      </div>
    </div>
    <div class="commentmsgs" id="commentMsgs">
      <div class="commentanchor" id="commentAnchor">
        <div class="commentanchor-head" id="commentAnchorHead">
          <span class="commentanchor-label" id="commentAnchorLabel">REFERENCE</span>
        </div>
        <div class="commentanchor-content" id="commentAnchorContent"></div>
      </div>
    </div>
    <div class="msg-float-actions comment-msg-float-actions" id="commentMsgFloatActions" aria-hidden="true">
      <button id="commentMsgFloatPin" type="button" aria-label="Pin this comment message"></button>
      <button id="commentMsgFloatReference" type="button" aria-label="Reference this comment response">@</button>
    </div>
    <div class="msg-reference-composer comment-msg-reference-composer" id="commentMsgReferenceComposer" role="dialog" aria-modal="false" aria-labelledby="commentMsgReferenceMark" hidden>
      <div class="msg-reference-head">
        <span class="msg-reference-mark" id="commentMsgReferenceMark">@ response</span>
        <span class="msg-reference-preview" id="commentMsgReferencePreview"></span>
        <button class="msg-reference-close" id="commentMsgReferenceClose" type="button" aria-label="Cancel reference"></button>
      </div>
      <input class="msg-reference-input" id="commentMsgReferenceInput" type="text" autocomplete="off" placeholder="Optional: prove, challenge, or verify">
      <div class="msg-reference-actions">
        <span class="msg-reference-hint">Optional · Enter to add</span>
        <button class="msg-reference-add" id="commentMsgReferenceAdd" type="button">add to comment</button>
      </div>
    </div>
    <div id="commentQueue"></div>
    <button class="scrollbottom comment-scrollbottom" id="commentScrollBottom" type="button" aria-label="scroll comments to bottom" title="Scroll to bottom" hidden></button>
    <div class="commentfoot">
      <div class="composer commentcomposer">
        <div class="commentcomposer-surface">
          <div class="composerrow">
            <div class="composer-shortcut-ghost" id="commentShortcutGhost" aria-hidden="true" hidden><span id="commentShortcutGhostPrefix"></span><span class="composer-shortcut-ghost-suffix" id="commentShortcutGhostSuffix"></span><span class="composer-shortcut-ghost-key">Tab</span></div>
            <textarea id="commentInput" rows="1" aria-autocomplete="inline" aria-keyshortcuts="Tab Enter Shift+Enter Escape" placeholder="message"></textarea>
            <div class="composeractions">
              <div class="actiongroup">
                <button id="scheduleComment" class="schedulebtn" type="button" aria-label="schedule comment" aria-expanded="false"></button>
                <button class="send commentsend" id="commentSend" type="button">send</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>
</div>
<div class="hover-tip" id="hoverTip" role="tooltip" hidden></div>
<div class="forktree-overlay" id="forkTree" hidden aria-hidden="true">
  <section class="forktree-panel" role="dialog" aria-modal="true" aria-labelledby="forkTreeTitle">
    <header class="forktree-head">
      <div class="forktree-heading">
        <div class="forktree-title" id="forkTreeTitle">Fork tree</div>
        <div class="forktree-count" id="forkTreeCount"></div>
      </div>
      <div class="forktree-controls">
        <button class="forktree-control" id="forkTreeZoomOut" type="button" title="zoom out" aria-label="zoom out"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10"></path></svg></button>
        <button class="forktree-control" id="forkTreeReset" type="button" title="fit fork tree" aria-label="fit fork tree"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2H2v4M10 2h4v4M14 10v4h-4M2 10v4h4"></path></svg></button>
        <button class="forktree-control" id="forkTreeZoomIn" type="button" title="zoom in" aria-label="zoom in"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M8 3v10"></path></svg></button>
        <button class="forktree-control" id="forkTreeClose" type="button" title="close fork tree" aria-label="close fork tree"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"></path></svg></button>
      </div>
    </header>
    <div class="forktree-viewport" id="forkTreeViewport">
      <div class="forktree-pan" id="forkTreePan"><div class="forktree-stage" id="forkTreeStage"></div></div>
    </div>
  </section>
</div>
<div class="imgpreview" id="imgPreview" hidden aria-hidden="true">
  <div class="imgpreview-bar">
    <div class="imgpreview-name" id="imgPreviewName"></div>
  </div>
  <div class="imgpreview-viewport" id="imgPreviewViewport">
    <div class="imgpreview-stage" id="imgPreviewStage">
      <img id="imgPreviewImg" alt="" draggable="false">
      <div class="imgpreview-html" id="imgPreviewHtml"></div>
    </div>
  </div>
</div>
<div class="workstats" id="workStats" hidden aria-hidden="true">
  <section class="workstats-panel" role="dialog" aria-modal="true" aria-labelledby="workStatsTitle">
    <header class="workstats-head">
      <div class="workstats-heading">
        <div class="workstats-title" id="workStatsTitle">Work patterns</div>
        <div class="workstats-sub">Session breadth, continuity, and current resource pressure</div>
      </div>
      <div class="workstats-periods" aria-label="statistics period">
        <button class="workstats-period" type="button" data-range="1h" aria-pressed="false">1h</button>
        <button class="workstats-period" type="button" data-range="3h" aria-pressed="false">3h</button>
        <button class="workstats-period" type="button" data-range="6h" aria-pressed="false">6h</button>
        <button class="workstats-period" type="button" data-range="12h" aria-pressed="false">12h</button>
        <button class="workstats-period" type="button" data-range="today" aria-pressed="true">Today</button>
        <button class="workstats-period" type="button" data-range="24h" aria-pressed="false">24h</button>
        <button class="workstats-period" type="button" data-range="3d" aria-pressed="false">3d</button>
        <button class="workstats-period" type="button" data-range="7d" aria-pressed="false">7d</button>
        <button class="workstats-period" type="button" data-range="15d" aria-pressed="false">15d</button>
      </div>
      <button class="workstats-close" id="workStatsClose" type="button" aria-label="close work statistics">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3 3 13"></path></svg>
      </button>
    </header>
    <div class="workstats-body" id="workStatsBody"></div>
  </section>
</div>
<div class="tagaction" id="tagAction" hidden aria-hidden="true">
  <section class="tagaction-panel" role="dialog" aria-modal="true" aria-labelledby="tagActionTitle">
    <div class="tagaction-title" id="tagActionTitle"></div>
    <div class="tagaction-actions">
      <button class="tagaction-clear instant-tip" id="tagActionClear" type="button"></button>
      <button class="tagaction-delete" id="tagActionDelete" type="button">Delete tag</button>
    </div>
  </section>
</div>
<div class="toast-host" id="toastHost" aria-live="polite" aria-atomic="true"></div>
<section class="sessiontag-popover" id="sessionTagPopover" role="dialog" aria-label="Edit session tags" hidden>
  <div class="sessiontag-search">
    <input id="sessionTagInput" class="sessiontag-input" role="combobox" aria-autocomplete="list" aria-controls="sessionTagList" aria-expanded="false" placeholder="pick or create a tag" autocomplete="off">
    <button id="sessionTagClose" class="edit-cancel sessiontag-close" type="button" aria-label="Close tag picker"></button>
  </div>
  <div id="sessionTagList" class="sessiontag-list" role="listbox" aria-multiselectable="true"></div>
</section>
<section class="schedulepop" id="schedulePop" role="dialog" aria-label="Schedule once" hidden>
  <div class="schedulepop-head"><span class="schedulepop-title">Schedule once</span><span class="schedulepop-zone" id="scheduleZone"></span></div>
  <div class="schedulerow">
    <div class="scheduledatetime" id="scheduleDateTime"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v5l3.3 2"></path></svg><input id="scheduleDateTimeInput" autocomplete="off" spellcheck="false" placeholder="YYYY-MM-DD HH:mm" aria-label="Scheduled date and time"><button class="scheduledatetime-toggle" id="schedulePickerToggle" type="button" aria-label="Open calendar and time options" aria-expanded="false">▾</button></div>
    <div class="scheduleactions" id="scheduleActions"></div>
  </div>
  <div class="schedulepicker" id="schedulePicker" hidden>
    <div class="schedulepicker-head"><button class="schedulepicker-nav" id="schedulePrevMonth" type="button" aria-label="Previous month">‹</button><div class="schedulepicker-month" id="scheduleMonth"></div><button class="schedulepicker-nav" id="scheduleNextMonth" type="button" aria-label="Next month">›</button></div>
    <div class="schedulepicker-week" aria-hidden="true"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
    <div class="schedulepicker-days" id="scheduleDays"></div>
    <div class="scheduletime"><span class="scheduletime-label">Time</span><input id="scheduleHour" inputmode="numeric" maxlength="2" aria-label="Hour"><span class="scheduletime-sep">:</span><input id="scheduleMinute" inputmode="numeric" maxlength="2" aria-label="Minute"></div>
    <div class="scheduletime-choices"><div><span class="scheduletime-choice-label">Hour</span><div class="scheduletime-hours" id="scheduleHourOptions"></div></div><div><span class="scheduletime-choice-label">Minute</span><div class="scheduletime-minutes" id="scheduleMinuteOptions"></div></div></div>
  </div>
  <div class="schedulemsg" id="scheduleMsg"></div>
</section>
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
window.__SCHEDULES__ = ${schedulesJson};
window.__DIRS__ = ${dirsJson};
window.__ROOTS__ = ${rootsJson};
window.__DEFAULT_NEW_DIR__ = ${defaultNewDirJson};
window.__PAGE_TITLE__ = ${pageTitleJson};
window.__VENDORS__ = ${vendorsJson};
window.__CLAUDE_MODELS__ = ${claudeModelsJson};
window.__CODEX_MODELS__ = ${codexModelsJson};
window.__CURSOR_MODELS__ = ${cursorModelsJson};
window.__MODEL_WARNINGS__ = ${modelWarningsJson};
window.__MODEL_DEFAULTS__ = ${modelDefaultsJson};
window.__TAGS__ = ${tagsJson};
window.__VAULT_STATE__ = ${vaultStateJson};
window.__E2EE__ = ${e2eeJson};
window.__CHANGELOG__ = ${changelogJson};
</script>
<script>
(function(){
  var SESS = window.__SESSIONS__ || [];
  var SCHEDULES = window.__SCHEDULES__ || [];
  var DIRS = window.__DIRS__ || [];
  var ROOTS = window.__ROOTS__ || [];
  var DEFAULT_NEW_DIR = window.__DEFAULT_NEW_DIR__ || '';
  var PAGE_TITLE = window.__PAGE_TITLE__ || 'Attend — console';
  var TAGS = window.__TAGS__ || [];
  var VAULT_STATE = window.__VAULT_STATE__ || {};
  var VENDORS = window.__VENDORS__ || [];
  var CLAUDE_MODELS = window.__CLAUDE_MODELS__ || [];
  var CODEX_MODELS = window.__CODEX_MODELS__ || [];
  var CURSOR_MODELS = window.__CURSOR_MODELS__ || [];
  var MODEL_WARNINGS = window.__MODEL_WARNINGS__ || {};
  var MODEL_DEFAULTS = window.__MODEL_DEFAULTS__ || {};
  var CHANGELOG_MARKDOWN = window.__CHANGELOG__ || '';
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
    SCHEDULES = view.schedules || [];
    DIRS = view.knownDirs || [];
    ROOTS = view.scopeRoots || [];
    DEFAULT_NEW_DIR = view.defaultNewDir || '';
    PAGE_TITLE = view.pageTitle || PAGE_TITLE;
    VENDORS = view.vendors || [];
    CLAUDE_MODELS = view.claudeModels || [];
    CODEX_MODELS = view.codexModels || [];
    CURSOR_MODELS = view.cursorModels || [];
    MODEL_WARNINGS = view.modelWarnings || {};
    MODEL_DEFAULTS = view.modelDefaults || {};
    TAGS = view.tags || [];
    VAULT_STATE = view.vaultState || {};
    pinnedTags = loadPinnedTags();
    hiddenTags = loadHiddenTags();
    commentThreads = VAULT_STATE.commentThreads && typeof VAULT_STATE.commentThreads==='object' ? VAULT_STATE.commentThreads : {};
    applyVaultSessionTitles();
    newPrefs = loadNewPrefs();
    focusViews = loadFocusViews();
    activeFocusId = loadActiveFocusId(focusViews);
    setTheme(VAULT_STATE.theme || currentTheme(), false);
    applyStats(view);
    renderTodoHubSummary();
    if(todoHubOpen()) renderTodoHub();
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
  function cliDefault(vendor, key){
    var defaults=MODEL_DEFAULTS[vendor]||{};
    return String(defaults[key]||'').trim();
  }
  function optionsWithDefault(options, value, suffix){
    var list=(options||[]).map(function(opt){ return Object.assign({}, opt); });
    value=String(value||'').trim();
    if(!value) return list;
    var found=false;
    list.forEach(function(opt){
      if(opt.value!==value) return;
      found=true;
      opt.label=opt.label+' ('+suffix+')';
    });
    if(!found) list.unshift({ value:value, label:value+' ('+suffix+')' });
    return list;
  }
  function loadNewPrefs(){
    var parsed=VAULT_STATE && VAULT_STATE.modelPrefs;
    return parsed && typeof parsed==='object' ? parsed : {};
  }
  var FOCUS_ACTIVE_KEY = 'attend.activeFocusView.v1';
  var TAG_FILTER_MODE_KEY = 'attend.tagFilterMode.v1';
  var TAG_ORDER_MODE_KEY = 'attend.tagOrderMode.v1';
  var TAG_HIDDEN_EXPANDED_KEY = 'attend.tagHiddenExpanded.v1';
  var PRIORITY_FILTER_KEY = 'attend.priorityFilter.v1';
  function loadTagFilterMode(){
    try{ return localStorage.getItem(TAG_FILTER_MODE_KEY)==='and' ? 'and' : 'or'; }
    catch(e){ return 'or'; }
  }
  function saveTagFilterMode(){
    try{ localStorage.setItem(TAG_FILTER_MODE_KEY, tagFilterMode); }catch(e){}
  }
  function loadTagOrderMode(){
    try{ return localStorage.getItem(TAG_ORDER_MODE_KEY)==='recent' ? 'recent' : 'fixed'; }
    catch(e){ return 'fixed'; }
  }
  function saveTagOrderMode(){
    try{ localStorage.setItem(TAG_ORDER_MODE_KEY, tagOrderMode); }catch(e){}
  }
  function loadTagHiddenExpanded(){
    try{ return localStorage.getItem(TAG_HIDDEN_EXPANDED_KEY)==='true'; }
    catch(e){ return false; }
  }
  function saveTagHiddenExpanded(){
    try{ localStorage.setItem(TAG_HIDDEN_EXPANDED_KEY, tagHiddenExpanded?'true':'false'); }catch(e){}
  }
  function loadPinnedTags(){
    var out=[], seen={};
    (VAULT_STATE && Array.isArray(VAULT_STATE.pinnedTags) ? VAULT_STATE.pinnedTags : []).forEach(function(raw){
      var tag=normalizeTag(raw);
      if(!tag || seen[tag]) return;
      seen[tag]=true;
      out.push(tag);
    });
    return out;
  }
  function loadHiddenTags(){
    var out=[], seen={};
    (VAULT_STATE && Array.isArray(VAULT_STATE.hiddenTags) ? VAULT_STATE.hiddenTags : []).forEach(function(raw){
      var tag=normalizeTag(raw);
      if(!tag || seen[tag]) return;
      seen[tag]=true;
      out.push(tag);
    });
    return out;
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
  function saveFocusViews(changedViews, removedId){
    try{
      localStorage.setItem(FOCUS_ACTIVE_KEY, activeFocusId);
    }catch(e){}
    VAULT_STATE.focusViews=focusViews;
    if(changedViews===undefined && !removedId) return;
    var patch={};
    (changedViews||[]).forEach(function(view){ if(view&&view.id) patch[view.id]=view; });
    if(removedId) patch[removedId]=null;
    if(Object.keys(patch).length) saveVaultUiState({focusViewPatch:patch});
  }
  var newPrefs = loadNewPrefs();
  var appliedNewVendor = '';
  var DIR_SUGGEST_LIMIT = 24;
  var DIR_RECENT_LIMIT = 5;
  var focusViews = loadFocusViews();
  var activeFocusId = loadActiveFocusId(focusViews);
  var cur = null, liveConnectionFailed = false, liveErrorToast = null, liveEventChain = Promise.resolve(), latestLiveSnapshot = null, assistantEl = null;
  var genEl = null, genTimer = null, genStart = 0, turnActive = false;
  var goalArmed = false, newGoalArmed = false, goalSyncGeneration = 0;
  var activeTags = (focusById(activeFocusId) || focusViews[0] || { tags:[] }).tags.slice();
  var activeTagView = 'all';
  var tagFilterMode = loadTagFilterMode();
  var tagOrderMode = loadTagOrderMode();
  var tagHiddenExpanded = loadTagHiddenExpanded();
  var pinnedTags = loadPinnedTags();
  var hiddenTags = loadHiddenTags();
  var priorityFilter = loadPriorityFilter();
  var priorityMenuOpen = false;
  var scopedTagFilters = { active: [], unread: [] };
  var bulkArchiveSeenBusy = false;
  var globalTagEditing = false;
  var globalTagDraft = '';
  var draggedGlobalTag = null;
  var globalTagDragToken = 0;
  var globalTagDropPlaceholder = null;
  var globalTagDragSize = null;
  var globalTagDropGeometry = null;
  var pendingGlobalTagRender = false;
  var pendingGlobalTagRenderFrame = 0;
  var suppressTagClickUntil = 0;
  var hiddenTagDropTimer = 0;
  var hiddenTagDropSource = '';
  var hiddenTagDropTarget = null;
  var hiddenTagDropArmed = false;
  var pendingGlobalTagAction = '';
  var sessionTagPopoverState = null;
  var newSessionTags = [];
  var newTagPickerOpen = false;
  var newTagPickerActive = -1;
  var todoHubEditing = null;
  var todoHubShowCompleted = false;
  var titleEditing = false;
  var WORK_STATS_RANGE_KEY = 'attend.workStatsRange';
  var SESSION_PANEL_OPEN_KEY = 'attend.sessionPanelOpen';
  var SESSION_PANEL_WIDTH_KEY = 'attend.sessionPanelW';
  var sessionPanelOpen = false;
  var sessionPanelPreferredWidth = 660;
  var chatGroups = [];
  var activeChatGroup = null;
  var chatGroupClock = 0;
  var draggedChatSession = null;
  var sessionRowClickSuppressUntil = 0;
  var headerTagSessionMenu = '';
  var WORK_STATS_RANGES = ['1h','3h','6h','12h','today','24h','3d','7d','15d'];
  var workStatsRange = loadWorkStatsRange();
  var workStatsRequest = 0;
  var workStatsLastFocus = null;
  var forkTreeFocusId = '';
  var forkTreeSessionCache = {};
  var forkTreeView = { scale:1, x:0, y:0, width:0, height:0, dragging:false, sx:0, sy:0, ox:0, oy:0 };
  var newSessionPending = false;
  var newSessionOperation = 0;
  var composerRailKind = '';
  var composerRailEditing = null;
  var composerShortcutComposing = false;
  var commentShortcutComposing = false;
  var newShortcutComposing = false;
  // Every asynchronous UI operation is scoped to the entity it mutates. Only
  // the newest operation in a scope may project a response back into local
  // state; this makes reversed HTTP completion order harmless.
  var operationClock = 0;
  var mutationTimestamp = 0;
  var latestOperations = {};
  var mutationChains = {};
  var vaultWriteChain = Promise.resolve();
  var localPendingMsgs = {};
  // Kept separately from localPendingMsgs: transcript re-rendering can settle a
  // pending row against the optimistic cache before its live acknowledgement
  // arrives. The receipt remains long enough to identify that acknowledgement
  // without mistaking it for a second user turn.
  var localUserEventReceipts = {};
  var orphanBusEvents = {};
  var orphanAnalysisMessages = {};
  var commentThreads = VAULT_STATE.commentThreads && typeof VAULT_STATE.commentThreads==='object' ? VAULT_STATE.commentThreads : {};
  var commentMessageCache = {};
  var commentGenTimer = null;
  var commentDrawerEpoch = 0;
  var commentGenStart = 0;
  var commentStick = true;
  var commentMsgOrdinal = 0;
  var commentToolEls = {};
  var commentLatestUserMsgEl = null;
  var commentLatestPinRaf = 0;
  var commentDrawerState = { epoch:0, threadId:'', parentSessionId:'', anchorKey:'', anchorText:'', anchorMsg:null, anchorSelectionStart:null, busy:false, generating:false, stopping:false, stoppedByUser:false, pendingStop:null, promoting:false, assistant:null, lastAssistantOutputAt:null };
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
  var schedulePopoverState = null;
  var forkingQueueItems = {};
  var sendingQueueItems = {};
  var editingQueueIdx = -1; // which queued draft is open in its inline editor (-1 = none)
  var editingScheduleId = ''; // scheduled queue row whose text is being edited
  var stopRequested = false;
  var sessionDrafts = {};
  var sessionAttachments = {};
  var sessionPinReferences = {};
  var sessionScrollStates = {};
  // Readline-style cursor: entries[0..N-1] are user turns; N is the saved draft.
  var composerHistoryNav = null;
  var sessionQueueEditing = {};
  // Keep each tab's last known queue locally as well as on the server. This makes
  // tab navigation synchronous; the GET below only reconciles newer server state.
  var sessionQueues = {};
  var queueParked = false;
  var queueSteerable = false;
  var transcriptCache = {};
  var transcriptVersions = {};
  function transcriptVersionKey(s){
    if(!s) return '';
    return s.sessionId ? 'sid:'+s.sessionId : transcriptCacheKey(s.file,s.vendor);
  }
  function transcriptVersion(s){
    var key=transcriptVersionKey(s);
    return key ? Number(transcriptVersions[key])||0 : 0;
  }
  function bumpTranscriptVersion(s){
    var key=transcriptVersionKey(s);
    if(key) transcriptVersions[key]=(Number(transcriptVersions[key])||0)+1;
  }
  function objectCacheSet(store,key,value,maxEntries){
    if(!key) return value;
    if(Object.prototype.hasOwnProperty.call(store,key)) delete store[key];
    store[key]=value;
    var keys=Object.keys(store);
    while(keys.length>maxEntries) delete store[keys.shift()];
    return value;
  }
  // A cache entry created by SSE may contain only the live tail of a session.
  // Track which entries have a persisted /chat/messages baseline so navigation
  // can distinguish a complete transcript from a useful-but-partial live cache.
  var transcriptBaselines = {};
  var transcriptLoads = {};
  var transcriptSelectionGeneration = 0;
  var draftAttachments = [];
  var draftPinReferences = [];
  var PIN_REFERENCE_LIMIT = 8;
  var pinReferencePicker = { open:false, start:-1, end:-1, query:'', items:[], active:0 };
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
  var messageReplaceGeneration = 0;
  var TRANSCRIPT_VIRTUAL_THRESHOLD = 120;
  var TRANSCRIPT_VIRTUAL_OVERSCAN_PX = 1400;
  var TRANSCRIPT_VIRTUAL_MIN_TURNS = 10;
  var transcriptVirtualState = null;
  var transcriptVirtualRaf = 0;
  var transcriptVirtualMeasureRaf = 0;
  var transcriptVirtualResizeObserver = null;
  var transcriptTurnHeightCaches = {};
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
  var commentOverlayLayoutRaf = 0;
  var msgOrdinal = 0;
  var toolOrdinal = 0;
  var viewVisit = null;
  var applyingTurnFolds = false;
  function byId(id){ return document.getElementById(id); }
  function el(tag, cls, txt){ var e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e; }
  var changelogContent = byId('changelogContent');
  if(changelogContent) changelogContent.innerHTML = renderMarkdown(CHANGELOG_MARKDOWN);
  var noSessionChangelog = byId('ph') ? byId('ph').cloneNode(true) : null;
  function sessionPromptLine(cls, label, value, leading, displayLabel){
    var shown=displayLabel||label;
    var text=shown+' · '+String(value||'');
    var line=el('div',cls+' prompt-line');
    line.appendChild(el('span','prompt-line-label prompt-line-'+String(label||'').toLowerCase(),shown));
    line.appendChild(document.createTextNode(' · '));
    if(leading) line.appendChild(leading);
    line.appendChild(el('span','prompt-line-text',String(value||'')));
    line.setAttribute('data-hover-tip',text);
    return line;
  }
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
    function circle(cx, cy, r){
      var c=document.createElementNS(ns, 'circle');
      c.setAttribute('cx', String(cx)); c.setAttribute('cy', String(cy)); c.setAttribute('r', String(r));
      svg.appendChild(c);
    }
    if(name==='edit'){
      path('M21.2 6.8a2.8 2.8 0 0 0-4-4L4 16v4h4L21.2 6.8z');
      path('M15.5 4.5l4 4');
    } else if(name==='delete'){
      path('M4 7h16');
      path('M9 7V4h6v3');
      path('M7 7l1 13h8l1-13');
      path('M10 11v5M14 11v5');
    } else if(name==='close'){
      path('M6 6l12 12M18 6L6 18');
    } else if(name==='pin'){
      path('M7 17h10', 'pin-base');
      path('M12 17v4', 'pin-base');
      path('M8 17v-5H6l3-4V3h6v5l3 4h-2v5H8z', 'pin-body');
    } else if(name==='collapse'){
      path('M6 12h12');
    } else if(name==='comment'){
      path('M4 5.5h16v11H9l-5 4v-15z');
    } else if(name==='fork'){
      // One source on the left diverges into two forward branches. This matches
      // the left-to-right Fork Tree and avoids the old down-flow/forward-arrow cue.
      path('M7 12h2');
      path('M9 12c4 0 4-5 8-5');
      path('M9 12c4 0 4 5 8 5');
      circle(5,12,2); circle(19,7,2); circle(19,17,2);
    } else if(name==='clock'){
      circle(12,12,8.5);
      path('M12 7.5v5l3.3 2');
    } else if(name==='up'){
      path('M6 15l6-6 6 6');
    } else if(name==='down'){
      path('M6 9l6 6 6-6');
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
  function editCancelButton(label){
    var button=el('button','edit-cancel');
    setIconButton(button,'close',label||'Cancel edit (Esc)');
    return button;
  }
  // Label + the shared horizontal fork icon, so Composer and Queue use one
  // left-to-right branching symbol everywhere an action creates a new session.
  function setForkButtonLabel(btn, text){
    if(!btn) return;
    btn.textContent='';
    btn.appendChild(document.createTextNode(text));
    var ic=svgIcon('fork');
    ic.classList.add('splitbtn-ico');
    btn.appendChild(ic);
  }
  function applyStats(stats){
    if(!stats) return;
    function compact(value){ var n=Math.max(0,Number(value)||0); return n>=1000000?(n/1000000).toFixed(1)+'M':n>=1000?(n/1000).toFixed(1)+'k':String(Math.round(n)); }
    var sessions1h=byId('sessions1h'), prompts1h=byId('prompts1h'), chars1h=byId('chars1h');
    if(sessions1h) sessions1h.textContent=compact(stats.sessions1h);
    if(prompts1h) prompts1h.textContent=compact(stats.prompts1h);
    if(chars1h) chars1h.textContent=compact(stats.chars1h);
    var summary=compact(stats.chars1h)+' chars/1h · '+compact(stats.prompts1h)+' pushes/1h · '+compact(stats.sessions1h)+' sessions/1h';
    var workStatsBtn=byId('workStatsBtn');
    if(workStatsBtn){ workStatsBtn.removeAttribute('title'); workStatsBtn.setAttribute('data-hover-tip',summary); workStatsBtn.setAttribute('aria-label','open work statistics: '+summary); }
  }
  function workModeInfo(mode){
    if(mode==='focus') return { label:'Narrow', range:'1–2 sessions / prompted H' };
    if(mode==='balanced') return { label:'Mixed', range:'3–5 sessions / prompted H' };
    return { label:'Wide', range:'6+ sessions / prompted H' };
  }
  function formatWorkNumber(value){
    var n=Number(value)||0;
    return n>=10 ? String(Math.round(n)) : n.toFixed(1);
  }
  function formatWorkPercent(value){
    if(value==null || !isFinite(Number(value))) return '—';
    return Math.round(Number(value)*100)+'%';
  }
  function formatWorkMinutes(value){
    if(value==null || !isFinite(Number(value))) return '—';
    var n=Number(value);
    return n>=60 ? formatWorkNumber(n/60)+'h' : formatWorkNumber(n)+'m';
  }
  function formatWorkDate(value){
    if(!value) return 'collecting now';
    return new Date(value).toLocaleString();
  }
  function workKpi(value, label){
    var node=el('div','work-kpi');
    node.appendChild(el('div','work-kpi-value',value));
    node.appendChild(el('div','work-kpi-label',label));
    return node;
  }
  function workStatsReadout(modes){
    var eligible=(modes||[]).filter(function(mode){ return Number(mode.promptedHours||0)>=5; });
    if(eligible.length<2) return 'A comparison needs at least 5 prompted hours in two breadth modes.';
    var narrow=eligible.find(function(mode){ return mode.mode==='focus'; }) || eligible[0];
    var broad=eligible.find(function(mode){ return mode.mode==='parallel'; }) || eligible[eligible.length-1];
    if(!narrow || !broad || narrow===broad) return 'A comparison needs at least 5 prompted hours in two breadth modes.';
    var text=workModeInfo(broad.mode).label+': '+formatWorkNumber(broad.completedTurnsPerPromptedHour)+' completed turns/H, '+formatWorkPercent(broad.switchRate)+' switching; '+workModeInfo(narrow.mode).label+': '+formatWorkNumber(narrow.completedTurnsPerPromptedHour)+' completed turns/H, '+formatWorkPercent(narrow.switchRate)+' switching.';
    if(Number(broad.outcomeSamples||0)>=5 && Number(narrow.outcomeSamples||0)>=5){
      text+=' Resolved or advanced within 72h: '+formatWorkPercent(broad.resolvedOrAdvanced72hRate)+' vs '+formatWorkPercent(narrow.resolvedOrAdvanced72hRate)+'.';
    }
    return text+' Breadth and real generation overlap are separate signals.';
  }
  function collaborationLabel(value){
    return String(value||'').replace(/_/g,' ').replace(/\\b\\w/g,function(ch){ return ch.toUpperCase(); });
  }
  function collaborationDistribution(title,items){
    var section=el('div','work-distribution');
    section.appendChild(el('div','work-section-note',title));
    (items||[]).forEach(function(item){
      var row=el('div','work-distribution-row');
      row.appendChild(el('span','',collaborationLabel(item.key)));
      var track=el('div','work-distribution-track'), fill=el('div','work-distribution-fill');
      fill.style.width=Math.max(2,Math.round(Number(item.rate||0)*100))+'%';
      track.appendChild(fill); row.appendChild(track);
      row.appendChild(el('span','work-distribution-value',String(item.count||0)+' · '+formatWorkPercent(item.rate)));
      section.appendChild(row);
    });
    return section;
  }
  function renderWorkStats(stats){
    var body=byId('workStatsBody');
    if(!body) return;
    body.innerHTML='';
    if(!stats || !stats.summary){ body.appendChild(el('div','workstats-empty','No statistics available.')); return; }

    var summary=stats.summary;
    var kpis=el('div','work-kpis');
    kpis.appendChild(workKpi(String(summary.sessionsTouched||0),'sessions touched'));
    kpis.appendChild(workKpi(formatWorkNumber(summary.promptsPerElapsedHour),'pushes / elapsed H'));
    kpis.appendChild(workKpi(formatWorkNumber(summary.completedTurnsPerElapsedHour),'completed turns / elapsed H'));
    kpis.appendChild(workKpi(formatWorkPercent(summary.modelBusyRate),'tracked model busy'));
    body.appendChild(kpis);

    var resource=el('div','work-resource');
    resource.appendChild(el('span','', 'Live snapshot'));
    var generating=el('strong','',String(stats.live&&stats.live.generating||0)+' generating');
    var queued=el('strong','',String(stats.live&&stats.live.queuedTurns||0)+' queued across '+String(stats.live&&stats.live.queuedSessions||0)+' sessions');
    var observed=el('span','',String(summary.prompts||0)+' pushes · '+String(summary.completedTurns||0)+' tracked completions');
    var overlap=el('span','',summary.overlapRate==null ? 'overlap collecting' : formatWorkPercent(summary.overlapRate)+' of busy time overlapped · peak '+String(summary.peakConcurrency||0));
    var timing=el('span','',summary.medianTurnMinutes==null ? 'turn timing collecting' : 'median turn '+formatWorkMinutes(summary.medianTurnMinutes)+(summary.medianQueueWaitMinutes==null ? '' : ' · queue wait '+formatWorkMinutes(summary.medianQueueWaitMinutes)));
    var coverage=stats.coverage||{};
    resource.appendChild(generating); resource.appendChild(queued); resource.appendChild(observed); resource.appendChild(overlap); resource.appendChild(timing);
    body.appendChild(resource);

    var collaboration=stats.collaboration;
    var collaborationSection=el('section','work-section');
    var collaborationHead=el('div','work-section-head');
    collaborationHead.appendChild(el('div','work-section-title','Collaboration flow'));
    collaborationHead.appendChild(el('div','work-section-note',collaboration ? String(collaboration.labeledTurns||0)+' / '+String(collaboration.totalTurns||0)+' turns classified' : 'semantic collection unavailable'));
    collaborationSection.appendChild(collaborationHead);
    if(collaboration && Number(collaboration.totalTurns||0)>0){
      var flowKpis=el('div','work-kpis');
      flowKpis.appendChild(workKpi(formatWorkPercent(collaboration.coverageRate),'semantic coverage'));
      flowKpis.appendChild(workKpi(formatWorkPercent(collaboration.straightThroughRate),'straight through'));
      flowKpis.appendChild(workKpi(formatWorkPercent(collaboration.reworkRate),'rework'));
      flowKpis.appendChild(workKpi(formatWorkPercent(collaboration.completedHandoffRate),'completed handoff'));
      collaborationSection.appendChild(flowKpis);
      var distributions=el('div','work-distributions');
      if((collaboration.intents||[]).length) distributions.appendChild(collaborationDistribution('Work mix',collaboration.intents));
      if((collaboration.steering||[]).length) distributions.appendChild(collaborationDistribution('Steering',collaboration.steering));
      if(distributions.childNodes.length) collaborationSection.appendChild(distributions);
    }else{
      collaborationSection.appendChild(el('div','workstats-empty','Collaboration labels will appear after analyzed turns complete.'));
    }
    body.appendChild(collaborationSection);

    var chartSection=el('section','work-section');
    var chartHead=el('div','work-section-head');
    chartHead.appendChild(el('div','work-section-title','Hourly breadth allocation'));
    chartHead.appendChild(el('div','work-section-note','line height = active sessions · line = breadth mode'));
    chartSection.appendChild(chartHead);
    var buckets=Array.isArray(stats.timeline) ? stats.timeline : [];
    var chartScroll=el('div','work-line-scroll');
    var width=Math.max(360,buckets.length*14), height=144, pad=10, maxSessions=Math.max.apply(Math,[6].concat(buckets.map(function(bucket){ return Number(bucket.sessions||0); })));
    var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','work-line-chart'); svg.setAttribute('viewBox','0 0 '+width+' '+height); svg.setAttribute('width',String(width)); svg.setAttribute('height',String(height));
    svg.setAttribute('role','img'); svg.setAttribute('aria-label','Active sessions per hour, split into narrow, mixed, and wide breadth modes');
    [0,0.5,1].forEach(function(ratio){ var grid=document.createElementNS('http://www.w3.org/2000/svg','line'), y=pad+(height-pad*2)*(1-ratio); grid.setAttribute('class','work-line-grid'); grid.setAttribute('x1',String(pad)); grid.setAttribute('x2',String(width-pad)); grid.setAttribute('y1',String(y)); grid.setAttribute('y2',String(y)); svg.appendChild(grid); });
    ['focus','balanced','parallel'].forEach(function(mode){
      var path='', drawing=false;
      buckets.forEach(function(bucket,index){
        var active=Number((bucket.modeHours||{})[mode]||0)>0, x=pad+(width-pad*2)*(buckets.length<=1 ? 0.5 : index/(buckets.length-1)), y=height-pad-(Number(bucket.sessions||0)/maxSessions)*(height-pad*2);
        if(!active){ drawing=false; return; }
        path+=(drawing?' L':'M')+x.toFixed(1)+' '+y.toFixed(1); drawing=true;
      });
      if(path){ var line=document.createElementNS('http://www.w3.org/2000/svg','path'); line.setAttribute('class','work-line-path '+mode); line.setAttribute('d',path); svg.appendChild(line); }
      buckets.forEach(function(bucket,index){
        if(Number((bucket.modeHours||{})[mode]||0)<=0) return;
        var x=pad+(width-pad*2)*(buckets.length<=1 ? 0.5 : index/(buckets.length-1)), y=height-pad-(Number(bucket.sessions||0)/maxSessions)*(height-pad*2), point=document.createElementNS('http://www.w3.org/2000/svg','circle');
        point.setAttribute('class','work-line-point '+mode); point.setAttribute('cx',x.toFixed(1)); point.setAttribute('cy',y.toFixed(1)); point.setAttribute('r','2.8');
        var date=new Date(bucket.start), title=document.createElementNS('http://www.w3.org/2000/svg','title'); title.textContent=date.toLocaleString()+' · '+String(bucket.sessions||0)+' sessions · '+String(bucket.prompts||0)+' pushes · '+workModeInfo(mode).label; point.appendChild(title); svg.appendChild(point);
      });
    });
    chartScroll.appendChild(svg); chartSection.appendChild(chartScroll);
    var labels=el('div','work-line-labels');
    buckets.forEach(function(bucket,index){ if(index!==0 && index!==buckets.length-1 && index%Math.ceil(Math.max(1,buckets.length/6))!==0) return; var date=new Date(bucket.start); labels.appendChild(el('span','',buckets.length>24 ? String(date.getMonth()+1)+'/'+String(date.getDate())+' '+String(date.getHours()).padStart(2,'0') : String(date.getHours()).padStart(2,'0')+':00')); });
    chartSection.appendChild(labels);
    var legend=el('div','work-legend');
    ['focus','balanced','parallel'].forEach(function(mode){
      var info=workModeInfo(mode), item=el('span','work-legend-item');
      item.appendChild(el('span','work-swatch '+mode));
      item.appendChild(el('span','',info.label+' · '+info.range));
      legend.appendChild(item);
    });
    chartSection.appendChild(legend);
    body.appendChild(chartSection);

    var compare=el('section','work-section');
    var compareHead=el('div','work-section-head');
    compareHead.appendChild(el('div','work-section-title','Breadth comparison'));
    compareHead.appendChild(el('div','work-section-note','complete natural-hour samples · outcomes use timestamped daemon state changes'));
    compare.appendChild(compareHead);
    var tableWrap=el('div','work-table-wrap'), table=el('table','work-table');
    var thead=document.createElement('thead'), hr=document.createElement('tr');
    ['Breadth','Prompted H','Sessions / H','Completed turns / H','Median turn','Switch rate','Resolved / advanced · 72h'].forEach(function(label){ hr.appendChild(el('th','',label)); });
    thead.appendChild(hr); table.appendChild(thead);
    var tbody=document.createElement('tbody');
    (stats.modes||[]).forEach(function(mode){
      var tr=document.createElement('tr'), info=workModeInfo(mode.mode);
      var first=document.createElement('td'), name=el('span','work-mode-name');
      name.appendChild(el('span','work-swatch '+mode.mode)); name.appendChild(el('span','',info.label+' · '+info.range)); first.appendChild(name); tr.appendChild(first);
      tr.appendChild(el('td','',String(mode.promptedHours||0)));
      tr.appendChild(el('td','',mode.promptedHours ? formatWorkNumber(mode.sessionsPerPromptedHour) : '—'));
      tr.appendChild(el('td','',mode.promptedHours ? formatWorkNumber(mode.completedTurnsPerPromptedHour) : '—'));
      tr.appendChild(el('td','',formatWorkMinutes(mode.medianTurnMinutes)));
      tr.appendChild(el('td','',formatWorkPercent(mode.switchRate)));
      tr.appendChild(el('td','',formatWorkPercent(mode.resolvedOrAdvanced72hRate)+(mode.outcomeSamples ? ' · n='+String(mode.outcomeSamples) : '')));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody); tableWrap.appendChild(table); compare.appendChild(tableWrap);
    compare.appendChild(el('div','work-readout',workStatsReadout(stats.modes||[])));
    body.appendChild(compare);

    var coverageSection=el('section','work-section');
    var coverageHead=el('div','work-section-head');
    coverageHead.appendChild(el('div','work-section-title','Data coverage'));
    coverageHead.appendChild(el('div','work-section-note','prompt history is backfilled · resource and outcome history starts when recorded'));
    coverageSection.appendChild(coverageHead);
    coverageSection.appendChild(el('div','work-readout',String(coverage.sessionsWithPromptHistory||0)+' sessions with prompt history · daemon state '+String(coverage.sessionsWithState||0)+' covered / '+String(coverage.sessionsWithoutState||0)+' missing · turns since '+formatWorkDate(coverage.turnSince)+' · states since '+formatWorkDate(coverage.stateSince)));
    body.appendChild(coverageSection);

  }
  function loadWorkStats(){
    var body=byId('workStatsBody'), request=++workStatsRequest;
    if(body){ body.innerHTML=''; body.appendChild(el('div','workstats-loading','Loading work statistics…')); }
    fetch('/stats/work?range='+encodeURIComponent(workStatsRange),{cache:'no-store'})
      .then(function(r){ if(!r.ok) throw new Error('stats request failed'); return r.json(); })
      .then(function(stats){ if(request===workStatsRequest) renderWorkStats(stats); })
      .catch(function(){
        if(request!==workStatsRequest || !body) return;
        body.innerHTML=''; body.appendChild(el('div','workstats-error','Could not load work statistics.'));
      });
  }
  function loadWorkStatsRange(){
    try{
      var saved=localStorage.getItem(WORK_STATS_RANGE_KEY)||'';
      if(WORK_STATS_RANGES.indexOf(saved)>=0) return saved;
    }catch(e){}
    return 'today';
  }
  function setWorkStatsRange(range){
    workStatsRange=WORK_STATS_RANGES.indexOf(range)>=0 ? range : 'today';
    try{ localStorage.setItem(WORK_STATS_RANGE_KEY,workStatsRange); }catch(e){}
    document.querySelectorAll('.workstats-period').forEach(function(btn){ btn.setAttribute('aria-pressed',btn.getAttribute('data-range')===workStatsRange ? 'true' : 'false'); });
    loadWorkStats();
  }
  function openWorkStats(){
    var modal=byId('workStats');
    if(!modal) return;
    workStatsLastFocus=document.activeElement;
    modal.hidden=false; modal.setAttribute('aria-hidden','false');
    byId('workStatsBtn').setAttribute('aria-expanded','true');
    setWorkStatsRange(workStatsRange);
    byId('workStatsClose').focus();
  }
  function closeWorkStats(){
    var modal=byId('workStats');
    if(!modal || modal.hidden) return;
    modal.hidden=true; modal.setAttribute('aria-hidden','true');
    byId('workStatsBtn').setAttribute('aria-expanded','false');
    workStatsRequest++;
    if(workStatsLastFocus && workStatsLastFocus.focus) workStatsLastFocus.focus();
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
    var messages=byId('msgs');
    var queue=byId('queue');
    var avoid=byId('avoidPanel');
    var footH=overlayHeight(foot) || 136;
    var queueH=(queue && queue.childElementCount) ? overlayHeight(queue) : 0;
    var avoidH=(avoid && !avoid.hidden) ? overlayHeight(avoid) : 0;
    var scrollbarW=messages ? Math.max(0,messages.offsetWidth-messages.clientWidth) : 0;
    main.style.setProperty('--chat-scrollbar-width',scrollbarW+'px');
    main.style.setProperty('--composer-overlay-height', footH+'px');
    main.style.setProperty('--queue-overlay-height', queueH+'px');
    main.style.setProperty('--avoid-overlay-height', avoidH+'px');
    // The bottom padding just changed. If the reader was pinned to the bottom,
    // re-pin so a just-sent user turn / generating line isn't left behind the
    // composer (the padding update lands a frame after the send-time scroll).
    if(stick){ var m=byId('msgs'); if(m) m.scrollTop=m.scrollHeight; }
  }
  function scheduleOverlayOffsets(){
    if(overlayLayoutRaf) return;
    overlayLayoutRaf=requestAnimationFrame(syncOverlayOffsets);
  }
  function syncCommentOverlayOffsets(){
    commentOverlayLayoutRaf=0;
    var panel=document.querySelector('.commentpanel'), foot=document.querySelector('.commentfoot'), queue=byId('commentQueue'), messages=byId('commentMsgs');
    if(!panel||!foot) return;
    var scrollbarW=messages ? Math.max(0,messages.offsetWidth-messages.clientWidth) : 0;
    panel.style.setProperty('--comment-scrollbar-width',scrollbarW+'px');
    panel.style.setProperty('--comment-composer-overlay-height',(overlayHeight(foot)||64)+'px');
    panel.style.setProperty('--comment-queue-overlay-height',((queue&&queue.childElementCount)?overlayHeight(queue):0)+'px');
    if(commentStick){ var host=byId('commentMsgs'); if(host) host.scrollTop=host.scrollHeight; }
  }
  function scheduleCommentOverlayOffsets(){
    if(commentOverlayLayoutRaf) return;
    commentOverlayLayoutRaf=requestAnimationFrame(syncCommentOverlayOffsets);
  }
  function scheduleIsPending(item){
    return !!(item && item.status!=='dispatched' && item.status!=='cancelled');
  }
  function scheduledItemsForSession(s){
    if(!s) return [];
    var provider=providerSessionId(s), client=String(s.clientBranchId||s.sessionId||'');
    return SCHEDULES.filter(function(item){
      if(!scheduleIsPending(item)||!item.payload) return false;
      return item.kind==='message'
        ? String(item.payload.sessionId||'')===String(provider||s.sessionId||'')
        : item.kind==='session' && String(item.payload.clientSessionId||'')===client;
    });
  }
  function scheduledCommentsForThread(threadId){
    return SCHEDULES.filter(function(item){
      return scheduleIsPending(item)&&item.kind==='comment'&&item.payload&&String(item.payload.threadId||'')===String(threadId||'');
    });
  }
  function scheduleDateLabel(at){
    var date=new Date(Number(at)||0), now=new Date(), tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
    var time=date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    if(date.toDateString()===now.toDateString()) return 'today '+time;
    if(date.toDateString()===tomorrow.toDateString()) return 'tomorrow '+time;
    return date.toLocaleDateString([],{month:'short',day:'numeric'})+' '+time;
  }
  function schedulePad(n){ return String(n).padStart(2,'0'); }
  function scheduleDateTimeText(at){
    var d=new Date(Number(at)||Date.now());
    return d.getFullYear()+'-'+schedulePad(d.getMonth()+1)+'-'+schedulePad(d.getDate())+' '+schedulePad(d.getHours())+':'+schedulePad(d.getMinutes());
  }
  function defaultScheduleAt(){
    var d=new Date();
    d.setHours(d.getHours()+1,0,0,0);
    return d.getTime();
  }
  function closeSchedulePopover(){
    var pop=byId('schedulePop'), picker=byId('schedulePicker'), toggle=byId('schedulePickerToggle');
    if(pop) pop.hidden=true;
    if(picker) picker.hidden=true; if(toggle) toggle.setAttribute('aria-expanded','false');
    if(schedulePopoverState&&schedulePopoverState.button) schedulePopoverState.button.setAttribute('aria-expanded','false');
    schedulePopoverState=null;
  }
  function positionSchedulePopover(button){
    var pop=byId('schedulePop'); if(!pop||!button) return;
    var rect=button.getBoundingClientRect(), width=Math.min(360,window.innerWidth-24);
    pop.style.width=width+'px';
    var left=Math.max(12,Math.min(window.innerWidth-width-12,rect.right-width));
    pop.style.left=left+'px';
    pop.style.top='auto'; pop.style.bottom='auto';
    var height=pop.getBoundingClientRect().height||150;
    if(rect.top>height+16) pop.style.top=Math.max(8,rect.top-height-8)+'px';
    else pop.style.top=Math.min(window.innerHeight-height-8,rect.bottom+8)+'px';
  }
  function scheduleActionList(actions){
    if(typeof actions==='function') return [{id:'schedule',label:'Schedule',submit:actions}];
    return (Array.isArray(actions)?actions:[]).filter(function(action){ return action&&typeof action.submit==='function'; });
  }
  function defaultScheduleAction(){
    if(!schedulePopoverState) return null;
    var actions=schedulePopoverState.actions||[];
    return actions.find(function(action){ return action.id===schedulePopoverState.defaultActionId; }) || actions[0] || null;
  }
  function syncScheduleDateTime(){
    if(!schedulePopoverState) return;
    var d=new Date(schedulePopoverState.selectedAt), direct=byId('scheduleDateTimeInput'), hour=byId('scheduleHour'), minute=byId('scheduleMinute');
    if(direct) direct.value=scheduleDateTimeText(d.getTime());
    if(hour) hour.value=schedulePad(d.getHours());
    if(minute) minute.value=schedulePad(d.getMinutes());
  }
  function applyScheduleDirectInput(showError){
    if(!schedulePopoverState) return false;
    var input=byId('scheduleDateTimeInput'), msg=byId('scheduleMsg'), raw=String(input&&input.value||'').trim();
    var match=raw.match(/^(\\d{4})[-\\/](\\d{1,2})[-\\/](\\d{1,2})[ T](\\d{1,2}):(\\d{1,2})$/);
    if(!match){ if(showError&&msg) msg.textContent='Use YYYY-MM-DD HH:mm.'; return false; }
    var year=Number(match[1]), month=Number(match[2])-1, day=Number(match[3]), hour=Number(match[4]), minute=Number(match[5]);
    var date=new Date(year,month,day,hour,minute,0,0), valid=date.getFullYear()===year&&date.getMonth()===month&&date.getDate()===day&&date.getHours()===hour&&date.getMinutes()===minute;
    if(!valid){ if(showError&&msg) msg.textContent='Enter a valid date and time.'; return false; }
    schedulePopoverState.selectedAt=date.getTime(); schedulePopoverState.calendarMonth=new Date(year,month,1).getTime();
    // Keep blur parsing side-effect free for the picker DOM. Re-rendering here
    // replaces an option between pointerdown and click when the direct input
    // loses focus, which makes the user's hour/minute click disappear.
    if(msg) msg.textContent=''; syncScheduleDateTime(); return true;
  }
  function renderSchedulePicker(){
    if(!schedulePopoverState) return;
    var state=schedulePopoverState, selected=new Date(state.selectedAt), monthDate=new Date(state.calendarMonth), host=byId('scheduleDays'), title=byId('scheduleMonth');
    if(!host||!title) return;
    var year=monthDate.getFullYear(), month=monthDate.getMonth(), first=new Date(year,month,1), count=new Date(year,month+1,0).getDate();
    var today=new Date(); today.setHours(0,0,0,0);
    title.textContent=first.toLocaleDateString([],{month:'long',year:'numeric'}); host.innerHTML='';
    for(var blank=0;blank<first.getDay();blank++) host.appendChild(el('span','schedulepicker-empty'));
    for(var day=1;day<=count;day++) (function(dayNumber){
      var date=new Date(year,month,dayNumber), button=el('button','schedulepicker-day',String(dayNumber)); button.type='button';
      var isToday=date.getTime()===today.getTime(), isSelected=selected.getFullYear()===year&&selected.getMonth()===month&&selected.getDate()===dayNumber;
      button.classList.toggle('today',isToday); button.classList.toggle('selected',isSelected); button.disabled=date.getTime()<today.getTime()||!!state.busy;
      button.setAttribute('aria-label',date.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'}));
      if(isSelected) button.setAttribute('aria-current','date');
      button.onclick=function(){
        var next=new Date(state.selectedAt); next.setFullYear(year,month,dayNumber); state.selectedAt=next.getTime(); syncScheduleDateTime(); renderSchedulePicker();
      };
      host.appendChild(button);
    })(day);
    syncScheduleDateTime(); renderScheduleTimeOptions();
  }
  function renderScheduleTimeOptions(){
    if(!schedulePopoverState) return;
    var state=schedulePopoverState, selected=new Date(state.selectedAt), hourHost=byId('scheduleHourOptions'), minuteHost=byId('scheduleMinuteOptions');
    if(!hourHost||!minuteHost) return;
    hourHost.innerHTML=''; minuteHost.innerHTML='';
    for(var hourValue=0;hourValue<24;hourValue++) (function(value){
      var button=el('button','scheduletime-option',schedulePad(value)); button.type='button'; button.disabled=!!state.busy; button.classList.toggle('selected',selected.getHours()===value);
      button.onclick=function(){ var next=new Date(state.selectedAt); next.setHours(value,selected.getMinutes(),0,0); state.selectedAt=next.getTime(); syncScheduleDateTime(); renderScheduleTimeOptions(); };
      hourHost.appendChild(button);
    })(hourValue);
    [0,15,30,45].forEach(function(value){
      var button=el('button','scheduletime-option',schedulePad(value)); button.type='button'; button.disabled=!!state.busy; button.classList.toggle('selected',selected.getMinutes()===value);
      button.onclick=function(){ var next=new Date(state.selectedAt); next.setMinutes(value,0,0); state.selectedAt=next.getTime(); syncScheduleDateTime(); renderScheduleTimeOptions(); };
      minuteHost.appendChild(button);
    });
  }
  function applyScheduleTimeParts(){
    if(!schedulePopoverState) return;
    var state=schedulePopoverState, d=new Date(state.selectedAt), hour=byId('scheduleHour'), minute=byId('scheduleMinute');
    var rawHour=String(hour&&hour.value||'').trim(), rawMinute=String(minute&&minute.value||'').trim();
    var h=rawHour===''?NaN:Number(rawHour), m=rawMinute===''?NaN:Number(rawMinute);
    h=Number.isFinite(h)?Math.max(0,Math.min(23,Math.floor(h))):d.getHours();
    m=Number.isFinite(m)?Math.max(0,Math.min(59,Math.floor(m))):d.getMinutes();
    d.setHours(h,m,0,0); state.selectedAt=d.getTime(); syncScheduleDateTime(); renderScheduleTimeOptions();
  }
  function toggleSchedulePicker(force){
    if(!schedulePopoverState) return;
    var picker=byId('schedulePicker'), button=byId('schedulePickerToggle'); if(!picker||!button) return;
    var open=force===undefined?picker.hidden:!!force; picker.hidden=!open; button.setAttribute('aria-expanded',open?'true':'false');
    if(open){ renderSchedulePicker(); requestAnimationFrame(function(){ if(schedulePopoverState) positionSchedulePopover(schedulePopoverState.button); }); }
    else positionSchedulePopover(schedulePopoverState.button);
  }
  function renderScheduleActions(){
    var host=byId('scheduleActions');
    if(!host) return;
    var state=schedulePopoverState, actions=state&&state.actions||[], direct=byId('scheduleDateTimeInput'), toggle=byId('schedulePickerToggle'), hour=byId('scheduleHour'), minute=byId('scheduleMinute');
    if(direct) direct.disabled=!!(state&&state.busy); if(toggle) toggle.disabled=!!(state&&state.busy); if(hour) hour.disabled=!!(state&&state.busy); if(minute) minute.disabled=!!(state&&state.busy);
    host.innerHTML='';
    actions.forEach(function(action){
      var button=el('button','scheduleaction'+(action.primary?' primary':'')+(action.id==='fork'?' splitbtn':''),action.label||action.id); button.type='button'; button.disabled=!!(state&&state.busy);
      if(action.id==='fork') setForkButtonLabel(button,action.label||'Fork');
      button.onclick=function(){ submitScheduleAction(action); };
      host.appendChild(button);
    });
  }
  function openSchedulePopover(button,actions,initialAt,defaultActionId){
    var pop=byId('schedulePop'), picker=byId('schedulePicker'), direct=byId('scheduleDateTimeInput'), toggle=byId('schedulePickerToggle'), msg=byId('scheduleMsg');
    if(!pop||!direct||!toggle||!button) return;
    if(schedulePopoverState&&schedulePopoverState.button===button){ closeSchedulePopover(); return; }
    closeSchedulePopover();
    actions=scheduleActionList(actions);
    if(!actions.length) return;
    var selected=actions.some(function(action){ return action.id===defaultActionId; }) ? defaultActionId : actions[0].id;
    var at=Number(initialAt)||defaultScheduleAt(), initialDate=new Date(at);
    schedulePopoverState={button:button,actions:actions,defaultActionId:selected,busy:false,selectedAt:at,calendarMonth:new Date(initialDate.getFullYear(),initialDate.getMonth(),1).getTime()};
    button.setAttribute('aria-expanded','true');
    toggle.setAttribute('aria-expanded','false'); if(picker) picker.hidden=true; syncScheduleDateTime();
    if(msg) msg.textContent='';
    var zone=byId('scheduleZone'); if(zone) zone.textContent=Intl.DateTimeFormat().resolvedOptions().timeZone||'local time';
    renderScheduleActions(); pop.hidden=false; positionSchedulePopover(button);
    setTimeout(function(){ direct.focus(); direct.select(); },0);
  }
  function submitScheduleAction(action){
    if(!schedulePopoverState) return;
    if(!applyScheduleDirectInput(true)) return;
    applyScheduleTimeParts();
    var msg=byId('scheduleMsg'), at=Number(schedulePopoverState.selectedAt)||0;
    if(!Number.isFinite(at)||at<=Date.now()){ if(msg) msg.textContent='Choose a future time.'; return; }
    var state=schedulePopoverState;
    if(!action){ if(msg) msg.textContent='Choose an action.'; return; }
    state.busy=true; renderScheduleActions(); renderSchedulePicker();
    var result;
    try{ result=action.submit(at); }catch(error){ result=Promise.reject(error); }
    Promise.resolve(result).then(function(ok){
      if(ok!==false){ closeSchedulePopover(); return; }
      if(schedulePopoverState===state){ state.busy=false; renderScheduleActions(); renderSchedulePicker(); }
    }).catch(function(error){
      if(schedulePopoverState!==state) return;
      state.busy=false; renderScheduleActions(); renderSchedulePicker();
      if(msg) msg.textContent=error&&error.message?error.message:'Could not schedule.';
    });
  }
  function scheduleRequest(path,options){
    return fetch(path,options).then(function(r){ return r.json(); }).then(function(res){
      if(!res.ok) throw new Error(res.error||'Could not update schedule.');
      syncSchedules(res.schedules||[]);
      return res;
    });
  }
  function createSchedule(kind,runAt,payload){
    return scheduleRequest('/schedules',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:kind,runAt:runAt,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',payload:payload})});
  }
  function scheduleMessageFor(runAt,target,turn,goalRequested){
    if(!target||target.pendingNew||!providerSessionId(target)) throw new Error(target&&target.pendingScheduled?'This session is already waiting to start.':'Session is not ready.');
    if(!turn.text&&!turn.attachments.length) throw new Error('Write a message first.');
    if(goalRequested&&!turn.text) throw new Error('Goal requires an objective.');
    return createSchedule('message',runAt,{sessionId:providerSessionId(target),text:turn.text,attachments:turn.attachments,references:pinReferencePayload(turn.references),goal:goalRequested===true});
  }
  function scheduleCurrentMessage(runAt){
    if(!cur||cur.pendingNew){ throw new Error(cur&&cur.pendingScheduled?'This session is already waiting to start.':'Session is not ready.'); }
    if(composerVendorChanged()) throw new Error('Use the current session vendor before scheduling.');
    var turn=currentComposerTurn();
    var target=cur, goalRequested=goalArmed;
    return scheduleMessageFor(runAt,target,turn,goalRequested).then(function(res){
      if(cur===target){ clearComposer(); if(goalRequested){ goalArmed=false; refreshGoalToggle(); } }
      return res;
    });
  }
  function scheduleForkFor(runAt,target,turn,prefixHistory,opts){
    opts=opts||{};
    if(!target) throw new Error('Session is not ready to fork.');
    var parentId=providerSessionId(target);
    if(!parentId||target.pendingNew||target.pendingFork) throw new Error('Session is not ready to fork.');
    if(!turn.text&&!turn.attachments.length) throw new Error('A scheduled fork needs a first message.');
    if(goalArmed) throw new Error('Scheduled Fork does not support Goal yet.');
    var config=currentForkDefaults(), info=vendorInfo(config.vendor);
    if(!info) throw new Error('Unknown vendor: '+config.vendor);
    if(!info.available||info.chat===false) throw new Error(info.message||config.vendor+' is not available for in-browser forks.');
    var shown=shownTurnText(turn);
    var context=prefixHistory!==undefined
      ? cloneTranscriptMsgs(prefixHistory||[])
      : forkBaseHistory(cachedTranscriptFor(target)||[],shown);
    var clientSessionId=makeClientBranchId();
    return createSchedule('session',runAt,{
      mode:'fork',clientSessionId:clientSessionId,parentSessionId:parentId,parentVendor:target.vendor,
      cwd:target.cwd||'',vendor:config.vendor,text:turn.text,attachments:turn.attachments||[],
      references:pinReferencePayload(turn.references),contextMessages:context,
      model:config.model||undefined,effort:config.effort||undefined,speed:config.speed||undefined,
      tags:(target.tags||[]).slice()
    }).then(function(res){
      var item=res.item, card=item&&findSessionByClientId(item.payload&&item.payload.clientSessionId);
      if(card){
        inheritSessionTextCollections(target,card);
        groupChatSession(target,card);
        if(opts.selectCard) select(card); else renderChatTabs();
      }
      return res;
    });
  }
  function scheduleCurrentFork(runAt){
    if(!cur) throw new Error('Pick a session before scheduling a fork.');
    var target=cur, turn=currentComposerTurn();
    return scheduleForkFor(runAt,target,turn,undefined,{selectCard:false}).then(function(res){
      if(cur===target) clearComposer();
      return res;
    });
  }
  function scheduleNewSession(runAt){
    if(newSessionPending) throw new Error('New session form is busy.');
    var dir=String((byId('ndir')||{}).value||'').trim(), text=String((byId('np')||{}).value||'').trim();
    var vendor=String((byId('nvendor')||{}).value||'').trim().toLowerCase();
    var attachments=newAttachments.map(function(att){ return Object.assign({},att); });
    if(!dir) throw new Error('Pick or type a directory.');
    if(!vendor) throw new Error('Pick a vendor.');
    var info=vendorInfo(vendor);
    if(!info) throw new Error('Unknown vendor: '+vendor);
    if(!info.available) throw new Error(info.message||vendor+' CLI is unavailable.');
    if(info.chat===false) throw new Error('Terminal-only sessions cannot be scheduled.');
    if(!text&&!attachments.length) throw new Error('A scheduled session needs a first message.');
    if(newGoalArmed&&!text) throw new Error('Goal requires an objective.');
    var clientSessionId=makeClientSessionId('scheduled'), model=selectedNewModel(), effort=selectedNewEffort(), speed=selectedNewSpeed();
    var tags=newSessionTags.slice(), goalRequested=newGoalArmed;
    return createSchedule('session',runAt,{clientSessionId:clientSessionId,cwd:dir,vendor:vendor,text:text,attachments:attachments,model:model||undefined,effort:effort||undefined,speed:speed||undefined,goal:goalRequested===true,tags:tags}).then(function(res){
      rememberNewSessionPrefs(vendor,model,effort,speed); rememberRecentDir(dir);
      byId('np').value=''; newAttachments=[]; newGoalArmed=false; newSessionTags=[];
      renderAttachments('new'); refreshNewGoalToggle(); renderNewTagPicker(); resetNewSessionDir(dir); closeNewBox();
      var item=res.item, card=item&&findSessionByClientId(item.payload&&item.payload.clientSessionId);
      if(card) select(card);
      return res;
    });
  }
  function scheduledSessionBaseHistory(item){
    var payload=item&&item.payload||{};
    return payload.mode==='fork' ? cloneTranscriptMsgs(payload.contextMessages||[]) : [];
  }
  function projectScheduledSessionTranscript(session,item){
    if(!session||!item||!item.payload||item.kind!=='session') return;
    if(session.materializingScheduled) return;
    var payload=item.payload, history=scheduledSessionBaseHistory(item);
    var opening=shownTurnText({text:String(payload.text||''),attachments:Array.isArray(payload.attachments)?payload.attachments:[]});
    if(opening) history.push({role:'user',text:opening,attachments:cloneAttachments(payload.attachments),references:clonePinReferences(payload.references),tools:[]});
    cacheTranscript(session,history);
    if(cur===session) renderPersistedAndPending(history,null);
  }
  function materializeScheduledSession(target){
    if(!target||!target.pendingScheduled||target.materializingScheduled) return;
    var item=SCHEDULES.find(function(candidate){ return candidate&&candidate.id===target.scheduleRunId&&candidate.kind==='session'; });
    if(!item){ showToast('This scheduled session is no longer waiting.','warn'); return; }
    if(composerVendorChanged()) return;
    var availability=vendorInfo(target.vendor);
    if(availability&&!availability.available){ showToast(availability.message||target.vendor+' CLI is unavailable.','warn'); return; }
    var turn=currentComposerTurn();
    if(!turn.text&&!turn.attachments.length) return;
    if(goalArmed&&!turn.text){ showToast('Goal requires an objective','warn'); return; }
    var goalRequested=goalArmed, shown=shownTurnText(turn), base=scheduledSessionBaseHistory(item);
    target.materializingScheduled=true;
    clearComposer();
    if(goalRequested){ goalArmed=false; refreshGoalToggle(); }
    cacheTranscript(target,base);
    if(base.length) renderPersistedAndPending(base,null); else { var host=byId('msgs'); if(host) host.innerHTML=''; }
    rememberPendingUserMsg(target.sessionId,shown,turn.attachments,turn.references);
    noteUserTurn(target,shown); cacheTranscriptUserMsg(target,shown,turn.attachments,turn.references);
    addMsg('user',shown,true,turn.attachments,turn.references); assistantEl=null;
    markVisitSend(); beginTurn(); expectSessionRun(target,genStart);
    var runEpoch=Number(target._runEpoch)||0;
    fetch('/schedules/materialize?id='+encodeURIComponent(item.id),{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({text:turn.text,attachments:turn.attachments||[],references:pinReferencePayload(turn.references),goal:goalRequested===true})
    }).then(function(r){ return r.json().then(function(res){ res._status=r.status; return res; }); }).then(function(res){
      var providerId=String(res.session||'');
      if(!res.ok||!providerId) throw Object.assign(new Error(res.error||'Session could not start.'),{response:res});
      if(!sessionRunWasAcknowledged(target,runEpoch)) acknowledgeSessionRun(target,Date.now());
      bindProviderSessionId(target,providerId);
      target.pendingNew=false; target.pendingScheduled=false; target.materializingScheduled=false; target.scheduleRunId=null;
      target.generating=res.generating!==false; target.generatingStartedAt=target.generating ? (target.generatingStartedAt||Date.now()) : null;
      if(item.payload.mode==='fork'&&item.payload.parentSessionId){ target.forkParentId=String(item.payload.parentSessionId); rememberForkRelation(providerId,target.forkParentId); }
      if(res.goal) applyGoalState(target,res.goal);
      flushPendingSessionTags(target); syncSchedules(res.schedules||[]); drainOrphanBusEvents(target);
      if(latestLiveSnapshot) applyLiveSnapshot(latestLiveSnapshot);
      syncOpenHeader(); refreshForkButton(); refreshRunConfigButton(); renderSidebar(); renderQueue();
      warmTranscriptCache(target);
    }).catch(function(error){
      var res=error&&error.response;
      target.materializingScheduled=false; target._awaitingLiveStart=false; target._awaitingLiveStartAt=null;
      if(res&&Array.isArray(res.schedules)) syncSchedules(res.schedules);
      forgetPendingUserMsg(target.sessionId,shown);
      projectScheduledSessionTranscript(target,item);
      setDraftForSession(target,turn.text||''); restoreComposerDraft(target);
      draftAttachments=cloneAttachments(turn.attachments); draftPinReferences=clonePinReferences(turn.references);
      stashAttachmentState(target); stashPinReferenceState(target); renderAttachments();
      if(goalRequested){ goalArmed=true; refreshGoalToggle(); }
      endTurn('failed'); renderSidebar(); renderQueue();
      showToast(error&&error.message?error.message:'Session could not start.','warn');
    });
  }
  function scheduleCurrentComment(runAt){
    if(!cur||!commentDrawerState.parentSessionId) throw new Error('Comment context is not ready.');
    var input=byId('commentInput'), text=String(input&&input.value||'').trim();
    if(!text) throw new Error('Write a comment first.');
    ensureCommentAnchorPinned();
    var target=cur, context=commentContextBeforeAnchor(target);
    var payload={threadId:commentDrawerState.threadId||'',parentSessionId:commentDrawerState.parentSessionId,anchorKey:commentDrawerState.anchorKey,anchorText:commentDrawerState.anchorText,anchorData:commentDrawerState.anchorData||undefined,text:text,contextMessages:context,createdWhileGenerating:!!(turnActive&&commentDrawerState.anchorMsg&&(commentDrawerState.anchorMsg===assistantEl||commentDrawerState.anchorMsg.hasAttribute('data-tool-pending'))),model:target.model||undefined,effort:target.effort||undefined,speed:target.speed||undefined};
    return createSchedule('comment',runAt,payload).then(function(res){
      var item=res.item, p=item&&item.payload;
      if(p&&p.threadId){
        var known=commentThreads[p.threadId];
        if(!known) rememberCommentThread({id:p.threadId,parentSessionId:p.parentSessionId,anchorKey:p.anchorKey,anchorText:p.anchorText,anchorData:p.anchorData||undefined,providerSessionId:'',vendor:p.vendor,cwd:p.cwd,createdAt:item.createdAt,status:'scheduled',messageCount:0});
        commentDrawerState.threadId=p.threadId;
      }
      if(input) input.value=''; syncCommentShortcutGhost(); renderCommentQueue(); syncCommentPromoteButton();
      return res;
    });
  }
  function editScheduled(item,button){
    openSchedulePopover(button,[{id:'reschedule',label:'Reschedule',primary:true,submit:function(runAt){
      return scheduleRequest('/schedules?id='+encodeURIComponent(item.id),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({runAt:runAt})});
    }}],item.runAt);
  }
  function runScheduledNow(item){
    var previousStatus=item.status, previousRunAt=item.runAt;
    item.status='claimed'; item.runAt=Date.now(); editingScheduleId='';
    renderQueue(); renderCommentQueue();
    return scheduleRequest('/schedules/run?id='+encodeURIComponent(item.id),{method:'POST'}).catch(function(error){
      item.status=previousStatus; item.runAt=previousRunAt; renderQueue(); renderCommentQueue(); showToast(error.message,'warn');
    });
  }
  function deleteScheduled(item){
    return scheduleRequest('/schedules?id='+encodeURIComponent(item.id),{method:'DELETE'}).then(function(res){
      if(item.kind==='comment'&&item.payload){
        var thread=commentThreads[item.payload.threadId];
        var remains=scheduledCommentsForThread(item.payload.threadId).length>0;
        if(thread&&!thread.providerSessionId&&!remains){
          delete commentThreads[thread.id]; VAULT_STATE.commentThreads=commentThreads;
          if(commentDrawerState.threadId===thread.id){ commentDrawerState.threadId=''; syncCommentPromoteButton(); }
          syncAllMessageCommentStates(); syncAllSessionCommentBadges(); renderPinTray();
        }
      }
      return res;
    }).catch(function(error){ showToast(error.message,'warn'); });
  }
  function makeScheduledQueueRow(item){
    if(editingScheduleId===item.id&&item.status!=='claimed'){
      var editingRow=el('div','qitem editing scheduled'); editingRow.appendChild(makeScheduledEditor(item)); return editingRow;
    }
    var row=el('div','qitem scheduled'+(item.status==='blocked'||item.status==='uncertain'?' blocked':''));
    row.appendChild(el('span','qtag',item.status==='claimed'?'dispatching':item.status==='blocked'?'blocked':item.status==='uncertain'?'review':'scheduled'));
    if(item.kind==='session'&&item.payload&&item.payload.mode==='fork') row.appendChild(el('span','qtag','fork'));
    if(item.payload&&item.payload.goal) row.appendChild(el('span','qtag','goal'));
    var text=String(item.payload&&item.payload.text||'');
    var tx=el('div','qtext',text||'(scheduled session)'); tx.title=text; row.appendChild(tx);
    var tm=el('span','qtime',scheduleDateLabel(item.runAt));
    tm.title=new Date(item.runAt).toLocaleString(); row.appendChild(tm);
    var run=el('button','qdispatch qsend','run now'); run.type='button'; run.disabled=item.status==='claimed'; run.title='Run this scheduled action now'; run.onclick=function(){ runScheduledNow(item); }; row.appendChild(run);
    var contentEdit=el('button','qaction qedit'); setIconButton(contentEdit,'edit','Edit scheduled content'); contentEdit.disabled=item.status==='claimed'; contentEdit.onclick=function(){ editingScheduleId=item.id; renderQueue(); renderCommentQueue(); }; row.appendChild(contentEdit);
    var reschedule=el('button','qaction qschedule'); setIconButton(reschedule,'clock','Reschedule'); reschedule.disabled=item.status==='claimed'; reschedule.onclick=function(){ editScheduled(item,reschedule); }; row.appendChild(reschedule);
    var del=el('button','qaction qdel'); setIconButton(del,'delete','Cancel scheduled action'); del.disabled=item.status==='claimed'; del.onclick=function(){ deleteScheduled(item); }; row.appendChild(del);
    if(item.error) row.setAttribute('data-hover-tip',item.error);
    return row;
  }
  function makeScheduledEditor(item){
    var payload=item.payload||{}, current=String(payload.text||''), attachments=Array.isArray(payload.attachments)?payload.attachments:[], references=Array.isArray(payload.references)?payload.references:[];
    var box=el('div','qeditbox');
    box.appendChild(el('span','qtag','scheduled'));
    if(item.kind==='session'&&payload.mode==='fork') box.appendChild(el('span','qtag','fork'));
    if(payload.goal) box.appendChild(el('span','qtag','goal'));
    if(attachments.length) box.appendChild(el('span','qtag',attachments.length+' file'+(attachments.length>1?'s':'')));
    if(references.length) box.appendChild(el('span','qtag',references.length+' pin'+(references.length>1?'s':'')));
    var input=el('input','qeditta'); input.type='text'; input.value=current; box.appendChild(input);
    var time=el('span','qtime',scheduleDateLabel(item.runAt)); time.title=new Date(item.runAt).toLocaleString(); box.appendChild(time);
    var save=el('button','qdispatch qsend','save'); save.title='Save this scheduled content'; box.appendChild(save);
    var cancel=editCancelButton('Cancel edit (Esc)'); box.appendChild(cancel);
    var del=el('button','qaction qdel'); setIconButton(del,'delete','Cancel scheduled action'); box.appendChild(del);
    function closeEditor(){ editingScheduleId=''; renderQueue(); renderCommentQueue(); }
    function commit(){
      var next=input.value.trim();
      if(!next){ editingScheduleId=''; deleteScheduled(item); return; }
      if(next===current){ closeEditor(); return; }
      input.disabled=true; save.disabled=true; cancel.disabled=true; del.disabled=true;
      scheduleRequest('/schedules?id='+encodeURIComponent(item.id),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({text:next})}).then(function(){ closeEditor(); }).catch(function(error){
        input.disabled=false; save.disabled=false; cancel.disabled=false; del.disabled=false; input.focus(); showToast(error.message,'warn');
      });
    }
    save.onclick=function(ev){ ev.stopPropagation(); commit(); };
    cancel.onclick=function(ev){ ev.stopPropagation(); closeEditor(); };
    del.onclick=function(ev){ ev.stopPropagation(); editingScheduleId=''; deleteScheduled(item); };
    box.onclick=function(ev){ ev.stopPropagation(); };
    input.onkeydown=function(ev){ ev.stopPropagation(); if(isImeConfirming(ev)) return; if(ev.key==='Enter'){ ev.preventDefault(); commit(); } else if(ev.key==='Escape'){ ev.preventDefault(); closeEditor(); } };
    setTimeout(function(){ try{ input.focus(); input.setSelectionRange(input.value.length,input.value.length); }catch(e){} },0);
    return box;
  }
  function scheduledSessionFromItem(item){
    var p=item.payload||{}, client=String(p.clientSessionId||'');
    if(!client) return null;
    var isFork=p.mode==='fork', parent=isFork?String(p.parentSessionId||''):'';
    var session={vendor:p.vendor||'claude',model:p.model||'',effort:p.effort||'',speed:p.speed||'',sessionId:client,clientBranchId:client,providerSessionId:null,forkParentId:parent||null,pendingNew:true,pendingScheduled:true,scheduleRunId:item.id,scheduledAt:item.runAt,title:isFork?forkTitleFromSession(findSessionById(parent),p.text):p.text||'(scheduled session)',lastPrompt:p.text||null,cwd:p.cwd||'',project:basename(p.cwd||''),file:'',ageDays:0,lastTs:item.createdAt||Date.now(),prompts:1,brief:null,state:null,seen:true,tags:Array.isArray(p.tags)?p.tags.slice():[],_pendingSessionTags:Array.isArray(p.tags)?p.tags.slice():[],generating:false,generatingStartedAt:null};
    projectScheduledSessionTranscript(session,item);
    return session;
  }
  function syncSchedules(items,quiet){
    SCHEDULES=Array.isArray(items)?items:[];
    var pendingClients={};
    SCHEDULES.forEach(function(item){
      if(item&&item.kind==='comment'&&item.status==='dispatched'&&item.dispatchId&&item.payload){
        var thread=commentThreads[item.payload.threadId];
        if(thread&&!thread.providerSessionId){
          thread=rememberCommentThread(Object.assign({},thread,{providerSessionId:String(item.dispatchId),status:'generating'}))||thread;
          if(commentDrawerState.threadId===thread.id) setCommentGenerating(true);
        }
      }
      if(!item||item.kind!=='session'||!item.payload) return;
      var client=String(item.payload.clientSessionId||''); if(!client) return;
      var synthetic=findSessionByClientId(client), dispatched=String(item.dispatchId||'');
      if(item.status==='dispatched'&&dispatched){
        var real=findSessionById(dispatched);
        if(item.payload.mode==='fork'&&item.payload.parentSessionId&&real){ real.forkParentId=String(item.payload.parentSessionId); rememberForkRelation(dispatched,real.forkParentId); }
        if(synthetic&&real&&synthetic!==real){
          var wasCurrent=cur===synthetic, idx=SESS.indexOf(synthetic); if(idx>=0) SESS.splice(idx,1);
          if(wasCurrent) select(real);
        } else if(synthetic){
          if(!synthetic.providerSessionId) bindProviderSessionId(synthetic,dispatched);
          if(item.payload.mode==='fork'&&item.payload.parentSessionId){ synthetic.forkParentId=String(item.payload.parentSessionId); rememberForkRelation(dispatched,synthetic.forkParentId); }
          synthetic.pendingNew=false; synthetic.pendingScheduled=false; synthetic.scheduleRunId=null;
          synthetic.generating=true; synthetic.generatingStartedAt=synthetic.generatingStartedAt||Date.now();
          warmTranscriptCache(synthetic);
        }
        return;
      }
      if(!scheduleIsPending(item)) return;
      pendingClients[client]=true;
      if(!synthetic){ var made=scheduledSessionFromItem(item); if(made) insertSession(made); }
      else { synthetic.pendingScheduled=true; synthetic.pendingNew=true; synthetic.scheduleRunId=item.id; synthetic.scheduledAt=item.runAt; synthetic.lastTs=item.createdAt||synthetic.lastTs; synthetic.lastPrompt=item.payload.text||synthetic.lastPrompt; if(item.payload.mode==='fork') synthetic.forkParentId=String(item.payload.parentSessionId||synthetic.forkParentId||'')||null; projectScheduledSessionTranscript(synthetic,item); }
    });
    SESS.slice().forEach(function(s){
      if(!s.pendingScheduled) return;
      var client=String(s.clientBranchId||s.sessionId||'');
      if(pendingClients[client]) return;
      var idx=SESS.indexOf(s); if(idx>=0) SESS.splice(idx,1);
      if(cur===s){ cur=null; resetOpenHeader(); }
    });
    if(!quiet){ sortSessions(); renderSidebar(); }
    SESS.forEach(syncSessionQueueBadge);
    renderQueue(); renderCommentQueue();
  }
  function showToast(text, kind, persistent){
    var host=byId('toastHost');
    if(!host) return null;
    var node=el('div','toast '+(kind||''),text);
    if(kind==='error') node.setAttribute('role','alert');
    host.appendChild(node);
    if(!persistent){
      setTimeout(function(){
        node.classList.add('hide');
        setTimeout(function(){ if(node.parentNode) node.parentNode.removeChild(node); }, 220);
      }, 4200);
    }
    return node;
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
  function sessionPanelWidthBounds(){
    var side=document.querySelector('.side');
    var sideWidth=side ? side.getBoundingClientRect().width : 320;
    return {min:320,max:Math.max(320,Math.min(1200,window.innerWidth-sideWidth-332))};
  }
  function applySessionPanelWidth(){
    var panel=byId('sessionPanel'); if(!panel) return;
    var bounds=sessionPanelWidthBounds();
    var width=Math.max(bounds.min,Math.min(bounds.max,Number(sessionPanelPreferredWidth)||660));
    panel.style.width=Math.round(width)+'px';
    if(sessionPanelVirtualState) scheduleSessionPanelVirtualWindow();
    if(newBoxOpen()) syncNewBoxPlacement();
    if(todoHubOpen()) syncTodoHubPlacement();
  }
  function syncSessionPanelButton(){
    var btn=byId('sessionPanelToggle'); if(!btn) return;
    btn.classList.toggle('on',sessionPanelOpen);
    btn.setAttribute('aria-expanded',sessionPanelOpen?'true':'false');
    btn.title=sessionPanelOpen?'close chats panel':'open chats panel';
    btn.setAttribute('aria-label',btn.title);
  }
  function setSessionPanelOpen(open,persist){
    sessionPanelOpen=!!open;
    var panel=byId('sessionPanel'),resizer=byId('sessionPanelResizer');
    if(panel) panel.hidden=!sessionPanelOpen;
    if(resizer) resizer.hidden=!sessionPanelOpen;
    syncSessionPanelButton();
    if(sessionPanelOpen){ applySessionPanelWidth(); renderSessionPanel(); }
    else {
      sessionPanelVirtualState=null;
      if(sessionTagPopoverState&&sessionTagPopoverState.surface==='panel') closeSessionTagPopover();
      var list=byId('sessionPanelList'); if(list) list.replaceChildren();
      pruneLiveTimingRegistrations();
    }
    if(persist!==false){
      try{ localStorage.setItem(SESSION_PANEL_OPEN_KEY,sessionPanelOpen?'1':'0'); }catch(e){}
    }
    scheduleOverlayOffsets();
    syncNewBoxPlacement();
    syncTodoHubPlacement();
  }
  function toggleSessionPanel(){ setSessionPanelOpen(!sessionPanelOpen,true); }
  function initSessionPanelLayout(){
    try{
      var savedWidth=parseInt(localStorage.getItem(SESSION_PANEL_WIDTH_KEY)||'',10);
      if(savedWidth>=320&&savedWidth<=1200) sessionPanelPreferredWidth=savedWidth;
      sessionPanelOpen=localStorage.getItem(SESSION_PANEL_OPEN_KEY)==='1';
    }catch(e){}
    setSessionPanelOpen(sessionPanelOpen,false);
    var resizer=byId('sessionPanelResizer'),panel=byId('sessionPanel');
    if(!resizer||!panel) return;
    var dragging=false;
    resizer.addEventListener('mousedown',function(ev){
      dragging=true; resizer.classList.add('dragging'); document.body.style.userSelect='none'; ev.preventDefault();
    });
    window.addEventListener('mousemove',function(ev){
      if(!dragging) return;
      sessionPanelPreferredWidth=ev.clientX-panel.getBoundingClientRect().left;
      applySessionPanelWidth();
    });
    window.addEventListener('mouseup',function(){
      if(!dragging) return;
      dragging=false; resizer.classList.remove('dragging'); document.body.style.userSelect='';
      sessionPanelPreferredWidth=parseInt(panel.style.width,10)||sessionPanelPreferredWidth;
      try{ localStorage.setItem(SESSION_PANEL_WIDTH_KEY,String(sessionPanelPreferredWidth)); }catch(e){}
    });
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
  function turnPinReferences(turn){ return turn && typeof turn==='object' && Array.isArray(turn.references) ? turn.references : []; }
  function clonePinReferences(refs){ return (refs||[]).map(function(ref){ return Object.assign({},ref); }); }
  function draftReferenceKey(ref){
    return ref&&ref.kind==='quote'
      ? 'quote:'+String(ref.sourceKey||'')+':'+hashText(String(ref.text||'')).toString(36)
      : String(ref&&ref.pinKey||'');
  }
  function pinReferencePayload(refs){
    return (refs||[]).map(function(ref){
      if(ref&&ref.kind==='quote'){
        return {kind:'quote',sourceKey:String(ref.sourceKey||''),role:ref.role==='selected'?'selected':'assistant',text:String(ref.text||'')};
      }
      return {kind:'pin',pinKey:String(ref&&ref.pinKey||''),pinSessionId:String(ref&&ref.pinSessionId||'')};
    }).filter(function(ref){ return ref.kind==='quote'?!!ref.text:!!ref.pinKey; });
  }
  function turnPreview(turn){
    var text=turnText(turn).replace(/\\s+/g,' ').trim();
    if(text) return text;
    var atts=turnAttachments(turn);
    return atts.length ? attachmentSummary(atts).replace(/\\n/g,' ') : '';
  }
  function cloneTurn(turn){
    return Object.assign({}, turn && typeof turn==='object' ? turn : {}, {
      text:turnText(turn), attachments:cloneAttachments(turnAttachments(turn)), references:clonePinReferences(turnPinReferences(turn))
    });
  }
  function rememberProviderRetry(s, turn, goalRequested){
    if(!s) return;
    var copy=cloneTurn(turn);
    s._providerRetry={turn:copy,shownText:shownTurnText(copy),goalRequested:goalRequested===true};
  }
  function retryProviderTurn(target){
    if(!target || cur!==target){ showToast('Open this session before retrying.','warn'); return false; }
    if(target.pendingNew){ showToast('This session has not started yet.','warn'); return false; }
    if(turnActive){ showToast('Wait for the current turn to finish before retrying.','warn'); return false; }
    var retry=target._providerRetry;
    if(!retry || !retry.turn){ showToast('The failed message is no longer available to retry.','warn'); return false; }
    var turn=cloneTurn(retry.turn), shown=String(retry.shownText||shownTurnText(turn));
    forgetPendingUserMsg(target.sessionId,shown);
    rememberPendingUserMsg(target.sessionId,shown,turn.attachments);
    if(retry.goalRequested){
      goalArmed=false;
      applyGoalState(target,{objective:turn.text,vendor:goalVendor(),status:'active',updatedAt:Date.now()});
    }
    dispatchSend(turn,shown,clearDerivedAvoidance(target),retry.goalRequested===true);
    return true;
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
  function removePinReference(referenceKey){
    draftPinReferences=draftPinReferences.filter(function(ref){ return draftReferenceKey(ref)!==referenceKey; });
    if(cur) stashPinReferenceState(cur);
    renderAttachments();
  }
  // A textarea can't host clickable inline tokens, so attachments live as chips in the input's
  // bottom-left corner instead — and each chip opens a native preview (blob URL) on click.
  function openAttachmentPreview(att){
    if(!att) return;
    try{
      var blob=null;
      if(att.kind==='text' && att.text!=null){
        blob=new Blob([att.text],{type:'text/plain;charset=utf-8'});
      } else if(att.data){
        var bin=atob(att.data),arr=new Uint8Array(bin.length);
        for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
        blob=new Blob([arr],{type:att.mediaType||'application/octet-stream'});
      }
      if(!blob) return;
      var url=URL.createObjectURL(blob);
      window.open(url,'_blank','noopener');
      setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(err){} },60000);
    }catch(err){}
  }
  function renderAttachments(target){
    var state=attachmentTargetState(target);
    var refs=target==='new' ? [] : draftPinReferences;
    var tray=byId(state.tray); if(!tray){
      if(!state.atts.length && !refs.length && !state.pending) setAttachmentMsg('', false, target);
      if(target!=='new') scheduleOverlayOffsets();
      return;
    }
    tray.innerHTML='';
    refs.forEach(function(ref){
      var chip=el('span','attachchip pinrefchip');
      var referenceKey=draftReferenceKey(ref);
      chip.title='Referenced context: '+String(ref.text||ref.pinKey||'');
      chip.appendChild(el('span','kind','@'));
      var label=el('span','name',String(ref.label||ref.text||'Pin').replace(/\\s+/g,' ').trim());
      chip.appendChild(label);
      if(ref.hasComment) chip.appendChild(el('span','commentmark','comments'));
      var del=el('button',null,'×');
      del.type='button'; del.title='Remove reference';
      del.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); removePinReference(referenceKey); };
      chip.appendChild(del);
      tray.appendChild(chip);
    });
    state.atts.forEach(function(att){
      var chip=el('span','attachchip');
      chip.setAttribute('role','button');
      chip.tabIndex=0;
      chip.title='Preview '+att.name;
      chip.onclick=function(ev){ ev.preventDefault(); openAttachmentPreview(att); };
      chip.onkeydown=function(ev){
        if(ev.target!==chip || (ev.key!=='Enter' && ev.key!==' ')) return;
        ev.preventDefault(); openAttachmentPreview(att);
      };
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
    tray.className='attachtray'+(state.atts.length || refs.length ? ' show' : '');
    if(!state.atts.length && !refs.length && !state.pending){
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
  function stashPinReferenceState(s){
    var key=draftKey(s);
    if(!key) return;
    if(draftPinReferences.length) sessionPinReferences[key]=clonePinReferences(draftPinReferences);
    else delete sessionPinReferences[key];
  }
  function restorePinReferenceState(s){
    var key=draftKey(s);
    draftPinReferences=key&&sessionPinReferences[key] ? clonePinReferences(sessionPinReferences[key]) : [];
    closePinReferencePicker();
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
      var errs=[];
      results.forEach(function(res){
        if(res.status==='fulfilled'){
          var att=res.value;
          var atts=target==='new' ? newAttachments : draftAttachments;
          if(!atts.some(function(x){ return x.name===att.name && x.kind===att.kind && (x.data||x.text)===(att.data||att.text); })){
            atts.push(att);
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
  var UNTAGGED_TAG_KEY='system:untagged';
  function untaggedTagDef(){
    return { key:UNTAGGED_TAG_KEY, kind:'untagged', label:'untagged', value:'untagged', title:'sessions with no custom tags', deletable:false };
  }
  function sessionIsUntagged(s){
    return !!s && !(s.tags||[]).some(function(tag){ return !!normalizeTag(tag); });
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
    if(sessionIsUntagged(s)) defs.push(untaggedTagDef());
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
    var untagged=untaggedTagDef();
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
    // Keep the system-owned empty bucket adjacent to the taxonomy it describes:
    // after vendor/project auto tags, immediately before the first user tag.
    defs.push(untagged); seen[untagged.key]=true;
    orderedUserTags().forEach(function(tag){
      var def=userTagDef(tag);
      if(!def || seen[def.key]) return;
      seen[def.key]=true;
      defs.push(def);
    });
    return defs;
  }
  function tagSessionCounts(){
    var counts={};
    SESS.forEach(function(s){
      var seen={};
      sessionTagKeys(s).forEach(function(key){
        if(seen[key]) return;
        seen[key]=true;
        counts[key]=(counts[key]||0)+1;
      });
    });
    return counts;
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
  function latestSessionUserTs(s){
    var latest=0;
    validPromptTs(s).forEach(function(ts){ if(ts>latest) latest=ts; });
    return latest;
  }
  function commentBelongsToSession(thread,s){
    if(!thread || !s) return false;
    var parent=String(thread.parentSessionId||'');
    return !!parent && (parent===String(s.sessionId||'') || parent===String(providerSessionId(s)||''));
  }
  function latestCommentUserTsForSession(s){
    var latest=0;
    Object.keys(commentThreads).forEach(function(key){
      var thread=commentThreads[key];
      if(!commentBelongsToSession(thread,s)) return;
      var ts=Number(thread.lastUserMessageAt || (thread.messageCount ? thread.createdAt : 0));
      if(isFinite(ts) && ts>latest) latest=ts;
    });
    return latest;
  }
  function latestUserTsForSession(s){
    return Math.max(latestSessionUserTs(s),latestCommentUserTsForSession(s));
  }
  function latestUserTsForTag(tag){
    var latest=0;
    SESS.forEach(function(s){
      if((s.tags||[]).indexOf(tag)<0) return;
      latest=Math.max(latest,latestUserTsForSession(s));
    });
    return latest;
  }
  function pinnedTagIndex(tag){
    tag=normalizeTag(tag);
    for(var i=0;i<pinnedTags.length;i++){ if(normalizeTag(pinnedTags[i])===tag) return i; }
    return -1;
  }
  function hiddenTagIndex(tag){
    tag=normalizeTag(tag);
    for(var i=0;i<hiddenTags.length;i++){ if(normalizeTag(hiddenTags[i])===tag) return i; }
    return -1;
  }
  function isTagHidden(tag){ return hiddenTagIndex(tag)>=0; }
  function isTagPinned(tag){ return !isTagHidden(tag) && pinnedTagIndex(tag)>=0; }
  function renderTagOptionLabel(option,label,tag){
    option.textContent='';
    option.appendChild(el('span','tag-option-label',label));
    if(!isTagPinned(tag)) return;
    option.classList.add('tag-option-pinned');
    var pin=svgIcon('pin'); pin.setAttribute('class','tag-option-pin'); option.appendChild(pin);
    option.setAttribute('aria-label',label+' (pinned)');
    option.title=label+' · pinned';
  }
  function visiblePinnedUserTags(){
    var byName={};
    TAGS.forEach(function(tag){ byName[normalizeTag(tag)]=tag; });
    var out=[], seen={};
    pinnedTags.forEach(function(tag){
      var key=normalizeTag(tag), actual=byName[key];
      if(!actual || isTagHidden(actual) || seen[key]) return;
      seen[key]=true;
      out.push(actual);
    });
    return out;
  }
  function orderedUnpinnedUserTags(){
    var rest=TAGS.filter(function(tag){ return !isTagPinned(tag); });
    if(tagOrderMode!=='recent') return rest;
    return rest.map(function(tag,idx){ return {tag:tag,idx:idx,ts:latestUserTsForTag(tag)}; })
      .sort(function(a,b){ return b.ts-a.ts || a.idx-b.idx; })
      .map(function(item){ return item.tag; });
  }
  function orderedUserTags(){
    return visiblePinnedUserTags().concat(orderedUnpinnedUserTags());
  }
  function selectableUserTags(assigned){
    assigned=assigned||{};
    return orderedUserTags().filter(function(tag){ return !assigned[normalizeTag(tag).toLowerCase()]; });
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
    var pinTip=isTagHidden(def.value) ? ' · hidden; restore it to return it to the everyday area' : (isTagPinned(def.value) ? ' · pinned; drag past the first unpinned tag to unpin' : ' · drag to the front to pin');
    var activityTip = (def.title || def.label) + ' · ' + count + ' user message' + (count===1?'':'s') + ' in latest-action 24h' + pinTip;
    chip.title = activityTip;
    if(btn) btn.title = activityTip;
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
  }
  function styleFilterTagChip(chip, btn, del, def, active){
    if(def && def.kind==='untagged'){
      clearTheme(chip);
      chip.classList.toggle('on', !!active);
      chip.classList.add('auto','untagged');
      if(btn){ btn.style.color=''; btn.style.backgroundColor='transparent'; }
      return;
    }
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
    saveFocusViews([view]);
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
  function syncTagOrderToggle(){
    var btn=byId('tagOrderToggle'); if(!btn) return;
    var recent=tagOrderMode==='recent';
    var value=byId('tagOrderValue'); if(value) value.textContent=recent ? 'recent' : 'fixed';
    btn.setAttribute('aria-pressed',recent ? 'true' : 'false');
    btn.setAttribute('aria-label',recent ? 'Unpinned custom tags sorted by latest user message. Click for fixed order.' : 'Unpinned custom tags use fixed drag-and-drop order. Click for recent order.');
    btn.setAttribute('data-tooltip',recent
      ? 'Pinned tags stay first; unpinned tags are sorted by their latest user message, including comments. Drag a tag to the front to pin it.'
      : 'Pinned tags stay first; unpinned tags use your fixed drag-and-drop order. Drag a tag across the boundary to pin or unpin it.');
  }
  function toggleTagOrderMode(){
    tagOrderMode=tagOrderMode==='recent' ? 'fixed' : 'recent';
    saveTagOrderMode();
    renderTagFilters();
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
    saveFocusViews([view]);
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
    var nextView=view || 'all';
    var togglesCurrentView=nextView!=='all' && (
      nextView===activeTagView ||
      (nextView.indexOf('focus:')===0 && activeTagView==='focus' && activeFocusId===nextView.slice(6))
    );
    if(togglesCurrentView) nextView='all';
    if(nextView.indexOf('focus:')===0){
      activeFocusId=nextView.slice(6);
      syncActiveTagsFromFocus();
      activeTagView = 'focus';
      saveFocusViews();
    } else activeTagView = nextView;
    renderTagFilters();
    reconcileCurrentSessionToFilter();
  }
  function addFocusView(){
    var view={ id:makeFocusId(), name:'Focus '+(focusViews.length+1), tags:[] };
    focusViews.push(view);
    activeFocusId=view.id;
    activeTags=[];
    activeTagView='focus';
    saveFocusViews([view]);
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
    saveFocusViews([],id);
    renderTagFilters();
    reconcileCurrentSessionToFilter();
  }
  function unreadSessionCount(){
    return SESS.filter(function(s){ return s && (s.generating || s.unread); }).length;
  }
  function renderViewTabs(){
    var wrap=byId('viewTabs'); if(!wrap) return; wrap.innerHTML='';
    function tab(id, label, title, disabled){
      var btn=el('button','viewtab'+(activeTagView===id?' on':''),label);
      btn.type='button';
      if(id==='unread'){
        var count=unreadSessionCount();
        btn.appendChild(el('span','viewtabcount',String(count)));
        btn.setAttribute('aria-label',label+' · '+count+' session'+(count===1?'':'s'));
      }
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
  function tagDefMatchesSearch(def){
    if(!tagSearchQ) return true;
    var hay=[def&&def.label,def&&def.title,def&&def.value,def&&def.kind]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.indexOf(tagSearchQ)>=0;
  }
  function sessionMatchesTagSearch(s){
    if(!tagSearchQ) return true;
    return allTagDefsForSession(s).some(tagDefMatchesSearch);
  }
  function sessionSearchDayStart(dayOffset){
    var date=new Date();
    date.setHours(0,0,0,0);
    date.setDate(date.getDate()+(Number(dayOffset)||0));
    return date.getTime();
  }
  function sessionSearchRangeBounds(value){
    var today=sessionSearchDayStart(0),tomorrow=sessionSearchDayStart(1);
    if(value==='today') return {start:today,end:tomorrow};
    if(value==='yesterday') return {start:sessionSearchDayStart(-1),end:today};
    if(value==='7d') return {start:sessionSearchDayStart(-6),end:tomorrow};
    if(value==='30d') return {start:sessionSearchDayStart(-29),end:tomorrow};
    if(value==='custom') return {start:sessionSearchCustomStart,end:sessionSearchCustomEnd,inclusiveEnd:true};
    return null;
  }
  function sessionSearchTimestamp(s){
    var ts=Number(sessionSortTs(s)||s&&s.lastTs)||0;
    if(ts>=100000000000) return ts;
    var age=Number(s&&s.ageDays);
    return Number.isFinite(age)&&age>=0 ? sessionSearchDayStart(-Math.floor(age))+43200000 : ts;
  }
  function sessionMatchesSearchRange(s){
    var bounds=sessionSearchRangeBounds(sessionSearchRange);
    if(!bounds) return true;
    var ts=sessionSearchTimestamp(s);
    return ts>=bounds.start&&(bounds.inclusiveEnd?ts<=bounds.end:ts<bounds.end);
  }
  function sessionMatchesSidebarSearch(s){
    if(!filterQ) return true;
    if(!sessionMatchesSearchRange(s)) return false;
    return sidebarFieldSearchHit(s) || !!contentSearchHit(s);
  }
  function sessionMatchesBulkArchiveScope(s){
    if(!s) return false;
    if(activeTagView==='unread') return false;
    if(activeTagView==='active' && !(s.generating || s.unread || s.seen)) return false;
    return sessionMatchesPriorityFilter(s) && sessionMatchesTagFilter(s, currentFilterTags()) && sessionMatchesTagSearch(s) && sessionMatchesSidebarSearch(s);
  }
  function bulkArchiveSeenTargets(){
    return SESS.filter(function(s){
      return !!(s && s.sessionId && !s.pendingFork && !s.generating && attentionState(s)==='seen' && sessionMatchesBulkArchiveScope(s));
    });
  }
  function syncBulkArchiveSeenButton(){
    var btn=byId('bulkArchiveSeen'); if(!btn) return;
    var count=bulkArchiveSeenTargets().length;
    btn.textContent='archive '+count+' seen session'+(count===1?'':'s');
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
  function sessionOperationId(s){
    return String(providerSessionId(s)||(s&&s.sessionId)||'');
  }
  function operationScope(kind, target){
    var id=typeof target==='string' ? target : sessionOperationId(target);
    return String(kind||'operation')+':'+id;
  }
  function beginOperation(kind, target){
    var scope=operationScope(kind,target), token=++operationClock;
    latestOperations[scope]=token;
    return {scope:scope,token:token};
  }
  function operationIsCurrent(operation){
    return !!(operation&&latestOperations[operation.scope]===operation.token);
  }
  function nextMutationTimestamp(){
    mutationTimestamp=Math.max(Date.now(),mutationTimestamp+1);
    return mutationTimestamp;
  }
  function serializeMutation(kind, target, task){
    var scope=operationScope(kind,target);
    var previous=mutationChains[scope]||Promise.resolve();
    var next=previous.catch(function(){}).then(task);
    var tracked=next.finally(function(){ if(mutationChains[scope]===tracked) delete mutationChains[scope]; });
    mutationChains[scope]=tracked;
    return tracked;
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
  function savedSessionGoals(){
    if(!VAULT_STATE || typeof VAULT_STATE!=='object') VAULT_STATE={};
    if(!VAULT_STATE.sessionGoals || typeof VAULT_STATE.sessionGoals!=='object' || Array.isArray(VAULT_STATE.sessionGoals)) VAULT_STATE.sessionGoals={};
    return VAULT_STATE.sessionGoals;
  }
  function goalForSession(s){
    var key=sessionTextKey(s);
    return key ? (savedSessionGoals()[key]||null) : null;
  }
  function goalIsActive(goal){ return !!(goal && goal.status && goal.status!=='complete'); }
  function newGoalVendor(){ return String((byId('nvendor')||{}).value||'').trim().toLowerCase(); }
  function newGoalSupported(){
    var vendor=newGoalVendor(),info=vendorInfo(vendor);
    return !!(info&&info.available&&info.chat!==false&&(vendor==='codex'||vendor==='claude'));
  }
  function refreshNewGoalToggle(){
    var button=byId('newGoalToggle'); if(!button) return;
    var vendor=newGoalVendor(),supported=newGoalSupported();
    if(vendor==='codex'||vendor==='claude') button.setAttribute('data-vendor',vendor);
    else button.removeAttribute('data-vendor');
    if(!supported) newGoalArmed=false;
    button.disabled=newSessionPending||!supported;
    button.classList.toggle('armed',newGoalArmed);
    button.setAttribute('aria-pressed',newGoalArmed?'true':'false');
    button.title=!supported ? (vendor==='cursor'?'Cursor does not support Goal':'Select an available Codex or Claude vendor')
      : newGoalArmed ? 'Goal armed — the first message becomes the objective'
      : 'Use the first message as a Goal';
    var input=byId('np');
    if(input) input.placeholder=newGoalArmed?'describe a verifiable completion condition…':'first message (optional · Enter to start · Shift+Enter for newline · drag files/images here)';
  }
  function toggleNewGoal(){
    if(newSessionPending||!newGoalSupported()) return;
    newGoalArmed=!newGoalArmed;
    refreshNewGoalToggle();
  }
  function applyGoalState(s,goal){
    var key=providerSessionId(s); if(!key) return;
    if(goal) savedSessionGoals()[key]=goal;
    else delete savedSessionGoals()[key];
    if(cur===s) refreshGoalToggle();
  }
  function goalVendor(){ return String((currentForkDefaults()).vendor||'').toLowerCase(); }
  function goalSupported(){
    var vendor=goalVendor();
    return !!(cur && providerSessionId(cur) && !cur.pendingFork && !composerVendorChanged() && (vendor==='codex'||vendor==='claude'));
  }
  function refreshGoalToggle(){
    var button=byId('goalToggle'); if(!button) return;
    var vendor=goalVendor(),goal=cur&&goalForSession(cur),active=goalIsActive(goal),supported=goalSupported();
    if(vendor==='codex'||vendor==='claude') button.setAttribute('data-vendor',vendor);
    else button.removeAttribute('data-vendor');
    if(!supported) goalArmed=false;
    button.disabled=!supported;
    button.classList.toggle('armed',!!goalArmed&&!active);
    button.classList.toggle('active',active);
    button.classList.toggle('pursuing',turnActive&&(active||goalArmed));
    button.setAttribute('aria-pressed',(goalArmed||active)?'true':'false');
    button.title=!supported ? (vendor==='cursor'?'Cursor does not support Goal':'Select a settled Codex or Claude session')
      : active ? (turnActive?'Goal in pursuit — click to clear':'Clear the active Goal')
      : goalArmed ? (turnActive?'Goal armed — the next queued message becomes the objective':'Goal armed — the next message becomes the objective')
      : 'Use the next message as a Goal';
    var input=byId('input');
    if(input) input.placeholder=goalArmed?'describe a verifiable completion condition…':(turnActive?'Generating… Enter queues your message':'message');
  }
  function syncGoalFromServer(s){
    var id=providerSessionId(s),vendor=String((s&&s.vendor)||'').toLowerCase(),generation=++goalSyncGeneration;
    if(!id || (vendor!=='codex'&&vendor!=='claude')){ if(cur===s) refreshGoalToggle(); return; }
    fetch('/chat/goal?session='+encodeURIComponent(id)+'&vendor='+encodeURIComponent(vendor))
      .then(function(r){ return r.json(); })
      .then(function(res){
        if(generation!==goalSyncGeneration || !res || !res.ok) return;
        applyGoalState(s,res.goal||null);
      }).catch(function(){});
  }
  function toggleGoal(){
    if(!cur || !goalSupported()) return;
    var target=cur,goal=goalForSession(target),id=providerSessionId(target),vendor=goalVendor();
    if(!goalIsActive(goal)){
      goalArmed=!goalArmed;
      refreshGoalToggle();
      return;
    }
    var button=byId('goalToggle'); if(button) button.disabled=true;
    fetch('/chat/goal/clear?session='+encodeURIComponent(id)+'&vendor='+encodeURIComponent(vendor),{method:'POST'})
      .then(function(r){ return r.json(); })
      .then(function(res){
        if(!res.ok) throw new Error(res.error||'Could not clear Goal');
        applyGoalState(target,null);
      }).catch(function(error){ showToast(error.message||'Could not clear Goal','warn'); })
      .finally(function(){ if(cur===target) refreshGoalToggle(); });
  }
  function sessionTitleKey(s){
    return providerSessionId(s);
  }
  function savedSessionTitles(){
    if(!VAULT_STATE || typeof VAULT_STATE!=='object') VAULT_STATE={};
    if(!VAULT_STATE.sessionTitles || typeof VAULT_STATE.sessionTitles!=='object' || Array.isArray(VAULT_STATE.sessionTitles)) VAULT_STATE.sessionTitles={};
    return VAULT_STATE.sessionTitles;
  }
  function applyVaultSessionTitles(){
    var titles=(VAULT_STATE && VAULT_STATE.sessionTitles && typeof VAULT_STATE.sessionTitles==='object') ? VAULT_STATE.sessionTitles : {};
    SESS.forEach(function(s){
      var key=sessionTitleKey(s);
      var value=key && typeof titles[key]==='string' ? titles[key].trim() : '';
      if(value || s.customTitle!==undefined) s.customTitle=value;
    });
  }
  function canEditSessionTitle(s){
    return !!(s && !s.pendingFork && sessionTitleKey(s));
  }
  function syncTitleEditButton(){
    var b=byId('titleEditBtn');
    if(!b) return;
    var enabled=canEditSessionTitle(cur);
    b.disabled=!enabled || titleEditing;
    b.title=enabled ? 'edit title' : 'select a session to edit title';
  }
  function saveSessionCustomTitle(s, value){
    var key=sessionTitleKey(s);
    if(!s || !key) return;
    var title=String(value||'').trim();
    s.customTitle=title;
    var titles=savedSessionTitles();
    if(title) titles[key]=title;
    else delete titles[key];
    var titlePatch={}; titlePatch[key]=title||null;
    saveVaultUiState({sessionTitles:titlePatch});
    renderSidebar();
    if(cur && cur.sessionId===s.sessionId) syncOpenHeader();
  }
  function startTitleEdit(){
    if(titleEditing || !canEditSessionTitle(cur)) return;
    var target=cur;
    var title=byId('h-title');
    if(!title) return;
    titleEditing=true;
    syncTitleEditButton();
    title.className='t it-title title-editing';
    title.removeAttribute('data-hover-tip');
    title.textContent='';
    var input=el('input','title-edit-input');
    input.value=customTitleText(target);
    input.placeholder=briefText(target);
    input.maxLength=160;
    input.setAttribute('aria-label','custom session title');
    title.appendChild(input);
    var done=false;
    var composing=false;
    function finish(save){
      if(done) return;
      done=true;
      titleEditing=false;
      if(save) saveSessionCustomTitle(target, input.value);
      else if(cur && cur.sessionId===target.sessionId) syncOpenHeader();
      syncTitleEditButton();
    }
    input.addEventListener('compositionstart',function(){ composing=true; });
    input.addEventListener('compositionend',function(){ composing=false; });
    input.addEventListener('keydown',function(ev){
      if(ev.key==='Enter' && !composing && !isImeConfirming(ev)){ ev.preventDefault(); finish(true); }
      else if(ev.key==='Escape'){ ev.preventDefault(); finish(false); }
    });
    input.addEventListener('blur',function(){ finish(true); });
    setTimeout(function(){ try{ input.focus(); input.select(); }catch(e){} }, 0);
  }
  function makeClientSessionId(prefix){
    prefix=String(prefix||'session');
    try{
      if(crypto && typeof crypto.randomUUID==='function') return prefix+'-'+crypto.randomUUID();
    }catch(e){}
    return prefix+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);
  }
  function makeClientBranchId(){ return makeClientSessionId('branch'); }
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
  function patchSessionView(next, options){
    if(!next || !next.sessionId) return;
    options=options||{};
    // Status/engagement writes return a freshly scanned SessionView. While a
    // turn is generating that view's lastTs/sortTs can advance with assistant
    // output, but opening or leaving a tab is navigation rather than activity.
    // Preserve the row's existing recent-sort anchor for those read-only
    // projections so switching among live tabs cannot reshuffle the sidebar.
    var preserveRecentOrder=options.source==='status'||options.source==='engagement';
    var s=findSessionById(next.sessionId);
    if(!s) return;
    ['pattern','patternset','patternReason','patternData','avoidancePrompt','nextStep','probe','state','stateset','score','reason','etaMin','brief','customTitle','forkParentId','priorityset','etaset','unread','seen','model','effort','speed'].forEach(function(k){
      if(options.source==='status' && k!=='unread' && k!=='seen') return;
      var derivedAvoidance=k==='pattern'||k==='patternReason'||k==='patternData'||k==='avoidancePrompt';
      if(options.source==='engagement' && !derivedAvoidance) return;
      if(options.source==='engagement' && (sessionAwaitingLiveStart(s)||s.patternset) && derivedAvoidance) return;
      if((options.source==='send'||options.source==='answer') && s.generating && derivedAvoidance) return;
      var turnScoped=k==='state'||k==='stateset'||k==='etaMin'||k==='etaset';
      if(next[k]!==undefined && !(s.generating&&turnScoped)) s[k]=next[k];
    });
    if(Array.isArray(next.userPromptTs)){
      var currentPromptTs=validPromptTs(s), incomingPromptTs=validPromptTs(next);
      var currentLatest=currentPromptTs.length?Math.max.apply(null,currentPromptTs):0;
      var incomingLatest=incomingPromptTs.length?Math.max.apply(null,incomingPromptTs):0;
      // A send response can be projected before the provider has flushed the
      // new user row to its transcript. Keep the optimistic timestamp until an
      // equally-newer authoritative snapshot arrives; otherwise the card's
      // Latest age jumps back even though the session activity correctly says now.
      if(incomingLatest>=currentLatest) s.userPromptTs=incomingPromptTs;
    }
    if(next.lastTs!==undefined) syncActivityLastTs(s, next.lastTs);
    else if(next.ageDays!==undefined && s.lastTs==null) s.ageDays=next.ageDays;
    if(!preserveRecentOrder){
      syncActivitySortTs(s, next.sortTs!=null ? next.sortTs : next.lastTs);
      sortSessions();
    }
    if(cur && cur.sessionId===s.sessionId){ syncOpenHeader(); renderAvoidancePanel(); }
    renderSidebar();
  }
  var RUN_START_TIMEOUT_MS=120000;
  function sessionAwaitingLiveStart(s, now){
    if(!s || !s._awaitingLiveStart) return false;
    var at=Number(s._awaitingLiveStartAt)||0;
    if(at && (Number(now)||Date.now())-at>RUN_START_TIMEOUT_MS){
      s._awaitingLiveStart=false;
      s._awaitingLiveStartAt=null;
      return false;
    }
    return true;
  }
  function expectSessionRun(s, startedAt){
    if(!s) return;
    var at=Number(startedAt)||Date.now();
    if(!sessionAwaitingLiveStart(s,at)) s._runEpoch=Math.max(0,Number(s._runEpoch)||0)+1;
    s._awaitingLiveStart=true;
    s._awaitingLiveStartAt=at;
    s.generating=true;
    s.generatingStartedAt=s.generatingStartedAt||at;
    s.lastAssistantOutputAt=null;
    s.lastGenerationDurationMs=null;
    s.lastGenerationOutcome=null;
    s.analysisPending=false;
    reviveAttention(s);
    applyGenerating(s);
  }
  function acknowledgeSessionRun(s, startedAt){
    if(!s) return;
    var wasAwaiting=sessionAwaitingLiveStart(s,startedAt);
    if(!wasAwaiting) s._runEpoch=Math.max(0,Number(s._runEpoch)||0)+1;
    s._runAcknowledgedEpoch=Math.max(Number(s._runAcknowledgedEpoch)||0,Number(s._runEpoch)||0);
    s._awaitingLiveStart=false;
    s._awaitingLiveStartAt=null;
    s.generating=true;
    s.generatingStartedAt=s.generatingStartedAt||Number(startedAt)||Date.now();
    applyGenerating(s);
  }
  function sessionRunWasAcknowledged(s, runEpoch){
    var expected=Number(runEpoch)||0;
    return !!(s && expected>0 && Number(s._runAcknowledgedEpoch||0)>=expected);
  }
  function rejectSessionRun(s, outcome){
    if(!s) return;
    s._awaitingLiveStart=false;
    s._awaitingLiveStartAt=null;
    if(s.lastGenerationDurationMs==null) finishGenerationTiming(s,Date.now(),outcome||'failed');
    s.generating=false;
    s.generatingStartedAt=null;
    s.lastAssistantOutputAt=null;
    applyGenerating(s);
  }
  // A resumed provider can take several seconds to start. Do not leave a stale
  // derived avoidance badge on screen while /chat/send waits for that startup:
  // the user's new turn is the event that resolves the observation. Manual
  // pattern overrides remain explicit and are therefore left alone.
  function clearDerivedAvoidance(s){
    if(!s || s.pattern!=='avoidance' || s.patternset) return null;
    var previous={
      pattern:s.pattern,
      patternReason:s.patternReason,
      patternData:s.patternData,
      avoidancePrompt:s.avoidancePrompt
    };
    s.pattern='unknown';
    s.patternReason=null;
    s.patternData=null;
    s.avoidancePrompt=null;
    if(cur===s){ renderAvoidancePanel(); headerSig(s); }
    renderSidebar();
    return previous;
  }
  function restoreDerivedAvoidance(s, previous){
    if(!s || !previous || s.pattern!=='unknown' || s.patternset) return;
    s.pattern=previous.pattern;
    s.patternReason=previous.patternReason;
    s.patternData=previous.patternData;
    s.avoidancePrompt=previous.avoidancePrompt;
    if(cur===s){ renderAvoidancePanel(); headerSig(s); }
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
    if(viewVisit.scrollPx >= Math.min(Math.max(chatMessageViewport(m).height * 0.5, 160), 480)){
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
      if(res && res.ok && res.view) patchSessionView(res.view,{source:'engagement'});
    }).catch(function(){});
  }
  function postSessionStatus(s, state){
    var id=providerSessionId(s);
    if(!s || !id || s.pendingFork) return Promise.resolve();
    var operation=beginOperation('status',s), updatedAt=nextMutationTimestamp();
    return serializeMutation('status',s,function(){
      // A newer full-state write supersedes one which has not started yet.
      if(!operationIsCurrent(operation)) return {ok:true,stale:true};
      return fetch('/session/status?session='+encodeURIComponent(id)+(s.cwd?('&cwd='+encodeURIComponent(s.cwd)):''),{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({ state: state, updatedAt: updatedAt })
      }).then(function(r){ return r.json(); });
    }).then(function(res){
      if(operationIsCurrent(operation) && res && res.ok && res.view) patchSessionView(res.view,{source:'status'});
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
  function rememberLocalUserEvent(sessionId,text){
    if(!sessionId || !text) return;
    var now=Date.now(),list=localUserEventReceipts[sessionId] || [];
    list=list.filter(function(entry){ return now-Number(entry.at||0)<120000; });
    list.push({text:String(text),at:now,acknowledged:false});
    localUserEventReceipts[sessionId]=list.slice(-16);
  }
  function matchesLocalUserEvent(sessionId,text,eventAt){
    var list=sessionId&&localUserEventReceipts[sessionId];
    if(!list || !list.length) return false;
    var now=Date.now(),at=Number(eventAt)||now,shown=String(text||'');
    list=list.filter(function(entry){ return now-Number(entry.at||0)<120000; });
    if(!list.length){ delete localUserEventReceipts[sessionId]; return false; }
    localUserEventReceipts[sessionId]=list;
    var best=-1,bestDistance=Infinity;
    // Prefer an unacknowledged receipt so two intentional identical sends are
    // paired in order rather than collapsed into one.
    for(var pass=0;pass<2 && best<0;pass++){
      for(var i=0;i<list.length;i++){
        var entry=list[i];
        if(entry.text!==shown || (!!entry.acknowledged)!==(pass===1)) continue;
        var distance=Math.abs(at-Number(entry.at||0));
        if(distance<bestDistance){ best=i; bestDistance=distance; }
      }
    }
    if(best<0 || bestDistance>120000) return false;
    list[best].acknowledged=true;
    return true;
  }
  function forgetLocalUserEvent(sessionId,text){
    var list=sessionId&&localUserEventReceipts[sessionId];
    if(!list || !list.length) return;
    for(var i=list.length-1;i>=0;i--){
      if(!list[i].acknowledged && list[i].text===String(text)){ list.splice(i,1); break; }
    }
    if(!list.length) delete localUserEventReceipts[sessionId];
  }
  function rememberPendingUserMsg(sessionId, text, attachments, references, expectLiveEvent){
    if(!sessionId || !text) return;
    var list=localPendingMsgs[sessionId] || (localPendingMsgs[sessionId]=[]);
    var state=transcriptCache['sid:'+sessionId];
    list.push({
      text:String(text),
      attachments:cloneAttachments(attachments),
      references:clonePinReferences(references),
      afterMsgs:Array.isArray(state) ? state.length : null,
      afterTail:pendingAfterTail(state),
      sentAt:Date.now()
    });
    if(expectLiveEvent!==false) rememberLocalUserEvent(sessionId,text);
  }
  function latestPendingUserText(sessionId){
    var list=sessionId && localPendingMsgs[sessionId];
    if(!list || !list.length) return '';
    return pendingEntryText(list[list.length-1]);
  }
  function transcriptCacheKey(file, vendor){
    return file ? String(vendor||'claude')+'|'+String(file) : '';
  }
  function transcriptStateKeys(s){
    var keys=[];
    if(s && s.sessionId) keys.push('sid:'+s.sessionId);
    var fileKey=s&&transcriptCacheKey(s.file,s.vendor);
    if(fileKey) keys.push(fileKey);
    return keys;
  }
  function hasTranscriptBaseline(s){
    return transcriptStateKeys(s).some(function(key){ return transcriptBaselines[key]===true; });
  }
  function markTranscriptBaseline(s){
    transcriptStateKeys(s).forEach(function(key){ transcriptBaselines[key]=true; });
  }
  function cloneTranscriptMsgs(msgs){
    return Array.isArray(msgs) ? msgs.map(function(m){
      var ts=transcriptTs(m);
      return {
        role: m && m.role || 'assistant',
        text: m && m.text || '',
        attachments: cloneAttachments(m && m.attachments),
        references: clonePinReferences(m && m.references),
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
    var m=String(key||'').match(/:(\\d+)$/);
    return m ? Number(m[1]) : -1;
  }
  function transcriptToolFromBlock(node){
    if(!node) return null;
    var block=node.classList&&node.classList.contains('toolc') ? node : node.querySelector&&node.querySelector('.toolc');
    if(!block) return null;
    var meta=block._attendTool||{};
    var tool={
      id:block.getAttribute('data-tool-id')||null,
      name:String(meta.name||block.getAttribute('data-tool-name')||'tool'),
      input:Object.prototype.hasOwnProperty.call(meta,'input') ? meta.input : null
    };
    // Completion is presence-based: an exec with an empty output is still
    // finished. Omitting result here makes addTool() render the copied call as
    // pending forever in a message-level fork.
    if(meta.resultReceived) tool.result=meta.result==null?'':String(meta.result);
    if(meta.isError) tool.isError=true;
    return tool;
  }
  function domHistoryBeforeMsg(msgEl){
    var msgs=byId('msgs');
    if(!msgs || !msgEl) return null;
    // A virtual transcript intentionally omits earlier turns from the DOM.
    // Falling back to the cached transcript preserves the complete Fork prefix.
    if(msgs.classList.contains('transcript-virtualized')) return null;
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
        } else if((node.classList.contains('toolc') || node.classList.contains('toolrow')) && out.length){
          var tool=transcriptToolFromBlock(node);
          if(tool) out[out.length-1].tools.push(tool);
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
    if(s && s.sessionId) objectCacheSet(transcriptCache,'sid:'+s.sessionId,copy,160);
    if(s && s.file) objectCacheSet(transcriptCache,transcriptCacheKey(s.file, s.vendor),copy,160);
    bumpTranscriptVersion(s);
    markTranscriptBaseline(s);
    return copy;
  }
  function ensureTranscriptState(s){
    if(!s || !s.sessionId) return null;
    var sidKey='sid:'+s.sessionId;
    var fileKey=transcriptCacheKey(s.file, s.vendor);
    var state=transcriptCache[sidKey] || (fileKey && transcriptCache[fileKey]);
    if(!state){
      state = [];
      objectCacheSet(transcriptCache,sidKey,state,160);
    } else {
      objectCacheSet(transcriptCache,sidKey,state,160);
    }
    if(fileKey) objectCacheSet(transcriptCache,fileKey,state,160);
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
  function cacheTranscriptUserMsg(s, text, attachments, references){
    var state=ensureTranscriptState(s);
    if(!state) return;
    state.push({ role:'user', text:String(text||''), attachments:cloneAttachments(attachments), references:clonePinReferences(references), tools:[], ts:Date.now() });
    bumpTranscriptVersion(s);
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
    if(msg){ msg.text = String(msg.text||'') + String(text); bumpTranscriptVersion(s); }
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
    bumpTranscriptVersion(s);
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
          bumpTranscriptVersion(s);
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
    if(sessionId && list && list.length){
      for(var i=list.length-1;i>=0;i--){
        if(pendingEntryText(list[i])===String(text)){ list.splice(i,1); break; }
      }
      if(!list.length) delete localPendingMsgs[sessionId];
    }
    forgetLocalUserEvent(sessionId,text);
  }
  function pendingEntryText(entry){
    return entry && typeof entry==='object' ? String(entry.text||'') : String(entry||'');
  }
  function pendingEntryAttachments(entry){
    return entry && typeof entry==='object' ? cloneAttachments(entry.attachments) : [];
  }
  function pendingEntryReferences(entry){
    return entry && typeof entry==='object' ? clonePinReferences(entry.references) : [];
  }
  function pendingEntryPromptText(entry){
    return attachmentDisplayText(pendingEntryText(entry), pendingEntryAttachments(entry));
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
  function transcriptUserMatchesPending(text, entry){
    var actual=String(text||'');
    if(actual===entry.text || actual===entry.promptText) return true;
    if(!entry.attachments.length) return false;
    // Text/file transports materialize attachments into the provider prompt.
    // Match that persisted form back to the original browser turn; image and
    // PDF transports normally persist only promptText and hit the branch above.
    var prefix=entry.promptText ? entry.promptText+'\\n\\n' : '';
    return actual.indexOf(prefix)===0 && /^\\[Attached (?:text|file): /.test(actual.slice(prefix.length));
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
        references: pendingEntryReferences(entry),
        promptText: pendingEntryPromptText(entry),
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
    var pendingSession=findSessionById(sessionId);
    var forkPending=!!(pendingSession && pendingSession.forkParentId);
    for(var i=0;i<entries.length;i++){
      var anchorEnd=findTailEndIndex(msgs, entries[i].afterTail);
      var afterWindow=entries[i].afterMsgs>=msgs.length;
      // A provider fork may store only the child delta even though our optimistic
      // cache was anchored to visible parent history. Once that unrelated parent
      // tail disappears, afterMsgs is no longer a valid index into the new
      // baseline; let the persisted timestamp confirm the opener instead.
      var replacedForkBaseline=forkPending && anchorEnd==null && (entries[i].afterTail.length>0 || entries[i].afterMsgs>0);
      var startAt=Math.max(minMsgIndex, anchorEnd!=null ? anchorEnd : entries[i].afterMsgs);
      for(var j=0;j<users.length;j++){
        if(!transcriptUserMatchesPending(users[j].text,entries[i])) continue;
        if(users[j].msgIndex < startAt && !timestampConfirmsPending(users[j], entries[i], afterWindow || replacedForkBaseline)) continue;
        if(entries[i].references.length) msgs[users[j].msgIndex].references=clonePinReferences(entries[i].references);
        lastConfirmed=i; minMsgIndex=users[j].msgIndex+1; break;
      }
    }
    var leftover=entries.slice(lastConfirmed+1);
    if(leftover.length) localPendingMsgs[sessionId]=leftover; else delete localPendingMsgs[sessionId];
    return leftover.slice();
  }
  function transcriptVirtualKey(sessionId){
    var s=sessionId&&findSessionById(sessionId)||cur;
    return sessionScrollKey(s)||String(sessionId||'transcript');
  }
  function transcriptVirtualToolKey(tc, ordinal){
    if(tc&&tc.id) return 'tool:id:'+hashText(String(tc.id)).toString(36);
    return 'tool:auto:'+ordinal+':'+hashText(String(tc&&tc.name||'tool')+'\\n'+fmt(tc&&tc.input)).toString(36);
  }
  function transcriptVirtualEntryEstimate(entry){
    if(!entry) return 0;
    if(entry.kind==='tool'){
      var input=fmt(entry.tool&&entry.tool.input),result=String(entry.tool&&entry.tool.result||'');
      var expanded=entry.tool&&(entry.tool.name==='apply_patch'||entry.tool.name==='edit'||entry.tool.name==='Write'||entry.tool.name==='MultiEdit'||isQuestionTool(entry.tool.name,entry.tool.input));
      return expanded ? Math.min(620,120+Math.ceil((input.length+result.length)/180)*18) : 42;
    }
    var text=String(entry.text||''),lines=Math.max(1,text.split('\\n').length);
    var charsPerLine=entry.role==='user'?58:82;
    return 54+Math.min(1100,Math.max(lines,Math.ceil(text.length/charsPerLine))*22);
  }
  function buildTranscriptVirtualModel(msgs,sessionId){
    msgs=Array.isArray(msgs)?msgs:[];
    var pending=transcriptPendingTail(sessionId,msgs).map(function(entry){
      return {
        text:entry.text,
        attachments:entry.attachments,
        references:entry.references,
        afterMsgs:Math.min(entry.afterMsgs,msgs.length)
      };
    });
    var turns=[],current=null,msgIndex=0,toolIndex=0,blockCount=0,blockOrder=0,keyToTurn={},keyOrder={},firstUserKey='',lastUserKey='';
    function finishTurn(){
      if(!current||!current.entries.length) return;
      current.estimate=Math.max(52,current.entries.reduce(function(total,entry){ return total+transcriptVirtualEntryEstimate(entry); },0));
      turns.push(current); current=null;
    }
    function addEntry(entry){
      if(entry.kind==='msg'&&entry.role==='user'){
        finishTurn();
        current={key:entry.key,entries:[]};
        if(!firstUserKey) firstUserKey=entry.key;
        lastUserKey=entry.key;
      } else if(!current) current={key:'intro:'+turns.length,entries:[]};
      current.entries.push(entry); blockCount++;
    }
    function addPendingAt(index){
      pending.forEach(function(entry){
        if(entry.afterMsgs!==index) return;
        var key='user:'+(msgIndex++);
        addEntry({kind:'msg',key:key,ordinal:msgIndex-1,role:'user',text:entry.text,attachments:entry.attachments,references:entry.references});
      });
    }
    for(var i=0;i<=msgs.length;i++){
      addPendingAt(i);
      if(i>=msgs.length) continue;
      var message=msgs[i]||{};
      if(message.text){
        var key=String(message.role||'assistant')+':'+msgIndex;
        addEntry({kind:'msg',key:key,ordinal:msgIndex++,role:message.role||'assistant',text:message.text,attachments:message.attachments,references:message.references});
      }
      (message.tools||[]).forEach(function(tool){
        var ordinal=toolIndex++,key=transcriptVirtualToolKey(tool,ordinal);
        addEntry({kind:'tool',key:key,ordinal:ordinal,tool:tool});
      });
    }
    finishTurn();
    turns.forEach(function(turn,index){
      turn.index=index;
      turn.entries.forEach(function(entry){ keyToTurn[entry.key]=index; keyOrder[entry.key]=blockOrder++; });
    });
    return {turns:turns,blockCount:blockCount,msgCount:msgIndex,toolCount:toolIndex,keyToTurn:keyToTurn,keyOrder:keyOrder,firstUserKey:firstUserKey,lastUserKey:lastUserKey};
  }
  function transcriptTurnHeightCache(key){
    var cache=transcriptTurnHeightCaches[key];
    if(!cache) cache=objectCacheSet(transcriptTurnHeightCaches,key,{},80);
    return cache;
  }
  function recalculateTranscriptOffsets(state){
    var offsets=[0],total=0,folded=cur?loadFoldedTurns(cur):[];
    for(var i=0;i<state.turns.length;i++){
      var turn=state.turns[i],height=state.heights[turn.key];
      if(folded.indexOf(turn.key)>=0) height=52;
      if(!(height>0)) height=turn.estimate||180;
      total+=height;
      offsets.push(total);
    }
    state.offsets=offsets; state.totalHeight=total;
  }
  function transcriptOffsetIndex(offsets,pixel){
    if(offsets.length<2) return 0;
    var low=0,high=offsets.length-2;
    while(low<high){ var mid=Math.floor((low+high)/2); if(offsets[mid+1]<pixel) low=mid+1; else high=mid; }
    return low;
  }
  function transcriptVirtualRange(state,top,height,forceIndex){
    var count=state.turns.length;
    if(!count) return {start:0,end:0};
    var start,end;
    if(forceIndex!=null){
      start=Math.max(0,forceIndex-3); end=Math.min(count,forceIndex+4);
    } else {
      start=transcriptOffsetIndex(state.offsets,Math.max(0,top-TRANSCRIPT_VIRTUAL_OVERSCAN_PX));
      end=Math.min(count,transcriptOffsetIndex(state.offsets,top+Math.max(height,600)+TRANSCRIPT_VIRTUAL_OVERSCAN_PX)+1);
    }
    while(end-start<TRANSCRIPT_VIRTUAL_MIN_TURNS && (start>0||end<count)){
      if(start>0) start--;
      if(end<count&&end-start<TRANSCRIPT_VIRTUAL_MIN_TURNS) end++;
    }
    return {start:start,end:end};
  }
  function renderTranscriptVirtualEntry(entry){
    if(entry.kind==='tool'){
      toolOrdinal=entry.ordinal;
      var tool=addTool(entry.tool);
      if(tool) tool.setAttribute('data-msg-key',entry.key);
      return tool;
    }
    msgOrdinal=entry.ordinal;
    var message=addMsg(entry.role,entry.text,true,entry.attachments,entry.references);
    if(message) message.setAttribute('data-msg-key',entry.key);
    return message;
  }
  function transcriptLiveTail(host){
    if(!host) return null;
    for(var i=host.children.length-1;i>=0;i--){
      var node=host.children[i];
      if(node.classList&&node.classList.contains('transcript-live-tail')) return node;
    }
    return null;
  }
  function appendChatNode(target,node){
    var host=byId('msgs');
    if(target===host&&host&&host.classList.contains('transcript-virtualized')){
      var tail=transcriptLiveTail(host);
      if(tail){ tail.appendChild(node); return node; }
    }
    target.appendChild(node);
    return node;
  }
  function syncTranscriptVirtualSpacers(state){
    var host=byId('msgs'); if(!host||state!==transcriptVirtualState) return;
    var top=host.querySelector('.transcript-virtual-spacer.top');
    var bottom=host.querySelector('.transcript-virtual-spacer.bottom');
    if(top) top.style.height=(state.offsets[state.start]||0)+'px';
    if(bottom) bottom.style.height=Math.max(0,state.totalHeight-(state.offsets[state.end]||0))+'px';
  }
  function restoreVirtualStreamingTargets(state){
    var host=byId('msgs');
    latestUserMsgEl=null; assistantEl=null;
    if(!host||state!==transcriptVirtualState) return;
    var users=host.querySelectorAll('.msg.user');
    if(state.end===state.turns.length&&users.length) latestUserMsgEl=users[users.length-1];
    if(turnActive&&state.end===state.turns.length){
      var lastTurn=state.turns[state.turns.length-1],lastEntry=lastTurn&&lastTurn.entries[lastTurn.entries.length-1];
      if(lastEntry&&lastEntry.kind==='msg'&&lastEntry.role==='assistant') assistantEl=findMsgByKey(lastEntry.key);
    }
  }
  function measureTranscriptVirtualTurns(state,pinBottom){
    var host=byId('msgs'); if(!host||state!==transcriptVirtualState) return;
    var previousOffsets=state.offsets.slice(),changed=false;
    Array.prototype.forEach.call(host.querySelectorAll('.transcript-turn[data-turn-index]'),function(node){
      var index=Number(node.getAttribute('data-turn-index')),turn=state.turns[index],height=node.offsetHeight;
      if(!turn||!(height>0)) return;
      if(Math.abs((state.heights[turn.key]||0)-height)>1){ state.heights[turn.key]=height; changed=true; }
    });
    if(changed){
      recalculateTranscriptOffsets(state);
      syncTranscriptVirtualSpacers(state);
      if(pinBottom) host.scrollTop=host.scrollHeight;
      else {
        var delta=(state.offsets[state.start]||0)-(previousOffsets[state.start]||0);
        if(delta) host.scrollTop=Math.max(0,host.scrollTop+delta);
      }
    }
    host.style.visibility='';
    restoreVirtualStreamingTargets(state);
    syncAllMessageCommentStates();
    renderPinTray();
    scheduleLatestPin();
  }
  function scheduleTranscriptVirtualMeasure(state,pinBottom){
    if(transcriptVirtualMeasureRaf) return;
    transcriptVirtualMeasureRaf=window.requestAnimationFrame(function(){
      transcriptVirtualMeasureRaf=0;
      measureTranscriptVirtualTurns(state,pinBottom);
    });
  }
  function observeTranscriptVirtualTurns(state){
    if(transcriptVirtualResizeObserver){ transcriptVirtualResizeObserver.disconnect(); transcriptVirtualResizeObserver=null; }
    if(!window.ResizeObserver) return;
    transcriptVirtualResizeObserver=new window.ResizeObserver(function(){ scheduleTranscriptVirtualMeasure(state,stick); });
    var host=byId('msgs');
    if(host) Array.prototype.forEach.call(host.querySelectorAll('.transcript-turn'),function(turn){ transcriptVirtualResizeObserver.observe(turn); });
  }
  function renderTranscriptVirtualRange(state,range,options){
    options=options||{};
    var host=byId('msgs'); if(!host||state!==transcriptVirtualState) return;
    var previousTop=host.scrollTop,fragment=document.createDocumentFragment();
    var topSpacer=el('div','transcript-virtual-spacer top');
    topSpacer.style.height=(state.offsets[range.start]||0)+'px';
    fragment.appendChild(topSpacer);
    toolEls={};
    var previousTarget=renderTarget,previousSuppress=suppressScroll;
    suppressScroll=true;
    for(var i=range.start;i<range.end;i++){
      var turn=state.turns[i],wrapper=el('div','transcript-turn');
      wrapper.setAttribute('data-turn-index',String(i)); wrapper.setAttribute('data-turn-key',turn.key);
      renderTarget=wrapper;
      turn.entries.forEach(renderTranscriptVirtualEntry);
      fragment.appendChild(wrapper);
    }
    renderTarget=previousTarget; suppressScroll=previousSuppress;
    msgOrdinal=state.msgCount; toolOrdinal=state.toolCount;
    var bottomSpacer=el('div','transcript-virtual-spacer bottom');
    bottomSpacer.style.height=Math.max(0,state.totalHeight-(state.offsets[range.end]||0))+'px';
    fragment.appendChild(bottomSpacer);
    fragment.appendChild(el('div','transcript-live-tail'));
    state.start=range.start; state.end=range.end;
    host.style.visibility='hidden';
    host.classList.add('transcript-virtualized');
    host.setAttribute('data-transcript-total-blocks',String(state.blockCount));
    host.replaceChildren(fragment);
    messageReplaceGeneration++;
    applyCollapsedTurns();
    keepGenLast();
    observeTranscriptVirtualTurns(state);
    var pinBottom=options.scrollMode!=='top'&&!(options.scrollMode&&typeof options.scrollMode==='object')&&options.keepScroll!==true&&stick;
    if(options.scrollMode==='top') host.scrollTop=0;
    else if(options.scrollMode&&typeof options.scrollMode==='object'&&isFinite(options.scrollMode.top)) host.scrollTop=Math.max(0,Number(options.scrollMode.top));
    else if(options.targetIndex!=null) host.scrollTop=Math.max(0,(state.offsets[options.targetIndex]||0)-18);
    else if(options.keepScroll) host.scrollTop=previousTop;
    else host.scrollTop=host.scrollHeight;
    scheduleTranscriptVirtualMeasure(state,pinBottom);
  }
  function transcriptSelectionIsActive(host){
    if(host.querySelector('.msg.editing, .inline-edit')) return true;
    var selection=window.getSelection&&window.getSelection();
    if(!selection||selection.isCollapsed||!selection.rangeCount) return false;
    var anchor=selection.anchorNode,focus=selection.focusNode;
    return !!((anchor&&host.contains(anchor))||(focus&&host.contains(focus)));
  }
  function refreshTranscriptVirtualModel(state){
    if(!state||state!==transcriptVirtualState||!cur) return;
    var version=transcriptVersion(cur);
    if(state.version===version) return;
    var latest=cachedTranscriptFor(cur);
    if(!latest) return;
    var model=buildTranscriptVirtualModel(latest,cur.sessionId);
    state.turns=model.turns;
    state.blockCount=model.blockCount;
    state.msgCount=model.msgCount;
    state.toolCount=model.toolCount;
    state.keyToTurn=model.keyToTurn;
    state.keyOrder=model.keyOrder;
    state.firstUserKey=model.firstUserKey;
    state.lastUserKey=model.lastUserKey;
    state.version=version;
    recalculateTranscriptOffsets(state);
  }
  function scheduleTranscriptVirtualWindow(){
    if(transcriptVirtualRaf) return;
    transcriptVirtualRaf=window.requestAnimationFrame(function(){
      transcriptVirtualRaf=0;
      var state=transcriptVirtualState,host=byId('msgs');
      if(!state||!host||transcriptSelectionIsActive(host)) return;
      refreshTranscriptVirtualModel(state);
      var range=transcriptVirtualRange(state,host.scrollTop,host.clientHeight);
      if(range.start===state.start&&range.end===state.end) return;
      renderTranscriptVirtualRange(state,range,{keepScroll:true});
    });
  }
  function ensureTranscriptKeyVisible(key){
    var host=byId('msgs'),state=transcriptVirtualState;
    if(!host||!state||!host.classList.contains('transcript-virtualized')) return false;
    if(findMsgByKey(key)) return true;
    refreshTranscriptVirtualModel(state);
    var index=state.keyToTurn[String(key||'')];
    if(index==null) return false;
    var range=transcriptVirtualRange(state,state.offsets[index]||0,host.clientHeight,index);
    renderTranscriptVirtualRange(state,range,{targetIndex:index,keepScroll:true});
    return !!findMsgByKey(key);
  }
  function clearTranscriptVirtualState(host){
    transcriptVirtualState=null;
    if(transcriptVirtualRaf){ window.cancelAnimationFrame(transcriptVirtualRaf); transcriptVirtualRaf=0; }
    if(transcriptVirtualMeasureRaf){ window.cancelAnimationFrame(transcriptVirtualMeasureRaf); transcriptVirtualMeasureRaf=0; }
    if(transcriptVirtualResizeObserver){ transcriptVirtualResizeObserver.disconnect(); transcriptVirtualResizeObserver=null; }
    if(host){
      host.classList.remove('transcript-virtualized');
      host.removeAttribute('data-transcript-total-blocks');
      host.style.visibility='';
    }
  }
  function replaceMessages(node, scrollMode){
    var m=byId('msgs'); if(!m) return;
    clearTranscriptVirtualState(m);
    var replaceGeneration=++messageReplaceGeneration;
    // Capture intent BEFORE we touch scrollTop: setting it fires a 'scroll' event
    // that recomputes stick, so reading it later is unreliable.
    var pinToTop = scrollMode==='top';
    var savedTop = scrollMode&&typeof scrollMode==='object'&&isFinite(scrollMode.top) ? Math.max(0,Number(scrollMode.top)) : null;
    var pinToSaved = savedTop!=null;
    var pinToBottom = !pinToTop && !pinToSaved && stick;
    function applyPinnedScroll(){
      if(pinToTop) m.scrollTop=0;
      else if(pinToSaved) m.scrollTop=savedTop;
      else if(pinToBottom) m.scrollTop=m.scrollHeight;
    }
    m.style.visibility='hidden';
    m.replaceChildren(node);
    keepGenLast();
    applyCollapsedTurns();
    if(pinToTop||pinToSaved) applyPinnedScroll(); else scroll();
    // The synchronous scroll above can land a few px short of the true bottom:
    // bubble/markdown layout (and a possible follow-up re-render from select()'s
    // transcript fetch) isn't fully settled in this tick, so scrollHeight grows
    // after we read it. Re-pin across the next two frames — idempotent if nothing
    // moved, but it closes the "差一点点" gap on tab switch. Guarded by pinToBottom
    // so a scrolled-up session isn't yanked to the bottom.
    requestAnimationFrame(function(){
      if(replaceGeneration!==messageReplaceGeneration) return;
      applyPinnedScroll();
      m.style.visibility='';
      requestAnimationFrame(function(){
        if(replaceGeneration!==messageReplaceGeneration) return;
        applyPinnedScroll();
      });
    });
    renderPinTray();
    scheduleLatestPin();
  }
  function renderPersistedAndPending(msgs, sessionId, scrollMode){
    var model=buildTranscriptVirtualModel(msgs,sessionId);
    if(model.blockCount>TRANSCRIPT_VIRTUAL_THRESHOLD){
      var host=byId('msgs'),key=transcriptVirtualKey(sessionId);
      var state={
        key:key,
        turns:model.turns,
        blockCount:model.blockCount,
        msgCount:model.msgCount,
        toolCount:model.toolCount,
        keyToTurn:model.keyToTurn,
        keyOrder:model.keyOrder,
        firstUserKey:model.firstUserKey,
        lastUserKey:model.lastUserKey,
        version:transcriptVersion(sessionId&&findSessionById(sessionId)||cur),
        heights:transcriptTurnHeightCache(key),
        offsets:[],
        totalHeight:0,
        start:0,
        end:0
      };
      transcriptVirtualState=state;
      recalculateTranscriptOffsets(state);
      var targetTop=scrollMode==='top'?0:(scrollMode&&typeof scrollMode==='object'&&isFinite(scrollMode.top)?Math.max(0,Number(scrollMode.top)):(stick?Math.max(0,state.totalHeight-(host&&host.clientHeight||600)):Math.max(0,host&&host.scrollTop||0)));
      var range=transcriptVirtualRange(state,targetTop,host&&host.clientHeight||600);
      renderTranscriptVirtualRange(state,range,{scrollMode:scrollMode,keepScroll:!stick&&!scrollMode});
      return;
    }
    var frag=document.createDocumentFragment();
    var prevTarget=renderTarget, prevSuppress=suppressScroll;
    renderTarget=frag; suppressScroll=true; msgOrdinal=0; toolOrdinal=0;
    toolEls={};
    if(!model.blockCount) addMsg('assistant','(no history yet)');
    else model.turns.forEach(function(turn){ turn.entries.forEach(renderTranscriptVirtualEntry); });
    renderTarget=prevTarget; suppressScroll=prevSuppress;
    replaceMessages(frag,scrollMode);
  }
  function renderSessionHistory(s, msgs, scrollMode){
    renderPersistedAndPending(msgs, s && s.sessionId, scrollMode);
    cacheTranscript(s, msgs);
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
    var pinPatch={}; pinPatch[key]=(pins&&pins.length)?pins:null;
    saveVaultUiState({pins:pinPatch});
  }
  function currentPins(){ return loadPins(cur); }
  function commentPinSession(){
    return commentDrawerState.threadId ? {sessionId:'comment:'+commentDrawerState.threadId} : null;
  }
  function pinScopeForBlock(block){
    return block&&block.closest&&block.closest('#commentMsgs') ? commentPinSession() : cur;
  }
  function isPinnedKey(key,block){
    if(!key) return false;
    return loadPins(pinScopeForBlock(block)).some(function(p){ return p.key===key; });
  }
  function chatBlockControlsHost(block){
    return block&&block.classList&&block.classList.contains('toolc')&&block.parentElement&&block.parentElement.classList.contains('toolrow') ? block.parentElement : block;
  }
  function syncMessagePinState(msgEl){
    if(!msgEl) return;
    var host=chatBlockControlsHost(msgEl), btn=host&&host.querySelector('.msg-pin');
    if(!btn) return;
    var on=isPinnedKey(msgEl.getAttribute('data-msg-key'),msgEl);
    btn.classList.toggle('on', on);
    var noun=msgEl.classList.contains('toolc')?'tool block':'message';
    btn.title=on ? 'Unpin this '+noun : 'Pin this '+noun+' to the top';
    btn.setAttribute('aria-label', btn.title);
  }
  function syncAllMessagePinStates(){
    var msgs=byId('msgs'); if(!msgs) return;
    Array.prototype.forEach.call(msgs.querySelectorAll('.msg, .toolc'), syncMessagePinState);
  }
  function normalizedCommentAnchor(text){ return String(text||'').replace(/\\s+/g,' ').trim(); }
  function commentThreadForAnchor(parentSessionId, anchorKey, anchorText){
    var values=Object.keys(commentThreads).map(function(key){ return commentThreads[key]; });
    for(var i=0;i<values.length;i++){
      var thread=values[i];
      if(thread && String(thread.parentSessionId||'')===String(parentSessionId||'') && String(thread.anchorKey||'')===String(anchorKey||'')) return thread;
    }
    var currentText=normalizedCommentAnchor(anchorText);
    if(!currentText) return null;
    for(var j=0;j<values.length;j++){
      var fallback=values[j];
      if(!fallback || String(fallback.parentSessionId||'')!==String(parentSessionId||'')) continue;
      var savedText=normalizedCommentAnchor(fallback.anchorText);
      if(savedText===currentText) return fallback;
      if(fallback.createdWhileGenerating && savedText.length>=16 && currentText.indexOf(savedText)===0) return fallback;
    }
    return null;
  }
  function pinReferenceTrigger(input){
    if(!input || composerShortcutComposing || document.activeElement!==input) return null;
    var value=String(input.value||''),caret=typeof input.selectionStart==='number'?input.selectionStart:value.length,end=typeof input.selectionEnd==='number'?input.selectionEnd:caret;
    if(caret!==end) return null;
    var before=value.slice(0,caret),match=/(^|\\s)@([^\\s@]*)$/.exec(before);
    if(!match) return null;
    var start=before.lastIndexOf('@');
    return {start:start,end:caret,query:String(match[2]||'')};
  }
  function referenceablePins(query){
    if(draftPinReferences.length>=PIN_REFERENCE_LIMIT) return [];
    var needle=String(query||'').toLowerCase();
    return sortPinsInChatOrder(currentPins()).filter(function(pin){
      var target=pinTargetKey(pin);
      if(String(pin.key||'').indexOf('tool:')===0 || target.indexOf('tool:')===0) return false;
      if(draftPinReferences.some(function(ref){ return ref.pinKey===pin.key; })) return false;
      if(!needle) return true;
      var thread=commentThreadForAnchor(currentParentSessionId(),pin.key,pin.text);
      var haystack=[pinRoleLabel(pin),pin.text,thread?'comments':''].join(' ').toLowerCase();
      return haystack.indexOf(needle)>=0;
    }).map(function(pin){
      return {pin:pin,thread:commentThreadForAnchor(currentParentSessionId(),pin.key,pin.text)};
    });
  }
  function closePinReferencePicker(){
    var picker=byId('composerPinPicker'),input=byId('input'),foot=document.querySelector('.foot');
    pinReferencePicker={open:false,start:-1,end:-1,query:'',items:[],active:0};
    if(picker){ picker.hidden=true; picker.innerHTML=''; }
    if(input){ input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant'); }
    if(foot) foot.classList.remove('pinref-open');
  }
  function renderPinReferencePicker(){
    var picker=byId('composerPinPicker'); if(!picker) return;
    picker.innerHTML='';
    picker.hidden=false;
    var head=el('div','pinref-picker-head');
    head.appendChild(el('span',null,'Reference a Pin'));
    head.appendChild(el('span',null,'↑↓ · Enter'));
    picker.appendChild(head);
    var list=el('div','pinref-picker-list'); picker.appendChild(list);
    if(!pinReferencePicker.items.length){
      var empty=draftPinReferences.length>=PIN_REFERENCE_LIMIT?'You can reference up to '+PIN_REFERENCE_LIMIT+' Pins.':(currentPins().length?'No matching Pins':'Pin a message first, then type @ to reference it.');
      list.appendChild(el('div','pinref-empty',empty));
      return;
    }
    pinReferencePicker.items.forEach(function(entry,index){
      var pin=entry.pin,button=el('button','pinref-option'+(index===pinReferencePicker.active?' active':''));
      button.type='button'; button.tabIndex=-1; button.id='pinref-option-'+index; button.setAttribute('role','option'); button.setAttribute('aria-selected',index===pinReferencePicker.active?'true':'false');
      var fullText=String(pin.text||'').replace(/\\s+/g,' ').trim();
      if(fullText) button.setAttribute('data-hover-tip',fullText);
      var icon=svgIcon('pin'); icon.setAttribute('class','pinref-option-icon'); button.appendChild(icon);
      var copy=el('span','pinref-option-copy'),meta=el('span','pinref-option-meta');
      meta.appendChild(el('span',null,pinRoleLabel(pin)));
      if(pin.kind==='selection') meta.appendChild(el('span',null,'selected text'));
      copy.appendChild(meta); copy.appendChild(el('span','pinref-option-text',fullText));
      button.appendChild(copy);
      if(entry.thread){
        var count=Math.max(0,Number(entry.thread.messageCount)||0);
        button.appendChild(el('span','pinref-option-comments',count?count+' comments':'comments'));
      }
      button.onmousedown=function(ev){ ev.preventDefault(); };
      button.onclick=function(){ choosePinReference(index); };
      list.appendChild(button);
    });
    var input=byId('input'),active=byId('pinref-option-'+pinReferencePicker.active);
    if(input&&active) input.setAttribute('aria-activedescendant',active.id);
  }
  function syncPinReferencePicker(){
    var input=byId('input'),trigger=pinReferenceTrigger(input);
    if(!trigger){ closePinReferencePicker(); return false; }
    var items=referenceablePins(trigger.query);
    if(trigger.query&&!items.length){ closePinReferencePicker(); return false; }
    var same=pinReferencePicker.open&&pinReferencePicker.query===trigger.query;
    pinReferencePicker.open=true; pinReferencePicker.start=trigger.start; pinReferencePicker.end=trigger.end; pinReferencePicker.query=trigger.query;
    pinReferencePicker.items=items;
    if(!same) pinReferencePicker.active=0;
    pinReferencePicker.active=Math.max(0,Math.min(pinReferencePicker.active,pinReferencePicker.items.length-1));
    var inputEl=byId('input'),foot=document.querySelector('.foot');
    if(inputEl){ inputEl.setAttribute('aria-controls','composerPinPicker'); inputEl.setAttribute('aria-expanded','true'); }
    if(foot) foot.classList.add('pinref-open');
    renderPinReferencePicker();
    syncComposerShortcutGhost();
    return true;
  }
  function choosePinReference(index){
    if(!pinReferencePicker.open) return false;
    if(draftPinReferences.length>=PIN_REFERENCE_LIMIT){ closePinReferencePicker(); showToast('You can reference up to '+PIN_REFERENCE_LIMIT+' Pins.','warn'); return false; }
    var entry=pinReferencePicker.items[index],input=byId('input');
    if(!entry||!input) return false;
    var before=input.value.slice(0,pinReferencePicker.start),after=input.value.slice(pinReferencePicker.end);
    if(/\\s$/.test(before)&&/^\\s/.test(after)) after=after.slice(1);
    input.value=before+after;
    var caret=before.length;
    var pin=entry.pin,role=pinRoleLabel(pin),text=String(pin.text||'').replace(/\\s+/g,' ').trim();
    draftPinReferences.push({kind:'pin',pinKey:String(pin.key||''),pinSessionId:String(cur&&cur.sessionId||''),label:role+' · '+text,text:text,role:role,hasComment:!!entry.thread});
    stashPinReferenceState(cur);
    closePinReferencePicker();
    renderAttachments();
    input.focus(); input.setSelectionRange(caret,caret); input.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  }
  function handlePinReferencePickerKey(ev){
    if(!pinReferencePicker.open) return false;
    if(ev.key==='Escape'){
      closePinReferencePicker();
      return true;
    }
    if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){
      if(pinReferencePicker.items.length){
        var direction=ev.key==='ArrowDown'?1:-1;
        pinReferencePicker.active=(pinReferencePicker.active+direction+pinReferencePicker.items.length)%pinReferencePicker.items.length;
        renderPinReferencePicker();
        var option=byId('pinref-option-'+pinReferencePicker.active); if(option) option.scrollIntoView({block:'nearest'});
      }
      return true;
    }
    if((ev.key==='Enter'&&!ev.shiftKey)||ev.key==='Tab'){
      if(pinReferencePicker.items.length) choosePinReference(pinReferencePicker.active);
      else closePinReferencePicker();
      return true;
    }
    return false;
  }
  function commentThreadBySession(sessionId, clientSessionId){
    var values=Object.keys(commentThreads).map(function(key){ return commentThreads[key]; });
    for(var i=0;i<values.length;i++){
      var thread=values[i];
      if(!thread) continue;
      if(sessionId && String(thread.providerSessionId||'')===String(sessionId)) return thread;
      if(clientSessionId && String(thread.id||'')===String(clientSessionId)) return thread;
    }
    return null;
  }
  function rememberCommentThread(thread){
    if(!thread || !thread.id) return null;
    var previous=commentThreads[thread.id];
    var previousActivity=Number(previous&&previous.lastUserMessageAt||0);
    var next=Object.assign({},previous||{},thread);
    var incomingActivity=Number(thread.lastUserMessageAt||0);
    if(previous && previousActivity && (!incomingActivity || incomingActivity<previousActivity)){
      next.lastUserMessageAt=previous.lastUserMessageAt;
      next.status=previous.status;
      next.messageCount=Math.max(Number(previous.messageCount)||0,Number(next.messageCount)||0);
    }
    commentThreads[thread.id]=next;
    VAULT_STATE.commentThreads=commentThreads;
    syncAllMessageCommentStates();
    syncAllSessionCommentBadges();
    renderPinTray();
    var nextActivity=Number(commentThreads[thread.id].lastUserMessageAt||0);
    if(nextActivity>previousActivity){
      sortSessions();
      if(tagOrderMode==='recent') renderTagFilters();
      renderSidebar();
    }
    return commentThreads[thread.id];
  }
  function currentParentSessionId(){ return cur ? String(providerSessionId(cur)||cur.sessionId||'') : ''; }
  function syncMessageCommentState(msgEl){
    if(!msgEl) return;
    var host=chatBlockControlsHost(msgEl), btn=host&&host.querySelector('.msg-comment'); if(!btn) return;
    var thread=commentThreadForAnchor(currentParentSessionId(),msgEl.getAttribute('data-msg-key'),previewTextFromMsg(msgEl));
    btn.classList.toggle('has-comments',!!thread);
    var old=btn.querySelector('.msg-comment-count'); if(old) old.remove();
    if(thread){
      var count=Math.max(1,Number(thread.messageCount)||1);
      btn.appendChild(el('span','msg-comment-count',String(count)));
      btn.title=thread.status==='generating' ? 'Open comments · reply generating' : 'Open comments';
      btn.setAttribute('aria-label',btn.title);
    } else {
      btn.title=msgEl.classList.contains('toolc')?'Comment on this tool block':'Comment on this response';
      btn.setAttribute('aria-label',btn.title);
    }
  }
  function syncAllMessageCommentStates(){
    var msgs=byId('msgs'); if(!msgs) return;
    Array.prototype.forEach.call(msgs.querySelectorAll('.msg.assistant, .toolc'),syncMessageCommentState);
  }
  function findMsgByKey(key){
    var msgs=byId('msgs'); if(!msgs || !key) return null;
    var nodes=msgs.querySelectorAll('.msg, .toolc');
    for(var i=0;i<nodes.length;i++){
      if(nodes[i].getAttribute('data-msg-key')===key) return nodes[i];
    }
    return null;
  }
  function alignMsgKey(key){
    var m=byId('msgs'), target=findMsgByKey(key);
    if(!target&&ensureTranscriptKeyVisible(key)) target=findMsgByKey(key);
    if(!m || !target) return false;
    var foldTarget=target.classList.contains('toolc')&&target.parentElement&&target.parentElement.classList.contains('toolrow') ? target.parentElement : target;
    if(foldTarget.classList.contains('folded-away')){
      target=findFoldSummaryByKey(foldTarget.getAttribute('data-folded-by')||key) || target;
    }
    var delta=target.getBoundingClientRect().top - m.getBoundingClientRect().top;
    m.scrollTop=Math.max(0, m.scrollTop + delta - 18);
    return true;
  }
  function scrollToMsgKey(key){
    if(!alignMsgKey(key)) return;
    scheduleLatestPin();
    // Message markdown, the composer, and queue rows can finish laying out just
    // after a jump. Re-align on the next two frames so the anchored block stays
    // inside the real #msgs viewport instead of being pushed beneath Composer.
    requestAnimationFrame(function(){
      if(!alignMsgKey(key)) return;
      requestAnimationFrame(function(){ if(alignMsgKey(key)) scheduleLatestPin(); });
    });
  }
  function textOffsetPoint(root,offset,preferNext){
    if(!root) return null;
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    var nodes=[],total=0,node;
    while((node=walker.nextNode())){ nodes.push({node:node,start:total}); total+=String(node.nodeValue||'').length; }
    if(!nodes.length) return null;
    var at=Math.max(0,Math.min(total,Number(offset)||0));
    for(var i=0;i<nodes.length;i++){
      var item=nodes[i],length=String(item.node.nodeValue||'').length,end=item.start+length;
      if(at<end || (!preferNext&&at===end) || (i===nodes.length-1&&at===end)){
        return {node:item.node,offset:Math.max(0,Math.min(length,at-item.start))};
      }
    }
    var last=nodes[nodes.length-1],lastLength=String(last.node.nodeValue||'').length;
    return {node:last.node,offset:lastLength};
  }
  function selectionRectForPin(pin,target){
    if(!pin||pin.kind!=='selection'||!target) return null;
    var content=target.classList&&target.classList.contains('toolc') ? target : (target.querySelector('.bubble')||target);
    var fullText=String(content.textContent||''),selected=String(pin.text||'');
    if(!content||!fullText||!selected) return null;
    var start=pinTextOrder(pin,target);
    if(!Number.isFinite(start)||start<0||fullText.slice(start,start+selected.length)!==selected){
      start=fullText.indexOf(selected);
    }
    if(start<0) return null;
    var from=textOffsetPoint(content,start,true),to=textOffsetPoint(content,start+selected.length,false);
    if(!from||!to) return null;
    try {
      var range=document.createRange();
      range.setStart(from.node,from.offset); range.setEnd(to.node,to.offset);
      var rects=range.getClientRects();
      for(var i=0;i<rects.length;i++) if(rects[i].width||rects[i].height) return rects[i];
      var box=range.getBoundingClientRect();
      return box&&(box.width||box.height)?box:null;
    } catch(_err){ return null; }
  }
  function scrollHostToTarget(host,target,pin){
    if(!host||!target) return false;
    var precise=selectionRectForPin(pin,target);
    var rect=precise||target.getBoundingClientRect();
    var frame=host.getBoundingClientRect();
    var inset=precise ? Math.max(18,Math.min(host.clientHeight*0.32,180)) : 18;
    host.scrollTop=Math.max(0,host.scrollTop+rect.top-frame.top-inset);
    return !!precise;
  }
  function scrollToPin(pin){
    var key=pinTargetKey(pin),target=findMsgByKey(key),host=byId('msgs');
    if(!target&&ensureTranscriptKeyVisible(key)) target=findMsgByKey(key);
    if(!host||!target) return;
    var foldTarget=target.classList.contains('toolc')&&target.parentElement&&target.parentElement.classList.contains('toolrow') ? target.parentElement : target;
    if(pin&&pin.kind==='selection'&&foldTarget.classList.contains('folded-away')){
      var foldKey=foldTarget.getAttribute('data-folded-by');
      if(foldKey){ setTurnFolded(foldKey,false); applyCollapsedTurns(); target=findMsgByKey(key)||target; }
    }
    if(pin&&pin.kind==='selection'&&scrollHostToTarget(host,target,pin)){
      scheduleLatestPin();
      return;
    }
    scrollToMsgKey(key);
  }
  function scrollToHeaderPrompt(which){
    var host=byId('msgs'); if(!host) return;
    if(transcriptVirtualState&&host.classList.contains('transcript-virtualized')){
      var virtualKey=which==='first'?transcriptVirtualState.firstUserKey:transcriptVirtualState.lastUserKey;
      if(virtualKey){ scrollToMsgKey(virtualKey); return; }
    }
    var users=host.querySelectorAll('.msg.user');
    var target=which==='first' ? users[0] : users[users.length-1];
    if(target) scrollToMsgKey(target.getAttribute('data-msg-key'));
  }
  function enableHeaderPromptJump(line,which){
    if(!line) return line;
    var label=which==='first'?'first':'latest';
    line.classList.add('prompt-line-jump');
    line.setAttribute('role','button'); line.setAttribute('tabindex','0');
    line.setAttribute('aria-label','Jump to '+label+' user message');
    line.onclick=function(){ scrollToHeaderPrompt(which); };
    line.onkeydown=function(ev){
      if(ev.key!=='Enter'&&ev.key!==' ') return;
      ev.preventDefault(); scrollToHeaderPrompt(which);
    };
    return line;
  }
  function msgKeyIndex(key){
    var m=String(key||'').match(/:(\\d+)$/);
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
  }
  function selectionAnchorBaseKey(key){
    var value=String(key||''), marker=':selection:', at=value.lastIndexOf(marker);
    return at>=0 ? value.slice(0,at) : value;
  }
  function selectionPinKey(block,text){
    var baseKey=block&&block.getAttribute&&block.getAttribute('data-msg-key');
    return baseKey&&text ? baseKey+':selection:'+hashText(text).toString(36) : '';
  }
  function selectionInfoInside(block){
    var empty={text:'',start:null}, selection=window.getSelection&&window.getSelection();
    if(!block||!selection||selection.isCollapsed||!selection.rangeCount) return empty;
    var range=selection.getRangeAt(0), common=range.commonAncestorContainer;
    if(!common||(common.nodeType===1?!block.contains(common):!block.contains(common.parentElement))) return empty;
    var raw=String(selection), text=raw.trim();
    if(!text) return empty;
    var content=block.classList&&block.classList.contains('toolc') ? block : (block.querySelector('.bubble')||block);
    var start=null;
    try {
      if(content===range.startContainer||content.contains(range.startContainer)){
        var before=document.createRange();
        before.selectNodeContents(content); before.setEnd(range.startContainer,range.startOffset);
        var leading=(raw.match(/^\\s*/)||[''])[0].length;
        start=String(before).length+leading;
      }
    } catch(_err){}
    return {text:text,start:start};
  }
  function assistantReferenceText(block){
    if(!block||!block.classList||!block.classList.contains('assistant')) return '';
    var bubble=block.querySelector('.bubble');
    return String(bubble&&(bubble.getAttribute('data-raw')||bubble.textContent)||'').trim();
  }
  function quotedInstructionText(text,selected,note){
    var quote=String(text||'').trim().split('\\n').map(function(line){ return '> '+line; }).join('\\n');
    var instruction=String(note||'').trim();
    return '@ '+(selected?'selected':'response')+'\\n'+quote+(instruction?'\\n\\n@ comment\\n'+instruction:'');
  }
  function appendQuotedInstruction(input,text,selected,note){
    var value=quotedInstructionText(text,selected,note); if(!input||!value) return;
    resetComposerHistoryNavigation();
    var current=String(input.value||''),separator=current?(/\\n\\n$/.test(current)?'':/\\n$/.test(current)?'\\n':'\\n\\n'):'';
    input.value=current+separator+value;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.focus();
    input.setSelectionRange(input.value.length,input.value.length);
  }
  function addAssistantQuoteToComposer(block,selectedText,note){
    if(!cur||!block||!block.classList.contains('assistant')) return false;
    var selected=String(selectedText||'').trim();
    var text=(selected||assistantReferenceText(block)).slice(0,12000);
    if(!text) return false;
    appendQuotedInstruction(byId('input'),text,!!selected,note);
    return true;
  }
  function addCommentQuoteToComposer(block,selectedText,note){
    if(!block||!block.classList.contains('assistant')) return false;
    var selected=String(selectedText||'').trim();
    var text=(selected||assistantReferenceText(block)).slice(0,12000);
    if(!text) return false;
    appendQuotedInstruction(byId('commentInput'),text,!!selected,note);
    return true;
  }
  function pinTargetKey(pin){
    return String(pin&&pin.targetKey||selectionAnchorBaseKey(pin&&pin.key));
  }
  function pinTextOrder(pin,block){
    if(!pin||pin.kind!=='selection') return -1;
    if(pin.selectionStart!==null&&pin.selectionStart!==undefined&&Number.isFinite(Number(pin.selectionStart))) return Math.max(0,Number(pin.selectionStart));
    var content=block&&(block.classList&&block.classList.contains('toolc') ? block : (block.querySelector('.bubble')||block));
    var at=content?String(content.textContent||'').indexOf(String(pin.text||'')):-1;
    return at>=0?at:Number.POSITIVE_INFINITY;
  }
  function msgDomOrder(){
    var order=transcriptVirtualState ? Object.assign({},transcriptVirtualState.keyOrder||{}) : {};
    var msgs=byId('msgs'); if(!msgs) return order;
    var nodes=msgs.querySelectorAll('.msg, .toolc');
    for(var i=0;i<nodes.length;i++){
      var key=nodes[i].getAttribute('data-msg-key');
      if(key&&!Object.prototype.hasOwnProperty.call(order,key)) order[key]=(transcriptVirtualState?transcriptVirtualState.blockCount:0)+i;
    }
    return order;
  }
  function sortPinsInChatOrder(pins){
    var order=msgDomOrder();
    return (pins||[]).slice().sort(function(a,b){
      var ak=pinTargetKey(a), bk=pinTargetKey(b);
      var ai=Object.prototype.hasOwnProperty.call(order, ak) ? order[ak] : msgKeyIndex(ak);
      var bi=Object.prototype.hasOwnProperty.call(order, bk) ? order[bk] : msgKeyIndex(bk);
      if(ai!==bi) return ai-bi;
      var ap=pinTextOrder(a,findMsgByKey(ak)), bp=pinTextOrder(b,findMsgByKey(bk));
      if(ap!==bp) return ap-bp;
      return (a.pinnedAt||0)-(b.pinnedAt||0);
    });
  }
  function previewTextFromMsg(msgEl){
    if(msgEl && msgEl.classList && msgEl.classList.contains('toolc')) return toolBlockSnapshot(msgEl);
    var bubble=msgEl && msgEl.querySelector('.bubble');
    return (bubble && (bubble.getAttribute('data-raw') || bubble.textContent) || '')
      .replace(/\\s+/g, ' ')
      .trim();
  }
  function pinHoverText(pin,inComments){
    var preview=String(pin&&pin.text||'').trim();
    if(!pin||pin.kind==='selection') return preview;
    var role=String(pin.role||'').trim();
    if(role!=='you'&&role!=='user') return preview;
    var stored=String(pin.fullText||'').replace(/\\s+/g,' ').trim();
    if(stored) return stored;
    var key=pinTargetKey(pin);
    var target=inComments?findCommentMsgByKey(key):findMsgByKey(key);
    if(target&&target.classList.contains('user')){
      var rendered=previewTextFromMsg(target);
      if(rendered) return rendered;
    }
    if(!inComments&&transcriptVirtualState){
      for(var i=0;i<transcriptVirtualState.turns.length;i++){
        var entries=transcriptVirtualState.turns[i].entries||[];
        for(var j=0;j<entries.length;j++){
          var entry=entries[j];
          if(entry&&entry.key===key&&entry.kind==='msg'&&entry.role==='user'){
            var virtualText=String(entry.text||'').replace(/\\s+/g,' ').trim();
            if(virtualText) return virtualText;
          }
        }
      }
    }
    return preview;
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
      if(n.classList.contains('toolc') || n.classList.contains('toolrow')) tools++;
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
      if(transcriptVirtualState){
        var virtualState=transcriptVirtualState;
        scheduleTranscriptVirtualMeasure(virtualState,stick);
      }
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
  function chatBlockRole(block){
    if(block&&block.closest&&block.closest('#commentMsgs')){
      if(block.classList.contains('user')) return 'you';
      var thread=commentDrawerState.threadId&&commentThreads[commentDrawerState.threadId];
      return String(thread&&thread.vendor||cur&&cur.vendor||'assistant');
    }
    if(block&&block.classList&&block.classList.contains('toolc')) return block.getAttribute('data-tool-name')||'tool';
    return block&&block.classList&&block.classList.contains('user') ? 'you' : ((cur&&cur.vendor)||'agent');
  }
  function migrateLegacySelectedCommentPins(){
    var pins=currentPins(), parentId=currentParentSessionId(), changed=false;
    Object.keys(commentThreads).forEach(function(id){
      var thread=commentThreads[id], key=String(thread&&thread.anchorKey||'');
      if(!thread||String(thread.parentSessionId||'')!==parentId||selectionAnchorBaseKey(key)===key) return;
      if(pins.some(function(pin){ return pin.key===key; })) return;
      var baseKey=selectionAnchorBaseKey(key), basePin=pins.find(function(pin){ return pin.key===baseKey; });
      if(!basePin) return;
      var migrated=Array.isArray(basePin.migratedSelectionKeys)?basePin.migratedSelectionKeys:[];
      if(migrated.indexOf(key)>=0) return;
      basePin.migratedSelectionKeys=migrated.concat(key);
      pins.push({key:key,targetKey:baseKey,kind:'selection',role:'selected',text:String(thread.anchorText||'').slice(0,1200),pinnedAt:Number(thread.createdAt)||Date.now()});
      changed=true;
    });
    if(changed) savePins(cur,sortPinsInChatOrder(pins));
    return pins;
  }
  function openCommentsForPin(pin,thread){
    if(!pin) return;
    var targetKey=pinTargetKey(pin),target=findMsgByKey(targetKey);
    if(!target&&ensureTranscriptKeyVisible(targetKey)) target=findMsgByKey(targetKey);
    var text=String(pin.text||'');
    var data=pin.kind==='selection'
      ? {kind:'message',role:target&&target.classList.contains('user')?'user':'assistant',text:text}
      : commentAnchorDataFromBlock(target);
    var override={key:String(pin.key||''),text:text,data:data};
    if(pin.kind==='selection'&&Number.isFinite(Number(pin.selectionStart))) override.selectionStart=Math.max(0,Number(pin.selectionStart));
    openCommentThread(thread,target,override);
  }
  function renderPinTray(){
    var tray=byId('pinTray'); if(!tray) return;
    var pins=sortPinsInChatOrder(migrateLegacySelectedCommentPins());
    tray.innerHTML='';
    tray.classList.toggle('show', !!pins.length);
    tray.setAttribute('aria-hidden', pins.length ? 'false' : 'true');
    pins.forEach(function(pin){
      var item=el('div','pinitem');
      var jumpLabel=pin.kind==='selection'?'Jump to selected text':'Jump to pinned block';
      var previewText=String(pin.text||'').trim(), fullText=pinHoverText(pin,false);
      item.setAttribute('aria-label',jumpLabel+(previewText?': '+previewText:''));
      if(fullText) item.setAttribute('data-hover-tip',fullText);
      var pinIcon=svgIcon('pin'); pinIcon.setAttribute('class','pinitem-icon'); item.appendChild(pinIcon);
      item.appendChild(el('span','pinrole',pinRoleLabel(pin)));
      var pinText=el('div','pintext',pin.text);
      if(fullText) pinText.setAttribute('data-hover-tip',fullText);
      item.appendChild(pinText);
      var thread=commentThreadForAnchor(currentParentSessionId(),pin.key,pin.text);
      var commentStatus=thread?String(thread.status||'read'):'idle';
      var cb=el('button','pincomment '+commentStatus);
      if(commentStatus==='generating'){
        var commentSpinner=el('span','comment-action-spinner pincomment-spinner');
        commentSpinner.setAttribute('aria-hidden','true'); cb.appendChild(commentSpinner);
      } else {
        var commentIcon=svgIcon('comment'); commentIcon.setAttribute('class','comment-action-icon pincomment-icon'); cb.appendChild(commentIcon);
      }
      cb.type='button';
      cb.title=commentStatus==='generating'?'Open comments · reply generating':thread?'Open comments':'Comment on this pin';
      cb.setAttribute('aria-label',cb.title);
      cb.onclick=function(ev){ ev.stopPropagation(); openCommentsForPin(pin,thread); };
      item.appendChild(cb);
      var x=el('button','pinx','×');
      x.title='Unpin';
      x.onclick=function(ev){
        ev.stopPropagation();
        savePins(cur, currentPins().filter(function(p){ return p.key!==pin.key; }));
        if(draftPinReferences.some(function(ref){ return ref.pinKey===pin.key; })) removePinReference(pin.key);
        renderPinTray();
        syncAllMessagePinStates();
      };
      item.onclick=function(){ scrollToPin(pin); };
      item.appendChild(x);
      tray.appendChild(item);
    });
    syncAllMessagePinStates();
    syncTopStack();
  }
  function syncCommentTopStack(){
    var stack=byId('commentTopStack'), latest=byId('commentLatestPin'), tray=byId('commentPinTray');
    if(!stack) return;
    var show=!!((latest&&latest.classList.contains('show'))||(tray&&tray.classList.contains('show')));
    stack.classList.toggle('show',show); stack.setAttribute('aria-hidden',show?'false':'true');
  }
  function commentMsgDomOrder(){
    var order={}, host=byId('commentMsgs'); if(!host) return order;
    Array.prototype.forEach.call(host.querySelectorAll('.msg[data-msg-key]'),function(node,i){ order[node.getAttribute('data-msg-key')]=i; });
    return order;
  }
  function sortCommentPins(pins){
    var order=commentMsgDomOrder();
    return (pins||[]).slice().sort(function(a,b){
      var ak=pinTargetKey(a), bk=pinTargetKey(b);
      var ai=Object.prototype.hasOwnProperty.call(order,ak)?order[ak]:msgKeyIndex(ak);
      var bi=Object.prototype.hasOwnProperty.call(order,bk)?order[bk]:msgKeyIndex(bk);
      if(ai!==bi) return ai-bi;
      var ap=pinTextOrder(a,findCommentMsgByKey(ak)), bp=pinTextOrder(b,findCommentMsgByKey(bk));
      if(ap!==bp) return ap-bp;
      return (a.pinnedAt||0)-(b.pinnedAt||0);
    });
  }
  function findCommentMsgByKey(key){
    var host=byId('commentMsgs'); if(!host||!key) return null;
    var nodes=host.querySelectorAll('.msg[data-msg-key]');
    for(var i=0;i<nodes.length;i++) if(nodes[i].getAttribute('data-msg-key')===key) return nodes[i];
    return null;
  }
  function scrollToCommentMsgKey(key,pin){
    var host=byId('commentMsgs'), target=findCommentMsgByKey(key); if(!host||!target) return;
    scrollHostToTarget(host,target,pin);
  }
  function renderCommentPinTray(){
    var tray=byId('commentPinTray'), scope=commentPinSession(); if(!tray) return;
    var pins=scope?sortCommentPins(loadPins(scope)):[];
    tray.innerHTML=''; tray.classList.toggle('show',!!pins.length); tray.setAttribute('aria-hidden',pins.length?'false':'true');
    pins.forEach(function(pin){
      var item=el('div','pinitem'), jumpLabel=pin.kind==='selection'?'Jump to selected text':'Jump to pinned comment message';
      var previewText=String(pin.text||'').trim(), fullText=pinHoverText(pin,true);
      item.setAttribute('aria-label',jumpLabel+(previewText?': '+previewText:''));
      if(fullText) item.setAttribute('data-hover-tip',fullText);
      var pinIcon=svgIcon('pin'); pinIcon.setAttribute('class','pinitem-icon'); item.appendChild(pinIcon);
      item.appendChild(el('span','pinrole',pinRoleLabel(pin)));
      var pinText=el('div','pintext',pin.text);
      if(fullText) pinText.setAttribute('data-hover-tip',fullText);
      item.appendChild(pinText);
      var close=el('button','pinx','×'); close.title='Unpin';
      close.onclick=function(ev){ ev.stopPropagation(); savePins(scope,loadPins(scope).filter(function(value){return value.key!==pin.key;})); renderCommentPinTray(); };
      item.onclick=function(){ scrollToCommentMsgKey(pinTargetKey(pin),pin); };
      item.appendChild(close); tray.appendChild(item);
    });
    var host=byId('commentMsgs'); if(host) Array.prototype.forEach.call(host.querySelectorAll('.msg'),syncMessagePinState);
    syncCommentTopStack();
  }
  function togglePinnedMessage(msgEl,selectedText,selectionStart){
    if(!cur || !msgEl) return;
    selectedText=String(selectedText||'').trim();
    var targetKey=msgEl.getAttribute('data-msg-key');
    var key=selectedText ? selectionPinKey(msgEl,selectedText) : targetKey;
    if(!key) return;
    var scope=pinScopeForBlock(msgEl); if(!scope) return;
    var pins=loadPins(scope);
    var i=pins.findIndex(function(p){ return p.key===key; });
    if(i>=0){
      pins.splice(i,1);
      if(scope===cur && draftPinReferences.some(function(ref){ return ref.pinKey===key; })) removePinReference(key);
    }
    else {
      var text=selectedText||previewTextFromMsg(msgEl);
      if(!text) return;
      if(selectedText){
        var selectionPin={key:key,targetKey:targetKey,kind:'selection',role:'selected',text:text.slice(0,1200),pinnedAt:Date.now()};
        if(Number.isFinite(selectionStart)) selectionPin.selectionStart=Math.max(0,selectionStart);
        pins.push(selectionPin);
      } else {
        var role=chatBlockRole(msgEl), pin={key:key,role:role,text:text.slice(0,1200),pinnedAt:Date.now()};
        if(role==='you') pin.fullText=text;
        pins.push(pin);
      }
    }
    var inComments=!!(msgEl.closest&&msgEl.closest('#commentMsgs'));
    savePins(scope,inComments?sortCommentPins(pins):sortPinsInChatOrder(pins));
    if(inComments) renderCommentPinTray(); else renderPinTray();
    syncMessagePinState(msgEl);
  }
  function ensureMessagePinned(msgEl){
    if(!msgEl) return;
    var key=msgEl.getAttribute('data-msg-key');
    if(key && !isPinnedKey(key,msgEl)) togglePinnedMessage(msgEl);
  }
  function ensureCommentAnchorPinned(){
    if(!cur) return;
    var key=String(commentDrawerState.anchorKey||''), text=String(commentDrawerState.anchorText||'').trim();
    if(!key||!text) return;
    var msgKey=commentDrawerState.anchorMsg&&commentDrawerState.anchorMsg.getAttribute('data-msg-key');
    var targetKey=msgKey||selectionAnchorBaseKey(key);
    if(key===targetKey){
      if(commentDrawerState.anchorMsg) ensureMessagePinned(commentDrawerState.anchorMsg);
      return;
    }
    var pins=currentPins();
    if(pins.some(function(pin){ return pin.key===key; })) return;
    var selectionPin={key:key,targetKey:targetKey,kind:'selection',role:'selected',text:text.slice(0,1200),pinnedAt:Date.now()};
    if(Number.isFinite(commentDrawerState.anchorSelectionStart)) selectionPin.selectionStart=Math.max(0,commentDrawerState.anchorSelectionStart);
    pins.push(selectionPin);
    savePins(cur,sortPinsInChatOrder(pins));
    renderPinTray();
  }
  function setCommentBusy(on){
    commentDrawerState.busy=!!on;
    syncCommentSendButton();
    syncCommentPromoteButton();
  }
  function syncCommentSendButton(){
    var send=byId('commentSend'); if(!send) return;
    send.textContent=commentDrawerState.stopping?'Stopping…':commentDrawerState.generating?'■ stop':commentDrawerState.busy?'sending…':'send';
    send.disabled=commentDrawerState.stopping||(!commentDrawerState.generating&&commentDrawerState.busy);
    send.title=commentDrawerState.generating?'Stop the current generation (Esc)':'';
    send.classList.toggle('stopping',commentDrawerState.generating);
  }
  function syncCommentPromoteButton(){
    var button=byId('commentPromote'), thread=commentDrawerState.threadId&&commentThreads[commentDrawerState.threadId];
    if(!button) return;
    button.disabled=!thread||!thread.providerSessionId||commentDrawerState.busy||commentDrawerState.generating||commentDrawerState.promoting;
    button.textContent=commentDrawerState.promoting?'promoting…':'promote to session';
    button.title=!thread||!thread.providerSessionId?'Send a comment before promoting':commentDrawerState.generating?'Wait for the current reply and queue to finish':'Make this comment thread a regular session';
  }
  function clearCommentGenerating(){
    if(commentGenTimer){ clearInterval(commentGenTimer); commentGenTimer=null; }
    var status=byId('commentGenerating'); if(status) status.remove();
    commentGenStart=0;
  }
  function latestCommentUserMessage(){
    var host=byId('commentMsgs'), latest=null;
    if(!host) return null;
    Array.prototype.forEach.call(host.children,function(node){
      if(node.classList&&node.classList.contains('msg')&&node.classList.contains('user')) latest=node;
    });
    return latest;
  }
  function canResendStoppedComment(msgEl){
    var stopped=commentDrawerState.stoppedByUser&&!commentDrawerState.generating;
    return !!(msgEl && (stopped||commentDrawerState.pendingStop) && latestCommentUserMessage()===msgEl);
  }
  function syncCommentUserEditActions(){
    var host=byId('commentMsgs'); if(!host) return;
    var latest=latestCommentUserMessage();
    Array.prototype.forEach.call(host.querySelectorAll('.msg.user .comment-msg-edit'),function(button){
      var msg=button.closest('.msg');
      button.hidden=!(msg===latest&&canResendStoppedComment(msg));
    });
  }
  function editStoppedCommentAndResend(msgEl,bubble){
    if(!canResendStoppedComment(msgEl)||msgEl.classList.contains('editing')) return;
    var raw=bubble.getAttribute('data-raw')||bubble.textContent||'';
    var threadId=commentDrawerState.threadId,drawerEpoch=commentDrawerState.epoch;
    msgEl.classList.add('editing');
    function restore(){ msgEl.classList.remove('editing'); if(editor.isConnected) editor.replaceWith(bubble); syncCommentUserEditActions(); }
    function resend(v){
      if(commentDrawerState.threadId!==threadId||commentDrawerState.epoch!==drawerEpoch){ restore(); return; }
      msgEl.classList.remove('editing');
      if(!v){ editor.replaceWith(bubble); syncCommentUserEditActions(); return; }
      editor.replaceWith(bubble);
      sendComment({question:v,userMessage:msgEl,bubble:bubble});
    }
    var editor=makeInlineEditor(raw,function(v){
      var pending=commentDrawerState.pendingStop;
      if(!pending){ resend(v); return; }
      var submit=editor.querySelector('.inline-edit-save'),textarea=editor.querySelector('.inline-edit-ta');
      if(submit&&submit.disabled) return;
      if(submit){ submit.disabled=true; submit.textContent='stopping…'; }
      if(textarea) textarea.disabled=true;
      Promise.resolve(pending).then(function(stopped){
        if(!editor.isConnected) return;
        if(!stopped){ restore(); return; }
        resend(v);
      }).catch(function(){ if(editor.isConnected) restore(); });
    },restore,'send ▸');
    bubble.replaceWith(editor);
  }
  function keepCommentGeneratingLast(){
    var host=byId('commentMsgs'), status=byId('commentGenerating');
    if(host&&status) host.appendChild(status);
  }
  function setCommentGenerating(on,startedAt){
    commentDrawerState.generating=!!on;
    if(on){
      if(startedAt){
        commentGenStart=Number(startedAt)||Date.now();
        commentDrawerState.lastAssistantOutputAt=null;
      }
      commentGenStart=commentGenStart||Date.now();
      var host=byId('commentMsgs'), status=byId('commentGenerating');
      if(host){
        // Create the "generating…" bubble if it is missing, AND (re)start the
        // interval if it is not running. Keying the timer purely off "no bubble
        // yet" meant that once a bubble was ever cleared while generating stayed
        // true, the elapsed timer never restarted — so a fresh comment send
        // showed the stop button but no generating/waiting clock.
        if(!status){
          status=el('div','msg assistant thinking'); status.id='commentGenerating';
          status.appendChild(el('div','bubble',''));
          host.appendChild(status);
        }
        if(!commentGenTimer){
          var tick=function(){
            var bubble=byId('commentGenerating'); bubble=bubble&&bubble.querySelector('.bubble');
            if(bubble) bubble.textContent=activeGenerationTimingText(activeGenerationTiming(commentDrawerState,commentGenStart,Date.now()));
          };
          tick(); commentGenTimer=setInterval(tick,1000);
        }
      }
      keepCommentGeneratingLast();
      // The bubble was appended below the last scroll; keep it in view so the
      // generating/waiting line isn't hidden behind the comment composer.
      if(commentStick){ var cm=byId('commentMsgs'); if(cm) cm.scrollTop=cm.scrollHeight; }
    } else {
      clearCommentGenerating();
      commentDrawerState.stopping=false;
    }
    syncCommentSendButton();
    syncCommentPromoteButton();
    syncCommentUserEditActions();
    syncScrollBottomButton(byId('commentMsgs'),byId('commentScrollBottom'));
  }
  function appendCommentMessage(role,text){
    var host=byId('commentMsgs'); if(!host) return null;
    var node=el('div','msg '+role), bubble=el('div','bubble');
    node.setAttribute('data-msg-key','comment:'+(commentMsgOrdinal++));
    setBubbleText(bubble,text||'',role==='user'||role==='assistant');
    if(role==='user'){
      var edit=el('button','msg-edit comment-msg-edit');
      setIconButton(edit,'edit','Edit stopped comment and resend');
      edit.hidden=true;
      edit.onclick=function(ev){ ev.stopPropagation(); editStoppedCommentAndResend(node,bubble); };
      node.appendChild(edit);
    }
    node.appendChild(bubble); host.appendChild(node); keepCommentGeneratingLast();
    if(role==='user'||commentStick) host.scrollTop=host.scrollHeight;
    syncScrollBottomButton(host,byId('commentScrollBottom'));
    syncCommentUserEditActions();
    scheduleCommentLatestPin();
    return node;
  }
  function appendCommentTool(tc){
    var host=byId('commentMsgs'); if(!host||!tc) return null;
    var block=addTool(tc,{target:host,registry:commentToolEls,readonly:true});
    keepCommentGeneratingLast();
    if(commentStick) host.scrollTop=host.scrollHeight;
    syncScrollBottomButton(host,byId('commentScrollBottom'));
    return block;
  }
  function cacheOpenCommentMessages(){
    var id=commentDrawerState.threadId, host=byId('commentMsgs');
    if(!id || !host) return;
    var messages=[];
    Array.prototype.forEach.call(host.children,function(node){
      if(!node.classList || node.id==='commentAnchor') return;
      if(node.classList.contains('msg')){
        if(node.classList.contains('thinking')||node.classList.contains('error')) return;
        if(!node.classList.contains('user')&&!node.classList.contains('assistant')) return;
        var bubble=node.querySelector('.bubble');
        messages.push({role:node.classList.contains('user')?'user':'assistant',text:bubble&&(bubble.getAttribute('data-raw')||bubble.textContent)||'',tools:[]});
        return;
      }
      if(!node.classList.contains('toolrow')&&!node.classList.contains('toolc')) return;
      var tool=transcriptToolFromBlock(node); if(!tool) return;
      var last=messages[messages.length-1];
      if(!last||last.role!=='assistant'){
        last={role:'assistant',text:'',tools:[]}; messages.push(last);
      }
      last.tools.push(tool);
    });
    objectCacheSet(commentMessageCache,id,messages,80);
  }
  function renderCommentMessages(messages,remember){
    var host=byId('commentMsgs'); if(!host) return;
    clearCommentGenerating();
    // The children collection is live. Removing from it while iterating by
    // index skips the node that shifts into the removed node's slot, leaving
    // stale bubbles behind before the authoritative history is appended.
    Array.prototype.slice.call(host.children).forEach(function(node){ if(node.id!=='commentAnchor') node.remove(); });
    commentDrawerState.assistant=null; commentMsgOrdinal=0; commentToolEls={}; commentLatestUserMsgEl=null;
    (messages||[]).forEach(function(message){
      if(!message || (message.role!=='user' && message.role!=='assistant')) return;
      // Preserve the ordinal used by persisted pin keys even though blank
      // transcript records do not deserve a visible bubble.
      if(!String(message.text||'').trim()) commentMsgOrdinal++;
      else appendCommentMessage(message.role,message.text||'');
      if(message.role==='assistant') (message.tools||[]).forEach(appendCommentTool);
    });
    if(remember!==false) cacheOpenCommentMessages();
    syncCommentUserEditActions();
    renderCommentPinTray(); scheduleCommentLatestPin();
    syncScrollBottomButton(host,byId('commentScrollBottom'));
  }
  function closeCommentDrawer(){
    var drawer=byId('commentDrawer'); if(!drawer) return;
    cacheOpenCommentMessages();
    clearCommentGenerating();
    hideCommentLatestPin();
    var rail=byId('commentMsgFloatActions'); if(rail){ rail.classList.remove('show'); rail.setAttribute('aria-hidden','true'); }
    var referenceBox=byId('commentMsgReferenceComposer'); if(referenceBox){ referenceBox.hidden=true; referenceBox.setAttribute('aria-hidden','true'); }
    drawer.hidden=true; drawer.setAttribute('aria-hidden','true');
    commentDrawerEpoch++;
    commentDrawerState.assistant=null;
  }
  function markCommentRead(thread){
    if(!thread || thread.status==='generating' || thread.status==='scheduled') return;
    var readAt=Date.now();
    rememberCommentThread(Object.assign({},thread,{status:'read'}));
    fetch('/comments/read',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:thread.id,readAt:readAt})})
      .then(function(r){return r.json();})
      .then(function(res){ if(res&&res.stale&&res.thread) rememberCommentThread(res.thread); })
      .catch(function(){});
  }
  function commentAnchorDataFromBlock(block){
    if(!block) return null;
    if(block.classList&&block.classList.contains('toolc')){
      var meta=block._attendTool||{}, tool={name:String(meta.name||block.getAttribute('data-tool-name')||'tool'),input:meta.input};
      if(meta.resultReceived) tool.result=meta.result;
      if(meta.isError) tool.isError=true;
      return {kind:'tool',tool:tool};
    }
    var bubble=block.querySelector&&block.querySelector('.bubble');
    if(!bubble) return null;
    return {kind:'message',role:block.classList.contains('user')?'user':'assistant',text:String(bubble.getAttribute('data-raw')||bubble.textContent||'')};
  }
  function renderCommentAnchorBlock(text,key,data){
    var card=byId('commentAnchor'), content=byId('commentAnchorContent'), label=byId('commentAnchorLabel');
    if(!card||!content||!label) return;
    content.innerHTML='';
    label.textContent=data&&data.kind==='tool'?'TOOL REFERENCE':'REFERENCE';
    if(data&&data.kind==='tool'&&data.tool){ addTool(data.tool,{reference:true,target:content}); return; }
    var role=data&&data.kind==='message'&&data.role==='user'?'user':'assistant';
    var node=el('div','msg '+role), bubble=el('div','bubble');
    setBubbleText(bubble,data&&data.kind==='message'?data.text:(text||'(response text unavailable)'),true);
    node.appendChild(bubble); content.appendChild(node);
  }
  function openCommentThread(thread,msgEl,anchorOverride){
    var drawer=byId('commentDrawer'), input=byId('commentInput');
    if(!drawer) return;
    cacheOpenCommentMessages();
    var parentId=currentParentSessionId();
    var key=anchorOverride&&anchorOverride.key||(msgEl ? msgEl.getAttribute('data-msg-key') : (thread&&thread.anchorKey)||'');
    var text=anchorOverride&&anchorOverride.text||(msgEl ? previewTextFromMsg(msgEl) : (thread&&thread.anchorText)||'');
    var anchorData=anchorOverride&&anchorOverride.data||commentAnchorDataFromBlock(msgEl)||(thread&&thread.anchorData)||null;
    var drawerEpoch=++commentDrawerEpoch;
    commentDrawerState={epoch:drawerEpoch,threadId:(thread&&thread.id)||'',parentSessionId:parentId,anchorKey:key,anchorText:text,anchorData:anchorData,anchorMsg:msgEl,anchorSelectionStart:anchorOverride&&anchorOverride.selectionStart,busy:false,generating:false,stopping:false,stoppedByUser:false,pendingStop:null,promoting:false,assistant:null,lastAssistantOutputAt:null};
    commentStick=true;
    renderCommentAnchorBlock(text,key,anchorData);
    drawer.hidden=false; drawer.setAttribute('aria-hidden','false');
    scheduleCommentOverlayOffsets();
    renderCommentMessages(thread&&commentMessageCache[thread.id]||[],false); renderCommentQueue(); setCommentBusy(false); setCommentGenerating(!!(thread&&thread.status==='generating'));
    if(input){ input.value=''; input.focus(); }
    if(thread&&thread.providerSessionId){
      fetch('/comments/messages?id='+encodeURIComponent(thread.id)).then(function(r){return r.json();}).then(function(res){
        if(commentDrawerState.epoch!==drawerEpoch || commentDrawerState.threadId!==thread.id) return;
        if(res&&res.thread) thread=rememberCommentThread(res.thread)||thread;
        var fresh=res&&res.messages||[], cached=commentMessageCache[thread.id]||[];
        var contentSize=function(messages){ return messages.reduce(function(total,message){
          var tools=message&&message.tools||[], toolSize=0;
          try{ toolSize=JSON.stringify(tools).length; }catch(_err){ toolSize=tools.length; }
          return total+String(message&&message.text||'').length+toolSize;
        },0); };
        renderCommentMessages(thread.status==='generating'&&contentSize(cached)>contentSize(fresh)?cached:fresh);
        setCommentGenerating(thread.status==='generating');
        if(thread.status!=='generating') markCommentRead(thread);
      }).catch(function(){ if(commentDrawerState.epoch===drawerEpoch) appendCommentMessage('error','Could not load comments.'); });
    }
  }
  function openCommentsForMessage(msgEl){
    if(!cur || !msgEl) return;
    var selectionInfo=selectionInfoInside(msgEl), selected=selectionInfo.text;
    var baseKey=msgEl.getAttribute('data-msg-key'), override=null;
    if(selected){
      override={key:selectionPinKey(msgEl,selected),text:selected,selectionStart:selectionInfo.start,data:{kind:'message',role:msgEl.classList.contains('user')?'user':'assistant',text:selected}};
    }
    var key=override?override.key:baseKey, text=override?override.text:previewTextFromMsg(msgEl);
    var thread=commentThreadForAnchor(currentParentSessionId(),key,text);
    openCommentThread(thread,msgEl,override);
  }
  function commentContextBeforeAnchor(targetSession){
    var key=selectionAnchorBaseKey(commentDrawerState.anchorKey);
    var anchor=commentDrawerState.anchorMsg||findMsgByKey(key);
    var history=anchor?historyBeforeMsg(anchor):null;
    if(!history) history=[];
    return history.map(function(message){ return {role:message.role,text:message.text||'',tools:message.tools||[]}; });
  }
  function sendComment(options){
    options=options||{};
    if(commentDrawerState.busy || !cur) return;
    var targetSession=cur, drawerEpoch=commentDrawerState.epoch;
    var input=byId('commentInput');
    var question=String(Object.prototype.hasOwnProperty.call(options,'question')?options.question:(input&&input.value||'')).trim();
    if(!question) return;
    ensureCommentAnchorPinned();
    var thread=commentDrawerState.threadId ? commentThreads[commentDrawerState.threadId] : null;
    var userMessageAt=Date.now();
    if(!thread){
      var id='comment-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
      thread=rememberCommentThread({id:id,parentSessionId:commentDrawerState.parentSessionId,anchorKey:commentDrawerState.anchorKey,anchorText:commentDrawerState.anchorText,anchorData:commentDrawerState.anchorData||undefined,providerSessionId:'',vendor:cur.vendor,cwd:cur.cwd,createdAt:userMessageAt,lastUserMessageAt:userMessageAt,status:'generating',messageCount:0});
      commentDrawerState.threadId=id;
      syncCommentPromoteButton();
    } else thread=rememberCommentThread(Object.assign({},thread,{lastUserMessageAt:userMessageAt}))||thread;
    var resendMessage=options.userMessage;
    if(resendMessage&&resendMessage.parentNode===byId('commentMsgs')){
      var resendBubble=options.bubble||resendMessage.querySelector('.bubble');
      if(resendBubble) setBubbleText(resendBubble,question,true);
      while(resendMessage.nextSibling) resendMessage.nextSibling.remove();
      commentLatestUserMsgEl=resendMessage;
      scheduleCommentLatestPin();
    } else appendCommentMessage('user',question);
    commentDrawerState.assistant=null;
    commentDrawerState.stoppedByUser=false;
    cacheOpenCommentMessages();
    if(input){ input.value=''; syncCommentShortcutGhost(); } setCommentBusy(true); setCommentGenerating(true,userMessageAt);
    var context=commentContextBeforeAnchor(targetSession);
    var requestThreadId=thread.id, operation=beginOperation('comment-send',requestThreadId);
    var requestState={
      parentSessionId:commentDrawerState.parentSessionId,
      anchorKey:commentDrawerState.anchorKey,
      anchorText:commentDrawerState.anchorText,
      anchorData:commentDrawerState.anchorData||undefined,
      createdWhileGenerating:!!(turnActive&&commentDrawerState.anchorMsg&&(commentDrawerState.anchorMsg===assistantEl||commentDrawerState.anchorMsg.hasAttribute('data-tool-pending')))
    };
    function drawerIsCurrent(){ return commentDrawerState.epoch===drawerEpoch && commentDrawerState.threadId===requestThreadId; }
    function failComment(rawError){
      if(!operationIsCurrent(operation)) return;
      var publicError=normalizedProviderError(rawError,'Comment failed.');
      var latest=commentThreads[requestThreadId]||thread;
      rememberCommentThread(Object.assign({},latest,{status:latest.providerSessionId&&latest.status==='generating'?'generating':'failed'}));
      if(drawerIsCurrent()){
        appendCommentProviderError(publicError);
        setCommentBusy(false);
        setCommentGenerating(!!(latest&&latest.providerSessionId&&latest.status==='generating'));
      } else showToast(publicError.message,'warn');
    }
    fetch('/comments/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      threadId:requestThreadId,parentSessionId:requestState.parentSessionId,anchorKey:requestState.anchorKey,
      anchorText:requestState.anchorText,anchorData:requestState.anchorData,question:question,contextMessages:context,
      createdWhileGenerating:requestState.createdWhileGenerating,model:targetSession.model||undefined,effort:targetSession.effort||undefined,speed:targetSession.speed||undefined
    })}).then(function(r){return r.json();}).then(function(res){
      if(!operationIsCurrent(operation)) return;
      if(!res.ok){ failComment(res); return; }
      var saved=rememberCommentThread(res.thread);
      if(saved) drainCommentOrphanEvents(saved);
      if(!drawerIsCurrent()) return;
      if(saved) commentDrawerState.threadId=saved.id;
      syncCommentPromoteButton();
      setCommentBusy(false);
      if(commentDrawerState.stopping) stopCommentTurn();
      else setCommentGenerating(!!(saved&&saved.status==='generating'));
    }).catch(function(err){ failComment({message:err&&err.message?err.message:'Comment failed.',retryable:true}); });
  }
  function stopCommentTurn(){
    var thread=commentDrawerState.threadId&&commentThreads[commentDrawerState.threadId];
    if(commentDrawerState.pendingStop) return commentDrawerState.pendingStop;
    if(!thread||!commentDrawerState.generating) return Promise.resolve(false);
    commentDrawerState.stopping=true; syncCommentSendButton(); syncCommentPromoteButton();
    var status=byId('commentGenerating'), bubble=status&&status.querySelector('.bubble');
    if(bubble) bubble.textContent='Stopping…';
    syncCommentUserEditActions();
    if(!thread.providerSessionId) return Promise.resolve(false);
    var stopRequest=fetch('/chat/abort?session='+encodeURIComponent(thread.providerSessionId)+'&vendor='+encodeURIComponent(thread.vendor||'claude'),{method:'POST'})
      .then(function(r){ return r.json().catch(function(){ return {}; }); })
      .catch(function(){ return {}; })
      .then(function(){
        if(commentDrawerState.threadId!==thread.id) return false;
        thread=rememberCommentThread(Object.assign({},thread,{status:'read'}))||thread;
        commentDrawerState.stoppedByUser=true;
        setCommentBusy(false); setCommentGenerating(false); markCommentRead(thread);
        return true;
    });
    commentDrawerState.pendingStop=stopRequest;
    syncCommentUserEditActions();
    stopRequest.then(function(){
      if(commentDrawerState.pendingStop===stopRequest) commentDrawerState.pendingStop=null;
      syncCommentUserEditActions();
    },function(){
      if(commentDrawerState.pendingStop===stopRequest) commentDrawerState.pendingStop=null;
      syncCommentUserEditActions();
    });
    return stopRequest;
  }
  function commentPrimaryAction(){
    if(commentDrawerState.generating) stopCommentTurn();
    else sendComment();
  }
  function promoteCommentThread(){
    var thread=commentDrawerState.threadId&&commentThreads[commentDrawerState.threadId];
    if(!thread||commentDrawerState.busy||commentDrawerState.generating||commentDrawerState.promoting) return;
    var drawerEpoch=commentDrawerState.epoch, operation=beginOperation('comment-promote',thread.id);
    function drawerIsCurrent(){ return commentDrawerState.epoch===drawerEpoch && commentDrawerState.threadId===thread.id; }
    commentDrawerState.promoting=true; syncCommentPromoteButton();
    fetch('/comments/promote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:thread.id})})
      .then(function(r){return r.json();}).then(function(res){
        if(!operationIsCurrent(operation)) return;
        if(!res.ok){ if(drawerIsCurrent()){ commentDrawerState.promoting=false; syncCommentPromoteButton(); } showToast(res.error||'promotion failed','warn'); return; }
        delete commentThreads[thread.id];
        VAULT_STATE.commentThreads=commentThreads;
        syncAllMessageCommentStates(); syncAllSessionCommentBadges(); renderPinTray();
        delete commentMessageCache[thread.id];
        var shouldOpen=drawerIsCurrent();
        var openView=function(view){
          if(!view) return;
          var parent=findSessionById(thread.parentSessionId);
          if(parent){ inheritSessionTextCollections(parent,view); inheritSessionGoal(parent,view); }
          var existing=findSessionById(view.sessionId);
          if(!existing){ insertSession(view); renderSidebar(); existing=view; }
          drainOrphanAnalysis(existing);
          if(parent) groupChatSession(parent,existing);
          if(shouldOpen) select(existing);
        };
        if(shouldOpen) closeCommentDrawer();
        else showToast('Comment promoted to a session.','ok');
        if(res.view) openView(res.view);
        else fetch('/session/view?session='+encodeURIComponent(res.session)).then(function(r){return r.json();}).then(function(next){ openView(next&&next.view); });
      }).catch(function(err){
        if(!operationIsCurrent(operation)) return;
        if(drawerIsCurrent()){ commentDrawerState.promoting=false; syncCommentPromoteButton(); }
        showToast(err&&err.message?err.message:'promotion failed','warn');
      });
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
    body.appendChild(el('span','latestpin-k','YOU'));
    var text=el('span','latestpin-text',previewTextFromMsg(msgEl));
    if(text.textContent) text.setAttribute('data-hover-tip',text.textContent);
    body.appendChild(text);
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
  function hideCommentLatestPin(){
    var pin=byId('commentLatestPin'), body=byId('commentLatestPinBody'); if(!pin||!body) return;
    pin.classList.remove('show'); pin.setAttribute('aria-hidden','true'); body.innerHTML=''; syncCommentTopStack();
  }
  function refreshCommentLatestUserMsg(){
    var host=byId('commentMsgs'); if(!host) return null;
    var frame=host.getBoundingClientRect(), nodes=Array.prototype.filter.call(host.children,function(node){ return node.classList&&node.classList.contains('msg')&&node.classList.contains('user'); }); commentLatestUserMsgEl=null;
    Array.prototype.forEach.call(nodes,function(node){ if(node.getBoundingClientRect().bottom<frame.top+10) commentLatestUserMsgEl=node; });
    return commentLatestUserMsgEl;
  }
  function updateCommentLatestPin(){
    commentLatestPinRaf=0;
    if((byId('commentDrawer')||{}).hidden) return hideCommentLatestPin();
    var msg=refreshCommentLatestUserMsg(), pin=byId('commentLatestPin'), body=byId('commentLatestPinBody');
    if(!msg||!pin||!body) return hideCommentLatestPin();
    body.innerHTML=''; body.appendChild(el('span','latestpin-k','YOU'));
    var text=el('span','latestpin-text',previewTextFromMsg(msg));
    if(text.textContent) text.setAttribute('data-hover-tip',text.textContent);
    body.appendChild(text);
    body.appendChild(el('span','latestpin-arrow','→'));
    pin.classList.add('show'); pin.setAttribute('aria-hidden','false'); syncCommentTopStack();
  }
  function scheduleCommentLatestPin(){
    if(commentLatestPinRaf) return;
    commentLatestPinRaf=requestAnimationFrame(updateCommentLatestPin);
  }
  function jumpToCommentLatestPin(){
    var host=byId('commentMsgs'), target=commentLatestUserMsgEl||refreshCommentLatestUserMsg(); if(!host||!target) return;
    host.scrollTop=Math.max(0,host.scrollTop+target.getBoundingClientRect().top-host.getBoundingClientRect().top-18);
    hideCommentLatestPin(); scheduleCommentLatestPin();
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
  function trimBareUrl(raw){
    var value=String(raw||'');
    var boundary=value.length;
    // Linkifiers treat Unicode punctuation, separators, and controls as prose
    // boundaries. Non-ASCII letters remain valid in internationalized paths.
    for(var i=0;i<value.length;){
      var point=value.codePointAt(i);
      var ch=String.fromCodePoint(point);
      if(point>127 && /[\\p{P}\\p{Z}\\p{C}]/u.test(ch)){ boundary=i; break; }
      i+=ch.length;
    }
    value=value.slice(0,boundary);
    // Parentheses and brackets are URL content only as balanced pairs. This
    // keeps Function_(mathematics) intact while excluding an adjacent (note.
    [['(',')'],['[',']'],['{','}']].forEach(function(pair){
      var stack=[];
      var cut=value.length;
      for(var i=0;i<value.length;i++){
        if(value[i]===pair[0]) stack.push(i);
        else if(value[i]===pair[1]){
          if(stack.length) stack.pop();
          else { cut=i; break; }
        }
      }
      if(stack.length) cut=Math.min(cut,stack[0]);
      value=value.slice(0,cut);
    });
    // Follow GFM's extended-autolink terminal punctuation rule.
    return value.replace(/[?!.,:*_~;]+$/,'');
  }
  function parseInline(text){
    var src=String(text||'');
    var codes=[];
    var anchors=[];
    src = src.replace(/\x60([^\x60]+)\x60/g, function(_, code){
      var idx=codes.push('<code>'+escapeHtml(code)+'</code>')-1;
      return '\u0000'+idx+'\u0000';
    });
    src = src.replace(/\\[([^\\]]+)\\]\\(([^)\\s]+)\\)/g, function(_, label, href){
      var local=localLinkPath(href);
      var anchor='';
      if(local){
        anchor='<a href="#" class="filepath" data-path="'+escapeAttr(local)+'" title="Reveal in file manager">'+parseInline(label)+'</a>';
      } else {
        var safe=sanitizeUrl(href);
        if(!safe) return label;
        anchor='<a href="'+escapeAttr(safe)+'" target="_blank" rel="noreferrer">'+parseInline(label)+'</a>';
      }
      var idx=anchors.push(anchor)-1;
      return '\u0001'+idx+'\u0001';
    });
    src = src.replace(/https?:\\/\\/[^\\s<>"']+/g, function(url){
      var raw=String(url||'');
      var trimmed=trimBareUrl(raw);
      var tail=raw.slice(trimmed.length);
      var safe=sanitizeUrl(trimmed);
      if(!safe) return url;
      var anchor='<a href="'+escapeAttr(safe)+'" target="_blank" rel="noreferrer">'+escapeHtml(trimmed)+'</a>';
      var idx=anchors.push(anchor)-1;
      return '\u0001'+idx+'\u0001'+tail;
    });
    src = escapeHtml(src);
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
    if(type==='plantuml'){
      // Render sends the source to plantuml.com, so gate it — but always offer
      // local Show source / Copy so the diagram is usable without any network call.
      var row='<div class="diagram-status">'
        +'<button type="button" class="diagram-btn diagram-render">Render</button>'
        +'<button type="button" class="diagram-btn diagram-toggle" aria-expanded="false">Show source</button>'
        +'<button type="button" class="diagram-btn diagram-copy">Copy</button>'
        +'<span class="diagram-note">Render sends the source to plantuml.com.</span>'
        +'</div>';
      var src='<pre class="diagram-src" hidden><code>'+escapeHtml(code)+'</code></pre>';
      return '<div class="diagram diagram-plantuml" data-diagram="plantuml" data-source="'+escapeAttr(code)+'">'+row+src+'</div>';
    }
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
  // Remembers which PlantUML sources the user already consented to render this
  // session, so switching tabs (which rebuilds the message list from scratch)
  // re-renders them automatically instead of re-showing the consent button.
  var plantUmlConsented = {};
  var MERMAID_CDN = '/assets/mermaid.min.js';
  var PAKO_CDN = '/assets/pako.min.js';
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
  function preparePlantUmlDiagram(node){
    if(!node || node.getAttribute('data-consent-bound')) return;
    node.setAttribute('data-consent-bound','1');
    var source=node.getAttribute('data-source') || '';
    if(source && plantUmlConsented[source]){ renderPlantUmlDiagram(node); return; }
    var render=node.querySelector('.diagram-render');
    var toggle=node.querySelector('.diagram-toggle');
    var copy=node.querySelector('.diagram-copy');
    var src=node.querySelector('.diagram-src');
    if(render){
      render.onclick=function(){
        var allowed=window.confirm('Render this PlantUML diagram? Its source will be sent to plantuml.com.');
        if(!allowed) return;
        if(source) plantUmlConsented[source]=true;
        renderPlantUmlDiagram(node);
      };
    }
    // Show source / Copy are pure-local: they never contact plantuml.com.
    if(toggle && src){
      toggle.onclick=function(){
        var show=src.hidden;
        src.hidden=!show;
        toggle.textContent=show?'Hide source':'Show source';
        toggle.setAttribute('aria-expanded',show?'true':'false');
      };
    }
    if(copy){
      copy.onclick=function(){
        copy.disabled=true;
        copyPlainText(source).then(function(){
          copy.textContent='Copied';
          setTimeout(function(){ if(copy.isConnected){ copy.textContent='Copy'; copy.disabled=false; } },1200);
        }).catch(function(){ copy.textContent='Copy failed'; copy.disabled=false; });
      };
    }
  }
  function renderDiagrams(root){
    if(!root || typeof root.querySelectorAll!=='function') return;
    root.querySelectorAll('.diagram[data-diagram]').forEach(function(node){
      var type=node.getAttribute('data-diagram');
      if(type==='mermaid') renderMermaidDiagram(node);
      else if(type==='plantuml') preparePlantUmlDiagram(node);
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
  // with a real extension. Unicode segments are kept together so text such as
  // codex/模型/effort/speed is checked as one candidate, never as /effort/speed.
  function pathRegex(){
    return /[A-Za-z]:\\\\[^\\s<>"']+|~\\/[^\\s<>"']+|\\/[\\p{L}\\p{N}_.-]+(?:\\/[\\p{L}\\p{N}_.-]+)*|[\\p{L}\\p{N}_.-]+(?:\\/[\\p{L}\\p{N}_.-]+)+|[\\p{L}\\p{N}][\\p{L}\\p{N}_.-]*\\.[A-Za-z][A-Za-z0-9]{1,7}/gu;
  }
  function isLikelyPathToken(raw){
    var value=String(raw||'');
    // Fractions and test summaries such as 2/2 and 24/24 are not directories.
    if(/^(?:\\d+(?:\\.\\d+)?\\/)+\\d+(?:\\.\\d+)?$/.test(value)) return false;
    return true;
  }
  function isExplicitPathToken(raw){
    return /^(?:[A-Za-z]:\\\\|~\\/|\\/|\\.\\.?\\/)/.test(String(raw||''));
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
    verifyPathCandidates(root);
  }
  function replacePathTextNode(node){
    var text=node.nodeValue, re=pathRegex(), frag=document.createDocumentFragment(), last=0, m;
    while((m=re.exec(text))){
      var raw=m[0].replace(/[.,:;)\\]]+$/,''); // trailing sentence punctuation isn't part of the path
      if(isUrlPathContinuation(text, m.index, raw)) continue;
      if(!isLikelyPathToken(raw)) continue;
      if(raw.length<2) continue;
      var start=m.index, end=start+raw.length;
      if(start>last) frag.appendChild(document.createTextNode(text.slice(last,start)));
      var span=document.createElement('span');
      span.className=isExplicitPathToken(raw)?'filepath':'pathcandidate';
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
  var pathCheckCache=Object.create(null);
  function pathCheckKey(cwd, value){ return String(cwd||'')+'\\n'+String(value||''); }
  function settlePathCandidate(node, exists){
    if(!node||!node.parentNode) return;
    if(exists){ node.classList.remove('pathcandidate'); node.classList.add('filepath'); return; }
    node.parentNode.replaceChild(document.createTextNode(node.textContent||''),node);
  }
  function verifyPathCandidates(root){
    if(!root||typeof root.querySelectorAll!=='function') return;
    var nodes=Array.prototype.slice.call(root.querySelectorAll('.pathcandidate'));
    if(!nodes.length) return;
    var cwd=(cur&&cur.cwd)||'';
    if(!cwd){ nodes.forEach(function(node){ settlePathCandidate(node,false); }); return; }
    var fresh=[], seen=Object.create(null);
    nodes.forEach(function(node){
      var value=node.getAttribute('data-path')||'', key=pathCheckKey(cwd,value);
      if(pathCheckCache[key]||seen[value]) return;
      seen[value]=true; fresh.push(value);
    });
    if(fresh.length){
      var batch=fetch('/paths/exists',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cwd:cwd,paths:fresh})})
        .then(function(r){ return r.ok?r.json():{exists:[]}; })
        .catch(function(){ return {exists:[]}; });
      fresh.forEach(function(value,index){
        pathCheckCache[pathCheckKey(cwd,value)]=batch.then(function(result){ return !!(result&&result.exists&&result.exists[index]); });
      });
    }
    nodes.forEach(function(node){
      var value=node.getAttribute('data-path')||'', check=pathCheckCache[pathCheckKey(cwd,value)];
      Promise.resolve(check||false).then(function(exists){ settlePathCandidate(node,exists); });
    });
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
      : vendor==='cursor'
        ? { fg:'var(--vendor-cursor-fg)', bg:'var(--vendor-cursor-bg)', border:'var(--vendor-cursor-border)' }
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
    var count=Number(s.prompts)||0;
    var prompts=el('span','ctx-prompts',count+'p');
    prompts.setAttribute('data-hover-tip',count+' user message'+(count===1?'':'s')+' in this session');
    row.appendChild(prompts);
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
    resetComposerHistoryNavigation();
    var input=byId('input');
    if(input){
      input.value=text;
      setDraftForSession(s, text);
      syncComposerHeight();
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
    var nudgeText=avoidanceNudgeText(cur),nudge=el('div','avoidpanel-draft',nudgeText);
    nudge.onpointerover=function(){
      if(nudge.scrollWidth>nudge.clientWidth) nudge.setAttribute('data-hover-tip',nudgeText);
      else nudge.removeAttribute('data-hover-tip');
    };
    panel.appendChild(nudge);
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
    if(s.sessionId){
      badge.classList.add('editable');
      badge.setAttribute('role','button');
      badge.tabIndex=0;
      badge.setAttribute('aria-label','Change state: '+stateLabel(s.state));
      var editState=function(ev){ ev.stopPropagation(); showSignalMenu(badge, s, 'state', STATE_OPTIONS.map(function(st){ return {value:st,label:stateLabel(st),node:stateChip(st, false),on:st===s.state}; })); };
      badge.onclick=editState;
      badge.onkeydown=function(ev){ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); editState(ev); } };
    }
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
    var hasAvailable=VENDORS.some(function(v){ return !!(v&&v.available); });
    return VENDORS.filter(function(v){
      return v && (!hasAvailable || v.available) && (!query || v.vendor.toLowerCase().indexOf(query)>=0);
    });
  }
  function saveNewPrefs(){
    VAULT_STATE.modelPrefs=newPrefs;
    saveVaultUiState({modelPrefs:newPrefs});
  }
  function saveVaultUiState(patch){
    // Persist local UI patches in issue order. These writes are tiny and rare;
    // serialization avoids an older title/pin/theme request winning on disk.
    vaultWriteChain=vaultWriteChain.catch(function(){}).then(function(){
      return fetch('/vault/ui-state',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(patch)})
        .then(function(r){ if(!r.ok) throw new Error('ui state save failed'); return true; })
        .catch(function(){ showToast('Could not save this UI change. It may not survive restart.','warn'); return false; });
    });
    return vaultWriteChain;
  }
  function makeUiTextId(kind){
    var suffix='';
    try{ suffix=crypto.randomUUID(); }catch(e){ suffix=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2); }
    return String(kind||'item')+'-'+suffix;
  }
  function ensureComposerCollections(){
    if(!VAULT_STATE || typeof VAULT_STATE!=='object') VAULT_STATE={};
    if(!Array.isArray(VAULT_STATE.shortcuts)) VAULT_STATE.shortcuts=[];
    if(!VAULT_STATE.sessionNotes || typeof VAULT_STATE.sessionNotes!=='object' || Array.isArray(VAULT_STATE.sessionNotes)) VAULT_STATE.sessionNotes={};
    if(!VAULT_STATE.sessionTodos || typeof VAULT_STATE.sessionTodos!=='object' || Array.isArray(VAULT_STATE.sessionTodos)) VAULT_STATE.sessionTodos={};
    if(!Array.isArray(VAULT_STATE.inboxTodos)) VAULT_STATE.inboxTodos=[];
  }
  function sessionTextKey(s){
    if(!s) return '';
    return providerSessionId(s) || String(s.clientBranchId||s.sessionId||'');
  }
  function composerTextItems(kind,s){
    ensureComposerCollections();
    if(kind==='shortcuts') return VAULT_STATE.shortcuts;
    var key=sessionTextKey(s);
    if(!key) return [];
    var store=kind==='notes' ? VAULT_STATE.sessionNotes : VAULT_STATE.sessionTodos;
    return Array.isArray(store[key]) ? store[key] : [];
  }
  function openTodoCount(s){
    return composerTextItems('todo',s).filter(function(item){ return item && item.completed!==true; }).length;
  }
  function todoSessionForKey(key){
    key=String(key||'');
    for(var i=0;i<SESS.length;i++) if(sessionTextKey(SESS[i])===key) return SESS[i];
    return null;
  }
  function todoOwnerItems(ownerKey){
    ensureComposerCollections();
    if(ownerKey==='inbox') return VAULT_STATE.inboxTodos;
    return Array.isArray(VAULT_STATE.sessionTodos[ownerKey]) ? VAULT_STATE.sessionTodos[ownerKey] : [];
  }
  function persistInboxTodos(items){
    ensureComposerCollections();
    VAULT_STATE.inboxTodos=Array.isArray(items)?items:[];
    saveVaultUiState({inboxTodos:VAULT_STATE.inboxTodos});
    renderTodoHub();
    renderTodoHubSummary();
  }
  function persistSessionTodoKey(key,items){
    ensureComposerCollections();
    key=String(key||''); if(!key) return;
    items=Array.isArray(items)?items:[];
    if(items.length) VAULT_STATE.sessionTodos[key]=items;
    else delete VAULT_STATE.sessionTodos[key];
    var patch={}; patch[key]=items.length?items:null;
    saveVaultUiState({sessionTodos:patch});
    renderSidebar();
    renderComposerRail();
    renderTodoHub();
    renderTodoHubSummary();
  }
  function todoHubEntries(){
    ensureComposerCollections();
    var entries=[],seenKeys={};
    VAULT_STATE.inboxTodos.forEach(function(item){ entries.push({ownerKey:'inbox',session:null,item:item}); });
    SESS.forEach(function(s){
      var key=sessionTextKey(s); if(!key||seenKeys[key]) return;
      seenKeys[key]=true;
      var items=Array.isArray(VAULT_STATE.sessionTodos[key])?VAULT_STATE.sessionTodos[key]:[];
      items.forEach(function(item){ entries.push({ownerKey:key,session:s,item:item}); });
    });
    return entries;
  }
  function todoHubOpenCount(){
    return todoHubEntries().filter(function(entry){ return entry.item&&entry.item.completed!==true; }).length;
  }
  function renderTodoHubSummary(){
    var count=todoHubOpenCount(),badge=byId('todoHubCount'),button=byId('todoHubToggle');
    if(badge){ badge.textContent=count>99?'99+':String(count); badge.hidden=count===0; }
    if(button){
      var label='Todos'+(count?' · '+count+' open':'');
      button.setAttribute('aria-label',(todoHubOpen()?'close ':'open ')+label.toLowerCase());
      button.removeAttribute('title');
      button.setAttribute('data-hover-tip',label);
    }
  }
  function updateTodoEntry(ownerKey,id,updater){
    var items=todoOwnerItems(ownerKey).slice(),index=items.findIndex(function(item){ return item.id===id; });
    if(index<0) return;
    var next=updater(items[index]);
    if(next) items[index]=next; else items.splice(index,1);
    if(ownerKey==='inbox') persistInboxTodos(items); else persistSessionTodoKey(ownerKey,items);
  }
  function addTodoHubItem(){
    var input=byId('todoHubAddInput'),text=String(input&&input.value||'').trim();
    if(!text) return;
    var now=Date.now(),items=todoOwnerItems('inbox').slice();
    items.unshift({id:makeUiTextId('todo'),text:text,createdAt:now,updatedAt:now,completed:false});
    if(input) input.value='';
    persistInboxTodos(items);
    syncTodoHubAddButton();
    setTimeout(function(){ if(todoHubOpen()&&input) input.focus(); },0);
  }
  function toggleTodoHubItem(ownerKey,id,completed){
    var now=Date.now();
    updateTodoEntry(ownerKey,id,function(item){
      var next=Object.assign({},item,{completed:completed===true,updatedAt:now});
      if(completed) next.completedAt=now; else delete next.completedAt;
      return next;
    });
  }
  function startTodoHubEdit(ownerKey,id){
    todoHubEditing={ownerKey:ownerKey,id:id};
    renderTodoHub();
    setTimeout(function(){ var input=byId('todoHubEditInput'); if(input){ input.focus(); input.select(); } },0);
  }
  function commitTodoHubEdit(ownerKey,id){
    var input=byId('todoHubEditInput'),text=String(input&&input.value||'').trim();
    if(!text) return;
    todoHubEditing=null;
    updateTodoEntry(ownerKey,id,function(item){ return Object.assign({},item,{text:text,updatedAt:Date.now()}); });
  }
  function deleteTodoHubItem(ownerKey,id){
    todoHubEditing=null;
    updateTodoEntry(ownerKey,id,function(){ return null; });
  }
  function clearTodoHubCompleted(){
    var entries=todoHubEntries(),owners={};
    entries.forEach(function(entry){ if(entry.item&&entry.item.completed===true) owners[entry.ownerKey]=true; });
    Object.keys(owners).forEach(function(ownerKey){
      var items=todoOwnerItems(ownerKey).filter(function(item){ return item.completed!==true; });
      if(ownerKey==='inbox') VAULT_STATE.inboxTodos=items;
      else if(items.length) VAULT_STATE.sessionTodos[ownerKey]=items;
      else delete VAULT_STATE.sessionTodos[ownerKey];
    });
    if(!Object.keys(owners).length) return;
    todoHubEditing=null;
    todoHubShowCompleted=false;
    var sessionTodos={};
    Object.keys(owners).forEach(function(ownerKey){
      if(ownerKey!=='inbox') sessionTodos[ownerKey]=VAULT_STATE.sessionTodos[ownerKey]||null;
    });
    var patch={sessionTodos:sessionTodos};
    if(owners.inbox) patch.inboxTodos=VAULT_STATE.inboxTodos;
    saveVaultUiState(patch);
    renderSidebar();
    renderComposerRail();
    renderTodoHub();
    renderTodoHubSummary();
  }
  function todoHubSessionLabel(s){
    if(!s) return 'Session unavailable';
    return [s.customTitle||s.brief||s.title||'(new session)',s.project||basename(s.cwd||'')].filter(Boolean).join(' · ');
  }
  function renderTodoHubItem(host,entry){
    var item=entry.item,row=el('div','todohub-item'+(item.completed?' done':''));
    row.setAttribute('data-todo-id',String(item.id||''));
    row.setAttribute('data-todo-owner',entry.ownerKey);
    var check=document.createElement('input'); check.type='checkbox'; check.className='rail-todo-check todohub-check'; check.checked=item.completed===true;
    check.setAttribute('aria-label',(item.completed?'Reopen ':'Complete ')+item.text);
    check.onchange=function(){ toggleTodoHubItem(entry.ownerKey,item.id,check.checked); };
    row.appendChild(check);
    if(todoHubEditing&&todoHubEditing.ownerKey===entry.ownerKey&&todoHubEditing.id===item.id){
      var edit=el('div','todohub-edit'),input=el('input'); input.id='todoHubEditInput'; input.value=item.text;
      var save=el('button',null,'save'); save.type='button';
      var cancel=editCancelButton('Cancel todo edit (Esc)');
      function commit(){ commitTodoHubEdit(entry.ownerKey,item.id); }
      save.onclick=commit; cancel.onclick=function(){ todoHubEditing=null; renderTodoHub(); };
      input.onkeydown=function(ev){
        if(ev.key==='Enter'&&!isImeConfirming(ev)){ ev.preventDefault(); commit(); }
        else if(ev.key==='Escape'){ ev.preventDefault(); todoHubEditing=null; renderTodoHub(); }
      };
      edit.appendChild(input); edit.appendChild(save); edit.appendChild(cancel); row.appendChild(edit); host.appendChild(row); return;
    }
    var content=el('div','todohub-content'),text=el('button','todohub-text',item.text); text.type='button';
    text.setAttribute('data-hover-tip',item.text);
    if(entry.session){
      text.title='Open session';
      text.onclick=function(){ closeTodoHub(); select(entry.session); };
    } else {
      text.title='Edit todo';
      text.onclick=function(){ startTodoHubEdit(entry.ownerKey,item.id); };
    }
    content.appendChild(text);
    var meta=el('div','todohub-meta');
    if(entry.session){
      var scope=el('button','todohub-scope',todoHubSessionLabel(entry.session)); scope.type='button';
      scope.onclick=function(){ closeTodoHub(); select(entry.session); }; meta.appendChild(scope);
    }
    meta.appendChild(el('span','',ageLabelAt(item.updatedAt)));
    content.appendChild(meta); row.appendChild(content);
    var actions=el('div','todohub-actions');
    var editButton=el('button','qaction qedit'); setIconButton(editButton,'edit','Edit todo'); editButton.onclick=function(ev){ ev.stopPropagation(); startTodoHubEdit(entry.ownerKey,item.id); }; actions.appendChild(editButton);
    var del=el('button','qaction qdel'); setIconButton(del,'delete','Delete todo'); del.onclick=function(ev){ ev.stopPropagation(); deleteTodoHubItem(entry.ownerKey,item.id); }; actions.appendChild(del);
    row.appendChild(actions); host.appendChild(row);
  }
  function renderTodoHubItems(body,entries){
    if(!entries.length) return;
    var list=el('div','todohub-items'); entries.forEach(function(entry){ renderTodoHubItem(list,entry); }); body.appendChild(list);
  }
  function renderTodoHub(){
    renderTodoHubSummary();
    var body=byId('todoHubBody'); if(!body) return;
    var entries=todoHubEntries();
    entries.sort(function(a,b){
      return Number(b.item.updatedAt||0)-Number(a.item.updatedAt||0);
    });
    var open=entries.filter(function(entry){ return entry.item.completed!==true; });
    var completed=entries.filter(function(entry){ return entry.item.completed===true; });
    body.innerHTML='';
    if(!open.length&&!completed.length){
      body.appendChild(el('div','todohub-empty','Nothing to do yet.'));
      return;
    }
    renderTodoHubItems(body,open);
    if(completed.length){
      var completedRow=el('div','todohub-completed-row');
      var toggle=el('button','todohub-completed',(todoHubShowCompleted?'Hide ':'Show ')+'completed · '+completed.length); toggle.type='button';
      toggle.onclick=function(){ todoHubShowCompleted=!todoHubShowCompleted; renderTodoHub(); }; completedRow.appendChild(toggle);
      var clear=el('button','todohub-clear-completed','clear completed'); clear.type='button';
      clear.setAttribute('aria-label','Clear completed todos');
      clear.onclick=clearTodoHubCompleted; completedRow.appendChild(clear);
      body.appendChild(completedRow);
      if(todoHubShowCompleted) renderTodoHubItems(body,completed);
    }
  }
  function syncTodoHubAddButton(){
    var input=byId('todoHubAddInput'),button=byId('todoHubAddButton');
    if(button) button.disabled=!String(input&&input.value||'').trim();
  }
  function persistComposerTextItems(kind,s,items){
    ensureComposerCollections();
    items=Array.isArray(items) ? items : [];
    if(kind==='shortcuts'){
      VAULT_STATE.shortcuts=items;
      saveVaultUiState({shortcuts:items});
    } else {
      var key=sessionTextKey(s);
      if(!key) return;
      var field=kind==='notes' ? 'sessionNotes' : 'sessionTodos';
      var store=field==='sessionNotes' ? VAULT_STATE.sessionNotes : VAULT_STATE.sessionTodos;
      if(items.length) store[key]=items;
      else delete store[key];
      var patch={}; patch[key]=items.length ? items : null;
      var body={}; body[field]=patch;
      saveVaultUiState(body);
    }
    if(kind==='todo') renderSidebar();
    if(kind==='shortcuts'){ syncComposerShortcutGhost(); syncCommentShortcutGhost(); syncNewShortcutGhost(); }
    renderComposerRail();
    if(kind==='todo'){ renderTodoHub(); renderTodoHubSummary(); }
  }
  function mergeUiTextItems(first,second){
    var out=[],seen={};
    (first||[]).concat(second||[]).forEach(function(item){
      var id=String(item&&item.id||'');
      if(!id || seen[id]) return;
      seen[id]=true; out.push(item);
    });
    return out;
  }
  function migrateSessionTextCollections(fromKey,toKey){
    fromKey=String(fromKey||''); toKey=String(toKey||'');
    if(!fromKey || !toKey || fromKey===toKey) return;
    ensureComposerCollections();
    var body={},changed=false;
    [['sessionNotes',VAULT_STATE.sessionNotes],['sessionTodos',VAULT_STATE.sessionTodos]].forEach(function(entry){
      var field=entry[0],store=entry[1],from=Array.isArray(store[fromKey])?store[fromKey]:[];
      if(!from.length) return;
      var merged=mergeUiTextItems(store[toKey],from);
      store[toKey]=merged; delete store[fromKey];
      var patch={}; patch[fromKey]=null; patch[toKey]=merged; body[field]=patch; changed=true;
    });
    if(changed) saveVaultUiState(body);
  }
  function inheritSessionTextCollections(parent,child){
    var parentKey=sessionTextKey(parent),childKey=sessionTextKey(child);
    if(!parentKey || !childKey || parentKey===childKey) return;
    ensureComposerCollections();
    var body={},changed=false;
    [['sessionNotes',VAULT_STATE.sessionNotes],['sessionTodos',VAULT_STATE.sessionTodos]].forEach(function(entry){
      var field=entry[0],store=entry[1],source=Array.isArray(store[parentKey])?store[parentKey]:[];
      if(!source.length) return;
      var inherited=source.map(function(item){ return Object.assign({},item); });
      store[childKey]=inherited;
      var patch={}; patch[childKey]=inherited; body[field]=patch; changed=true;
    });
    if(changed) saveVaultUiState(body);
  }
  function inheritSessionGoal(parent,child){
    var parentKey=providerSessionId(parent),childKey=sessionTextKey(child);
    var vendor=String(child&&child.vendor||'').toLowerCase();
    var source=parentKey&&savedSessionGoals()[parentKey];
    if(!childKey || !goalIsActive(source) || (vendor!=='claude'&&vendor!=='codex')) return;
    var inherited=Object.assign({},source,{vendor:vendor,updatedAt:Date.now()});
    savedSessionGoals()[childKey]=inherited;
    var patch={}; patch[childKey]=inherited;
    saveVaultUiState({sessionGoals:patch});
  }
  function migrateSessionGoal(fromKey,toKey){
    fromKey=String(fromKey||''); toKey=String(toKey||'');
    if(!fromKey || !toKey || fromKey===toKey) return;
    var goals=savedSessionGoals(),source=goals[fromKey];
    if(!source) return;
    goals[toKey]=source; delete goals[fromKey];
    var patch={}; patch[fromKey]=null; patch[toKey]=source;
    saveVaultUiState({sessionGoals:patch});
  }
  function bindProviderSessionId(s,providerId){
    if(!s || !providerId) return;
    var previous=sessionTextKey(s);
    var newlyBound=!s.providerSessionId;
    s.providerSessionId=providerId;
    migrateSessionTextCollections(previous,String(providerId));
    migrateSessionGoal(previous,String(providerId));
    var chatGroup=chatGroupForSession(s); if(chatGroup) persistChatGroups([chatGroup]);
    if(cur===s){
      renderComposerRail();
      refreshGoalToggle();
    }
    drainOrphanAnalysis(s);
  }
  function railOptionLabel(options,value,fallback){
    for(var i=0;i<(options||[]).length;i++) if(String(options[i].value)===String(value)) return options[i].label||options[i].value;
    return value || fallback;
  }
  function compactRailLabel(label){
    return String(label||'').replace(/\\s+\\((?:CLI\\s+)?default\\)$/i,'');
  }
  function setRailButton(id,label,count,opts){
    var button=byId(id); if(!button) return;
    opts=opts||{};
    var value=button.querySelector('.railbtn-value'); if(value) value.textContent=label;
    var badge=button.querySelector('.railbtn-count'),n=Math.max(0,Number(count)||0);
    if(badge){ badge.textContent=String(n); badge.hidden=n===0; }
    button.classList.toggle('rail-has-count',!!badge&&n>0);
    button.disabled=opts.disabled===true;
    if(opts.kind==='vendor') button.setAttribute('data-vendor',opts.vendor||'');
    button.classList.toggle('active',composerRailKind===opts.kind);
    button.setAttribute('aria-expanded',composerRailKind===opts.kind?'true':'false');
    if(opts.title) button.title=opts.title; else button.removeAttribute('title');
  }
  function renderComposerRail(){
    var config=currentForkDefaults();
    var display=currentRunDisplayConfig(config);
    var configurable=canConfigureRun();
    var model=config.model||cliDefault(config.vendor,'model');
    var effort=config.effort||defaultEffortValue(config.vendor,model);
    var speed=config.speed||defaultSpeedValue(config.vendor,model);
    var speedSupported=modelSupportsSpeed(config.vendor,model)||!!display.speed||!modelMetaFor(config.vendor,model);
    var modelLabel=display.model ? railOptionLabel(modelOptionsFor(config.vendor),display.model,display.model) : 'unknown';
    var effortLabel=display.effort ? railOptionLabel(effortOptionsFor(config.vendor,model,speed),display.effort,display.effort) : 'unknown';
    var speedLabel=speedSupported ? (display.speed ? railOptionLabel(speedOptionsFor(config.vendor,model,effort),display.speed,display.speed) : 'unknown') : '—';
    setRailButton('railVendor',config.vendor||'—',null,{kind:'vendor',vendor:config.vendor,disabled:!configurable});
    setRailButton('railModel',compactRailLabel(modelLabel),null,{kind:'model',disabled:!configurable,title:modelLabel});
    setRailButton('railEffort',compactRailLabel(effortLabel),null,{kind:'effort',disabled:!configurable,title:effortLabel});
    setRailButton('railSpeed',compactRailLabel(speedLabel),null,{kind:'speed',disabled:!configurable||!speedSupported,title:speedSupported?speedLabel:'Speed is unavailable for this model'});
    setRailButton('railShortcuts','shortcuts',composerTextItems('shortcuts',cur).length,{kind:'shortcuts',disabled:!cur});
    setRailButton('railNotes','notes',composerTextItems('notes',cur).length,{kind:'notes',disabled:!cur});
    setRailButton('railTodos','todo',openTodoCount(cur),{kind:'todo',disabled:!cur});
    renderRailProbe();
    syncComposerShortcutGhost();
    var pop=byId('composerRailPop');
    if(!composerRailKind){ if(pop) pop.hidden=true; return; }
    renderComposerRailPanel();
  }
  // Lane A — the daemon's most-likely next message. Surfaced as a ghost in the
  // EMPTY composer even before it owns focus; Tab accepts it once focused.
  function nextStepText(s){ return s && !s.generating && s.nextStep ? String(s.nextStep).trim() : ''; }
  // Lane B — the daemon's scrutiny probe (question / explain / verify THIS turn).
  // Sits to the right of "todo", filling the rail width; a click replaces the draft
  // (never sends). Shown independently of nextStep, whenever the daemon emitted one.
  function probeText(s){ return s && !s.generating && s.probe ? String(s.probe).trim() : ''; }
  function renderRailProbe(){
    var btn=byId('railProbe');
    if(!btn) return;
    var rail=byId('composerRail');
    var text=probeText(cur);
    if(!text){ btn.hidden=true; btn.disabled=true; if(rail) rail.classList.remove('rail-full'); return; }
    btn.hidden=false; btn.disabled=false;
    if(rail) rail.classList.add('rail-full');
    var value=btn.querySelector('.railbtn-value');
    if(value) value.textContent=text;
    // Full text on hover — the rail truncates at the composer edge.
    btn.title=text;
  }
  function fillProbe(){
    var text=probeText(cur);
    if(!text) return;
    closeSignalMenu();
    resetComposerHistoryNavigation();
    var input=byId('input');
    if(input){
      input.value=text;               // replace the draft (fill-not-send)
      setDraftForSession(cur, text);
      syncComposerHeight();
      syncComposerShortcutGhost();
      input.focus();
      input.select();
    }
  }
  function composerRailTrigger(kind){
    var ids={vendor:'railVendor',model:'railModel',effort:'railEffort',speed:'railSpeed',shortcuts:'railShortcuts',notes:'railNotes',todo:'railTodos'};
    return byId(ids[kind]||'');
  }
  function alignComposerRailPanel(){
    var composer=byId('composer'),rail=byId('composerRail'),pop=byId('composerRailPop'),trigger=composerRailTrigger(composerRailKind);
    if(!composer||!rail||!pop||!trigger||pop.hidden) return;
    pop.style.left='0px';
    var composerRect=composer.getBoundingClientRect(),railRect=rail.getBoundingClientRect(),triggerRect=trigger.getBoundingClientRect();
    var railBase=railRect.left+rail.clientLeft; // absolute left offsets from the tray's padding box, past its border
    var preferred=triggerRect.left-railBase;
    var minLeft=composerRect.left-railBase,maxLeft=composerRect.right-railBase-pop.offsetWidth;
    var left=Math.max(minLeft,Math.min(preferred,maxLeft));
    pop.style.left=Math.round(left)+'px';
  }
  function closeComposerRail(){
    composerRailKind=''; composerRailEditing=null;
    var pop=byId('composerRailPop'); if(pop) pop.hidden=true;
    var foot=document.querySelector('.foot'); if(foot) foot.classList.remove('rail-open');
    renderComposerRail();
  }
  function openComposerRail(kind){
    if(composerRailKind===kind){ closeComposerRail(); return; }
    if((kind==='vendor'||kind==='model'||kind==='effort'||kind==='speed') && !canConfigureRun()) return;
    if(!cur) return;
    if((kind==='vendor'||kind==='model'||kind==='effort'||kind==='speed') && !(byId('rvendor')||{}).options.length) populateRunConfigControls();
    composerRailKind=kind; composerRailEditing=null;
    var foot=document.querySelector('.foot'); if(foot) foot.classList.add('rail-open');
    renderComposerRail();
    if(kind==='shortcuts'||kind==='notes'||kind==='todo') setTimeout(function(){ var input=byId('railAddInput'); if(input) input.focus(); },0);
  }
  function chooseRailConfig(kind,value){
    if(kind==='vendor'){
      var vendor=byId('rvendor'); if(vendor) vendor.value=value;
      refreshRunConfigControls(true); applyRunConfig();
    } else if(kind==='model'){
      var model=byId('rmodel'); if(model) model.value=value;
      syncRunConfigurationToModel();
    } else if(kind==='effort'){
      var effort=byId('reffort'); if(effort) effort.value=value;
      syncRunEffortSelection();
    } else {
      var speed=byId('rspeed'); if(speed) speed.value=value;
      syncRunSpeedSelection();
    }
    closeComposerRail();
  }
  function renderRailConfigOptions(body,kind){
    var config=currentForkDefaults(),options=[],selected='';
    if(kind==='vendor'){
      options=forkVendorChoices().map(function(info){ return {value:info.vendor,label:info.vendor}; });
      selected=config.vendor;
    } else if(kind==='model'){
      options=modelOptionsFor(config.vendor); selected=config.model||cliDefault(config.vendor,'model');
    } else if(kind==='effort'){
      var model=config.model||cliDefault(config.vendor,'model');
      options=effortOptionsFor(config.vendor,model,config.speed); selected=config.effort||defaultEffortValue(config.vendor,model);
    } else {
      var model=config.model||cliDefault(config.vendor,'model');
      options=speedOptionsFor(config.vendor,model,config.effort); selected=config.speed||defaultSpeedValue(config.vendor,model);
    }
    if(!options.length){ body.appendChild(el('div','rail-empty','No options available')); return; }
    options.forEach(function(option){
      var value=String(option.value==null?'':option.value),isCurrent=value===String(selected||'');
      var button=el('button','rail-option'+(isCurrent?' on':'')),notes=[];
      button.type='button';
      button.setAttribute('aria-current',isCurrent?'true':'false');
      if(kind==='vendor'){
        button.setAttribute('data-vendor',value);
        button.appendChild(el('span','rail-option-vendor-mark'));
      }
      button.appendChild(el('span','rail-option-label',option.label||value||'CLI default'));
      if(kind==='vendor') notes.push(isCurrent?'current':(value===String(cur&&cur.vendor||'')?'session':'fork'));
      else if((kind==='effort'||kind==='speed') && isCurrent) notes.push('current');
      if(kind!=='model' && option.note) notes.push(option.note);
      if(notes.length) button.appendChild(el('span','rail-option-note',notes.join(' · ')));
      button.onclick=function(){ chooseRailConfig(kind,value); };
      body.appendChild(button);
    });
  }
  function insertRailText(text){
    var input=byId('input'); if(!input) return;
    var value=String(text||''),start=typeof input.selectionStart==='number'?input.selectionStart:input.value.length,end=typeof input.selectionEnd==='number'?input.selectionEnd:start;
    var before=input.value.slice(0,start),after=input.value.slice(end);
    var prefix=before && !/\\s$/.test(before)?'\\n':'';
    var suffix=after && !/^\\s/.test(after)?'\\n':'';
    input.value=before+prefix+value+suffix+after;
    var caret=(before+prefix+value).length;
    input.setSelectionRange(caret,caret);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.focus();
  }
  function shortcutMatch(input,composing,ignoreSession){
    // shortcuts are global (VAULT_STATE.shortcuts), so the new-session box can complete them
    // even with no active session selected — ignoreSession skips the cur gate for that input.
    if(!input || (!cur && !ignoreSession) || composing || document.activeElement!==input) return null;
    var value=String(input.value||'');
    var start=typeof input.selectionStart==='number' ? input.selectionStart : value.length;
    var end=typeof input.selectionEnd==='number' ? input.selectionEnd : start;
    if(!value || start!==end || end!==value.length) return null;
    var best=null,items=composerTextItems('shortcuts',cur);
    for(var i=0;i<items.length;i++){
      var item=items[i];
      var text=String(item&&item.text||'');
      var max=Math.min(value.length,text.length);
      // Require at least a 2-char match before suggesting: a single typed
      // character matches almost anything and just adds noise.
      var minimum=best ? best.length : 1;
      for(var length=max;length>minimum;length--){
        if(value.slice(value.length-length)===text.slice(0,length)){
          best={text:text,length:length};
          break;
        }
      }
    }
    return best;
  }
  function composerShortcutMatch(input){ return shortcutMatch(input,composerShortcutComposing); }
  function composerNextStepMatch(input){
    if(!input || composerShortcutComposing) return null;
    if(String(input.value||'')!=='') return null;
    var text=nextStepText(cur);
    return text ? {text:text,length:0} : null;
  }
  // Tab completion remains focus-gated. Rendering additionally consults
  // composerNextStepMatch so an empty, unfocused composer still shows Lane A.
  function composerCompletionMatch(input){
    if(!input || document.activeElement!==input || composerShortcutComposing) return null;
    return composerShortcutMatch(input)||composerNextStepMatch(input);
  }
  function composerGhostMatch(input){
    return composerCompletionMatch(input)||composerNextStepMatch(input);
  }
  function commentShortcutMatch(input){ return shortcutMatch(input,commentShortcutComposing); }
  function newShortcutMatch(input){ return shortcutMatch(input,newShortcutComposing,true); }
  function syncShortcutGhost(input,ghost,prefix,suffix,match){
    if(!input || !ghost) return;
    var scrollbarWidth=Math.max(0,input.offsetWidth-input.clientWidth);
    ghost.style.width='calc(100% - '+scrollbarWidth+'px)';
    var completion=match ? match.text.slice(match.length) : '';
    ghost.hidden=!completion;
    if(prefix) prefix.textContent=completion ? String(input.value||'') : '';
    if(suffix) suffix.textContent=completion;
    if(completion){ ghost.scrollTop=input.scrollTop; ghost.scrollLeft=input.scrollLeft; }
  }
  function syncComposerShortcutGhost(){
    var input=byId('input'),ghost=byId('composerShortcutGhost');
    var match=pinReferencePicker.open?null:composerGhostMatch(input);
    syncShortcutGhost(input,ghost,byId('composerShortcutGhostPrefix'),byId('composerShortcutGhostSuffix'),match);
    // Hide the native placeholder while the empty composer shows the nextStep ghost,
    // so the ghost text and the "message …" hint don't overlap.
    if(input) input.classList.toggle('nextstep-ghosting', !!(match && String(input.value||'')===''));
  }
  function syncCommentShortcutGhost(){
    var input=byId('commentInput'),ghost=byId('commentShortcutGhost');
    syncShortcutGhost(input,ghost,byId('commentShortcutGhostPrefix'),byId('commentShortcutGhostSuffix'),commentShortcutMatch(input));
  }
  function syncNewShortcutGhost(){
    var input=byId('np'),ghost=byId('newShortcutGhost');
    syncShortcutGhost(input,ghost,byId('newShortcutGhostPrefix'),byId('newShortcutGhostSuffix'),newShortcutMatch(input));
  }
  function completeShortcut(input,match){
    var completion=match ? match.text.slice(match.length) : '';
    if(!completion) return false;
    // Insert via execCommand so the browser keeps its native undo stack — a direct
    // input.value= assignment wipes it, leaving Ctrl+Z unable to revert the completion.
    input.focus();
    input.setSelectionRange(input.value.length,input.value.length);
    var inserted=false;
    try{ inserted=document.execCommand('insertText',false,completion); }catch(_e){ inserted=false; }
    if(!inserted){
      input.value=String(input.value||'')+completion;
      input.setSelectionRange(input.value.length,input.value.length);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }
    return true;
  }
  function completeComposerShortcut(input){ return completeShortcut(input,composerCompletionMatch(input)); }
  function completeCommentShortcut(input){ return completeShortcut(input,commentShortcutMatch(input)); }
  function completeNewShortcut(input){ return completeShortcut(input,newShortcutMatch(input)); }
  function completeInlineEditShortcut(input){ return completeShortcut(input,shortcutMatch(input,false)); }
  function startRailItemEdit(kind,id){
    composerRailEditing={kind:kind,id:id}; renderComposerRailPanel();
    setTimeout(function(){ var input=byId('railEditInput'); if(input){ input.focus(); input.select(); } },0);
  }
  function commitRailItemEdit(kind,id,text){
    text=String(text||'').trim();
    var items=composerTextItems(kind,cur).slice(),index=items.findIndex(function(item){return item.id===id;});
    if(index<0) return;
    if(!text){ items.splice(index,1); }
    else items[index]=Object.assign({},items[index],{text:text,updatedAt:Date.now()});
    composerRailEditing=null; persistComposerTextItems(kind,cur,items);
  }
  function deleteRailItem(kind,id){
    var items=composerTextItems(kind,cur).filter(function(item){return item.id!==id;});
    if(composerRailEditing&&composerRailEditing.id===id) composerRailEditing=null;
    persistComposerTextItems(kind,cur,items);
  }
  function restoreMovedRailItem(id,direction,scrollTop){
    var pop=byId('composerRailPop'),body=pop&&pop.querySelector('.railpop-body');
    if(body) body.scrollTop=scrollTop;
    var rows=pop ? pop.querySelectorAll('.rail-item') : [];
    for(var i=0;i<rows.length;i++){
      var row=rows[i];
      if(row.getAttribute('data-rail-item-id')!==String(id||'')) continue;
      var action=row.querySelector(direction<0?'.qmove-up':'.qmove-down');
      if(!action || action.disabled) action=row.querySelector(direction<0?'.qmove-down':'.qmove-up');
      if(!action) action=row.querySelector('.rail-item-text');
      if(action){ try{ action.focus({preventScroll:true}); }catch(e){ action.focus(); } }
      break;
    }
  }
  function moveRailItem(kind,id,direction){
    var items=composerTextItems(kind,cur).slice();
    var index=items.findIndex(function(item){return item.id===id;});
    var target=index+(direction<0?-1:1);
    if(index<0 || target<0 || target>=items.length) return;
    var pop=byId('composerRailPop'),body=pop&&pop.querySelector('.railpop-body'),scrollTop=body?body.scrollTop:0;
    var moved=items.splice(index,1)[0];
    items.splice(target,0,moved);
    persistComposerTextItems(kind,cur,items);
    restoreMovedRailItem(id,direction,scrollTop);
  }
  function toggleRailTodo(id,completed){
    var now=Date.now();
    var items=composerTextItems('todo',cur).map(function(item){
      return item.id===id ? Object.assign({},item,{completed:completed===true,updatedAt:now},completed?{completedAt:now}:{completedAt:undefined}) : item;
    });
    persistComposerTextItems('todo',cur,items);
  }
  function addRailItem(kind,text){
    text=String(text||'').trim(); if(!text) return;
    var now=Date.now(),item={id:makeUiTextId(kind),text:text,createdAt:now,updatedAt:now};
    if(kind==='todo') item.completed=false;
    var items=composerTextItems(kind,cur).slice(); items.push(item);
    persistComposerTextItems(kind,cur,items);
    setTimeout(function(){ var input=byId('railAddInput'); if(input) input.focus(); },0);
  }
  function resizeRailTextarea(input){
    var style=window.getComputedStyle(input);
    var minHeight=parseFloat(style.minHeight)||0;
    var maxHeight=parseFloat(style.maxHeight)||96;
    input.style.minHeight='0px';
    input.style.height='0px';
    var borderHeight=input.offsetHeight-input.clientHeight;
    var desiredHeight=input.scrollHeight+borderHeight;
    input.style.minHeight='';
    input.style.height=Math.max(minHeight,Math.min(desiredHeight,maxHeight))+'px';
    input.style.overflowY=desiredHeight>maxHeight?'auto':'hidden';
  }
  function bindRailTextarea(input,onEnter,onEscape,onInput){
    var composing=false;
    input.addEventListener('compositionstart',function(){ composing=true; });
    input.addEventListener('compositionend',function(){ composing=false; });
    function sync(){ resizeRailTextarea(input); if(onInput) onInput(); }
    input.addEventListener('input',sync);
    input.onkeydown=function(ev){
      if(composing||ev.isComposing||ev.keyCode===229){ ev.stopPropagation(); return; }
      if(ev.key==='Enter'&&!ev.shiftKey){ ev.preventDefault(); ev.stopPropagation(); onEnter(); }
      else if(ev.key==='Enter'){ ev.stopPropagation(); }
      else if(ev.key==='Escape'&&onEscape){ ev.preventDefault(); ev.stopPropagation(); onEscape(); }
    };
    setTimeout(sync,0);
  }
  function renderRailTextItem(host,kind,item,index,total){
    var row=el('div','rail-item'+(item.completed?' done':''));
    row.setAttribute('data-rail-item-id',String(item.id||''));
    if(kind==='todo'){
      var check=document.createElement('input'); check.type='checkbox'; check.className='rail-todo-check'; check.checked=item.completed===true;
      check.setAttribute('aria-label',(item.completed?'Reopen ':'Complete ')+item.text);
      check.onchange=function(){ toggleRailTodo(item.id,check.checked); };
      row.appendChild(check);
    }
    if(composerRailEditing&&composerRailEditing.kind===kind&&composerRailEditing.id===item.id){
      var edit=el('div','rail-item-edit'),input=document.createElement('textarea'); input.id='railEditInput'; input.rows=1; input.value=item.text;
      input.setAttribute('aria-keyshortcuts','Enter Shift+Enter Escape');
      var save=el('button','rail-item-edit-save','save'); save.type='button';
      var cancel=editCancelButton('Cancel edit (Esc)');
      function syncSave(){ save.disabled=!input.value.trim()||input.value===item.text; }
      function commit(){ if(!save.disabled) commitRailItemEdit(kind,item.id,input.value); }
      function closeEdit(){ composerRailEditing=null; renderComposerRailPanel(); }
      save.onclick=commit; cancel.onclick=closeEdit;
      edit.onkeydown=function(ev){ if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();closeEdit();} };
      bindRailTextarea(input,commit,closeEdit,syncSave);
      syncSave();
      edit.appendChild(input); edit.appendChild(save); edit.appendChild(cancel); row.appendChild(edit); host.appendChild(row); return;
    }
    var text=el('button','rail-item-text',item.text); text.type='button';
    if(kind==='shortcuts'){ text.title='Insert'; text.onclick=function(){ insertRailText(item.text); }; }
    else {
      // single click inserts into the composer; double-click opens edit. Debounce the
      // single-click so a double-click doesn't also fire (and insert) before editing.
      text.title='Click to insert · Double-click to edit';
      var clickTimer=null;
      text.onclick=function(){
        if(clickTimer) return;
        clickTimer=setTimeout(function(){ clickTimer=null; insertRailText(item.text); },220);
      };
      text.ondblclick=function(){
        if(clickTimer){ clearTimeout(clickTimer); clickTimer=null; }
        startRailItemEdit(kind,item.id);
      };
    }
    row.appendChild(text);
    if(kind==='shortcuts'){
      var order=el('span','rail-item-order'),moveLabel=String(item.text||'').slice(0,80);
      var up=el('button','qaction qmove qmove-up'); setIconButton(up,'up','Move shortcut up: '+moveLabel); up.disabled=index===0; up.onclick=function(){moveRailItem(kind,item.id,-1);}; order.appendChild(up);
      var down=el('button','qaction qmove qmove-down'); setIconButton(down,'down','Move shortcut down: '+moveLabel); down.disabled=index===total-1; down.onclick=function(){moveRailItem(kind,item.id,1);}; order.appendChild(down);
      row.appendChild(order);
      var editButton=el('button','qaction qedit'); setIconButton(editButton,'edit','Edit shortcut'); editButton.onclick=function(){startRailItemEdit(kind,item.id);}; row.appendChild(editButton);
    }
    var del=el('button','qaction qdel'); setIconButton(del,'delete','Delete '+(kind==='shortcuts'?'shortcut':kind==='notes'?'note':'todo')); del.onclick=function(){deleteRailItem(kind,item.id);}; row.appendChild(del);
    host.appendChild(row);
  }
  function renderRailTextPanel(pop,kind){
    var body=el('div','railpop-body'),items=composerTextItems(kind,cur).slice();
    if(kind==='todo') items.sort(function(a,b){return Number(a.completed)-Number(b.completed);});
    var list=el('div','rail-items');
    items.forEach(function(item,index){renderRailTextItem(list,kind,item,index,items.length);});
    if(items.length) body.appendChild(list);
    var add=el('div','rail-add'),input=document.createElement('textarea'); input.id='railAddInput'; input.rows=1;
    input.placeholder='Add '+(kind==='shortcuts'?'shortcut':kind==='notes'?'note':'todo')+'…';
    input.setAttribute('aria-keyshortcuts','Enter Shift+Enter Escape');
    var button=el('button',null,'add'); button.type='button';
    function syncAdd(){ button.disabled=!input.value.trim(); }
    function commit(){ if(button.disabled) return; var text=input.value; input.value=''; addRailItem(kind,text); }
    button.onclick=commit;
    bindRailTextarea(input,commit,closeComposerRail,syncAdd);
    syncAdd();
    add.appendChild(input); add.appendChild(button); body.appendChild(add); pop.appendChild(body);
  }
  function renderComposerRailPanel(){
    var pop=byId('composerRailPop'); if(!pop || !composerRailKind) return;
    pop.hidden=false; pop.className='railpop kind-'+composerRailKind; pop.innerHTML='';
    if(composerRailKind==='shortcuts'||composerRailKind==='notes'||composerRailKind==='todo'){
      renderRailTextPanel(pop,composerRailKind); alignComposerRailPanel(); return;
    }
    var body=el('div','railpop-body'); renderRailConfigOptions(body,composerRailKind); pop.appendChild(body);
    alignComposerRailPanel();
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
    var vendorOwned=id==='nmodel'||id==='rmodel'||id==='neffort'||id==='reffort'||id==='nspeed'||id==='rspeed';
    var list=vendorOwned ? (options||[]).slice() : optionListWithCurrent(options, current);
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
  var closeVendorChooser=null;
  var customSelectResizeObserver=window.ResizeObserver ? new ResizeObserver(function(){
    if(openCustomSelect) positionCustomSelectMenu(openCustomSelect);
  }) : null;
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
    var isModel=sel.id==='nmodel'||sel.id==='rmodel';
    ctrl.menu.innerHTML='';
    Array.prototype.forEach.call(sel.options || [], function(opt, idx){
      var fullText=opt.textContent || opt.value || '';
      var item=el('div','selectopt');
      item.setAttribute('role','option');
      item.setAttribute('data-value', opt.value);
      item.setAttribute('aria-selected', opt.selected ? 'true' : 'false');
      if(isModel && fullText) item.setAttribute('data-hover-tip',fullText);
      styleSelectTheme(item, customSelectTheme(sel, opt.value), opt.selected);
      item.appendChild(el('span','selectopt-label',fullText));
      if(opt.selected){
        var check=el('span','selectopt-check','✓'); check.setAttribute('aria-hidden','true'); item.appendChild(check);
      }
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
    var selectedText=selectedOptionText(sel) || '';
    ctrl.text.textContent=selectedText;
    if((sel.id==='nmodel'||sel.id==='rmodel') && selectedText) ctrl.button.setAttribute('data-hover-tip',selectedText);
    else ctrl.button.removeAttribute('data-hover-tip');
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
  function positionConfigMenu(anchor, menu, preferredRem){
    if(!anchor || !menu || menu.hidden) return false;
    var rect=anchor.getBoundingClientRect(),margin=10,gap=6;
    var host=anchor.closest('.newbox');
    if(host){
      var hostRect=host.getBoundingClientRect();
      if(rect.bottom<=hostRect.top || rect.top>=hostRect.bottom) return false;
    }
    var viewportWidth=window.innerWidth||document.documentElement.clientWidth;
    var viewportHeight=window.innerHeight||document.documentElement.clientHeight;
    var rootSize=parseFloat(window.getComputedStyle(document.documentElement).fontSize)||16;
    var preferredWidthPx=preferredRem*rootSize;
    var width=Math.min(Math.max(rect.width,preferredWidthPx),Math.max(0,viewportWidth-margin*2));
    menu.style.width=Math.round(width)+'px';
    var baseMax=Math.min(viewportHeight*0.38,18*rootSize);
    var below=Math.max(0,viewportHeight-rect.bottom-gap-margin);
    var above=Math.max(0,rect.top-gap-margin);
    var contentHeight=Math.min(menu.scrollHeight,baseMax);
    var openBelow=below>=contentHeight || below>=above;
    var available=openBelow?below:above;
    menu.style.maxHeight=Math.max(48,Math.min(baseMax,available))+'px';
    var menuHeight=menu.getBoundingClientRect().height;
    var left=Math.max(margin,Math.min(rect.left,viewportWidth-width-margin));
    var top=openBelow?rect.bottom+gap:rect.top-gap-menuHeight;
    top=Math.max(margin,Math.min(top,viewportHeight-menuHeight-margin));
    menu.style.left=Math.round(left)+'px';
    menu.style.top=Math.round(top)+'px';
    return true;
  }
  function positionCustomSelectMenu(ctrl){
    if(!ctrl || ctrl.menu.hidden) return;
    if(!positionConfigMenu(ctrl.button,ctrl.menu,ctrl.kind==='model'?10.5:6)) closeCustomSelect(ctrl);
  }
  function openCustomSelectMenu(ctrl){
    if(openCustomSelect && openCustomSelect!==ctrl) closeCustomSelect(openCustomSelect);
    syncCustomSelect(ctrl.select);
    ctrl.menu.hidden=false;
    ctrl.button.setAttribute('aria-expanded','true');
    openCustomSelect=ctrl;
    positionCustomSelectMenu(ctrl);
    var selected=ctrl.menu.querySelector('.selectopt[aria-selected="true"]');
    if(selected) selected.scrollIntoView({ block:'nearest' });
  }
  function enhanceCustomSelect(id){
    var sel=byId(id); if(!sel || sel._customSelect) return;
    sel.classList.add('is-enhanced');
    var wrap=el('div','selectwrap');
    var button=el('button','selectbtn');
    button.type='button';
    button.id=id+'Button';
    button.setAttribute('aria-haspopup','listbox');
    button.setAttribute('aria-expanded','false');
    var text=el('span','selecttxt');
    button.appendChild(text);
    var menuKind=id==='nmodel'?'model':(id==='neffort'?'effort':'speed');
    var menu=el('div','selectmenu configmenu kind-'+menuKind);
    menu.id=id+'Menu';
    menu.setAttribute('role','listbox');
    menu.setAttribute('aria-labelledby',button.id);
    button.setAttribute('aria-controls',menu.id);
    menu.hidden=true;
    wrap.appendChild(button);
    sel.insertAdjacentElement('afterend', wrap);
    document.body.appendChild(menu);
    var ctrl={ select:sel, wrap:wrap, button:button, text:text, menu:menu, kind:menuKind, active:0 };
    sel._customSelect=ctrl;
    if(customSelectResizeObserver) customSelectResizeObserver.observe(button);
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
      } else if(ev.key==='Escape' && !menu.hidden){ ev.preventDefault(); ev.stopPropagation(); closeCustomSelect(ctrl); }
    };
    sel.addEventListener('change', function(){ syncCustomSelect(sel); });
    syncCustomSelect(sel);
  }
  function setupCustomSelects(){
    ['nmodel','neffort','nspeed'].forEach(enhanceCustomSelect);
    // Both axes are per-model; Cursor also constrains them as an exact matrix.
    var nmodel=byId('nmodel'); if(nmodel) nmodel.addEventListener('change', syncNewConfigurationToModel);
    var neffort=byId('neffort'); if(neffort) neffort.addEventListener('change',syncNewEffortSelection);
    var nspeed=byId('nspeed'); if(nspeed) nspeed.addEventListener('change',syncNewSpeedSelection);
    var rmodel=byId('rmodel'); if(rmodel) rmodel.addEventListener('change', syncRunConfigurationToModel);
    var reffort=byId('reffort'); if(reffort) reffort.addEventListener('change', syncRunEffortSelection);
    var rspeed=byId('rspeed'); if(rspeed) rspeed.addEventListener('change', syncRunSpeedSelection);
    document.addEventListener('pointerdown', function(ev){
      if(openCustomSelect && !openCustomSelect.wrap.contains(ev.target) && !openCustomSelect.menu.contains(ev.target)) closeCustomSelect(openCustomSelect);
    });
    window.addEventListener('resize',function(){ if(openCustomSelect) positionCustomSelectMenu(openCustomSelect); });
    document.addEventListener('scroll',function(ev){
      if(!openCustomSelect || ev.target===openCustomSelect.menu) return;
      positionCustomSelectMenu(openCustomSelect);
    },true);
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
          .map(function(e){ return e.trim(); });
        if(efs.length) out.efforts=efs;
      }
      if(typeof opt.defaultEffort==='string' && opt.defaultEffort.trim()) out.defaultEffort=opt.defaultEffort.trim();
      if(opt.effortLabels && typeof opt.effortLabels==='object') out.effortLabels=opt.effortLabels;
      if(Array.isArray(opt.speeds)){
        var speeds=opt.speeds.filter(function(speed){ return typeof speed==='string' && speed.trim(); })
          .map(function(speed){ return speed.trim(); });
        if(speeds.length) out.speeds=speeds;
      }
      if(typeof opt.defaultSpeed==='string' && opt.defaultSpeed.trim()) out.defaultSpeed=opt.defaultSpeed.trim();
      if(opt.speedLabels && typeof opt.speedLabels==='object') out.speedLabels=opt.speedLabels;
      if(Array.isArray(opt.configurations)){
        var configurations=opt.configurations.filter(function(config){
          return config && typeof config.value==='string' && config.value.trim();
        }).map(function(config){
          var normalized={value:config.value.trim()};
          if(typeof config.effort==='string' && config.effort.trim()) normalized.effort=config.effort.trim();
          if(typeof config.speed==='string' && config.speed.trim()) normalized.speed=config.speed.trim();
          return normalized;
        });
        if(configurations.length) out.configurations=configurations;
      }
      return out;
    }) : [];
  }
  // Look up a specific model's vendor-advertised metadata, if any.
  function modelMetaFor(vendor, model){
    var slug=String(model||'').trim();
    if(!slug) return null;
    var src = vendor==='claude' ? CLAUDE_MODELS : (vendor==='codex' ? CODEX_MODELS : (vendor==='cursor' ? CURSOR_MODELS : null));
    if(!src) return null;
    var list=normalizedModelOptions(src);
    for(var i=0;i<list.length;i++){ if(list[i].value===slug) return list[i]; }
    return null;
  }
  function matrixAxisValues(meta, axis){
    var advertised=axis==='effort' ? (meta&&meta.efforts) : (meta&&meta.speeds);
    if(!Array.isArray(advertised)) return [];
    var configurations=meta&&meta.configurations;
    if(!Array.isArray(configurations) || !configurations.length) return advertised.slice();
    var allowed={};
    configurations.forEach(function(config){
      allowed[String(config[axis]||'')]=true;
    });
    return advertised.filter(function(value){ return allowed[String(value)]; });
  }
  function modelSupportsSpeed(vendor, model){
    return matrixAxisValues(modelMetaFor(vendor,model),'speed').length>0;
  }
  function populateSpeedSelect(id,vendor,model,effort,current,temporarilyDisabled){
    var supported=modelSupportsSpeed(vendor,model);
    populateSelect(id,supported ? speedOptionsFor(vendor,model,effort) : [{value:'',label:'—'}],supported ? current : '');
    var sel=byId(id); if(!sel) return;
    sel.disabled=!supported || temporarilyDisabled===true;
    syncCustomSelect(sel);
    var ctrl=sel._customSelect;
    if(ctrl&&ctrl.button){
      if(supported) ctrl.button.removeAttribute('title');
      else ctrl.button.title='Speed is unavailable for this model';
    }
  }
  // Choices come only from vendor-owned metadata. Changing either Cursor axis
  // cascades the other to an exact row in its configuration matrix.
  function effortOptionsFor(vendor, model, speed){
    var meta=modelMetaFor(vendor, model);
    var efforts=matrixAxisValues(meta,'effort');
    if(efforts.length){
      var defaultValue=defaultEffortValue(vendor,model);
      return optionsWithDefault(efforts.map(function(e){
        return { value:e, label:(meta.effortLabels && meta.effortLabels[e]) || e };
      }), efforts.indexOf(defaultValue)>=0 ? defaultValue : '', 'default');
    }
    return optionsWithDefault([], defaultEffortValue(vendor, model), 'default');
  }
  function speedOptionsFor(vendor, model, effort){
    var meta=modelMetaFor(vendor, model);
    var speeds=matrixAxisValues(meta,'speed');
    if(speeds.length){
      var defaultValue=defaultSpeedValue(vendor,model);
      return optionsWithDefault(speeds.map(function(speed){
        return { value:speed, label:(meta.speedLabels && meta.speedLabels[speed]) || speed };
      }), speeds.indexOf(defaultValue)>=0 ? defaultValue : '', 'default');
    }
    return optionsWithDefault([], defaultSpeedValue(vendor, model), 'default');
  }
  function defaultEffortFor(vendor, model){
    var meta=modelMetaFor(vendor, model);
    if(meta && meta.defaultEffort) return meta.defaultEffort;
    return '';
  }
  function defaultEffortValue(vendor, model){
    return defaultEffortFor(vendor, model) || cliDefault(vendor, 'effort');
  }
  function defaultSpeedFor(vendor, model){
    var meta=modelMetaFor(vendor, model);
    if(meta && meta.defaultSpeed) return meta.defaultSpeed;
    return '';
  }
  function defaultSpeedValue(vendor, model){
    var meta=modelMetaFor(vendor,model);
    if(meta && (!meta.speeds || !meta.speeds.length)) return '';
    return defaultSpeedFor(vendor, model) || cliDefault(vendor, 'speed');
  }
  function modelEffortKey(model){
    return String(model||'').trim() || '__current_cli_model__';
  }
  function rememberedModelEffort(vendor, model){
    var byVendor=newPrefs.modelEfforts && newPrefs.modelEfforts[vendor];
    var key=modelEffortKey(model);
    if(byVendor && Object.prototype.hasOwnProperty.call(byVendor, key)) return String(byVendor[key]||'').trim();
    // Backward compatibility with v1 preferences, which only remembered the last
    // new-session model+effort pair for each vendor.
    var legacy=newPrefs[vendor];
    if(legacy && String(legacy.model||'').trim()===String(model||'').trim()) return String(legacy.effort||'').trim();
    return undefined;
  }
  function rememberedModelSpeed(vendor, model){
    var byVendor=newPrefs.modelSpeeds && newPrefs.modelSpeeds[vendor];
    var key=modelEffortKey(model);
    if(byVendor && Object.prototype.hasOwnProperty.call(byVendor,key)) return String(byVendor[key]||'').trim();
    var legacy=newPrefs[vendor];
    if(legacy && String(legacy.model||'').trim()===String(model||'').trim()) return String(legacy.speed||'').trim();
    return undefined;
  }
  function modelConfigurationFor(vendor,model,effort,speed,preferredAxis){
    var meta=modelMetaFor(vendor,model),configurations=meta&&meta.configurations;
    var wantEffort=String(effort||defaultEffortValue(vendor,model)||'').trim();
    var wantSpeed=String(speed||defaultSpeedValue(vendor,model)||'').trim();
    if(Array.isArray(configurations) && configurations.length){
      function exact(config){ return String(config.effort||'')===wantEffort && String(config.speed||'')===wantSpeed; }
      var selected=configurations.filter(exact)[0];
      if(!selected && preferredAxis==='effort' && wantEffort){
        selected=configurations.filter(function(config){ return String(config.effort||'')===wantEffort; })[0];
      }
      if(!selected && preferredAxis==='speed' && wantSpeed){
        selected=configurations.filter(function(config){ return String(config.speed||'')===wantSpeed; })[0];
      }
      if(!selected){
        var defaultEffort=String(defaultEffortValue(vendor,model)||'');
        var defaultSpeed=String(defaultSpeedValue(vendor,model)||'');
        selected=configurations.filter(function(config){
          return String(config.effort||'')===defaultEffort && String(config.speed||'')===defaultSpeed;
        })[0] || configurations[0];
      }
      return {effort:String(selected.effort||''),speed:String(selected.speed||'')};
    }
    return {
      effort:safeEffort(vendor,model,wantEffort,wantSpeed)||defaultEffortValue(vendor,model),
      speed:safeSpeed(vendor,model,wantSpeed,wantEffort)||defaultSpeedValue(vendor,model)
    };
  }
  function linkedModelConfigurationFor(vendor,model){
    return modelConfigurationFor(vendor,model,rememberedModelEffort(vendor,model),rememberedModelSpeed(vendor,model));
  }
  function linkedEffortFor(vendor, model){ return linkedModelConfigurationFor(vendor,model).effort; }
  function linkedSpeedFor(vendor, model){ return linkedModelConfigurationFor(vendor,model).speed; }
  function rememberModelConfiguration(vendor, model, effort, speed){
    vendor=String(vendor||'').trim().toLowerCase();
    if(!vendor) return;
    // Keep the most recently used tuple per vendor and per-model histories.
    newPrefs[vendor]={ model:String(model||'').trim(), effort:String(effort||'').trim(), speed:String(speed||'').trim() };
    if(!newPrefs.modelEfforts || typeof newPrefs.modelEfforts!=='object') newPrefs.modelEfforts={};
    if(!newPrefs.modelEfforts[vendor] || typeof newPrefs.modelEfforts[vendor]!=='object') newPrefs.modelEfforts[vendor]={};
    newPrefs.modelEfforts[vendor][modelEffortKey(model)]=String(effort||'').trim();
    if(!newPrefs.modelSpeeds || typeof newPrefs.modelSpeeds!=='object') newPrefs.modelSpeeds={};
    if(!newPrefs.modelSpeeds[vendor] || typeof newPrefs.modelSpeeds[vendor]!=='object') newPrefs.modelSpeeds[vendor]={};
    newPrefs.modelSpeeds[vendor][modelEffortKey(model)]=String(speed||'').trim();
    saveNewPrefs();
  }
  function claudeModelOptions(){
    var dynamic = normalizedModelOptions(CLAUDE_MODELS);
    return optionsWithDefault(dynamic, cliDefault('claude', 'model'), 'CLI default');
  }
  function codexModelOptions(){
    var dynamic = normalizedModelOptions(CODEX_MODELS);
    return optionsWithDefault(dynamic, cliDefault('codex', 'model'), 'CLI default');
  }
  function cursorModelOptions(){
    var dynamic = normalizedModelOptions(CURSOR_MODELS);
    return optionsWithDefault(dynamic, cliDefault('cursor', 'model'), 'CLI default');
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
      var linked=linkedModelConfigurationFor('claude',nmodel);
      refreshNewConfigurationOptions(linked.effort,linked.speed);
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
      var linked=linkedModelConfigurationFor('codex',nmodel);
      refreshNewConfigurationOptions(linked.effort,linked.speed);
    }
    var rvendor=String((byId('rvendor')||{}).value||'').trim().toLowerCase();
      if(rvendor==='codex' && runPopOpen()) refreshRunConfigControls(false);
  }
  function applyCursorModelSnapshot(models){
    var next=normalizedModelOptions(models);
    if(!next.length) return;
    if(JSON.stringify(next)===JSON.stringify(normalizedModelOptions(CURSOR_MODELS))) return;
    CURSOR_MODELS=next;
    var nvendor=((byId('nvendor')||{}).value||'').trim().toLowerCase();
    if(nvendor==='cursor'){
      var nmodel=selectedNewModel();
      populateSelect('nmodel', modelOptionsFor('cursor'), nmodel);
      var linked=linkedModelConfigurationFor('cursor',nmodel);
      refreshNewConfigurationOptions(linked.effort,linked.speed);
    }
    var rvendor=String((byId('rvendor')||{}).value||'').trim().toLowerCase();
    if(rvendor==='cursor' && runPopOpen()) refreshRunConfigControls(false);
  }
  function syncModelWarnings(){
    var nvendor=String((byId('nvendor')||{}).value||'').toLowerCase();
    var nmessage=String(MODEL_WARNINGS[nvendor]||'').trim();
    var nwarning=byId('nmodelWarning');
    if(nwarning){ nwarning.textContent=nmessage; nwarning.hidden=!nmessage; }
    var rvendor=String((byId('rvendor')||{}).value||'').toLowerCase();
    var rmessage=String(MODEL_WARNINGS[rvendor]||'').trim();
    var rwarning=byId('rmodelWarning');
    if(rwarning){ rwarning.textContent=rmessage; rwarning.hidden=!rmessage; }
  }
  function applyModelWarning(vendor, warning){
    MODEL_WARNINGS[vendor]=typeof warning==='string' ? warning : '';
    syncModelWarnings();
  }
  function applyModelDefaults(vendor, defaults){
    if(!defaults || typeof defaults!=='object') return;
    var before=JSON.stringify(MODEL_DEFAULTS[vendor]||{});
    MODEL_DEFAULTS[vendor]=defaults;
    if(before===JSON.stringify(defaults)) return;
    var nvendor=String((byId('nvendor')||{}).value||'').trim().toLowerCase();
    if(nvendor===vendor){
      var nmodel=selectedNewModel();
      populateSelect('nmodel', modelOptionsFor(vendor), nmodel);
      refreshNewConfigurationOptions(selectedNewEffort(),selectedNewSpeed());
    }
    var rvendor=String((byId('rvendor')||{}).value||'').trim().toLowerCase();
    if(rvendor===vendor && runPopOpen()) refreshRunConfigControls(false);
    refreshRunConfigButton();
  }
  function refreshClaudeModels(){
    fetch('/models/claude', { cache:'no-store' }).then(function(r){ return r.json(); }).then(function(res){
      applyModelWarning('claude', res && res.warning);
      applyModelDefaults('claude', res && res.defaults);
      applyClaudeModelSnapshot(res && res.models);
    }).catch(function(){});
  }
  function refreshCodexModels(){
    fetch('/models/codex', { cache:'no-store' }).then(function(r){ return r.json(); }).then(function(res){
      applyModelWarning('codex', res && res.warning);
      applyModelDefaults('codex', res && res.defaults);
      applyCodexModelSnapshot(res && res.models);
    }).catch(function(){});
  }
  function refreshCursorModels(){
    fetch('/models/cursor', { cache:'no-store' }).then(function(r){ return r.json(); }).then(function(res){
      applyModelWarning('cursor', res && res.warning);
      applyModelDefaults('cursor', res && res.defaults);
      applyCursorModelSnapshot(res && res.models);
    }).catch(function(){});
  }
  function modelOptionsFor(vendor){
    if(vendor==='claude') return claudeModelOptions();
    if(vendor==='codex') return codexModelOptions();
    if(vendor==='cursor') return cursorModelOptions();
    return optionsWithDefault([], cliDefault(vendor, 'model'), 'CLI default');
  }
  function applyNewSessionPrefs(force){
    var vendor=((byId('nvendor')||{}).value||'').trim().toLowerCase();
    if(!vendorInfo(vendor)) return;
    if(!force && appliedNewVendor===vendor) return;
    var remembered=newPrefs[vendor] || {};
    var rememberedModel=String(remembered.model||'').trim() || cliDefault(vendor, 'model');
    populateSelect('nmodel', modelOptionsFor(vendor), rememberedModel);
    var linked=linkedModelConfigurationFor(vendor,rememberedModel);
    refreshNewConfigurationOptions(linked.effort,linked.speed);
    appliedNewVendor=vendor;
    syncModelWarnings();
  }
  // Repopulate both axes as one valid vendor-owned configuration.
  function refreshNewConfigurationOptions(preferredEffort,preferredSpeed,preferredAxis){
    var vendor=((byId('nvendor')||{}).value||'').trim().toLowerCase();
    var model=selectedNewModel();
    var wantEffort=preferredEffort!==undefined ? preferredEffort : selectedNewEffort();
    var wantSpeed=preferredSpeed!==undefined ? preferredSpeed : selectedNewSpeed();
    var selected=modelConfigurationFor(vendor,model,wantEffort,wantSpeed,preferredAxis);
    populateSelect('neffort',effortOptionsFor(vendor,model,selected.speed),selected.effort);
    populateSpeedSelect('nspeed',vendor,model,selected.effort,selected.speed,newSessionPending);
  }
  function syncNewConfigurationToModel(){
    var vendor=((byId('nvendor')||{}).value||'').trim().toLowerCase();
    var model=selectedNewModel();
    var linked=linkedModelConfigurationFor(vendor,model);
    refreshNewConfigurationOptions(linked.effort,linked.speed);
  }
  function syncNewEffortSelection(){ refreshNewConfigurationOptions(selectedNewEffort(),selectedNewSpeed(),'effort'); }
  function syncNewSpeedSelection(){ refreshNewConfigurationOptions(selectedNewEffort(),selectedNewSpeed(),'speed'); }
  function rememberNewSessionPrefs(vendor, model, effort, speed){
    if(!vendor) return;
    newPrefs.vendor=vendor;
    newPrefs[vendor]={ model:model||'', effort:effort||'', speed:speed||'' };
    rememberModelConfiguration(vendor, model, effort, speed);
  }
  function selectedNewModel(){
    var sel=byId('nmodel');
    return sel && sel.value ? sel.value.trim() : '';
  }
  function selectedNewEffort(){
    var sel=byId('neffort');
    return sel && sel.value ? sel.value.trim() : '';
  }
  function selectedNewSpeed(){
    var sel=byId('nspeed');
    return sel && sel.value ? sel.value.trim() : '';
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
  function safeEffort(vendor, model, effort, speed){
    var want=String(effort||'').trim();
    if(!want) return '';
    var opts=effortOptionsFor(vendor, model, speed);
    return opts.some(function(opt){ return opt.value===want; }) ? want : '';
  }
  function safeSpeed(vendor,model,speed,effort){
    var want=String(speed||'').trim();
    if(!want) return '';
    var opts=speedOptionsFor(vendor,model,effort);
    return opts.some(function(opt){ return opt.value===want; }) ? want : '';
  }
  function currentForkDefaults(){
    var vendor=(cur&&(cur.runVendor||cur.vendor))||'claude';
    var model=String((cur&&(cur.runModel!==undefined ? cur.runModel : cur.model))||'').trim();
    var selected=modelConfigurationFor(
      vendor,
      model,
      (cur&&(cur.runEffort!==undefined ? cur.runEffort : cur.effort))||linkedEffortFor(vendor,model),
      (cur&&(cur.runSpeed!==undefined ? cur.runSpeed : cur.speed))||linkedSpeedFor(vendor,model)
    );
    return {
      vendor:vendor,
      model:model,
      effort:selected.effort,
      speed:selected.speed
    };
  }
  function currentRunDisplayConfig(selected){
    selected=selected||currentForkDefaults();
    if(!cur) return {vendor:selected.vendor,model:'',effort:'',speed:''};
    var staged=cur.runConfigDirty===true || (cur.runVendor!==undefined && cur.runVendor!==cur.vendor);
    if(staged) return selected;
    return {
      vendor:selected.vendor,
      model:String(cur.model||'').trim(),
      effort:String(cur.effort||'').trim(),
      speed:String(cur.speed||'').trim()
    };
  }
  function runConfigLabel(s){
    if(!s) return 'model · effort · speed';
    var config=currentRunDisplayConfig(currentForkDefaults());
    return (config.model || 'unknown')+' · '+
      (config.effort || 'unknown')+' · '+
      (config.speed || 'unknown');
  }
  function canConfigureRun(){
    var info=cur&&vendorInfo(cur.vendor);
    return !!(cur && cur.sessionId && info && info.available && info.chat!==false && !cur.pendingNew && !cur.pendingFork);
  }
  function refreshRunConfigButton(){
    renderComposerRail();
    refreshGoalToggle();
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
    var keep=!changedVendor && vendor===defaults.vendor;
    var recent=newPrefs[vendor] || {};
    var model=(keep ? defaults.model : String(recent.model||'').trim()) || cliDefault(vendor, 'model');
    var linked=keep ? {effort:defaults.effort,speed:defaults.speed} : linkedModelConfigurationFor(vendor,model);
    populateSelect('rmodel', modelOptionsFor(vendor), model);
    refreshRunConfigurationOptions(linked.effort,linked.speed);
    syncCustomSelect(byId('rvendor'));
    syncModelWarnings();
    setRunMsg(vendor===cur.vendor ? 'Send continues this session; Fork creates a new branch.' : 'Vendor changed: Send is unavailable. Use Fork to create a '+vendor+' branch.', false);
  }
  function refreshRunConfigurationOptions(preferredEffort,preferredSpeed,preferredAxis){
    var vendor=String((byId('rvendor')||{}).value || (cur&&cur.vendor) || 'claude').trim().toLowerCase();
    var model=String((byId('rmodel')||{}).value || '').trim();
    var wantEffort=preferredEffort!==undefined ? preferredEffort : String((byId('reffort')||{}).value || '');
    var wantSpeed=preferredSpeed!==undefined ? preferredSpeed : String((byId('rspeed')||{}).value || '');
    var selected=modelConfigurationFor(vendor,model,wantEffort,wantSpeed,preferredAxis);
    populateSelect('reffort',effortOptionsFor(vendor,model,selected.speed),selected.effort);
    populateSpeedSelect('rspeed',vendor,model,selected.effort,selected.speed,false);
  }
  function syncRunConfigurationToModel(){
    var vendor=String((byId('rvendor')||{}).value || (cur&&cur.vendor) || 'claude').trim().toLowerCase();
    var model=String((byId('rmodel')||{}).value || '').trim();
    var linked=linkedModelConfigurationFor(vendor,model);
    refreshRunConfigurationOptions(linked.effort,linked.speed);
    applyRunConfig();
  }
  function syncRunEffortSelection(){
    refreshRunConfigurationOptions(String((byId('reffort')||{}).value||''),String((byId('rspeed')||{}).value||''),'effort');
    applyRunConfig();
  }
  function syncRunSpeedSelection(){
    refreshRunConfigurationOptions(String((byId('reffort')||{}).value||''),String((byId('rspeed')||{}).value||''),'speed');
    applyRunConfig();
  }
  function selectedRunConfig(){
    return {
      vendor:String((byId('rvendor')||{}).value || '').trim().toLowerCase(),
      model:String((byId('rmodel')||{}).value || '').trim(),
      effort:String((byId('reffort')||{}).value || '').trim(),
      speed:String((byId('rspeed')||{}).value || '').trim()
    };
  }
  function setRunMsg(msg, isErr){
    var node=byId('runMsg'); if(!node) return;
    node.textContent=msg||'';
    node.className='forkmsg'+(isErr?' err':'');
  }
  function runPopOpen(){ return composerRailKind==='vendor'||composerRailKind==='model'||composerRailKind==='effort'||composerRailKind==='speed'; }
  function closeRunPop(){ if(runPopOpen()) closeComposerRail(); }
  function openRunPop(){
    openComposerRail('model');
  }
  function applyRunConfig(){
    if(!cur || !canConfigureRun()) return;
    var config=selectedRunConfig();
    cur.runVendor=config.vendor;
    cur.runModel=config.model;
    cur.runEffort=config.effort;
    cur.runSpeed=config.speed;
    if(config.vendor===cur.vendor){
      cur.model=config.model;
      cur.effort=config.effort;
      cur.speed=config.speed;
      cur.runConfigDirty=true;
    } else cur.runConfigDirty=false;
    rememberModelConfiguration(config.vendor, config.model, config.effort, config.speed);
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
    if(!choice || !choice.value) return false;
    var key=dirChoiceKey(choice.value);
    if(!key || seen[key]) return false;
    seen[key]=true;
    out.push(choice);
    return true;
  }
  function dirChoices(q, remoteHits){
    var query=String(q||'').trim().toLowerCase();
    var out=[], seen={}, recentCount=0;
    function addChoice(choice){
      if(choice && choice.source==='recent' && recentCount>=DIR_RECENT_LIMIT) return;
      if(addDirChoice(out, seen, choice) && choice.source==='recent') recentCount++;
    }
    DIRS.filter(function(dir){
      if(!query) return true;
      var abs=String(dir||'').toLowerCase();
      var rel=dirDisplayLabel(dir).toLowerCase();
      return abs.indexOf(query)>=0 || rel.indexOf(query)>=0 || basename(dir).toLowerCase().indexOf(query)>=0;
    }).forEach(function(dir){
      addChoice(dirChoiceFromPath(dir, 'recent'));
    });
    (remoteHits||[]).forEach(addChoice);
    return out.slice(0, DIR_SUGGEST_LIMIT);
  }
  function rememberRecentDir(dir){
    var value=String(dir||'').trim(); if(!value) return;
    var key=dirChoiceKey(value);
    DIRS=[value].concat(DIRS.filter(function(item){ return dirChoiceKey(item)!==key; }));
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
  function resetNewSessionDir(lastDir){
    var input=byId('ndir');
    if(!input) return;
    input.value=String(lastDir||DEFAULT_NEW_DIR||ROOTS[0]||'');
    // A reset value is a selection, not a filter — keep the recent list showing
    // every process-level recent directory (see markDirSelection in setupDirChooser).
    input.setAttribute('data-dir-selection','1');
    applyDirChooserTheme(input.value);
  }
  function setupVendorChooser(){
    var input=byId('nvendor'), drop=byId('nvendorSug');
    if(!input || !drop) return;
    document.body.appendChild(drop);
    drop.classList.add('configmenu','vendor-portal','kind-vendor');
    drop.setAttribute('role','listbox');
    input.setAttribute('role','combobox');
    input.setAttribute('aria-autocomplete','both');
    input.setAttribute('aria-controls',drop.id);
    input.setAttribute('aria-expanded','false');
    var active=-1;
    function items(){ return drop.querySelectorAll('.chooser-opt'); }
    function hide(){ active=-1; drop.hidden=true; input.setAttribute('aria-expanded','false'); }
    function positionDrop(){ if(!drop.hidden && !positionConfigMenu(input,drop,8.5)) hide(); }
    closeVendorChooser=hide;
    function choose(vendor, keepOpenUntilClick){
      var info=vendorInfo(vendor);
      if(info && !info.available){
        var message=byId('nmsg');
        if(message){ message.className='nmsg'; message.removeAttribute('role'); message.textContent=info.message||info.vendor+' CLI is unavailable.'; }
        return;
      }
      input.value=vendor||'';
      applyVendorChooserTheme(input.value);
      applyNewSessionPrefs(true);
      refreshNewGoalToggle();
      if(keepOpenUntilClick) window.setTimeout(hide, 0);
      else hide();
    }
    function render(open, query){
      var hits=vendorChoices(query==null ? input.value : query);
      drop.innerHTML='';
      hits.forEach(function(info){
        var selected=info.vendor===input.value.trim().toLowerCase();
        var opt=el('div','chooser-opt'+(info.available?'':' unavailable')+(selected?' selected':''));
        // Unavailable rows stay actionable so a click/Enter can explain how to
        // install or update the CLI; only actual choices participate as options.
        if(info.available) opt.setAttribute('role','option');
        opt.setAttribute('data-value', info.vendor);
        opt.setAttribute('aria-disabled',info.available?'false':'true');
        opt.setAttribute('aria-selected',selected?'true':'false');
        opt.title=!info.available ? (info.message||info.vendor+' CLI is unavailable.') : info.chat===false ? info.vendor+' opens a real terminal session' : info.vendor+' starts in-browser chat';
        styleSelectTheme(opt, vendorTheme(info.vendor), false);
        var line=el('div','chooser-opt-line');
        var label=el('div','chooser-opt-label', info.vendor);
        line.appendChild(el('span','chooser-vendor-mark'));
        line.appendChild(label);
        if(!info.available) line.appendChild(el('span','chooser-opt-note','unavailable'));
        else if(info.chat===false) line.appendChild(el('span','chooser-opt-note','terminal'));
        if(selected){ var check=el('span','selectopt-check','✓'); check.setAttribute('aria-hidden','true'); line.appendChild(check); }
        opt.appendChild(line);
        if(!info.available) opt.appendChild(el('div','chooser-opt-meta',info.message||info.vendor+' CLI is unavailable.'));
        opt.onmousedown=function(ev){ ev.preventDefault(); ev.stopPropagation(); };
        opt.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); choose(info.vendor); };
        drop.appendChild(opt);
      });
      if(!hits.length) drop.appendChild(el('div','chooser-empty','No vendors match'));
      drop.hidden = !open && !hits.length;
      if(open) drop.hidden=false;
      input.setAttribute('aria-expanded',drop.hidden?'false':'true');
      positionDrop();
      if(active>=items().length) active=items().length-1;
      Array.prototype.forEach.call(items(), function(node, idx){ node.classList.toggle('on', idx===active); });
    }
    input.addEventListener('click', function(ev){ ev.stopPropagation(); render(true, ''); });
    input.addEventListener('focus', function(){ render(true, ''); });
    input.addEventListener('input', function(){ active=-1; applyVendorChooserTheme(input.value); refreshNewGoalToggle(); render(true, input.value); });
    input.addEventListener('keydown', function(ev){
      if(isImeConfirming(ev)) return;
      var opts=items(), n=opts.length;
      if(ev.key==='ArrowDown'){ ev.preventDefault(); render(true, drop.hidden ? '' : input.value); opts=items(); n=opts.length; if(n){ active=(active+1)%n; Array.prototype.forEach.call(opts, function(node, idx){ node.classList.toggle('on', idx===active); }); } }
      else if(ev.key==='ArrowUp'){ ev.preventDefault(); render(true, drop.hidden ? '' : input.value); opts=items(); n=opts.length; if(n){ active=(active-1+n)%n; Array.prototype.forEach.call(opts, function(node, idx){ node.classList.toggle('on', idx===active); }); } }
      else if(ev.key==='Enter'){ var val=input.value.trim(); var info=vendorInfo(val); if(!val) return; if(n && active>=0 && opts[active]) choose(opts[active].getAttribute('data-value')); else if(info) choose(info.vendor); }
      else if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); hide(); }
    });
    input.addEventListener('blur', function(){ var info=vendorInfo(input.value.trim()); if(info) choose(info.vendor); else applyVendorChooserTheme(input.value); });
    drop.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
    drop.addEventListener('click', function(ev){ ev.stopPropagation(); });
    function insideChooser(target){ var box=byId('nvendorBox'); return !!((box&&box.contains(target)) || drop.contains(target)); }
    document.addEventListener('pointerdown', function(ev){ if(insideChooser(ev.target)) return; hide(); });
    document.addEventListener('click', function(ev){ if(insideChooser(ev.target)) return; hide(); });
    window.addEventListener('resize',positionDrop);
    window.addEventListener('scroll',positionDrop,true);
    if(window.ResizeObserver) new ResizeObserver(positionDrop).observe(input);
    var remembered=vendorInfo(newPrefs.vendor);
    var first=(remembered&&remembered.available?remembered:null) || vendorChoices('')[0];
    if(first) choose(first.vendor);
  }
  function setupDirChooser(){
    var input=byId('ndir'), drop=byId('ndirSug');
    if(!input || !drop) return;
    document.body.appendChild(drop);
    drop.classList.add('dir-portal');
    var active=-1;
    var wantsOpen=false;
    var remoteQuery=null;
    var remoteHits=[];
    var remoteLoading=false;
    var remoteSeq=0;
    var remoteTimer=null;
    // The field is prefilled with a selected dir (the most recently used one).
    // A selected value must NOT filter the recent list — otherwise a multi-root
    // Attend process only shows recents matching the prefilled dir. Treat the
    // value as a filter query only once the user actually types. Stored on the
    // element so resetNewSessionDir (outside this closure) can re-mark it.
    function markDirSelection(on){ if(on) input.setAttribute('data-dir-selection','1'); else input.removeAttribute('data-dir-selection'); }
    function currentQuery(){ return input.getAttribute('data-dir-selection')==='1' ? '' : input.value; }
    function items(){ return drop.querySelectorAll('.chooser-opt'); }
    function hide(){ wantsOpen=false; active=-1; drop.hidden=true; }
    function positionDrop(){
      if(drop.hidden) return;
      var rect=input.getBoundingClientRect();
      var viewportH=window.innerHeight||document.documentElement.clientHeight||0;
      var gap=4, desired=240;
      var below=Math.max(0,viewportH-rect.bottom-gap-8);
      var above=Math.max(0,rect.top-gap-8);
      var openAbove=below<Math.min(160,desired) && above>below;
      var available=openAbove ? above : below;
      drop.style.left=Math.round(rect.left)+'px';
      drop.style.width=Math.round(rect.width)+'px';
      drop.style.maxHeight=Math.max(48,Math.min(desired,available))+'px';
      if(openAbove){
        drop.style.top='auto';
        drop.style.bottom=Math.round(viewportH-rect.top+gap)+'px';
      } else {
        drop.style.top=Math.round(rect.bottom+gap)+'px';
        drop.style.bottom='auto';
      }
    }
    function choose(dir, keepOpenUntilClick){
      input.value=dir||'';
      markDirSelection(true);
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
      positionDrop();
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
            if(wantsOpen) render(true, currentQuery());
          })
          .catch(function(){
            if(seq!==remoteSeq) return;
            remoteQuery=q;
            remoteHits=[];
            remoteLoading=false;
            if(wantsOpen) render(true, currentQuery());
          });
      }, q.trim() ? 90 : 0);
    }
    input.addEventListener('click', function(ev){ ev.stopPropagation(); });
    input.addEventListener('focus', function(){ wantsOpen=true; render(true, currentQuery()); requestSuggestions(currentQuery()); });
    input.addEventListener('input', function(){ wantsOpen=true; active=-1; markDirSelection(false); applyDirChooserTheme(input.value); render(true, input.value); requestSuggestions(input.value); });
    input.addEventListener('keydown', function(ev){
      if(isImeConfirming(ev)) return;
      var opts=items(), n=opts.length;
      if(ev.key==='ArrowDown'){ ev.preventDefault(); wantsOpen=true; render(true, currentQuery()); requestSuggestions(currentQuery()); opts=items(); n=opts.length; if(n){ active=(active+1)%n; Array.prototype.forEach.call(opts, function(node, idx){ node.classList.toggle('on', idx===active); }); } }
      else if(ev.key==='ArrowUp'){ ev.preventDefault(); wantsOpen=true; render(true, currentQuery()); requestSuggestions(currentQuery()); opts=items(); n=opts.length; if(n){ active=(active-1+n)%n; Array.prototype.forEach.call(opts, function(node, idx){ node.classList.toggle('on', idx===active); }); } }
      else if(ev.key==='Enter' && n && active>=0 && opts[active]){ ev.preventDefault(); choose(opts[active].getAttribute('data-value')); }
      else if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); hide(); }
    });
    drop.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
    drop.addEventListener('click', function(ev){ ev.stopPropagation(); });
    function insideChooser(target){
      var box=byId('ndirBox');
      return !!((box&&box.contains(target)) || drop.contains(target));
    }
    document.addEventListener('pointerdown', function(ev){ if(insideChooser(ev.target)) return; hide(); });
    document.addEventListener('click', function(ev){ if(insideChooser(ev.target)) return; hide(); });
    window.addEventListener('resize', positionDrop);
    window.addEventListener('scroll', positionDrop, true);
    if(DEFAULT_NEW_DIR) choose(DEFAULT_NEW_DIR);
  }
  var hoverTipAnchor=null;
  var hoverTipTimer=null;
  var HOVER_TIP_DELAY_MS=80;
  function hoverTipRoot(){ return byId('hoverTip'); }
  function normalizeHoverTitle(node){
    if(!node || node.nodeType!==1 || !node.hasAttribute('title')) return;
    var value=String(node.getAttribute('title')||'').trim();
    node.removeAttribute('title');
    if(value) node.setAttribute('data-hover-tip',value);
    else node.removeAttribute('data-hover-tip');
  }
  function normalizeHoverTitles(root){
    if(!root || root.nodeType!==1) return;
    normalizeHoverTitle(root);
    if(root.querySelectorAll) Array.prototype.forEach.call(root.querySelectorAll('[title]'),normalizeHoverTitle);
  }
  function hideHoverTip(){
    if(hoverTipTimer){ clearTimeout(hoverTipTimer); hoverTipTimer=null; }
    hoverTipAnchor=null;
    var tip=hoverTipRoot(); if(!tip) return;
    tip.classList.remove('show');
    tip.hidden=true;
  }
  function positionHoverTip(anchor, ev){
    var tip=hoverTipRoot(); if(!tip || !anchor) return;
    var pad=10, rect=anchor.getBoundingClientRect();
    var x=ev&&Number.isFinite(ev.clientX) ? ev.clientX+12 : rect.left;
    var y=ev&&Number.isFinite(ev.clientY) ? ev.clientY+16 : rect.bottom+7;
    var tw=tip.offsetWidth||180, th=tip.offsetHeight||32;
    if(x+tw>window.innerWidth-pad) x=window.innerWidth-tw-pad;
    if(y+th>window.innerHeight-pad) y=Math.max(pad,rect.top-th-7);
    tip.style.left=Math.max(pad,x)+'px';
    tip.style.top=Math.max(pad,y)+'px';
  }
  function queueHoverTip(anchor, ev){
    var tip=hoverTipRoot();
    if(!tip || !anchor) return;
    var value=String(anchor.getAttribute('data-hover-tip')||'').trim();
    if(!value) return;
    if(hoverTipTimer) clearTimeout(hoverTipTimer);
    hoverTipAnchor=anchor;
    hoverTipTimer=setTimeout(function(){
      hoverTipTimer=null;
      if(hoverTipAnchor!==anchor || !anchor.isConnected) return;
      tip.textContent=value;
      tip.hidden=false;
      positionHoverTip(anchor,ev);
      requestAnimationFrame(function(){ if(hoverTipAnchor===anchor) tip.classList.add('show'); });
    },HOVER_TIP_DELAY_MS);
  }
  function setupHoverTips(){
    normalizeHoverTitles(document.body);
    document.addEventListener('pointerover',function(ev){
      var anchor=ev.target&&ev.target.closest&&ev.target.closest('[data-hover-tip]');
      if(!anchor || (ev.relatedTarget&&anchor.contains(ev.relatedTarget))) return;
      queueHoverTip(anchor,ev);
    });
    document.addEventListener('pointermove',function(ev){ if(hoverTipAnchor) positionHoverTip(hoverTipAnchor,ev); });
    document.addEventListener('pointerout',function(ev){
      if(!hoverTipAnchor || (ev.relatedTarget&&hoverTipAnchor.contains(ev.relatedTarget))) return;
      hideHoverTip();
    });
    document.addEventListener('focusin',function(ev){ var anchor=ev.target&&ev.target.closest&&ev.target.closest('[data-hover-tip]'); if(anchor) queueHoverTip(anchor); });
    document.addEventListener('focusout',function(ev){ if(hoverTipAnchor&&ev.target&&hoverTipAnchor.contains(ev.target)) hideHoverTip(); });
    if(window.MutationObserver) new MutationObserver(function(records){
      records.forEach(function(record){
        if(record.type==='attributes') normalizeHoverTitle(record.target);
        else Array.prototype.forEach.call(record.addedNodes||[],normalizeHoverTitles);
      });
    }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['title']});
  }
  function setNewPending(on, msg){
    newSessionPending = on;
    var btn=byId('nbtn'), schedule=byId('scheduleNew'), vend=byId('nvendor'), model=byId('nmodel'), effort=byId('neffort'), speed=byId('nspeed'), dir=byId('ndir'), np=byId('np'), attach=byId('nattach');
    if(btn){ btn.disabled=on; btn.textContent=on?'starting…':'start session ▸'; }
    if(schedule) schedule.disabled=on;
    if(vend) vend.disabled=on;
    if(model) model.disabled=on;
    if(effort) effort.disabled=on;
    if(speed){
      var vendor=String((byId('nvendor')||{}).value||'').trim().toLowerCase();
      speed.disabled=on||!modelSupportsSpeed(vendor,selectedNewModel());
      syncCustomSelect(speed);
    }
    if(dir) dir.disabled=on;
    if(np) np.disabled=on;
    if(attach) attach.disabled=on;
    refreshNewGoalToggle();
    var message=byId('nmsg');
    if(message && (on || msg!=null)){
      message.className='nmsg'; message.removeAttribute('role');
      message.textContent=on?'':String(msg||'');
    }
  }
  function newSessionFormSnapshot(){
    function value(id){ var node=byId(id); return String(node&&node.value||''); }
    return JSON.stringify({
      dir:value('ndir'), vendor:value('nvendor'), model:value('nmodel'), effort:value('neffort'), speed:value('nspeed'),
      prompt:value('np'), goal:newGoalArmed, tags:newSessionTags, tagDraft:value('newTagInput'),
      attachments:newAttachments.map(function(att){
        var content=String(att&&((att.data!=null&&att.data)||(att.text!=null&&att.text))||'');
        return [String(att&&att.kind||''),String(att&&att.name||''),content.length,content.slice(0,32),content.slice(-32)];
      })
    });
  }
  function renderNewTagPicker(){
    var host=byId('newTags'), menu=byId('newTagMenu'), sug=byId('newTagSug'), input=byId('newTagInput'), add=byId('newTagAdd');
    if(!host || !menu || !sug || !input || !add) return;
    host.innerHTML='';
    newSessionTags.forEach(function(tag){
      var chip=el('span','newtagchip');
      chip.appendChild(el('span',null,tag));
      var remove=el('button',null,'×'); remove.type='button'; remove.title='Remove tag';
      remove.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); newSessionTags=newSessionTags.filter(function(x){ return x!==tag; }); renderNewTagPicker(); };
      chip.appendChild(remove); host.appendChild(chip);
    });
    add.setAttribute('aria-expanded',newTagPickerOpen?'true':'false');
    input.setAttribute('aria-expanded',newTagPickerOpen?'true':'false');
    menu.hidden=!newTagPickerOpen;
    if(!newTagPickerOpen) return;
    var q=normalizeTag(input.value).toLowerCase();
    var assigned={}; newSessionTags.forEach(function(tag){ assigned[tag.toLowerCase()]=true; });
    var matches=selectableUserTags(assigned).filter(function(tag){ return tagSuggestionMatches(tag,q); });
    sug.innerHTML='';
    function option(label,value){
      var btn=el('button','newtagopt'); btn.type='button';
      btn.setAttribute('data-val',value);
      btn.setAttribute('role','option');
      renderTagOptionLabel(btn,label,value);
      btn.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); addNewSessionTag(value); };
      sug.appendChild(btn);
    }
    matches.forEach(function(tag){ option(tag,tag); });
    var typed=normalizeTag(input.value);
    var known=typed && (assigned[typed.toLowerCase()] || TAGS.some(function(tag){ return normalizeTag(tag).toLowerCase()===typed.toLowerCase(); }));
    if(typed && !known) option('Create “'+typed+'”',typed);
    if(!matches.length && (!typed || known)) sug.appendChild(el('div','chooser-empty',typed?'Tag already selected':'No tags yet — type to create one'));
    var options=sug.querySelectorAll('.newtagopt');
    if(newTagPickerActive>=options.length) newTagPickerActive=options.length-1;
    options.forEach(function(node,index){
      var on=index===newTagPickerActive;
      node.classList.toggle('on',on);
      node.setAttribute('aria-selected',on?'true':'false');
    });
  }
  function moveNewTagPickerActive(delta){
    var sug=byId('newTagSug'),options=sug&&sug.querySelectorAll('.newtagopt'),count=options&&options.length||0;
    if(!count) return;
    newTagPickerActive=(newTagPickerActive+delta+count)%count;
    options.forEach(function(node,index){
      var on=index===newTagPickerActive;
      node.classList.toggle('on',on);
      node.setAttribute('aria-selected',on?'true':'false');
    });
    if(options[newTagPickerActive]) options[newTagPickerActive].scrollIntoView({block:'nearest'});
  }
  function commitNewTagPicker(){
    var sug=byId('newTagSug'),options=sug&&sug.querySelectorAll('.newtagopt');
    if(options&&newTagPickerActive>=0&&options[newTagPickerActive]){
      addNewSessionTag(options[newTagPickerActive].getAttribute('data-val'));
      return;
    }
    addNewSessionTag((byId('newTagInput')||{}).value);
  }
  function addNewSessionTag(raw){
    var tag=normalizeTag(raw); if(!tag) return;
    if(!newSessionTags.some(function(x){ return x.toLowerCase()===tag.toLowerCase(); })) newSessionTags.push(tag);
    var input=byId('newTagInput'); if(input) input.value='';
    newTagPickerOpen=false; newTagPickerActive=-1; renderNewTagPicker();
  }
  function closeNewTagPicker(){ newTagPickerOpen=false; newTagPickerActive=-1; renderNewTagPicker(); }
  function newBoxOpen(){ var box=byId('newbox'); return !!(box && box.classList.contains('open')); }
  function todoHubOpen(){ var box=byId('todoHub'); return !!(box&&box.classList.contains('open')); }
  function resetAnchoredBoxPlacement(box){
    var side=document.querySelector('.side');
    if(side) side.classList.remove('newsession-panel-active');
    if(!box) return;
    box.classList.remove('panel-hosted');
    ['left','right','top','width','max-height'].forEach(function(name){ box.style.removeProperty(name); });
  }
  function syncAnchoredBoxPlacement(box,button,open,maxWidth){
    var panel=byId('sessionPanel'),side=document.querySelector('.side');
    resetAnchoredBoxPlacement(box);
    if(!box||!button||!panel||!side||!open||!sessionPanelOpen||panel.hidden||window.innerWidth<=760) return;
    var sideRect=side.getBoundingClientRect();
    if(sideRect.width>=480) return;
    var buttonRect=button.getBoundingClientRect(),panelRect=panel.getBoundingClientRect(),gutter=8,gap=6;
    var left=Math.round(buttonRect.right+gap),top=Math.round(buttonRect.top);
    var width=Math.min(maxWidth,Math.max(240,Math.round(panelRect.right-gutter-left)));
    box.classList.add('panel-hosted');
    side.classList.add('newsession-panel-active');
    box.style.left=left+'px';
    box.style.right='auto';
    box.style.top=top+'px';
    box.style.width=width+'px';
    box.style.maxHeight=Math.max(160,Math.round(window.innerHeight-top-gutter))+'px';
  }
  function resetNewBoxPlacement(){ resetAnchoredBoxPlacement(byId('newbox')); }
  function syncNewBoxPlacement(){ syncAnchoredBoxPlacement(byId('newbox'),byId('newToggle'),newBoxOpen(),576); }
  function resetTodoHubPlacement(){ resetAnchoredBoxPlacement(byId('todoHub')); }
  function syncTodoHubPlacement(){
    syncAnchoredBoxPlacement(byId('todoHub'),byId('todoHubToggle'),todoHubOpen(),512);
  }
  function closeTodoHub(){
    todoHubEditing=null;
    var box=byId('todoHub'); if(box) box.classList.remove('open');
    resetTodoHubPlacement();
    var button=byId('todoHubToggle'); if(button) button.setAttribute('aria-expanded','false');
    renderTodoHubSummary();
  }
  function openTodoHub(){
    if(newBoxOpen()){
      if(newSessionPending) return;
      closeNewBox();
    }
    closeComposerRail();
    var box=byId('todoHub'); if(box) box.classList.add('open');
    var button=byId('todoHubToggle'); if(button) button.setAttribute('aria-expanded','true');
    renderTodoHub();
    syncTodoHubPlacement();
    setTimeout(function(){ var input=byId('todoHubAddInput'); if(todoHubOpen()&&input) input.focus(); },0);
  }
  function toggleTodoHub(){ if(todoHubOpen()) closeTodoHub(); else openTodoHub(); }
  function closeNewBox(){
    closeNewTagPicker();
    closeCustomSelect();
    if(closeVendorChooser) closeVendorChooser();
    var box=byId('newbox'); if(box) box.classList.remove('open');
    resetNewBoxPlacement();
    var btn=byId('newToggle'); if(btn) btn.setAttribute('aria-expanded','false');
  }
  function openNewBox(){
    closeTodoHub();
    refreshCodexModels();
    var box=byId('newbox'); if(box) box.classList.add('open');
    var btn=byId('newToggle'); if(btn) btn.setAttribute('aria-expanded','true');
    syncNewBoxPlacement();
    renderNewTagPicker();
    setTimeout(function(){
      var input=byId('np');
      if(newBoxOpen() && input && !input.disabled) input.focus();
    },0);
  }
  function toggleNewBox(){ if(newBoxOpen()) closeNewBox(); else openNewBox(); }
  function closeGlobalTagEditor(){ globalTagEditing = false; globalTagDraft=''; renderTagFilters(); }
  function openGlobalTagEditor(){ globalTagEditing = true; globalTagDraft=''; renderTagFilters(); }
  function buildGlobalTagEditor(){
    var wrap=el('div','tagcreate-inline');
    var row=el('div','tagedit-row');
    var input=document.createElement('input');
    input.className='tagedit-input';
    input.id='tagInput';
    input.value=globalTagDraft;
    input.placeholder='tag name · Enter';
    var cancel=editCancelButton('Close tag editor (Esc)');
    cancel.id='tagAddCancel';
    row.appendChild(input);
    row.appendChild(cancel);
    wrap.appendChild(row);
    cancel.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); closeGlobalTagEditor(); };
    input.addEventListener('input', function(){ globalTagDraft=input.value; });
    input.addEventListener('keydown', function(ev){
      if(isImeConfirming(ev)) return;
      if(ev.key==='Enter' && !ev.shiftKey){ ev.preventDefault(); addGlobalTag(); }
      else if(ev.key==='Escape'){ ev.preventDefault(); ev.stopImmediatePropagation(); closeGlobalTagEditor(); }
    });
    setTimeout(function(){ try{ input.focus(); input.setSelectionRange(input.value.length,input.value.length); }catch(e){} }, 0);
    return wrap;
  }
  function orderedTagsEqual(a,b){
    a=Array.isArray(a) ? a : [];
    b=Array.isArray(b) ? b : [];
    if(a.length!==b.length) return false;
    for(var i=0;i<a.length;i++){ if(a[i]!==b[i]) return false; }
    return true;
  }
  function showGlobalTagDropPreview(target, after){
    if(!target || !target.parentElement) return;
    var wrap=target.parentElement;
    var source=wrap.querySelector('.gtag.dragging');
    if(!source) return;
    var anchor=after ? target.nextSibling : target;
    if(globalTagDropPlaceholder && ((after && anchor===globalTagDropPlaceholder) || (!after && globalTagDropPlaceholder.nextSibling===target) || (!anchor && globalTagDropPlaceholder===wrap.lastChild))) return;
    if(!globalTagDropPlaceholder){
      globalTagDropPlaceholder=el('span','tag-drag-placeholder');
      globalTagDropPlaceholder.classList.add('gtag');
      globalTagDropPlaceholder.appendChild(el('span','gtagbtn',source.getAttribute('data-tag-label')||source.getAttribute('data-tag-value')||''));
      globalTagDropPlaceholder.setAttribute('aria-hidden','true');
    }
    var rect=globalTagDragSize||source.getBoundingClientRect();
    globalTagDropPlaceholder.style.width=rect.width+'px';
    globalTagDropPlaceholder.style.minWidth=rect.width+'px';
    globalTagDropPlaceholder.style.maxWidth=rect.width+'px';
    globalTagDropPlaceholder.style.height=rect.height+'px';
    globalTagDropPlaceholder.style.flex='0 0 '+rect.width+'px';
    wrap.insertBefore(globalTagDropPlaceholder,anchor);
  }
  function clearGlobalTagDropPreview(){
    var placeholder=globalTagDropPlaceholder;
    if(!placeholder) return;
    placeholder.remove();
    globalTagDropPlaceholder=null;
  }
  function clearHiddenTagDropArm(){
    if(hiddenTagDropTimer) window.clearTimeout(hiddenTagDropTimer);
    hiddenTagDropTimer=0;
    hiddenTagDropSource='';
    hiddenTagDropArmed=false;
    if(hiddenTagDropTarget) hiddenTagDropTarget.classList.remove('drag-over');
    hiddenTagDropTarget=null;
  }
  function scheduleHiddenTagDropArm(target, source){
    if(hiddenTagDropTarget===target && hiddenTagDropSource===source) return;
    clearHiddenTagDropArm();
    hiddenTagDropTarget=target;
    hiddenTagDropSource=source;
    hiddenTagDropTimer=window.setTimeout(function(){
      hiddenTagDropTimer=0;
      if(!hiddenTagDropTarget || draggedGlobalTag!==hiddenTagDropSource) return;
      hiddenTagDropArmed=true;
      hiddenTagDropTarget.classList.add('drag-over');
    },250);
  }
  function clearGlobalTagDragState(){
    globalTagDragSize=null;
    globalTagDropGeometry=null;
    Array.prototype.forEach.call(document.querySelectorAll('.gtag.dragging,.gtag.drag-layout-source'), function(node){
      node.classList.remove('dragging','drag-layout-source');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tag-pin-empty.drag-over,.tag-pin-divider.drag-over,.tag-hidden-divider.drag-over'),function(node){ node.classList.remove('drag-over'); });
    clearHiddenTagDropArm();
    clearGlobalTagDropPreview();
    if(pendingGlobalTagRender&&!pendingGlobalTagRenderFrame){
      pendingGlobalTagRenderFrame=window.requestAnimationFrame(function(){
        pendingGlobalTagRenderFrame=0;
        if(pendingGlobalTagRender&&!draggedGlobalTag) renderTagFilters();
      });
    }
  }
  function finishGlobalTagDrag(token){
    if(token!=null && globalTagDragToken!==token) return;
    globalTagDragToken++;
    draggedGlobalTag=null;
    suppressTagClickUntil=Date.now()+350;
    clearGlobalTagDragState();
  }
  function captureGlobalTagDropGeometry(wrap, source, sourceChip){
    if(!wrap) return null;
    var temporarilyHidden=sourceChip&&!sourceChip.classList.contains('drag-layout-source');
    if(temporarilyHidden) sourceChip.classList.add('drag-layout-source');
    var chips=Array.prototype.slice.call(wrap.querySelectorAll('.gtag[data-tag-value]')).filter(function(chip){
      return !chip.classList.contains('tag-hidden') && normalizeTag(chip.getAttribute('data-tag-value')||'')!==source;
    });
    var rows=[], wrapRect=wrap.getBoundingClientRect();
    chips.forEach(function(chip){
      var chipRect=chip.getBoundingClientRect();
      var rect={left:chipRect.left-wrapRect.left,top:chipRect.top-wrapRect.top,width:chipRect.width,bottom:chipRect.bottom-wrapRect.top};
      var row=rows[rows.length-1];
      if(!row || rect.top>row.bottom+2){ row={chips:[],top:rect.top,bottom:rect.bottom}; rows.push(row); }
      row.chips.push({chip:chip,rect:rect});
      row.bottom=Math.max(row.bottom,rect.bottom);
    });
    function pinRect(selector,kind){
      var node=wrap.querySelector(selector);
      if(!node) return null;
      var rect=node.getBoundingClientRect();
      var left=rect.left-wrapRect.left, top=rect.top-wrapRect.top, bottom=rect.bottom-wrapRect.top;
      if(kind==='pin-end'){
        var pinnedChips=chips.filter(function(chip){ return isTagPinned(chip.getAttribute('data-tag-value')||''); });
        var lastPinned=pinnedChips[pinnedChips.length-1];
        if(lastPinned){
          var pinnedRect=lastPinned.getBoundingClientRect();
          var sameRow=pinnedRect.bottom>=rect.top && pinnedRect.top<=rect.bottom;
          if(sameRow){
            left=pinnedRect.right-wrapRect.left;
            top=Math.min(top,pinnedRect.top-wrapRect.top);
            bottom=Math.max(bottom,pinnedRect.bottom-wrapRect.top);
          }
        }
      }
      return {kind:kind,target:node,left:left,top:top,right:rect.right-wrapRect.left,bottom:bottom};
    }
    var pins=[pinRect('.tag-pin-empty','front'),pinRect('.tag-pin-divider','pin-end')].filter(Boolean);
    if(temporarilyHidden) sourceChip.classList.remove('drag-layout-source');
    return {rows:rows,pins:pins};
  }
  function globalTagDropPosition(wrap, ev, source, ignoreHiddenTarget){
    var eventTarget=ev&&ev.target;
    var hiddenRegion=eventTarget&&eventTarget.closest&&eventTarget.closest('.tag-hidden-divider,.tag-hidden-shelf,.gtag.tag-hidden');
    var hiddenTarget=wrap.querySelector('.tag-hidden-divider');
    if(!ignoreHiddenTarget && hiddenRegion && hiddenTarget && wrap.contains(hiddenRegion)) return {kind:'hide',target:hiddenTarget,after:false};
    var geometry=globalTagDropGeometry;
    if(!geometry){
      geometry=captureGlobalTagDropGeometry(wrap,source,wrap.querySelector('.gtag.dragging'));
      globalTagDropGeometry=geometry;
    }
    if(!geometry) return null;
    var wrapRect=wrap.getBoundingClientRect(), x=ev.clientX-wrapRect.left, y=ev.clientY-wrapRect.top;
    for(var p=0;p<geometry.pins.length;p++){
      var pin=geometry.pins[p];
      if(x>=pin.left && x<=pin.right && y>=pin.top && y<=pin.bottom) return {kind:pin.kind,target:pin.target,after:pin.kind==='front'};
    }
    var rows=geometry.rows;
    if(!rows.length) return null;
    var row=rows[0];
    for(var i=0;i<rows.length;i++){
      row=rows[i];
      if(y<=row.bottom || i===rows.length-1) break;
    }
    for(var j=0;j<row.chips.length;j++){
      if(x<row.chips[j].rect.left+row.chips[j].rect.width/2) return {kind:'tag',target:row.chips[j].chip,after:false};
    }
    return {kind:'tag',target:row.chips[row.chips.length-1].chip,after:true};
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
    var operation=beginOperation('global-tags','catalog');
    setGlobalTags(next);
    serializeMutation('global-tags','catalog',function(){
      if(!operationIsCurrent(operation)) return {ok:true,stale:true,tags:next};
      return fetch('/tags/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tags:next})})
        .then(function(r){return r.json();});
    })
      .then(function(res){
        if(!operationIsCurrent(operation)) return;
        if(!res.ok) throw new Error('tag order failed');
        setGlobalTags(res.tags || next);
      })
      .catch(function(){ if(operationIsCurrent(operation)) setGlobalTags(prevTags); });
  }
  function mergedPinnedTagOrder(visiblePinned){
    var visible={};
    TAGS.forEach(function(tag){ visible[normalizeTag(tag)]=true; });
    return pinnedTags.filter(function(tag){ return !visible[normalizeTag(tag)]; }).concat(visiblePinned);
  }
  function savePinnedTagOrder(visiblePinned){
    var next=mergedPinnedTagOrder(visiblePinned), prev=pinnedTags.slice();
    if(orderedTagsEqual(prev,next)) return;
    var operation=beginOperation('tag-pins','catalog');
    pinnedTags=next;
    VAULT_STATE.pinnedTags=next.slice();
    renderTagFilters();
    saveVaultUiState({pinnedTags:next})
      .catch(function(){
        if(!operationIsCurrent(operation)) return;
        pinnedTags=prev;
        VAULT_STATE.pinnedTags=prev.slice();
        renderTagFilters();
      });
  }
  function placeGlobalTag(source, target, after, forceFront, forceUnpin){
    source=normalizeTag(source);
    target=normalizeTag(target);
    if(!source) return;
    var current=orderedUserTags(), moved=null, remaining=[];
    current.forEach(function(tag){
      if(moved==null && normalizeTag(tag)===source) moved=tag;
      else remaining.push(tag);
    });
    if(moved==null) return;
    var idx=forceFront ? 0 : -1;
    if(idx<0){
      for(var i=0;i<remaining.length;i++){
        if(normalizeTag(remaining[i])===target){ idx=i+(after?1:0); break; }
      }
    }
    if(idx<0) return;
    var pinnedRemaining=remaining.filter(isTagPinned);
    var pinDrop=!forceUnpin && (forceFront || isTagPinned(target));
    var next=remaining.slice();
    next.splice(idx,0,moved);
    var visiblePins=pinDrop ? next.slice(0,pinnedRemaining.length+1) : pinnedRemaining;
    savePinnedTagOrder(visiblePins);
    if(tagOrderMode==='fixed' && !pinDrop) saveGlobalTagOrder(next);
  }
  function reorderGlobalTag(source, target, after){
    if(!source || !target || normalizeTag(source)===normalizeTag(target)) return;
    placeGlobalTag(source,target,after,false,false);
  }
  function pinGlobalTagAtFront(source){
    placeGlobalTag(source,'',false,true,false);
  }
  function pinGlobalTagAtEnd(source){
    var visiblePins=visiblePinnedUserTags();
    if(!visiblePins.length){ pinGlobalTagAtFront(source); return; }
    placeGlobalTag(source,visiblePins[visiblePins.length-1],true,false,false);
  }
  function unpinGlobalTag(source){
    source=normalizeTag(source);
    if(!source || !isTagPinned(source)) return;
    savePinnedTagOrder(visiblePinnedUserTags().filter(function(tag){ return normalizeTag(tag)!==source; }));
  }
  function bindTagPinTarget(target, append){
    target.setAttribute('data-tag-pin-target',append?'end':'front');
  }
  function bindGlobalTagDrag(chip, def){
    if(!def || def.kind!=='user') return;
    var chipDragToken=0;
    chip.setAttribute('data-tag-value', def.value);
    chip.setAttribute('data-tag-label', def.label);
    chip.draggable=true;
    chip.addEventListener('dragstart', function(ev){
      chipDragToken=++globalTagDragToken;
      draggedGlobalTag=def.value;
      suppressTagClickUntil=Date.now()+350;
      var rect=chip.getBoundingClientRect();
      globalTagDragSize={width:rect.width,height:rect.height};
      if(ev.dataTransfer){
        ev.dataTransfer.effectAllowed='move';
        ev.dataTransfer.setData('text/plain', def.value);
      }
      globalTagDropGeometry=captureGlobalTagDropGeometry(byId('tagFilters'),normalizeTag(def.value),chip);
      chip.classList.add('dragging');
      // Let the browser capture its native drag image before removing the source
      // chip from flex layout. The ghost then becomes the sole occupied slot.
      window.setTimeout(function(){ if(globalTagDragToken===chipDragToken && draggedGlobalTag===def.value) chip.classList.add('drag-layout-source'); },0);
    });
    chip.addEventListener('dragend', function(){
      var endedToken=chipDragToken;
      suppressTagClickUntil=Date.now()+350;
      window.setTimeout(function(){
        finishGlobalTagDrag(endedToken);
      }, 0);
    });
  }
  function bindGlobalTagDropZone(wrap){
    wrap.ondragover=function(ev){
      var source=globalTagDragSource(ev);
      if(!source) return;
      ev.preventDefault();
      if(ev.dataTransfer) ev.dataTransfer.dropEffect='move';
      var position=globalTagDropPosition(wrap,ev,source);
      Array.prototype.forEach.call(wrap.querySelectorAll('.tag-pin-empty.drag-over,.tag-pin-divider.drag-over'),function(node){ node.classList.remove('drag-over'); });
      if(position){
        if(position.kind==='hide'){
          clearGlobalTagDropPreview();
          if(isTagHidden(source)) clearHiddenTagDropArm();
          else scheduleHiddenTagDropArm(position.target,source);
        } else {
          clearHiddenTagDropArm();
          if(position.kind!=='tag') position.target.classList.add('drag-over');
          showGlobalTagDropPreview(position.target,position.after);
        }
      }
    };
    wrap.ondrop=function(ev){
      var source=globalTagDragSource(ev);
      if(!source) return;
      ev.preventDefault();
      var sourceHidden=isTagHidden(source);
      var position=globalTagDropPosition(wrap,ev,source);
      var hideArmed=!!(position && position.kind==='hide' && !sourceHidden && hiddenTagDropArmed && hiddenTagDropSource===source);
      if(position && position.kind==='hide' && !sourceHidden && !hideArmed) position=globalTagDropPosition(wrap,ev,source,true);
      var target=position&&position.target, after=!!(position&&position.after);
      if(!target){
        finishGlobalTagDrag();
        if(!sourceHidden) unpinGlobalTag(source);
        return;
      }
      var kind=position.kind;
      var targetTag=target.getAttribute('data-tag-value')||'';
      var first=orderedUserTags().filter(function(tag){ return normalizeTag(tag)!==source; })[0];
      finishGlobalTagDrag();
      if(kind==='front'){
        if(sourceHidden) setGlobalTagHidden(source,false);
        pinGlobalTagAtFront(source);
        return;
      }
      if(kind==='pin-end'){
        if(sourceHidden) setGlobalTagHidden(source,false);
        pinGlobalTagAtEnd(source);
        return;
      }
      if(kind==='hide'){
        if(!sourceHidden && hideArmed) setGlobalTagHidden(source,true);
        return;
      }
      if(sourceHidden) setGlobalTagHidden(source,false);
      if(!sourceHidden && !after && normalizeTag(first||'')===normalizeTag(targetTag)){
        pinGlobalTagAtFront(source);
        return;
      }
      var allPinned=orderedUserTags().every(isTagPinned);
      placeGlobalTag(source,targetTag,after,false,allPinned&&after);
    };
  }
  function renderTagFilters(){
    if(draggedGlobalTag){ pendingGlobalTagRender=true; return; }
    pendingGlobalTagRender=false;
    clearTagHeatCache();
    syncTagFilterModeToggle();
    syncTagOrderToggle();
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
    var defs=filterTagDefs().filter(tagDefMatchesSearch);
    var filterTags=currentFilterTags();
    var tagCounts=tagSessionCounts();
    var mainDefs=[], hiddenDefs=[];
    defs.forEach(function(def){
      var hidden=def.kind==='user' && isTagHidden(def.value);
      if(hidden) hiddenDefs.push(def);
      else mainDefs.push(def);
    });
    var hiddenCount=TAGS.filter(isTagHidden).length;
    var activeHidden=hiddenDefs.some(function(def){ return filterTags.indexOf(def.key)>=0; });
    var visibleUserDefs=mainDefs.filter(function(def){ return def.kind==='user' && !isTagHidden(def.value); });
    var visiblePinnedCount=visibleUserDefs.filter(function(def){ return isTagPinned(def.value); }).length;
    var pinGuideInserted=false, pinDividerInserted=false;
    function appendEmptyPinTarget(){
      var target=el('span','tag-pin-empty','drag here to pin');
      target.setAttribute('role','note');
      target.setAttribute('aria-label','Drag a custom tag here to pin it');
      target.title='Drag a custom tag here to pin it';
      bindTagPinTarget(target,false);
      wrap.appendChild(target);
      pinGuideInserted=true;
    }
    function appendPinDivider(){
      var divider=el('span','tag-pin-divider');
      divider.setAttribute('role','separator');
      divider.setAttribute('aria-label','Pinned tags end here');
      divider.title='Pinned tags · drop here to pin at the end';
      bindTagPinTarget(divider,true);
      wrap.appendChild(divider);
      pinDividerInserted=true;
    }
    function appendTagDef(def, parent){
      var host=parent||wrap;
      var active=filterTags.indexOf(def.key)>=0;
      var pinned=def.kind==='user' && isTagPinned(def.value);
      var hidden=def.kind==='user' && isTagHidden(def.value);
      if(def.kind==='user' && !hidden && !pinGuideInserted){
        pinGuideInserted=true;
        if(!visiblePinnedCount){
          appendEmptyPinTarget();
          appendPinDivider();
        }
      }
      if(def.kind==='user' && !hidden && visiblePinnedCount && !pinned && !pinDividerInserted) appendPinDivider();
      var manageable=def.deletable && !hidden;
      var chip=el('span','gtag'+(active?' on':'')+(def.kind!=='user'?' auto':'')+(def.kind==='untagged'?' untagged':'')+(manageable?' deletable':'')+(pinned?' tag-pinned':'')+(hidden?' tag-hidden':''));
      var btn=el('button','gtagbtn',def.label);
      var count=tagCounts[def.key]||0;
      btn.appendChild(el('span','gtagcount',String(count)));
      btn.setAttribute('aria-label',def.label+' · '+count+' session'+(count===1?'':'s')+(pinned?' · pinned':'')+(hidden?' · hidden':''));
      btn.draggable=false;
      btn.onclick=function(ev){
        ev.stopPropagation();
        if(Date.now()<suppressTagClickUntil) return;
        toggleFilterTag(def.key);
      };
      chip.appendChild(btn);
      if(manageable){
        var del=el('button','gtagdel','×');
        del.draggable=false;
        del.setAttribute('aria-label','Manage tag '+def.label);
        del.onclick=function(ev){
          ev.stopPropagation();
          if(Date.now()<suppressTagClickUntil) return;
          openGlobalTagAction(def.value);
        };
        chip.appendChild(del);
        styleFilterTagChip(chip, btn, del, def, active);
      } else {
        styleFilterTagChip(chip, btn, null, def, active);
      }
      bindGlobalTagDrag(chip, def);
      host.appendChild(chip);
    }
    mainDefs.forEach(function(def){ appendTagDef(def); });
    if(visiblePinnedCount && !pinDividerInserted) appendPinDivider();
    else if(visibleUserDefs.length && !pinGuideInserted){ appendEmptyPinTarget(); appendPinDivider(); }
    if(globalTagEditing) wrap.appendChild(buildGlobalTagEditor());
    else {
      var add=el('button','tagadd-compact','+ tag');
      add.type='button';
      add.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); openGlobalTagEditor(); };
      wrap.appendChild(add);
    }
    var hiddenForcedOpen=!!tagSearchQ || activeHidden;
    var hiddenExpanded=(tagHiddenExpanded || hiddenForcedOpen) && hiddenDefs.length>0;
    var hiddenLabel=hiddenCount ? ('hidden '+hiddenCount+(hiddenExpanded?' ▴':' ▾')) : 'hide';
    var hiddenDivider=el('button','tag-hidden-divider',hiddenLabel);
    hiddenDivider.type='button';
    hiddenDivider.setAttribute('data-tag-hide-target','true');
    hiddenDivider.setAttribute('aria-expanded',hiddenExpanded?'true':'false');
    hiddenDivider.setAttribute('aria-label',hiddenCount
      ? ((hiddenExpanded?'Collapse ':'Show ')+hiddenCount+' hidden tag'+(hiddenCount===1?'':'s')+'. Drag another tag here to hide it.')
      : 'Hidden area is empty. Drag a tag here to hide it.');
    hiddenDivider.title=hiddenCount
      ? ((hiddenExpanded?'Collapse ':'Show ')+hiddenCount+' dormant tag'+(hiddenCount===1?'':'s')+' · drag another tag here to hide it')
      : 'Drag a tag here to hide it';
    hiddenDivider.onclick=function(ev){
      ev.preventDefault(); ev.stopPropagation();
      if(!hiddenDefs.length || hiddenForcedOpen) return;
      tagHiddenExpanded=!hiddenExpanded;
      saveTagHiddenExpanded();
      renderTagFilters();
    };
    wrap.appendChild(hiddenDivider);
    if(hiddenExpanded){
      var hiddenShelf=el('div','tag-hidden-shelf');
      hiddenShelf.setAttribute('data-tag-hide-target','true');
      hiddenShelf.setAttribute('role','group');
      hiddenShelf.setAttribute('aria-label','Hidden tags. Drag a tag above the divider to restore it.');
      hiddenDefs.forEach(function(def){ appendTagDef(def,hiddenShelf); });
      wrap.appendChild(hiddenShelf);
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
    saveFocusViews(focusViews);
    syncActiveTagsFromFocus();
    SESS.forEach(function(s){ if(Array.isArray(s.tags)) s.tags = orderedKnownTags(s.tags); });
    renderTagFilters();
    renderSidebar();
  }
  function addGlobalTag(){
    var inp=byId('tagInput'); if(!inp) return;
    var name=normalizeTag(inp.value);
    if(!name) return;
    var operation=beginOperation('global-tags','catalog');
    serializeMutation('global-tags','catalog',function(){
      return fetch('/tags',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:name})})
        .then(function(r){return r.json();});
    }).then(function(res){ if(!operationIsCurrent(operation)||!res.ok) return; inp.value=''; globalTagDraft=''; globalTagEditing = false; setGlobalTags(res.tags||[]); })
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
      saveFocusViews(focusViews);
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
  function snapshotGlobalTagState(){
    var sessionTags={};
    SESS.forEach(function(s){ if(s && s.sessionId) sessionTags[s.sessionId]=(s.tags||[]).slice(); });
    return {
      tags:TAGS.slice(),
      sessionTags:sessionTags,
      focus:{ views:focusViews.map(function(view){ return { id:view.id, name:view.name, tags:(view.tags||[]).slice() }; }), activeId:activeFocusId, activeTags:activeTags.slice(), activeView:activeTagView, scopedTags:{ active:scopedTagFilters.active.slice(), unread:scopedTagFilters.unread.slice() } }
    };
  }
  function setGlobalTagHidden(tag, shouldHide){
    tag=normalizeTag(tag);
    shouldHide=!!shouldHide;
    if(!tag || isTagHidden(tag)===shouldHide) return;
    var prevHidden=hiddenTags.slice(), prevPinned=pinnedTags.slice();
    var nextHidden=hiddenTags.filter(function(item){ return normalizeTag(item)!==tag; });
    var nextPinned=pinnedTags.slice();
    if(shouldHide){
      nextHidden.push(tag);
      nextPinned=nextPinned.filter(function(item){ return normalizeTag(item)!==tag; });
    }
    var operation=beginOperation('tag-visibility','catalog');
    hiddenTags=nextHidden;
    pinnedTags=nextPinned;
    VAULT_STATE.hiddenTags=nextHidden.slice();
    VAULT_STATE.pinnedTags=nextPinned.slice();
    renderTagFilters();
    saveVaultUiState({hiddenTags:nextHidden,pinnedTags:nextPinned}).then(function(ok){
      if(ok || !operationIsCurrent(operation)) return;
      hiddenTags=prevHidden;
      pinnedTags=prevPinned;
      VAULT_STATE.hiddenTags=prevHidden.slice();
      VAULT_STATE.pinnedTags=prevPinned.slice();
      renderTagFilters();
    });
  }
  function forgetGlobalTagDisplayState(tag){
    tag=normalizeTag(tag);
    if(!tag) return;
    var nextHidden=hiddenTags.filter(function(item){ return normalizeTag(item)!==tag; });
    var nextPinned=pinnedTags.filter(function(item){ return normalizeTag(item)!==tag; });
    if(orderedTagsEqual(nextHidden,hiddenTags) && orderedTagsEqual(nextPinned,pinnedTags)) return;
    hiddenTags=nextHidden;
    pinnedTags=nextPinned;
    VAULT_STATE.hiddenTags=nextHidden.slice();
    VAULT_STATE.pinnedTags=nextPinned.slice();
    saveVaultUiState({hiddenTags:nextHidden,pinnedTags:nextPinned});
  }
  function openGlobalTagAction(tag){
    tag=normalizeTag(tag);
    if(!tag) return;
    var count=tagSessionCounts()['tag:'+tag]||0;
    pendingGlobalTagAction=tag;
    var modal=byId('tagAction');
    byId('tagActionTitle').textContent='Manage tag “'+tag+'”';
    var clearButton=byId('tagActionClear');
    var clearDescription='Keep this tag, but remove it from all chats currently using it.';
    clearButton.textContent='Remove from '+count+' chat'+(count===1?'':'s');
    clearButton.setAttribute('data-tooltip',clearDescription);
    clearButton.setAttribute('aria-description',clearDescription);
    clearButton.hidden=count===0;
    clearButton.disabled=count===0;
    modal.hidden=false;
    modal.setAttribute('aria-hidden','false');
    window.setTimeout(function(){ (clearButton.hidden?byId('tagActionDelete'):clearButton).focus(); },0);
  }
  function closeGlobalTagAction(){
    var modal=byId('tagAction');
    if(!modal || modal.hidden) return;
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    pendingGlobalTagAction='';
  }
  function clearGlobalTagBindings(tag){
    tag=normalizeTag(tag);
    if(!tag) return;
    var prev=snapshotGlobalTagState();
    var operation=beginOperation('global-tags','catalog');
    SESS.forEach(function(s){
      if(s) s.tags=(s.tags||[]).filter(function(x){ return normalizeTag(x)!==tag; });
    });
    if(cur){
      cur.tags=(cur.tags||[]).filter(function(x){ return normalizeTag(x)!==tag; });
      syncOpenHeader();
    }
    renderTagFilters();
    renderSidebar();
    serializeMutation('global-tags','catalog',function(){
      return fetch('/tags/clear-session-bindings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:tag})})
        .then(function(r){return r.json();});
    }).then(function(res){ if(!operationIsCurrent(operation)) return; if(!res.ok) throw new Error('tag binding clear failed'); setGlobalTags(res.tags||TAGS); })
      .catch(function(){ if(operationIsCurrent(operation)) restoreTagState(prev.tags, prev.sessionTags, prev.focus); });
  }
  function deleteGlobalTag(tag){
    tag=normalizeTag(tag);
    if(!tag) return;
    var prev=snapshotGlobalTagState();
    var operation=beginOperation('global-tags','catalog');
    setGlobalTags(TAGS.filter(function(x){ return normalizeTag(x)!==tag; }));
    serializeMutation('global-tags','catalog',function(){
      return fetch('/tags?name='+encodeURIComponent(tag),{method:'DELETE'})
        .then(function(r){return r.json();});
    }).then(function(res){ if(!operationIsCurrent(operation)) return; if(!res.ok) throw new Error('tag delete failed'); setGlobalTags(res.tags||TAGS); forgetGlobalTagDisplayState(tag); })
      .catch(function(){ if(operationIsCurrent(operation)) restoreTagState(prev.tags, prev.sessionTags, prev.focus); });
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
    if(!s) return Promise.resolve();
    // Product-created sessions have a stable client id before the provider has
    // minted/bound its real id. Tags are still ordinary local UI state during
    // that window; remember the desired final set and persist it as soon as the
    // provider id arrives. This keeps a just-created fork taggable while its
    // opening turn is already generating.
    if(!id){
      s._pendingSessionTags=Array.isArray(tags) ? tags.slice() : [];
      return Promise.resolve({ok:true,deferred:true,sessionTags:s._pendingSessionTags.slice()});
    }
    var operation=beginOperation('session-tags',s);
    var desired=Array.isArray(tags) ? tags.slice() : [];
    return serializeMutation('session-tags',s,function(){
      if(!operationIsCurrent(operation)) return {ok:true,stale:true};
      return fetch('/session/tags?session='+encodeURIComponent(id),
        {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tags:desired,updatedAt:nextMutationTimestamp()})})
        .then(function(r){return r.json();});
    }).then(function(res){
        if(!operationIsCurrent(operation)) return {ok:true,stale:true};
        if(!res.ok) return;
        s.tags = res.sessionTags || [];
        setGlobalTags(res.tags || TAGS);
        if(cur && cur.sessionId===s.sessionId){ cur.tags = s.tags.slice(); syncOpenHeader(); }
        return res;
      }).catch(function(){ return operationIsCurrent(operation) ? undefined : {ok:true,stale:true}; });
  }
  function flushPendingSessionTags(s){
    if(!s || !providerSessionId(s) || !Array.isArray(s._pendingSessionTags)) return Promise.resolve();
    var next=s._pendingSessionTags.slice();
    delete s._pendingSessionTags;
    return saveSessionTags(s,next).then(function(res){
      if(!res) s._pendingSessionTags=next;
      return res;
    });
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
    if(TAGS.indexOf(tag)<0) TAGS.push(tag);
    applySessionTagsLocal(s, next);
    saveSessionTags(s, next).then(function(res){ if(!res){ TAGS=prevTags; applySessionTagsLocal(s, prev); } });
  }
  function tagSuggestionMatches(tag, query){
    var hay=normalizeTag(tag).toLowerCase();
    var terms=normalizeTag(query).toLowerCase().split(' ').filter(Boolean);
    return !terms.length || terms.every(function(term){ return hay.indexOf(term)>=0; });
  }
  function sessionTagOptionEls(){
    var list=byId('sessionTagList');
    return list ? list.querySelectorAll('.sessiontag-option') : [];
  }
  function positionSessionTagPopover(){
    var state=sessionTagPopoverState,pop=byId('sessionTagPopover');
    if(!state||!pop||!state.button||!state.button.isConnected) return closeSessionTagPopover();
    var anchor=state.button.getBoundingClientRect(),pad=8,gap=6;
    var width=Math.min(272,window.innerWidth-pad*2);
    pop.style.width=width+'px';
    var height=pop.offsetHeight;
    var left=Math.max(pad,Math.min(anchor.left,window.innerWidth-width-pad));
    var below=anchor.bottom+gap;
    var top=below+height<=window.innerHeight-pad ? below : Math.max(pad,anchor.top-gap-height);
    pop.style.left=Math.round(left)+'px'; pop.style.top=Math.round(top)+'px';
  }
  function closeSessionTagPopover(){
    var state=sessionTagPopoverState,pop=byId('sessionTagPopover'),input=byId('sessionTagInput');
    if(state&&state.button) state.button.setAttribute('aria-expanded','false');
    sessionTagPopoverState=null;
    if(pop) pop.hidden=true;
    if(input){ input.value=''; input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant'); }
  }
  function highlightSessionTagOption(){
    var state=sessionTagPopoverState,options=sessionTagOptionEls();
    if(!state) return;
    if(state.active>=options.length) state.active=options.length-1;
    options.forEach(function(option,index){ option.classList.toggle('on',index===state.active); });
    var active=state.active>=0&&options[state.active]?options[state.active]:null;
    var input=byId('sessionTagInput');
    if(input){
      if(active) input.setAttribute('aria-activedescendant',active.id);
      else input.removeAttribute('aria-activedescendant');
    }
    if(active) active.scrollIntoView({block:'nearest'});
  }
  function chooseSessionTag(raw){
    var state=sessionTagPopoverState,tag=normalizeTag(raw);
    if(!state||!tag) return;
    var s=state.session,assigned=(s.tags||[]).find(function(item){ return normalizeTag(item).toLowerCase()===tag.toLowerCase(); });
    closeSessionTagPopover();
    if(assigned) removeSessionTag(s,assigned);
    else addSessionTag(s,tag);
  }
  function renderSessionTagPopover(){
    var state=sessionTagPopoverState,pop=byId('sessionTagPopover'),input=byId('sessionTagInput'),list=byId('sessionTagList');
    if(!state||!pop||!input||!list) return;
    var assigned={};
    (state.session.tags||[]).forEach(function(tag){ assigned[normalizeTag(tag).toLowerCase()]=true; });
    var query=normalizeTag(input.value).toLowerCase();
    var matches=orderedUserTags().filter(function(tag){ return tagSuggestionMatches(tag,query); });
    list.innerHTML='';
    matches.forEach(function(tag,index){
      var selected=!!assigned[normalizeTag(tag).toLowerCase()];
      var option=el('button','sessiontag-option'+(selected?' selected':''));
      option.type='button'; option.id='sessionTagOption'+index; option.setAttribute('data-val',tag);
      option.setAttribute('role','option'); option.setAttribute('aria-selected',selected?'true':'false');
      renderTagOptionLabel(option,tag,tag);
      option.appendChild(el('span','sessiontag-check',selected?'✓':''));
      option.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); chooseSessionTag(tag); };
      list.appendChild(option);
    });
    var typed=normalizeTag(input.value);
    var known=typed&&TAGS.some(function(tag){ return normalizeTag(tag).toLowerCase()===typed.toLowerCase(); });
    if(typed&&!known){
      var create=el('button','sessiontag-option tagsug-create'); create.type='button';
      create.id='sessionTagOption'+matches.length; create.setAttribute('data-val',typed); create.setAttribute('role','option'); create.setAttribute('aria-selected','false');
      create.appendChild(el('span','tagsug-new','new')); create.appendChild(el('span','tag-option-label',typed)); create.appendChild(el('span','sessiontag-check',''));
      create.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); chooseSessionTag(typed); };
      list.appendChild(create);
    }
    if(!list.childNodes.length) list.appendChild(el('div','chooser-empty','No matching tags — type to create one'));
    highlightSessionTagOption();
    positionSessionTagPopover();
  }
  function openSessionTagPopover(button,s,surface){
    if(!button||!s||!s.sessionId) return;
    if(sessionTagPopoverState&&sessionTagPopoverState.button===button){ closeSessionTagPopover(); return; }
    closeSessionTagPopover(); closeHeaderTagSessionMenu();
    sessionTagPopoverState={button:button,session:s,surface:surface||'sidebar',active:-1};
    button.setAttribute('aria-expanded','true');
    var pop=byId('sessionTagPopover'),input=byId('sessionTagInput');
    if(!pop||!input) return;
    pop.hidden=false; input.value=''; input.setAttribute('aria-expanded','true');
    renderSessionTagPopover();
    setTimeout(function(){ if(sessionTagPopoverState&&sessionTagPopoverState.button===button){ input.focus(); positionSessionTagPopover(); } },0);
  }
  // Auto-scroll is "sticky": we only pull to the bottom while the user is already
  // there. If they scroll up to read mid-turn, streamed chunks must NOT yank them
  // back down — scroll(force=true) is reserved for the user's own actions (sending).
  var stick = true;
  function floatingActionViewport(host,bottomInsetProperties){
    var rect=host.getBoundingClientRect(), owner=host.parentElement;
    var style=owner&&window.getComputedStyle(owner), bottomInset=0;
    (bottomInsetProperties||[]).forEach(function(property){
      bottomInset+=parseFloat(style&&style.getPropertyValue(property)||'0')||0;
    });
    var bottom=Math.max(rect.top,rect.bottom-bottomInset);
    return {top:rect.top,bottom:bottom,height:bottom-rect.top};
  }
  var CHAT_MESSAGE_BOTTOM_INSETS=[];
  var COMMENT_MESSAGE_BOTTOM_INSETS=[];
  function chatMessageViewport(host){ return floatingActionViewport(host,CHAT_MESSAGE_BOTTOM_INSETS); }
  function commentMessageViewport(host){ return floatingActionViewport(host,COMMENT_MESSAGE_BOTTOM_INSETS); }
  function nearScrollBottom(node){ return !node || (node.scrollHeight-node.scrollTop-node.clientHeight)<80; }
  function syncScrollBottomButton(node,button){ if(button) button.hidden=nearScrollBottom(node); }
  function nearBottom(){ return nearScrollBottom(byId('msgs')); }
  function wheelDeltaPixels(ev,host){
    if(ev.deltaMode===1) return ev.deltaY*16;
    if(ev.deltaMode===2) return ev.deltaY*Math.max(1,host.clientHeight);
    return ev.deltaY;
  }
  // Trackpads can keep a gesture latched to a nested tool scroller even after it
  // reaches an edge. Split an edge-crossing wheel delta between the tool body and
  // the chat so expanded edits / patches never trap the rest of the gesture.
  function handoffNestedToolScroll(ev,host){
    if(!host || ev.defaultPrevented || !ev.cancelable || ev.ctrlKey || !ev.deltaY) return;
    if(Math.abs(ev.deltaX)>Math.abs(ev.deltaY)) return;
    var target=ev.target;
    if(target&&target.nodeType!==1) target=target.parentElement;
    var inner=target&&target.closest ? target.closest('.toolc .diff, .toolc pre, .toolc .rplan') : null;
    if(!inner || !host.contains(inner)) return;
    var max=Math.max(0,inner.scrollHeight-inner.clientHeight);
    if(max<=1) return;
    var delta=wheelDeltaPixels(ev,host);
    var top=Math.max(0,Math.min(max,inner.scrollTop));
    var room=delta>0 ? max-top : top;
    var magnitude=Math.abs(delta);
    if(!delta || magnitude<=room+0.5) return;
    var innerBefore=inner.scrollTop, hostBefore=host.scrollTop;
    inner.scrollTop=delta>0 ? max : 0;
    host.scrollTop+=(magnitude-room)*(delta>0 ? 1 : -1);
    if(inner.scrollTop!==innerBefore || host.scrollTop!==hostBefore) ev.preventDefault();
  }
  function scroll(force){ var m=byId('msgs'); if(!m) return; if(force||stick){ m.scrollTop=m.scrollHeight; } syncScrollBottomButton(m,byId('chatScrollBottom')); }
  function scrollChatToBottom(){
    var m=byId('msgs'); if(!m) return;
    // A virtualized transcript can change its estimated height while a smooth
    // scroll is in flight. Jumping to the live maximum makes this explicit
    // user action land at the true bottom; later measurements keep it pinned.
    stick=true; m.scrollTop=m.scrollHeight;
    syncScrollBottomButton(m,byId('chatScrollBottom'));
  }
  function scrollCommentsToBottom(){
    var m=byId('commentMsgs'); if(!m) return;
    commentStick=true; m.scrollTo({top:m.scrollHeight,behavior:'smooth'});
  }
  (function(){ var m=byId('msgs'); if(m){
    m.addEventListener('wheel',function(ev){ handoffNestedToolScroll(ev,m); },{passive:false});
    m.addEventListener('scroll', function(ev){ stick = nearBottom(); if(cur) stashSessionScroll(cur); syncScrollBottomButton(m,byId('chatScrollBottom')); trackVisitScroll(ev); scheduleLatestPin(); scheduleTranscriptVirtualWindow(); });
  } })();
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
    var tick=function(){ var b=genEl&&genEl.querySelector('.bubble');
      if(b) b.textContent=activeGenerationTimingText(activeGenerationTiming(cur,genStart,Date.now())); };
    tick(); genTimer=setInterval(tick,1000);
    clearPh(); appendChatNode(byId('msgs'),genEl); scroll();
  }
  function keepGenLast(){ if(genEl) appendChatNode(byId('msgs'),genEl); }
  function clearGen(){ if(genTimer){ clearInterval(genTimer); genTimer=null; } if(genEl){ genEl.remove(); genEl=null; } }
  // The input stays typeable even mid-turn now — drafts queue instead of being
  // blocked — so this only swaps the placeholder hint. An async turn ending
  // must never steal focus from New Session, search, tag editing, or another field.
  function setInputEnabled(on){ var i=byId('input'); if(!i) return; i.disabled=false;
    i.placeholder = on ? (goalArmed?'describe a verifiable completion condition…':'message')
                       : 'Generating… Enter queues your message'; }
  function draftKey(s){ return s && s.sessionId ? String(s.sessionId) : ''; }
  function sessionScrollKey(s){
    if(!s) return '';
    var id=String(s.clientBranchId||s.sessionId||providerSessionId(s)||'');
    return id ? String(s.vendor||'')+'\u0000'+id : '';
  }
  function currentTurnUnreadRatio(host){
    if(!host) return null;
    if(transcriptVirtualState&&host.classList.contains('transcript-virtualized')&&transcriptVirtualState.turns.length){
      var state=transcriptVirtualState,index=state.turns.length-1;
      var start=state.offsets[index]||0,end=state.offsets[index+1]||state.totalHeight;
      var readAt=host.scrollTop+chatMessageViewport(host).height;
      if(readAt<start) return 1;
      if(readAt<end) return Math.max(0,Math.min(1,(end-readAt)/Math.max(1,end-start)));
      return 0;
    }
    var children=Array.prototype.filter.call(host.querySelectorAll('.msg, .toolrow'),function(node){
      return node.classList&&!node.classList.contains('folded-away')&&!node.classList.contains('turnfold-row');
    });
    var starts=[];
    for(var i=0;i<children.length;i++){
      if(children[i].classList.contains('msg')&&children[i].classList.contains('user')) starts.push(i);
    }
    if(!starts.length) return null;
    var hostRect=host.getBoundingClientRect(),readAt=host.scrollTop+chatMessageViewport(host).height;
    function top(node){ return node.getBoundingClientRect().top-hostRect.top+host.scrollTop; }
    function bottom(node){ return node.getBoundingClientRect().bottom-hostRect.top+host.scrollTop; }
    for(var j=0;j<starts.length;j++){
      var start=top(children[starts[j]]);
      var end=j+1<starts.length ? top(children[starts[j+1]]) : bottom(children[children.length-1]);
      if(readAt<start) return 1;
      if(readAt<end){
        var height=Math.max(1,end-start);
        return Math.max(0,Math.min(1,(end-readAt)/height));
      }
    }
    return 0;
  }
  function stashSessionScroll(s){
    var key=sessionScrollKey(s),host=byId('msgs');
    if(!key||!host) return;
    var max=Math.max(0,host.scrollHeight-host.clientHeight);
    sessionScrollStates[key]={
      top:Math.max(0,host.scrollTop),
      max:max,
      atBottom:nearScrollBottom(host),
      unreadRatio:currentTurnUnreadRatio(host)
    };
    syncSessionReadProgress(s);
  }
  function savedSessionScrollState(s){
    var key=sessionScrollKey(s);
    if(!key||!Object.prototype.hasOwnProperty.call(sessionScrollStates,key)) return null;
    return sessionScrollStates[key];
  }
  function savedSessionScroll(s){
    var state=savedSessionScrollState(s);
    if(!state) return null;
    var top=Number(state.top);
    return isFinite(top) ? Math.max(0,top) : null;
  }
  function setDraftForSession(s, text){
    var key=draftKey(s);
    if(!key) return;
    var val=String(text||'');
    if(val) sessionDrafts[key]=val;
    else delete sessionDrafts[key];
  }
  function draftTextForSession(s){
    var key=draftKey(s);
    return key && sessionDrafts[key] ? String(sessionDrafts[key]).trim() : '';
  }
  function composerOwnsDraftForSession(s){
    var input=byId('input');
    return !!(input && document.activeElement===input && draftKey(cur)===draftKey(s));
  }
  function appendLatestPrompt(host, s, cls){
    // Keep the navigation context stable while the user is actively composing.
    // The text is still saved continuously, but only becomes a projected Draft
    // after the composer loses focus.
    var draft=composerOwnsDraftForSession(s) ? '' : draftTextForSession(s);
    var latest=draft || String((s&&s.lastPrompt)||'');
    if(!latest || (!draft && latest===String((s&&s.title)||''))) return null;
    var edit=null;
    if(draft){
      edit=el('button','draft-edit');
      setIconButton(edit,'edit','Edit draft');
      edit.onclick=function(ev){
        ev.preventDefault(); ev.stopPropagation();
        if(cur!==s) select(s);
        setTimeout(function(){
          var input=byId('input'); if(!input) return;
          try{ input.focus(); input.setSelectionRange(input.value.length,input.value.length); }catch(e){}
        },0);
      };
    }
    var line=sessionPromptLine(cls||'it-firstline',draft?'Draft':'Latest',latest,edit,draft?'Draft':promptAgeLabel(s,'latest'));
    host.appendChild(line);
    return line;
  }
  function clearDraftForSession(s){
    var key=draftKey(s);
    if(!key) return;
    delete sessionDrafts[key];
    delete sessionAttachments[key];
    delete sessionPinReferences[key];
  }
  function stashComposerDraft(s){
    var inp=byId('input');
    if(!inp || !s){ resetComposerHistoryNavigation(); return; }
    var key=draftKey(s);
    if(composerHistoryNav&&composerHistoryNav.sessionKey===key){
      if(composerHistoryNav.index===composerHistoryNav.entries.length) composerHistoryNav.draft=String(inp.value||'');
      else composerHistoryNav.entries[composerHistoryNav.index]=String(inp.value||'');
    }
    var draft=composerHistoryNav&&composerHistoryNav.sessionKey===key
      ? composerHistoryNav.draft
      : inp.value;
    setDraftForSession(s, draft);
    resetComposerHistoryNavigation();
  }
  function restoreComposerDraft(s){
    var inp=byId('input');
    if(!inp) return;
    resetComposerHistoryNavigation();
    var key=draftKey(s);
    inp.value = key && sessionDrafts[key] ? sessionDrafts[key] : '';
    syncComposerHeight();
  }
  function resetComposerHistoryNavigation(){ composerHistoryNav=null; }
  function composerUserMessageHistory(s){
    var out=[];
    var history=cachedTranscriptFor(s)||[];
    for(var i=0;i<history.length;i++){
      var message=history[i];
      if(!message || message.role!=='user') continue;
      var historicalText=attachmentDisplayText(message.text, message.attachments).trim();
      if(historicalText) out.push(historicalText);
    }
    if(out.length) return out;
    var host=byId('msgs'), rows=host ? host.querySelectorAll('.msg.user') : [];
    for(var j=0;j<rows.length;j++){
      var bubble=rows[j].querySelector('.bubble');
      if(!bubble) continue;
      var raw=bubble.hasAttribute('data-raw') ? bubble.getAttribute('data-raw') : bubble.textContent;
      var text=String(raw||'').trim();
      if(text) out.push(text);
    }
    if(out.length) return out;
    var last=String(s&&s.lastPrompt||'').trim();
    return last ? [last] : [];
  }
  function setComposerHistoryValue(input,text){
    input.value=text;
    syncComposerHeight();
    try{ input.setSelectionRange(text.length,text.length); }catch(e){}
    syncComposerShortcutGhost();
  }
  function composerCaretVisualTop(input,position){
    var style=window.getComputedStyle(input);
    var mirror=document.createElement('div');
    var properties=[
      'boxSizing','width','height','overflowX','overflowY',
      'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
      'paddingTop','paddingRight','paddingBottom','paddingLeft',
      'fontStyle','fontVariant','fontWeight','fontStretch','fontSize','fontFamily',
      'fontKerning','fontFeatureSettings','lineHeight','letterSpacing','wordSpacing',
      'textAlign','textTransform','textIndent','textDecoration','tabSize','direction',
      'whiteSpace','wordBreak','overflowWrap'
    ];
    properties.forEach(function(property){ mirror.style[property]=style[property]; });
    mirror.style.position='fixed';
    mirror.style.left='-10000px';
    mirror.style.top='0';
    mirror.style.visibility='hidden';
    mirror.style.pointerEvents='none';
    mirror.style.whiteSpace=style.whiteSpace||'pre-wrap';
    mirror.style.overflowWrap=style.overflowWrap||'break-word';
    var value=String(input.value||'');
    mirror.textContent=value.slice(0,position);
    var marker=document.createElement('span');
    marker.textContent=value.slice(position)||'\\u200b';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    var top=marker.offsetTop;
    mirror.remove();
    return top;
  }
  function composerCaretAtEdge(input,direction){
    // Only hand ArrowUp/Down to history when the caret can't move any further
    // inside a multi-line draft. Measure visual lines in a style-matched mirror
    // so soft wrapping behaves the same as explicit newlines.
    var start=input.selectionStart, end=input.selectionEnd;
    if(start==null || start!==end) return false;
    var value=String(input.value||'');
    var caretTop=composerCaretVisualTop(input,start);
    var edgeTop=composerCaretVisualTop(input,direction<0?0:value.length);
    return Math.abs(caretTop-edgeTop)<1;
  }
  function navigateComposerHistory(input,direction){
    if(!input || !cur || !direction) return false;
    var key=draftKey(cur);
    if(!key) return false;
    if(!composerCaretAtEdge(input,direction)) return false;
    var nav=composerHistoryNav;
    if(!nav || nav.sessionKey!==key){
      resetComposerHistoryNavigation();
      if(direction>0) return false;
      var entries=composerUserMessageHistory(cur);
      if(!entries.length) return false;
      nav={sessionKey:key,entries:entries,index:entries.length,draft:String(input.value||'')};
      composerHistoryNav=nav;
      setDraftForSession(cur,nav.draft);
    }
    if(nav.index===nav.entries.length) nav.draft=String(input.value||'');
    else nav.entries[nav.index]=String(input.value||'');
    nav.index=direction<0
      ? Math.max(0,nav.index-1)
      : Math.min(nav.entries.length,nav.index+1);
    setComposerHistoryValue(input,nav.index===nav.entries.length ? nav.draft : nav.entries[nav.index]);
    return true;
  }
  function syncComposerHeight(){
    var inp=byId('input'); if(!inp) return;
    inp.style.height='auto';
    var max=parseFloat(window.getComputedStyle(inp).maxHeight)||192;
    var next=Math.min(inp.scrollHeight,max);
    inp.style.height=next+'px';
    inp.style.overflowY=inp.scrollHeight>max ? 'auto' : 'hidden';
    syncComposerShortcutGhost();
    scheduleOverlayOffsets();
    alignComposerRailPanel();
  }
  function stashQueueState(s){
    var key=draftKey(s);
    if(!key) return;
    sessionQueues[key]={items:pendingQueue.map(cloneTurn),parked:queueParked,steerable:queueSteerable};
    if(editingQueueIdx>=0) sessionQueueEditing[key]=editingQueueIdx;
    else delete sessionQueueEditing[key];
  }
  function restoreQueueState(s){
    var key=draftKey(s);
    var saved=key&&sessionQueues[key];
    pendingQueue = saved&&Array.isArray(saved.items) ? saved.items.map(cloneTurn) : [];
    queueParked = !!(saved&&saved.parked);
    queueSteerable = !!(saved&&saved.steerable);
    editingQueueIdx = key&&sessionQueueEditing[key]!=null ? sessionQueueEditing[key] : -1;
    if(editingQueueIdx>=pendingQueue.length) editingQueueIdx=-1;
    renderQueue();
    if(key) refreshServerQueue(s);
  }
  function syncQueueState(){
    if(!cur) return;
    stashQueueState(cur);
  }
  function applyServerQueue(s, res){
    if(!s || !res || !res.ok) return;
    var items=Array.isArray(res.items) ? res.items.map(cloneTurn) : [];
    var parked=res.parked===true;
    var steerable=res.steerable===true;
    var key=draftKey(s);
    if(key) sessionQueues[key]={items:items.map(cloneTurn),parked:parked,steerable:steerable};
    s.queueCount=items.length;
    s.queueParked=parked;
    syncSessionQueueBadge(s);
    if(!cur || cur.sessionId!==s.sessionId) return;
    pendingQueue=items;
    queueParked=parked;
    queueSteerable=steerable;
    if(editingQueueIdx>=pendingQueue.length) editingQueueIdx=-1;
    renderQueue();
  }
  function refreshServerQueue(s){
    var id=providerSessionId(s);
    if(!s || !id) return Promise.resolve();
    var key=draftKey(s), saved=key&&sessionQueues[key];
    if(saved&&saved.items&&saved.items.some(function(item){ return String(item.id||'').indexOf('pending-')===0; })) return Promise.resolve();
    var operation=beginOperation('queue-view',s);
    return fetch('/chat/queue?session='+encodeURIComponent(id))
      .then(function(r){ return r.json(); })
      .then(function(res){ if(operationIsCurrent(operation)) applyServerQueue(s, res); })
      .catch(function(){});
  }
  function dropOptimisticQueueItem(s,itemId){
    var key=draftKey(s), saved=key&&sessionQueues[key];
    if(saved&&Array.isArray(saved.items)) saved.items=saved.items.filter(function(item){ return item.id!==itemId; });
    if(cur&&s&&cur.sessionId===s.sessionId){
      pendingQueue=pendingQueue.filter(function(item){ return item.id!==itemId; });
      stashQueueState(s); renderQueue();
    }
    var remaining=saved&&Array.isArray(saved.items) ? saved.items.length : 0;
    s.queueCount=remaining;
    syncSessionQueueBadge(s);
  }
  function queuedForkKey(s,itemId){ return draftKey(s)+'|'+String(itemId||''); }
  function queuedForkBusy(s,itemId){ return !!forkingQueueItems[queuedForkKey(s,itemId)]; }
  function queuedSendBusy(s,itemId){ return !!sendingQueueItems[queuedForkKey(s,itemId)]; }
  function queuedImmediateActionCopy(s,turn,edited){
    var vendor=String((turn&&turn.vendor)||(s&&s.vendor)||'').toLowerCase();
    var qualifier=edited?'edited queued message':'queued message';
    if(vendor==='claude') return {
      label:'append',
      title:'Append this '+qualifier+' to the current Claude turn',
      unavailable:'Claude cannot accept an appended message right now'
    };
    if(vendor==='codex') return {
      label:'guide',
      title:'Guide the current Codex response with this '+qualifier,
      unavailable:'Codex cannot accept guidance right now'
    };
    return {
      label:'send now',
      title:'Send this '+qualifier+' now to guide the current response',
      unavailable:'This provider cannot accept guidance right now'
    };
  }
  function makeQueuedEditor(turn, i){
    var text=turnText(turn), atts=turnAttachments(turn), refs=turnPinReferences(turn);
    var immediate=queuedImmediateActionCopy(cur,turn,true);
    var box=el('div','qeditbox');
    box.appendChild(el('span','qtag','queued'));
    if(turn.goal) box.appendChild(el('span','qtag','goal'));
    if(atts.length) box.appendChild(el('span','qtag', atts.length+' file'+(atts.length>1?'s':'')));
    if(refs.length) box.appendChild(el('span','qtag', refs.length+' pin'+(refs.length>1?'s':'')));
    var input=el('input','qeditta'); input.type='text'; input.value=String(text||'');
    box.appendChild(input);
    function closeEditor(){ editingQueueIdx=-1; syncQueueState(); renderQueue(); }
    function commit(sendNow){
      var next=input.value.trim();
      if(!next){ delQueued(i); return; }
      editingQueueIdx=-1;
      updateQueued(i, next, sendNow);
    }
    var go;
    if(turnActive && (!queueSteerable || turn.goal)){
      go=el('span','qdispatch qwaiting','waiting');
      go.title=turn.goal?'Goals start with the next turn':immediate.unavailable;
    } else {
      go=el('button','qdispatch qsend',turnActive?immediate.label:'send');
      go.disabled=queuedSendBusy(cur,turn.id);
      go.title=turnActive?immediate.title:'Send this edited queued message now';
      go.onclick=function(ev){ ev.stopPropagation(); commit(true); };
    }
    var cancel=editCancelButton('Cancel edit (Esc)');
    var del=el('button','qaction qdel');
    setIconButton(del,'delete','Delete queued message');
    box.appendChild(go); box.appendChild(cancel); box.appendChild(del);
    cancel.onclick=function(ev){ ev.stopPropagation(); closeEditor(); };
    del.onclick=function(ev){ ev.stopPropagation(); delQueued(i); };
    box.onclick=function(ev){ ev.stopPropagation(); };
    input.onkeydown=function(ev){ ev.stopPropagation();
      if(isImeConfirming(ev)) return;
      if(ev.key==='Enter'){ ev.preventDefault(); commit(true); }
      else if(ev.key==='Escape'){ ev.preventDefault(); closeEditor(); }
    };
    setTimeout(function(){ try{ input.focus(); input.setSelectionRange(input.value.length, input.value.length); }catch(e){} }, 0);
    return box;
  }
  // The send button doubles as Stop while a turn is in flight.
  function composerVendorChanged(){ return !!(cur && cur.runVendor && cur.runVendor!==cur.vendor); }
  function updateSendLabel(){ var b=byId('send'),forkButton=byId('forkBtn'); if(!b) return;
    var changed=composerVendorChanged(),vendor=(currentForkDefaults()).vendor||'selected vendor';
    if(turnActive){
      b.textContent='■ stop'; b.disabled=false; b.title='Stop the current generation (Esc)';
      if(forkButton){ forkButton.hidden=false; setForkButtonLabel(forkButton,changed?'fork with '+vendor:'fork'); }
    } else if(changed){
      setForkButtonLabel(b,'fork with '+vendor); b.disabled=!canForkCur(); b.title='Create a '+vendor+' branch with this draft';
      if(forkButton) forkButton.hidden=true;
    } else {
      var currentInfo=vendorInfo(cur&&cur.vendor);
      var unavailable=!!(currentInfo&&!currentInfo.available);
      b.textContent='send'; b.disabled=unavailable; b.title=unavailable ? (currentInfo.message||currentInfo.vendor+' CLI is unavailable.') : '';
      if(forkButton){ forkButton.hidden=false; setForkButtonLabel(forkButton,'fork'); }
    }
    b.classList.toggle('stopping', turnActive); }
  function beginTurn(startedAt){
    endCatchup();
    stopRequested=false;
    reviveAttention(cur);
    turnActive=true;
    if(cur) cur.lastGenerationDurationMs=null;
    if(cur) cur.lastGenerationOutcome=null;
    if(cur) cur.lastGenerationStoppedByUser=false;
    if(cur) cur.analysisPending=false;
    clearTurnScopedSignals(cur);
    if(cur && !startedAt) cur.lastAssistantOutputAt=null;
    setInputEnabled(false);
    updateSendLabel();
    refreshGoalToggle();
    startGen(startedAt);
    markCurGenerating(true);
    refreshForkButton();
    renderQueue();
  }
  function endTurn(outcome){ clearGen(); turnActive=false; setInputEnabled(true); updateSendLabel(); markCurGenerating(false,outcome); refreshForkButton(); refreshGoalToggle(); }
  function markCurGenerating(on,outcome){
    if(!cur) return;
    if(!on && cur.lastGenerationDurationMs==null) finishGenerationTiming(cur,Date.now(),outcome);
    cur.generating=on;
    cur.generatingStartedAt=on ? (genStart || Date.now()) : null;
    if(!on) cur.lastAssistantOutputAt=null;
    if(on && viewVisit && viewVisit.sessionId===cur.sessionId) viewVisit.wasGenerating=true;
    applyGenerating(cur);
  }
  // Queue advancement is server-owned. A terminal event only updates this tab;
  // the server starts the next queued turn even when this session is in the background.
  function turnEnded(outcome){
    var stoppedByUser=stopRequested;
    var terminal=outcome||(stoppedByUser?'stopped':'generated');
    stopRequested=false;
    endTurn(terminal);
    if(cur && stoppedByUser) cur.lastGenerationStoppedByUser=true;
    renderQueue();
    if(cur){ refreshServerQueue(cur); refreshAnalysis(cur); }
  }
  // Render the pinned "queued" list (above the composer). Each row: the text plus
  // a Send/Edit/Delete control set — Codex-style.
  function renderQueue(){
    var q=byId('queue'); if(!q) return; q.innerHTML='';
    scheduledItemsForSession(cur).forEach(function(item){ q.appendChild(makeScheduledQueueRow(item)); });
    pendingQueue.forEach(function(turn,i){
      var text=turnText(turn), atts=turnAttachments(turn), refs=turnPinReferences(turn), preview=turnPreview(turn);
      var immediate=queuedImmediateActionCopy(cur,turn,false);
      if(i===editingQueueIdx){
        var erow=el('div','qitem editing'); erow.appendChild(makeQueuedEditor(turn, i)); q.appendChild(erow);
        return;
      }
      var row=el('div','qitem');
      row.appendChild(el('span','qtag','queued'));
      if(turn.goal) row.appendChild(el('span','qtag','goal'));
      if(atts.length) row.appendChild(el('span','qtag', atts.length+' file'+(atts.length>1?'s':'')));
      if(refs.length) row.appendChild(el('span','qtag', refs.length+' pin'+(refs.length>1?'s':'')));
      var tx=el('div','qtext',preview); tx.title=preview; row.appendChild(tx);
      var sb;
      if(turnActive && (!queueSteerable || turn.goal)){
        sb=el('span','qdispatch qwaiting','waiting');
        sb.title=turn.goal?'Goals start with the next turn':immediate.unavailable;
      } else {
        sb=el('button','qdispatch qsend',turnActive?immediate.label:'send');
        sb.disabled=queuedSendBusy(cur,turn.id);
        sb.title=turnActive?immediate.title:'Send this queued message now';
        sb.onclick=function(){ sendQueued(i); };
      }
      var fb=el('button','qaction qfork');
      setIconButton(fb,'fork','Fork queued message into a new session');
      var forkReady=String(turn.id||'').indexOf('pending-')!==0;
      fb.disabled=!forkReady || queuedForkBusy(cur,turn.id);
      if(!forkReady) fb.title='Waiting for this queued message to be saved';
      else if(fb.disabled) fb.title='Forking queued message…';
      fb.onclick=function(){ forkQueued(i); };
      var eb=el('button','qaction qedit');
      setIconButton(eb,'edit','Edit queued message');
      eb.onclick=function(){ editQueued(i); };
      var db=el('button','qaction qdel');
      setIconButton(db,'delete','Delete queued message');
      db.onclick=function(){ delQueued(i); };
      row.appendChild(sb); row.appendChild(fb); row.appendChild(eb); row.appendChild(db);
      q.appendChild(row);
    });
    scheduleOverlayOffsets();
  }
  function renderCommentQueue(){
    var q=byId('commentQueue'); if(!q) return;
    q.innerHTML='';
    scheduledCommentsForThread(commentDrawerState.threadId).forEach(function(item){ q.appendChild(makeScheduledQueueRow(item)); });
    scheduleCommentOverlayOffsets();
  }
  // Edit a queued draft in place (NOT back in the bottom composer, which may hold
  // an unrelated draft): only the text slot becomes a single-line input, so the
  // row height and action positions stay fixed. Empty → removes; cancel keeps it.
  function editQueued(i){ if(pendingQueue[i]==null) return; editingQueueIdx=i; syncQueueState(); renderQueue(); }
  function forkQueued(i){
    var item=pendingQueue[i];
    if(!cur || !cur.sessionId || !item || !item.id || String(item.id).indexOf('pending-')===0) return;
    var target=cur, key=queuedForkKey(target,item.id);
    if(forkingQueueItems[key]) return;
    forkingQueueItems[key]=true;
    renderQueue();
    var branch=startFork(currentForkDefaults(),cloneTurn(item),{queueItemId:item.id});
    if(branch) return;
    delete forkingQueueItems[key];
    renderQueue();
  }
  function sendQueued(i){
    if(pendingQueue[i]==null) return;
    var item=pendingQueue[i];
    if(turnActive && (!queueSteerable || item.goal)) return;
    if(!cur || !cur.sessionId || !item.id) return;
    var target=cur;
    var id=providerSessionId(target); if(!id) return;
    var sendKey=queuedForkKey(target,item.id);
    if(sendingQueueItems[sendKey]) return;
    sendingQueueItems[sendKey]=true;
    var operation=beginOperation('queue-send',target);
    var viewOperation=beginOperation('queue-view',target);
    var steering=turnActive;
    if(!steering) expectSessionRun(target);
    var runEpoch=Number(target._runEpoch)||0;
    if(cur===target && !steering) beginTurn(target.generatingStartedAt);
    renderQueue();
    fetch('/chat/queue/send?session='+encodeURIComponent(id)+'&item='+encodeURIComponent(item.id),{method:'POST'})
      .then(function(r){ return r.json(); })
      .then(function(res){
        delete sendingQueueItems[sendKey];
        if(!operationIsCurrent(operation)) return;
        if(res.ok){ if(operationIsCurrent(viewOperation)) applyServerQueue(target,res); }
        else {
          if(!steering && sessionRunWasAcknowledged(target,runEpoch)) return;
          if(!steering){ if(cur===target) endTurn('failed'); else rejectSessionRun(target,'failed'); }
          showToast(res.error||'Could not send queued message','warn');
          refreshServerQueue(target);
        }
      })
      .catch(function(){
        delete sendingQueueItems[sendKey];
        if(!operationIsCurrent(operation)) return;
        if(!steering && sessionRunWasAcknowledged(target,runEpoch)) return;
        if(!steering){ if(cur===target) endTurn('failed'); else rejectSessionRun(target,'failed'); }
        showToast('Could not send queued message','warn'); refreshServerQueue(target);
      });
  }
  function delQueued(i){
    var item=pendingQueue[i];
    if(!cur || !cur.sessionId || !item || !item.id) return;
    var target=cur;
    var id=providerSessionId(target); if(!id) return;
    var operation=beginOperation('queue-view',target);
    // A fast delete can beat the enqueue response, while the row still has its
    // client-only temporary id. Mark that object cancelled; enqueue() will delete
    // the real server item as soon as its id arrives.
    if(String(item.id).indexOf('pending-')===0){
      item.cancelled=true;
      pendingQueue.splice(i,1);
      if(editingQueueIdx===i) editingQueueIdx=-1;
      else if(editingQueueIdx>i) editingQueueIdx--;
      target.queueCount=pendingQueue.length;
      syncQueueState(); syncSessionQueueBadge(target); renderQueue();
      return;
    }
    pendingQueue.splice(i,1);
    if(editingQueueIdx===i) editingQueueIdx=-1;
    else if(editingQueueIdx>i) editingQueueIdx--;
    target.queueCount=pendingQueue.length;
    syncQueueState(); syncSessionQueueBadge(target); renderQueue();
    serializeMutation('queue-write',target,function(){
      return fetch('/chat/queue?session='+encodeURIComponent(id)+'&item='+encodeURIComponent(item.id),{method:'DELETE'})
        .then(function(r){ return r.json(); });
    })
      .then(function(res){
        if(!operationIsCurrent(operation)) return;
        if(res.ok) applyServerQueue(target, res);
        else { showToast(res.error||'Could not delete queued message','warn'); refreshServerQueue(target); }
      })
      .catch(function(){ if(operationIsCurrent(operation)){ showToast('Could not delete queued message','warn'); refreshServerQueue(target); } });
  }
  function updateQueued(i, text, sendNow){
    var item=pendingQueue[i];
    if(!cur || !cur.sessionId || !item || !item.id) return;
    var target=cur;
    var id=providerSessionId(target); if(!id) return;
    var operation=beginOperation('queue-view',target);
    var previous=cloneTurn(item);
    item.text=text;
    syncQueueState(); renderQueue();
    serializeMutation('queue-write',target,function(){
      return fetch('/chat/queue?session='+encodeURIComponent(id)+'&item='+encodeURIComponent(item.id),{
        method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify({text:text})
      }).then(function(r){ return r.json(); });
    }).then(function(res){
      if(!operationIsCurrent(operation)) return;
      if(!res.ok){
        var current=pendingQueue.findIndex(function(candidate){ return candidate.id===item.id; });
        if(current>=0) pendingQueue[current]=previous;
        syncQueueState(); renderQueue();
        showToast(res.error||'Could not update queued message','warn');
        return;
      }
      applyServerQueue(target, res);
      if(sendNow && res.ok && cur===target){
        var next=(res.items||[]).findIndex(function(candidate){ return candidate.id===item.id; });
        if(next>=0) sendQueued(next);
      }
    }).catch(function(){
      if(!operationIsCurrent(operation)) return;
      var current=pendingQueue.findIndex(function(candidate){ return candidate.id===item.id; });
      if(current>=0) pendingQueue[current]=previous;
      syncQueueState(); renderQueue();
      showToast('Could not update queued message','warn');
    });
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
    var previous={score:s.score,priorityset:s.priorityset,state:s.state,stateset:s.stateset,pattern:s.pattern,patternset:s.patternset,etaMin:s.etaMin,etaset:s.etaset};
    if(field==='priority'){ value=Math.max(0,Math.min(10,value)); s.score=value; s.priorityset=true; body.priority=value; }
    else if(field==='state'){ s.state=value; s.stateset=true; body.state=value; }
    else if(field==='pattern'){
      if(value===null){ s.pattern='unknown'; s.patternset=false; body.pattern=null; }
      else { s.pattern=value; s.patternset=true; body.pattern=value; }
    }
    else { value=Math.max(1,Math.round(value)); s.etaMin=value; s.etaset=true; body.etaMin=value; }
    var id=providerSessionId(s); if(!id) return;
    var operation=beginOperation('override:'+field,s);
    body.updatedAt=nextMutationTimestamp();
    function rollback(){
      if(!operationIsCurrent(operation)) return;
      s.score=previous.score; s.priorityset=previous.priorityset;
      s.state=previous.state; s.stateset=previous.stateset;
      s.pattern=previous.pattern; s.patternset=previous.patternset;
      s.etaMin=previous.etaMin; s.etaset=previous.etaset;
      if(cur===s){ syncOpenHeader(); renderAvoidancePanel(); }
      renderSidebar();
    }
    serializeMutation('override:'+field,s,function(){
      if(!operationIsCurrent(operation)) return {ok:true,stale:true};
      return fetch('/session/override?session='+encodeURIComponent(id),
        {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
        .then(function(r){return r.json();});
    }).then(function(res){ if(operationIsCurrent(operation)&&!res.ok) rollback(); })
      .catch(rollback);
  }
  function clearTurnScopedSignals(s){
    if(!s) return;
    s.etaMin=null;
    s.etaset=false;
    s.state=null;
    s.stateset=false;
    // Both analyzer drafts belong to the assistant turn that just ended. Once a
    // user/queued turn starts they must not survive locally or reappear at turn-end.
    s.nextStep=null;
    s.probe=null;
    if(cur&&cur.sessionId===s.sessionId){ headerSig(s); renderComposerRail(); }
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
  function chatSessionIds(s){
    if(!s) return [];
    var ids=[s.clientBranchId,s.providerSessionId,s.sessionId].map(function(value){ return String(value||''); }).filter(Boolean);
    return ids.filter(function(value,index){ return ids.indexOf(value)===index; });
  }
  function sameChatSession(a,b){
    if(!a||!b) return false;
    if(a===b) return true;
    if(String(a.vendor||'')!==String(b.vendor||'')) return false;
    var aIds=chatSessionIds(a),bIds=chatSessionIds(b);
    return aIds.some(function(id){ return bIds.indexOf(id)>=0; });
  }
  function chatSessionRef(s){
    if(!s) return null;
    var vendor=String(s.vendor||'').trim().toLowerCase();
    var sessionId=String(providerSessionId(s)||s.clientBranchId||s.sessionId||'').trim();
    return vendor&&sessionId ? {vendor:vendor,sessionId:sessionId} : null;
  }
  function chatMemberKey(member){
    return String(member&&member.vendor||'').trim().toLowerCase()+'\u0000'+String(member&&member.sessionId||'').trim();
  }
  function sessionForChatMember(member){
    var vendor=String(member&&member.vendor||'').trim().toLowerCase();
    var id=String(member&&member.sessionId||'').trim();
    if(!vendor||!id) return null;
    for(var i=0;i<SESS.length;i++){
      if(String(SESS[i]&&SESS[i].vendor||'').trim().toLowerCase()===vendor&&chatSessionIds(SESS[i]).indexOf(id)>=0) return SESS[i];
    }
    return null;
  }
  function savedChatGroups(){
    if(!VAULT_STATE||typeof VAULT_STATE!=='object') VAULT_STATE={};
    if(!VAULT_STATE.chatGroups||typeof VAULT_STATE.chatGroups!=='object'||Array.isArray(VAULT_STATE.chatGroups)) VAULT_STATE.chatGroups={};
    return VAULT_STATE.chatGroups;
  }
  function makeChatGroupId(){
    try{ if(crypto&&typeof crypto.randomUUID==='function') return 'chat-group-'+crypto.randomUUID(); }catch(e){}
    return 'chat-group-'+Date.now().toString(36)+'-'+(++chatGroupClock).toString(36)+'-'+Math.random().toString(36).slice(2,8);
  }
  function chatGroupForSession(s){
    for(var i=0;i<chatGroups.length;i++){
      for(var j=0;j<chatGroups[i].sessions.length;j++){
        if(sameChatSession(chatGroups[i].sessions[j],s)) return chatGroups[i];
      }
    }
    return null;
  }
  function chatGroupSessionIndex(group,s){
    if(!group) return -1;
    for(var i=0;i<group.sessions.length;i++){ if(sameChatSession(group.sessions[i],s)) return i; }
    return -1;
  }
  function newChatGroup(s,id){
    var group={id:String(id||makeChatGroupId()),sessions:s?[s]:[]};
    chatGroups.push(group);
    return group;
  }
  function chatGroupRecord(group){
    var saved=savedChatGroups(),previous=saved[group.id],members=[],seen={};
    (previous&&Array.isArray(previous.members)?previous.members:[]).forEach(function(member){
      // A session absent from this Attend scope may belong to another launch
      // root. Keep it while rewriting the visible part of the group.
      if(sessionForChatMember(member)) return;
      var vendor=String(member&&member.vendor||'').trim().toLowerCase(),sessionId=String(member&&member.sessionId||'').trim();
      var key=chatMemberKey(member);
      if(!vendor||!sessionId||seen[key]) return;
      seen[key]=true;
      members.push({vendor:vendor,sessionId:sessionId});
    });
    group.sessions.forEach(function(s){
      var member=chatSessionRef(s),key=chatMemberKey(member);
      if(!member||seen[key]) return;
      seen[key]=true; members.push(member);
    });
    return {id:group.id,members:members,updatedAt:Date.now()};
  }
  function persistChatGroups(groups){
    var patch={},saved=savedChatGroups(),seen={};
    (groups||[]).forEach(function(group){
      if(!group||!group.id||seen[group.id]) return;
      seen[group.id]=true;
      var record=chatGroupRecord(group);
      if(record.members.length>1){ saved[group.id]=record; patch[group.id]=record; }
      else { delete saved[group.id]; patch[group.id]=null; }
    });
    if(Object.keys(patch).length) saveVaultUiState({chatGroups:patch});
  }
  function restoreChatGroups(){
    chatGroups=[]; activeChatGroup=null;
    var claimed=[];
    Object.keys(savedChatGroups()).map(function(id){ return savedChatGroups()[id]; }).filter(function(group){
      return group&&typeof group==='object'&&Array.isArray(group.members);
    }).sort(function(a,b){ return Number(b.updatedAt||0)-Number(a.updatedAt||0); }).forEach(function(saved){
      var sessions=[];
      saved.members.forEach(function(member){
        var s=sessionForChatMember(member);
        if(!s||claimed.some(function(existing){ return sameChatSession(existing,s); })) return;
        claimed.push(s); sessions.push(s);
      });
      if(sessions.length) chatGroups.push({id:String(saved.id||''),sessions:sessions});
    });
  }
  function activateChatGroupForSession(s){
    if(!s){ activeChatGroup=null; return null; }
    var group=chatGroupForSession(s)||newChatGroup(s);
    var index=chatGroupSessionIndex(group,s);
    if(index>=0) group.sessions[index]=s;
    activeChatGroup=group;
    return group;
  }
  function removeChatGroup(group){
    var index=chatGroups.indexOf(group);
    if(index>=0) chatGroups.splice(index,1);
    if(activeChatGroup===group) activeChatGroup=null;
  }
  function groupChatSession(anchor,s,options){
    if(!anchor||!s) return null;
    options=options||{};
    var target=chatGroupForSession(anchor)||newChatGroup(anchor);
    var source=chatGroupForSession(s);
    if(source && source!==target){
      var sourceIndex=chatGroupSessionIndex(source,s);
      if(sourceIndex>=0) source.sessions.splice(sourceIndex,1);
      if(!source.sessions.length) removeChatGroup(source);
    }
    var targetIndex=chatGroupSessionIndex(target,s);
    if(targetIndex<0) target.sessions.push(s); else target.sessions[targetIndex]=s;
    var anchorIndex=chatGroupSessionIndex(target,anchor);
    if(anchorIndex>=0) target.sessions[anchorIndex]=anchor;
    activeChatGroup=target;
    if(options.persist!==false) persistChatGroups(source&&source!==target?[source,target]:[target]);
    return target;
  }
  function seedForkChatGroups(){
    var changed=[];
    SESS.forEach(function(s){
      var parentId=String((s&&s.forkParentId)||(s&&s.pendingFork&&s.pendingFork.parent)||'').trim();
      if(!parentId||chatGroupForSession(s)) return;
      var parent=findSessionById(parentId);
      if(parent){ var group=groupChatSession(parent,s,{persist:false}); if(group&&changed.indexOf(group)<0) changed.push(group); }
    });
    if(changed.length) persistChatGroups(changed);
  }
  function pruneChatGroups(){
    var priorActive=activeChatGroup,claimed=[];
    chatGroups=chatGroups.filter(function(group){
      var next=[];
      group.sessions.forEach(function(tab){
        var canonical=null;
        for(var i=0;i<SESS.length;i++){ if(sameChatSession(tab,SESS[i])){ canonical=SESS[i]; break; } }
        if(!canonical || claimed.some(function(existing){ return sameChatSession(existing,canonical); })) return;
        claimed.push(canonical); next.push(canonical);
      });
      group.sessions=next;
      return next.length>0;
    });
    activeChatGroup=chatGroups.indexOf(priorActive)>=0?priorActive:null;
  }
  function closeChatTab(s){
    var group=chatGroupForSession(s),index=chatGroupSessionIndex(group,s); if(!group||index<0) return;
    var wasCurrent=sameChatSession(cur,group.sessions[index]);
    group.sessions.splice(index,1);
    if(!group.sessions.length) removeChatGroup(group);
    persistChatGroups([group]);
    if(!wasCurrent){ renderChatTabs(); return; }
    var next=group.sessions[Math.min(index,group.sessions.length-1)]||null;
    if(next){ select(next); return; }
    flushVisit(false);
    stashSessionScroll(cur);
    stashComposerDraft(cur); stashAttachmentState(cur); stashPinReferenceState(cur); stashQueueState(cur);
    if(!(byId('commentDrawer')||{}).hidden) closeCommentDrawer();
    closeComposerRail(); clearGen(); turnActive=false;
    resetOpenHeader(); renderSidebar(); renderChatTabs();
    document.body.classList.remove('show-chat');
  }
  function renderChatTabs(){
    var host=byId('chatTabs'); if(!host) return;
    pruneChatGroups();
    var tabs=activeChatGroup?activeChatGroup.sessions:[];
    host.innerHTML=''; host.hidden=tabs.length<=1;
    tabs.forEach(function(s,index){
      var active=sameChatSession(cur,s),item=el('div','chat-tab'+(active?' on':''));
      item.setAttribute('data-session-id',String(s.sessionId||s.clientBranchId||''));
      var main=el('button','chat-tab-main');
      main.type='button'; main.setAttribute('role','tab'); main.setAttribute('aria-selected',active?'true':'false');
      main.title=sessionTitleText(s); main.appendChild(el('span','chat-tab-status '+statusState(s)));
      main.appendChild(el('span','chat-tab-label',sessionTitleParts(s).title));
      main.onclick=function(){ if(!sameChatSession(cur,s)) select(s); };
      main.onkeydown=function(ev){
        if(ev.key!=='ArrowLeft'&&ev.key!=='ArrowRight') return;
        ev.preventDefault();
        var offset=ev.key==='ArrowLeft'?-1:1;
        select(tabs[(index+offset+tabs.length)%tabs.length]);
      };
      var close=el('button','chat-tab-close','×'); close.type='button';
      close.title='Close chat tab'; close.setAttribute('aria-label','Close '+sessionTitleParts(s).title);
      close.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); closeChatTab(s); };
      item.appendChild(main); item.appendChild(close); host.appendChild(item);
      if(active) setTimeout(function(){ if(item.isConnected) item.scrollIntoView({block:'nearest',inline:'nearest'}); },0);
    });
  }
  function sessionsForHeaderTag(tag){
    var key=normalizeTag(tag).toLowerCase();
    return SESS.filter(function(s){
      return (s.tags||[]).some(function(value){ return normalizeTag(value).toLowerCase()===key; });
    }).sort(function(a,b){ return Number(sessionSortTs(b)||0)-Number(sessionSortTs(a)||0); }).slice(0,10);
  }
  function closeHeaderTagSessionMenu(){
    headerTagSessionMenu='';
    var menu=byId('headerTagSessionMenu'); if(menu) menu.remove();
    Array.prototype.forEach.call(document.querySelectorAll('.headtag-nav[aria-expanded="true"]'),function(node){ node.setAttribute('aria-expanded','false'); });
  }
  function toggleHeaderTagSessionMenu(trigger,tag){
    var normalized=normalizeTag(tag),same=headerTagSessionMenu===normalized;
    hideHoverTip();
    closeHeaderTagSessionMenu();
    if(same) return;
    headerTagSessionMenu=normalized; trigger.setAttribute('aria-expanded','true');
    var menu=el('div','headtag-session-menu'); menu.id='headerTagSessionMenu'; menu.setAttribute('role','menu');
    sessionsForHeaderTag(normalized).forEach(function(s){
      var active=sameChatSession(cur,s),option=el('button','headtag-session-option'+(active?' on':''));
      option.type='button'; option.setAttribute('role','menuitem');
      var copy=el('span','headtag-session-copy');
      var heading=el('span','headtag-session-heading');
      heading.appendChild(el('span','chat-tab-status '+statusState(s)));
      heading.appendChild(el('span','headtag-session-title',sessionTitleParts(s).title));
      copy.appendChild(heading);
      copy.appendChild(el('span','headtag-session-meta',[s.vendor,s.project||basename(s.cwd||''),ageLabel(s)].filter(Boolean).join(' · ')));
      option.appendChild(copy);
      if(active) option.appendChild(el('span','headtag-session-current','current'));
      option.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); closeHeaderTagSessionMenu(); if(!active) select(s); };
      menu.appendChild(option);
    });
    trigger.parentElement.appendChild(menu);
  }
  function renderHeaderTags(s){
    var wrap=byId('h-tags'); if(!wrap) return;
    closeHeaderTagSessionMenu();
    wrap.innerHTML='';
    if(!s) return;
    var row=el('div','headtag-row it-footrow');
    var tags=el('div','it-tags');
    (s.tags||[]).forEach(function(tag){
      var def=userTagDef(tag);
      if(!def) return;
      var chip=tagChip(def, !!s.sessionId, function(){ removeSessionTag(s, def.value); });
      var trigger=chip.firstElementChild;
      if(trigger){
        trigger.classList.add('headtag-nav'); trigger.setAttribute('role','button'); trigger.setAttribute('tabindex','0');
        trigger.setAttribute('aria-haspopup','menu'); trigger.setAttribute('aria-expanded','false');
        trigger.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); toggleHeaderTagSessionMenu(trigger,def.value); };
        trigger.onkeydown=function(ev){
          if(ev.key!=='Enter'&&ev.key!==' '&&ev.key!=='ArrowDown') return;
          ev.preventDefault(); ev.stopPropagation(); toggleHeaderTagSessionMenu(trigger,def.value);
          var first=byId('headerTagSessionMenu')&&byId('headerTagSessionMenu').querySelector('button'); if(first) first.focus();
        };
      }
      tags.appendChild(chip);
    });
    if(s.sessionId){
      var add=el('button','it-tagadd','+ tag');
      add.type='button';
      add.setAttribute('aria-haspopup','dialog'); add.setAttribute('aria-expanded','false'); add.setAttribute('aria-controls','sessionTagPopover');
      add.onclick=function(ev){
        ev.preventDefault(); ev.stopPropagation(); openSessionTagPopover(add,s,'header');
      };
      tags.appendChild(add);
    }
    row.appendChild(tags);
    row.appendChild(sessionContextRow(s));
    if(row.childNodes.length) wrap.appendChild(row);
  }
  // The open header mirrors the sidebar tab signals; vendor/project/prompts live
  // with the tag row so their visual treatment matches the tab footer.
  function headerSig(s){
    var sig=byId('h-sig'); if(!sig) return;
    renderSessionSignals(sig,s);
  }

  function renderSessionSignals(host,s){
    if(!host) return;
    host.innerHTML='';
    if(s.score!=null) host.appendChild(priBadge(s,'b-pri'));
    var liveEntry=makeLiveTimingEntry(s);
    registerLiveTiming(liveEntry);
    if(s.generating || s.lastGenerationDurationMs!=null || s.score!=null) host.appendChild(liveEntry.row);
    syncLiveTimingEntry(liveEntry,s,Date.now());
    if(!s.generating && s.analysisPending) host.appendChild(el('span','analysis-pending','analyzing'));
    if(!s.generating && !s.analysisPending && s.etaMin!=null) host.appendChild(etaBadge(s,'b-eta'));
    if(!s.generating && !s.analysisPending){ var badge=stateBadge(s); if(badge) host.appendChild(badge); }
    var reason=!s.generating && !s.analysisPending && s.reason && s.reason!=='no signal' ? s.reason : '';
    if(reason){
      var reasonEl=el('span','it-reason',reason);
      reasonEl.setAttribute('data-hover-tip',reason);
      host.appendChild(reasonEl);
    }
  }
  // Patch a session's daemon verdict into its tab (and the header if open).
  function applyAnalysis(s, a){
    if(!a) return;
    // A manually-pinned priority/ETA wins — don't let the daemon's verdict overwrite it.
    s.brief=a.brief; s.reason=a.reason;
    if(!s.stateset) s.state=a.state || null;
    if(!s.priorityset) s.score=a.priority;
    if(!s.etaset) s.etaMin=a.etaMin;
    s.nextStep=a.nextStep||null;
    s.probe=a.probe||null;
    s.analysisPending=false;
    var t=s.sessionId&&titleEls[s.sessionId];
    if(t) renderSessionTitle(t, s, 'it-title');
    if(cur&&cur.sessionId===s.sessionId){ renderSessionTitle(byId('h-title'), cur, 't it-title'); headerSig(s); renderComposerRail(); }
    renderSidebar();
  }
  // The daemon analyzes on turn-end (server-side); poll a few times for its verdict.
  function analysisChanged(s, a){
    if(!a) return false;
    return a.brief!==s.brief ||
      (!s.stateset && (a.state||null)!==(s.state||null)) ||
      a.reason!==s.reason ||
      String(a.nextStep||'')!==String(s.nextStep||'') ||
      String(a.probe||'')!==String(s.probe||'') ||
      (!s.priorityset && Number(a.priority)!==Number(s.score)) ||
      (!s.etaset && Number(a.etaMin)!==Number(s.etaMin));
  }
  // Fallback only: the server pushes the verdict over the live bus (onBusAnalysisEvent)
  // the moment it's cached, which is the primary path. This poll covers a dropped SSE
  // connection and, crucially, clears the "analyzing" flag when it finally gives up so
  // the badge can't hang forever (the old 4×4s window expired before Codex's ~30s reply).
  var ANALYSIS_POLL_TRIES=8; // ~3.5s + 8×4.5s ≈ 40s, past typical Codex daemon latency
  function refreshAnalysis(s){
    var id=providerSessionId(s);
    if(!s||!id) return; // supported vendor sessions can receive a daemon verdict
    var tries=0, runEpoch=Number(s._runEpoch)||0;
    var giveUp=function(){
      if((Number(s._runEpoch)||0)!==runEpoch || s.generating || !s.analysisPending) return;
      s.analysisPending=false;
      if(cur&&cur.sessionId===s.sessionId) headerSig(s);
      renderSidebar();
    };
    var poll=function(){
      if((Number(s._runEpoch)||0)!==runEpoch || s.generating) return;
      tries++;
      fetch('/session/analysis?session='+encodeURIComponent(id)).then(function(r){return r.json();})
        .then(function(res){ var a=res&&res.analysis;
          if((Number(s._runEpoch)||0)!==runEpoch || s.generating) return;
          if(analysisChanged(s,a)){ applyAnalysis(s,a); return; }
          if(tries<ANALYSIS_POLL_TRIES) setTimeout(poll, 4500); else giveUp();
        }).catch(function(){ if(tries<ANALYSIS_POLL_TRIES) setTimeout(poll,4500); else giveUp(); });
    };
    setTimeout(poll, 3500);
  }

  function syncOpenHeader(){
    if(!cur) return;
    if(!titleEditing) renderSessionTitle(byId('h-title'), cur, 't it-title');
    syncHeaderStatus(cur);
    var sub=byId('h-sub'); sub.innerHTML=''; sub.className='s';
    if(cur.title) sub.appendChild(enableHeaderPromptJump(sessionPromptLine('sub-line it-firstline','First',cur.title,null,promptAgeLabel(cur,'first')),'first'));
    var latestLine=appendLatestPrompt(sub, cur, 'sub-line it-firstline');
    if(latestLine&&latestLine.querySelector('.prompt-line-latest')) enableHeaderPromptJump(latestLine,'latest');
    if(!sub.childNodes.length) sub.appendChild(el('div','sub-line', cur.vendor+' · '+(cur.cwd||'')));
    var age=byId('h-age'); if(age){ age.textContent=ageLabel(cur); age.hidden=!age.textContent; }
    headerSig(cur);
    renderHeaderTags(cur);
    syncTitleEditButton();
    syncHeaderForkTree();
    var rb=byId('refreshBtn');
    if(rb){ rb.disabled = !(cur && (cur.sessionId || cur.pendingFork)); }
    syncHeaderPinButton();
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
  function syncHeaderPinButton(){
    var button=byId('headerPinBtn');
    if(!button) return;
    var enabled=!!(cur&&cur.sessionId&&!cur.pendingFork),pinned=enabled&&!!sessionPinTime(cur);
    var label=enabled?(pinned?'Unpin session':'Pin session to top'):'select a session to pin';
    button.disabled=!enabled;
    button.classList.toggle('on',pinned);
    button.title=label;
    button.setAttribute('aria-label',label);
    button.setAttribute('aria-pressed',pinned?'true':'false');
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
    resetComposerHistoryNavigation();
    document.body.classList.add('no-session');
    syncPageTitle(null);
    var ht=byId('h-title'); if(ht){ ht.className='t it-title'; ht.textContent = 'Attend'; ht.removeAttribute('data-hover-tip'); }
    var sub=byId('h-sub');
    if(sub){ sub.className='s'; sub.textContent='Recent changes'; }
    var sig=byId('h-sig'); if(sig) sig.innerHTML='';
    var age=byId('h-age'); if(age){ age.textContent=''; age.hidden=true; }
    var tags=byId('h-tags'); if(tags) tags.innerHTML='';
    var tray=byId('pinTray'); if(tray){ tray.innerHTML=''; tray.classList.remove('show'); tray.setAttribute('aria-hidden','true'); }
    syncHeaderStatus(null);
    refreshBusy = false;
    titleEditing = false;
    cur = null;
    pendingQueue = [];
    editingQueueIdx = -1;
    editingScheduleId = '';
    hideLatestPin();
    var ap=byId('avoidPanel'); if(ap){ ap.innerHTML=''; ap.hidden=true; }
    if(noSessionChangelog) replaceMessages(noSessionChangelog.cloneNode(true),'top');
    renderQueue();
    clearAttachments();
    setComposerDrop(false);
    syncRefreshButton();
    syncHeaderPinButton();
    syncTitleEditButton();
    syncHeaderForkTree();
    activeChatGroup=null;
    renderChatTabs();
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
    if(tagOrderMode==='recent') renderTagFilters();
  }
  function hydrateSessionSource(s, opts){
    opts = opts || {};
    var force = !!opts.force;
    var preserveSort = !!opts.preserveSort;
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
            if(!preserveSort){ syncActivitySortTs(s, found.lastTs); sortSessions(); }
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
    return loadTranscriptBaseline(s,{force:true,preserveSort:true}).catch(function(){})
      .finally(function(){ s._warmingTranscript = false; });
  }

  function sessionSortTs(s){
    if(!s) return null;
    return Math.max(Number(s.sortTs!=null ? s.sortTs : s.lastTs)||0,latestCommentUserTsForSession(s));
  }
  function sessionPinTime(s){
    var id=String(s&&s.sessionId||'');
    return id&&VAULT_STATE.sessionPins ? Number(VAULT_STATE.sessionPins[id])||0 : 0;
  }
  function compareSessionPins(a,b){
    var ap=sessionPinTime(a), bp=sessionPinTime(b);
    if(!!ap!==!!bp) return ap ? -1 : 1;
    return 0;
  }
  function sessionPinBoundaryIndex(sessions){
    for(var i=1;i<(sessions||[]).length;i++){
      if(sessionPinTime(sessions[i-1]) && !sessionPinTime(sessions[i])) return i;
    }
    return -1;
  }
  function sortSessions(){
    var mode=(byId('sort')||{}).value||'recent';
    if(filterQ){
      SESS.sort(function(a,b){
        var pinOrder=compareSessionPins(a,b); if(pinOrder) return pinOrder;
        var ra=searchRelevance(a), rb=searchRelevance(b);
        if(ra!==rb) return rb-ra;
        return (sessionSortTs(b)||0)-(sessionSortTs(a)||0);
      });
    }
    else if(mode==='priority'){ SESS.sort(function(a,b){ return compareSessionPins(a,b)||(b.score||0)-(a.score||0); }); }
    // 'recent' = most-recent activity first, by precise timestamp (coarse ageDays
    // can't distinguish same-day sessions, so they'd never reorder on interaction).
    else { SESS.sort(function(a,b){ return compareSessionPins(a,b)||(sessionSortTs(b)||0)-(sessionSortTs(a)||0); }); }
  }
  // Keep the pin boundary authoritative from the first optimistic render. A raw
  // unshift places an unpinned new session above pinned rows until a later sort.
  function insertSession(s){ SESS.unshift(s); sortSessions(); return s; }
  function toggleSessionPin(s){
    var id=String(s&&s.sessionId||''); if(!id) return;
    if(!VAULT_STATE.sessionPins || typeof VAULT_STATE.sessionPins!=='object') VAULT_STATE.sessionPins={};
    var patch={};
    if(sessionPinTime(s)){ delete VAULT_STATE.sessionPins[id]; patch[id]=null; }
    else { VAULT_STATE.sessionPins[id]=Date.now(); patch[id]=VAULT_STATE.sessionPins[id]; }
    saveVaultUiState({sessionPins:patch});
    sortSessions(); renderSidebar();
    if(cur&&String(cur.sessionId||'')===id) syncHeaderPinButton();
  }
  // Bump a session to the top on user-authored activity. Plainly opening a tab is
  // handled by engagement telemetry and must not affect recent sorting.
  function touchSession(s){ if(!s) return; s.sortTs=Date.now(); sortSessions(); renderSidebar(); }
  var titleEls={}; // sessionId -> .it-title node, so a late daemon brief can patch it in place
  var statusEls={}; // sessionId -> .it-status dot, so live generating state can patch in place
  var queueEls={}; // sessionId -> queued-work badge, patched from the global live snapshot
  var commentEls={}; // sessionId -> unread-comment badge, patched as comment threads settle/read
  var liveTimingEls={}; // sessionId -> compact generating + output-silence telemetry
  var filterQ=''; // sidebar search query (matches custom title / brief / 首 / 新 / project / vendor / reason)
  var sessionSearchRange='today';
  var sessionSearchRangeOpen=false;
  var sessionSearchRangeView='presets';
  var sessionSearchCustomStart=sessionSearchDayStart(0);
  var sessionSearchCustomEnd=Date.now();
  var sessionSearchCustomDraftStart=sessionSearchCustomStart;
  var sessionSearchCustomDraftEnd=sessionSearchCustomEnd;
  var sessionSearchCustomPickerTarget='';
  var sessionSearchCustomPickerMonth=sessionSearchDayStart(0);
  var SESSION_SEARCH_RANGES=[
    {value:'today',label:'Today',compact:'Today'},
    {value:'yesterday',label:'Yesterday',compact:'Yesterday'},
    {value:'7d',label:'Last 7 days',compact:'7 days'},
    {value:'30d',label:'Last 30 days',compact:'30 days'},
    {value:'all',label:'All time',compact:'All'},
    {value:'custom',label:'Custom range…',compact:'Custom'}
  ];
  var tagSearchQ=''; // tag-chip search; also narrows sessions inside the current view
  var contentSearchQ='';
  var contentSearchTimer=null;
  var contentSearchSeq=0;
  var contentSearchResults={};
  var parsedSessionSearch={clauses:[],groups:[],test:function(){return true;}};
  function escapeSearchLiteral(text){ return String(text).replace(/[.*+?^\${}()|[\]\\]/g,'\\$&'); }
  function compileSessionSearch(raw){
    if(raw.length>500) throw new Error('search query is too long');
    var clauses=[], groups=[[]], i=0;
    function regex(source){
      if(!source) throw new Error('empty regex');
      if(source.length>160) throw new Error('regex is too long');
      if(/[()]/.test(source)||/\\\\[1-9]/.test(source)) throw new Error('regex groups and backreferences are not supported');
      try{return new RegExp(source,'i');}catch(err){throw new Error(err&&err.message||'invalid regex');}
    }
    while(i<raw.length){
      while(/\\s/.test(raw[i]||'')) i++;
      if(i>=raw.length) break;
      var exclude=false; if(raw[i]==='-'){exclude=true;i++;}
      if(i>=raw.length||/\\s/.test(raw[i]||'')) throw new Error("'-' must prefix a term");
      var delimiter=raw[i]==='"'?'"':raw[i]==='%'?'%':null, value='';
      if(delimiter){
        i++;
        while(i<raw.length&&raw[i]!==delimiter){ if(raw[i]==='\\\\'&&delimiter==='"'&&i+1<raw.length)i++; value+=raw[i]||'';i++; }
        if(raw[i]!==delimiter) throw new Error(delimiter==='"'?'unclosed quote':'unclosed regex');
        i++; if(i<raw.length&&!/\\s/.test(raw[i]||'')) throw new Error('add a space after a quoted term');
      }else while(i<raw.length&&!/\\s/.test(raw[i]||'')){value+=raw[i]||'';i++;}
      if(!value) throw new Error('empty search term');
      if(!delimiter&&!exclude&&value.toUpperCase()==='OR'){
        if(!groups[groups.length-1].length) throw new Error('OR must follow a search term');
        groups.push([]); continue;
      }
      var clause={exclude:exclude,source:value,regex:delimiter==='%'?regex(value):new RegExp(escapeSearchLiteral(value),'i')};
      clauses.push(clause); groups[groups.length-1].push(clause);
    }
    if(groups.length>1&&!groups[groups.length-1].length) throw new Error('OR must precede a search term');
    return {clauses:clauses,groups:groups,test:function(text){text=String(text||'');return groups.some(function(group){return group.every(function(c){return c.exclude!==c.regex.test(text);});});}};
  }
  function setSessionSearchError(message){
    var node=byId('searchError'), input=byId('search'); if(!node||!input)return;
    node.textContent=message||''; node.hidden=!message; input.setAttribute('aria-invalid',message?'true':'false');
  }
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
          scheduleSidebarRender();
        })
        .catch(function(){});
    }, 300);
  }
  function textHasSearch(value){
    return !!(filterQ && parsedSessionSearch.test(String(value||'')));
  }
  function primaryFieldSearchHit(s){
    return !!(s && (textHasSearch(s.customTitle) || textHasSearch(s.brief) || textHasSearch(s.title) || textHasSearch(s.lastPrompt)));
  }
  function sidebarFieldSearchHit(s){
    if(!s) return false;
    if(primaryFieldSearchHit(s)) return true;
    var hay=[s.customTitle,s.brief,s.title,s.lastPrompt,s.project,s.vendor,s.reason,s.cwd]
      .concat(allTagDefsForSession(s).map(function(def){ return def.label; }))
      .filter(Boolean).join(' ').toLowerCase();
    return parsedSessionSearch.test(hay);
  }
  function searchMatchRank(s){
    if(!filterQ) return 0;
    if(primaryFieldSearchHit(s)) return 3; // brief / First / Latest before transcript content.
    if(sidebarFieldSearchHit(s)) return 2;
    return contentSearchHit(s) ? 1 : 0;
  }
  function normalizedSearchText(value){ return String(value||'').replace(/\\s+/g,' ').trim().toLowerCase(); }
  function searchRelevance(s){
    if(!filterQ||!s) return 0;
    var title=customTitleText(s)||String(s.title||''), score=0;
    var positive=parsedSessionSearch.clauses.filter(function(c){return !c.exclude;});
    var literalQuery=positive.length===1&&parsedSessionSearch.clauses.length===1?normalizedSearchText(positive[0].source):'';
    if(literalQuery&&normalizedSearchText(title)===literalQuery) score+=1000;
    if(parsedSessionSearch.test(title)) score+=500;
    else if(parsedSessionSearch.test([s.customTitle,s.brief,s.title].filter(Boolean).join(' '))) score+=420;
    else if(parsedSessionSearch.test([s.title,s.lastPrompt].filter(Boolean).join(' '))) score+=320;
    else if(sidebarFieldSearchHit(s)) score+=220;
    var content=contentSearchHit(s);
    if(content) score+=100+Math.min(40,Number(content.count||0)*4);
    return score||searchMatchRank(s)*100;
  }
  function matchesFilter(s){
    var isCur=!!(cur && s && cur.sessionId && s.sessionId===cur.sessionId);
    if(activeTagView==='unread' && !isCur && !(s && (s.generating || s.unread))) return false;
    if(activeTagView==='active' && !isCur && !(s && (s.generating || s.unread || s.seen))) return false;
    if(!sessionMatchesPriorityFilter(s)) return false;
    if(!sessionMatchesTagFilter(s, currentFilterTags())) return false;
    if(!sessionMatchesTagSearch(s)) return false;
    return sessionMatchesSidebarSearch(s);
  }
  function reconcileCurrentSessionToFilter(){
    renderSidebar();
  }
  function briefText(s){ return s.brief || s.title || '(no prompt)'; }
  function customTitleText(s){ return String((s&&s.customTitle)||'').trim(); }
  function generatedBriefText(s){ return String((s&&s.brief)||'').trim(); }
  function sessionTitleParts(s){
    var custom=customTitleText(s);
    var generated=generatedBriefText(s);
    var aux=custom && generated && generated!==custom ? generated : '';
    return { title: custom || briefText(s), custom: !!custom, aux: aux };
  }
  function sessionTitleText(s){
    var parts=sessionTitleParts(s);
    return parts.title + (parts.aux ? ' · '+parts.aux : '');
  }
  function renderSessionTitle(node, s, baseClass){
    if(!node) return;
    var parts=sessionTitleParts(s);
    var tip=parts.title + (parts.aux ? ' · '+parts.aux : '');
    node.className=baseClass+' session-title'+(parts.custom?' manual':'')+(parts.aux?' has-aux':'')+(!parts.custom && !(s&&s.brief)?' pending':'');
    if(tip) node.setAttribute('data-hover-tip',tip);
    else node.removeAttribute('data-hover-tip');
    node.textContent='';
    node.appendChild(el('span','session-title-main',parts.title));
    if(parts.aux) node.appendChild(el('span','session-title-aux',parts.aux));
  }
  function stripForkPrefix(text){
    return String(text||'').replace(/^\\s*(?:\\(fork\\)\\s*)+/i, '').trim();
  }
  function forkTitleFromSession(s, userMsg){
    var message=String(userMsg||'').trim();
    var base=stripForkPrefix(message || (s && s.brief) || (s && s.title) || (s && s.lastPrompt) || '');
    return base ? '(fork) '+base : '(fork)';
  }
  // Compact time since activity: now / Xm / Xh / Xd.
  function ageLabelAt(t,fallbackDays){
    if(t==null) return fallbackDays!=null?(fallbackDays+'d'):'';
    var ms=Date.now()-t; if(ms<0) ms=0;
    var m=Math.floor(ms/60000);
    if(m<1) return 'now';
    if(m<60) return m+'m';
    var h=Math.floor(m/60);
    if(h<24) return h+'h';
    return Math.floor(h/24)+'d';
  }
  // The title-row age follows all activity. Prompt subtitles use the same format,
  // but anchor First/Latest to the earliest/latest real user-authored prompt.
  function ageLabel(s){ return ageLabelAt(s&&s.lastTs,s&&s.ageDays); }
  function promptAgeLabel(s,which){
    var times=validPromptTs(s),t=null;
    if(times.length) t=which==='first' ? Math.min.apply(null,times) : Math.max.apply(null,times);
    else if(s) t=s.lastTs;
    return ageLabelAt(t,s&&s.ageDays)||'—';
  }
  function savedForkParents(){
    if(!VAULT_STATE || typeof VAULT_STATE!=='object') VAULT_STATE={};
    if(!VAULT_STATE.forkParents || typeof VAULT_STATE.forkParents!=='object' || Array.isArray(VAULT_STATE.forkParents)) VAULT_STATE.forkParents={};
    return VAULT_STATE.forkParents;
  }
  function forkNodeId(s){
    if(!s) return '';
    return providerSessionId(s) || String(s.sessionId||'');
  }
  function forkSessionForId(id){
    var found=findSessionById(id);
    if(found) return found;
    return forkTreeSessionCache[id] || null;
  }
  function forkParentMap(){
    var raw=savedForkParents(), out={};
    Object.keys(raw).forEach(function(child){
      var parent=typeof raw[child]==='string' ? raw[child].trim() : '';
      child=String(child||'').trim();
      if(child && parent && child!==parent) out[child]=parent;
    });
    SESS.forEach(function(s){
      var child=forkNodeId(s);
      var parent=String((s&&s.forkParentId)||(s&&s.pendingFork&&s.pendingFork.parent)||'').trim();
      if(child && parent && child!==parent) out[child]=parent;
    });
    return out;
  }
  function rememberForkRelation(child, parent){
    child=String(child||'').trim(); parent=String(parent||'').trim();
    if(!child || !parent || child===parent) return;
    savedForkParents()[child]=parent;
  }
  function forkComponentIds(s){
    var start=typeof s==='string' ? s : forkNodeId(s);
    if(!start) return [];
    var parents=forkParentMap(), children={};
    Object.keys(parents).forEach(function(child){
      var parent=parents[child];
      if(!children[parent]) children[parent]=[];
      children[parent].push(child);
    });
    var seen={}, queue=[start], out=[];
    while(queue.length){
      var id=queue.shift();
      if(!id || seen[id]) continue;
      seen[id]=true; out.push(id);
      if(parents[id]) queue.push(parents[id]);
      (children[id]||[]).forEach(function(child){ queue.push(child); });
    }
    return out;
  }
  function forkTreeLayout(s){
    var ids=forkComponentIds(s), parents=forkParentMap(), inTree={};
    ids.forEach(function(id){ inTree[id]=true; });
    var children={};
    ids.forEach(function(id){
      var parent=parents[id];
      if(parent && inTree[parent]){
        if(!children[parent]) children[parent]=[];
        children[parent].push(id);
      }
    });
    Object.keys(children).forEach(function(id){
      children[id].sort(function(a,b){
        var sa=forkSessionForId(a), sb=forkSessionForId(b);
        return Number((sa&&sa.lastTs)||0)-Number((sb&&sb.lastTs)||0);
      });
    });
    var roots=ids.filter(function(id){ return !parents[id] || !inTree[parents[id]]; });
    if(!roots.length && ids.length) roots=[ids[0]];
    var nodeW=300,nodeH=112,columnStep=364,rowStep=134;
    var positions={}, visiting={}, visited={}, leaf=0;
    function place(id, depth){
      if(positions[id]) return positions[id].y;
      if(visiting[id]) return leaf++*rowStep;
      visiting[id]=true;
      var ys=[];
      (children[id]||[]).forEach(function(child){
        if(!visiting[child]) ys.push(place(child,depth+1));
      });
      var y=ys.length ? ys.reduce(function(sum,n){ return sum+n; },0)/ys.length : leaf++*rowStep;
      positions[id]={id:id,x:40+depth*columnStep,y:36+y,depth:depth};
      visiting[id]=false; visited[id]=true;
      return y;
    }
    roots.forEach(function(id){ place(id,0); });
    ids.forEach(function(id){ if(!visited[id]) place(id,0); });
    var nodes=ids.map(function(id){ return positions[id]; }).filter(Boolean);
    var edges=[];
    ids.forEach(function(id){
      var parent=parents[id];
      if(parent && positions[parent] && positions[id]) edges.push({from:positions[parent],to:positions[id]});
    });
    var maxX=0,maxY=0;
    nodes.forEach(function(node){ maxX=Math.max(maxX,node.x); maxY=Math.max(maxY,node.y); });
    return { ids:ids, nodes:nodes, edges:edges, nodeW:nodeW, nodeH:nodeH, width:Math.max(404,maxX+nodeW+40), height:Math.max(264,maxY+nodeH+40) };
  }
  function forkTreeMini(s){
    var layout=forkTreeLayout(s), ns='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(ns,'svg');
    svg.setAttribute('class','forktree-mini'); svg.setAttribute('viewBox','0 0 38 18'); svg.setAttribute('aria-hidden','true');
    if(!layout.nodes.length) return svg;
    var xs=layout.nodes.map(function(n){return n.x;}), ys=layout.nodes.map(function(n){return n.y;});
    var minX=Math.min.apply(null,xs), maxX=Math.max.apply(null,xs), minY=Math.min.apply(null,ys), maxY=Math.max.apply(null,ys);
    function px(n){ return maxX===minX ? 19 : 4+(n-minX)/(maxX-minX)*30; }
    function py(n){ return maxY===minY ? 9 : 3+(n-minY)/(maxY-minY)*12; }
    layout.edges.forEach(function(edge){
      var path=document.createElementNS(ns,'path');
      var x1=px(edge.from.x),y1=py(edge.from.y),x2=px(edge.to.x),y2=py(edge.to.y),mid=(x1+x2)/2;
      path.setAttribute('d','M '+x1+' '+y1+' C '+mid+' '+y1+', '+mid+' '+y2+', '+x2+' '+y2);
      svg.appendChild(path);
    });
    var current=forkNodeId(s);
    layout.nodes.forEach(function(node){
      var dot=document.createElementNS(ns,'circle');
      dot.setAttribute('cx',String(px(node.x))); dot.setAttribute('cy',String(py(node.y)));
      dot.setAttribute('r',node.id===current?'2.6':'1.65');
      if(node.id===current) dot.setAttribute('class','current');
      svg.appendChild(dot);
    });
    return svg;
  }
  function configureForkTreeTrigger(button, s, knownCount){
    if(!button) return;
    var count=knownCount==null ? (button._forkCount==null ? forkComponentIds(s).length : button._forkCount) : knownCount;
    button.hidden=count<2;
    button.innerHTML='';
    if(count<2){ button.onclick=null; button.removeAttribute('data-hover-tip'); return; }
    button.appendChild(forkTreeMini(s));
    button.setAttribute('data-hover-tip','View fork tree · '+count+' sessions');
    button.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); openForkTree(s); };
  }
  function syncHeaderForkTree(){ configureForkTreeTrigger(byId('forkTreeBtn'),cur); }
  function applyForkTreeTransform(){
    var pan=byId('forkTreePan'),stage=byId('forkTreeStage'); if(!pan||!stage) return;
    var scale=Number(forkTreeView.scale)||1;
    // Scale tree geometry, then counter-scale each node's content. The cards get
    // physically larger/smaller while text stays readable; zooming in therefore
    // exposes more of long titles, prompts, tags, and context instead of merely
    // magnifying the same clipped text.
    pan.style.transform='translate('+Math.round(forkTreeView.x)+'px,'+Math.round(forkTreeView.y)+'px)';
    stage.style.transform='scale('+scale+')';
    stage.style.setProperty('--forktree-content-scale',String(1/scale));
    stage.style.setProperty('--forktree-content-size',String(scale*100)+'%');
  }
  function fitForkTree(){
    var viewport=byId('forkTreeViewport'); if(!viewport || !forkTreeView.width || !forkTreeView.height) return;
    var vw=viewport.clientWidth, vh=viewport.clientHeight;
    var scale=Math.min(1.15,Math.max(0.35,Math.min((vw-48)/forkTreeView.width,(vh-48)/forkTreeView.height)));
    forkTreeView.scale=scale;
    forkTreeView.x=(vw-forkTreeView.width*scale)/2;
    forkTreeView.y=(vh-forkTreeView.height*scale)/2;
    applyForkTreeTransform();
  }
  function zoomForkTree(factor, clientX, clientY){
    var viewport=byId('forkTreeViewport'); if(!viewport) return;
    var rect=viewport.getBoundingClientRect();
    var ax=clientX==null ? rect.width/2 : clientX-rect.left;
    var ay=clientY==null ? rect.height/2 : clientY-rect.top;
    var next=Math.max(0.3,Math.min(2.4,forkTreeView.scale*factor));
    var worldX=(ax-forkTreeView.x)/forkTreeView.scale, worldY=(ay-forkTreeView.y)/forkTreeView.scale;
    forkTreeView.scale=next;
    forkTreeView.x=ax-worldX*next; forkTreeView.y=ay-worldY*next;
    applyForkTreeTransform();
  }
  function fetchForkTreeSession(id){
    var known=forkSessionForId(id);
    if(known) return Promise.resolve(known);
    return fetch('/session/view?session='+encodeURIComponent(id)).then(function(r){return r.json();}).then(function(res){
      if(res&&res.view){ forkTreeSessionCache[id]=res.view; return res.view; }
      return null;
    }).catch(function(){ return null; });
  }
  function selectForkTreeSession(id){
    fetchForkTreeSession(id).then(function(s){
      if(!s) return;
      if(!findSessionById(id)){ SESS.push(s); sortSessions(); }
      var parent=s.forkParentId&&findSessionById(s.forkParentId);
      if(parent&&!chatGroupForSession(s)) groupChatSession(parent,s);
      closeForkTree(); select(s);
    });
  }
  function renderForkTreeStage(s){
    var stage=byId('forkTreeStage'); if(!stage) return;
    var layout=forkTreeLayout(s), ns='http://www.w3.org/2000/svg';
    stage.innerHTML=''; stage.style.width=layout.width+'px'; stage.style.height=layout.height+'px';
    forkTreeView.width=layout.width; forkTreeView.height=layout.height;
    var svg=document.createElementNS(ns,'svg');
    svg.setAttribute('class','forktree-edges'); svg.setAttribute('width',String(layout.width)); svg.setAttribute('height',String(layout.height));
    layout.edges.forEach(function(edge){
      var path=document.createElementNS(ns,'path');
      var x1=edge.from.x+layout.nodeW,y1=edge.from.y+layout.nodeH/2,x2=edge.to.x,y2=edge.to.y+layout.nodeH/2,mid=(x1+x2)/2;
      path.setAttribute('class','forktree-edge');
      path.setAttribute('d','M '+x1+' '+y1+' C '+mid+' '+y1+', '+mid+' '+y2+', '+x2+' '+y2);
      svg.appendChild(path);
    });
    stage.appendChild(svg);
    var current=typeof s==='string' ? s : forkNodeId(s);
    layout.nodes.forEach(function(node){
      var session=forkSessionForId(node.id);
      var st=session ? statusState(session) : 'read';
      var button=el('button','forktree-node'+(node.id===current?' current':'')+(!session?' missing':''));
      button.type='button'; button.style.left=node.x+'px'; button.style.top=node.y+'px'; button.disabled=!session;
      button.setAttribute('data-forktree-node-id',node.id);
      var content=el('div','forktree-node-content');
      var head=el('div','forktree-node-head');
      var dot=el('span','forktree-node-dot it-status '+st);
      dot.title=session ? statusLabel(st) : 'session unavailable';
      head.appendChild(dot);
      var title=session ? sessionTitleText(session) : node.id;
      var titleNode=el('span','forktree-node-title');
      if(session) renderSessionTitle(titleNode,session,'forktree-node-title');
      else titleNode.textContent=title;
      head.appendChild(titleNode);
      if(session){
        var commentBadge=el('span','it-comment');
        head.appendChild(commentBadge);
        paintSessionCommentBadge(commentBadge,session);
      }
      if(session && ageLabel(session)) head.appendChild(el('span','forktree-node-age',ageLabel(session)));
      content.appendChild(head);
      if(session){
        var signals=el('div','forktree-node-signals it-meta');
        renderSessionSignals(signals,session);
        if(signals.childNodes.length) content.appendChild(signals);
        var promptTail=null;
        if(session.title){ promptTail=sessionPromptLine('it-firstline','First',session.title,null,promptAgeLabel(session,'first')); content.appendChild(promptTail); }
        promptTail=appendLatestPrompt(content, session, 'it-firstline')||promptTail;
        var queueBadge=el('span','it-queue');
        if(promptTail){ promptTail.classList.add('with-tail'); promptTail.appendChild(queueBadge); }
        else content.appendChild(queueBadge);
        paintSessionQueueBadge(queueBadge,session);
        var foot=el('div','forktree-node-foot it-footrow');
        var tags=el('div','it-tags');
        (session.tags||[]).slice(0,3).forEach(function(tag){ var def=userTagDef(tag); if(def) tags.appendChild(tagChip(def,false)); });
        if((session.tags||[]).length>3) tags.appendChild(el('span','it-tag','+'+((session.tags||[]).length-3)));
        foot.appendChild(tags);
        foot.appendChild(sessionContextRow(session));
        content.appendChild(foot);
      } else content.appendChild(el('span','forktree-node-missing','session unavailable'));
      button.appendChild(content);
      button.setAttribute('data-hover-tip',title);
      if(session) button.onclick=function(ev){ ev.stopPropagation(); selectForkTreeSession(node.id); };
      stage.appendChild(button);
    });
    var count=byId('forkTreeCount'); if(count) count.textContent=layout.ids.length+' sessions';
    return layout;
  }
  function hydrateForkTreeSessions(ids){
    var missing=ids.filter(function(id){ return !forkSessionForId(id); });
    if(!missing.length) return;
    Promise.all(missing.map(fetchForkTreeSession)).then(function(){
      var overlay=byId('forkTree');
      if(!overlay || overlay.hidden || !forkTreeFocusId) return;
      var focus=forkSessionForId(forkTreeFocusId) || forkTreeFocusId;
      renderForkTreeStage(focus);
      applyForkTreeTransform();
    });
  }
  function openForkTree(s){
    if(!s || forkComponentIds(s).length<2) return;
    var overlay=byId('forkTree'); if(!overlay) return;
    forkTreeFocusId=forkNodeId(s);
    overlay.hidden=false; overlay.setAttribute('aria-hidden','false');
    var layout=renderForkTreeStage(s);
    requestAnimationFrame(function(){ fitForkTree(); });
    hydrateForkTreeSessions(layout.ids);
  }
  function closeForkTree(){
    var overlay=byId('forkTree'); if(!overlay) return;
    overlay.hidden=true; overlay.setAttribute('aria-hidden','true'); forkTreeFocusId=''; forkTreeView.dragging=false;
  }
  function liveClock(ms){
    var total=Math.max(0,Math.floor((Number(ms)||0)/1000));
    var sec=total%60, min=Math.floor(total/60)%60, hour=Math.floor(total/3600);
    var two=function(n){ return n<10 ? '0'+n : String(n); };
    return hour>0 ? hour+':'+two(min)+':'+two(sec) : Math.floor(total/60)+':'+two(sec);
  }
  function activeGenerationTiming(s, startedAt, now){
    now=Number(now)||Date.now();
    var started=Number(startedAt)||now;
    var last=Number(s&&s.lastAssistantOutputAt)||0;
    var hasOutput=last>=started && last<=now+1000;
    var quietFrom=hasOutput ? last : started;
    return {
      started:started,
      hasOutput:hasOutput,
      quietSec:Math.max(0,Math.floor((now-quietFrom)/1000)),
      totalText:liveClock(now-started),
      quietText:liveClock(now-quietFrom)
    };
  }
  function activeGenerationTimingText(timing){
    return 'generating '+timing.totalText+' · '+(timing.hasOutput?'quiet ':'waiting ')+timing.quietText;
  }
  function makeLiveTimingEntry(s){
    var row=el('div','it-live');
    row.hidden=!s.generating && s.lastGenerationDurationMs==null;
    row.setAttribute('data-hover-tip','Live turn duration · time since the latest assistant or tool activity');
    var total=el('span','it-live-total');
    var totalLabel=el('span','it-live-label');
    var totalTime=el('span','it-live-time');
    total.appendChild(totalLabel); total.appendChild(totalTime);
    var sep=el('span','it-live-sep','·');
    var quiet=el('span','it-live-quiet');
    var quietLabel=el('span','it-live-label');
    var quietTime=el('span','it-live-time');
    quiet.appendChild(quietLabel); quiet.appendChild(quietTime);
    row.appendChild(total); row.appendChild(sep); row.appendChild(quiet);
    var entry={row:row,totalLabel:totalLabel,totalTime:totalTime,sep:sep,quiet:quiet,quietLabel:quietLabel,quietTime:quietTime,session:s};
    // Virtualized sidebar rows can leave and re-enter the DOM. Keep the entry on
    // its own node so it can be re-registered without rebuilding the whole row.
    row._liveTimingEntry=entry;
    return entry;
  }
  function registerLiveTiming(entry){
    var s=entry&&entry.session;
    if(!s||!s.sessionId) return;
    if(!Array.isArray(liveTimingEls[s.sessionId])) liveTimingEls[s.sessionId]=[];
    if(liveTimingEls[s.sessionId].indexOf(entry)<0) liveTimingEls[s.sessionId].push(entry);
  }
  function syncLiveTimingEntry(entry, s, now){
    if(!entry||!s) return;
    var active=!!s.generating;
    var completed=Number(s.lastGenerationDurationMs);
    var hasCompleted=!active && isFinite(completed) && completed>=0;
    entry.row.hidden=!active && !hasCompleted;
    var outcome=hasCompleted ? (s.lastGenerationOutcome||'generated') : 'active';
    entry.row.className='it-live '+outcome;
    entry.sep.hidden=!active;
    entry.quiet.hidden=!active;
    if(hasCompleted){
      entry.totalLabel.textContent=outcome;
      entry.totalTime.textContent=liveClock(completed);
      entry.row.setAttribute('aria-label',outcome+' '+entry.totalTime.textContent);
      return;
    }
    if(!active) return;
    now=Number(now)||Date.now();
    var timing=activeGenerationTiming(s,s.generatingStartedAt,now);
    if(!s.generatingStartedAt) s.generatingStartedAt=timing.started;
    entry.totalLabel.textContent='generating';
    entry.totalTime.textContent=timing.totalText;
    entry.quietLabel.textContent=timing.hasOutput?'quiet':'waiting';
    entry.quietTime.textContent=timing.quietText;
    entry.quiet.className='it-live-quiet'+(timing.quietSec>=300?' hot':timing.quietSec>=120?' warm':'');
    entry.row.setAttribute('aria-label','generating '+entry.totalTime.textContent+'; '+entry.quietLabel.textContent+' '+entry.quietTime.textContent);
  }
  function syncLiveTiming(s, now){
    var entries=s&&s.sessionId&&liveTimingEls[s.sessionId];
    if(!Array.isArray(entries)) return;
    entries.forEach(function(entry){ syncLiveTimingEntry(entry,s,now); });
  }
  function finishGenerationTiming(s, endedAt, outcome){
    if(!s) return;
    var started=Number(s.generatingStartedAt)||0;
    var ended=Number(endedAt)||Date.now();
    if(started>0) s.lastGenerationDurationMs=Math.max(0,ended-started);
    s.lastGenerationOutcome=outcome||'generated';
    s.analysisPending=true;
    syncLiveTiming(s,ended);
  }
  function generationOutcome(ev){
    if(!ev) return 'generated';
    if(ev.kind==='error') return 'failed';
    if(ev.kind==='result' && ev.ok===false){
      return /interrupt|abort|stop/i.test(String(ev.text||'')) ? 'stopped' : 'failed';
    }
    return 'generated';
  }
  function tickLiveTimings(){
    var now=Date.now();
    pruneLiveTimingRegistrations();
    Object.keys(liveTimingEls).forEach(function(id){
      (liveTimingEls[id]||[]).forEach(function(entry){ syncLiveTimingEntry(entry,entry.session,now); });
    });
  }
  function pruneLiveTimingRegistrations(){
    Object.keys(liveTimingEls).forEach(function(id){
      liveTimingEls[id]=(liveTimingEls[id]||[]).filter(function(entry){ return entry&&entry.row&&entry.row.isConnected; });
      if(!liveTimingEls[id].length) delete liveTimingEls[id];
    });
  }
  // Sidebar status dot — two orthogonal axes folded into one indicator:
  //   generating (violet spinning ring) = a turn is running (not your turn)
  //   unread     (solid green)        = a turn ended in the background     → "new, look at me"
  //   seen       (blue hollow ring)    = tracked / in progress             → "still open"
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
  function syncForkTreeNodeStatus(s){
    var overlay=byId('forkTree'), stage=byId('forkTreeStage');
    if(!overlay || overlay.hidden || !stage || !s) return;
    var id=forkNodeId(s);
    if(!id) return;
    var node=null;
    Array.prototype.some.call(stage.querySelectorAll('.forktree-node'),function(item){
      if(item.getAttribute('data-forktree-node-id')!==id) return false;
      node=item; return true;
    });
    if(!node) return;
    var st=statusState(s), dot=node.querySelector('.forktree-node-dot');
    node.classList.toggle('missing',false);
    if(dot){ dot.className='forktree-node-dot it-status '+st; dot.title=statusLabel(st); }
  }
  function sessionPanelNodes(s,selector){
    return sessionPanelRows(s).reduce(function(out,row){
      var node=row.querySelector(selector); if(node) out.push(node);
      return out;
    },[]);
  }
  function sessionPanelRows(s){
    var host=byId('sessionPanelList'),id=String(s&&s.sessionId||'');
    if(!host||!id) return [];
    return Array.prototype.filter.call(host.querySelectorAll('.item[data-session-id]'),function(row){ return row.getAttribute('data-session-id')===id; });
  }
  function sessionReadRailRatio(unreadRatio){
    var ratio=Math.max(0,Math.min(1,Number(unreadRatio)||0));
    // Amplify the unread tail of a turn so the final, usually most important,
    // assistant paragraphs remain visible on the card rail.
    return Math.log(1+9*ratio)/Math.log(10);
  }
  function paintSessionReadProgress(bar,s){
    if(!bar||!s) return;
    var state=savedSessionScrollState(s);
    var top=Number(state&&state.top)||0,max=Number(state&&state.max)||0;
    var ratio=Number(state&&state.unreadRatio);
    var visible=!!(!s.generating&&top>1&&max-top>=80&&isFinite(ratio)&&ratio>0);
    bar.hidden=!visible;
    if(visible){
      var railRatio=sessionReadRailRatio(ratio);
      var percent=railRatio*100;
      bar.style.height=percent.toFixed(2)+'%';
      bar.setAttribute('data-unread-ratio',String(ratio));
      bar.setAttribute('data-rail-ratio',String(railRatio));
    } else {
      bar.style.height='';
      bar.removeAttribute('data-unread-ratio');
      bar.removeAttribute('data-rail-ratio');
    }
  }
  function syncSessionReadProgress(s){
    if(!s||!s.sessionId) return;
    var dot=statusEls[s.sessionId],row=dot&&dot.closest&&dot.closest('.item');
    if(row) paintSessionReadProgress(row.querySelector('.session-read-progress'),s);
    sessionPanelNodes(s,'.session-read-progress').forEach(function(bar){ paintSessionReadProgress(bar,s); });
  }
  function paintSessionPanelRowStatus(row,s){
    if(!row) return;
    ['generating','unread','seen','read'].forEach(function(state){ row.classList.toggle('session-status-'+state,statusState(s)===state); });
  }
  function applyGenerating(s){
    if(!s) return;
    var d=s.sessionId&&statusEls[s.sessionId];
    var st=statusState(s);
    if(d){ d.className='it-status '+st; d.title=sidebarStatusTitle(st); }
    sessionPanelNodes(s,'.it-status').forEach(function(dot){ dot.className='it-status '+st; dot.title=sidebarStatusTitle(st); });
    sessionPanelRows(s).forEach(function(row){ paintSessionPanelRowStatus(row,s); });
    syncSessionReadProgress(s);
    syncForkTreeNodeStatus(s);
    syncLiveTiming(s);
    if(cur && s && cur.sessionId===s.sessionId) syncHeaderStatus(s);
  }
  function sessionQueueState(s){
    var liveId=providerSessionId(s), queues=latestLiveSnapshot&&latestLiveSnapshot.queues||{};
    var info=liveId&&queues[liveId];
    var base=info ? {count:Math.max(0,Number(info.count)||0),parked:info.parked===true}
      : {count:Math.max(0,Number(s&&s.queueCount)||0),parked:!!(s&&s.queueParked)};
    var scheduled=scheduledItemsForSession(s).length;
    return {count:base.count+scheduled,parked:base.parked,scheduled:scheduled,queued:base.count};
  }
  function paintSessionQueueBadge(badge,s){
    if(!badge || !s) return;
    var state=sessionQueueState(s), count=state.count, parked=state.parked;
    badge.hidden=count<1;
    badge.className='it-queue'+(parked?' parked':'');
    badge.innerHTML='';
    badge.appendChild(el('span','it-queue-count',String(count)));
    var onlyScheduled=state.scheduled>0&&state.queued===0;
    badge.appendChild(el('span','it-queue-label',parked?'held':onlyScheduled?'scheduled':'queued'));
    var description=onlyScheduled ? count+' scheduled action'+(count===1?'':'s') : count+' queued action'+(count===1?'':'s');
    badge.setAttribute('data-hover-tip',description+(parked?' · paused after Stop':onlyScheduled?'':' · will continue automatically'));
    badge.setAttribute('aria-label',description+(parked?', paused':''));
  }
  function paintSessionTodoBadge(badge,s){
    if(!badge || !s) return;
    var count=openTodoCount(s);
    badge.hidden=count<1;
    badge.innerHTML='';
    badge.appendChild(el('span','it-todo-count',String(count)));
    badge.appendChild(el('span','it-todo-label','todo'));
    badge.setAttribute('data-hover-tip',count+' open todo'+(count===1?'':'s'));
    badge.setAttribute('aria-label',count+' open todo'+(count===1?'':'s'));
  }
  function syncSessionQueueBadge(s){
    if(!s || !s.sessionId) return;
    paintSessionQueueBadge(queueEls[s.sessionId],s);
    sessionPanelNodes(s,'.it-queue').forEach(function(badge){ paintSessionQueueBadge(badge,s); });
    syncForkTreeNodeWorkBadges(s);
  }
  function sidebarCommentThreadsForSession(s){
    if(!s) return [];
    return Object.keys(commentThreads).map(function(key){
      var thread=commentThreads[key];
      return thread && commentBelongsToSession(thread,s) ? thread : null;
    }).filter(Boolean).sort(function(a,b){
      var generatingOrder=Number(b.status==='generating')-Number(a.status==='generating');
      var unreadOrder=Number(b.status==='unread')-Number(a.status==='unread');
      return generatingOrder || unreadOrder || Number(b.lastUserMessageAt||b.createdAt||0)-Number(a.lastUserMessageAt||a.createdAt||0);
    });
  }
  function openSidebarCommentForSession(s){
    var thread=sidebarCommentThreadsForSession(s)[0];
    if(!thread) return;
    var tree=byId('forkTree');
    if(tree && !tree.hidden) closeForkTree();
    if(cur!==s) select(s);
    openCommentThread(thread,null);
  }
  function paintSessionCommentBadge(badge,s){
    if(!badge || !s) return;
    var threads=sidebarCommentThreadsForSession(s), threadCount=threads.length;
    var generatingCount=threads.filter(function(thread){ return thread.status==='generating'; }).length;
    var unreadCount=threads.filter(function(thread){ return thread.status==='unread'; }).length;
    badge.hidden=threadCount<1;
    badge.classList.toggle('generating',generatingCount>0);
    badge.classList.toggle('unread',unreadCount>0&&generatingCount===0);
    badge.classList.toggle('read',threadCount>0&&unreadCount===0&&generatingCount===0);
    badge.innerHTML='';
    if(generatingCount){
      var spinner=el('span','comment-action-spinner it-comment-spinner');
      spinner.setAttribute('aria-hidden','true'); badge.appendChild(spinner);
    } else {
      var icon=svgIcon('comment'); icon.setAttribute('class','comment-action-icon it-comment-icon'); badge.appendChild(icon);
    }
    if(unreadCount) badge.appendChild(el('span','it-comment-count',String(unreadCount)));
    var stateLabel=generatingCount
      ? generatingCount+' comment repl'+(generatingCount===1?'y':'ies')+' generating'+(unreadCount?' · '+unreadCount+' unread':'')
      : unreadCount
        ? unreadCount+' unread comment thread'+(unreadCount===1?'':'s')
        : threadCount+' comment thread'+(threadCount===1?'':'s');
    badge.setAttribute('data-hover-tip',stateLabel+' · open comment panel');
    badge.setAttribute('aria-label',stateLabel);
    badge.setAttribute('role','button'); badge.tabIndex=0;
    // Keep a focused composer from blurring before click. Its blur handler
    // rebuilds the sidebar, which would detach this badge and drop the click.
    badge.onpointerdown=function(ev){
      if((ev.pointerType && ev.pointerType!=='mouse') || ev.button!==0) return;
      ev.preventDefault(); ev.stopPropagation();
    };
    badge.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); openSidebarCommentForSession(s); };
    badge.onkeydown=function(ev){ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); ev.stopPropagation(); openSidebarCommentForSession(s); } };
  }
  function syncSessionCommentBadge(s){
    if(!s || !s.sessionId) return;
    paintSessionCommentBadge(commentEls[s.sessionId],s);
    sessionPanelNodes(s,'.it-comment').forEach(function(badge){ paintSessionCommentBadge(badge,s); });
    syncForkTreeNodeWorkBadges(s);
  }
  function syncForkTreeNodeWorkBadges(s){
    var stage=byId('forkTreeStage'), id=forkNodeId(s); if(!stage || !id) return;
    Array.prototype.some.call(stage.querySelectorAll('.forktree-node'),function(node){
      if(node.getAttribute('data-forktree-node-id')!==id) return false;
      paintSessionCommentBadge(node.querySelector('.it-comment'),s);
      paintSessionQueueBadge(node.querySelector('.it-queue'),s);
      return true;
    });
  }
  function syncAllSessionCommentBadges(){
    SESS.forEach(syncSessionCommentBadge);
  }
  function syncHeaderStatus(s){
    var dot=byId('h-status'); if(!dot) return;
    var st=s ? statusState(s) : 'read';
    dot.className='headstatus it-status '+st;
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
  function attentionRank(st){ return st==='unread' ? 2 : st==='seen' ? 1 : 0; }
  // Re-flagging a dismissed / less-active session (read→seen, →unread) via the dot
  // is a deliberate "this is live again" action — treat it like fresh input and
  // pull it to the top of the recent sort. Only the sort anchor moves, not lastTs,
  // so the "Xh ago" display stays honest (no real message was sent). Dismissing
  // (→read) or acknowledging (unread→seen) never bumps.
  function applyDotToggle(s, next){
    if(!s) return;
    var prev=attentionState(s);
    setAttentionState(s, next);
    if(attentionRank(next) > attentionRank(prev)) touchSession(s);
  }
  // Sidebar dot: list management. Clicking green/unread marks the session done;
  // clicking gray puts it back in progress. Reversible; a later turn-end still
  // re-arms green.
  // No-op mid-turn — the pulse isn't a state you can toggle.
  function toggleStatus(s){
    if(!s || s.generating) return;
    applyDotToggle(s, (s.unread || s.seen) ? 'read' : 'seen'); // dismiss → read, else flag → seen
  }
  // Header dot: current-chat reading state. It lets you bump an already-open
  // session back to unread after opening demoted it to seen.
  function toggleHeaderStatus(s){
    if(!s || s.generating) return;
    if(s.unread) applyDotToggle(s, 'seen');
    else applyDotToggle(s, attentionState(s)==='read' ? 'seen' : 'unread');
  }
  function isSessionRowControl(target, row){
    var node=target;
    while(node && node!==row){
      if((node.matches && node.matches('button,input,textarea,select,a,label')) || typeof node.onclick==='function') return true;
      node=node.parentElement;
    }
    return false;
  }
  var SIDEBAR_VIRTUAL_THRESHOLD=80;
  var SIDEBAR_ROW_ESTIMATE=132;
  var SIDEBAR_PIN_DIVIDER_HEIGHT=13;
  var SIDEBAR_OVERSCAN_PX=650;
  var SIDEBAR_ROW_CACHE_LIMIT=160;
  var SESSION_PANEL_VIRTUAL_THRESHOLD=60;
  var SESSION_PANEL_ROW_ESTIMATE=178;
  var SESSION_PANEL_OVERSCAN_PX=650;
  var sidebarVisibleSessions=[];
  var sidebarHeightByKey={};
  var sidebarRowCache={};
  var sidebarRowUse=0;
  var sidebarVirtualRaf=0;
  var sidebarRenderRaf=0;
  var sidebarForkSizes={};
  var sessionPanelVirtualState=null;
  var sessionPanelVirtualRaf=0;
  var sessionPanelRowHeights={};
  var sessionPanelCardCache={};
  function sidebarSessionKey(s,index){
    return searchKeyFor(s)||('row:'+index+':'+String(s&&s.vendor||''));
  }
  function indexSidebarForkComponents(){
    var parents=forkParentMap(), roots={}, sizes={};
    function add(id){ if(id && roots[id]==null) roots[id]=id; }
    function find(id){
      add(id);
      var root=id;
      while(roots[root]!==root) root=roots[root];
      while(roots[id]!==id){ var next=roots[id]; roots[id]=root; id=next; }
      return root;
    }
    function join(a,b){
      if(!a||!b) return;
      var ar=find(a),br=find(b); if(ar!==br) roots[br]=ar;
    }
    Object.keys(parents).forEach(function(child){ add(child); add(parents[child]); join(child,parents[child]); });
    SESS.forEach(function(s){ add(forkNodeId(s)); });
    Object.keys(roots).forEach(function(id){ var root=find(id); sizes[root]=(sizes[root]||0)+1; });
    var out={}; Object.keys(roots).forEach(function(id){ out[id]=sizes[find(id)]||1; });
    sidebarForkSizes=out;
  }
  function sidebarForkCount(s){ return sidebarForkSizes[forkNodeId(s)]||1; }
  function retainedHeaderLiveTimings(){
    var headerSignals=byId('h-sig'),panelList=byId('sessionPanelList'),retained={};
    Object.keys(liveTimingEls).forEach(function(id){
      var entries=(liveTimingEls[id]||[]).filter(function(entry){
        return entry&&entry.row&&entry.row.isConnected&&((headerSignals&&headerSignals.contains(entry.row))||(panelList&&panelList.contains(entry.row)));
      });
      if(entries.length) retained[id]=entries;
    });
    return retained;
  }
  function resetSidebarRegistrations(){
    titleEls={}; statusEls={}; queueEls={}; commentEls={}; liveTimingEls=retainedHeaderLiveTimings();
  }
  function registerSidebarRow(item,s){
    if(!item||!s||!s.sessionId) return;
    var id=s.sessionId;
    titleEls[id]=item.querySelector('.it-title');
    statusEls[id]=item.querySelector('.it-status');
    queueEls[id]=item.querySelector('.it-queue');
    commentEls[id]=item.querySelector('.it-comment');
    Array.prototype.forEach.call(item.querySelectorAll('.it-live'),function(node){
      if(node._liveTimingEntry) registerLiveTiming(node._liveTimingEntry);
    });
    applyGenerating(s);
    paintSessionQueueBadge(queueEls[id],s);
    paintSessionCommentBadge(commentEls[id],s);
    paintSessionTodoBadge(item.querySelector('.it-todo'),s);
    paintSessionReadProgress(item.querySelector('.session-read-progress'),s);
  }
  function pruneSidebarRowCache(activeKeys){
    var keys=Object.keys(sidebarRowCache);
    if(keys.length<=SIDEBAR_ROW_CACHE_LIMIT) return;
    keys.filter(function(key){ return !activeKeys[key]; })
      .sort(function(a,b){ return sidebarRowCache[a].used-sidebarRowCache[b].used; })
      .slice(0,keys.length-SIDEBAR_ROW_CACHE_LIMIT)
      .forEach(function(key){ delete sidebarRowCache[key]; });
  }
  function cachedSidebarRow(s,index){
    var key=sidebarSessionKey(s,index), cached=sidebarRowCache[key];
    if(!cached || cached.session!==s){ cached={node:buildSessionRow(s,'sidebar'),session:s,used:0}; sidebarRowCache[key]=cached; }
    cached.used=++sidebarRowUse;
    cached.node.setAttribute('data-sidebar-key',key);
    return cached.node;
  }
  function sidebarOffsets(){
    var offsets=[0],total=0,boundary=sessionPinBoundaryIndex(sidebarVisibleSessions);
    for(var i=0;i<sidebarVisibleSessions.length;i++){
      if(i===boundary) total+=SIDEBAR_PIN_DIVIDER_HEIGHT;
      total+=sidebarHeightByKey[sidebarSessionKey(sidebarVisibleSessions[i],i)]||SIDEBAR_ROW_ESTIMATE;
      offsets.push(total);
    }
    return offsets;
  }
  function sidebarOffsetIndex(offsets,pixel){
    var low=0,high=Math.max(0,offsets.length-2);
    while(low<high){ var mid=Math.floor((low+high)/2); if(offsets[mid+1]<pixel) low=mid+1; else high=mid; }
    return low;
  }
  function measureSidebarRows(list){
    var changed=false;
    Array.prototype.forEach.call(list.querySelectorAll('.item[data-sidebar-key]'),function(item){
      var key=item.getAttribute('data-sidebar-key'),height=item.offsetHeight;
      if(key&&height>0&&Math.abs((sidebarHeightByKey[key]||0)-height)>1){ sidebarHeightByKey[key]=height; changed=true; }
    });
    if(changed) scheduleSidebarWindow();
  }
  function renderSidebarWindow(){
    var list=byId('list');
    if(!list||!list.classList.contains('virtualized')) return;
    var offsets=sidebarOffsets(),top=Math.max(0,list.scrollTop-SIDEBAR_OVERSCAN_PX);
    var bottom=list.scrollTop+Math.max(list.clientHeight,600)+SIDEBAR_OVERSCAN_PX;
    var start=sidebarOffsetIndex(offsets,top),end=Math.min(sidebarVisibleSessions.length,sidebarOffsetIndex(offsets,bottom)+1);
    var fragment=document.createDocumentFragment(),activeKeys={},boundary=sessionPinBoundaryIndex(sidebarVisibleSessions);
    var topSpacer=el('div','sidebar-spacer'); topSpacer.style.height=offsets[start]+'px'; fragment.appendChild(topSpacer);
    resetSidebarRegistrations();
    for(var i=start;i<end;i++){
      if(i===boundary) fragment.appendChild(buildSessionPinDivider('sidebar'));
      var s=sidebarVisibleSessions[i],key=sidebarSessionKey(s,i),item=cachedSidebarRow(s,i);
      activeKeys[key]=true; fragment.appendChild(item); registerSidebarRow(item,s);
    }
    var bottomSpacer=el('div','sidebar-spacer'); bottomSpacer.style.height=Math.max(0,offsets[offsets.length-1]-offsets[end])+'px'; fragment.appendChild(bottomSpacer);
    list.replaceChildren(fragment);
    pruneSidebarRowCache(activeKeys);
    window.requestAnimationFrame(function(){ if(list.isConnected) measureSidebarRows(list); });
  }
  function scheduleSidebarWindow(){
    if(sidebarVirtualRaf) return;
    sidebarVirtualRaf=window.requestAnimationFrame(function(){ sidebarVirtualRaf=0; renderSidebarWindow(); });
  }
  function scheduleSidebarRender(){
    if(sidebarRenderRaf) return;
    sidebarRenderRaf=window.requestAnimationFrame(function(){ sidebarRenderRaf=0; renderSidebar(); });
  }
  function sessionListEmptyText(){
    var filterTags=currentFilterTags();
    return (filterQ||tagSearchQ||activeTagView!=='all'||filterTags.length||priorityFilter.length<5)
      ? ('No matches'+(filterQ?(' for “'+filterQ+'”'):'')+(tagSearchQ?(' · tag search: “'+tagSearchQ+'”'):'')+(priorityFilter.length<5?(' · priority: '+priorityFilterLabel(priorityFilter)):'')+(filterTags.length?(' · tags: '+activeTagLabels().join(', ')):'')+(activeTagView==='unread'?' · Unread':'')+(activeTagView==='active'?' · Active':'')+(activeTagView==='focus'?' · Focus':''))
      : 'No sessions yet';
  }
  function buildSessionPinDivider(surface){
    var divider=el('div','session-pin-divider');
    divider.setAttribute('role','separator');
    divider.setAttribute('aria-label','Pinned sessions end');
    divider.setAttribute('data-session-surface',surface);
    return divider;
  }
  function sessionPanelColumnCount(){
    var list=byId('sessionPanelList'),panel=byId('sessionPanel');
    var width=Math.max(300,Number(list&&list.clientWidth)||Number(panel&&panel.clientWidth)||660);
    return Math.max(1,Math.floor((width-9)/(300+9)));
  }
  function buildSessionPanelVirtualRows(columns){
    var rows=[],cards=[],boundary=sessionPinBoundaryIndex(sidebarVisibleSessions);
    function flush(){
      if(!cards.length) return;
      var sessions=cards; cards=[];
      rows.push({kind:'cards',sessions:sessions,key:'cards:'+sessions.map(function(s,index){ return sidebarSessionKey(s,index); }).join('|')});
    }
    sidebarVisibleSessions.forEach(function(s,index){
      if(index===boundary){ flush(); rows.push({kind:'divider',key:'divider:'+index}); }
      cards.push(s);
      if(cards.length>=columns) flush();
    });
    flush();
    return rows;
  }
  function recalculateSessionPanelOffsets(state){
    var offsets=[0],total=0;
    state.rows.forEach(function(row){
      total+=row.kind==='divider'?SIDEBAR_PIN_DIVIDER_HEIGHT:(sessionPanelRowHeights[row.key]||SESSION_PANEL_ROW_ESTIMATE);
      offsets.push(total);
    });
    state.offsets=offsets; state.totalHeight=total;
  }
  function sessionPanelOffsetIndex(offsets,pixel){
    if(offsets.length<2) return 0;
    var low=0,high=offsets.length-2;
    while(low<high){ var mid=Math.floor((low+high)/2); if(offsets[mid+1]<pixel) low=mid+1; else high=mid; }
    return low;
  }
  function sessionPanelVirtualRange(state,panel){
    if(!state.rows.length) return {start:0,end:0};
    var top=Math.max(0,panel.scrollTop-SESSION_PANEL_OVERSCAN_PX);
    var bottom=panel.scrollTop+Math.max(panel.clientHeight,600)+SESSION_PANEL_OVERSCAN_PX;
    return {
      start:sessionPanelOffsetIndex(state.offsets,top),
      end:Math.min(state.rows.length,sessionPanelOffsetIndex(state.offsets,bottom)+1)
    };
  }
  function cachedSessionPanelCard(s){
    var key=sidebarSessionKey(s,0),cached=sessionPanelCardCache[key];
    if(!cached||cached.session!==s){ cached={session:s,node:buildSessionRow(s,'panel')}; sessionPanelCardCache[key]=cached; }
    cached.node.classList.toggle('active',!!(cur&&sameChatSession(cur,s)));
    paintSessionPanelRowStatus(cached.node,s);
    paintSessionReadProgress(cached.node.querySelector('.session-read-progress'),s);
    return cached.node;
  }
  function measureSessionPanelVirtualRows(state){
    var list=byId('sessionPanelList'),panel=byId('sessionPanel');
    if(!list||!panel||state!==sessionPanelVirtualState) return;
    var oldOffsets=state.offsets.slice(),changed=false;
    Array.prototype.forEach.call(list.querySelectorAll('.session-panel-virtual-row[data-panel-row]'),function(row){
      var index=Number(row.getAttribute('data-panel-row')),model=state.rows[index],height=row.offsetHeight;
      if(!model||!(height>0)) return;
      if(Math.abs((sessionPanelRowHeights[model.key]||0)-height)>1){ sessionPanelRowHeights[model.key]=height; changed=true; }
    });
    if(!changed) return;
    recalculateSessionPanelOffsets(state);
    var top=list.querySelector('.session-panel-virtual-spacer.top');
    var bottom=list.querySelector('.session-panel-virtual-spacer.bottom');
    if(top) top.style.height=(state.offsets[state.start]||0)+'px';
    if(bottom) bottom.style.height=Math.max(0,state.totalHeight-(state.offsets[state.end]||0))+'px';
    var delta=(state.offsets[state.start]||0)-(oldOffsets[state.start]||0);
    if(delta) panel.scrollTop=Math.max(0,panel.scrollTop+delta);
  }
  function renderSessionPanelVirtualWindow(force){
    var panel=byId('sessionPanel'),list=byId('sessionPanelList'),state=sessionPanelVirtualState;
    if(!panel||!list||panel.hidden||!state) return;
    var columns=sessionPanelColumnCount();
    if(force||columns!==state.columns){
      state.columns=columns; state.rows=buildSessionPanelVirtualRows(columns); recalculateSessionPanelOffsets(state);
    }
    var range=sessionPanelVirtualRange(state,panel);
    if(!force&&range.start===state.start&&range.end===state.end) return;
    var fragment=document.createDocumentFragment();
    var top=el('div','session-panel-virtual-spacer top'); top.style.height=(state.offsets[range.start]||0)+'px'; fragment.appendChild(top);
    for(var i=range.start;i<range.end;i++){
      var row=state.rows[i];
      if(row.kind==='divider'){
        fragment.appendChild(el('div','session-panel-virtual-divider'));
        continue;
      }
      var grid=el('div','session-panel-virtual-row');
      grid.style.setProperty('--session-panel-columns',String(state.columns));
      grid.setAttribute('data-panel-row',String(i));
      row.sessions.forEach(function(s){ grid.appendChild(cachedSessionPanelCard(s)); });
      fragment.appendChild(grid);
    }
    var bottom=el('div','session-panel-virtual-spacer bottom'); bottom.style.height=Math.max(0,state.totalHeight-(state.offsets[range.end]||0))+'px'; fragment.appendChild(bottom);
    state.start=range.start; state.end=range.end;
    list.replaceChildren(fragment);
    pruneLiveTimingRegistrations();
    window.requestAnimationFrame(function(){ measureSessionPanelVirtualRows(state); });
  }
  function scheduleSessionPanelVirtualWindow(){
    if(sessionPanelVirtualRaf) return;
    sessionPanelVirtualRaf=window.requestAnimationFrame(function(){
      sessionPanelVirtualRaf=0;
      if(draggedChatSession||(sessionTagPopoverState&&sessionTagPopoverState.surface==='panel')) return;
      renderSessionPanelVirtualWindow(false);
    });
  }
  function renderSessionPanel(){
    var panel=byId('sessionPanel'),list=byId('sessionPanelList');
    if(!panel||!list||panel.hidden) return;
    var scrollTop=panel.scrollTop;
    if(sidebarVisibleSessions.length>SESSION_PANEL_VIRTUAL_THRESHOLD){
      list.classList.add('virtualized');
      sessionPanelCardCache={};
      sessionPanelVirtualState={columns:0,rows:[],offsets:[],totalHeight:0,start:-1,end:-1};
      renderSessionPanelVirtualWindow(true);
      panel.scrollTop=scrollTop;
      scheduleSessionPanelVirtualWindow();
      return;
    }
    sessionPanelVirtualState=null;
    sessionPanelCardCache={};
    list.classList.remove('virtualized');
    var fragment=document.createDocumentFragment();
    list.replaceChildren();
    pruneLiveTimingRegistrations();
    var boundary=sessionPinBoundaryIndex(sidebarVisibleSessions);
    sidebarVisibleSessions.forEach(function(s,index){
      if(index===boundary) fragment.appendChild(buildSessionPinDivider('panel'));
      fragment.appendChild(buildSessionRow(s,'panel'));
    });
    if(!sidebarVisibleSessions.length) fragment.appendChild(el('div','empty',sessionListEmptyText()));
    list.appendChild(fragment);
    panel.scrollTop=scrollTop;
  }
  function renderSidebar(){
    clearTagHeatCache();
    renderViewTabs();
    var list=byId('list');
    indexSidebarForkComponents();
    sidebarVisibleSessions=SESS.filter(matchesFilter);
    sidebarRowCache={}; sidebarRowUse=0;
    resetSidebarRegistrations();
    list.classList.toggle('virtualized',sidebarVisibleSessions.length>SIDEBAR_VIRTUAL_THRESHOLD);
    if(sidebarVisibleSessions.length>SIDEBAR_VIRTUAL_THRESHOLD) renderSidebarWindow();
    else {
      list.innerHTML='';
      var boundary=sessionPinBoundaryIndex(sidebarVisibleSessions);
      sidebarVisibleSessions.forEach(function(s,index){
        if(index===boundary) list.appendChild(buildSessionPinDivider('sidebar'));
        var item=cachedSidebarRow(s,index); list.appendChild(item); registerSidebarRow(item,s);
      });
    }
    if(sidebarVisibleSessions.length===0){
      var empty=el('div','empty');
      empty.textContent=sessionListEmptyText();
      list.appendChild(empty);
    }
    syncBulkArchiveSeenButton();
    renderSessionPanel();
    renderChatTabs();
  }
  function sameSessionSequence(a,b){
    if(a.length!==b.length) return false;
    for(var i=0;i<a.length;i++) if(a[i]!==b[i]) return false;
    return true;
  }
  function paintCachedSessionSelection(previous,next){
    function paint(node,s){ if(node) node.classList.toggle('active',!!(next&&sameChatSession(next,s))); }
    Object.keys(sidebarRowCache).forEach(function(key){ var cached=sidebarRowCache[key]; if(cached) paint(cached.node,cached.session); });
    Object.keys(sessionPanelCardCache).forEach(function(key){ var cached=sessionPanelCardCache[key]; if(cached) paint(cached.node,cached.session); });
    [byId('list'),byId('sessionPanelList')].forEach(function(host){
      if(!host) return;
      Array.prototype.forEach.call(host.querySelectorAll('.item[data-session-id]'),function(row){
        var id=row.getAttribute('data-session-id');
        row.classList.toggle('active',!!(next&&String(next.sessionId||'')===id));
      });
    });
    if(previous) applyGenerating(previous);
    if(next) applyGenerating(next);
  }
  function refreshSessionRowNodes(s){
    if(!s) return;
    Object.keys(sidebarRowCache).forEach(function(key){
      var cached=sidebarRowCache[key]; if(!cached||cached.session!==s) return;
      var replacement=buildSessionRow(s,'sidebar');
      replacement.setAttribute('data-sidebar-key',key);
      if(cached.node&&cached.node.isConnected) cached.node.replaceWith(replacement);
      cached.node=replacement; cached.used=++sidebarRowUse;
      if(replacement.isConnected) registerSidebarRow(replacement,s);
    });
    Object.keys(sessionPanelCardCache).forEach(function(key){
      var cached=sessionPanelCardCache[key]; if(!cached||cached.session!==s) return;
      var replacement=buildSessionRow(s,'panel');
      if(cached.node&&cached.node.isConnected) cached.node.replaceWith(replacement);
      cached.node=replacement;
    });
  }
  function syncSessionListsAfterSelection(previous,next){
    var visible=SESS.filter(matchesFilter);
    if(!sameSessionSequence(sidebarVisibleSessions,visible)){
      renderSidebar();
      return;
    }
    sidebarVisibleSessions=visible;
    renderViewTabs();
    paintCachedSessionSelection(previous,next);
    syncBulkArchiveSeenButton();
    renderChatTabs();
  }
  function syncSessionListsAfterPatch(s){
    var visible=SESS.filter(matchesFilter);
    if(!sameSessionSequence(sidebarVisibleSessions,visible)){ renderSidebar(); return; }
    sidebarVisibleSessions=visible;
    refreshSessionRowNodes(s);
    renderViewTabs();
    syncBulkArchiveSeenButton();
    renderChatTabs();
  }
  function buildSessionRow(s,surface){
      surface=surface==='panel'?'panel':'sidebar';
      var taggable=!!s.sessionId;
      var item=el('div','item'+(s.pattern==='avoidance'?' avoidance':'')+(cur&&cur.sessionId===s.sessionId?' active':''));
      if(surface==='panel') paintSessionPanelRowStatus(item,s);
      item.setAttribute('data-session-surface',surface);
      if(s.sessionId) item.setAttribute('data-session-id',String(s.sessionId));
      if(s.pattern==='avoidance') item.title='avoidance';
      var readProgress=el('span','session-read-progress');
      readProgress.hidden=true;
      readProgress.setAttribute('aria-hidden','true');
      item.appendChild(readProgress);
      paintSessionReadProgress(readProgress,s);
      // title row: a live-status dot + the daemon's brief (falls back to first prompt)
      var trow=el('div','it-titlerow');
      var st=statusState(s);
      var dot=el('span','it-status '+st);
      dot.title=sidebarStatusTitle(st);
      if(s.sessionId&&surface==='sidebar') statusEls[s.sessionId]=dot;
      // click the dot to dismiss (green→gray) or re-flag (gray→green) without opening
      // the session — stopPropagation keeps the row's own open handler from firing.
      if(s.sessionId && !s.pendingFork){
        dot.onclick=function(ev){ ev.stopPropagation(); toggleStatus(s); };
      }
      trow.appendChild(dot);
      var t=el('div','it-title');
      renderSessionTitle(t, s, 'it-title');
      if(s.sessionId&&surface==='sidebar') titleEls[s.sessionId]=t;
      trow.appendChild(t);
      if(s.sessionId){
        var commentBadge=el('span','it-comment');
        if(surface==='sidebar') commentEls[s.sessionId]=commentBadge;
        trow.appendChild(commentBadge);
        if(surface==='sidebar') syncSessionCommentBadge(s); else paintSessionCommentBadge(commentBadge,s);
      }
      var forkCount=sidebarForkCount(s);
      if(forkCount>1){
        var treeButton=el('button','forktree-trigger it-forktree');
        treeButton.type='button'; treeButton.setAttribute('aria-label','view fork tree');
        treeButton._forkCount=forkCount;
        configureForkTreeTrigger(treeButton,s);
        trow.appendChild(treeButton);
      }
      // Keep age as the final piece of metadata; the pin action stays aligned at
      // the card's far-right edge.
      var age=ageLabel(s);
      if(age) trow.appendChild(el('span','it-age', age));
      if(s.sessionId && !s.pendingFork){
        var pinned=!!sessionPinTime(s);
        var pinButton=el('button','it-pin'+(pinned?' on':''));
        pinButton.type='button';
        pinButton.title=pinned?'Unpin session':'Pin session to top';
        pinButton.setAttribute('aria-label',pinButton.title);
        pinButton.setAttribute('aria-pressed',pinned?'true':'false');
        pinButton.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 2.5h6l-1 4 2 2v1H8.7L8 14l-.7-4.5H4v-1l2-2-1-4Z"></path></svg>';
        pinButton.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); toggleSessionPin(s); };
        trow.appendChild(pinButton);
      }
      item.appendChild(trow);
      // Keep the full current handoff context directly under the brief.
      var meta=el('div','it-meta');
      renderSessionSignals(meta,s);
      if(meta.childNodes.length) item.appendChild(meta);
      // two subtitles: my first message, then my latest message
      var promptTail=null;
      if(s.title){ promptTail=sessionPromptLine('it-firstline','First',s.title,null,promptAgeLabel(s,'first')); item.appendChild(promptTail); }
      promptTail=appendLatestPrompt(item, s, 'it-firstline')||promptTail;
      if(s.sessionId){
        var workBadges=el('span','it-workbadges');
        var queueBadge=el('span','it-queue');
        if(surface==='sidebar') queueEls[s.sessionId]=queueBadge;
        var todoBadge=el('span','it-todo');
        workBadges.appendChild(queueBadge); workBadges.appendChild(todoBadge);
        if(promptTail){ promptTail.classList.add('with-tail'); promptTail.appendChild(workBadges); }
        else item.appendChild(workBadges);
        if(surface==='sidebar') syncSessionQueueBadge(s); else paintSessionQueueBadge(queueBadge,s);
        paintSessionTodoBadge(todoBadge,s);
      }
      var contentHit=contentSearchHit(s);
      if(contentHit && contentHit.hits && contentHit.hits.length){
        var firstHit=contentHit.hits[0];
        var hitText='Content · '+firstHit.role+' · '+firstHit.text;
        if(contentHit.count>1) hitText += ' +' + (contentHit.count-1);
        item.appendChild(el('div','it-searchhit', hitText));
      }
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
          add.type='button'; add.setAttribute('aria-haspopup','dialog'); add.setAttribute('aria-expanded','false'); add.setAttribute('aria-controls','sessionTagPopover');
          add.onclick=function(ev){
            ev.preventDefault(); ev.stopPropagation(); openSessionTagPopover(add,s,surface);
          };
          tagrow.appendChild(add);
        }
      }
      foot.appendChild(tagrow);
      foot.appendChild(sessionContextRow(s));
      item.appendChild(foot);
      // Mouse navigation finishes on a window-level pointerup: this survives a
      // live sidebar rerender without opening the card at the start of a drag.
      // Touch/pen stay click-based so scrolling the list never navigates.
      item.onpointerdown=function(ev){
        if((ev.pointerType && ev.pointerType!=='mouse') || ev.button!==0 || isSessionRowControl(ev.target,item)) return;
        var pointerId=ev.pointerId,startX=ev.clientX,startY=ev.clientY,moved=false;
        function cleanup(){
          window.removeEventListener('pointermove',move);
          window.removeEventListener('pointerup',finish);
          window.removeEventListener('pointercancel',cancel);
        }
        function move(next){
          if(next.pointerId!==pointerId) return;
          if(Math.abs(next.clientX-startX)>5||Math.abs(next.clientY-startY)>5) moved=true;
        }
        function finish(next){
          if(next.pointerId!==pointerId) return;
          cleanup();
          if(moved||draggedChatSession) return;
          sessionRowClickSuppressUntil=Date.now()+350;
          if(!sameChatSession(cur,s)) select(s);
        }
        function cancel(next){ if(next.pointerId===pointerId) cleanup(); }
        window.addEventListener('pointermove',move);
        window.addEventListener('pointerup',finish);
        window.addEventListener('pointercancel',cancel);
      };
      item.onclick=function(ev){
        if(Date.now()<sessionRowClickSuppressUntil||isSessionRowControl(ev.target,item)) return;
        if(!sameChatSession(cur,s)) select(s);
      };
      item.draggable=true;
      item.ondragstart=function(ev){
        if(window.innerWidth<=760||isSessionRowControl(ev.target,item)){ ev.preventDefault(); return; }
        draggedChatSession=s; item.classList.add('session-card-dragging');
        if(ev.dataTransfer){
          ev.dataTransfer.effectAllowed='move';
          try{ ev.dataTransfer.setData('application/x-attend-session',String(s.sessionId||s.clientBranchId||'')); }catch(_err){}
        }
      };
      item.ondragend=function(){
        item.classList.remove('session-card-dragging');
        draggedChatSession=null;
        var main=document.querySelector('.main'); if(main) main.classList.remove('session-drop-target');
      };
      return item;
  }
  function bindChatGroupDrop(){
    var main=document.querySelector('.main'); if(!main) return;
    function clearDrop(){ main.classList.remove('session-drop-target'); }
    main.addEventListener('dragenter',function(ev){
      if(!draggedChatSession||!cur||sameChatSession(draggedChatSession,cur)) return;
      ev.preventDefault(); main.classList.add('session-drop-target');
    });
    main.addEventListener('dragover',function(ev){
      if(!draggedChatSession||!cur||sameChatSession(draggedChatSession,cur)) return;
      ev.preventDefault(); if(ev.dataTransfer) ev.dataTransfer.dropEffect='move';
      main.classList.add('session-drop-target');
    });
    main.addEventListener('dragleave',function(ev){
      if(!ev.relatedTarget||!main.contains(ev.relatedTarget)) clearDrop();
    });
    main.addEventListener('drop',function(ev){
      var dropped=draggedChatSession;
      if(!dropped||!cur||sameChatSession(dropped,cur)){ clearDrop(); return; }
      ev.preventDefault();
      var anchor=cur;
      draggedChatSession=null; clearDrop();
      groupChatSession(anchor,dropped);
      select(dropped);
    });
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
    var info=vendorInfo(config.vendor);
    setForkEnabled(ok, ok ? 'fork directly with '+config.vendor+' · '+(config.model||'current model')+' · '+config.effort : (info&&!info.available ? (info.message||config.vendor+' CLI is unavailable.') : 'select a session to split'));
    updateSendLabel();
  }
  // A small in-place editor (textarea + primary/cancel). Enter commits,
  // Shift+Enter inserts a newline, Esc cancels.
  function makeInlineEditor(text, onCommit, onCancel, primaryLabel, scheduleOption){
    var rawText=String(text||'');
    var box=el('div','inline-edit');
    var ta=el('textarea','inline-edit-ta'); ta.value=rawText;
    function syncInlineEditShape(){
      var rows=Math.min(8, Math.max(1, String(ta.value||'').split('\\n').length));
      ta.rows=rows;
      box.classList.toggle('single-line', rows===1);
    }
    syncInlineEditShape();
    ta.addEventListener('input',syncInlineEditShape);
    var bar=el('div','inline-edit-bar');
    var save=el('button','inline-edit-save',primaryLabel || 'save ▸');
    if(/^fork\\b/i.test(String(primaryLabel||''))){
      setForkButtonLabel(save,String(primaryLabel||'fork').replace(/\\s*▸\\s*$/,''));
    }
    var cancel=editCancelButton('Cancel edit (Esc)');
    if(scheduleOption){
      var group=el('div','actiongroup'), schedule=el('button','schedulebtn');
      setIconButton(schedule,'clock','schedule '+String(scheduleOption.label||primaryLabel||'action').toLowerCase());
      schedule.setAttribute('aria-expanded','false');
      schedule.onclick=function(ev){
        ev.preventDefault(); ev.stopPropagation();
        openSchedulePopover(schedule,[{id:scheduleOption.id||'schedule',label:scheduleOption.label||primaryLabel||'Action',primary:scheduleOption.id==='send',submit:function(runAt){ return scheduleOption.submit(runAt,ta.value.trim()); }}]);
      };
      group.appendChild(schedule); group.appendChild(save); bar.appendChild(group);
    } else bar.appendChild(save);
    bar.appendChild(cancel);
    box.appendChild(ta); box.appendChild(bar);
    function commit(){ onCommit(ta.value.trim()); }
    save.onclick=function(ev){ ev.stopPropagation(); commit(); };
    cancel.onclick=function(ev){ ev.stopPropagation(); onCancel(); };
    box.onclick=function(ev){ ev.stopPropagation(); };
    box.addEventListener('keydown',function(ev){
      if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); onCancel(); }
    },true);
    ta.onkeydown=function(ev){
      ev.stopPropagation();
      if(isImeConfirming(ev)) return;
      if(ev.key==='Tab'&&!ev.shiftKey&&!ev.altKey&&!ev.ctrlKey&&!ev.metaKey&&completeInlineEditShortcut(ta)){
        ev.preventDefault();
        return;
      }
      if(ev.key==='Enter' && !ev.shiftKey){ ev.preventDefault(); commit(); }
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
  function canResendStoppedLatest(msgEl){
    var stopInFlight=!!(cur && stopRequested && cur._pendingStopRequest);
    return !!(cur && ((cur.lastGenerationStoppedByUser && !turnActive)||stopInFlight) && isLatestUserMessage(msgEl));
  }
  function editStoppedLatestAndResend(msgEl, bubble){
    if(!cur || !cur.sessionId || cur.pendingFork) return;
    if(msgEl.classList.contains('editing')) return;
    var raw=bubble.getAttribute('data-raw') || bubble.textContent || '', target=cur;
    msgEl.classList.add('editing');
    function restore(){ msgEl.classList.remove('editing'); if(editor.isConnected) editor.replaceWith(bubble); }
    function resend(v){
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
    }
    var editor=makeInlineEditor(raw, function(v){
      var pendingStop=target._pendingStopRequest;
      if(!pendingStop){ resend(v); return; }
      var submit=editor.querySelector('.inline-edit-save'), textarea=editor.querySelector('.inline-edit-ta');
      if(submit&&submit.disabled) return;
      if(submit){ submit.disabled=true; submit.textContent='stopping…'; }
      if(textarea) textarea.disabled=true;
      Promise.resolve(pendingStop).then(function(stopped){
        if(!editor.isConnected) return;
        if(!stopped){ restore(); return; }
        resend(v);
      }).catch(function(){ if(editor.isConnected) restore(); });
    }, function(){
      restore();
    }, 'send ▸', {id:'send',label:'Send',submit:function(runAt,v){
      if(!v) throw new Error('Write a message first.');
      return scheduleMessageFor(runAt,target,{text:v,attachments:[],references:[]},false).then(function(res){
        restore(); return res;
      });
    }});
    bubble.replaceWith(editor);
  }
  function editAndForkFromMessage(msgEl, bubble){
    if(!cur || !cur.sessionId || cur.pendingFork) return;
    if(msgEl.classList.contains('editing')) return;
    var prefix=historyBeforeMsg(msgEl);
    if(!prefix){ showToast('Could not find the transcript point for this message.', 'warn'); return; }
    var raw=bubble.getAttribute('data-raw') || bubble.textContent || '', target=cur;
    msgEl.classList.add('editing');
    function restore(){ msgEl.classList.remove('editing'); if(editor.isConnected) editor.replaceWith(bubble); }
    var editor=makeInlineEditor(raw, function(v){
      msgEl.classList.remove('editing');
      if(!v){ editor.replaceWith(bubble); return; } // empty → just cancel, don't send
      editor.replaceWith(bubble);
      startForkFromPrefix(prefix, { text:v, attachments:[] });
    }, function(){
      restore();
    }, 'fork', {id:'fork',label:'Fork',submit:function(runAt,v){
      if(!v) throw new Error('A scheduled fork needs a first message.');
      return scheduleForkFor(runAt,target,{text:v,attachments:[],references:[]},prefix,{selectCard:true}).then(function(res){ restore(); return res; });
    }});
    bubble.replaceWith(editor);
  }
  function editUserMessage(msgEl, bubble){
    if(canResendStoppedLatest(msgEl)) editStoppedLatestAndResend(msgEl, bubble);
    else editAndForkFromMessage(msgEl, bubble);
  }
  function normalizedProviderError(raw, fallback){
    var source=raw && typeof raw==='object' ? raw : {message:raw};
    var code=String(source.code||'').trim();
    var vendor=String(source.vendor||(code.indexOf('_')>0?code.split('_')[0]:'')).trim().toLowerCase();
    return {
      message:String(source.message||source.error||fallback||'Request failed.'),
      code:code,
      vendor:vendor,
      command:String(source.command||'').trim(),
      retryable:typeof source.retryable==='boolean' ? source.retryable : undefined
    };
  }
  function providerErrorVendorLabel(error){
    var vendor=String(error&&error.vendor||'').trim();
    return vendor ? vendor.charAt(0).toUpperCase()+vendor.slice(1) : '';
  }
  function providerErrorTitle(error){
    var vendor=providerErrorVendorLabel(error);
    if(/_auth_required$/.test(error.code)) return (vendor?vendor+' ':'')+'sign-in required';
    if(/_usage_limit$/.test(error.code)) return (vendor?vendor+' ':'')+'usage limit reached';
    return vendor?vendor+' request failed':'Request failed';
  }
  function fallbackCopyText(text){
    return new Promise(function(resolve,reject){
      var area=document.createElement('textarea');
      area.value=String(text||''); area.setAttribute('readonly',''); area.style.position='fixed'; area.style.opacity='0';
      document.body.appendChild(area); area.select();
      var copied=false;
      try{ copied=!!document.execCommand('copy'); }catch(e){}
      area.remove();
      if(copied) resolve(); else reject(new Error('copy unavailable'));
    });
  }
  function copyPlainText(text){
    try{
      if(navigator.clipboard && typeof navigator.clipboard.writeText==='function'){
        return Promise.resolve(navigator.clipboard.writeText(String(text||''))).catch(function(){ return fallbackCopyText(text); });
      }
    }catch(e){}
    return fallbackCopyText(text);
  }
  function fillProviderErrorCard(card, raw, onRetry){
    var error=normalizedProviderError(raw);
    card.setAttribute('data-provider-error-code',error.code||'unknown');
    card.appendChild(el('div','provider-error-title',providerErrorTitle(error)));
    card.appendChild(el('div','provider-error-message',error.message));
    if(error.command){
      var commandRow=el('div','provider-error-command');
      commandRow.appendChild(el('code',null,error.command));
      var copy=el('button','provider-error-button provider-error-copy','Copy command'); copy.type='button';
      copy.onclick=function(){
        copy.disabled=true;
        copyPlainText(error.command).then(function(){
          copy.textContent='Copied';
          setTimeout(function(){ if(copy.isConnected){ copy.textContent='Copy command'; copy.disabled=false; } },1200);
        }).catch(function(){ copy.textContent='Copy failed'; copy.disabled=false; });
      };
      commandRow.appendChild(copy); card.appendChild(commandRow);
    }
    if(typeof onRetry==='function' && (error.command || error.retryable!==false)){
      var actions=el('div','provider-error-actions');
      var retryLabel=/_auth_required$/.test(error.code)?"I've signed in — retry":'Try again';
      var retry=el('button','provider-error-button provider-error-retry',retryLabel); retry.type='button';
      retry.onclick=function(){ onRetry(); };
      actions.appendChild(retry); card.appendChild(actions);
    }
    return error;
  }
  function addProviderError(raw, onRetry){
    clearPh();
    var node=el('div','msg error provider-error'); node.setAttribute('role','alert');
    node.setAttribute('data-msg-key','error:'+(msgOrdinal++));
    var bubble=el('div','bubble provider-error-card');
    fillProviderErrorCard(bubble,raw,onRetry?function(){
      if(onRetry()!==false && node.parentNode) node.parentNode.removeChild(node);
    }:undefined);
    node.appendChild(bubble);
    var target=renderTarget||byId('msgs'); appendChatNode(target,node);
    if(!suppressScroll){ keepGenLast(); scroll(); scheduleLatestPin(); }
    return node;
  }
  function appendCommentProviderError(raw){
    var host=byId('commentMsgs'); if(!host) return null;
    var node=el('div','msg error provider-error'); node.setAttribute('role','alert');
    node.setAttribute('data-msg-key','comment:'+(commentMsgOrdinal++));
    var bubble=el('div','bubble provider-error-card'); fillProviderErrorCard(bubble,raw);
    node.appendChild(bubble); host.appendChild(node); keepCommentGeneratingLast();
    if(commentStick) host.scrollTop=host.scrollHeight;
    syncScrollBottomButton(host,byId('commentScrollBottom')); scheduleCommentLatestPin();
    return node;
  }
  function showNewSessionProviderError(raw, onRetry){
    var host=byId('nmsg'); if(!host) return;
    host.innerHTML=''; host.className='nmsg provider-error-host'; host.setAttribute('role','alert');
    var card=el('div','provider-error-card'); fillProviderErrorCard(card,raw,onRetry); host.appendChild(card);
  }
  function messageReferenceDisplay(ref){
    var pin=currentPins().find(function(value){ return value.key===String(ref&&ref.pinKey||''); });
    var text=String(ref&&ref.text||pin&&pin.text||ref&&ref.pinKey||'Pin').replace(/\s+/g,' ').trim();
    var role=String(ref&&ref.role||pin&&pinRoleLabel(pin)||'Pin').trim();
    var thread=commentThreadForAnchor(currentParentSessionId(),String(ref&&ref.pinKey||''),text);
    return {label:String(ref&&ref.label||role+' · '+text),text:text,hasComment:!!(ref&&ref.hasComment||thread)};
  }
  function appendMessageReferences(bubble,references){
    var refs=clonePinReferences(references); if(!bubble||!refs.length) return;
    var tray=el('div','msgrefs'); tray.setAttribute('aria-label','Referenced context');
    refs.forEach(function(ref){
      var display=messageReferenceDisplay(ref), chip=el('span','msgref');
      chip.title='Referenced context: '+display.text;
      chip.appendChild(el('span','msgref-kind','@'));
      chip.appendChild(el('span','msgref-label',display.label));
      if(display.hasComment) chip.appendChild(el('span','msgref-comments','comments'));
      tray.appendChild(chip);
    });
    bubble.appendChild(tray);
  }
  function addMsg(role, text, markdown, attachments, references){
    clearPh();
    var m=el('div','msg '+role);
    m.setAttribute('data-msg-key', role+':'+(msgOrdinal++));
    var b=el('div','bubble');
    var atts=cloneAttachments(attachments);
    var displayText=atts.length ? attachmentDisplayText(text, atts) : text;
    setBubbleText(b, displayText||'', markdown!==false && (role==='user' || role==='assistant'));
    appendAttachmentCards(b, atts);
    if(role==='user') appendMessageReferences(b,references);
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
    m.appendChild(b);
    var target=renderTarget || byId('msgs');
    appendChatNode(target,m);
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
  function stringValueAfterKey(source,key){
    var marker='"'+key+'"', at=source.indexOf(marker);
    if(at<0) return '';
    at=source.indexOf(':',at+marker.length);
    if(at<0) return '';
    at++;
    while(at<source.length && /\\s/.test(source.charAt(at))) at++;
    if(source.charAt(at)!=='"') return '';
    var start=at, escaped=false;
    for(at++;at<source.length;at++){
      var ch=source.charAt(at);
      if(escaped){ escaped=false; continue; }
      if(ch==='\\\\'){ escaped=true; continue; }
      if(ch==='"'){
        try { return JSON.parse(source.slice(start,at+1)); } catch(e){ return ''; }
      }
    }
    return '';
  }
  function execPreview(input){
    var source=String(input||''), command=stringValueAfterKey(source,'cmd');
    if(command) return String(command).split('\\n')[0].trim().slice(0,90);
    if(source.indexOf('tools.apply_patch')>=0) return 'apply patch';
    if(source.indexOf('tools.write_stdin')>=0) return 'continue command';
    var toolAt=source.indexOf('tools.');
    if(toolAt>=0){
      var tail=source.slice(toolAt+6), end=tail.search(/[^A-Za-z0-9_]/);
      var called=end<0?tail:tail.slice(0,end);
      if(called) return called.slice(0,90);
    }
    var lines=source.split('\\n');
    for(var i=0;i<lines.length;i++) if(lines[i].trim()) return lines[i].trim().slice(0,90);
    return '';
  }
  function toolPreview(name, input){
    try {
      if(!input) return '';
      if(typeof input==='string') return name==='exec' ? execPreview(input) : input.split('\\n')[0].slice(0,90);
      if(typeof input!=='object') return String(input).slice(0,90);
      if(name==='Bash' && input.command) return String(input.command).split('\\n')[0].slice(0,90);
      if((name==='shell'||name==='exec_command') && (input.command||input.cmd)) return String(input.command||input.cmd).split('\\n')[0].slice(0,90);
      if(input.file_path) return String(input.file_path);
      if(input.path) return String(input.path);
      if(input.pattern) return String(input.pattern);
      var k=Object.keys(input)[0]; return k?(k+': '+String(input[k]).slice(0,70)):'';
    } catch(e){ return ''; }
  }
  function toolSummary(text){
    var summary=el('summary');
    summary.appendChild(el('span','tool-summary-text',text));
    return summary;
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
  function parseCodexFileChanges(name, input){
    if(name!=='edit' || !input || !Array.isArray(input.changes)) return null;
    var files=[];
    input.changes.forEach(function(change){
      if(!change || typeof change!=='object') return;
      var rows=[];
      String(change.diff||'').replace(/\\r/g,'').split('\\n').forEach(function(line){
        if(!line) return;
        var sign=line.charAt(0);
        if(line.indexOf('@@')===0 || line.indexOf('diff --git ')===0 || line.indexOf('index ')===0 || line.indexOf('--- ')===0 || line.indexOf('+++ ')===0)
          rows.push({t:'@',s:line});
        else if(sign==='+' || sign==='-' || sign===' ')
          rows.push({t:sign,s:line.slice(1)});
        else rows.push({t:'@',s:line});
      });
      files.push({title:change.path||'File change', meta:[change.kind||'update'], rows:rows});
    });
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
      if(answers[q.question]) pairs.push('"'+q.question+'"="'+(q.isSecret?'[redacted]':answers[q.question])+'"');
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
      if(!vals.length){
        if(q.optional) continue;
        return {ok:false, error:'Please answer every required question before submitting.'};
      }
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
    var target=cur, providerId=providerSessionId(target); if(!providerId) return;
    var operation=beginOperation('answer:'+toolId,target);
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
    markReplied(target); // answering keeps the session in-progress until you dismiss it
    var answerText=questionAnswerSummary(qs, picked.answers);
    var codexAnswer=(target.vendor==='codex');
    if(codexAnswer){
      rememberPendingUserMsg(target.sessionId, answerText);
      markVisitSend();
      noteUserTurn(target, answerText);
      cacheTranscriptUserMsg(target, answerText);
      addMsg('user', answerText);
      assistantEl=null;
    }
    var previousAvoidance=clearDerivedAvoidance(target);
    beginTurn();
    expectSessionRun(target,genStart);
    var runEpoch=Number(target._runEpoch)||0;
    touchSession(target);
    function failAnswer(message){
      if(!operationIsCurrent(operation)) return;
      if(sessionRunWasAcknowledged(target,runEpoch)) return;
      if(codexAnswer) forgetPendingUserMsg(target.sessionId, answerText);
      restoreDerivedAvoidance(target,previousAvoidance);
      if(cur===target){
        if(err) err.textContent=message;
        setQuestionBusy(root, false, 'submit answer');
        target._awaitingLiveStart=false; target._awaitingLiveStartAt=null;
        endTurn('failed');
      } else {
        rejectSessionRun(target,'failed');
        renderSidebar();
        showToast(message,'warn');
      }
    }
    fetch('/chat/answer?session='+encodeURIComponent(providerId)+'&cwd='+encodeURIComponent(target.cwd||'')+'&vendor='+encodeURIComponent(target.vendor||'claude'),{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        toolUseId:toolId,
        text:answerText,
        toolUseResult:toolUseResult
      })
    }).then(function(r){ return r.json(); }).then(function(res){
      if(!operationIsCurrent(operation)) return;
      if(res.ok){ if(res.view) patchSessionView(res.view,{source:'answer'}); }
      else failAnswer(res.error||'answer failed');
    }).catch(function(e){
      failAnswer('network error: '+(e&&e.message?e.message:e));
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
        other.type=q.isSecret?'password':'text';
        other.autocomplete=q.isSecret?'off':'on';
        other.placeholder=(q.optional?'Optional · ':'')+'Or type your own answer';
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
  function toolBlockKey(tc){
    var ordinal=toolOrdinal++;
    if(tc&&tc.id) return 'tool:id:'+hashText(String(tc.id)).toString(36);
    return 'tool:auto:'+ordinal+':'+hashText(String(tc&&tc.name||'tool')+'\\n'+fmt(tc&&tc.input)).toString(36);
  }
  function toolBlockSnapshot(block){
    var meta=block&&block._attendTool||{};
    var parts=['Tool: '+String(meta.name||block&&block.getAttribute('data-tool-name')||'tool')];
    if(meta.input!=null && !(typeof meta.input==='object' && Object.keys(meta.input).length===0)) parts.push('Input:\\n'+fmt(meta.input));
    if(meta.resultReceived) parts.push((meta.isError?'Error':'Result')+':\\n'+String(meta.result||''));
    return parts.join('\\n\\n').slice(0,20000);
  }
  function refreshPinnedToolSnapshot(block){
    if(!cur||!block) return;
    var key=block.getAttribute('data-msg-key'), pins=currentPins();
    var pin=pins.find(function(item){ return item.key===key; });
    if(!pin) return;
    pin.text=toolBlockSnapshot(block).slice(0,1200);
    pin.role=chatBlockRole(block);
    savePins(cur,sortPinsInChatOrder(pins)); renderPinTray();
  }
  function updateToolBlockResult(block,result,isError,detached){
    if(!block) return;
    var meta=block._attendTool||{};
    meta.result=String(result||''); meta.resultReceived=true; meta.isError=!!isError;
    block._attendTool=meta; block.removeAttribute('data-tool-pending');
    if(isError) block.setAttribute('data-tool-error','true');
    else block.removeAttribute('data-tool-error');
    if(!detached){ refreshPinnedToolSnapshot(block); syncMessageCommentState(block); }
  }
  function decorateToolBlock(block,row,tc){
    block._attendTool={name:String(tc.name||'tool'),input:tc.input,result:tc.result,resultReceived:tc.result!=null,isError:tc.isError===true};
    block.setAttribute('data-msg-key',toolBlockKey(tc));
    block.setAttribute('data-tool-name',String(tc.name||'tool'));
    if(tc.result==null) block.setAttribute('data-tool-pending','true');
    if(tc.isError===true) block.setAttribute('data-tool-error','true');
  }
  // tc = { id?, name, input, result?, isError? }
  function addTool(tc,opts){
    opts=opts||{};
    var registry=opts.registry||toolEls;
    if(!opts.reference&&tc.id&&registry[tc.id]) return registry[tc.id];
    if(!opts.reference) clearPh();
    var d=el('details','toolc');
    if(tc.result==null) d.setAttribute('data-tool-pending','true');
    if(tc.isError===true) d.setAttribute('data-tool-error','true');
    if(tc.id) d.setAttribute('data-tool-id', tc.id);
    var autoExpandPatch = tc.name==='apply_patch' && typeof tc.input==='string' && !!tc.input.trim();
    var parsedPatch = autoExpandPatch ? parseApplyPatch(tc.input) : null;
    // Interactive tools (todos / plan / questions) get a rich body, expanded;
    // Edit-family tools render as a git-style diff; everything else collapses to JSON.
    var rich=richTool(tc.name, tc.input, tc);
    if(rich){
      d.appendChild(toolSummary(rich.label));
      d.open=true; d.appendChild(rich.el);
    } else {
      var prev=toolPreview(tc.name, tc.input);
      d.appendChild(toolSummary('⚙ '+tc.name+(prev?(' — '+prev):'')));
      var diff=editsFromInput(tc.name, tc.input);
      var codexPatch=parseCodexFileChanges(tc.name, tc.input);
      if(diff){
        d.open=true;
        d.appendChild(renderDiff(diff));
      } else if(codexPatch){
        d.open=true;
        d.appendChild(renderApplyPatch(codexPatch));
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
    if(opts.readonly && isQuestionTool(tc.name, tc.input)) lockQuestionTool(d);
    if(opts.reference){
      d.classList.add('commentanchor-tool');
      (opts.target||byId('commentAnchorContent')).appendChild(d);
      return d;
    }
    var row=el('div','toolrow'); row.appendChild(d); decorateToolBlock(d,row,tc);
    var target=opts.target || renderTarget || byId('msgs');
    appendChatNode(target,row);
    if(tc.id) registry[tc.id]=d;
    if(!opts.target&&!renderTarget) applyCollapsedTurns();
    if(!opts.target&&!suppressScroll){ keepGenLast(); scroll(); scheduleLatestPin(); }
    return d;
  }

  function transcriptLoadKey(s){
    if(!s) return '';
    return s.sessionId ? ('sid:'+s.sessionId) : transcriptCacheKey(s.file,s.vendor);
  }
  function loadTranscriptBaseline(s, opts){
    opts=opts||{};
    if(!s) return Promise.resolve([]);
    if(!opts.force && hasTranscriptBaseline(s)) return Promise.resolve(cachedTranscriptFor(s)||[]);
    var key=transcriptLoadKey(s);
    if(key && transcriptLoads[key]) return transcriptLoads[key];
    var busVersion=Number(s._busVersion||0);
    var load=hydrateSessionSource(s,{force:!!opts.force,preserveSort:opts.preserveSort!==false}).then(function(){
      if(!s.file) return cachedTranscriptFor(s)||[];
      return fetch('/chat/messages?file='+encodeURIComponent(s.file)+'&vendor='+encodeURIComponent(s.vendor||''))
        .then(function(r){ return r.json(); })
        .then(function(msgs){
          msgs=Array.isArray(msgs)?msgs:[];
          // Cursor has no headless native fork, and cross-provider forks cannot
          // copy the provider's transcript. In both cases the backend seeds the
          // new run with a hidden context prompt. That prompt gives the model the
          // history, but transcript readers intentionally hide it from the chat.
          // Re-project the parent's visible messages when rebuilding the branch
          // from disk so refresh/navigation does not turn a fork into an
          // apparently empty conversation. The child's first visible user row
          // (the fork opener) remains in the child rows and follows the parent.
          var parentId=String(s.forkParentId||'').trim();
          var parent=parentId ? findSessionById(parentId) : null;
          var needsParent=!!(parent && (s.vendor==='cursor' || parent.vendor!==s.vendor));
          if(needsParent){
            return loadTranscriptBaseline(parent,{preserveSort:true}).catch(function(){
              return cachedTranscriptFor(parent)||[];
            }).then(function(parentMsgs){
              return cloneTranscriptMsgs(parentMsgs||[]).concat(cloneTranscriptMsgs(msgs));
            });
          }
          return msgs;
        })
        .then(function(msgs){
          // Do not let a snapshot taken during active SSE delivery overwrite
          // newer deltas. The completed turn will reconcile once the stream is
          // quiet; until then the live cache remains the authoritative view.
          if(Number(s._busVersion||0)!==busVersion) return cachedTranscriptFor(s)||msgs;
          // A fork/new-session opener is rendered and cached optimistically
          // before the provider transcript has necessarily flushed that user
          // row. A force warm-up can therefore read a valid but stale prefix.
          // While the turn is active, never replace an established live
          // baseline with that disk snapshot merely because no SSE delta landed
          // during this particular fetch.
          var live=cachedTranscriptFor(s);
          if(s.generating && hasTranscriptBaseline(s) && live) return live;
          return cacheTranscript(s,msgs);
        });
    }).finally(function(){ if(key && transcriptLoads[key]===load) delete transcriptLoads[key]; });
    if(key) transcriptLoads[key]=load;
    return load;
  }
  function reconcileMissingTranscriptBaseline(s){
    if(!s || hasTranscriptBaseline(s)) return;
    Promise.resolve().then(function(){
      return loadTranscriptBaseline(s,{force:true,preserveSort:true});
    }).then(function(){
      // A load already in flight may have been rejected as stale by an SSE
      // delta. Once the terminal event has landed, one quiet retry is enough.
      if(!hasTranscriptBaseline(s)) return loadTranscriptBaseline(s,{force:true,preserveSort:true});
    }).then(function(){
      if(cur!==s || turnActive || !hasTranscriptBaseline(s)) return;
      var next=cachedTranscriptFor(s)||[];
      renderPersistedAndPending(next,s.sessionId);
    }).catch(function(){});
  }

  function select(s){
    var selectionGeneration=++transcriptSelectionGeneration;
    var previousSelection=cur;
    if(refreshBusy) setRefreshBusy(false);
    if(cur && cur!==s && !(byId('commentDrawer')||{}).hidden) closeCommentDrawer();
    flushVisit(false);
    stashSessionScroll(cur);
    stashComposerDraft(cur);
    stashAttachmentState(cur);
    stashPinReferenceState(cur);
    stashQueueState(cur);
    // Opening a session is navigation, not activity. Anchor its current ordering
    // before source hydration so a click alone cannot move the row.
    if(s && s.sortTs==null && s.lastTs!=null) s.sortTs=s.lastTs;
    var savedScrollState=savedSessionScrollState(s);
    var savedScrollTop=savedSessionScroll(s);
    // A bottom position is an intent, not a fixed pixel offset. If this session
    // keeps generating in the background, its old max scrollTop becomes the head
    // of the newly appended turn. Keep it bottom-pinned even after generation ends.
    var restoreBottom=!!(savedScrollState&&savedScrollState.atBottom);
    var restoreReadingPosition=!s.generating&&!restoreBottom&&savedScrollTop!=null;
    var selectionScrollMode=restoreReadingPosition ? {top:savedScrollTop} : null;
    closeSessionTagPopover();
    cur=s; activateChatGroupForSession(s); goalArmed=false; editingScheduleId='';
    clearGen(); turnActive=false; msgOrdinal=0; toolOrdinal=0; setInputEnabled(true); updateSendLabel();
    refreshGoalToggle();
    markSeen(s); syncSessionListsAfterSelection(previousSelection,s);
    document.body.classList.remove('no-session');
    document.body.classList.add('show-chat'); // mobile: slide to the chat page (no-op on desktop)
    syncPageTitle(s);
    // top mirrors the tab: brief as title, my first + latest message as subtitles
    // — each on its own line (like the sidebar tab).
    syncOpenHeader();
    // in-browser fork works for Claude + Codex; gated to a settled turn (see
    // refreshForkButton — forking mid-generation corrupts both parent and branch).
    refreshForkButton();
    syncGoalFromServer(s);
    closeComposerRail(); populateRunConfigControls(); refreshRunConfigButton();
    stick=!restoreReadingPosition; assistantEl=null; toolEls={}; endCatchup(); restoreQueueState(s);
    hideLatestPin(); latestUserMsgEl=null;
    renderPinTray();
    restoreComposerDraft(s);
    restoreAttachmentState(s);
    restorePinReferenceState(s);
    renderAvoidancePanel();
    var cached=cachedTranscriptFor(s);
    if(cached) renderPersistedAndPending(cached, s.sessionId, selectionScrollMode);
    else {
      var loading=el('div','placeholder','Loading…'); loading.id='ph'; replaceMessages(loading,selectionScrollMode);
    }
    var selectionIsCurrent=function(){ return cur===s && selectionGeneration===transcriptSelectionGeneration; };
    renderQueue();
    if(s.pendingFork){
      // A fork opened WITH an opening turn belongs to materializeFork(), which
      // runs synchronously right after this select() and renders the opener +
      // turn. The empty-fork "type your next message" hint below is only for a
      // fork still awaiting its first message — starting it here would land
      // after materializeFork and erase the opener. Skip the async path outright.
      if(s.pendingFork.opener) return;
      var parent=findSessionById(s.pendingFork.parent) || {
        sessionId:s.pendingFork.parent,
        vendor:s.vendor||'claude',
        cwd:s.pendingFork.cwd||'',
        file:''
      };
      var finishEmptyFork=function(msgs){
        if(!selectionIsCurrent() || !s.pendingFork || s.pendingFork.materializing) return;
        renderPersistedAndPending(msgs||[], null, selectionScrollMode);
        addMsg('assistant','(forked with '+forkConfigLabel(s)+' — type your next message to continue this branch in a new direction)');
        beginVisit(s);
        syncOpenHeader();
      };
      loadTranscriptBaseline(parent,{preserveSort:true}).then(function(msgs){
        // Opener forks already returned above, so we're an empty fork here — but
        // the user may have typed + sent before this async resolved, in which
        // case send()→materializeFork() has taken over (setting materializing,
        // then clearing pendingFork once /chat/fork returns). Bail rather than
        // landing the placeholder on top of that opener.
        finishEmptyFork(msgs);
      }).catch(function(){ finishEmptyFork(cachedTranscriptFor(parent)||[]); });
      return;
    }
    var finishHistoryLoad=function(){
      if(!selectionIsCurrent()) return;
      syncCurrentLiveState(s);
      beginVisit(s);
    };
    // Navigation is cache-only once a complete baseline exists. /chat/messages
    // is reserved for first open, explicit refresh, and later gap recovery.
    if(hasTranscriptBaseline(s)){
      finishHistoryLoad();
      if(!s.file) hydrateSessionSource(s,{preserveSort:true}).then(function(){
        if(selectionIsCurrent()){ syncOpenHeader(); syncSessionListsAfterPatch(s); }
      }).catch(function(){});
      return;
    }
    var rendered=cached;
    loadTranscriptBaseline(s,{preserveSort:true}).then(function(msgs){
      if(!selectionIsCurrent()) return;
      var next=cachedTranscriptFor(s)||msgs||[];
      if(!rendered || !sameTranscript(rendered,next)) renderPersistedAndPending(next,s.sessionId,selectionScrollMode);
      syncOpenHeader(); syncSessionListsAfterPatch(s); finishHistoryLoad();
    }).catch(function(){
      if(!selectionIsCurrent()) return;
      if(!cachedTranscriptFor(s)) renderSessionHistory(s,[],selectionScrollMode);
      finishHistoryLoad();
    });
  }
  function refreshCurrentChat(){
    if(!cur) return;
    var s=cur;
    var before=cachedTranscriptFor(s);
    var selectionGeneration=++transcriptSelectionGeneration;
    setRefreshBusy(true);
    loadTranscriptBaseline(s,{force:true,preserveSort:false}).then(function(msgs){
      if(cur!==s || selectionGeneration!==transcriptSelectionGeneration) return;
      var next=cachedTranscriptFor(s)||msgs||[];
      if(!before || !sameTranscript(before,next)) renderPersistedAndPending(next,s.sessionId);
      syncOpenHeader(); syncSessionListsAfterPatch(s); syncCurrentLiveState(s); beginVisit(s); setRefreshBusy(false);
    }).catch(function(){
      if(cur===s && selectionGeneration===transcriptSelectionGeneration) setRefreshBusy(false);
    });
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
    if(sessionAwaitingLiveStart(cur)) return;
    // Right after beginTurn(), /chat/live can briefly lag the real run creation.
    // Give it a short grace window so we don't collapse a just-started turn, but
    // do recover if a background tab missed the SSE result event.
    if(!canRecoverTurnEnd()) return;
    turnEnded();
  }
  function recoverCurrentTurnFromSync(ev){
    if(!cur || !cur.sessionId || !turnActive || ev.turnActive) return;
    if(sessionAwaitingLiveStart(cur)) return;
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
    if(Array.isArray(res&&res.schedules)) syncSchedules(res.schedules);
    applyStats(res && res.stats);
    var active={}; (res.active||[]).forEach(function(id){ active[id]=true; });
    var clientSessionIds=res&&res.clientSessionIds||{};
    var lastAssistantAt=res&&res.lastAssistantAt||{};
    var queues=res&&res.queues||{};
    SESS.forEach(function(s){
      if(!s.sessionId) return;
      if(s.clientBranchId && !s.providerSessionId){
        Object.keys(clientSessionIds).some(function(providerId){
          if(clientSessionIds[providerId]!==s.clientBranchId) return false;
          bindProviderSessionId(s,providerId);
          flushPendingSessionTags(s);
          return true;
        });
      }
      var liveId=providerSessionId(s);
      var queueInfo=liveId&&queues[liveId];
      s.queueCount=queueInfo ? Math.max(0,Number(queueInfo.count)||0) : 0;
      s.queueParked=!!(queueInfo&&queueInfo.parked===true);
      syncSessionQueueBadge(s);
      var wasGenerating=!!s.generating;
      // /chat/abort can resolve just before the next live snapshot drops the
      // session from the active set. Do not let that stale snapshot resurrect the
      // stopped turn and erase lastGenerationStoppedByUser via beginTurn().
      var suppressStoppedLive=s===cur && !turnActive && s.lastGenerationStoppedByUser===true;
      var live=!!(liveId && active[liveId]) && !suppressStoppedLive;
      // A background fork starts with only a client id. Snapshots taken before
      // /chat/fork binds its provider id cannot authoritatively say that the
      // new turn ended, so keep the optimistic state until the fork response is
      // reconciled with an active snapshot or a terminal session event.
      var wasAwaiting=sessionAwaitingLiveStart(s);
      if(live && !wasGenerating && !wasAwaiting) s._runEpoch=Math.max(0,Number(s._runEpoch)||0)+1;
      if(live) s._runAcknowledgedEpoch=Math.max(Number(s._runAcknowledgedEpoch)||0,Number(s._runEpoch)||0);
      if(live){ s._awaitingLiveStart=false; s._awaitingLiveStartAt=null; }
      var startedAt=live ? liveStartedAt(res, liveId) : 0;
      var keepLocal = s===cur && turnActive;
      var keepPendingStart = wasGenerating && (!!(s.pendingFork && s.pendingFork.materializing) || sessionAwaitingLiveStart(s));
      var keepGrace = s===cur && !turnActive && wasGenerating && !live && !canRecoverSessionTurnEnd(s);
      var g=live || keepLocal || keepPendingStart || keepGrace;
      if(g && !wasGenerating){
        s.lastGenerationDurationMs=null;
        s.lastGenerationOutcome=null;
        s.analysisPending=false;
        clearTurnScopedSignals(s);
      }
      if(!g && wasGenerating) finishGenerationTiming(s,Date.now(),'generated');
      s.generatingStartedAt = g ? (startedAt || s.generatingStartedAt || Date.now()) : null;
      if(g){
        var outputAt=Number(lastAssistantAt[liveId])||0;
        var currentOutputAt=Number(s.lastAssistantOutputAt)||0;
        var turnStart=Number(s.generatingStartedAt)||0;
        s.lastAssistantOutputAt=Math.max(outputAt>=turnStart?outputAt:0,currentOutputAt>=turnStart?currentOutputAt:0)||null;
      } else s.lastAssistantOutputAt=null;
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
      syncLiveTiming(s);
    });
    recoverCurrentTurnFromLive(active);
    if(cur && cur.sessionId && res.queues){
      var curQueueInfo=res.queues[providerSessionId(cur)];
      var serverCount=curQueueInfo ? Number(curQueueInfo.count||0) : 0;
      if(serverCount!==pendingQueue.length || (!!curQueueInfo && curQueueInfo.parked===true)!==queueParked) refreshServerQueue(cur);
    }
    var curLiveId=providerSessionId(cur);
    if(cur && curLiveId && (active[curLiveId] || sessionAwaitingLiveStart(cur)) && !turnActive){
      beginTurn(liveStartedAt(res, curLiveId) || Date.now());
    }
  }
  function syncCurrentLiveState(s){
    if(!s || !s.sessionId) return;
    // Re-project the authoritative SSE snapshot after transcript rendering. Never
    // substitute a polling response when the live connection is down.
    if(!liveConnectionFailed && latestLiveSnapshot) applyLiveSnapshot(latestLiveSnapshot);
  }
  function markLiveConnectionFailed(){
    if(liveConnectionFailed) return;
    liveConnectionFailed=true;
    liveErrorToast=showToast('Attend is unavailable.', 'error', true);
  }
  function markLiveRestored(){
    if(liveErrorToast && liveErrorToast.parentNode) liveErrorToast.parentNode.removeChild(liveErrorToast);
    liveErrorToast=null;
    if(liveConnectionFailed) showToast('Attend service connection restored.', 'live-restored');
    liveConnectionFailed=false;
  }
  function openLiveStateStream(){
    if(!window.EventSource){
      markLiveConnectionFailed();
      return;
    }
    var source=new EventSource('/chat/live-stream');
    source.onopen=function(){
      markLiveRestored();
    };
    source.onmessage=function(e){
      markLiveRestored();
      liveEventChain=liveEventChain.then(function(){ return e2eeEventData(e.data); }).then(function(message){
        if(message && message.kind==='session_event') onBusSessionEvent(message);
        else if(message && message.kind==='analysis') onBusAnalysisEvent(message);
        else applyLiveSnapshot(message||{});
      }).catch(function(){});
    };
    source.onerror=function(){
      markLiveConnectionFailed();
    };
  }
  function reduceLatestLiveSnapshotEvent(sessionId, clientSessionId, ev, emittedAt){
    if(!sessionId || !ev || !latestLiveSnapshot) return;
    var starts=ev.kind==='user_turn_started' || ev.kind==='queued_turn_started' || ev.kind==='queued_turn_steered';
    var ends=ev.kind==='result' || ev.kind==='error';
    var activity=(ev.kind==='assistant_text' && !!ev.text) || ev.kind==='tool_use' || ev.kind==='tool_result';
    if(!starts && !ends && !activity) return;
    var active=Array.isArray(latestLiveSnapshot.active) ? latestLiveSnapshot.active.slice() : [];
    var startedAt=Object.assign({}, latestLiveSnapshot.startedAt||{});
    var lastAssistantAt=Object.assign({},latestLiveSnapshot.lastAssistantAt||{});
    var clientSessionIds=Object.assign({}, latestLiveSnapshot.clientSessionIds||{});
    var idx=active.indexOf(sessionId);
    if(starts){
      if(idx<0) active.push(sessionId);
      if(!startedAt[sessionId]) startedAt[sessionId]=Number(emittedAt)||Date.now();
      if(clientSessionId) clientSessionIds[sessionId]=clientSessionId;
    } else if(ends) {
      if(idx>=0) active.splice(idx,1);
      delete startedAt[sessionId];
    }
    if(activity) lastAssistantAt[sessionId]=Number(emittedAt)||Date.now();
    latestLiveSnapshot=Object.assign({}, latestLiveSnapshot, {active:active,startedAt:startedAt,lastAssistantAt:lastAssistantAt,clientSessionIds:clientSessionIds});
  }
  function sessionEventNeedsSidebarRebuild(ev){
    return !!(ev && (ev.kind==='user_turn_started' || ev.kind==='queued_turn_started' || ev.kind==='queued_turn_steered' || ev.kind==='result' || ev.kind==='error'));
  }
  function applyRunConfigEvent(s,ev){
    if(!s || !ev || ev.kind!=='run_config') return;
    var observed=ev.source==='provider-observed';
    ['model','effort','speed'].forEach(function(field){
      var value=String(ev[field]||'').trim();
      if(value && (!observed || !String(s[field]||'').trim())) s[field]=value;
    });
    if(cur===s) renderComposerRail();
  }
  // Daemon verdict pushed over the live bus (server broadcasts the moment it caches).
  // Applied directly — no analysisChanged gate and no fixed poll window to race, so a
  // slow Codex daemon (~25-35s) still lands its brief/state/eta/nextStep on the tab.
  function onBusAnalysisEvent(message){
    var sessionId=String(message&&message.sessionId||'');
    if(!sessionId) return;
    var s=findSessionById(sessionId);
    // Forks and promoted comments are visible locally only after their provider
    // identity / SessionView arrives. A fast daemon can finish before that bind;
    // retain its verdict instead of dropping the only live projection.
    if(!s){ objectCacheSet(orphanAnalysisMessages,sessionId,message,100); return; }
    var a=message.analysis;
    if(a){ applyAnalysis(s, a); return; }
    // null verdict (unparseable / no daemon): stop showing "analyzing" instead of hanging.
    if(s.analysisPending){
      s.analysisPending=false;
      if(cur&&cur.sessionId===s.sessionId) headerSig(s);
      scheduleSidebarRender();
    }
  }
  function onBusSessionEvent(message){
    var sessionId=String(message&&message.sessionId||'');
    var clientSessionId=String(message&&message.clientSessionId||'');
    var ev=message&&message.event;
    var emittedAt=Number(message&&message.emittedAt)||Date.now();
    if(!sessionId || !ev) return;
    if(onCommentBusEvent(message)) return;
    // Keep the cached SSE snapshot current with deltas between periodic snapshots.
    // In particular, result/error must remove the session immediately so opening
    // it cannot re-project an older "active" snapshot after the turn has ended.
    reduceLatestLiveSnapshotEvent(sessionId, clientSessionId, ev, emittedAt);
    var s=clientSessionId ? findSessionByClientId(clientSessionId) : findSessionById(sessionId);
    if(!s) s=findSessionById(sessionId);
    if(!s){
      var orphaned=orphanBusEvents[sessionId] || [];
      orphaned.push(message);
      objectCacheSet(orphanBusEvents,sessionId,orphaned.slice(-500),100);
      return;
    }
    if(clientSessionId && !s.clientBranchId) s.clientBranchId=clientSessionId;
    if(!s.providerSessionId && s.clientBranchId){
      bindProviderSessionId(s,sessionId);
      flushPendingSessionTags(s);
    }
    if(ev.kind==='run_config') applyRunConfigEvent(s,ev);
    if(ev.kind==='user_turn_started' || ev.kind==='queued_turn_started'){
      var retryTurn={text:ev.text||'',attachments:Array.isArray(ev.attachments)?ev.attachments:[]};
      var retryGoal=ev.goal===true || !!(s._providerRetry&&s._providerRetry.goalRequested);
      rememberProviderRetry(s,retryTurn,retryGoal);
    } else if(ev.kind==='result') s._providerRetry=null;
    if(ev.kind==='queued_turn_started' && ev.goal){
      applyGoalState(s,{objective:ev.text||'',vendor:String(s.vendor||'codex').toLowerCase(),status:'active',updatedAt:emittedAt});
    }
    if(ev.kind==='result' || ev.kind==='error'){
      s._runAcknowledgedEpoch=Math.max(Number(s._runAcknowledgedEpoch)||0,Number(s._runEpoch)||0);
      s._awaitingLiveStart=false;
      s._awaitingLiveStartAt=null;
    }
    s._busVersion=Number(s._busVersion||0)+1;
    if(ev.kind==='user_turn_started' || ev.kind==='queued_turn_started'){
      acknowledgeSessionRun(s,emittedAt);
      s.lastAssistantOutputAt=null;
      s.lastGenerationDurationMs=null;
      s.lastGenerationOutcome=null;
      s.analysisPending=false;
      clearTurnScopedSignals(s);
    } else if(ev.kind==='queued_turn_steered'){
      s.analysisPending=false;
      clearTurnScopedSignals(s);
    } else if((ev.kind==='assistant_text' && ev.text) || ev.kind==='tool_use' || ev.kind==='tool_result') s.lastAssistantOutputAt=emittedAt;
    else if(ev.kind==='result' || ev.kind==='error') finishGenerationTiming(s,emittedAt,generationOutcome(ev));
    syncLiveTiming(s);
    if(cur===s){
      onEvent(ev, String(s.sessionId||''), emittedAt);
      if(ev.kind==='result'||ev.kind==='error') reconcileMissingTranscriptBaseline(s);
      return;
    }
    if(ev.kind==='user_turn_started'){
      var userTurn={text:ev.text||'',attachments:Array.isArray(ev.attachments)?ev.attachments:[]};
      var userShown=shownTurnText(userTurn);
      var localUserEvent=matchesLocalUserEvent(s.sessionId,userShown,ev.startedAt||emittedAt);
      if(!localUserEvent && latestPendingUserText(s.sessionId)!==userShown){
        noteUserTurn(s, userShown);
        cacheTranscriptUserMsg(s, userShown, userTurn.attachments);
      }
      s.generating=true;
      s.generatingStartedAt=s.generatingStartedAt||emittedAt;
      reviveAttention(s);
    } else if(ev.kind==='queued_turn_started' || ev.kind==='queued_turn_steered'){
      var turn={text:ev.text||'',attachments:Array.isArray(ev.attachments)?ev.attachments:[]};
      var shown=shownTurnText(turn);
      noteUserTurn(s, shown);
      cacheTranscriptUserMsg(s, shown, turn.attachments);
      s.generating=true;
      s.generatingStartedAt=s.generatingStartedAt||emittedAt;
      reviveAttention(s);
    } else if(ev.kind==='assistant_text') cacheTranscriptAssistantText(s, ev.text);
    else if(ev.kind==='tool_use') cacheTranscriptToolUse(s, {id:ev.id,name:ev.name,input:ev.input});
    else if(ev.kind==='tool_result') cacheTranscriptToolResult(s, ev.id, String(ev.text||'').slice(0,8000), ev.isError);
    else if(ev.kind==='result' || ev.kind==='error'){
      s.generating=false;
      s.generatingStartedAt=null;
      s.lastAssistantOutputAt=null;
      markUnread(s);
      refreshAnalysis(s);
      reconcileMissingTranscriptBaseline(s);
    }
    applyGenerating(s);
    // Text/tool deltas only affect nodes already registered for this session:
    // applyGenerating + syncLiveTiming patch those in place. Rebuilding every
    // row for each streamed chunk is both wasteful and capable of detaching a
    // row during a click. Lifecycle edges can change ordering or filter
    // membership, so those still get one structural render.
    if(sessionEventNeedsSidebarRebuild(ev)){
      if(ev.kind==='user_turn_started' || ev.kind==='queued_turn_started' || ev.kind==='queued_turn_steered') sortSessions();
      scheduleSidebarRender();
    }
  }
  function onCommentBusEvent(message){
    var sessionId=String(message&&message.sessionId||'');
    var clientSessionId=String(message&&message.clientSessionId||'');
    var ev=message&&message.event;
    var emittedAt=Number(message&&message.emittedAt)||Date.now();
    var thread=commentThreadBySession(sessionId,clientSessionId);
    if(!thread) return false;
    if(sessionId && !thread.providerSessionId) thread=rememberCommentThread(Object.assign({},thread,{providerSessionId:sessionId}))||thread;
    var open=commentDrawerState.threadId===thread.id && !(byId('commentDrawer')||{}).hidden;
    if(ev.kind==='user_turn_started' || ev.kind==='queued_turn_started' || ev.kind==='queued_turn_steered'){
      thread=rememberCommentThread(Object.assign({},thread,{status:'generating',lastUserMessageAt:emittedAt}))||thread;
      if(open) setCommentGenerating(true,ev.startedAt||ev.steeredAt);
    } else if(ev.kind==='assistant_text'){
      if(open){
        var delta=String(ev.text||'');
        if(!delta) return true;
        commentDrawerState.lastAssistantOutputAt=emittedAt;
        if(!commentDrawerState.assistant) commentDrawerState.assistant=appendCommentMessage('assistant',delta);
        else {
          var bubble=commentDrawerState.assistant.querySelector('.bubble');
          setBubbleText(bubble,(bubble&&bubble.getAttribute('data-raw')||'')+delta,true);
        }
        keepCommentGeneratingLast();
        var host=byId('commentMsgs');
        if(host&&commentStick) host.scrollTop=host.scrollHeight;
        syncScrollBottomButton(host,byId('commentScrollBottom'));
        cacheOpenCommentMessages();
      }
    } else if(ev.kind==='tool_use'){
      if(open){
        commentDrawerState.lastAssistantOutputAt=emittedAt;
        commentDrawerState.assistant=null;
        appendCommentTool({id:ev.id,name:ev.name,input:ev.input});
        cacheOpenCommentMessages();
      }
    } else if(ev.kind==='tool_result'){
      if(open){
        commentDrawerState.lastAssistantOutputAt=emittedAt;
        commentDrawerState.assistant=null;
        var tool=ev.id?commentToolEls[ev.id]:null;
        if(tool){
          var out=tool.querySelector('.tool-out');
          out.textContent=String(ev.text||'').slice(0,8000); out.style.display='';
          if(ev.isError) out.className='tool-out err';
          updateToolBlockResult(tool,ev.text,ev.isError,true);
          if(hasQuestionAnswerResult(ev.text,ev.isError)) lockQuestionTool(tool);
        } else appendCommentTool({name:'result',input:null,result:ev.text,isError:ev.isError});
        cacheOpenCommentMessages();
      }
    } else if(ev.kind==='result' || ev.kind==='error'){
      var status=ev.kind==='error'||ev.ok===false ? 'failed' : (message.hasQueuedTurns?'generating':(open?'read':'unread'));
      thread=rememberCommentThread(Object.assign({},thread,{status:status}))||thread;
      if(open){
        if(ev.kind==='error') appendCommentProviderError(ev);
        setCommentBusy(false); setCommentGenerating(status==='generating');
        if(status==='read') markCommentRead(thread);
      }
      commentDrawerState.assistant=null;
    }
    return true;
  }
  function drainCommentOrphanEvents(thread){
    if(!thread) return;
    [thread.providerSessionId,thread.id].filter(Boolean).forEach(function(id){
      var pending=orphanBusEvents[id]; if(!pending) return;
      delete orphanBusEvents[id]; pending.forEach(onBusSessionEvent);
    });
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
  function drainOrphanAnalysis(s){
    if(!s) return false;
    var ids=[String(s.providerSessionId||''),providerSessionId(s),String(s.sessionId||'')].filter(Boolean);
    for(var i=0;i<ids.length;i++){
      var message=orphanAnalysisMessages[ids[i]];
      if(!message) continue;
      delete orphanAnalysisMessages[ids[i]];
      onBusAnalysisEvent(message);
      return true;
    }
    return false;
  }
  function onEvent(ev, streamSessionId, emittedAt){
    if(!cur || !cur.sessionId || String(cur.sessionId)!==String(streamSessionId||'')) return;
    if(ev.kind==='user_turn_started'){
      var userTurn={text:ev.text||'',attachments:Array.isArray(ev.attachments)?ev.attachments:[]};
      var userShown=shownTurnText(userTurn);
      var localUserEvent=matchesLocalUserEvent(cur.sessionId,userShown,ev.startedAt||emittedAt);
      if(!localUserEvent && latestPendingUserText(cur.sessionId)!==userShown){
        noteUserTurn(cur, userShown);
        cacheTranscriptUserMsg(cur, userShown, userTurn.attachments);
        addMsg('user', userShown, true, userTurn.attachments);
      }
      assistantEl=null;
      if(!turnActive) beginTurn(emittedAt);
    }
    else if(ev.kind==='queued_turn_started' || ev.kind==='queued_turn_steered'){
      var queueIndex=pendingQueue.findIndex(function(item){ return item.id===ev.queueId; });
      var queuedItem=queueIndex>=0?pendingQueue[queueIndex]:null;
      if(queueIndex>=0) pendingQueue.splice(queueIndex,1);
      if(ev.kind==='queued_turn_started') queueParked=false;
      var queuedItemReferences=turnPinReferences(queuedItem);
      var queuedTurn={text:ev.text||'',attachments:Array.isArray(ev.attachments)?ev.attachments:[],references:clonePinReferences(queuedItemReferences.length?queuedItemReferences:(Array.isArray(ev.references)?ev.references:[]))};
      var queuedShown=shownTurnText(queuedTurn);
      rememberPendingUserMsg(cur.sessionId, queuedShown, queuedTurn.attachments, queuedTurn.references, false);
      noteUserTurn(cur, queuedShown);
      cacheTranscriptUserMsg(cur, queuedShown, queuedTurn.attachments, queuedTurn.references);
      addMsg('user', queuedShown, true, queuedTurn.attachments, queuedTurn.references);
      assistantEl=null;
      if(ev.kind==='queued_turn_started' && !turnActive) beginTurn(emittedAt);
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
      if(t){ var o=t.querySelector('.tool-out'); o.textContent=String(ev.text||'').slice(0,8000); o.style.display=''; if(ev.isError) o.className='tool-out err'; updateToolBlockResult(t,ev.text,ev.isError); if(hasQuestionAnswerResult(ev.text, ev.isError)) lockQuestionTool(t); }
      else { addTool({name:'result',input:null,result:ev.text,isError:ev.isError}); }
      keepGenLast(); scroll(); scheduleLatestPin(); }
    else if(ev.kind==='goal'){ applyGoalState(cur,ev.goal||null); }
    else if(ev.kind==='result'){
      assistantEl=null;
      var currentGoal=goalForSession(cur);
      if(currentGoal && currentGoal.vendor==='claude') applyGoalState(cur,null);
      turnEnded(generationOutcome(ev));
    }
    else if(ev.kind==='error'){
      endCatchup(); assistantEl=null;
      var failedSession=cur;
      addProviderError(ev,failedSession&&failedSession._providerRetry?function(){ return retryProviderTurn(failedSession); }:undefined);
      turnEnded('failed');
    }
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
    if(cur.pendingScheduled){ materializeScheduledSession(cur); return; }
    if(cur.pendingNew){ showToast('Session is still starting. Your draft is preserved.', 'warn'); return; }
    if(composerVendorChanged()) return;
    var availability=vendorInfo(cur.vendor);
    if(availability && !availability.available){ showToast(availability.message||cur.vendor+' CLI is unavailable.','warn'); return; }
    var turn=currentComposerTurn();
    if(!turn.text && !turn.attachments.length) return;
    if(goalArmed && !turn.text){ showToast('Goal requires an objective','warn'); return; }
    if(cur.pendingFork){
      var forkGoal=goalArmed;
      if(forkGoal){ goalArmed=false; refreshGoalToggle(); }
      materializeFork(cur, turn, {goal:forkGoal}); return;
    }
    if(!cur.sessionId) return;
    clearComposer();
    // Mid-turn: queue the draft instead of blocking it. A naturally-finished
    // turn auto-advances into the queue; a manually-stopped one leaves it parked.
    if(turnActive){
      var queuedGoalRequested=goalArmed;
      if(queuedGoalRequested){ goalArmed=false; refreshGoalToggle(); }
      enqueue(turn,queuedGoalRequested);
      return;
    }
    var goalRequested=goalArmed;
    if(goalRequested){
      goalArmed=false;
      applyGoalState(cur,{objective:turn.text,vendor:goalVendor(),status:'active',updatedAt:Date.now()});
    }
    var shown=shownTurnText(turn);
    rememberPendingUserMsg(cur.sessionId, shown, turn.attachments, turn.references);
    markVisitSend();
    noteUserTurn(cur, shown);
    cacheTranscriptUserMsg(cur, shown, turn.attachments, turn.references);
    addMsg('user', shown, true, turn.attachments, turn.references); assistantEl=null;
    var previousAvoidance=clearDerivedAvoidance(cur);
    dispatchSend(turn, shown, previousAvoidance, goalRequested);
  }
  // Queue a draft (rendered in the pinned region below) to send when the turn ends.
  function currentComposerTurn(){
    var inp=byId('input');
    return {
      text: inp && inp.value ? inp.value.trim() : '',
      attachments: cloneAttachments(draftAttachments),
      references: clonePinReferences(draftPinReferences)
    };
  }
  function clearComposer(){
    resetComposerHistoryNavigation();
    var inp=byId('input');
    if(inp){ inp.value=''; syncComposerHeight(); }
    if(cur) setDraftForSession(cur, '');
    draftAttachments = [];
    draftPinReferences = [];
    if(cur) stashAttachmentState(cur);
    if(cur) stashPinReferenceState(cur);
    closePinReferencePicker();
    renderAttachments();
  }
  function shownTurnText(turn){ return composeTurnText(turn.text, turn.attachments); }
  function enqueue(turn,goalRequested){
    if(!cur || !cur.sessionId) return;
    var target=cur;
    var providerId=providerSessionId(target); if(!providerId) return;
    var temp=Object.assign({id:'pending-'+Date.now()},cloneTurn(turn),goalRequested?{goal:true}:{});
    pendingQueue.push(temp);
    target.queueCount=pendingQueue.length;
    syncQueueState(); syncSessionQueueBadge(target); renderQueue();
    var operation=beginOperation('queue-view',target);
    serializeMutation('queue-write',target,function(){
      return fetch('/chat/queue?session='+encodeURIComponent(providerId)+'&cwd='+encodeURIComponent(target.cwd||'')+'&vendor='+encodeURIComponent(target.vendor||'claude'),{
        method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({text:turn.text,attachments:turn.attachments||[],references:pinReferencePayload(turn.references),goal:goalRequested===true})
      }).then(function(r){ return r.json(); });
    }).then(function(res){
      if(temp.cancelled && res.ok && res.item && res.item.id){
        var deleteOperation=beginOperation('queue-view',target);
        serializeMutation('queue-write',target,function(){
          return fetch('/chat/queue?session='+encodeURIComponent(providerId)+'&item='+encodeURIComponent(res.item.id),{method:'DELETE'})
            .then(function(r){ return r.json(); });
        })
          .then(function(deleted){
            if(!operationIsCurrent(deleteOperation)) return;
            if(deleted.ok) applyServerQueue(target,deleted);
            else { showToast(deleted.error||'Could not delete queued message','warn'); refreshServerQueue(target); }
          })
          .catch(function(){ if(operationIsCurrent(deleteOperation)){ showToast('Could not delete queued message','warn'); refreshServerQueue(target); } });
        return;
      }
      if(!operationIsCurrent(operation)) return;
      applyServerQueue(target,res);
      if(!res.ok){
        dropOptimisticQueueItem(target,temp.id);
        setDraftForSession(target, turn.text||'');
        if(goalRequested && cur===target){ goalArmed=true; refreshGoalToggle(); }
        showToast(res.error||'Could not queue message','warn');
      }
    }).catch(function(){
      if(!operationIsCurrent(operation)) return;
      dropOptimisticQueueItem(target,temp.id);
      setDraftForSession(target, turn.text||'');
      if(goalRequested && cur===target){ goalArmed=true; refreshGoalToggle(); }
      showToast('Could not queue message','warn');
    });
  }
  // POST the turn and (re)attach the stream. The stream is opened once per
  // session in select(); only reopen if it somehow isn't (avoids replaying the
  // buffer and double-rendering the history).
  function dispatchSend(turn, shownText, previousAvoidance, goalRequested){
    if(!cur||!cur.sessionId){ endTurn('failed'); return; }
    var target=cur;
    rememberProviderRetry(target,turn,goalRequested);
    markReplied(target); // you advanced it → keep it tracked; only a manual gray clears it
    assistantEl=null; beginTurn();
    // /chat/send may spend several seconds resuming a cold provider session.
    // The entity-scoped lifecycle survives navigation until SSE acknowledges it.
    expectSessionRun(target,genStart);
    var runEpoch=Number(target._runEpoch)||0;
    touchSession(target); // sending is an interaction → float this session to the top
    var uiId=target.sessionId, id=providerSessionId(target), cwd=target.cwd||'', vendor=target.vendor||'claude';
    if(!id){ target._awaitingLiveStart=false; target._awaitingLiveStartAt=null; endTurn('failed'); return; }
    rememberModelConfiguration(vendor, target.model||'', target.effort||'', target.speed||'');
    // shownText contains the UI-only attachment summary. Sending it as the real
    // prompt makes the server echo that summary together with attachments, then
    // shownTurnText() appends it again and defeats optimistic-event de-duplication.
    var body={ text: turn.text, attachments: turn.attachments || [], references:pinReferencePayload(turn.references) };
    if(goalRequested) body.goal=true;
    if(target.runConfigDirty){
      body.runConfig=true;
      body.model=target.model||undefined;
      body.effort=target.effort||undefined;
      body.speed=target.speed||undefined;
    }
    function failSend(rawError){
      if(sessionRunWasAcknowledged(target,runEpoch)) return;
      var publicError=normalizedProviderError(rawError,'Send failed.');
      target._awaitingLiveStart=false;
      target._awaitingLiveStartAt=null;
      restoreDerivedAvoidance(target, previousAvoidance);
      forgetPendingUserMsg(uiId, shownText);
      if(goalRequested){ applyGoalState(target,null); goalArmed=true; }
      if(cur===target){
        addProviderError(publicError,function(){ return retryProviderTurn(target); });
        turnEnded('failed');
        return;
      }
      rejectSessionRun(target,'failed');
      renderSidebar();
      showToast(publicError.message,'warn');
    }
    var sendRequest=fetch('/chat/send?session='+encodeURIComponent(id)+'&cwd='+encodeURIComponent(cwd)+'&vendor='+encodeURIComponent(vendor),{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(body)
    })
      .then(function(r){return r.json();});
    // Stop can be clicked before this request reaches /chat/send. Keep the
    // acknowledgement available so stopTurn can retry an abort that arrived
    // before the server had registered the starting turn.
    target._pendingSendRequest=sendRequest;
    sendRequest.then(function(res){ if(res.ok){
      if(res.view) patchSessionView(res.view,{source:'send'});
      if(goalRequested && res.goal) applyGoalState(target,res.goal);
      target.runConfigDirty=false;
      if(cur===target) refreshRunConfigButton();
    } else failSend(res); })
      .catch(function(e){ failSend({message:'Network error: '+(e&&e.message?e.message:e),retryable:true}); });
    sendRequest.then(function(){ if(target._pendingSendRequest===sendRequest) target._pendingSendRequest=null; },function(){ if(target._pendingSendRequest===sendRequest) target._pendingSendRequest=null; });
  }
  // Stop: interrupt the in-flight turn. Keep queued drafts intact; when the abort result arrives, turnEnded
  // will leave them parked so you can edit or send one explicitly.
  function stopTurn(){
    if(!cur||!cur.sessionId) return;
    var stopping=cur;
    var pendingSend=stopping._pendingSendRequest;
    stopRequested=true;
    renderQueue();
    var b=genEl&&genEl.querySelector('.bubble'); if(b){ b.textContent='Stopping…'; }
    var providerId=providerSessionId(cur); if(!providerId) return;
    function abortOnce(){
      return fetch('/chat/abort?session='+encodeURIComponent(providerId)+'&vendor='+encodeURIComponent(stopping.vendor||'claude'),{method:'POST'})
        .then(function(r){ return r.json().catch(function(){ return {}; }); })
        .catch(function(){ return {ok:false}; });
    }
    var stopRequest=abortOnce().then(function(first){
      if(!pendingSend) return first;
      // HTTP requests may be processed out of order. If the first abort saw no
      // turn, wait for send acknowledgement and retry against the registered run.
      return pendingSend.then(function(sent){
        if(first.ok || !sent || !sent.ok) return first;
        return abortOnce();
      },function(){ return first; });
    }).then(function(res){
      if(cur!==stopping || !stopRequested) return !!stopping.lastGenerationStoppedByUser;
      if(res && res.ok){ turnEnded(); syncCurrentLiveState(stopping); return true; }
      stopRequested=false;
      renderQueue(); updateSendLabel();
      showToast('Could not stop the current turn.','warn');
      syncCurrentLiveState(stopping);
      return false;
    });
    stopping._pendingStopRequest=stopRequest;
    stopRequest.then(function(){ if(stopping._pendingStopRequest===stopRequest) stopping._pendingStopRequest=null; },function(){ if(stopping._pendingStopRequest===stopRequest) stopping._pendingStopRequest=null; });
  }
  function startForkFromPrefix(prefixHistory, firstTurn){
    if(!cur||!cur.sessionId) return;
    var config=currentForkDefaults();
    var info=vendorInfo(config.vendor);
    if(info && (!info.available || info.chat===false)){ showToast(info.message||config.vendor+' is not available for in-browser forks', 'warn'); return; }
    if(!info){ showToast('unknown vendor: '+config.vendor, 'warn'); return; }
    var clientBranchId=makeClientBranchId();
    var ns={
      vendor:config.vendor,
      model:config.model||'',
      effort:config.effort||'',
      speed:config.speed||'',
      sessionId:clientBranchId,
      clientBranchId:clientBranchId,
      providerSessionId:null,
      forkParentId:providerSessionId(cur),
      pendingFork:{
        parent:providerSessionId(cur),
        parentVendor:cur.vendor,
        cwd:cur.cwd||'',
        consumeParentDraft:false,
        opener:true,
        model:config.model||'',
        effort:config.effort||'',
        speed:config.speed||'',
        prefixHistory:cloneTranscriptMsgs(prefixHistory)
      },
      title:forkTitleFromSession(cur, firstTurn.text),
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
    inheritSessionTextCollections(cur,ns);
    inheritSessionGoal(cur,ns);
    insertSession(ns);
    groupChatSession(cur,ns);
    select(ns);
    materializeFork(ns, firstTurn);
  }
  function startFork(config,openingTurn,opts){
    if(!cur||!cur.sessionId){ alert('Pick a session on the left before splitting.'); return null; }
    if(cur.pendingFork){ byId('input').focus(); return null; }
    config = config || currentForkDefaults();
    var info=vendorInfo(config.vendor);
    if(info && (!info.available || info.chat===false)){ showToast(info.message||config.vendor+' is not available for in-browser forks', 'warn'); return null; }
    if(!info){ showToast('unknown vendor: '+config.vendor, 'warn'); return null; }
    // Forking a still-generating session is fine: the fork snapshots the parent's
    // transcript as it stands now (history up to the latest generated token) and
    // diverges from there — the parent keeps running untouched.
    // Add the branch immediately, but keep the chat focused on the parent. The
    // real fork is materialized lazily on the first message: every backend needs
    // a turn to diverge on (Claude
    // mints the new id on first input; Codex copies the parent's rollout then
    // resumes it), so we defer the actual /chat/fork until send().
    // A just-created fork is in-progress, not parked → seed it 'seen' (hollow green
    // dot), never the default gray "read".
    // If you'd already typed something, that becomes the branch's opening turn —
    // "I typed this, but it's better off as a split" — and we materialize now.
    var inp=byId('input');
    var firstTurn=openingTurn ? cloneTurn(openingTurn) : currentComposerTurn();
    var queueItemId=String(opts&&opts.queueItemId||'');
    var clientBranchId=makeClientBranchId();
    var parentSession=cur;
    var ns={vendor:config.vendor,model:config.model||'',effort:config.effort||'',speed:config.speed||'',sessionId:clientBranchId,clientBranchId:clientBranchId,providerSessionId:null,forkParentId:providerSessionId(cur),pendingFork:{parent:providerSessionId(cur),parentVendor:cur.vendor,cwd:cur.cwd||'',consumeParentDraft:!openingTurn&&!!(firstTurn.text || firstTurn.attachments.length),opener:!!(firstTurn.text || firstTurn.attachments.length),queueItemId:queueItemId||null,model:config.model||'',effort:config.effort||'',speed:config.speed||''},title:forkTitleFromSession(cur, firstTurn.text),lastPrompt:null,cwd:cur.cwd,project:cur.project,file:'',ageDays:0,lastTs:Date.now(),prompts:0,brief:null,state:null,seen:true,tags:(cur.tags||[]).slice()};
    inheritSessionTextCollections(parentSession,ns);
    inheritSessionGoal(parentSession,ns);
    insertSession(ns); groupChatSession(parentSession,ns); renderSidebar();
    if(firstTurn.text || firstTurn.attachments.length){
      var forkGoal=goalArmed && !!(firstTurn.text||'').trim();
      if(goalArmed){ goalArmed=false; refreshGoalToggle(); }
      materializeFork(ns, firstTurn, {background:true, goal:forkGoal});
    }
    else { inp.focus(); }
    return ns;
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
  function materializeFork(branch,turn,opts){
    var background=!!(opts&&opts.background&&cur!==branch);
    var queuedItemId=String(branch.pendingFork&&branch.pendingFork.queueItemId||'');
    // Goal fork: the branch's own opening message becomes the objective. Only the
    // plain /chat/fork path supports it — a queued fork uses a different endpoint.
    var goalRequested=!!(opts&&opts.goal) && !queuedItemId;
    // Opener forks skip select()'s async placeholder synchronously (pendingFork
    // .opener), so this flag only matters for the empty-fork path: if the user
    // typed + sent before select()'s in-flight placeholder render resolved,
    // mark materializing so that render stands down instead of replaceMessages()
    // -ing away the opening user turn we're about to render.
    if(branch.pendingFork) branch.pendingFork.materializing = true;
    var shown=shownTurnText(turn);
    var parent=findSessionById(branch.pendingFork.parent);
    function settleQueuedFork(consumed){
      if(!queuedItemId || !parent) return;
      delete forkingQueueItems[queuedForkKey(parent,queuedItemId)];
      if(consumed) dropOptimisticQueueItem(parent,queuedItemId);
      refreshServerQueue(parent);
      if(cur===parent) renderQueue();
    }
    if(String(turn&&turn.text||'').trim()) branch.title=forkTitleFromSession(parent, turn.text);
    var hasPrefix=!!(branch.pendingFork && Object.prototype.hasOwnProperty.call(branch.pendingFork, 'prefixHistory'));
    var parentHistory=hasPrefix
      ? cloneTranscriptMsgs(branch.pendingFork.prefixHistory || [])
      : forkBaseHistory((parent && cachedTranscriptFor(parent)) || [], shown);
    var inp=byId('input');
    if(!background){
      if(parentHistory.length) renderPersistedAndPending(parentHistory, null);
      else byId('msgs').innerHTML='';
    }
    noteUserTurn(branch, shown);
    if(!background) addMsg('user', shown, true, turn.attachments, turn.references);
    // The branch cache is keyed by its stable client identity from the start.
    // Provider events can now append safely even before /chat/fork returns.
    cacheTranscript(branch, parentHistory);
    rememberPendingUserMsg(branch.sessionId, shown, turn.attachments, turn.references);
    cacheTranscriptUserMsg(branch, shown, turn.attachments, turn.references);
    resetComposerHistoryNavigation();
    if(inp){ inp.value=''; syncComposerHeight(); }
    setDraftForSession(background ? parent : branch, '');
    if(background && parent && cur===parent) syncOpenHeader();
    draftAttachments=[];
    draftPinReferences=[];
    if(background && parent) stashAttachmentState(parent); else stashAttachmentState(branch);
    if(background && parent) stashPinReferenceState(parent); else stashPinReferenceState(branch);
    renderAttachments();
    if(background){
      expectSessionRun(branch);
      renderSidebar();
    } else {
      assistantEl=null;
      beginTurn();
      expectSessionRun(branch,genStart);
    }
    var runEpoch=Number(branch._runEpoch)||0;
    var vendor=branch.vendor||'claude';
    var model=(branch.pendingFork&&branch.pendingFork.model)||branch.model||'';
    var effort=(branch.pendingFork&&branch.pendingFork.effort)||branch.effort||'';
    var speed=(branch.pendingFork&&branch.pendingFork.speed)||branch.speed||'';
    rememberModelConfiguration(vendor, model, effort, speed);
    var body={text:turn.text, attachments:turn.attachments || [], references:pinReferencePayload(turn.references), model:model||undefined, effort:effort||undefined, speed:speed||undefined, clientSessionId:branch.clientBranchId, parentVendor:(branch.pendingFork&&branch.pendingFork.parentVendor)||undefined};
    if(hasPrefix) body.contextMessages=parentHistory;
    if(goalRequested) body.goal=true;
    function keepAcknowledgedFork(){
      if(!sessionRunWasAcknowledged(branch,runEpoch)) return false;
      if(branch.pendingFork&&branch.pendingFork.consumeParentDraft) clearDraftForSession(parent);
      branch.pendingFork=null;
      branch.model=model; branch.effort=effort; branch.speed=speed;
      flushPendingSessionTags(branch);
      markReplied(branch);
      settleQueuedFork(true);
      if(cur===branch){ syncOpenHeader(); refreshForkButton(); refreshRunConfigButton(); }
      renderSidebar();
      return true;
    }
    var forkPath=(queuedItemId?'/chat/queue/fork':'/chat/fork')+'?session='+encodeURIComponent(branch.pendingFork.parent)+'&cwd='+encodeURIComponent(branch.pendingFork.cwd)+'&vendor='+encodeURIComponent(vendor)+(queuedItemId?'&item='+encodeURIComponent(queuedItemId):'');
    fetch(forkPath,
      {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
       .then(function(r){return r.json();}).then(function(res){ if(!res.ok){
        if(keepAcknowledgedFork()) return;
        settleQueuedFork(false);
        if(cur===branch){ branch._awaitingLiveStart=false; branch._awaitingLiveStartAt=null; addProviderError(res); endTurn('failed'); }
        else { rejectSessionRun(branch,'failed'); renderSidebar(); showToast(res.error||'fork failed','warn'); }
        return;
       }
       if(branch.pendingFork.consumeParentDraft) clearDraftForSession(parent);
        var forkAlreadyFinished=res.generating===false;
        if(forkAlreadyFinished) rejectSessionRun(branch,'generated');
        bindProviderSessionId(branch,res.session);
        if(goalRequested && res.goal) applyGoalState(branch,res.goal);
        branch.forkParentId=res.parentSessionId||branch.forkParentId||branch.pendingFork.parent;
        rememberForkRelation(res.session,branch.forkParentId);
        branch.pendingFork=null;
        if(res.cwd) branch.cwd=res.cwd;
        if(res.project) branch.project=res.project;
        else if(res.cwd) branch.project=basename(res.cwd);
        branch.file='';
        branch.model=model; branch.effort=effort; branch.speed=speed;
        flushPendingSessionTags(branch);
        drainOrphanBusEvents(branch);
        markReplied(branch);
        settleQueuedFork(true);
        // The active snapshot may have arrived while this object still had its
        // pending id. Re-project the already-received SSE state after the id bind;
        // this is local event-store reduction, not an extra live-status request.
        var snapshotActive=latestLiveSnapshot&&Array.isArray(latestLiveSnapshot.active) ? latestLiveSnapshot.active : [];
        if(latestLiveSnapshot && (!background || snapshotActive.indexOf(res.session)>=0)) applyLiveSnapshot(latestLiveSnapshot);
        if(cur===branch){ syncOpenHeader(); renderSidebar(); refreshForkButton(); refreshRunConfigButton(); }
        else renderSidebar();
        if(forkAlreadyFinished && branch.analysisPending) refreshAnalysis(branch);
        // Best-effort: resolve the fork's own JSONL so a full page reload (which
        // drops the in-memory cache) can reload its complete history from disk.
        warmTranscriptCache(branch); })
       .catch(function(e){
        if(keepAcknowledgedFork()) return;
        settleQueuedFork(false);
        if(cur===branch){ branch._awaitingLiveStart=false; branch._awaitingLiveStartAt=null; addProviderError({message:'Fork failed: '+(e&&e.message?e.message:e),retryable:true}); endTurn('failed'); }
        else { rejectSessionRun(branch,'failed'); renderSidebar(); showToast('fork failed: '+(e&&e.message?e.message:e),'warn'); }
       });
  }
  function vendorInfo(id){
    var want=String(id||'').trim().toLowerCase();
    for(var i=0;i<VENDORS.length;i++){ if(String(VENDORS[i].vendor||'').toLowerCase()===want) return VENDORS[i]; }
    return null;
  }
  function newSession(){
    if(newSessionPending) return;
    setNewPending(false,'');
    var dir=(byId('ndir')||{}).value ? byId('ndir').value.trim() : '';
    var text=byId('np').value.trim();
    var attachments=newAttachments.map(function(att){ return Object.assign({}, att); });
    if(!dir){ byId('nmsg').textContent='pick or type a directory'; return; }
    var vendor=(byId('nvendor')||{}).value ? byId('nvendor').value.trim().toLowerCase() : '';
    if(!vendor){ byId('nmsg').textContent='pick a vendor'; return; }
    var info=vendorInfo(vendor);
    if(info && !info.available){ byId('nmsg').textContent=info.message||vendor+' CLI is unavailable.'; return; }
    if(!info){ byId('nmsg').textContent='unknown vendor: '+vendor; return; }
    var goalRequested=newGoalArmed;
    if(goalRequested && !text){ byId('nmsg').textContent='Goal requires an objective'; return; }
    if(goalRequested && vendor!=='codex' && vendor!=='claude'){ byId('nmsg').textContent=vendor+' does not support Goal'; return; }
    var requestedText=text;
    var model=selectedNewModel();
    var effort=selectedNewEffort();
    var speed=selectedNewSpeed();
    var initialTags=newSessionTags.slice();
    var launchQs=(model?('&model='+encodeURIComponent(model)):'')+(effort?('&effort='+encodeURIComponent(effort)):'')+(speed?('&speed='+encodeURIComponent(speed)):'');
    // A vendor without in-browser chat (terminal-only) launches a real terminal.
    if(info && info.chat===false){
      if(attachments.length){ byId('nmsg').textContent='attachments are only available for in-browser chat sessions'; return; }
      var terminalOperation=++newSessionOperation;
      setNewPending(true,'Opening terminal…');
      fetch('/launch?action=new&vendor='+encodeURIComponent(vendor)+'&cwd='+encodeURIComponent(dir)+launchQs+(text?('&prompt='+encodeURIComponent(text)):''),{method:'POST'})
        .then(function(r){return r.json();}).then(function(res){
          if(!res.ok){ if(terminalOperation===newSessionOperation) setNewPending(false, res.error||'failed'); return; }
          rememberNewSessionPrefs(vendor, model, effort, speed);
          rememberRecentDir(res.cwd||dir);
          byId('np').value='';
          resetNewSessionDir(res.cwd||dir);
          if(terminalOperation===newSessionOperation) setNewPending(false, 'Launched in terminal: '+res.command); })
        .catch(function(e){ if(terminalOperation===newSessionOperation) setNewPending(false, e&&e.message?e.message:'failed'); });
      return;
    }
    var operation=++newSessionOperation;
    setNewPending(true,'Starting session…');
    // In-browser chat. Claude can open empty; process-per-turn CLIs mint an id
    // only after the first turn, so give those an opening message when omitted.
    if(vendor!=='claude' && !text && !attachments.length){ text='hello'; }
    var previous=cur;
    var clientSessionId=makeClientSessionId('new');
    var shown=composeTurnText(text, attachments);
    var ns={vendor:vendor,model:model||'',effort:effort||'',speed:speed||'',sessionId:clientSessionId,clientBranchId:clientSessionId,providerSessionId:null,pendingNew:true,title:shown||'(new session)',lastPrompt:null,cwd:dir,project:basename(dir),file:'',ageDays:0,lastTs:Date.now(),prompts:0,brief:null,state:null,seen:true,tags:initialTags,_pendingSessionTags:initialTags.slice(),generating:!!shown,generatingStartedAt:shown?Date.now():null};
    if(shown) expectSessionRun(ns,ns.generatingStartedAt);
    var runEpoch=Number(ns._runEpoch)||0;
    cacheTranscript(ns, []);
    if(shown){
      rememberPendingUserMsg(clientSessionId, shown, attachments);
      noteUserTurn(ns, shown);
      cacheTranscriptUserMsg(ns, shown, attachments);
    }
    insertSession(ns); select(ns);
    if(shown && ns.generating && !turnActive) beginTurn(ns.generatingStartedAt);
    byId('np').value=''; newAttachments=[]; newGoalArmed=false; newSessionTags=[]; renderAttachments('new'); refreshNewGoalToggle(); renderNewTagPicker(); resetNewSessionDir(dir); closeNewBox();
    // The pending state belongs to the optimistic session above, not to this
    // reusable form. Let another session be composed while the provider is still
    // minting the first one's id.
    setNewPending(false,'');
    var resetFormSnapshot=newSessionFormSnapshot();
    function failNewSession(rawError){
      if(sessionRunWasAcknowledged(ns,runEpoch)){
        ns.pendingNew=false;
        renderSidebar();
        return;
      }
      var publicError=normalizedProviderError(rawError,'Could not start session.');
      var idx=SESS.indexOf(ns); if(idx>=0) SESS.splice(idx,1);
      forgetPendingUserMsg(clientSessionId,shown);
      if(cur===ns){
        var fallback=previous&&SESS.indexOf(previous)>=0 ? previous : (SESS[0]||null);
        if(fallback) select(fallback); else resetOpenHeader();
      } else renderSidebar();
      var canRestoreDraft=operation===newSessionOperation && newSessionFormSnapshot()===resetFormSnapshot;
      if(!canRestoreDraft){
        showToast(publicError.message||'Could not start session.','warn');
        return;
      }
      var prompt=byId('np'); if(prompt) prompt.value=requestedText;
      newAttachments=attachments.map(function(att){ return Object.assign({},att); });
      newGoalArmed=goalRequested;
      // The optimistic reset above cleared the form; restore the dir + tags too so
      // a retry re-runs with exactly what the user had entered.
      newSessionTags=initialTags.slice();
      var ndir=byId('ndir'); if(ndir){ ndir.value=dir; ndir.setAttribute('data-dir-selection','1'); applyDirChooserTheme(dir); }
      renderAttachments('new'); refreshNewGoalToggle(); renderNewTagPicker();
      openNewBox();
      showNewSessionProviderError(publicError,function(){ newSession(); });
    }
    fetch('/chat/new?cwd='+encodeURIComponent(dir)+'&vendor='+encodeURIComponent(vendor),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text, attachments:attachments, model:model||undefined, effort:effort||undefined, speed:speed||undefined, clientSessionId:clientSessionId, goal:goalRequested===true})})
      .then(function(r){return r.json();}).then(function(res){ if(!res.ok){ failNewSession(res); return; }
        rememberNewSessionPrefs(vendor, model, effort, speed);
        var cwd=res.cwd||dir;
        rememberRecentDir(cwd);
        bindProviderSessionId(ns,res.session);
        if(goalRequested && res.goal) applyGoalState(ns,res.goal);
        ns.pendingNew=false;
        ns.cwd=cwd; ns.project=basename(cwd);
        flushPendingSessionTags(ns);
        drainOrphanBusEvents(ns);
        if(latestLiveSnapshot) applyLiveSnapshot(latestLiveSnapshot);
        if(cur===ns){ syncOpenHeader(); refreshForkButton(); refreshGoalToggle(); }
        renderSidebar(); warmTranscriptCache(ns);
        // Do not let this older request rewrite a newer draft. When the form is
        // still untouched, it is safe to refine its reset dir to the resolved cwd.
        if(operation===newSessionOperation && newSessionFormSnapshot()===resetFormSnapshot){
          resetNewSessionDir(cwd);
          resetFormSnapshot=newSessionFormSnapshot();
        }
      }).catch(function(e){ failNewSession({message:e&&e.message?e.message:'Could not start session.',retryable:true}); });
  }

  function initApp(){
  syncSchedules(SCHEDULES,true);
  var scheduleNew=byId('scheduleNew'); if(scheduleNew){
    setIconButton(scheduleNew,'clock','schedule new session'); scheduleNew.setAttribute('aria-expanded','false');
    scheduleNew.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); openSchedulePopover(scheduleNew,[{id:'start',label:'Start session',primary:true,submit:scheduleNewSession}]); };
  }
  var scheduleChat=byId('scheduleChat'); if(scheduleChat){
    setIconButton(scheduleChat,'clock','schedule Send or Fork'); scheduleChat.setAttribute('aria-expanded','false');
    scheduleChat.onclick=function(ev){
      ev.preventDefault(); ev.stopPropagation();
      var actions=[];
      if(canForkCur()) actions.push({id:'fork',label:'Fork',submit:scheduleCurrentFork});
      actions.push({id:'send',label:'Send',primary:true,submit:scheduleCurrentMessage});
      openSchedulePopover(scheduleChat,actions,undefined,'send');
    };
  }
  var scheduleComment=byId('scheduleComment'); if(scheduleComment){
    setIconButton(scheduleComment,'clock','schedule comment'); scheduleComment.setAttribute('aria-expanded','false');
    scheduleComment.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); openSchedulePopover(scheduleComment,[{id:'send',label:'Send comment',primary:true,submit:scheduleCurrentComment}]); };
  }
  var scheduleDateTimeInput=byId('scheduleDateTimeInput'); if(scheduleDateTimeInput){
    scheduleDateTimeInput.onblur=function(){ applyScheduleDirectInput(false); };
    scheduleDateTimeInput.onkeydown=function(ev){ if(ev.key==='ArrowDown'){ ev.preventDefault(); applyScheduleDirectInput(false); toggleSchedulePicker(true); } else if(ev.key==='Enter'){ ev.preventDefault(); submitScheduleAction(defaultScheduleAction()); } else if(ev.key==='Escape'){ ev.preventDefault(); closeSchedulePopover(); } };
  }
  var schedulePickerToggle=byId('schedulePickerToggle'); if(schedulePickerToggle) schedulePickerToggle.onclick=function(){ applyScheduleDirectInput(false); toggleSchedulePicker(); };
  var schedulePrevMonth=byId('schedulePrevMonth'); if(schedulePrevMonth) schedulePrevMonth.onclick=function(){ if(!schedulePopoverState) return; var d=new Date(schedulePopoverState.calendarMonth); d.setMonth(d.getMonth()-1); schedulePopoverState.calendarMonth=d.getTime(); renderSchedulePicker(); };
  var scheduleNextMonth=byId('scheduleNextMonth'); if(scheduleNextMonth) scheduleNextMonth.onclick=function(){ if(!schedulePopoverState) return; var d=new Date(schedulePopoverState.calendarMonth); d.setMonth(d.getMonth()+1); schedulePopoverState.calendarMonth=d.getTime(); renderSchedulePicker(); };
  ['scheduleHour','scheduleMinute'].forEach(function(id){
    var input=byId(id); if(!input) return;
    input.onfocus=function(){ input.select(); };
    input.onblur=applyScheduleTimeParts;
    input.onkeydown=function(ev){
      if(ev.key==='Escape'){ ev.preventDefault(); closeSchedulePopover(); return; }
      if(ev.key==='Enter'){ ev.preventDefault(); applyScheduleTimeParts(); submitScheduleAction(defaultScheduleAction()); return; }
      if(ev.key!=='ArrowUp'&&ev.key!=='ArrowDown') return;
      ev.preventDefault(); var max=id==='scheduleHour'?23:59, value=Number(input.value)||0, delta=ev.key==='ArrowUp'?1:-1; input.value=schedulePad((value+delta+max+1)%(max+1)); applyScheduleTimeParts();
    };
  });
  var chatScrollBottom=byId('chatScrollBottom'); if(chatScrollBottom){ setIconButton(chatScrollBottom,'down','Scroll to bottom'); chatScrollBottom.onclick=scrollChatToBottom; }
  var commentScrollBottom=byId('commentScrollBottom'); if(commentScrollBottom){ setIconButton(commentScrollBottom,'down','Scroll comments to bottom'); commentScrollBottom.onclick=scrollCommentsToBottom; }
  var commentMsgs=byId('commentMsgs'); if(commentMsgs) commentMsgs.addEventListener('scroll',function(){ commentStick=nearScrollBottom(commentMsgs); syncScrollBottomButton(commentMsgs,commentScrollBottom); scheduleCommentLatestPin(); });
  var commentLatestPin=byId('commentLatestPin'); if(commentLatestPin){ commentLatestPin.onclick=jumpToCommentLatestPin; commentLatestPin.onkeydown=function(ev){ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); jumpToCommentLatestPin(); } }; }
  var commentClose=byId('commentClose'); if(commentClose) commentClose.onclick=closeCommentDrawer;
  var commentPromote=byId('commentPromote'); if(commentPromote) commentPromote.onclick=promoteCommentThread;
  var commentDrawer=byId('commentDrawer'); if(commentDrawer) commentDrawer.onclick=function(ev){ if(ev.target===commentDrawer) closeCommentDrawer(); };
  var commentSend=byId('commentSend'); if(commentSend) commentSend.onclick=commentPrimaryAction;
  var commentInput=byId('commentInput'); if(commentInput){
    commentInput.onkeydown=function(ev){
      if(ev.key==='Tab'&&!ev.shiftKey&&!ev.altKey&&!ev.ctrlKey&&!ev.metaKey&&!isImeConfirming(ev)&&completeCommentShortcut(this)){ ev.preventDefault(); return; }
      if(ev.key==='Enter'&&!ev.shiftKey&&!isImeConfirming(ev)){ ev.preventDefault(); sendComment(); }
      else if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); if(commentDrawerState.generating) stopCommentTurn(); }
    };
    commentInput.addEventListener('compositionstart',function(){ commentShortcutComposing=true; syncCommentShortcutGhost(); });
    commentInput.addEventListener('compositionend',function(){ commentShortcutComposing=false; syncCommentShortcutGhost(); });
    commentInput.addEventListener('input',syncCommentShortcutGhost);
    commentInput.addEventListener('select',syncCommentShortcutGhost);
    commentInput.addEventListener('click',syncCommentShortcutGhost);
    commentInput.addEventListener('keyup',syncCommentShortcutGhost);
    commentInput.addEventListener('scroll',syncCommentShortcutGhost,{passive:true});
    commentInput.addEventListener('focus',syncCommentShortcutGhost);
    commentInput.addEventListener('blur',function(){ var ghost=byId('commentShortcutGhost'); if(ghost) ghost.hidden=true; });
  }
  // Stream active-session snapshots so background tabs show generating state.
  // A lost stream is reported as an Attend service error; it is never masked by polling.
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
  refreshCursorModels();
  var cursorModelRefreshCount=0;
  var cursorModelRefreshTimer=window.setInterval(function(){
    refreshCursorModels();
    cursorModelRefreshCount++;
    if(cursorModelRefreshCount>=12) window.clearInterval(cursorModelRefreshTimer);
  }, 5000);

  // Drag the divider to resize the sidebar; width persists across reloads.
  (function(){
    var rz=byId('resizer'), side=document.querySelector('.side'); if(!rz||!side) return;
    var saved=parseInt(localStorage.getItem('attend.sideW')||'',10);
    if(saved>=200 && saved<=720) side.style.width=saved+'px';
    var dragging=false;
    rz.addEventListener('mousedown',function(e){ dragging=true; rz.classList.add('dragging'); document.body.style.userSelect='none'; e.preventDefault(); });
    window.addEventListener('mousemove',function(e){ if(!dragging) return; var w=Math.min(Math.max(e.clientX,200),720); side.style.width=w+'px'; if(sessionPanelOpen) applySessionPanelWidth(); });
    window.addEventListener('mouseup',function(){ if(!dragging) return; dragging=false; rz.classList.remove('dragging'); document.body.style.userSelect='';
      try{ localStorage.setItem('attend.sideW', String(parseInt(side.style.width,10))); }catch(e){} });
  })();
  initSessionPanelLayout();
  bindChatGroupDrop();

  sortSessions();
  restoreChatGroups();
  seedForkChatGroups();
  renderTagFilters();
  renderSidebar();
  renderTodoHubSummary();
  byId('list').addEventListener('scroll',scheduleSidebarWindow,{passive:true});
  byId('sessionPanel').addEventListener('scroll',scheduleSessionPanelVirtualWindow,{passive:true});
  window.addEventListener('resize',scheduleSessionPanelVirtualWindow);
  window.setInterval(tickLiveTimings,1000);
  resetOpenHeader();
  setupCustomSelects();
  setupSessionSearchRange();
  setupVendorChooser();
  syncModelWarnings();
  setupDirChooser();
  bindComposerDrop();
  bindNewAttachments();
  setupHoverTips();
  renderAttachments();
  renderAttachments('new');
  scheduleOverlayOffsets();
  scheduleCommentOverlayOffsets();
  window.addEventListener('resize', scheduleOverlayOffsets);
  window.addEventListener('resize', scheduleCommentOverlayOffsets);
  window.addEventListener('resize', alignComposerRailPanel);
  window.addEventListener('resize', syncComposerShortcutGhost);
  window.addEventListener('resize', syncCommentShortcutGhost);
  window.addEventListener('resize', scheduleSidebarWindow);
  window.addEventListener('resize',function(){ if(sessionPanelOpen) applySessionPanelWidth(); else { syncNewBoxPlacement(); syncTodoHubPlacement(); } });
  window.addEventListener('resize', syncNewShortcutGhost);
  var composerRailControls=document.querySelector('.composerrail-controls');
  if(composerRailControls) composerRailControls.addEventListener('scroll',alignComposerRailPanel,{passive:true});
  window.addEventListener('resize',function(){ if(!byId('forkTree').hidden) fitForkTree(); });
  if(window.ResizeObserver){
    var overlayObserver=new ResizeObserver(scheduleOverlayOffsets);
    ['msgs','composer','queue','avoidPanel','attachTray','attachMsg'].forEach(function(id){
      var node=byId(id);
      if(node) overlayObserver.observe(node);
    });
    var commentOverlayObserver=new ResizeObserver(scheduleCommentOverlayOffsets);
    ['commentMsgs','commentQueue'].forEach(function(id){
      var node=byId(id);
      if(node) commentOverlayObserver.observe(node);
    });
    var commentFoot=document.querySelector('.commentfoot');
    if(commentFoot) commentOverlayObserver.observe(commentFoot);
    var composerInput=byId('input');
    if(composerInput) new ResizeObserver(syncComposerShortcutGhost).observe(composerInput);
    if(commentInput) new ResizeObserver(syncCommentShortcutGhost).observe(commentInput);
    var newInput=byId('np');
    if(newInput) new ResizeObserver(syncNewShortcutGhost).observe(newInput);
  }
  syncRefreshButton();
  refreshRunConfigButton();
  setTheme(currentTheme(), false);
  // The send button is also the Stop button mid-turn.
  byId('send').onclick=function(){ if(turnActive) stopTurn(); else if(composerVendorChanged()) fork(); else send(); };
  byId('themeToggle').onclick=toggleTheme;
  byId('sessionPanelToggle').onclick=toggleSessionPanel;
  byId('workStatsBtn').onclick=openWorkStats;
  byId('workStatsClose').onclick=closeWorkStats;
  byId('workStats').onclick=function(ev){ if(ev.target===this) closeWorkStats(); };
  byId('tagActionClear').onclick=function(){ var tag=pendingGlobalTagAction; closeGlobalTagAction(); clearGlobalTagBindings(tag); };
  byId('tagActionDelete').onclick=function(){ var tag=pendingGlobalTagAction; closeGlobalTagAction(); deleteGlobalTag(tag); };
  byId('tagAction').onclick=function(ev){ if(ev.target===this) closeGlobalTagAction(); };
  byId('forkTreeClose').onclick=closeForkTree;
  byId('forkTreeZoomOut').onclick=function(){ zoomForkTree(1/1.18); };
  byId('forkTreeZoomIn').onclick=function(){ zoomForkTree(1.18); };
  byId('forkTreeReset').onclick=fitForkTree;
  byId('forkTree').onclick=function(ev){ if(ev.target===this) closeForkTree(); };
  byId('forkTreeViewport').addEventListener('wheel',function(ev){
    if(byId('forkTree').hidden) return;
    ev.preventDefault();
    // Trackpad pinch is exposed as ctrl+wheel by browsers. Ordinary two-finger
    // scrolling should move the canvas, matching its click-and-drag behavior.
    if(ev.ctrlKey){
      zoomForkTree(ev.deltaY<0?1.12:1/1.12,ev.clientX,ev.clientY);
      return;
    }
    var wheelScale=ev.deltaMode===1 ? 16 : ev.deltaMode===2 ? Math.max(1,this.clientHeight) : 1;
    forkTreeView.x-=ev.deltaX*wheelScale;
    forkTreeView.y-=ev.deltaY*wheelScale;
    applyForkTreeTransform();
  },{passive:false});
  byId('forkTreeViewport').addEventListener('pointerdown',function(ev){
    if(ev.target&&ev.target.closest&&ev.target.closest('.forktree-node')) return;
    forkTreeView.dragging=true; forkTreeView.sx=ev.clientX; forkTreeView.sy=ev.clientY;
    forkTreeView.ox=forkTreeView.x; forkTreeView.oy=forkTreeView.y;
    this.classList.add('dragging'); this.setPointerCapture(ev.pointerId);
  });
  byId('forkTreeViewport').addEventListener('pointermove',function(ev){
    if(!forkTreeView.dragging) return;
    forkTreeView.x=forkTreeView.ox+(ev.clientX-forkTreeView.sx);
    forkTreeView.y=forkTreeView.oy+(ev.clientY-forkTreeView.sy);
    applyForkTreeTransform();
  });
  function endForkTreeDrag(ev){
    forkTreeView.dragging=false; byId('forkTreeViewport').classList.remove('dragging');
    if(ev&&ev.pointerId!==undefined){ try{ byId('forkTreeViewport').releasePointerCapture(ev.pointerId); }catch(_err){} }
  }
  byId('forkTreeViewport').addEventListener('pointerup',endForkTreeDrag);
  byId('forkTreeViewport').addEventListener('pointercancel',endForkTreeDrag);
  document.querySelectorAll('.workstats-period').forEach(function(btn){
    btn.onclick=function(){ setWorkStatsRange(btn.getAttribute('data-range')); };
  });
  byId('titleEditBtn').onclick=startTitleEdit;
  byId('refreshBtn').onclick=refreshCurrentChat;
  byId('headerPinBtn').onclick=function(){ if(cur) toggleSessionPin(cur); };
  byId('latestPin').onclick=jumpToLatestPin;
  byId('latestPin').onkeydown=function(e){
    if(e.key==='Enter' || e.key===' '){ e.preventDefault(); jumpToLatestPin(); }
  };
  // mobile: back from the chat page to the session list
  byId('backbtn').onclick=function(){ document.body.classList.remove('show-chat'); };
  [['railVendor','vendor'],['railModel','model'],['railEffort','effort'],['railSpeed','speed'],['railShortcuts','shortcuts'],['railNotes','notes'],['railTodos','todo']].forEach(function(entry){
    byId(entry[0]).onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); openComposerRail(entry[1]); };
  });
  byId('railProbe').onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); fillProbe(); };
  byId('forkBtn').onclick=fork;
  byId('goalToggle').onclick=toggleGoal;
  byId('newGoalToggle').onclick=toggleNewGoal;
  byId('rvendor').onchange=function(){ refreshRunConfigControls(true); applyRunConfig(); };
  byId('nbtn').onclick=newSession;
  // Tab completes a shortcut ghost; Enter starts the session; Shift+Enter inserts a newline (IME-safe).
  byId('np').addEventListener('keydown',function(e){
    if(e.key==='Tab'&&!e.shiftKey&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!isImeConfirming(e)&&completeNewShortcut(this)){ e.preventDefault(); return; }
    if(e.key==='Enter'&&!e.shiftKey&&!isImeConfirming(e)){ e.preventDefault(); newSession(); }
    else if(e.key==='Escape'&&newBoxOpen()&&!newSessionPending){ e.preventDefault(); e.stopPropagation(); closeNewBox(); }
  });
  byId('np').addEventListener('compositionstart',function(){ newShortcutComposing=true; syncNewShortcutGhost(); });
  byId('np').addEventListener('compositionend',function(){ newShortcutComposing=false; syncNewShortcutGhost(); });
  byId('np').addEventListener('input',syncNewShortcutGhost);
  byId('np').addEventListener('select',syncNewShortcutGhost);
  byId('np').addEventListener('click',syncNewShortcutGhost);
  byId('np').addEventListener('keyup',syncNewShortcutGhost);
  byId('np').addEventListener('scroll',syncNewShortcutGhost,{passive:true});
  byId('np').addEventListener('focus',syncNewShortcutGhost);
  byId('np').addEventListener('blur',function(){ var ghost=byId('newShortcutGhost'); if(ghost) ghost.hidden=true; });
  byId('newToggle').onclick=function(ev){ ev.stopPropagation(); toggleNewBox(); };
  byId('newClose').onclick=function(ev){ ev.stopPropagation(); closeNewBox(); };
  byId('todoHubToggle').onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); toggleTodoHub(); };
  byId('todoHubClose').onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); closeTodoHub(); };
  byId('todoHubAddButton').onclick=addTodoHubItem;
  byId('todoHubAddInput').addEventListener('input',syncTodoHubAddButton);
  byId('todoHubAddInput').addEventListener('keydown',function(ev){
    if(ev.key==='Enter'&&!isImeConfirming(ev)){ ev.preventDefault(); addTodoHubItem(); }
    else if(ev.key==='Escape'){ ev.preventDefault(); closeTodoHub(); }
  });
  byId('newTagAdd').onclick=function(ev){
    ev.preventDefault(); ev.stopPropagation(); newTagPickerOpen=!newTagPickerOpen; newTagPickerActive=-1; renderNewTagPicker();
    if(newTagPickerOpen) setTimeout(function(){ var input=byId('newTagInput'); if(input) input.focus(); },0);
  };
  byId('newTagInput').addEventListener('input',function(){ newTagPickerActive=-1; renderNewTagPicker(); });
  byId('newTagInput').addEventListener('keydown',function(ev){
    if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); closeNewTagPicker(); return; }
    if(isImeConfirming(ev)) return;
    if(ev.key==='ArrowDown'){ ev.preventDefault(); moveNewTagPickerActive(1); }
    else if(ev.key==='ArrowUp'){ ev.preventDefault(); moveNewTagPickerActive(-1); }
    else if(ev.key==='Enter'){ ev.preventDefault(); commitNewTagPicker(); }
  });
  setIconButton(byId('sessionTagClose'),'close','Close tag picker');
  byId('sessionTagClose').onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); closeSessionTagPopover(); };
  byId('sessionTagInput').addEventListener('input',function(){
    if(!sessionTagPopoverState) return;
    sessionTagPopoverState.active=-1;
    renderSessionTagPopover();
  });
  byId('sessionTagInput').addEventListener('keydown',function(ev){
    ev.stopPropagation();
    if(ev.key==='Escape'){ ev.preventDefault(); closeSessionTagPopover(); return; }
    if(isImeConfirming(ev)||!sessionTagPopoverState) return;
    var options=sessionTagOptionEls(),count=options.length;
    if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){
      ev.preventDefault();
      if(count){
        var delta=ev.key==='ArrowDown'?1:-1;
        sessionTagPopoverState.active=sessionTagPopoverState.active<0
          ? (delta>0?0:count-1)
          : (sessionTagPopoverState.active+delta+count)%count;
        highlightSessionTagOption();
      }
    } else if(ev.key==='Enter'){
      ev.preventDefault();
      var active=sessionTagPopoverState.active>=0&&options[sessionTagPopoverState.active]?options[sessionTagPopoverState.active]:null;
      var value=active&&active.getAttribute('data-val')||normalizeTag(this.value);
      if(value) chooseSessionTag(value);
    }
  });
  byId('tagModeToggle').onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); toggleTagFilterMode(); };
  byId('tagOrderToggle').onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); toggleTagOrderMode(); };
  byId('bulkArchiveSeen').onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); archiveSeenInView(); };
  function sessionSearchRangeDef(){
    for(var i=0;i<SESSION_SEARCH_RANGES.length;i++) if(SESSION_SEARCH_RANGES[i].value===sessionSearchRange) return SESSION_SEARCH_RANGES[i];
    return SESSION_SEARCH_RANGES[0];
  }
  function sessionSearchLocalDateTimeValue(timestamp){
    var date=new Date(timestamp),pad=function(value){ return String(value).padStart(2,'0'); };
    return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+' '+pad(date.getHours())+':'+pad(date.getMinutes());
  }
  function parseSessionSearchLocalDateTime(value){
    var match=String(value||'').trim().match(/^(\\d{4})[-\\/](\\d{1,2})[-\\/](\\d{1,2})[ T](\\d{1,2}):(\\d{1,2})$/);
    if(!match) return NaN;
    var year=Number(match[1]),month=Number(match[2])-1,day=Number(match[3]),hour=Number(match[4]),minute=Number(match[5]);
    var date=new Date(year,month,day,hour,minute,0,0);
    return date.getFullYear()===year&&date.getMonth()===month&&date.getDate()===day&&date.getHours()===hour&&date.getMinutes()===minute?date.getTime():NaN;
  }
  function sameSessionSearchDate(a,b){
    return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  }
  function sessionSearchCustomCompactLabel(){
    var start=new Date(sessionSearchCustomStart),end=new Date(sessionSearchCustomEnd);
    var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var pad=function(value){ return String(value).padStart(2,'0'); };
    if(sameSessionSearchDate(start,end)){
      var endLabel=Math.abs(sessionSearchCustomEnd-Date.now())<90000?'Now':pad(end.getHours())+':'+pad(end.getMinutes());
      return pad(start.getHours())+':'+pad(start.getMinutes())+'–'+endLabel;
    }
    var startLabel=months[start.getMonth()]+' '+start.getDate();
    if(start.getFullYear()!==end.getFullYear()) startLabel+=' '+start.getFullYear();
    var endLabel=(start.getFullYear()===end.getFullYear()&&start.getMonth()===end.getMonth()?'':months[end.getMonth()]+' ')+end.getDate();
    if(start.getFullYear()!==end.getFullYear()) endLabel+=' '+end.getFullYear();
    return startLabel+'–'+endLabel;
  }
  function syncSessionSearchRangeControl(){
    var button=byId('searchRangeButton'),text=byId('searchRangeText'); if(!button||!text) return;
    var def=sessionSearchRangeDef();
    text.textContent=sessionSearchRange==='custom'?sessionSearchCustomCompactLabel():def.compact;
    button.classList.toggle('active',!!filterQ);
    button.setAttribute('aria-expanded',sessionSearchRangeOpen?'true':'false');
    var rangeLabel=def.label;
    if(sessionSearchRange==='custom') rangeLabel=new Date(sessionSearchCustomStart).toLocaleString()+' – '+new Date(sessionSearchCustomEnd).toLocaleString();
    button.setAttribute('aria-label','Search time range: '+rangeLabel+(filterQ?'':' · applies when searching'));
  }
  function renderSessionSearchCustomRange(menu){
    menu.classList.add('custom');
    menu.setAttribute('role','dialog'); menu.setAttribute('aria-label','Custom search time range');
    var head=el('div','search-range-custom-head');
    var back=el('button','search-range-custom-back','‹'); back.type='button'; back.setAttribute('aria-label','Back to time range presets');
    back.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); sessionSearchCustomPickerTarget=''; sessionSearchRangeView='presets'; renderSessionSearchRangeMenu(); var option=menu.querySelector('[data-range="custom"]'); if(option) option.focus(); };
    head.appendChild(back); head.appendChild(el('div','search-range-custom-title','Custom range')); head.appendChild(el('span'));
    menu.appendChild(head);
    var fields=el('div','search-range-custom-fields');
    function appendField(id,label,value){
      var target=id==='searchRangeCustomStart'?'start':'end';
      var field=el('div','search-range-custom-field'),caption=el('span','',label),control=el('div','scheduledatetime search-range-datetime'),input=el('input'),toggle=el('button','scheduledatetime-toggle','▾');
      var clock=document.createElementNS('http://www.w3.org/2000/svg','svg'); clock.setAttribute('viewBox','0 0 24 24'); clock.setAttribute('aria-hidden','true');
      var circle=document.createElementNS('http://www.w3.org/2000/svg','circle'); circle.setAttribute('cx','12'); circle.setAttribute('cy','12'); circle.setAttribute('r','8.5'); clock.appendChild(circle);
      var path=document.createElementNS('http://www.w3.org/2000/svg','path'); path.setAttribute('d','M12 7.5v5l3.3 2'); clock.appendChild(path);
      input.id=id; input.value=sessionSearchLocalDateTimeValue(value); input.autocomplete='off'; input.spellcheck=false; input.placeholder='YYYY-MM-DD HH:mm'; input.setAttribute('aria-label',label+' search date and time');
      input.onblur=function(){ var parsed=parseSessionSearchLocalDateTime(input.value); if(Number.isFinite(parsed)){ if(target==='start') sessionSearchCustomDraftStart=parsed; else sessionSearchCustomDraftEnd=parsed; input.value=sessionSearchLocalDateTimeValue(parsed); } };
      input.onkeydown=function(ev){
        if(ev.key==='ArrowDown'){ ev.preventDefault(); openSessionSearchCustomPicker(target,input); }
        else if(ev.key==='Enter'){ ev.preventDefault(); var apply=menu.querySelector('.search-range-custom-apply'); if(apply) apply.click(); }
      };
      toggle.type='button'; toggle.setAttribute('aria-label','Open '+label.toLowerCase()+' calendar and time options'); toggle.setAttribute('aria-expanded',sessionSearchCustomPickerTarget===target?'true':'false');
      toggle.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); if(sessionSearchCustomPickerTarget===target){ sessionSearchCustomPickerTarget=''; renderSessionSearchRangeMenu(); return; } openSessionSearchCustomPicker(target,input); };
      control.appendChild(clock); control.appendChild(input); control.appendChild(toggle);
      field.appendChild(caption); field.appendChild(control); fields.appendChild(field);
      return input;
    }
    var startInput=appendField('searchRangeCustomStart','From',sessionSearchCustomDraftStart);
    var endInput=appendField('searchRangeCustomEnd','To',sessionSearchCustomDraftEnd);
    if(sessionSearchCustomPickerTarget) fields.appendChild(renderSessionSearchCustomPicker());
    var error=el('div','search-range-custom-error'); error.id='searchRangeCustomError'; error.setAttribute('role','alert'); fields.appendChild(error);
    var actions=el('div','search-range-custom-actions'),apply=el('button','search-range-custom-apply','Apply'); apply.type='button';
    apply.onclick=function(ev){
      ev.preventDefault(); ev.stopPropagation();
      var start=parseSessionSearchLocalDateTime(startInput.value),end=parseSessionSearchLocalDateTime(endInput.value);
      if(!Number.isFinite(start)||!Number.isFinite(end)){ error.textContent='Choose both a start and end time.'; return; }
      if(end<start){ error.textContent='End time must be after the start time.'; return; }
      sessionSearchCustomStart=start; sessionSearchCustomEnd=end; sessionSearchCustomDraftStart=start; sessionSearchCustomDraftEnd=end;
      sessionSearchRange='custom'; closeSessionSearchRange(true); syncSessionSearchRangeControl();
      if(filterQ){ sortSessions(); byId('list').scrollTop=0; renderSidebar(); }
    };
    actions.appendChild(apply); fields.appendChild(actions); menu.appendChild(fields);
  }
  function sessionSearchCustomPickerValue(){ return sessionSearchCustomPickerTarget==='start'?sessionSearchCustomDraftStart:sessionSearchCustomDraftEnd; }
  function setSessionSearchCustomPickerValue(timestamp){
    if(sessionSearchCustomPickerTarget==='start') sessionSearchCustomDraftStart=timestamp;
    else sessionSearchCustomDraftEnd=timestamp;
  }
  function openSessionSearchCustomPicker(target,input){
    var parsed=parseSessionSearchLocalDateTime(input&&input.value);
    if(Number.isFinite(parsed)){ if(target==='start') sessionSearchCustomDraftStart=parsed; else sessionSearchCustomDraftEnd=parsed; }
    sessionSearchCustomPickerTarget=target;
    var date=new Date(target==='start'?sessionSearchCustomDraftStart:sessionSearchCustomDraftEnd);
    sessionSearchCustomPickerMonth=new Date(date.getFullYear(),date.getMonth(),1).getTime();
    renderSessionSearchRangeMenu();
  }
  function renderSessionSearchCustomPicker(){
    var picker=el('div','schedulepicker search-range-custom-picker'),selected=new Date(sessionSearchCustomPickerValue()),monthDate=new Date(sessionSearchCustomPickerMonth);
    var head=el('div','schedulepicker-head'),prev=el('button','schedulepicker-nav','‹'),title=el('div','schedulepicker-month'),next=el('button','schedulepicker-nav','›');
    prev.type='button'; prev.setAttribute('aria-label','Previous month'); next.type='button'; next.setAttribute('aria-label','Next month');
    prev.onclick=function(){ var date=new Date(sessionSearchCustomPickerMonth); date.setMonth(date.getMonth()-1); sessionSearchCustomPickerMonth=date.getTime(); renderSessionSearchRangeMenu(); };
    next.onclick=function(){ var date=new Date(sessionSearchCustomPickerMonth); date.setMonth(date.getMonth()+1); sessionSearchCustomPickerMonth=date.getTime(); renderSessionSearchRangeMenu(); };
    var year=monthDate.getFullYear(),month=monthDate.getMonth(),first=new Date(year,month,1),count=new Date(year,month+1,0).getDate();
    title.textContent=first.toLocaleDateString([],{month:'long',year:'numeric'}); head.appendChild(prev); head.appendChild(title); head.appendChild(next); picker.appendChild(head);
    var week=el('div','schedulepicker-week'); week.setAttribute('aria-hidden','true'); ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(function(day){ week.appendChild(el('span','',day)); }); picker.appendChild(week);
    var days=el('div','schedulepicker-days'),today=new Date(); today.setHours(0,0,0,0);
    for(var blank=0;blank<first.getDay();blank++) days.appendChild(el('span','schedulepicker-empty'));
    for(var dayNumber=1;dayNumber<=count;dayNumber++) (function(day){
      var date=new Date(year,month,day),button=el('button','schedulepicker-day',String(day)); button.type='button';
      button.classList.toggle('today',date.getTime()===today.getTime()); button.classList.toggle('selected',selected.getFullYear()===year&&selected.getMonth()===month&&selected.getDate()===day);
      button.setAttribute('aria-label',date.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'}));
      button.onclick=function(){ var nextDate=new Date(sessionSearchCustomPickerValue()); nextDate.setFullYear(year,month,day); setSessionSearchCustomPickerValue(nextDate.getTime()); renderSessionSearchRangeMenu(); };
      days.appendChild(button);
    })(dayNumber);
    picker.appendChild(days);
    var time=el('div','scheduletime'),timeLabel=el('span','scheduletime-label','Time'),hour=el('input'),separator=el('span','scheduletime-sep',':'),minute=el('input');
    hour.inputMode='numeric'; hour.maxLength=2; hour.value=String(selected.getHours()).padStart(2,'0'); hour.setAttribute('aria-label','Hour');
    minute.inputMode='numeric'; minute.maxLength=2; minute.value=String(selected.getMinutes()).padStart(2,'0'); minute.setAttribute('aria-label','Minute');
    function applyParts(){
      var current=new Date(sessionSearchCustomPickerValue()),h=Math.max(0,Math.min(23,Number(hour.value)||0)),m=Math.max(0,Math.min(59,Number(minute.value)||0));
      current.setHours(h,m,0,0); setSessionSearchCustomPickerValue(current.getTime()); hour.value=String(h).padStart(2,'0'); minute.value=String(m).padStart(2,'0');
    }
    hour.onfocus=function(){ hour.select(); }; minute.onfocus=function(){ minute.select(); }; hour.onblur=applyParts; minute.onblur=applyParts;
    [hour,minute].forEach(function(input){ input.onkeydown=function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); applyParts(); renderSessionSearchRangeMenu(); } }; });
    time.appendChild(timeLabel); time.appendChild(hour); time.appendChild(separator); time.appendChild(minute); picker.appendChild(time);
    var choices=el('div','scheduletime-choices'),hoursWrap=el('div'),minutesWrap=el('div'),hourOptions=el('div','scheduletime-hours'),minuteOptions=el('div','scheduletime-minutes');
    hoursWrap.appendChild(el('span','scheduletime-choice-label','Hour')); minutesWrap.appendChild(el('span','scheduletime-choice-label','Minute'));
    for(var hourValue=0;hourValue<24;hourValue++) (function(value){ var button=el('button','scheduletime-option',String(value).padStart(2,'0')); button.type='button'; button.classList.toggle('selected',selected.getHours()===value); button.onclick=function(){ var date=new Date(sessionSearchCustomPickerValue()); date.setHours(value,date.getMinutes(),0,0); setSessionSearchCustomPickerValue(date.getTime()); renderSessionSearchRangeMenu(); }; hourOptions.appendChild(button); })(hourValue);
    [0,15,30,45].forEach(function(value){ var button=el('button','scheduletime-option',String(value).padStart(2,'0')); button.type='button'; button.classList.toggle('selected',selected.getMinutes()===value); button.onclick=function(){ var date=new Date(sessionSearchCustomPickerValue()); date.setMinutes(value,0,0); setSessionSearchCustomPickerValue(date.getTime()); renderSessionSearchRangeMenu(); }; minuteOptions.appendChild(button); });
    hoursWrap.appendChild(hourOptions); minutesWrap.appendChild(minuteOptions); choices.appendChild(hoursWrap); choices.appendChild(minutesWrap); picker.appendChild(choices);
    return picker;
  }
  function renderSessionSearchRangeMenu(){
    var menu=byId('searchRangeMenu'); if(!menu) return;
    menu.innerHTML=''; menu.classList.remove('custom');
    if(sessionSearchRangeView==='custom'){
      renderSessionSearchCustomRange(menu);
      menu.hidden=!sessionSearchRangeOpen;
      return;
    }
    menu.setAttribute('role','listbox'); menu.setAttribute('aria-label','Search time range');
    SESSION_SEARCH_RANGES.forEach(function(def){
      var selected=def.value===sessionSearchRange;
      var option=el('button','search-range-option'); option.type='button';
      option.setAttribute('role','option'); option.setAttribute('aria-selected',selected?'true':'false');
      option.setAttribute('data-range',def.value);
      option.appendChild(el('span','search-range-option-label',def.label));
      if(selected){ var check=el('span','search-range-option-check','✓'); check.setAttribute('aria-hidden','true'); option.appendChild(check); }
      option.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); if(def.value==='custom') enterSessionSearchCustomRange(); else selectSessionSearchRange(def.value); };
      menu.appendChild(option);
    });
    menu.hidden=!sessionSearchRangeOpen;
  }
  function closeSessionSearchRange(focusButton){
    if(!sessionSearchRangeOpen) return;
    sessionSearchRangeOpen=false; sessionSearchRangeView='presets'; sessionSearchCustomPickerTarget=''; renderSessionSearchRangeMenu(); syncSessionSearchRangeControl();
    if(focusButton){ var button=byId('searchRangeButton'); if(button) button.focus(); }
  }
  function openSessionSearchRange(){
    closeCustomSelect();
    sessionSearchRangeOpen=true; sessionSearchRangeView='presets'; sessionSearchCustomPickerTarget=''; renderSessionSearchRangeMenu(); syncSessionSearchRangeControl();
    var selected=byId('searchRangeMenu')&&byId('searchRangeMenu').querySelector('[aria-selected="true"]');
    if(selected) selected.focus();
  }
  function enterSessionSearchCustomRange(){
    if(sessionSearchRange==='custom'){
      sessionSearchCustomDraftStart=sessionSearchCustomStart; sessionSearchCustomDraftEnd=sessionSearchCustomEnd;
    } else {
      sessionSearchCustomDraftStart=sessionSearchDayStart(0); sessionSearchCustomDraftEnd=Date.now();
    }
    sessionSearchCustomPickerTarget=''; sessionSearchRangeView='custom'; renderSessionSearchRangeMenu(); syncSessionSearchRangeControl();
    setTimeout(function(){ var input=byId('searchRangeCustomStart'); if(input){ input.focus(); input.select(); } },0);
  }
  function selectSessionSearchRange(value){
    if(value==='custom'||!SESSION_SEARCH_RANGES.some(function(def){ return def.value===value; })) return;
    sessionSearchRange=value;
    closeSessionSearchRange(true);
    syncSessionSearchRangeControl();
    if(filterQ){ sortSessions(); byId('list').scrollTop=0; renderSidebar(); }
  }
  function setupSessionSearchRange(){
    var button=byId('searchRangeButton'),menu=byId('searchRangeMenu'); if(!button||!menu) return;
    renderSessionSearchRangeMenu(); syncSessionSearchRangeControl();
    button.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); if(sessionSearchRangeOpen) closeSessionSearchRange(false); else openSessionSearchRange(); };
    button.onkeydown=function(ev){
      if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){ ev.preventDefault(); if(!sessionSearchRangeOpen) openSessionSearchRange(); return; }
      if(ev.key==='Escape'&&sessionSearchRangeOpen){ ev.preventDefault(); ev.stopPropagation(); closeSessionSearchRange(false); }
    };
    menu.onkeydown=function(ev){
      if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); closeSessionSearchRange(true); return; }
      if(sessionSearchRangeView==='custom') return;
      var options=Array.prototype.slice.call(menu.querySelectorAll('.search-range-option'));
      if(ev.key!=='ArrowDown'&&ev.key!=='ArrowUp') return;
      ev.preventDefault();
      var index=options.indexOf(document.activeElement),delta=ev.key==='ArrowDown'?1:-1;
      if(options.length) options[(index+delta+options.length)%options.length].focus();
    };
    document.addEventListener('pointerdown',function(ev){
      if(!sessionSearchRangeOpen||button.contains(ev.target)||menu.contains(ev.target)) return;
      closeSessionSearchRange(false);
    });
  }
  // Live-filter the sidebar as you type; Esc clears the search.
  function syncSearchFilterState(input){
    var on=!!String(input&&input.value||'').trim();
    input.classList.toggle('filtering', on);
    if(input.parentElement) input.parentElement.classList.toggle('filtering', on);
    var clear=byId(input.id==='tagSearch' ? 'tagSearchClear' : 'searchClear');
    if(clear) clear.hidden=!on;
    if(input.id==='search') syncSessionSearchRangeControl();
  }
  function applySessionSearch(input){
    var next=input.value.trim();
    try{ parsedSessionSearch=compileSessionSearch(next); filterQ=next; setSessionSearchError(''); }
    catch(err){ setSessionSearchError(err&&err.message||'invalid search'); syncSearchFilterState(input); return; }
    syncSearchFilterState(input); sortSessions(); byId('list').scrollTop=0; renderSidebar(); scheduleContentSearch();
  }
  var sessionSearchInputTimer=null;
  function scheduleSessionSearch(input){
    syncSearchFilterState(input);
    if(sessionSearchInputTimer) clearTimeout(sessionSearchInputTimer);
    // Small lists stay instant. Larger lists wait for a short typing pause so a
    // multi-character query causes one sort/filter/render instead of one per key.
    if(SESS.length<=SIDEBAR_VIRTUAL_THRESHOLD){ applySessionSearch(input); return; }
    sessionSearchInputTimer=setTimeout(function(){ sessionSearchInputTimer=null; applySessionSearch(input); },120);
  }
  // Search and filters are exploratory: they update the list without navigating.
  function applyTagSearch(input){ tagSearchQ=input.value.trim().toLowerCase(); syncSearchFilterState(input); renderTagFilters(); renderSidebar(); }
  byId('search').addEventListener('input',function(){ scheduleSessionSearch(this); });
  byId('search').addEventListener('keydown',function(e){ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); if(sessionSearchInputTimer) clearTimeout(sessionSearchInputTimer); this.value=''; applySessionSearch(this); } });
  byId('searchClear').onclick=function(){ if(sessionSearchInputTimer) clearTimeout(sessionSearchInputTimer); var input=byId('search'); input.value=''; applySessionSearch(input); input.focus(); };
  byId('tagSearch').addEventListener('input',function(){ applyTagSearch(this); });
  byId('tagSearch').addEventListener('keydown',function(e){ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); this.value=''; applyTagSearch(this); } });
  byId('tagSearchClear').onclick=function(){ var input=byId('tagSearch'); input.value=''; applyTagSearch(input); input.focus(); };
  function clampedFloatingActionTop(blockRect,viewportRect,railHeight){
    var half=railHeight/2, inset=6;
    var min=viewportRect.top+half+inset, max=viewportRect.bottom-half-inset;
    if(max<min) return viewportRect.top+viewportRect.height/2;
    return Math.max(min,Math.min(blockRect.top+blockRect.height/2,max));
  }
  // One viewport-level action rail serves every long message. It stays at the
  // block center while that center is visible, then clamps to the visible top
  // or bottom edge so long blocks remain actionable without following the pointer.
  (function setupFloatingMessageActions(){
    var host=byId('msgs'), rail=byId('msgFloatActions'), pin=byId('msgFloatPin'), reference=byId('msgFloatReference'), comment=byId('msgFloatComment');
    var referenceBox=byId('msgReferenceComposer'),referenceInput=byId('msgReferenceInput'),referencePreview=byId('msgReferencePreview'),referenceMark=byId('msgReferenceMark'),referenceAdd=byId('msgReferenceAdd'),referenceClose=byId('msgReferenceClose');
    if(!host||!rail||!pin||!reference||!comment||!referenceBox||!referenceInput||!referencePreview||!referenceMark||!referenceAdd||!referenceClose) return;
    setIconButton(pin,'pin','Pin this message to the top');
    setIconButton(comment,'comment','Comment on this response');
    setIconButton(referenceClose,'close','Cancel reference');
    var active=null, activeSelection='', activeSelectionStart=null, overRail=false, hideTimer=null;
    var referenceState=null;
    function closeReferenceComposer(restoreFocus){
      if(referenceBox.hidden) return;
      referenceBox.hidden=true; referenceBox.setAttribute('aria-hidden','true');
      referenceInput.value=''; referenceState=null;
      if(restoreFocus) reference.focus();
    }
    function positionReferenceComposer(){
      if(referenceBox.hidden) return;
      var trigger=reference.getBoundingClientRect(),width=referenceBox.offsetWidth||336,height=referenceBox.offsetHeight||150,inset=8;
      var left=Math.max(inset,Math.min(trigger.left,window.innerWidth-width-inset));
      var below=trigger.bottom+7,top=below+height<=window.innerHeight-inset?below:Math.max(inset,trigger.top-height-7);
      referenceBox.style.left=Math.round(left)+'px'; referenceBox.style.top=Math.round(top)+'px';
    }
    function openReferenceComposer(){
      if(!active||!active.classList.contains('assistant')) return;
      var selected=String(activeSelection||'').trim(),text=selected||assistantReferenceText(active);
      if(!text) return;
      referenceState={block:active,selectedText:selected};
      referenceMark.textContent=selected?'@ selected':'@ response';
      referencePreview.textContent=text.replace(/\\s+/g,' ').trim();
      referencePreview.setAttribute('data-hover-tip',text.replace(/\\s+/g,' ').trim());
      referenceInput.value='';
      referenceBox.hidden=false; referenceBox.setAttribute('aria-hidden','false');
      requestAnimationFrame(function(){ positionReferenceComposer(); referenceInput.focus(); });
    }
    function commitReferenceComposer(){
      var note=String(referenceInput.value||'').trim();
      if(!referenceState){ referenceInput.focus(); return; }
      if(addAssistantQuoteToComposer(referenceState.block,referenceState.selectedText,note)) closeReferenceComposer(false);
    }
    function blockFromTarget(target){
      var content=target&&target.closest&&target.closest('.bubble, .toolc');
      var node=content&&(content.classList.contains('bubble')?content.closest('.msg'):content);
      if(!node || !host.contains(node) || node.closest('.commentanchor')) return null;
      if(node.classList.contains('msg')&&!node.classList.contains('assistant')) return null;
      return node;
    }
    function positionRail(){
      if(!active||!document.body.contains(active)){ hide(); return; }
      var anchor=active.classList.contains('msg')?(active.querySelector('.bubble')||active):active;
      var rect=anchor.getBoundingClientRect();
      var viewportRect=chatMessageViewport(host);
      if(rect.bottom<viewportRect.top||rect.top>viewportRect.bottom){ hide(); return; }
      var width=rail.offsetWidth||78, height=rail.offsetHeight||36;
      var left=rect.right+6;
      if(left+width>window.innerWidth-8) left=Math.max(8,window.innerWidth-width-8);
      var top=clampedFloatingActionTop(rect,viewportRect,height);
      rail.style.left=Math.round(left)+'px'; rail.style.top=Math.round(top)+'px';
    }
    function syncRail(){
      if(!active) return;
      var tool=active.classList.contains('toolc');
      pin.hidden=false; comment.hidden=false;
      var selectionInfo=selectionInfoInside(active);
      activeSelection=selectionInfo.text; activeSelectionStart=selectionInfo.start;
      var selectionKey=selectionPinKey(active,activeSelection);
      var pinned=isPinnedKey(selectionKey||active.getAttribute('data-msg-key'),active);
      pin.classList.toggle('on',pinned);
      var hasSelection=!!activeSelection;
      rail.classList.toggle('has-selection',hasSelection);
      reference.hidden=tool;
      pin.title=hasSelection
        ? (pinned?'Unpin selected text':'Pin selected text to the top')
        : ((pinned?'Unpin this ':'Pin this ')+(tool?'tool block':'message')+(pinned?'':' to the top'));
      pin.setAttribute('aria-label',pin.title);
      comment.title=hasSelection?'Comment on selected text':(tool?'Comment on this tool block':'Comment on this response');
      comment.setAttribute('aria-label',comment.title);
      reference.title=hasSelection?'Reference selected text in the prompt':'Reference this response in the prompt';
      reference.setAttribute('aria-label',reference.title);
      positionRail();
    }
    function show(block){
      if(hideTimer){ clearTimeout(hideTimer); hideTimer=null; }
      active=block; rail.classList.add('show'); rail.setAttribute('aria-hidden','false'); syncRail();
    }
    function hideSoon(){
      if(hideTimer) clearTimeout(hideTimer);
      hideTimer=setTimeout(function(){ if(!overRail) hide(); },90);
    }
    function hide(){ active=null; activeSelection=''; activeSelectionStart=null; rail.classList.remove('show','has-selection'); rail.setAttribute('aria-hidden','true'); }
    host.addEventListener('pointermove',function(ev){ var block=blockFromTarget(ev.target); if(block) show(block); else if(!overRail) hideSoon(); });
    host.addEventListener('pointerleave',hideSoon);
    host.addEventListener('scroll',function(){ closeReferenceComposer(false); if(active&&!overRail) positionRail(); },{passive:true});
    rail.addEventListener('pointerenter',function(){ overRail=true; if(hideTimer) clearTimeout(hideTimer); });
    rail.addEventListener('pointerleave',function(){ overRail=false; hideSoon(); });
    document.addEventListener('selectionchange',function(){ if(active) syncRail(); });
    window.addEventListener('resize',function(){ positionRail(); positionReferenceComposer(); });
    pin.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); if(active){ togglePinnedMessage(active,activeSelection,activeSelectionStart); syncRail(); } };
    reference.onpointerdown=function(ev){ ev.preventDefault(); };
    reference.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); openReferenceComposer(); };
    comment.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); if(active) openCommentsForMessage(active); };
    referenceAdd.onclick=function(ev){ ev.preventDefault(); commitReferenceComposer(); };
    referenceClose.onclick=function(ev){ ev.preventDefault(); closeReferenceComposer(true); };
    referenceInput.onkeydown=function(ev){
      if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); closeReferenceComposer(true); return; }
      if(ev.key==='Enter'&&!isImeConfirming(ev)){ ev.preventDefault(); commitReferenceComposer(); }
    };
    document.addEventListener('pointerdown',function(ev){
      if(referenceBox.hidden||referenceBox.contains(ev.target)||reference.contains(ev.target)) return;
      closeReferenceComposer(false);
    });
  })();
  // Comment messages use the same center-or-visible-edge pin rail as the main
  // chat. Keeping it outside each row avoids permanent control-width placeholders.
  (function setupFloatingCommentActions(){
    var host=byId('commentMsgs'), panel=document.querySelector('.commentpanel');
    var rail=byId('commentMsgFloatActions'), pin=byId('commentMsgFloatPin'), reference=byId('commentMsgFloatReference');
    var referenceBox=byId('commentMsgReferenceComposer'),referenceInput=byId('commentMsgReferenceInput'),referencePreview=byId('commentMsgReferencePreview'),referenceMark=byId('commentMsgReferenceMark'),referenceAdd=byId('commentMsgReferenceAdd'),referenceClose=byId('commentMsgReferenceClose');
    if(!host||!panel||!rail||!pin||!reference||!referenceBox||!referenceInput||!referencePreview||!referenceMark||!referenceAdd||!referenceClose) return;
    setIconButton(pin,'pin','Pin this comment message to the top');
    setIconButton(referenceClose,'close','Cancel reference');
    var active=null, activeSelection='', activeSelectionStart=null, overRail=false, hideTimer=null;
    var referenceState=null;
    function closeReferenceComposer(restoreFocus){
      if(referenceBox.hidden) return;
      referenceBox.hidden=true; referenceBox.setAttribute('aria-hidden','true');
      referenceInput.value=''; referenceState=null;
      if(restoreFocus) reference.focus();
    }
    function positionReferenceComposer(){
      if(referenceBox.hidden) return;
      var trigger=reference.getBoundingClientRect(),panelRect=panel.getBoundingClientRect(),width=referenceBox.offsetWidth||304,height=referenceBox.offsetHeight||150,inset=8;
      var minLeft=Math.max(inset,panelRect.left+inset),maxLeft=Math.min(window.innerWidth-width-inset,panelRect.right-width-inset);
      var left=maxLeft<minLeft?minLeft:Math.max(minLeft,Math.min(trigger.left,maxLeft));
      var below=trigger.bottom+7,top=below+height<=window.innerHeight-inset?below:Math.max(inset,trigger.top-height-7);
      referenceBox.style.left=Math.round(left)+'px'; referenceBox.style.top=Math.round(top)+'px';
    }
    function openReferenceComposer(){
      if(!active||!active.classList.contains('assistant')) return;
      var selected=String(activeSelection||'').trim(),text=selected||assistantReferenceText(active);
      if(!text) return;
      referenceState={block:active,selectedText:selected};
      referenceMark.textContent=selected?'@ selected':'@ response';
      referencePreview.textContent=text.replace(/\\s+/g,' ').trim();
      referencePreview.setAttribute('data-hover-tip',text.replace(/\\s+/g,' ').trim());
      referenceInput.value='';
      referenceBox.hidden=false; referenceBox.setAttribute('aria-hidden','false');
      requestAnimationFrame(function(){ positionReferenceComposer(); referenceInput.focus(); });
    }
    function commitReferenceComposer(){
      var note=String(referenceInput.value||'').trim();
      if(!referenceState){ referenceInput.focus(); return; }
      if(addCommentQuoteToComposer(referenceState.block,referenceState.selectedText,note)) closeReferenceComposer(false);
    }
    function blockFromTarget(target){
      var bubble=target&&target.closest&&target.closest('.bubble');
      var node=bubble&&bubble.closest('.msg');
      if(!node||!host.contains(node)||node.closest('.commentanchor')||node.classList.contains('thinking')||node.classList.contains('error')) return null;
      return node.classList.contains('assistant') ? node : null;
    }
    function positionRail(){
      if(!active||!document.body.contains(active)){ hide(); return; }
      var anchor=active.querySelector('.bubble')||active;
      var rect=anchor.getBoundingClientRect(), panelRect=panel.getBoundingClientRect();
      var viewportRect=commentMessageViewport(host);
      if(rect.bottom<viewportRect.top||rect.top>viewportRect.bottom){ hide(); return; }
      var width=rail.offsetWidth||78, height=rail.offsetHeight||36;
      var left=rect.right+6;
      left=Math.max(panelRect.left+8,Math.min(left,panelRect.right-width-8));
      var top=clampedFloatingActionTop(rect,viewportRect,height);
      rail.style.left=Math.round(left)+'px'; rail.style.top=Math.round(top)+'px';
    }
    function syncRail(){
      if(!active) return;
      var selectionInfo=selectionInfoInside(active);
      activeSelection=selectionInfo.text; activeSelectionStart=selectionInfo.start;
      var selectionKey=selectionPinKey(active,activeSelection);
      var pinned=isPinnedKey(selectionKey||active.getAttribute('data-msg-key'),active);
      pin.classList.toggle('on',pinned);
      var hasSelection=!!activeSelection;
      rail.classList.toggle('has-selection',hasSelection);
      pin.title=hasSelection
        ? (pinned?'Unpin selected text':'Pin selected text to the top')
        : (pinned?'Unpin this comment message':'Pin this comment message to the top');
      pin.setAttribute('aria-label',pin.title);
      reference.title=hasSelection?'Reference selected text in the comment':'Reference this response in the comment';
      reference.setAttribute('aria-label',reference.title);
      positionRail();
    }
    function show(block){
      if(hideTimer){ clearTimeout(hideTimer); hideTimer=null; }
      active=block;
      rail.classList.add('show'); rail.setAttribute('aria-hidden','false'); syncRail();
    }
    function hideSoon(){
      if(hideTimer) clearTimeout(hideTimer);
      hideTimer=setTimeout(function(){ if(!overRail) hide(); },90);
    }
    function hide(){ active=null; activeSelection=''; activeSelectionStart=null; rail.classList.remove('show','has-selection'); rail.setAttribute('aria-hidden','true'); }
    host.addEventListener('pointermove',function(ev){ var block=blockFromTarget(ev.target); if(block) show(block); else if(!overRail) hideSoon(); });
    host.addEventListener('pointerleave',hideSoon);
    host.addEventListener('scroll',function(){ closeReferenceComposer(false); if(active&&!overRail) positionRail(); },{passive:true});
    rail.addEventListener('pointerenter',function(){ overRail=true; if(hideTimer) clearTimeout(hideTimer); });
    rail.addEventListener('pointerleave',function(){ overRail=false; hideSoon(); });
    document.addEventListener('selectionchange',function(){ if(active) syncRail(); });
    window.addEventListener('resize',function(){ positionRail(); positionReferenceComposer(); });
    pin.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); if(active){ togglePinnedMessage(active,activeSelection,activeSelectionStart); syncRail(); } };
    reference.onpointerdown=function(ev){ ev.preventDefault(); };
    reference.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); openReferenceComposer(); };
    referenceAdd.onclick=function(ev){ ev.preventDefault(); commitReferenceComposer(); };
    referenceClose.onclick=function(ev){ ev.preventDefault(); closeReferenceComposer(true); };
    referenceInput.onkeydown=function(ev){
      if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); closeReferenceComposer(true); return; }
      if(ev.key==='Enter'&&!isImeConfirming(ev)){ ev.preventDefault(); commitReferenceComposer(); }
    };
    document.addEventListener('pointerdown',function(ev){
      if(referenceBox.hidden||referenceBox.contains(ev.target)||reference.contains(ev.target)) return;
      closeReferenceComposer(false);
    });
  })();
  byId('imgPreview').onclick=function(ev){ if(ev.target===this) closeImagePreview(); };
  byId('imgPreviewViewport').onclick=function(ev){ if(ev.target===this) closeImagePreview(); };
  byId('imgPreviewViewport').addEventListener('wheel', function(ev){
    if(byId('imgPreview').hidden) return;
    ev.preventDefault();
    zoomMediaPreview(ev.deltaY<0 ? 1.12 : 1/1.12);
  }, { passive:false });
  byId('imgPreviewViewport').addEventListener('dragstart', function(ev){ ev.preventDefault(); });
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
  function isTextEditingTarget(target){
    return !!(target&&target.closest&&target.closest('input,textarea,select,[role="textbox"],[role="combobox"],[contenteditable="true"]'));
  }
  document.addEventListener('keydown',function(e){
    if(e.defaultPrevented||isTextEditingTarget(e.target)) return;
    if(e.key==='Escape' && headerTagSessionMenu){ closeHeaderTagSessionMenu(); return; }
    if(e.key==='Escape' && !byId('tagAction').hidden){ closeGlobalTagAction(); return; }
    if(e.key==='Escape' && !byId('forkTree').hidden){ closeForkTree(); return; }
    if(e.key==='Escape' && !byId('workStats').hidden){ closeWorkStats(); return; }
    if(e.key==='Escape' && priorityMenuOpen){ priorityMenuOpen=false; renderTagFilters(); }
    if(!byId('imgPreview').hidden){
      if(e.key==='Escape') closeImagePreview();
      if(e.key==='+' || e.key==='='){ e.preventDefault(); zoomMediaPreview(1.18); }
      if(e.key==='-' || e.key==='_'){ e.preventDefault(); zoomMediaPreview(1/1.18); }
      if(e.key==='0'){ e.preventDefault(); resetMediaPreviewTransform(); }
    }
    if(e.key==='Escape' && todoHubOpen()){ closeTodoHub(); return; }
    if(e.key==='Escape' && newBoxOpen() && !newSessionPending){ closeNewBox(); }
    if(e.key==='Escape' && composerRailKind){ closeComposerRail(); }
    if(e.key==='Escape' && schedulePopoverState){ closeSchedulePopover(); }
  });
  document.addEventListener('pointerdown',function(ev){
    var picker=byId('newTagPick');
    if(newTagPickerOpen && picker && !picker.contains(ev.target)) closeNewTagPicker();
  },true);
  document.addEventListener('pointerdown',function(ev){
    var box=byId('todoHub'),toggle=byId('todoHubToggle');
    if(!todoHubOpen()||(box&&box.contains(ev.target))||(toggle&&toggle.contains(ev.target))) return;
    closeTodoHub();
  },true);
  document.addEventListener('pointerdown',function(ev){
    var picker=byId('composerPinPicker'),input=byId('input');
    if(!pinReferencePicker.open || ev.target===input || (picker&&picker.contains(ev.target))) return;
    closePinReferencePicker();
  });
  document.addEventListener('pointerdown',function(ev){
    var pop=byId('schedulePop'), button=schedulePopoverState&&schedulePopoverState.button;
    if(!schedulePopoverState||!pop||pop.contains(ev.target)||(button&&button.contains(ev.target))) return;
    closeSchedulePopover();
  });
  window.addEventListener('resize',function(){ if(schedulePopoverState) positionSchedulePopover(schedulePopoverState.button); });
  // The shared session-tag picker is portalled to the page root, so it never
  // changes a sidebar row, middle-panel card, or chat-header height.
  document.addEventListener('pointerdown',function(ev){
    var pop=byId('sessionTagPopover'),button=sessionTagPopoverState&&sessionTagPopoverState.button;
    if(!sessionTagPopoverState||!pop||pop.contains(ev.target)||(button&&button.contains(ev.target))) return;
    closeSessionTagPopover();
  });
  window.addEventListener('resize',function(){ if(sessionTagPopoverState) positionSessionTagPopover(); });
  window.addEventListener('scroll',function(){ if(sessionTagPopoverState) positionSessionTagPopover(); },true);
  document.addEventListener('click',function(ev){
    var priorityTag=byId('priorityTag');
    if(!priorityMenuOpen || (priorityTag && priorityTag.contains(ev.target))) return;
    // Observe outside clicks before controls can stop propagation, but wait
    // until this click finishes before replacing anything in its event path.
    setTimeout(function(){
      if(!priorityMenuOpen) return;
      priorityMenuOpen=false;
      renderTagFilters();
    },0);
  }, true);
  document.addEventListener('pointerdown',function(ev){
    if(!headerTagSessionMenu) return;
    var target=ev.target;
    if(target&&target.closest&&(target.closest('.headtag-session-menu')||target.closest('.headtag-nav'))) return;
    closeHeaderTagSessionMenu();
  });
  document.addEventListener('click',function(ev){
    var rail=byId('composerRail');
    var path=typeof ev.composedPath==='function' ? ev.composedPath() : [];
    if(!composerRailKind || (rail && (rail.contains(ev.target) || path.indexOf(rail)>=0))) return;
    closeComposerRail();
  });
  byId('input').addEventListener('compositionstart',function(){
    composerShortcutComposing=true;
    closePinReferencePicker();
    syncComposerShortcutGhost();
  });
  byId('input').addEventListener('compositionend',function(){
    composerShortcutComposing=false;
    syncPinReferencePicker();
    syncComposerShortcutGhost();
  });
  byId('input').addEventListener('select',syncComposerShortcutGhost);
  byId('input').addEventListener('click',syncComposerShortcutGhost);
  byId('input').addEventListener('keyup',syncComposerShortcutGhost);
  byId('input').addEventListener('select',syncPinReferencePicker);
  byId('input').addEventListener('click',syncPinReferencePicker);
  byId('input').addEventListener('keyup',function(e){ if(e.key!=='Escape') syncPinReferencePicker(); });
  byId('input').addEventListener('scroll',syncComposerShortcutGhost,{passive:true});
  document.addEventListener('selectionchange',function(){
    if(document.activeElement===byId('input')){ syncPinReferencePicker(); syncComposerShortcutGhost(); }
    if(document.activeElement===byId('commentInput')) syncCommentShortcutGhost();
    if(document.activeElement===byId('np')) syncNewShortcutGhost();
  });
  byId('input').addEventListener('keydown',function(e){
    if(handlePinReferencePickerKey(e)){
      e.preventDefault(); e.stopPropagation();
      return;
    }
    if(e.key==='Tab'&&!e.shiftKey&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!isImeConfirming(e)&&completeComposerShortcut(this)){
      e.preventDefault();
      return;
    }
    var historyDirection=e.key==='ArrowUp' ? -1 : e.key==='ArrowDown' ? 1 : 0;
    if(historyDirection&&!e.shiftKey&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!isImeConfirming(e)&&navigateComposerHistory(this,historyDirection)){
      e.preventDefault();
      return;
    }
    if(e.key==='Enter'&&!e.shiftKey&&!isImeConfirming(e)){
      e.preventDefault();
      if(composerVendorChanged()) fork();
      else send();
    }
  });
  byId('input').addEventListener('input',function(){
    syncComposerHeight();
    syncPinReferencePicker();
    syncComposerShortcutGhost();
    if(!cur) return;
    var historyNav=composerHistoryNav;
    if(historyNav&&historyNav.sessionKey===draftKey(cur)&&historyNav.index<historyNav.entries.length){
      historyNav.entries[historyNav.index]=this.value;
      syncOpenHeader();
      return;
    }
    if(historyNav&&historyNav.sessionKey===draftKey(cur)) historyNav.draft=this.value;
    var hadDraft=!!draftTextForSession(cur);
    setDraftForSession(cur, this.value);
    var hasDraft=!!String(this.value||'').trim();
    // Draft text is intentionally hidden from the sidebar while this composer
    // owns focus, so subsequent keystrokes do not change any rendered row.
    // Reorder once when a draft begins; render once when it becomes empty.
    if(hasDraft && !hadDraft) touchSession(cur);
    else if(!hasDraft && hadDraft) renderSidebar();
    syncOpenHeader();
  });
  byId('input').addEventListener('focus',function(){
    syncComposerShortcutGhost();
    renderSidebar();
    syncOpenHeader();
  });
  byId('input').addEventListener('blur',function(){
    syncComposerShortcutGhost();
    renderSidebar();
    syncOpenHeader();
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
