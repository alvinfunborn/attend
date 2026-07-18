import { EventEmitter } from "node:events";
import type { CodexEvent } from "../codex/events.js";
import { toUiEventsFromCodex } from "../codex/events.js";
import type { ActiveSessionState, ChatDriver, StartOpts, ToolAnswer, UserTurn } from "../driver.js";
import type { UiEvent } from "../events.js";
import { type ProviderErrorClassifier, providerErrorPayload } from "../provider-errors.js";
import { type DriverRun, DriverRuntime } from "../runtime.js";
import type { ProcessForkFn, ProcessSandbox, ProcessTurnFn, ProcessTurnHandle } from "./types.js";

interface ProcessRun extends DriverRun {
  model?: string;
  effort?: StartOpts["effort"];
  speed?: StartOpts["speed"];
  child: ProcessTurnHandle<CodexEvent> | null;
  awaitingInputToolUseId: string | null;
  stoppingForInput: boolean;
  queuedAnswer: ToolAnswer | null;
  settle: ((sessionId: string) => void) | null;
  fail: ((error: Error) => void) | null;
}

function isInputTool(name: string, input: unknown): boolean {
  const base = name.split(".").pop();
  return (
    base === "request_user_input" &&
    !!input &&
    typeof input === "object" &&
    Array.isArray((input as { questions?: unknown }).questions)
  );
}

function isTurnEvent(event: UiEvent): boolean {
  return (
    event.kind === "assistant_text" ||
    event.kind === "tool_use" ||
    event.kind === "tool_result" ||
    event.kind === "result" ||
    event.kind === "error"
  );
}

/**
 * Adapter for providers whose headless interface runs one JSONL process per turn.
 * Codex exec is the compatibility implementation; Cursor maps its stream into the
 * same process event protocol. Rich persistent transports should implement
 * ChatDriver directly instead of accumulating conditionals here.
 */
export class ProcessChatDriver implements ChatDriver {
  readonly vendor: string;
  private readonly runtime = new DriverRuntime<ProcessRun>({
    shouldReplay: (run) => run.turnActive || !!run.awaitingInputToolUseId,
  });

  constructor(
    private readonly execFn: ProcessTurnFn<CodexEvent>,
    private readonly sandbox: ProcessSandbox = "danger-full-access",
    private readonly forkFn: ProcessForkFn = () => null,
    vendor = "codex",
    readonly classifyError?: ProviderErrorClassifier,
  ) {
    this.vendor = vendor;
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

  shutdown(): void {
    this.runtime.clearPending();
    for (const run of this.runtime.values()) {
      try {
        run.child?.kill();
      } catch {
        // Best effort during process shutdown.
      }
      run.child = null;
    }
  }

  start(opts: StartOpts): Promise<string> {
    let resumeId = opts.resume;
    let forkFailed = false;
    if (opts.forkSession && opts.resume) {
      const forked = this.forkFn(opts.resume, opts.firstText);
      if (forked) resumeId = forked;
      else forkFailed = true;
    }
    const run: ProcessRun = {
      sessionId: forkFailed ? null : (resumeId ?? null),
      clientSessionId: opts.clientSessionId,
      cwd: opts.cwd,
      model: opts.model,
      effort: opts.effort,
      speed: opts.speed,
      events: [],
      emitter: new EventEmitter(),
      turnActive: false,
      turnStartedAt: 0,
      child: null,
      awaitingInputToolUseId: null,
      stoppingForInput: false,
      queuedAnswer: null,
      settle: null,
      fail: null,
    };
    if (run.sessionId) this.runtime.index(run.sessionId, run);

    return new Promise<string>((resolve, reject) => {
      let resolved = false;
      run.settle = (sessionId) => {
        if (resolved) return;
        resolved = true;
        resolve(sessionId);
      };
      run.fail = (error) => {
        if (resolved) return;
        resolved = true;
        reject(error);
      };
      if (forkFailed) {
        run.fail(new Error(`parent ${this.vendor} session not found`));
        return;
      }
      if (opts.firstText !== undefined || opts.firstAttachments?.length) {
        this.runTurn(run, opts.firstText ?? "", opts.firstAttachments);
      }
      if (run.sessionId) run.settle(run.sessionId);
      else if (opts.firstText === undefined && !opts.firstAttachments?.length) {
        run.fail(new Error(`${this.vendor} sessions need a first message`));
      }
    });
  }

  send(sessionId: string, turn: UserTurn): boolean {
    const run = this.runtime.get(sessionId);
    if (!run || run.turnActive || run.awaitingInputToolUseId) return false;
    this.runTurn(run, turn.text, turn.attachments);
    return true;
  }

  answer(sessionId: string, answer: ToolAnswer): boolean {
    const run = this.runtime.get(sessionId);
    if (!run || !run.awaitingInputToolUseId) return false;
    if (answer.toolUseId !== run.awaitingInputToolUseId) return false;
    run.awaitingInputToolUseId = null;
    run.queuedAnswer = answer;
    if (run.child) {
      run.stoppingForInput = true;
      try {
        run.child.kill();
      } catch {
        return false;
      }
    } else {
      const queued = run.queuedAnswer;
      run.queuedAnswer = null;
      this.runTurn(run, queued.text);
    }
    return true;
  }

  async interrupt(sessionId: string): Promise<boolean> {
    const run = this.runtime.get(sessionId);
    if (!run || !run.child || !run.turnActive) return false;
    const child = run.child;
    try {
      child.kill();
    } catch {
      return false;
    }
    if (run.child === child) run.child = null;
    this.emit(run, { kind: "result", ok: false, text: "interrupted" });
    return true;
  }

  subscribe(sessionId: string, listener: (event: UiEvent) => void): () => void {
    return this.runtime.subscribe(sessionId, listener);
  }

  private runTurn(run: ProcessRun, text: string, attachments: UserTurn["attachments"] = []): void {
    run.events = [];
    run.turnActive = true;
    run.turnStartedAt = Date.now();
    const handle = this.execFn({
      cwd: run.cwd,
      prompt: text,
      attachments,
      resume: run.sessionId ?? undefined,
      model: run.model,
      effort: run.effort,
      speed: run.speed,
      sandbox: this.sandbox,
    });
    run.child = handle;

    void (async () => {
      let terminal = false;
      try {
        for await (const providerEvent of handle.events) {
          if (run.child !== handle) break;
          for (const event of toUiEventsFromCodex(providerEvent)) {
            if (event.kind === "error") {
              Object.assign(event, providerErrorPayload(this.classifyError, event.message));
            }
            if (this.emit(run, event) && (event.kind === "result" || event.kind === "error")) {
              terminal = true;
            }
          }
        }
      } catch (error) {
        if (run.child === handle) {
          this.emit(run, {
            kind: "error",
            ...providerErrorPayload(this.classifyError, error),
          });
          terminal = true;
        }
      } finally {
        if (
          run.child === handle &&
          !terminal &&
          !run.stoppingForInput &&
          !run.awaitingInputToolUseId &&
          !run.queuedAnswer
        ) {
          this.emit(run, { kind: "result", ok: false, text: `${this.vendor} exited` });
        }
        if (run.child === handle) {
          run.turnActive = false;
          run.turnStartedAt = 0;
          run.child = null;
          run.stoppingForInput = false;
        }
        if (run.queuedAnswer) {
          const queued = run.queuedAnswer;
          run.queuedAnswer = null;
          this.runTurn(run, queued.text);
        }
        if (!run.sessionId && run.fail) {
          run.fail(new Error(`${this.vendor} produced no session`));
        }
      }
    })();
  }

  private emit(run: ProcessRun, event: UiEvent): boolean {
    if (run.awaitingInputToolUseId) {
      if (
        event.kind === "assistant_text" ||
        event.kind === "result" ||
        event.kind === "error" ||
        (event.kind === "tool_result" && event.id === run.awaitingInputToolUseId)
      ) {
        return false;
      }
    }
    if (!run.turnActive && isTurnEvent(event)) return false;
    if (event.kind === "tool_use" && isInputTool(event.name, event.input)) {
      run.awaitingInputToolUseId = event.id;
      run.turnActive = false;
      run.turnStartedAt = 0;
      run.stoppingForInput = true;
      try {
        run.child?.kill();
      } catch {
        // Keep the question visible even if the process cannot be stopped.
      }
    }
    this.runtime.publish(run, event);
    if (event.kind === "session" && event.sessionId) run.settle?.(event.sessionId);
    return true;
  }
}

/** Compatibility name for the original Codex-specific process adapter. */
export { ProcessChatDriver as CodexEngine };
