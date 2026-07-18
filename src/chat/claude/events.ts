import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { UiEvent } from "../events.js";

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

function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as ContentBlock[])
      .map((block) =>
        typeof block === "string" ? block : block?.type === "text" ? (block.text ?? "") : "",
      )
      .join("");
  }
  return "";
}

function configValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean && !clean.startsWith("<") ? clean : undefined;
}

function fastModeSpeed(value: unknown): string | undefined {
  if (value === "on" || value === "cooldown") return "fast";
  if (value === "off") return "standard";
  return undefined;
}

/** Translate Claude Agent SDK messages at the adapter boundary. */
export function toUiEventsFromClaude(message: SDKMessage): UiEvent[] {
  const events: UiEvent[] = [];

  if (message.type === "system" && "session_id" in message && message.session_id) {
    events.push({ kind: "session", sessionId: message.session_id });
    if (message.subtype === "init") {
      const model = configValue(message.model);
      const speed = fastModeSpeed(message.fast_mode_state);
      if (model || speed)
        events.push({
          kind: "run_config",
          source: "provider",
          ...(model ? { model } : {}),
          ...(speed ? { speed } : {}),
        });
    }
  }

  if (message.type === "assistant") {
    const providerMessage = message.message as {
      content?: unknown;
      model?: unknown;
      usage?: { speed?: unknown };
    };
    const model = configValue(providerMessage.model);
    const speed = configValue(providerMessage.usage?.speed);
    if (model || speed)
      events.push({
        kind: "run_config",
        source: "provider",
        ...(model ? { model } : {}),
        ...(speed ? { speed } : {}),
      });
    const content = providerMessage.content;
    const blocks: ContentBlock[] = Array.isArray(content)
      ? (content as ContentBlock[])
      : typeof content === "string"
        ? [{ type: "text", text: content }]
        : [];
    for (const block of blocks) {
      if (block.type === "text" && block.text) {
        events.push({ kind: "assistant_text", text: block.text });
      } else if (block.type === "tool_use" && block.name) {
        events.push({
          kind: "tool_use",
          id: block.id ?? null,
          name: block.name,
          input: block.input,
        });
      }
    }
    if (message.error) events.push({ kind: "error", message: message.error });
  }

  if (message.type === "user") {
    const content = (message.message as { content?: unknown })?.content;
    if (Array.isArray(content)) {
      for (const block of content as ContentBlock[]) {
        if (block?.type !== "tool_result") continue;
        events.push({
          kind: "tool_result",
          id: block.tool_use_id ?? null,
          text: resultText(block.content),
          isError: block.is_error === true,
        });
      }
    }
  }

  if (message.type === "result") {
    const ok = message.subtype === "success";
    const text =
      "result" in message && typeof message.result === "string" ? message.result : undefined;
    events.push({ kind: "result", ok, text });
  }

  return events;
}

/** Compatibility name for older imports. */
export const toUiEvents = toUiEventsFromClaude;
