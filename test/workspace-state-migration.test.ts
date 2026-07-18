import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ChatQueueStore } from "../src/chat/queue.js";
import { resolveConfig } from "../src/config.js";
import { SessionStatusStore } from "../src/core/session-status.js";
import { TagStore } from "../src/core/tags.js";
import { VaultUiStateStore } from "../src/core/ui-state.js";
import { WorkEventStore } from "../src/core/work-events.js";
import { migrateWorkspaceState } from "../src/core/workspace-state-migration.js";

describe("migrateWorkspaceState", () => {
  it("idempotently imports workspace-local stores into the global data home", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-workspace-migration-"));
    const dataHome = path.join(root, "global");
    const workspace = path.join(root, "workspace");
    const local = path.join(workspace, ".attend");
    fs.mkdirSync(local, { recursive: true });
    fs.writeFileSync(
      path.join(local, "tags.json"),
      JSON.stringify({ tags: ["work"], sessions: { s1: ["work"] } }),
    );
    fs.writeFileSync(
      path.join(local, "ui-state.json"),
      JSON.stringify({
        shortcuts: [{ id: "shortcut-1", text: "Review changes", createdAt: 1, updatedAt: 1 }],
        sessionNotes: {
          s1: [{ id: "note-1", text: "Keep context", createdAt: 2, updatedAt: 2 }],
        },
        sessionTodos: {
          s1: [
            {
              id: "todo-1",
              text: "Verify migration",
              completed: false,
              createdAt: 3,
              updatedAt: 3,
            },
          ],
        },
        sessionTitles: { s1: "Local title" },
        sessionRunConfigs: {
          "claude:s1": { model: "claude-opus", effort: "high", updatedAt: 4 },
        },
        pins: { s1: [{ key: "p1" }] },
      }),
    );
    fs.writeFileSync(
      path.join(local, "chat-queues.json"),
      JSON.stringify({
        sessions: {
          s1: {
            parked: false,
            items: [
              {
                id: "q1",
                sessionId: "s1",
                cwd: workspace,
                vendor: "claude",
                text: "next",
                createdAt: 1,
              },
            ],
          },
        },
      }),
    );
    fs.writeFileSync(
      path.join(local, "work-events.json"),
      JSON.stringify({
        version: 1,
        events: [
          { id: "e1", kind: "turn_started", at: Date.now(), sessionId: "s1", source: "live" },
        ],
      }),
    );
    fs.writeFileSync(
      path.join(local, "session-status.json"),
      JSON.stringify({ sessions: { s1: { state: "unread", updatedAt: 1 } } }),
    );

    const config = {
      ...resolveConfig({ positionals: [workspace] }),
      tags: path.join(dataHome, "tags.json"),
      overrides: path.join(dataHome, "overrides.json"),
      engagement: path.join(dataHome, "engagement.json"),
      sessionStatus: path.join(dataHome, "session-status.json"),
      uiState: path.join(dataHome, "ui-state.json"),
      chatQueue: path.join(dataHome, "chat-queues.json"),
      workEvents: path.join(dataHome, "attend.sqlite3"),
    };
    fs.mkdirSync(dataHome, { recursive: true });
    // Version 1 marked roots after omitting shortcuts/notes/todos. Version 2
    // intentionally reruns the idempotent merge so those collections recover.
    fs.writeFileSync(
      path.join(dataHome, "workspace-state-migrations.json"),
      JSON.stringify({ version: 1, roots: { [fs.realpathSync(workspace)]: Date.now() } }),
    );
    migrateWorkspaceState(config);

    expect(new TagStore(config.tags, config.workEvents).tagsFor("s1")).toEqual(["work"]);
    expect(new VaultUiStateStore(config.uiState, undefined, config.workEvents).get()).toMatchObject(
      {
        sessionTitles: { s1: "Local title" },
        sessionRunConfigs: {
          "claude:s1": { model: "claude-opus", effort: "high", updatedAt: 4 },
        },
        pins: { s1: [{ key: "p1" }] },
        shortcuts: [expect.objectContaining({ id: "shortcut-1", text: "Review changes" })],
        sessionNotes: { s1: [expect.objectContaining({ id: "note-1" })] },
        sessionTodos: {
          s1: [expect.objectContaining({ id: "todo-1", completed: false })],
        },
      },
    );
    expect(new ChatQueueStore(config.chatQueue, config.workEvents).peek("s1")?.text).toBe("next");
    expect(new WorkEventStore(config.workEvents).list().map((event) => event.id)).toEqual(["e1"]);
    expect(new SessionStatusStore(config.sessionStatus, config.workEvents).state("s1")).toBe(
      "unread",
    );

    new TagStore(config.tags, config.workEvents).setSessionTags("s1", []);
    migrateWorkspaceState(config);
    expect(new TagStore(config.tags, config.workEvents).tagsFor("s1")).toEqual([]);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
