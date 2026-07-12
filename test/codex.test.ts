import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CodexSource,
  isCodexSubagentTranscript,
  parseCodexTranscript,
} from "../src/core/vendor/codex.js";

function jsonl(...lines: object[]): string {
  return lines.map((l) => JSON.stringify(l)).join("\n");
}

describe("parseCodexTranscript (RolloutLine schema)", () => {
  it("reads cwd from session_meta, counts user prompts and tool-call actions", () => {
    const raw = jsonl(
      {
        timestamp: "2026-05-01T10:00:00Z",
        type: "session_meta",
        payload: { id: "abc", cwd: "/home/u/proj", cli_version: "0.1" },
      },
      {
        timestamp: "2026-05-01T10:01:00Z",
        type: "response_item",
        payload: { type: "message", role: "user", content: [{ type: "input_text", text: "do X" }] },
      },
      {
        timestamp: "2026-05-01T10:02:00Z",
        type: "response_item",
        payload: { type: "local_shell_call", command: ["ls"] },
      },
      {
        timestamp: "2026-05-01T10:03:00Z",
        type: "response_item",
        payload: { type: "function_call", name: "apply_patch", arguments: "{}" },
      },
    );
    const s = parseCodexTranscript("rollout.jsonl", raw);
    expect(s.vendor).toBe("codex");
    expect(s.cwd).toBe("/home/u/proj");
    expect(s.prompts).toBe(1);
    expect(s.actions).toBe(2);
    expect(s.firstTs).toBe(Date.parse("2026-05-01T10:00:00Z"));
    expect(s.lastTs).toBe(Date.parse("2026-05-01T10:03:00Z"));
    expect(s.lastAssistantTs).toBe(Date.parse("2026-05-01T10:03:00Z"));
    expect(s.userPromptTs).toEqual([Date.parse("2026-05-01T10:01:00Z")]);
  });

  it("does not count assistant messages or non-action response items", () => {
    const raw = jsonl(
      {
        timestamp: "2026-05-01T10:00:00Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "hi" }],
        },
      },
      { type: "response_item", payload: { type: "reasoning", summary: [] } },
      { type: "event_msg", payload: { type: "token_count", total: 10 } },
    );
    const s = parseCodexTranscript("r.jsonl", raw);
    expect(s.prompts).toBe(0);
    expect(s.actions).toBe(0);
    expect(s.lastAssistantTs).toBe(Date.parse("2026-05-01T10:00:00Z"));
    expect(s.assistantTextActivity).toEqual([{ at: Date.parse("2026-05-01T10:00:00Z"), chars: 2 }]);
    expect(s.chars).toBe(2);
  });

  it("skips synthetic <…>-wrapped user turns so title/lastPrompt are the real prompts", () => {
    const raw = jsonl(
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "<environment_context>\n <cwd>/p</cwd>\n</environment_context>",
            },
          ],
        },
      },
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "investigate this call" }],
        },
      },
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "<environment_context>again</environment_context>" },
          ],
        },
      },
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "now add the transcript" }],
        },
      },
    );
    const s = parseCodexTranscript("r.jsonl", raw);
    expect(s.prompts).toBe(2); // only the two real prompts
    expect(s.title).toBe("investigate this call"); // first REAL prompt, not the env block
    expect(s.lastPrompt).toBe("now add the transcript");
  });

  it("strips provider-fork context from title and latest prompt", () => {
    const raw = jsonl({
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "push prod patch to main",
              "Attend fork context: this branch originally ran in claude.",
              "Use the transcript below as prior context, but treat this as a new independent branch in the current workspace.",
              "Transcript:",
              "User: old parent task",
              "Assistant: old parent answer",
            ].join("\n"),
          },
        ],
      },
    });
    const s = parseCodexTranscript("r.jsonl", raw);
    expect(s.prompts).toBe(1);
    expect(s.title).toBe("push prod patch to main");
    expect(s.lastPrompt).toBe("push prod patch to main");
  });

  it("keeps the full prompt (no 80-char truncation) so tooltips/header show it all", () => {
    const long = `investigate ${"x".repeat(300)} done`;
    const raw = jsonl({
      type: "response_item",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: long }] },
    });
    const s = parseCodexTranscript("r.jsonl", raw);
    expect(s.title).toBe(long); // intact, not "…"-truncated
    expect(s.title?.includes("…")).toBe(false);
  });

  it("marks a rollout active when the latest task has not completed", () => {
    const raw = jsonl(
      {
        timestamp: "2026-05-01T10:00:00Z",
        type: "session_meta",
        payload: { id: "cx-live", cwd: "/home/u/proj" },
      },
      {
        timestamp: "2026-05-01T10:00:01Z",
        type: "event_msg",
        payload: { type: "task_started", turn_id: "turn-1", started_at: 1_778_234_401 },
      },
      {
        timestamp: "2026-05-01T10:00:02Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "keep working" }],
        },
      },
      {
        timestamp: "2026-05-01T10:00:03Z",
        type: "response_item",
        payload: {
          type: "function_call",
          name: "exec_command",
          arguments: "{}",
          call_id: "call-1",
        },
      },
    );
    const s = parseCodexTranscript("rollout.jsonl", raw);
    expect(s.active).toBe(true);
    expect(s.activeStartedAt).toBe(1_778_234_401_000);
  });

  it("clears active state when the latest task completes", () => {
    const raw = jsonl(
      {
        timestamp: "2026-05-01T10:00:01Z",
        type: "event_msg",
        payload: { type: "task_started", turn_id: "turn-1", started_at: 1_778_234_401 },
      },
      {
        timestamp: "2026-05-01T10:00:05Z",
        type: "event_msg",
        payload: { type: "task_complete", turn_id: "turn-1", completed_at: 1_778_234_405 },
      },
    );
    const s = parseCodexTranscript("rollout.jsonl", raw);
    expect(s.active).toBeUndefined();
    expect(s.activeStartedAt).toBeUndefined();
  });

  it("treats a final answer as terminal even before task_complete is written", () => {
    const raw = jsonl(
      {
        timestamp: "2026-05-01T10:00:01Z",
        type: "event_msg",
        payload: { type: "task_started", turn_id: "turn-1", started_at: 1_778_234_401 },
      },
      {
        timestamp: "2026-05-01T10:00:04Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          phase: "final_answer",
          content: [{ type: "output_text", text: "done" }],
        },
      },
    );
    const s = parseCodexTranscript("rollout.jsonl", raw);
    expect(s.active).toBeUndefined();
    expect(s.activeStartedAt).toBeUndefined();
  });

  it("tolerates bare (pre-RolloutLine) records and malformed lines", () => {
    const raw = [
      "garbage",
      JSON.stringify({ cwd: "/bare/proj" }),
      JSON.stringify({
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "hey" }],
      }),
    ].join("\n");
    const s = parseCodexTranscript("r.jsonl", raw);
    expect(s.cwd).toBe("/bare/proj");
    expect(s.prompts).toBe(1);
  });

  it("detects Codex team-mode subagent transcripts", () => {
    const raw = jsonl({
      type: "session_meta",
      payload: {
        id: "child",
        cwd: "/home/u/proj",
        thread_source: "subagent",
        source: {
          subagent: {
            thread_spawn: { parent_thread_id: "parent", agent_nickname: "Rawls" },
          },
        },
      },
    });
    expect(isCodexSubagentTranscript(raw)).toBe(true);
  });

  it("does not list Codex team-mode subagent sessions", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-codex-source-"));
    try {
      fs.writeFileSync(
        path.join(dir, "rollout-parent.jsonl"),
        jsonl(
          { type: "session_meta", payload: { id: "parent", cwd: "/home/u/proj" } },
          {
            type: "response_item",
            payload: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "parent task" }],
            },
          },
        ),
      );
      fs.writeFileSync(
        path.join(dir, "rollout-child.jsonl"),
        jsonl(
          {
            type: "session_meta",
            payload: {
              id: "child",
              cwd: "/home/u/proj",
              thread_source: "subagent",
              source: { subagent: { thread_spawn: { parent_thread_id: "parent" } } },
            },
          },
          {
            type: "response_item",
            payload: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "child task" }],
            },
          },
        ),
      );

      const sessions = new CodexSource(dir).scan();
      expect(sessions.map((s) => s.sessionId)).toEqual(["parent"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
