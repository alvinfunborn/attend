import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import type { ChatAttachment, ImageAttachment, SessionEffort } from "../driver.js";
import type { CodexEvent } from "./events.js";

export type CodexSandbox = "read-only" | "workspace-write" | "danger-full-access";

/** One Codex `exec` turn: a fresh thread (no `resume`) or a continuation. */
export interface CodexExecRequest {
  cwd: string;
  prompt: string;
  attachments?: ChatAttachment[];
  /** thread id to continue; omitted for a brand-new thread */
  resume?: string;
  /** model override for this session/turn */
  model?: string;
  /** reasoning effort override for this session/turn */
  effort?: Exclude<SessionEffort, "max">;
  /** filesystem policy; chat defaults to danger-full-access, the daemon stays read-only */
  sandbox?: CodexSandbox;
  /** JSON Schema file forcing the final message's shape (the analyzer uses it) */
  outputSchemaFile?: string;
}

/** A running turn: its event stream, plus a way to stop it (the Stop button). */
export interface CodexExecHandle {
  events: AsyncIterable<CodexEvent>;
  kill(): void;
}

/**
 * Runs one `codex exec` turn and streams its JSONL events. Injectable so the
 * engine and analyzer are unit-testable without spawning a process (mirrors the
 * Claude side's injectable `query`).
 */
export type CodexExecFn = (req: CodexExecRequest) => CodexExecHandle;

/** Build the real exec function bound to a resolved `codex` binary path. */
export function makeCodexExec(bin: string): CodexExecFn {
  return (req) => spawnCodexExec(bin, req);
}

interface PreparedCodexExecInput {
  prompt: string;
  imagePaths: string[];
  cleanup(): void;
}

function quoteConfigString(value: string): string {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function configArgs(req: CodexExecRequest): string[] {
  const args: string[] = [];
  if (req.model) args.push("-c", `model=${quoteConfigString(req.model)}`);
  if (req.effort) args.push("-c", `model_reasoning_effort=${quoteConfigString(req.effort)}`);
  return args;
}

function sanitizeAttachmentName(name: string): string {
  const base = path.basename(name).trim();
  return base.replace(/[^A-Za-z0-9._-]+/g, "-") || "attachment";
}

function imageExt(mediaType: ImageAttachment["mediaType"]): string {
  if (mediaType === "image/jpeg") return ".jpg";
  if (mediaType === "image/gif") return ".gif";
  if (mediaType === "image/webp") return ".webp";
  return ".png";
}

function appendTextAttachment(prompt: string, name: string, text: string): string {
  const block = [`[Attached text: ${name}]`, text].join("\n");
  return prompt ? `${prompt}\n\n${block}` : block;
}

export function prepareCodexExecInput(req: CodexExecRequest): PreparedCodexExecInput {
  let prompt = req.prompt;
  const imagePaths: string[] = [];
  let tempDir: string | null = null;
  const cleanup = () => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  };

  for (const attachment of req.attachments ?? []) {
    if (attachment.kind === "text") {
      prompt = appendTextAttachment(prompt, attachment.name, attachment.text);
      continue;
    }
    if (attachment.kind === "document") {
      cleanup();
      throw new Error("Codex chat does not support PDF attachments");
    }
    if (!tempDir) {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-codex-"));
    }
    const file = path.join(
      tempDir,
      `${String(imagePaths.length + 1).padStart(2, "0")}-${sanitizeAttachmentName(attachment.name)}${imageExt(attachment.mediaType)}`,
    );
    fs.writeFileSync(file, Buffer.from(attachment.data, "base64"));
    imagePaths.push(file);
  }

  return { prompt, imagePaths, cleanup };
}

/**
 * `exec` flags differ from `exec resume`: resume rejects `-C`/`-s` (cwd is
 * inherited from the recorded session; sandbox is passed as a config override).
 * Captured against codex-cli 0.133.
 */
export function buildArgs(req: CodexExecRequest & { imagePaths?: string[] }): string[] {
  const schema = req.outputSchemaFile ? ["--output-schema", req.outputSchemaFile] : [];
  const config = configArgs(req);
  const images = req.imagePaths?.length ? ["--image", req.imagePaths.join(",")] : [];
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
    req.prompt,
  ];
}

function spawnCodexExec(bin: string, req: CodexExecRequest): CodexExecHandle {
  const prepared = prepareCodexExecInput(req);
  // stdin ignored: with a piped-but-open stdin codex blocks "Reading additional
  // input from stdin…"; closing it lets the prompt arg stand alone.
  try {
    const child = spawn(
      bin,
      buildArgs({ ...req, prompt: prepared.prompt, imagePaths: prepared.imagePaths }),
      { cwd: req.cwd, stdio: ["ignore", "pipe", "ignore"] },
    );
    return { events: readEvents(child, prepared.cleanup), kill: () => child.kill("SIGTERM") };
  } catch (err) {
    prepared.cleanup();
    throw err;
  }
}

/**
 * Branch a Codex session into a new one: returns the new session id, or null if
 * the parent isn't found. `codex exec` has no native fork, but Codex resolves a
 * session purely from its rollout file (verified), so a fork is a faithful copy
 * of the parent's rollout under a fresh id — full history, parent untouched.
 * `codex exec resume <newId>` then diverges into the branch.
 */
export type CodexForkFn = (parentId: string) => string | null;

export function makeCodexFork(sessionsDir: string): CodexForkFn {
  return (parentId) => forkRollout(sessionsDir, parentId);
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

function forkRollout(sessionsDir: string, parentId: string): string | null {
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
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line) as { type?: string; payload?: { id?: string } };
      // rewrite the session id so the copy is an independent thread
      if (o.type === "session_meta" && o.payload && typeof o.payload === "object") {
        o.payload.id = newId;
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

/** Stream stdout as parsed JSONL events; ends when the process exits (or is killed). */
async function* readEvents(child: ChildProcess, cleanup: () => void): AsyncIterable<CodexEvent> {
  try {
    if (!child.stdout) return;
    const rl = readline.createInterface({
      input: child.stdout,
      crlfDelay: Number.POSITIVE_INFINITY,
    });
    for await (const line of rl) {
      const t = line.trim();
      if (!t) continue;
      try {
        yield JSON.parse(t) as CodexEvent;
      } catch {
        // tolerate a non-JSON banner line; skip it
      }
    }
  } finally {
    cleanup();
  }
}
