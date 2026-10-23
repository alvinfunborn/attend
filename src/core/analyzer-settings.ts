import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { configureStateDatabase } from "./state-database.js";

export type AnalyzerMode = "legacy_vendor_default" | "economical" | "follow" | "off";
export interface AnalyzerSettings {
  mode: AnalyzerMode;
  revision: number;
}
export function isAnalyzerMode(
  value: unknown,
): value is Exclude<AnalyzerMode, "legacy_vendor_default"> {
  return value === "economical" || value === "follow" || value === "off";
}

/** Initialize before any other component creates the shared database. */
export class AnalyzerSettingsStore {
  private readonly db: DatabaseSync;
  constructor(
    databaseFile: string,
    _legacyFiles: string[] = [],
    private readonly instanceId = "scope:v1:all",
  ) {
    fs.mkdirSync(path.dirname(databaseFile), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(databaseFile);
    configureStateDatabase(this.db);
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS analyzer_settings (id INTEGER PRIMARY KEY CHECK(id = 1), mode TEXT NOT NULL, revision INTEGER NOT NULL) STRICT",
    );
    this.db.prepare("INSERT OR IGNORE INTO analyzer_settings VALUES (1, ?, 0)").run("economical");
    // Upgrade the former implicit CLI default without overriding explicit API settings.
    this.db.exec(
      "UPDATE analyzer_settings SET mode = 'economical', revision = revision + 1 WHERE mode = 'legacy_vendor_default'",
    );
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS instance_analyzer_settings (instance_id TEXT PRIMARY KEY, mode TEXT NOT NULL, revision INTEGER NOT NULL) STRICT",
    );
    this.db.exec(
      "UPDATE instance_analyzer_settings SET mode = 'economical', revision = revision + 1 WHERE mode = 'legacy_vendor_default'",
    );
    // Import the old machine-wide choice once; each instance then evolves independently.
    this.db
      .prepare(
        "INSERT OR IGNORE INTO instance_analyzer_settings SELECT ?, mode, revision FROM analyzer_settings WHERE id = 1",
      )
      .run(this.instanceId);
  }
  get(): AnalyzerSettings {
    const row = this.db
      .prepare("SELECT mode, revision FROM instance_analyzer_settings WHERE instance_id = ?")
      .get(this.instanceId) as unknown as AnalyzerSettings;
    return {
      mode: isAnalyzerMode(row.mode) ? row.mode : "legacy_vendor_default",
      revision: row.revision,
    };
  }
  set(mode: Exclude<AnalyzerMode, "legacy_vendor_default">): AnalyzerSettings {
    if (!isAnalyzerMode(mode)) throw new Error("Invalid analyzer mode");
    this.db
      .prepare(
        "UPDATE instance_analyzer_settings SET mode = ?, revision = revision + 1 WHERE instance_id = ? AND mode != ?",
      )
      .run(mode, this.instanceId, mode);
    return this.get();
  }
  close(): void {
    this.db.close();
  }
}
