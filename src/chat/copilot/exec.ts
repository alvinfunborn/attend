import crypto from "node:crypto";
import type { CodexEvent } from "../codex/events.js";
import { makeJsonlExec } from "../process/jsonl-exec.js";
import type { ProcessTurnFn, ProcessTurnRequest } from "../process/types.js";

export interface CopilotEvent {
  id?: string;
  type?: string;
  timestamp?: string;
  sessionId?: string;
  data?: {
    sessionId?: string;
    content?: string;
    message?: string;
    errorType?: string;
    toolCallId?: string;
    toolId?: string;
    toolName?: string;
    name?: string;
    arguments?: unknown;
    input?: unknown;
    result?: unknown;
    output?: unknown;
    success?: boolean;
  };
  _attend?: { timestamp?: number; cwd?: string };
}

interface CopilotState {
  sessionId: string;
  sawAssistantDelta: boolean;
}

export function buildCopilotArgs(
  request: ProcessTurnRequest,
  sessionId: string,
  prompt = request.prompt,
): string[] {
  const args = ["-p", prompt, "--output-format=json", "--no-ask-user"];
  if (request.resume) args.push(`--resume=${request.resume}`);
  else args.push("--session-id", sessionId);
  if (request.model) args.push("--model", request.model);
  if (request.effort) args.push("--reasoning-effort", request.effort);
  if (request.sandbox === "read-only") {
    args.push("--allow-tool=read", "--deny-tool=write,shell,url");
  } else {
    args.push("--allow-all");
  }
  return args;
}

function toolId(event: CopilotEvent): string | undefined {
  return event.data?.toolCallId ?? event.data?.toolId ?? event.id;
}

export function copilotToProcessEvent(event: CopilotEvent, state: CopilotState): CodexEvent[] {
  const data = event.data ?? {};
  if (event.type === "session.start" || event.type === "session.resume") {
    return [
      { type: "thread.started", thread_id: data.sessionId ?? event.sessionId ?? state.sessionId },
    ];
  }
  if (event.type === "assistant.message_delta" || event.type === "assistant.streaming_delta") {
    state.sawAssistantDelta = true;
    return data.content
      ? [{ type: "item.completed", item: { type: "agent_message", text: data.content } }]
      : [];
  }
  if (event.type === "assistant.message") {
    return !state.sawAssistantDelta && data.content
      ? [{ type: "item.completed", item: { type: "agent_message", text: data.content } }]
      : [];
  }
  if (event.type === "tool.execution_start" || event.type === "external_tool.requested") {
    return [
      {
        type: "item.started",
        item: {
          id: toolId(event),
          type: "mcp_tool_call",
          name: data.toolName ?? data.name ?? "tool",
          arguments: data.arguments ?? data.input,
        },
      },
    ];
  }
  if (event.type === "tool.execution_complete" || event.type === "external_tool.completed") {
    const output = data.result ?? data.output ?? "";
    return [
      {
        type: "item.completed",
        item: {
          id: toolId(event),
          type: "mcp_tool_call",
          name: data.toolName ?? data.name ?? "tool",
          aggregated_output: typeof output === "string" ? output : JSON.stringify(output),
        },
      },
    ];
  }
  if (event.type === "session.error") {
    return [
      {
        type: "turn.failed",
        error: data.message ?? data.errorType ?? "copilot turn failed",
      },
    ];
  }
  if (event.type === "session.idle") {
    return [{ type: "turn.completed" }];
  }
  return [];
}

export function makeCopilotExec(bin: string, sessionsDir: string): ProcessTurnFn<CodexEvent> {
  return makeJsonlExec<CopilotEvent, CopilotState>({
    vendor: "copilot",
    bin,
    sessionsDir,
    createState: (request) => ({
      sessionId: request.resume ?? crypto.randomUUID(),
      sawAssistantDelta: false,
    }),
    buildArgs: (request, prompt, state) => buildCopilotArgs(request, state.sessionId, prompt),
    initialSessionId: (_request, state) => state.sessionId,
    sessionId: (event, state) => event.data?.sessionId ?? event.sessionId ?? state.sessionId,
    normalize: copilotToProcessEvent,
  });
}
