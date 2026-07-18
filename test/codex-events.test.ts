import { describe, expect, it } from "vitest";
import { type CodexEvent, toUiEventsFromCodex } from "../src/chat/codex/events.js";

describe("toUiEventsFromCodex", () => {
  it("maps current session_meta / response_item / task_complete protocol", () => {
    expect(
      toUiEventsFromCodex({
        type: "session_meta",
        payload: { id: "cx-new", cwd: "/tmp/x" },
      }),
    ).toEqual([{ kind: "session", sessionId: "cx-new" }]);

    expect(
      toUiEventsFromCodex({
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "final answer" }],
        },
      }),
    ).toEqual([{ kind: "assistant_text", text: "final answer" }]);

    expect(toUiEventsFromCodex({ type: "event_msg", payload: { type: "task_complete" } })).toEqual([
      { kind: "result", ok: true },
    ]);
  });

  it("maps thread.started to a session event", () => {
    expect(toUiEventsFromCodex({ type: "thread.started", thread_id: "cx-1" })).toEqual([
      { kind: "session", sessionId: "cx-1" },
    ]);
  });

  it("carries Cursor's init model as an observed run configuration", () => {
    expect(
      toUiEventsFromCodex({ type: "thread.started", thread_id: "cu-1", model: "Auto" }),
    ).toEqual([
      { kind: "session", sessionId: "cu-1" },
      { kind: "run_config", source: "provider-observed", model: "auto" },
    ]);
  });

  it("emits assistant text only on a completed agent_message", () => {
    const started = toUiEventsFromCodex({ type: "item.started", item: { type: "agent_message" } });
    const done = toUiEventsFromCodex({
      type: "item.completed",
      item: { type: "agent_message", text: "pong" },
    });
    expect(started).toEqual([]);
    expect(done).toEqual([{ kind: "assistant_text", text: "pong" }]);
  });

  it("maps a command_execution to tool_use (start) then tool_result (complete)", () => {
    const start = toUiEventsFromCodex({
      type: "item.started",
      item: { id: "item_1", type: "command_execution", command: "echo hi", status: "in_progress" },
    });
    expect(start).toEqual([
      { kind: "tool_use", id: "item_1", name: "shell", input: { command: "echo hi" } },
    ]);
    const ok = toUiEventsFromCodex({
      type: "item.completed",
      item: { id: "item_1", type: "command_execution", aggregated_output: "hi\n", exit_code: 0 },
    });
    expect(ok).toEqual([{ kind: "tool_result", id: "item_1", text: "hi\n", isError: false }]);
  });

  it("maps current response_item tool calls and outputs", () => {
    expect(
      toUiEventsFromCodex({
        type: "response_item",
        payload: {
          type: "function_call",
          name: "exec_command",
          call_id: "call_1",
          arguments: '{"cmd":"pwd"}',
        },
      }),
    ).toEqual([{ kind: "tool_use", id: "call_1", name: "exec_command", input: { cmd: "pwd" } }]);

    expect(
      toUiEventsFromCodex({
        type: "response_item",
        payload: {
          type: "custom_tool_call_output",
          call_id: "call_1",
          output: "ok",
        },
      }),
    ).toEqual([{ kind: "tool_result", id: "call_1", text: "ok", isError: false }]);
  });

  it("flags a nonzero exit as an error tool_result", () => {
    const ev = toUiEventsFromCodex({
      type: "item.completed",
      item: { id: "x", type: "command_execution", aggregated_output: "boom", exit_code: 1 },
    });
    expect(ev).toEqual([{ kind: "tool_result", id: "x", text: "boom", isError: true }]);
  });

  it("surfaces turn.completed as an ok result and turn.failed as a visible error", () => {
    expect(toUiEventsFromCodex({ type: "turn.completed" })).toEqual([{ kind: "result", ok: true }]);
    // A failed turn must render (banner), not be swallowed like a `result`.
    expect(toUiEventsFromCodex({ type: "turn.failed", error: "nope" })).toEqual([
      { kind: "error", message: "nope" },
    ]);
    // No message anywhere → still terminal, with a generic fallback.
    expect(toUiEventsFromCodex({ type: "turn.failed" })).toEqual([
      { kind: "error", message: "codex turn failed" },
    ]);
  });

  it("surfaces a codex usage-limit failure as an error banner (parity with Claude)", () => {
    // The real shape: a bare `error` event immediately followed by an informative
    // `turn.failed`. The empty one must emit nothing so it can't preempt (and thus
    // suppress, in the engine) the message-carrying terminal.
    expect(toUiEventsFromCodex({ type: "error", error: "" })).toEqual([]);
    expect(toUiEventsFromCodex({ type: "error" })).toEqual([]);
    expect(
      toUiEventsFromCodex({
        type: "turn.failed",
        error: { message: "You've hit your usage limit. Try again at Jul 7th, 2026 9:45 AM." },
      }),
    ).toEqual([
      {
        kind: "error",
        message: "You've hit your usage limit. Try again at Jul 7th, 2026 9:45 AM.",
      },
    ]);
  });

  it("emits a visible error when codex reports one via an `error` event", () => {
    expect(
      toUiEventsFromCodex({ type: "error", error: { message: "stream disconnected" } }),
    ).toEqual([{ kind: "error", message: "stream disconnected" }]);
  });

  it("ignores item types it can't render (e.g. reasoning)", () => {
    const ev: CodexEvent = { type: "item.completed", item: { type: "reasoning", text: "…" } };
    expect(toUiEventsFromCodex(ev)).toEqual([]);
  });
});
