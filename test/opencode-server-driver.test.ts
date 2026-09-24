import type { Event } from "@opencode-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import type { UiEvent } from "../src/chat/events.js";
import type {
  OpencodePromptRequest,
  OpencodeServerLike,
} from "../src/chat/opencode/server/client.js";
import { OpencodeServerDriver } from "../src/chat/opencode/server/driver.js";
import { makeOpencodeServerExec } from "../src/chat/opencode/server/exec.js";
import { ProcessChatDriver } from "../src/chat/process/driver.js";

class FakeOpencodeServer implements OpencodeServerLike {
  startCalls = 0;
  shutdownCalls = 0;
  createdDirectories: string[] = [];
  prompts: OpencodePromptRequest[] = [];
  aborts: Array<{ sessionId: string; directory: string }> = [];
  permissions: Array<{ sessionId: string; permissionId: string; directory: string }> = [];
  questions: Array<{ questionId: string; answers: string[][]; directory: string }> = [];
  steers: Array<{ sessionId: string; text: string }> = [];
  nextSessionId = "ses_created";
  readonly eventDirectories: string[] = [];
  private readonly listeners = new Set<(event: Event) => void>();
  private readonly disconnectListeners = new Set<(error: Error) => void>();

  async start(): Promise<void> {
    this.startCalls += 1;
  }

  async createSession(directory: string): Promise<string> {
    this.createdDirectories.push(directory);
    return this.nextSessionId;
  }

  async prompt(request: OpencodePromptRequest): Promise<void> {
    this.prompts.push(request);
  }

  async abort(sessionId: string, directory: string): Promise<boolean> {
    this.aborts.push({ sessionId, directory });
    return true;
  }

  async replyPermission(sessionId: string, permissionId: string, directory: string): Promise<void> {
    this.permissions.push({ sessionId, permissionId, directory });
  }

  async replyQuestion(questionId: string, answers: string[][], directory: string): Promise<void> {
    this.questions.push({ questionId, answers, directory });
  }

  async steerPrompt(sessionId: string, text: string): Promise<void> {
    this.steers.push({ sessionId, text });
  }

  onEvent(directory: string, listener: (event: Event) => void): () => void {
    this.eventDirectories.push(directory);
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onDisconnect(directory: string, listener: (error: Error) => void): () => void {
    this.eventDirectories.push(directory);
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  emit(event: Event): void {
    for (const listener of [...this.listeners]) listener(event);
  }

  dropConnection(error: Error): void {
    for (const listener of [...this.disconnectListeners]) listener(error);
  }

  shutdown(): void {
    this.shutdownCalls += 1;
  }
}

function assistantMessage(sessionID: string, messageID: string): Event {
  return {
    type: "message.updated",
    properties: { info: { id: messageID, sessionID, role: "assistant" } },
  } as unknown as Event;
}

function userMessage(sessionID: string, messageID: string): Event {
  return {
    type: "message.updated",
    properties: { info: { id: messageID, sessionID, role: "user" } },
  } as unknown as Event;
}

function textPartEvent(sessionID: string, messageID: string, text: string, settled = true): Event {
  return {
    type: "message.part.updated",
    properties: {
      part: {
        id: `prt_text_${messageID}`,
        sessionID,
        messageID,
        type: "text",
        text,
        time: settled ? { start: 1, end: 2 } : { start: 1 },
      },
    },
  } as unknown as Event;
}

function toolPartEvent(sessionID: string, messageID: string, output: string): Event {
  return {
    type: "message.part.updated",
    properties: {
      part: {
        id: `prt_tool_${messageID}`,
        sessionID,
        messageID,
        type: "tool",
        callID: `call_${messageID}`,
        tool: "bash",
        state: {
          status: "completed",
          input: { command: "ls" },
          output,
          title: "ls",
          metadata: { exit: 0 },
          time: { start: 1, end: 2 },
        },
      },
    },
  } as unknown as Event;
}

function stepFinishEvent(sessionID: string, messageID: string): Event {
  return {
    type: "message.part.updated",
    properties: {
      part: {
        id: `prt_step_${messageID}`,
        sessionID,
        messageID,
        type: "step-finish",
        reason: "stop",
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      },
    },
  } as unknown as Event;
}

function permissionEvent(sessionID: string, permissionId: string): Event {
  return {
    type: "permission.updated",
    properties: {
      id: permissionId,
      type: "bash",
      sessionID,
      messageID: "msg_1",
      title: "bash",
      metadata: {},
      time: { created: 1 },
    },
  } as unknown as Event;
}

function permissionAskedEvent(sessionID: string, permissionId: string): Event {
  // OpenCode 1.18 emits the v2 `permission.asked` shape.
  return {
    type: "permission.asked",
    properties: {
      id: permissionId,
      sessionID,
      permission: "external_directory",
      patterns: ["/external/*"],
      metadata: {},
      always: ["/external/*"],
      tool: { messageID: "msg_1", callID: "call_1" },
    },
  } as unknown as Event;
}

function questionAskedEvent(sessionID: string, requestID: string): Event {
  // OpenCode 1.18's native question tool ask.
  return {
    type: "question.asked",
    properties: {
      id: requestID,
      sessionID,
      questions: [
        {
          header: "Env",
          question: "Which env?",
          options: [
            { label: "staging", description: "staging env" },
            { label: "prod", description: "prod env" },
          ],
        },
      ],
      tool: { messageID: "msg_1", callID: "call_1" },
    },
  } as unknown as Event;
}

function questionRepliedEvent(sessionID: string, requestID: string, answers: string[][]): Event {
  return {
    type: "question.replied",
    properties: { sessionID, requestID, answers },
  } as unknown as Event;
}

function idleEvent(sessionID: string): Event {
  return { type: "session.idle", properties: { sessionID } } as Event;
}

function sessionErrorEvent(sessionID: string, message: string): Event {
  return {
    type: "session.error",
    properties: { sessionID, error: { name: "UnknownError", data: { message } } },
  } as unknown as Event;
}

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function makeDriver(server: FakeOpencodeServer): ProcessChatDriver {
  return new ProcessChatDriver(
    makeOpencodeServerExec(server),
    "danger-full-access",
    () => null,
    "opencode",
  );
}

describe("opencode server chat driver", () => {
  it("resumes a session, streams settled content, and ends on session.idle", async () => {
    const server = new FakeOpencodeServer();
    const driver = makeDriver(server);
    expect(
      await driver.start({
        resume: "ses_abc",
        cwd: "/work/repo",
        model: "opencode-go/deepseek-v4.1-flash",
        effort: "max",
      }),
    ).toBe("ses_abc");
    const events: UiEvent[] = [];
    const turns: string[] = [];
    driver.onTurnEnd((id) => turns.push(id));
    driver.subscribe("ses_abc", (event) => events.push(event));

    expect(driver.send("ses_abc", { text: "hello" })).toBe(true);
    await vi.waitFor(() => expect(server.prompts).toHaveLength(1));
    expect(server.prompts[0]).toEqual({
      sessionId: "ses_abc",
      directory: "/work/repo",
      text: "hello",
      model: "opencode-go/deepseek-v4.1-flash",
      variant: "max",
    });
    expect(driver.activeSessions()).toEqual(["ses_abc"]);
    // The event stream must be scoped to the session directory; OpenCode only
    // delivers a workspace's events to a subscription carrying that directory.
    expect(server.eventDirectories).toContain("/work/repo");

    // Streaming text snapshots and another role's parts never render.
    server.emit(assistantMessage("ses_abc", "msg_1"));
    server.emit(textPartEvent("ses_abc", "msg_1", "partial", false));
    server.emit(userMessage("ses_abc", "msg_user"));
    server.emit(textPartEvent("ses_abc", "msg_user", "user text"));
    await flush();
    expect(events.some((event) => event.kind === "assistant_text")).toBe(false);

    server.emit(textPartEvent("ses_abc", "msg_1", "final answer"));
    server.emit(toolPartEvent("ses_abc", "msg_1", "ok"));
    server.emit(idleEvent("ses_abc"));
    await vi.waitFor(() => expect(driver.activeSessions()).toEqual([]));

    const texts = events
      .filter(
        (event): event is Extract<UiEvent, { kind: "assistant_text" }> =>
          event.kind === "assistant_text",
      )
      .map((event) => event.text);
    expect(texts).toEqual(["final answer"]);
    expect(events.some((event) => event.kind === "tool_use")).toBe(true);
    expect(events.some((event) => event.kind === "tool_result")).toBe(true);
    expect(events.at(-1)).toEqual({ kind: "result", ok: true });
    expect(turns).toEqual(["ses_abc"]);
  });

  it("creates a session for a first turn and announces its id", async () => {
    const server = new FakeOpencodeServer();
    const driver = makeDriver(server);
    expect(await driver.start({ cwd: "/work/repo", firstText: "start here" })).toBe("ses_created");
    await vi.waitFor(() => expect(server.prompts).toHaveLength(1));
    expect(server.createdDirectories).toEqual(["/work/repo"]);
    expect(server.prompts[0]).toEqual({
      sessionId: "ses_created",
      directory: "/work/repo",
      text: "start here",
      model: undefined,
      variant: undefined,
    });
    server.emit(assistantMessage("ses_created", "msg_new"));
    server.emit(textPartEvent("ses_created", "msg_new", "hi"));
    server.emit(idleEvent("ses_created"));
    await vi.waitFor(() => expect(driver.activeSessions()).toEqual([]));
  });

  it("keeps the turn open across step-finish until the session idles", async () => {
    const server = new FakeOpencodeServer();
    const driver = makeDriver(server);
    await driver.start({ resume: "ses_abc", cwd: "/work/repo" });
    const events: UiEvent[] = [];
    driver.subscribe("ses_abc", (event) => events.push(event));
    driver.send("ses_abc", { text: "work" });
    await vi.waitFor(() => expect(server.prompts).toHaveLength(1));

    server.emit(assistantMessage("ses_abc", "msg_1"));
    server.emit(textPartEvent("ses_abc", "msg_1", "a step"));
    server.emit(stepFinishEvent("ses_abc", "msg_1"));
    await flush();
    expect(driver.activeSessions()).toEqual(["ses_abc"]);
    expect(events.some((event) => event.kind === "result")).toBe(false);

    server.emit(idleEvent("ses_abc"));
    await vi.waitFor(() => expect(driver.activeSessions()).toEqual([]));
  });

  it("interrupt aborts the server-side turn", async () => {
    const server = new FakeOpencodeServer();
    const driver = makeDriver(server);
    await driver.start({ resume: "ses_abc", cwd: "/work/repo" });
    const events: UiEvent[] = [];
    driver.subscribe("ses_abc", (event) => events.push(event));
    driver.send("ses_abc", { text: "long job" });
    await vi.waitFor(() => expect(server.prompts).toHaveLength(1));

    await expect(driver.interrupt("ses_abc")).resolves.toBe(true);
    await vi.waitFor(() =>
      expect(server.aborts).toEqual([{ sessionId: "ses_abc", directory: "/work/repo" }]),
    );
    expect(events.some((event) => event.kind === "result" && !event.ok)).toBe(true);
    expect(driver.activeSessions()).toEqual([]);
  });

  it("auto-approves permission asks for interactive turns", async () => {
    const server = new FakeOpencodeServer();
    const driver = makeDriver(server);
    await driver.start({ resume: "ses_abc", cwd: "/work/repo" });
    driver.send("ses_abc", { text: "write a file" });
    await vi.waitFor(() => expect(server.prompts).toHaveLength(1));

    server.emit(permissionEvent("ses_abc", "per_1"));
    await vi.waitFor(() =>
      expect(server.permissions).toEqual([
        { sessionId: "ses_abc", permissionId: "per_1", directory: "/work/repo" },
      ]),
    );
    expect(server.startCalls).toBe(1);
  });

  it("auto-approves the v2 permission.asked event (OpenCode 1.18)", async () => {
    const server = new FakeOpencodeServer();
    const driver = makeDriver(server);
    await driver.start({ resume: "ses_abc", cwd: "/work/repo" });
    driver.send("ses_abc", { text: "read an external file" });
    await vi.waitFor(() => expect(server.prompts).toHaveLength(1));

    server.emit(permissionAskedEvent("ses_abc", "per_asked"));
    await vi.waitFor(() =>
      expect(server.permissions).toEqual([
        { sessionId: "ses_abc", permissionId: "per_asked", directory: "/work/repo" },
      ]),
    );
  });

  it("surfaces the native question tool and answers it in place without restarting the turn", async () => {
    const server = new FakeOpencodeServer();
    const driver = makeDriver(server);
    await driver.start({ resume: "ses_abc", cwd: "/work/repo" });
    const events: UiEvent[] = [];
    driver.subscribe("ses_abc", (event) => events.push(event));
    driver.send("ses_abc", { text: "ask me something" });
    await vi.waitFor(() => expect(server.prompts).toHaveLength(1));

    server.emit(questionAskedEvent("ses_abc", "que_1"));
    await vi.waitFor(() =>
      expect(
        events.some(
          (event) =>
            event.kind === "tool_use" &&
            event.name === "request_user_input" &&
            event.id === "que_1",
        ),
      ).toBe(true),
    );
    // The provider turn stays alive while it waits, so the session remains active.
    expect(driver.activeSessions()).toEqual(["ses_abc"]);

    const answered = driver.answer("ses_abc", {
      toolUseId: "que_1",
      text: "answered",
      toolUseResult: {
        questions: [{ question: "Which env?", header: "Env", options: [], multiSelect: false }],
        answers: { "Which env?": "staging" },
      },
    });
    expect(answered).toBe(true);
    await vi.waitFor(() =>
      expect(server.questions).toEqual([
        { questionId: "que_1", answers: [["staging"]], directory: "/work/repo" },
      ]),
    );

    server.emit(questionRepliedEvent("ses_abc", "que_1", [["staging"]]));
    server.emit(idleEvent("ses_abc"));
    await vi.waitFor(() => expect(driver.activeSessions()).toEqual([]));
    expect(events.some((event) => event.kind === "tool_result" && event.id === "que_1")).toBe(true);
    expect(events.at(-1)).toEqual({ kind: "result", ok: true });
  });

  it("steers guidance into the running turn instead of queueing a new one", async () => {
    const server = new FakeOpencodeServer();
    const driver = makeDriver(server);
    await driver.start({ resume: "ses_abc", cwd: "/work/repo" });
    driver.send("ses_abc", { text: "start" });
    await vi.waitFor(() => expect(server.prompts).toHaveLength(1));

    expect(driver.canSteer("ses_abc")).toBe(true);
    expect(await driver.steer("ses_abc", { text: "also do X" })).toBe(true);
    await vi.waitFor(() =>
      expect(server.steers).toEqual([{ sessionId: "ses_abc", text: "also do X" }]),
    );
    // Steering feeds the same provider turn; the session stays active.
    expect(driver.activeSessions()).toEqual(["ses_abc"]);

    server.emit(idleEvent("ses_abc"));
    await vi.waitFor(() => expect(driver.activeSessions()).toEqual([]));
    // An ended turn can no longer be steered.
    expect(driver.canSteer("ses_abc")).toBe(false);
  });

  it("leaves permission asks alone for read-only turns", async () => {
    const server = new FakeOpencodeServer();
    const exec = makeOpencodeServerExec(server);
    const handle = exec({
      cwd: "/work/repo",
      prompt: "analyze",
      resume: "ses_ro",
      sandbox: "read-only",
    });
    const first = handle.events[Symbol.asyncIterator]().next();
    await vi.waitFor(() => expect(server.prompts).toHaveLength(1));

    server.emit(permissionEvent("ses_ro", "per_ro"));
    await flush();
    expect(server.permissions).toEqual([]);

    handle.kill();
    await first;
    await vi.waitFor(() => expect(server.aborts).toHaveLength(1));
  });

  it("fails the turn when the server connection drops", async () => {
    const server = new FakeOpencodeServer();
    const driver = makeDriver(server);
    await driver.start({ resume: "ses_abc", cwd: "/work/repo" });
    const events: UiEvent[] = [];
    driver.subscribe("ses_abc", (event) => events.push(event));
    driver.send("ses_abc", { text: "hello" });
    await vi.waitFor(() => expect(server.prompts).toHaveLength(1));

    server.dropConnection(new Error("opencode server exited (SIGTERM)"));
    await vi.waitFor(() => expect(driver.activeSessions()).toEqual([]));
    expect(events.find((event) => event.kind === "error")).toMatchObject({
      message: "opencode server exited (SIGTERM)",
    });
  });

  it("fails the turn when the server reports a session error", async () => {
    const server = new FakeOpencodeServer();
    const driver = makeDriver(server);
    await driver.start({ resume: "ses_abc", cwd: "/work/repo" });
    const events: UiEvent[] = [];
    driver.subscribe("ses_abc", (event) => events.push(event));
    driver.send("ses_abc", { text: "hello" });
    await vi.waitFor(() => expect(server.prompts).toHaveLength(1));

    server.emit(sessionErrorEvent("ses_abc", "usage limit reached"));
    await vi.waitFor(() => expect(driver.activeSessions()).toEqual([]));
    expect(events.find((event) => event.kind === "error")).toMatchObject({
      message: "usage limit reached",
    });
  });

  it("shuts the persistent server down with the driver", () => {
    const server = new FakeOpencodeServer();
    const driver = new OpencodeServerDriver(server);
    driver.shutdown();
    expect(server.shutdownCalls).toBe(1);
  });
});
