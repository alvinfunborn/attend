import { parentPort } from "node:worker_threads";
import { readAnalyzerContextFile } from "./context.js";

if (!parentPort) throw new Error("analyzer context worker requires a parent port");

let queue = Promise.resolve();

parentPort.on(
  "message",
  (message: {
    kind?: string;
    id?: number;
    file?: string;
    vendor?: string;
    sessionId?: string;
    analysisFromAt?: number | null;
  }) => {
    if (message.kind === "close") {
      void queue.finally(() => parentPort?.close());
      return;
    }
    if (
      message.kind !== "read" ||
      typeof message.id !== "number" ||
      !message.file ||
      !message.vendor ||
      !message.sessionId
    ) {
      return;
    }
    const run = queue.then(() =>
      readAnalyzerContextFile(
        message.file as string,
        message.vendor as string,
        message.sessionId as string,
        message.analysisFromAt,
      ),
    );
    // Serialize full-file jobs to cap peak memory when several daemons finish
    // together. A failed job cannot poison the following queue item.
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    void run.then(
      (context) => parentPort?.postMessage({ kind: "result", id: message.id, context }),
      (error) =>
        parentPort?.postMessage({
          kind: "result",
          id: message.id,
          error: error instanceof Error ? error.message : String(error),
        }),
    );
  },
);
