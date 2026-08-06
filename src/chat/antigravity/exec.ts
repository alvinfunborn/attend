import type { CodexEvent } from "../codex/events.js";
import { makeJsonlExec } from "../process/jsonl-exec.js";
import type { ProcessTurnFn, ProcessTurnRequest } from "../process/types.js";

export interface AntigravityEvent {
  type?: string;
  timestamp?: string;
  session_id?: string;
  sessionId?: string;
  conversation_id?: string;
  conversationId?: string;
  model?: string | { id?: string; display_name?: string };
  role?: "user" | "assistant";
  content?: unknown;
  text?: string;
  delta?: boolean;
  tool_name?: string;
  tool_id?: string;
  parameters?: unknown;
  status?: "success" | "error";
  output?: string;
  error?: { type?: string; message?: string };
  severity?: "warning" | "error";
  message?: string;
  _attend?: { timestamp?: number; cwd?: string };
}

interface AntigravityState {
  assistantText: string;
}

/** Standalone Antigravity CLI headless flags (the `agy` command, not the desktop launcher). */
export function buildAntigravityArgs(
  request: ProcessTurnRequest,
  prompt = request.prompt,
): string[] {
  const args = ["--output-format", "stream-json"];
  if (request.resume) args.push("--conversation", request.resume);
  if (request.model) args.push("--model", request.model);
  if (request.effort) args.push("--effort", request.effort);
  if (request.sandbox === "read-only") args.push("--mode", "plan", "--sandbox");
  else args.push("--dangerously-skip-permissions");
  args.push("--print", prompt);
  return args;
}

function stringContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value
      .map((part) =>
        typeof part === "string"
          ? part
          : part && typeof part === "object" && "text" in part
            ? String(part.text ?? "")
            : "",
      )
      .join("");
  if (value && typeof value === "object" && "text" in value) return String(value.text ?? "");
  return "";
}

function modelId(model: AntigravityEvent["model"]): string | undefined {
  return typeof model === "string" ? model : (model?.id ?? model?.display_name);
}

export function antigravityToProcessEvent(
  event: AntigravityEvent,
  state: AntigravityState = { assistantText: "" },
): CodexEvent[] {
  const sessionId =
    event.conversation_id ?? event.conversationId ?? event.session_id ?? event.sessionId;
  if (
    sessionId &&
    ["init", "session.start", "conversation.start", "conversation_started"].includes(
      event.type ?? "",
    )
  ) {
    return [
      {
        type: "thread.started",
        thread_id: sessionId,
        ...(modelId(event.model) ? { model: modelId(event.model) } : {}),
      },
    ];
  }
  const content = stringContent(event.content) || event.text || event.message || "";
  if (
    content &&
    ((event.type === "message" && event.role === "assistant") ||
      ["assistant.message", "assistant_message", "agent_message", "planner_response"].includes(
        event.type ?? "",
      ))
  ) {
    state.assistantText += content;
    return [{ type: "item.completed", item: { type: "agent_message", text: content } }];
  }
  if (["tool_use", "tool_call", "tool.execution_start"].includes(event.type ?? "")) {
    return [
      {
        type: "item.started",
        item: {
          id: event.tool_id,
          type: "mcp_tool_call",
          name: event.tool_name ?? "tool",
          arguments: event.parameters,
        },
      },
    ];
  }
  if (["tool_result", "tool.execution_complete"].includes(event.type ?? "")) {
    return [
      {
        type: "item.completed",
        item: {
          id: event.tool_id,
          type: "mcp_tool_call",
          name: "tool",
          aggregated_output:
            event.output ?? event.error?.message ?? (event.status === "error" ? "tool failed" : ""),
        },
      },
    ];
  }
  if (event.type === "error" && event.severity === "error") {
    return [{ type: "turn.failed", error: event.message ?? "antigravity turn failed" }];
  }
  // The shared runner emits completion after it has also inspected stderr for
  // a newly-created conversation id.
  return [];
}

export function makeAntigravityExec(bin: string, sessionsDir: string): ProcessTurnFn<CodexEvent> {
  return makeJsonlExec<AntigravityEvent, AntigravityState>({
    vendor: "antigravity",
    bin,
    sessionsDir,
    createState: () => ({ assistantText: "" }),
    buildArgs: (request, prompt) => buildAntigravityArgs(request, prompt),
    sessionId: (event) =>
      event.conversation_id ?? event.conversationId ?? event.session_id ?? event.sessionId ?? null,
    sessionIdFromStderr: (stderr) =>
      stderr.match(
        /(?:created|conversation(?:\s+id)?)[^0-9a-f]*([0-9a-f]{8}-[0-9a-f-]{27,})/i,
      )?.[1] ?? null,
    normalize: antigravityToProcessEvent,
  });
}
