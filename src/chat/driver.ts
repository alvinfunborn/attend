import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";
import type { UiEvent } from "./events.js";

export type SessionEffort = "low" | "medium" | "high" | "xhigh" | "max";

/** Inputs to (re)start a chat run. `permissionMode` is Claude-only; Codex ignores it. */
export interface StartOpts {
  cwd: string;
  resume?: string;
  forkSession?: boolean;
  firstText?: string;
  firstAttachments?: ChatAttachment[];
  model?: string;
  effort?: SessionEffort;
  permissionMode?: PermissionMode;
}

export interface ImageAttachment {
  kind: "image";
  name: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
}

export interface PdfAttachment {
  kind: "document";
  name: string;
  mediaType: "application/pdf";
  data: string;
}

export type FileAttachmentMediaType =
  | "application/vnd.ms-excel"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "application/vnd.ms-excel.sheet.macroEnabled.12"
  | "application/vnd.ms-excel.sheet.binary.macroEnabled.12"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.template"
  | "application/vnd.ms-excel.template.macroEnabled.12"
  | "application/vnd.ms-excel.addin.macroEnabled.12";

export interface FileAttachment {
  kind: "file";
  name: string;
  mediaType: FileAttachmentMediaType;
  data: string;
}

export interface TextAttachment {
  kind: "text";
  name: string;
  text: string;
}

export type ChatAttachment = ImageAttachment | PdfAttachment | FileAttachment | TextAttachment;

export interface UserTurn {
  text: string;
  attachments?: ChatAttachment[];
}

export interface ToolAnswer {
  toolUseId: string;
  text: string;
  toolUseResult?: unknown;
}

export interface ActiveSessionState {
  sessionId: string;
  startedAt: number;
}

/**
 * What the server needs from a chat backend, independent of vendor. Both engines
 * implement it: `ChatEngine` (Claude, Agent SDK, one long-lived streaming process)
 * and `CodexEngine` (Codex, `codex exec` — one process per turn). The server holds
 * one driver per vendor and dispatches by the session's vendor (invariant 4:
 * vendor-neutral data, vendor-locked execution).
 */
export interface ChatDriver {
  readonly vendor: string;
  /** A live run's cwd, or undefined when the session isn't currently live. */
  get(sessionId: string): { cwd: string } | undefined;
  /** Start (or resume/fork) a run; resolves with the session id once known. */
  start(opts: StartOpts): Promise<string>;
  /** Send a user turn to a live run. Returns false if it can't accept one now. */
  send(sessionId: string, turn: UserTurn): boolean;
  /** Answer an interactive tool call (e.g. AskUserQuestion) on a live run. */
  answer(sessionId: string, answer: ToolAnswer): boolean;
  /** Interrupt the in-flight turn. Returns false if there's nothing to stop. */
  interrupt(sessionId: string): Promise<boolean>;
  /** Replay buffered events then stream new ones; returns an unsubscribe fn. */
  subscribe(sessionId: string, onEvent: (ev: UiEvent) => void): () => void;
  /** Session ids with a turn currently in flight. */
  activeSessions(): string[];
  /** Live turns with their start timestamps, for reconnect/refresh restoration. */
  activeSessionStates(): ActiveSessionState[];
  /** Notify on each turn completion (drives per-session daemon re-analysis). */
  onTurnEnd(cb: (sessionId: string) => void): () => void;
}
