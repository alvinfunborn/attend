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

interface RolloutLine {
  timestamp?: string;
  type?: string;
  payload?: ResponseItem & { cwd?: string };
  // tolerate bare (pre-RolloutLine) records that omit the wrapper
  cwd?: string;
  role?: string;
  content?: unknown;
}

interface ResponseItem {
  type?: string;
  role?: string;
  content?: unknown;
  cwd?: string;
  id?: string;
}

function parseTs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/** Return the user prompt text if this response item is a typed user message, else null. */
function userPromptText(item: ResponseItem): string | null {
  if (item.type !== "message" || item.role !== "user") return null;
  const c = item.content;
  if (typeof c === "string") return c.trim() !== "" ? c.trim() : null;
  if (Array.isArray(c)) {
    for (const b of c) {
      if (!b || typeof b !== "object") continue;
      const block = b as { type?: string; text?: string };
      if (block.type === "input_text" && block.text && block.text.trim() !== "") {
        return block.text.trim();
      }
    }
  }
  return null;
}

function snippet(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 79)}…` : oneLine;
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
    let item: ResponseItem | undefined = obj.payload;
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
    }
  }
  // Fallback: rollout filenames embed the session UUID (rollout-<ts>-<uuid>.jsonl).
  if (session.sessionId === null) {
    const m = /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/.exec(
      file,
    );
    if (m) session.sessionId = m[1] ?? null;
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
    return findJsonl(this.sessionsDir).map((f) => {
      try {
        return parseCodexTranscript(f, fs.readFileSync(f, "utf-8"));
      } catch {
        return {
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
        };
      }
    });
  }
}
