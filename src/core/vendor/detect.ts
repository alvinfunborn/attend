import { spawnSync } from "node:child_process";

export type VendorId = "claude" | "codex";

export interface VendorAvailability {
  vendor: VendorId;
  /** the vendor CLI resolves on PATH (so we can actually launch it) */
  available: boolean;
  /** supports the in-browser chat console (Claude only); else terminal launcher */
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

const VENDORS: { vendor: VendorId; chat: boolean }[] = [
  { vendor: "claude", chat: true },
  { vendor: "codex", chat: false },
];

/**
 * Detect which vendor CLIs are installed locally, so the "+ new" picker only
 * offers backends that can actually run. Vendor-locked execution (DESIGN.md
 * invariant 4): detection lives in core/vendor/ alongside the other seams.
 */
export function detectVendors(probe: CliProbe = onPath): VendorAvailability[] {
  return VENDORS.map(({ vendor, chat }) => ({ vendor, chat, available: probe(vendor) }));
}
