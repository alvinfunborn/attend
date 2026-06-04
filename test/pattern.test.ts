import { describe, expect, it } from "vitest";
import { classifyPattern } from "../src/core/pattern.js";
import type { Telemetry } from "../src/core/types.js";

function tel(over: Partial<Telemetry>): Telemetry {
  return {
    sessions: 1,
    prompts: 0,
    actions: 0,
    visits: 1,
    totalMinutes: 0,
    avgSessionMin: null,
    lastActionAgeDays: null,
    lastTouch: null,
    lastTouchAgeDays: null,
    reviewVisits: 0,
    reviewMinutes: 0,
    ...over,
  };
}

describe("classifyPattern", () => {
  it("no sessions is left unbadged", () => {
    expect(classifyPattern(tel({ sessions: 0 }))).toBe("unknown");
  });

  it("avoidance: many visits over a long span but the task isn't advancing (prompts ≤ visits)", () => {
    expect(classifyPattern(tel({ visits: 4, totalMinutes: 600, prompts: 3 }))).toBe("avoidance");
  });

  it("avoidance: repeated long review visits with meaningful scroll and no send", () => {
    expect(classifyPattern(tel({ reviewVisits: 2, reviewMinutes: 25 }))).toBe("avoidance");
  });

  it("NOT avoidance: a single long sitting (one visit) is not decision-avoidance", () => {
    expect(classifyPattern(tel({ visits: 1, totalMinutes: 600, prompts: 1 }))).not.toBe(
      "avoidance",
    );
  });

  it("NOT avoidance: many revisits but the conversation keeps advancing (prompts > visits)", () => {
    expect(
      classifyPattern(tel({ visits: 4, totalMinutes: 600, prompts: 20, actions: 5 })),
    ).not.toBe("avoidance");
  });

  it("ignores AI actions: zero actions alone never triggers avoidance without the visit pattern", () => {
    expect(classifyPattern(tel({ visits: 1, prompts: 6, actions: 0, totalMinutes: 90 }))).not.toBe(
      "avoidance",
    );
  });

  it("stalled: zero actions, cold for >=7 days", () => {
    expect(classifyPattern(tel({ prompts: 2, actions: 0, lastTouchAgeDays: 9 }))).toBe("stalled");
  });

  it("healthy: actions, deep dwell, touched recently", () => {
    expect(classifyPattern(tel({ actions: 3, avgSessionMin: 25, lastTouchAgeDays: 1 }))).toBe(
      "healthy",
    );
  });

  it("generic in-progress work is left unbadged", () => {
    expect(classifyPattern(tel({ actions: 1, avgSessionMin: 4, lastTouchAgeDays: 5 }))).toBe(
      "unknown",
    );
  });
});
