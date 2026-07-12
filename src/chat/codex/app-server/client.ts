import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import readline from "node:readline";
import type { AppServerMessage, JsonRpcId } from "./types.js";

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

export interface AppServerClientLike {
  start(): Promise<void>;
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
  respond(id: JsonRpcId, result: unknown): void;
  respondError(id: JsonRpcId, message: string): void;
  onMessage(listener: (message: AppServerMessage) => void): () => void;
  shutdown(): void;
}

/** A single initialized JSONL connection to `codex app-server --stdio`. */
export class CodexAppServerClient implements AppServerClientLike {
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly events = new EventEmitter();
  private readonly pending = new Map<JsonRpcId, PendingRequest>();
  private nextId = 1;
  private starting: Promise<void> | null = null;
  private ready = false;
  private stderr = "";
  private stopped = false;

  constructor(private readonly bin = "codex") {}

  start(): Promise<void> {
    if (this.ready && this.child) return Promise.resolve();
    if (this.starting) return this.starting;
    this.starting = this.open().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    await this.start();
    const id = this.nextId++;
    const result = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.write({ method, id, ...(params === undefined ? {} : { params }) });
    return (await result) as T;
  }

  respond(id: JsonRpcId, result: unknown): void {
    this.write({ id, result });
  }

  respondError(id: JsonRpcId, message: string): void {
    this.write({ id, error: { code: -32601, message } });
  }

  onMessage(listener: (message: AppServerMessage) => void): () => void {
    this.events.on("message", listener);
    return () => this.events.off("message", listener);
  }

  shutdown(): void {
    this.stopped = true;
    this.ready = false;
    const child = this.child;
    this.child = null;
    child?.kill("SIGTERM");
    this.rejectPending(new Error("codex app-server stopped"));
  }

  private async open(): Promise<void> {
    this.stopped = false;
    const child = spawn(this.bin, ["app-server", "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    this.stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      this.stderr = (this.stderr + chunk).slice(-8000);
    });
    child.once("error", (error) => this.fail(child, error));
    child.once("exit", (code, signal) => {
      const detail = this.stderr.trim();
      const suffix = detail ? `: ${detail}` : "";
      this.fail(
        child,
        new Error(`codex app-server exited (${signal ?? String(code ?? "unknown")})${suffix}`),
      );
    });
    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => this.receive(line));

    await this.requestDirect("initialize", {
      clientInfo: { name: "attend", title: "Attend", version: "1.0.0" },
      capabilities: { experimentalApi: true, requestAttestation: false },
    });
    this.write({ method: "initialized" });
    this.ready = true;
  }

  private requestDirect(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const result = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.write({ method, id, params });
    return result;
  }

  private receive(line: string): void {
    let message: AppServerMessage;
    try {
      message = JSON.parse(line) as AppServerMessage;
    } catch {
      return;
    }
    if (message.id !== undefined && !message.method) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message ?? "codex app-server request failed"));
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    this.events.emit("message", message);
  }

  private write(message: object): void {
    const child = this.child;
    if (!child || child.stdin.destroyed) throw new Error("codex app-server is not running");
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private fail(child: ChildProcessWithoutNullStreams, error: Error): void {
    if (this.child !== child) return;
    this.child = null;
    this.ready = false;
    this.rejectPending(error);
    if (!this.stopped)
      this.events.emit("message", { method: "transport/error", params: { error } });
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}
