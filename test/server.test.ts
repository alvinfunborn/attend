import net from "node:net";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ChatEngine, type QueryFn } from "../src/chat/engine.js";
import { resolveConfig } from "../src/config.js";
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
  const deps: AppDeps = {
    launcher: (action, vendor, cwd, opts) => {
      calls.push({ action, vendor, cwd, opts });
      return `${vendor} ${action}`;
    },
    engine: new ChatEngine(fakeQuery),
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

  it("rejects new without a directory or message", async () => {
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
    expect(
      (
        await app.request(`/chat/new?cwd=${tmp}`, {
          method: "POST",
          body: JSON.stringify({ text: "" }),
          headers: { "content-type": "application/json" },
        })
      ).status,
    ).toBe(400);
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

  it("fork returns the new session id", async () => {
    const { app } = appWithSpy();
    const res = await app.request(`/chat/fork?session=abc&cwd=${tmp}`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, session: "fake-1" });
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
