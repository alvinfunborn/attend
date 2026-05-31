import { spawn } from "node:child_process";

export type LaunchVendor = "claude" | "codex";
export type LaunchAction = "resume" | "fork" | "new";

export interface LaunchOpts {
  sessionId?: string;
  prompt?: string;
}

function shellQuote(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}

/**
 * The vendor CLI command for a launch action, run in a terminal:
 *   resume — continue an existing session   (claude --resume <id> / codex resume <id>)
 *   fork   — branch it into a new session    (claude --resume <id> --fork-session / codex fork <id>)
 *   new    — start a fresh session, optional initial prompt (claude [<prompt>] / codex [<prompt>])
 * All are interactive, so they must run in a real terminal (buildTerminalInvocation).
 */
export function buildCommand(
  action: LaunchAction,
  vendor: LaunchVendor,
  opts: LaunchOpts = {},
): string {
  const id = opts.sessionId ?? "";
  if (action === "resume") {
    return vendor === "claude" ? `claude --resume ${id}` : `codex resume ${id}`;
  }
  if (action === "fork") {
    return vendor === "claude" ? `claude --resume ${id} --fork-session` : `codex fork ${id}`;
  }
  // new
  const promptArg = opts.prompt?.trim() ? ` ${shellQuote(opts.prompt.trim())}` : "";
  return `${vendor}${promptArg}`;
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
 * Launch a vendor session action in a new terminal. Detached so it outlives the
 * daemon. Returns the command run (for UI feedback). This is where attend
 * actively spawns vendor processes — a deliberate override of the original
 * "spawn = copy-only" invariant, requested explicitly (see DESIGN.md v1.2/v1.3).
 */
export function launchSession(
  action: LaunchAction,
  vendor: LaunchVendor,
  cwd: string,
  opts: LaunchOpts = {},
  platform: NodeJS.Platform = process.platform,
): string {
  const command = buildCommand(action, vendor, opts);
  const { file, args } = buildTerminalInvocation(platform, cwd, command);
  const child = spawn(file, args, { cwd, detached: true, stdio: "ignore" });
  child.unref();
  return command;
}
