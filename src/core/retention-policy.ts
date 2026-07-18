export const DAY_MS = 86_400_000;

/** Append-only activity used for work statistics. */
export const WORK_EVENT_RETENTION_MS = 180 * DAY_MS;
export const WORK_EVENT_MAX_ROWS = 200_000;

/** Reconstructable/transient per-session documents with reliable timestamps. */
export const TRANSIENT_SESSION_RETENTION_MS = 180 * DAY_MS;

/** Read comment threads are history, not pending work; unread/failed threads never auto-expire. */
export const READ_COMMENT_RETENTION_MS = 180 * DAY_MS;

/** Only one Attend process performs physical database housekeeping per day. */
export const DATABASE_MAINTENANCE_INTERVAL_MS = DAY_MS;
