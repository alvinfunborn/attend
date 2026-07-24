export type JsonRpcId = string | number;

export interface JsonRpcResponse {
  id: JsonRpcId;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
}

export interface AppServerMessage {
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
}

export interface AppServerThread {
  id: string;
  cwd?: string;
}

export interface AppServerTurn {
  id: string;
  status: "completed" | "interrupted" | "failed" | "inProgress";
  error?: {
    message?: string;
    codexErrorInfo?: unknown;
    additionalDetails?: string | null;
  } | null;
}

export interface AppServerItem {
  id: string;
  type: string;
  text?: string;
  command?: string;
  cwd?: string;
  aggregatedOutput?: string | null;
  exitCode?: number | null;
  status?: string;
  changes?: Array<{ path: string; kind: string; diff: string }>;
  server?: string;
  tool?: string;
  arguments?: unknown;
  result?: unknown;
  error?: unknown;
  [key: string]: unknown;
}

export interface UserInputQuestion {
  id: string;
  header: string;
  question: string;
  isOther?: boolean;
  isSecret?: boolean;
  options?: Array<{ label: string; description: string }> | null;
}
