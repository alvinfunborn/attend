import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  Options,
  PermissionMode,
  SDKUserMessage,
  query,
} from "@anthropic-ai/claude-agent-sdk";
import type { ContentBlockParam, MessageParam, TextBlockParam } from "@anthropic-ai/sdk/resources";
import type {
  ActiveSessionState,
  ChatAttachment,
  ChatDriver,
  StartOpts,
  ToolAnswer,
  UserTurn,
} from "../driver.js";
import type { UiEvent } from "../events.js";
import { IdleSessionTimers, SESSION_IDLE_TTL_MS } from "../idle-sessions.js";
import { providerErrorPayload } from "../provider-errors.js";
import { type DriverRun, DriverRuntime } from "../runtime.js";
import { classifyClaudeError } from "./errors.js";
import { toUiEventsFromClaude } from "./events.js";

/** Injectable so tests can drive the adapter without the real SDK or network. */
export type QueryFn = typeof query;

class ClaudeInputQueue implements AsyncIterable<SDKUserMessage> {
  private items: SDKUserMessage[] = [];
  private waiters: Array<(result: IteratorResult<SDKUserMessage>) => void> = [];
  private closed = false;
  private tempDir: string | null = null;
  private fileCount = 0;

  private push(message: SDKUserMessage): void {
    const waiter = this.waiters.shift();
    if (waiter) waiter({ value: message, done: false });
    else this.items.push(message);
  }

  private attachmentBlock(
    attachment: Exclude<ChatAttachment, { kind: "file" }>,
  ): ContentBlockParam {
    if (attachment.kind === "image") {
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: attachment.mediaType,
          data: attachment.data,
        },
      };
    }
    if (attachment.kind === "document") {
      return {
        type: "document",
        title: attachment.name,
        source: {
          type: "base64",
          media_type: attachment.mediaType,
          data: attachment.data,
        },
      };
    }
    return {
      type: "document",
      title: attachment.name,
      source: { type: "text", media_type: "text/plain", data: attachment.text },
    };
  }

  private sanitizeAttachmentName(name: string): string {
    const base = path.basename(name).trim();
    return base.replace(/[^A-Za-z0-9._-]+/g, "-") || "attachment";
  }

  private appendFileAttachment(
    text: string,
    attachment: Extract<ChatAttachment, { kind: "file" }>,
  ): string {
    if (!this.tempDir) this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-claude-"));
    this.fileCount++;
    const file = path.join(
      this.tempDir,
      `${String(this.fileCount).padStart(2, "0")}-${this.sanitizeAttachmentName(attachment.name)}`,
    );
    fs.writeFileSync(file, Buffer.from(attachment.data, "base64"));
    const block = [
      `[Attached file: ${attachment.name}]`,
      `MIME type: ${attachment.mediaType}`,
      `Local path: ${file}`,
      "Read this file from the local path when you need its contents.",
    ].join("\n");
    return text ? `${text}\n\n${block}` : block;
  }

  pushTurn(turn: UserTurn): void {
    let text = turn.text ?? "";
    const originalAttachments = turn.attachments ?? [];
    const attachments: Array<Exclude<ChatAttachment, { kind: "file" }>> = [];
    for (const attachment of originalAttachments) {
      if (attachment.kind === "file") {
        text = this.appendFileAttachment(text, attachment);
      } else {
        attachments.push(attachment);
      }
    }
    const textBlock: TextBlockParam | null = text ? { type: "text", text } : null;
    const content: MessageParam["content"] = originalAttachments.length
      ? [
          ...(textBlock ? [textBlock] : []),
          ...attachments.map((attachment) => this.attachmentBlock(attachment)),
        ]
      : text;
    this.push({
      type: "user",
      message: { role: "user", content },
      parent_tool_use_id: null,
    });
  }

  pushToolResult(toolUseId: string, text: string, toolUseResult?: unknown): void {
    this.push({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "tool_result", content: text, tool_use_id: toolUseId }],
      },
      parent_tool_use_id: toolUseId,
      ...(toolUseResult !== undefined ? { tool_use_result: toolUseResult } : {}),
    });
  }

  close(): void {
    this.closed = true;
    this.cleanup();
    const waiter = this.waiters.shift();
    if (waiter) waiter({ value: undefined as unknown as SDKUserMessage, done: true });
  }

  cleanup(): void {
    if (!this.tempDir) return;
    fs.rmSync(this.tempDir, { recursive: true, force: true });
    this.tempDir = null;
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return {
      next: (): Promise<IteratorResult<SDKUserMessage>> => {
        const item = this.items.shift();
        if (item) return Promise.resolve({ value: item, done: false });
        if (this.closed) return Promise.resolve({ value: undefined as never, done: true });
        return new Promise((resolve) => this.waiters.push(resolve));
      },
    };
  }
}

export interface ClaudeRun extends DriverRun {
  vendor: "claude";
  input: ClaudeInputQueue;
  done: boolean;
  interrupt: (() => Promise<unknown>) | null;
  awaitingQuestionToolUseId: string | null;
  stallTimer: ReturnType<typeof setTimeout> | null;
}

const STALL_TIMEOUT_MS = 10 * 60 * 1000;

function isTurnEvent(event: UiEvent): boolean {
  return (
    event.kind === "assistant_text" ||
    event.kind === "tool_use" ||
    event.kind === "tool_result" ||
    event.kind === "result" ||
    event.kind === "error"
  );
}

/** Claude Agent SDK adapter: one long-lived SDK stream per live session. */
export class ClaudeSdkDriver implements ChatDriver {
  readonly vendor = "claude";
  readonly classifyError = classifyClaudeError;
  private readonly runtime = new DriverRuntime<ClaudeRun>({
    isActive: (run) => run.turnActive && !run.done,
    shouldReplay: (run) => run.turnActive || !!run.awaitingQuestionToolUseId,
  });
  private readonly idle: IdleSessionTimers;

  constructor(
    private readonly queryFn: QueryFn,
    private readonly stallTimeoutMs: number = STALL_TIMEOUT_MS,
    idleTtlMs = SESSION_IDLE_TTL_MS,
  ) {
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

  get(sessionId: string): ClaudeRun | undefined {
    const run = this.runtime.get(sessionId);
    return run?.done ? undefined : run;
  }

  activeSessions(): string[] {
    return this.runtime.activeSessions();
  }

  activeSessionStates(): ActiveSessionState[] {
    return this.runtime.activeSessionStates();
  }

  shutdown(): void {
    this.idle.clear();
    this.runtime.clearPending();
    for (const run of new Set(this.runtime.values())) {
      run.input.close();
      if (run.turnActive && run.interrupt) void run.interrupt().catch(() => {});
    }
  }

  start(opts: StartOpts): Promise<string> {
    if (opts.resume && !opts.forkSession) this.idle.cancel(opts.resume);
    if (opts.resume && !opts.forkSession) {
      const previous = this.runtime.get(opts.resume);
      if (previous && !previous.turnActive && !previous.done) {
        previous.done = true;
        previous.input.close();
        previous.emitter.emit("done");
      }
    }

    const hasFirstTurn = opts.firstText !== undefined || !!opts.firstAttachments?.length;
    const run: ClaudeRun = {
      sessionId: opts.resume && !opts.forkSession ? opts.resume : null,
      clientSessionId: opts.clientSessionId,
      cwd: opts.cwd,
      vendor: "claude",
      input: new ClaudeInputQueue(),
      events: [],
      emitter: new EventEmitter(),
      done: false,
      turnActive: hasFirstTurn,
      turnStartedAt: hasFirstTurn ? Date.now() : 0,
      interrupt: null,
      awaitingQuestionToolUseId: null,
      stallTimer: null,
    };
    if (run.sessionId) this.runtime.index(run.sessionId, run);
    this.scheduleStall(run);

    const mode = (opts.permissionMode ?? "bypassPermissions") as PermissionMode;
    const options: Options = {
      cwd: opts.cwd,
      permissionMode: mode,
      ...(opts.model ? { model: opts.model } : {}),
      ...(opts.effort ? { effort: opts.effort as Options["effort"] } : {}),
      ...(opts.speed
        ? { settings: { fastMode: opts.speed === "fast" } as NonNullable<Options["settings"]> }
        : {}),
      ...(mode === "bypassPermissions" ? { allowDangerouslySkipPermissions: true } : {}),
      ...(opts.resume ? { resume: opts.resume } : {}),
      ...(opts.forkSession ? { forkSession: true } : {}),
    };

    return new Promise<string>((resolve, reject) => {
      let resolved = false;
      const settle = (sessionId: string) => {
        if (resolved) return;
        resolved = true;
        resolve(sessionId);
      };
      const emit = (event: UiEvent) => {
        if (!this.emit(run, event)) return;
        if (event.kind === "session" && event.sessionId) settle(event.sessionId);
      };

      void (async () => {
        try {
          const stream = this.queryFn({ prompt: run.input, options });
          run.interrupt =
            typeof stream.interrupt === "function" ? stream.interrupt.bind(stream) : null;
          if (hasFirstTurn) {
            run.input.pushTurn({
              text: opts.firstText ?? "",
              attachments: opts.firstAttachments,
            });
          }
          for await (const message of stream) {
            const events = toUiEventsFromClaude(message);
            const knownFailure = events.reduce<ReturnType<typeof classifyClaudeError>>(
              (known, event) =>
                known ?? (event.kind === "error" ? this.classifyError(event.message) : null),
              null,
            );
            for (const event of events) {
              if (event.kind === "assistant_text" && knownFailure?.code.endsWith("_auth_required"))
                continue;
              if (event.kind === "error") {
                Object.assign(event, providerErrorPayload(this.classifyError, event.message));
              }
              emit(event);
            }
          }
        } catch (error) {
          const failure = providerErrorPayload(this.classifyError, error);
          emit({ kind: "error", ...failure });
          if (!resolved) reject(new Error(failure.message, { cause: error }));
        } finally {
          run.input.cleanup();
          run.done = true;
          run.turnActive = false;
          this.scheduleStall(run);
          run.emitter.emit("done");
          if (run.sessionId) {
            if (this.runtime.get(run.sessionId) === run) this.idle.cancel(run.sessionId);
            settle(run.sessionId);
            this.runtime.pruneInactive();
          } else if (!resolved) {
            reject(new Error("Claude stream ended before producing a session id"));
          }
        }
      })();
    });
  }

  send(sessionId: string, turn: UserTurn): boolean {
    const run = this.runtime.get(sessionId);
    if (!run || run.done || run.turnActive || run.awaitingQuestionToolUseId) return false;
    this.idle.cancel(sessionId);
    run.events = [];
    run.turnActive = true;
    run.turnStartedAt = Date.now();
    run.input.pushTurn(turn);
    this.scheduleStall(run);
    return true;
  }

  canSteer(sessionId: string): boolean {
    const run = this.runtime.get(sessionId);
    return !!run && !run.done && run.turnActive && !run.awaitingQuestionToolUseId;
  }

  steer(sessionId: string, turn: UserTurn): Promise<boolean> {
    const run = this.runtime.get(sessionId);
    if (!run || !this.canSteer(sessionId)) return Promise.resolve(false);
    this.idle.cancel(sessionId);
    run.input.pushTurn(turn);
    this.scheduleStall(run);
    return Promise.resolve(true);
  }

  answer(sessionId: string, answer: ToolAnswer): boolean {
    const run = this.runtime.get(sessionId);
    if (!run || run.done) return false;
    this.idle.cancel(sessionId);
    run.awaitingQuestionToolUseId = null;
    run.events = [];
    run.turnActive = true;
    run.turnStartedAt = Date.now();
    run.input.pushToolResult(answer.toolUseId, answer.text, answer.toolUseResult);
    this.scheduleStall(run);
    return true;
  }

  async interrupt(sessionId: string): Promise<boolean> {
    const run = this.runtime.get(sessionId);
    if (!run || run.done || !run.turnActive || !run.interrupt) return false;
    try {
      await withTimeout(run.interrupt(), 5_000, "Claude interrupt timed out");
    } catch {
      return false;
    }
    this.emit(run, { kind: "result", ok: false, text: "interrupted" });
    return true;
  }

  subscribe(sessionId: string, listener: (event: UiEvent) => void): () => void {
    return this.runtime.subscribe(sessionId, listener);
  }

  private emit(run: ClaudeRun, event: UiEvent): boolean {
    if (run.awaitingQuestionToolUseId) {
      if (event.kind === "tool_result" && event.id === run.awaitingQuestionToolUseId) {
        if (event.isError) return false;
        run.awaitingQuestionToolUseId = null;
      } else if (event.kind === "assistant_text" || event.kind === "result") {
        return false;
      }
    }
    if (!run.turnActive && isTurnEvent(event)) return false;
    if (event.kind === "tool_use" && event.name === "AskUserQuestion") {
      run.turnActive = false;
      run.turnStartedAt = 0;
      run.awaitingQuestionToolUseId = event.id;
    }
    this.runtime.publish(run, event);
    if (event.kind === "session" || event.kind === "result" || event.kind === "error") {
      this.scheduleIdle(run);
    }
    this.scheduleStall(run);
    return true;
  }

  private scheduleIdle(run: ClaudeRun): void {
    const sessionId = run.sessionId;
    if (!sessionId || run.done || run.turnActive || run.awaitingQuestionToolUseId) return;
    this.idle.arm(sessionId, () => this.releaseIdle(run));
  }

  private releaseIdle(run: ClaudeRun): void {
    const sessionId = run.sessionId;
    if (!sessionId || run.done || run.turnActive || run.awaitingQuestionToolUseId) return;
    if (!this.runtime.release(sessionId, run)) return;
    run.done = true;
    run.input.close();
  }

  private scheduleStall(run: ClaudeRun): void {
    if (run.stallTimer) {
      clearTimeout(run.stallTimer);
      run.stallTimer = null;
    }
    if (run.done || !run.turnActive || this.stallTimeoutMs <= 0) return;
    const timer = setTimeout(() => void this.onStall(run), this.stallTimeoutMs);
    (timer as unknown as { unref?: () => void }).unref?.();
    run.stallTimer = timer;
  }

  private async onStall(run: ClaudeRun): Promise<void> {
    run.stallTimer = null;
    if (run.done || !run.turnActive) return;
    if (!run.interrupt) return;
    try {
      await withTimeout(run.interrupt(), 5_000, "Claude interrupt timed out");
      this.emit(run, { kind: "result", ok: false, text: "stalled" });
    } catch {
      this.scheduleStall(run);
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Compatibility name while downstream imports migrate to explicit adapters. */
export { ClaudeSdkDriver as ChatEngine };
export type { StartOpts } from "../driver.js";
