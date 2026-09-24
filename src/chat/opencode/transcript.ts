import fs from "node:fs";
import type { ToolCall, TranscriptMsg } from "../transcript.js";

/**
 * OpenCode history arrives in two compatible JSONL shapes:
 *
 *  1. Attend's own mirror, one `TranscriptMsg` per line
 *     (`{"role":"user"|"assistant","text":"…","tools":[…],"ts":…}`), written by
 *     `OpencodeSource` from the native SQLite/legacy store.
 *  2. Raw `opencode run --format json` events captured while Attend drives a turn
 *     (`step_start` / `text` / `tool_use` / `step_finish` / `error`) plus Attend's
 *     synthetic `attend.user` opening line.
 *
 * Both are normalized here into the shared `TranscriptMsg` protocol.
 */
export interface OpencodeRawPart {
  id?: string;
  type?: string;
  text?: string;
  tool?: string;
  callID?: string;
  /** step-finish only: "stop" ends the turn, "tool-calls" is an intermediate step. */
  reason?: string;
  state?: {
    status?: string;
    input?: unknown;
    output?: unknown;
    metadata?: { exit?: number | null; output?: unknown; truncated?: boolean };
    title?: string;
  };
  time?: { start?: number; end?: number };
}

export interface OpencodeTranscriptEvent {
  type?: string;
  role?: "user" | "assistant";
  text?: string;
  content?: string;
  time?: number | { created?: number; start?: number; end?: number };
  sessionID?: string;
  part?: OpencodeRawPart;
  tools?: ToolCall[];
  ts?: number;
  error?: { name?: string; data?: { message?: string } } | string;
  _attend?: { timestamp?: number; cwd?: string };
}

function numeric(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function eventTimestamp(event: OpencodeTranscriptEvent): number | undefined {
  return (
    numeric(event._attend?.timestamp) ??
    numeric(event.ts) ??
    numeric(event.time) ??
    numeric(event.part?.time?.end) ??
    numeric(event.part?.time?.start) ??
    (typeof event.time === "object"
      ? (numeric(event.time?.end) ?? numeric(event.time?.created))
      : undefined)
  );
}

function toolFromPart(part: OpencodeRawPart): ToolCall {
  const state = part.state ?? {};
  const output = state.output ?? state.metadata?.output;
  const exit = typeof state.metadata?.exit === "number" ? state.metadata.exit : null;
  const result =
    output === undefined || output === null
      ? undefined
      : typeof output === "string"
        ? output
        : JSON.stringify(output);
  return {
    id: part.callID ?? part.id ?? null,
    name: part.tool ?? part.type ?? "tool",
    input: state.input ?? {},
    ...(result !== undefined ? { result } : {}),
    ...(state.status === "error" || (exit !== null && exit !== 0) ? { isError: true } : {}),
  };
}

function pushMessage(messages: TranscriptMsg[], message: TranscriptMsg): void {
  const last = messages.at(-1);
  if (
    last &&
    last.role === message.role &&
    last.text === message.text &&
    !message.tools.length &&
    !last.tools.length
  ) {
    return;
  }
  messages.push(message);
}

/** Appends a user turn, collapsing the immediate duplicate opencode can emit. */
function pushUser(messages: TranscriptMsg[], text: string, ts: number | undefined): void {
  const last = messages.at(-1);
  if (last?.role === "user" && last.text === text) return;
  messages.push({ role: "user", text, tools: [], ...(ts ? { ts } : {}) });
}

function pushAssistant(messages: TranscriptMsg[], text: string, ts: number | undefined): void {
  // Multiple `text` events in one opencode step are separate blocks; keep them
  // as their own assistant messages so the console can render them in order.
  pushMessage(messages, {
    role: "assistant",
    text,
    tools: [],
    ...(ts ? { ts } : {}),
  });
}

function attachTool(messages: TranscriptMsg[], tool: ToolCall, ts: number | undefined): void {
  const last = messages.at(-1);
  if (last?.role === "assistant" && last.text === "") {
    last.tools.push(tool);
    if (!last.ts && ts) last.ts = ts;
    return;
  }
  messages.push({ role: "assistant", text: "", tools: [tool], ...(ts ? { ts } : {}) });
}

export function parseOpencodeTranscript(raw: string, limit = 200): TranscriptMsg[] {
  const messages: TranscriptMsg[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event: OpencodeTranscriptEvent;
    try {
      event = JSON.parse(line) as OpencodeTranscriptEvent;
    } catch {
      continue;
    }

    // Attend mirror: a complete TranscriptMsg.
    if (event.role === "user" || event.role === "assistant") {
      const tools = Array.isArray(event.tools) ? event.tools : [];
      pushMessage(messages, {
        role: event.role,
        text: typeof event.text === "string" ? event.text : "",
        tools,
        ...(numeric(event.ts) ? { ts: event.ts as number } : {}),
      });
      continue;
    }

    const ts = eventTimestamp(event);
    const type = event.type;
    if (type === "attend.user" || type === "user") {
      const text = typeof event.content === "string" ? event.content : (event.text ?? "");
      if (text) pushUser(messages, text, ts);
      continue;
    }
    if (type === "text" && event.part?.type === "text" && event.part.text) {
      pushAssistant(messages, event.part.text, ts);
      continue;
    }
    if (type === "tool_use" && event.part && event.part.type === "tool") {
      attachTool(messages, toolFromPart(event.part), ts);
    }
    // step_start / step_finish / reasoning / error carry no display content.
  }
  return messages.slice(-limit);
}

export function readOpencodeTranscript(file: string, limit = 200): TranscriptMsg[] {
  try {
    return parseOpencodeTranscript(fs.readFileSync(file, "utf8"), limit);
  } catch {
    return [];
  }
}
