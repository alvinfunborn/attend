import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { RawSession } from "../src/core/types.js";
import { WorkEventStore } from "../src/core/work-events.js";

function session(id: string, prompts: number[]): RawSession {
  return {
    path: `/tmp/${id}.jsonl`,
    vendor: "claude",
    sessionId: id,
    title: id,
    lastPrompt: id,
    lastTurnChars: 0,
    chars: 0,
    cwd: "/tmp",
    firstTs: prompts[0] ?? null,
    lastTs: prompts.at(-1) ?? null,
    userPromptTs: prompts,
    userPromptActivity: prompts.map((at) => ({ at, chars: id.length })),
    prompts: prompts.length,
    actions: 0,
    visits: 1,
  };
}

describe("WorkEventStore", () => {
  it("persists live events and idempotently backfills transcript prompts", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-work-events-"));
    const file = path.join(root, "work-events.json");
    const now = Date.now();
    const store = new WorkEventStore(file);

    store.record({
      kind: "turn_started",
      at: now,
      sessionId: "s1",
      vendor: "claude",
      source: "live",
    });
    expect(store.backfillPrompts([session("s1", [now - 1_000, now - 2_000])])).toBe(2);
    expect(store.backfillPrompts([session("s1", [now - 1_000, now - 2_000])])).toBe(0);

    const reloaded = new WorkEventStore(file).list();
    expect(reloaded.map((event) => event.kind)).toEqual([
      "user_prompt",
      "user_prompt",
      "turn_started",
    ]);
    expect(
      reloaded.filter((event) => event.kind === "user_prompt").map((event) => event.chars),
    ).toEqual([2, 2]);
  });

  it("enriches a legacy live prompt with transcript character counts", () => {
    const file = path.join(os.tmpdir(), `attend-work-events-${Date.now()}-chars.json`);
    const store = new WorkEventStore(file);
    const now = Date.now();
    store.record({ kind: "user_prompt", at: now, sessionId: "hello", source: "live" });

    expect(store.backfillPrompts([session("hello", [now])])).toBe(1);
    expect(store.list()[0]?.chars).toBe(5);
    fs.rmSync(file, { force: true });
  });

  it("deduplicates repeated live callbacks within the configured window", () => {
    const file = path.join(os.tmpdir(), `attend-work-events-${Date.now()}-${Math.random()}.json`);
    const store = new WorkEventStore(file);
    const now = Date.now();
    const input = {
      kind: "turn_finished" as const,
      at: now,
      sessionId: "s1",
      source: "live" as const,
    };
    store.record(input, { dedupeWithinMs: 1_000 });
    store.record({ ...input, at: now + 100 }, { dedupeWithinMs: 1_000 });
    expect(store.list()).toHaveLength(1);
  });
});
