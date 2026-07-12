import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCursorArgs,
  cursorToProcessEvent,
  descendantPidsFromPs,
} from "../src/chat/cursor/exec.js";
import { parseCursorTranscript } from "../src/chat/cursor/transcript.js";
import { CursorSource, parseCursorSession } from "../src/core/vendor/cursor.js";

const line = (event: object, timestamp: number) =>
  JSON.stringify({ ...event, _attend: { timestamp, cwd: "/work/repo" } });

describe("Cursor CLI adapter", () => {
  it("orders Cursor tool descendants deepest-first for interruption", () => {
    expect(descendantPidsFromPs("100 1\n110 100\n120 110\n130 100\n", 100)).toEqual([
      120, 110, 130,
    ]);
  });

  it("builds documented headless and resume arguments", () => {
    expect(
      buildCursorArgs({
        cwd: "/work/repo",
        prompt: "fix it",
        resume: "chat-1",
        model: "composer-2",
      }),
    ).toEqual([
      "--print",
      "--force",
      "--output-format",
      "stream-json",
      "--stream-partial-output",
      "--resume=chat-1",
      "--model",
      "composer-2",
      "fix it",
    ]);
  });

  it("passes Cursor's selected parameterized variant as the model", () => {
    expect(
      buildCursorArgs({
        cwd: "/work/repo",
        prompt: "fix it",
        model: "gpt-5.3-codex",
        effort: "gpt-5.3-codex[reasoning=high,fast=true]",
      }),
    ).toContain("gpt-5.3-codex[reasoning=high,fast=true]");
  });

  it("parses Cursor's native IDE/CLI transcript shape", () => {
    const raw = [
      JSON.stringify({
        role: "user",
        message: { content: [{ type: "text", text: "<user_query>\nFix login\n</user_query>" }] },
      }),
      JSON.stringify({
        role: "assistant",
        message: {
          content: [
            { type: "text", text: "I'll inspect it." },
            { type: "tool_use", id: "tool-1", name: "Read", input: { path: "src/auth.ts" } },
          ],
        },
      }),
    ].join("\n");

    expect(parseCursorTranscript(raw)).toEqual([
      { role: "user", text: "Fix login", tools: [] },
      {
        role: "assistant",
        text: "I'll inspect it.",
        tools: [{ id: "tool-1", name: "Read", input: { path: "src/auth.ts" } }],
      },
    ]);
    expect(parseCursorSession("/tmp/native-id.jsonl", raw, "/work/repo")).toMatchObject({
      sessionId: "native-id",
      cwd: "/work/repo",
      prompts: 1,
      actions: 1,
      title: "Fix login",
    });
  });

  it("strips Cursor's timestamp wrapper from native user prompts", () => {
    const raw = JSON.stringify({
      role: "user",
      message: {
        content: [
          {
            type: "text",
            text: "<timestamp>Sunday</timestamp>\n<user_query>\nActual prompt\n</user_query>",
          },
        ],
      },
    });
    expect(parseCursorTranscript(raw)).toEqual([
      { role: "user", text: "Actual prompt", tools: [] },
    ]);
  });

  it("discovers native transcripts and resolves the encoded workspace", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-cursor-native-"));
    const workspace = path.join(root, "my-project");
    const projects = path.join(root, "cursor-projects");
    const id = "7c45d76b-ff1e-4d9c-b7af-d6692ce2018a";
    const encoded = workspace.slice(path.parse(workspace).root.length).split(path.sep).join("-");
    const transcriptDir = path.join(projects, encoded, "agent-transcripts", id);
    fs.mkdirSync(workspace, { recursive: true });
    fs.mkdirSync(transcriptDir, { recursive: true });
    fs.writeFileSync(
      path.join(transcriptDir, `${id}.jsonl`),
      JSON.stringify({
        role: "user",
        message: { content: [{ type: "text", text: "Native session" }] },
      }),
    );
    try {
      expect(new CursorSource(projects).scan()).toMatchObject([
        { vendor: "cursor", sessionId: id, cwd: workspace, title: "Native session", prompts: 1 },
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("normalizes stream-json session, assistant, tool, and result events", () => {
    expect(cursorToProcessEvent({ type: "system", subtype: "init", session_id: "chat-1" })).toEqual(
      [{ type: "thread.started", thread_id: "chat-1" }],
    );
    expect(
      cursorToProcessEvent({
        type: "assistant",
        message: { content: [{ type: "text", text: "done" }] },
      }),
    ).toEqual([{ type: "item.completed", item: { type: "agent_message", text: "done" } }]);
    expect(
      cursorToProcessEvent({
        type: "tool_call",
        subtype: "started",
        call_id: "t1",
        tool_call: { writeToolCall: { args: { path: "a.ts" } } },
      }),
    ).toEqual([
      {
        type: "item.started",
        item: {
          id: "t1",
          type: "mcp_tool_call",
          name: "writeToolCall",
          arguments: { path: "a.ts" },
        },
      },
    ]);
    expect(cursorToProcessEvent({ type: "result", subtype: "success", is_error: false })).toEqual([
      { type: "turn.completed" },
    ]);
  });

  it("renders and summarizes Attend-captured Cursor transcripts", () => {
    const raw = [
      line({ type: "system", subtype: "init", session_id: "chat-1" }, 1000),
      line({ type: "user", message: { content: [{ type: "text", text: "Fix login" }] } }, 1100),
      line({ type: "assistant", message: { content: [{ type: "text", text: "I will " }] } }, 1200),
      line(
        { type: "assistant", message: { content: [{ type: "text", text: "inspect it." }] } },
        1300,
      ),
      line(
        {
          type: "tool_call",
          subtype: "started",
          call_id: "t1",
          tool_call: { readToolCall: { args: { path: "src/auth.ts" } } },
        },
        1400,
      ),
      line({ type: "result", subtype: "success", session_id: "chat-1" }, 1500),
    ].join("\n");

    const messages = parseCursorTranscript(raw);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", text: "Fix login" });
    expect(messages[1]).toMatchObject({
      role: "assistant",
      text: "I will inspect it.",
      tools: [{ id: "t1", name: "readToolCall" }],
    });

    const session = parseCursorSession("/tmp/chat-1.jsonl", raw);
    expect(session).toMatchObject({
      vendor: "cursor",
      sessionId: "chat-1",
      cwd: "/work/repo",
      title: "Fix login",
      lastPrompt: "Fix login",
      prompts: 1,
      actions: 1,
    });
    expect(session.chars).toBe("Fix login".length + "I will inspect it.".length);
  });

  it("uses the successful result text when the CLI emits no assistant event", () => {
    const raw = [
      line({ type: "user", message: { content: [{ type: "text", text: "Say hi" }] } }, 1000),
      line(
        {
          type: "result",
          subtype: "success",
          is_error: false,
          result: "Hi from Cursor",
          session_id: "chat-2",
        },
        1100,
      ),
    ].join("\n");
    expect(parseCursorTranscript(raw)).toMatchObject([
      { role: "user", text: "Say hi" },
      { role: "assistant", text: "Hi from Cursor" },
    ]);
  });

  it("does not duplicate the final assistant snapshot after partial deltas", () => {
    const raw = [
      line({ type: "user", message: { content: [{ type: "text", text: "Reply once" }] } }, 1000),
      line({ type: "assistant", message: { content: [{ type: "text", text: "CUR" }] } }, 1010),
      line({ type: "assistant", message: { content: [{ type: "text", text: "SOR" }] } }, 1020),
      line({ type: "assistant", message: { content: [{ type: "text", text: "CURSOR" }] } }, 1030),
      line({ type: "result", subtype: "success", result: "CURSOR" }, 1040),
    ].join("\n");
    expect(parseCursorTranscript(raw)).toMatchObject([
      { role: "user", text: "Reply once" },
      { role: "assistant", text: "CURSOR" },
    ]);
  });
});
