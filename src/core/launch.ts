import { spawn } from "node:child_process";
import path from "node:path";

export type LaunchVendor = "claude" | "codex" | "cursor";
export type LaunchAction = "resume" | "fork" | "new";

export interface LaunchOpts {
  sessionId?: string;
  prompt?: string;
  model?: string;
  effort?: string;
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
    if (vendor === "claude") return `claude --resume ${id}`;
    if (vendor === "codex") return `codex resume ${id}`;
    return `cursor-agent --resume=${id}`;
  }
  if (action === "fork") {
    if (vendor === "claude") return `claude --resume ${id} --fork-session`;
    if (vendor === "codex") return `codex fork ${id}`;
    throw new Error(
      "Cursor supports interactive /fork, but its headless CLI does not expose a fork command",
    );
  }
  // new
  if (vendor === "claude") {
    const modelArg = opts.model?.trim() ? ` --model ${shellQuote(opts.model.trim())}` : "";
    const effortArg = opts.effort?.trim() ? ` --effort ${shellQuote(opts.effort.trim())}` : "";
    const promptArg = opts.prompt?.trim() ? ` ${shellQuote(opts.prompt.trim())}` : "";
    return `claude${modelArg}${effortArg}${promptArg}`;
  }
  if (vendor === "cursor") {
    const modelArg = opts.model?.trim() ? ` --model ${shellQuote(opts.model.trim())}` : "";
    const promptArg = opts.prompt?.trim() ? ` ${shellQuote(opts.prompt.trim())}` : "";
    return `cursor-agent${modelArg}${promptArg}`;
  }
  const modelArg = opts.model?.trim() ? ` -c ${shellQuote(`model="${opts.model.trim()}"`)}` : "";
  const effort = opts.effort?.trim();
  const effortArg = effort ? ` -c ${shellQuote(`model_reasoning_effort="${effort}"`)}` : "";
  const promptArg = opts.prompt?.trim() ? ` ${shellQuote(opts.prompt.trim())}` : "";
  return `codex${modelArg}${effortArg}${promptArg}`;
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

export interface RevealInvocation {
  file: string;
  args: string[];
}

/**
 * Platform argv that reveals `target` in the OS file manager, selecting the file:
 *   macOS  → `open -R <path>`          (Finder, highlighted)
 *   win32  → `explorer /select,<path>` (Explorer, highlighted)
 *   linux  → `xdg-open <dir>`          (opens the containing folder)
 */
export function revealCommand(platform: NodeJS.Platform, target: string): RevealInvocation {
  if (platform === "win32") return { file: "explorer.exe", args: [`/select,${target}`] };
  if (platform === "darwin") return { file: "open", args: ["-R", target] };
  return { file: "xdg-open", args: [path.dirname(target)] };
}

/**
 * Reveal a local path in the OS file manager (Finder / Explorer). Detached so it
 * outlives the daemon. Mirrors `launchSession` — this is attend deliberately
 * spawning a local viewer, for "click a file path in chat → open it" (the same
 * v1.2/v1.3 "spawn is allowed when the user asks" override).
 */
export function revealPath(target: string, platform: NodeJS.Platform = process.platform): void {
  const { file, args } = revealCommand(platform, target);
  const child = spawn(file, args, { detached: true, stdio: "ignore" });
  child.unref();
}
