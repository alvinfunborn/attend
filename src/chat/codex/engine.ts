import { EventEmitter } from "node:events";
import type { ActiveSessionState, ChatDriver, StartOpts, ToolAnswer, UserTurn } from "../driver.js";
import type { UiEvent } from "../events.js";
import { toUiEventsFromCodex } from "./events.js";
import type { CodexExecFn, CodexExecHandle, CodexForkFn, CodexSandbox } from "./exec.js";

const MAX_BUFFER = 2000;

/**
 * A Codex session as the engine tracks it. Unlike a Claude run (one long-lived
 * streaming process), a Codex session has **one process per turn** (`codex exec`
 * for the first, `codex exec resume <id>` after), so `child` is the in-flight
 * turn's handle and is null between turns. The session itself never "ends" — it
 * stays resumable — so there's no `done` flag; `turnActive` gates whether a new
 * turn can start.
 */
interface CodexRun {
  sessionId: string | null;
  clientSessionId?: string;
  cwd: string;
  model?: string;
  effort?: StartOpts["effort"];
  events: UiEvent[];
  emitter: EventEmitter;
  turnActive: boolean;
  turnStartedAt: number;
  child: CodexExecHandle | null;
  /** Codex request_user_input is not answerable through `codex exec`; when it
   * appears we stop the current exec turn and resume with the user's answer. */
  awaitingInputToolUseId: string | null;
  stoppingForInput: boolean;
  queuedAnswer: ToolAnswer | null;
  /** resolve/reject the start() promise once the first turn yields (or fails) */
  settle: ((id: string) => void) | null;
  fail: ((err: Error) => void) | null;
}

function shouldReplayBufferedEvents(run: CodexRun): boolean {
  return run.turnActive || !!run.awaitingInputToolUseId;
}

function isCodexInputTool(name: string, input: unknown): boolean {
  const base = name.split(".").pop();
  return (
    base === "request_user_input" &&
    !!input &&
    typeof input === "object" &&
    Array.isArray((input as { questions?: unknown }).questions)
  );
}

function isTurnEvent(ev: UiEvent): boolean {
  return (
    ev.kind === "assistant_text" ||
    ev.kind === "tool_use" ||
    ev.kind === "tool_result" ||
    ev.kind === "result" ||
    ev.kind === "error"
  );
}

/**
 * Drives Codex sessions via `codex exec --json`, exposing the same `ChatDriver`
 * surface as the Claude engine so the server treats both vendors uniformly. The
 * exec function is injectable so tests never spawn a process / hit the network.
 */
export class CodexEngine implements ChatDriver {
  readonly vendor = "codex";
  private runs = new Map<string, CodexRun>();
  private pending = new Map<string, Set<(ev: UiEvent) => void>>();
  private turnEndListeners = new Set<(sessionId: string) => void>();
  private eventListeners = new Set<
    (sessionId: string, event: UiEvent, clientSessionId?: string) => void
  >();

  constructor(
    private readonly execFn: CodexExecFn,
    private readonly sandbox: CodexSandbox = "danger-full-access",
    private readonly forkFn: CodexForkFn = () => null,
  ) {}

  onTurnEnd(cb: (sessionId: string) => void): () => void {
    this.turnEndListeners.add(cb);
    return () => this.turnEndListeners.delete(cb);
  }

  onEvent(cb: (sessionId: string, event: UiEvent, clientSessionId?: string) => void): () => void {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }

  get(sessionId: string): { cwd: string } | undefined {
    return this.runs.get(sessionId);
  }

  activeSessions(): string[] {
    const ids: string[] = [];
    for (const [id, run] of this.runs) if (run.turnActive) ids.push(id);
    return ids;
  }

  activeSessionStates(): ActiveSessionState[] {
    const states: ActiveSessionState[] = [];
    for (const [id, run] of this.runs) {
      if (run.turnActive)
        states.push({
          sessionId: id,
          startedAt: run.turnStartedAt,
          clientSessionId: run.clientSessionId,
        });
    }
    return states;
  }

  /** The running Codex child process is intentionally left alone. With the HTTP
   * service closed there are no new sends, and the current turn can finish. */
  shutdown(): void {
    this.pending.clear();
  }

  private index(id: string, run: CodexRun): void {
    this.runs.set(id, run);
    const waiting = this.pending.get(id);
    if (!waiting) return;
    this.pending.delete(id);
    for (const onEvent of waiting) {
      if (shouldReplayBufferedEvents(run)) {
        for (const ev of run.events) onEvent(ev);
      }
      onEvent({ kind: "sync", turnActive: run.turnActive, startedAt: run.turnStartedAt });
      run.emitter.on("event", onEvent);
    }
  }

  /**
   * Start a session. A resume (id known) resolves immediately and the turn — if a
   * first message was given — streams in the background; a brand-new session needs
   * a first message (Codex only mints a thread id once a turn runs) and resolves
   * when `thread.started` arrives.
   */
  start(opts: StartOpts): Promise<string> {
    // A fork branches the parent into a NEW thread (copy its rollout, then resume
    // the copy with the first message). The new id is known up front.
    let resumeId = opts.resume;
    let forkFailed = false;
    if (opts.forkSession && opts.resume) {
      const forked = this.forkFn(opts.resume, opts.firstText);
      if (forked) resumeId = forked;
      else forkFailed = true;
    }
    const run: CodexRun = {
      sessionId: forkFailed ? null : (resumeId ?? null),
      clientSessionId: opts.clientSessionId,
      cwd: opts.cwd,
      model: opts.model,
      effort: opts.effort,
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
    if (run.sessionId) this.index(run.sessionId, run);

    return new Promise<string>((resolve, reject) => {
      let resolved = false;
      run.settle = (id) => {
        if (!resolved) {
          resolved = true;
          resolve(id);
        }
      };
      run.fail = (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      };
      if (forkFailed) {
        run.fail(new Error("parent Codex session not found"));
        return;
      }
      if (opts.firstText !== undefined || opts.firstAttachments?.length) {
        this.runTurn(run, opts.firstText ?? "", opts.firstAttachments);
      }
      if (run.sessionId) run.settle(run.sessionId);
      else if (opts.firstText === undefined && !opts.firstAttachments?.length)
        run.fail(new Error("Codex sessions need a first message"));
    });
  }

  send(sessionId: string, turn: UserTurn): boolean {
    const run = this.runs.get(sessionId);
    if (!run || run.turnActive) return false;
    this.runTurn(run, turn.text, turn.attachments);
    return true;
  }

  answer(sessionId: string, answer: ToolAnswer): boolean {
    const run = this.runs.get(sessionId);
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
    const run = this.runs.get(sessionId);
    if (!run || !run.child || !run.turnActive) return false;
    const child = run.child;
    try {
      child.kill();
    } catch {
      // A failed process signal must not leave the browser stuck in Generating.
    }
    if (run.child === child) run.child = null;
    this.emit(run, { kind: "result", ok: false, text: "interrupted" });
    return true;
  }

  subscribe(sessionId: string, onEvent: (ev: UiEvent) => void): () => void {
    const run = this.runs.get(sessionId);
    if (run) {
      if (shouldReplayBufferedEvents(run)) {
        for (const ev of run.events) onEvent(ev);
      }
      onEvent({ kind: "sync", turnActive: run.turnActive, startedAt: run.turnStartedAt });
      run.emitter.on("event", onEvent);
    } else {
      let parked = this.pending.get(sessionId);
      if (!parked) {
        parked = new Set();
        this.pending.set(sessionId, parked);
      }
      parked.add(onEvent);
    }
    return () => {
      const parked = this.pending.get(sessionId);
      if (parked) {
        parked.delete(onEvent);
        if (parked.size === 0) this.pending.delete(sessionId);
      }
      this.runs.get(sessionId)?.emitter.off("event", onEvent);
    };
  }

  /** Run one turn as its own `codex exec` process, streaming its events. */
  private runTurn(run: CodexRun, text: string, attachments: UserTurn["attachments"] = []): void {
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
      sandbox: this.sandbox,
    });
    run.child = handle;

    void (async () => {
      let terminal = false;
      try {
        for await (const cev of handle.events) {
          if (run.child !== handle) break;
          for (const ev of toUiEventsFromCodex(cev)) {
            if (this.emit(run, ev) && (ev.kind === "result" || ev.kind === "error")) {
              terminal = true;
            }
          }
        }
      } catch (err) {
        if (run.child === handle) {
          this.emit(run, {
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
          terminal = true;
        }
      } finally {
        // process exited without a turn.completed/turn.failed → synthesize one so
        // the UI's 生成中… state always tears down. When we stopped specifically
        // for request_user_input, the question card is the terminal visible state.
        if (
          run.child === handle &&
          !terminal &&
          !run.stoppingForInput &&
          !run.awaitingInputToolUseId &&
          !run.queuedAnswer
        )
          this.emit(run, { kind: "result", ok: false, text: "codex exited" });
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
        // a brand-new session that never emitted thread.started: surface the failure
        if (!run.sessionId && run.fail) run.fail(new Error("codex produced no session"));
      }
    })();
  }

  private finishTurn(run: CodexRun): void {
    if (!run.turnActive) return;
    run.turnActive = false;
    run.turnStartedAt = 0;
    const sid = run.sessionId;
    if (sid) for (const cb of this.turnEndListeners) cb(sid);
  }

  private emit(run: CodexRun, ev: UiEvent): boolean {
    if (run.awaitingInputToolUseId) {
      if (
        ev.kind === "assistant_text" ||
        ev.kind === "result" ||
        ev.kind === "error" ||
        (ev.kind === "tool_result" && ev.id === run.awaitingInputToolUseId)
      ) {
        return false;
      }
    }

    // A stopped Codex exec can still flush buffered JSONL while the process is
    // winding down. Once Attend has ended the turn locally, ignore those late
    // chunks so they cannot revive the UI or collide with the next user turn.
    if (!run.turnActive && isTurnEvent(ev)) return false;

    run.events.push(ev);
    if (run.events.length > MAX_BUFFER) run.events.shift();
    if (ev.kind === "session" && ev.sessionId) {
      run.sessionId = ev.sessionId;
      this.index(ev.sessionId, run);
      run.settle?.(ev.sessionId);
    }
    if (ev.kind === "result" || ev.kind === "error") this.finishTurn(run);
    if (ev.kind === "tool_use" && isCodexInputTool(ev.name, ev.input)) {
      run.awaitingInputToolUseId = ev.id;
      run.turnActive = false;
      run.turnStartedAt = 0;
      run.stoppingForInput = true;
      try {
        run.child?.kill();
      } catch {
        // If kill fails, keep the question visible; the eventual process result is
        // suppressed while awaitingInputToolUseId is set.
      }
    }
    run.emitter.emit("event", ev);
    if (run.sessionId)
      for (const cb of this.eventListeners) cb(run.sessionId, ev, run.clientSessionId);
    return true;
  }
}
