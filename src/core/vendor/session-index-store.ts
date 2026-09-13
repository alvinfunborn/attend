import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { RawSession } from "../types.js";
import type { PersistedScanCache } from "./scan-cache.js";
import {
  type PreparedSessionIndexChange,
  type SessionIndexDelta,
  type SessionIndexIdentity,
  prepareSessionIndexChange,
} from "./session-index-protocol.js";
import type { SessionIndexSnapshot } from "./session-index.js";

const LEASE_MS = 10 * 60_000;
const LEASE_RENEW_WINDOW_MS = LEASE_MS / 2;

type CacheMap = Record<string, PersistedScanCache>;

interface IndexRow {
  epoch: string;
  revision: number;
  scanned_at: number;
  sessions_json: string;
}

interface LeaseRow {
  owner: string;
  token: number;
  expires_at: number;
}

interface DeltaRow {
  epoch: string;
  base_revision: number;
  revision: number;
  scanned_at: number;
  upserts_json: string;
  removed_json: string;
}

function ownerProcessAlive(owner: string): boolean {
  const match = /^(\d+):/.exec(owner);
  if (!match) return true;
  const pid = Number(match[1]);
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    return code !== "ESRCH" && code !== "EINVAL";
  }
}

export class SessionIndexStore {
  private readonly db: DatabaseSync;
  private lastMaintenanceAt = 0;

  constructor(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA auto_vacuum = INCREMENTAL;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 1000;
      PRAGMA journal_size_limit = 8388608;
      CREATE TABLE IF NOT EXISTS session_index (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        epoch TEXT NOT NULL,
        revision INTEGER NOT NULL,
        scanned_at INTEGER NOT NULL,
        sessions_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS session_scan_caches (
        vendor TEXT PRIMARY KEY,
        cache_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS session_index_lease (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        owner TEXT NOT NULL,
        token INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS session_index_deltas (
        epoch TEXT NOT NULL,
        revision INTEGER NOT NULL,
        base_revision INTEGER NOT NULL,
        scanned_at INTEGER NOT NULL,
        upserts_json TEXT NOT NULL,
        removed_json TEXT NOT NULL,
        PRIMARY KEY (epoch, revision)
      ) STRICT;
    `);
    this.db
      .prepare(
        `INSERT OR IGNORE INTO session_index
         (id, epoch, revision, scanned_at, sessions_json)
         VALUES (1, ?, 0, 0, '[]')`,
      )
      .run(crypto.randomUUID());
  }

  readSnapshot(): SessionIndexSnapshot {
    const row = this.db
      .prepare("SELECT epoch, revision, scanned_at, sessions_json FROM session_index WHERE id = 1")
      .get() as unknown as IndexRow;
    let sessions: RawSession[] = [];
    try {
      const parsed = JSON.parse(row.sessions_json) as unknown;
      if (Array.isArray(parsed)) sessions = parsed as RawSession[];
    } catch {
      // A corrupt snapshot is treated as a cold index. The next leader scan
      // replaces it atomically.
    }
    return {
      epoch: row.epoch,
      revision: row.revision,
      scannedAt: row.scanned_at,
      pending: row.revision === 0,
      sessions,
    };
  }

  /** Read only the tiny catalog identity; this is the follower's one-second hot path. */
  readIdentity(): SessionIndexIdentity {
    const row = this.db
      .prepare("SELECT epoch, revision, scanned_at FROM session_index WHERE id = 1")
      .get() as unknown as Omit<IndexRow, "sessions_json">;
    return {
      epoch: row.epoch,
      revision: row.revision,
      scannedAt: row.scanned_at,
      pending: row.revision === 0,
    };
  }

  /**
   * Read a consecutive revision range from the compact change journal. A missing
   * entry means this follower fell behind retention and must fetch one full snapshot.
   */
  readDeltas(
    epoch: string,
    afterRevision: number,
    throughRevision: number,
  ): SessionIndexDelta[] | null {
    if (throughRevision <= afterRevision) return [];
    const rows = this.db
      .prepare(
        `SELECT epoch, base_revision, revision, scanned_at, upserts_json, removed_json
         FROM session_index_deltas
         WHERE epoch = ? AND revision > ? AND revision <= ?
         ORDER BY revision`,
      )
      .all(epoch, afterRevision, throughRevision) as unknown as DeltaRow[];
    const out: SessionIndexDelta[] = [];
    let expectedBase = afterRevision;
    for (const row of rows) {
      if (row.base_revision !== expectedBase || row.revision !== expectedBase + 1) return null;
      try {
        const upserts = JSON.parse(row.upserts_json) as unknown;
        const removed = JSON.parse(row.removed_json) as unknown;
        if (!Array.isArray(upserts) || !Array.isArray(removed)) return null;
        out.push({
          epoch: row.epoch,
          baseRevision: row.base_revision,
          revision: row.revision,
          scannedAt: row.scanned_at,
          pending: false,
          upserts: upserts as RawSession[],
          removed: removed as SessionIndexDelta["removed"],
        });
      } catch {
        return null;
      }
      expectedBase = row.revision;
    }
    return expectedBase === throughRevision ? out : null;
  }

  readCaches(): CacheMap {
    const rows = this.db
      .prepare("SELECT vendor, cache_json FROM session_scan_caches")
      .all() as unknown as Array<{ vendor: string; cache_json: string }>;
    const out: CacheMap = {};
    for (const row of rows) {
      try {
        out[row.vendor] = JSON.parse(row.cache_json) as PersistedScanCache;
      } catch {
        // One vendor cache may be rebuilt without invalidating the catalog.
      }
    }
    return out;
  }

  acquireLease(owner: string, now = Date.now()): number | null {
    const observed = this.db
      .prepare("SELECT owner, token, expires_at FROM session_index_lease WHERE id = 1")
      .get() as unknown as LeaseRow | undefined;
    if (observed?.owner === owner && observed.expires_at > now + LEASE_RENEW_WINDOW_MS) {
      return observed.token;
    }
    if (
      observed &&
      observed.owner !== owner &&
      observed.expires_at > now &&
      ownerProcessAlive(observed.owner)
    ) {
      return null;
    }

    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.db
        .prepare("SELECT owner, token, expires_at FROM session_index_lease WHERE id = 1")
        .get() as unknown as LeaseRow | undefined;
      if (
        current &&
        current.owner !== owner &&
        current.expires_at > now &&
        ownerProcessAlive(current.owner)
      ) {
        this.db.exec("COMMIT");
        return null;
      }
      const token = current?.owner === owner ? current.token : (current?.token ?? 0) + 1;
      this.db
        .prepare(
          `INSERT INTO session_index_lease (id, owner, token, expires_at)
           VALUES (1, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             owner = excluded.owner,
             token = excluded.token,
             expires_at = excluded.expires_at`,
        )
        .run(owner, token, now + LEASE_MS);
      this.db.exec("COMMIT");
      return token;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  commit(
    owner: string,
    token: number,
    sessions: RawSession[],
    caches: CacheMap,
    scannedAt: number,
    preparedChange?: PreparedSessionIndexChange,
  ): SessionIndexSnapshot | null {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const lease = this.db
        .prepare("SELECT owner, token, expires_at FROM session_index_lease WHERE id = 1")
        .get() as unknown as LeaseRow | undefined;
      if (!lease || lease.owner !== owner || lease.token !== token) {
        this.db.exec("ROLLBACK");
        return null;
      }
      const current = this.db
        .prepare("SELECT epoch, revision, sessions_json FROM session_index WHERE id = 1")
        .get() as unknown as { epoch: string; revision: number; sessions_json: string };
      let change = preparedChange;
      if (!change) {
        let previous: RawSession[] = [];
        try {
          const parsed = JSON.parse(current.sessions_json) as unknown;
          if (Array.isArray(parsed)) previous = parsed as RawSession[];
        } catch {
          // A corrupt prior snapshot is replaced by the current scan.
        }
        change = prepareSessionIndexChange(previous, sessions);
      }
      const changed = change.changed;
      const revision = current.revision + (changed ? 1 : 0);
      if (changed) {
        this.db
          .prepare(
            `UPDATE session_index
             SET revision = ?, scanned_at = ?, sessions_json = ?
             WHERE id = 1`,
          )
          .run(revision, scannedAt, change.sessionsJson);
        // Revision zero has no reusable base snapshot, so its "delta" is the
        // entire catalog. Do not duplicate that multi-megabyte payload in SQLite.
        if (current.revision > 0) {
          this.db
            .prepare(
              `INSERT INTO session_index_deltas
               (epoch, revision, base_revision, scanned_at, upserts_json, removed_json)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run(
              current.epoch,
              revision,
              current.revision,
              scannedAt,
              JSON.stringify(change.upserts),
              JSON.stringify(change.removed),
            );
        }
        this.db
          .prepare("DELETE FROM session_index_deltas WHERE epoch != ? OR revision < ?")
          .run(current.epoch, Math.max(0, revision - 64));
      }
      // scannedAt identifies the durable revision, not a no-op poll. An unchanged
      // scan intentionally leaves this overflow-page-backed row untouched.
      const writeCache = this.db.prepare(
        `INSERT INTO session_scan_caches (vendor, cache_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(vendor) DO UPDATE SET
           cache_json = excluded.cache_json,
           updated_at = excluded.updated_at
         WHERE session_scan_caches.cache_json IS NOT excluded.cache_json`,
      );
      for (const [vendor, cache] of Object.entries(caches)) {
        writeCache.run(vendor, JSON.stringify(cache), scannedAt);
      }
      this.db
        .prepare(
          `UPDATE session_index_lease SET expires_at = ?
           WHERE id = 1 AND owner = ? AND token = ? AND expires_at <= ?`,
        )
        .run(Date.now() + LEASE_MS, owner, token, Date.now() + LEASE_RENEW_WINDOW_MS);
      this.db.exec("COMMIT");
      this.maintainIfDue(scannedAt);
      return {
        epoch: current.epoch,
        revision,
        scannedAt,
        pending: false,
        sessions,
      };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  releaseLease(owner: string): void {
    this.db
      .prepare("UPDATE session_index_lease SET expires_at = 0 WHERE id = 1 AND owner = ?")
      .run(owner);
  }

  close(): void {
    this.db.close();
  }

  private maintainIfDue(now: number): void {
    if (now - this.lastMaintenanceAt < 24 * 60 * 60_000) return;
    this.lastMaintenanceAt = now;
    try {
      this.db.exec("PRAGMA optimize");
      this.db.exec("PRAGMA wal_checkpoint(PASSIVE)");
      this.db.exec("PRAGMA incremental_vacuum(256)");
    } catch {
      // Physical maintenance is opportunistic; the committed catalog is valid.
    }
  }
}

export interface SessionIndexCompactionResult {
  beforeBytes: number;
  afterBytes: number;
}

/**
 * One-shot, explicit compaction for indexes created before incremental vacuum was
 * enabled. Refuse while a live Attend process owns the scan lease.
 */
export function compactSessionIndexDatabase(file: string): SessionIndexCompactionResult {
  if (!fs.existsSync(file)) throw new Error(`session index does not exist: ${file}`);
  const beforeBytes = fs.statSync(file).size;
  const db = new DatabaseSync(file);
  try {
    db.exec("PRAGMA busy_timeout = 1000");
    const lease = db
      .prepare("SELECT owner, token, expires_at FROM session_index_lease WHERE id = 1")
      .get() as unknown as LeaseRow | undefined;
    if (lease && lease.expires_at > Date.now() && ownerProcessAlive(lease.owner)) {
      throw new Error("session index is in use; stop every Attend instance before compaction");
    }
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    db.exec("PRAGMA auto_vacuum = INCREMENTAL");
    db.exec("VACUUM");
    db.exec("PRAGMA optimize");
  } finally {
    db.close();
  }
  return { beforeBytes, afterBytes: fs.statSync(file).size };
}
