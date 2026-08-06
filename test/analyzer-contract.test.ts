import { describe, expect, it } from "vitest";
import {
  DAEMON_PROMPT_MARKERS,
  RESPONSE_SHAPE,
  avoidancePromptRequest,
  condenseUiContext,
  looksLikeDaemonPrompt,
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

// These markers back the last-resort daemon filter (isLikelyDaemonSession in server.ts).
// They previously drifted out of sync with the prompts and silently stopped matching, so
// lock them to the real prompt text here: change a prompt and this fails.
describe("daemon prompt markers", () => {
  it("still match the current analyze + avoidance prompts", () => {
    const analyze = requestPrompt("some transcript", [], "");
    expect(analyze.startsWith(DAEMON_PROMPT_MARKERS.analyzePrefix)).toBe(true);
    expect(analyze.includes(DAEMON_PROMPT_MARKERS.analyzeReply)).toBe(true);

    const avoidance = avoidancePromptRequest("some transcript", "");
    expect(avoidance.startsWith(DAEMON_PROMPT_MARKERS.avoidancePrefix)).toBe(true);
  });

  it("recognize a daemon transcript by seed title or analyze/avoidance last prompt", () => {
    expect(looksLikeDaemonPrompt(`${DAEMON_PROMPT_MARKERS.seedPrefix} …`, "hi")).toBe(true);
    expect(looksLikeDaemonPrompt("Refactor parser", requestPrompt("t", [], ""))).toBe(true);
    expect(looksLikeDaemonPrompt("Refactor parser", avoidancePromptRequest("t", ""))).toBe(true);
  });

  it("do not mistake a real user session for a daemon", () => {
    expect(looksLikeDaemonPrompt("Fix funnel breakdown bug", "storm 已经停了，首次完成功能")).toBe(
      false,
    );
    expect(looksLikeDaemonPrompt("", "")).toBe(false);
  });
});
