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
});
