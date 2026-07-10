import fs from "node:fs";
import type { RawSession } from "../types.js";

interface CacheEntry {
  mtimeMs: number;
  size: number;
  value: RawSession | null;
}

/**
 * Per-source parse cache keyed by file path + (mtime, size).
 *
 * The scan pipeline re-lists its transcript dir on every refresh, but reading +
 * `JSON.parse`-ing every `.jsonl` line each time is what makes the periodic
 * dashboard scan expensive (near-1.8 GB of transcript on a busy machine, CPU
 * dominated by parse + GC). A transcript is immutable given its (mtime, size), so
 * we memoize the parsed `RawSession`: `memoize()` still `stat`s every file (cheap
 * — one syscall) but only calls `read()` for files whose (mtime, size) changed
 * since the last scan. Steady-state cost drops to the directory walk + stats.
 *
 * Each call rebuilds the index from the passed file list, so entries for files
 * that vanished (deleted / rotated out of scope) are evicted automatically. A
 * `read()` returning `null` (e.g. a Codex subagent transcript we intentionally
 * skip) is cached too, so the skip decision isn't recomputed every scan.
 *
 * Lives in `core/vendor/` and holds no server state — the invariant that keeps
 * `core/` unit-testable (CLAUDE.md).
 */
export class ScanCache {
  private entries = new Map<string, CacheEntry>();

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
}
