import { EventEmitter } from "node:events";
import type {
  ActiveSessionState,
  ChatDriver,
  StartOpts,
  ToolAnswer,
  UserTurn,
} from "../../driver.js";
import type { UiEvent } from "../../events.js";
import { type DriverRun, DriverRuntime } from "../../runtime.js";
import { prepareCodexInput } from "../input.js";
import { type AppServerClientLike, CodexAppServerClient } from "./client.js";
import type {
  AppServerItem,
  AppServerMessage,
  AppServerThread,
  AppServerTurn,
  JsonRpcId,
  UserInputQuestion,
} from "./types.js";

interface PendingInput {
  requestId: JsonRpcId;
  itemId: string;
  questions: UserInputQuestion[];
}

interface CodexRun extends DriverRun {
  model?: string;
  effort?: string;
  turnId: string | null;
  pendingInput: PendingInput | null;
  streamedMessages: Set<string>;
  cleanupInput: (() => void) | null;
}

interface ThreadResponse {
  thread: AppServerThread;
}

interface TurnResponse {
  turn: AppServerTurn;
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
  private readonly runtime = new DriverRuntime<CodexRun>({
    shouldReplay: (run) => run.turnActive || !!run.pendingInput,
  });
  private readonly unsubscribe: () => void;

  constructor(private readonly client: AppServerClientLike = new CodexAppServerClient()) {
    this.unsubscribe = client.onMessage((message) => this.receive(message));
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

  activeSessions(): string[] {
    return this.runtime.activeSessions();
  }

  activeSessionStates(): ActiveSessionState[] {
    return this.runtime.activeSessionStates();
  }

  async start(opts: StartOpts): Promise<string> {
    await this.client.start();
    const common = {
      cwd: opts.cwd,
      model: opts.model,
      approvalPolicy: "never",
      sandbox: "danger-full-access",
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
    const run: CodexRun = {
      sessionId,
      clientSessionId: opts.clientSessionId,
      cwd: opts.cwd,
      model: opts.model,
      effort: opts.effort,
      events: [],
      emitter: new EventEmitter(),
      turnActive: false,
      turnStartedAt: 0,
      turnId: null,
      pendingInput: null,
      streamedMessages: new Set(),
      cleanupInput: null,
    };
    this.runtime.index(sessionId, run);
    this.runtime.publish(run, { kind: "session", sessionId });
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
    }
    return sessionId;
  }

  send(sessionId: string, turn: UserTurn): boolean {
    const run = this.runtime.get(sessionId);
    if (!run || run.turnActive || run.pendingInput) return false;
    void this.startTurn(run, turn).catch((error) => this.failTurn(run, error));
    return true;
  }

  answer(sessionId: string, answer: ToolAnswer): boolean {
    const run = this.runtime.get(sessionId);
    const pending = run?.pendingInput;
    if (!run || !pending || pending.itemId !== answer.toolUseId) return false;
    const supplied = record(record(answer.toolUseResult).answers);
    const answers: Record<string, { answers: string[] }> = {};
    for (const question of pending.questions) {
      const value = supplied[question.question] ?? supplied[question.id];
      const values = Array.isArray(value)
        ? value.map(String)
        : typeof value === "string"
          ? [value]
          : [answer.text];
      answers[question.id] = { answers: values };
    }
    run.pendingInput = null;
    this.client.respond(pending.requestId, { answers });
    return true;
  }

  async interrupt(sessionId: string): Promise<boolean> {
    const run = this.runtime.get(sessionId);
    if (!run?.turnActive || !run.turnId) return false;
    await this.client.request("turn/interrupt", {
      threadId: sessionId,
      turnId: run.turnId,
    });
    return true;
  }

  subscribe(sessionId: string, listener: (event: UiEvent) => void): () => void {
    return this.runtime.subscribe(sessionId, listener);
  }

  shutdown(): void {
    this.unsubscribe();
    this.runtime.clearPending();
    for (const run of this.runtime.values()) run.cleanupInput?.();
    this.client.shutdown();
  }

  private async startTurn(run: CodexRun, turn: UserTurn): Promise<void> {
    run.events = [];
    run.streamedMessages.clear();
    run.turnActive = true;
    run.turnStartedAt = Date.now();
    const prepared = prepareCodexInput(turn.text, turn.attachments);
    run.cleanupInput?.();
    run.cleanupInput = prepared.cleanup;
    try {
      const input: unknown[] = [];
      if (prepared.prompt) input.push({ type: "text", text: prepared.prompt, text_elements: [] });
      for (const imagePath of prepared.imagePaths)
        input.push({ type: "localImage", path: imagePath });
      const response = await this.client.request<TurnResponse>("turn/start", {
        threadId: run.sessionId,
        input,
        cwd: run.cwd,
        model: run.model,
        effort: run.effort,
        approvalPolicy: "never",
        sandboxPolicy: { type: "dangerFullAccess" },
      });
      run.turnId = response.turn.id;
    } catch (error) {
      run.cleanupInput?.();
      run.cleanupInput = null;
      throw error;
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
    const threadId = typeof params.threadId === "string" ? params.threadId : null;
    if (!threadId) return;
    const run = this.runtime.get(threadId);
    if (!run) return;

    switch (message.method) {
      case "turn/started": {
        const turn = record(params.turn);
        if (typeof turn.id === "string") run.turnId = turn.id;
        run.turnActive = true;
        if (!run.turnStartedAt) run.turnStartedAt = Date.now();
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
      case "turn/completed":
        this.turnCompleted(run, record(params.turn) as unknown as AppServerTurn);
        break;
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
    run.pendingInput = { requestId, itemId, questions };
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
        })),
      },
    });
  }

  private turnCompleted(run: CodexRun, turn: AppServerTurn): void {
    run.turnId = null;
    run.pendingInput = null;
    run.cleanupInput?.();
    run.cleanupInput = null;
    if (turn.status === "failed") {
      this.runtime.publish(run, {
        kind: "error",
        message: turn.error?.message ?? "codex turn failed",
      });
    } else {
      this.runtime.publish(run, {
        kind: "result",
        ok: turn.status === "completed",
        ...(turn.status === "interrupted" ? { text: "interrupted" } : {}),
      });
    }
  }

  private failTurn(run: CodexRun, error: unknown): void {
    run.turnId = null;
    run.pendingInput = null;
    run.cleanupInput?.();
    run.cleanupInput = null;
    this.runtime.publish(run, {
      kind: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
