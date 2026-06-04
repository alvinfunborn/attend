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
  cwd: string;
  model?: string;
  effort?: StartOpts["effort"];
  events: UiEvent[];
  emitter: EventEmitter;
  turnActive: boolean;
  turnStartedAt: number;
  child: CodexExecHandle | null;
  /** resolve/reject the start() promise once the first turn yields (or fails) */
  settle: ((id: string) => void) | null;
  fail: ((err: Error) => void) | null;
}

function shouldReplayBufferedEvents(run: CodexRun): boolean {
  return run.turnActive;
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

  constructor(
    private readonly execFn: CodexExecFn,
    private readonly sandbox: CodexSandbox = "danger-full-access",
    private readonly forkFn: CodexForkFn = () => null,
  ) {}

  onTurnEnd(cb: (sessionId: string) => void): () => void {
    this.turnEndListeners.add(cb);
    return () => this.turnEndListeners.delete(cb);
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
      if (run.turnActive) states.push({ sessionId: id, startedAt: run.turnStartedAt });
    }
    return states;
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
      const forked = this.forkFn(opts.resume);
      if (forked) resumeId = forked;
      else forkFailed = true;
    }
    const run: CodexRun = {
      sessionId: forkFailed ? null : (resumeId ?? null),
      cwd: opts.cwd,
      model: opts.model,
      effort: opts.effort,
      events: [],
      emitter: new EventEmitter(),
      turnActive: false,
      turnStartedAt: 0,
      child: null,
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

  answer(_sessionId: string, _answer: ToolAnswer): boolean {
    return false;
  }

  async interrupt(sessionId: string): Promise<boolean> {
    const run = this.runs.get(sessionId);
    if (!run || !run.child) return false;
    try {
      run.child.kill();
      return true;
    } catch {
      return false;
    }
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
    run.turnActive = true;
    run.turnStartedAt = Date.now();
    const handle = this.execFn({
      cwd: run.cwd,
      prompt: text,
      attachments,
      resume: run.sessionId ?? undefined,
      model: run.model,
      effort: run.effort === "max" ? "xhigh" : run.effort,
      sandbox: this.sandbox,
    });
    run.child = handle;

    void (async () => {
      let terminal = false;
      try {
        for await (const cev of handle.events) {
          for (const ev of toUiEventsFromCodex(cev)) {
            if (ev.kind === "result" || ev.kind === "error") terminal = true;
            this.emit(run, ev);
          }
        }
      } catch (err) {
        this.emit(run, {
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
        terminal = true;
      } finally {
        // process exited without a turn.completed/turn.failed → synthesize one so
        // the UI's 生成中… state always tears down.
        if (!terminal) this.emit(run, { kind: "result", ok: false, text: "codex exited" });
        run.turnActive = false;
        run.child = null;
        // a brand-new session that never emitted thread.started: surface the failure
        if (!run.sessionId && run.fail) run.fail(new Error("codex produced no session"));
      }
    })();
  }

  private emit(run: CodexRun, ev: UiEvent): void {
    run.events.push(ev);
    if (run.events.length > MAX_BUFFER) run.events.shift();
    if (ev.kind === "session" && ev.sessionId) {
      run.sessionId = ev.sessionId;
      this.index(ev.sessionId, run);
      run.settle?.(ev.sessionId);
    }
    if (ev.kind === "result" || ev.kind === "error") {
      const sid = run.sessionId;
      if (sid) for (const cb of this.turnEndListeners) cb(sid);
    }
    run.emitter.emit("event", ev);
  }
}
