import fs from "node:fs";
import path from "node:path";
import type { AntigravityEvent } from "../../chat/antigravity/exec.js";
import { parseAntigravityTranscript } from "../../chat/antigravity/transcript.js";
import type { RawSession } from "../types.js";
import type { SessionSource } from "./index.js";
import { type IncrementalJsonlParser, ScanCache } from "./scan-cache.js";
import {
  type TranscriptSummaryState,
  appendTranscriptSummary,
  createTranscriptSummaryState,
  restoreTranscriptSummaryState,
  transcriptSummarySnapshot,
} from "./session-summary.js";
import type { TranscriptPathWriter } from "./transcript-index.js";

function filesIn(dir: string, nested: boolean): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && nested) out.push(...filesIn(full, true));
    else if (entry.isFile() && (entry.name.endsWith(".json") || entry.name.endsWith(".jsonl"))) {
      out.push(full);
    }
  }
  return out;
}

interface AntigravitySummaryState {
  summary: TranscriptSummaryState;
  conversationId: string | null;
  sessionId: string | null;
  fallbackSessionId: string | null;
  attendCwd: string | null;
  workspaceCwd: string | null;
}

type AntigravitySummaryEvent = AntigravityEvent & {
  messages?: unknown[];
  workspace?: { current_dir?: string; project_dir?: string };
};

function fallbackSessionId(file: string): string | null {
  const nativeConversation =
    path.basename(file) === "transcript.jsonl"
      ? path.basename(path.resolve(path.dirname(file), "..", ".."))
      : null;
  return (
    nativeConversation ?? path.basename(file).match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0] ?? null
  );
}

function createAntigravityState(file: string): AntigravitySummaryState {
  return {
    summary: createTranscriptSummaryState(),
    conversationId: null,
    sessionId: null,
    fallbackSessionId: fallbackSessionId(file),
    attendCwd: null,
    workspaceCwd: null,
  };
}

function appendAntigravityLine(state: AntigravitySummaryState, line: string): void {
  const event = JSON.parse(line) as AntigravitySummaryEvent;
  const native = Array.isArray(event.messages);
  for (const message of parseAntigravityTranscript(line, Number.POSITIVE_INFINITY)) {
    appendTranscriptSummary(state.summary, message, {
      mergeAssistantText: !native,
    });
  }
  const conversationId = event.conversation_id ?? event.conversationId;
  const sessionId = event.session_id ?? event.sessionId;
  if (typeof conversationId === "string" && conversationId) {
    state.conversationId = conversationId;
  }
  if (typeof sessionId === "string" && sessionId) state.sessionId = sessionId;
  if (typeof event._attend?.cwd === "string" && event._attend.cwd) {
    state.attendCwd = event._attend.cwd;
  }
  const workspaceCwd = event.workspace?.current_dir ?? event.workspace?.project_dir;
  if (typeof workspaceCwd === "string" && workspaceCwd) {
    state.workspaceCwd = workspaceCwd;
  }
}

function restoreAntigravityState(
  file: string,
  checkpoint: unknown,
): AntigravitySummaryState | null {
  if (!checkpoint || typeof checkpoint !== "object") return null;
  const saved = checkpoint as Partial<AntigravitySummaryState>;
  const summary = restoreTranscriptSummaryState(saved.summary);
  const nullableString = (value: unknown): value is string | null =>
    value === null || typeof value === "string";
  if (
    !summary ||
    !nullableString(saved.conversationId) ||
    !nullableString(saved.sessionId) ||
    !nullableString(saved.attendCwd) ||
    !nullableString(saved.workspaceCwd)
  ) {
    return null;
  }
  return {
    summary,
    conversationId: saved.conversationId,
    sessionId: saved.sessionId,
    fallbackSessionId: fallbackSessionId(file),
    attendCwd: saved.attendCwd,
    workspaceCwd: saved.workspaceCwd,
  };
}

const antigravityJsonlParser: IncrementalJsonlParser<AntigravitySummaryState> = {
  create: createAntigravityState,
  restore: restoreAntigravityState,
  serialize: (state) => state,
  append: appendAntigravityLine,
  snapshot: (state, file, mtimeMs) =>
    transcriptSummarySnapshot("antigravity", file, state.summary, {
      sessionId: state.conversationId ?? state.sessionId ?? state.fallbackSessionId,
      cwd: state.attendCwd ?? state.workspaceCwd,
      fallbackTimestamp: mtimeMs,
    }),
};

export class AntigravitySource implements SessionSource {
  readonly vendor = "antigravity";

  constructor(
    private readonly nativeDir: string,
    private readonly capturedDir: string,
    private readonly cache = new ScanCache(),
    private readonly transcriptIndex?: TranscriptPathWriter,
  ) {}

  scan(): RawSession[] {
    const native = filesIn(this.nativeDir, true).filter(
      (file) => path.basename(file) === "transcript.jsonl",
    );
    const captured = filesIn(this.capturedDir, false).filter((file) => file.endsWith(".jsonl"));
    const sessions = this.cache.memoizeJsonl([...native, ...captured], antigravityJsonlParser);
    const byId = new Map<string, RawSession>();
    for (const session of sessions) {
      if (!session.sessionId) continue;
      const previous = byId.get(session.sessionId);
      if (!previous || session.cwd || !previous.cwd) byId.set(session.sessionId, session);
    }
    const merged = [...byId.values()];
    this.transcriptIndex?.replaceVendor(this.vendor, merged);
    return merged;
  }
}
