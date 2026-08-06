import { Worker } from "node:worker_threads";
import type { TranscriptHistoryReader, TranscriptHistorySnapshot } from "./history-cache.js";

interface PendingRead {
  resolve: (snapshot: TranscriptHistorySnapshot) => void;
  reject: (error: Error) => void;
}

interface PendingVersion {
  resolve: (version: string | null) => void;
  reject: (error: Error) => void;
}

function workerEntry(): URL {
  return new URL(
    import.meta.url.endsWith(".ts") ? "./history-worker.ts" : "./history-worker.js",
    import.meta.url,
  );
}

/** Worker-backed history parser. Large tail decoding and normalization never run
 * on the HTTP/SSE event loop. */
export class WorkerTranscriptHistory implements TranscriptHistoryReader {
  private worker: Worker | null = null;
  private readonly pending = new Map<number, PendingRead>();
  private readonly pendingVersions = new Map<number, PendingVersion>();
  private nextId = 1;
  private closing = false;

  constructor() {
    this.start();
  }

  read(file: string, vendor = "claude", limit = 200): Promise<TranscriptHistorySnapshot> {
    if (!this.worker) this.start();
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("history worker is unavailable"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ kind: "read", id, file, vendor, limit });
    });
  }

  version(file: string): Promise<string | null> {
    if (!this.worker) this.start();
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("history worker is unavailable"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pendingVersions.set(id, { resolve, reject });
      worker.postMessage({ kind: "version", id, file });
    });
  }

  close(): void {
    this.closing = true;
    const worker = this.worker;
    this.worker = null;
    if (worker) {
      worker.postMessage({ kind: "close" });
      const force = setTimeout(() => void worker.terminate(), 1_000);
      force.unref?.();
      worker.once("exit", () => clearTimeout(force));
    }
    this.rejectPending(new Error("history worker closed"));
  }

  private start(): void {
    if (this.closing || this.worker) return;
    const entry = workerEntry();
    const worker = new Worker(entry, {
      name: "attend-history",
      ...(entry.pathname.endsWith(".ts") ? { execArgv: ["--import", "tsx"] } : {}),
    });
    this.worker = worker;
    worker.on(
      "message",
      (message: {
        kind?: string;
        id?: number;
        snapshot?: TranscriptHistorySnapshot;
        version?: string | null;
        error?: string;
      }) => {
        if (message.kind === "version" && typeof message.id === "number") {
          const pending = this.pendingVersions.get(message.id);
          if (!pending) return;
          this.pendingVersions.delete(message.id);
          if (!message.error) pending.resolve(message.version ?? null);
          else pending.reject(new Error(message.error));
          return;
        }
        if (message.kind !== "result" || typeof message.id !== "number") return;
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.snapshot) pending.resolve(message.snapshot);
        else pending.reject(new Error(message.error ?? "history worker failed"));
      },
    );
    worker.on("error", (error) => this.rejectPending(error));
    worker.on("exit", (code) => {
      if (this.worker === worker) this.worker = null;
      if (code !== 0) this.rejectPending(new Error(`history worker exited with code ${code}`));
      if (!this.closing) this.start();
    });
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    for (const pending of this.pendingVersions.values()) pending.reject(error);
    this.pendingVersions.clear();
  }
}
