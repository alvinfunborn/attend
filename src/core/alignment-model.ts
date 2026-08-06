import { Worker } from "node:worker_threads";
import type { AlignmentModel } from "./alignment.js";

export interface AlignmentModelReader {
  snapshot(): AlignmentModel | null;
  requestRefresh(): void;
  subscribe(listener: (model: AlignmentModel) => void): () => void;
  close?(): void;
}

interface AlignmentWorkerConfig {
  sources: string[];
  claudeProjects: string;
}

type AlignmentWorkerMessage =
  | { kind: "model"; model: AlignmentModel }
  | { kind: "error"; error: string };

function workerEntry(): URL {
  return new URL(
    import.meta.url.endsWith(".ts") ? "./alignment-model-worker.ts" : "./alignment-model-worker.js",
    import.meta.url,
  );
}

/**
 * Stale-while-revalidate memory model.
 *
 * Directory discovery, memory-file reads, tokenization, and TF-IDF construction
 * all stay in the worker. Request/projection code only reads the latest cloned
 * Map-based model.
 */
export class WorkerAlignmentModel implements AlignmentModelReader {
  private current: AlignmentModel | null = null;
  private worker: Worker | null = null;
  private readonly listeners = new Set<(model: AlignmentModel) => void>();
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRefreshAt = 0;
  private closing = false;

  constructor(private readonly config: AlignmentWorkerConfig) {
    this.start();
  }

  snapshot(): AlignmentModel | null {
    this.requestRefresh();
    return this.current;
  }

  requestRefresh(): void {
    const now = Date.now();
    if (now - this.lastRefreshAt < 60_000) return;
    this.lastRefreshAt = now;
    this.worker?.postMessage({ kind: "refresh" });
  }

  subscribe(listener: (model: AlignmentModel) => void): () => void {
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
      name: "attend-alignment-model",
      workerData: this.config,
      ...(entry.pathname.endsWith(".ts") ? { execArgv: ["--import", "tsx"] } : {}),
    });
    this.worker = worker;
    worker.on("message", (message: AlignmentWorkerMessage) => {
      if (message.kind !== "model") return;
      this.current = message.model;
      for (const listener of this.listeners) listener(message.model);
    });
    worker.on("error", () => {
      // Keep serving the last good model; exit handling restarts the worker.
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
