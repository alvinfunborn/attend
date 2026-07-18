import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  SqliteDocument,
  claimStateMaintenance,
  optimizeStateDatabase,
} from "../src/core/state-database.js";

const normalize = (value: unknown): Record<string, number> =>
  value && typeof value === "object" ? (value as Record<string, number>) : {};

describe("SqliteDocument", () => {
  it("imports a legacy JSON document once and keeps the source as a backup", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-state-db-migrate-"));
    const database = path.join(root, "attend.sqlite3");
    const legacy = path.join(root, "tags.json");
    fs.writeFileSync(legacy, JSON.stringify({ imported: 1 }));

    const first = new SqliteDocument(database, "tags", legacy, normalize);
    expect(first.read()).toEqual({ imported: 1 });
    fs.writeFileSync(legacy, JSON.stringify({ imported: 2 }));
    const second = new SqliteDocument(database, "tags", legacy, normalize);
    expect(second.read()).toEqual({ imported: 1 });
    expect(fs.existsSync(legacy)).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("serializes updates from independent connections without losing fields", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-state-db-concurrent-"));
    const database = path.join(root, "attend.sqlite3");
    const first = new SqliteDocument(
      database,
      "shared",
      path.join(root, "missing.json"),
      normalize,
    );
    const second = new SqliteDocument(
      database,
      "shared",
      path.join(root, "missing.json"),
      normalize,
    );

    first.update((value) => {
      value.first = 1;
    });
    second.update((value) => {
      value.second = 2;
    });
    expect(first.read()).toEqual({ first: 1, second: 2 });
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("keeps independent document namespaces in one database", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-state-db-namespace-"));
    const database = path.join(root, "attend.sqlite3");
    new SqliteDocument(database, "one", path.join(root, "one.json"), normalize).update((value) => {
      value.one = 1;
    });
    new SqliteDocument(database, "two", path.join(root, "two.json"), normalize).update((value) => {
      value.two = 2;
    });

    const db = new DatabaseSync(database, { readOnly: true });
    const count = db.prepare("SELECT COUNT(*) AS count FROM state_documents").get() as {
      count: number;
    };
    db.close();
    expect(count.count).toBe(2);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("elects one daily maintenance runner and permits the next day", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-state-db-maintenance-"));
    const database = path.join(root, "attend.sqlite3");
    const now = 200 * 86_400_000;

    expect(claimStateMaintenance(database, now)).toBe(true);
    expect(claimStateMaintenance(database, now + 1_000)).toBe(false);
    expect(claimStateMaintenance(database, now + 86_400_001)).toBe(true);
    expect(() => optimizeStateDatabase(database)).not.toThrow();
    fs.rmSync(root, { recursive: true, force: true });
  });
});
