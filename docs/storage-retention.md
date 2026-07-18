# Storage and retention

Attend-owned state lives in `~/.attend/attend.sqlite3`. Retention is based on the
meaning of each record; the database does not apply a blanket TTL to every
document.

| Data | SQLite representation | Retention |
| --- | --- | --- |
| Work events | Indexed `work_events` rows | 180 days and at most 200,000 rows |
| Collaboration turn facts and labels | Indexed `collaboration_turns` / `collaboration_labels` rows | 180 days; labels follow their turn |
| Collaboration session/fork relations | Indexed `collaboration_sessions` rows | No automatic expiry (user-visible lineage and analysis boundary) |
| Session attention (`seen` / `unread`) | `session-status` document | 180 days when `updatedAt` is known |
| Engagement telemetry | `engagement` document | 180 days from its latest known activity |
| Read comment threads | `ui-state` document | 180 days from creation |
| Unread, generating, or failed comments | `ui-state` document | No automatic expiry |
| Queue leases | `chat-queue` document | Removed as soon as the lease expires |
| Queued messages | `chat-queue` document | No automatic expiry; only user or dispatch removes them |
| Tags, titles, pins, Focus views, overrides, fork links | State documents | No automatic expiry (user intent) |
| Daemon registry and analysis cache | State documents | No automatic expiry; required for daemon hiding and continuity |
| Workspace migration markers | `workspace-state-migrations` document | Permanent for idempotency |

Records that lack a trustworthy legacy timestamp are retained instead of being
guessed stale. This makes migration conservative and prevents silent data loss.

## Maintenance

One Attend process is elected through `state_maintenance` at most once per day.
It performs logical pruning, a passive WAL checkpoint, `PRAGMA optimize`, and a
bounded incremental vacuum. WAL is capped at 4 MiB. Cleanup is opportunistic:
failure never prevents the server from starting, and another daily run can
recover.

Legacy JSON files are retained as migration backups and are not subject to the
SQLite retention job. They can be archived or deleted manually after the new
database has been verified. Vendor transcripts and vendor-owned caches remain
outside Attend's database and follow their vendors' lifecycle rules.
