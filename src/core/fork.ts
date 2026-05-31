import { spawn } from "node:child_process";

export type ForkVendor = "claude" | "codex";

/**
 * The vendor CLI command that forks (branches) an existing session into a new
 * one, leaving the original untouched.
 *   - Claude: `claude --resume <id> --fork-session`
 *   - Codex:  `codex fork <id>`
 * Both are interactive — they drop the user into the forked session — so they
 * must run in a real terminal (see buildTerminalInvocation).
 */
export function buildForkCommand(vendor: ForkVendor, sessionId: string): string {
  return vendor === "claude"
    ? `claude --resume ${sessionId} --fork-session`
    : `codex fork ${sessionId}`;
}

export interface TerminalInvocation {
  file: string;
  args: string[];
}

/** Build the platform-specific argv that opens a terminal running `command` in `cwd`. */
export function buildTerminalInvocation(
  platform: NodeJS.Platform,
  cwd: string,
  command: string,
): TerminalInvocation {
  if (platform === "win32") {
    return {
      file: "cmd.exe",
      args: ["/c", "start", "", "cmd", "/k", `cd /d "${cwd}" && ${command}`],
    };
  }
  if (platform === "darwin") {
    const script = `tell application "Terminal" to do script "cd '${cwd}' && ${command}"`;
    return { file: "osascript", args: ["-e", script] };
  }
  // linux / other: best-effort via x-terminal-emulator
  return {
    file: "x-terminal-emulator",
    args: ["-e", `bash -lc 'cd "${cwd}" && ${command}; exec bash'`],
  };
}

/**
 * Launch a forked session in a new terminal window. Detached so it outlives the
 * daemon. Returns the fork command that was run (for UI feedback). This is the
 * one place attend actively spawns a vendor process — a deliberate override of
 * the "spawn = copy-only" invariant, requested explicitly (see DESIGN.md v1.2).
 */
export function launchFork(
  vendor: ForkVendor,
  sessionId: string,
  cwd: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const command = buildForkCommand(vendor, sessionId);
  const { file, args } = buildTerminalInvocation(platform, cwd, command);
  const child = spawn(file, args, { cwd, detached: true, stdio: "ignore" });
  child.unref();
  return command;
}
