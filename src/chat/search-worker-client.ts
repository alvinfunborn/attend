import { Worker } from "node:worker_threads";
import type { RawSession } from "../core/types.js";
import type { SessionSearch } from "./search-service.js";
import type { SessionSearchResult } from "./search.js";

interface PendingSearch {
  resolve: (results: SessionSearchResult[]) => void;
  reject: (error: Error) => void;
}

function workerEntry(): URL {
  return new URL(
    import.meta.url.endsWith(".ts") ? "./search-worker.ts" : "./search-worker.js",
    import.meta.url,
  );
}

export class WorkerSessionSearch implements SessionSearch {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, PendingSearch>();
  private closing = false;

  constructor(private readonly databaseFile = ":memory:") {
    this.start();
  }

  sync(sessions: RawSession[]): void {
    if (!this.worker) this.start();
    this.worker?.postMessage({ kind: "sync", sessions });
  }

  search(
    sessions: RawSession[],
    query: string,
    opts?: { maxResults?: number; maxHitsPerSession?: number },
  ): Promise<SessionSearchResult[]> {
    if (!this.worker) this.start();
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("search worker is unavailable"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ kind: "search", id, sessions, query, opts });
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
    this.rejectPending(new Error("search worker closed"));
  }

  private start(): void {
    if (this.closing || this.worker) return;
    const entry = workerEntry();
    const worker = new Worker(entry, {
      name: "attend-search",
      workerData: { databaseFile: this.databaseFile },
      ...(entry.pathname.endsWith(".ts") ? { execArgv: ["--import", "tsx"] } : {}),
    });
    this.worker = worker;
    worker.on(
      "message",
      (message: {
        kind?: string;
        id?: number;
        results?: SessionSearchResult[];
        error?: string;
      }) => {
        if (message.kind !== "result" || typeof message.id !== "number") return;
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.results) pending.resolve(message.results);
        else pending.reject(new Error(message.error ?? "search worker failed"));
      },
    );
    worker.on("error", (error) => this.rejectPending(error));
    worker.on("exit", (code) => {
      if (this.worker === worker) this.worker = null;
      if (code !== 0) this.rejectPending(new Error(`search worker exited with code ${code}`));
      if (!this.closing) this.start();
    });
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}
