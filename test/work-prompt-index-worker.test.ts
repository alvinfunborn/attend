import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { RawSession } from "../src/core/types.js";
import { WorkEventStore } from "../src/core/work-events.js";
import { WorkerWorkPromptIndex } from "../src/core/work-prompt-index.js";

describe("WorkerWorkPromptIndex", () => {
  it("materializes large transcript activity without starving the request loop", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-work-index-"));
    const database = path.join(root, "events.sqlite3");
    const base = Date.now() - 60_000;
    const activity = Array.from({ length: 2_000 }, (_, index) => ({
      at: base + index * 10,
      chars: index + 1,
    }));
    const session: RawSession = {
      path: path.join(root, "session.jsonl"),
      vendor: "claude",
      sessionId: "worker-activity",
      title: "worker activity",
      lastPrompt: "worker activity",
      lastTurnChars: 0,
      chars: 0,
      cwd: root,
      firstTs: base,
      lastTs: base + activity.length * 10,
      userPromptTs: activity.map(({ at }) => at),
      userPromptActivity: activity,
      assistantTextActivity: activity,
      prompts: activity.length,
      actions: 0,
      visits: 1,
    };
    const index = new WorkerWorkPromptIndex(database);
    let ticks = 0;
    const ticker = setInterval(() => {
      ticks += 1;
    }, 2);
    try {
      const synced = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("work prompt worker timed out")), 10_000);
        const unsubscribe = index.subscribe(() => {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        });
      });
      index.sync([session]);
      await synced;
      const store = new WorkEventStore(database);
      try {
        const events = store.list();
        expect(events.filter((event) => event.kind === "user_prompt")).toHaveLength(
          activity.length,
        );
        expect(events.some((event) => event.kind === "assistant_output")).toBe(true);
      } finally {
        store.close();
      }
      expect(ticks).toBeGreaterThan(2);
    } finally {
      clearInterval(ticker);
      index.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 15_000);
});
