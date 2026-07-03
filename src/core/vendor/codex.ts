import fs from "node:fs";
import path from "node:path";
import { VISIT_GAP_MINUTES } from "../pattern.js";
import type { RawSession } from "../types.js";
import type { SessionSource } from "./index.js";

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

type Payload = ResponseItem & SessionMeta & EventPayload;

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
    const s = t.trim();
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
  const session: RawSession = {
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
    prompts: 0,
    actions: 0,
    visits: 0,
  };
  const gapMs = VISIT_GAP_MINUTES * 60_000;
  let prevTs: number | null = null;
  let activeTurn: ActiveTurn | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let obj: RolloutLine;
    try {
      obj = JSON.parse(line) as RolloutLine;
    } catch {
      continue;
    }

    const ts = parseTs(obj.timestamp);
    if (ts !== null) {
      if (session.firstTs === null) session.firstTs = ts;
      session.lastTs = ts;
      // A fresh burst (first activity, or resumed after a long idle gap) = a visit.
      if (prevTs === null || ts - prevTs > gapMs) session.visits += 1;
      prevTs = ts;
    }

    // Normalize wrapped vs. bare records into (kind, item).
    let kind = obj.type;
    let item: Payload | undefined = obj.payload;
    if (item === undefined) {
      // bare record: infer kind from its own shape
      if (obj.cwd !== undefined && obj.type === undefined) kind = "session_meta";
      else if (obj.type) {
        kind = "response_item";
        item = { type: obj.type, role: obj.role, content: obj.content };
      }
    }

    if (kind === "session_meta") {
      const cwd = item?.cwd ?? obj.cwd;
      if (session.cwd === null && cwd) session.cwd = cwd;
      if (session.sessionId === null && item?.id) session.sessionId = item.id;
    } else if (kind === "event_msg" && item) {
      if (item.type === "task_started") {
        activeTurn = {
          turnId: item.turn_id ?? null,
          startedAt: secondsToMs(item.started_at) ?? ts,
        };
      } else if (isFinalAnswer(item)) {
        activeTurn = null;
      } else if (
        activeTurn &&
        item.type &&
        TERMINAL_EVENT_TYPES.has(item.type) &&
        (!activeTurn.turnId || !item.turn_id || item.turn_id === activeTurn.turnId)
      ) {
        activeTurn = null;
      }
    } else if (kind === "response_item" && item) {
      const text = userPromptText(item);
      if (text !== null) {
        session.prompts += 1;
        // Only user-prompt chars: Codex assistant output isn't reliably parsed,
        // and we never fabricate vendor data (DESIGN invariant 3).
        session.chars += text.length;
        if (session.title === null) session.title = snippet(text);
        session.lastPrompt = snippet(text);
      } else if (item.type && ACTION_ITEM_TYPES.has(item.type)) {
        session.actions += 1;
      }
      if (isFinalAnswer(item)) activeTurn = null;
    }
  }
  // Fallback: rollout filenames embed the session UUID (rollout-<ts>-<uuid>.jsonl).
  if (session.sessionId === null) {
    const m = /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/.exec(
      file,
    );
    if (m) session.sessionId = m[1] ?? null;
  }
  if (activeTurn) {
    session.active = true;
    session.activeStartedAt = activeTurn.startedAt;
  }
  return session;
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

export class CodexSource implements SessionSource {
  readonly vendor = "codex";

  constructor(private readonly sessionsDir: string) {}

  scan(): RawSession[] {
    if (!fs.existsSync(this.sessionsDir)) return [];
    const sessions: RawSession[] = [];
    for (const f of findJsonl(this.sessionsDir)) {
      try {
        const raw = fs.readFileSync(f, "utf-8");
        if (isCodexSubagentTranscript(raw)) continue;
        sessions.push(parseCodexTranscript(f, raw));
      } catch {
        sessions.push({
          path: f,
          vendor: "codex" as const,
          sessionId: null,
          title: null,
          lastPrompt: null,
          lastTurnChars: 0,
          chars: 0,
          cwd: null,
          firstTs: null,
          lastTs: null,
          prompts: 0,
          actions: 0,
          visits: 0,
        });
      }
    }
    return sessions;
  }
}
