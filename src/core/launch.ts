import { spawn } from "node:child_process";
import path from "node:path";

export type LaunchVendor = "claude" | "codex" | "cursor";
export type LaunchAction = "resume" | "fork" | "new";

export interface LaunchOpts {
  sessionId?: string;
  prompt?: string;
  model?: string;
  effort?: string;
  speed?: string;
}

export interface LaunchCommand {
  file: string;
  args: string[];
}

const SESSION_ID = /^[A-Za-z0-9_-]+$/;
const MODEL_OPTION = /^[A-Za-z0-9._:/=,\[\]-]+$/;

/** Build the vendor CLI as argv. User-controlled values never become shell syntax. */
export function buildCommand(
  action: LaunchAction,
  vendor: LaunchVendor,
  opts: LaunchOpts = {},
): LaunchCommand {
  const id = opts.sessionId?.trim() ?? "";
  if (action !== "new" && !SESSION_ID.test(id)) throw new Error("invalid session id");

  if (action === "resume") {
    if (vendor === "claude") return { file: "claude", args: ["--resume", id] };
    if (vendor === "codex") return { file: "codex", args: ["resume", id] };
    return { file: "cursor-agent", args: [`--resume=${id}`] };
  }
  if (action === "fork") {
    if (vendor === "claude") return { file: "claude", args: ["--resume", id, "--fork-session"] };
    if (vendor === "codex") return { file: "codex", args: ["fork", id] };
    throw new Error(
      "Cursor supports interactive /fork, but its headless CLI does not expose a fork command",
    );
  }

  const model = optionValue("model", opts.model);
  const effort = optionValue("effort", opts.effort);
  const speed = optionValue("speed", opts.speed);
  const prompt = opts.prompt?.trim();
  if (vendor === "claude") {
    return {
      file: "claude",
      args: [
        ...(model ? ["--model", model] : []),
        ...(effort ? ["--effort", effort] : []),
        ...(speed ? ["--settings", JSON.stringify({ fastMode: speed === "fast" })] : []),
        ...(prompt ? [prompt] : []),
      ],
    };
  }
  if (vendor === "cursor") {
    return {
      file: "cursor-agent",
      args: [...(model ? ["--model", model] : []), ...(prompt ? [prompt] : [])],
    };
  }
  return {
    file: "codex",
    args: [
      ...(model ? ["-c", `model=${JSON.stringify(model)}`] : []),
      ...(effort ? ["-c", `model_reasoning_effort=${JSON.stringify(effort)}`] : []),
      ...(speed ? ["-c", `service_tier=${JSON.stringify(speed)}`] : []),
      ...(prompt ? [prompt] : []),
    ],
  };
}

function optionValue(name: string, value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (!MODEL_OPTION.test(normalized)) throw new Error(`invalid ${name}`);
  return normalized;
}

export interface TerminalInvocation {
  file: string;
  args: string[];
}

/** Build the platform terminal invocation without interpolating untrusted shell text. */
export function buildTerminalInvocation(
  platform: NodeJS.Platform,
  cwd: string,
  command: LaunchCommand,
): TerminalInvocation {
  if (platform === "win32") {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      `Set-Location -LiteralPath ${powerShellQuote(cwd)}`,
      `& ${powerShellQuote(command.file)} ${command.args.map(powerShellQuote).join(" ")}`,
    ].join("; ");
    return {
      file: "powershell.exe",
      args: [
        "-NoExit",
        "-NoProfile",
        "-EncodedCommand",
        Buffer.from(script, "utf16le").toString("base64"),
      ],
    };
  }

  const shellCommand = renderPosixCommand(command);
  const script = `cd -- ${posixQuote(cwd)} && ${shellCommand}; exec bash`;
  if (platform === "darwin") {
    return {
      file: "osascript",
      args: ["-e", `tell application "Terminal" to do script ${appleScriptQuote(script)}`],
    };
  }
  return { file: "x-terminal-emulator", args: ["-e", "bash", "-lc", script] };
}

export function displayCommand(command: LaunchCommand): string {
  return renderPosixCommand(command);
}

function renderPosixCommand(command: LaunchCommand): string {
  return [command.file, ...command.args].map(posixQuote).join(" ");
}

function posixQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function powerShellQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function appleScriptQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

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
  return displayCommand(command);
}

export interface RevealInvocation {
  file: string;
  args: string[];
}

export function revealCommand(platform: NodeJS.Platform, target: string): RevealInvocation {
  if (platform === "win32") return { file: "explorer.exe", args: [`/select,${target}`] };
  if (platform === "darwin") return { file: "open", args: ["-R", target] };
  return { file: "xdg-open", args: [path.dirname(target)] };
}

export function revealPath(target: string, platform: NodeJS.Platform = process.platform): void {
  const { file, args } = revealCommand(platform, target);
  const child = spawn(file, args, { detached: true, stdio: "ignore" });
  child.unref();
}
