import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface AttendConfig {
  /** Directories scanned recursively for brief.md. */
  vaultRoots: string[];
  /** ~/.claude/projects */
  claudeProjects: string;
  /** ~/.codex/sessions */
  codexSessions: string;
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
}

/** CLI-derived inputs (already parsed by cli.ts). */
export interface CliInputs {
  positionals: string[];
  port?: string;
  host?: string;
  config?: string;
  noOpen?: boolean;
}

interface ConfigFile {
  vaultRoots?: string[];
  claudeProjects?: string;
  codexSessions?: string;
  memorySources?: string[];
  port?: number;
  host?: string;
}

function platformDefaults(): AttendConfig {
  const home = os.homedir();
  const attendHome = path.join(home, ".attend");
  return {
    vaultRoots: [process.cwd()],
    claudeProjects: path.join(home, ".claude", "projects"),
    codexSessions: path.join(home, ".codex", "sessions"),
    memorySources: [],
    port: 5050,
    host: "127.0.0.1",
    open: true,
    scanDepth: 8,
    daemonRegistry: path.join(attendHome, "daemons.json"),
    analysisCache: path.join(attendHome, "analysis.json"),
    overrides: path.join(attendHome, "overrides.json"),
  };
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

/**
 * Resolve config with precedence: CLI args > env > config file > platform defaults.
 * Vault roots / session dirs / port can all be specified, satisfying "可指定目录".
 */
export function resolveConfig(cli: CliInputs): AttendConfig {
  const defaults = platformDefaults();
  const file = readConfigFile(cli.config);
  const env = process.env;

  const vaultRoots =
    cli.positionals.length > 0
      ? cli.positionals
      : (splitPaths(env.ATTEND_VAULTS) ?? file.vaultRoots ?? defaults.vaultRoots);

  const port = Number(cli.port ?? env.ATTEND_PORT ?? file.port ?? defaults.port);

  return {
    vaultRoots: vaultRoots.map((p) => path.resolve(p)),
    claudeProjects: path.resolve(
      env.ATTEND_CLAUDE_PROJECTS ?? file.claudeProjects ?? defaults.claudeProjects,
    ),
    codexSessions: path.resolve(
      env.ATTEND_CODEX_SESSIONS ?? file.codexSessions ?? defaults.codexSessions,
    ),
    memorySources: (file.memorySources ?? defaults.memorySources).map((p) => path.resolve(p)),
    port: Number.isFinite(port) ? port : defaults.port,
    host: cli.host ?? env.ATTEND_HOST ?? file.host ?? defaults.host,
    open: cli.noOpen ? false : defaults.open,
    scanDepth: defaults.scanDepth,
    daemonRegistry: path.resolve(env.ATTEND_DAEMON_REGISTRY ?? defaults.daemonRegistry),
    analysisCache: path.resolve(env.ATTEND_ANALYSIS_CACHE ?? defaults.analysisCache),
    overrides: path.resolve(env.ATTEND_OVERRIDES ?? defaults.overrides),
  };
}
