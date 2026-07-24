import { describe, expect, it } from "vitest";
import type { Analysis } from "../src/core/daemon/cache.js";
import type { RawSession } from "../src/core/types.js";
import type { WorkEvent, WorkEventKind } from "../src/core/work-events.js";
import { buildWorkStats, trailingPromptActivity } from "../src/core/work-stats.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function session(id: string, prompts: number[], extra: Partial<RawSession> = {}): RawSession {
  return {
    path: `/tmp/${id}.jsonl`,
    vendor: "claude",
    sessionId: id,
    title: id,
    lastPrompt: id,
    lastTurnChars: 0,
    chars: 100,
    cwd: "/tmp/demo",
    firstTs: prompts[0] ?? null,
    lastTs: prompts.at(-1) ?? null,
    userPromptTs: prompts,
    prompts: prompts.length,
    actions: 0,
    visits: 1,
    ...extra,
  };
}

function event(
  id: string,
  kind: WorkEventKind,
  at: number,
  sessionId: string,
  extra: Partial<WorkEvent> = {},
): WorkEvent {
  return { id, kind, at, sessionId, source: "live", ...extra };
}

function analysis(state: Analysis["state"], priority = 5): Analysis {
  return { brief: "daemon brief", state, priority, etaMin: 8, reason: "test" };
}

describe("buildWorkStats", () => {
  it("uses globally aligned one-hour breadth samples for every range", () => {
    const now = new Date(2026, 6, 11, 18).getTime();
    const at = (daysAgo: number, hour: number, minute: number) => {
      const value = new Date(now);
      value.setDate(value.getDate() - daysAgo);
      value.setHours(hour, minute, 0, 0);
      return value.getTime();
    };
    const promptEvents: WorkEvent[] = [];
    const addHour = (prefix: string, count: number, time: number) => {
      for (let index = 0; index < count; index += 1) {
        promptEvents.push(
          event(`${prefix}-${index}`, "user_prompt", time + index * 1_000, `${prefix}-${index}`),
        );
      }
    };
    addHour("narrow", 2, at(5, 9, 5));
    addHour("mixed", 4, at(4, 11, 5));
    addHour("wide", 6, at(3, 12, 5));

    const stats = buildWorkStats([], now, "7d", { events: promptEvents });

    expect(stats.timelineUnit).toBe("hour");
    expect(stats.timeline).toHaveLength(Math.ceil((now - stats.windowStart) / HOUR));
    expect(stats.summary).toMatchObject({ sessionsTouched: 12, prompts: 12, promptedHours: 3 });
    expect(stats.modes.find((item) => item.mode === "focus")).toMatchObject({
      promptedHours: 1,
      sessionsPerPromptedHour: 2,
    });
    expect(stats.modes.find((item) => item.mode === "balanced")).toMatchObject({
      promptedHours: 1,
      sessionsPerPromptedHour: 4,
    });
    expect(stats.modes.find((item) => item.mode === "parallel")).toMatchObject({
      promptedHours: 1,
      sessionsPerPromptedHour: 6,
    });
    expect(
      stats.timeline
        .flatMap((bucket) => Object.values(bucket.modeHours))
        .reduce((a, b) => a + b, 0),
    ).toBe(3);
  });

  it("counts cross-hour switches as a normalized probability", () => {
    const now = new Date(2026, 6, 11, 18, 30).getTime();
    const events = [
      event("a", "user_prompt", now - 91 * 60_000, "a"),
      event("b", "user_prompt", now - 89 * 60_000, "b"),
      event("c", "user_prompt", now - 88 * 60_000, "b"),
    ];
    const stats = buildWorkStats([], now, "3h", { events });
    const focus = stats.modes.find((item) => item.mode === "focus");

    expect(stats.summary.promptedHours).toBe(2);
    expect(stats.timeline.reduce((sum, bucket) => sum + bucket.switches, 0)).toBe(1);
    expect(focus?.switchRate).toBe(1);
  });

  it("uses timestamped daemon outcomes instead of the session's latest state", () => {
    const now = new Date(2026, 6, 11, 18).getTime();
    const first = now - 6 * DAY;
    const events = [
      event("p-return", "user_prompt", first, "returned"),
      event("s-return", "daemon_state", first + 10 * 60_000, "returned", { state: "needs_review" }),
      event("p-return-2", "user_prompt", first + DAY, "returned"),
      event("p-hidden", "user_prompt", first + HOUR, "hidden"),
      event("s-hidden", "daemon_state", first + HOUR + 10 * 60_000, "hidden", {
        state: "needs_input",
      }),
      event("p-done", "user_prompt", first + 2 * HOUR, "done"),
      event("s-done", "daemon_state", first + 2 * HOUR + 10 * 60_000, "done", { state: "done" }),
      event("p-blocked", "user_prompt", first + 3 * HOUR, "blocked"),
      event("s-blocked", "daemon_state", first + 3 * HOUR + 10 * 60_000, "blocked", {
        state: "blocked",
      }),
    ];
    const stats = buildWorkStats([], now, "7d", { events });
    const focus = stats.modes.find((item) => item.mode === "focus");

    expect(focus).toMatchObject({ resolvedOrAdvanced72hRate: 0.667, outcomeSamples: 3 });
  });

  it("measures real turn overlap, completion throughput, turnaround, and queue wait", () => {
    const now = new Date(2026, 6, 11, 18).getTime();
    const events = [
      event("q1", "queue_enqueued", now - 2.5 * HOUR, "a", { queueId: "q1" }),
      event("p1", "user_prompt", now - 2 * HOUR, "a"),
      event("t1", "turn_started", now - 2 * HOUR, "a", { queueId: "q1" }),
      event("p2", "user_prompt", now - 1.5 * HOUR, "b"),
      event("t2", "turn_started", now - 1.5 * HOUR, "b"),
      event("f1", "turn_finished", now - HOUR, "a", { ok: true }),
      event("f2", "turn_finished", now - 0.5 * HOUR, "b", { ok: true }),
    ];
    const stats = buildWorkStats([], now, "3h", { events });

    expect(stats.summary).toMatchObject({
      completedTurns: 2,
      medianTurnMinutes: 60,
      medianQueueWaitMinutes: 30,
      modelBusyRate: 0.75,
      overlapRate: 0.333,
      peakConcurrency: 2,
      resourceObservedHours: 2,
    });
  });

  it("uses the latest real user prompt for dormant work and separates blocked state", () => {
    const now = new Date(2026, 6, 11, 18).getTime();
    const stale = now - 5 * DAY;
    const sessions = [
      session("open", [stale], { lastTs: now - DAY }),
      session("blocked", [stale + HOUR]),
      session("done", [stale + 2 * HOUR]),
    ];
    const states: Record<string, Analysis> = {
      open: analysis("needs_review"),
      blocked: analysis("blocked"),
      done: analysis("done"),
    };
    const stats = buildWorkStats(sessions, now, "7d", {
      analysisFor: (id) => states[id] ?? null,
    });

    expect(stats.dormant.attention.items[0]).toMatchObject({ sessionId: "open", ageDays: 5 });
    expect(stats.dormant.blocked.items[0]).toMatchObject({ sessionId: "blocked" });
  });

  it("supports every range and reports honest ledger coverage", () => {
    const now = new Date(2026, 6, 11, 18, 30).getTime();
    const events = [event("p", "user_prompt", now - HOUR, "a", { source: "transcript" })];

    expect(buildWorkStats([], now, "3h", { events }).range).toBe("3h");
    const today = buildWorkStats([], now, "today", { events });
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    expect(today.windowStart).toBe(midnight.getTime());
    const fifteenDays = buildWorkStats([], now, "15d", { events });
    expect(fifteenDays.timelineUnit).toBe("hour");
    expect(fifteenDays.timeline).toHaveLength(Math.ceil((now - fifteenDays.windowStart) / HOUR));
    expect(today.coverage).toMatchObject({
      promptSince: events[0]?.at,
      turnSince: null,
      stateSince: null,
    });
  });

  it("reports exact trailing prompt totals instead of ambiguous hourly session rates", () => {
    const now = Date.now();
    const events = [
      event("a1", "user_prompt", now - HOUR, "a", { chars: 10 }),
      event("a2", "user_prompt", now - 2 * HOUR, "a", { chars: 20 }),
      event("b1", "user_prompt", now - 3 * HOUR, "b", { chars: 30 }),
      event("reply", "assistant_output", now - 30 * 60_000, "a", { chars: 40 }),
      event("old", "user_prompt", now - 25 * HOUR, "old"),
    ];
    expect(trailingPromptActivity(events, now, 24)).toEqual({
      sessions: 2,
      prompts: 3,
      chars: 100,
    });
  });
});
