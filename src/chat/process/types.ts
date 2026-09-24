import type {
  ChatAttachment,
  SessionEffort,
  SessionSpeed,
  ToolAnswer,
  UserTurn,
} from "../driver.js";

export type ProcessSandbox = "read-only" | "workspace-write" | "danger-full-access";

export interface ProcessTurnRequest {
  cwd: string;
  prompt: string;
  attachments?: ChatAttachment[];
  resume?: string;
  model?: string;
  effort?: SessionEffort;
  speed?: SessionSpeed;
  sandbox?: ProcessSandbox;
  outputSchemaFile?: string;
}

export interface ProcessTurnHandle<Event> {
  events: AsyncIterable<Event>;
  kill(): void;
  /**
   * Vendors whose provider keeps the turn alive while it waits for user input
   * (OpenCode's native question tool) answer here instead of restarting the
   * turn. `ProcessChatDriver` detects this capability and leaves the run active.
   * Returns false when the answer wasn't accepted.
   */
  answer?(toolUseId: string, answer: ToolAnswer): boolean;
  /**
   * Vendors whose provider absorbs guidance into the running turn (OpenCode's
   * `delivery: "steer"`). `ProcessChatDriver` advertises steering only when the
   * live handle provides this.
   */
  steer?(turn: UserTurn): Promise<boolean>;
}

export type ProcessTurnFn<Event> = (request: ProcessTurnRequest) => ProcessTurnHandle<Event>;

export type ProcessForkFn = (parentId: string, branchText?: string) => string | null;
