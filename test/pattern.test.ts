import { describe, expect, it } from "vitest";
import { classifyPattern } from "../src/core/pattern.js";
import type { Telemetry } from "../src/core/types.js";

function tel(over: Partial<Telemetry>): Telemetry {
  return {
    sessions: 1,
    prompts: 0,
    actions: 0,
    totalMinutes: 0,
    avgSessionMin: null,
    lastActionAgeDays: null,
    lastTouch: null,
    lastTouchAgeDays: null,
    ...over,
  };
}

describe("classifyPattern", () => {
  it("fresh when no sessions", () => {
    expect(classifyPattern(tel({ sessions: 0 }))).toBe("fresh");
  });

  it("avoidance: many prompts, zero actions", () => {
    expect(classifyPattern(tel({ prompts: 5, actions: 0 }))).toBe("avoidance");
  });

  it("stalled: zero actions, cold for >=7 days", () => {
    expect(classifyPattern(tel({ prompts: 2, actions: 0, lastTouchAgeDays: 9 }))).toBe("stalled");
  });

  it("healthy: actions, deep dwell, touched recently", () => {
    expect(classifyPattern(tel({ actions: 3, avgSessionMin: 25, lastTouchAgeDays: 1 }))).toBe(
      "healthy",
    );
  });

  it("active: actions present but not healthy", () => {
    expect(classifyPattern(tel({ actions: 1, avgSessionMin: 4, lastTouchAgeDays: 5 }))).toBe(
      "active",
    );
  });
});
