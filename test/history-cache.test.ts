import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TranscriptHistoryCache } from "../src/chat/history-cache.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function codexMessage(role: "user" | "assistant", text: string): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    type: "response_item",
    payload: {
      type: "message",
      role,
      content: [{ type: role === "user" ? "input_text" : "output_text", text }],
    },
  });
}

describe("TranscriptHistoryCache", () => {
  it("reads a bounded suffix, caches it by file version, and refreshes after append", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-history-tail-"));
    dirs.push(dir);
    const file = path.join(dir, "rollout-large.jsonl");
    const ignored = JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "event_msg",
      payload: { type: "reasoning", text: "x".repeat(220_000) },
    });
    const lines = Array.from({ length: 28 }, () => ignored);
    for (let index = 0; index < 260; index++) {
      lines.push(codexMessage("user", `question ${index}`));
      lines.push(codexMessage("assistant", `answer ${index}`));
    }
    fs.writeFileSync(file, lines.join("\n"));

    const cache = new TranscriptHistoryCache();
    const first = await cache.read(file, "codex", 200);

    expect(first.messages).toHaveLength(200);
    expect(first.messages[0]).toMatchObject({
      role: "user",
      text: "question 160",
      historyOrdinal: 0,
    });
    expect(first.messages.at(-1)).toMatchObject({
      role: "assistant",
      text: "answer 259",
      historyOrdinal: 199,
    });
    expect(first.bytesRead).toBeLessThan(fs.statSync(file).size);
    expect(first.truncatedBefore).toBe(true);

    const cached = await cache.read(file, "codex", 200);
    expect(cached).toBe(first);

    const stableAnswerId = first.messages.find(
      (message) => message.text === "answer 259",
    )?.historyId;
    expect(stableAnswerId).toMatch(/^m_/);
    fs.appendFileSync(file, `\n${codexMessage("assistant", "answer after append")}`);
    const refreshed = await cache.read(file, "codex", 200);
    expect(refreshed.version).not.toBe(first.version);
    expect(refreshed.messages.at(-1)?.text).toBe("answer after append");
    expect(refreshed.messages.find((message) => message.text === "answer 259")?.historyId).toBe(
      stableAnswerId,
    );
    expect(refreshed.messages.find((message) => message.text === "answer 259")?.historyIndex).toBe(
      198,
    );
  });

  it("stops expanding a sparse transcript at its configured byte ceiling", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-history-cap-"));
    dirs.push(dir);
    const file = path.join(dir, "rollout-sparse.jsonl");
    const oversizedReasoning = JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "event_msg",
      payload: { type: "reasoning", text: "x".repeat(900_000) },
    });
    fs.writeFileSync(file, `${oversizedReasoning}\n${codexMessage("assistant", "latest answer")}`);

    const maxTailBytes = 512 * 1024;
    const cache = new TranscriptHistoryCache(64, 48 * 1024 * 1024, maxTailBytes);
    const snapshot = await cache.read(file, "codex", 200);

    expect(snapshot.bytesRead).toBe(maxTailBytes);
    expect(snapshot.truncatedBefore).toBe(true);
    expect(snapshot.messages).toEqual([
      expect.objectContaining({ role: "assistant", text: "latest answer", historyOrdinal: 0 }),
    ]);
  });
});
