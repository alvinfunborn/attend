import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
  private tempDir: string | null = null;
  private fileCount = 0;

  private push(msg: SDKUserMessage): void {
    const w = this.waiters.shift();
    if (w) w({ value: msg, done: false });
    else this.items.push(msg);
  }

  private attachmentBlock(att: Exclude<ChatAttachment, { kind: "file" }>): ContentBlockParam {
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

  private sanitizeAttachmentName(name: string): string {
    const base = path.basename(name).trim();
    return base.replace(/[^A-Za-z0-9._-]+/g, "-") || "attachment";
  }

  private appendFileAttachment(
    text: string,
    att: Extract<ChatAttachment, { kind: "file" }>,
  ): string {
    if (!this.tempDir) {
      this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-claude-"));
    }
    this.fileCount++;
    const file = path.join(
      this.tempDir,
      `${String(this.fileCount).padStart(2, "0")}-${this.sanitizeAttachmentName(att.name)}`,
    );
    fs.writeFileSync(file, Buffer.from(att.data, "base64"));
    const block = [
      `[Attached file: ${att.name}]`,
      `MIME type: ${att.mediaType}`,
      `Local path: ${file}`,
      "Read this file from the local path when you need its contents.",
    ].join("\n");
    return text ? `${text}\n\n${block}` : block;
  }

  pushTurn(turn: UserTurn): void {
    let text = turn.text ?? "";
    const originalAttachments = turn.attachments ?? [];
    const attachments: Array<Exclude<ChatAttachment, { kind: "file" }>> = [];
    for (const att of originalAttachments) {
      if (att.kind !== "file") {
        attachments.push(att);
        continue;
      }
      text = this.appendFileAttachment(text, att);
    }
    const textBlock: TextBlockParam | null = text ? { type: "text", text } : null;
    const content: MessageParam["content"] = originalAttachments.length
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
    this.cleanup();
    const w = this.waiters.shift();
    if (w) w({ value: undefined as unknown as SDKUserMessage, done: true });
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
  /** An AskUserQuestion tool is displayed in the browser and must block visible
   *  continuation until /chat/answer supplies the user's tool_result. */
  awaitingQuestionToolUseId: string | null;
  /** Watchdog timer for a silent turn. The SDK is trusted to end every turn with
   *  a `result` (or to close the stream), but a dropped API socket / orphaned CLI
   *  subprocess can leave the stream open and silent forever — the full answer
   *  arrived, but the closing frame never did. Then `turnActive` never clears and
   *  the console shows "Generating…" indefinitely. This fires after a long silence
   *  to finish the turn locally so every client recovers. Reset on each event. */
  stallTimer: ReturnType<typeof setTimeout> | null;
}

export type { StartOpts } from "./driver.js";

/** Injectable so tests can drive the engine without the real SDK / network. */
export type QueryFn = typeof query;

const MAX_BUFFER = 2000;

/**
 * A turn is considered stalled (not merely slow) after this much *silence* — no
 * SDK event of any kind. Chosen well above any realistic think/tool gap in an
 * interactive chat (extended thinking streams text; a tool_use emits an event
 * the instant it starts, resetting the clock), yet far below the multi-hour
 * hangs a dropped stream produces. The watchdog resets on every event, so a
 * genuinely working turn — even one running a long, output-silent tool — is
 * never cut. Set to 0 to disable (used by callers that manage their own timeout).
 */
const STALL_TIMEOUT_MS = 10 * 60 * 1000;

function shouldReplayBufferedEvents(run: LiveRun): boolean {
  return run.turnActive || !!run.awaitingQuestionToolUseId;
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

  constructor(
    private readonly queryFn: QueryFn = query,
    /** Silence before a turn is treated as stalled and finished locally. */
    private readonly stallTimeoutMs: number = STALL_TIMEOUT_MS,
  ) {}

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
    if (opts.resume && !opts.forkSession) {
      const prev = this.runs.get(opts.resume);
      if (prev && !prev.turnActive && !prev.done) {
        prev.done = true;
        prev.input.close();
        prev.emitter.emit("done");
      }
    }
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
      awaitingQuestionToolUseId: null,
      stallTimer: null,
    };
    // index immediately under resume id so /chat/send can find it before init
    if (run.sessionId) this.index(run.sessionId, run);
    // Arm the watchdog if this run opens with a turn in flight (a stall could
    // strike before the very first event ever arrives).
    this.scheduleStall(run);

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
        if (!this.emit(run, ev)) return;
        if (ev.kind === "session" && ev.sessionId) {
          run.sessionId = ev.sessionId;
          this.index(ev.sessionId, run);
          settle(ev.sessionId);
        }
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
          run.input.cleanup();
          run.done = true;
          run.turnActive = false;
          this.scheduleStall(run); // stream closed → cancel any pending watchdog
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
    run.events = [];
    run.turnActive = true;
    run.turnStartedAt = Date.now();
    run.input.pushTurn(turn);
    this.scheduleStall(run);
    return true;
  }

  answer(sessionId: string, answer: ToolAnswer): boolean {
    const run = this.runs.get(sessionId);
    if (!run || run.done) return false;
    run.awaitingQuestionToolUseId = null;
    run.events = [];
    run.turnActive = true;
    run.turnStartedAt = Date.now();
    run.input.pushToolResult(answer.toolUseId, answer.text, answer.toolUseResult);
    this.scheduleStall(run);
    return true;
  }

  /**
   * Interrupt the in-flight turn for a live run (the Stop button). The SDK
   * interrupt is best-effort: it may throw, hang, or skip a terminal event, so
   * Attend ends the turn locally immediately and ignores late chunks afterward.
   */
  async interrupt(sessionId: string): Promise<boolean> {
    const run = this.runs.get(sessionId);
    if (!run || run.done || !run.turnActive) return false;
    if (run.interrupt) void run.interrupt().catch(() => {});
    this.emit(run, { kind: "result", ok: false, text: "interrupted" });
    return true;
  }

  private finishTurn(run: LiveRun): void {
    if (!run.turnActive) return;
    run.turnActive = false;
    run.turnStartedAt = 0;
    const sid = run.sessionId;
    if (sid) for (const cb of this.turnEndListeners) cb(sid);
  }

  private emit(run: LiveRun, ev: UiEvent): boolean {
    if (run.awaitingQuestionToolUseId) {
      if (ev.kind === "tool_result" && ev.id === run.awaitingQuestionToolUseId) {
        if (ev.isError) return false;
        run.awaitingQuestionToolUseId = null;
      } else if (ev.kind === "assistant_text" || ev.kind === "result") {
        return false;
      }
    }

    // After Stop, the SDK may still deliver stale chunks/result for the previous
    // turn. Drop those while idle so the UI does not re-enter Generating or
    // advance queued drafts from a duplicate terminal event.
    if (!run.turnActive && isTurnEvent(ev)) return false;

    run.events.push(ev);
    if (run.events.length > MAX_BUFFER) run.events.shift();
    if (ev.kind === "result" || ev.kind === "error") this.finishTurn(run);
    if (ev.kind === "tool_use" && ev.name === "AskUserQuestion") {
      run.turnActive = false;
      run.turnStartedAt = 0;
      run.awaitingQuestionToolUseId = ev.id;
    }
    // Reset the watchdog on activity (reschedules while turnActive; the state
    // above may have ended the turn, in which case this cancels the timer).
    this.scheduleStall(run);
    run.emitter.emit("event", ev);
    return true;
  }

  /**
   * (Re)arm the stall watchdog: clear any pending timer, then schedule a fresh
   * one only while a turn is actually in flight. Every kept event calls this, so
   * a streaming turn keeps pushing the deadline out; a silent one eventually
   * trips onStall(). A no-op (just clears) once the turn ends or when disabled.
   */
  private scheduleStall(run: LiveRun): void {
    if (run.stallTimer) {
      clearTimeout(run.stallTimer);
      run.stallTimer = null;
    }
    if (run.done || !run.turnActive || this.stallTimeoutMs <= 0) return;
    const timer = setTimeout(() => this.onStall(run), this.stallTimeoutMs);
    // Don't let the watchdog alone keep the process alive.
    (timer as unknown as { unref?: () => void }).unref?.();
    run.stallTimer = timer;
  }

  /**
   * The turn produced no events for `stallTimeoutMs` — the SDK stream is orphaned
   * (dropped socket / hung subprocess) and will never deliver its terminal
   * `result`. Finish the turn locally (mirrors interrupt: emit one terminal
   * event, ignore any late real result via the idle guard in emit()) so
   * `turnActive` clears and every client stops showing "Generating…", then
   * best-effort tear down the dead query so we don't leak the subprocess.
   */
  private onStall(run: LiveRun): void {
    run.stallTimer = null;
    if (run.done || !run.turnActive) return;
    this.emit(run, { kind: "result", ok: false, text: "stalled" });
    if (run.interrupt) void run.interrupt().catch(() => {});
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
