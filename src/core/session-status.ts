import fs from "node:fs";
import path from "node:path";

export type SessionAttentionState = "read" | "seen" | "unread";
export type StoredSessionAttentionState = Exclude<SessionAttentionState, "read">;

export interface SessionStatusRecord {
  state: StoredSessionAttentionState;
  updatedAt: number | null;
}

interface SessionStatusFile {
  sessions?: Record<string, SessionStatusRecord>;
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
  private bySession = new Map<string, SessionStatusRecord>();
  private loaded = false;

  constructor(private readonly file: string) {}

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, "utf-8")) as SessionStatusFile;
      for (const [sessionId, value] of Object.entries(raw.sessions ?? {})) {
        const record = normalizeRecord(value);
        if (record) this.bySession.set(sessionId, record);
      }
    } catch {
      // missing/corrupt — start empty
    }
  }

  get(sessionId: string): SessionStatusRecord | null {
    this.load();
    const found = this.bySession.get(sessionId);
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
    this.load();
    if (state === "read") {
      this.bySession.delete(sessionId);
      this.persist();
      return null;
    }
    const record: SessionStatusRecord = {
      state,
      updatedAt: normalizeUpdatedAt(updatedAt),
    };
    this.bySession.set(sessionId, record);
    this.persist();
    return { ...record };
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(
        this.file,
        JSON.stringify({ sessions: Object.fromEntries(this.bySession) }, null, 2),
      );
    } catch {
      // best-effort persistence
    }
  }
}
