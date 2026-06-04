import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ClaudeAnalyzer } from "../src/chat/analyzer/claude.js";
import { DaemonOrchestrator } from "../src/chat/daemon.js";
import type { ChatDriver, StartOpts, ToolAnswer, UserTurn } from "../src/chat/driver.js";
import { ChatEngine, type QueryFn } from "../src/chat/engine.js";
import type { UiEvent } from "../src/chat/events.js";
import { resolveConfig } from "../src/config.js";
import { AnalysisCache } from "../src/core/daemon/cache.js";
import { DaemonRegistry } from "../src/core/daemon/registry.js";
import type { LaunchAction, LaunchVendor } from "../src/core/launch.js";
import { type AppDeps, createApp, startServer } from "../src/server.js";

interface Call {
  action: LaunchAction;
  vendor: LaunchVendor;
  cwd: string;
  opts: { sessionId?: string; prompt?: string; model?: string; effort?: string };
}

const queryCalls: Array<{ prompt: unknown; options?: Record<string, unknown> }> = [];
// Fake SDK query(): yields init → assistant → result, no network.
const fakeQuery = ((args: { prompt: unknown; options?: Record<string, unknown> }) => {
  queryCalls.push({ prompt: args.prompt, options: args.options });
  async function* gen() {
    yield { type: "system", subtype: "init", session_id: "fake-1" };
    yield {
      type: "assistant",
      message: { content: [{ type: "text", text: "hi" }] },
      session_id: "fake-1",
    };
    yield { type: "result", subtype: "success", result: "hi", session_id: "fake-1" };
  }
  return gen();
}) as unknown as QueryFn;

function appWithSpy(config = resolveConfig({ positionals: [] })) {
  queryCalls.length = 0;
  const calls: Call[] = [];
  const reveals: string[] = [];
  const uniq = Math.random().toString(36).slice(2);
  const orchestrator = new DaemonOrchestrator(
    new DaemonRegistry(path.join(os.tmpdir(), `attend-test-daemons-${uniq}.json`)),
    new AnalysisCache(path.join(os.tmpdir(), `attend-test-analysis-${uniq}.json`)),
    [new ClaudeAnalyzer(os.tmpdir(), fakeQuery)],
  );
  const deps: AppDeps = {
    launcher: (action, vendor, cwd, opts) => {
      calls.push({ action, vendor, cwd, opts });
      return `${vendor} ${action}`;
    },
    revealer: (target) => {
      reveals.push(target);
    },
    engine: new ChatEngine(fakeQuery),
    orchestrator,
  };
  return { app: createApp(config, deps), calls, reveals };
}

const tmp = encodeURIComponent(os.tmpdir());

class FakeCodexDriver implements ChatDriver {
  readonly vendor = "codex";
  readonly starts: StartOpts[] = [];
  readonly sends: Array<{ sessionId: string; turn: UserTurn }> = [];

  get(_sessionId: string): { cwd: string } | undefined {
    return { cwd: os.tmpdir() };
  }

  start(opts: StartOpts): Promise<string> {
    this.starts.push(opts);
    return Promise.resolve("cx-1");
  }

  send(sessionId: string, turn: UserTurn): boolean {
    this.sends.push({ sessionId, turn });
    return true;
  }

  answer(_sessionId: string, _answer: ToolAnswer): boolean {
    return false;
  }

  interrupt(_sessionId: string): Promise<boolean> {
    return Promise.resolve(false);
  }

  subscribe(_sessionId: string, _onEvent: (ev: UiEvent) => void): () => void {
    return () => {};
  }

  activeSessions(): string[] {
    return [];
  }

  activeSessionStates(): Array<{ sessionId: string; startedAt: number }> {
    return [];
  }

  onTurnEnd(_cb: (sessionId: string) => void): () => void {
    return () => {};
  }
}

describe("POST /launch", () => {
  it("resumes a session for a valid request", async () => {
    const { app, calls } = appWithSpy();
    const res = await app.request(`/launch?action=resume&vendor=claude&id=abc-123&cwd=${tmp}`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, command: "claude resume" });
    expect(calls[0]).toMatchObject({ action: "resume", vendor: "claude" });
  });

  it("starts a new session without a session id, passing the prompt through", async () => {
    const { app, calls } = appWithSpy();
    const res = await app.request(
      `/launch?action=new&vendor=codex&cwd=${tmp}&prompt=${encodeURIComponent("do X")}`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    expect(calls[0]?.opts.prompt).toBe("do X");
  });

  it("passes model and effort through terminal launches", async () => {
    const { app, calls } = appWithSpy();
    const res = await app.request(
      `/launch?action=new&vendor=claude&cwd=${tmp}&model=${encodeURIComponent("sonnet")}&effort=high`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    expect(calls[0]?.opts).toMatchObject({ model: "sonnet", effort: "high" });
  });

  it("resolves a vault-relative cwd for new terminal launches", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-root-"));
    const child = path.join(root, "proj");
    fs.mkdirSync(child);
    try {
      const { app, calls } = appWithSpy(resolveConfig({ positionals: [root] }));
      const res = await app.request(
        `/launch?action=new&vendor=claude&cwd=${encodeURIComponent("proj")}`,
        { method: "POST" },
      );
      expect(res.status).toBe(200);
      expect(calls[0]?.cwd).toBe(child);
      expect(await res.json()).toMatchObject({ ok: true, cwd: child });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an unknown action / vendor", async () => {
    const { app } = appWithSpy();
    expect(
      (await app.request(`/launch?action=zap&vendor=claude&cwd=${tmp}`, { method: "POST" })).status,
    ).toBe(400);
    expect(
      (await app.request(`/launch?action=new&vendor=gemini&cwd=${tmp}`, { method: "POST" })).status,
    ).toBe(400);
  });

  it("requires a safe session id for resume/fork", async () => {
    const { app, calls } = appWithSpy();
    const res = await app.request(
      `/launch?action=fork&vendor=claude&id=${encodeURIComponent("a; rm -rf /")}&cwd=${tmp}`,
      { method: "POST" },
    );
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("rejects a non-existent directory", async () => {
    const { app } = appWithSpy();
    const res = await app.request(
      `/launch?action=new&vendor=claude&cwd=${encodeURIComponent("/no/such/xyz")}`,
      { method: "POST" },
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /open", () => {
  it("reveals an absolute file that exists", async () => {
    const { app, reveals } = appWithSpy();
    const file = path.join(os.tmpdir(), `attend-open-${Math.random().toString(36).slice(2)}.md`);
    fs.writeFileSync(file, "x");
    try {
      const res = await app.request(`/open?path=${encodeURIComponent(file)}`, { method: "POST" });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true, path: file });
      expect(reveals).toEqual([file]);
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  it("resolves a relative path against the provided cwd", async () => {
    const { app, reveals } = appWithSpy();
    const name = `attend-open-${Math.random().toString(36).slice(2)}.ogg`;
    const file = path.join(os.tmpdir(), name);
    fs.writeFileSync(file, "x");
    try {
      const res = await app.request(
        `/open?path=${encodeURIComponent(name)}&cwd=${encodeURIComponent(os.tmpdir())}`,
        { method: "POST" },
      );
      expect(res.status).toBe(200);
      expect(reveals[0]).toBe(file);
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  it("404s a path that does not exist (no reveal)", async () => {
    const { app, reveals } = appWithSpy();
    const res = await app.request(`/open?path=${encodeURIComponent("/no/such/nope-xyz.md")}`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
    expect(reveals).toHaveLength(0);
  });

  it("400s a relative path with no cwd to resolve against", async () => {
    const { app } = appWithSpy();
    const res = await app.request(`/open?path=${encodeURIComponent("report.md")}`, {
      method: "POST",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /session/override", () => {
  // Build an app whose override store points at a throwaway temp file (never the
  // real ~/.attend/overrides.json).
  function appWithOverrides() {
    const uniq = Math.random().toString(36).slice(2);
    const config = {
      ...resolveConfig({ positionals: [] }),
      overrides: path.join(os.tmpdir(), `attend-test-ov-${uniq}.json`),
    };
    const orchestrator = new DaemonOrchestrator(
      new DaemonRegistry(path.join(os.tmpdir(), `attend-test-daemons-${uniq}.json`)),
      new AnalysisCache(path.join(os.tmpdir(), `attend-test-analysis-${uniq}.json`)),
      [new ClaudeAnalyzer(os.tmpdir(), fakeQuery)],
    );
    const deps: AppDeps = {
      launcher: () => "noop",
      engine: new ChatEngine(fakeQuery),
      orchestrator,
    };
    return createApp(config, deps);
  }

  const post = (app: ReturnType<typeof appWithOverrides>, qs: string, body: unknown) =>
    app.request(`/session/override${qs}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("pins and clamps a priority", async () => {
    const app = appWithOverrides();
    const res = await post(app, "?session=s1", { priority: 99 });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, override: { priority: 10 } });
  });

  it("merges etaMin without dropping a prior priority pin", async () => {
    const app = appWithOverrides();
    await post(app, "?session=s1", { priority: 4 });
    const res = await post(app, "?session=s1", { etaMin: 25 });
    expect(await res.json()).toMatchObject({ ok: true, override: { priority: 4, etaMin: 25 } });
  });

  it("rejects a missing session or an empty patch", async () => {
    const app = appWithOverrides();
    expect((await post(app, "", { priority: 5 })).status).toBe(400);
    expect((await post(app, "?session=s1", {})).status).toBe(400);
  });
});

describe("tag routes", () => {
  function appWithTags() {
    const uniq = Math.random().toString(36).slice(2);
    const config = {
      ...resolveConfig({ positionals: [] }),
      tags: path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`),
      overrides: path.join(os.tmpdir(), `attend-test-ov-${uniq}.json`),
    };
    const orchestrator = new DaemonOrchestrator(
      new DaemonRegistry(path.join(os.tmpdir(), `attend-test-daemons-${uniq}.json`)),
      new AnalysisCache(path.join(os.tmpdir(), `attend-test-analysis-${uniq}.json`)),
      [new ClaudeAnalyzer(os.tmpdir(), fakeQuery)],
    );
    const deps: AppDeps = {
      launcher: () => "noop",
      engine: new ChatEngine(fakeQuery),
      orchestrator,
    };
    return createApp(config, deps);
  }

  const post = (app: ReturnType<typeof appWithTags>, path: string, body: unknown) =>
    app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("creates a global tag and assigns tags to a session", async () => {
    const app = appWithTags();
    expect(await (await post(app, "/tags", { name: "work" })).json()).toMatchObject({
      ok: true,
      tags: ["work"],
    });
    expect(
      await (await post(app, "/session/tags?session=s1", { tags: ["work", "urgent"] })).json(),
    ).toMatchObject({
      ok: true,
      sessionTags: ["work", "urgent"],
      tags: ["work", "urgent"],
    });
  });

  it("deletes a global tag", async () => {
    const app = appWithTags();
    await post(app, "/session/tags?session=s1", { tags: ["work", "urgent"] });
    const res = await app.request("/tags?name=urgent", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, tags: [] });
  });

  it("rejects missing tag names and missing session ids", async () => {
    const app = appWithTags();
    expect((await post(app, "/tags", {})).status).toBe(400);
    expect((await post(app, "/session/tags", { tags: ["work"] })).status).toBe(400);
  });
});

describe("engagement routes", () => {
  function appWithEngagement() {
    const uniq = Math.random().toString(36).slice(2);
    const config = {
      ...resolveConfig({ positionals: [] }),
      engagement: path.join(os.tmpdir(), `attend-test-engagement-${uniq}.json`),
      tags: path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`),
      overrides: path.join(os.tmpdir(), `attend-test-ov-${uniq}.json`),
    };
    const orchestrator = new DaemonOrchestrator(
      new DaemonRegistry(path.join(os.tmpdir(), `attend-test-daemons-${uniq}.json`)),
      new AnalysisCache(path.join(os.tmpdir(), `attend-test-analysis-${uniq}.json`)),
      [new ClaudeAnalyzer(os.tmpdir(), fakeQuery)],
    );
    const deps: AppDeps = {
      launcher: () => "noop",
      engine: new ChatEngine(fakeQuery),
      orchestrator,
    };
    return createApp(config, deps);
  }

  async function appWithTrackedSession(endedAt = 1234) {
    const uniq = Math.random().toString(36).slice(2);
    const claudeProjects = path.join(os.tmpdir(), `attend-test-projects-${uniq}`);
    const projectDir = path.join(claudeProjects, "-tmp-proj");
    const transcript = path.join(projectDir, "s1.jsonl");
    await fs.promises.mkdir(projectDir, { recursive: true });
    await fs.promises.writeFile(
      transcript,
      [
        JSON.stringify({
          type: "user",
          sessionId: "s1",
          cwd: "/tmp/proj",
          timestamp: "2026-06-03T03:06:02.640Z",
          message: { content: "first prompt" },
        }),
        JSON.stringify({
          type: "assistant",
          sessionId: "s1",
          cwd: "/tmp/proj",
          timestamp: "2026-06-03T03:06:12.429Z",
          message: { content: [{ type: "text", text: "reply" }] },
        }),
      ].join("\n"),
    );
    const config = {
      ...resolveConfig({ positionals: [] }),
      claudeProjects,
      codexSessions: path.join(os.tmpdir(), `attend-test-codex-${uniq}`),
      engagement: path.join(os.tmpdir(), `attend-test-engagement-${uniq}.json`),
      tags: path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`),
      overrides: path.join(os.tmpdir(), `attend-test-ov-${uniq}.json`),
    };
    const orchestrator = new DaemonOrchestrator(
      new DaemonRegistry(path.join(os.tmpdir(), `attend-test-daemons-${uniq}.json`)),
      new AnalysisCache(path.join(os.tmpdir(), `attend-test-analysis-${uniq}.json`)),
      [new ClaudeAnalyzer(claudeProjects, fakeQuery)],
    );
    const app = createApp(config, {
      launcher: () => "noop",
      engine: new ChatEngine(fakeQuery),
      orchestrator,
    });
    const res = await app.request("/session/engagement?session=s1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        viewedMs: 25_000,
        hadMeaningfulScroll: true,
        hadSend: false,
        endedAt,
      }),
    });
    expect(res.status).toBe(200);
    return { app, transcript, endedAt };
  }

  it("records a view visit and returns the engagement aggregate", async () => {
    const app = appWithEngagement();
    const res = await app.request("/session/engagement?session=s1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        viewedMs: 25_000,
        hadMeaningfulScroll: true,
        hadSend: false,
        endedAt: 1234,
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      record: { opens: 1, reviewVisits: 1, lastViewedAt: 1234 },
      view: null,
    });
  });

  it("keeps the displayed lastTs on real activity and exposes a separate sortTs", async () => {
    const endedAt = Date.parse("2026-06-04T06:00:00.000Z");
    const { app } = await appWithTrackedSession(endedAt);
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    const match = /window\.__SESSIONS__ = (\[[\s\S]*?\]);/.exec(html);
    expect(match?.[1]).toBeTruthy();
    const sessions = JSON.parse(match?.[1] ?? "[]") as Array<Record<string, unknown>>;
    const s1 = sessions.find((s) => s.sessionId === "s1");
    expect(s1).toMatchObject({
      lastTs: Date.parse("2026-06-03T03:06:12.429Z"),
      sortTs: endedAt,
    });
  });

  it("rejects a missing session id", async () => {
    const app = appWithEngagement();
    const res = await app.request("/session/engagement", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ viewedMs: 1_000 }),
    });
    expect(res.status).toBe(400);
  });
});

describe("session status routes", () => {
  function appWithSessionStatus() {
    const uniq = Math.random().toString(36).slice(2);
    const config = {
      ...resolveConfig({ positionals: [] }),
      sessionStatus: path.join(os.tmpdir(), `attend-test-session-status-${uniq}.json`),
      engagement: path.join(os.tmpdir(), `attend-test-engagement-${uniq}.json`),
      tags: path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`),
      overrides: path.join(os.tmpdir(), `attend-test-ov-${uniq}.json`),
    };
    const orchestrator = new DaemonOrchestrator(
      new DaemonRegistry(path.join(os.tmpdir(), `attend-test-daemons-${uniq}.json`)),
      new AnalysisCache(path.join(os.tmpdir(), `attend-test-analysis-${uniq}.json`)),
      [new ClaudeAnalyzer(os.tmpdir(), fakeQuery)],
    );
    const deps: AppDeps = {
      launcher: () => "noop",
      engine: new ChatEngine(fakeQuery),
      orchestrator,
    };
    return createApp(config, deps);
  }

  it("persists an unfinished state and removes it when read", async () => {
    const app = appWithSessionStatus();
    const markSeen = await app.request("/session/status?session=s1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: "seen", updatedAt: 1234 }),
    });
    expect(markSeen.status).toBe(200);
    expect(await markSeen.json()).toMatchObject({
      ok: true,
      status: { state: "seen", updatedAt: 1234 },
      view: null,
    });

    const markRead = await app.request("/session/status?session=s1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: "read", updatedAt: 2345 }),
    });
    expect(markRead.status).toBe(200);
    expect(await markRead.json()).toMatchObject({ ok: true, status: null, view: null });
  });

  it("rejects missing session ids and invalid states", async () => {
    const app = appWithSessionStatus();
    expect(
      (
        await app.request("/session/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state: "seen" }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request("/session/status?session=s1", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state: "bogus" }),
        })
      ).status,
    ).toBe(400);
  });
});

describe("GET /session/source", () => {
  it("resolves a session id back to its transcript file", async () => {
    const uniq = Math.random().toString(36).slice(2);
    const claudeProjects = path.join(os.tmpdir(), `attend-test-projects-${uniq}`);
    const projectDir = path.join(claudeProjects, "-tmp-proj");
    const transcript = path.join(projectDir, "s1.jsonl");
    await fs.promises.mkdir(projectDir, { recursive: true });
    await fs.promises.writeFile(
      transcript,
      [
        JSON.stringify({
          type: "user",
          sessionId: "s1",
          cwd: "/tmp/proj",
          timestamp: "2026-06-03T03:06:02.640Z",
          message: { content: "first prompt" },
        }),
        JSON.stringify({
          type: "assistant",
          sessionId: "s1",
          cwd: "/tmp/proj",
          timestamp: "2026-06-03T03:06:12.429Z",
          message: { content: [{ type: "text", text: "reply" }] },
        }),
      ].join("\n"),
    );
    const config = {
      ...resolveConfig({ positionals: [] }),
      claudeProjects,
      codexSessions: path.join(os.tmpdir(), `attend-test-codex-${uniq}`),
      overrides: path.join(os.tmpdir(), `attend-test-ov-${uniq}.json`),
      tags: path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`),
    };
    const orchestrator = new DaemonOrchestrator(
      new DaemonRegistry(path.join(os.tmpdir(), `attend-test-daemons-${uniq}.json`)),
      new AnalysisCache(path.join(os.tmpdir(), `attend-test-analysis-${uniq}.json`)),
      [new ClaudeAnalyzer(claudeProjects, fakeQuery)],
    );
    const app = createApp(config, {
      launcher: () => "noop",
      engine: new ChatEngine(fakeQuery),
      orchestrator,
    });
    const res = await app.request("/session/source?session=s1&vendor=claude");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      session: {
        vendor: "claude",
        file: transcript,
        cwd: "/tmp/proj",
        project: "proj",
        title: "first prompt",
        lastPrompt: "first prompt",
        prompts: 1,
      },
    });
  });

  it("does not list or resolve an unregistered analyzer daemon transcript", async () => {
    const uniq = Math.random().toString(36).slice(2);
    const claudeProjects = path.join(os.tmpdir(), `attend-test-projects-${uniq}`);
    const projectDir = path.join(claudeProjects, "-tmp-proj");
    const daemonId = "daemon-s1";
    const transcript = path.join(projectDir, `${daemonId}.jsonl`);
    await fs.promises.mkdir(projectDir, { recursive: true });
    await fs.promises.writeFile(
      transcript,
      [
        JSON.stringify({
          type: "user",
          sessionId: daemonId,
          cwd: "/tmp/proj",
          timestamp: "2026-06-03T03:06:02.640Z",
          message: {
            content:
              "You are the *attend daemon* for a single coding session. Your only job: each time I send you the session's latest transcript, observe it and reply with ONE JSON object and nothing else.",
          },
        }),
        JSON.stringify({
          type: "user",
          sessionId: daemonId,
          cwd: "/tmp/proj",
          timestamp: "2026-06-03T03:06:12.429Z",
          message: {
            content:
              "The session advanced. Session context:\\n\\n(no text yet)\\n\\nReply with the JSON object only.",
          },
        }),
      ].join("\n"),
    );
    const config = {
      ...resolveConfig({ positionals: [] }),
      claudeProjects,
      codexSessions: path.join(os.tmpdir(), `attend-test-codex-${uniq}`),
      overrides: path.join(os.tmpdir(), `attend-test-ov-${uniq}.json`),
      tags: path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`),
    };
    const orchestrator = new DaemonOrchestrator(
      new DaemonRegistry(path.join(os.tmpdir(), `attend-test-daemons-${uniq}.json`)),
      new AnalysisCache(path.join(os.tmpdir(), `attend-test-analysis-${uniq}.json`)),
      [new ClaudeAnalyzer(claudeProjects, fakeQuery)],
    );
    const app = createApp(config, {
      launcher: () => "noop",
      engine: new ChatEngine(fakeQuery),
      orchestrator,
    });

    const page = await app.request("/");
    const html = await page.text();
    expect(html).not.toContain(`"sessionId":"${daemonId}"`);

    const res = await app.request(`/session/source?session=${daemonId}&vendor=claude`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ session: null });
  });
});

describe("POST /chat/new + /chat/fork + /chat/send (faked SDK)", () => {
  function appWithCodexSpy() {
    const codex = new FakeCodexDriver();
    const uniq = Math.random().toString(36).slice(2);
    const config = {
      ...resolveConfig({ positionals: [] }),
      overrides: path.join(os.tmpdir(), `attend-test-ov-${uniq}.json`),
      tags: path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`),
    };
    const orchestrator = new DaemonOrchestrator(
      new DaemonRegistry(path.join(os.tmpdir(), `attend-test-daemons-${uniq}.json`)),
      new AnalysisCache(path.join(os.tmpdir(), `attend-test-analysis-${uniq}.json`)),
      [new ClaudeAnalyzer(os.tmpdir(), fakeQuery)],
    );
    return {
      app: createApp(config, {
        launcher: () => "noop",
        engine: new ChatEngine(fakeQuery),
        codex,
        orchestrator,
      }),
      codex,
    };
  }

  it("starts a new session and returns its id", async () => {
    const { app } = appWithSpy();
    const res = await app.request(`/chat/new?cwd=${tmp}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "hello" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, session: "fake-1" });
  });

  it("passes model and effort through in-browser new sessions", async () => {
    const { app } = appWithSpy();
    const res = await app.request(`/chat/new?cwd=${tmp}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "hello", model: "sonnet", effort: "high" }),
    });
    expect(res.status).toBe(200);
    expect(queryCalls[0]?.options).toMatchObject({ model: "sonnet", effort: "high" });
  });

  it("resolves a vault-relative cwd for new chat sessions", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-root-"));
    const child = path.join(root, "proj");
    fs.mkdirSync(child);
    try {
      const { app } = appWithSpy(resolveConfig({ positionals: [root] }));
      const res = await app.request(`/chat/new?cwd=${encodeURIComponent("proj")}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "hello" }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true, session: "fake-1", cwd: child });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts attachment-only fork requests", async () => {
    const { app } = appWithSpy();
    const res = await app.request(`/chat/fork?session=fake-1&cwd=${tmp}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attachments: [{ kind: "text", name: "notes.md", text: "# branch here" }],
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, session: "fake-1" });
  });

  it("passes codex fork attachments through to the codex driver", async () => {
    const { app, codex } = appWithCodexSpy();
    const res = await app.request(`/chat/fork?session=parent-1&cwd=${tmp}&vendor=codex`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attachments: [
          { kind: "text", name: "notes.md", text: "# branch here" },
          { kind: "image", name: "ui.png", mediaType: "image/png", data: "abcd" },
        ],
      }),
    });
    expect(res.status).toBe(200);
    expect(codex.starts[0]).toMatchObject({
      resume: "parent-1",
      forkSession: true,
      firstText: "",
      firstAttachments: [
        { kind: "text", name: "notes.md", text: "# branch here" },
        { kind: "image", name: "ui.png", mediaType: "image/png", data: "abcd" },
      ],
    });
  });

  it("rejects codex PDF attachments instead of silently dropping them", async () => {
    const { app, codex } = appWithCodexSpy();
    const res = await app.request(`/chat/send?session=cx-1&cwd=${tmp}&vendor=codex`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "review this",
        attachments: [{ kind: "document", name: "brief.pdf", data: "abcd" }],
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Codex chat does not support PDF attachments",
    });
    expect(codex.sends).toHaveLength(0);
  });

  it("rejects new without a valid directory", async () => {
    const { app } = appWithSpy();
    expect(
      (
        await app.request(`/chat/new?cwd=${encodeURIComponent("/no/such")}`, {
          method: "POST",
          body: JSON.stringify({ text: "x" }),
          headers: { "content-type": "application/json" },
        })
      ).status,
    ).toBe(400);
  });

  it("starts a new session even with no first message (message is optional)", async () => {
    const { app } = appWithSpy();
    const res = await app.request(`/chat/new?cwd=${tmp}`, {
      method: "POST",
      body: JSON.stringify({ text: "" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, session: "fake-1" });
  });

  it("send requires session + existing dir + non-empty text", async () => {
    const { app } = appWithSpy();
    expect(
      (await app.request(`/chat/send?cwd=${tmp}`, { method: "POST", body: "{}" })).status,
    ).toBe(400);
    const res = await app.request(`/chat/send?session=abc&cwd=${tmp}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "hi" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, session: "abc" });
  });

  it("answer requires session + existing dir + toolUseId + non-empty text", async () => {
    const { app } = appWithSpy();
    expect(
      (
        await app.request(`/chat/answer?cwd=${tmp}`, {
          method: "POST",
          body: "{}",
          headers: { "content-type": "application/json" },
        })
      ).status,
    ).toBe(400);
    const res = await app.request(`/chat/answer?session=abc&cwd=${tmp}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toolUseId: "toolu-1",
        text: 'Your questions have been answered: "Pick one?"="A".',
        toolUseResult: { answers: { "Pick one?": "A" } },
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, session: "abc", toolUseId: "toolu-1" });
  });

  it("fork branches with a first message and returns the new session id", async () => {
    const { app } = appWithSpy();
    const res = await app.request(`/chat/fork?session=abc&cwd=${tmp}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "try another approach" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, session: "fake-1" });
  });

  it("abort requires a session id", async () => {
    const { app } = appWithSpy();
    expect((await app.request("/chat/abort", { method: "POST" })).status).toBe(400);
  });

  it("abort routes to engine.interrupt (ok:false when nothing is interruptible)", async () => {
    const { app } = appWithSpy();
    const res = await app.request("/chat/abort?session=abc", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: false, session: "abc" });
  });

  it("fork requires a first message to branch with (else it would hang)", async () => {
    const { app } = appWithSpy();
    const res = await app.request(`/chat/fork?session=abc&cwd=${tmp}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /open", () => {
  it("reveals an existing local file and tolerates :line suffixes", async () => {
    const { app, reveals } = appWithSpy();
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "attend-open-"));
    const file = path.join(dir, "report.md");
    await fs.promises.writeFile(file, "hi");
    const res = await app.request(
      `/open?path=${encodeURIComponent(`${file}:12`)}&cwd=${encodeURIComponent(dir)}`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, path: file });
    expect(reveals).toEqual([file]);
  });
});

describe("startServer port rollover", () => {
  const cleanup: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanup.splice(0)) fn();
  });

  it("rolls forward to the next free port when the requested one is taken", async () => {
    const taken = net.createServer();
    const takenPort: number = await new Promise((resolve) => {
      taken.listen(0, "127.0.0.1", () => resolve((taken.address() as net.AddressInfo).port));
    });
    cleanup.push(() => taken.close());

    const config = resolveConfig({ positionals: [], port: String(takenPort), host: "127.0.0.1" });
    const running = await startServer(config);
    cleanup.push(() => running.close());

    expect(running.port).toBeGreaterThan(takenPort);
  });
});
