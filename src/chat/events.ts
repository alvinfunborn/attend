import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

/** Normalized, transport-friendly events the browser console renders. */
export type UiEvent =
  | { kind: "session"; sessionId: string }
  | { kind: "assistant_text"; text: string }
  | { kind: "tool_use"; name: string; input: unknown }
  | { kind: "result"; ok: boolean; text?: string }
  | { kind: "error"; message: string };

interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: unknown;
}

/**
 * Normalize one SDK message into zero or more UI events. Keeps the browser
 * protocol small and stable, independent of the SDK's large message union.
 */
export function toUiEvents(msg: SDKMessage): UiEvent[] {
  const out: UiEvent[] = [];

  if (msg.type === "system" && "session_id" in msg && msg.session_id) {
    out.push({ kind: "session", sessionId: msg.session_id });
  }

  if (msg.type === "assistant") {
    const content = (msg.message as { content?: unknown })?.content;
    const blocks: ContentBlock[] = Array.isArray(content)
      ? (content as ContentBlock[])
      : typeof content === "string"
        ? [{ type: "text", text: content }]
        : [];
    for (const b of blocks) {
      if (b.type === "text" && b.text) out.push({ kind: "assistant_text", text: b.text });
      else if (b.type === "tool_use" && b.name) {
        out.push({ kind: "tool_use", name: b.name, input: b.input });
      }
    }
    if (msg.error) out.push({ kind: "error", message: msg.error });
  }

  if (msg.type === "result") {
    const ok = msg.subtype === "success";
    const text = "result" in msg && typeof msg.result === "string" ? msg.result : undefined;
    out.push({ kind: "result", ok, text });
  }

  return out;
}
