import type { UiEvent } from "./events.js";
import type { ProviderErrorClassifier } from "./provider-errors.js";

/** Opaque vendor-advertised effort identifier; Attend never enumerates these. */
export type SessionEffort = string;

/** Opaque vendor-advertised speed tier; Attend never enumerates these. */
export type SessionSpeed = string;

/** Inputs to (re)start a chat run. Provider-specific values stay opaque here. */
export interface StartOpts {
  cwd: string;
  /** Stable browser/UI identity while the provider session id is still unknown. */
  clientSessionId?: string;
  resume?: string;
  forkSession?: boolean;
  firstText?: string;
  firstAttachments?: ChatAttachment[];
  model?: string;
  effort?: SessionEffort;
  speed?: SessionSpeed;
  permissionMode?: string;
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

/** A user-selected piece of Attend UI context that is resolved before provider dispatch. */
export interface PinChatReference {
  kind: "pin";
  pinKey: string;
  /** UI pin scopes can retain a client id after a provider session is materialized. */
  pinSessionId?: string;
}

/** Ephemeral assistant text quoted directly into one draft without creating a Pin. */
export interface QuoteChatReference {
  kind: "quote";
  text: string;
  role: "assistant" | "selected";
  /** Stable UI message key used for display/deduplication only. */
  sourceKey?: string;
}

export type ChatReference = PinChatReference | QuoteChatReference;

export interface UserTurn {
  text: string;
  attachments?: ChatAttachment[];
  references?: ChatReference[];
}

export interface ToolAnswer {
  toolUseId: string;
  text: string;
  toolUseResult?: unknown;
}

export interface ActiveSessionState {
  sessionId: string;
  startedAt: number;
  clientSessionId?: string;
}

export type GoalStatus =
  | "active"
  | "paused"
  | "blocked"
  | "usageLimited"
  | "budgetLimited"
  | "complete";

export interface SessionGoal {
  threadId: string;
  objective: string;
  status: GoalStatus;
  createdAt?: number;
  updatedAt?: number;
  tokensUsed?: number;
  timeUsedSeconds?: number;
  tokenBudget?: number | null;
}

/**
 * Attend's provider port. SDKs, app servers, and process transports implement
 * this interface while the HTTP/SSE/queue layers remain vendor-neutral.
 */
export interface ChatDriver {
  readonly vendor: string;
  /** Vendor-owned recognition of stable, actionable provider failures. */
  classifyError?: ProviderErrorClassifier;
  /** A live run's cwd, or undefined when the session isn't currently live. */
  get(sessionId: string): { cwd: string } | undefined;
  /** Provider capability validation before a turn is accepted or queued. */
  validateAttachments?(attachments: ChatAttachment[]): string | null;
  /** Start (or resume/fork) a run; resolves with the session id once known. */
  start(opts: StartOpts): Promise<string>;
  /** Send a user turn to a live run. Returns false if it can't accept one now. */
  send(sessionId: string, turn: UserTurn): boolean;
  /** Whether an in-flight turn can accept user guidance without starting a new turn. */
  canSteer(sessionId: string): boolean;
  /** Inject user guidance into an in-flight turn. The current turn stays active. */
  steer(sessionId: string, turn: UserTurn): Promise<boolean>;
  /** Answer an interactive tool call (e.g. AskUserQuestion) on a live run. */
  answer(sessionId: string, answer: ToolAnswer): boolean;
  /** Interrupt the in-flight turn. An external transcript can provide its exact
   * provider turn id, avoiding a racy status lookup after Attend restarts. */
  interrupt(sessionId: string, options?: { turnId?: string | null }): Promise<boolean>;
  /** Replay buffered events then stream new ones; returns an unsubscribe fn. */
  subscribe(sessionId: string, onEvent: (ev: UiEvent) => void): () => void;
  /** Session ids with a turn currently in flight. */
  activeSessions(): string[];
  /** Live turns with their start timestamps, for reconnect/refresh restoration. */
  activeSessionStates(): ActiveSessionState[];
  /** Notify on each turn completion (drives per-session daemon re-analysis). */
  onTurnEnd(cb: (sessionId: string) => void): () => void;
  /** Provider-native durable Goal support, when exposed by the backend. */
  setGoal?(sessionId: string, objective: string): Promise<SessionGoal>;
  getGoal?(sessionId: string): Promise<SessionGoal | null>;
  clearGoal?(sessionId: string): Promise<boolean>;
  /** Observe every normalized event across all sessions (global browser event bus). */
  onEvent?(cb: (sessionId: string, event: UiEvent, clientSessionId?: string) => void): () => void;
  /** Stop accepting future in-process input without interrupting active turns. */
  shutdown?(): void;
}
