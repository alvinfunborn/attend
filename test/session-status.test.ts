import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SessionStatusStore } from "../src/core/session-status.js";

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
    `attend-session-status-${Math.random().toString(36).slice(2)}.json`,
  );
  files.push(file);
  return new SessionStatusStore(file);
}

describe("SessionStatusStore", () => {
  it("persists unfinished states and deletes them when marked read", () => {
    const s = store();
    expect(s.set("sess-1", "seen", 1234)).toMatchObject({ state: "seen", updatedAt: 1234 });
    expect(s.get("sess-1")).toMatchObject({ state: "seen", updatedAt: 1234 });

    const file = files.at(-1);
    expect(file).toBeTruthy();
    if (!file) throw new Error("missing temp file");
    const again = new SessionStatusStore(file);
    expect(again.state("sess-1")).toBe("seen");

    expect(again.set("sess-1", "read", 2345)).toBeNull();
    expect(again.get("sess-1")).toBeNull();
    expect(again.state("sess-1")).toBe("read");
  });

  it("keeps the newest attention mutation when requests arrive out of order", () => {
    const s = store();
    expect(s.set("sess-1", "unread", 3000)).toMatchObject({
      state: "unread",
      updatedAt: 3000,
    });

    expect(s.set("sess-1", "seen", 2000)).toMatchObject({
      state: "unread",
      updatedAt: 3000,
    });
    expect(s.set("sess-1", "read", 2500)).toMatchObject({
      state: "unread",
      updatedAt: 3000,
    });
  });

  it("keeps a newer read tombstone from being resurrected by a late request", () => {
    const s = store();
    expect(s.set("sess-1", "read", 3000)).toBeNull();
    expect(s.set("sess-1", "unread", 2000)).toBeNull();
    expect(s.state("sess-1")).toBe("read");
  });

  it("expires only timestamped transient states older than 180 days", () => {
    const s = store();
    const now = 200 * 86_400_000;
    s.set("old", "seen", 1);
    s.set("recent", "unread", now - 10 * 86_400_000);

    expect(s.prune(now)).toBe(1);
    expect(s.get("old")).toBeNull();
    expect(s.state("recent")).toBe("unread");
  });
});
