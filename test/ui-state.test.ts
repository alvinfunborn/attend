import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SqliteDocument } from "../src/core/state-database.js";
import { VaultUiStateStore } from "../src/core/ui-state.js";

describe("VaultUiStateStore", () => {
  it("keeps Inbox todos scope-local and merges them in a multi-directory view", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-ui-inbox-"));
    const file = path.join(dir, "ui-state.json");
    const first = new VaultUiStateStore(file, "scope:first");
    const second = new VaultUiStateStore(file, "scope:second");
    const firstTodo = {
      id: "first",
      text: "First vault task",
      completed: false,
      createdAt: 1,
      updatedAt: 1,
    };
    const secondTodo = {
      id: "second",
      text: "Second vault task",
      completed: false,
      createdAt: 2,
      updatedAt: 2,
    };
    first.patch({ inboxTodos: [firstTodo] });
    second.patch({ inboxTodos: [secondTodo] });

    expect(new VaultUiStateStore(file, "scope:first").get().inboxTodos).toEqual([firstTodo]);
    expect(new VaultUiStateStore(file, "scope:second").get().inboxTodos).toEqual([secondTodo]);

    const combined = new VaultUiStateStore(file, "scope:combined", undefined, [
      "scope:first",
      "scope:second",
    ]);
    expect(combined.get().inboxTodos).toEqual([firstTodo, secondTodo]);
    combined.patch({ inboxTodos: [firstTodo, secondTodo] });
    expect(new VaultUiStateStore(file, "scope:first").get().inboxTodos).toEqual([
      firstTodo,
      secondTodo,
    ]);
    expect(new VaultUiStateStore(file, "scope:second").get().inboxTodos).toEqual([
      firstTodo,
      secondTodo,
    ]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("persists exact session configs and does not let observations replace them", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-session-config-"));
    const file = path.join(dir, "ui-state.json");
    const store = new VaultUiStateStore(file);

    store.recordSessionRunConfig("cursor", "same-id", {
      model: "gpt-5.3-codex",
      effort: "high",
    });
    store.recordSessionRunConfig(
      "cursor",
      "same-id",
      { model: "Composer 2.5", speed: "true" },
      { observed: true },
    );
    store.recordSessionRunConfig("codex", "same-id", { model: "gpt-5.5", effort: "xhigh" });

    expect(new VaultUiStateStore(file).get().sessionRunConfigs).toMatchObject({
      "cursor:same-id": {
        model: "gpt-5.3-codex",
        effort: "high",
        speed: "true",
        updatedAt: expect.any(Number),
      },
      "codex:same-id": {
        model: "gpt-5.5",
        effort: "xhigh",
        updatedAt: expect.any(Number),
      },
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("persists browser-independent UI data in one vault file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-ui-state-"));
    const file = path.join(dir, ".attend", "ui-state.json");
    new VaultUiStateStore(file).patch({
      theme: "dark",
      focusViews: [{ id: "f1", name: "Work", tags: ["work"] }],
      modelPrefs: { codex: { model: "gpt-5.6-sol", effort: "medium" } },
      pinnedTags: [" urgent ", "work", "urgent"],
      hiddenTags: [" stable ", "later", "stable"],
      shortcuts: [{ id: "sc1", text: "Run the tests", createdAt: 10, updatedAt: 10 }],
      sessionNotes: {
        s1: [{ id: "n1", text: "Keep the old schema", createdAt: 11, updatedAt: 11 }],
      },
      sessionTodos: {
        s1: [
          { id: "t1", text: "Verify migration", completed: false, createdAt: 12, updatedAt: 12 },
        ],
      },
      sessionGoals: {
        s1: {
          objective: "Ship a verified fix",
          vendor: "codex",
          status: "active",
          updatedAt: 13,
        },
      },
      pins: { "attend.pins.v1:s1": [{ key: "m:1", text: "keep" }] },
      sessionPins: { s1: 123 },
      sessionTitles: { s1: "Customer escalation" },
      forkParents: { s2: "s1" },
      chatGroups: {
        g1: {
          id: "g1",
          members: [
            { vendor: "claude", sessionId: "s1" },
            { vendor: "codex", sessionId: "s2" },
          ],
          updatedAt: 124,
        },
      },
      commentThreads: {
        c1: {
          id: "c1",
          parentSessionId: "s1",
          anchorKey: "assistant:1",
          anchorText: "explanation",
          providerSessionId: "side-1",
          vendor: "claude",
          cwd: dir,
          createdAt: 123,
          lastUserMessageAt: 456,
          lastUserText: "Can you verify the edge case?",
          status: "unread",
          messageCount: 2,
        },
      },
    });

    expect(new VaultUiStateStore(file).get()).toMatchObject({
      theme: "dark",
      focusViews: [{ id: "f1", name: "Work", tags: ["work"] }],
      modelPrefs: { codex: { model: "gpt-5.6-sol", effort: "medium" } },
      pinnedTags: ["urgent", "work"],
      hiddenTags: ["stable", "later"],
      shortcuts: [{ id: "sc1", text: "Run the tests", createdAt: 10, updatedAt: 10 }],
      sessionNotes: { s1: [expect.objectContaining({ id: "n1", text: "Keep the old schema" })] },
      sessionTodos: {
        s1: [expect.objectContaining({ id: "t1", text: "Verify migration", completed: false })],
      },
      sessionGoals: {
        s1: {
          objective: "Ship a verified fix",
          vendor: "codex",
          status: "active",
          updatedAt: 13,
        },
      },
      pins: { "attend.pins.v1:s1": [{ key: "m:1", text: "keep" }] },
      sessionPins: { s1: 123 },
      sessionTitles: { s1: "Customer escalation" },
      forkParents: { s2: "s1" },
      chatGroups: {
        g1: {
          id: "g1",
          members: [
            { vendor: "claude", sessionId: "s1" },
            { vendor: "codex", sessionId: "s2" },
          ],
          updatedAt: 124,
        },
      },
      commentThreads: {
        c1: expect.objectContaining({
          parentSessionId: "s1",
          anchorKey: "assistant:1",
          providerSessionId: "side-1",
          status: "unread",
          messageCount: 2,
          lastUserMessageAt: 456,
          lastUserText: "Can you verify the edge case?",
        }),
      },
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("merges record deltas from independent server instances", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-ui-concurrent-"));
    const file = path.join(dir, "ui-state.json");
    const first = new VaultUiStateStore(file);
    const second = new VaultUiStateStore(file);
    first.patch({
      sessionTitles: { s1: "One" },
      pins: { s1: [{ key: "a" }] },
      chatGroups: {
        g1: {
          id: "g1",
          members: [
            { vendor: "claude", sessionId: "s1" },
            { vendor: "claude", sessionId: "s2" },
          ],
          updatedAt: 1,
        },
      },
    });
    second.patch({
      sessionTitles: { s2: "Two" },
      pins: { s2: [{ key: "b" }] },
      chatGroups: {
        g2: {
          id: "g2",
          members: [
            { vendor: "codex", sessionId: "s3" },
            { vendor: "codex", sessionId: "s4" },
          ],
          updatedAt: 2,
        },
      },
    });
    first.patch({ sessionTitles: { s1: null }, pins: { s1: null }, chatGroups: { g1: null } });
    expect(second.get()).toMatchObject({
      sessionTitles: { s2: "Two" },
      pins: { s2: [{ key: "b" }] },
    });
    expect(second.get().sessionTitles).not.toHaveProperty("s1");
    expect(second.get().pins).not.toHaveProperty("s1");
    expect(second.get().chatGroups).toEqual({
      g2: {
        id: "g2",
        members: [
          { vendor: "codex", sessionId: "s3" },
          { vendor: "codex", sessionId: "s4" },
        ],
        updatedAt: 2,
      },
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("persists successful new-session directory use as an MRU", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-dir-mru-"));
    const file = path.join(dir, "ui-state.json");
    const store = new VaultUiStateStore(file);
    const first = path.join(dir, "first");
    const second = path.join(dir, "second");

    store.recordDirectoryUse(first, 10);
    store.recordDirectoryUse(second, 20);
    store.recordDirectoryUse(first, 30);

    expect(new VaultUiStateStore(file).get().recentDirectories).toEqual({
      [first]: 30,
      [second]: 20,
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("normalizes text collections and preserves todo completion", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-ui-text-items-"));
    const file = path.join(dir, "ui-state.json");
    const store = new VaultUiStateStore(file);
    store.patch({
      shortcuts: [
        { id: " s1 ", text: "  reusable text  ", createdAt: 1, updatedAt: 2 },
        { id: "s1", text: "duplicate", createdAt: 3, updatedAt: 3 },
      ],
      sessionTodos: {
        session: [
          {
            id: "todo",
            text: " Finished item ",
            completed: true,
            completedAt: 9,
            createdAt: 4,
            updatedAt: 9,
          },
        ],
      },
    });
    expect(store.get().shortcuts).toEqual([
      { id: "s1", text: "reusable text", createdAt: 1, updatedAt: 2 },
    ]);
    expect(store.get().sessionTodos?.session).toEqual([
      {
        id: "todo",
        text: "Finished item",
        completed: true,
        completedAt: 9,
        createdAt: 4,
        updatedAt: 9,
      },
    ]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("protects composer text from an older Attend process rewriting ui-state", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-ui-text-compat-"));
    const file = path.join(dir, "ui-state.json");
    const database = path.join(dir, "attend.sqlite3");
    const store = new VaultUiStateStore(file, "scope:test", database);
    store.patch({
      shortcuts: [{ id: "shortcut", text: "Keep me", createdAt: 1, updatedAt: 1 }],
      sessionNotes: {
        session: [{ id: "note", text: "Still here", createdAt: 2, updatedAt: 2 }],
      },
      sessionTodos: {
        session: [{ id: "todo", text: "Do this", completed: false, createdAt: 3, updatedAt: 3 }],
      },
    });

    const oldWriter = new SqliteDocument<Record<string, unknown>>(
      database,
      "ui-state",
      file,
      (value) => {
        const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
        return "theme" in input ? { theme: input.theme } : {};
      },
    );
    oldWriter.update((state) => {
      state.theme = "dark";
    });
    oldWriter.close();

    expect(new VaultUiStateStore(file, "scope:test", database).get()).toMatchObject({
      shortcuts: [expect.objectContaining({ id: "shortcut" })],
      sessionNotes: { session: [expect.objectContaining({ id: "note" })] },
      sessionTodos: { session: [expect.objectContaining({ id: "todo" })] },
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("merges focus-view changes by id across independent instances", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-focus-concurrent-"));
    const file = path.join(dir, "ui-state.json");
    const first = new VaultUiStateStore(file);
    const second = new VaultUiStateStore(file);
    first.patch({ focusViewPatch: { f1: { id: "f1", name: "One", tags: [] } } });
    second.patch({ focusViewPatch: { f2: { id: "f2", name: "Two", tags: ["work"] } } });
    first.patch({ focusViewPatch: { f1: null } });

    expect(second.get().focusViews).toEqual([{ id: "f2", name: "Two", tags: ["work"] }]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("isolates focus views and tag display state by scope while keeping session state shared", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-focus-scopes-"));
    const file = path.join(dir, "ui-state.json");
    const parent = new VaultUiStateStore(file, "scope:parent");
    const child = new VaultUiStateStore(file, "scope:child");
    parent.patch({
      focusViewPatch: { parent: { id: "parent", name: "Parent", tags: ["backend"] } },
      pinnedTags: ["urgent"],
      hiddenTags: ["stable"],
      sessionTitles: { s1: "Shared title" },
      chatGroups: {
        shared: {
          id: "shared",
          members: [
            { vendor: "claude", sessionId: "s1" },
            { vendor: "claude", sessionId: "s2" },
          ],
          updatedAt: 10,
        },
      },
    });
    child.patch({
      focusViewPatch: { child: { id: "child", name: "Child", tags: ["frontend"] } },
      pinnedTags: ["later"],
      hiddenTags: [],
    });

    expect(parent.get().focusViews).toEqual([{ id: "parent", name: "Parent", tags: ["backend"] }]);
    expect(child.get().focusViews).toEqual([{ id: "child", name: "Child", tags: ["frontend"] }]);
    expect(parent.get().pinnedTags).toEqual(["urgent"]);
    expect(parent.get().hiddenTags).toEqual(["stable"]);
    expect(child.get().pinnedTags).toEqual(["later"]);
    expect(child.get().hiddenTags).toEqual([]);
    expect(child.get().sessionTitles).toEqual({ s1: "Shared title" });
    expect(child.get().chatGroups).toEqual(parent.get().chatGroups);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("inherits tag display state from individual scopes in a combined scope", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-combined-scope-"));
    const file = path.join(dir, "ui-state.json");
    new VaultUiStateStore(file, "scope:first").patch({
      focusViewPatch: { first: { id: "first", name: "First", tags: [] } },
      pinnedTags: ["urgent"],
      hiddenTags: ["stable", "shared"],
    });
    new VaultUiStateStore(file, "scope:second").patch({
      focusViewPatch: { second: { id: "second", name: "Second", tags: [] } },
      pinnedTags: ["later", "urgent"],
      hiddenTags: ["shared", "someday"],
    });
    new VaultUiStateStore(file, "scope:combined").patch({
      focusViewPatch: { stale: { id: "stale", name: "Stale", tags: [] } },
      pinnedTags: ["stale-pin"],
      hiddenTags: ["stale-hidden"],
    });

    const combined = new VaultUiStateStore(file, "scope:combined", undefined, [
      "scope:first",
      "scope:second",
    ]);
    expect(combined.get().focusViews).toEqual([
      { id: "first", name: "First", tags: [] },
      { id: "second", name: "Second", tags: [] },
    ]);
    expect(combined.get().pinnedTags).toEqual(["urgent", "later"]);
    expect(combined.get().hiddenTags).toEqual(["stable", "shared", "someday"]);

    combined.patch({
      focusViewPatch: { combined: { id: "combined", name: "Combined", tags: [] } },
      pinnedTags: ["urgent", "later"],
      hiddenTags: [],
    });
    expect(combined.get().hiddenTags).toEqual([]);
    expect(combined.get().pinnedTags).toEqual(["urgent", "later"]);
    expect(combined.get().focusViews).toEqual([
      { id: "first", name: "First", tags: [] },
      { id: "combined", name: "Combined", tags: [] },
      { id: "second", name: "Second", tags: [] },
    ]);
    expect(new VaultUiStateStore(file, "scope:first").get()).toMatchObject({
      focusViews: [
        { id: "first", name: "First", tags: [] },
        { id: "combined", name: "Combined", tags: [] },
      ],
      pinnedTags: ["urgent", "later"],
      hiddenTags: [],
    });
    expect(new VaultUiStateStore(file, "scope:second").get()).toMatchObject({
      focusViews: [
        { id: "second", name: "Second", tags: [] },
        { id: "combined", name: "Combined", tags: [] },
      ],
      pinnedTags: ["urgent", "later"],
      hiddenTags: [],
    });
    const persisted = JSON.parse(fs.readFileSync(file, "utf8")) as {
      scopes?: Record<string, unknown>;
    };
    expect(persisted.scopes).not.toHaveProperty("scope:combined");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("uses legacy global view preferences as a migration fallback per scope", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-focus-legacy-"));
    const file = path.join(dir, "ui-state.json");
    fs.writeFileSync(
      file,
      JSON.stringify({
        focusViews: [{ id: "legacy", name: "Legacy", tags: [] }],
        pinnedTags: ["legacy-pin"],
        hiddenTags: ["legacy-hidden"],
      }),
    );
    const parent = new VaultUiStateStore(file, "scope:parent");
    const child = new VaultUiStateStore(file, "scope:child");
    parent.patch({ focusViewPatch: { parent: { id: "parent", name: "Parent", tags: [] } } });

    expect(parent.get().focusViews).toEqual([
      { id: "legacy", name: "Legacy", tags: [] },
      { id: "parent", name: "Parent", tags: [] },
    ]);
    expect(child.get().focusViews).toEqual([{ id: "legacy", name: "Legacy", tags: [] }]);
    expect(parent.get().pinnedTags).toEqual(["legacy-pin"]);
    expect(child.get().hiddenTags).toEqual(["legacy-hidden"]);

    parent.patch({ pinnedTags: [], hiddenTags: ["parent-hidden"] });
    expect(parent.get().pinnedTags).toEqual([]);
    expect(parent.get().hiddenTags).toEqual(["parent-hidden"]);
    expect(child.get().pinnedTags).toEqual(["legacy-pin"]);
    expect(child.get().hiddenTags).toEqual(["legacy-hidden"]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("expires old read comments while preserving pending and failed threads", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-comment-retention-"));
    const file = path.join(dir, "ui-state.json");
    const store = new VaultUiStateStore(file);
    const thread = {
      parentSessionId: "parent",
      anchorKey: "assistant:1",
      anchorText: "answer",
      providerSessionId: "side",
      vendor: "claude",
      cwd: dir,
      createdAt: 1,
      messageCount: 1,
    };
    store.patch({
      commentThreads: {
        read: { ...thread, id: "read", status: "read" },
        unread: { ...thread, id: "unread", status: "unread" },
        failed: { ...thread, id: "failed", status: "failed" },
      },
    });

    expect(store.pruneReadComments(200 * 86_400_000)).toBe(1);
    expect(store.get().commentThreads).not.toHaveProperty("read");
    expect(store.get().commentThreads).toHaveProperty("unread");
    expect(store.get().commentThreads).toHaveProperty("failed");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
