import fs from "node:fs";
import path from "node:path";
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
}

function parseTs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function isUserPrompt(item: ResponseItem): boolean {
  if (item.type !== "message" || item.role !== "user") return false;
  const c = item.content;
  if (typeof c === "string") return c.trim() !== "";
  if (Array.isArray(c)) {
    return c.some((b) => {
      if (!b || typeof b !== "object") return false;
      const block = b as { type?: string; text?: string };
      return block.type === "input_text" && !!block.text && block.text.trim() !== "";
    });
  }
  return false;
}

/** Parse one Codex rollout transcript's text into a normalized session (pure, testable). */
export function parseCodexTranscript(file: string, raw: string): RawSession {
  const session: RawSession = {
    path: file,
    vendor: "codex",
    cwd: null,
    firstTs: null,
    lastTs: null,
    prompts: 0,
    actions: 0,
  };
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
    } else if (kind === "response_item" && item) {
      if (isUserPrompt(item)) session.prompts += 1;
      else if (item.type && ACTION_ITEM_TYPES.has(item.type)) session.actions += 1;
    }
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
          cwd: null,
          firstTs: null,
          lastTs: null,
          prompts: 0,
          actions: 0,
        };
      }
    });
  }
}
