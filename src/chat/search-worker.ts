import { parentPort, workerData } from "node:worker_threads";
import type { RawSession } from "../core/types.js";
import { PersistentTranscriptSearchIndex } from "./search-index.js";

if (!parentPort) throw new Error("search worker requires a parent port");

const index = new PersistentTranscriptSearchIndex(
  (workerData as { databaseFile?: string } | undefined)?.databaseFile,
);

parentPort.on(
  "message",
  (message: {
    kind?: string;
    id?: number;
    sessions?: RawSession[];
    query?: string;
    opts?: { maxResults?: number; maxHitsPerSession?: number };
  }) => {
    if (message.kind === "close") {
      index.close();
      parentPort?.close();
      return;
    }
    if (message.kind === "sync" && Array.isArray(message.sessions)) {
      try {
        index.sync(message.sessions);
      } catch {
        // A background refresh is best-effort; an explicit search retries.
      }
      return;
    }
    if (
      message.kind !== "search" ||
      typeof message.id !== "number" ||
      !Array.isArray(message.sessions) ||
      typeof message.query !== "string"
    )
      return;
    try {
      parentPort?.postMessage({
        kind: "result",
        id: message.id,
        results: index.search(message.sessions, message.query, message.opts),
      });
    } catch (error) {
      parentPort?.postMessage({
        kind: "result",
        id: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
