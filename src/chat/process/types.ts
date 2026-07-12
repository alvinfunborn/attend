import type { ChatAttachment, SessionEffort } from "../driver.js";

export type ProcessSandbox = "read-only" | "workspace-write" | "danger-full-access";

export interface ProcessTurnRequest {
  cwd: string;
  prompt: string;
  attachments?: ChatAttachment[];
  resume?: string;
  model?: string;
  effort?: SessionEffort;
  sandbox?: ProcessSandbox;
  outputSchemaFile?: string;
}

export interface ProcessTurnHandle<Event> {
  events: AsyncIterable<Event>;
  kill(): void;
}

export type ProcessTurnFn<Event> = (request: ProcessTurnRequest) => ProcessTurnHandle<Event>;

export type ProcessForkFn = (parentId: string, branchText?: string) => string | null;
