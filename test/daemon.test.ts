import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ClaudeAnalyzer } from "../src/chat/analyzer/claude.js";
import { CodexAnalyzer } from "../src/chat/analyzer/codex.js";
import { DaemonOrchestrator } from "../src/chat/daemon.js";
import type { QueryFn } from "../src/chat/engine.js";
import { AnalysisCache } from "../src/core/daemon/cache.js";
import { DaemonRegistry } from "../src/core/daemon/registry.js";

// Fake SDK query: a spawn (no resume) mints a daemon id; a resumed turn replies
// with a JSON verdict. No network.
const fakeQuery = ((args: { options?: { resume?: string } }) => {
  const resume = args.options?.resume;
  async function* gen() {
    if (resume) {
      yield {
        type: "assistant",
        message: {
          content: [
            {
              type: "text",
              text: '{"brief":"refactor parser","priority":7,"etaMin":12,"reason":"two questions, no edits"}',
            },
          ],
        },
        session_id: resume,
      };
      yield { type: "result", subtype: "success", result: "" };
    } else {
      yield { type: "system", subtype: "init", session_id: "daemon-1" };
      yield {
        type: "assistant",
        message: {
          content: [
            { type: "text", text: '{"brief":"new session","priority":0,"etaMin":0,"reason":""}' },
          ],
        },
        session_id: "daemon-1",
      };
      yield { type: "result", subtype: "success", result: "" };
    }
  }
  return gen();
}) as unknown as QueryFn;

function make() {
  const uniq = Math.random().toString(36).slice(2);
  const reg = path.join(os.tmpdir(), `attend-daemons-${uniq}.json`);
  const cache = path.join(os.tmpdir(), `attend-analysis-${uniq}.json`);
  const orch = new DaemonOrchestrator(new DaemonRegistry(reg), new AnalysisCache(cache), [
    new ClaudeAnalyzer(os.tmpdir(), fakeQuery),
    new CodexAnalyzer(),
  ]);
  return { orch, reg, cache };
}

const cleanup: string[] = [];
afterEach(() => {
  for (const f of cleanup.splice(0)) {
    try {
      fs.rmSync(f, { force: true });
    } catch {
      // ignore
    }
  }
});

describe("DaemonOrchestrator", () => {
  it("spawns a daemon, registers the pairing, and exposes it for filtering", async () => {
    const { orch, reg, cache } = make();
    cleanup.push(reg, cache);
    const id = await orch.ensureDaemon("task-1", "claude", os.tmpdir());
    expect(id).toBe("daemon-1");
    expect(orch.hasDaemon("task-1")).toBe(true);
    expect(orch.isDaemon("daemon-1")).toBe(true);
    expect(orch.daemonIds().has("daemon-1")).toBe(true);
  });

  it("re-analyzes on turn-end and caches the parsed verdict", async () => {
    const { orch, reg, cache } = make();
    cleanup.push(reg, cache);
    await orch.ensureDaemon("task-1", "claude", os.tmpdir());
    const a = await orch.analyzeTask("task-1", os.tmpdir());
    expect(a?.brief).toBe("refactor parser");
    expect(a?.priority).toBe(7);
    expect(orch.analysis("task-1")?.brief).toBe("refactor parser");
  });

  it("does not analyze a session that has no daemon (historical/external)", async () => {
    const { orch, reg, cache } = make();
    cleanup.push(reg, cache);
    expect(await orch.analyzeTask("never-spawned", os.tmpdir())).toBeNull();
    expect(orch.analysis("never-spawned")).toBeNull();
  });

  it("spawns no daemon for a vendor whose analyzer can't (Codex stub)", async () => {
    const { orch, reg, cache } = make();
    cleanup.push(reg, cache);
    expect(await orch.ensureDaemon("cx-1", "codex", os.tmpdir())).toBeNull();
    expect(orch.hasDaemon("cx-1")).toBe(false);
  });
});
