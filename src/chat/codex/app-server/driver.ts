import { EventEmitter } from "node:events";
import type {
  ActiveSessionState,
  ChatDriver,
  SessionGoal,
  StartOpts,
  ToolAnswer,
  UserTurn,
} from "../../driver.js";
import type { UiEvent } from "../../events.js";
import { IdleSessionTimers, SESSION_IDLE_TTL_MS } from "../../idle-sessions.js";
import { InteractionBroker } from "../../interactions.js";
import { providerErrorPayload } from "../../provider-errors.js";
import { type DriverRun, DriverRuntime } from "../../runtime.js";
import { classifyCodexError } from "../errors.js";
import { prepareCodexInput, validateCodexAttachments } from "../input.js";
import { type AppServerClientLike, CodexAppServerClient } from "./client.js";
import type {
  AppServerItem,
  AppServerMessage,
  AppServerThread,
  AppServerTurn,
  JsonRpcId,
  UserInputQuestion,
} from "./types.js";

const INTERACTIVE_APPROVAL_POLICY = "never";
const INTERACTIVE_SANDBOX = "danger-full-access";
const INTERACTIVE_SANDBOX_POLICY = { type: "dangerFullAccess" } as const;

interface CodexRun extends DriverRun {
  model?: string;
  effort?: string;
  speed?: string;
  turnId: string | null;
  turnReady: Promise<void> | null;
  interruptRequested: boolean;
  interactions: InteractionBroker<ToolAnswer>;
  streamedMessages: Set<string>;
  cleanupInputs: Set<() => void>;
}

interface ThreadResponse {
  thread: AppServerThread;
  model?: string | null;
  reasoningEffort?: string | null;
  serviceTier?: string | null;
}

interface TurnResponse {
  turn: AppServerTurn;
}

interface ThreadReadResponse {
  thread: AppServerThread & { turns?: AppServerTurn[] };
}

interface GoalResponse {
  goal: SessionGoal | null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Persistent Codex adapter backed by the bidirectional app-server protocol. */
export class CodexAppServerDriver implements ChatDriver {
  readonly vendor = "codex";
  readonly classifyError = classifyCodexError;
  private readonly runtime = new DriverRuntime<CodexRun>({
    shouldReplay: (run) => run.turnActive || run.interactions.size > 0,
  });
  private readonly unsubscribe: () => void;
  private readonly idle: IdleSessionTimers;
  private readonly starts = new Map<string, Promise<string>>();
  private readonly pendingInterrupts = new Set<string>();

  constructor(
    private readonly client: AppServerClientLike = new CodexAppServerClient(),
    idleTtlMs = SESSION_IDLE_TTL_MS,
  ) {
    this.unsubscribe = client.onMessage((message) => this.receive(message));
    this.idle = new IdleSessionTimers(idleTtlMs);
  }

  onTurnEnd(listener: (sessionId: string) => void): () => void {
    return this.runtime.onTurnEnd(listener);
  }

  onEvent(
    listener: (sessionId: string, event: UiEvent, clientSessionId?: string) => void,
  ): () => void {
    return this.runtime.onEvent(listener);
  }

  get(sessionId: string): { cwd: string } | undefined {
    return this.runtime.get(sessionId);
  }

  validateAttachments(attachments: UserTurn["attachments"] = []): string | null {
    return validateCodexAttachments(attachments);
  }

  activeSessions(): string[] {
    return this.runtime.activeSessions();
  }

  activeSessionStates(): ActiveSessionState[] {
    return this.runtime.activeSessionStates();
  }

  async setGoal(sessionId: string, objective: string): Promise<SessionGoal> {
    await this.client.start();
    const response = await this.client.request<GoalResponse>("thread/goal/set", {
      threadId: sessionId,
      objective,
      status: "active",
    });
    if (!response.goal) throw new Error("codex did not return the created goal");
    return response.goal;
  }

  async getGoal(sessionId: string): Promise<SessionGoal | null> {
    await this.client.start();
    const response = await this.client.request<GoalResponse>("thread/goal/get", {
      threadId: sessionId,
    });
    return response.goal ?? null;
  }

  async clearGoal(sessionId: string): Promise<boolean> {
    await this.client.start();
    const response = await this.client.request<{ cleared?: boolean }>("thread/goal/clear", {
      threadId: sessionId,
    });
    return response.cleared === true;
  }

  async start(opts: StartOpts): Promise<string> {
    if (opts.resume && !opts.forkSession) this.idle.cancel(opts.resume);
    const key = opts.resume && !opts.forkSession ? opts.resume : null;
    if (!key) return this.startOnce(opts);
    const existing = this.starts.get(key);
    if (existing) return existing;
    const pending = this.startOnce(opts)
      .catch((error) => {
        const run = this.runtime.get(key);
        if (run) this.scheduleIdle(run);
        throw error;
      })
      .finally(() => {
        this.starts.delete(key);
        this.pendingInterrupts.delete(key);
      });
    this.starts.set(key, pending);
    return pending;
  }

  private async startOnce(opts: StartOpts): Promise<string> {
    const resumeKey = opts.resume && !opts.forkSession ? opts.resume : null;
    await this.client.start();
    const common = {
      cwd: opts.cwd,
      model: opts.model,
      ...(opts.speed ? { serviceTier: opts.speed } : {}),
      approvalPolicy: INTERACTIVE_APPROVAL_POLICY,
      sandbox: INTERACTIVE_SANDBOX,
    };
    let response: ThreadResponse;
    if (opts.forkSession && opts.resume) {
      response = await this.client.request<ThreadResponse>("thread/fork", {
        threadId: opts.resume,
        ...common,
      });
    } else if (opts.resume) {
      response = await this.client.request<ThreadResponse>("thread/resume", {
        threadId: opts.resume,
        ...common,
      });
    } else {
      response = await this.client.request<ThreadResponse>("thread/start", common);
    }
    const sessionId = response.thread.id;
    const model = opts.model ?? response.model ?? undefined;
    const effort = opts.effort ?? response.reasoningEffort ?? undefined;
    const speed = opts.speed ?? response.serviceTier ?? undefined;
    const run: CodexRun = {
      sessionId,
      clientSessionId: opts.clientSessionId,
      cwd: opts.cwd,
      model,
      effort,
      speed,
      events: [],
      emitter: new EventEmitter(),
      turnActive: false,
      turnStartedAt: 0,
      turnId: null,
      turnReady: null,
      interruptRequested: resumeKey ? this.pendingInterrupts.delete(resumeKey) : false,
      interactions: new InteractionBroker<ToolAnswer>(),
      streamedMessages: new Set(),
      cleanupInputs: new Set(),
    };
    this.runtime.index(sessionId, run);
    this.runtime.publish(run, { kind: "session", sessionId });
    if (model || effort || speed)
      this.runtime.publish(run, {
        kind: "run_config",
        source: "provider",
        ...(model ? { model } : {}),
        ...(effort ? { effort } : {}),
        ...(speed ? { speed } : {}),
      });
    if (opts.firstText !== undefined || opts.firstAttachments?.length) {
      try {
        await this.startTurn(run, {
          text: opts.firstText ?? "",
          attachments: opts.firstAttachments,
        });
      } catch (error) {
        this.failTurn(run, error);
        throw error;
      }
    } else {
      this.scheduleIdle(run);
    }
    return sessionId;
  }

  send(sessionId: string, turn: UserTurn): boolean {
    const run = this.runtime.get(sessionId);
    if (!run || run.turnActive || run.interactions.size > 0) return false;
    this.idle.cancel(sessionId);
    void this.startTurn(run, turn).catch((error) => this.failTurn(run, error));
    return true;
  }

  canSteer(sessionId: string): boolean {
    const run = this.runtime.get(sessionId);
    return (
      !!run && run.turnActive && (!!run.turnId || !!run.turnReady) && run.interactions.size === 0
    );
  }

  async steer(sessionId: string, turn: UserTurn): Promise<boolean> {
    const run = this.runtime.get(sessionId);
    if (!run || !this.canSteer(sessionId)) return false;
    if (run.turnReady) await run.turnReady;
    if (!this.canSteer(sessionId) || !run.turnId) return false;
    this.idle.cancel(sessionId);
    const expectedTurnId = run.turnId;
    const prepared = this.prepareTurnInput(turn);
    run.cleanupInputs.add(prepared.cleanup);
    try {
      await this.client.request("turn/steer", {
        threadId: sessionId,
        input: prepared.input,
        expectedTurnId,
      });
      return true;
    } catch {
      run.cleanupInputs.delete(prepared.cleanup);
      prepared.cleanup();
      return false;
    }
  }

  answer(sessionId: string, answer: ToolAnswer): boolean {
    const run = this.runtime.get(sessionId);
    return !!run && run.interactions.answer(answer.toolUseId, answer);
  }

  async interrupt(sessionId: string, options?: { turnId?: string | null }): Promise<boolean> {
    const run = this.runtime.get(sessionId);
    if (!run) {
      if (this.starts.has(sessionId)) {
        this.pendingInterrupts.add(sessionId);
        return true;
      }
      return this.interruptRemoteTurn(sessionId, options?.turnId);
    }
    const cancelledInteractions = run.interactions.cancelAll();
    if (!run.turnActive)
      return (
        cancelledInteractions > 0 || (await this.interruptRemoteTurn(sessionId, options?.turnId))
      );
    if (!run.turnId) {
      run.interruptRequested = true;
      return true;
    }
    await this.client.request("turn/interrupt", {
      threadId: sessionId,
      turnId: run.turnId,
    });
    return true;
  }

  private async interruptRemoteTurn(
    sessionId: string,
    hintedTurnId?: string | null,
  ): Promise<boolean> {
    try {
      if (hintedTurnId) {
        try {
          await this.client.request("turn/interrupt", {
            threadId: sessionId,
            turnId: hintedTurnId,
          });
          return true;
        } catch {
          // The scanner can be one event behind a just-finished turn. Fall
          // through to discover a newer active turn before reporting failure.
        }
      }
      const response = await this.client.request<ThreadReadResponse>("thread/read", {
        threadId: sessionId,
        includeTurns: true,
      });
      const turns = Array.isArray(response.thread.turns) ? response.thread.turns : [];
      const active = [...turns].reverse().find((turn) => turn.status === "inProgress");
      if (!active?.id) return false;
      await this.client.request("turn/interrupt", { threadId: sessionId, turnId: active.id });
      return true;
    } catch {
      return false;
    }
  }

  subscribe(sessionId: string, listener: (event: UiEvent) => void): () => void {
    return this.runtime.subscribe(sessionId, listener);
  }

  shutdown(): void {
    this.unsubscribe();
    this.idle.clear();
    this.runtime.clearPending();
    for (const run of this.runtime.values()) this.cleanupPreparedInputs(run);
    this.client.shutdown();
  }

  private prepareTurnInput(turn: UserTurn): {
    input: unknown[];
    cleanup: () => void;
  } {
    const prepared = prepareCodexInput(turn.text, turn.attachments);
    const input: unknown[] = [];
    if (prepared.prompt) input.push({ type: "text", text: prepared.prompt, text_elements: [] });
    for (const imagePath of prepared.imagePaths)
      input.push({ type: "localImage", path: imagePath });
    return { input, cleanup: prepared.cleanup };
  }

  private cleanupPreparedInputs(run: CodexRun): void {
    for (const cleanup of run.cleanupInputs) cleanup();
    run.cleanupInputs.clear();
  }

  private async startTurn(run: CodexRun, turn: UserTurn): Promise<void> {
    if (run.sessionId) this.idle.cancel(run.sessionId);
    run.events = [];
    run.streamedMessages.clear();
    run.turnActive = true;
    run.turnStartedAt = Date.now();
    const prepared = this.prepareTurnInput(turn);
    this.cleanupPreparedInputs(run);
    run.cleanupInputs.add(prepared.cleanup);
    let markTurnReady = () => {};
    const turnReady = new Promise<void>((resolve) => {
      markTurnReady = resolve;
    });
    run.turnReady = turnReady;
    try {
      const response = await this.client.request<TurnResponse>("turn/start", {
        threadId: run.sessionId,
        input: prepared.input,
        cwd: run.cwd,
        model: run.model,
        effort: run.effort,
        ...(run.speed ? { serviceTier: run.speed } : {}),
        approvalPolicy: INTERACTIVE_APPROVAL_POLICY,
        sandboxPolicy: INTERACTIVE_SANDBOX_POLICY,
      });
      run.turnId = response.turn.id;
      if (run.interruptRequested) {
        await this.client.request("turn/interrupt", {
          threadId: run.sessionId,
          turnId: run.turnId,
        });
      }
    } catch (error) {
      run.interruptRequested = false;
      this.cleanupPreparedInputs(run);
      throw error;
    } finally {
      markTurnReady();
      if (run.turnReady === turnReady) run.turnReady = null;
    }
  }

  private receive(message: AppServerMessage): void {
    if (message.method === "transport/error") {
      const error = record(message.params).error;
      for (const run of this.runtime.values()) {
        if (run.turnActive) this.failTurn(run, error);
      }
      return;
    }
    const params = record(message.params);
    const requestMethod = message.id !== undefined ? message.method : undefined;
    if (
      requestMethod === "account/chatgptAuthTokens/refresh" ||
      requestMethod === "attestation/generate"
    ) {
      this.client.respondError(
        message.id as JsonRpcId,
        `${requestMethod} is not supported by Attend`,
      );
      return;
    }
    const threadId = typeof params.threadId === "string" ? params.threadId : null;
    if (!threadId) {
      if (message.id !== undefined && message.method)
        this.client.respondError(message.id, `Unsupported app-server request: ${message.method}`);
      return;
    }
    const run = this.runtime.get(threadId);
    if (!run) {
      if (message.id !== undefined)
        this.client.respondError(message.id, `No live Attend session for ${threadId}`);
      return;
    }

    switch (message.method) {
      case "thread/goal/updated": {
        const goal = record(params.goal) as unknown as SessionGoal;
        this.runtime.publish(run, { kind: "goal", goal });
        break;
      }
      case "thread/goal/cleared":
        this.runtime.publish(run, { kind: "goal", goal: null });
        break;
      case "turn/started": {
        this.idle.cancel(threadId);
        const turn = record(params.turn);
        if (typeof turn.id === "string") run.turnId = turn.id;
        run.turnActive = true;
        if (!run.turnStartedAt) run.turnStartedAt = Date.now();
        break;
      }
      case "error": {
        // app-server reports terminal provider failures here before (and, in
        // some versions, without) a useful turn/completed notification. In
        // particular usageLimitExceeded may be marked willRetry while Codex
        // backs off internally. Waiting for those retries leaves the UI silent
        // even though the user already needs to wait for quota reset. Surface
        // classified account failures immediately; only transient unknown
        // failures remain silent while the provider retries.
        const error = record(params.error);
        const classified = this.classifyError(error);
        if (run.turnActive && (params.willRetry !== true || classified)) this.failTurn(run, error);
        break;
      }
      case "item/agentMessage/delta": {
        const itemId = typeof params.itemId === "string" ? params.itemId : "";
        if (itemId) run.streamedMessages.add(itemId);
        if (typeof params.delta === "string" && params.delta) {
          this.runtime.publish(run, { kind: "assistant_text", text: params.delta });
        }
        break;
      }
      case "item/started":
        this.itemStarted(run, record(params.item) as AppServerItem);
        break;
      case "item/completed":
        this.itemCompleted(run, record(params.item) as AppServerItem);
        break;
      case "item/tool/requestUserInput":
        if (message.id !== undefined) this.requestUserInput(run, message.id, params);
        break;
      case "item/commandExecution/requestApproval":
        if (message.id !== undefined) this.requestApproval(run, message.id, params, "command");
        break;
      case "item/fileChange/requestApproval":
        if (message.id !== undefined) this.requestApproval(run, message.id, params, "file change");
        break;
      case "item/permissions/requestApproval":
        if (message.id !== undefined) this.requestPermissionApproval(run, message.id, params);
        break;
      case "mcpServer/elicitation/request":
        if (message.id !== undefined) this.requestMcpElicitation(run, message.id, params);
        break;
      case "item/tool/call":
        if (message.id !== undefined) this.requestDynamicTool(run, message.id, params);
        break;
      case "turn/completed":
        this.turnCompleted(run, record(params.turn) as unknown as AppServerTurn);
        break;
      default:
        if (message.id !== undefined && message.method)
          this.client.respondError(message.id, `Unsupported app-server request: ${message.method}`);
    }
  }

  private itemStarted(run: CodexRun, item: AppServerItem): void {
    if (!item.id) return;
    if (item.type === "commandExecution") {
      this.runtime.publish(run, {
        kind: "tool_use",
        id: item.id,
        name: "shell",
        input: { command: item.command, cwd: item.cwd },
      });
    } else if (item.type === "mcpToolCall") {
      this.runtime.publish(run, {
        kind: "tool_use",
        id: item.id,
        name: [item.server, item.tool].filter(Boolean).join(".") || "mcp",
        input: item.arguments,
      });
    }
  }

  private itemCompleted(run: CodexRun, item: AppServerItem): void {
    if (!item.id) return;
    if (item.type === "agentMessage" && item.text && !run.streamedMessages.has(item.id)) {
      this.runtime.publish(run, { kind: "assistant_text", text: item.text });
    } else if (item.type === "commandExecution") {
      this.runtime.publish(run, {
        kind: "tool_result",
        id: item.id,
        text: item.aggregatedOutput ?? "",
        isError: item.status === "failed" || (item.exitCode ?? 0) !== 0,
      });
    } else if (item.type === "fileChange") {
      this.runtime.publish(run, {
        kind: "tool_use",
        id: item.id,
        name: "edit",
        input: { id: item.id, type: item.type, changes: item.changes ?? [], status: item.status },
      });
    } else if (item.type === "mcpToolCall") {
      this.runtime.publish(run, {
        kind: "tool_result",
        id: item.id,
        text: text(item.error ?? item.result),
        isError: item.status === "failed" || !!item.error,
      });
    }
  }

  private requestUserInput(
    run: CodexRun,
    requestId: JsonRpcId,
    params: Record<string, unknown>,
  ): void {
    const itemId = typeof params.itemId === "string" ? params.itemId : String(requestId);
    const questions = Array.isArray(params.questions)
      ? (params.questions as UserInputQuestion[])
      : [];
    const opened = run.interactions.open({
      id: itemId,
      requestId,
      kind: "question",
      answer: (answer) => {
        const supplied = record(record(answer.toolUseResult).answers);
        const answers: Record<string, { answers: string[] }> = {};
        for (const question of questions) {
          const value = supplied[question.question] ?? supplied[question.id];
          const values = Array.isArray(value)
            ? value.map(String)
            : typeof value === "string"
              ? [value]
              : [answer.text];
          answers[question.id] = { answers: values };
        }
        this.client.respond(requestId, { answers });
      },
      cancel: () => this.client.respondError(requestId, "Interaction cancelled by user"),
    });
    if (!opened) {
      this.client.respondError(requestId, `Duplicate interaction id: ${itemId}`);
      return;
    }
    this.runtime.publish(run, {
      kind: "tool_use",
      id: itemId,
      name: "request_user_input",
      input: {
        questions: questions.map((question) => ({
          id: question.id,
          header: question.header,
          question: question.question,
          options: question.options ?? [],
          multiSelect: false,
          ...(question.isSecret === true ? { isSecret: true } : {}),
        })),
      },
    });
  }

  private requestApproval(
    run: CodexRun,
    requestId: JsonRpcId,
    params: Record<string, unknown>,
    subject: string,
  ): void {
    const itemId = typeof params.itemId === "string" ? params.itemId : String(requestId);
    const command = typeof params.command === "string" ? `\n\n${params.command}` : "";
    const reason = typeof params.reason === "string" ? `\n\n${params.reason}` : "";
    const question = `Approve this ${subject}?${command}${reason}`;
    this.openChoiceInteraction(
      run,
      requestId,
      itemId,
      "approval",
      question,
      (choice) => ({
        decision: choice === "Approve" ? "accept" : "decline",
      }),
      { decision: "cancel" },
    );
  }

  private requestPermissionApproval(
    run: CodexRun,
    requestId: JsonRpcId,
    params: Record<string, unknown>,
  ): void {
    const itemId = typeof params.itemId === "string" ? params.itemId : String(requestId);
    const reason =
      typeof params.reason === "string" ? params.reason : "Additional permissions requested";
    this.openChoiceInteraction(
      run,
      requestId,
      itemId,
      "approval",
      `${reason}\n\nRequested permissions: ${text(params.permissions)}`,
      (choice) =>
        choice === "Approve"
          ? { permissions: record(params.permissions), scope: "turn" }
          : { permissions: {}, scope: "turn" },
      { permissions: {}, scope: "turn" },
    );
  }

  private requestDynamicTool(
    run: CodexRun,
    requestId: JsonRpcId,
    params: Record<string, unknown>,
  ): void {
    const tool = typeof params.tool === "string" ? params.tool : "";
    const callId = typeof params.callId === "string" ? params.callId : String(requestId);
    if (tool.split(".").pop() !== "request_plugin_install") {
      this.client.respondError(requestId, `Unsupported client tool: ${tool || "unknown"}`);
      return;
    }
    const args = record(params.arguments);
    const pluginId = typeof args.plugin_id === "string" ? args.plugin_id : "the suggested plugin";
    const reason = typeof args.suggest_reason === "string" ? `\n\n${args.suggest_reason}` : "";
    this.openChoiceInteraction(
      run,
      requestId,
      callId,
      "client_action",
      `Install ${pluginId}?${reason}`,
      (choice) => ({
        success: true,
        contentItems: [
          {
            type: "inputText",
            text:
              choice === "Approve"
                ? `The user accepted the ${pluginId} installation suggestion.`
                : `The user declined the ${pluginId} installation suggestion.`,
          },
        ],
      }),
      {
        success: false,
        contentItems: [{ type: "inputText", text: "Plugin installation suggestion cancelled." }],
      },
    );
  }

  private requestMcpElicitation(
    run: CodexRun,
    requestId: JsonRpcId,
    params: Record<string, unknown>,
  ): void {
    const itemId =
      typeof params.elicitationId === "string" ? params.elicitationId : `mcp-${String(requestId)}`;
    const mode = typeof params.mode === "string" ? params.mode : "form";
    const baseMessage = typeof params.message === "string" ? params.message : "MCP input requested";
    const message =
      mode === "url" && typeof params.url === "string"
        ? `${baseMessage}\n\nOpen this URL, complete the action, then approve:\n${params.url}`
        : baseMessage;
    const schema = record(params.requestedSchema);
    const properties = record(schema.properties);
    const required = new Set(Array.isArray(schema.required) ? schema.required.map(String) : []);
    const fields = Object.entries(properties).map(([id, raw]) => {
      const field = record(raw);
      const items = record(field.items);
      const enumValues = Array.isArray(field.enum)
        ? field.enum
        : Array.isArray(items.enum)
          ? items.enum
          : null;
      const choices = enumValues
        ? enumValues.map((value) => ({ label: String(value), description: "" }))
        : field.type === "boolean"
          ? [
              { label: "true", description: "" },
              { label: "false", description: "" },
            ]
          : [];
      return {
        id,
        header: typeof field.title === "string" ? field.title : id,
        question:
          typeof field.description === "string"
            ? `${message}\n\n${field.description}`
            : `${message}\n\n${id}`,
        options: choices,
        multiSelect: field.type === "array",
        optional: !required.has(id),
        isSecret: field.writeOnly === true || field.format === "password",
        valueType: typeof field.type === "string" ? field.type : "string",
      };
    });
    const questions = fields.length
      ? fields
      : [
          {
            id: "action",
            header: "MCP request",
            question: message,
            options: [
              { label: "Approve", description: "Continue with this request" },
              { label: "Decline", description: "Do not continue" },
            ],
            multiSelect: false,
          },
        ];
    const opened = run.interactions.open({
      id: itemId,
      requestId,
      kind: "form",
      answer: (answer) => {
        const supplied = record(record(answer.toolUseResult).answers);
        if (!fields.length) {
          const choice = String(Object.values(supplied)[0] ?? "Decline");
          this.client.respond(requestId, { action: choice === "Approve" ? "accept" : "decline" });
          return;
        }
        const content: Record<string, unknown> = {};
        for (const field of fields) {
          const value = supplied[field.question] ?? supplied[field.id];
          if (value === undefined || value === "") continue;
          if (field.valueType === "number" || field.valueType === "integer")
            content[field.id] = Number(value);
          else if (field.valueType === "boolean") content[field.id] = String(value) === "true";
          else if (field.valueType === "array")
            content[field.id] = Array.isArray(value)
              ? value
              : String(value)
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean);
          else content[field.id] = value;
        }
        this.client.respond(requestId, { action: "accept", content });
      },
      cancel: () => this.client.respond(requestId, { action: "cancel" }),
    });
    if (!opened) {
      this.client.respondError(requestId, `Duplicate interaction id: ${itemId}`);
      return;
    }
    this.runtime.publish(run, {
      kind: "tool_use",
      id: itemId,
      name: "request_user_input",
      input: { questions, interactionKind: mode === "url" ? "approval" : "form" },
    });
  }

  private openChoiceInteraction(
    run: CodexRun,
    requestId: JsonRpcId,
    itemId: string,
    kind: "approval" | "client_action",
    question: string,
    result: (choice: string) => unknown,
    cancelResult: unknown,
  ): void {
    const opened = run.interactions.open({
      id: itemId,
      requestId,
      kind,
      answer: (answer) => {
        const supplied = record(record(answer.toolUseResult).answers);
        const choice = String(supplied[question] ?? Object.values(supplied)[0] ?? answer.text);
        this.client.respond(requestId, result(choice));
      },
      cancel: () => this.client.respond(requestId, cancelResult),
    });
    if (!opened) {
      this.client.respondError(requestId, `Duplicate interaction id: ${itemId}`);
      return;
    }
    this.runtime.publish(run, {
      kind: "tool_use",
      id: itemId,
      name: "request_user_input",
      input: {
        interactionKind: kind,
        questions: [
          {
            id: "decision",
            header: kind === "approval" ? "Approval" : "Action",
            question,
            options: [
              { label: "Approve", description: "Allow this request" },
              { label: "Decline", description: "Do not allow this request" },
            ],
            multiSelect: false,
          },
        ],
      },
    });
  }

  private turnCompleted(run: CodexRun, turn: AppServerTurn): void {
    // A non-retrying app-server `error` notification may already have ended and
    // surfaced this turn. Ignore the trailing completion instead of duplicating
    // the banner (or replacing its structured usage-limit classification).
    if (!run.turnActive) {
      this.scheduleIdle(run);
      return;
    }
    run.turnId = null;
    run.turnReady = null;
    run.interruptRequested = false;
    run.interactions.cancelAll();
    this.cleanupPreparedInputs(run);
    if (turn.status === "failed") {
      this.runtime.publish(run, {
        kind: "error",
        ...providerErrorPayload(this.classifyError, turn.error ?? "codex turn failed"),
      });
    } else {
      this.runtime.publish(run, {
        kind: "result",
        ok: turn.status === "completed",
        ...(turn.status === "interrupted" ? { text: "interrupted" } : {}),
      });
    }
    this.scheduleIdle(run);
  }

  private failTurn(run: CodexRun, error: unknown): void {
    run.turnId = null;
    run.turnReady = null;
    run.interruptRequested = false;
    run.interactions.cancelAll();
    this.cleanupPreparedInputs(run);
    this.runtime.publish(run, {
      kind: "error",
      ...providerErrorPayload(this.classifyError, error),
    });
    this.scheduleIdle(run);
  }

  private scheduleIdle(run: CodexRun): void {
    const sessionId = run.sessionId;
    if (!sessionId || run.turnActive || run.interactions.size > 0) return;
    this.idle.arm(sessionId, () => this.releaseIdle(run));
  }

  private releaseIdle(run: CodexRun): void {
    const sessionId = run.sessionId;
    if (!sessionId || run.turnActive || run.interactions.size > 0) return;
    if (!this.runtime.release(sessionId, run)) return;
    this.cleanupPreparedInputs(run);
    void this.client.request("thread/unsubscribe", { threadId: sessionId }).catch(() => {});
  }
}
