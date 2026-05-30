import { describe, expect, it } from "vitest";
import { evaluatePriority } from "../src/core/priority.js";
import type { Brief, Telemetry } from "../src/core/types.js";

function brief(over: Partial<Brief>): Brief {
  return {
    path: "/v/p/brief.md",
    projectDir: "/v/p",
    name: "p",
    frontMatter: {},
    what: "",
    accept: "",
    next: "",
    status: "active",
    deferUntil: null,
    ...over,
  };
}

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

describe("evaluatePriority", () => {
  it("scores memory alignment ×2 and reports hits", () => {
    const r = evaluatePriority(brief({ what: "build the widget" }), tel({}), ["widget"]);
    expect(r.score).toBeGreaterThanOrEqual(2);
    expect(r.reason).toContain("memory aligned");
  });

  it("avoidance adds weight and a decision-needed reason", () => {
    const r = evaluatePriority(brief({}), tel({ prompts: 6, actions: 0 }), []);
    expect(r.pattern).toBe("avoidance");
    expect(r.score).toBe(4);
    expect(r.reason).toContain("needs decision");
  });

  it("done is pushed to the bottom", () => {
    const r = evaluatePriority(brief({ status: "done" }), tel({ sessions: 0 }), []);
    expect(r.score).toBe(-100);
    expect(r.reason).toContain("done");
  });

  it("explicit blocker in next adds a bonus", () => {
    const r = evaluatePriority(brief({ next: "stuck on auth" }), tel({}), []);
    expect(r.reason).toContain("explicit blocker");
  });

  it("trailing 等 inside a parenthetical does not count as a blocker", () => {
    const r = evaluatePriority(brief({ next: "ship A (作品B 等)" }), tel({}), []);
    expect(r.reason).not.toContain("explicit blocker");
  });

  it("concrete 等X does count as a blocker", () => {
    const r = evaluatePriority(brief({ next: "等用户回复" }), tel({}), []);
    expect(r.reason).toContain("explicit blocker");
  });
});
