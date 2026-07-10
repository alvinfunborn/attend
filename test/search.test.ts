import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
});
