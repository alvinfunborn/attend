import { EventEmitter } from "node:events";
import {
  type Options,
  type PermissionMode,
  type SDKUserMessage,
  query,
} from "@anthropic-ai/claude-agent-sdk";
import { type UiEvent, toUiEvents } from "./events.js";

/** A pushable async queue of user messages — the streaming-input prompt for query(). */
class InputQueue implements AsyncIterable<SDKUserMessage> {
  private items: SDKUserMessage[] = [];
  private waiters: Array<(r: IteratorResult<SDKUserMessage>) => void> = [];
  private closed = false;

  push(text: string): void {
    const msg: SDKUserMessage = {
      type: "user",
      message: { role: "user", content: text },
      parent_tool_use_id: null,
    };
    const w = this.waiters.shift();
    if (w) w({ value: msg, done: false });
    else this.items.push(msg);
  }

  close(): void {
    this.closed = true;
    const w = this.waiters.shift();
    if (w) w({ value: undefined as unknown as SDKUserMessage, done: true });
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

export interface LiveRun {
  /** known once the SDK emits its init message */
  sessionId: string | null;
  cwd: string;
  vendor: "claude";
  input: InputQueue;
  events: UiEvent[];
  emitter: EventEmitter;
  done: boolean;
}

export interface StartOpts {
  cwd: string;
  resume?: string;
  forkSession?: boolean;
  firstText?: string;
  permissionMode?: PermissionMode;
}

/** Injectable so tests can drive the engine without the real SDK / network. */
export type QueryFn = typeof query;

const MAX_BUFFER = 2000;

/**
 * Runs and tracks live Claude sessions via the Agent SDK. Each run streams SDK
 * messages, normalizes them to UiEvents, buffers them (so a (re)connecting SSE
 * client catches up), and re-emits for live subscribers. No terminal involved.
 */
export class ChatEngine {
  private runs = new Map<string, LiveRun>();

  constructor(private readonly queryFn: QueryFn = query) {}

  get(sessionId: string): LiveRun | undefined {
    return this.runs.get(sessionId);
  }

  /**
   * Start (or resume/fork) a run. Resolves with the session id once the SDK
   * reports it (from the init message). For resume, the id is known up front.
   */
  start(opts: StartOpts): Promise<string> {
    const run: LiveRun = {
      sessionId: opts.resume && !opts.forkSession ? opts.resume : null,
      cwd: opts.cwd,
      vendor: "claude",
      input: new InputQueue(),
      events: [],
      emitter: new EventEmitter(),
      done: false,
    };
    // index immediately under resume id so /chat/send can find it before init
    if (run.sessionId) this.runs.set(run.sessionId, run);

    const options: Options = {
      cwd: opts.cwd,
      permissionMode: opts.permissionMode ?? "acceptEdits",
      ...(opts.resume ? { resume: opts.resume } : {}),
      ...(opts.forkSession ? { forkSession: true } : {}),
    };

    return new Promise<string>((resolve, reject) => {
      let resolved = false;
      const settle = (id: string) => {
        if (resolved) return;
        resolved = true;
        resolve(id);
      };

      const emit = (ev: UiEvent) => {
        run.events.push(ev);
        if (run.events.length > MAX_BUFFER) run.events.shift();
        if (ev.kind === "session" && ev.sessionId) {
          run.sessionId = ev.sessionId;
          this.runs.set(ev.sessionId, run);
          settle(ev.sessionId);
        }
        run.emitter.emit("event", ev);
      };

      (async () => {
        try {
          const stream = this.queryFn({ prompt: run.input, options });
          if (opts.firstText !== undefined) run.input.push(opts.firstText);
          for await (const msg of stream) {
            for (const ev of toUiEvents(msg)) emit(ev);
          }
        } catch (err) {
          emit({ kind: "error", message: err instanceof Error ? err.message : String(err) });
          if (!resolved) reject(err instanceof Error ? err : new Error(String(err)));
        } finally {
          run.done = true;
          run.emitter.emit("done");
          // a resume with a known id resolves even if no init arrived
          if (run.sessionId) settle(run.sessionId);
        }
      })();
    });
  }

  /** Send a user turn to a live run. Returns false if the session isn't live. */
  send(sessionId: string, text: string): boolean {
    const run = this.runs.get(sessionId);
    if (!run || run.done) return false;
    run.input.push(text);
    return true;
  }

  /** Subscribe to a run: replays the buffered events, then streams new ones. */
  subscribe(sessionId: string, onEvent: (ev: UiEvent) => void): () => void {
    const run = this.runs.get(sessionId);
    if (!run) return () => {};
    for (const ev of run.events) onEvent(ev);
    run.emitter.on("event", onEvent);
    return () => run.emitter.off("event", onEvent);
  }
}
