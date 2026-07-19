import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ChatAttachment, ChatReference } from "../chat/driver.js";
import { configureStateDatabase } from "./state-database.js";
import type { CommentAnchorData } from "./ui-state.js";

export type ScheduleKind = "message" | "session" | "comment";
export type ScheduleRunStatus =
  | "scheduled"
  | "claimed"
  | "dispatched"
  | "blocked"
  | "uncertain"
  | "cancelled";

interface SchedulePayloadBase {
  cwd: string;
  vendor: string;
  text: string;
}

export interface ScheduledMessagePayload extends SchedulePayloadBase {
  kind: "message";
  sessionId: string;
  attachments?: ChatAttachment[];
  references?: ChatReference[];
  /** Frozen when the job is created, just like an ordinary persisted queue turn. */
  referenceContext?: string;
  goal?: boolean;
}

export interface ScheduledSessionPayload extends SchedulePayloadBase {
  kind: "session";
  /** Omitted by older one-shot records; absence means a brand-new session. */
  mode?: "new" | "fork";
  clientSessionId: string;
  attachments?: ChatAttachment[];
  references?: ChatReference[];
  /** Frozen Pin text and fork-point transcript, never exposed through the public API. */
  referenceContext?: string;
  contextMessages?: unknown[];
  parentSessionId?: string;
  parentVendor?: string;
  model?: string;
  effort?: string;
  speed?: string;
  goal?: boolean;
  tags?: string[];
}

export interface ScheduledCommentPayload extends SchedulePayloadBase {
  kind: "comment";
  threadId: string;
  parentSessionId: string;
  anchorKey: string;
  anchorText: string;
  anchorData?: CommentAnchorData;
  contextMessages?: unknown[];
  createdWhileGenerating?: boolean;
  model?: string;
  effort?: string;
  speed?: string;
}

export type SchedulePayload =
  | ScheduledMessagePayload
  | ScheduledSessionPayload
  | ScheduledCommentPayload;

export interface ScheduledItem {
  id: string;
  jobId: string;
  kind: ScheduleKind;
  runAt: number;
  timezone: string;
  status: ScheduleRunStatus;
  payload: SchedulePayload;
  dispatchId?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

interface ScheduleRow {
  id: string;
  job_id: string;
  kind: ScheduleKind;
  run_at: number;
  timezone: string;
  status: ScheduleRunStatus;
  payload_json: string;
  dispatch_id?: string | null;
  error?: string | null;
  created_at: number;
  updated_at: number;
}

const ACTIVE_STATUSES: ScheduleRunStatus[] = ["scheduled", "claimed", "blocked", "uncertain"];

function rowToItem(row: ScheduleRow): ScheduledItem {
  return {
    id: row.id,
    jobId: row.job_id,
    kind: row.kind,
    runAt: row.run_at,
    timezone: row.timezone,
    status: row.status,
    payload: JSON.parse(row.payload_json) as SchedulePayload,
    ...(row.dispatch_id ? { dispatchId: row.dispatch_id } : {}),
    ...(row.error ? { error: row.error } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Durable one-shot jobs plus occurrence rows; recurrence can add more runs per job later. */
export class ScheduleStore {
  private readonly db: DatabaseSync;

  constructor(databaseFile: string) {
    fs.mkdirSync(path.dirname(databaseFile), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(databaseFile);
    configureStateDatabase(this.db);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schedule_jobs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('message', 'session', 'comment')),
        timezone TEXT NOT NULL,
        schedule_json TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        cwd TEXT NOT NULL,
        vendor TEXT NOT NULL,
        target_key TEXT NOT NULL,
        enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS schedule_runs (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        due_at INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('scheduled', 'claimed', 'dispatched', 'blocked', 'uncertain', 'cancelled')),
        lease_owner TEXT,
        lease_expires_at INTEGER,
        dispatch_id TEXT,
        error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (job_id, due_at)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS schedule_runs_due_idx
        ON schedule_runs(status, due_at);
      CREATE INDEX IF NOT EXISTS schedule_jobs_target_idx
        ON schedule_jobs(target_key, enabled);
    `);
  }

  close(): void {
    this.db.close();
  }

  create(
    payload: SchedulePayload,
    runAt: number,
    timezone: string,
    ids: { jobId?: string; runId?: string } = {},
  ): ScheduledItem {
    const now = Date.now();
    const jobId = ids.jobId ?? crypto.randomUUID();
    const runId = ids.runId ?? crypto.randomUUID();
    const targetKey =
      payload.kind === "message"
        ? payload.sessionId
        : payload.kind === "session"
          ? payload.clientSessionId
          : payload.threadId;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          `INSERT INTO schedule_jobs
           (id, kind, timezone, schedule_json, payload_json, cwd, vendor, target_key, enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        )
        .run(
          jobId,
          payload.kind,
          timezone,
          JSON.stringify({ type: "once", runAt }),
          JSON.stringify(payload),
          payload.cwd,
          payload.vendor,
          targetKey,
          now,
          now,
        );
      this.db
        .prepare(
          `INSERT INTO schedule_runs
           (id, job_id, due_at, status, created_at, updated_at)
           VALUES (?, ?, ?, 'scheduled', ?, ?)`,
        )
        .run(runId, jobId, runAt, now, now);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    const item = this.get(runId);
    if (!item) throw new Error("scheduled run was not created");
    return item;
  }

  get(runId: string): ScheduledItem | null {
    const row = this.db
      .prepare(
        `SELECT r.id, r.job_id, j.kind, r.due_at AS run_at, j.timezone, r.status,
                j.payload_json, r.dispatch_id, r.error, r.created_at, r.updated_at
         FROM schedule_runs r JOIN schedule_jobs j ON j.id = r.job_id
         WHERE r.id = ?`,
      )
      .get(runId) as ScheduleRow | undefined;
    return row ? rowToItem(row) : null;
  }

  list(options: { includeRecentlyDispatched?: boolean } = {}): ScheduledItem[] {
    const statuses = [...ACTIVE_STATUSES];
    const dispatchedSince = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const rows = this.db
      .prepare(
        `SELECT r.id, r.job_id, j.kind, r.due_at AS run_at, j.timezone, r.status,
                j.payload_json, r.dispatch_id, r.error, r.created_at, r.updated_at
         FROM schedule_runs r JOIN schedule_jobs j ON j.id = r.job_id
         WHERE j.enabled = 1 AND (r.status IN (${statuses.map(() => "?").join(",")})
           ${options.includeRecentlyDispatched ? "OR (r.status = 'dispatched' AND j.kind IN ('session', 'comment') AND r.updated_at >= ?)" : ""})
         ORDER BY r.due_at ASC, r.created_at ASC`,
      )
      .all(
        ...statuses,
        ...(options.includeRecentlyDispatched ? [dispatchedSince] : []),
      ) as unknown as ScheduleRow[];
    return rows.map(rowToItem);
  }

  update(runId: string, patch: { runAt?: number; text?: string }): ScheduledItem | null {
    const current = this.get(runId);
    if (!current || current.status === "dispatched" || current.status === "cancelled") return null;
    const now = Date.now();
    const payload = {
      ...current.payload,
      ...(patch.text !== undefined ? { text: patch.text } : {}),
    };
    const dueAt = patch.runAt ?? current.runAt;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          "UPDATE schedule_jobs SET payload_json = ?, schedule_json = ?, updated_at = ? WHERE id = ?",
        )
        .run(
          JSON.stringify(payload),
          JSON.stringify({ type: "once", runAt: dueAt }),
          now,
          current.jobId,
        );
      this.db
        .prepare(
          `UPDATE schedule_runs
           SET due_at = ?, status = 'scheduled', lease_owner = NULL, lease_expires_at = NULL,
               error = NULL, updated_at = ? WHERE id = ?`,
        )
        .run(dueAt, now, runId);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.get(runId);
  }

  cancel(runId: string): ScheduledItem | null {
    const current = this.get(runId);
    if (!current || current.status === "dispatched") return null;
    const now = Date.now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("UPDATE schedule_jobs SET enabled = 0, updated_at = ? WHERE id = ?")
        .run(now, current.jobId);
      this.db
        .prepare(
          `UPDATE schedule_runs SET status = 'cancelled', lease_owner = NULL,
           lease_expires_at = NULL, updated_at = ? WHERE id = ?`,
        )
        .run(now, runId);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.get(runId);
  }

  markExpiredClaimsUncertain(now = Date.now()): number {
    return Number(
      this.db
        .prepare(
          `UPDATE schedule_runs SET status = 'uncertain',
             error = 'Attend stopped while this scheduled action was dispatching. Review and retry it.',
             lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
           WHERE status = 'claimed' AND lease_expires_at <= ?`,
        )
        .run(now, now).changes,
    );
  }

  /** Claim one known due run immediately, used by the explicit Run now action. */
  claim(runId: string, owner: string, now = Date.now(), leaseMs = 120_000): ScheduledItem | null {
    const changed = this.db
      .prepare(
        `UPDATE schedule_runs SET status = 'claimed', lease_owner = ?, lease_expires_at = ?,
           error = NULL, updated_at = ?
         WHERE id = ? AND status = 'scheduled' AND due_at <= ?`,
      )
      .run(owner, now + leaseMs, now, runId, now).changes;
    return changed ? this.get(runId) : null;
  }

  /**
   * Reserve a future session run while its placeholder is materialized early.
   * Unlike Run now, this does not require the due time to have arrived: the
   * original opening turn remains scheduled and is retargeted after the real
   * provider session has been created.
   */
  claimForMaterialization(
    runId: string,
    owner: string,
    now = Date.now(),
    leaseMs = 120_000,
  ): ScheduledItem | null {
    const changed = this.db
      .prepare(
        `UPDATE schedule_runs SET status = 'claimed', lease_owner = ?, lease_expires_at = ?,
           error = NULL, updated_at = ?
         WHERE id = ? AND status = 'scheduled' AND EXISTS (
           SELECT 1 FROM schedule_jobs j WHERE j.id = schedule_runs.job_id AND j.kind = 'session'
         )`,
      )
      .run(owner, now + leaseMs, now, runId).changes;
    return changed ? this.get(runId) : null;
  }

  /** Restore a failed early-materialization attempt without changing its due time. */
  releaseMaterialization(runId: string, owner: string): ScheduledItem | null {
    const now = Date.now();
    const changed = this.db
      .prepare(
        `UPDATE schedule_runs SET status = 'scheduled', lease_owner = NULL,
           lease_expires_at = NULL, error = NULL, updated_at = ?
         WHERE id = ? AND status = 'claimed' AND lease_owner = ?`,
      )
      .run(now, runId, owner).changes;
    return changed ? this.get(runId) : null;
  }

  /**
   * Convert the claimed future session opener into a normal scheduled message
   * on the provider session that was just materialized.
   */
  retargetMaterializedSession(
    runId: string,
    owner: string,
    sessionId: string,
  ): ScheduledItem | null {
    const current = this.get(runId);
    if (!current || current.status !== "claimed" || current.payload.kind !== "session") return null;
    const source = current.payload;
    const payload: ScheduledMessagePayload = {
      kind: "message",
      sessionId,
      cwd: source.cwd,
      vendor: source.vendor,
      text: source.text,
      attachments: source.attachments,
      references: source.references,
      referenceContext: source.referenceContext,
      ...(source.goal ? { goal: true } : {}),
    };
    const now = Date.now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const run = this.db
        .prepare(
          `UPDATE schedule_runs SET status = 'scheduled', lease_owner = NULL,
             lease_expires_at = NULL, error = NULL, updated_at = ?
           WHERE id = ? AND status = 'claimed' AND lease_owner = ?`,
        )
        .run(now, runId, owner);
      if (!run.changes) {
        this.db.exec("ROLLBACK");
        return null;
      }
      this.db
        .prepare(
          `UPDATE schedule_jobs SET kind = 'message', payload_json = ?, cwd = ?, vendor = ?,
             target_key = ?, updated_at = ? WHERE id = ?`,
        )
        .run(JSON.stringify(payload), payload.cwd, payload.vendor, sessionId, now, current.jobId);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.get(runId);
  }

  claimDue(
    owner: string,
    eligible: (item: ScheduledItem) => boolean,
    now = Date.now(),
    leaseMs = 120_000,
  ): ScheduledItem | null {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const rows = this.db
        .prepare(
          `SELECT r.id, r.job_id, j.kind, r.due_at AS run_at, j.timezone, r.status,
                  j.payload_json, r.dispatch_id, r.error, r.created_at, r.updated_at
           FROM schedule_runs r JOIN schedule_jobs j ON j.id = r.job_id
           WHERE j.enabled = 1 AND r.status = 'scheduled' AND r.due_at <= ?
           ORDER BY r.due_at ASC LIMIT 100`,
        )
        .all(now) as unknown as ScheduleRow[];
      const candidate = rows.map(rowToItem).find(eligible);
      if (!candidate) {
        this.db.exec("COMMIT");
        return null;
      }
      const changed = this.db
        .prepare(
          `UPDATE schedule_runs SET status = 'claimed', lease_owner = ?, lease_expires_at = ?,
             error = NULL, updated_at = ? WHERE id = ? AND status = 'scheduled'`,
        )
        .run(owner, now + leaseMs, now, candidate.id).changes;
      this.db.exec("COMMIT");
      return changed ? this.get(candidate.id) : null;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  complete(runId: string, owner: string, dispatchId?: string): ScheduledItem | null {
    return this.finish(runId, owner, "dispatched", dispatchId, undefined);
  }

  block(runId: string, owner: string, error: string): ScheduledItem | null {
    return this.finish(runId, owner, "blocked", undefined, error);
  }

  private finish(
    runId: string,
    owner: string,
    status: "dispatched" | "blocked",
    dispatchId?: string,
    error?: string,
  ): ScheduledItem | null {
    const now = Date.now();
    const changed = this.db
      .prepare(
        `UPDATE schedule_runs SET status = ?, dispatch_id = ?, error = ?, lease_owner = NULL,
           lease_expires_at = NULL, updated_at = ?
         WHERE id = ? AND status = 'claimed' AND lease_owner = ?`,
      )
      .run(status, dispatchId ?? null, error ?? null, now, runId, owner).changes;
    return changed ? this.get(runId) : null;
  }
}
