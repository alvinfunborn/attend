import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WorkEventStore } from "../src/core/work-events.js";

describe("WorkEventStore", () => {
  it("idempotently imports and retains a legacy JSON ledger", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-work-events-migration-"));
    const json = path.join(root, "work-events.json");
    const database = path.join(root, "work-events.sqlite3");
    fs.writeFileSync(
      json,
      JSON.stringify({
        version: 1,
        events: [
          {
            id: "legacy-turn",
            kind: "turn_started",
            at: Date.now(),
            sessionId: "legacy",
            source: "live",
          },
        ],
      }),
    );

    const first = new WorkEventStore(database);
    expect(first.list().map((event) => event.id)).toEqual(["legacy-turn"]);
    first.close();
    const second = new WorkEventStore(database);
    expect(second.list().map((event) => event.id)).toEqual(["legacy-turn"]);
    second.close();
    expect(fs.existsSync(json)).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
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

  it("compacts assistant output fragments into one event per session per five minutes", () => {
    const file = path.join(os.tmpdir(), `attend-work-events-${Date.now()}-outputs.json`);
    const store = new WorkEventStore(file);
    const bucket = Math.floor(Date.now() / (5 * 60_000)) * (5 * 60_000);

    store.record({
      kind: "assistant_output",
      at: bucket + 1_000,
      sessionId: "s1",
      chars: 10,
      source: "live",
    });
    store.record({
      kind: "assistant_output",
      at: bucket + 20_000,
      sessionId: "s1",
      chars: 15,
      source: "live",
    });

    expect(store.list()).toMatchObject([
      { kind: "assistant_output", at: bucket, sessionId: "s1", chars: 25, source: "live" },
    ]);
    fs.rmSync(file, { force: true });
  });

  it("merges events from independent server instances", () => {
    const file = path.join(os.tmpdir(), `attend-work-events-${Date.now()}-concurrent.json`);
    const first = new WorkEventStore(file);
    const second = new WorkEventStore(file);
    first.record({ kind: "turn_started", at: Date.now(), sessionId: "s1", source: "live" });
    second.record({ kind: "turn_started", at: Date.now(), sessionId: "s2", source: "live" });
    expect(
      first
        .list()
        .map((event) => event.sessionId)
        .sort(),
    ).toEqual(["s1", "s2"]);
    fs.rmSync(file, { force: true });
  });
});
