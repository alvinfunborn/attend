import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type {
  ProcessForkFn,
  ProcessSandbox,
  ProcessTurnFn,
  ProcessTurnHandle,
  ProcessTurnRequest,
} from "../process/types.js";
import type { CodexEvent } from "./events.js";
import { prepareCodexInput } from "./input.js";

export type CodexSandbox = ProcessSandbox;
export type CodexExecRequest = ProcessTurnRequest;
export type CodexExecHandle = ProcessTurnHandle<CodexEvent>;

/**
 * Runs one `codex exec` turn and streams its JSONL events. Injectable so the
 * engine and analyzer are unit-testable without spawning a process (mirrors the
 * Claude side's injectable `query`).
 */
export type CodexExecFn = ProcessTurnFn<CodexEvent>;

/** Build the real exec function bound to a resolved `codex` binary path. */
export function makeCodexExec(bin: string): CodexExecFn {
  return (req) => spawnCodexExec(bin, req);
}

function quoteConfigString(value: string): string {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function configArgs(req: CodexExecRequest): string[] {
  const args: string[] = [];
  if (req.model) args.push("-c", `model=${quoteConfigString(req.model)}`);
  if (req.effort) args.push("-c", `model_reasoning_effort=${quoteConfigString(req.effort)}`);
  if (req.speed) args.push("-c", `service_tier=${quoteConfigString(req.speed)}`);
  return args;
}

/** @deprecated Use the transport-neutral Codex input preparer. */
export function prepareCodexExecInput(req: CodexExecRequest) {
  return prepareCodexInput(req.prompt, req.attachments);
}

/**
 * `exec` flags differ from `exec resume`: resume rejects `-C`/`-s` (cwd is
 * inherited from the recorded session; sandbox is passed as a config override).
 * Captured against codex-cli 0.133.
 */
export function buildArgs(req: CodexExecRequest & { imagePaths?: string[] }): string[] {
  const schema = req.outputSchemaFile ? ["--output-schema", req.outputSchemaFile] : [];
  const config = configArgs(req);
  const images = (req.imagePaths ?? []).flatMap((image) => ["--image", image]);
  if (req.resume) {
    const sandbox = req.sandbox ? ["-c", `sandbox_mode="${req.sandbox}"`] : [];
    return [
      "exec",
      "resume",
      req.resume,
      "--json",
      "--skip-git-repo-check",
      ...config,
      ...sandbox,
      ...images,
      ...schema,
      "--",
      req.prompt,
    ];
  }
  const sandbox = req.sandbox ? ["-s", req.sandbox] : [];
  return [
    "exec",
    "--json",
    "--skip-git-repo-check",
    "-C",
    req.cwd,
    ...config,
    ...sandbox,
    ...images,
    ...schema,
    "--",
    req.prompt,
  ];
}

function spawnCodexExec(bin: string, req: CodexExecRequest): CodexExecHandle {
  const prepared = prepareCodexExecInput(req);
  // stdin ignored: with a piped-but-open stdin codex blocks "Reading additional
  // input from stdin…"; closing it lets the prompt arg stand alone.
  let child: ChildProcess;
  try {
    child = spawn(
      bin,
      buildArgs({ ...req, prompt: prepared.prompt, imagePaths: prepared.imagePaths }),
      { cwd: req.cwd, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" },
    );
  } catch (err) {
    prepared.cleanup();
    throw err;
  }
  // A missing binary (ENOENT) or other launch failure is reported via an async
  // 'error' event, NOT a throw — so the try/catch above can't see it. An unheard
  // 'error' on a ChildProcess is a fatal uncaught exception that takes down the
  // whole server, so attach the outcome listeners synchronously (before the event
  // can fire) and let readEvents turn the failure into an error event instead.
  const outcome = waitForOutcome(child);
  return {
    events: readEvents(child, prepared.cleanup, outcome, bin),
    kill: () => killCodexExec(child),
  };
}

function killCodexExec(child: ChildProcess): void {
  const signal = (sig: NodeJS.Signals) => {
    if (process.platform !== "win32" && child.pid) process.kill(-child.pid, sig);
    else child.kill(sig);
  };
  try {
    signal("SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
  setTimeout(() => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try {
      signal("SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }, 1500).unref();
}

/**
 * Branch a Codex session into a new one: returns the new session id, or null if
 * the parent isn't found. `codex exec` has no native fork, but Codex resolves a
 * session purely from its rollout file (verified), so a fork is a faithful copy
 * of the parent's rollout under a fresh id — parent untouched. If the branch
 * opener is the parent's latest user turn, copy only the history before that
 * turn so the old answer does not render before the new opening message.
 * `codex exec resume <newId>` then diverges into the branch.
 */
export type CodexForkFn = ProcessForkFn;

export function makeCodexFork(sessionsDir: string): CodexForkFn {
  return (parentId, branchText) => forkRollout(sessionsDir, parentId, branchText);
}

/** Find a session's rollout file (`rollout-*-<id>.jsonl`) anywhere under `dir`. */
function findRollout(dir: string, sessionId: string): string | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const hit = findRollout(full, sessionId);
      if (hit) return hit;
    } else if (e.isFile() && e.name.endsWith(".jsonl") && e.name.includes(sessionId)) {
      return full;
    }
  }
  return null;
}

function visibleForkUserText(content: unknown): string {
  const parts = Array.isArray(content)
    ? (content as Array<{ type?: string; text?: string }>)
        .filter((b) => b?.type === "input_text" && b.text)
        .map((b) => b.text)
        .join("")
    : typeof content === "string"
      ? content
      : "";
  const text = parts
    .replace(/<image\b[^>]*>/g, "")
    .replace(/<\/image>/g, "")
    .trim();
  return text && !text.startsWith("<") ? text : "";
}

function lastMatchingUserLine(lines: string[], branchText: string | undefined): number | null {
  const needle = branchText?.trim();
  if (!needle) return null;
  let lastUser: { index: number; text: string } | null = null;
  for (let i = 0; i < lines.length; i++) {
    try {
      const o = JSON.parse(lines[i] ?? "") as {
        type?: string;
        payload?: { type?: string; role?: string; content?: unknown };
      };
      const p = o.payload;
      if (o.type !== "response_item" || p?.type !== "message" || p.role !== "user") continue;
      const text = visibleForkUserText(p.content);
      if (text) lastUser = { index: i, text };
    } catch {}
  }
  return lastUser?.text === needle ? lastUser.index : null;
}

function forkRollout(
  sessionsDir: string,
  parentId: string,
  branchText: string | undefined,
): string | null {
  const src = findRollout(sessionsDir, parentId);
  if (!src) return null;
  let raw: string;
  try {
    raw = fs.readFileSync(src, "utf-8");
  } catch {
    return null;
  }
  const newId = randomUUID();
  const out: string[] = [];
  // A generating Codex turn appends to the rollout while fork reads it. A
  // concurrent read can observe the final JSONL record halfway through the
  // write. Snapshot every completed line, but never copy that unterminated tail
  // into the child rollout; Codex would reject the child as a malformed
  // conversation document. This keeps mid-generation fork supported while
  // branching from the last fully persisted event.
  const chunks = raw.split(/\r?\n/);
  if (!/\r?\n$/.test(raw)) {
    const tail = chunks[chunks.length - 1];
    try {
      JSON.parse(tail ?? "");
    } catch {
      chunks.pop();
    }
  }
  const lines = chunks.filter((line) => line.trim());
  const forkFrom = lastMatchingUserLine(lines, branchText);
  const sourceLines = forkFrom === null ? lines : lines.slice(0, forkFrom);
  for (const line of sourceLines) {
    try {
      const o = JSON.parse(line) as {
        type?: string;
        payload?: { id?: string; session_id?: string };
      };
      // rewrite the session id so the copy is an independent thread
      if (o.type === "session_meta" && o.payload && typeof o.payload === "object") {
        o.payload.id = newId;
        o.payload.session_id = newId;
      }
      out.push(JSON.stringify(o));
    } catch {
      out.push(line);
    }
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = path.join(path.dirname(src), `rollout-${stamp}-${newId}.jsonl`);
  try {
    fs.writeFileSync(dest, `${out.join("\n")}\n`);
  } catch {
    return null;
  }
  return newId;
}

interface CodexExecOutcome {
  code: number | null;
  signal: NodeJS.Signals | null;
  /** set when the process failed to spawn (e.g. ENOENT) rather than exiting */
  error: NodeJS.ErrnoException | null;
}

/**
 * Resolve when the process exits OR fails to launch. Listening for 'error' here
 * (synchronously, at spawn time) is what keeps a missing `codex` binary from
 * crashing Node with an uncaught 'error' event.
 */
function waitForOutcome(child: ChildProcess): Promise<CodexExecOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (outcome: CodexExecOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };
    child.once("error", (error) => done({ code: null, signal: null, error }));
    child.once("exit", (code, signal) => done({ code, signal, error: null }));
  });
}

function describeSpawnError(bin: string, error: NodeJS.ErrnoException): string {
  if (error.code === "ENOENT") {
    return `Codex CLI not found (tried "${bin}"). Install the Codex CLI or set ATTEND_CODEX_BIN to its path.`;
  }
  return `Failed to launch Codex (${bin}): ${error.message}`;
}

/** Stream stdout as parsed JSONL events; ends when the process exits, fails to
 *  spawn, or is killed. */
async function* readEvents(
  child: ChildProcess,
  cleanup: () => void,
  outcome: Promise<CodexExecOutcome>,
  bin: string,
): AsyncIterable<CodexEvent> {
  const stderr: string[] = [];
  child.stderr?.setEncoding("utf-8");
  child.stderr?.on("data", (chunk) => stderr.push(String(chunk)));
  try {
    if (child.stdout) {
      const rl = readline.createInterface({
        input: child.stdout,
        crlfDelay: Number.POSITIVE_INFINITY,
      });
      try {
        for await (const line of rl) {
          const t = line.trim();
          if (!t) continue;
          try {
            yield JSON.parse(t) as CodexEvent;
          } catch {
            // tolerate a non-JSON banner line; skip it
          }
        }
      } catch {
        // stdout torn down before the process settled (e.g. a failed spawn) —
        // fall through and report the outcome below.
      }
    }
    const { code, signal, error } = await outcome;
    if (error) {
      yield { type: "error", error: describeSpawnError(bin, error) };
    } else if (signal === null && code !== null && code !== 0) {
      const message = stderr.join("").trim() || `codex exited with code ${code}`;
      yield { type: "error", error: message };
    }
  } finally {
    cleanup();
  }
}
