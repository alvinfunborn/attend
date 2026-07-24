import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ClaudeAnalyzer } from "../src/chat/analyzer/claude.js";
import { CodexAnalyzer } from "../src/chat/analyzer/codex.js";
import type { AnalyzerVerdict, SessionAnalyzer } from "../src/chat/analyzer/index.js";
import type { CodexExecFn } from "../src/chat/codex/exec.js";
import { DaemonOrchestrator } from "../src/chat/daemon.js";
import type { QueryFn } from "../src/chat/engine.js";
import { AnalysisCache } from "../src/core/daemon/cache.js";
import { DaemonRegistry } from "../src/core/daemon/registry.js";
import { TranscriptPathIndex } from "../src/core/vendor/transcript-index.js";

const claudeCalls: Array<{ prompt: unknown; options?: Record<string, unknown> }> = [];
// Fake SDK query: a spawn (no resume) mints a daemon id; a resumed turn replies
// with a JSON verdict. No network.
const fakeQuery = ((args: {
  prompt: unknown;
  options?: { resume?: string } & Record<string, unknown>;
}) => {
  claudeCalls.push({ prompt: args.prompt, options: args.options });
  const resume = args.options?.resume;
  const prompt = String(args.prompt ?? "");
  async function* gen() {
    if (resume) {
      if (prompt.includes("flagged by local telemetry")) {
        yield {
          type: "assistant",
          message: {
            content: [
              {
                type: "text",
                text: '{"avoidancePrompt":"Ask for the smallest next step"}',
              },
            ],
          },
          session_id: resume,
        };
        yield { type: "result", subtype: "success", result: "" };
        return;
      }
      yield {
        type: "assistant",
        message: {
          content: [
            {
              type: "text",
              text: '{"brief":"refactor parser","state":"needs_decision","priority":7,"etaMin":12,"reason":"two questions, no edits","nextStep":"pick option two","probe":"show the parser diff"}',
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
            {
              type: "text",
              text: '{"brief":"new session","state":"done","priority":0,"etaMin":0,"reason":""}',
            },
          ],
        },
        session_id: "daemon-1",
      };
      yield { type: "result", subtype: "success", result: "" };
    }
  }
  return gen();
}) as unknown as QueryFn;

const codexCalls: Array<Record<string, unknown>> = [];
// Fake `codex exec`: a spawn (no resume) mints a daemon thread + greets; a resumed
// turn replies with a JSON verdict. Same contract as the Claude fake, no process.
const fakeCodexExec: CodexExecFn = (req) => {
  codexCalls.push(req as unknown as Record<string, unknown>);
  const events = req.resume
    ? [
        { type: "thread.started", thread_id: req.resume },
        {
          type: "item.completed",
          item: {
            type: "agent_message",
            text: '{"brief":"codex task","state":"continue_ready","priority":6,"etaMin":9,"reason":"exploring files"}',
          },
        },
        { type: "turn.completed" },
      ]
    : [
        { type: "thread.started", thread_id: "cx-daemon-1" },
        {
          type: "item.completed",
          item: {
            type: "agent_message",
            text: '{"brief":"new session","state":"done","priority":0,"etaMin":0,"reason":""}',
          },
        },
        { type: "turn.completed" },
      ];
  return {
    events: (async function* () {
      for (const e of events) yield e;
    })(),
    kill: () => {},
  };
};

function make(codexExec: CodexExecFn | null = fakeCodexExec) {
  const uniq = Math.random().toString(36).slice(2);
  const reg = path.join(os.tmpdir(), `attend-daemons-${uniq}.json`);
  const cache = path.join(os.tmpdir(), `attend-analysis-${uniq}.json`);
  const orch = new DaemonOrchestrator(new DaemonRegistry(reg), new AnalysisCache(cache), [
    new ClaudeAnalyzer(os.tmpdir(), fakeQuery),
    new CodexAnalyzer(os.tmpdir(), codexExec),
  ]);
  return { orch, reg, cache };
}

const cleanup: string[] = [];
afterEach(() => {
  claudeCalls.length = 0;
  codexCalls.length = 0;
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
    expect(a?.state).toBe("needs_decision");
    expect(a?.priority).toBe(7);
    expect(orch.analysis("task-1")?.brief).toBe("refactor parser");
  });

  it("discards the previous turn drafts when the session advances", async () => {
    const { orch, reg, cache } = make();
    cleanup.push(reg, cache);
    await orch.ensureDaemon("task-1", "claude", os.tmpdir());
    await orch.analyzeTask("task-1", os.tmpdir());
    expect(orch.analysis("task-1")).toMatchObject({
      nextStep: "pick option two",
      probe: "show the parser diff",
    });

    const kept = orch.discardTurnDrafts("task-1");
    expect(kept).toMatchObject({
      brief: "refactor parser",
      state: "needs_decision",
      nextStep: null,
      probe: null,
    });
    expect(orch.analysis("task-1")).toMatchObject({ nextStep: null, probe: null });
  });

  it("drops an in-flight verdict that finishes after a newer user turn starts", async () => {
    const uniq = Math.random().toString(36).slice(2);
    const reg = path.join(os.tmpdir(), `attend-daemons-stale-${uniq}.json`);
    const cacheFile = path.join(os.tmpdir(), `attend-analysis-stale-${uniq}.json`);
    cleanup.push(reg, cacheFile);
    let release!: (value: AnalyzerVerdict | null) => void;
    const verdict = new Promise<AnalyzerVerdict | null>((resolve) => {
      release = resolve;
    });
    const analyzer: SessionAnalyzer = {
      vendor: "slow",
      spawn: () => Promise.resolve("daemon-slow"),
      analyze: () => verdict,
    };
    const analysisCache = new AnalysisCache(cacheFile);
    analysisCache.set("task-slow", {
      brief: "old",
      state: "continue_ready",
      priority: 4,
      etaMin: 2,
      reason: "old turn",
      nextStep: "continue old work",
      probe: "question old work",
    });
    const orch = new DaemonOrchestrator(new DaemonRegistry(reg), analysisCache, [analyzer]);
    await orch.ensureDaemon("task-slow", "slow", os.tmpdir());
    const pending = orch.analyzeTask("task-slow", os.tmpdir());
    await Promise.resolve();

    orch.discardTurnDrafts("task-slow");
    release({
      analysis: {
        brief: "stale",
        state: "done",
        priority: 1,
        etaMin: 0,
        reason: "late result",
        nextStep: "stale next",
        probe: "stale probe",
      },
      observedTurns: [],
      labels: [],
    });

    await expect(pending).resolves.toBeNull();
    expect(orch.analysis("task-slow")).toMatchObject({
      brief: "old",
      nextStep: null,
      probe: null,
    });
  });

  it("generates and caches an avoidance prompt only when requested", async () => {
    const { orch, reg, cache } = make();
    cleanup.push(reg, cache);
    await orch.ensureDaemon("task-1", "claude", os.tmpdir());
    await orch.analyzeTask("task-1", os.tmpdir());
    const before = claudeCalls.length;
    await expect(orch.ensureAvoidancePrompt("task-1", os.tmpdir())).resolves.toBe(
      "Ask for the smallest next step",
    );
    await expect(orch.ensureAvoidancePrompt("task-1", os.tmpdir())).resolves.toBe(
      "Ask for the smallest next step",
    );
    expect(claudeCalls.length).toBe(before + 1);
    expect(orch.analysis("task-1")?.avoidancePrompt).toBe("Ask for the smallest next step");
  });

  it("does not pin special Claude daemon options", async () => {
    const { orch, reg, cache } = make();
    cleanup.push(reg, cache);
    await orch.ensureDaemon("task-1", "claude", os.tmpdir());
    expect(claudeCalls[0]?.options).toMatchObject({ cwd: os.tmpdir() });
    expect(claudeCalls[0]?.options?.model).toBeUndefined();
    expect(claudeCalls[0]?.options?.allowedTools).toBeUndefined();
    expect(claudeCalls[0]?.options?.maxTurns).toBeUndefined();
    expect(claudeCalls[0]?.options?.permissionMode).toBeUndefined();
  });

  it("does not analyze a session that has no daemon (historical/external)", async () => {
    const { orch, reg, cache } = make();
    cleanup.push(reg, cache);
    expect(await orch.analyzeTask("never-spawned", os.tmpdir())).toBeNull();
    expect(orch.analysis("never-spawned")).toBeNull();
  });

  it("spawns and analyzes a Codex daemon too (via codex exec)", async () => {
    const { orch, reg, cache } = make();
    cleanup.push(reg, cache);
    const id = await orch.ensureDaemon("cx-1", "codex", os.tmpdir());
    expect(id).toBe("cx-daemon-1");
    expect(orch.isDaemon("cx-daemon-1")).toBe(true);
    const a = await orch.analyzeTask("cx-1", os.tmpdir());
    expect(a?.brief).toBe("codex task");
    expect(a?.state).toBe("continue_ready");
    expect(a?.priority).toBe(6);
  });

  it("uses the scanner-owned transcript index without searching the configured Codex root", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-indexed-codex-"));
    const taskId = "indexed-codex-task";
    const file = path.join(dir, `${taskId}.jsonl`);
    cleanup.push(file, dir);
    fs.writeFileSync(
      file,
      JSON.stringify({
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "indexed codex transcript" }],
        },
      }),
    );
    const index = new TranscriptPathIndex();
    index.set("codex", taskId, file);
    const analyzer = new CodexAnalyzer(path.join(dir, "does-not-exist"), fakeCodexExec, index);

    await analyzer.analyze("cx-daemon-1", dir, taskId);
    expect(String(codexCalls.at(-1)?.prompt ?? "")).toContain("indexed codex transcript");
  });

  it("uses the scanner-owned transcript index without searching Claude project dirs", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-indexed-claude-"));
    const taskId = "indexed-claude-task";
    const file = path.join(dir, `${taskId}.jsonl`);
    cleanup.push(file, dir);
    fs.writeFileSync(
      file,
      JSON.stringify({ type: "user", message: { content: "indexed claude transcript" } }),
    );
    const index = new TranscriptPathIndex();
    index.set("claude", taskId, file);
    const analyzer = new ClaudeAnalyzer(path.join(dir, "does-not-exist"), fakeQuery, index);

    await analyzer.analyze("daemon-1", dir, taskId);
    expect(String(claudeCalls.at(-1)?.prompt ?? "")).toContain("indexed claude transcript");
  });

  it("pins Codex daemon work to the read-only sandbox", async () => {
    const { orch, reg, cache } = make();
    cleanup.push(reg, cache);
    await orch.ensureDaemon("cx-1", "codex", os.tmpdir());
    expect(codexCalls[0]?.cwd).toBe(os.tmpdir());
    expect(codexCalls[0]?.sandbox).toBe("read-only");
  });

  it("spawns no daemon when Codex isn't installed (null exec → heuristic fallback)", async () => {
    const { orch, reg, cache } = make(null);
    cleanup.push(reg, cache);
    expect(await orch.ensureDaemon("cx-1", "codex", os.tmpdir())).toBeNull();
    expect(orch.hasDaemon("cx-1")).toBe(false);
  });

  it("analyzer prompt preserves the true opening goal for long sessions", async () => {
    const uniq = Math.random().toString(36).slice(2);
    const base = path.join(os.tmpdir(), `attend-claude-proj-${uniq}`);
    const proj = path.join(base, "proj");
    const sessionId = `task-long-${uniq}`;
    const file = path.join(proj, `${sessionId}.jsonl`);
    fs.mkdirSync(proj, { recursive: true });
    cleanup.push(file);
    cleanup.push(base);

    const lines: unknown[] = [
      {
        type: "user",
        message: { content: "查看codebase的livekit接电话的实现情况" },
      },
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "先读代码和迁移方案。" }] },
      },
    ];
    for (let i = 0; i < 205; i++) {
      lines.push({
        type: "assistant",
        message: { content: [{ type: "text", text: `filler-${i}` }] },
      });
    }
    lines.push({
      type: "user",
      message: { content: "只改1吧" },
    });
    lines.push({
      type: "assistant",
      message: { content: [{ type: "text", text: "已按 magicline 对齐能力门控。" }] },
    });
    lines.push({
      type: "user",
      message: { content: "那就这样, 前后端创建分支提交并创建pr" },
    });
    fs.writeFileSync(file, lines.map((x) => JSON.stringify(x)).join("\n"));

    const analyzer = new ClaudeAnalyzer(base, fakeQuery);
    await analyzer.analyze("daemon-1", os.tmpdir(), sessionId);
    const prompt = String(claudeCalls.at(-1)?.prompt ?? "");
    expect(prompt).toContain('"brief" is the best glance label for a crowded session list');
    expect(prompt).toContain(
      '"state":"<continue_ready|needs_decision|needs_input|blocked|needs_review|followup_suggested|done>"',
    );
    expect(prompt).toContain('"priority" is workspace-level business importance');
    expect(prompt).toContain("An activity can be the glance label");
    expect(prompt).toContain("Do not let meta/debugging about the workflow become the brief");
    expect(prompt).toContain('"reason" is volatile current context, not a second title');
    expect(prompt).toContain('without repeating "brief"');
    expect(prompt).toContain("A vague phrase like");
    expect(prompt).toContain(
      "Initial user goal (historical context only): 查看codebase的livekit接电话的实现情况",
    );
    expect(prompt).toContain("Current/latest user request: 那就这样, 前后端创建分支提交并创建pr");
    expect(prompt.indexOf("Current/latest user request:")).toBeLessThan(
      prompt.indexOf("Initial user goal"),
    );
    expect(prompt).not.toContain("Initial user goal (historical context only): 只改1吧");
  });

  it("keeps a mid-session user pivot buried under later activity (memory anchor)", async () => {
    const uniq = Math.random().toString(36).slice(2);
    const base = path.join(os.tmpdir(), `attend-claude-proj-${uniq}`);
    const proj = path.join(base, "proj");
    const sessionId = `task-pivot-${uniq}`;
    const file = path.join(proj, `${sessionId}.jsonl`);
    fs.mkdirSync(proj, { recursive: true });
    cleanup.push(file);
    cleanup.push(base);

    const lines: unknown[] = [
      { type: "user", message: { content: "帮我调查登录超时的问题" } },
      { type: "assistant", message: { content: [{ type: "text", text: "开始排查登录链路。" }] } },
      // The real pivot — a NEW task introduced early, then buried under filler so a
      // naive "last N messages" window would drop it entirely.
      { type: "user", message: { content: "先放一放，改成做暗色主题切换" } },
    ];
    for (let i = 0; i < 205; i++) {
      lines.push({
        type: "assistant",
        message: { content: [{ type: "text", text: `filler-${i}` }] },
      });
    }
    // Latest turn is a routine admin action; it must NOT become the brief on its own.
    lines.push({ type: "user", message: { content: "打包看看" } });
    fs.writeFileSync(file, lines.map((x) => JSON.stringify(x)).join("\n"));

    const analyzer = new ClaudeAnalyzer(base, fakeQuery);
    await analyzer.analyze("daemon-1", os.tmpdir(), sessionId);
    const prompt = String(claudeCalls.at(-1)?.prompt ?? "");
    // The buried pivot survives condensation because user turns are anchor candidates.
    expect(prompt).toContain("先放一放，改成做暗色主题切换");
    // The opening goal is still available as historical context, and the latest admin
    // action is surfaced as the current request (not lost, but not the only signal).
    expect(prompt).toContain("Initial user goal (historical context only): 帮我调查登录超时的问题");
    expect(prompt).toContain("Current/latest user request: 打包看看");
  });

  it("pairs a short choice reply with the question it answers", async () => {
    const uniq = Math.random().toString(36).slice(2);
    const base = path.join(os.tmpdir(), `attend-claude-proj-${uniq}`);
    const proj = path.join(base, "proj");
    const sessionId = `task-choice-${uniq}`;
    const file = path.join(proj, `${sessionId}.jsonl`);
    fs.mkdirSync(proj, { recursive: true });
    cleanup.push(file);
    cleanup.push(base);

    const lines: unknown[] = [
      { type: "user", message: { content: "帮我设计缓存层" } },
      { type: "assistant", message: { content: [{ type: "text", text: "开始设计缓存层。" }] } },
      // The assistant poses a multiple-choice question; the user's answer is just "B",
      // which is meaningless without this question.
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "text",
              text: "缓存方案可选:\nA) 内存 LRU\nB) Redis 外部缓存\nC) 无缓存直接查库\n你选哪个?",
            },
          ],
        },
      },
      { type: "user", message: { content: "B" } },
      { type: "assistant", message: { content: [{ type: "text", text: "好，用 Redis。" }] } },
    ];
    // Bury the exchange so it is NOT in the trailing window — it must survive purely via
    // the user-turn pairing.
    for (let i = 0; i < 205; i++) {
      lines.push({
        type: "assistant",
        message: { content: [{ type: "text", text: `filler-${i}` }] },
      });
    }
    lines.push({ type: "user", message: { content: "打包看看" } });
    fs.writeFileSync(file, lines.map((x) => JSON.stringify(x)).join("\n"));

    const analyzer = new ClaudeAnalyzer(base, fakeQuery);
    await analyzer.analyze("daemon-1", os.tmpdir(), sessionId);
    const prompt = String(claudeCalls.at(-1)?.prompt ?? "");
    // The bare "B" reply survives...
    expect(prompt).toContain("User: B");
    // ...alongside the question that gives it meaning, even though it is buried under filler.
    expect(prompt).toContain("Redis 外部缓存");
  });
});
