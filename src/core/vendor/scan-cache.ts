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
  state: State;
  value: RawSession | null;
}

export interface IncrementalJsonlParser<State> {
  create(file: string): State;
  append(state: State, line: string): void;
  snapshot(state: State, file: string, mtimeMs: number): RawSession | null;
}

const READ_CHUNK_BYTES = 256 * 1024;
const CHECKPOINT_BYTES = 128;

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
): number {
  let fd: number | null = null;
  let readPosition = start;
  let processedOffset = start;
  let pending = Buffer.alloc(0);
  try {
    fd = fs.openSync(file, "r");
    while (readPosition < end) {
      const wanted = Math.min(READ_CHUNK_BYTES, end - readPosition);
      const chunk = Buffer.allocUnsafe(wanted);
      const count = fs.readSync(fd, chunk, 0, wanted, readPosition);
      if (count === 0) break;
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
    return processedOffset;
  } catch {
    return start;
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

  /**
   * Return `read(file)` for each file, reusing the previous result when the
   * file's (mtime, size) is unchanged. `read` owns all vendor specifics (read,
   * parse, skip, error placeholder); this cache only decides read-vs-reuse.
   */
  memoize(files: string[], read: (file: string) => RawSession | null): RawSession[] {
    const next = new Map<string, CacheEntry>();
    const out: RawSession[] = [];
    for (const file of files) {
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
      const value =
        prev && prev.mtimeMs === mtimeMs && prev.size === size ? prev.value : read(file);
      next.set(file, { mtimeMs, size, value });
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
        next.set(file, previous);
        if (previous.value) out.push(previous.value);
        continue;
      }

      const canAppend =
        !!previous &&
        sameFile(previous, stat) &&
        stat.size > previous.size &&
        stat.size >= previous.offset &&
        checkpointMatches(file, previous);
      const state = canAppend && previous ? previous.state : parser.create(file);
      const start = canAppend && previous ? previous.offset : 0;
      const offset = appendJsonl(file, start, stat.size, state, parser.append);
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
        value,
      };
      next.set(file, entry);
      if (value) out.push(value);
    }
    this.jsonlEntries = next;
    return out;
  }
}
