import type { EventEmitter } from "node:events";
import type { ActiveSessionState } from "./driver.js";
import type { UiEvent } from "./events.js";

/** Provider-owned run state required by Attend's shared live-session runtime. */
export interface DriverRun {
  sessionId: string | null;
  clientSessionId?: string;
  cwd: string;
  events: UiEvent[];
  emitter: EventEmitter;
  turnActive: boolean;
  turnStartedAt: number;
}

interface RuntimeOptions<Run extends DriverRun> {
  isActive?: (run: Run) => boolean;
  shouldReplay?: (run: Run) => boolean;
  maxBuffer?: number;
  maxBufferBytes?: number;
}

/**
 * Shared session registry and event hub for every chat adapter.
 *
 * Providers own transport and protocol state; this class owns the Attend-facing
 * invariants: stable session lookup, subscribers that may arrive before a run,
 * current-turn replay, active snapshots, terminal notifications, and the global
 * event bus. Keeping those rules here prevents each vendor from slowly acquiring
 * a different reconnect or attention-state implementation.
 */
export class DriverRuntime<Run extends DriverRun> {
  private readonly runs = new Map<string, Run>();
  private readonly pending = new Map<string, Set<(event: UiEvent) => void>>();
  private readonly turnEndListeners = new Set<(sessionId: string) => void>();
  private readonly eventListeners = new Set<
    (sessionId: string, event: UiEvent, clientSessionId?: string) => void
  >();
  private readonly isActiveRun: (run: Run) => boolean;
  private readonly shouldReplayRun: (run: Run) => boolean;
  private readonly maxBuffer: number;
  private readonly maxBufferBytes: number;
  private readonly bufferedBytes = new WeakMap<Run, number>();

  constructor(options: RuntimeOptions<Run> = {}) {
    this.isActiveRun = options.isActive ?? ((run) => run.turnActive);
    this.shouldReplayRun = options.shouldReplay ?? ((run) => run.turnActive);
    this.maxBuffer = options.maxBuffer ?? 2000;
    this.maxBufferBytes = options.maxBufferBytes ?? 2 * 1024 * 1024;
  }

  get(sessionId: string): Run | undefined {
    return this.runs.get(sessionId);
  }

  values(): IterableIterator<Run> {
    return this.runs.values();
  }

  delete(sessionId: string, expected?: Run): boolean {
    if (expected && this.runs.get(sessionId) !== expected) return false;
    return this.runs.delete(sessionId);
  }

  /**
   * Remove a live provider run while keeping its subscribers parked for a later
   * resume of the same durable session.
   */
  release(sessionId: string, expected?: Run): boolean {
    const run = this.runs.get(sessionId);
    if (!run || (expected && run !== expected)) return false;
    const listeners = run.emitter.listeners("event") as Array<(event: UiEvent) => void>;
    run.emitter.removeAllListeners("event");
    if (listeners.length) {
      let waiting = this.pending.get(sessionId);
      if (!waiting) {
        waiting = new Set();
        this.pending.set(sessionId, waiting);
      }
      for (const listener of listeners) waiting.add(listener);
    }
    return this.runs.delete(sessionId);
  }

  /** Bound completed-session metadata while retaining recent sync snapshots. */
  pruneInactive(maxInactive = 256): void {
    let inactive = 0;
    for (const run of this.runs.values()) if (!this.isActiveRun(run)) inactive++;
    if (inactive <= maxInactive) return;
    for (const [sessionId, run] of this.runs) {
      if (this.isActiveRun(run)) continue;
      this.runs.delete(sessionId);
      inactive--;
      if (inactive <= maxInactive) break;
    }
  }

  clearPending(): void {
    this.pending.clear();
  }

  onTurnEnd(listener: (sessionId: string) => void): () => void {
    this.turnEndListeners.add(listener);
    return () => this.turnEndListeners.delete(listener);
  }

  onEvent(
    listener: (sessionId: string, event: UiEvent, clientSessionId?: string) => void,
  ): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  activeSessions(): string[] {
    const ids: string[] = [];
    for (const [id, run] of this.runs) if (this.isActiveRun(run)) ids.push(id);
    return ids;
  }

  activeSessionStates(): ActiveSessionState[] {
    const states: ActiveSessionState[] = [];
    for (const [id, run] of this.runs) {
      if (!this.isActiveRun(run)) continue;
      states.push({
        sessionId: id,
        startedAt: run.turnStartedAt,
        clientSessionId: run.clientSessionId,
      });
    }
    return states;
  }

  /** Register a known provider id and attach subscribers that arrived first. */
  index(sessionId: string, run: Run): void {
    run.sessionId = sessionId;
    this.runs.set(sessionId, run);
    const waiting = this.pending.get(sessionId);
    if (!waiting) return;
    this.pending.delete(sessionId);
    for (const listener of waiting) {
      if (this.shouldReplayRun(run)) {
        for (const event of run.events) listener(event);
      }
      listener({ kind: "sync", turnActive: run.turnActive, startedAt: run.turnStartedAt });
      run.emitter.on("event", listener);
    }
  }

  finishTurn(run: Run): boolean {
    if (!run.turnActive) return false;
    run.turnActive = false;
    run.turnStartedAt = 0;
    if (run.sessionId) {
      for (const listener of this.turnEndListeners) listener(run.sessionId);
    }
    return true;
  }

  /** Publish an already-normalized event after the provider's filtering rules. */
  publish(run: Run, event: UiEvent): void {
    const eventBytes = Buffer.byteLength(JSON.stringify(event));
    if (eventBytes <= this.maxBufferBytes) {
      run.events.push(event);
      let bytes = (run.events.length === 1 ? 0 : (this.bufferedBytes.get(run) ?? 0)) + eventBytes;
      while (run.events.length > this.maxBuffer || bytes > this.maxBufferBytes) {
        const removed = run.events.shift();
        if (removed) bytes -= Buffer.byteLength(JSON.stringify(removed));
      }
      this.bufferedBytes.set(run, Math.max(0, bytes));
    }
    if (event.kind === "session" && event.sessionId) this.index(event.sessionId, run);
    if (event.kind === "result" || event.kind === "error") this.finishTurn(run);
    run.emitter.emit("event", event);
    if (run.sessionId) {
      for (const listener of this.eventListeners) {
        listener(run.sessionId, event, run.clientSessionId);
      }
    }
  }

  subscribe(sessionId: string, listener: (event: UiEvent) => void): () => void {
    const run = this.runs.get(sessionId);
    if (run) {
      if (this.shouldReplayRun(run)) {
        for (const event of run.events) listener(event);
      }
      listener({ kind: "sync", turnActive: run.turnActive, startedAt: run.turnStartedAt });
      run.emitter.on("event", listener);
    } else {
      let waiting = this.pending.get(sessionId);
      if (!waiting) {
        waiting = new Set();
        this.pending.set(sessionId, waiting);
      }
      waiting.add(listener);
    }
    return () => {
      const waiting = this.pending.get(sessionId);
      if (waiting) {
        waiting.delete(listener);
        if (waiting.size === 0) this.pending.delete(sessionId);
      }
      this.runs.get(sessionId)?.emitter.off("event", listener);
    };
  }
}
