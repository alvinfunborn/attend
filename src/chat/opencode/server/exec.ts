import type { Event, Part, ToolPart } from "@opencode-ai/sdk";
import type { CodexEvent } from "../../codex/events.js";
import type { ToolAnswer, UserTurn } from "../../driver.js";
import { prepareProcessInput } from "../../process/jsonl-exec.js";
import type { ProcessTurnFn, ProcessTurnRequest } from "../../process/types.js";
import { opencodeToProcessEvent } from "../exec.js";
import type { OpencodeState } from "../exec.js";
import type { OpencodeRawPart, OpencodeTranscriptEvent } from "../transcript.js";
import type { OpencodePromptRequest, OpencodeServerLike } from "./client.js";

/** Minimal push queue turning server callbacks into this turn's async iterator. */
class CodexEventQueue implements AsyncIterable<CodexEvent> {
  private readonly values: CodexEvent[] = [];
  private readonly waiters: Array<(result: IteratorResult<CodexEvent>) => void> = [];
  private closed = false;

  push(event: CodexEvent): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter({ value: event, done: false });
    else this.values.push(event);
  }

  end(): void {
    if (this.closed) return;
    this.closed = true;
    while (this.waiters.length) {
      const waiter = this.waiters.shift();
      waiter?.({ value: undefined as never, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<CodexEvent> {
    return {
      next: (): Promise<IteratorResult<CodexEvent>> => {
        const value = this.values.shift();
        if (value !== undefined) return Promise.resolve({ value, done: false });
        if (this.closed) return Promise.resolve({ value: undefined as never, done: true });
        return new Promise((resolve) => this.waiters.push(resolve));
      },
    };
  }
}

export interface OpencodeServerExecOptions {
  /** Auto-approve asks for non-read-only turns, mirroring `run --auto`. */
  autoApprove?(request: ProcessTurnRequest): boolean;
}

/** One entry of OpenCode's native `question` tool ask (the 1.18 shape). */
export interface OpencodeQuestionInfo {
  question: string;
  header: string;
  options?: Array<{ label: string; description?: string }>;
  multiple?: boolean;
  custom?: boolean;
}

/**
 * Drives one chat turn through the persistent OpenCode server. The turn shape
 * matches the process drivers (`ProcessTurnFn`), so all shared run/turn
 * semantics live in `ProcessChatDriver`; only the transport differs.
 *
 * Event normalization is intentionally shared with the `opencode run` path:
 * server parts are projected into the same `OpencodeTranscriptEvent` shape and
 * fed through `opencodeToProcessEvent`.
 */
export function makeOpencodeServerExec(
  server: OpencodeServerLike,
  options: OpencodeServerExecOptions = {},
): ProcessTurnFn<CodexEvent> {
  const autoApprove = options.autoApprove ?? ((request) => request.sandbox !== "read-only");
  return (request) => {
    const prepared = prepareProcessInput("opencode", request.prompt, request.attachments);
    const state: OpencodeState = { sessionId: request.resume ?? null, announced: !!request.resume };
    const queue = new CodexEventQueue();
    const assistantMessages = new Set<string>();
    const pendingQuestions = new Map<string, OpencodeQuestionInfo[]>();
    const steerCleanups: Array<() => void> = [];
    const approved = autoApprove(request);
    let settled = false;
    let promptSent = false;
    let unsubscribe: (() => void) | null = null;
    let unsubscribeDisconnect: (() => void) | null = null;

    const settle = (events: CodexEvent[]): void => {
      if (settled) return;
      settled = true;
      for (const event of events) queue.push(event);
      queue.end();
    };
    const belongs = (sessionId: string | undefined): boolean =>
      !!state.sessionId && sessionId === state.sessionId;

    const onServerEvent = (event: Event): void => {
      if (settled) return;
      if (event.type === "message.updated") {
        if (belongs(event.properties.info.sessionID) && event.properties.info.role === "assistant")
          assistantMessages.add(event.properties.info.id);
        return;
      }
      if (event.type === "message.part.updated") {
        const part = event.properties.part;
        if (!belongs(part.sessionID) || !assistantMessages.has(part.messageID)) return;
        const transcript = transcriptEvent(part);
        if (!transcript) return;
        for (const item of opencodeToProcessEvent(transcript, state)) queue.push(item);
        return;
      }
      if (event.type === "session.idle") {
        if (!promptSent || !belongs(event.properties.sessionID)) return;
        settle([{ type: "turn.completed" }]);
        return;
      }
      if (event.type === "session.error") {
        if (event.properties.sessionID && !belongs(event.properties.sessionID)) return;
        settle([{ type: "turn.failed", error: serverErrorText(event.properties.error) }]);
        return;
      }
      // The 1.18 server emits the v2 `permission.asked`; older builds used
      // `permission.updated`. Both carry `{ id, sessionID }`, so auto-approve
      // whichever arrives instead of hanging the turn on an unanswered ask.
      const ask = permissionAsk(event);
      if (ask && approved && belongs(ask.sessionID)) {
        void server.replyPermission(ask.sessionID, ask.id, request.cwd).catch(() => {});
        return;
      }
      // The native `question` tool blocks the turn until answered. Surface it as
      // the shared input-tool UI; the answer goes back through the server API.
      const question = questionAsked(event);
      if (question && belongs(question.sessionID)) {
        pendingQuestions.set(question.id, question.questions);
        queue.push({
          type: "item.started",
          item: {
            id: question.id,
            type: "mcp_tool_call",
            name: "request_user_input",
            arguments: { questions: question.questions.map(questionToUi) },
          },
        });
        return;
      }
      const replied = questionReplied(event);
      if (replied && belongs(replied.sessionID)) {
        pendingQuestions.delete(replied.requestID);
        queue.push({
          type: "item.completed",
          item: {
            id: replied.requestID,
            type: "mcp_tool_call",
            name: "request_user_input",
            aggregated_output: answerSummary(replied.answers),
          },
        });
      }
    };

    const cleanup = (): void => {
      unsubscribe?.();
      unsubscribeDisconnect?.();
      prepared.cleanup();
      for (const steerCleanup of steerCleanups) steerCleanup();
    };

    void (async () => {
      try {
        await server.start();
        if (!state.sessionId) {
          const created = await server.createSession(request.cwd);
          state.sessionId = created;
          state.announced = true;
          queue.push({ type: "thread.started", thread_id: created });
        }
        unsubscribe = server.onEvent(request.cwd, onServerEvent);
        unsubscribeDisconnect = server.onDisconnect(request.cwd, (error) =>
          settle([{ type: "turn.failed", error: error.message }]),
        );
        promptSent = true;
        const prompt: OpencodePromptRequest = {
          sessionId: state.sessionId,
          directory: request.cwd,
          text: prepared.prompt,
          model: request.model,
          variant: request.effort,
        };
        await server.prompt(prompt);
      } catch (error) {
        settle([{ type: "turn.failed", error: errorMessage(error) }]);
      }
    })();

    return {
      events: (async function* events(): AsyncIterable<CodexEvent> {
        try {
          for await (const event of queue) yield event;
        } finally {
          cleanup();
        }
      })(),
      kill: (): void => {
        if (state.sessionId) void server.abort(state.sessionId, request.cwd).catch(() => {});
        settle([]);
      },
      answer: (toolUseId: string, answer: ToolAnswer): boolean => {
        const questions = pendingQuestions.get(toolUseId);
        if (!questions) return false;
        pendingQuestions.delete(toolUseId);
        const answers = questionAnswers(questions, answer);
        void server.replyQuestion(toolUseId, answers, request.cwd).catch(() => {});
        return true;
      },
      steer: async (turn: UserTurn): Promise<boolean> => {
        if (!state.sessionId) return false;
        const steerInput = prepareProcessInput("opencode", turn.text, turn.attachments);
        steerCleanups.push(steerInput.cleanup);
        try {
          await server.steerPrompt(state.sessionId, steerInput.prompt);
          return true;
        } catch {
          return false;
        }
      },
    };
  };
}

/**
 * Project a server part into the shape the shared `opencode run` normalizer
 * consumes. Only settled content is forwarded: text snapshots stream while the
 * model writes, and tool parts transition pending/running → completed, so
 * forwarding every update would render each block many times. `step-finish` is
 * deliberately dropped — the server may keep going after a step (compaction
 * auto-continue), which makes `session.idle` the authoritative turn end.
 */
function transcriptEvent(part: Part): OpencodeTranscriptEvent | null {
  if (part.type === "text") {
    if (!part.time?.end) return null;
    return {
      type: "text",
      sessionID: part.sessionID,
      part: {
        id: part.id,
        type: "text",
        text: part.text,
        time: { start: part.time.start, end: part.time.end },
      },
    };
  }
  if (part.type === "tool") {
    // The native question tool is rendered from the live `question.asked`
    // event, not as a generic tool block once its part settles.
    if (part.tool === "question") return null;
    const raw = transcriptToolPart(part);
    return raw ? { type: "tool_use", sessionID: part.sessionID, part: raw } : null;
  }
  return null;
}

function transcriptToolPart(part: ToolPart): OpencodeRawPart | null {
  const status = part.state.status;
  if (status !== "completed" && status !== "error") return null;
  return {
    id: part.id,
    type: "tool",
    tool: part.tool,
    callID: part.callID,
    state: {
      status,
      input: part.state.input,
      output: status === "completed" ? part.state.output : part.state.error,
      metadata: "metadata" in part.state ? part.state.metadata : undefined,
    },
  };
}

/**
 * Reads the `{ id, sessionID }` of a permission ask from either event shape:
 * the legacy `permission.updated` or the 1.18 `permission.asked`.
 */
export function permissionAsk(event: Event): { sessionID: string; id: string } | null {
  const type = (event as { type?: unknown }).type;
  if (type !== "permission.asked" && type !== "permission.updated") return null;
  const properties = (event as { properties?: { id?: unknown; sessionID?: unknown } }).properties;
  if (typeof properties?.sessionID !== "string" || typeof properties.id !== "string") return null;
  return { sessionID: properties.sessionID, id: properties.id };
}

/** Reads the native `question.asked` ask (the 1.18 event shape, absent from the SDK types). */
export function questionAsked(
  event: Event,
): { id: string; sessionID: string; questions: OpencodeQuestionInfo[] } | null {
  if ((event as { type?: unknown }).type !== "question.asked") return null;
  const properties = (
    event as {
      properties?: { id?: unknown; sessionID?: unknown; questions?: unknown };
    }
  ).properties;
  if (
    typeof properties?.id !== "string" ||
    typeof properties.sessionID !== "string" ||
    !Array.isArray(properties.questions)
  ) {
    return null;
  }
  return {
    id: properties.id,
    sessionID: properties.sessionID,
    questions: properties.questions as OpencodeQuestionInfo[],
  };
}

function questionReplied(
  event: Event,
): { sessionID: string; requestID: string; answers: string[][] } | null {
  if ((event as { type?: unknown }).type !== "question.replied") return null;
  const properties = (
    event as {
      properties?: { sessionID?: unknown; requestID?: unknown; answers?: unknown };
    }
  ).properties;
  if (typeof properties?.sessionID !== "string" || typeof properties.requestID !== "string") {
    return null;
  }
  const answers = Array.isArray(properties.answers)
    ? properties.answers.map((entry) =>
        Array.isArray(entry) ? entry.map(String) : [String(entry)],
      )
    : [];
  return { sessionID: properties.sessionID, requestID: properties.requestID, answers };
}

/** Projects one OpenCode question into the shape the console's question card reads. */
function questionToUi(question: OpencodeQuestionInfo, index: number): Record<string, unknown> {
  return {
    id: `q${index}`,
    header: question.header || "Question",
    question: question.question,
    options: Array.isArray(question.options) ? question.options : [],
    multiSelect: question.multiple === true,
    custom: question.custom !== false,
  };
}

/**
 * Converts the console's answer into OpenCode's `answers` matrix: one array of
 * selected labels per question, in order. The console keys by question text and
 * joins multi-selects with ", "; freeform text rides in `response`.
 */
function questionAnswers(questions: OpencodeQuestionInfo[], answer: ToolAnswer): string[][] {
  const result = (answer.toolUseResult ?? {}) as {
    answers?: Record<string, unknown>;
    response?: unknown;
  };
  const supplied = result.answers ?? {};
  const freeform = typeof result.response === "string" ? result.response : "";
  return questions.map((question) => {
    const raw = supplied[question.question];
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === "string" && raw) return raw.split(", ").filter(Boolean);
    if (freeform) return [freeform];
    return answer.text ? [answer.text] : [];
  });
}

function answerSummary(answers: string[][]): string {
  const summary = answers
    .map((entry) => entry.filter(Boolean).join(", "))
    .filter(Boolean)
    .join("; ");
  return summary || "answered";
}

function serverErrorText(error: unknown): string {
  if (!error) return "opencode turn failed";
  if (typeof error === "string") return error;
  const data = (error as { data?: { message?: unknown } }).data;
  if (typeof data?.message === "string" && data.message) return data.message;
  const name = (error as { name?: unknown }).name;
  if (typeof name === "string" && name) return name;
  return "opencode turn failed";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
