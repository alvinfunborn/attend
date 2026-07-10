import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RawSession } from "../src/core/types.js";
import { ScanCache } from "../src/core/vendor/scan-cache.js";

function stub(file: string): RawSession {
  return {
    path: file,
    vendor: "test",
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

describe("ScanCache", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-scan-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("parses once, reuses unchanged, re-parses changed, evicts vanished", () => {
    const a = path.join(dir, "a.jsonl");
    const b = path.join(dir, "b.jsonl");
    fs.writeFileSync(a, "a1");
    fs.writeFileSync(b, "b1");
    const reads: string[] = [];
    const read = (f: string) => {
      reads.push(f);
      return stub(f);
    };
    const cache = new ScanCache();

    expect(cache.memoize([a, b], read).map((s) => s.path)).toEqual([a, b]);
    expect(reads).toEqual([a, b]);

    // Unchanged → served from cache, no re-read.
    expect(cache.memoize([a, b], read).map((s) => s.path)).toEqual([a, b]);
    expect(reads).toEqual([a, b]);

    // Only b changed (size differs) → only b re-read.
    fs.writeFileSync(b, "b2-longer");
    cache.memoize([a, b], read);
    expect(reads).toEqual([a, b, b]);

    // Drop a from the listing → evicted; re-adding forces a fresh read.
    cache.memoize([b], read);
    expect(reads).toEqual([a, b, b]);
    cache.memoize([a, b], read);
    expect(reads).toEqual([a, b, b, a]);
  });

  it("caches a null (skipped) result without re-reading", () => {
    const s = path.join(dir, "sub.jsonl");
    fs.writeFileSync(s, "x");
    const reads: string[] = [];
    const read = (f: string) => {
      reads.push(f);
      return null;
    };
    const cache = new ScanCache();

    expect(cache.memoize([s], read)).toEqual([]);
    expect(cache.memoize([s], read)).toEqual([]);
    expect(reads).toEqual([s]);
  });
});
