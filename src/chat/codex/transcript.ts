import fs from "node:fs";
import { type ToolCall, type TranscriptMsg, visiblePromptText } from "../transcript.js";

/**
 * Read a Codex rollout transcript (`~/.codex/sessions/**​/rollout-*.jsonl`) into the
 * same display messages the Claude reader produces, so the console renders a Codex
 * session's history identically. Schema (codex-cli 0.133, captured from real
 * rollouts — never fabricated, DESIGN invariant 3): each line is
 *   {"timestamp","type":<session_meta|response_item|event_msg|…>,"payload":{…}}
 * and a `response_item` payload is an OpenAI Responses item:
 *   - message role=user    content=[{type:"input_text",text}]
 *   - message role=assistant content=[{type:"output_text",text}]
 *   - function_call         {name,arguments,call_id}
 *   - function_call_output  {call_id,output}
 * Synthetic user turns (environment/permission context, all `<…>`-wrapped) and
 * developer/reasoning items are dropped, mirroring the Claude reader. Codex
 * compaction entries are model-context snapshots, not display transcripts; they
 * are only used as a fallback if no real response items were present.
 */
interface ContentBlock {
  type?: string;
  text?: string;
}
interface Payload {
  type?: string;
  role?: string;
  content?: unknown;
  name?: string;
  arguments?: unknown;
  input?: unknown;
  call_id?: string;
  id?: string;
  output?: unknown;
  replacement_history?: unknown;
}
interface Line {
  type?: string;
  timestamp?: string;
  payload?: Payload;
}

function parseTs(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : undefined;
}

function withTs<T extends TranscriptMsg>(msg: T, ts: number | undefined): T {
  return ts === undefined ? msg : ({ ...msg, ts } as T);
}

function textOf(content: unknown, kind: string): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as ContentBlock[])
      .filter((b) => b?.type === kind && b.text)
      .map((b) => b.text)
      .join("");
  }
  return "";
}

function visibleUserText(content: unknown): string {
  const raw = textOf(content, "input_text").trim();
  const text = raw
    .replace(/<image\b[^>]*>/g, "")
    .replace(/<\/image>/g, "")
    .trim();
  // skip synthetic <environment_context>/<permissions…> turns, but keep real
  // prompts that were preceded by Codex's serialized image tags.
  const visible = visiblePromptText(text);
  return visible && !visible.startsWith("<") ? visible : "";
}

function parseToolInput(input: unknown): unknown {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

function applyItem(
  p: Payload,
  msgs: TranscriptMsg[],
  toolById: Map<string, ToolCall>,
  ts?: number,
): void {
  if (p.type === "message" && p.role === "user") {
    const text = visibleUserText(p.content);
    if (text) msgs.push(withTs({ role: "user", text, tools: [] }, ts));
  } else if (p.type === "message" && p.role === "assistant") {
    const text = textOf(p.content, "output_text").trim();
    if (text) msgs.push(withTs({ role: "assistant", text, tools: [] }, ts));
  } else if (
    p.type === "function_call" ||
    p.type === "custom_tool_call" ||
    p.type === "local_shell_call"
  ) {
    const tc: ToolCall = {
      id: p.call_id ?? p.id ?? null,
      name: p.name ?? p.type ?? "tool",
      input: parseToolInput(p.arguments ?? p.input),
    };
    if (p.call_id) toolById.set(p.call_id, tc);
    const last = msgs[msgs.length - 1];
    if (last && last.role === "assistant") last.tools.push(tc);
    else msgs.push(withTs({ role: "assistant", text: "", tools: [tc] }, ts));
  } else if (
    (p.type === "function_call_output" || p.type === "custom_tool_call_output") &&
    p.call_id
  ) {
    const tc = toolById.get(p.call_id);
    if (tc) tc.result = typeof p.output === "string" ? p.output : JSON.stringify(p.output ?? "");
  }
}

export function readCodexTranscript(file: string, limit = 200): TranscriptMsg[] {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  const msgs: TranscriptMsg[] = [];
  const toolById = new Map<string, ToolCall>();

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let o: Line;
    try {
      o = JSON.parse(line) as Line;
    } catch {
      continue;
    }
    const p = o.payload;
    if (!p) continue;
    const ts = parseTs(o.timestamp);
    if (o.type === "response_item") {
      applyItem(p, msgs, toolById, ts);
    } else if (
      o.type === "compacted" &&
      msgs.length === 0 &&
      Array.isArray(p.replacement_history)
    ) {
      for (const item of p.replacement_history) {
        if (!item || typeof item !== "object") continue;
        applyItem(item as Payload, msgs, toolById);
      }
    }
  }
  return msgs.slice(-limit);
}
