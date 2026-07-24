import fs from "node:fs";
import path from "node:path";
import {
  type CursorEvent,
  type CursorTranscriptState,
  appendCursorTranscriptEvent,
  createCursorTranscriptState,
  parseCursorEvent,
} from "../../chat/cursor/transcript.js";
import type { TranscriptMsg } from "../../chat/transcript.js";
import { VISIT_GAP_MINUTES } from "../pattern.js";
import type { RawSession } from "../types.js";
import type { SessionSource } from "./index.js";
import { type IncrementalJsonlParser, ScanCache } from "./scan-cache.js";
import type { TranscriptPathWriter } from "./transcript-index.js";

function observedModel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  if (!clean) return undefined;
  return clean.toLowerCase() === "auto" ? "auto" : clean;
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

interface CursorSessionState {
  session: RawSession;
  transcript: CursorTranscriptState;
  previousTs: number | null;
  messageChars: WeakMap<TranscriptMsg, number>;
  assistantActivityIndexes: WeakMap<TranscriptMsg, number>;
}

function createCursorState(file: string, cwd: string | null): CursorSessionState {
  const session = emptySession(file);
  session.cwd = cwd;
  return {
    session,
    transcript: createCursorTranscriptState(),
    previousTs: null,
    messageChars: new WeakMap(),
    assistantActivityIndexes: new WeakMap(),
  };
}

function syncCursorMessage(state: CursorSessionState, message: TranscriptMsg): void {
  const previousChars = state.messageChars.get(message);
  const currentChars = message.text.length;
  if (message.role === "user") {
    if (previousChars === undefined) {
      state.session.prompts += 1;
      state.session.chars += currentChars;
      if (!state.session.title) state.session.title = compact(message.text);
      state.session.lastPrompt = compact(message.text);
      if (message.ts) {
        state.session.userPromptTs?.push(message.ts);
        state.session.userPromptActivity?.push({ at: message.ts, chars: currentChars });
      }
    }
  } else {
    state.session.chars += currentChars - (previousChars ?? 0);
    if (currentChars > 0) {
      state.session.lastTurnChars = currentChars;
      if (message.ts) {
        state.session.lastAssistantTs = message.ts;
        const index = state.assistantActivityIndexes.get(message);
        if (index === undefined) {
          state.session.assistantTextActivity?.push({ at: message.ts, chars: currentChars });
          state.assistantActivityIndexes.set(
            message,
            (state.session.assistantTextActivity?.length ?? 1) - 1,
          );
        } else {
          const activity = state.session.assistantTextActivity?.[index];
          if (activity) activity.chars = currentChars;
        }
      }
    }
  }
  state.messageChars.set(message, currentChars);
}

function appendCursorLine(state: CursorSessionState, line: string): void {
  const event = parseCursorEvent(line);
  if (!event) return;
  const session = state.session;
  if (event.session_id) session.sessionId = event.session_id;
  if (!session.cwd && event._attend?.cwd) session.cwd = event._attend.cwd;
  const ts = Number(event._attend?.timestamp);
  if (event.type === "system" && event.subtype === "init") {
    const model = observedModel(event.model);
    if (model) {
      session.runConfig = {
        model,
        source: "provider-observed",
        ...(Number.isFinite(ts) && ts > 0 ? { updatedAt: ts } : {}),
      };
    }
  }
  if (Number.isFinite(ts) && ts > 0) {
    if (session.firstTs === null) session.firstTs = ts;
    session.lastTs = ts;
    if (state.previousTs === null || ts - state.previousTs > VISIT_GAP_MINUTES * 60_000) {
      session.visits += 1;
    }
    state.previousTs = ts;
  }
  if (event.type === "tool_call" && event.subtype === "started") session.actions += 1;
  if (event.role === "assistant" && Array.isArray(event.message?.content)) {
    session.actions += event.message.content.filter((block) => block?.type === "tool_use").length;
  }

  const previousLength = state.transcript.messages.length;
  const previousLast = state.transcript.messages.at(-1);
  appendCursorTranscriptEvent(state.transcript, event);
  const messages = state.transcript.messages;
  for (const message of messages.slice(previousLength)) syncCursorMessage(state, message);
  const currentLast = messages.at(-1);
  if (currentLast && currentLast === previousLast) syncCursorMessage(state, currentLast);
  // Session telemetry only needs Cursor's latest merge target. Keeping the full
  // message/tool history here would undo the memory win of incremental parsing;
  // chat history continues to use parseCursorTranscript separately.
  if (messages.length > 1) messages.splice(0, messages.length - 1);
  state.transcript.tools.clear();
}

function cursorJsonlParser(
  cwdForFile: (file: string) => string | null,
): IncrementalJsonlParser<CursorSessionState> {
  return {
    create: (file) => createCursorState(file, cwdForFile(file)),
    append: appendCursorLine,
    snapshot: (state, _file, mtimeMs) => {
      if (state.session.firstTs !== null) return state.session;
      return {
        ...state.session,
        firstTs: mtimeMs,
        lastTs: mtimeMs,
        visits: state.session.prompts > 0 ? 1 : 0,
      };
    },
  };
}

export function parseCursorSession(
  file: string,
  raw: string,
  cwd: string | null = null,
): RawSession {
  const state = createCursorState(file, cwd);
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim()) appendCursorLine(state, line);
  }
  return state.session;
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
    private readonly capturedCache = new ScanCache(),
    private readonly transcriptIndex?: TranscriptPathWriter,
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
    const nativeSessions = this.cache.memoizeJsonl(
      native.map(({ file }) => file),
      cursorJsonlParser((file) => nativeCwds.get(file) ?? null),
    );
    const capturedSessions = this.capturedCache.memoizeJsonl(
      captured,
      cursorJsonlParser(() => null),
    );
    const capturedById = new Map(
      capturedSessions
        .filter((session) => !!session.sessionId)
        .map((session) => [session.sessionId as string, session]),
    );
    const mergedNative = nativeSessions.map((session) => {
      const compatibility = session.sessionId ? capturedById.get(session.sessionId) : undefined;
      if (!compatibility) return session;
      capturedById.delete(session.sessionId as string);
      // Native Cursor transcripts are the canonical conversation, while Attend's
      // compatibility capture contains the otherwise-missing init model.
      return {
        ...session,
        ...(!session.runConfig && compatibility.runConfig
          ? { runConfig: compatibility.runConfig }
          : {}),
      };
    });
    const nativeIds = new Set(nativeSessions.map((session) => session.sessionId));
    const sessions = [
      ...mergedNative,
      ...capturedSessions.filter((session) => !nativeIds.has(session.sessionId)),
    ];
    this.transcriptIndex?.replaceVendor(this.vendor, sessions);
    return sessions;
  }
}
