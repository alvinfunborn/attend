import type { ChatAttachment } from "./driver.js";

/** Normalized transport events rendered by Attend, independent of provider SDKs. */
export type UiEvent =
  | { kind: "session"; sessionId: string }
  | { kind: "user_turn_started"; text: string; attachments?: ChatAttachment[]; startedAt?: number }
  | {
      kind: "queued_turn_started";
      queueId: string;
      text: string;
      attachments?: ChatAttachment[];
      startedAt?: number;
    }
  | { kind: "assistant_text"; text: string }
  | { kind: "tool_use"; id: string | null; name: string; input: unknown }
  | { kind: "tool_result"; id: string | null; text: string; isError: boolean }
  | { kind: "result"; ok: boolean; text?: string }
  | { kind: "error"; message: string }
  | { kind: "sync"; turnActive: boolean; startedAt?: number };

/** @deprecated Provider mappers live beside their adapters. */
export { toUiEventsFromClaude as toUiEvents } from "./claude/events.js";
