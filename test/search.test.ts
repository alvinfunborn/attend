import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { PersistentTranscriptSearchIndex } from "../src/chat/search-index.js";
import { parseSearchQuery } from "../src/chat/search-query.js";
import { searchSessions } from "../src/chat/search.js";
import type { RawSession } from "../src/core/types.js";

function session(overrides: Partial<RawSession>): RawSession {
  return {
    path: overrides.path ?? "",
    vendor: overrides.vendor ?? "claude",
    sessionId: overrides.sessionId ?? "s1",
    title: overrides.title ?? null,
    lastPrompt: overrides.lastPrompt ?? null,
    lastTurnChars: overrides.lastTurnChars ?? 0,
    chars: overrides.chars ?? 0,
    cwd: overrides.cwd ?? null,
    firstTs: overrides.firstTs ?? null,
    lastTs: overrides.lastTs ?? null,
    prompts: overrides.prompts ?? 0,
    actions: overrides.actions ?? 0,
    visits: overrides.visits ?? 0,
  };
}

describe("searchSessions", () => {
  it("supports implicit AND, phrases, exclusions, and CloudWatch-style regex", () => {
    const q = parseSearchQuery('cursor "cold start" -indexing %session\\s+id%');
    expect(q.test("Cursor had a cold start and then printed session id")).toBe(true);
    expect(q.test("Cursor had a cold start while indexing, then printed session id")).toBe(false);
    expect(q.test("Cursor start was cold and then printed session id")).toBe(false);
  });

  it("supports OR alternatives with AND precedence inside each branch", () => {
    const q = parseSearchQuery('cursor cold OR codex "fork history"');
    expect(q.test("cursor had a cold startup")).toBe(true);
    expect(q.test("codex restored fork history")).toBe(true);
    expect(q.test("cursor only")).toBe(false);
    expect(() => parseSearchQuery("cursor OR")).toThrow("OR must precede");
  });

  it("rejects malformed and unsafe regex search syntax", () => {
    expect(() => parseSearchQuery('"unfinished')).toThrow("unclosed quote");
    expect(() => parseSearchQuery("%([a]+)+%")).toThrow("groups and backreferences");
  });

  it("indexes Claude text messages, not assistant tool calls or tool results", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-search-"));
    const file = path.join(dir, "claude.jsonl");
    fs.writeFileSync(
      file,
      [
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "text", text: "Natural answer about deployment." },
              { type: "tool_use", id: "t1", name: "Bash", input: { command: "secret-shell" } },
            ],
          },
        }),
        JSON.stringify({
          type: "user",
          message: {
            content: [{ type: "tool_result", tool_use_id: "t1", content: "secret-output" }],
          },
        }),
      ].join("\n"),
    );

    try {
      const sessions = [session({ path: file })];
      expect(searchSessions(sessions, "deployment")).toHaveLength(1);
      expect(searchSessions(sessions, "secret-shell")).toEqual([]);
      expect(searchSessions(sessions, "secret-output")).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("indexes Codex text messages, not shell/edit function call blocks", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-search-"));
    const file = path.join(dir, "codex.jsonl");
    fs.writeFileSync(
      file,
      [
        JSON.stringify({
          type: "response_item",
          payload: {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "Visible answer about release notes." }],
          },
        }),
        JSON.stringify({
          type: "response_item",
          payload: {
            type: "function_call",
            call_id: "call-1",
            name: "exec_command",
            arguments: JSON.stringify({ cmd: "rg hidden-codex-command" }),
          },
        }),
        JSON.stringify({
          type: "response_item",
          payload: {
            type: "function_call_output",
            call_id: "call-1",
            output: "hidden-codex-output",
          },
        }),
      ].join("\n"),
    );

    try {
      const sessions = [session({ path: file, vendor: "codex" })];
      expect(searchSessions(sessions, "release notes")).toHaveLength(1);
      expect(searchSessions(sessions, "hidden-codex-command")).toEqual([]);
      expect(searchSessions(sessions, "hidden-codex-output")).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("matches AND terms across separate visible transcript messages", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-search-and-"));
    const file = path.join(dir, "claude.jsonl");
    fs.writeFileSync(
      file,
      [
        JSON.stringify({ type: "user", message: { content: "cursor startup" } }),
        JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: "cold indexing finished" }] },
        }),
      ].join("\n"),
    );
    try {
      expect(searchSessions([session({ path: file })], "cursor cold")).toHaveLength(1);
      expect(searchSessions([session({ path: file })], "cursor -cold")).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists parsed transcript text and incrementally replaces changed files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-search-index-"));
    const file = path.join(dir, "claude.jsonl");
    const database = path.join(dir, "index.sqlite3");
    fs.writeFileSync(
      file,
      JSON.stringify({ type: "user", message: { content: "durable first phrase" } }),
    );
    const indexedSession = session({ path: file, sessionId: "durable-search" });
    const first = new PersistentTranscriptSearchIndex(database);
    try {
      expect(first.search([indexedSession], "durable first")).toHaveLength(1);
    } finally {
      first.close();
    }

    const hidden = `${file}.hidden`;
    fs.renameSync(file, hidden);
    const restored = new PersistentTranscriptSearchIndex(database);
    try {
      // The source file is unavailable, so this result can only come from the
      // durable SQLite index created by the previous instance.
      expect(restored.search([indexedSession], "durable first")).toHaveLength(1);
      fs.renameSync(hidden, file);
      fs.appendFileSync(
        file,
        `\n${JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: "incremental replacement phrase" }] },
        })}`,
      );
      expect(restored.search([indexedSession], "replacement phrase")).toHaveLength(1);
    } finally {
      restored.close();
      if (fs.existsSync(hidden)) fs.renameSync(hidden, file);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("bounded incremental transcript indexing", () => {
  const row = (text: string) =>
    JSON.stringify({
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text }],
      },
    });

  it("streams a >32 MiB tool-heavy log and shares the append checkpoint across instances", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-search-large-"));
    const file = path.join(dir, "codex.jsonl");
    const database = path.join(dir, "search.sqlite3");
    const filler = `${JSON.stringify({
      type: "response_item",
      payload: {
        type: "function_call_output",
        call_id: "tool",
        output: "x".repeat(65536),
      },
    })}\n`;
    const fd = fs.openSync(file, "w");
    for (let i = 0; i < 600; i++) fs.writeSync(fd, filler);
    fs.writeSync(fd, `${row("first visible needle")}\n`);
    fs.closeSync(fd);
    const first = new PersistentTranscriptSearchIndex(database);
    const second = new PersistentTranscriptSearchIndex(database);
    const sessions = [session({ path: file, vendor: "codex" })];
    const read = vi.spyOn(fs, "readSync");
    try {
      expect(first.search(sessions, "needle")).toHaveLength(1);
      expect(read.mock.calls.every((args) => Number((args as unknown[])[3]) <= 65536)).toBe(true);
      read.mockClear();
      fs.appendFileSync(file, `${row("new incremental 中文 tail")}\n`);
      expect(second.search(sessions, "中文 tail")).toHaveLength(1);
      expect(
        read.mock.calls.reduce((sum, args) => sum + Number((args as unknown[])[3]), 0),
      ).toBeLessThan(2048);
      read.mockClear();
      expect(first.search(sessions, "needle incremental")).toHaveLength(1);
      expect(read).not.toHaveBeenCalled();
      expect(first.search(sessions, "needle -incremental")).toEqual([]);
      expect(first.search(sessions, "missing OR %incremental% ")).toHaveLength(1);
      expect(first.search(sessions, "eedl")).toHaveLength(1);
    } finally {
      read.mockRestore();
      first.close();
      second.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("coordinates independent processes through the shared database", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-search-process-"));
    const file = path.join(dir, "codex.jsonl");
    const database = path.join(dir, "search.sqlite3");
    const fd = fs.openSync(file, "w");
    // Visible text also exceeds the heap limit, exercising bounded SQLite
    // query iteration as well as bounded source-file parsing.
    const filler = `${row(`visible payload ${"x".repeat(65536)}`)}\n`;
    for (let i = 0; i < 2048; i++) fs.writeSync(fd, filler);
    fs.writeSync(fd, `${row("shared process needle")}\n`);
    fs.closeSync(fd);
    const sourceBytes = fs.statSync(file).size;
    // Bootstrap schema independently from the indexing race.
    new PersistentTranscriptSearchIndex(database).close();
    const code = `
      import fs from 'node:fs';
      import { PersistentTranscriptSearchIndex } from './src/chat/search-index.ts';
      let bytes = 0;
      const read = fs.readSync;
      fs.readSync = (...args) => { bytes += Number(args[3]); return read(...args); };
      const index = new PersistentTranscriptSearchIndex(process.argv[1]);
      const results = index.search([JSON.parse(process.argv[2])], 'needle');
      index.close();
      console.log(JSON.stringify({ bytes, count: results.length }));
    `;
    try {
      const run = () =>
        promisify(execFile)(
          process.execPath,
          [
            "--max-old-space-size=64",
            "--import",
            "tsx",
            "--input-type=module",
            "-e",
            code,
            database,
            JSON.stringify(session({ path: file, vendor: "codex" })),
          ],
          { cwd: path.resolve(import.meta.dirname, "..") },
        );
      const results = await Promise.all([run(), run()]);
      const stats = results.map((result) => JSON.parse(result.stdout));
      expect(stats.map((stat) => stat.count)).toEqual([1, 1]);
      expect(stats.reduce((sum, stat) => sum + stat.bytes, 0)).toBeLessThan(sourceBytes + 2048);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 20000);

  it("replays an incomplete UTF-8 record and rebuilds after truncation or replacement", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-search-tail-"));
    const file = path.join(dir, "codex.jsonl");
    const index = new PersistentTranscriptSearchIndex();
    const sessions = [session({ path: file, vendor: "codex" })];
    const bytes = Buffer.from(row("completed 中文 record"));
    const split = bytes.indexOf(Buffer.from("中文")) + 1;
    try {
      fs.writeFileSync(
        file,
        Buffer.concat([Buffer.from(`${row("original message")}\n`), bytes.subarray(0, split)]),
      );
      expect(index.search(sessions, "original")).toHaveLength(1);
      fs.appendFileSync(file, bytes.subarray(split));
      expect(index.search(sessions, "中文")).toHaveLength(1);
      fs.appendFileSync(file, `\n${row("followup")}\n`);
      expect(index.search(sessions, "record")[0]?.count).toBe(1);
      fs.writeFileSync(file, `${row("truncated")}\n`);
      expect(index.search(sessions, "original")).toEqual([]);
      expect(index.search(sessions, "truncated")).toHaveLength(1);
      fs.renameSync(file, `${file}.old`);
      fs.writeFileSync(file, `${row("replacement with a longer message")}\n`);
      expect(index.search(sessions, "truncated")).toEqual([]);
      expect(index.search(sessions, "replacement")).toHaveLength(1);
    } finally {
      index.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails oversized records explicitly and rolls back the prior searchable index", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-search-limit-"));
    const file = path.join(dir, "codex.jsonl");
    const index = new PersistentTranscriptSearchIndex();
    const sessions = [session({ path: file, vendor: "codex" })];
    try {
      fs.writeFileSync(file, `${row("retained message")}\n`);
      index.sync(sessions);
      const fd = fs.openSync(file, "a");
      const block = Buffer.alloc(65536, 120);
      for (let i = 0; i < 513; i++) fs.writeSync(fd, block);
      fs.closeSync(fd);
      expect(() => index.sync(sessions)).toThrow("32 MiB safety limit");
      fs.unlinkSync(file);
      expect(index.search(sessions, "retained")).toHaveLength(1);
    } finally {
      index.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
