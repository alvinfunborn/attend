import { Worker } from "node:worker_threads";
import type { AnalyzerContextReader, AnalyzerTranscriptContext } from "./context.js";

interface PendingContext {
  resolve: (context: AnalyzerTranscriptContext) => void;
  reject: (error: Error) => void;
}

function workerEntry(): URL {
  return new URL(
    import.meta.url.endsWith(".ts") ? "./context-worker.ts" : "./context-worker.js",
    import.meta.url,
  );
}

/**
 * Dedicated daemon-analysis worker.
 *
 * Full-transcript parsing is intentionally isolated from the bounded UI history
 * worker: a large daemon refresh must not delay opening a chat transcript.
 */
export class WorkerAnalyzerContext implements AnalyzerContextReader {
  private worker: Worker | null = null;
  private readonly pending = new Map<number, PendingContext>();
  private nextId = 1;
  private closing = false;

  constructor() {
    this.start();
  }

  readAnalyzerContext(
    file: string,
    vendor: string,
    sessionId: string,
    analysisFromAt: number | null = null,
  ): Promise<AnalyzerTranscriptContext> {
    if (!this.worker) this.start();
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("analyzer context worker is unavailable"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ kind: "read", id, file, vendor, sessionId, analysisFromAt });
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
    this.rejectPending(new Error("analyzer context worker closed"));
  }

  private start(): void {
    if (this.closing || this.worker) return;
    const entry = workerEntry();
    const worker = new Worker(entry, {
      name: "attend-analyzer-context",
      ...(entry.pathname.endsWith(".ts") ? { execArgv: ["--import", "tsx"] } : {}),
    });
    this.worker = worker;
    worker.on(
      "message",
      (message: {
        kind?: string;
        id?: number;
        context?: AnalyzerTranscriptContext;
        error?: string;
      }) => {
        if (message.kind !== "result" || typeof message.id !== "number") return;
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.context) pending.resolve(message.context);
        else pending.reject(new Error(message.error ?? "analyzer context worker failed"));
      },
    );
    worker.on("error", (error) => this.rejectPending(error));
    worker.on("exit", (code) => {
      if (this.worker === worker) this.worker = null;
      if (code !== 0)
        this.rejectPending(new Error(`analyzer context worker exited with code ${code}`));
      if (!this.closing) this.start();
    });
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}
