import fs from "node:fs";
import type { ToolCall, TranscriptMsg } from "../transcript.js";
import type { AntigravityEvent } from "./exec.js";

interface AntigravityNativeMessage {
  type?: string;
  role?: string;
  content?: unknown;
  text?: string;
  timestamp?: string;
  toolCalls?: Array<{
    id?: string;
    name?: string;
    args?: unknown;
    result?: unknown;
    status?: string;
  }>;
}

interface AntigravityNativeSession {
  messages?: AntigravityNativeMessage[];
}

function timestamp(value: unknown): number | undefined {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function nativeMessages(raw: string): TranscriptMsg[] | null {
  try {
    const parsed = JSON.parse(raw) as AntigravityNativeSession;
    if (!Array.isArray(parsed.messages)) return null;
    return parsed.messages.flatMap((message): TranscriptMsg[] => {
      const text =
        typeof message.content === "string"
          ? message.content
          : typeof message.text === "string"
            ? message.text
            : "";
      if (message.type === "user" || message.role === "user") {
        return text
          ? [
              {
                role: "user",
                text,
                tools: [],
                ...(timestamp(message.timestamp) ? { ts: timestamp(message.timestamp) } : {}),
              },
            ]
          : [];
      }
      if (
        !["assistant", "agent", "model", "planner_response"].includes(message.type ?? "") &&
        message.role !== "assistant"
      )
        return [];
      const tools: ToolCall[] = (message.toolCalls ?? []).map((tool) => ({
        id: tool.id ?? null,
        name: tool.name ?? "tool",
        input: tool.args,
        ...(tool.result !== undefined
          ? { result: typeof tool.result === "string" ? tool.result : JSON.stringify(tool.result) }
          : {}),
      }));
      return text || tools.length
        ? [
            {
              role: "assistant",
              text,
              tools,
              ...(timestamp(message.timestamp) ? { ts: timestamp(message.timestamp) } : {}),
            },
          ]
        : [];
    });
  } catch {
    return null;
  }
}

function eventText(event: AntigravityEvent): string {
  if (typeof event.content === "string") return event.content;
  if (Array.isArray(event.content))
    return event.content
      .map((part) =>
        typeof part === "string"
          ? part
          : part && typeof part === "object" && "text" in part
            ? String(part.text ?? "")
            : "",
      )
      .join("");
  return event.text ?? event.message ?? "";
}

export function parseAntigravityTranscript(raw: string, limit = 200): TranscriptMsg[] {
  const native = nativeMessages(raw);
  if (native) return native.slice(-limit);
  const messages: TranscriptMsg[] = [];
  const tools = new Map<string, ToolCall>();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event: AntigravityEvent;
    try {
      event = JSON.parse(line) as AntigravityEvent;
    } catch {
      continue;
    }
    const ts = timestamp(event._attend?.timestamp ?? event.timestamp);
    const text = eventText(event);
    if (event.role === "user" && text) {
      const last = messages.at(-1);
      if (last?.role !== "user" || last.text !== text)
        messages.push({ role: "user", text, tools: [], ...(ts ? { ts } : {}) });
    } else if (
      text &&
      (event.role === "assistant" ||
        ["assistant.message", "assistant_message", "agent_message", "planner_response"].includes(
          event.type ?? "",
        ))
    ) {
      const last = messages.at(-1);
      if (last?.role === "assistant") last.text += text;
      else
        messages.push({
          role: "assistant",
          text,
          tools: [],
          ...(ts ? { ts } : {}),
        });
    } else if (["tool_use", "tool_call", "tool.execution_start"].includes(event.type ?? "")) {
      const tool: ToolCall = {
        id: event.tool_id ?? null,
        name: event.tool_name ?? "tool",
        input: event.parameters,
      };
      if (event.tool_id) tools.set(event.tool_id, tool);
      const last = messages.at(-1);
      if (last?.role === "assistant") last.tools.push(tool);
      else messages.push({ role: "assistant", text: "", tools: [tool], ...(ts ? { ts } : {}) });
    } else if (
      ["tool_result", "tool.execution_complete"].includes(event.type ?? "") &&
      event.tool_id
    ) {
      const tool = tools.get(event.tool_id);
      if (tool) tool.result = event.output ?? event.error?.message ?? "";
    }
  }
  return messages.slice(-limit);
}

export function readAntigravityTranscript(file: string, limit = 200): TranscriptMsg[] {
  try {
    return parseAntigravityTranscript(fs.readFileSync(file, "utf8"), limit);
  } catch {
    return [];
  }
}
