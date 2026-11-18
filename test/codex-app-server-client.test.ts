import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CodexAppServerClient,
  MAX_APP_SERVER_MESSAGE_BYTES,
} from "../src/chat/codex/app-server/client.js";
import { spawnCli } from "../src/core/spawn.js";

vi.mock("../src/core/spawn.js", () => ({ spawnCli: vi.fn() }));

function transport() {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
  child.stdin.on("data", (chunk) => {
    const request = JSON.parse(String(chunk));
    if (request.method === "initialize") {
      child.stdout.write(`${JSON.stringify({ id: request.id, result: {} })}\n`);
    }
  });
  vi.mocked(spawnCli).mockReturnValue(child as unknown as ReturnType<typeof spawnCli>);
  return child;
}

const clients: CodexAppServerClient[] = [];
const children: ReturnType<typeof transport>[] = [];
function setup() {
  const child = transport();
  const client = new CodexAppServerClient();
  children.push(child);
  clients.push(client);
  return { child, client };
}

afterEach(() => {
  for (const client of clients.splice(0)) client.shutdown();
  for (const child of children.splice(0)) {
    child.stdin.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
  }
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Codex app-server bounded JSONL transport", () => {
  it("handles fragmented UTF-8, CRLF, and several messages per chunk", async () => {
    const { child, client } = setup();
    await client.start();
    const messages: unknown[] = [];
    client.onMessage((message) => messages.push(message));
    const wire = Buffer.from('{"method":"notice","params":{"text":"你好"}}\r\n');
    const split = wire.indexOf(Buffer.from("你")) + 1;
    child.stdout.write(wire.subarray(0, split));
    expect(messages).toEqual([]);
    child.stdout.write(wire.subarray(split));
    child.stdout.write('\n{"method":"one"}\n{"method":"two"}\n');
    expect(messages).toEqual([
      { method: "notice", params: { text: "你好" } },
      { method: "one" },
      { method: "two" },
    ]);
  });

  it.each([false, true])(
    "rejects an oversized single chunk (terminated: %s)",
    async (terminated) => {
      const { child, client } = setup();
      await client.start();
      const messages: unknown[] = [];
      client.onMessage((message) => messages.push(message));
      const pending = client.request("thread/read");
      const rejected = expect(pending).rejects.toThrow("JSONL message exceeds");
      await Promise.resolve();
      child.stdout.write(
        `${"x".repeat(MAX_APP_SERVER_MESSAGE_BYTES + 1)}${terminated ? "\n" : ""}`,
      );
      await rejected;
      expect(child.kill).toHaveBeenCalledWith("SIGTERM");
      expect(child.stdout.destroyed).toBe(true);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({ method: "transport/error" });
    },
  );

  it("bounds fragmented output after a resume timeout and permits a fresh connection", async () => {
    vi.useFakeTimers();
    const { child, client } = setup();
    await client.start();
    const stalled = client.request("thread/resume", {}, { timeoutMs: 60_000 });
    const timedOut = expect(stalled).rejects.toThrow("thread/resume timed out after 60000ms");
    await vi.advanceTimersByTimeAsync(60_000);
    await timedOut;
    // There need not be a pending RPC when runaway output arrives.
    const chunk = "x".repeat(1024 * 1024);
    for (let i = 0; i < 32; i++) child.stdout.write(chunk);
    expect(child.kill).not.toHaveBeenCalled();
    child.stdout.write("x");
    expect(child.kill).toHaveBeenCalledTimes(1);

    const fresh = transport();
    children.push(fresh);
    await client.start();
    // Old lifecycle events must not reject RPCs on the new connection.
    child.emit("exit", 1, null);
    child.stdin.emit("error", new Error("old pipe closed"));
    fresh.stdin.on("data", (chunk) => {
      const wire = JSON.parse(String(chunk));
      fresh.stdout.write(`${JSON.stringify({ id: wire.id, result: { ok: true } })}\n`);
    });
    const request = client.request("thread/read");
    await expect(request).resolves.toEqual({ ok: true });
    expect(fresh.kill).not.toHaveBeenCalled();
  });

  it("counts UTF-8 bytes and rejects every pending request on stream failure", async () => {
    const { child, client } = setup();
    await client.start();
    const first = client.request("thread/read");
    const second = client.request("thread/resume");
    const rejected = Promise.all([
      expect(first).rejects.toThrow("JSONL message exceeds"),
      expect(second).rejects.toThrow("JSONL message exceeds"),
    ]);
    await Promise.resolve();
    child.stdout.write("你".repeat(Math.ceil(MAX_APP_SERVER_MESSAGE_BYTES / 3)));
    await rejected;
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it.each(["end", "error"])("rejects pending RPCs on stream %s", async (event) => {
    const { child, client } = setup();
    await client.start();
    const pending = client.request("thread/read");
    const rejected = expect(pending).rejects.toThrow(
      event === "end" ? "stdout closed" : "pipe broken",
    );
    await Promise.resolve();
    if (event === "end") child.stdout.end();
    else child.stdin.emit("error", new Error("pipe broken"));
    await rejected;
    expect(child.stdout.destroyed).toBe(true);
  });
});
