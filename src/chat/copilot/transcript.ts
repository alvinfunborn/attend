import fs from "node:fs";
import type { ToolCall, TranscriptMsg } from "../transcript.js";
import type { CopilotEvent } from "./exec.js";

function timestamp(event: CopilotEvent): number | undefined {
  const raw = event._attend?.timestamp ?? event.timestamp;
  const value =
    typeof raw === "number" ? raw : typeof raw === "string" ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function toolId(event: CopilotEvent): string | null {
  return event.data?.toolCallId ?? event.data?.toolId ?? event.id ?? null;
}

export function parseCopilotTranscript(raw: string, limit = 200): TranscriptMsg[] {
  const messages: TranscriptMsg[] = [];
  const tools = new Map<string, ToolCall>();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event: CopilotEvent;
    try {
      event = JSON.parse(line) as CopilotEvent;
    } catch {
      continue;
    }
    const data = event.data ?? {};
    const ts = timestamp(event);
    const syntheticContent =
      event.type === "attend.user" && "content" in event
        ? String((event as CopilotEvent & { content?: string }).content ?? "")
        : "";
    if ((event.type === "user.message" && data.content) || syntheticContent) {
      const text = data.content ?? syntheticContent;
      const last = messages.at(-1);
      if (last?.role !== "user" || last.text !== text)
        messages.push({ role: "user", text, tools: [], ...(ts ? { ts } : {}) });
    } else if (event.type === "assistant.message" && data.content) {
      messages.push({ role: "assistant", text: data.content, tools: [], ...(ts ? { ts } : {}) });
    } else if (event.type === "tool.execution_start" || event.type === "external_tool.requested") {
      const id = toolId(event);
      const tool: ToolCall = {
        id,
        name: data.toolName ?? data.name ?? "tool",
        input: data.arguments ?? data.input,
      };
      if (id) tools.set(id, tool);
      const last = messages.at(-1);
      if (last?.role === "assistant") last.tools.push(tool);
      else messages.push({ role: "assistant", text: "", tools: [tool], ...(ts ? { ts } : {}) });
    } else if (
      (event.type === "tool.execution_complete" || event.type === "external_tool.completed") &&
      toolId(event)
    ) {
      const tool = tools.get(toolId(event) as string);
      const result = data.result ?? data.output;
      if (tool && result !== undefined) {
        tool.result = typeof result === "string" ? result : JSON.stringify(result);
      }
    }
  }
  return messages.slice(-limit);
}

export function readCopilotTranscript(file: string, limit = 200): TranscriptMsg[] {
  try {
    return parseCopilotTranscript(fs.readFileSync(file, "utf8"), limit);
  } catch {
    return [];
  }
}
