import type { RawSession } from "../types.js";

export interface SessionIndexIdentity {
  epoch: string;
  revision: number;
  scannedAt: number;
  pending: boolean;
}

export interface SessionIndexMetrics {
  durationMs: number;
  files: number;
  leader: boolean;
  parsedBytes: number;
  parsedFiles: number;
  cacheHits: number;
}

export interface SessionIndexRemoval {
  key: string;
  path: string;
  vendor: string;
  sessionId: string | null;
}

export interface SessionIndexDelta extends SessionIndexIdentity {
  baseRevision: number;
  upserts: RawSession[];
  removed: SessionIndexRemoval[];
  metrics?: SessionIndexMetrics;
}

export interface PreparedSessionIndexChange {
  changed: boolean;
  sessionsJson: string;
  upserts: RawSession[];
  removed: SessionIndexRemoval[];
  sessionJsonByKey: Map<string, string>;
}

/** Stable identity shared by the SQLite journal, worker and main-thread facade. */
export function sessionIndexKey(session: RawSession): string {
  const identity = session.sessionId ? `id:${session.sessionId}` : `path:${session.path}`;
  return `${session.vendor}\u0000${identity}`;
}

export function sessionIndexJsonMap(sessions: RawSession[]): Map<string, string> {
  return new Map(sessions.map((session) => [sessionIndexKey(session), JSON.stringify(session)]));
}

/**
 * Compare the catalog in linear time and serialize the next durable snapshot once.
 * Provider scans normally recreate every object, so reference equality cannot be
 * used to decide whether a session actually changed.
 */
export function prepareSessionIndexChange(
  previous: RawSession[],
  next: RawSession[],
  previousJsonByKey?: ReadonlyMap<string, string>,
): PreparedSessionIndexChange {
  const before = new Map<string, { session: RawSession; json: string }>();
  for (const session of previous) {
    const key = sessionIndexKey(session);
    before.set(key, { session, json: previousJsonByKey?.get(key) ?? JSON.stringify(session) });
  }

  const seen = new Set<string>();
  const encoded: string[] = [];
  const sessionJsonByKey = new Map<string, string>();
  const upserts: RawSession[] = [];
  for (const session of next) {
    const key = sessionIndexKey(session);
    const json = JSON.stringify(session);
    encoded.push(json);
    sessionJsonByKey.set(key, json);
    seen.add(key);
    if (before.get(key)?.json !== json) upserts.push(session);
  }

  const removed: SessionIndexRemoval[] = [];
  for (const [key, entry] of before) {
    if (seen.has(key)) continue;
    removed.push({
      key,
      path: entry.session.path,
      vendor: entry.session.vendor,
      sessionId: entry.session.sessionId,
    });
  }

  return {
    changed: upserts.length > 0 || removed.length > 0,
    sessionsJson: `[${encoded.join(",")}]`,
    upserts,
    removed,
    sessionJsonByKey,
  };
}

/** Apply one or more consecutive journal entries without reparsing the full snapshot. */
export function applySessionIndexDeltas(
  sessions: RawSession[],
  deltas: SessionIndexDelta[],
): RawSession[] {
  const catalog = new Map(sessions.map((session) => [sessionIndexKey(session), session]));
  for (const delta of deltas) {
    for (const removal of delta.removed) catalog.delete(removal.key);
    for (const session of delta.upserts) catalog.set(sessionIndexKey(session), session);
  }
  return [...catalog.values()];
}

/** Collapse a consecutive journal range into one small worker message. */
export function combineSessionIndexDeltas(deltas: SessionIndexDelta[]): SessionIndexDelta | null {
  if (!deltas.length) return null;
  const first = deltas[0];
  if (!first) return null;
  const last = deltas[deltas.length - 1] ?? first;
  const upserts = new Map<string, RawSession>();
  const removed = new Map<string, SessionIndexRemoval>();
  for (const delta of deltas) {
    for (const removal of delta.removed) {
      upserts.delete(removal.key);
      removed.set(removal.key, removal);
    }
    for (const session of delta.upserts) {
      const key = sessionIndexKey(session);
      removed.delete(key);
      upserts.set(key, session);
    }
  }
  return {
    epoch: last.epoch,
    baseRevision: first.baseRevision,
    revision: last.revision,
    scannedAt: last.scannedAt,
    pending: last.pending,
    upserts: [...upserts.values()],
    removed: [...removed.values()],
    metrics: last.metrics,
  };
}
