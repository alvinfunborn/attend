import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

describe("server main-thread performance boundary", () => {
  it("keeps provider scans, history parsing, search, and CLI metadata off the request loop", () => {
    const source = fs.readFileSync(path.join(root, "src", "server.ts"), "utf8");

    expect(source).not.toMatch(/\bbuildSources\b/);
    expect(source).not.toMatch(/\bTranscriptHistoryCache\b/);
    expect(source).not.toMatch(/\bsearchSessions\b/);
    expect(source).not.toMatch(/\bspawnSync\b/);
    expect(source).not.toMatch(/\b(?:existsSync|realpathSync|readdirSync|statSync)\b/);
    expect(source).not.toMatch(/\.backfillPrompts\(/);
    expect(source).not.toMatch(/readSessionTranscript/);
    expect(source).toContain("await providerForkPrompt(transcriptHistory");
    expect(source).toContain("await resolvePinReferenceContext");
    expect(source).toContain("new WorkerSessionIndex(");
    expect(source).toContain("new WorkerTranscriptHistory()");
    expect(source).toContain("new WorkerAnalyzerContext()");
    expect(source).toContain("new WorkerSessionSearch(");
    expect(source).toContain("new WorkerAlignmentModel(");
    expect(source).toContain("new WorkerWorkPromptIndex(");
    expect(source).toContain("analyzerContext,");
    expect(source).toContain("inspectCursorModelsAsync");
    expect(source).toContain("inspectCodexModelsAsync");
  });

  it("confines synchronous provider directory traversal to the session-index worker graph", () => {
    const indexWorker = fs.readFileSync(
      path.join(root, "src", "core", "vendor", "session-index-worker.ts"),
      "utf8",
    );
    const providerGraph = fs.readFileSync(
      path.join(root, "src", "core", "vendor", "index.ts"),
      "utf8",
    );

    expect(indexWorker).toContain('from "./index.js"');
    expect(indexWorker).toContain("buildSources(config, caches)");
    expect(providerGraph).toContain("export function buildSources");
  });
});
