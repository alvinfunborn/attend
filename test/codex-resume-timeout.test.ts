import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodexAppServerClient } from "../src/chat/codex/app-server/client.js";
import { CodexAppServerDriver } from "../src/chat/codex/app-server/driver.js";
import { spawnCli } from "../src/core/spawn.js";

vi.mock("../src/core/spawn.js", () => ({ spawnCli: vi.fn() }));

describe("Codex cold resume transport", () => {
  afterEach(() => vi.useRealTimers());

  it("releases a silent resume, permits retry, and ignores its late response", async () => {
    vi.useFakeTimers();
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const child = Object.assign(new EventEmitter(), {
      stdin,
      stdout,
      stderr: new PassThrough(),
      kill: vi.fn(),
    });
    vi.mocked(spawnCli).mockReturnValue(child as unknown as ReturnType<typeof spawnCli>);
    const requests: Array<{ id: number; method: string; params?: Record<string, unknown> }> = [];
    const reply = (id: number, result: unknown) => {
      stdout.write(`${JSON.stringify({ id, result })}\n`);
    };
    let resumeAttempts = 0;
    stdin.on("data", (chunk) => {
      const request = JSON.parse(String(chunk));
      requests.push(request);
      if (request.method === "initialize") reply(request.id, {});
      if (request.method === "thread/read") reply(request.id, { thread: { id: "other" } });
      if (request.method === "thread/resume" && ++resumeAttempts > 1)
        reply(request.id, { thread: { id: "parent" } });
      if (request.method === "turn/start")
        reply(request.id, { turn: { id: "turn-1", status: "inProgress" } });
    });
    const client = new CodexAppServerClient();
    const driver = new CodexAppServerDriver(client);
    const opts = { cwd: "/repo", resume: "parent", firstText: "continue the task" };
    const failures: string[] = [];
    try {
      const first = driver.start(opts).catch((error: Error) => failures.push(error.message));
      const duplicate = driver.start(opts).catch((error: Error) => failures.push(error.message));
      await vi.advanceTimersByTimeAsync(0);
      expect(resumeAttempts).toBe(1);
      expect(requests.find((request) => request.method === "thread/resume")?.params).toMatchObject({
        threadId: "parent",
        excludeTurns: true,
      });
      // One stalled thread must not prevent independent RPCs on the shared transport.
      await expect(client.request("thread/read", { threadId: "other" })).resolves.toMatchObject({
        thread: { id: "other" },
      });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(failures).toEqual([
        "codex app-server thread/resume timed out after 60000ms",
        "codex app-server thread/resume timed out after 60000ms",
      ]);
      await Promise.all([first, duplicate]);
      expect(requests.some((request) => request.method === "turn/start")).toBe(false);

      await expect(driver.start(opts)).resolves.toBe("parent");
      expect(resumeAttempts).toBe(2);
      const oldResume = requests.find((request) => request.method === "thread/resume");
      if (!oldResume) throw new Error("resume request was not sent");
      reply(oldResume.id, { thread: { id: "parent" } });
      await vi.advanceTimersByTimeAsync(0);
      const turns = requests.filter((request) => request.method === "turn/start");
      expect(turns).toHaveLength(1);
      expect(turns[0]?.params?.input).toMatchObject([{ type: "text", text: "continue the task" }]);
    } finally {
      driver.shutdown();
      stdin.destroy();
      stdout.destroy();
      child.stderr.destroy();
    }
  });
});
