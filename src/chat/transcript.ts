import fs from "node:fs";

export interface ToolCall {
  name: string;
  input: unknown;
  result?: string;
  isError?: boolean;
}

export interface TranscriptMsg {
  role: "user" | "assistant";
  text: string;
  tools: ToolCall[];
}

interface Block {
  type?: string;
  text?: string;
  name?: string;
  id?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}
interface Line {
  type?: string;
  isSidechain?: boolean;
  message?: { content?: unknown };
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Block[])
      .filter((b) => b?.type === "text" && b.text)
      .map((b) => b.text)
      .join("");
  }
  return "";
}

function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Block[])
      .map((b) => (typeof b === "string" ? b : b?.type === "text" ? (b.text ?? "") : ""))
      .join("");
  }
  return "";
}

/**
 * Read a Claude JSONL transcript into display messages (most recent `limit`).
 * Tool calls keep their input, and their result is correlated back by
 * tool_use_id so the console can render each tool as an expandable block.
 */
export function readClaudeTranscript(file: string, limit = 200): TranscriptMsg[] {
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
    if (o.isSidechain) continue;
    const content = o.message?.content;

    if (o.type === "user") {
      // a user turn is either a typed prompt or synthetic tool_result blocks
      if (Array.isArray(content)) {
        for (const b of content as Block[]) {
          if (b?.type === "tool_result" && b.tool_use_id) {
            const tc = toolById.get(b.tool_use_id);
            if (tc) {
              tc.result = resultText(b.content);
              tc.isError = b.is_error === true;
            }
          }
        }
      }
      const text = textOf(content).trim();
      if (text && !text.startsWith("<")) msgs.push({ role: "user", text, tools: [] });
    } else if (o.type === "assistant") {
      const blocks: Block[] = Array.isArray(content) ? (content as Block[]) : [];
      let text = "";
      const tools: ToolCall[] = [];
      for (const b of blocks) {
        if (b?.type === "text" && b.text) text += b.text;
        else if (b?.type === "tool_use" && b.name) {
          const tc: ToolCall = { name: b.name, input: b.input };
          tools.push(tc);
          if (b.id) toolById.set(b.id, tc);
        }
      }
      if (text || tools.length) msgs.push({ role: "assistant", text, tools });
    }
  }
  return msgs.slice(-limit);
}
