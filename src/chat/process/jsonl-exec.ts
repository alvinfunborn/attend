import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawnCli, spawnCliSync } from "../../core/spawn.js";
import type { CodexEvent } from "../codex/events.js";
import type { ChatAttachment } from "../driver.js";
import type { ProcessTurnFn, ProcessTurnHandle, ProcessTurnRequest } from "./types.js";

interface PreparedInput {
  prompt: string;
  cleanup(): void;
}

function sanitizeName(name: string): string {
  return (
    path
      .basename(name)
      .trim()
      .replace(/[^A-Za-z0-9._-]+/g, "-") || "attachment"
  );
}

/** Materializes attachments as temporary local files and returns the prompt. */
export function prepareProcessInput(
  vendor: string,
  prompt: string,
  attachments: ChatAttachment[] = [],
): PreparedInput {
  let text = prompt;
  let tempDir: string | null = null;
  let count = 0;
  for (const attachment of attachments) {
    if (attachment.kind === "text") {
      const block = `[Attached text: ${attachment.name}]\n${attachment.text}`;
      text = text ? `${text}\n\n${block}` : block;
      continue;
    }
    if (!tempDir) tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `attend-${vendor}-`));
    count += 1;
    const file = path.join(
      tempDir,
      `${String(count).padStart(2, "0")}-${sanitizeName(attachment.name)}`,
    );
    fs.writeFileSync(file, Buffer.from(attachment.data, "base64"));
    const block = [
      `[Attached file: ${attachment.name}]`,
      `Local path: ${file}`,
      "Read this file from the local path when you need its contents.",
    ].join("\n");
    text = text ? `${text}\n\n${block}` : block;
  }
  return {
    prompt: text,
    cleanup: () => {
      if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

function descendantPids(root: number): number[] {
  if (process.platform === "win32") return [];
  try {
    const result = spawnCliSync("ps", ["-axo", "pid=,ppid="], {
      encoding: "utf8",
      windowsHide: true,
    });
    const children = new Map<number, number[]>();
    for (const line of String(result.stdout ?? "").split(/\r?\n/)) {
      const match = line.trim().match(/^(\d+)\s+(\d+)$/);
      if (!match) continue;
      const pid = Number(match[1]);
      const ppid = Number(match[2]);
      children.set(ppid, [...(children.get(ppid) ?? []), pid]);
    }
    const out: number[] = [];
    const visit = (pid: number) => {
      for (const child of children.get(pid) ?? []) {
        visit(child);
        out.push(child);
      }
    };
    visit(root);
    return out;
  } catch {
    return [];
  }
}

function killProcess(child: ChildProcess): void {
  const descendants = child.pid ? descendantPids(child.pid) : [];
  const signal = (value: NodeJS.Signals) => {
    for (const pid of descendants) {
      try {
        process.kill(pid, value);
      } catch {
        // The child may already have exited.
      }
    }
    if (process.platform !== "win32" && child.pid) process.kill(-child.pid, value);
    else child.kill(value);
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

export interface JsonlExecAdapter<Event extends object, State> {
  vendor: string;
  bin: string;
  sessionsDir: string;
  createState(request: ProcessTurnRequest): State;
  buildArgs(request: ProcessTurnRequest, prompt: string, state: State): string[];
  sessionId(event: Event, state: State): string | null;
  normalize(event: Event, state: State): CodexEvent[];
  /** A known id lets integrations such as Copilot create a transcript before output starts. */
  initialSessionId?(request: ProcessTurnRequest, state: State): string | null;
  /** Last-resort extraction for CLIs that announce a new id only in their log stream. */
  sessionIdFromStderr?(stderr: string, state: State): string | null;
  /** Override the child environment (e.g. a vendor that trusts $PWD over cwd). */
  env?(request: ProcessTurnRequest, base: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
}

/** Build a resilient line-oriented CLI runner shared by Antigravity and Copilot. */
export function makeJsonlExec<Event extends object, State>(
  adapter: JsonlExecAdapter<Event, State>,
): ProcessTurnFn<CodexEvent> {
  return (request): ProcessTurnHandle<CodexEvent> => {
    const prepared = prepareProcessInput(adapter.vendor, request.prompt, request.attachments);
    const state = adapter.createState(request);
    let sessionId = request.resume ?? adapter.initialSessionId?.(request, state) ?? null;
    fs.mkdirSync(adapter.sessionsDir, { recursive: true });
    const child = spawnCli(adapter.bin, adapter.buildArgs(request, prepared.prompt, state), {
      cwd: request.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      ...(adapter.env ? { env: adapter.env(request, process.env) } : {}),
    });
    let launchError: Error | null = null;
    child.once("error", (error) => {
      launchError = error;
    });

    async function* events(): AsyncIterable<CodexEvent> {
      const stderr: string[] = [];
      child.stderr?.on("data", (chunk) => stderr.push(String(chunk)));
      let transcript = sessionId ? path.join(adapter.sessionsDir, `${sessionId}.jsonl`) : null;
      const pending: string[] = [];
      const opening = `${JSON.stringify({
        type: "attend.user",
        role: "user",
        content: request.prompt,
        _attend: { timestamp: Date.now(), cwd: request.cwd },
      })}\n`;
      if (transcript) fs.appendFileSync(transcript, opening);
      else pending.push(opening);
      let sawTerminal = false;
      let sawRecognizedActivity = false;
      try {
        if (sessionId) yield { type: "thread.started", thread_id: sessionId };
        const stdout = child.stdout;
        if (!stdout) {
          yield { type: "turn.failed", error: `${adapter.vendor} stdout is unavailable` };
          return;
        }
        const lines = readline.createInterface({ input: stdout });
        outer: for await (const line of lines) {
          let event: Event;
          try {
            event = JSON.parse(line) as Event;
          } catch {
            continue;
          }
          const stored = `${JSON.stringify({
            ...event,
            _attend: { timestamp: Date.now(), cwd: request.cwd },
          })}\n`;
          if (!transcript) pending.push(stored);
          const observedId = adapter.sessionId(event, state);
          if (!sessionId && observedId) {
            sessionId = observedId;
            transcript = path.join(adapter.sessionsDir, `${sessionId}.jsonl`);
            if (pending.length) fs.appendFileSync(transcript, pending.join(""));
            pending.length = 0;
          } else if (transcript) {
            fs.appendFileSync(transcript, stored);
          }
          for (const normalized of adapter.normalize(event, state)) {
            if (normalized.type !== "thread.started") sawRecognizedActivity = true;
            if (
              normalized.type === "thread.started" &&
              sessionId &&
              normalized.thread_id === sessionId &&
              request.resume
            )
              continue;
            if (normalized.type === "turn.completed" || normalized.type === "turn.failed") {
              sawTerminal = true;
              yield normalized;
              // Some providers (e.g. opencode) keep a server process alive after
              // their terminal event. Stop reading and reap it so the turn ends
              // instead of waiting on a process that never exits.
              killProcess(child);
              break outer;
            }
            yield normalized;
          }
        }
        const outcome = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
          (resolve) => {
            if (child.exitCode !== null || child.signalCode !== null) {
              resolve({ code: child.exitCode, signal: child.signalCode });
            } else {
              child.once("close", (code, signal) => resolve({ code, signal }));
            }
          },
        );
        if (!sessionId && adapter.sessionIdFromStderr) {
          const observedId = adapter.sessionIdFromStderr(stderr.join(""), state);
          if (observedId) {
            sessionId = observedId;
            transcript = path.join(adapter.sessionsDir, `${sessionId}.jsonl`);
            if (pending.length) fs.appendFileSync(transcript, pending.join(""));
            pending.length = 0;
            yield { type: "thread.started", thread_id: sessionId };
          }
        }
        if (launchError) yield { type: "turn.failed", error: launchError.message };
        else if (outcome.code !== 0 && !outcome.signal) {
          yield {
            type: "turn.failed",
            error: stderr.join("").trim() || `${adapter.vendor} exited with code ${outcome.code}`,
          };
        } else if (outcome.code === 0 && !sawTerminal) {
          if (sawRecognizedActivity) yield { type: "turn.completed" };
          else {
            yield {
              type: "turn.failed",
              error:
                stderr.join("").trim() ||
                `${adapter.vendor} produced no recognized response events`,
            };
          }
        }
      } finally {
        prepared.cleanup();
      }
    }

    return { events: events(), kill: () => killProcess(child) };
  };
}
