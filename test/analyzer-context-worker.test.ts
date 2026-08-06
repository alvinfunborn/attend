import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import { WorkerAnalyzerContext } from "../src/chat/analyzer/context-worker-client.js";

describe("worker-backed analyzer context", () => {
  it("parses and condenses a large full transcript without starving the main event loop", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-analyzer-context-"));
    const file = path.join(root, "large.jsonl");
    const opening = `${JSON.stringify({
      type: "user",
      timestamp: new Date(Date.now() - 60_000).toISOString(),
      message: { content: "investigate the original performance problem" },
    })}\n`;
    const filler = `${JSON.stringify({
      type: "assistant",
      timestamp: new Date(Date.now() - 30_000).toISOString(),
      message: { content: [{ type: "text", text: `background ${"x".repeat(2_048)}` }] },
    })}\n`;
    const latest = `${JSON.stringify({
      type: "user",
      timestamp: new Date().toISOString(),
      message: { content: "ship the worker refactor" },
    })}\n`;
    fs.writeFileSync(file, opening + filler.repeat(6_000) + latest);

    const reader = new WorkerAnalyzerContext();
    let ticks = 0;
    const ticker = setInterval(() => {
      ticks += 1;
    }, 2);
    try {
      const context = await reader.readAnalyzerContext(file, "claude", "large-session");
      expect(context.transcript).toContain("investigate the original performance problem");
      expect(context.transcript).toContain("ship the worker refactor");
      expect(context.observedTurns).toHaveLength(2);
      expect(ticks).toBeGreaterThan(2);
    } finally {
      clearInterval(ticker);
      reader.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 15_000);

  it("restarts after an unexpected worker exit", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-analyzer-restart-"));
    const file = path.join(root, "session.jsonl");
    fs.writeFileSync(
      file,
      `${JSON.stringify({ type: "user", message: { content: "recover context" } })}\n`,
    );
    const reader = new WorkerAnalyzerContext();
    try {
      const internal = reader as unknown as { worker: Worker | null };
      await internal.worker?.terminate();
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
      const context = await reader.readAnalyzerContext(file, "claude", "restart-session");
      expect(context.transcript).toContain("recover context");
    } finally {
      reader.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
