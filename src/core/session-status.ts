import { JsonFile, type JsonRepository } from "./json-file.js";
import { TRANSIENT_SESSION_RETENTION_MS } from "./retention-policy.js";
import { SqliteDocument } from "./state-database.js";

export type SessionAttentionState = "read" | "seen" | "unread";
export type StoredSessionAttentionState = Exclude<SessionAttentionState, "read">;

export interface SessionStatusRecord {
  state: StoredSessionAttentionState;
  updatedAt: number | null;
}

interface SessionStatusFile {
  sessions?: Record<string, SessionStatusRecord>;
  /** Last accepted mutation per session, including read tombstones. */
  versions?: Record<string, number>;
}

function normalizeState(input: unknown): StoredSessionAttentionState | null {
  return input === "seen" || input === "unread" ? input : null;
}

function normalizeUpdatedAt(input: unknown): number | null {
  const n = Number(input);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function normalizeRecord(
  input: Partial<SessionStatusRecord> | undefined,
): SessionStatusRecord | null {
  const state = normalizeState(input?.state);
  if (!state) return null;
  return {
    state,
    updatedAt: normalizeUpdatedAt(input?.updatedAt),
  };
}

export class SessionStatusStore {
  private readonly data: JsonRepository<Required<SessionStatusFile>>;

  constructor(file: string, databaseFile?: string) {
    this.data = databaseFile
      ? new SqliteDocument(databaseFile, "session-status", file, normalizeFile)
      : new JsonFile(file, normalizeFile);
  }

  get(sessionId: string): SessionStatusRecord | null {
    const found = this.data.read().sessions[sessionId];
    return found ? { ...found } : null;
  }

  state(sessionId: string): SessionAttentionState {
    return this.get(sessionId)?.state ?? "read";
  }

  set(
    sessionId: string,
    state: SessionAttentionState,
    updatedAt = Date.now(),
  ): SessionStatusRecord | null {
    return this.data.update((data) => {
      const incoming = normalizeUpdatedAt(updatedAt) ?? Date.now();
      const previousVersion = data.versions[sessionId] ?? 0;
      if (incoming <= previousVersion) {
        const current = data.sessions[sessionId];
        return current ? { ...current } : null;
      }
      data.versions[sessionId] = incoming;
      if (state === "read") {
        delete data.sessions[sessionId];
        return null;
      }
      const record: SessionStatusRecord = {
        state,
        updatedAt: incoming,
      };
      data.sessions[sessionId] = record;
      return { ...record };
    });
  }

  /** Remove old transient attention flags; records without a trustworthy timestamp are retained. */
  prune(now = Date.now()): number {
    const cutoff = now - TRANSIENT_SESSION_RETENTION_MS;
    return this.data.transact((data) => {
      let removed = 0;
      let changed = false;
      for (const [sessionId, record] of Object.entries(data.sessions)) {
        if (record.updatedAt !== null && record.updatedAt < cutoff) {
          delete data.sessions[sessionId];
          removed += 1;
          changed = true;
        }
      }
      for (const [sessionId, updatedAt] of Object.entries(data.versions)) {
        if (updatedAt < cutoff) {
          delete data.versions[sessionId];
          changed = true;
        }
      }
      return { result: removed, changed };
    });
  }
}

function normalizeFile(value: unknown): Required<SessionStatusFile> {
  const input = value && typeof value === "object" ? (value as SessionStatusFile) : {};
  const sessions: Record<string, SessionStatusRecord> = {};
  for (const [sessionId, value] of Object.entries(input.sessions ?? {})) {
    const record = normalizeRecord(value);
    if (record) sessions[sessionId] = record;
  }
  const versions: Record<string, number> = {};
  for (const [sessionId, value] of Object.entries(input.versions ?? {})) {
    const updatedAt = normalizeUpdatedAt(value);
    if (updatedAt !== null) versions[sessionId] = updatedAt;
  }
  for (const [sessionId, record] of Object.entries(sessions)) {
    if (record.updatedAt !== null)
      versions[sessionId] = Math.max(versions[sessionId] ?? 0, record.updatedAt);
  }
  return { sessions, versions };
}
