import type { Brief } from "./types.js";

export type Vendor = "claude" | "codex";

function quote(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Build a copy-paste spawn command. v0 never auto-spawns — the dashboard only
 * renders the command for the user to paste (DESIGN.md: avoid the 4-tab cascade).
 */
export function spawnCommand(brief: Brief, vendor: Vendor): string {
  const summary = brief.what.trim();
  const next = brief.next.trim();
  const parts: string[] = [];
  if (summary) parts.push(summary);
  if (next) parts.push(`\\n\\nNext: ${next}`);
  const body = quote(parts.join(""));
  return `cd "${brief.projectDir}"\n${vendor} "${body}"`;
}
