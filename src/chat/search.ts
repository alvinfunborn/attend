import fs from "node:fs";
import type { RawSession } from "../core/types.js";
import { readCodexTranscript } from "./codex/transcript.js";
import { type ToolCall, type TranscriptMsg, readClaudeTranscript } from "./transcript.js";

export interface SearchHit {
  role: "user" | "assistant" | "tool";
  text: string;
}

export interface SessionSearchResult {
  vendor: string;
  sessionId: string | null;
  file: string;
  count: number;
  hits: SearchHit[];
}

interface CacheEntry {
  mtimeMs: number;
  size: number;
  chunks: SearchHit[];
}

const transcriptSearchCache = new Map<string, CacheEntry>();

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stringifyToolValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toolText(tool: ToolCall): string {
  return compact(
    [tool.name, stringifyToolValue(tool.input), tool.result ?? ""].filter(Boolean).join(" "),
  );
}

function chunksFromMessages(messages: TranscriptMsg[]): SearchHit[] {
  const chunks: SearchHit[] = [];
  for (const msg of messages) {
    const text = compact(msg.text);
    if (text) chunks.push({ role: msg.role, text });
    for (const tool of msg.tools) {
      const t = toolText(tool);
      if (t) chunks.push({ role: "tool", text: t });
    }
  }
  return chunks;
}

function readChunks(session: RawSession): SearchHit[] {
  let st: fs.Stats;
  try {
    st = fs.statSync(session.path);
  } catch {
    return [];
  }
  const cached = transcriptSearchCache.get(session.path);
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) return cached.chunks;
  const read = session.vendor === "codex" ? readCodexTranscript : readClaudeTranscript;
  const chunks = chunksFromMessages(read(session.path, Number.POSITIVE_INFINITY));
  transcriptSearchCache.set(session.path, { mtimeMs: st.mtimeMs, size: st.size, chunks });
  return chunks;
}

function snippet(text: string, needle: string): string {
  const hay = text.toLowerCase();
  const idx = hay.indexOf(needle);
  if (idx < 0) return text.length > 180 ? `${text.slice(0, 179)}...` : text;
  const start = Math.max(0, idx - 70);
  const end = Math.min(text.length, idx + needle.length + 90);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

export function searchSessions(
  sessions: RawSession[],
  query: string,
  opts: { maxResults?: number; maxHitsPerSession?: number } = {},
): SessionSearchResult[] {
  const needle = normalizeQuery(query);
  if (!needle) return [];
  const maxResults = opts.maxResults ?? 50;
  const maxHitsPerSession = opts.maxHitsPerSession ?? 3;
  const out: SessionSearchResult[] = [];
  for (const session of sessions) {
    if (out.length >= maxResults) break;
    const hits: SearchHit[] = [];
    let count = 0;
    for (const chunk of readChunks(session)) {
      if (!chunk.text.toLowerCase().includes(needle)) continue;
      count += 1;
      if (hits.length < maxHitsPerSession) {
        hits.push({ role: chunk.role, text: snippet(chunk.text, needle) });
      }
    }
    if (count > 0) {
      out.push({
        vendor: session.vendor,
        sessionId: session.sessionId,
        file: session.path,
        count,
        hits,
      });
    }
  }
  return out;
}
