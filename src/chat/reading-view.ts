import type { UiEvent } from "./events.js";
import type { ToolCall, TranscriptMsg } from "./transcript.js";

function isQuestionTool(name: string, input: unknown): boolean {
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray((input as { questions?: unknown }).questions)
  ) {
    return false;
  }
  const base = name.split(".").at(-1);
  return (
    name === "AskUserQuestion" ||
    base === "request_user_input" ||
    base === "request_user_input_async"
  );
}

/** Keep ordering, completion and Pin identity without retaining hidden payloads. */
export function readingViewTool(tool: ToolCall): ToolCall {
  if (isQuestionTool(tool.name, tool.input)) return tool;
  return {
    id: tool.id,
    name: tool.name,
    input: null,
    result: typeof tool.result === "string" ? "" : undefined,
    isError: tool.isError,
    historyId: tool.historyId,
    historyOrdinal: tool.historyOrdinal,
    historyIndex: tool.historyIndex,
  };
}

export function readingViewMessages(messages: TranscriptMsg[]): TranscriptMsg[] {
  return messages.map((message) => ({ ...message, tools: message.tools.map(readingViewTool) }));
}

/** Project before serialization/encryption. Activity events still drive quiet. */
export class ReadingViewEvents {
  private readonly questions = new Map<string, true>();
  private readonly projected = new WeakMap<UiEvent, UiEvent>();

  constructor(private readonly questionLimit = 4096) {}

  project(sessionKey: string, event: UiEvent): UiEvent {
    if (event.kind !== "tool_use" && event.kind !== "tool_result") return event;
    const cached = this.projected.get(event);
    if (cached) return cached;
    const key = JSON.stringify([sessionKey, event.id]);
    let projected: UiEvent;
    if (event.kind === "tool_use") {
      this.questions.delete(key);
      if (isQuestionTool(event.name, event.input)) {
        this.questions.set(key, true);
        while (this.questions.size > this.questionLimit) {
          const oldest = this.questions.keys().next().value;
          if (oldest === undefined) break;
          this.questions.delete(oldest);
        }
        projected = event;
      } else {
        projected = { kind: event.kind, id: event.id, name: event.name, input: null };
      }
    } else {
      // Async questions can emit an accepted acknowledgement, then an answer.
      // Cache the projection at broadcast time so replay is independent of the
      // bounded ID tracker and of whether tool_use is still in the replay tail.
      projected = this.questions.has(key)
        ? event
        : { kind: event.kind, id: event.id, text: "", isError: event.isError };
    }
    this.projected.set(event, projected);
    return projected;
  }
}
