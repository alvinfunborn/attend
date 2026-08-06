import crypto from "node:crypto";
import { Worker } from "node:worker_threads";
import type { AttendConfig } from "../../config.js";
import type { RawSession } from "../types.js";
import type { TranscriptPathWriter } from "./transcript-index.js";

export interface SessionIndexSnapshot {
  epoch: string;
  revision: number;
  scannedAt: number;
  pending: boolean;
  sessions: RawSession[];
  error?: string;
  metrics?: {
    durationMs: number;
    files: number;
    leader: boolean;
    parsedBytes: number;
    parsedFiles: number;
    cacheHits: number;
  };
}

export interface SessionIndex {
  snapshot(): SessionIndexSnapshot;
  lookup(vendor: string, sessionId: string): RawSession | null;
  requestRefresh(reason?: string): void;
  subscribe(listener: (snapshot: SessionIndexSnapshot) => void): () => void;
  close(): void;
}

export interface SessionIndexWorkerConfig {
  ownerId: string;
  databaseFile: string;
  legacyCacheFile: string;
  claudeProjects: string;
  codexSessions: string;
  cursorProjects: string;
  cursorSessions: string;
  antigravityBrain: string;
  antigravityCapturedSessions: string;
  copilotSessions: string;
  copilotCapturedSessions: string;
  scanIntervalMs: number;
}

type WorkerMessage =
  | { kind: "snapshot"; snapshot: SessionIndexSnapshot }
  | { kind: "error"; error: string };

function workerEntry(): URL {
  return new URL(
    import.meta.url.endsWith(".ts") ? "./session-index-worker.ts" : "./session-index-worker.js",
    import.meta.url,
  );
}

function workerConfig(config: AttendConfig, ownerId: string): SessionIndexWorkerConfig {
  return {
    ownerId,
    databaseFile: config.sessionIndex,
    legacyCacheFile: config.scanCache,
    claudeProjects: config.claudeProjects,
    codexSessions: config.codexSessions,
    cursorProjects: config.cursorProjects,
    cursorSessions: config.cursorSessions,
    antigravityBrain: config.antigravityBrain,
    antigravityCapturedSessions: config.antigravityCapturedSessions,
    copilotSessions: config.copilotSessions,
    copilotCapturedSessions: config.copilotCapturedSessions,
    scanIntervalMs: 5_000,
  };
}

/**
 * Main-thread facade for the session catalog.
 *
 * The worker owns every provider directory walk, synchronous file read, JSONL
 * parse and SQLite transaction. HTTP handlers only touch the immutable in-memory
 * snapshot below. A failed worker is restarted, but never replaced by an inline
 * scanner.
 */
export class WorkerSessionIndex implements SessionIndex {
  private current: SessionIndexSnapshot = {
    epoch: `pending-${crypto.randomUUID()}`,
    revision: 0,
    scannedAt: 0,
    pending: true,
    sessions: [],
  };
  private readonly listeners = new Set<(snapshot: SessionIndexSnapshot) => void>();
  private readonly byProviderId = new Map<string, RawSession>();
  private readonly ownerId = `${process.pid}:${crypto.randomUUID()}`;
  private worker: Worker | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private closing = false;

  constructor(
    private readonly config: AttendConfig,
    private readonly transcriptIndex?: TranscriptPathWriter,
  ) {
    this.startWorker();
  }

  snapshot(): SessionIndexSnapshot {
    return this.current;
  }

  lookup(vendor: string, sessionId: string): RawSession | null {
    return this.byProviderId.get(`${vendor}\u0000${sessionId}`) ?? null;
  }

  requestRefresh(reason = "requested"): void {
    this.worker?.postMessage({ kind: "refresh", reason });
  }

  subscribe(listener: (snapshot: SessionIndexSnapshot) => void): () => void {
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

  private startWorker(): void {
    if (this.closing || this.worker) return;
    const entry = workerEntry();
    const worker = new Worker(entry, {
      workerData: workerConfig(this.config, this.ownerId),
      name: "attend-session-index",
      ...(entry.pathname.endsWith(".ts") ? { execArgv: ["--import", "tsx"] } : {}),
    });
    this.worker = worker;
    worker.on("message", (message: WorkerMessage) => {
      if (message.kind === "snapshot") this.applySnapshot(message.snapshot);
      else this.applyError(message.error);
    });
    worker.on("error", (error) => this.applyError(error.message));
    worker.on("exit", (code) => {
      if (this.worker === worker) this.worker = null;
      if (this.closing) return;
      if (code !== 0) this.applyError(`session index worker exited with code ${code}`);
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        this.startWorker();
      }, 1_000);
      this.restartTimer.unref?.();
    });
  }

  private applySnapshot(snapshot: SessionIndexSnapshot): void {
    // An equal (epoch, revision) is byte-identical to what we already published:
    // rebuilding the provider maps and notifying every subscriber would be pure
    // waste. A lower revision is a stale straggler. Only a newer state proceeds.
    if (snapshot.epoch === this.current.epoch && snapshot.revision <= this.current.revision) return;
    this.current = snapshot;
    this.byProviderId.clear();
    const byVendor = new Map<string, RawSession[]>();
    for (const session of snapshot.sessions) {
      if (session.sessionId)
        this.byProviderId.set(`${session.vendor}\u0000${session.sessionId}`, session);
      const sessions = byVendor.get(session.vendor) ?? [];
      sessions.push(session);
      byVendor.set(session.vendor, sessions);
    }
    if (this.transcriptIndex) {
      for (const vendor of ["claude", "codex", "cursor", "antigravity", "copilot"]) {
        this.transcriptIndex.replaceVendor(vendor, byVendor.get(vendor) ?? []);
      }
    }
    for (const listener of this.listeners) listener(snapshot);
  }

  private applyError(error: string): void {
    this.current = { ...this.current, error };
    for (const listener of this.listeners) listener(this.current);
  }
}
