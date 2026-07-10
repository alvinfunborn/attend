import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defaultClaudeModelsCachePath } from "./core/vendor/claude-models.js";
import { defaultCodexModelsCachePath } from "./core/vendor/codex-models.js";
import { resolveCodexBin } from "./core/vendor/detect.js";

export interface AttendConfig {
  /**
   * Scope the listing to sessions whose cwd is within one of these dirs (or a
   * subdir). Empty = no scope, list every session. Sourced from the positional
   * dir args (`attend <dir>…`) > `ATTEND_VAULTS` > config-file `vaultRoots`.
   */
  scopeRoots: string[];
  /** ~/.claude/projects */
  claudeProjects: string;
  /** Manual Claude model override list. Empty = detected models / UI fallback. */
  claudeModels: string[];
  /** Claude Code gateway model cache, when its discovery is enabled locally. */
  claudeModelsCache: string;
  /** ~/.codex/sessions */
  codexSessions: string;
  /** ~/.codex/models_cache.json */
  codexModelsCache: string;
  /** resolved `codex` binary (PATH or app bundle), or null when not installed —
   *  gates in-browser Codex chat / the Codex daemon. */
  codexBin: string | null;
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
  /** vault-owned UI state (theme, focus definitions, model prefs, message pins). */
  uiState: string;
  /** persistent server-owned queued chat turns. */
  chatQueue: string;
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
  claudeModels?: string[];
  claudeModelsCache?: string;
  codexSessions?: string;
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
    claudeProjects: path.join(home, ".claude", "projects"),
    claudeModels: [],
    claudeModelsCache: defaultClaudeModelsCachePath(),
    codexSessions: path.join(home, ".codex", "sessions"),
    codexModelsCache: defaultCodexModelsCachePath(),
    codexBin: resolveCodexBin(),
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
    recentDays: 30,
    maxSessions: 200,
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

function defaultTagsPath(scopeRoots: string[], globalTags: string): string {
  return scopeRoots.length === 1
    ? path.join(scopeRoots[0] ?? "", ".attend", "tags.json")
    : globalTags;
}

function defaultVaultPath(scopeRoots: string[], globalFile: string): string {
  return scopeRoots.length === 1
    ? path.join(scopeRoots[0] ?? "", ".attend", path.basename(globalFile))
    : globalFile;
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
  const scopeRoots = scopeRootsInput.map((p) => path.resolve(p));

  const port = Number(cli.port ?? env.ATTEND_PORT ?? file.port ?? defaults.port);

  return {
    scopeRoots,
    claudeProjects: path.resolve(
      env.ATTEND_CLAUDE_PROJECTS ?? file.claudeProjects ?? defaults.claudeProjects,
    ),
    claudeModels: splitCsv(env.ATTEND_CLAUDE_MODELS) ?? file.claudeModels ?? defaults.claudeModels,
    claudeModelsCache: path.resolve(
      env.ATTEND_CLAUDE_MODELS_CACHE ?? file.claudeModelsCache ?? defaults.claudeModelsCache,
    ),
    codexSessions: path.resolve(
      env.ATTEND_CODEX_SESSIONS ?? file.codexSessions ?? defaults.codexSessions,
    ),
    codexModelsCache: path.resolve(
      env.ATTEND_CODEX_MODELS_CACHE ?? file.codexModelsCache ?? defaults.codexModelsCache,
    ),
    codexBin: env.ATTEND_CODEX_BIN ?? defaults.codexBin,
    memorySources: (file.memorySources ?? defaults.memorySources).map((p) => path.resolve(p)),
    port: Number.isFinite(port) ? port : defaults.port,
    host: cli.host ?? env.ATTEND_HOST ?? file.host ?? defaults.host,
    open: cli.noOpen ? false : defaults.open,
    scanDepth: defaults.scanDepth,
    daemonRegistry: path.resolve(env.ATTEND_DAEMON_REGISTRY ?? defaults.daemonRegistry),
    analysisCache: path.resolve(env.ATTEND_ANALYSIS_CACHE ?? defaults.analysisCache),
    overrides: path.resolve(
      env.ATTEND_OVERRIDES ?? defaultVaultPath(scopeRoots, defaults.overrides),
    ),
    tags: path.resolve(env.ATTEND_TAGS ?? defaultTagsPath(scopeRoots, defaults.tags)),
    engagement: path.resolve(
      env.ATTEND_ENGAGEMENT ?? defaultVaultPath(scopeRoots, defaults.engagement),
    ),
    sessionStatus: path.resolve(env.ATTEND_SESSION_STATUS ?? defaults.sessionStatus),
    uiState: path.resolve(defaultVaultPath(scopeRoots, defaults.uiState)),
    chatQueue: path.resolve(defaultVaultPath(scopeRoots, defaults.chatQueue)),
    recentDays: intOr(env.ATTEND_RECENT_DAYS, defaults.recentDays),
    maxSessions: intOr(env.ATTEND_MAX_SESSIONS, defaults.maxSessions),
    e2eePassphrase: cli.e2eePassphrase ?? env.ATTEND_E2EE_PASSPHRASE ?? defaults.e2eePassphrase,
  };
}
