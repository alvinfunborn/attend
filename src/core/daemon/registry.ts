import fs from "node:fs";
import path from "node:path";

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
  private map = new Map<string, DaemonEntry>();
  private loaded = false;

  constructor(private readonly file: string) {}

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const obj = JSON.parse(fs.readFileSync(this.file, "utf-8")) as Record<string, DaemonEntry>;
      for (const [k, v] of Object.entries(obj)) this.map.set(k, v);
    } catch {
      // missing/corrupt — start empty
    }
  }

  get(taskId: string): DaemonEntry | undefined {
    this.load();
    return this.map.get(taskId);
  }

  has(taskId: string): boolean {
    this.load();
    return this.map.has(taskId);
  }

  set(taskId: string, entry: DaemonEntry): void {
    this.load();
    this.map.set(taskId, entry);
    this.persist();
  }

  /** Every daemon session id — used to filter daemons out of the listing. */
  daemonIds(): Set<string> {
    this.load();
    const ids = new Set<string>();
    for (const v of this.map.values()) ids.add(v.daemonId);
    return ids;
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const obj: Record<string, DaemonEntry> = {};
      for (const [k, v] of this.map) obj[k] = v;
      fs.writeFileSync(this.file, JSON.stringify(obj, null, 2));
    } catch {
      // best-effort persistence
    }
  }
}
