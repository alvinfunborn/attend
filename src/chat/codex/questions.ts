import type { ToolCall } from "../transcript.js";

/** Async questions are delivered as agent messages as well as rollout tool calls. */
export function asyncQuestionTool(item: Record<string, unknown>): (ToolCall & { id: string }) | null {
  if (
    !["agentMessage", "AgentMessage"].includes(String(item.type)) ||
    item.delivery !== "async" ||
    typeof item.id !== "string" ||
    !Array.isArray(item.questions) ||
    !item.questions.length
  ) {
    return null;
  }
  return {
    id: item.id,
    name: "request_user_input_async",
    input: { questions: item.questions },
  };
}
