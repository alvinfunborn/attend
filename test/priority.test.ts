import { describe, expect, it } from "vitest";
import { buildAlignmentModel } from "../src/core/alignment.js";
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
    visits: 1,
    totalMinutes: 0,
    avgSessionMin: null,
    lastActionAgeDays: null,
    lastTouch: null,
    lastTouchAgeDays: null,
    ...over,
  };
}

describe("evaluatePriority", () => {
  it("scores memory alignment via cosine and reports the matched terms", () => {
    const model = buildAlignmentModel(["the widget pipeline and widget tokens"]);
    const r = evaluatePriority(brief({ what: "build the widget" }), tel({}), model);
    expect(r.score).toBeGreaterThan(0);
    expect(r.reason).toContain("memory aligned");
    expect(r.reason).toContain("widget");
  });

  it("gives no alignment bonus when the brief shares nothing with memory", () => {
    const model = buildAlignmentModel(["totally unrelated memory corpus"]);
    const r = evaluatePriority(brief({ what: "quantum zebra" }), tel({ sessions: 0 }), model);
    expect(r.reason).not.toContain("memory aligned");
  });

  it("avoidance adds a small nudge and a decision-point reason with evidence", () => {
    const r = evaluatePriority(brief({}), tel({ visits: 4, totalMinutes: 600, prompts: 3 }), null);
    expect(r.pattern).toBe("avoidance");
    // memory-led rank: pattern only nudges now (was 4 when pattern could dominate)
    expect(r.score).toBe(1);
    expect(r.reason).toContain("decision point");
    expect(r.reason).toContain("4 visits");
  });

  it("done is pushed to the bottom", () => {
    const r = evaluatePriority(brief({ status: "done" }), tel({ sessions: 0 }), null);
    expect(r.score).toBe(-100);
    expect(r.reason).toContain("done");
  });

  it("explicit blocker in next adds a bonus", () => {
    const r = evaluatePriority(brief({ next: "stuck on auth" }), tel({}), null);
    expect(r.reason).toContain("explicit blocker");
  });

  it("trailing 等 inside a parenthetical does not count as a blocker", () => {
    const r = evaluatePriority(brief({ next: "ship A (作品B 等)" }), tel({}), null);
    expect(r.reason).not.toContain("explicit blocker");
  });

  it("concrete 等X does count as a blocker", () => {
    const r = evaluatePriority(brief({ next: "等用户回复" }), tel({}), null);
    expect(r.reason).toContain("explicit blocker");
  });
});
