import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { RawSession } from "../core/types.js";
import { parseSearchQuery } from "./search-query.js";
import { type SearchHit, type SessionSearchResult, readSearchChunks } from "./search.js";

interface IndexedFile {
  mtime_ms: number;
  size: number;
  vendor: string;
  session_id: string | null;
}

function snippet(text: string, matcher: RegExp | undefined): string {
  const index = matcher ? text.search(matcher) : -1;
  if (index < 0) return text.length > 180 ? `${text.slice(0, 179)}...` : text;
  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, index + 90);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

function ftsLiteral(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Durable transcript text index owned by the search worker.
 *
 * Full provider parsing happens only when a file identity changes. Searches
 * query SQLite thereafter and still run the product's exact AND/OR/exclusion/
 * regex matcher over candidate sessions, so FTS is an accelerator rather than
 * a change in query semantics.
 */
export class PersistentTranscriptSearchIndex {
  private readonly db: DatabaseSync;
  private readonly ftsAvailable: boolean;

  constructor(file = ":memory:") {
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS transcript_search_files (
        file TEXT PRIMARY KEY,
        vendor TEXT NOT NULL,
        session_id TEXT,
        mtime_ms REAL NOT NULL,
        size INTEGER NOT NULL,
        indexed_at INTEGER NOT NULL
      ) STRICT;
    `);
    let ftsAvailable = true;
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS transcript_search_fts USING fts5(
          file UNINDEXED,
          vendor UNINDEXED,
          session_id UNINDEXED,
          role UNINDEXED,
          text,
          tokenize = 'unicode61'
        );
      `);
    } catch {
      ftsAvailable = false;
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS transcript_search_fts (
          file TEXT NOT NULL,
          vendor TEXT NOT NULL,
          session_id TEXT,
          role TEXT NOT NULL,
          text TEXT NOT NULL
        ) STRICT;
        CREATE INDEX IF NOT EXISTS transcript_search_file
          ON transcript_search_fts(file);
      `);
    }
    this.ftsAvailable = ftsAvailable;
  }

  sync(sessions: RawSession[]): void {
    for (const session of sessions) this.indexIfChanged(session);
  }

  syncDelta(upserts: RawSession[], removedPaths: string[]): void {
    const paths = [...new Set(removedPaths.filter(Boolean))];
    if (paths.length) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const removeText = this.db.prepare("DELETE FROM transcript_search_fts WHERE file = ?");
        const removeFile = this.db.prepare("DELETE FROM transcript_search_files WHERE file = ?");
        for (const file of paths) {
          removeText.run(file);
          removeFile.run(file);
        }
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
    for (const session of upserts) this.indexIfChanged(session);
  }

  search(
    sessions: RawSession[],
    query: string,
    opts: { maxResults?: number; maxHitsPerSession?: number } = {},
  ): SessionSearchResult[] {
    const parsed = parseSearchQuery(query.trim());
    if (!parsed.clauses.length) return [];
    this.sync(sessions);

    const maxResults = opts.maxResults ?? 50;
    const maxHitsPerSession = opts.maxHitsPerSession ?? 3;
    const allowed = new Set(sessions.map((session) => session.path));
    let candidates = allowed;
    const literalClauses = parsed.clauses.filter(
      (clause) =>
        !clause.exclude &&
        clause.kind === "literal" &&
        clause.source.length >= 2 &&
        /^[\p{L}\p{N}_ .:/-]+$/u.test(clause.source),
    );
    if (this.ftsAvailable && literalClauses.length) {
      try {
        const expression = literalClauses.map((clause) => ftsLiteral(clause.source)).join(" OR ");
        const rows = this.db
          .prepare(
            "SELECT DISTINCT file FROM transcript_search_fts WHERE transcript_search_fts MATCH ?",
          )
          .all(expression) as unknown as Array<{ file: string }>;
        candidates = new Set(rows.map((row) => row.file).filter((file) => allowed.has(file)));
      } catch {
        // Tokenizer/query edge cases fall back to the exact matcher over every
        // already-indexed session rather than changing search correctness.
        candidates = allowed;
      }
    }

    const read = this.db.prepare(
      "SELECT role, text FROM transcript_search_fts WHERE file = ? ORDER BY rowid",
    );
    const out: SessionSearchResult[] = [];
    for (const session of sessions) {
      if (out.length >= maxResults) break;
      if (!candidates.has(session.path)) continue;
      const chunks = read.all(session.path) as unknown as SearchHit[];
      const searchable = chunks.map((chunk) => chunk.text).join("\n");
      if (!parsed.test(searchable)) continue;
      const positive = parsed.matchingClauses(searchable).filter((clause) => !clause.exclude);
      const hits: SearchHit[] = [];
      let count = 0;
      for (const chunk of chunks) {
        const matcher = positive.find((clause) => clause.regex.test(chunk.text))?.regex;
        if (positive.length && !matcher) continue;
        count += 1;
        if (hits.length < maxHitsPerSession) {
          hits.push({ role: chunk.role, text: snippet(chunk.text, matcher) });
        }
      }
      if (!positive.length) count = Math.max(1, count);
      if (count > 0) {
        out.push({
          vendor: session.vendor,
          sessionId: session.sessionId,
          file: session.path,
          count,
          hits,
        });
      }
    }
    return out;
  }

  close(): void {
    this.db.close();
  }

  private indexIfChanged(session: RawSession): void {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(session.path);
    } catch {
      return;
    }
    const previous = this.db
      .prepare(
        "SELECT vendor, session_id, mtime_ms, size FROM transcript_search_files WHERE file = ?",
      )
      .get(session.path) as unknown as IndexedFile | undefined;
    if (
      previous &&
      previous.mtime_ms === stat.mtimeMs &&
      previous.size === stat.size &&
      previous.vendor === session.vendor &&
      previous.session_id === session.sessionId
    ) {
      return;
    }

    const chunks = readSearchChunks(session);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("DELETE FROM transcript_search_fts WHERE file = ?").run(session.path);
      const insert = this.db.prepare(
        `INSERT INTO transcript_search_fts
         (file, vendor, session_id, role, text) VALUES (?, ?, ?, ?, ?)`,
      );
      for (const chunk of chunks) {
        insert.run(session.path, session.vendor, session.sessionId, chunk.role, chunk.text);
      }
      this.db
        .prepare(
          `INSERT INTO transcript_search_files
           (file, vendor, session_id, mtime_ms, size, indexed_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(file) DO UPDATE SET
             vendor = excluded.vendor,
             session_id = excluded.session_id,
             mtime_ms = excluded.mtime_ms,
             size = excluded.size,
             indexed_at = excluded.indexed_at`,
        )
        .run(session.path, session.vendor, session.sessionId, stat.mtimeMs, stat.size, Date.now());
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
