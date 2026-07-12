import { spawnSync } from "node:child_process";
import fs from "node:fs";

export type VendorId = "claude" | "codex" | "cursor";

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
  /** the vendor CLI resolves on PATH (so we can actually launch it) */
  available: boolean;
  /** supports the in-browser chat console; else terminal launcher only */
  chat: boolean;
}

/** Probe whether a command resolves on PATH. Injectable so tests never spawn. */
export type CliProbe = (command: string) => boolean;

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
  resolve: (p: CliProbe, e: ExistsFn) => boolean;
}[] = [
  { vendor: "claude", chat: true, resolve: (p) => p("claude") },
  // Codex is driven in-browser via `codex exec --json` (no SDK needed); resolves
  // from PATH or the desktop-app bundle.
  { vendor: "codex", chat: true, resolve: (p, e) => resolveCodexBin(p, e) !== null },
  // Cursor's headless CLI exposes the same process-per-turn primitives Attend
  // needs: stream-json output and --resume=<session id>.
  { vendor: "cursor", chat: true, resolve: (p) => p("cursor-agent") || p("agent") },
];

export function isVendorId(value: unknown): value is VendorId {
  return typeof value === "string" && VENDORS.some(({ vendor }) => vendor === value);
}

/**
 * Detect which vendor CLIs are installed locally, so the "+ new" picker only
 * offers backends that can actually run. Vendor-locked execution (DESIGN.md
 * invariant 4): detection lives in core/vendor/ alongside the other seams. Both
 * the PATH probe and the app-bundle existence check are injectable so tests stay
 * deterministic off any real machine.
 */
export function detectVendors(
  probe: CliProbe = onPath,
  exists: ExistsFn = fs.existsSync,
): VendorAvailability[] {
  return VENDORS.map(({ vendor, chat, resolve }) => ({
    vendor,
    chat,
    available: resolve(probe, exists),
  }));
}
