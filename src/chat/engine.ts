import { EventEmitter } from "node:events";
import {
  type Options,
  type PermissionMode,
  type SDKUserMessage,
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
} from "./driver.js";
import { type UiEvent, toUiEvents } from "./events.js";

/** A pushable async queue of user messages — the streaming-input prompt for query(). */
class InputQueue implements AsyncIterable<SDKUserMessage> {
  private items: SDKUserMessage[] = [];
  private waiters: Array<(r: IteratorResult<SDKUserMessage>) => void> = [];
  private closed = false;

  private push(msg: SDKUserMessage): void {
    const w = this.waiters.shift();
    if (w) w({ value: msg, done: false });
    else this.items.push(msg);
  }

  private attachmentBlock(att: ChatAttachment): ContentBlockParam {
    if (att.kind === "image") {
      return {
        type: "image",
        source: { type: "base64", media_type: att.mediaType, data: att.data },
      };
    }
    if (att.kind === "document") {
      return {
        type: "document",
        title: att.name,
        source: { type: "base64", media_type: att.mediaType, data: att.data },
      };
    }
    return {
      type: "document",
      title: att.name,
      source: { type: "text", media_type: "text/plain", data: att.text },
    };
  }

  pushTurn(turn: UserTurn): void {
    const text = turn.text ?? "";
    const attachments = turn.attachments ?? [];
    const textBlock: TextBlockParam | null = text ? { type: "text", text } : null;
    const content: MessageParam["content"] = attachments.length
      ? [...(textBlock ? [textBlock] : []), ...attachments.map((att) => this.attachmentBlock(att))]
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
  /** a turn is in flight (a user message was sent, no result/error yet) — used
   *  to restore the "生成中…" state on a reconnecting page. */
  turnActive: boolean;
  /** epoch ms the current turn began (0 when idle). Sent in `sync` so a
   *  reconnecting page resumes the elapsed timer instead of restarting it. */
  turnStartedAt: number;
  /** interrupt the in-flight SDK turn (the Stop button). Bound to the query
   *  stream once it exists; null if the underlying query offers no interrupt
   *  (e.g. the test fake), so callers must null-check. */
  interrupt: (() => Promise<void>) | null;
}

export type { StartOpts } from "./driver.js";

/** Injectable so tests can drive the engine without the real SDK / network. */
export type QueryFn = typeof query;

const MAX_BUFFER = 2000;

function shouldReplayBufferedEvents(run: LiveRun): boolean {
  return run.turnActive;
}

/**
 * Runs and tracks live Claude sessions via the Agent SDK. Each run streams SDK
 * messages, normalizes them to UiEvents, buffers them (so a (re)connecting SSE
 * client catches up), and re-emits for live subscribers. No terminal involved.
 */
export class ChatEngine implements ChatDriver {
  readonly vendor = "claude";
  private runs = new Map<string, LiveRun>();
  /** subscribers parked on a session id whose run isn't live yet (e.g. after a
   *  server restart: the SSE reconnects before /chat/send resumes the run). */
  private pending = new Map<string, Set<(ev: UiEvent) => void>>();
  /** fired when a turn ends (result/error) — the daemon analyzer hooks this. */
  private turnEndListeners = new Set<(sessionId: string) => void>();

  constructor(private readonly queryFn: QueryFn = query) {}

  /** Notify on each turn completion (used to trigger per-session daemon analysis). */
  onTurnEnd(cb: (sessionId: string) => void): () => void {
    this.turnEndListeners.add(cb);
    return () => this.turnEndListeners.delete(cb);
  }

  get(sessionId: string): LiveRun | undefined {
    return this.runs.get(sessionId);
  }

  /** Session ids with a turn currently in flight — drives the sidebar's per-tab
   *  "generating" status, including background sessions the page isn't streaming. */
  activeSessions(): string[] {
    const ids: string[] = [];
    for (const [id, run] of this.runs) if (run.turnActive && !run.done) ids.push(id);
    return ids;
  }

  activeSessionStates(): ActiveSessionState[] {
    const states: ActiveSessionState[] = [];
    for (const [id, run] of this.runs) {
      if (run.turnActive && !run.done) states.push({ sessionId: id, startedAt: run.turnStartedAt });
    }
    return states;
  }

  /** Index a run under an id, flushing any subscribers parked on it (replay the
   *  buffer, then attach for live events) so a stream opened before the run
   *  existed re-binds automatically instead of staying silent. */
  private index(id: string, run: LiveRun): void {
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
   * Start (or resume/fork) a run. Resolves with the session id once the SDK
   * reports it (from the init message). For resume, the id is known up front.
   */
  start(opts: StartOpts): Promise<string> {
    const hasFirstTurn = opts.firstText !== undefined || !!opts.firstAttachments?.length;
    const run: LiveRun = {
      sessionId: opts.resume && !opts.forkSession ? opts.resume : null,
      cwd: opts.cwd,
      vendor: "claude",
      input: new InputQueue(),
      events: [],
      emitter: new EventEmitter(),
      done: false,
      turnActive: hasFirstTurn,
      turnStartedAt: hasFirstTurn ? Date.now() : 0,
      interrupt: null,
    };
    // index immediately under resume id so /chat/send can find it before init
    if (run.sessionId) this.index(run.sessionId, run);

    // Default to full CLI-parity execution: the console is a local, single-user
    // surface and the user wants the same power as running `claude` directly.
    // `acceptEdits` (the old default) auto-denied Bash/etc., so Claude reported
    // it was "sandboxed" and could not run anything.
    const mode: PermissionMode = opts.permissionMode ?? "bypassPermissions";
    const options: Options = {
      cwd: opts.cwd,
      permissionMode: mode,
      ...(opts.model ? { model: opts.model } : {}),
      ...(opts.effort ? { effort: opts.effort } : {}),
      ...(mode === "bypassPermissions" ? { allowDangerouslySkipPermissions: true } : {}),
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
        if (ev.kind === "result" || ev.kind === "error") {
          run.turnActive = false;
          const sid = run.sessionId;
          if (sid) for (const cb of this.turnEndListeners) cb(sid);
        }
        if (ev.kind === "tool_use" && ev.name === "AskUserQuestion") {
          run.turnActive = false;
        }
        if (ev.kind === "session" && ev.sessionId) {
          run.sessionId = ev.sessionId;
          this.index(ev.sessionId, run);
          settle(ev.sessionId);
        }
        run.emitter.emit("event", ev);
      };

      (async () => {
        try {
          const stream = this.queryFn({ prompt: run.input, options });
          // Expose the SDK's interrupt() (streaming mode only) so /chat/abort can
          // stop a turn. The test fake is a bare async generator with no such
          // method, hence the runtime guard.
          run.interrupt =
            typeof stream.interrupt === "function" ? stream.interrupt.bind(stream) : null;
          if (hasFirstTurn) {
            run.input.pushTurn({
              text: opts.firstText ?? "",
              attachments: opts.firstAttachments,
            });
          }
          for await (const msg of stream) {
            for (const ev of toUiEvents(msg)) emit(ev);
          }
        } catch (err) {
          emit({ kind: "error", message: err instanceof Error ? err.message : String(err) });
          if (!resolved) reject(err instanceof Error ? err : new Error(String(err)));
        } finally {
          run.done = true;
          run.turnActive = false;
          run.emitter.emit("done");
          // a resume with a known id resolves even if no init arrived
          if (run.sessionId) settle(run.sessionId);
        }
      })();
    });
  }

  /** Send a user turn to a live run. Returns false if the session isn't live. */
  send(sessionId: string, turn: UserTurn): boolean {
    const run = this.runs.get(sessionId);
    if (!run || run.done) return false;
    run.turnActive = true;
    run.turnStartedAt = Date.now();
    run.input.pushTurn(turn);
    return true;
  }

  answer(sessionId: string, answer: ToolAnswer): boolean {
    const run = this.runs.get(sessionId);
    if (!run || run.done) return false;
    run.turnActive = true;
    run.turnStartedAt = Date.now();
    run.input.pushToolResult(answer.toolUseId, answer.text, answer.toolUseResult);
    return true;
  }

  /**
   * Interrupt the in-flight turn for a live run (the Stop button). Returns false
   * if the session isn't live or its query offers no interrupt. The SDK stops
   * and emits a result message, which clears turnActive via the normal event
   * path — so the UI's 生成中… state tears down the same way a finished turn does.
   */
  async interrupt(sessionId: string): Promise<boolean> {
    const run = this.runs.get(sessionId);
    if (!run || run.done || !run.interrupt) return false;
    try {
      await run.interrupt();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Subscribe to a run: replays the buffered events, then streams new ones. If
   * the run isn't live yet (typical right after a server restart — the SSE
   * reconnects before the next send resumes the run), park the subscriber; it
   * auto-attaches via index() the moment the run is (re)created, so the stream
   * is never permanently silent. The returned unsub cleans up from wherever the
   * subscriber currently lives (parked set or the run's emitter).
   */
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
}
