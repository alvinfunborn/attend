import fs from "node:fs";

export interface TranscriptMsg {
  role: "user" | "assistant";
  text: string;
  tools: string[];
}

interface Block {
  type?: string;
  text?: string;
  name?: string;
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

/**
 * Read a Claude JSONL transcript into display messages (most recent `limit`).
 * Used to show a session's history when you open it in the console.
 */
export function readClaudeTranscript(file: string, limit = 200): TranscriptMsg[] {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  const msgs: TranscriptMsg[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let o: Line;
    try {
      o = JSON.parse(line) as Line;
    } catch {
      continue;
    }
    if (o.isSidechain) continue;
    if (o.type === "user") {
      const text = textOf(o.message?.content).trim();
      if (text && !text.startsWith("<")) msgs.push({ role: "user", text, tools: [] });
    } else if (o.type === "assistant") {
      const content = o.message?.content;
      const blocks: Block[] = Array.isArray(content) ? (content as Block[]) : [];
      let text = "";
      const tools: string[] = [];
      for (const b of blocks) {
        if (b?.type === "text" && b.text) text += b.text;
        else if (b?.type === "tool_use" && b.name) tools.push(b.name);
      }
      if (text || tools.length) msgs.push({ role: "assistant", text, tools });
    }
  }
  return msgs.slice(-limit);
}
