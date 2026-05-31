import fs from "node:fs";
import path from "node:path";
import type { RawSession } from "../types.js";
import type { SessionSource } from "./index.js";

/** Tool uses that count as productive "actions". */
const ACTION_TOOLS = new Set(["Edit", "Write", "NotebookEdit", "Bash", "PowerShell"]);

function parseTs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

interface JsonlEntry {
  cwd?: string;
  timestamp?: string;
  type?: string;
  isSidechain?: boolean;
  sessionId?: string;
  message?: { content?: unknown };
}

/** Return the user prompt text if this is a real typed prompt, else null. */
function userPromptText(content: unknown): string | null {
  if (typeof content === "string") {
    const t = content.trim();
    return t !== "" && !content.startsWith("<") ? t : null;
  }
  if (Array.isArray(content)) {
    for (const c of content) {
      if (c && typeof c === "object" && (c as { type?: string }).type === "text") {
        const t = (c as { text?: string }).text;
        if (typeof t === "string" && t.trim() !== "") return t.trim();
      }
    }
  }
  return null;
}

function snippet(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 79)}…` : oneLine;
}

function countActions(content: unknown): number {
  if (!Array.isArray(content)) return 0;
  let n = 0;
  for (const c of content) {
    if (c && typeof c === "object") {
      const block = c as { type?: string; name?: string };
      if (block.type === "tool_use" && block.name && ACTION_TOOLS.has(block.name)) n += 1;
    }
  }
  return n;
}

/** Parse one Claude transcript's text into a normalized session (pure, testable). */
export function parseClaudeTranscript(file: string, raw: string): RawSession {
  const session: RawSession = {
    path: file,
    vendor: "claude",
    sessionId: null,
    title: null,
    cwd: null,
    firstTs: null,
    lastTs: null,
    prompts: 0,
    actions: 0,
  };
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let obj: JsonlEntry;
    try {
      obj = JSON.parse(line) as JsonlEntry;
    } catch {
      continue;
    }
    if (session.cwd === null && obj.cwd) session.cwd = obj.cwd;
    if (session.sessionId === null && obj.sessionId) session.sessionId = obj.sessionId;
    const ts = parseTs(obj.timestamp);
    if (ts !== null) {
      if (session.firstTs === null) session.firstTs = ts;
      session.lastTs = ts;
    }
    // Skip subagent sidechain turns — they are not the user's direct prompts
    // and their tool uses shouldn't inflate the brief's action count.
    if (obj.isSidechain) continue;
    if (obj.type === "user") {
      const text = userPromptText(obj.message?.content);
      if (text !== null) {
        session.prompts += 1;
        if (session.title === null) session.title = snippet(text);
      }
    } else if (obj.type === "assistant") {
      session.actions += countActions(obj.message?.content);
    }
  }
  return session;
}

function parseSessionFile(file: string): RawSession {
  try {
    return parseClaudeTranscript(file, fs.readFileSync(file, "utf-8"));
  } catch {
    return {
      path: file,
      vendor: "claude",
      sessionId: null,
      title: null,
      cwd: null,
      firstTs: null,
      lastTs: null,
      prompts: 0,
      actions: 0,
    };
  }
}

/** Reads Claude Code transcripts at ~/.claude/projects/<encoded-cwd>/*.jsonl. */
export class ClaudeSource implements SessionSource {
  readonly vendor = "claude";

  constructor(private readonly projectsDir: string) {}

  scan(): RawSession[] {
    const sessions: RawSession[] = [];
    let projects: fs.Dirent[];
    try {
      projects = fs.readdirSync(this.projectsDir, { withFileTypes: true });
    } catch {
      return sessions;
    }
    for (const proj of projects) {
      if (!proj.isDirectory()) continue;
      const dir = path.join(this.projectsDir, proj.name);
      let files: string[];
      try {
        files = fs.readdirSync(dir);
      } catch {
        continue;
      }
      for (const f of files) {
        if (f.endsWith(".jsonl")) sessions.push(parseSessionFile(path.join(dir, f)));
      }
    }
    return sessions;
  }
}
