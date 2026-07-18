import fs from "node:fs";

export interface ToolCall {
  id?: string | null;
  name: string;
  input: unknown;
  result?: string;
  isError?: boolean;
}

export interface TranscriptMsg {
  role: "user" | "assistant";
  text: string;
  tools: ToolCall[];
  /** epoch ms parsed from the transcript row, when the vendor records one */
  ts?: number;
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
  /** Claude marks injected context (slash-command expansions, system notes) as
   *  meta — it's not part of the visible conversation, so we skip it. */
  isMeta?: boolean;
  timestamp?: string;
  message?: { content?: unknown };
}

function parseTs(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : undefined;
}

function withTs<T extends TranscriptMsg>(msg: T, ts: number | undefined): T {
  return ts === undefined ? msg : ({ ...msg, ts } as T);
}

/**
 * A slash command the user typed is stored as `<command-name>/x</command-name>
 * <command-args>…</command-args>` (the human-visible turn), followed by a separate
 * `isMeta` message holding the command's expanded template. Reconstruct the typed
 * command so the transcript shows what the user actually sent — `/x args` — instead
 * of dropping it (it starts with "<") and surfacing the giant template in its place.
 */
function commandText(raw: string): string | null {
  const name = /<command-name>\s*([^<]*?)\s*<\/command-name>/.exec(raw);
  if (!name) return null;
  const cmd = (name[1] ?? "").trim();
  if (!cmd) return null;
  const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(raw);
  const a = (args?.[1] ?? "").trim();
  return a ? `${cmd} ${a}` : cmd;
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

export function visiblePromptText(raw: string): string {
  const text = raw.trim();
  const command = commandText(text);
  if (command) return visiblePromptText(command);
  const pinnedMarker = "Attend pinned context:";
  const pinnedAtStart = text.startsWith(pinnedMarker);
  const pinnedAfterLineBreak = text.indexOf(`\n${pinnedMarker}`);
  const pinnedIdx = pinnedAtStart ? 0 : pinnedAfterLineBreak;
  let validPinnedIdx = -1;
  if (pinnedIdx >= 0) {
    const tail = text.slice(pinnedAtStart ? pinnedIdx : pinnedIdx + 1);
    if (
      tail.includes("\nThe user explicitly selected the quoted Pin context below for this turn.") &&
      tail.includes("\nTool calls, tool inputs, and tool results are intentionally omitted.")
    ) {
      validPinnedIdx = pinnedIdx;
    }
  }
  const marker = "Attend fork context:";
  const markerAtStart = text.startsWith(marker);
  const markerAfterLineBreak = text.indexOf(`\n${marker}`);
  const idx = markerAtStart ? 0 : markerAfterLineBreak;
  if (idx >= 0) {
    const tail = text.slice(markerAtStart ? idx : idx + 1);
    const validFork =
      tail.includes("\nUse the transcript below as prior context") &&
      tail.includes("\nTranscript:");
    if (validFork && (validPinnedIdx < 0 || idx <= validPinnedIdx)) {
      const opening = text.slice(0, idx).trim();
      const attachmentNote = "\nThe user's opening turn includes ";
      const noteIdx = opening.indexOf(attachmentNote);
      return (noteIdx >= 0 ? opening.slice(0, noteIdx) : opening).trim();
    }
  }
  if (validPinnedIdx >= 0) return text.slice(0, validPinnedIdx).trim();
  return text;
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
    // Injected meta turns (slash-command expansions, system notes) aren't part of
    // the visible conversation — skip them so the giant command template doesn't
    // render as a user message.
    if (o.isMeta) continue;
    const content = o.message?.content;
    const ts = parseTs(o.timestamp);

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
      const raw = textOf(content);
      const cmd = commandText(raw);
      if (cmd) {
        // a typed slash command → show "/cmd args", not the dropped tag soup
        msgs.push(withTs({ role: "user", text: cmd, tools: [] }, ts));
      } else {
        const text = visiblePromptText(raw);
        // other "<…>" synthetic content (ide_opened_file, system reminders) stays hidden
        if (text && !text.startsWith("<")) msgs.push(withTs({ role: "user", text, tools: [] }, ts));
      }
    } else if (o.type === "assistant") {
      const blocks: Block[] = Array.isArray(content) ? (content as Block[]) : [];
      let text = "";
      const tools: ToolCall[] = [];
      for (const b of blocks) {
        if (b?.type === "text" && b.text) text += b.text;
        else if (b?.type === "tool_use" && b.name) {
          const tc: ToolCall = { id: b.id ?? null, name: b.name, input: b.input };
          tools.push(tc);
          if (b.id) toolById.set(b.id, tc);
        }
      }
      if (text || tools.length) msgs.push(withTs({ role: "assistant", text, tools }, ts));
    }
  }
  return msgs.slice(-limit);
}
