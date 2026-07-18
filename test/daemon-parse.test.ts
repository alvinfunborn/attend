import { describe, expect, it } from "vitest";
import {
  parseAnalysis,
  parseAvoidancePrompt,
  parseCollaborationLabels,
} from "../src/core/daemon/parse.js";

describe("parseAnalysis", () => {
  it("extracts a fenced JSON verdict, ignoring surrounding prose", () => {
    const text =
      'Here is my read:\n```json\n{"brief":"refactor parser","state":"needs_decision","priority":7,"etaMin":12,"reason":"two questions, no edits"}\n```';
    expect(parseAnalysis(text)).toEqual({
      brief: "refactor parser",
      state: "needs_decision",
      priority: 7,
      etaMin: 12,
      reason: "two questions, no edits",
    });
  });

  it("handles braces inside string values (string-aware brace matching)", () => {
    const r = parseAnalysis(
      '{"brief":"fix {config} loader","state":"blocked","priority":2,"etaMin":3,"reason":""}',
    );
    expect(r?.brief).toBe("fix {config} loader");
    expect(r?.state).toBe("blocked");
  });

  it("takes the last object when several appear", () => {
    const r = parseAnalysis(
      '{"brief":"old"} then {"brief":"new","state":"done","priority":1,"etaMin":1,"reason":""}',
    );
    expect(r?.brief).toBe("new");
    expect(r?.state).toBe("done");
  });

  it("clamps priority and etaMin into range", () => {
    const r = parseAnalysis('{"brief":"x","priority":99,"etaMin":-5,"reason":""}');
    expect(r?.priority).toBe(10);
    expect(r?.etaMin).toBe(0);
  });

  it("keeps old daemon output parseable without fabricating a state", () => {
    const r = parseAnalysis('{"brief":"x","priority":3,"etaMin":5,"reason":"old schema"}');
    expect(r?.state).toBeNull();
    expect(r?.avoidancePrompt).toBeUndefined();
    expect(r?.nextStep).toBeUndefined();
  });

  it("parses nextStep as an editable draft, mapping an empty string to null", () => {
    const drafted = parseAnalysis(
      '{"brief":"x","state":"needs_decision","priority":4,"etaMin":2,"reason":"pick one","nextStep":"用第二个方案,先跑测试"}',
    );
    // The daemon drafts the most likely next message even for a decision turn.
    expect(drafted?.nextStep).toBe("用第二个方案,先跑测试");
    // Empty (nothing inferable — task done / no transcript) becomes null, so the pill hides.
    const none = parseAnalysis(
      '{"brief":"x","state":"done","priority":1,"etaMin":1,"reason":"finished","nextStep":""}',
    );
    expect(none?.nextStep).toBeNull();
  });

  it("does not fabricate an ETA or let prose quotes hide the JSON object", () => {
    const r = parseAnalysis('The phrase "never closes. {"brief":"x","priority":3}');
    expect(r?.brief).toBe("x");
    expect(r?.etaMin).toBe(0);
  });

  it("returns null when there is no JSON, or no brief (never fabricates)", () => {
    expect(parseAnalysis("no structure here")).toBeNull();
    expect(parseAnalysis('{"priority":5,"etaMin":2,"reason":"r"}')).toBeNull();
  });

  it("parses one-shot avoidance prompt output separately", () => {
    expect(parseAvoidancePrompt('{"avoidancePrompt":"Ask for a 3-step checklist"}')).toBe(
      "Ask for a 3-step checklist",
    );
    expect(parseAvoidancePrompt('{"avoidancePrompt":""}')).toBeNull();
  });

  it("parses valid supplied turn labels without trusting invented turn ids", () => {
    const text = JSON.stringify({
      brief: "inspect parser",
      turns: [
        {
          turnId: "known",
          intent: "inspect_code",
          steering: "challenge",
          feedbackTarget: "design",
          handoff: "continue_ready",
          confidence: 1.5,
        },
        {
          turnId: "invented",
          intent: "implement",
          steering: "continue",
          feedbackTarget: "code_change",
        },
      ],
    });
    expect(parseCollaborationLabels(text, new Set(["known"]))).toEqual([
      {
        turnId: "known",
        intent: "inspect_code",
        steering: "challenge",
        feedbackTarget: "design",
        handoff: "continue_ready",
        confidence: 1,
      },
    ]);
  });
});
