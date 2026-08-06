import { parentPort, workerData } from "node:worker_threads";
import type { RawSession } from "./types.js";
import { WorkEventStore, WorkEventStoreBusyError } from "./work-events.js";

if (!parentPort) throw new Error("work prompt index worker requires a parent port");

const config = workerData as { databaseFile: string };
const store = new WorkEventStore(config.databaseFile);
const queue: Array<{ id: number; sessions: RawSession[] }> = [];
let running = false;
let closed = false;

function drain(): void {
  if (closed || running) return;
  const item = queue.shift();
  if (!item) return;
  running = true;
  let retryDelayed = false;
  try {
    store.backfillPrompts(item.sessions, { lockTimeoutMs: 100 });
    parentPort?.postMessage({ kind: "synced", id: item.id });
  } catch (error) {
    if (error instanceof WorkEventStoreBusyError) {
      queue.unshift(item);
      retryDelayed = true;
      setTimeout(drain, 250).unref?.();
    } else {
      parentPort?.postMessage({
        kind: "error",
        id: item.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } finally {
    running = false;
    if (queue.length && !retryDelayed) setImmediate(drain);
  }
}

parentPort.on("message", (message: { kind?: string; id?: number; sessions?: RawSession[] }) => {
  if (
    message.kind === "sync" &&
    typeof message.id === "number" &&
    Array.isArray(message.sessions)
  ) {
    queue.push({ id: message.id, sessions: message.sessions });
    setImmediate(drain);
  } else if (message.kind === "close") {
    closed = true;
    queue.length = 0;
    store.close();
    parentPort?.close();
  }
});
