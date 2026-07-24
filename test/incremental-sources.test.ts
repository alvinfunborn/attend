import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ClaudeSource } from "../src/core/vendor/claude.js";
import { CodexSource } from "../src/core/vendor/codex.js";
import { CursorSource } from "../src/core/vendor/cursor.js";
import { ScanCache } from "../src/core/vendor/scan-cache.js";
import { TranscriptPathIndex } from "../src/core/vendor/transcript-index.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("incremental vendor sources", () => {
  it("updates Claude aggregate state and its transcript index from appended rows", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-claude-incremental-"));
    roots.push(root);
    const project = path.join(root, "encoded-project");
    const file = path.join(project, "claude-session.jsonl");
    fs.mkdirSync(project);
    fs.writeFileSync(
      file,
      JSON.stringify({
        type: "user",
        sessionId: "claude-session",
        message: { content: "first" },
      }),
    );
    const index = new TranscriptPathIndex();
    const source = new ClaudeSource(root, new ScanCache(), index);

    expect(source.scan()[0]).toMatchObject({ prompts: 1, lastPrompt: "first" });
    expect(index.get("claude", "claude-session")).toBe(file);

    fs.appendFileSync(
      file,
      `\n${JSON.stringify({
        type: "user",
        sessionId: "claude-session",
        message: { content: "second" },
      })}`,
    );
    expect(source.scan()[0]).toMatchObject({ prompts: 2, lastPrompt: "second" });
  });

  it("updates Codex active state and its transcript index from appended rows", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-codex-incremental-"));
    roots.push(root);
    const file = path.join(root, "rollout-codex-session.jsonl");
    fs.writeFileSync(
      file,
      [
        JSON.stringify({
          type: "session_meta",
          payload: { id: "codex-session", cwd: "/work" },
        }),
        JSON.stringify({
          type: "event_msg",
          payload: { type: "task_started", turn_id: "turn-1" },
        }),
      ].join("\n"),
    );
    const index = new TranscriptPathIndex();
    const source = new CodexSource(root, new ScanCache(), index);

    expect(source.scan()[0]?.active).toBe(true);
    expect(index.get("codex", "codex-session")).toBe(file);

    fs.appendFileSync(
      file,
      `\n${JSON.stringify({
        type: "event_msg",
        payload: { type: "task_complete", turn_id: "turn-1" },
      })}`,
    );
    expect(source.scan()[0]?.active).toBeUndefined();
  });

  it("merges appended Cursor partial output without double-counting text", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-cursor-incremental-"));
    roots.push(root);
    const captured = path.join(root, "captured");
    const file = path.join(captured, "cursor-session.jsonl");
    fs.mkdirSync(captured);
    fs.writeFileSync(
      file,
      JSON.stringify({
        type: "user",
        session_id: "cursor-session",
        message: { content: [{ type: "text", text: "question" }] },
        _attend: { timestamp: 1, cwd: "/work" },
      }),
    );
    const index = new TranscriptPathIndex();
    const source = new CursorSource(
      path.join(root, "missing-native"),
      captured,
      new ScanCache(),
      new ScanCache(),
      index,
    );

    expect(source.scan()[0]).toMatchObject({ prompts: 1, chars: 8 });
    fs.appendFileSync(
      file,
      `\n${JSON.stringify({
        type: "assistant",
        session_id: "cursor-session",
        message: { content: [{ type: "text", text: "CUR" }] },
        _attend: { timestamp: 2, cwd: "/work" },
      })}\n${JSON.stringify({
        type: "assistant",
        session_id: "cursor-session",
        message: { content: [{ type: "text", text: "SOR" }] },
        _attend: { timestamp: 3, cwd: "/work" },
      })}\n${JSON.stringify({
        type: "assistant",
        session_id: "cursor-session",
        message: { content: [{ type: "text", text: "CURSOR" }] },
        _attend: { timestamp: 4, cwd: "/work" },
      })}`,
    );
    expect(source.scan()[0]).toMatchObject({ lastTurnChars: 6, chars: 14 });
    expect(index.get("cursor", "cursor-session")).toBe(file);
  });
});
