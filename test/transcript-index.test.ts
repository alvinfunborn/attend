import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TranscriptPathIndex } from "../src/core/vendor/transcript-index.js";

const cleanup: string[] = [];

afterEach(() => {
  for (const target of cleanup.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

describe("TranscriptPathIndex", () => {
  it("replaces one vendor snapshot without disturbing another", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-transcript-index-"));
    cleanup.push(dir);
    const claude = path.join(dir, "claude.jsonl");
    const codex = path.join(dir, "codex.jsonl");
    fs.writeFileSync(claude, "");
    fs.writeFileSync(codex, "");
    const index = new TranscriptPathIndex();
    const session = (vendor: string, sessionId: string, file: string) => ({
      path: file,
      vendor,
      sessionId,
      title: null,
      lastPrompt: null,
      lastTurnChars: 0,
      chars: 0,
      cwd: null,
      firstTs: null,
      lastTs: null,
      prompts: 0,
      actions: 0,
      visits: 0,
    });

    index.replaceVendor("claude", [session("claude", "cl-1", claude)]);
    index.replaceVendor("codex", [session("codex", "cx-1", codex)]);
    expect(index.get("claude", "cl-1")).toBe(claude);
    expect(index.get("codex", "cx-1")).toBe(codex);

    index.replaceVendor("claude", []);
    expect(index.get("claude", "cl-1")).toBeNull();
    expect(index.get("codex", "cx-1")).toBe(codex);
  });

  it("invalidates a path after the transcript disappears", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-transcript-index-stale-"));
    cleanup.push(dir);
    const file = path.join(dir, "gone.jsonl");
    fs.writeFileSync(file, "");
    const index = new TranscriptPathIndex();
    index.set("codex", "gone", file);
    expect(index.get("codex", "gone")).toBe(file);
    fs.rmSync(file);
    expect(index.get("codex", "gone")).toBeNull();
  });
});
