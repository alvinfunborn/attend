import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { JsonTransaction } from "./json-file.js";
import { DATABASE_MAINTENANCE_INTERVAL_MS } from "./retention-policy.js";

const BUSY_TIMEOUT_MS = 10_000;
const WAL_SIZE_LIMIT_BYTES = 4 * 1024 * 1024;

type Normalizer<T> = (value: unknown) => T;

export function configureStateDatabase(db: DatabaseSync): void {
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  db.exec(`
    PRAGMA auto_vacuum = INCREMENTAL;
    PRAGMA journal_mode = WAL;
    PRAGMA journal_size_limit = ${WAL_SIZE_LIMIT_BYTES};
    PRAGMA synchronous = NORMAL;
  `);
}

/** Atomically elect one process to run daily logical and physical cleanup. */
export function claimStateMaintenance(databaseFile: string, now = Date.now()): boolean {
  const db = openMaintenanceDatabase(databaseFile);
  try {
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = db
        .prepare("SELECT value FROM state_maintenance WHERE key = 'last-run-at'")
        .get() as { value: string } | undefined;
      const lastRunAt = Number(row?.value) || 0;
      if (now - lastRunAt < DATABASE_MAINTENANCE_INTERVAL_MS) {
        db.exec("COMMIT");
        return false;
      }
      db.prepare(
        `INSERT INTO state_maintenance (key, value) VALUES ('last-run-at', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).run(String(now));
      db.exec("COMMIT");
      return true;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}

/** Reclaim free pages incrementally and keep the WAL bounded without blocking readers. */
export function optimizeStateDatabase(databaseFile: string): void {
  const db = openMaintenanceDatabase(databaseFile);
  try {
    db.exec("PRAGMA optimize");
    db.exec("PRAGMA wal_checkpoint(PASSIVE)");
    db.exec("PRAGMA incremental_vacuum(256)");
  } finally {
    db.close();
  }
}

function openMaintenanceDatabase(databaseFile: string): DatabaseSync {
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databaseFile);
  configureStateDatabase(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS state_maintenance (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT
  `);
  return db;
}

/**
 * Transactional JSON document stored inside Attend's shared SQLite database.
 * The legacy JSON file is imported only when the document does not exist yet;
 * it remains untouched as a migration backup.
 */
export class SqliteDocument<T> {
  private readonly db: DatabaseSync;

  constructor(
    databaseFile: string,
    private readonly key: string,
    private readonly legacyFile: string,
    private readonly normalize: Normalizer<T>,
  ) {
    fs.mkdirSync(path.dirname(databaseFile), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(databaseFile);
    configureStateDatabase(this.db);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS state_documents (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT
    `);
    this.ensureDocument();
  }

  read(): T {
    const row = this.db.prepare("SELECT value FROM state_documents WHERE key = ?").get(this.key) as
      | { value: string }
      | undefined;
    if (!row) return this.normalize(undefined);
    try {
      return this.normalize(JSON.parse(row.value));
    } catch {
      return this.normalize(undefined);
    }
  }

  close(): void {
    this.db.close();
  }

  update<R>(mutate: (value: T) => R): R {
    return this.transact((value) => ({ result: mutate(value), changed: true }));
  }

  transact<R>(mutate: (value: T) => JsonTransaction<R>): R {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = this.read();
      const transaction = mutate(value);
      if (transaction.changed) this.write(value);
      this.db.exec("COMMIT");
      return transaction.result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private ensureDocument(): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const found = this.db.prepare("SELECT 1 FROM state_documents WHERE key = ?").get(this.key);
      if (!found) {
        let initial: T;
        try {
          initial = this.normalize(JSON.parse(fs.readFileSync(this.legacyFile, "utf8")));
        } catch {
          initial = this.normalize(undefined);
        }
        this.write(initial);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private write(value: T): void {
    this.db
      .prepare(
        `INSERT INTO state_documents (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(this.key, JSON.stringify(value), Date.now());
  }
}
