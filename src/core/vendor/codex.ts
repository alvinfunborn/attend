import fs from "node:fs";
import path from "node:path";
import { visiblePromptText } from "../../chat/transcript.js";
import { VISIT_GAP_MINUTES } from "../pattern.js";
import type { RawSession } from "../types.js";
import type { SessionSource } from "./index.js";
import { type IncrementalJsonlParser, ScanCache } from "./scan-cache.js";
import type { TranscriptPathWriter } from "./transcript-index.js";

/**
 * Codex CLI rollout transcripts (~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl).
 *
 * Schema (openai/codex, codex-rs/protocol): each line is a RolloutLine —
 *   { "timestamp": "...", "type": <RolloutItem tag>, "payload": {...} }
 * with RolloutItem adjacently tagged, rename_all = snake_case:
 *   session_meta | response_item | event_msg | turn_context | compacted
 * `payload` of a response_item is an OpenAI Responses API item.
 *
 * Mapping to attend's vendor-neutral RawSession (parallels the Claude adapter):
 *   - cwd      ← session_meta.payload.cwd
 *   - prompts  ← response_item message with role "user" carrying input_text
 *   - actions  ← response_item function_call | local_shell_call | custom_tool_call
 *
 * NOTE: implemented from the documented schema; no local Codex install was
 * available to validate against a real rollout file. The mapping is conservative
 * (counts only unambiguous user turns and tool executions) and degrades to an
 * empty result rather than fabricating telemetry (DESIGN.md invariant 3). When a
 * real sample exists, confirm the field names below.
 */

const ACTION_ITEM_TYPES = new Set(["function_call", "local_shell_call", "custom_tool_call"]);

type Payload = ResponseItem & SessionMeta & EventPayload & TurnContext;

interface RolloutLine {
  timestamp?: string;
  type?: string;
  payload?: Payload;
  // tolerate bare (pre-RolloutLine) records that omit the wrapper
  cwd?: string;
  role?: string;
  content?: unknown;
}

interface SessionMeta {
  cwd?: string;
  thread_source?: string;
  source?: { subagent?: unknown };
}

interface ResponseItem {
  type?: string;
  role?: string;
  content?: unknown;
  cwd?: string;
  id?: string;
  phase?: string;
}

interface EventPayload {
  turn_id?: string;
  started_at?: number;
  completed_at?: number;
  phase?: string;
}

interface TurnContext {
  model?: string;
  effort?: string;
  service_tier?: string;
  serviceTier?: string;
}

function configValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

interface ActiveTurn {
  turnId: string | null;
  startedAt: number | null;
}

const TERMINAL_EVENT_TYPES = new Set(["task_complete", "task_failed", "task_cancelled"]);

function parseTs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function secondsToMs(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value * 1000) : null;
}

function isFinalAnswer(item: Payload): boolean {
  return item.phase === "final_answer";
}

function assistantOutputTextLength(item: Payload): number {
  if (item.type !== "message" || item.role !== "assistant" || !Array.isArray(item.content)) {
    return 0;
  }
  return item.content.reduce((total, part) => {
    if (!part || typeof part !== "object" || (part as { type?: string }).type !== "output_text") {
      return total;
    }
    const text = (part as { text?: unknown }).text;
    return total + (typeof text === "string" ? text.length : 0);
  }, 0);
}

/**
 * Return the *real* user prompt text for a typed user message, else null. Codex
 * injects synthetic user turns before each real one (`<environment_context>`,
 * `<permissions…>`, etc.) — all `<…>`-wrapped — which would otherwise become the
 * session's title/first prompt. Skip them, mirroring the Claude source and the
 * Codex transcript reader.
 */
function userPromptText(item: ResponseItem): string | null {
  if (item.type !== "message" || item.role !== "user") return null;
  const c = item.content;
  const real = (t: string): string | null => {
    const s = visiblePromptText(t).trim();
    return s !== "" && !s.startsWith("<") ? s : null;
  };
  if (typeof c === "string") return real(c);
  if (Array.isArray(c)) {
    for (const b of c) {
      if (!b || typeof b !== "object") continue;
      const block = b as { type?: string; text?: string };
      if (block.type === "input_text" && block.text) {
        const t = real(block.text);
        if (t) return t;
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

interface CodexSessionState {
  session: RawSession;
  previousTs: number | null;
  activeTurn: ActiveTurn | null;
  hasSessionMetaId: boolean;
  subagent: boolean;
  skipSubagentContent: boolean;
}

function createCodexState(file: string, skipSubagentContent = false): CodexSessionState {
  return {
    session: emptyCodexSession(file),
    previousTs: null,
    activeTurn: null,
    hasSessionMetaId: false,
    subagent: false,
    skipSubagentContent,
  };
}

function syncCodexActive(state: CodexSessionState): void {
  if (state.activeTurn) {
    state.session.active = true;
    state.session.activeStartedAt = state.activeTurn.startedAt;
    state.session.activeTurnId = state.activeTurn.turnId;
  } else {
    state.session.active = undefined;
    state.session.activeStartedAt = undefined;
    state.session.activeTurnId = undefined;
  }
}

function appendCodexLine(state: CodexSessionState, line: string): void {
  if (state.subagent && state.skipSubagentContent) return;
  let obj: RolloutLine;
  try {
    obj = JSON.parse(line) as RolloutLine;
  } catch {
    return;
  }
  const session = state.session;
  const ts = parseTs(obj.timestamp);
  if (ts !== null) {
    if (session.firstTs === null) session.firstTs = ts;
    session.lastTs = ts;
    if (state.previousTs === null || ts - state.previousTs > VISIT_GAP_MINUTES * 60_000) {
      session.visits += 1;
    }
    state.previousTs = ts;
  }

  let kind = obj.type;
  let item: Payload | undefined = obj.payload;
  if (item === undefined) {
    if (obj.cwd !== undefined && obj.type === undefined) kind = "session_meta";
    else if (obj.type) {
      kind = "response_item";
      item = { type: obj.type, role: obj.role, content: obj.content };
    }
  }

  if (kind === "session_meta") {
    const cwd = item?.cwd ?? obj.cwd;
    if (session.cwd === null && cwd) session.cwd = cwd;
    if (item?.id && !state.hasSessionMetaId) {
      session.sessionId = item.id;
      state.hasSessionMetaId = true;
    }
    state.subagent = item?.thread_source === "subagent" || !!item?.source?.subagent;
  } else if (kind === "turn_context" && item) {
    const model = configValue(item.model);
    const effort = configValue(item.effort);
    const speed = configValue(item.service_tier ?? item.serviceTier);
    if (model || effort || speed) {
      session.runConfig = {
        source: "provider",
        ...(session.runConfig ?? {}),
        ...(ts !== null ? { updatedAt: ts } : {}),
        ...(model ? { model } : {}),
        ...(effort ? { effort } : {}),
        ...(speed ? { speed } : {}),
      };
    }
  } else if (kind === "event_msg" && item) {
    if (item.type === "task_started") {
      state.activeTurn = {
        turnId: item.turn_id ?? null,
        startedAt: secondsToMs(item.started_at) ?? ts,
      };
    } else if (isFinalAnswer(item)) {
      state.activeTurn = null;
    } else if (
      state.activeTurn &&
      item.type &&
      TERMINAL_EVENT_TYPES.has(item.type) &&
      (!state.activeTurn.turnId || !item.turn_id || item.turn_id === state.activeTurn.turnId)
    ) {
      state.activeTurn = null;
    }
  } else if (kind === "response_item" && item) {
    const prompt = userPromptText(item);
    const assistantChars = assistantOutputTextLength(item);
    if (prompt !== null) {
      if (ts !== null) {
        session.userPromptTs?.push(ts);
        session.userPromptActivity?.push({ at: ts, chars: prompt.length });
      }
      session.prompts += 1;
      session.chars += prompt.length;
      if (session.title === null) session.title = snippet(prompt);
      session.lastPrompt = snippet(prompt);
    } else if (item.type && ACTION_ITEM_TYPES.has(item.type)) {
      session.actions += 1;
    }
    if (
      ts !== null &&
      (assistantChars > 0 ||
        (!!item.type && (ACTION_ITEM_TYPES.has(item.type) || item.type.endsWith("_call_output"))))
    ) {
      session.lastAssistantTs = ts;
    }
    if (ts !== null && assistantChars > 0) {
      session.assistantTextActivity?.push({ at: ts, chars: assistantChars });
      session.chars += assistantChars;
    }
    if (isFinalAnswer(item)) state.activeTurn = null;
  }
  syncCodexActive(state);
}

function codexSnapshot(state: CodexSessionState): RawSession {
  const session = state.session;
  if (session.sessionId === null) {
    const match =
      /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/.exec(
        session.path,
      );
    if (match) session.sessionId = match[1] ?? null;
  }
  syncCodexActive(state);
  return session;
}

const codexJsonlParser: IncrementalJsonlParser<CodexSessionState> = {
  create: (file) => createCodexState(file, true),
  append: appendCodexLine,
  snapshot: (state) => (state.subagent ? null : codexSnapshot(state)),
};

/** Codex team-mode workers are execution details of the parent session. */
export function isCodexSubagentTranscript(raw: string): boolean {
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let obj: RolloutLine;
    try {
      obj = JSON.parse(line) as RolloutLine;
    } catch {
      continue;
    }
    if (obj.type !== "session_meta") continue;
    const meta = obj.payload;
    return meta?.thread_source === "subagent" || !!meta?.source?.subagent;
  }
  return false;
}

/** Parse one Codex rollout transcript's text into a normalized session (pure, testable). */
export function parseCodexTranscript(file: string, raw: string): RawSession {
  const state = createCodexState(file);
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim()) appendCodexLine(state, line);
  }
  return codexSnapshot(state);
}

function findJsonl(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name.endsWith(".jsonl")) out.push(full);
    }
  };
  walk(root);
  return out;
}

function emptyCodexSession(file: string): RawSession {
  return {
    path: file,
    vendor: "codex",
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

export class CodexSource implements SessionSource {
  readonly vendor = "codex";

  constructor(
    private readonly sessionsDir: string,
    private readonly cache = new ScanCache(),
    private readonly transcriptIndex?: TranscriptPathWriter,
  ) {}

  scan(): RawSession[] {
    if (!fs.existsSync(this.sessionsDir)) return [];
    const sessions = this.cache.memoizeJsonl(findJsonl(this.sessionsDir), codexJsonlParser);
    this.transcriptIndex?.replaceVendor(this.vendor, sessions);
    return sessions;
  }
}
