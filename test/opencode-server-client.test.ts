import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OpencodeServerClient,
  opencodePromptBody,
  withAutoApprove,
} from "../src/chat/opencode/server/client.js";

class FakeStream extends EventEmitter {
  setEncoding(): void {}
}

class FakeChild extends EventEmitter {
  pid = 4242;
  readonly stdout = new FakeStream();
  readonly stderr = new FakeStream();
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  readonly signals: NodeJS.Signals[] = [];

  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    this.signals.push(signal);
    this.exit(0, signal);
    return true;
  }

  announce(url: string): void {
    this.stdout.emit("data", `opencode server listening on ${url}\n`);
  }

  exit(code: number | null, signal: NodeJS.Signals | null = null): void {
    if (this.exitCode !== null || this.signalCode !== null) return;
    this.exitCode = code;
    this.signalCode = signal;
    this.emit("exit", code, signal);
  }
}

function spawnRecorder(child: FakeChild) {
  const calls: Array<{ command: string; args: readonly string[]; options: SpawnOptions }> = [];
  const spawn = (command: string, args: readonly string[], options: SpawnOptions): ChildProcess => {
    calls.push({ command, args, options });
    return child as unknown as ChildProcess;
  };
  return { calls, spawn };
}

const tempDirs: string[] = [];

function tempPidFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-opencode-server-"));
  tempDirs.push(dir);
  return path.join(dir, "opencode-server.pid");
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("opencode server client", () => {
  it("spawns one serve process on the allocated port and resolves on the listening line", async () => {
    const child = new FakeChild();
    const { calls, spawn } = spawnRecorder(child);
    const client = new OpencodeServerClient({
      bin: "/opt/bin/opencode",
      spawn,
      pickPort: async () => 4567,
      startupTimeoutMs: 200,
    });

    const starting = client.start();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.command).toBe("/opt/bin/opencode");
    expect(calls[0]?.args).toEqual(["serve", "--hostname=127.0.0.1", "--port=4567"]);

    child.announce("http://127.0.0.1:4567");
    await expect(starting).resolves.toBeUndefined();
    // A second start reuses the running server.
    await client.start();
    expect(calls).toHaveLength(1);

    client.shutdown();
    expect(child.signals).toEqual(["SIGTERM"]);
  });

  it("drops the desktop app's basic-auth env so the server stays credential-free", async () => {
    vi.stubEnv("OPENCODE_SERVER_USERNAME", "opencode");
    vi.stubEnv("OPENCODE_SERVER_PASSWORD", "secret");
    const child = new FakeChild();
    const { calls, spawn } = spawnRecorder(child);
    const client = new OpencodeServerClient({
      bin: "opencode",
      spawn,
      pickPort: async () => 4567,
      startupTimeoutMs: 200,
    });

    const starting = client.start();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    const env = calls[0]?.options.env ?? {};
    expect(env.OPENCODE_SERVER_USERNAME).toBeUndefined();
    expect(env.OPENCODE_SERVER_PASSWORD).toBeUndefined();
    expect(JSON.parse(String(env.OPENCODE_CONFIG_CONTENT))).toEqual({ permission: "allow" });
    child.announce("http://127.0.0.1:4567");
    await starting;
    client.shutdown();
  });

  it("merges auto-approve into config content without dropping existing settings", () => {
    expect(withAutoApprove(undefined)).toBe(JSON.stringify({ permission: "allow" }));
    expect(withAutoApprove(JSON.stringify({ compaction: { auto: true } }))).toBe(
      JSON.stringify({ compaction: { auto: true }, permission: "allow" }),
    );
    expect(withAutoApprove(JSON.stringify({ permission: "deny" }))).toBe(
      JSON.stringify({ permission: "deny" }),
    );
    expect(withAutoApprove("not json")).toBe(JSON.stringify({ permission: "allow" }));
  });

  it("writes its own instance pid record and removes it on shutdown", async () => {
    const pidFile = tempPidFile();
    const ownerFile = `${pidFile}.${process.pid}`;
    const child = new FakeChild();
    const { spawn } = spawnRecorder(child);
    const client = new OpencodeServerClient({
      bin: "opencode",
      pidFile,
      spawn,
      pickPort: async () => 4567,
      startupTimeoutMs: 200,
    });

    const starting = client.start();
    await vi.waitFor(() => expect(fs.existsSync(ownerFile)).toBe(true));
    child.announce("http://127.0.0.1:4567");
    await starting;
    expect(fs.readFileSync(ownerFile, "utf8").trim()).toBe(`${process.pid} 4242`);

    client.shutdown();
    expect(fs.existsSync(ownerFile)).toBe(false);
  });

  it("reaps the orphaned server of a dead Attend instance", async () => {
    const pidFile = tempPidFile();
    const staleFile = `${pidFile}.999998`;
    fs.writeFileSync(staleFile, "999998 9999\n");
    let killed = false;
    const processCommand = vi.fn(async (pid: number) => {
      if (pid !== 9999) return null;
      return killed ? null : "/opt/homebrew/bin/opencode serve --hostname=127.0.0.1 --port=4096";
    });
    const killPid = vi.fn((_pid: number, _signal: NodeJS.Signals) => {
      killed = true;
    });
    const child = new FakeChild();
    const { calls, spawn } = spawnRecorder(child);
    const client = new OpencodeServerClient({
      bin: "opencode",
      pidFile,
      spawn,
      killPid,
      processCommand,
      pickPort: async () => 4567,
      startupTimeoutMs: 200,
    });

    const starting = client.start();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(killPid).toHaveBeenCalledWith(9999, "SIGTERM");
    expect(fs.existsSync(staleFile)).toBe(false);
    child.announce("http://127.0.0.1:4567");
    await starting;
    expect(fs.readFileSync(`${pidFile}.${process.pid}`, "utf8").trim()).toBe(`${process.pid} 4242`);
  });

  it("never reaps a server owned by another live Attend instance", async () => {
    const pidFile = tempPidFile();
    // pid 1 is always alive; it stands in for a concurrent Attend instance.
    const liveFile = `${pidFile}.1`;
    fs.writeFileSync(liveFile, "1 7777\n");
    const processCommand = vi.fn(
      async () => "/opt/homebrew/bin/opencode serve --hostname=127.0.0.1",
    );
    const killPid = vi.fn();
    const child = new FakeChild();
    const { calls, spawn } = spawnRecorder(child);
    const client = new OpencodeServerClient({
      bin: "opencode",
      pidFile,
      spawn,
      killPid,
      processCommand,
      pickPort: async () => 4567,
      startupTimeoutMs: 200,
    });

    const starting = client.start();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(killPid).not.toHaveBeenCalled();
    expect(fs.existsSync(liveFile)).toBe(true);
    child.announce("http://127.0.0.1:4567");
    await starting;
  });

  it("never kills a recycled pid whose command line is not an opencode server", async () => {
    const pidFile = tempPidFile();
    fs.writeFileSync(`${pidFile}.999997`, "999997 8888\n");
    const processCommand = vi.fn(async () => "/usr/bin/some-other-process --serve");
    const killPid = vi.fn();
    const child = new FakeChild();
    const { calls, spawn } = spawnRecorder(child);
    const client = new OpencodeServerClient({
      bin: "opencode",
      pidFile,
      spawn,
      killPid,
      processCommand,
      pickPort: async () => 4567,
      startupTimeoutMs: 200,
    });

    const starting = client.start();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(killPid).not.toHaveBeenCalled();
    child.announce("http://127.0.0.1:4567");
    await starting;
  });

  it("rejects startup when the process exits before it listens", async () => {
    const child = new FakeChild();
    const { calls, spawn } = spawnRecorder(child);
    const client = new OpencodeServerClient({
      bin: "opencode",
      spawn,
      pickPort: async () => 4567,
      startupTimeoutMs: 200,
    });

    const starting = client.start();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    child.exit(1);
    await expect(starting).rejects.toThrow(/exited during startup/);
  });

  it("rejects startup when the server never announces its url", async () => {
    const child = new FakeChild();
    const { spawn } = spawnRecorder(child);
    const client = new OpencodeServerClient({
      bin: "opencode",
      spawn,
      pickPort: async () => 4567,
      startupTimeoutMs: 20,
    });

    await expect(client.start()).rejects.toThrow(/did not start within 20ms/);
  });

  it("builds the SDK prompt body with a split model ref and variant", () => {
    expect(
      opencodePromptBody({
        sessionId: "ses_1",
        directory: "/work/repo",
        text: "hello",
        model: "opencode-go/deepseek-v4.1-flash",
        variant: "max",
      }),
    ).toEqual({
      parts: [{ type: "text", text: "hello" }],
      model: { providerID: "opencode-go", modelID: "deepseek-v4.1-flash" },
      variant: "max",
    });
    expect(
      opencodePromptBody({ sessionId: "ses_1", directory: "/work/repo", text: "plain" }),
    ).toEqual({ parts: [{ type: "text", text: "plain" }] });
  });
});
