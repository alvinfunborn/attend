import fs from "node:fs";
import path from "node:path";
import { parseCursorTranscript } from "../../chat/cursor/transcript.js";
import { VISIT_GAP_MINUTES } from "../pattern.js";
import type { RawSession } from "../types.js";
import type { SessionSource } from "./index.js";
import { ScanCache } from "./scan-cache.js";

interface CursorEvent {
  role?: string;
  type?: string;
  subtype?: string;
  session_id?: string;
  message?: { content?: unknown };
  _attend?: { timestamp?: number; cwd?: string };
}

function emptySession(file: string): RawSession {
  return {
    path: file,
    vendor: "cursor",
    sessionId: path.basename(file, ".jsonl") || null,
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

function compact(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 2000 ? `${oneLine.slice(0, 1999)}…` : oneLine;
}

export function parseCursorSession(
  file: string,
  raw: string,
  cwd: string | null = null,
): RawSession {
  const session = emptySession(file);
  session.cwd = cwd;
  const messages = parseCursorTranscript(raw, Number.POSITIVE_INFINITY);
  const gapMs = VISIT_GAP_MINUTES * 60_000;
  let previousTs: number | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let ev: CursorEvent;
    try {
      ev = JSON.parse(line) as CursorEvent;
    } catch {
      continue;
    }
    if (ev.session_id) session.sessionId = ev.session_id;
    if (!session.cwd && ev._attend?.cwd) session.cwd = ev._attend.cwd;
    const ts = Number(ev._attend?.timestamp);
    if (Number.isFinite(ts) && ts > 0) {
      if (session.firstTs === null) session.firstTs = ts;
      session.lastTs = ts;
      if (previousTs === null || ts - previousTs > gapMs) session.visits += 1;
      previousTs = ts;
    }
    if (ev.type === "tool_call" && ev.subtype === "started") session.actions += 1;
    if (ev.role === "assistant" && Array.isArray(ev.message?.content)) {
      session.actions += ev.message.content.filter(
        (block) =>
          typeof block === "object" &&
          block !== null &&
          "type" in block &&
          block.type === "tool_use",
      ).length;
    }
  }
  for (const message of messages) {
    if (message.role === "user") {
      session.prompts += 1;
      session.chars += message.text.length;
      if (!session.title) session.title = compact(message.text);
      session.lastPrompt = compact(message.text);
      if (message.ts) {
        session.userPromptTs?.push(message.ts);
        session.userPromptActivity?.push({ at: message.ts, chars: message.text.length });
      }
    } else if (message.role === "assistant") {
      const chars = message.text.length;
      session.chars += chars;
      if (chars) session.lastTurnChars = chars;
      if (chars && message.ts) {
        session.lastAssistantTs = message.ts;
        session.assistantTextActivity?.push({ at: message.ts, chars });
      }
    }
  }
  return session;
}

function readSession(file: string, cwd: string | null): RawSession {
  try {
    const session = parseCursorSession(file, fs.readFileSync(file, "utf8"), cwd);
    if (session.firstTs === null) {
      const mtime = fs.statSync(file).mtimeMs;
      session.firstTs = mtime;
      session.lastTs = mtime;
      if (session.prompts > 0) session.visits = 1;
    }
    return session;
  } catch {
    return emptySession(file);
  }
}

const decodedProjects = new Map<string, string | null>();

/** Cursor encodes an absolute workspace path by replacing separators with `-`.
 * Resolve it against the real filesystem so hyphens inside directory names stay
 * unambiguous (a string replacement in the opposite direction cannot do that). */
export function decodeCursorProjectDir(encoded: string): string | null {
  if (decodedProjects.has(encoded)) return decodedProjects.get(encoded) ?? null;
  const root = path.parse(process.cwd()).root;
  const visit = (parent: string, rest: string): string | null => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(parent, { withFileTypes: true });
    } catch {
      return null;
    }
    const encodedName = (name: string) => name.replace(/[^A-Za-z0-9-]/g, "-");
    const candidates = entries
      .filter((entry) => {
        const name = encodedName(entry.name);
        return (
          (entry.isDirectory() || entry.isSymbolicLink()) &&
          (rest === name || rest.startsWith(`${name}-`))
        );
      })
      .sort((a, b) => encodedName(b.name).length - encodedName(a.name).length);
    for (const entry of candidates) {
      const next = path.join(parent, entry.name);
      const name = encodedName(entry.name);
      if (rest === name) return next;
      const found = visit(next, rest.slice(name.length + 1));
      if (found) return found;
    }
    return null;
  };
  const resolved = visit(root, encoded);
  decodedProjects.set(encoded, resolved);
  return resolved;
}

function nativeTranscripts(projectsDir: string): Array<{ file: string; cwd: string | null }> {
  let projects: fs.Dirent[];
  try {
    projects = fs.readdirSync(projectsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: Array<{ file: string; cwd: string | null }> = [];
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const transcripts = path.join(projectsDir, project.name, "agent-transcripts");
    let sessions: fs.Dirent[];
    try {
      sessions = fs.readdirSync(transcripts, { withFileTypes: true });
    } catch {
      continue;
    }
    const cwd = decodeCursorProjectDir(project.name);
    for (const session of sessions) {
      if (!session.isDirectory()) continue;
      const file = path.join(transcripts, session.name, `${session.name}.jsonl`);
      if (fs.existsSync(file)) files.push({ file, cwd });
    }
  }
  return files;
}

export class CursorSource implements SessionSource {
  readonly vendor = "cursor";

  constructor(
    private readonly projectsDir: string,
    private readonly capturedDir?: string,
    private readonly cache = new ScanCache(),
  ) {}

  scan(): RawSession[] {
    const native = nativeTranscripts(this.projectsDir);
    let captured: string[] = [];
    try {
      captured = this.capturedDir
        ? fs
            .readdirSync(this.capturedDir, { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
            .map((entry) => path.join(this.capturedDir ?? "", entry.name))
        : [];
    } catch {
      // Compatibility logs are optional; native Cursor transcripts remain usable.
    }
    const nativeCwds = new Map(native.map(({ file, cwd }) => [file, cwd]));
    const nativeSessions = this.cache.memoize(
      native.map(({ file }) => file),
      (file) => readSession(file, nativeCwds.get(file) ?? null),
    );
    const nativeIds = new Set(nativeSessions.map((session) => session.sessionId));
    const capturedSessions = this.cache
      .memoize(captured, (file) => readSession(file, null))
      .filter((session) => !nativeIds.has(session.sessionId));
    return [...nativeSessions, ...capturedSessions];
  }
}
