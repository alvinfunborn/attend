import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { OverrideStore } from "../src/core/daemon/overrides.js";

const files: string[] = [];
function tmpFile(): string {
  const f = path.join(os.tmpdir(), `attend-test-ov-${Math.random().toString(36).slice(2)}.json`);
  files.push(f);
  return f;
}

afterEach(() => {
  for (const f of files.splice(0)) {
    try {
      fs.rmSync(f);
    } catch {
      /* ignore */
    }
  }
});

describe("OverrideStore", () => {
  it("pins and clamps priority and etaMin", () => {
    const store = new OverrideStore(tmpFile());
    expect(store.set("s1", { priority: 12 })).toEqual({ priority: 10 });
    expect(store.set("s1", { etaMin: 0 })).toEqual({ priority: 10, etaMin: 1 });
    expect(store.get("s1")).toEqual({ priority: 10, etaMin: 1 });
  });

  it("merges patches without dropping the untouched field", () => {
    const store = new OverrideStore(tmpFile());
    store.set("s1", { priority: 7 });
    store.set("s1", { etaMin: 30 });
    expect(store.get("s1")).toEqual({ priority: 7, etaMin: 30 });
  });

  it("pins state and pattern overrides", () => {
    const store = new OverrideStore(tmpFile());
    expect(store.set("s1", { state: "needs_review" })).toEqual({ state: "needs_review" });
    expect(store.set("s1", { pattern: "avoidance" })).toEqual({
      state: "needs_review",
      pattern: "avoidance",
    });
    expect(store.set("s1", { pattern: "unknown" })).toEqual({
      state: "needs_review",
      pattern: "unknown",
    });
  });

  it("null clears a single pin; clearing both removes the entry", () => {
    const store = new OverrideStore(tmpFile());
    store.set("s1", { priority: 5, etaMin: 20, state: "done", pattern: "avoidance" });
    expect(store.set("s1", { priority: null })?.etaMin).toBe(20);
    expect(store.get("s1")?.priority).toBeUndefined();
    expect(store.set("s1", { etaMin: null, state: null, pattern: null })).toBeNull();
    expect(store.get("s1")).toBeNull();
  });

  it("persists across instances", () => {
    const file = tmpFile();
    new OverrideStore(file).set("s2", { priority: 3, etaMin: 15 });
    expect(new OverrideStore(file).get("s2")).toEqual({ priority: 3, etaMin: 15 });
  });
});
