import { parentPort } from "node:worker_threads";
import { TranscriptHistoryCache } from "./history-cache.js";

if (!parentPort) throw new Error("history worker requires a parent port");

const history = new TranscriptHistoryCache();

parentPort.on(
  "message",
  async (message: {
    kind?: string;
    id?: number;
    file?: string;
    vendor?: string;
    limit?: number;
  }) => {
    if (message.kind === "close") {
      parentPort?.close();
      return;
    }
    if (message.kind === "version" && typeof message.id === "number" && message.file) {
      try {
        parentPort?.postMessage({
          kind: "version",
          id: message.id,
          version: await history.version(message.file),
        });
      } catch (error) {
        parentPort?.postMessage({
          kind: "version",
          id: message.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }
    if (message.kind !== "read" || typeof message.id !== "number" || !message.file) return;
    try {
      const snapshot = await history.read(message.file, message.vendor, message.limit);
      parentPort?.postMessage({ kind: "result", id: message.id, snapshot });
    } catch (error) {
      parentPort?.postMessage({
        kind: "result",
        id: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
