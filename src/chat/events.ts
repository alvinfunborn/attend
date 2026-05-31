import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

/** Normalized, transport-friendly events the browser console renders. */
export type UiEvent =
  | { kind: "session"; sessionId: string }
  | { kind: "assistant_text"; text: string }
  | { kind: "tool_use"; id: string | null; name: string; input: unknown }
  | { kind: "tool_result"; id: string | null; text: string; isError: boolean }
  | { kind: "result"; ok: boolean; text?: string }
  | { kind: "error"; message: string }
  /** engine→client only (not from the SDK): sent once right after a subscriber
   *  catches up on the buffer, so a reconnecting page knows whether a turn is
   *  still generating and can restore the "生成中…" state. `startedAt` is the
   *  epoch-ms the in-flight turn began, so a (re)connecting page resumes the
   *  elapsed timer from the true start instead of restarting it from 0. */
  | { kind: "sync"; turnActive: boolean; startedAt?: number };

interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: unknown;
  id?: string;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

/** Flatten a tool_result's content (string, or array of text blocks) into text. */
function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as ContentBlock[])
      .map((b) => (typeof b === "string" ? b : b?.type === "text" ? (b.text ?? "") : ""))
      .join("");
  }
  return "";
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
        out.push({ kind: "tool_use", id: b.id ?? null, name: b.name, input: b.input });
      }
    }
    if (msg.error) out.push({ kind: "error", message: msg.error });
  }

  // Tool results come back as user messages carrying tool_result blocks.
  if (msg.type === "user") {
    const content = (msg.message as { content?: unknown })?.content;
    if (Array.isArray(content)) {
      for (const b of content as ContentBlock[]) {
        if (b?.type === "tool_result") {
          out.push({
            kind: "tool_result",
            id: b.tool_use_id ?? null,
            text: resultText(b.content),
            isError: b.is_error === true,
          });
        }
      }
    }
  }

  if (msg.type === "result") {
    const ok = msg.subtype === "success";
    const text = "result" in msg && typeof msg.result === "string" ? msg.result : undefined;
    out.push({ kind: "result", ok, text });
  }

  return out;
}
