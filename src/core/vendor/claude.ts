import fs from "node:fs";
import path from "node:path";
import { visiblePromptText } from "../../chat/transcript.js";
import { VISIT_GAP_MINUTES } from "../pattern.js";
import type { RawSession } from "../types.js";
import type { SessionSource } from "./index.js";
import { type IncrementalJsonlParser, ScanCache } from "./scan-cache.js";
import type { TranscriptPathWriter } from "./transcript-index.js";

/** Tool uses that count as productive "actions". */
const ACTION_TOOLS = new Set(["Edit", "Write", "NotebookEdit", "Bash", "PowerShell"]);

function parseTs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function isActivityEntry(obj: JsonlEntry): boolean {
  return obj.type === "user" || obj.type === "assistant";
}

interface JsonlEntry {
  cwd?: string;
  timestamp?: string;
  type?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  sessionId?: string;
  message?: {
    content?: unknown;
    model?: unknown;
    usage?: { speed?: unknown; service_tier?: unknown };
  };
}

function configValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean && !clean.startsWith("<") ? clean : undefined;
}

/** Return the user prompt text if this is a real typed prompt, else null. */
function userPromptText(content: unknown): string | null {
  const real = (text: string): string | null => {
    const t = visiblePromptText(text).trim();
    return t !== "" && !t.startsWith("<") ? t : null;
  };
  if (typeof content === "string") {
    return real(content);
  }
  if (Array.isArray(content)) {
    for (const c of content) {
      if (c && typeof c === "object" && (c as { type?: string }).type === "text") {
        const t = (c as { text?: string }).text;
        if (typeof t === "string") {
          const visible = real(t);
          if (visible) return visible;
        }
      }
    }
  }
  return null;
}

// Collapse to one line but keep the full prompt (bounded only against pathological
// pastes): the tab truncates visually via CSS, while the hover tooltip + chat
// header show the whole thing — so we must not truncate the data here.
function snippet(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 2000 ? `${oneLine.slice(0, 1999)}…` : oneLine;
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

/** Total length of text blocks in an assistant turn (was the ETA re-read proxy;
 *  ETA is memory-derived since v2.2 — captured but currently unused). */
function assistantText(content: unknown): number {
  if (typeof content === "string") return content.length;
  if (!Array.isArray(content)) return 0;
  let n = 0;
  for (const c of content) {
    if (c && typeof c === "object") {
      const block = c as { type?: string; text?: string };
      if (block.type === "text" && block.text) n += block.text.length;
    }
  }
  return n;
}

interface ClaudeSessionState {
  session: RawSession;
  previousTs: number | null;
}

function emptyClaudeSession(file: string): RawSession {
  return {
    path: file,
    vendor: "claude",
    sessionId: null,
    title: null,
    lastPrompt: null,
    lastTurnChars: 0,
    chars: 0,
    cwd: null,
    firstTs: null,
    lastTs: null,
    userPromptTs: [],
    userPromptActivity: [],
    assistantTextActivity: [],
    prompts: 0,
    actions: 0,
    visits: 0,
  };
}

function createClaudeState(file: string): ClaudeSessionState {
  return { session: emptyClaudeSession(file), previousTs: null };
}

function appendClaudeLine(state: ClaudeSessionState, line: string): void {
  let obj: JsonlEntry;
  try {
    obj = JSON.parse(line) as JsonlEntry;
  } catch {
    return;
  }
  const session = state.session;
  if (session.cwd === null && obj.cwd) session.cwd = obj.cwd;
  if (session.sessionId === null && obj.sessionId) session.sessionId = obj.sessionId;
  const ts = isActivityEntry(obj) ? parseTs(obj.timestamp) : null;
  if (ts !== null) {
    if (session.firstTs === null) session.firstTs = ts;
    session.lastTs = ts;
    // A fresh burst (first activity, or resumed after a long idle gap) = a visit.
    if (state.previousTs === null || ts - state.previousTs > VISIT_GAP_MINUTES * 60_000) {
      session.visits += 1;
    }
    state.previousTs = ts;
  }
  // Skip subagent sidechain turns — they are not the user's direct prompts
  // and their tool uses shouldn't inflate the brief's action count.
  if (obj.isSidechain || obj.isMeta) return;
  if (obj.type === "user") {
    const text = userPromptText(obj.message?.content);
    if (text !== null) {
      if (ts !== null) {
        session.userPromptTs?.push(ts);
        session.userPromptActivity?.push({ at: ts, chars: text.length });
      }
      session.prompts += 1;
      session.chars += text.length;
      if (session.title === null) session.title = snippet(text);
      session.lastPrompt = snippet(text);
    }
  } else if (obj.type === "assistant") {
    const model = configValue(obj.message?.model);
    const speed = configValue(obj.message?.usage?.speed);
    if (model || speed) {
      session.runConfig = {
        source: "provider",
        ...(session.runConfig ?? {}),
        ...(ts !== null ? { updatedAt: ts } : {}),
        ...(model ? { model } : {}),
        ...(speed ? { speed } : {}),
      };
    }
    session.actions += countActions(obj.message?.content);
    const chars = assistantText(obj.message?.content);
    session.chars += chars;
    if (chars > 0) {
      session.lastTurnChars = chars;
      if (ts !== null) {
        session.lastAssistantTs = ts;
        session.assistantTextActivity?.push({ at: ts, chars });
      }
    }
  }
}

const claudeJsonlParser: IncrementalJsonlParser<ClaudeSessionState> = {
  create: createClaudeState,
  append: appendClaudeLine,
  snapshot: (state) => state.session,
};

/** Parse one Claude transcript's text into a normalized session (pure, testable). */
export function parseClaudeTranscript(file: string, raw: string): RawSession {
  const state = createClaudeState(file);
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim()) appendClaudeLine(state, line);
  }
  return state.session;
}

/** Reads Claude Code transcripts at ~/.claude/projects/<encoded-cwd>/*.jsonl. */
export class ClaudeSource implements SessionSource {
  readonly vendor = "claude";

  constructor(
    private readonly projectsDir: string,
    private readonly cache = new ScanCache(),
    private readonly transcriptIndex?: TranscriptPathWriter,
  ) {}

  scan(): RawSession[] {
    const sessions = this.cache.memoizeJsonl(this.listTranscripts(), claudeJsonlParser);
    this.transcriptIndex?.replaceVendor(this.vendor, sessions);
    return sessions;
  }

  private listTranscripts(): string[] {
    const files: string[] = [];
    let projects: fs.Dirent[];
    try {
      projects = fs.readdirSync(this.projectsDir, { withFileTypes: true });
    } catch {
      return files;
    }
    for (const proj of projects) {
      if (!proj.isDirectory()) continue;
      const dir = path.join(this.projectsDir, proj.name);
      let names: string[];
      try {
        names = fs.readdirSync(dir);
      } catch {
        continue;
      }
      for (const f of names) {
        if (f.endsWith(".jsonl")) files.push(path.join(dir, f));
      }
    }
    return files;
  }
}
