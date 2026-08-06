import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WorkerAlignmentModel } from "../src/core/alignment-model.js";

describe("WorkerAlignmentModel", () => {
  it("builds a large memory model without starving the main event loop", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-alignment-worker-"));
    const memory = path.join(root, "MEMORY.md");
    fs.writeFileSync(memory, "attention architecture worker ".repeat(180_000));
    const reader = new WorkerAlignmentModel({
      sources: [memory],
      claudeProjects: path.join(root, "unused"),
    });
    let ticks = 0;
    const ticker = setInterval(() => {
      ticks += 1;
    }, 2);
    try {
      const model = await new Promise<ReturnType<typeof reader.snapshot>>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("alignment worker timed out")), 10_000);
        const unsubscribe = reader.subscribe((value) => {
          clearTimeout(timeout);
          unsubscribe();
          resolve(value);
        });
      });
      expect(model?.profile).toBeInstanceOf(Map);
      expect(model?.vocabSize).toBeGreaterThan(0);
      expect(ticks).toBeGreaterThan(2);
    } finally {
      clearInterval(ticker);
      reader.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 15_000);
});
