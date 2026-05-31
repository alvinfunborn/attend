import os from "node:os";
import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";
import type { ForkVendor } from "../src/core/fork.js";
import { type AppDeps, createApp } from "../src/server.js";

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
