import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ClaudeAnalyzer } from "../src/chat/analyzer/claude.js";
import { DaemonOrchestrator } from "../src/chat/daemon.js";
import { ChatEngine, type QueryFn } from "../src/chat/engine.js";
import { resolveConfig } from "../src/config.js";
import { AnalysisCache } from "../src/core/daemon/cache.js";
import { DaemonRegistry } from "../src/core/daemon/registry.js";
import type { LaunchAction, LaunchVendor } from "../src/core/launch.js";
import { type AppDeps, createApp, startServer } from "../src/server.js";

interface Call {
  action: LaunchAction;
  vendor: LaunchVendor;
  cwd: string;
  opts: { sessionId?: string; prompt?: string };
}

// Fake SDK query(): yields init → assistant → result, no network.
const fakeQuery = (() => {
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

function appWithSpy() {
  const calls: Call[] = [];
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
    engine: new ChatEngine(fakeQuery),
    orchestrator,
  };
  return { app: createApp(resolveConfig({ positionals: [] }), deps), calls };
}

const tmp = encodeURIComponent(os.tmpdir());

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

describe("POST /chat/new + /chat/fork + /chat/send (faked SDK)", () => {
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
