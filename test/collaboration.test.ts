import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { TranscriptMsg } from "../src/chat/transcript.js";
import { CollaborationStore, projectCollaborationTurns } from "../src/core/collaboration.js";

describe("collaboration analytics", () => {
  it("projects stable user-to-assistant turns with normalized tool facts", () => {
    const messages: TranscriptMsg[] = [
      { role: "user", text: "read the current implementation", tools: [], ts: 1_000 },
      {
        role: "assistant",
        text: "I inspected it.",
        tools: [{ name: "Read", input: { file: "src/app.ts" } }],
        ts: 2_000,
      },
      { role: "user", text: "continue and run tests", tools: [], ts: 3_000 },
      {
        role: "assistant",
        text: "Done.",
        tools: [{ name: "Bash", input: { command: "npm test" } }],
        ts: 4_000,
      },
    ];

    const first = projectCollaborationTurns("claude", "s1", messages);
    const again = projectCollaborationTurns("claude", "s1", messages);

    expect(first).toHaveLength(2);
    expect(first.map((turn) => turn.turnId)).toEqual(again.map((turn) => turn.turnId));
    expect(first[0]).toMatchObject({ seq: 0, readCalls: 1, assistantChars: 15 });
    expect(first[1]).toMatchObject({ seq: 1, shellCalls: 1, testCalls: 1 });
    expect(first[1]?.previousTurnId).toBe(first[0]?.turnId);
  });

  it("stores labels and derives work mix, straight-through, and rework statistics", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-collaboration-"));
    const file = path.join(dir, "attend.sqlite3");
    const store = new CollaborationStore(file);
    const messages: TranscriptMsg[] = [
      { role: "user", text: "inspect this code", tools: [], ts: 1_000 },
      { role: "assistant", text: "Inspected.", tools: [], ts: 2_000 },
      { role: "user", text: "continue", tools: [], ts: 3_000 },
      { role: "assistant", text: "Implemented.", tools: [], ts: 4_000 },
      { role: "user", text: "that design is wrong, redo it", tools: [], ts: 5_000 },
      { role: "assistant", text: "Reworked.", tools: [], ts: 6_000 },
    ];
    const turns = projectCollaborationTurns("claude", "s1", messages);
    store.saveAnalysis("claude", "s1", "/tmp/demo", turns, [
      {
        turnId: turns[0]?.turnId ?? "",
        intent: "inspect_code",
        steering: "initiate",
        feedbackTarget: "none",
        handoff: "continue_ready",
        confidence: 0.9,
      },
      {
        turnId: turns[1]?.turnId ?? "",
        intent: "implement",
        steering: "continue",
        feedbackTarget: "code_change",
        handoff: "needs_review",
        confidence: 0.9,
      },
      {
        turnId: turns[2]?.turnId ?? "",
        intent: "design",
        steering: "reject_full",
        feedbackTarget: "design",
        handoff: "needs_review",
        confidence: 0.9,
      },
    ]);

    const stats = store.stats(0, ["s1"]);
    expect(stats).toMatchObject({
      totalTurns: 3,
      labeledTurns: 3,
      coverageRate: 1,
      feedbackSamples: 2,
      straightThroughRate: 0.5,
      reworkRate: 0.5,
      completedHandoffRate: 0,
    });
    expect(stats.intents.map((item) => item.key)).toEqual(["design", "implement", "inspect_code"]);
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("counts completed handoffs without requiring a later accept message", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-collaboration-complete-"));
    const file = path.join(dir, "attend.sqlite3");
    const store = new CollaborationStore(file);
    const messages: TranscriptMsg[] = [
      { role: "user", text: "fix it", tools: [], ts: 1_000 },
      { role: "assistant", text: "Fixed.", tools: [], ts: 2_000 },
    ];
    const turns = projectCollaborationTurns("claude", "s1", messages);
    store.saveAnalysis("claude", "s1", "/tmp/demo", turns, [
      {
        turnId: turns[0]?.turnId ?? "",
        intent: "implement",
        steering: "initiate",
        feedbackTarget: "none",
        handoff: "done",
        confidence: 0.9,
      },
    ]);

    expect(store.stats(0, ["s1"]).completedHandoffRate).toBe(1);
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
