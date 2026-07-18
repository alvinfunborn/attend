import fs from "node:fs";
import type { RawSession } from "../core/types.js";
import { readCodexTranscript } from "./codex/transcript.js";
import { readCursorTranscript } from "./cursor/transcript.js";
import { parseSearchQuery } from "./search-query.js";
import { type TranscriptMsg, readClaudeTranscript } from "./transcript.js";

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
  bytes: number;
}

const transcriptSearchCache = new Map<string, CacheEntry>();
const SEARCH_CACHE_MAX_ENTRIES = 256;
const SEARCH_CACHE_MAX_BYTES = 32 * 1024 * 1024;
let transcriptSearchCacheBytes = 0;

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function chunksFromMessages(messages: TranscriptMsg[]): SearchHit[] {
  const chunks: SearchHit[] = [];
  for (const msg of messages) {
    const text = compact(msg.text);
    if (text) chunks.push({ role: msg.role, text });
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
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
    transcriptSearchCache.delete(session.path);
    transcriptSearchCache.set(session.path, cached);
    return cached.chunks;
  }
  if (cached) {
    transcriptSearchCache.delete(session.path);
    transcriptSearchCacheBytes -= cached.bytes;
  }
  const read =
    session.vendor === "codex"
      ? readCodexTranscript
      : session.vendor === "cursor"
        ? readCursorTranscript
        : readClaudeTranscript;
  const chunks = chunksFromMessages(read(session.path, Number.POSITIVE_INFINITY));
  const bytes = chunks.reduce((total, chunk) => total + Buffer.byteLength(chunk.text), 0);
  transcriptSearchCache.set(session.path, { mtimeMs: st.mtimeMs, size: st.size, chunks, bytes });
  transcriptSearchCacheBytes += bytes;
  while (
    transcriptSearchCache.size > SEARCH_CACHE_MAX_ENTRIES ||
    transcriptSearchCacheBytes > SEARCH_CACHE_MAX_BYTES
  ) {
    const oldest = transcriptSearchCache.entries().next().value as [string, CacheEntry] | undefined;
    if (!oldest) break;
    transcriptSearchCache.delete(oldest[0]);
    transcriptSearchCacheBytes -= oldest[1].bytes;
  }
  return chunks;
}

function snippet(text: string, matcher: RegExp | undefined): string {
  const idx = matcher ? text.search(matcher) : -1;
  if (idx < 0) return text.length > 180 ? `${text.slice(0, 179)}...` : text;
  const start = Math.max(0, idx - 70);
  const end = Math.min(text.length, idx + 90);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

export function searchSessions(
  sessions: RawSession[],
  query: string,
  opts: { maxResults?: number; maxHitsPerSession?: number } = {},
): SessionSearchResult[] {
  const parsed = parseSearchQuery(query.trim());
  if (!parsed.clauses.length) return [];
  const maxResults = opts.maxResults ?? 50;
  const maxHitsPerSession = opts.maxHitsPerSession ?? 3;
  const out: SessionSearchResult[] = [];
  for (const session of sessions) {
    if (out.length >= maxResults) break;
    const hits: SearchHit[] = [];
    let count = 0;
    const chunks = readChunks(session);
    const searchable = chunks.map((chunk) => chunk.text).join("\n");
    if (!parsed.test(searchable)) continue;
    const positive = parsed.matchingClauses(searchable).filter((clause) => !clause.exclude);
    for (const chunk of chunks) {
      const matcher = positive.find((clause) => clause.regex.test(chunk.text))?.regex;
      if (positive.length && !matcher) continue;
      count += 1;
      if (hits.length < maxHitsPerSession) {
        hits.push({ role: chunk.role, text: snippet(chunk.text, matcher) });
      }
    }
    if (!positive.length) count = Math.max(1, count);
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
