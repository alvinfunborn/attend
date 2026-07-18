import { JsonFile, type JsonRepository } from "../json-file.js";
import { SqliteDocument } from "../state-database.js";

export interface DaemonEntry {
  /** the daemon's own session id (filtered out of the listing) */
  daemonId: string;
  /** the task's cwd — the daemon shares it, so it can read all the context */
  cwd: string;
  /** the task's vendor — picks which analyzer drives this daemon on later rounds */
  vendor: string;
}

/**
 * Persistent task→daemon pairing. A daemon is a normal Claude session we spawned
 * to analyze a task session; it shares the task's cwd (so it sees the same repo +
 * memory), which means it *cannot* be told apart by directory. This registry is
 * the source of truth for which session ids are daemons — and thus which ones to
 * hide from the top-level list (DESIGN v2.3: "daemon is a normal session, just
 * filtered out of our product").
 */
export class DaemonRegistry {
  private readonly data: JsonRepository<Record<string, DaemonEntry>>;

  constructor(file: string, databaseFile?: string) {
    this.data = databaseFile
      ? new SqliteDocument(databaseFile, "daemon-registry", file, normalizeEntries)
      : new JsonFile(file, normalizeEntries);
  }

  get(taskId: string): DaemonEntry | undefined {
    return this.data.read()[taskId];
  }

  has(taskId: string): boolean {
    return Object.hasOwn(this.data.read(), taskId);
  }

  set(taskId: string, entry: DaemonEntry): void {
    this.data.update((entries) => {
      entries[taskId] = entry;
    });
  }

  /** Every daemon session id — used to filter daemons out of the listing. */
  daemonIds(): Set<string> {
    const ids = new Set<string>();
    for (const v of Object.values(this.data.read())) ids.add(v.daemonId);
    return ids;
  }
}

function normalizeEntries(value: unknown): Record<string, DaemonEntry> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries: Record<string, DaemonEntry> = {};
  for (const [taskId, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Partial<DaemonEntry>;
    if (
      typeof candidate.daemonId === "string" &&
      typeof candidate.cwd === "string" &&
      typeof candidate.vendor === "string"
    ) {
      entries[taskId] = {
        daemonId: candidate.daemonId,
        cwd: candidate.cwd,
        vendor: candidate.vendor,
      };
    }
  }
  return entries;
}
