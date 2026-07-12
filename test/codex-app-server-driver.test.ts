import { describe, expect, it } from "vitest";
import type { AppServerClientLike } from "../src/chat/codex/app-server/client.js";
import { CodexAppServerDriver } from "../src/chat/codex/app-server/driver.js";
import type { AppServerMessage, JsonRpcId } from "../src/chat/codex/app-server/types.js";
import type { UiEvent } from "../src/chat/events.js";

class FakeAppServer implements AppServerClientLike {
  requests: Array<{ method: string; params: unknown }> = [];
  responses: Array<{ id: JsonRpcId; result: unknown }> = [];
  listeners = new Set<(message: AppServerMessage) => void>();
  nextThread = "thread-1";
  nextTurn = "turn-1";

  async start(): Promise<void> {}

  async request<T>(method: string, params?: unknown): Promise<T> {
    this.requests.push({ method, params });
    if (method.startsWith("thread/")) return { thread: { id: this.nextThread } } as T;
    if (method === "turn/start") return { turn: { id: this.nextTurn, status: "inProgress" } } as T;
    return {} as T;
  }

  respond(id: JsonRpcId, result: unknown): void {
    this.responses.push({ id, result });
  }

  respondError(): void {}

  onMessage(listener: (message: AppServerMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(message: AppServerMessage): void {
    for (const listener of this.listeners) listener(message);
  }

  shutdown(): void {}
}

describe("CodexAppServerDriver", () => {
  it("uses native thread and turn methods and streams rich file changes", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({
      cwd: "/repo",
      firstText: "change it",
      model: "gpt-5.6",
      effort: "high",
    });
    const events: UiEvent[] = [];
    driver.subscribe(id, (event) => events.push(event));

    expect(client.requests[0]).toMatchObject({
      method: "thread/start",
      params: {
        cwd: "/repo",
        model: "gpt-5.6",
        approvalPolicy: "never",
        sandbox: "danger-full-access",
      },
    });
    expect(client.requests[1]).toMatchObject({
      method: "turn/start",
      params: {
        threadId: "thread-1",
        input: [{ type: "text", text: "change it", text_elements: [] }],
        effort: "high",
        sandboxPolicy: { type: "dangerFullAccess" },
      },
    });

    client.emit({
      method: "item/agentMessage/delta",
      params: { threadId: id, turnId: "turn-1", itemId: "msg-1", delta: "Working" },
    });
    client.emit({
      method: "item/completed",
      params: {
        threadId: id,
        turnId: "turn-1",
        item: {
          id: "item-12",
          type: "fileChange",
          status: "completed",
          changes: [{ path: "/repo/README.md", kind: "update", diff: "@@ -1 +1 @@" }],
        },
      },
    });
    client.emit({
      method: "turn/completed",
      params: {
        threadId: id,
        turn: { id: "turn-1", status: "completed" },
      },
    });

    expect(events).toContainEqual({ kind: "assistant_text", text: "Working" });
    expect(events).toContainEqual({
      kind: "tool_use",
      id: "item-12",
      name: "edit",
      input: {
        id: "item-12",
        type: "fileChange",
        status: "completed",
        changes: [{ path: "/repo/README.md", kind: "update", diff: "@@ -1 +1 @@" }],
      },
    });
    expect(events).toContainEqual({ kind: "result", ok: true });
    expect(driver.activeSessions()).toEqual([]);
  });

  it("answers app-server requestUserInput without ending or restarting the turn", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", firstText: "ask" });
    const events: UiEvent[] = [];
    driver.subscribe(id, (event) => events.push(event));
    client.emit({
      id: "request-7",
      method: "item/tool/requestUserInput",
      params: {
        threadId: id,
        turnId: "turn-1",
        itemId: "question-1",
        questions: [
          {
            id: "choice",
            header: "Choice",
            question: "Pick one?",
            isOther: true,
            options: [{ label: "A", description: "first" }],
          },
        ],
      },
    });

    expect(events).toContainEqual({
      kind: "tool_use",
      id: "question-1",
      name: "request_user_input",
      input: {
        questions: [
          {
            id: "choice",
            header: "Choice",
            question: "Pick one?",
            multiSelect: false,
            options: [{ label: "A", description: "first" }],
          },
        ],
      },
    });
    expect(
      driver.answer(id, {
        toolUseId: "question-1",
        text: "A",
        toolUseResult: { answers: { "Pick one?": "A" } },
      }),
    ).toBe(true);
    expect(client.responses).toEqual([
      { id: "request-7", result: { answers: { choice: { answers: ["A"] } } } },
    ]);
    expect(client.requests.filter((request) => request.method === "turn/start")).toHaveLength(1);
  });

  it("uses native resume, fork, and interrupt", async () => {
    const resumeClient = new FakeAppServer();
    const resume = new CodexAppServerDriver(resumeClient);
    await resume.start({ cwd: "/repo", resume: "parent" });
    expect(resumeClient.requests[0]).toMatchObject({
      method: "thread/resume",
      params: { threadId: "parent" },
    });

    const forkClient = new FakeAppServer();
    const fork = new CodexAppServerDriver(forkClient);
    const id = await fork.start({
      cwd: "/repo",
      resume: "parent",
      forkSession: true,
      firstText: "branch",
    });
    expect(forkClient.requests[0]).toMatchObject({
      method: "thread/fork",
      params: { threadId: "parent" },
    });
    expect(await fork.interrupt(id)).toBe(true);
    expect(forkClient.requests.at(-1)).toEqual({
      method: "turn/interrupt",
      params: { threadId: id, turnId: "turn-1" },
    });
  });
});
