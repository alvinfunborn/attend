import { Worker } from "node:worker_threads";
import type { RawSession } from "./types.js";

export interface WorkPromptIndex {
  sync(sessions: RawSession[]): void;
  subscribe(listener: () => void): () => void;
  close?(): void;
}

function workerEntry(): URL {
  return new URL(
    import.meta.url.endsWith(".ts")
      ? "./work-prompt-index-worker.ts"
      : "./work-prompt-index-worker.js",
    import.meta.url,
  );
}

/**
 * Persists transcript-derived prompt/output activity without running the
 * O(session activity) SQLite transaction on the HTTP event loop.
 */
export class WorkerWorkPromptIndex implements WorkPromptIndex {
  private worker: Worker | null = null;
  private readonly listeners = new Set<() => void>();
  private nextId = 1;
  private latest: RawSession[] | null = null;
  private closing = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly databaseFile: string) {
    this.start();
  }

  sync(sessions: RawSession[]): void {
    this.latest = sessions;
    if (!this.worker) {
      this.start();
      return;
    }
    this.worker?.postMessage({ kind: "sync", id: this.nextId++, sessions });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.closing = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    const worker = this.worker;
    this.worker = null;
    if (worker) {
      worker.postMessage({ kind: "close" });
      const force = setTimeout(() => void worker.terminate(), 1_000);
      force.unref?.();
      worker.once("exit", () => clearTimeout(force));
    }
  }

  private start(): void {
    if (this.closing || this.worker) return;
    const entry = workerEntry();
    const worker = new Worker(entry, {
      name: "attend-work-prompt-index",
      workerData: { databaseFile: this.databaseFile },
      ...(entry.pathname.endsWith(".ts") ? { execArgv: ["--import", "tsx"] } : {}),
    });
    this.worker = worker;
    if (this.latest) {
      worker.postMessage({ kind: "sync", id: this.nextId++, sessions: this.latest });
    }
    worker.on("message", (message: { kind?: string }) => {
      if (message.kind !== "synced") return;
      for (const listener of this.listeners) listener();
    });
    worker.on("error", () => {
      // The worker exit path restarts it; callers keep serving existing stats.
    });
    worker.on("exit", () => {
      if (this.worker === worker) this.worker = null;
      if (this.closing) return;
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        this.start();
      }, 1_000);
      this.restartTimer.unref?.();
    });
  }
}
