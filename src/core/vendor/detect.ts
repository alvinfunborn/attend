import { spawnSync } from "node:child_process";
import fs from "node:fs";

export type VendorId = "claude" | "codex" | "cursor";

/**
 * Attend's supported system-CLI floor is the Claude Code 2.1 line. Patch
 * releases intentionally stay interchangeable: upgrading the SDK must not force
 * users to keep their terminal CLI in exact daily lockstep with it.
 */
export const MIN_CLAUDE_CLI_VERSION = "2.1.0";

/**
 * macOS desktop apps bundle the `codex` CLI but don't symlink it onto PATH.
 * The binary ships inside ChatGPT.app (current) and shipped inside Codex.app
 * (older builds); probe both, newest layout first.
 */
const CODEX_APP_BINS = [
  "/Applications/ChatGPT.app/Contents/Resources/codex",
  "/Applications/Codex.app/Contents/Resources/codex",
];

export interface VendorAvailability {
  vendor: VendorId;
  /** the configured local CLI was detected and meets any Attend version floor */
  available: boolean;
  /** supports the in-browser chat console; else terminal launcher only */
  chat: boolean;
  /** normalized version reported by the local CLI */
  version?: string;
  /** minimum version required by Attend when that vendor has one */
  minimumVersion?: string;
  /** stable reason for an unavailable integration */
  issue?: "not_installed" | "not_runnable" | "version_too_old";
  /** concise, English recovery guidance shown by the CLI and web UI */
  message?: string;
}

export type VendorExecutables = Record<VendorId, string | null>;

/** Probe whether a command resolves on PATH. Injectable so tests never spawn. */
export type CliProbe = (command: string) => boolean;
export type CliVersionProbe = (executable: string) => string | null;

/** Resolve a PATH command to the concrete executable used by the current shell. */
export function resolveOnPath(command: string): string | null {
  const probe = process.platform === "win32" ? "where" : "which";
  try {
    const result = spawnSync(probe, [command], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0) return null;
    return (
      String(result.stdout || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean) ?? null
    );
  } catch {
    return null;
  }
}

export function resolveClaudeBin(resolve: (command: string) => string | null = resolveOnPath) {
  return resolve("claude");
}

export function resolveCursorBin(resolve: (command: string) => string | null = resolveOnPath) {
  return resolve("cursor-agent") ?? resolve("agent");
}

/** Default probe: `where` on Windows, `which` elsewhere. Resolves shims (claude.cmd). */
export function onPath(command: string): boolean {
  return resolveOnPath(command) !== null;
}

/** Extract a semver-like CLI version from native vendor `--version` output. */
export function parseCliVersion(output: string): string | null {
  return output.match(/(?:^|[^0-9])v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/)?.[1] ?? null;
}

/** Run the exact configured executable; never consult an SDK-bundled runtime. */
export function readCliVersion(executable: string): string | null {
  try {
    const options = {
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true,
    } as const;
    // npm-installed CLIs commonly resolve to `.cmd` shims on Windows, which
    // Node cannot execute directly without cmd.exe.
    const result =
      process.platform === "win32" && /\.(?:cmd|bat)$/i.test(executable)
        ? spawnSync(
            process.env.ComSpec ?? "cmd.exe",
            ["/d", "/s", "/c", `"${executable}" --version`],
            options,
          )
        : spawnSync(executable, ["--version"], options);
    if (result.status !== 0 || result.error) return null;
    return parseCliVersion(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  } catch {
    return null;
  }
}

function compareCliVersions(left: string, right: string): number {
  const parse = (version: string) => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(version);
    return match
      ? {
          parts: [Number(match[1]), Number(match[2]), Number(match[3])] as const,
          prerelease: match[4] ?? null,
        }
      : null;
  };
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) return 0;
  for (let index = 0; index < a.parts.length; index++) {
    const difference = (a.parts[index] ?? 0) - (b.parts[index] ?? 0);
    if (difference) return difference;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

/**
 * Resolve the `codex` binary: PATH first, else the macOS desktop-app bundle
 * (installed but not symlinked). Returns null when Codex isn't found. The
 * `existsSync` check is injectable so tests stay off the filesystem.
 */
export function resolveCodexBin(
  probe: CliProbe = onPath,
  exists: (p: string) => boolean = fs.existsSync,
): string | null {
  if (probe("codex")) return "codex";
  return CODEX_APP_BINS.find((bin) => exists(bin)) ?? null;
}

type ExistsFn = (p: string) => boolean;
/**
 * Registry of vendor integrations implemented by Attend. The UI never keeps a
 * separate vendor list: it receives the locally-detected entries from here.
 * Adding another CLI integration means registering its probe/capabilities here
 * alongside its source/driver/launcher implementation.
 */
const VENDORS: readonly {
  vendor: VendorId;
  chat: boolean;
}[] = [
  { vendor: "claude", chat: true },
  // Codex is driven in-browser via `codex exec --json` (no SDK needed); resolves
  // from PATH or the desktop-app bundle.
  { vendor: "codex", chat: true },
  // Cursor's headless CLI exposes the same process-per-turn primitives Attend
  // needs: stream-json output and --resume=<session id>.
  { vendor: "cursor", chat: true },
];

const VENDOR_LABELS: Record<VendorId, string> = {
  claude: "Claude Code",
  codex: "Codex CLI",
  cursor: "Cursor CLI",
};

const VENDOR_INSTALL_MESSAGES: Record<VendorId, string> = {
  claude: "Claude CLI was not found. Install Claude Code, then restart Attend.",
  codex:
    "Codex CLI was not found. Install Codex CLI or the ChatGPT desktop app, then restart Attend.",
  cursor: "Cursor CLI was not found. Install Cursor CLI, then restart Attend.",
};

/**
 * Inspect the exact executables selected by configuration. This is the single
 * runtime availability contract shared by the picker, HTTP routes, analyzers,
 * and startup output; the Agent SDK is deliberately absent from this decision.
 */
export function inspectVendorExecutables(
  executables: VendorExecutables,
  versionProbe: CliVersionProbe = readCliVersion,
): VendorAvailability[] {
  return VENDORS.map(({ vendor, chat }) => {
    const executable = executables[vendor];
    const minimumVersion = vendor === "claude" ? MIN_CLAUDE_CLI_VERSION : undefined;
    if (!executable) {
      return {
        vendor,
        chat,
        available: false,
        ...(minimumVersion ? { minimumVersion } : {}),
        issue: "not_installed" as const,
        message: VENDOR_INSTALL_MESSAGES[vendor],
      };
    }

    const version = versionProbe(executable);
    if (!version && minimumVersion) {
      return {
        vendor,
        chat,
        available: false,
        ...(minimumVersion ? { minimumVersion } : {}),
        issue: "not_runnable" as const,
        message: `Attend could not run ${VENDOR_LABELS[vendor]}. Check its configured path or reinstall it, then restart Attend.`,
      };
    }

    if (
      version &&
      vendor === "claude" &&
      minimumVersion &&
      compareCliVersions(version, minimumVersion) < 0
    ) {
      return {
        vendor,
        chat,
        available: false,
        version,
        minimumVersion,
        issue: "version_too_old" as const,
        message: `Claude CLI ${version} is too old. Attend requires ${minimumVersion} or newer. Update Claude Code, then restart Attend.`,
      };
    }

    return {
      vendor,
      chat,
      available: true,
      ...(version ? { version } : {}),
      ...(minimumVersion ? { minimumVersion } : {}),
    };
  });
}

export function isVendorId(value: unknown): value is VendorId {
  return typeof value === "string" && VENDORS.some(({ vendor }) => vendor === value);
}

/**
 * Detect which vendor CLIs are installed locally. The "+ new" picker receives
 * every entry, hides unavailable ones when any vendor works, and uses the
 * generated messages as recovery guidance when none work.
 * Vendor-locked execution (DESIGN.md invariant 4): detection lives in
 * core/vendor/ alongside the other seams. Probes are injectable so tests stay
 * deterministic off any real machine.
 */
export function detectVendors(
  probe: CliProbe = onPath,
  exists: ExistsFn = fs.existsSync,
  versionProbe: CliVersionProbe = readCliVersion,
): VendorAvailability[] {
  const cursorBin = probe("cursor-agent") ? "cursor-agent" : probe("agent") ? "agent" : null;
  return inspectVendorExecutables(
    {
      claude: probe("claude") ? "claude" : null,
      codex: resolveCodexBin(probe, exists),
      cursor: cursorBin,
    },
    versionProbe,
  );
}
