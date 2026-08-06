import fs from "node:fs";
import type { RawSession } from "../types.js";

interface CacheEntry {
  mtimeMs: number;
  size: number;
  value: RawSession | null;
}

interface JsonlCacheEntry<State> {
  dev: number;
  ino: number;
  mtimeMs: number;
  size: number;
  offset: number;
  checkpoint: Buffer;
  /**
   * Live vendor parser state. It is absent immediately after a disk restore;
   * `persistedState` can recreate it when the parser supports checkpoints.
   */
  state?: State;
  /** JSON-safe parser checkpoint retained even when the live state has not yet
   *  been restored in this process. */
  persistedState?: unknown;
  value: RawSession | null;
}

/**
 * On-disk form of a {@link ScanCache}. Holds only the (metadata + parsed
 * snapshot + JSON-safe parser checkpoint) needed to continue across a restart.
 * Buffers are base64. Bump `v` whenever the shape changes so stale files are
 * ignored rather than misread.
 */
export interface PersistedScanCache {
  v: 3;
  entries: Array<[string, { mtimeMs: number; size: number; value: RawSession | null }]>;
  jsonl: Array<
    [
      string,
      {
        dev: number;
        ino: number;
        mtimeMs: number;
        size: number;
        offset: number;
        checkpoint: string;
        state?: unknown;
        value: RawSession | null;
      },
    ]
  >;
}

interface LegacyPersistedScanCache {
  v: 2;
  entries: PersistedScanCache["entries"];
  jsonl: Array<[string, Omit<PersistedScanCache["jsonl"][number][1], "state">]>;
}

const PERSIST_VERSION = 3 as const;

export interface IncrementalJsonlParser<State> {
  create(file: string): State;
  /** Restore the minimal aggregate state needed to continue from a persisted
   *  byte offset. Returning null safely rebuilds the file from byte zero. */
  restore?(file: string, checkpoint: unknown): State | null;
  /** Return a JSON-safe checkpoint. It is versioned by the enclosing ScanCache. */
  serialize?(state: State): unknown;
  append(state: State, line: string): void;
  snapshot(state: State, file: string, mtimeMs: number): RawSession | null;
}

export interface ScanCacheMetrics {
  filesSeen: number;
  cacheHits: number;
  parsedFiles: number;
  parsedBytes: number;
}

const READ_CHUNK_BYTES = 256 * 1024;
const CHECKPOINT_BYTES = 128;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isPersistedSession(value: unknown): value is RawSession | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<RawSession>;
  return (
    typeof session.path === "string" &&
    typeof session.vendor === "string" &&
    isNullableString(session.sessionId) &&
    isNullableString(session.title) &&
    isNullableString(session.lastPrompt) &&
    isFiniteNumber(session.lastTurnChars) &&
    isFiniteNumber(session.chars) &&
    isNullableString(session.cwd) &&
    isNullableNumber(session.firstTs) &&
    isNullableNumber(session.lastTs) &&
    isFiniteNumber(session.prompts) &&
    isFiniteNumber(session.actions) &&
    isFiniteNumber(session.visits)
  );
}

function decodeCheckpoint(value: unknown, offset: number): Buffer | null {
  if (typeof value !== "string") return null;
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== Math.min(CHECKPOINT_BYTES, offset)) return null;
  return decoded.toString("base64") === value ? decoded : null;
}

function sameFile(previous: JsonlCacheEntry<unknown>, current: fs.Stats): boolean {
  if (previous.dev !== current.dev) return false;
  // Some platforms/filesystems report inode 0. Size + checkpoint validation is
  // still safe there, so only enforce inode identity when both sides expose it.
  return previous.ino === 0 || current.ino === 0 || previous.ino === current.ino;
}

function readRange(file: string, start: number, length: number): Buffer | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(file, "r");
    const out = Buffer.allocUnsafe(length);
    let read = 0;
    while (read < length) {
      const count = fs.readSync(fd, out, read, length - read, start + read);
      if (count === 0) break;
      read += count;
    }
    return read === length ? out : out.subarray(0, read);
  } catch {
    return null;
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

function checkpoint(file: string, offset: number): Buffer | null {
  const length = Math.min(CHECKPOINT_BYTES, offset);
  return length === 0 ? Buffer.alloc(0) : readRange(file, offset - length, length);
}

function checkpointMatches(file: string, entry: JsonlCacheEntry<unknown>): boolean {
  const current = checkpoint(file, entry.offset);
  return current?.equals(entry.checkpoint) === true;
}

/**
 * Feed complete JSONL records from [start, end) without materializing the whole
 * file. A syntactically incomplete final record is left before the returned
 * offset and retried after the writer appends the rest of it.
 */
function appendJsonl<State>(
  file: string,
  start: number,
  end: number,
  state: State,
  append: (state: State, line: string) => void,
): { offset: number; bytesRead: number } {
  let fd: number | null = null;
  let readPosition = start;
  let processedOffset = start;
  let bytesRead = 0;
  let pending = Buffer.alloc(0);
  try {
    fd = fs.openSync(file, "r");
    while (readPosition < end) {
      const wanted = Math.min(READ_CHUNK_BYTES, end - readPosition);
      const chunk = Buffer.allocUnsafe(wanted);
      const count = fs.readSync(fd, chunk, 0, wanted, readPosition);
      if (count === 0) break;
      bytesRead += count;
      readPosition += count;
      const data = pending.length
        ? Buffer.concat([pending, chunk.subarray(0, count)])
        : chunk.subarray(0, count);
      let cursor = 0;
      for (;;) {
        const newline = data.indexOf(0x0a, cursor);
        if (newline < 0) break;
        let line = data.subarray(cursor, newline);
        if (line.at(-1) === 0x0d) line = line.subarray(0, -1);
        const text = line.toString("utf8");
        if (text.trim()) {
          try {
            append(state, text);
          } catch {
            // One malformed provider record must not invalidate the rest of a
            // transcript. It is complete (newline-terminated), so skip it.
          }
        }
        cursor = newline + 1;
      }
      pending = Buffer.from(data.subarray(cursor));
      processedOffset = readPosition - pending.length;
    }
    if (pending.length) {
      const text = pending.toString("utf8");
      try {
        // A writer may be between writes. Only consume a non-newline tail once
        // it is a complete JSON value; otherwise retry it on the next scan.
        if (text.trim()) {
          JSON.parse(text);
          append(state, text);
        }
        processedOffset = readPosition;
      } catch {
        // Keep the offset before the partial record.
      }
    }
    return { offset: processedOffset, bytesRead };
  } catch {
    return { offset: start, bytesRead };
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

/**
 * Per-source parse cache keyed by file path + file metadata.
 *
 * The scan pipeline re-lists its transcript dir on every refresh, but reading +
 * `JSON.parse`-ing every `.jsonl` line each time is what makes the periodic
 * dashboard scan expensive (near-1.8 GB of transcript on a busy machine, CPU
 * dominated by parse + GC). A transcript is immutable given its (mtime, size), so
 * `memoizeJsonl()` additionally retains a vendor parser state + byte offset, so
 * an append only parses the newly written records. Initial reads are chunked to
 * avoid materializing a multi-hundred-MB rollout as one string. Truncation,
 * replacement, and in-place rewrites rebuild from byte zero.
 *
 * Each call rebuilds the index from the passed file list, so entries for files
 * that vanished (deleted / rotated out of scope) are evicted automatically. A
 * null snapshot (e.g. a Codex subagent transcript we intentionally skip) is
 * cached too, so the skip decision isn't recomputed every scan.
 *
 * Lives in `core/vendor/` and holds no server state — the invariant that keeps
 * `core/` unit-testable (CLAUDE.md).
 */
export class ScanCache {
  private entries = new Map<string, CacheEntry>();
  private jsonlEntries = new Map<string, JsonlCacheEntry<unknown>>();
  private readonly counters: ScanCacheMetrics = {
    filesSeen: 0,
    cacheHits: 0,
    parsedFiles: 0,
    parsedBytes: 0,
  };

  metrics(): ScanCacheMetrics {
    return { ...this.counters };
  }

  /**
   * Return `read(file)` for each file, reusing the previous result when the
   * file's (mtime, size) is unchanged. `read` owns all vendor specifics (read,
   * parse, skip, error placeholder); this cache only decides read-vs-reuse.
   */
  memoize(files: string[], read: (file: string) => RawSession | null): RawSession[] {
    const next = new Map<string, CacheEntry>();
    const out: RawSession[] = [];
    for (const file of files) {
      this.counters.filesSeen += 1;
      let mtimeMs = 0;
      let size = -1;
      try {
        const st = fs.statSync(file);
        mtimeMs = st.mtimeMs;
        size = st.size;
      } catch {
        // Vanished/unreadable between listing and stat: fall through so `read`
        // (which will hit its own read error) can decide, and don't cache it.
      }
      const prev = size >= 0 ? this.entries.get(file) : undefined;
      const hit = !!prev && prev.mtimeMs === mtimeMs && prev.size === size;
      const value = hit ? prev.value : read(file);
      if (hit) this.counters.cacheHits += 1;
      else {
        this.counters.parsedFiles += 1;
        this.counters.parsedBytes += Math.max(0, size);
      }
      if (size >= 0) next.set(file, { mtimeMs, size, value });
      if (value) out.push(value);
    }
    this.entries = next;
    return out;
  }

  /**
   * Incrementally parse append-only JSONL files. Unchanged files reuse their
   * snapshot; growing files feed only newly appended complete records. Truncate,
   * replace, or in-place rewrite falls back to a fresh parser state.
   */
  memoizeJsonl<State>(files: string[], parser: IncrementalJsonlParser<State>): RawSession[] {
    const next = new Map<string, JsonlCacheEntry<unknown>>();
    const out: RawSession[] = [];
    for (const file of files) {
      this.counters.filesSeen += 1;
      let stat: fs.Stats;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      const previous = this.jsonlEntries.get(file) as JsonlCacheEntry<State> | undefined;
      if (
        previous &&
        previous.mtimeMs === stat.mtimeMs &&
        previous.size === stat.size &&
        sameFile(previous, stat)
      ) {
        this.counters.cacheHits += 1;
        next.set(file, previous);
        if (previous.value) out.push(previous.value);
        continue;
      }

      const restoredState =
        previous?.state ??
        (previous?.persistedState !== undefined
          ? (parser.restore?.(file, previous.persistedState) ?? undefined)
          : undefined);
      const canAppend =
        !!previous &&
        restoredState !== undefined &&
        sameFile(previous, stat) &&
        stat.size > previous.size &&
        stat.size >= previous.offset &&
        checkpointMatches(file, previous);
      const state: State =
        canAppend && restoredState !== undefined ? restoredState : parser.create(file);
      const start = canAppend && previous ? previous.offset : 0;
      const parsed = appendJsonl(file, start, stat.size, state, parser.append);
      const offset = parsed.offset;
      this.counters.parsedFiles += 1;
      this.counters.parsedBytes += parsed.bytesRead;
      const value = parser.snapshot(state, file, stat.mtimeMs);
      const mark = checkpoint(file, offset) ?? Buffer.alloc(0);
      const entry: JsonlCacheEntry<State> = {
        dev: stat.dev,
        ino: stat.ino,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        offset,
        checkpoint: mark,
        state,
        persistedState: parser.serialize?.(state),
        value,
      };
      next.set(file, entry);
      if (value) out.push(value);
    }
    this.jsonlEntries = next;
    return out;
  }

  /**
   * Serialize to a plain, JSON-safe snapshot for cross-restart reuse. Parsers
   * that expose `serialize`/`restore` can continue a grown file from the saved
   * offset; other parsers safely rebuild that file. Pure (no fs), so the worker
   * layer owns where it lands.
   */
  toPersistable(): PersistedScanCache {
    return {
      v: PERSIST_VERSION,
      entries: [...this.entries].map(([file, e]) => [
        file,
        { mtimeMs: e.mtimeMs, size: e.size, value: e.value },
      ]),
      jsonl: [...this.jsonlEntries].map(([file, e]) => [
        file,
        {
          dev: e.dev,
          ino: e.ino,
          mtimeMs: e.mtimeMs,
          size: e.size,
          offset: e.offset,
          checkpoint: e.checkpoint.toString("base64"),
          ...(e.persistedState !== undefined ? { state: e.persistedState } : {}),
          value: e.value,
        },
      ]),
    };
  }

  /**
   * Repopulate from {@link toPersistable} output. Returns whether the complete
   * snapshot was accepted, so callers do not mistake an old/corrupt cache file
   * for a warm startup.
   */
  hydrate(data: unknown): boolean {
    if (!data || typeof data !== "object") return false;
    const snapshot = data as Partial<PersistedScanCache | LegacyPersistedScanCache>;
    if (
      (snapshot.v !== PERSIST_VERSION && snapshot.v !== 2) ||
      !Array.isArray(snapshot.entries) ||
      !Array.isArray(snapshot.jsonl)
    )
      return false;

    const entries = new Map<string, CacheEntry>();
    for (const item of snapshot.entries as unknown[]) {
      if (!Array.isArray(item) || item.length !== 2) return false;
      const [file, rawEntry] = item;
      if (!rawEntry || typeof rawEntry !== "object") return false;
      const entry = rawEntry as Record<string, unknown>;
      if (
        typeof file !== "string" ||
        !isFiniteNumber(entry.mtimeMs) ||
        !isFiniteNumber(entry.size) ||
        entry.size < 0 ||
        !isPersistedSession(entry.value)
      )
        return false;
      entries.set(file, {
        mtimeMs: entry.mtimeMs,
        size: entry.size,
        value: entry.value,
      });
    }

    const jsonlEntries = new Map<string, JsonlCacheEntry<unknown>>();
    for (const item of snapshot.jsonl as unknown[]) {
      if (!Array.isArray(item) || item.length !== 2) return false;
      const [file, rawEntry] = item;
      if (!rawEntry || typeof rawEntry !== "object") return false;
      const entry = rawEntry as Record<string, unknown>;
      if (
        typeof file !== "string" ||
        !isFiniteNumber(entry.dev) ||
        entry.dev < 0 ||
        !isFiniteNumber(entry.ino) ||
        entry.ino < 0 ||
        !isFiniteNumber(entry.mtimeMs) ||
        !isFiniteNumber(entry.size) ||
        entry.size < 0 ||
        !isFiniteNumber(entry.offset) ||
        entry.offset < 0 ||
        entry.offset > entry.size ||
        !isPersistedSession(entry.value)
      )
        return false;
      const mark = decodeCheckpoint(entry.checkpoint, entry.offset);
      if (!mark) return false;
      jsonlEntries.set(file, {
        dev: entry.dev,
        ino: entry.ino,
        mtimeMs: entry.mtimeMs,
        size: entry.size,
        offset: entry.offset,
        checkpoint: mark,
        ...(Object.hasOwn(entry, "state") ? { persistedState: entry.state } : {}),
        value: entry.value,
      });
    }

    this.entries = entries;
    this.jsonlEntries = jsonlEntries;
    return true;
  }
}
