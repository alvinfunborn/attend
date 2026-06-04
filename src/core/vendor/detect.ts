import { spawnSync } from "node:child_process";
import fs from "node:fs";

export type VendorId = "claude" | "codex";

/** macOS desktop app bundles the `codex` CLI but doesn't symlink it onto PATH. */
const CODEX_APP_BIN = "/Applications/Codex.app/Contents/Resources/codex";

export interface VendorAvailability {
  vendor: VendorId;
  /** the vendor CLI resolves on PATH (so we can actually launch it) */
  available: boolean;
  /** supports the in-browser chat console; else terminal launcher only */
  chat: boolean;
}

/** Probe whether a command resolves on PATH. Injectable so tests never spawn. */
export type CliProbe = (command: string) => boolean;

/** Default probe: `where` on Windows, `which` elsewhere. Resolves shims (claude.cmd). */
export function onPath(command: string): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  try {
    return spawnSync(probe, [command], { stdio: "ignore", windowsHide: true }).status === 0;
  } catch {
    return false;
  }
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
  if (exists(CODEX_APP_BIN)) return CODEX_APP_BIN;
  return null;
}

type ExistsFn = (p: string) => boolean;
const VENDORS: {
  vendor: VendorId;
  chat: boolean;
  resolve: (p: CliProbe, e: ExistsFn) => boolean;
}[] = [
  { vendor: "claude", chat: true, resolve: (p) => p("claude") },
  // Codex is driven in-browser via `codex exec --json` (no SDK needed); resolves
  // from PATH or the desktop-app bundle.
  { vendor: "codex", chat: true, resolve: (p, e) => resolveCodexBin(p, e) !== null },
];

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
