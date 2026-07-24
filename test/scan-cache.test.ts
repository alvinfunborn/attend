import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RawSession } from "../src/core/types.js";
import { type IncrementalJsonlParser, ScanCache } from "../src/core/vendor/scan-cache.js";

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

interface LineState {
  file: string;
  values: string[];
}

function incrementalParser(
  created: string[],
  appended: string[],
): IncrementalJsonlParser<LineState> {
  return {
    create(file) {
      created.push(file);
      return { file, values: [] };
    },
    append(state, line) {
      appended.push(line);
      state.values.push(String((JSON.parse(line) as { value: unknown }).value));
    },
    snapshot(state) {
      return { ...stub(state.file), title: state.values.join(",") };
    },
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

  it("feeds only appended JSONL records to an existing parser state", () => {
    const file = path.join(dir, "growing.jsonl");
    fs.writeFileSync(file, JSON.stringify({ value: "one" }));
    const created: string[] = [];
    const appended: string[] = [];
    const cache = new ScanCache();
    const parser = incrementalParser(created, appended);

    expect(cache.memoizeJsonl([file], parser)[0]?.title).toBe("one");
    expect(created).toEqual([file]);
    expect(appended).toHaveLength(1);

    fs.appendFileSync(file, `\n${JSON.stringify({ value: "two" })}`);
    expect(cache.memoizeJsonl([file], parser)[0]?.title).toBe("one,two");
    expect(created).toEqual([file]);
    expect(appended).toHaveLength(2);

    cache.memoizeJsonl([file], parser);
    expect(appended).toHaveLength(2);
  });

  it("waits for an incomplete final record and consumes it after append", () => {
    const file = path.join(dir, "partial.jsonl");
    fs.writeFileSync(file, `${JSON.stringify({ value: "one" })}\n{"value":`);
    const created: string[] = [];
    const appended: string[] = [];
    const cache = new ScanCache();
    const parser = incrementalParser(created, appended);

    expect(cache.memoizeJsonl([file], parser)[0]?.title).toBe("one");
    expect(appended).toHaveLength(1);

    fs.appendFileSync(file, '"two"}\n');
    expect(cache.memoizeJsonl([file], parser)[0]?.title).toBe("one,two");
    expect(created).toEqual([file]);
    expect(appended).toHaveLength(2);
  });

  it("rebuilds state after truncate or an in-place rewrite", () => {
    const file = path.join(dir, "rewritten.jsonl");
    const created: string[] = [];
    const appended: string[] = [];
    const cache = new ScanCache();
    const parser = incrementalParser(created, appended);
    fs.writeFileSync(
      file,
      [JSON.stringify({ value: "old-one" }), JSON.stringify({ value: "old-two" })].join("\n"),
    );
    expect(cache.memoizeJsonl([file], parser)[0]?.title).toBe("old-one,old-two");

    fs.writeFileSync(file, JSON.stringify({ value: "short" }));
    expect(cache.memoizeJsonl([file], parser)[0]?.title).toBe("short");

    fs.writeFileSync(file, JSON.stringify({ value: "replacement-that-is-longer" }));
    expect(cache.memoizeJsonl([file], parser)[0]?.title).toBe("replacement-that-is-longer");
    expect(created).toEqual([file, file, file]);
  });
});
