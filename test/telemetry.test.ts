import { describe, expect, it } from "vitest";
import { matchSessions, telemetryForBrief } from "../src/core/telemetry.js";
import type { Brief, RawSession } from "../src/core/types.js";

const NOW = Date.parse("2026-05-30T00:00:00Z");
const DAY = 86_400_000;

function brief(projectDir: string): Brief {
  return {
    path: `${projectDir}/brief.md`,
    projectDir,
    name: "proj",
    frontMatter: {},
    what: "",
    accept: "",
    next: "",
    status: "active",
    deferUntil: null,
  };
}

function session(cwd: string | null, extra: Partial<RawSession> = {}): RawSession {
  return {
    path: "s.jsonl",
    vendor: "claude",
    sessionId: null,
    title: null,
    lastTurnChars: 0,
    cwd,
    firstTs: null,
    lastTs: null,
    prompts: 0,
    actions: 0,
    ...extra,
  };
}

describe("matchSessions (bidirectional cwd containment)", () => {
  const b = brief("D:\\workspace\\proj");

  it("matches when cwd is the project dir, nested under it, or a parent of it", () => {
    const sessions = [
      session("D:\\workspace\\proj"),
      session("D:\\workspace\\proj\\sub"),
      session("D:\\workspace"),
      session("D:\\workspace\\other"),
      session(null),
    ];
    expect(matchSessions(b, sessions)).toHaveLength(3);
  });

  it("normalizes separators so forward-slash cwd matches backslash project dir", () => {
    expect(matchSessions(b, [session("D:/workspace/proj")])).toHaveLength(1);
  });
});

describe("telemetryForBrief", () => {
  it("returns zeros when nothing matches", () => {
    const t = telemetryForBrief(brief("/a/b"), [session("/c/d")], NOW);
    expect(t.sessions).toBe(0);
    expect(t.avgSessionMin).toBeNull();
    expect(t.lastTouchAgeDays).toBeNull();
  });

  it("aggregates prompts/actions/dwell and ages from matched sessions", () => {
    const start = NOW - 2 * DAY;
    const t = telemetryForBrief(
      brief("/a/b"),
      [
        session("/a/b", {
          firstTs: start,
          lastTs: start + 30 * 60_000,
          prompts: 4,
          actions: 2,
        }),
        session("/a/b/sub", {
          firstTs: start,
          lastTs: start + 10 * 60_000,
          prompts: 1,
          actions: 0,
        }),
      ],
      NOW,
    );
    expect(t.sessions).toBe(2);
    expect(t.prompts).toBe(5);
    expect(t.actions).toBe(2);
    expect(t.avgSessionMin).toBe(20);
    // last touch is 2 days minus 30 minutes ago → floors to 1
    expect(t.lastTouchAgeDays).toBe(1);
    expect(t.lastActionAgeDays).toBe(1);
  });
});
