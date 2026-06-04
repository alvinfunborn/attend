import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TagStore } from "../src/core/tags.js";

describe("TagStore", () => {
  it("creates global tags and persists per-session assignments", () => {
    const uniq = Math.random().toString(36).slice(2);
    const file = path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`);

    const store = new TagStore(file);
    expect(store.create("work")).toEqual(["work"]);
    expect(store.setSessionTags("s1", ["work", " urgent "])).toEqual(["work", "urgent"]);

    const reloaded = new TagStore(file);
    expect(reloaded.list()).toEqual(["work", "urgent"]);
    expect(reloaded.tagsFor("s1")).toEqual(["work", "urgent"]);
  });

  it("deletes a global tag and removes it from every session", () => {
    const uniq = Math.random().toString(36).slice(2);
    const file = path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`);

    const store = new TagStore(file);
    store.setSessionTags("s1", ["work", "urgent"]);
    store.setSessionTags("s2", ["urgent"]);

    expect(store.delete("urgent")).toEqual(["work"]);
    expect(store.tagsFor("s1")).toEqual(["work"]);
    expect(store.tagsFor("s2")).toEqual([]);
  });
});
