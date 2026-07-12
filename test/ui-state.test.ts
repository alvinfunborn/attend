import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VaultUiStateStore } from "../src/core/ui-state.js";

describe("VaultUiStateStore", () => {
  it("persists browser-independent UI data in one vault file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-ui-state-"));
    const file = path.join(dir, ".attend", "ui-state.json");
    new VaultUiStateStore(file).patch({
      theme: "dark",
      focusViews: [{ id: "f1", name: "Work", tags: ["work"] }],
      modelPrefs: { codex: { model: "gpt-5.6-sol", effort: "medium" } },
      pins: { "attend.pins.v1:s1": [{ key: "m:1", text: "keep" }] },
      sessionTitles: { s1: "Customer escalation" },
      forkParents: { s2: "s1" },
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
          status: "unread",
          messageCount: 2,
        },
      },
    });

    expect(new VaultUiStateStore(file).get()).toMatchObject({
      theme: "dark",
      focusViews: [{ id: "f1", name: "Work", tags: ["work"] }],
      modelPrefs: { codex: { model: "gpt-5.6-sol", effort: "medium" } },
      pins: { "attend.pins.v1:s1": [{ key: "m:1", text: "keep" }] },
      sessionTitles: { s1: "Customer escalation" },
      forkParents: { s2: "s1" },
      commentThreads: {
        c1: expect.objectContaining({
          parentSessionId: "s1",
          anchorKey: "assistant:1",
          providerSessionId: "side-1",
          status: "unread",
          messageCount: 2,
        }),
      },
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
