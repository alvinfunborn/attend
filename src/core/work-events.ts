import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AnalysisState } from "./daemon/cache.js";
import { WORK_EVENT_MAX_ROWS, WORK_EVENT_RETENTION_MS } from "./retention-policy.js";
import { configureStateDatabase } from "./state-database.js";
import type { RawSession } from "./types.js";

const ASSISTANT_OUTPUT_BUCKET_MS = 5 * 60_000;
const DEFAULT_BUSY_TIMEOUT_MS = 10_000;
const PRUNE_INTERVAL_MS = 60 * 60_000;

export type WorkEventKind =
  | "user_prompt"
  | "assistant_output"
  | "turn_started"
  | "turn_finished"
  | "queue_enqueued"
  | "daemon_state";

export interface WorkEvent {
  id: string;
  kind: WorkEventKind;
  at: number;
  sessionId: string;
  vendor?: string;
  queueId?: string;
  ok?: boolean;
  state?: AnalysisState | null;
  /** real user prompt text length; absent on legacy persisted events */
  chars?: number;
  source: "transcript" | "live";
}

interface WorkEventFile {
  version: 1;
  events: WorkEvent[];
}

interface EventRow {
  id: string;
  kind: WorkEventKind;
  at: number;
  session_id: string;
  vendor: string | null;
  queue_id: string | null;
  ok: number | null;
  state: AnalysisState | null;
  chars: number | null;
  source: WorkEvent["source"];
}

export class WorkEventStoreBusyError extends Error {
  constructor(
    readonly file: string,
    options?: ErrorOptions,
  ) {
    super(`timed out writing work events in ${file}`, options);
    this.name = "WorkEventStoreBusyError";
  }
}

function validAt(value: unknown): number | null {
  const at = Number(value);
  return Number.isFinite(at) && at > 0 ? Math.floor(at) : null;
}

function normalizeEvent(value: WorkEvent): WorkEvent | null {
  const at = validAt(value.at);
  const sessionId = typeof value.sessionId === "string" ? value.sessionId.trim() : "";
  if (!at || !sessionId || !value.id || !value.kind) return null;
  const chars = Math.max(0, Math.floor(Number(value.chars) || 0));
  return { ...value, at, sessionId, ...(chars ? { chars } : {}) };
}

function normalizeFile(value: unknown): WorkEventFile {
  const input = value && typeof value === "object" ? (value as Partial<WorkEventFile>) : {};
  const events: WorkEvent[] = [];
  const ids = new Set<string>();
  const assistantOutputs = new Map<string, WorkEvent>();
  for (const raw of Array.isArray(input.events) ? input.events : []) {
    const event = normalizeEvent(raw);
    if (!event) continue;
    if (event.kind === "assistant_output") {
      const id = assistantOutputId(event.sessionId, event.source, event.at);
      const existing = assistantOutputs.get(id);
      if (existing) {
        existing.chars = (existing.chars ?? 0) + (event.chars ?? 0);
        continue;
      }
      const compacted = { ...event, id, at: assistantOutputBucket(event.at) };
      assistantOutputs.set(id, compacted);
      events.push(compacted);
      ids.add(id);
      continue;
    }
    if (ids.has(event.id)) continue;
    ids.add(event.id);
    events.push(event);
  }
  return { version: 1, events };
}

function promptId(sessionId: string, at: number): string {
  return `prompt:${sessionId}:${Math.floor(at)}`;
}

function assistantOutputBucket(at: number): number {
  return Math.floor(at / ASSISTANT_OUTPUT_BUCKET_MS) * ASSISTANT_OUTPUT_BUCKET_MS;
}

function assistantOutputId(sessionId: string, source: WorkEvent["source"], at: number): string {
  return `assistant:${source}:${sessionId}:${assistantOutputBucket(at)}`;
}

function rowEvent(row: EventRow): WorkEvent {
  return {
    id: row.id,
    kind: row.kind,
    at: Number(row.at),
    sessionId: row.session_id,
    ...(row.vendor === null ? {} : { vendor: row.vendor }),
    ...(row.queue_id === null ? {} : { queueId: row.queue_id }),
    ...(row.ok === null ? {} : { ok: row.ok === 1 }),
    ...(row.state === null ? {} : { state: row.state }),
    ...(row.chars === null ? {} : { chars: Number(row.chars) }),
    source: row.source,
  };
}

function changed(result: { changes: number | bigint }): number {
  return Number(result.changes);
}

function isBusyError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "message" in error &&
    /database is (?:locked|busy)/i.test(String(error.message))
  );
}

export class WorkEventStore {
  private readonly db: DatabaseSync;
  private lastPrunedAt = 0;

  constructor(private readonly file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(file);
    configureStateDatabase(this.db);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS work_events (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        at INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        vendor TEXT,
        queue_id TEXT,
        ok INTEGER,
        state TEXT,
        chars INTEGER,
        source TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS work_events_at_idx ON work_events(at);
      CREATE INDEX IF NOT EXISTS work_events_session_kind_at_idx
        ON work_events(session_id, kind, at);
      CREATE TABLE IF NOT EXISTS work_event_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT;
    `);
    const legacyJson =
      path.basename(file) === "attend.sqlite3"
        ? path.join(path.dirname(file), "work-events.json")
        : path.extname(file) === ".sqlite3"
          ? file.replace(/\.sqlite3$/, ".json")
          : "";
    if (legacyJson) this.importJsonFile(legacyJson, "legacy-global-json-v1");
    try {
      this.transaction(() => this.prune(Date.now(), true));
    } catch (error) {
      // Retention cleanup is opportunistic; concurrent startup must still succeed.
      if (!(error instanceof WorkEventStoreBusyError)) throw error;
    }
  }

  close(): void {
    this.db.close();
  }

  list(since?: number): WorkEvent[] {
    const rows = (since === undefined
      ? this.db.prepare("SELECT * FROM work_events ORDER BY at, id").all()
      : this.db
          .prepare("SELECT * FROM work_events WHERE at >= ? ORDER BY at, id")
          .all(since)) as unknown as EventRow[];
    return rows.map(rowEvent);
  }

  record(
    event: Omit<WorkEvent, "id"> & { id?: string },
    opts: { dedupeWithinMs?: number } = {},
  ): WorkEvent {
    const at = validAt(event.at) ?? Date.now();
    const dedupeWithinMs = Math.max(0, opts.dedupeWithinMs ?? 0);
    return this.transaction(() => {
      if (dedupeWithinMs > 0) {
        const duplicate = this.db
          .prepare(
            `SELECT * FROM work_events
             WHERE kind = ? AND session_id = ? AND at BETWEEN ? AND ?
             ORDER BY at DESC LIMIT 1`,
          )
          .get(event.kind, event.sessionId, at - dedupeWithinMs, at + dedupeWithinMs) as
          | unknown
          | undefined;
        if (duplicate) return rowEvent(duplicate as EventRow);
      }

      const assistantOutput = event.kind === "assistant_output";
      const persistedAt = assistantOutput ? assistantOutputBucket(at) : at;
      const id =
        event.id ??
        (assistantOutput
          ? assistantOutputId(event.sessionId, event.source, persistedAt)
          : `${event.kind}:${crypto.randomUUID()}`);
      const normalized = normalizeEvent({ ...event, id, at: persistedAt });
      if (!normalized) throw new Error("invalid work event");
      const sql = assistantOutput
        ? `INSERT INTO work_events
             (id, kind, at, session_id, vendor, queue_id, ok, state, chars, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             chars = COALESCE(work_events.chars, 0) + COALESCE(excluded.chars, 0),
             vendor = COALESCE(excluded.vendor, work_events.vendor)
           RETURNING *`
        : `INSERT INTO work_events
             (id, kind, at, session_id, vendor, queue_id, ok, state, chars, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET id = excluded.id
           RETURNING *`;
      const row = this.db.prepare(sql).get(...eventValues(normalized)) as unknown as EventRow;
      this.prune(Date.now());
      return rowEvent(row);
    });
  }

  backfillPrompts(sessions: RawSession[], opts: { lockTimeoutMs?: number } = {}): number {
    return this.transaction(() => {
      let added = 0;
      const nearbyLivePrompt = this.db.prepare(
        `SELECT id, chars FROM work_events
         WHERE source = 'live' AND kind = 'user_prompt' AND session_id = ?
           AND at BETWEEN ? AND ?
         ORDER BY at DESC LIMIT 1`,
      );
      const enrichLivePrompt = this.db.prepare(
        "UPDATE work_events SET chars = ? WHERE id = ? AND COALESCE(chars, 0) = 0",
      );
      const insertPrompt = this.db.prepare(
        `INSERT OR IGNORE INTO work_events
           (id, kind, at, session_id, vendor, chars, source)
         VALUES (?, 'user_prompt', ?, ?, ?, ?, 'transcript')`,
      );
      const hasLiveOutput = this.db.prepare("SELECT 1 FROM work_events WHERE id = ?");
      const upsertTranscriptOutput = this.db.prepare(
        `INSERT INTO work_events (id, kind, at, session_id, vendor, chars, source)
         VALUES (?, 'assistant_output', ?, ?, ?, ?, 'transcript')
         ON CONFLICT(id) DO UPDATE SET chars = excluded.chars, vendor = excluded.vendor
         WHERE COALESCE(work_events.chars, 0) != excluded.chars`,
      );

      for (const session of sessions) {
        if (!session.sessionId) continue;
        const promptActivity = session.userPromptActivity?.length
          ? session.userPromptActivity
          : (session.userPromptTs ?? []).map((at) => ({ at, chars: 0 }));
        for (const prompt of promptActivity) {
          const at = validAt(prompt.at);
          if (!at) continue;
          const live = nearbyLivePrompt.get(session.sessionId, at - 5_000, at + 5_000) as
            | { id: string; chars: number | null }
            | undefined;
          const chars = Math.max(0, Math.floor(prompt.chars));
          if (live) {
            if (!live.chars && chars > 0) added += changed(enrichLivePrompt.run(chars, live.id));
            continue;
          }
          added += changed(
            insertPrompt.run(
              promptId(session.sessionId, at),
              at,
              session.sessionId,
              session.vendor,
              chars || null,
            ),
          );
        }

        const outputBuckets = new Map<number, number>();
        for (const output of session.assistantTextActivity ?? []) {
          const at = validAt(output.at);
          if (!at || output.chars <= 0) continue;
          const bucket = assistantOutputBucket(at);
          outputBuckets.set(bucket, (outputBuckets.get(bucket) ?? 0) + Math.floor(output.chars));
        }
        for (const [at, chars] of outputBuckets) {
          const transcriptId = assistantOutputId(session.sessionId, "transcript", at);
          const liveId = assistantOutputId(session.sessionId, "live", at);
          if (hasLiveOutput.get(liveId)) continue;
          added += changed(
            upsertTranscriptOutput.run(transcriptId, at, session.sessionId, session.vendor, chars),
          );
        }
      }
      this.prune(Date.now());
      return added;
    }, opts.lockTimeoutMs);
  }

  /** Idempotently import a legacy JSON ledger, retaining the source as a backup. */
  importJsonFile(sourceFile: string, migrationKey = `json:${path.resolve(sourceFile)}`): number {
    if (!fs.existsSync(sourceFile)) return 0;
    if (this.db.prepare("SELECT 1 FROM work_event_meta WHERE key = ?").get(migrationKey)) return 0;
    const data = normalizeFile(JSON.parse(fs.readFileSync(sourceFile, "utf8")));
    return this.transaction(() => {
      const insert = this.db.prepare(
        `INSERT OR IGNORE INTO work_events
           (id, kind, at, session_id, vendor, queue_id, ok, state, chars, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      let imported = 0;
      for (const event of data.events) imported += changed(insert.run(...eventValues(event)));
      this.db
        .prepare("INSERT OR REPLACE INTO work_event_meta (key, value) VALUES (?, ?)")
        .run(
          migrationKey,
          JSON.stringify({ sourceFile: path.resolve(sourceFile), at: Date.now() }),
        );
      return imported;
    });
  }

  private transaction<R>(operation: () => R, timeoutMs = DEFAULT_BUSY_TIMEOUT_MS): R {
    this.db.exec(`PRAGMA busy_timeout = ${Math.max(0, Math.floor(timeoutMs))}`);
    try {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const result = operation();
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    } catch (error) {
      if (isBusyError(error)) throw new WorkEventStoreBusyError(this.file, { cause: error });
      throw error;
    } finally {
      this.db.exec(`PRAGMA busy_timeout = ${DEFAULT_BUSY_TIMEOUT_MS}`);
    }
  }

  private prune(now: number, force = false): void {
    if (!force && now - this.lastPrunedAt < PRUNE_INTERVAL_MS) return;
    this.db.prepare("DELETE FROM work_events WHERE at < ?").run(now - WORK_EVENT_RETENTION_MS);
    this.db.exec(`
      DELETE FROM work_events WHERE id IN (
        SELECT id FROM work_events ORDER BY at DESC, id DESC LIMIT -1 OFFSET ${WORK_EVENT_MAX_ROWS}
      )
    `);
    this.lastPrunedAt = now;
  }
}

function eventValues(event: WorkEvent): Array<string | number | null> {
  return [
    event.id,
    event.kind,
    event.at,
    event.sessionId,
    event.vendor ?? null,
    event.queueId ?? null,
    event.ok === undefined ? null : event.ok ? 1 : 0,
    event.state ?? null,
    event.chars ?? null,
    event.source,
  ];
}
