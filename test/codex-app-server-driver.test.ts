import { describe, expect, it, vi } from "vitest";
import type { AppServerClientLike } from "../src/chat/codex/app-server/client.js";
import { CodexAppServerDriver } from "../src/chat/codex/app-server/driver.js";
import type { AppServerMessage, JsonRpcId } from "../src/chat/codex/app-server/types.js";
import type { UiEvent } from "../src/chat/events.js";

class FakeAppServer implements AppServerClientLike {
  requests: Array<{ method: string; params: unknown }> = [];
  responses: Array<{ id: JsonRpcId; result: unknown }> = [];
  responseErrors: Array<{ id: JsonRpcId; message: string }> = [];
  listeners = new Set<(message: AppServerMessage) => void>();
  nextThread = "thread-1";
  nextTurn = "turn-1";
  threadConfig: Record<string, unknown> = {};
  threadTurns: Array<{ id: string; status: string }> = [];
  rejectInterruptFor: string | null = null;

  async start(): Promise<void> {}

  async request<T>(method: string, params?: unknown): Promise<T> {
    this.requests.push({ method, params });
    if (method === "thread/goal/set")
      return {
        goal: {
          threadId: this.nextThread,
          objective: (params as { objective?: string }).objective ?? "",
          status: "active",
          createdAt: 1,
          updatedAt: 1,
          tokensUsed: 0,
          timeUsedSeconds: 0,
        },
      } as T;
    if (method === "thread/goal/get") return { goal: null } as T;
    if (method === "thread/goal/clear") return { cleared: true } as T;
    if (method === "thread/read")
      return { thread: { id: this.nextThread, turns: this.threadTurns } } as T;
    if (
      method === "turn/interrupt" &&
      (params as { turnId?: string } | undefined)?.turnId === this.rejectInterruptFor
    )
      throw new Error("turn is no longer active");
    if (method.startsWith("thread/"))
      return { thread: { id: this.nextThread }, ...this.threadConfig } as T;
    if (method === "turn/start") return { turn: { id: this.nextTurn, status: "inProgress" } } as T;
    return {} as T;
  }

  respond(id: JsonRpcId, result: unknown): void {
    this.responses.push({ id, result });
  }

  respondError(id: JsonRpcId, message: string): void {
    this.responseErrors.push({ id, message });
  }

  onMessage(listener: (message: AppServerMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(message: AppServerMessage): void {
    for (const listener of this.listeners) listener(message);
  }

  shutdown(): void {}
}

class DeferredTurnAppServer extends FakeAppServer {
  private releaseTurnStart: (() => void) | null = null;
  private readonly turnStartGate = new Promise<void>((resolve) => {
    this.releaseTurnStart = resolve;
  });

  override async request<T>(method: string, params?: unknown): Promise<T> {
    if (method !== "turn/start") return super.request<T>(method, params);
    this.requests.push({ method, params });
    await this.turnStartGate;
    return { turn: { id: this.nextTurn, status: "inProgress" } } as T;
  }

  resolveTurnStart(): void {
    this.releaseTurnStart?.();
  }
}

/** `thread/goal/set` starts a turn of its own before `turn/start` is answered. */
class GoalTurnAppServer extends FakeAppServer {
  goalTurnId = "goal-turn";

  override async request<T>(method: string, params?: unknown): Promise<T> {
    if (method !== "turn/start") return super.request<T>(method, params);
    this.requests.push({ method, params });
    this.emit({
      method: "turn/started",
      params: {
        threadId: this.nextThread,
        turn: { id: this.goalTurnId, status: "inProgress" },
      },
    });
    return { turn: { id: "turn-never-live", status: "inProgress" } } as T;
  }
}

/** Rejects steering that names anything but the genuinely running turn. */
class StaleTurnAppServer extends FakeAppServer {
  activeTurnId = "turn-live";

  override async request<T>(method: string, params?: unknown): Promise<T> {
    if (method !== "turn/steer") return super.request<T>(method, params);
    this.requests.push({ method, params });
    const expected = (params as { expectedTurnId?: string } | undefined)?.expectedTurnId;
    if (expected !== this.activeTurnId)
      throw new Error(`expected active turn id \`${expected}\` but found \`${this.activeTurnId}\``);
    return {} as T;
  }
}

class RejectInterruptAppServer extends FakeAppServer {
  override async request<T>(method: string, params?: unknown): Promise<T> {
    if (method !== "turn/interrupt") return super.request<T>(method, params);
    this.requests.push({ method, params });
    throw new Error("interrupt transport failed");
  }
}

describe("CodexAppServerDriver", () => {
  it("restores the provider-returned configuration when resuming cold", async () => {
    const client = new FakeAppServer();
    client.threadConfig = {
      model: "gpt-resumed",
      reasoningEffort: "xhigh",
      serviceTier: "priority",
    };
    const driver = new CodexAppServerDriver(client);
    const events: UiEvent[] = [];
    driver.onEvent((_sessionId, event) => events.push(event));
    const id = await driver.start({ cwd: "/repo", resume: "thread-1" });

    expect(events).toContainEqual({
      kind: "run_config",
      source: "provider",
      model: "gpt-resumed",
      effort: "xhigh",
      speed: "priority",
    });
    expect(driver.send(id, { text: "continue" })).toBe(true);
    await Promise.resolve();
    expect(client.requests.at(-1)).toMatchObject({
      method: "turn/start",
      params: {
        model: "gpt-resumed",
        effort: "xhigh",
        serviceTier: "priority",
      },
    });
  });

  it("uses native thread and turn methods and streams rich file changes", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({
      cwd: "/repo",
      firstText: "change it",
      model: "gpt-5.6",
      effort: "high",
      speed: "priority",
    });
    const events: UiEvent[] = [];
    driver.subscribe(id, (event) => events.push(event));

    expect(client.requests[0]).toMatchObject({
      method: "thread/start",
      params: {
        cwd: "/repo",
        model: "gpt-5.6",
        serviceTier: "priority",
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
        serviceTier: "priority",
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

  it("withholds a split memory trailer and publishes structured citations at completion", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", firstText: "answer from memory" });
    const events: UiEvent[] = [];
    driver.subscribe(id, (event) => events.push(event));
    const answer = `Answer.\n\n<oai-mem-citation>
<citation_entries>
MEMORY.md:20-24|note=[Used prior routing context]
</citation_entries>
<rollout_ids>
019fcf92-6aa8-71d2-b503-9dbc27a54228
</rollout_ids>
</oai-mem-citation>`;

    for (const delta of ["Answer.\n\n<oai-mem-", answer.slice("Answer.\n\n<oai-mem-".length)]) {
      client.emit({
        method: "item/agentMessage/delta",
        params: { threadId: id, turnId: "turn-1", itemId: "message-1", delta },
      });
    }
    client.emit({
      method: "item/completed",
      params: {
        threadId: id,
        turnId: "turn-1",
        item: { id: "message-1", type: "agentMessage", text: answer },
      },
    });

    expect(
      events
        .filter((event) => event.kind === "assistant_text")
        .map((event) => event.text)
        .join(""),
    ).not.toContain("oai-mem-citation");
    expect(events).toContainEqual({
      kind: "assistant_memory_citations",
      text: "Answer.",
      memoryCitations: {
        entries: [
          {
            path: "MEMORY.md",
            lineStart: 20,
            lineEnd: 24,
            note: "Used prior routing context",
          },
        ],
        rolloutIds: ["019fcf92-6aa8-71d2-b503-9dbc27a54228"],
      },
    });
  });

  it("releases a withheld marker when the completed assistant text is not a valid trailer", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", firstText: "show the example" });
    const events: UiEvent[] = [];
    driver.subscribe(id, (event) => events.push(event));
    const answer = "Example: <oai-mem-citation> is only an opening tag.";

    client.emit({
      method: "item/agentMessage/delta",
      params: { threadId: id, turnId: "turn-1", itemId: "message-1", delta: answer },
    });
    client.emit({
      method: "item/completed",
      params: {
        threadId: id,
        turnId: "turn-1",
        item: { id: "message-1", type: "agentMessage", text: answer },
      },
    });

    expect(
      events
        .filter((event) => event.kind === "assistant_text")
        .map((event) => event.text)
        .join(""),
    ).toBe(answer);
    expect(events.some((event) => event.kind === "assistant_memory_citations")).toBe(false);
  });

  it("steers an active turn through the native app-server method", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", firstText: "start working" });

    expect(driver.canSteer(id)).toBe(true);
    expect(await driver.steer(id, { text: "focus on the failing test" })).toBe(true);
    expect(client.requests.at(-1)).toEqual({
      method: "turn/steer",
      params: {
        threadId: id,
        expectedTurnId: "turn-1",
        input: [{ type: "text", text: "focus on the failing test", text_elements: [] }],
      },
    });
    expect(driver.activeSessions()).toEqual([id]);

    client.emit({
      method: "turn/completed",
      params: { threadId: id, turn: { id: "turn-1", status: "completed" } },
    });
    expect(driver.canSteer(id)).toBe(false);
  });

  it("waits for the active turn id before steering an immediately queued message", async () => {
    const client = new DeferredTurnAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", resume: "thread-1" });
    expect(driver.send(id, { text: "start" })).toBe(true);
    expect(driver.canSteer(id)).toBe(true);

    const steering = driver.steer(id, { text: "guide immediately" });
    await Promise.resolve();
    expect(client.requests.some((request) => request.method === "turn/steer")).toBe(false);
    client.resolveTurnStart();

    expect(await steering).toBe(true);
    expect(client.requests.at(-1)).toMatchObject({
      method: "turn/steer",
      params: { threadId: id, expectedTurnId: "turn-1" },
    });
  });

  it("steers the Goal turn the provider actually started, not the turn/start echo", async () => {
    const client = new GoalTurnAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo" });

    // `thread/goal/set` starts its own turn; our turn/start is absorbed into it
    // and answers with an id that was never live.
    await driver.setGoal(id, "ship a verified fix");
    expect(driver.send(id, { text: "start the goal" })).toBe(true);

    expect(await driver.steer(id, { text: "guide the goal" })).toBe(true);
    expect(client.requests.at(-1)).toMatchObject({
      method: "turn/steer",
      params: { threadId: id, expectedTurnId: "goal-turn" },
    });
    expect(client.requests.some((request) => request.method === "thread/read")).toBe(false);
  });

  it("repairs a stale turn id from thread/read instead of refusing every guide", async () => {
    const client = new StaleTurnAppServer();
    client.nextTurn = "turn-stale";
    client.threadTurns = [{ id: "turn-live", status: "inProgress" }];
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", firstText: "run a long task" });

    expect(await driver.steer(id, { text: "guide" })).toBe(true);
    expect(client.requests.map((request) => request.method).slice(-3)).toEqual([
      "turn/steer",
      "thread/read",
      "turn/steer",
    ]);
    expect(client.requests.at(-1)).toMatchObject({
      method: "turn/steer",
      params: { threadId: id, expectedTurnId: "turn-live" },
    });

    // The run keeps the repaired id, so the next call costs one round trip.
    expect(await driver.steer(id, { text: "guide again" })).toBe(true);
    expect(client.requests.at(-1)).toMatchObject({
      method: "turn/steer",
      params: { expectedTurnId: "turn-live" },
    });
    expect(client.requests.at(-2)?.method).toBe("turn/steer");
  });

  it("stops a live run whose tracked turn id the provider rejects", async () => {
    const client = new FakeAppServer();
    client.nextTurn = "turn-stale";
    client.rejectInterruptFor = "turn-stale";
    client.threadTurns = [{ id: "turn-live", status: "inProgress" }];
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", firstText: "run a long task" });

    expect(await driver.interrupt(id)).toBe(true);
    expect(client.requests.map((request) => request.method).slice(-3)).toEqual([
      "turn/interrupt",
      "thread/read",
      "turn/interrupt",
    ]);
    expect(client.requests.at(-1)).toEqual({
      method: "turn/interrupt",
      params: { threadId: id, turnId: "turn-live" },
    });
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

  it("renders and answers a plugin-install client action instead of hanging the turn", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", firstText: "open a PR" });
    const events: UiEvent[] = [];
    driver.subscribe(id, (event) => events.push(event));

    client.emit({
      id: "dynamic-1",
      method: "item/tool/call",
      params: {
        threadId: id,
        turnId: "turn-1",
        callId: "plugin-call-1",
        tool: "request_plugin_install",
        arguments: {
          plugin_id: "github@openai-curated-remote",
          suggest_reason: "Track PR comments",
        },
      },
    });

    expect(events).toContainEqual({
      kind: "tool_use",
      id: "plugin-call-1",
      name: "request_user_input",
      input: {
        interactionKind: "client_action",
        questions: [
          expect.objectContaining({
            question: expect.stringContaining("github@openai-curated-remote"),
          }),
        ],
      },
    });
    const question = (
      (
        events.find(
          (event) => event.kind === "tool_use" && event.id === "plugin-call-1",
        ) as Extract<UiEvent, { kind: "tool_use" }>
      ).input as { questions: Array<{ question: string }> }
    ).questions[0]?.question;
    if (!question) throw new Error("plugin interaction question was not emitted");
    expect(
      driver.answer(id, {
        toolUseId: "plugin-call-1",
        text: "Approve",
        toolUseResult: { answers: { [question]: "Approve" } },
      }),
    ).toBe(true);
    expect(client.responses).toContainEqual({
      id: "dynamic-1",
      result: {
        success: true,
        contentItems: [
          {
            type: "inputText",
            text: expect.stringContaining("accepted"),
          },
        ],
      },
    });
  });

  it("fails unsupported server requests fast so app-server cannot wait forever", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", firstText: "work" });

    client.emit({
      id: "dynamic-unsupported",
      method: "item/tool/call",
      params: {
        threadId: id,
        turnId: "turn-1",
        callId: "call-unsupported",
        tool: "host_secret_tool",
        arguments: {},
      },
    });
    client.emit({ id: "future-request", method: "future/request", params: { threadId: id } });
    client.emit({ id: "auth-refresh", method: "account/chatgptAuthTokens/refresh", params: {} });

    expect(client.responseErrors).toEqual([
      { id: "dynamic-unsupported", message: "Unsupported client tool: host_secret_tool" },
      { id: "future-request", message: "Unsupported app-server request: future/request" },
      {
        id: "auth-refresh",
        message: "account/chatgptAuthTokens/refresh is not supported by Attend",
      },
    ]);
  });

  it("cancels a pending interaction before interrupting its active turn", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", firstText: "ask" });
    client.emit({
      id: "approval-1",
      method: "item/commandExecution/requestApproval",
      params: {
        threadId: id,
        turnId: "turn-1",
        itemId: "command-1",
        command: "rm example.tmp",
      },
    });

    expect(await driver.interrupt(id)).toBe(true);
    expect(client.responses).toContainEqual({
      id: "approval-1",
      result: { decision: "cancel" },
    });
    expect(client.requests.at(-1)).toEqual({
      method: "turn/interrupt",
      params: { threadId: id, turnId: "turn-1" },
    });
    expect(driver.answer(id, { toolUseId: "command-1", text: "Approve", toolUseResult: {} })).toBe(
      false,
    );
  });

  it("preserves the live turn and late output when app-server rejects interrupt", async () => {
    const client = new RejectInterruptAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", firstText: "run a long command" });
    const events: UiEvent[] = [];
    driver.subscribe(id, (event) => events.push(event));

    await expect(driver.interrupt(id)).resolves.toBe(false);
    expect(events).not.toContainEqual({ kind: "result", ok: false, text: "interrupted" });
    expect(driver.activeSessions()).toContain(id);

    client.emit({
      method: "item/agentMessage/delta",
      params: { threadId: id, turnId: "turn-1", itemId: "late", delta: "too late" },
    });
    expect(events).toContainEqual({ kind: "assistant_text", text: "too late" });
  });

  it("recovers an in-progress app-server turn when Attend lost its local runtime", async () => {
    const client = new FakeAppServer();
    client.threadTurns = [
      { id: "turn-complete", status: "completed" },
      { id: "turn-recovered", status: "inProgress" },
    ];
    const driver = new CodexAppServerDriver(client);

    expect(await driver.interrupt("detached-thread")).toBe(true);
    expect(client.requests).toEqual([
      {
        method: "thread/read",
        params: { threadId: "detached-thread", includeTurns: true },
      },
      {
        method: "turn/interrupt",
        params: { threadId: "detached-thread", turnId: "turn-recovered" },
      },
    ]);
  });

  it("interrupts an externally scanned turn directly instead of re-reading its status", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);

    expect(await driver.interrupt("detached-thread", { turnId: "turn-from-transcript" })).toBe(
      true,
    );
    expect(client.requests).toEqual([
      {
        method: "turn/interrupt",
        params: { threadId: "detached-thread", turnId: "turn-from-transcript" },
      },
    ]);
  });

  it("falls back to the current remote turn when a scanned id has just ended", async () => {
    const client = new FakeAppServer();
    client.rejectInterruptFor = "turn-stale";
    client.threadTurns = [{ id: "turn-current", status: "inProgress" }];
    const driver = new CodexAppServerDriver(client);

    expect(await driver.interrupt("detached-thread", { turnId: "turn-stale" })).toBe(true);
    expect(client.requests).toEqual([
      {
        method: "turn/interrupt",
        params: { threadId: "detached-thread", turnId: "turn-stale" },
      },
      {
        method: "thread/read",
        params: { threadId: "detached-thread", includeTurns: true },
      },
      {
        method: "turn/interrupt",
        params: { threadId: "detached-thread", turnId: "turn-current" },
      },
    ]);
  });

  it("maps an MCP form elicitation to questions and returns structured content", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", firstText: "configure" });
    const events: UiEvent[] = [];
    driver.subscribe(id, (event) => events.push(event));
    client.emit({
      id: "mcp-1",
      method: "mcpServer/elicitation/request",
      params: {
        threadId: id,
        turnId: "turn-1",
        serverName: "example",
        mode: "form",
        message: "Choose deployment settings",
        requestedSchema: {
          type: "object",
          properties: {
            environment: { title: "Environment", type: "string", enum: ["dev", "prod"] },
          },
        },
      },
    });
    const interaction = events.find(
      (event) => event.kind === "tool_use" && event.id === "mcp-mcp-1",
    ) as Extract<UiEvent, { kind: "tool_use" }>;
    const question = (interaction.input as { questions: Array<{ question: string }> }).questions[0]
      ?.question;
    if (!question) throw new Error("MCP interaction question was not emitted");

    expect(
      driver.answer(id, {
        toolUseId: "mcp-mcp-1",
        text: "dev",
        toolUseResult: { answers: { [question]: "dev" } },
      }),
    ).toBe(true);
    expect(client.responses).toContainEqual({
      id: "mcp-1",
      result: { action: "accept", content: { environment: "dev" } },
    });
  });

  it("turns a Codex usage-limit failure into the normalized visible error", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", firstText: "ask" });
    const events: UiEvent[] = [];
    driver.subscribe(id, (event) => events.push(event));

    client.emit({
      method: "turn/completed",
      params: {
        threadId: id,
        turn: {
          id: "turn-1",
          status: "failed",
          error: { message: "You've hit your usage limit. Try again tomorrow." },
        },
      },
    });

    expect(events).toContainEqual({
      kind: "error",
      message: "You've hit your usage limit. Try again tomorrow.",
      code: "codex_usage_limit",
      vendor: "codex",
      retryable: true,
    });
    expect(driver.classifyError(new Error("401 Unauthorized"))).toMatchObject({
      code: "codex_auth_required",
      command: "codex login",
    });
  });

  it("surfaces the app-server usage-limit notification once without waiting for completion", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", firstText: "ask" });
    const events: UiEvent[] = [];
    driver.subscribe(id, (event) => events.push(event));
    const error = {
      message: "You have 0 weighted tokens left",
      codexErrorInfo: "usageLimitExceeded",
      additionalDetails: null,
    };

    client.emit({
      method: "error",
      params: {
        threadId: id,
        turnId: "turn-1",
        willRetry: true,
        error,
      },
    });
    expect(events.filter((event) => event.kind === "error")).toEqual([
      {
        kind: "error",
        message: "You have 0 weighted tokens left",
        code: "codex_usage_limit",
        vendor: "codex",
        retryable: true,
      },
    ]);

    // A later terminal notification and completion must not duplicate the card.
    client.emit({
      method: "error",
      params: {
        threadId: id,
        turnId: "turn-1",
        willRetry: false,
        error,
      },
    });
    client.emit({
      method: "turn/completed",
      params: {
        threadId: id,
        turn: { id: "turn-1", status: "failed", error },
      },
    });
    expect(events.filter((event) => event.kind === "error")).toHaveLength(1);
  });

  it("keeps transient app-server retry notifications non-terminal", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo", firstText: "ask" });
    const events: UiEvent[] = [];
    driver.subscribe(id, (event) => events.push(event));

    client.emit({
      method: "error",
      params: {
        threadId: id,
        turnId: "turn-1",
        willRetry: true,
        error: {
          message: "stream disconnected; retrying",
          codexErrorInfo: { responseStreamDisconnected: { httpStatusCode: null } },
        },
      },
    });

    expect(events.filter((event) => event.kind === "error")).toEqual([]);
    expect(driver.canSteer(id)).toBe(true);
  });

  it("uses native resume, fork, and interrupt without clearing the forked Goal", async () => {
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
    expect(forkClient.requests[1]?.method).toBe("turn/start");
    expect(forkClient.requests).not.toContainEqual({
      method: "thread/goal/clear",
      params: { threadId: id },
    });
    expect(await fork.interrupt(id)).toBe(true);
    expect(forkClient.requests.at(-1)).toEqual({
      method: "turn/interrupt",
      params: { threadId: id, turnId: "turn-1" },
    });
  });

  it("uses native Goal RPCs and publishes Goal notifications", async () => {
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo" });
    const events: UiEvent[] = [];
    driver.subscribe(id, (event) => events.push(event));

    await expect(driver.setGoal(id, "ship a verified fix")).resolves.toMatchObject({
      objective: "ship a verified fix",
      status: "active",
    });
    expect(client.requests.at(-1)).toMatchObject({
      method: "thread/goal/set",
      params: { threadId: id, objective: "ship a verified fix", status: "active" },
    });

    client.emit({
      method: "thread/goal/updated",
      params: {
        threadId: id,
        goal: { threadId: id, objective: "ship a verified fix", status: "complete" },
      },
    });
    client.emit({ method: "thread/goal/cleared", params: { threadId: id } });
    expect(events).toContainEqual({
      kind: "goal",
      goal: { threadId: id, objective: "ship a verified fix", status: "complete" },
    });
    expect(events).toContainEqual({ kind: "goal", goal: null });
    await expect(driver.clearGoal(id)).resolves.toBe(true);
  });

  it("remembers an interrupt requested before turn/start returns its turn id", async () => {
    const client = new DeferredTurnAppServer();
    const driver = new CodexAppServerDriver(client);
    const id = await driver.start({ cwd: "/repo" });

    expect(driver.send(id, { text: "stop this immediately" })).toBe(true);
    expect(await driver.interrupt(id)).toBe(true);
    expect(client.requests.some((request) => request.method === "turn/interrupt")).toBe(false);

    client.resolveTurnStart();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(client.requests.at(-1)).toEqual({
      method: "turn/interrupt",
      params: { threadId: id, turnId: "turn-1" },
    });
  });

  it("remembers an interrupt while a cold resumed session is still starting", async () => {
    const client = new DeferredTurnAppServer();
    client.nextThread = "parent";
    const driver = new CodexAppServerDriver(client);

    const starting = driver.start({
      cwd: "/repo",
      resume: "parent",
      firstText: "stop this cold start",
    });
    expect(await driver.interrupt("parent")).toBe(true);

    client.resolveTurnStart();
    expect(await starting).toBe("parent");
    expect(client.requests.at(-1)).toEqual({
      method: "turn/interrupt",
      params: { threadId: "parent", turnId: "turn-1" },
    });
  });

  it("unsubscribes a completed thread only after its 24-hour-style idle TTL", async () => {
    vi.useFakeTimers();
    const client = new FakeAppServer();
    const driver = new CodexAppServerDriver(client, 1_000);
    try {
      const id = await driver.start({ cwd: "/repo", firstText: "first" });
      const events: UiEvent[] = [];
      driver.subscribe(id, (event) => events.push(event));
      client.emit({
        method: "turn/completed",
        params: { threadId: id, turn: { id: "turn-1", status: "completed" } },
      });

      await vi.advanceTimersByTimeAsync(999);
      expect(driver.get(id)).toMatchObject({ cwd: "/repo" });
      expect(client.requests.some((request) => request.method === "thread/unsubscribe")).toBe(
        false,
      );

      expect(driver.send(id, { text: "still here" })).toBe(true);
      client.emit({
        method: "turn/completed",
        params: { threadId: id, turn: { id: "turn-2", status: "completed" } },
      });
      await vi.advanceTimersByTimeAsync(999);
      expect(driver.get(id)).toBeDefined();

      await vi.advanceTimersByTimeAsync(1);
      expect(driver.get(id)).toBeUndefined();
      expect(client.requests.at(-1)).toEqual({
        method: "thread/unsubscribe",
        params: { threadId: id },
      });

      await driver.start({ cwd: "/repo", resume: id });
      expect(client.requests.at(-1)).toMatchObject({
        method: "thread/resume",
        params: { threadId: id },
      });
      expect(events).toContainEqual({ kind: "session", sessionId: id });
    } finally {
      driver.shutdown();
      vi.useRealTimers();
    }
  });
});
