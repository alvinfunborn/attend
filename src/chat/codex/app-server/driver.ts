import { EventEmitter } from "node:events";
import { debugLog } from "../../debug-log.js";
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
import { MEMORY_CITATION_OPEN, extractMemoryCitationTrailer } from "../../memory-citations.js";
import { errorText, providerErrorPayload } from "../../provider-errors.js";
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
const INTERRUPT_REQUEST_TIMEOUT_MS = 5_000;
const RESUME_REQUEST_TIMEOUT_MS = 60_000;
const CAPACITY_RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000, 40_000, 60_000] as const;
const CAPACITY_RETRY_PROMPT = [
  "<attend_auto_retry>",
  "The previous turn was interrupted by a transient Codex model-capacity error.",
  "Continue the original task from the exact point where it stopped " +
    "without asking the user to send continue.",
  "Do not repeat completed side effects. Reuse or inspect any yielded tool session " +
    "before starting a duplicate.",
  "Finish only when the original task is genuinely complete or needs real user input.",
  "</attend_auto_retry>",
].join("\n");

interface CodexRun extends DriverRun {
  model?: string;
  effort?: string;
  speed?: string;
  turnId: string | null;
  turnReady: Promise<void> | null;
  interruptRequested: boolean;
  interactions: InteractionBroker<ToolAnswer>;
  agentMessageStreams: Map<string, { raw: string; emittedLength: number }>;
  cleanupInputs: Set<() => void>;
  capacityRetryAttempt: number;
  capacityRetryTimer: ReturnType<typeof setTimeout> | null;
  pendingCapacityError: unknown;
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

function isCapacityError(error: unknown): boolean {
  const normalized = `${errorText(error)} ${text(error)}`.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return (
    normalized.includes("serveroverloaded") ||
    normalized.includes("serverisoverloaded") ||
    normalized.includes("selectedmodelisatcapacity") ||
    normalized.includes("modelisatcapacity") ||
    normalized.includes("modelcapacityerror")
  );
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
    private readonly capacityRetryDelaysMs: readonly number[] = CAPACITY_RETRY_DELAYS_MS,
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
      // Display history comes from Attend's history worker. Hydrating every
      // provider turn here only delays sending, and a missing RPC response must
      // not pin starts[sessionId] forever (including every subsequent retry).
      response = await this.client.request<ThreadResponse>(
        "thread/resume",
        { threadId: opts.resume, ...common, excludeTurns: true },
        { timeoutMs: RESUME_REQUEST_TIMEOUT_MS },
      );
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
      agentMessageStreams: new Map(),
      cleanupInputs: new Set(),
      capacityRetryAttempt: 0,
      capacityRetryTimer: null,
      pendingCapacityError: null,
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
    const prepared = this.prepareTurnInput(turn);
    run.cleanupInputs.add(prepared.cleanup);
    const submit = (expectedTurnId: string) =>
      this.client.request("turn/steer", {
        threadId: sessionId,
        input: prepared.input,
        expectedTurnId,
      });
    const expectedTurnId = run.turnId;
    try {
      await submit(expectedTurnId);
      return true;
    } catch (error) {
      debugLog("codex", `turn/steer rejected for ${sessionId}`, error);
      // The tracked id can be stale whenever the provider started a turn we did
      // not (Goal continuation being the standard case). Re-resolve the live
      // turn once and retry, so a desynced run repairs itself instead of
      // refusing every guide until the session is restarted.
      const activeTurnId = await this.resolveActiveTurnId(sessionId);
      if (activeTurnId && activeTurnId !== expectedTurnId) {
        run.turnId = activeTurnId;
        try {
          await submit(activeTurnId);
          return true;
        } catch (retryError) {
          debugLog("codex", `turn/steer retry rejected for ${sessionId}`, retryError);
        }
      }
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
    if (run.capacityRetryTimer !== null) {
      this.finishCapacityRetryAsInterrupted(run);
      return true;
    }
    if (!run.turnActive)
      return (
        cancelledInteractions > 0 || (await this.interruptRemoteTurn(sessionId, options?.turnId))
      );
    if (!run.turnId) {
      run.interruptRequested = true;
      return true;
    }
    try {
      await this.client.request(
        "turn/interrupt",
        { threadId: sessionId, turnId: run.turnId },
        { timeoutMs: INTERRUPT_REQUEST_TIMEOUT_MS },
      );
      return true;
    } catch (error) {
      debugLog("codex", `turn/interrupt rejected for ${sessionId}`, error);
      // Same stale-id hazard as steer: a run tracking a turn the provider never
      // ran could never be stopped, because the live-run branch had no fallback
      // at all. Re-resolve and retry rather than stranding the session.
      return this.interruptRemoteTurn(sessionId);
    }
  }

  /** The turn the provider is actually running, whatever this run believes. */
  private async resolveActiveTurnId(sessionId: string): Promise<string | null> {
    try {
      const response = await this.client.request<ThreadReadResponse>(
        "thread/read",
        { threadId: sessionId, includeTurns: true },
        { timeoutMs: INTERRUPT_REQUEST_TIMEOUT_MS },
      );
      const turns = Array.isArray(response.thread.turns) ? response.thread.turns : [];
      return [...turns].reverse().find((turn) => turn.status === "inProgress")?.id ?? null;
    } catch (error) {
      debugLog("codex", `thread/read failed for ${sessionId}`, error);
      return null;
    }
  }

  private async interruptRemoteTurn(
    sessionId: string,
    hintedTurnId?: string | null,
  ): Promise<boolean> {
    try {
      if (hintedTurnId) {
        try {
          await this.client.request(
            "turn/interrupt",
            { threadId: sessionId, turnId: hintedTurnId },
            { timeoutMs: INTERRUPT_REQUEST_TIMEOUT_MS },
          );
          return true;
        } catch (error) {
          // The scanner can be one event behind a just-finished turn. Fall
          // through to discover a newer active turn before reporting failure.
          debugLog("codex", `hinted turn/interrupt rejected for ${sessionId}`, error);
        }
      }
      const activeTurnId = await this.resolveActiveTurnId(sessionId);
      if (!activeTurnId) return false;
      await this.client.request(
        "turn/interrupt",
        { threadId: sessionId, turnId: activeTurnId },
        { timeoutMs: INTERRUPT_REQUEST_TIMEOUT_MS },
      );
      // Keep a live run pointed at the turn we just proved is real, so a
      // follow-up guide does not repeat the same rejected round trip.
      const run = this.runtime.get(sessionId);
      if (run?.turnActive) run.turnId = activeTurnId;
      return true;
    } catch (error) {
      debugLog("codex", `remote turn/interrupt failed for ${sessionId}`, error);
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
    for (const run of this.runtime.values()) {
      this.clearCapacityRetryTimer(run);
      this.cleanupPreparedInputs(run);
    }
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

  private async startTurn(
    run: CodexRun,
    turn: UserTurn,
    capacityContinuation = false,
  ): Promise<void> {
    if (run.sessionId) this.idle.cancel(run.sessionId);
    if (!capacityContinuation) {
      this.clearCapacityRetryTimer(run);
      run.capacityRetryAttempt = 0;
      run.events = [];
      run.agentMessageStreams.clear();
    }
    run.pendingCapacityError = null;
    run.turnActive = true;
    if (!capacityContinuation || !run.turnStartedAt) run.turnStartedAt = Date.now();
    // A fresh turn owns a fresh id, and `turn/started` may claim it before
    // `turn/start` answers (see below). Clear first so "unset" is meaningful.
    run.turnId = null;
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
      // `turn/started` is authoritative; the `turn/start` response is not.
      // `thread/goal/set` immediately starts a goal turn of its own, so our
      // later `turn/start` is absorbed into that already-running turn — and
      // answers with a *different*, never-live turn id. Adopting it made every
      // `expectedTurnId` wrong for the rest of the turn, which silently broke
      // both steer and interrupt on Goal sessions. Verified against the real
      // app-server: `expected active turn id <ours> but found <goal turn>`.
      if (!run.turnId) run.turnId = response.turn.id;
      if (run.interruptRequested) {
        await this.client.request(
          "turn/interrupt",
          { threadId: run.sessionId, turnId: run.turnId },
          { timeoutMs: INTERRUPT_REQUEST_TIMEOUT_MS },
        );
      }
    } catch (error) {
      this.cleanupPreparedInputs(run);
      // A rejected turn/start may not have persisted its input. Retry that
      // exact input; completed provider turns use the continuation prompt below.
      if (this.scheduleCapacityRetry(run, error, turn)) return;
      run.interruptRequested = false;
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
        if (isCapacityError(error)) {
          // Capacity failures terminate the provider turn, but not the user's
          // requested task. Wait for turn/completed so a replacement turn never
          // overlaps the provider's still-closing turn.
          run.pendingCapacityError = error;
          break;
        }
        const classified = this.classifyError(error);
        if (run.turnActive && (params.willRetry !== true || classified)) this.failTurn(run, error);
        break;
      }
      case "item/agentMessage/delta": {
        const itemId = typeof params.itemId === "string" ? params.itemId : "";
        if (typeof params.delta === "string" && params.delta) {
          this.publishAgentMessageDelta(run, itemId, params.delta);
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

  private publishAgentMessageDelta(run: CodexRun, itemId: string, delta: string): void {
    const key = itemId || "__agent_message__";
    const state = run.agentMessageStreams.get(key) ?? { raw: "", emittedLength: 0 };
    state.raw += delta;
    run.agentMessageStreams.set(key, state);

    const markerAt = state.raw.indexOf(MEMORY_CITATION_OPEN);
    let visibleEnd = markerAt;
    if (markerAt < 0) {
      let possibleMarkerLength = Math.min(MEMORY_CITATION_OPEN.length - 1, state.raw.length);
      while (
        possibleMarkerLength > 0 &&
        !MEMORY_CITATION_OPEN.startsWith(state.raw.slice(-possibleMarkerLength))
      ) {
        possibleMarkerLength--;
      }
      visibleEnd = state.raw.length - possibleMarkerLength;
    }
    if (visibleEnd <= state.emittedLength) return;
    this.runtime.publish(run, {
      kind: "assistant_text",
      text: state.raw.slice(state.emittedLength, visibleEnd),
    });
    state.emittedLength = visibleEnd;
  }

  private completeAgentMessage(run: CodexRun, itemId: string, text: string): void {
    const key = itemId || "__agent_message__";
    const state = run.agentMessageStreams.get(key);
    const parsed = extractMemoryCitationTrailer(text);
    const emittedLength = state?.emittedLength ?? 0;
    const emittedPrefix = state?.raw.slice(0, emittedLength) ?? "";

    if (parsed.memoryCitations) {
      if (!state || parsed.text.startsWith(emittedPrefix)) {
        const remainder = parsed.text.slice(emittedLength);
        if (remainder) this.runtime.publish(run, { kind: "assistant_text", text: remainder });
      }
      this.runtime.publish(run, {
        kind: "assistant_memory_citations",
        text: parsed.text,
        memoryCitations: parsed.memoryCitations,
      });
    } else if (!state || text.startsWith(emittedPrefix)) {
      const remainder = text.slice(emittedLength);
      if (remainder) this.runtime.publish(run, { kind: "assistant_text", text: remainder });
    } else {
      // A malformed terminal block must remain visible. A provider-side rewrite
      // is not expected, but releasing the withheld streamed bytes is safer than
      // silently discarding them when the completed text differs.
      const remainder = state.raw.slice(emittedLength);
      if (remainder) this.runtime.publish(run, { kind: "assistant_text", text: remainder });
    }

    run.agentMessageStreams.delete(key);
  }

  private flushAgentMessageStreams(run: CodexRun): void {
    for (const state of run.agentMessageStreams.values()) {
      const remainder = state.raw.slice(state.emittedLength);
      if (remainder) this.runtime.publish(run, { kind: "assistant_text", text: remainder });
    }
    run.agentMessageStreams.clear();
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
    if (item.type === "agentMessage" && item.text) {
      this.completeAgentMessage(run, item.id, item.text);
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
    const failure = isCapacityError(turn.error)
      ? turn.error
      : (run.pendingCapacityError ?? turn.error ?? "codex turn failed");
    if (turn.status === "failed" && this.scheduleCapacityRetry(run, failure)) return;

    this.clearCapacityRetryTimer(run);
    run.capacityRetryAttempt = 0;
    run.pendingCapacityError = null;
    run.turnId = null;
    run.turnReady = null;
    run.interruptRequested = false;
    run.interactions.cancelAll();
    this.cleanupPreparedInputs(run);
    this.flushAgentMessageStreams(run);
    if (turn.status === "failed") {
      this.runtime.publish(run, {
        kind: "error",
        ...providerErrorPayload(this.classifyError, failure),
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
    this.clearCapacityRetryTimer(run);
    run.capacityRetryAttempt = 0;
    run.pendingCapacityError = null;
    run.turnId = null;
    run.turnReady = null;
    run.interruptRequested = false;
    run.interactions.cancelAll();
    this.cleanupPreparedInputs(run);
    this.flushAgentMessageStreams(run);
    this.runtime.publish(run, {
      kind: "error",
      ...providerErrorPayload(this.classifyError, error),
    });
    this.scheduleIdle(run);
  }

  private scheduleCapacityRetry(
    run: CodexRun,
    error: unknown,
    retryTurn: UserTurn = { text: CAPACITY_RETRY_PROMPT },
  ): boolean {
    if (!isCapacityError(error)) return false;
    if (run.interruptRequested) {
      this.finishCapacityRetryAsInterrupted(run);
      return true;
    }
    const delayMs = this.capacityRetryDelaysMs[run.capacityRetryAttempt];
    if (delayMs === undefined) return false;

    this.clearCapacityRetryTimer(run);
    run.capacityRetryAttempt += 1;
    run.pendingCapacityError = null;
    run.turnId = null;
    run.turnReady = null;
    run.interactions.cancelAll();
    this.cleanupPreparedInputs(run);
    this.flushAgentMessageStreams(run);
    debugLog(
      "codex",
      `capacity retry ${run.capacityRetryAttempt}/${this.capacityRetryDelaysMs.length} for ${run.sessionId} in ${delayMs}ms`,
    );

    const timer = setTimeout(
      () => {
        if (run.capacityRetryTimer !== timer) return;
        run.capacityRetryTimer = null;
        if (!run.turnActive) return;
        if (run.interruptRequested) {
          this.finishCapacityRetryAsInterrupted(run);
          return;
        }
        void this.startTurn(run, retryTurn, true).catch((retryError) =>
          this.failTurn(run, retryError),
        );
      },
      Math.max(0, delayMs),
    );
    timer.unref?.();
    run.capacityRetryTimer = timer;
    return true;
  }

  private clearCapacityRetryTimer(run: CodexRun): void {
    if (run.capacityRetryTimer !== null) clearTimeout(run.capacityRetryTimer);
    run.capacityRetryTimer = null;
  }

  private finishCapacityRetryAsInterrupted(run: CodexRun): void {
    this.clearCapacityRetryTimer(run);
    run.capacityRetryAttempt = 0;
    run.pendingCapacityError = null;
    run.turnId = null;
    run.turnReady = null;
    run.interruptRequested = false;
    run.interactions.cancelAll();
    this.cleanupPreparedInputs(run);
    this.flushAgentMessageStreams(run);
    this.runtime.publish(run, { kind: "result", ok: false, text: "interrupted" });
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
