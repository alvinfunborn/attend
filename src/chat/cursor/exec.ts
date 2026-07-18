import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import type { CodexEvent } from "../codex/events.js";
import type { ChatAttachment } from "../driver.js";
import type { ProcessTurnFn, ProcessTurnHandle, ProcessTurnRequest } from "../process/types.js";

interface CursorContent {
  type?: string;
  text?: string;
}

interface CursorEvent {
  type?: string;
  subtype?: string;
  session_id?: string;
  is_error?: boolean;
  result?: string;
  message?: { role?: string; content?: CursorContent[] | string };
  call_id?: string;
  tool_call?: Record<string, { args?: unknown; result?: unknown }>;
  cwd?: string;
  model?: string;
  [key: string]: unknown;
}

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

function prepareInput(prompt: string, attachments: ChatAttachment[] = []): PreparedInput {
  let text = prompt;
  let tempDir: string | null = null;
  let count = 0;
  for (const attachment of attachments) {
    if (attachment.kind === "text") {
      const block = `[Attached text: ${attachment.name}]\n${attachment.text}`;
      text = text ? `${text}\n\n${block}` : block;
      continue;
    }
    if (!tempDir) tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-cursor-"));
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

/** Cursor CLI headless invocation documented at docs.cursor.com/en/cli/headless. */
export function buildCursorArgs(req: ProcessTurnRequest): string[] {
  const args = ["--print", "--force", "--output-format", "stream-json", "--stream-partial-output"];
  if (req.resume) args.push(`--resume=${req.resume}`);
  if (req.model) args.push("--model", req.model);
  args.push(req.prompt);
  return args;
}

function contentText(message: CursorEvent["message"]): string {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text ?? "")
    .join("");
}

function toolShape(ev: CursorEvent): { name: string; body: { args?: unknown; result?: unknown } } {
  const entry = Object.entries(ev.tool_call ?? {})[0];
  return entry ? { name: entry[0], body: entry[1] ?? {} } : { name: "tool", body: {} };
}

/** Convert Cursor stream-json into the compatibility protocol used by ProcessChatDriver. */
export function cursorToProcessEvent(ev: CursorEvent): CodexEvent[] {
  if (ev.type === "system" && ev.subtype === "init" && ev.session_id) {
    return [
      {
        type: "thread.started",
        thread_id: ev.session_id,
        ...(typeof ev.model === "string" && ev.model.trim() ? { model: ev.model.trim() } : {}),
      },
    ];
  }
  if (ev.type === "assistant") {
    const text = contentText(ev.message);
    return text ? [{ type: "item.completed", item: { type: "agent_message", text } }] : [];
  }
  if (ev.type === "tool_call") {
    const tool = toolShape(ev);
    if (ev.subtype === "started") {
      return [
        {
          type: "item.started",
          item: {
            id: ev.call_id,
            type: "mcp_tool_call",
            name: tool.name,
            arguments: tool.body.args,
          },
        },
      ];
    }
    if (ev.subtype === "completed") {
      return [
        {
          type: "item.completed",
          item: {
            id: ev.call_id,
            type: "mcp_tool_call",
            name: tool.name,
            arguments: tool.body.args,
            aggregated_output:
              typeof tool.body.result === "string"
                ? tool.body.result
                : JSON.stringify(tool.body.result ?? ""),
          },
        },
      ];
    }
  }
  if (ev.type === "result") {
    if (ev.subtype === "success" && ev.is_error !== true) return [{ type: "turn.completed" }];
    return [{ type: "turn.failed", error: ev.result || "cursor turn failed" }];
  }
  return [];
}

export function descendantPidsFromPs(raw: string, root: number): number[] {
  const children = new Map<number, number[]>();
  for (const line of raw.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d+)\s+(\d+)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const ppid = Number(match[2]);
    const list = children.get(ppid) ?? [];
    list.push(pid);
    children.set(ppid, list);
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
}

function processDescendants(pid: number): number[] {
  if (process.platform === "win32") return [];
  try {
    const result = spawnSync("ps", ["-axo", "pid=,ppid="], {
      encoding: "utf8",
      windowsHide: true,
    });
    return descendantPidsFromPs(String(result.stdout ?? ""), pid);
  } catch {
    return [];
  }
}

function killProcess(child: ChildProcess): void {
  const descendants = child.pid ? processDescendants(child.pid) : [];
  const signal = (sig: NodeJS.Signals) => {
    for (const pid of descendants) {
      try {
        process.kill(pid, sig);
      } catch {
        // It may already have exited between the process-table scan and signal.
      }
    }
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

function transcriptLine(ev: CursorEvent, cwd: string): string {
  return `${JSON.stringify({ ...ev, _attend: { timestamp: Date.now(), cwd } })}\n`;
}

function spawnCursorExec(
  bin: string,
  sessionsDir: string,
  req: ProcessTurnRequest,
): ProcessTurnHandle<CodexEvent> {
  const prepared = prepareInput(req.prompt, req.attachments);
  fs.mkdirSync(sessionsDir, { recursive: true });
  const child = spawn(bin, buildCursorArgs({ ...req, prompt: prepared.prompt }), {
    cwd: req.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  let launchError: Error | null = null;
  child.once("error", (err) => {
    launchError = err;
  });

  async function* events(): AsyncIterable<CodexEvent> {
    const stderr: string[] = [];
    child.stderr?.on("data", (chunk) => stderr.push(String(chunk)));
    let transcript = req.resume ? path.join(sessionsDir, `${req.resume}.jsonl`) : null;
    const pending: string[] = [];
    let sawAssistant = false;
    let assistantText = "";
    try {
      const stdout = child.stdout;
      if (!stdout) {
        yield { type: "turn.failed", error: "cursor-agent stdout is unavailable" };
        return;
      }
      const lines = readline.createInterface({ input: stdout });
      for await (const line of lines) {
        let ev: CursorEvent;
        try {
          ev = JSON.parse(line) as CursorEvent;
        } catch {
          continue;
        }
        // Cursor's assistant events are cumulative snapshots under
        // --stream-partial-output. Persisting every snapshot makes transcript
        // size quadratic; keep only non-assistant protocol events and append one
        // final assistant message when the turn terminates.
        const finalAssistantLine =
          ev.type === "result" && assistantText
            ? transcriptLine(
                { type: "assistant", message: { role: "assistant", content: assistantText } },
                req.cwd,
              )
            : "";
        const stored =
          ev.type === "assistant" ? "" : finalAssistantLine + transcriptLine(ev, req.cwd);
        if (!transcript && stored) pending.push(stored);
        if (!transcript && ev.session_id) {
          transcript = path.join(sessionsDir, `${ev.session_id}.jsonl`);
          if (pending.length) fs.appendFileSync(transcript, pending.join(""));
          pending.length = 0;
        } else if (transcript) {
          if (stored) fs.appendFileSync(transcript, stored);
        }
        let normalizedAssistant: string | null = null;
        if (ev.type === "assistant") {
          const text = contentText(ev.message);
          if (text) {
            sawAssistant = true;
            if (text === assistantText || assistantText.startsWith(text)) {
              normalizedAssistant = "";
            } else if (text.startsWith(assistantText)) {
              normalizedAssistant = text.slice(assistantText.length);
              assistantText = text;
            } else {
              normalizedAssistant = text;
              assistantText += text;
            }
          }
        }
        if (
          ev.type === "result" &&
          ev.subtype === "success" &&
          ev.is_error !== true &&
          !sawAssistant &&
          typeof ev.result === "string" &&
          ev.result
        ) {
          yield { type: "item.completed", item: { type: "agent_message", text: ev.result } };
        }
        if (ev.type === "assistant") {
          if (normalizedAssistant) {
            yield {
              type: "item.completed",
              item: { type: "agent_message", text: normalizedAssistant },
            };
          }
        } else {
          for (const mapped of cursorToProcessEvent(ev)) yield mapped;
        }
      }
      const outcome = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
        (resolve) => {
          if (child.exitCode !== null || child.signalCode !== null)
            resolve({ code: child.exitCode, signal: child.signalCode });
          else child.once("close", (code, signal) => resolve({ code, signal }));
        },
      );
      if (launchError) yield { type: "turn.failed", error: launchError.message };
      else if (outcome.code !== 0 && !outcome.signal) {
        yield {
          type: "turn.failed",
          error: stderr.join("").trim() || `cursor-agent exited with code ${outcome.code}`,
        };
      }
    } finally {
      prepared.cleanup();
    }
  }

  return { events: events(), kill: () => killProcess(child) };
}

/** Build a Cursor headless runner compatible with the existing per-turn engine. */
export function makeCursorExec(bin: string, sessionsDir: string): ProcessTurnFn<CodexEvent> {
  return (req) => spawnCursorExec(bin, sessionsDir, req);
}
