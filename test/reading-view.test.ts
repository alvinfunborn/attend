import { describe, expect, it } from "vitest";
import type { UiEvent } from "../src/chat/events.js";
import { ReadingViewEvents, readingViewMessages } from "../src/chat/reading-view.js";
import type { TranscriptMsg } from "../src/chat/transcript.js";

describe("reading view transport", () => {
  it("removes hidden payloads while retaining text, status, timestamps and history identities", () => {
    const messages: TranscriptMsg[] = [
      {
        role: "assistant",
        text: "Still working",
        ts: 123,
        historyId: "m_1",
        historyIndex: 3,
        tools: [
          {
            id: "done",
            name: "exec",
            input: { command: "x".repeat(100_000) },
            result: "y".repeat(500_000),
            isError: true,
            historyId: "t_1",
            historyOrdinal: 2,
          },
          { id: "pending", name: "exec", input: "pending command" },
        ],
      },
    ];
    const reading = readingViewMessages(messages);
    expect(reading[0]).toMatchObject({
      text: "Still working",
      ts: 123,
      historyId: "m_1",
      historyIndex: 3,
    });
    expect(reading[0]?.tools[0]).toMatchObject({
      id: "done",
      name: "exec",
      input: null,
      result: "",
      isError: true,
      historyId: "t_1",
      historyOrdinal: 2,
    });
    expect(reading[0]?.tools[1]?.result).toBeUndefined();
    expect(JSON.stringify(reading).length).toBeLessThan(JSON.stringify(messages).length / 1000);
    expect(messages[0]?.tools[0]?.result?.length).toBe(500_000);
  });

  it.each([
    "AskUserQuestion",
    "functions.request_user_input",
    "functions.request_user_input_async",
  ])("preserves %s questions and answers", (name) => {
    const tool = {
      id: "question",
      name,
      input: { questions: [{ title: "Choose", options: ["A", "B"] }] },
      result: '{"answer":"A"}',
    };
    expect(
      readingViewMessages([{ role: "assistant", text: "", tools: [tool] }])[0]?.tools[0],
    ).toEqual(tool);
    const events = new ReadingViewEvents();
    const use: UiEvent = { kind: "tool_use", id: tool.id, name, input: tool.input };
    expect(events.project("session", use)).toEqual(use);
    for (const text of ['{"accepted":true}', tool.result]) {
      const result: UiEvent = { kind: "tool_result", id: tool.id, text, isError: false };
      expect(events.project("session", result)).toEqual(result);
    }
    expect(
      events.project("other-session", {
        kind: "tool_result",
        id: tool.id,
        text: "hidden",
        isError: true,
      }),
    ).toEqual({ kind: "tool_result", id: tool.id, text: "", isError: true });
  });

  it("replays a classified question result after the bounded question tracker evicts its ID", () => {
    const events = new ReadingViewEvents(1);
    events.project("s", {
      kind: "tool_use",
      id: "q1",
      name: "AskUserQuestion",
      input: { questions: [] },
    });
    const result: UiEvent = { kind: "tool_result", id: "q1", text: "answer", isError: false };
    events.project("s", result);
    events.project("s", {
      kind: "tool_use",
      id: "q2",
      name: "AskUserQuestion",
      input: { questions: [] },
    });
    expect(events.project("s", { ...result })).toMatchObject({ text: "" });
    expect(events.project("s", result)).toEqual(result);
  });
});
