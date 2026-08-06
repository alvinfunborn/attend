import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { RawSession } from "../types.js";
import type { PersistedScanCache } from "./scan-cache.js";
import type { SessionIndexSnapshot } from "./session-index.js";

const LEASE_MS = 10 * 60_000;

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

  constructor(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(file);
    this.db.exec(`
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
      const sessionsJson = JSON.stringify(sessions);
      const changed = sessionsJson !== current.sessions_json;
      const revision = current.revision + (changed ? 1 : 0);
      this.db
        .prepare(
          `UPDATE session_index
           SET revision = ?, scanned_at = ?, sessions_json = ?
           WHERE id = 1`,
        )
        .run(revision, scannedAt, sessionsJson);
      const writeCache = this.db.prepare(
        `INSERT INTO session_scan_caches (vendor, cache_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(vendor) DO UPDATE SET
           cache_json = excluded.cache_json,
           updated_at = excluded.updated_at`,
      );
      for (const [vendor, cache] of Object.entries(caches)) {
        writeCache.run(vendor, JSON.stringify(cache), scannedAt);
      }
      this.db
        .prepare(
          "UPDATE session_index_lease SET expires_at = ? WHERE id = 1 AND owner = ? AND token = ?",
        )
        .run(Date.now() + LEASE_MS, owner, token);
      this.db.exec("COMMIT");
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
}
