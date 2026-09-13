import fs from "node:fs";
import { parentPort, workerData } from "node:worker_threads";
import { type SourceCaches, buildSources } from "./index.js";
import { type PersistedScanCache, ScanCache } from "./scan-cache.js";
import {
  type SessionIndexDelta,
  applySessionIndexDeltas,
  combineSessionIndexDeltas,
  prepareSessionIndexChange,
  sessionIndexJsonMap,
  sessionIndexKey,
} from "./session-index-protocol.js";
import { SessionIndexStore } from "./session-index-store.js";
import type { SessionIndexSnapshot, SessionIndexWorkerConfig } from "./session-index.js";

if (!parentPort) throw new Error("session index worker requires a parent port");

const config = workerData as SessionIndexWorkerConfig;
const owner = config.ownerId;
const store = new SessionIndexStore(config.databaseFile);
const caches: Required<SourceCaches> = {
  claude: new ScanCache(),
  codex: new ScanCache(),
  cursor: new ScanCache(),
  cursorCaptured: new ScanCache(),
  antigravity: new ScanCache(),
  copilot: new ScanCache(),
};
const cacheNames = Object.keys(caches) as Array<keyof typeof caches>;
let current = store.readSnapshot();
// Only the elected scanner keeps serialized fingerprints. Followers retain the
// materialized catalog needed by their own server, but not a second full text copy.
let currentSessionJson: Map<string, string> | null = null;
let currentLease: number | null = null;
let lastScanStartedAt = 0;
let refreshRequested = true;
let closed = false;

let lastPostedEpoch = "";
let lastPostedRevision = -1;

/**
 * Deliver a snapshot to the main thread, but only when it names a state the main
 * thread has not already seen. A scan that finds no transcript change reuses the
 * prior (epoch, revision), so re-posting it would force the HTTP event loop to
 * structured-clone-deserialize the full session array (~MBs) for a no-op. Revision
 * only advances on genuine content change (see SessionIndexStore.commit), so this
 * (epoch, revision) guard is exact, not heuristic.
 */
function post(snapshot: SessionIndexSnapshot, force = false): void {
  if (!force && snapshot.epoch === lastPostedEpoch && snapshot.revision === lastPostedRevision)
    return;
  lastPostedEpoch = snapshot.epoch;
  lastPostedRevision = snapshot.revision;
  parentPort?.postMessage({ kind: "snapshot", snapshot });
}

function postDelta(delta: SessionIndexDelta): void {
  if (delta.epoch === lastPostedEpoch && delta.revision <= lastPostedRevision) return;
  lastPostedEpoch = delta.epoch;
  lastPostedRevision = delta.revision;
  parentPort?.postMessage({ kind: "delta", delta });
}

function hydrateCaches(): void {
  let persisted = store.readCaches();
  if (!Object.keys(persisted).length) {
    try {
      const legacy = JSON.parse(fs.readFileSync(config.legacyCacheFile, "utf8")) as unknown;
      if (legacy && typeof legacy === "object")
        persisted = legacy as Record<string, PersistedScanCache>;
    } catch {
      // A missing legacy cache is a normal first boot.
    }
  }
  for (const name of cacheNames) caches[name].hydrate(persisted[name]);
}

function persistableCaches(): Record<string, PersistedScanCache> {
  return Object.fromEntries(cacheNames.map((name) => [name, caches[name].toPersistable()]));
}

function cacheMetrics(): { parsedBytes: number; parsedFiles: number; cacheHits: number } {
  return cacheNames.reduce(
    (total, name) => {
      const metrics = caches[name].metrics();
      total.parsedBytes += metrics.parsedBytes;
      total.parsedFiles += metrics.parsedFiles;
      total.cacheHits += metrics.cacheHits;
      return total;
    },
    { parsedBytes: 0, parsedFiles: 0, cacheHits: 0 },
  );
}

function publishFollowerSnapshot(): void {
  const identity = store.readIdentity();
  if (identity.epoch === current.epoch && identity.revision === current.revision) return;

  if (identity.epoch === current.epoch && identity.revision > current.revision) {
    const deltas = store.readDeltas(current.epoch, current.revision, identity.revision);
    const combined = deltas && combineSessionIndexDeltas(deltas);
    if (deltas && combined) {
      current = {
        ...identity,
        sessions: applySessionIndexDeltas(current.sessions, deltas),
      };
      if (currentSessionJson) {
        for (const delta of deltas) {
          for (const removal of delta.removed) currentSessionJson.delete(removal.key);
          for (const session of delta.upserts) {
            currentSessionJson.set(sessionIndexKey(session), JSON.stringify(session));
          }
        }
      }
      postDelta(combined);
      return;
    }
  }

  // Journal retention or an epoch replacement can leave a slow follower without
  // a complete delta chain. Full parsing is the recovery path, never the poll path.
  current = store.readSnapshot();
  if (currentSessionJson) currentSessionJson = sessionIndexJsonMap(current.sessions);
  post(current);
}

function runScan(token: number): void {
  const startedAt = Date.now();
  const before = cacheMetrics();
  lastScanStartedAt = startedAt;
  refreshRequested = false;
  try {
    const sessions = buildSources(config, caches).flatMap((source) => source.scan());
    const scannedAt = Date.now();
    const previous = current;
    const change = prepareSessionIndexChange(
      previous.sessions,
      sessions,
      currentSessionJson ?? undefined,
    );
    const committed = store.commit(owner, token, sessions, persistableCaches(), scannedAt, change);
    if (!committed) {
      currentLease = null;
      publishFollowerSnapshot();
      return;
    }
    const after = cacheMetrics();
    current = {
      ...committed,
      metrics: {
        durationMs: scannedAt - startedAt,
        files: sessions.length,
        leader: true,
        parsedBytes: after.parsedBytes - before.parsedBytes,
        parsedFiles: after.parsedFiles - before.parsedFiles,
        cacheHits: after.cacheHits - before.cacheHits,
      },
    };
    currentSessionJson = change.sessionJsonByKey;
    if (change.changed) {
      postDelta({
        epoch: current.epoch,
        baseRevision: previous.revision,
        revision: current.revision,
        scannedAt: current.scannedAt,
        pending: current.pending,
        upserts: change.upserts,
        removed: change.removed,
        metrics: current.metrics,
      });
    } else {
      post(current);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    parentPort?.postMessage({ kind: "error", error: message });
  }
}

function tick(): void {
  if (closed) return;
  try {
    const token = store.acquireLease(owner);
    if (token === null) {
      currentLease = null;
      currentSessionJson = null;
      publishFollowerSnapshot();
      return;
    }
    if (currentLease !== token) {
      currentLease = token;
      hydrateCaches();
      currentSessionJson = sessionIndexJsonMap(current.sessions);
    }
    if (
      refreshRequested ||
      lastScanStartedAt === 0 ||
      Date.now() - lastScanStartedAt >= config.scanIntervalMs
    ) {
      runScan(token);
    }
  } catch (error) {
    parentPort?.postMessage({
      kind: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

post(current);
const timer = setInterval(tick, 1_000);
timer.unref();
setImmediate(tick);

parentPort.on("message", (message: { kind?: string }) => {
  if (message.kind === "resync") {
    post(current, true);
    return;
  }
  if (message.kind === "refresh") {
    refreshRequested = true;
    setImmediate(tick);
    return;
  }
  if (message.kind === "close") {
    closed = true;
    clearInterval(timer);
    if (currentLease !== null) store.releaseLease(owner);
    store.close();
    parentPort?.close();
  }
});
