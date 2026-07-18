import { describe, expect, it } from "vitest";
import {
  RESPONSE_SHAPE,
  avoidancePromptRequest,
  condenseUiContext,
  requestPrompt,
} from "../src/chat/analyzer/contract.js";

describe("condenseUiContext", () => {
  it("formats todos (open/done), notes, and shortcuts into one bounded block", () => {
    const out = condenseUiContext({
      shortcuts: ["run the suite", "  "],
      notes: ["decided to keep the daemon read-only", ""],
      todos: [
        { text: "wire the pill", completed: true },
        { text: "verify end to end", completed: false },
      ],
    });
    expect(out).toContain("[x] wire the pill");
    expect(out).toContain("[ ] verify end to end");
    expect(out).toContain("decided to keep the daemon read-only");
    expect(out).toContain("run the suite");
    expect(out.length).toBeLessThanOrEqual(1800);
  });

  it("returns an empty string when there is nothing to add", () => {
    expect(condenseUiContext({ shortcuts: [], notes: [], todos: [] })).toBe("");
    expect(
      condenseUiContext({
        shortcuts: ["  "],
        notes: [""],
        todos: [{ text: "  ", completed: false }],
      }),
    ).toBe("");
  });
});

describe("prompt uiContext injection", () => {
  it("includes the ui context block only when supplied", () => {
    const ctx = condenseUiContext({ shortcuts: [], notes: ["remember X"], todos: [] });
    expect(requestPrompt("transcript", [], ctx)).toContain("remember X");
    expect(requestPrompt("transcript", [])).not.toContain("private context for this session");
    expect(avoidancePromptRequest("transcript", ctx)).toContain("remember X");
    expect(avoidancePromptRequest("transcript")).not.toContain("private context for this session");
  });
});

describe("RESPONSE_SHAPE", () => {
  it("declares the nextStep field so the daemon emits it", () => {
    expect(RESPONSE_SHAPE).toContain('"nextStep"');
  });
});
