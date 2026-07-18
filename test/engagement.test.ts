import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EngagementStore, REVIEW_MIN_DWELL_MS } from "../src/core/engagement.js";

const files: string[] = [];
afterEach(async () => {
  const fs = await import("node:fs");
  for (const f of files.splice(0)) {
    try {
      fs.rmSync(f, { force: true });
    } catch {
      // ignore
    }
  }
});

function store() {
  const file = path.join(
    os.tmpdir(),
    `attend-engagement-${Math.random().toString(36).slice(2)}.json`,
  );
  files.push(file);
  return new EngagementStore(file);
}

describe("EngagementStore", () => {
  it("records every visit and only counts long scroll-without-send visits as reviews", () => {
    const s = store();
    const a = s.recordVisit("sess-1", {
      viewedMs: REVIEW_MIN_DWELL_MS + 5_000,
      hadMeaningfulScroll: true,
      hadSend: false,
      endedAt: 1000,
    });
    expect(a.opens).toBe(1);
    expect(a.reviewVisits).toBe(1);
    expect(a.reviewMs).toBe(REVIEW_MIN_DWELL_MS + 5_000);

    const b = s.recordVisit("sess-1", {
      viewedMs: REVIEW_MIN_DWELL_MS + 5_000,
      hadMeaningfulScroll: true,
      hadSend: true,
      endedAt: 2000,
    });
    expect(b.opens).toBe(2);
    expect(b.reviewVisits).toBe(1);
    expect(b.lastViewedAt).toBe(2000);
  });

  it("does not count progress watching during generation as a review", () => {
    const s = store();
    const a = s.recordVisit("sess-1", {
      viewedMs: REVIEW_MIN_DWELL_MS + 5_000,
      hadMeaningfulScroll: true,
      hadSend: false,
      wasGenerating: true,
      endedAt: 1000,
    });
    expect(a.opens).toBe(1);
    expect(a.reviewVisits).toBe(0);
    expect(a.reviewMs).toBe(0);
  });

  it("resets avoidance evidence when the user sends a new message", () => {
    const s = store();
    s.recordVisit("sess-1", {
      viewedMs: 12 * 60_000,
      hadMeaningfulScroll: true,
      hadSend: false,
      endedAt: 1000,
    });
    s.recordVisit("sess-1", {
      viewedMs: 12 * 60_000,
      hadMeaningfulScroll: true,
      hadSend: false,
      endedAt: 2000,
    });

    const reset = s.recordUserMessage("sess-1", 3000);

    expect(reset).toMatchObject({
      opens: 0,
      viewMs: 0,
      reviewVisits: 0,
      reviewMs: 0,
      lastViewedAt: null,
      lastUserMessageAt: 3000,
    });
  });

  it("reloads persisted aggregates", () => {
    const s = store();
    s.recordVisit("sess-1", {
      viewedMs: REVIEW_MIN_DWELL_MS + 1,
      hadMeaningfulScroll: true,
      hadSend: false,
      endedAt: 3210,
    });
    const file = files.at(-1);
    expect(file).toBeTruthy();
    if (!file) throw new Error("missing temp file");
    const again = new EngagementStore(file);
    expect(again.get("sess-1")).toMatchObject({
      opens: 1,
      reviewVisits: 1,
      lastViewedAt: 3210,
    });
  });

  it("expires telemetry whose latest reliable timestamp is older than 180 days", () => {
    const s = store();
    const now = 200 * 86_400_000;
    s.recordVisit("old", { viewedMs: 1_000, endedAt: 1 });
    s.recordVisit("recent", { viewedMs: 1_000, endedAt: now - 10 * 86_400_000 });

    expect(s.prune(now)).toBe(1);
    expect(s.get("old")).toBeNull();
    expect(s.get("recent")).not.toBeNull();
  });
});
