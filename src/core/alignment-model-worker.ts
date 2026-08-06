import { parentPort, workerData } from "node:worker_threads";
import { buildAlignmentModel } from "./alignment.js";
import { discoverMemorySources, loadMemoryDocs } from "./memory.js";

if (!parentPort) throw new Error("alignment model worker requires a parent port");

const config = workerData as { sources: string[]; claudeProjects: string };
let closed = false;
let running = false;
let refreshPending = true;

function build(): void {
  if (closed || running || !refreshPending) return;
  running = true;
  refreshPending = false;
  try {
    const sources = config.sources.length
      ? config.sources
      : discoverMemorySources(config.claudeProjects);
    parentPort?.postMessage({
      kind: "model",
      model: buildAlignmentModel(loadMemoryDocs(sources)),
    });
  } catch (error) {
    parentPort?.postMessage({
      kind: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    running = false;
    if (refreshPending) setImmediate(build);
  }
}

parentPort.on("message", (message: { kind?: string }) => {
  if (message.kind === "refresh") {
    refreshPending = true;
    setImmediate(build);
  } else if (message.kind === "close") {
    closed = true;
    parentPort?.close();
  }
});

setImmediate(build);
