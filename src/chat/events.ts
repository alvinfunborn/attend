import type { ProviderSessionRunConfig } from "../core/session-run-config.js";
import type { ChatAttachment, ChatReference, SessionGoal } from "./driver.js";
import type { PublicProviderError } from "./provider-errors.js";

/** Normalized transport events rendered by Attend, independent of provider SDKs. */
export type UiEvent =
  | { kind: "session"; sessionId: string }
  | ({ kind: "run_config" } & ProviderSessionRunConfig)
  | { kind: "user_turn_started"; text: string; attachments?: ChatAttachment[]; startedAt?: number }
  | {
      kind: "queued_turn_started";
      queueId: string;
      text: string;
      attachments?: ChatAttachment[];
      references?: ChatReference[];
      goal?: boolean;
      startedAt?: number;
    }
  | {
      kind: "queued_turn_steered";
      queueId: string;
      text: string;
      attachments?: ChatAttachment[];
      references?: ChatReference[];
      steeredAt?: number;
    }
  | { kind: "assistant_text"; text: string }
  | { kind: "tool_use"; id: string | null; name: string; input: unknown }
  | { kind: "tool_result"; id: string | null; text: string; isError: boolean }
  | { kind: "result"; ok: boolean; text?: string }
  | { kind: "goal"; goal: SessionGoal | null }
  | ({ kind: "error"; message: string } & Partial<Omit<PublicProviderError, "message">>)
  | { kind: "sync"; turnActive: boolean; startedAt?: number };

/** @deprecated Provider mappers live beside their adapters. */
export { toUiEventsFromClaude as toUiEvents } from "./claude/events.js";
