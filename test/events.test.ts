import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it } from "vitest";
import { toUiEvents } from "../src/chat/events.js";

const as = (o: unknown) => o as SDKMessage;

describe("toUiEvents", () => {
  it("maps a system init to a session event", () => {
    expect(toUiEvents(as({ type: "system", subtype: "init", session_id: "s1" }))).toEqual([
      { kind: "session", sessionId: "s1" },
    ]);
  });

  it("splits assistant content into text + tool_use events", () => {
    const evs = toUiEvents(
      as({
        type: "assistant",
        session_id: "s1",
        message: {
          content: [
            { type: "text", text: "hello" },
            { type: "tool_use", name: "Edit", input: { path: "a" } },
          ],
        },
      }),
    );
    expect(evs).toEqual([
      { kind: "assistant_text", text: "hello" },
      { kind: "tool_use", id: null, name: "Edit", input: { path: "a" } },
    ]);
  });

  it("handles string assistant content", () => {
    const evs = toUiEvents(
      as({ type: "assistant", session_id: "s1", message: { content: "hi there" } }),
    );
    expect(evs).toEqual([{ kind: "assistant_text", text: "hi there" }]);
  });

  it("maps result success/failure", () => {
    expect(toUiEvents(as({ type: "result", subtype: "success", result: "done" }))).toEqual([
      { kind: "result", ok: true, text: "done" },
    ]);
    expect(toUiEvents(as({ type: "result", subtype: "error_max_turns" }))[0]).toMatchObject({
      kind: "result",
      ok: false,
    });
  });
});
