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

describe("GET /", () => {
  it("shows the scoped vault name while e2ee is locked", async () => {
    const uniq = Math.random().toString(36).slice(2);
    const vaultRoot = path.join(os.tmpdir(), `attend-test-vault-${uniq}`);
    const config = {
      ...resolveConfig({ positionals: [vaultRoot], e2eePassphrase: "secret" }),
      daemonRegistry: path.join(os.tmpdir(), `attend-test-daemons-${uniq}.json`),
      analysisCache: path.join(os.tmpdir(), `attend-test-analysis-${uniq}.json`),
      overrides: path.join(os.tmpdir(), `attend-test-ov-${uniq}.json`),
      tags: path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`),
      engagement: path.join(os.tmpdir(), `attend-test-engagement-${uniq}.json`),
      sessionStatus: path.join(os.tmpdir(), `attend-test-session-status-${uniq}.json`),
    };
    const { app } = appWithSpy(config);

    const res = await app.request("/");
    const html = await res.text();
    const vaultName = path.basename(vaultRoot);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain(
      `<span class="brand-scope" title="Attend — ${vaultName}">${vaultName}</span>`,
    );
    expect(html).not.toContain(">locked</span>");
  });
});

describe("GET /models/codex", () => {
  it("reads the latest Codex model cache on every request", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-model-route-"));
    const cache = path.join(root, "models_cache.json");
    const config = { ...resolveConfig({ positionals: [] }), codexModelsCache: cache };
    const { app } = appWithSpy(config);
    fs.writeFileSync(cache, JSON.stringify({ models: [{ slug: "gpt-5.5", visibility: "list" }] }));

    const firstResponse = await app.request("/models/codex");
    const first = (await firstResponse.json()) as {
      models: Array<{ value: string }>;
    };
    fs.writeFileSync(cache, JSON.stringify({ models: [{ slug: "gpt-5.6", visibility: "list" }] }));
    const second = (await (await app.request("/models/codex")).json()) as {
      models: Array<{ value: string }>;
    };

    expect(first.models.map((model) => model.value)).toEqual(["gpt-5.5"]);
    expect(second.models.map((model) => model.value)).toEqual(["gpt-5.6"]);
    expect(firstResponse.headers.get("cache-control")).toBe("no-store");
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe("GET /models/claude", () => {
  it("reads the latest Claude model cache on every request", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-claude-model-route-"));
    const cache = path.join(root, "gateway-models.json");
    const config = {
      ...resolveConfig({ positionals: [] }),
      claudeModels: [],
      claudeModelsCache: cache,
    };
    const { app } = appWithSpy(config);
    fs.writeFileSync(cache, JSON.stringify({ models: [{ id: "claude-sonnet-5" }] }));

    const firstResponse = await app.request("/models/claude");
    const first = (await firstResponse.json()) as {
      models: Array<{ value: string }>;
    };
    fs.writeFileSync(cache, JSON.stringify({ models: [{ id: "claude-fable-5" }] }));
    const second = (await (await app.request("/models/claude")).json()) as {
      models: Array<{ value: string }>;
    };

    expect(first.models.map((model) => model.value)).toEqual(["claude-sonnet-5"]);
    expect(second.models.map((model) => model.value)).toEqual(["claude-fable-5"]);
    expect(firstResponse.headers.get("cache-control")).toBe("no-store");
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe("vault UI state", () => {
  it("persists browser-independent preferences in the scoped vault", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-vault-ui-"));
    const config = resolveConfig({ positionals: [root] });
    const { app } = appWithSpy(config);
    const res = await app.request("/vault/ui-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: "dark", modelPrefs: { codex: { effort: "medium" } } }),
    });

    expect(res.status).toBe(200);
    expect(JSON.parse(fs.readFileSync(config.uiState, "utf-8"))).toMatchObject({
      theme: "dark",
      modelPrefs: { codex: { effort: "medium" } },
    });
    fs.rmSync(root, { recursive: true, force: true });
  });
});

class FakeCodexDriver implements ChatDriver {
  readonly vendor = "codex";
  readonly starts: StartOpts[] = [];
  readonly sends: Array<{ sessionId: string; turn: UserTurn }> = [];
  readonly interrupts: string[] = [];
  interruptResult = false;
  active: Array<{ sessionId: string; startedAt: number; clientSessionId?: string }> = [];
  readonly turnEndListeners = new Set<(sessionId: string) => void>();

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
    this.interrupts.push(_sessionId);
    return Promise.resolve(this.interruptResult);
  }

  subscribe(_sessionId: string, _onEvent: (ev: UiEvent) => void): () => void {
    return () => {};
  }

  activeSessions(): string[] {
    return this.active.map((s) => s.sessionId);
  }

  activeSessionStates(): Array<{
    sessionId: string;
    startedAt: number;
    clientSessionId?: string;
  }> {
    return this.active;
  }

  onTurnEnd(cb: (sessionId: string) => void): () => void {
    this.turnEndListeners.add(cb);
    return () => this.turnEndListeners.delete(cb);
  }

  finishTurn(sessionId: string): void {
    this.active = this.active.filter((state) => state.sessionId !== sessionId);
    for (const cb of this.turnEndListeners) cb(sessionId);
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

describe("GET /dirs/suggest", () => {
  it("lists local child directories for an absolute directory input", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-dirs-"));
    const child = path.join(root, "magicline");
    const file = path.join(root, "notes.txt");
    fs.mkdirSync(child);
    fs.writeFileSync(file, "x");
    try {
      const { app } = appWithSpy(resolveConfig({ positionals: [root] }));
      const res = await app.request(`/dirs/suggest?q=${encodeURIComponent(root + path.sep)}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { dirs: Array<{ path: string; source: string }> };
      expect(body.dirs).toContainEqual({ path: child, source: "folder" });
      expect(body.dirs.map((d) => d.path)).not.toContain(file);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("lists scoped child directories for a relative prefix", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-dirs-"));
    const child = path.join(root, "ai_call");
    fs.mkdirSync(child);
    try {
      const { app } = appWithSpy(resolveConfig({ positionals: [root] }));
      const res = await app.request(`/dirs/suggest?q=${encodeURIComponent("ai_")}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { dirs: Array<{ path: string; source: string }> };
      expect(body.dirs).toContainEqual({ path: child, source: "folder" });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("POST /session/override", () => {
  // Build an app whose override store points at a throwaway temp file (never the
  // real ~/.attend/overrides.json).
  function appWithOverrides() {
    const uniq = Math.random().toString(36).slice(2);
    const config = {
      ...resolveConfig({ positionals: [] }),
      claudeProjects: path.join(os.tmpdir(), `attend-test-claude-${uniq}`),
      codexSessions: path.join(os.tmpdir(), `attend-test-codex-${uniq}`),
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

  it("pins state and pattern overrides", async () => {
    const app = appWithOverrides();
    const res = await post(app, "?session=s1", { state: "blocked", pattern: "avoidance" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      override: { state: "blocked", pattern: "avoidance" },
    });
    const clear = await post(app, "?session=s1", { pattern: "unknown" });
    expect(clear.status).toBe(200);
    expect(await clear.json()).toMatchObject({
      ok: true,
      override: { state: "blocked", pattern: "unknown" },
    });
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

  it("persists session tags under the daemon brief key", async () => {
    const uniq = Math.random().toString(36).slice(2);
    const claudeProjects = fs.mkdtempSync(path.join(os.tmpdir(), `attend-test-claude-${uniq}-`));
    const tagFile = path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`);
    const cwd = path.join(os.tmpdir(), `attend-test-project-${uniq}`);
    fs.mkdirSync(cwd, { recursive: true });
    const projectDir = path.join(claudeProjects, "project");
    fs.mkdirSync(projectDir);
    fs.writeFileSync(
      path.join(projectDir, "s1.jsonl"),
      JSON.stringify({
        type: "user",
        timestamp: "2026-06-01T00:00:00.000Z",
        cwd,
        sessionId: "s1",
        message: { content: "first prompt" },
      }),
    );
    const config = {
      ...resolveConfig({ positionals: [] }),
      claudeProjects,
      tags: tagFile,
      overrides: path.join(os.tmpdir(), `attend-test-ov-${uniq}.json`),
    };
    const cache = new AnalysisCache(path.join(os.tmpdir(), `attend-test-analysis-${uniq}.json`));
    cache.set("s1", {
      brief: "Shared task",
      state: "needs_review",
      priority: 5,
      etaMin: 2,
      reason: "test",
    });
    const orchestrator = new DaemonOrchestrator(
      new DaemonRegistry(path.join(os.tmpdir(), `attend-test-daemons-${uniq}.json`)),
      cache,
      [new ClaudeAnalyzer(os.tmpdir(), fakeQuery)],
    );
    const app = createApp(config, {
      launcher: () => "noop",
      engine: new ChatEngine(fakeQuery),
      orchestrator,
    });

    await post(app, "/session/tags?session=s1", { tags: ["work"] });

    const persisted = JSON.parse(fs.readFileSync(tagFile, "utf-8")) as {
      sessions: Record<string, string[]>;
    };
    expect(persisted.sessions.s1).toEqual(["work"]);
    expect(persisted.sessions[`brief:claude:${cwd}:Shared task`]).toEqual(["work"]);
    expect(
      Object.entries(persisted.sessions).some(
        ([key, value]) => key.startsWith(`title:claude:${cwd}:`) && value[0] === "work",
      ),
    ).toBe(true);
    expect(
      Object.entries(persisted.sessions).some(
        ([key, value]) => key.startsWith("path:claude:") && value[0] === "work",
      ),
    ).toBe(true);
    fs.rmSync(claudeProjects, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("deletes a global tag", async () => {
    const app = appWithTags();
    await post(app, "/session/tags?session=s1", { tags: ["work", "urgent"] });
    const res = await app.request("/tags?name=urgent", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, tags: ["work"] });
  });

  it("reorders global tags", async () => {
    const app = appWithTags();
    await post(app, "/session/tags?session=s1", { tags: ["work", "urgent", "later"] });

    const res = await post(app, "/tags/order", { tags: ["later", "work", "urgent"] });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, tags: ["later", "work", "urgent"] });
  });

  it("keeps tag write responses scoped to the current vault", async () => {
    const uniq = Math.random().toString(36).slice(2);
    const claudeProjects = fs.mkdtempSync(path.join(os.tmpdir(), `attend-test-claude-${uniq}-`));
    const currentRoot = fs.mkdtempSync(path.join(os.tmpdir(), `attend-test-vault-a-${uniq}-`));
    const otherRoot = fs.mkdtempSync(path.join(os.tmpdir(), `attend-test-vault-b-${uniq}-`));
    const projectDir = path.join(claudeProjects, "project");
    const tagFile = path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`);
    fs.mkdirSync(projectDir);
    fs.writeFileSync(
      path.join(projectDir, "s1.jsonl"),
      JSON.stringify({
        type: "user",
        timestamp: "2026-06-01T00:00:00.000Z",
        cwd: path.join(currentRoot, "app"),
        sessionId: "s1",
        message: { content: "current vault" },
      }),
    );
    fs.writeFileSync(
      path.join(projectDir, "s2.jsonl"),
      JSON.stringify({
        type: "user",
        timestamp: "2026-06-01T00:01:00.000Z",
        cwd: path.join(otherRoot, "app"),
        sessionId: "s2",
        message: { content: "other vault" },
      }),
    );
    fs.writeFileSync(
      tagFile,
      JSON.stringify({
        tags: ["local", "foreign"],
        sessions: { s1: ["local"], s2: ["foreign"] },
      }),
    );
    const config = {
      ...resolveConfig({ positionals: [] }),
      scopeRoots: [currentRoot],
      claudeProjects,
      codexSessions: path.join(os.tmpdir(), `attend-test-codex-${uniq}`),
      tags: tagFile,
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

    try {
      expect(await (await post(app, "/tags", { name: "new local" })).json()).toMatchObject({
        ok: true,
        tags: ["local", "new local"],
      });
      const persistedAfterCreate = JSON.parse(fs.readFileSync(tagFile, "utf-8")) as {
        sessions: Record<string, string[]>;
      };
      expect(persistedAfterCreate.sessions[`scope:${currentRoot}`]).toEqual(["new local"]);

      expect(
        await (
          await post(app, "/session/tags?session=s1", { tags: ["local", "tab local"] })
        ).json(),
      ).toMatchObject({
        ok: true,
        sessionTags: ["local", "tab local"],
        tags: ["local", "new local", "tab local"],
      });

      const restarted = createApp(config, {
        launcher: () => "noop",
        engine: new ChatEngine(fakeQuery),
        orchestrator,
      });
      const html = await (await restarted.request("/")).text();
      expect(html).toContain('"local"');
      expect(html).toContain('"new local"');
      expect(html).not.toContain('"foreign"');
    } finally {
      fs.rmSync(claudeProjects, { recursive: true, force: true });
      fs.rmSync(currentRoot, { recursive: true, force: true });
      fs.rmSync(otherRoot, { recursive: true, force: true });
      fs.rmSync(tagFile, { force: true });
    }
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

  async function appWithTrackedSession(endedAt = Date.now(), activityAt = Date.now() - 60_000) {
    const uniq = Math.random().toString(36).slice(2);
    const claudeProjects = path.join(os.tmpdir(), `attend-test-projects-${uniq}`);
    const root = path.join(os.tmpdir(), `attend-test-root-${uniq}`);
    const cwd = path.join(root, "child");
    const projectDir = path.join(claudeProjects, "-tmp-proj");
    const transcript = path.join(projectDir, "s1.jsonl");
    await fs.promises.mkdir(cwd, { recursive: true });
    await fs.promises.mkdir(projectDir, { recursive: true });
    await fs.promises.writeFile(
      transcript,
      [
        JSON.stringify({
          type: "user",
          sessionId: "s1",
          cwd,
          timestamp: new Date(activityAt - 10_000).toISOString(),
          message: { content: "first prompt" },
        }),
        JSON.stringify({
          type: "assistant",
          sessionId: "s1",
          cwd,
          timestamp: new Date(activityAt).toISOString(),
          message: { content: [{ type: "text", text: "reply" }] },
        }),
      ].join("\n"),
    );
    const config = {
      ...resolveConfig({ positionals: [] }),
      scopeRoots: [root],
      claudeProjects,
      codexSessions: path.join(os.tmpdir(), `attend-test-codex-${uniq}`),
      engagement: path.join(os.tmpdir(), `attend-test-engagement-${uniq}.json`),
      sessionStatus: path.join(os.tmpdir(), `attend-test-session-status-${uniq}.json`),
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
    return { app, transcript, root, cwd, endedAt };
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

  it("clears avoidance telemetry when a new user message is sent", async () => {
    const endedAt = Date.now();
    const { app, cwd } = await appWithTrackedSession(endedAt);
    const secondReview = await app.request("/session/engagement?session=s1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        viewedMs: 20 * 60_000,
        hadMeaningfulScroll: true,
        hadSend: false,
        endedAt: endedAt + 1_000,
      }),
    });
    expect(secondReview.status).toBe(200);

    const before = await app.request("/");
    const beforeHtml = await before.text();
    const beforeMatch = /window\.__SESSIONS__ = (\[[\s\S]*?\]);/.exec(beforeHtml);
    const beforeSessions = JSON.parse(beforeMatch?.[1] ?? "[]") as Array<Record<string, unknown>>;
    expect(beforeSessions.find((s) => s.sessionId === "s1")).toMatchObject({
      pattern: "avoidance",
    });

    const sent = await app.request(`/chat/send?session=s1&cwd=${encodeURIComponent(cwd)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "here is the decision" }),
    });

    expect(sent.status).toBe(200);
    expect(await sent.json()).toMatchObject({
      ok: true,
      session: "s1",
      view: {
        sessionId: "s1",
        pattern: "unknown",
        patternReason: null,
        patternData: null,
        avoidancePrompt: null,
      },
    });
  });

  it("does not count generating progress visits as review engagement", async () => {
    const app = appWithEngagement();
    const res = await app.request("/session/engagement?session=s1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        viewedMs: 25_000,
        hadMeaningfulScroll: true,
        hadSend: false,
        wasGenerating: true,
        endedAt: 1234,
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      record: { opens: 1, reviewVisits: 0, reviewMs: 0 },
    });
  });

  it("keeps opening a session from changing the recent sort timestamp", async () => {
    const activityAt = Date.now() - 60_000;
    const endedAt = activityAt + 30_000;
    const { app } = await appWithTrackedSession(endedAt, activityAt);
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    const match = /window\.__SESSIONS__ = (\[[\s\S]*?\]);/.exec(html);
    expect(match?.[1]).toBeTruthy();
    const sessions = JSON.parse(match?.[1] ?? "[]") as Array<Record<string, unknown>>;
    const s1 = sessions.find((s) => s.sessionId === "s1");
    expect(s1).toMatchObject({
      lastTs: activityAt,
      sortTs: activityAt,
    });
  });

  it("includes current throughput stats in live snapshots", async () => {
    const { app } = await appWithTrackedSession();
    const res = await app.request("/chat/live");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      stats: { sessionsPerHour: 1 / 24 },
    });
  });

  it("stores unfinished tab state under the scope root and deletes it when grayed", async () => {
    const { app, root, cwd } = await appWithTrackedSession();
    const statusFile = path.join(root, ".attend", "session-status.json");
    const childStatusFile = path.join(cwd, ".attend", "session-status.json");

    const markAlreadyRead = await app.request(
      `/session/status?session=s1&cwd=${encodeURIComponent(cwd)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: "read", updatedAt: 1111 }),
      },
    );
    expect(markAlreadyRead.status).toBe(200);
    expect(fs.existsSync(statusFile)).toBe(false);
    expect(fs.existsSync(childStatusFile)).toBe(false);

    const markSeen = await app.request(
      `/session/status?session=s1&cwd=${encodeURIComponent(cwd)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: "seen", updatedAt: 1234 }),
      },
    );
    expect(markSeen.status).toBe(200);
    expect(JSON.parse(fs.readFileSync(statusFile, "utf-8"))).toMatchObject({
      sessions: { s1: { state: "seen", updatedAt: 1234 } },
    });
    expect(fs.existsSync(childStatusFile)).toBe(false);

    const res = await app.request("/");
    const html = await res.text();
    const match = /window\.__SESSIONS__ = (\[[\s\S]*?\]);/.exec(html);
    const sessions = JSON.parse(match?.[1] ?? "[]") as Array<Record<string, unknown>>;
    expect(sessions.find((s) => s.sessionId === "s1")).toMatchObject({ seen: true });

    const markRead = await app.request(
      `/session/status?session=s1&cwd=${encodeURIComponent(cwd)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: "read", updatedAt: 2345 }),
      },
    );
    expect(markRead.status).toBe(200);
    expect(JSON.parse(fs.readFileSync(statusFile, "utf-8"))).toEqual({ sessions: {} });
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

describe("external Codex active state", () => {
  function appWithExternalCodexSession() {
    const uniq = Math.random().toString(36).slice(2);
    const codexSessions = fs.mkdtempSync(path.join(os.tmpdir(), `attend-test-codex-${uniq}-`));
    const claudeProjects = fs.mkdtempSync(path.join(os.tmpdir(), `attend-test-claude-${uniq}-`));
    const startedAt = Date.now() - 10_000;
    const touchedAt = Date.now() - 5_000;
    fs.writeFileSync(
      path.join(codexSessions, "rollout-live.jsonl"),
      [
        JSON.stringify({
          timestamp: new Date(startedAt).toISOString(),
          type: "session_meta",
          payload: { id: "cx-live", cwd: os.tmpdir() },
        }),
        JSON.stringify({
          timestamp: new Date(startedAt).toISOString(),
          type: "event_msg",
          payload: {
            type: "task_started",
            turn_id: "turn-live",
            started_at: Math.floor(startedAt / 1000),
          },
        }),
        JSON.stringify({
          timestamp: new Date(touchedAt).toISOString(),
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "fix the status dot" }],
          },
        }),
        JSON.stringify({
          timestamp: new Date(touchedAt).toISOString(),
          type: "response_item",
          payload: {
            type: "function_call",
            name: "exec_command",
            arguments: '{"cmd":"pwd"}',
            call_id: "call-live",
          },
        }),
      ].join("\n"),
    );

    const config = {
      ...resolveConfig({ positionals: [] }),
      claudeProjects,
      codexSessions,
      engagement: path.join(os.tmpdir(), `attend-test-engagement-${uniq}.json`),
      sessionStatus: path.join(os.tmpdir(), `attend-test-session-status-${uniq}.json`),
      tags: path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`),
      overrides: path.join(os.tmpdir(), `attend-test-ov-${uniq}.json`),
    };
    const calls: Call[] = [];
    const codex = new FakeCodexDriver();
    const orchestrator = new DaemonOrchestrator(
      new DaemonRegistry(path.join(os.tmpdir(), `attend-test-daemons-${uniq}.json`)),
      new AnalysisCache(path.join(os.tmpdir(), `attend-test-analysis-${uniq}.json`)),
      [new ClaudeAnalyzer(os.tmpdir(), fakeQuery)],
    );
    return {
      app: createApp(config, {
        launcher: (action, vendor, cwd, opts) => {
          calls.push({ action, vendor, cwd, opts });
          return `${vendor} ${action}`;
        },
        engine: new ChatEngine(fakeQuery),
        codex,
        orchestrator,
      }),
      calls,
      config,
      codex,
    };
  }

  function appendCodexActivityAfterStop(config: ReturnType<typeof resolveConfig>) {
    const rollout = path.join(config.codexSessions, "rollout-live.jsonl");
    fs.appendFileSync(
      rollout,
      `\n${JSON.stringify({
        timestamp: new Date(Date.now() + 1_000).toISOString(),
        type: "response_item",
        payload: {
          type: "function_call_output",
          call_id: "call-live",
          output: "late buffered output",
        },
      })}`,
    );
  }

  it("marks externally-running Codex rollouts generating in the initial page", async () => {
    const { app } = appWithExternalCodexSession();
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    const match = /window\.__SESSIONS__ = (\[[\s\S]*?\]);/.exec(html);
    const sessions = JSON.parse(match?.[1] ?? "[]") as Array<Record<string, unknown>>;
    expect(sessions.find((s) => s.sessionId === "cx-live")).toMatchObject({
      generating: true,
    });
  });

  it("includes externally-running Codex rollouts in /chat/live", async () => {
    const { app } = appWithExternalCodexSession();
    const res = await app.request("/chat/live");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      active: expect.arrayContaining(["cx-live"]),
    });
  });

  it("suppresses stale transcript active state after a local Codex stop", async () => {
    const { app, codex } = appWithExternalCodexSession();
    codex.interruptResult = true;

    const before = await app.request("/chat/live");
    expect(await before.json()).toMatchObject({ active: expect.arrayContaining(["cx-live"]) });

    const stop = await app.request("/chat/abort?session=cx-live&vendor=codex", { method: "POST" });
    expect(await stop.json()).toMatchObject({ ok: true, session: "cx-live" });

    const live = (await (await app.request("/chat/live")).json()) as { active: string[] };
    expect(live.active).not.toContain("cx-live");

    const page = await app.request("/");
    const html = await page.text();
    const match = /window\.__SESSIONS__ = (\[[\s\S]*?\]);/.exec(html);
    const sessions = JSON.parse(match?.[1] ?? "[]") as Array<Record<string, unknown>>;
    expect(sessions.find((s) => s.sessionId === "cx-live")).toMatchObject({
      generating: false,
    });
  });

  it("keeps a stopped external turn suppressed when late transcript lines arrive", async () => {
    const { app, codex, config } = appWithExternalCodexSession();
    codex.interruptResult = true;

    const stop = await app.request("/chat/abort?session=cx-live&vendor=codex", { method: "POST" });
    expect(await stop.json()).toMatchObject({ ok: true, session: "cx-live" });
    appendCodexActivityAfterStop(config);

    const live = (await (await app.request("/chat/live")).json()) as { active: string[] };
    expect(live.active).not.toContain("cx-live");
  });

  it("suppresses stale transcript active state even when no live run is interruptible", async () => {
    const { app } = appWithExternalCodexSession();

    const stop = await app.request("/chat/abort?session=cx-live&vendor=codex", { method: "POST" });
    expect(await stop.json()).toMatchObject({ ok: false, session: "cx-live" });

    const live = (await (await app.request("/chat/live")).json()) as { active: string[] };
    expect(live.active).not.toContain("cx-live");
  });

  it("routes abort by session id when the vendor query is missing or stale", async () => {
    const { app, codex } = appWithExternalCodexSession();
    codex.active = [{ sessionId: "cx-live", startedAt: Date.now() - 1000 }];
    codex.interruptResult = true;

    const stop = await app.request("/chat/abort?session=cx-live", { method: "POST" });
    expect(await stop.json()).toMatchObject({ ok: true, session: "cx-live" });
    expect(codex.interrupts).toContain("cx-live");
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
      chatQueue: path.join(os.tmpdir(), `attend-test-queue-${uniq}.json`),
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

describe("GET /search", () => {
  it("finds transcript content in listed sessions", async () => {
    const uniq = Math.random().toString(36).slice(2);
    const claudeProjects = path.join(os.tmpdir(), `attend-test-projects-${uniq}`);
    const codexSessions = path.join(os.tmpdir(), `attend-test-codex-${uniq}`);
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
          timestamp: new Date(Date.now() - 10_000).toISOString(),
          message: { content: "first prompt" },
        }),
        JSON.stringify({
          type: "assistant",
          sessionId: "s1",
          cwd: "/tmp/proj",
          timestamp: new Date(Date.now() - 5_000).toISOString(),
          message: {
            content: [{ type: "text", text: "The deploy failed because port 5050 was busy." }],
          },
        }),
      ].join("\n"),
    );
    const config = {
      ...resolveConfig({ positionals: [] }),
      claudeProjects,
      codexSessions,
      overrides: path.join(os.tmpdir(), `attend-test-ov-${uniq}.json`),
      tags: path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`),
      engagement: path.join(os.tmpdir(), `attend-test-engagement-${uniq}.json`),
      sessionStatus: path.join(os.tmpdir(), `attend-test-session-status-${uniq}.json`),
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

    try {
      const res = await app.request(`/search?q=${encodeURIComponent("port 5050")}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        results: [
          {
            vendor: "claude",
            sessionId: "s1",
            file: transcript,
            count: 1,
            hits: [{ role: "assistant", text: "The deploy failed because port 5050 was busy." }],
          },
        ],
      });
    } finally {
      fs.rmSync(claudeProjects, { recursive: true, force: true });
      fs.rmSync(codexSessions, { recursive: true, force: true });
    }
  });
});

describe("POST /chat/new + /chat/fork + /chat/send (faked SDK)", () => {
  function appWithCodexSpy() {
    const codex = new FakeCodexDriver();
    const uniq = Math.random().toString(36).slice(2);
    const config = {
      ...resolveConfig({ positionals: [] }),
      claudeProjects: path.join(os.tmpdir(), `attend-test-claude-${uniq}`),
      codexSessions: path.join(os.tmpdir(), `attend-test-codex-${uniq}`),
      overrides: path.join(os.tmpdir(), `attend-test-ov-${uniq}.json`),
      tags: path.join(os.tmpdir(), `attend-test-tags-${uniq}.json`),
      chatQueue: path.join(os.tmpdir(), `attend-test-queue-${uniq}.json`),
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
      config,
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

  it("passes model and effort through in-browser fork sessions", async () => {
    const { app } = appWithSpy();
    const res = await app.request(`/chat/fork?session=abc&cwd=${tmp}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "try another approach",
        model: "sonnet",
        effort: "xhigh",
        clientSessionId: "branch-ui-claude",
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.clone().json()).toMatchObject({ clientSessionId: "branch-ui-claude" });
    expect(queryCalls[0]?.options).toMatchObject({
      resume: "abc",
      forkSession: true,
      model: "sonnet",
      effort: "xhigh",
    });
  });

  it("starts context-prefix forks without resuming the parent session", async () => {
    const { app, codex } = appWithCodexSpy();
    const res = await app.request(`/chat/fork?session=parent-1&cwd=${tmp}&vendor=codex`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "edited opener",
        clientSessionId: "branch-ui-codex",
        contextMessages: [
          { role: "user", text: "original prompt" },
          { role: "assistant", text: "original answer", tools: [{ name: "Bash" }] },
        ],
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      cwd: os.tmpdir(),
      project: path.basename(os.tmpdir()),
      forkMode: "context-prefix",
    });
    expect(codex.starts[0]).toMatchObject({
      cwd: os.tmpdir(),
      clientSessionId: "branch-ui-codex",
    });
    expect(codex.starts[0]?.resume).toBeUndefined();
    expect(codex.starts[0]?.forkSession).toBeUndefined();
    expect(codex.starts[0]?.firstText).toMatch(/^edited opener\n/);
    expect(codex.starts[0]?.firstText).toContain("Transcript:");
    expect(codex.starts[0]?.firstText).toContain("User: original prompt");
    expect(codex.starts[0]?.firstText).toContain("Assistant: original answer");
    expect(codex.starts[0]?.firstText).toContain("[tools: Bash]");
    expect(codex.starts[0]?.firstText).toContain("Attend fork context:");
  });

  it("passes model and effort through same-session configured sends", async () => {
    const { app } = appWithSpy();
    const res = await app.request(`/chat/send?session=abc&cwd=${tmp}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "continue here",
        runConfig: true,
        model: "opus",
        effort: "high",
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, session: "abc" });
    expect(queryCalls[0]?.options).toMatchObject({
      resume: "abc",
      model: "opus",
      effort: "high",
    });
  });

  it("includes stable client identities in the global live snapshot", async () => {
    const { app, codex } = appWithCodexSpy();
    codex.active = [
      {
        sessionId: "cx-provider-1",
        clientSessionId: "branch-ui-1",
        startedAt: Date.now(),
      },
    ];
    expect(await (await app.request("/chat/live")).json()).toMatchObject({
      active: ["cx-provider-1"],
      clientSessionIds: { "cx-provider-1": "branch-ui-1" },
    });
  });

  it("advances a persisted queue on turn-end while no browser session is selected", async () => {
    const { app, codex } = appWithCodexSpy();
    codex.active = [{ sessionId: "cx-1", startedAt: Date.now() }];
    const queued = await app.request(
      `/chat/queue?session=cx-1&cwd=${encodeURIComponent(os.tmpdir())}&vendor=codex`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "run after the current turn" }),
      },
    );
    expect(await queued.json()).toMatchObject({
      ok: true,
      items: [{ text: "run after the current turn" }],
    });
    expect(codex.sends).toHaveLength(0);

    codex.finishTurn("cx-1");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(codex.sends).toEqual([
      { sessionId: "cx-1", turn: expect.objectContaining({ text: "run after the current turn" }) },
    ]);
    const remaining = await app.request("/chat/queue?session=cx-1");
    expect(await remaining.json()).toMatchObject({ ok: true, items: [], parked: false });
  });

  it("parks the server queue on Stop until a queued item is explicitly sent", async () => {
    const { app, codex } = appWithCodexSpy();
    codex.active = [{ sessionId: "cx-1", startedAt: Date.now() }];
    codex.interruptResult = true;
    const queued = await app.request(
      `/chat/queue?session=cx-1&cwd=${encodeURIComponent(os.tmpdir())}&vendor=codex`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "keep parked" }),
      },
    );
    const queuedBody = (await queued.json()) as { item: { id: string } };
    await app.request("/chat/abort?session=cx-1&vendor=codex", { method: "POST" });
    codex.finishTurn("cx-1");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(codex.sends).toHaveLength(0);

    const sent = await app.request(
      `/chat/queue/send?session=cx-1&item=${encodeURIComponent(queuedBody.item.id)}`,
      { method: "POST" },
    );
    expect(await sent.json()).toMatchObject({ ok: true, items: [] });
    expect(codex.sends[0]).toMatchObject({ sessionId: "cx-1", turn: { text: "keep parked" } });
  });

  it("persists inherited tags when forking a session", async () => {
    const { app, config } = appWithCodexSpy();
    const uniq = Math.random().toString(36).slice(2);
    const claudeProjects = fs.mkdtempSync(path.join(os.tmpdir(), `attend-test-claude-${uniq}-`));
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `attend-test-cwd-${uniq}-`));
    const projectDir = path.join(claudeProjects, "project");
    fs.mkdirSync(projectDir);
    fs.writeFileSync(
      path.join(projectDir, "parent-1.jsonl"),
      JSON.stringify({
        type: "user",
        timestamp: "2026-06-01T00:00:00.000Z",
        cwd,
        sessionId: "parent-1",
        message: { content: "parent prompt" },
      }),
    );
    config.claudeProjects = claudeProjects;
    fs.writeFileSync(
      config.tags,
      JSON.stringify({ tags: ["work"], sessions: { "parent-1": ["work"] } }),
    );

    const res = await app.request(
      `/chat/fork?session=parent-1&cwd=${encodeURIComponent(cwd)}&vendor=codex`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "branch" }),
      },
    );

    expect(res.status).toBe(200);
    const persisted = JSON.parse(fs.readFileSync(config.tags, "utf-8")) as {
      sessions: Record<string, string[]>;
    };
    expect(persisted.sessions["cx-1"]).toEqual(["work"]);
  });

  it("passes codex new-session attachments through to the codex driver", async () => {
    const { app, codex } = appWithCodexSpy();
    const res = await app.request(`/chat/new?cwd=${tmp}&vendor=codex`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attachments: [
          { kind: "text", name: "notes.md", text: "# start here" },
          { kind: "image", name: "ui.png", mediaType: "image/png", data: "abcd" },
        ],
      }),
    });
    expect(res.status).toBe(200);
    expect(codex.starts[0]).toMatchObject({
      cwd: os.tmpdir(),
      firstText: "",
      firstAttachments: [
        { kind: "text", name: "notes.md", text: "# start here" },
        { kind: "image", name: "ui.png", mediaType: "image/png", data: "abcd" },
      ],
    });
  });

  it("passes Excel attachments through to the codex driver", async () => {
    const { app, codex } = appWithCodexSpy();
    const res = await app.request(`/chat/new?cwd=${tmp}&vendor=codex`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attachments: [
          {
            kind: "file",
            name: "budget.xlsx",
            mediaType: "application/octet-stream",
            data: "abcd",
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    expect(codex.starts[0]).toMatchObject({
      firstAttachments: [
        {
          kind: "file",
          name: "budget.xlsx",
          mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          data: "abcd",
        },
      ],
    });
  });

  it("rejects codex PDF attachments on new sessions", async () => {
    const { app, codex } = appWithCodexSpy();
    const res = await app.request(`/chat/new?cwd=${tmp}&vendor=codex`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attachments: [{ kind: "document", name: "brief.pdf", data: "abcd" }],
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Codex chat does not support PDF attachments",
    });
    expect(codex.starts).toHaveLength(0);
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

  it("starts a transcript-context fork when switching providers", async () => {
    const { app, codex, config } = appWithCodexSpy();
    const uniq = Math.random().toString(36).slice(2);
    const claudeProjects = fs.mkdtempSync(path.join(os.tmpdir(), `attend-test-claude-${uniq}-`));
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `attend-test-cwd-${uniq}-`));
    const projectDir = path.join(claudeProjects, "project");
    fs.mkdirSync(projectDir);
    fs.writeFileSync(
      path.join(projectDir, "parent-ctx.jsonl"),
      [
        JSON.stringify({
          type: "user",
          timestamp: "2026-06-01T00:00:00.000Z",
          cwd,
          sessionId: "parent-ctx",
          message: { content: "original task" },
        }),
        JSON.stringify({
          type: "assistant",
          timestamp: "2026-06-01T00:00:01.000Z",
          cwd,
          sessionId: "parent-ctx",
          message: { content: [{ type: "text", text: "previous answer" }] },
        }),
      ].join("\n"),
    );
    config.claudeProjects = claudeProjects;

    const res = await app.request(
      `/chat/fork?session=parent-ctx&cwd=${encodeURIComponent(cwd)}&vendor=codex`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "branch with Codex", model: "gpt-5.5", effort: "high" }),
      },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      session: "cx-1",
      forkMode: "provider-context",
    });
    expect(codex.starts[0]).toMatchObject({
      cwd,
      model: "gpt-5.5",
      effort: "high",
    });
    expect(codex.starts[0]?.resume).toBeUndefined();
    expect(codex.starts[0]?.forkSession).toBeUndefined();
    expect(codex.starts[0]?.firstText).toContain("originally ran in claude");
    expect(codex.starts[0]?.firstText).toContain("original task");
    expect(codex.starts[0]?.firstText).toContain("branch with Codex");
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
