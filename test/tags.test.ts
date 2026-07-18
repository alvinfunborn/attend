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

  it("merges tag assignments across stable aliases", () => {
    const uniq = Math.random().toString(36).slice(2);
    const file = path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`);

    const store = new TagStore(file);
    store.setSessionTags("session-id", ["work"]);
    store.setSessionTags("brief:claude:/tmp/project:Fix login", ["urgent", "work"]);

    expect(store.tagsFor(["session-id", "brief:claude:/tmp/project:Fix login"])).toEqual([
      "work",
      "urgent",
    ]);
  });

  it("reloads external changes before writing from another store instance", () => {
    const uniq = Math.random().toString(36).slice(2);
    const file = path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`);

    const firstVault = new TagStore(file);
    const secondVault = new TagStore(file);

    expect(secondVault.list()).toEqual([]);
    firstVault.setSessionTags("s1", ["work"]);
    secondVault.setSessionTags("s2", ["urgent"]);

    const reloaded = new TagStore(file);
    expect(reloaded.tagsFor("s1")).toEqual(["work"]);
    expect(reloaded.tagsFor("s2")).toEqual(["urgent"]);
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

  it("clears every session binding without deleting the global tag", () => {
    const uniq = Math.random().toString(36).slice(2);
    const file = path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`);

    const store = new TagStore(file);
    store.setSessionTags("s1", ["work", "urgent"]);
    store.setSessionTags("s2", ["urgent"]);
    store.setSessionTags("scope-id:vault", ["urgent"]);

    expect(store.clearSessionBindings("urgent")).toEqual(["work", "urgent"]);
    expect(store.list()).toEqual(["work", "urgent"]);
    expect(store.tagsFor("s1")).toEqual(["work"]);
    expect(store.tagsFor("s2")).toEqual([]);
    expect(store.tagsFor("scope-id:vault")).toEqual(["urgent"]);
  });

  it("reorders global tags while preserving unmentioned tags in place", () => {
    const uniq = Math.random().toString(36).slice(2);
    const file = path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`);

    const store = new TagStore(file);
    store.setSessionTags("s1", ["work", "urgent", "later"]);

    expect(store.reorder(["later", "work"])).toEqual(["later", "urgent", "work"]);
    expect(store.tagsFor("s1")).toEqual(["later", "urgent", "work"]);
  });
});
