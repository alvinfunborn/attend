import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { normalizeScopeRoots, scopeIdForRoots } from "./core/scope.js";
import { defaultCodexModelsCachePath } from "./core/vendor/codex-models.js";
import { defaultCursorStateDbPath } from "./core/vendor/cursor-models.js";
import { resolveClaudeBin, resolveCodexBin, resolveCursorBin } from "./core/vendor/detect.js";

export interface AttendConfig {
  /**
   * Scope the listing to sessions whose cwd is within one of these dirs (or a
   * subdir). Empty = no scope, list every session. Sourced from the positional
   * dir args (`attend <dir>…`) > `ATTEND_VAULTS` > config-file `vaultRoots`.
   */
  scopeRoots: string[];
  /** Stable identity of the canonical, minimal scope-root set. */
  scopeId: string;
  /** ~/.claude/projects */
  claudeProjects: string;
  /** ~/.codex/sessions */
  codexSessions: string;
  /** ~/.cursor/projects (native Cursor IDE/CLI transcripts). */
  cursorProjects: string;
  /** Attend-captured Cursor CLI stream-json transcripts (compatibility fallback). */
  cursorSessions: string;
  /** Cursor Desktop's local model-picker state database. */
  cursorStateDb: string;
  /** ~/.codex/models_cache.json */
  codexModelsCache: string;
  /** exact system Claude Code executable used by the Agent SDK, or null when unavailable. */
  claudeBin: string | null;
  /** resolved `codex` binary (PATH or app bundle), or null when not installed —
   *  gates in-browser Codex chat / the Codex daemon. */
  codexBin: string | null;
  /** resolved `cursor-agent` binary, or null when it is not installed. */
  cursorBin: string | null;
  /** Explicit memory files; when empty, per-project memory is auto-discovered. */
  memorySources: string[];
  port: number;
  host: string;
  /** Open the browser on start. */
  open: boolean;
  scanDepth: number;
  /** task→daemon pairing file (which sessions are hidden analyzer daemons). */
  daemonRegistry: string;
  /** per-task daemon analysis cache (brief/priority/eta/reason). */
  analysisCache: string;
  /** per-session manual overrides (priority / etaMin set by clicking the tab). */
  overrides: string;
  /** vault-scoped tags + per-session tag assignments. */
  tags: string;
  /** per-session engagement telemetry (view/scroll/review behavior). */
  engagement: string;
  /** per-session unfinished/attention state, cleared only when dismissed to gray. */
  sessionStatus: string;
  /** vault-owned UI state (theme, focus, model prefs, per-session run config, pins). */
  uiState: string;
  /** persistent server-owned queued chat turns. */
  chatQueue: string;
  /** shared Attend SQLite database (work events plus transactional state documents). */
  workEvents: string;
  /** only list sessions with activity within this many days (0 = no limit). */
  recentDays: number;
  /** cap the listed sessions to the N most-recent (0 = no limit). */
  maxSessions: number;
  /** Optional application-layer encryption passphrase for remote HTTP tunnels. */
  e2eePassphrase: string | null;
}

/** CLI-derived inputs (already parsed by cli.ts). */
export interface CliInputs {
  positionals: string[];
  port?: string;
  host?: string;
  config?: string;
  noOpen?: boolean;
  e2eePassphrase?: string;
}

interface ConfigFile {
  vaultRoots?: string[];
  claudeProjects?: string;
  codexSessions?: string;
  cursorProjects?: string;
  cursorSessions?: string;
  cursorStateDb?: string;
  codexModelsCache?: string;
  memorySources?: string[];
  port?: number;
  host?: string;
}

function platformDefaults(): AttendConfig {
  const home = os.homedir();
  const attendHome = path.join(home, ".attend");
  return {
    scopeRoots: [],
    scopeId: scopeIdForRoots([]),
    claudeProjects: path.join(home, ".claude", "projects"),
    codexSessions: path.join(home, ".codex", "sessions"),
    cursorProjects: path.join(home, ".cursor", "projects"),
    cursorSessions: path.join(attendHome, "cursor-sessions"),
    cursorStateDb: defaultCursorStateDbPath(),
    codexModelsCache: defaultCodexModelsCachePath(),
    // Match the user's terminal: the Agent SDK is only an adapter around this
    // concrete system CLI. ATTEND_CLAUDE_BIN may explicitly override the path;
    // the SDK-bundled Claude Code is never a default or fallback.
    claudeBin: resolveClaudeBin(),
    codexBin: resolveCodexBin(),
    cursorBin: resolveCursorBin(),
    memorySources: [],
    port: 5050,
    host: "127.0.0.1",
    open: true,
    scanDepth: 8,
    daemonRegistry: path.join(attendHome, "daemons.json"),
    analysisCache: path.join(attendHome, "analysis.json"),
    overrides: path.join(attendHome, "overrides.json"),
    tags: path.join(attendHome, "tags.json"),
    engagement: path.join(attendHome, "engagement.json"),
    sessionStatus: path.join(attendHome, "session-status.json"),
    uiState: path.join(attendHome, "ui-state.json"),
    chatQueue: path.join(attendHome, "chat-queues.json"),
    workEvents: path.join(attendHome, "attend.sqlite3"),
    recentDays: 30,
    // The sidebar virtualizes large result sets, so keep enough history available
    // for useful browsing/search without attaching every row to the DOM.
    maxSessions: 1000,
    e2eePassphrase: null,
  };
}

/** Parse a non-negative integer env override, falling back to `dflt`. */
function intOr(value: string | undefined, dflt: number): number {
  if (value === undefined) return dflt;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : dflt;
}

function readConfigFile(explicitPath: string | undefined): ConfigFile {
  const candidate = explicitPath ?? path.join(process.cwd(), "attend.config.json");
  try {
    if (!fs.existsSync(candidate)) return {};
    return JSON.parse(fs.readFileSync(candidate, "utf-8")) as ConfigFile;
  } catch {
    return {};
  }
}

function splitPaths(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(path.delimiter)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitCsv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Resolve config with precedence: CLI args > env > config file > platform defaults.
 * Scope dirs / session dirs / port can all be specified, satisfying "可指定目录".
 */
export function resolveConfig(cli: CliInputs): AttendConfig {
  const defaults = platformDefaults();
  const file = readConfigFile(cli.config);
  const env = process.env;

  // The positional dir args (or ATTEND_VAULTS / config `vaultRoots`) scope the
  // listing to sessions under those dirs. Empty when none given → list everything.
  const scopeRootsInput =
    cli.positionals.length > 0
      ? cli.positionals
      : (splitPaths(env.ATTEND_VAULTS) ?? file.vaultRoots ?? defaults.scopeRoots);
  const scopeRoots = normalizeScopeRoots(scopeRootsInput);

  const port = Number(cli.port ?? env.ATTEND_PORT ?? file.port ?? defaults.port);

  return {
    scopeRoots,
    scopeId: scopeIdForRoots(scopeRoots),
    claudeProjects: path.resolve(
      env.ATTEND_CLAUDE_PROJECTS ?? file.claudeProjects ?? defaults.claudeProjects,
    ),
    codexSessions: path.resolve(
      env.ATTEND_CODEX_SESSIONS ?? file.codexSessions ?? defaults.codexSessions,
    ),
    cursorProjects: path.resolve(
      env.ATTEND_CURSOR_PROJECTS ?? file.cursorProjects ?? defaults.cursorProjects,
    ),
    cursorSessions: path.resolve(
      env.ATTEND_CURSOR_SESSIONS ?? file.cursorSessions ?? defaults.cursorSessions,
    ),
    cursorStateDb: path.resolve(
      env.ATTEND_CURSOR_STATE_DB ?? file.cursorStateDb ?? defaults.cursorStateDb,
    ),
    codexModelsCache: path.resolve(
      env.ATTEND_CODEX_MODELS_CACHE ?? file.codexModelsCache ?? defaults.codexModelsCache,
    ),
    claudeBin: env.ATTEND_CLAUDE_BIN ?? defaults.claudeBin,
    codexBin: env.ATTEND_CODEX_BIN ?? defaults.codexBin,
    cursorBin: env.ATTEND_CURSOR_BIN ?? defaults.cursorBin,
    memorySources: (file.memorySources ?? defaults.memorySources).map((p) => path.resolve(p)),
    port: Number.isFinite(port) ? port : defaults.port,
    host: cli.host ?? env.ATTEND_HOST ?? file.host ?? defaults.host,
    open: cli.noOpen ? false : defaults.open,
    scanDepth: defaults.scanDepth,
    daemonRegistry: path.resolve(env.ATTEND_DAEMON_REGISTRY ?? defaults.daemonRegistry),
    analysisCache: path.resolve(env.ATTEND_ANALYSIS_CACHE ?? defaults.analysisCache),
    overrides: path.resolve(env.ATTEND_OVERRIDES ?? defaults.overrides),
    tags: path.resolve(env.ATTEND_TAGS ?? defaults.tags),
    engagement: path.resolve(env.ATTEND_ENGAGEMENT ?? defaults.engagement),
    sessionStatus: path.resolve(env.ATTEND_SESSION_STATUS ?? defaults.sessionStatus),
    uiState: path.resolve(defaults.uiState),
    chatQueue: path.resolve(defaults.chatQueue),
    workEvents: path.resolve(defaults.workEvents),
    recentDays: intOr(env.ATTEND_RECENT_DAYS, defaults.recentDays),
    maxSessions: intOr(env.ATTEND_MAX_SESSIONS, defaults.maxSessions),
    e2eePassphrase: cli.e2eePassphrase ?? env.ATTEND_E2EE_PASSPHRASE ?? defaults.e2eePassphrase,
  };
}

/** Whether binding this hostname keeps the service on the local machine. */
export function isLoopbackHost(host: string): boolean {
  const normalized = host
    .trim()
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  const ipVersion = net.isIP(normalized);
  if (ipVersion === 4) return normalized.startsWith("127.");
  if (ipVersion === 6) return normalized === "::1" || normalized === "0:0:0:0:0:0:0:1";
  return false;
}
