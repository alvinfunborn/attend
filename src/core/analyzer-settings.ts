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
  constructor(databaseFile: string, legacyFiles: string[] = []) {
    const existing = fs.existsSync(databaseFile) || legacyFiles.some((file) => fs.existsSync(file));
    fs.mkdirSync(path.dirname(databaseFile), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(databaseFile);
    configureStateDatabase(this.db);
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS analyzer_settings (id INTEGER PRIMARY KEY CHECK(id = 1), mode TEXT NOT NULL, revision INTEGER NOT NULL) STRICT",
    );
    this.db
      .prepare("INSERT OR IGNORE INTO analyzer_settings VALUES (1, ?, 0)")
      .run(existing ? "legacy_vendor_default" : "economical");
  }
  get(): AnalyzerSettings {
    const row = this.db
      .prepare("SELECT mode, revision FROM analyzer_settings WHERE id = 1")
      .get() as unknown as AnalyzerSettings;
    return {
      mode: isAnalyzerMode(row.mode) ? row.mode : "legacy_vendor_default",
      revision: row.revision,
    };
  }
  set(mode: Exclude<AnalyzerMode, "legacy_vendor_default">): AnalyzerSettings {
    if (!isAnalyzerMode(mode)) throw new Error("Invalid analyzer mode");
    this.db
      .prepare(
        "UPDATE analyzer_settings SET mode = ?, revision = revision + 1 WHERE id = 1 AND mode != ?",
      )
      .run(mode, mode);
    return this.get();
  }
  close(): void {
    this.db.close();
  }
}
