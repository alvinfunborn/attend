import fs from "node:fs";
import path from "node:path";
import { visiblePromptText } from "../../chat/transcript.js";
import { VISIT_GAP_MINUTES } from "../pattern.js";
import type { RawSession } from "../types.js";
import type { SessionSource } from "./index.js";
import { ScanCache } from "./scan-cache.js";

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

/** Parse one Claude transcript's text into a normalized session (pure, testable). */
export function parseClaudeTranscript(file: string, raw: string): RawSession {
  const session: RawSession = {
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
  const gapMs = VISIT_GAP_MINUTES * 60_000;
  let prevTs: number | null = null;
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
    const ts = isActivityEntry(obj) ? parseTs(obj.timestamp) : null;
    if (ts !== null) {
      if (session.firstTs === null) session.firstTs = ts;
      session.lastTs = ts;
      // A fresh burst (first activity, or resumed after a long idle gap) = a visit.
      if (prevTs === null || ts - prevTs > gapMs) session.visits += 1;
      prevTs = ts;
    }
    // Skip subagent sidechain turns — they are not the user's direct prompts
    // and their tool uses shouldn't inflate the brief's action count.
    if (obj.isSidechain) continue;
    if (obj.isMeta) continue;
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
        session.lastPrompt = snippet(text); // keep overwriting → ends as the latest prompt
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
      const txt = assistantText(obj.message?.content);
      session.chars += txt;
      if (txt > 0) {
        session.lastTurnChars = txt;
        if (ts !== null) {
          session.lastAssistantTs = ts;
          session.assistantTextActivity?.push({ at: ts, chars: txt });
        }
      }
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
      lastPrompt: null,
      lastTurnChars: 0,
      chars: 0,
      cwd: null,
      firstTs: null,
      lastTs: null,
      userPromptTs: [],
      prompts: 0,
      actions: 0,
      visits: 0,
    };
  }
}

/** Reads Claude Code transcripts at ~/.claude/projects/<encoded-cwd>/*.jsonl. */
export class ClaudeSource implements SessionSource {
  readonly vendor = "claude";

  constructor(
    private readonly projectsDir: string,
    private readonly cache = new ScanCache(),
  ) {}

  scan(): RawSession[] {
    // Walk + stat is cheap; the cache re-parses only transcripts whose mtime/size
    // changed since the last scan (see ScanCache).
    return this.cache.memoize(this.listTranscripts(), parseSessionFile);
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
