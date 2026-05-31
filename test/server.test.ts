import net from "node:net";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";
import type { ForkVendor } from "../src/core/fork.js";
import { type AppDeps, createApp, startServer } from "../src/server.js";

function appWithSpy() {
  const calls: Array<{ vendor: ForkVendor; id: string; cwd: string }> = [];
  const deps: AppDeps = {
    forkLauncher: (vendor, id, cwd) => {
      calls.push({ vendor, id, cwd });
      return `${vendor} fork ${id}`;
    },
  };
  return { app: createApp(resolveConfig({ positionals: [] }), deps), calls };
}

const tmp = encodeURIComponent(os.tmpdir());

describe("POST /fork", () => {
  it("launches a fork for a valid request and echoes the command", async () => {
    const { app, calls } = appWithSpy();
    const res = await app.request(`/fork?vendor=codex&id=abc-123&cwd=${tmp}`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, command: "codex fork abc-123" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.vendor).toBe("codex");
  });

  it("rejects an unknown vendor without launching", async () => {
    const { app, calls } = appWithSpy();
    const res = await app.request(`/fork?vendor=gemini&id=abc&cwd=${tmp}`, { method: "POST" });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("rejects an unsafe session id", async () => {
    const { app, calls } = appWithSpy();
    const res = await app.request(
      `/fork?vendor=claude&id=${encodeURIComponent("a; rm -rf /")}&cwd=${tmp}`,
      {
        method: "POST",
      },
    );
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("rejects a non-existent cwd", async () => {
    const { app } = appWithSpy();
    const res = await app.request(
      `/fork?vendor=claude&id=abc&cwd=${encodeURIComponent("/no/such/dir/xyz")}`,
      {
        method: "POST",
      },
    );
    expect(res.status).toBe(400);
  });
});

describe("startServer port rollover", () => {
  const cleanup: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanup.splice(0)) fn();
  });

  it("rolls forward to the next free port when the requested one is taken", async () => {
    // occupy an ephemeral port, then ask attend to bind it
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
