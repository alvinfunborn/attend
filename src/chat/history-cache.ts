import { createHash } from "node:crypto";
import type fs from "node:fs";
import { open, stat } from "node:fs/promises";
import { parseAntigravityTranscript } from "./antigravity/transcript.js";
import { parseCodexTranscriptMessages } from "./codex/transcript.js";
import { parseCopilotTranscript } from "./copilot/transcript.js";
import { parseCursorTranscript } from "./cursor/transcript.js";
import { type ToolCall, type TranscriptMsg, parseClaudeTranscriptMessages } from "./transcript.js";

const INITIAL_TAIL_BYTES = 2 * 1024 * 1024;
const MAX_TAIL_BYTES = 32 * 1024 * 1024;
const HISTORY_OVERSCAN_MESSAGES = 24;
const DEFAULT_HISTORY_LIMIT = 200;
const DEFAULT_MAX_ENTRIES = 64;
const DEFAULT_MAX_CACHE_BYTES = 48 * 1024 * 1024;

interface FileIdentity {
  dev: number;
  ino: number;
  mtimeMs: number;
  size: number;
}

export interface TranscriptHistorySnapshot {
  messages: TranscriptMsg[];
  version: string;
  bytesRead: number;
  truncatedBefore: boolean;
}

export interface TranscriptHistoryReader {
  read(file: string, vendor?: string, limit?: number): Promise<TranscriptHistorySnapshot>;
  version?(file: string): Promise<string | null>;
  close?(): void;
}

interface CacheEntry extends TranscriptHistorySnapshot {
  identity: FileIdentity;
  cost: number;
}

function identityOf(value: fs.Stats): FileIdentity {
  return {
    dev: value.dev,
    ino: value.ino,
    mtimeMs: value.mtimeMs,
    size: value.size,
  };
}

function sameIdentity(a: FileIdentity, b: FileIdentity): boolean {
  return (
    a.dev === b.dev &&
    (a.ino === 0 || b.ino === 0 || a.ino === b.ino) &&
    a.mtimeMs === b.mtimeMs &&
    a.size === b.size
  );
}

function identityVersion(identity: FileIdentity): string {
  return [identity.dev, identity.ino, identity.mtimeMs, identity.size].join(":");
}

function parseHistory(
  vendor: string | undefined,
  raw: string,
  limit: number,
  startsAtFileBeginning: boolean,
): TranscriptMsg[] {
  if (vendor === "codex") return parseCodexTranscriptMessages(raw, limit, startsAtFileBeginning);
  if (vendor === "cursor") return parseCursorTranscript(raw, limit);
  if (vendor === "antigravity") return parseAntigravityTranscript(raw, limit);
  if (vendor === "copilot") return parseCopilotTranscript(raw, limit);
  return parseClaudeTranscriptMessages(raw, limit);
}

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

function historyId(prefix: "m" | "t", value: unknown): string {
  return `${prefix}_${createHash("sha256").update(stableJson(value)).digest("base64url").slice(0, 22)}`;
}

function withHistoryMetadata(messages: TranscriptMsg[]): TranscriptMsg[] {
  let messageOrdinal = 0;
  let toolOrdinal = 0;
  const duplicateMessages = new Map<string, number>();
  const duplicateTools = new Map<string, number>();
  return messages.map((message, historyIndex) => {
    const messageBase = historyId("m", [
      message.role,
      message.ts ?? null,
      message.text,
      message.memoryCitations ?? null,
      message.text ? null : (message.tools ?? []).map((tool) => [tool.id, tool.name, tool.input]),
    ]);
    const messageDuplicate = duplicateMessages.get(messageBase) ?? 0;
    duplicateMessages.set(messageBase, messageDuplicate + 1);
    const messageHistoryId = messageDuplicate ? `${messageBase}.${messageDuplicate}` : messageBase;
    return {
      ...message,
      historyId: messageHistoryId,
      historyIndex,
      ...(message.text ? { historyOrdinal: messageOrdinal++ } : {}),
      tools: (message.tools ?? []).map((tool, toolIndex): ToolCall => {
        const toolBase = historyId("t", [
          tool.id ?? null,
          messageHistoryId,
          toolIndex,
          tool.name,
          tool.input,
        ]);
        const toolDuplicate = duplicateTools.get(toolBase) ?? 0;
        duplicateTools.set(toolBase, toolDuplicate + 1);
        return {
          ...tool,
          historyId: toolDuplicate ? `${toolBase}.${toolDuplicate}` : toolBase,
          historyOrdinal: toolOrdinal++,
          historyIndex,
        };
      }),
    };
  });
}

function snapshotCost(messages: TranscriptMsg[]): number {
  let chars = 0;
  for (const message of messages) {
    chars += message.text.length;
    for (const citation of message.memoryCitations?.entries ?? []) {
      chars += citation.path.length + citation.note.length + 32;
    }
    for (const rolloutId of message.memoryCitations?.rolloutIds ?? []) chars += rolloutId.length;
    for (const tool of message.tools ?? []) {
      try {
        chars += JSON.stringify(tool).length;
      } catch {
        chars += 1_024;
      }
    }
  }
  // JS strings are commonly two bytes per code unit; include object overhead.
  return Math.max(1_024, chars * 2 + messages.length * 256);
}

async function readRange(
  handle: Awaited<ReturnType<typeof open>>,
  start: number,
  length: number,
): Promise<Buffer> {
  const buffer = Buffer.allocUnsafe(length);
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await handle.read(buffer, offset, length - offset, start + offset);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  return offset === length ? buffer : buffer.subarray(0, offset);
}

function alignedTail(buffer: Buffer, startsAt: number): string {
  if (startsAt === 0) return buffer.toString("utf8");
  const newline = buffer.indexOf(0x0a);
  return newline < 0 ? "" : buffer.subarray(newline + 1).toString("utf8");
}

async function yieldEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function readTail(
  file: string,
  vendor: string | undefined,
  identity: FileIdentity,
  limit: number,
  maxTailBytes: number,
): Promise<Omit<TranscriptHistorySnapshot, "version">> {
  const parseLimit = limit + HISTORY_OVERSCAN_MESSAGES;
  const tailLimit = Math.max(1, maxTailBytes);
  const handle = await open(file, "r");
  try {
    let windowBytes = Math.min(identity.size, INITIAL_TAIL_BYTES, tailLimit);
    let startsAt = identity.size - windowBytes;
    let buffer = await readRange(handle, startsAt, windowBytes);
    let messages: TranscriptMsg[] = [];
    for (;;) {
      const raw = alignedTail(buffer, startsAt);
      messages = parseHistory(vendor, raw, parseLimit, startsAt === 0);
      if (messages.length >= parseLimit || startsAt === 0) break;

      const nextWindowBytes = Math.min(
        identity.size,
        tailLimit,
        Math.max(windowBytes * 2, windowBytes + 1),
      );
      if (nextWindowBytes === windowBytes) break;
      const nextStart = identity.size - nextWindowBytes;
      const prefix = await readRange(handle, nextStart, startsAt - nextStart);
      buffer = Buffer.concat([prefix, buffer]);
      startsAt = nextStart;
      windowBytes = nextWindowBytes;
      // Very large histories should not starve the unified SSE stream while
      // their tail is being expanded.
      await yieldEventLoop();
    }
    return {
      messages: withHistoryMetadata(messages.slice(-limit)),
      bytesRead: buffer.length,
      truncatedBefore: startsAt > 0,
    };
  } finally {
    await handle.close();
  }
}

/**
 * File-versioned LRU for display history.
 *
 * Unlike the old readers, a cold lookup starts at EOF and expands backward only
 * until the bounded visible tail is complete. Reopens and CommentPanel reads
 * then reuse the same parsed snapshot until the file identity changes.
 */
export class TranscriptHistoryCache implements TranscriptHistoryReader {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<TranscriptHistorySnapshot>>();
  private cacheBytes = 0;

  constructor(
    private readonly maxEntries = DEFAULT_MAX_ENTRIES,
    private readonly maxCacheBytes = DEFAULT_MAX_CACHE_BYTES,
    private readonly maxTailBytes = MAX_TAIL_BYTES,
  ) {}

  async version(file: string): Promise<string | null> {
    try {
      return identityVersion(identityOf(await stat(file)));
    } catch {
      return null;
    }
  }

  async read(
    file: string,
    vendor = "claude",
    limit = DEFAULT_HISTORY_LIMIT,
  ): Promise<TranscriptHistorySnapshot> {
    const boundedLimit = Math.max(1, Math.min(DEFAULT_HISTORY_LIMIT, Math.floor(limit) || 1));
    const currentIdentity = identityOf(await stat(file));
    const key = `${vendor}\u0000${file}\u0000${boundedLimit}`;
    const cached = this.entries.get(key);
    if (cached && sameIdentity(cached.identity, currentIdentity)) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return cached;
    }

    const inflightKey = `${key}\u0000${identityVersion(currentIdentity)}`;
    const pending = this.inflight.get(inflightKey);
    if (pending) return pending;
    const load = this.load(file, vendor, boundedLimit, currentIdentity, true).finally(() => {
      if (this.inflight.get(inflightKey) === load) this.inflight.delete(inflightKey);
    });
    this.inflight.set(inflightKey, load);
    return load;
  }

  private async load(
    file: string,
    vendor: string,
    limit: number,
    identity: FileIdentity,
    retryOnAppend: boolean,
  ): Promise<TranscriptHistorySnapshot> {
    const tail = await readTail(file, vendor, identity, limit, this.maxTailBytes);
    const after = identityOf(await stat(file));
    if (retryOnAppend && !sameIdentity(identity, after)) {
      return this.load(file, vendor, limit, after, false);
    }
    // If a very hot file changes again during the single retry, keep the
    // snapshot labeled with the identity it was actually read against. The
    // next lookup will miss and refresh; it must never cache older bytes under
    // the newer file version.
    const snapshotIdentity = sameIdentity(identity, after) ? after : identity;
    const snapshot: CacheEntry = {
      ...tail,
      version: identityVersion(snapshotIdentity),
      identity: snapshotIdentity,
      cost: snapshotCost(tail.messages),
    };
    const key = `${vendor}\u0000${file}\u0000${limit}`;
    const previous = this.entries.get(key);
    if (previous) this.cacheBytes -= previous.cost;
    this.entries.delete(key);
    this.entries.set(key, snapshot);
    this.cacheBytes += snapshot.cost;
    while (this.entries.size > this.maxEntries || this.cacheBytes > this.maxCacheBytes) {
      const oldest = this.entries.entries().next().value as [string, CacheEntry] | undefined;
      if (!oldest) break;
      this.entries.delete(oldest[0]);
      this.cacheBytes -= oldest[1].cost;
    }
    return snapshot;
  }
}
