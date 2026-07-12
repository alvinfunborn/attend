import fs from "node:fs";
import { type ToolCall, type TranscriptMsg, visiblePromptText } from "../transcript.js";

interface CursorBlock {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface CursorEvent {
  role?: string;
  type?: string;
  subtype?: string;
  message?: { role?: string; content?: CursorBlock[] | string };
  call_id?: string;
  tool_call?: Record<string, { args?: unknown; result?: unknown }>;
  result?: string;
  is_error?: boolean;
  _attend?: { timestamp?: number; cwd?: string };
}

function messageRole(ev: CursorEvent): string | undefined {
  return ev.role ?? ev.type;
}

function nativePromptText(text: string): string {
  const match = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/);
  return visiblePromptText(match?.[1] ?? text).trim();
}

function textOf(message: CursorEvent["message"]): string {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text ?? "")
    .join("");
}

function toolOf(ev: CursorEvent): { name: string; args?: unknown; result?: unknown } {
  const entry = Object.entries(ev.tool_call ?? {})[0];
  return entry
    ? { name: entry[0], args: entry[1]?.args, result: entry[1]?.result }
    : { name: "tool" };
}

export function parseCursorTranscript(raw: string, limit = 200): TranscriptMsg[] {
  const messages: TranscriptMsg[] = [];
  const tools = new Map<string, ToolCall>();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let ev: CursorEvent;
    try {
      ev = JSON.parse(line) as CursorEvent;
    } catch {
      continue;
    }
    const ts = Number.isFinite(ev._attend?.timestamp) ? ev._attend?.timestamp : undefined;
    const role = messageRole(ev);
    if (role === "user") {
      const text = nativePromptText(textOf(ev.message));
      if (text) messages.push({ role: "user", text, tools: [], ...(ts ? { ts } : {}) });
    } else if (role === "assistant") {
      const text = textOf(ev.message);
      const last = messages[messages.length - 1];
      const nativeTools = Array.isArray(ev.message?.content)
        ? ev.message.content
            .filter((block) => block?.type === "tool_use")
            .map((block) => {
              const value = block as CursorBlock & { id?: string; name?: string; input?: unknown };
              return {
                id: value.id ?? null,
                name: value.name ?? "tool",
                input: value.input,
              } satisfies ToolCall;
            })
        : [];
      if (!text && nativeTools.length === 0) continue;
      if (last?.role === "assistant") {
        if (ev.role) last.text += text;
        else if (text === last.text || last.text.startsWith(text)) {
          // Cursor partial mode finishes with a full assistant snapshot after
          // emitting deltas. It is confirmation, not another message.
        } else if (text.startsWith(last.text)) last.text = text;
        else last.text += text;
        last.tools.push(...nativeTools);
      } else {
        messages.push({ role: "assistant", text, tools: nativeTools, ...(ts ? { ts } : {}) });
      }
    } else if (ev.type === "tool_call" && ev.subtype === "started") {
      const tool = toolOf(ev);
      const call: ToolCall = { id: ev.call_id ?? null, name: tool.name, input: tool.args };
      if (ev.call_id) tools.set(ev.call_id, call);
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") last.tools.push(call);
      else messages.push({ role: "assistant", text: "", tools: [call], ...(ts ? { ts } : {}) });
    } else if (ev.type === "tool_call" && ev.subtype === "completed" && ev.call_id) {
      const call = tools.get(ev.call_id);
      if (call) {
        const result = toolOf(ev).result;
        call.result = typeof result === "string" ? result : JSON.stringify(result ?? "");
      }
    } else if (
      ev.type === "result" &&
      ev.subtype === "success" &&
      ev.is_error !== true &&
      typeof ev.result === "string" &&
      ev.result
    ) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && !last.text) last.text = ev.result;
      else if (last?.role !== "assistant")
        messages.push({ role: "assistant", text: ev.result, tools: [], ...(ts ? { ts } : {}) });
    }
  }
  return messages.slice(-limit);
}

export function readCursorTranscript(file: string, limit = 200): TranscriptMsg[] {
  try {
    return parseCursorTranscript(fs.readFileSync(file, "utf8"), limit);
  } catch {
    return [];
  }
}
