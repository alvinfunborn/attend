import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { spawnCli } from "../../../core/spawn.js";
import type { AppServerMessage, JsonRpcId } from "./types.js";

// Resume/history responses can be large, but must never approach V8's string limit.
export const MAX_APP_SERVER_MESSAGE_BYTES = 32 * 1024 * 1024;

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer?: ReturnType<typeof setTimeout>;
}

export interface AppServerRequestOptions {
  timeoutMs?: number;
}

export interface AppServerClientLike {
  start(): Promise<void>;
  request<T = unknown>(
    method: string,
    params?: unknown,
    options?: AppServerRequestOptions,
  ): Promise<T>;
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
  private closeReader: (() => void) | null = null;

  constructor(private readonly bin = "codex") {}

  start(): Promise<void> {
    if (this.ready && this.child) return Promise.resolve();
    if (this.starting) return this.starting;
    this.starting = this.open().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  async request<T = unknown>(
    method: string,
    params?: unknown,
    options: AppServerRequestOptions = {},
  ): Promise<T> {
    await this.start();
    const id = this.nextId++;
    const result = this.pendingRequest(id, method, options.timeoutMs);
    try {
      this.write({ method, id, ...(params === undefined ? {} : { params }) });
    } catch (error) {
      this.rejectRequest(id, error instanceof Error ? error : new Error(String(error)));
    }
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
    this.closeReader?.();
    this.closeReader = null;
    child?.kill("SIGTERM");
    this.rejectPending(new Error("codex app-server stopped"));
  }

  private async open(): Promise<void> {
    this.stopped = false;
    const child = spawnCli(this.bin, ["app-server", "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    this.stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      if (this.child !== child) return;
      this.stderr = (this.stderr + chunk).slice(-8000);
    });
    child.stdin.on("error", (error) => this.fail(child, error));
    child.stdout.on("error", (error) => this.fail(child, error));
    child.stderr.on("error", (error) => this.fail(child, error));
    child.once("error", (error) => this.fail(child, error));
    child.once("exit", (code, signal) => {
      const detail = this.stderr.trim();
      const suffix = detail ? `: ${detail}` : "";
      this.fail(
        child,
        new Error(`codex app-server exited (${signal ?? String(code ?? "unknown")})${suffix}`),
      );
    });
    // readline buffers an unfinished line without a bound, throwing an uncaught
    // RangeError for runaway output. Check each segment before concatenating it.
    let line = "";
    let bytes = 0;
    child.stdout.setEncoding("utf8");
    const onData = (chunk: string) => {
      let offset = 0;
      while (offset < chunk.length && this.child === child) {
        const newline = chunk.indexOf("\n", offset);
        const end = newline < 0 ? chunk.length : newline;
        const segment = chunk.slice(offset, end);
        bytes += Buffer.byteLength(segment, "utf8");
        if (bytes > MAX_APP_SERVER_MESSAGE_BYTES) {
          this.fail(
            child,
            new Error(
              `codex app-server JSONL message exceeds ${MAX_APP_SERVER_MESSAGE_BYTES} bytes; connection closed`,
            ),
          );
          return;
        }
        line += segment;
        if (newline < 0) return;
        const complete = line;
        line = "";
        bytes = 0;
        this.receive(complete);
        offset = newline + 1;
      }
    };
    const onEnd = () => {
      if (this.child !== child) return;
      if (line) this.receive(line);
      this.fail(child, new Error("codex app-server stdout closed"));
    };
    child.stdout.on("data", onData);
    child.stdout.once("end", onEnd);
    this.closeReader = () => {
      child.stdout.off("data", onData);
      child.stdout.off("end", onEnd);
      line = "";
      bytes = 0;
      child.stdout.destroy();
    };

    await this.requestDirect("initialize", {
      clientInfo: { name: "attend", title: "Attend", version: "1.0.0" },
      capabilities: { experimentalApi: true, requestAttestation: false },
    });
    if (this.child !== child) throw new Error("codex app-server closed during initialize");
    this.write({ method: "initialized" });
    this.ready = true;
  }

  private requestDirect(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const result = this.pendingRequest(id, method);
    try {
      this.write({ method, id, params });
    } catch (error) {
      this.rejectRequest(id, error instanceof Error ? error : new Error(String(error)));
    }
    return result;
  }

  private pendingRequest(id: JsonRpcId, method: string, timeoutMs?: number): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const pending: PendingRequest = { resolve, reject };
      if (timeoutMs && timeoutMs > 0) {
        pending.timer = setTimeout(() => {
          if (this.pending.get(id) !== pending) return;
          this.pending.delete(id);
          reject(new Error(`codex app-server ${method} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        pending.timer.unref?.();
      }
      this.pending.set(id, pending);
    });
  }

  private rejectRequest(id: JsonRpcId, error: Error): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    if (pending.timer) clearTimeout(pending.timer);
    pending.reject(error);
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
      if (pending.timer) clearTimeout(pending.timer);
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
    this.closeReader?.();
    this.closeReader = null;
    child.kill("SIGTERM");
    this.rejectPending(error);
    if (!this.stopped)
      this.events.emit("message", { method: "transport/error", params: { error } });
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
