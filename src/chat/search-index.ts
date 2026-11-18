import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { RawSession } from "../core/types.js";
import { parseCodexTranscriptMessages } from "./codex/transcript.js";
import { readSearchLines } from "./search-lines.js";
import { parseSearchQuery } from "./search-query.js";
import { type SearchHit, type SessionSearchResult, readSearchChunks } from "./search.js";
import { parseClaudeTranscriptMessages } from "./transcript.js";

interface IndexedFile {
  mtime_ms: number;
  size: number;
  vendor: string;
  session_id: string | null;
  resume_offset: number;
  identity: string;
  boundary: string;
}

function snippet(text: string, matcher: RegExp | undefined): string {
  const index = matcher ? text.search(matcher) : -1;
  if (index < 0) return text.length > 180 ? `${text.slice(0, 179)}...` : text;
  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, index + 90);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

/**
 * Durable transcript text index owned by the search worker.
 *
 * Codex/Claude JSONL is read in bounded blocks, with a durable byte checkpoint.
 * Query clauses match individual visible messages; AND/OR/exclusion combine
 * across messages without concatenating the complete session in memory.
 */
export class PersistentTranscriptSearchIndex {
  private readonly db: DatabaseSync;

  constructor(file = ":memory:") {
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS transcript_search_files (
        file TEXT PRIMARY KEY,
        vendor TEXT NOT NULL,
        session_id TEXT,
        mtime_ms REAL NOT NULL,
        size INTEGER NOT NULL,
        indexed_at INTEGER NOT NULL
      ) STRICT;
    `);
    // Upgrade existing indexes without discarding their searchable contents.
    const columns = this.db.prepare("PRAGMA table_info(transcript_search_files)").all();
    for (const [name, type] of [
      ["resume_offset", "INTEGER NOT NULL DEFAULT 0"],
      ["identity", "TEXT NOT NULL DEFAULT ''"],
      ["boundary", "TEXT NOT NULL DEFAULT ''"],
    ]) {
      if (!columns.some((column) => column.name === name)) {
        try {
          this.db.exec(`ALTER TABLE transcript_search_files ADD COLUMN ${name} ${type}`);
        } catch (error) {
          // Another instance can finish the same migration while we wait.
          if (
            !this.db
              .prepare("PRAGMA table_info(transcript_search_files)")
              .all()
              .some((column) => column.name === name)
          )
            throw error;
        }
      }
    }
    this.db.exec(`CREATE TABLE IF NOT EXISTS transcript_search_stream (
      file TEXT NOT NULL, offset INTEGER NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL,
      PRIMARY KEY(file, offset)
    ) STRICT;`);
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
          this.db.prepare("DELETE FROM transcript_search_stream WHERE file = ?").run(file);
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
    // Evaluate clauses across messages without materializing a whole session.
    // FTS token matching cannot safely narrow substring/regex OR queries.
    const read = this.db.prepare(`
      SELECT role, text FROM transcript_search_stream WHERE file = ? ORDER BY offset
    `);
    const legacyRead = this.db.prepare(
      "SELECT role, text FROM transcript_search_fts WHERE file = ? ORDER BY rowid",
    );
    const out: SessionSearchResult[] = [];
    for (const session of sessions) {
      if (out.length >= maxResults) break;
      const indexed = this.db
        .prepare("SELECT identity FROM transcript_search_files WHERE file = ?")
        .get(session.path);
      const stream =
        (session.vendor === "codex" || session.vendor === "claude") && !!indexed?.identity;
      const statement = stream ? read : legacyRead;
      const matched = new Set<(typeof parsed.clauses)[number]>();
      for (const row of statement.iterate(session.path)) {
        const text = row.text as string;
        for (const clause of parsed.clauses) {
          if (clause.regex.test(text)) matched.add(clause);
        }
      }
      const group = parsed.groups.find((group) =>
        group.every((clause) => clause.exclude !== matched.has(clause)),
      );
      if (!group) continue;
      const positive = group.filter((clause) => !clause.exclude);
      const hits: SearchHit[] = [];
      let count = 0;
      for (const row of statement.iterate(session.path)) {
        const chunk = row as unknown as SearchHit;
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
    const unchanged = (previous: IndexedFile | undefined): boolean =>
      !!previous &&
      previous.mtime_ms === stat.mtimeMs &&
      previous.size === stat.size &&
      previous.vendor === session.vendor &&
      previous.session_id === session.sessionId &&
      previous.identity === `${stat.dev}:${stat.ino}`;
    const readPrevious = (): IndexedFile | undefined =>
      this.db
        .prepare("SELECT * FROM transcript_search_files WHERE file = ?")
        .get(session.path) as unknown as IndexedFile | undefined;
    // Avoid acquiring a writer lock for the many unchanged files in a search.
    if (unchanged(readPrevious())) return;
    // Take the shared SQLite writer lock BEFORE parsing and recheck the version
    // under it. A second Attend worker then reuses the first worker's checkpoint.
    this.db.exec("BEGIN IMMEDIATE");
    try {
      stat = fs.statSync(session.path);
      const previous = readPrevious();
      const identity = `${stat.dev}:${stat.ino}`;
      if (unchanged(previous)) {
        this.db.exec("COMMIT");
        return;
      }
      const stream = session.vendor === "codex" || session.vendor === "claude";
      let resumeOffset = 0;
      let boundary = "";
      if (stream) {
        const fd = fs.openSync(session.path, "r");
        try {
          const fingerprint = (offset: number): string => {
            const hash = createHash("sha256");
            for (const [start, length] of [
              [0, Math.min(offset, 256)],
              [Math.max(0, offset - 256), Math.min(offset, 256)],
            ] as const) {
              const bytes = Buffer.alloc(length);
              const n = fs.readSync(fd, bytes, 0, length, start);
              hash.update(bytes.subarray(0, n));
            }
            return hash.digest("hex");
          };
          const append =
            previous &&
            previous.identity === identity &&
            previous.vendor === session.vendor &&
            previous.session_id === session.sessionId &&
            stat.size > previous.size &&
            previous.resume_offset > 0 &&
            fingerprint(previous.resume_offset) === previous.boundary;
          resumeOffset = append ? previous.resume_offset : 0;
          this.db
            .prepare("DELETE FROM transcript_search_stream WHERE file = ? AND offset >= ?")
            .run(session.path, resumeOffset);
          if (!append) {
            this.db.prepare("DELETE FROM transcript_search_fts WHERE file = ?").run(session.path);
          }
          const insert = this.db.prepare(
            "INSERT INTO transcript_search_stream (file, offset, role, text) VALUES (?, ?, ?, ?)",
          );
          for (const line of readSearchLines(fd, resumeOffset, stat.size)) {
            // Reuse display visibility rules, but do not retain tool correlation
            // state or compaction snapshots across the multi-GB source file.
            const messages =
              session.vendor === "codex"
                ? parseCodexTranscriptMessages(line.text, Number.POSITIVE_INFINITY, false)
                : parseClaudeTranscriptMessages(line.text, Number.POSITIVE_INFINITY);
            for (const message of messages) {
              const text = message.text.replace(/\s+/g, " ").trim();
              if (text) insert.run(session.path, line.start, message.role, text);
            }
            resumeOffset = line.complete ? line.end : line.start;
          }
          boundary = fingerprint(resumeOffset);
        } finally {
          fs.closeSync(fd);
        }
      } else {
        const chunks = readSearchChunks(session);
        this.db.prepare("DELETE FROM transcript_search_stream WHERE file = ?").run(session.path);
        this.db.prepare("DELETE FROM transcript_search_fts WHERE file = ?").run(session.path);
        const insert = this.db.prepare(`INSERT INTO transcript_search_fts
          (file, vendor, session_id, role, text) VALUES (?, ?, ?, ?, ?)`);
        for (const chunk of chunks) {
          insert.run(session.path, session.vendor, session.sessionId, chunk.role, chunk.text);
        }
      }
      const current = fs.statSync(session.path);
      if (
        `${current.dev}:${current.ino}` !== identity ||
        current.size < stat.size ||
        (current.size === stat.size && current.mtimeMs !== stat.mtimeMs)
      ) {
        throw new Error("Transcript changed while indexing; retry search");
      }
      this.db
        .prepare(`INSERT INTO transcript_search_files
        (file, vendor, session_id, mtime_ms, size, indexed_at, resume_offset, identity, boundary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(file) DO UPDATE SET vendor=excluded.vendor, session_id=excluded.session_id,
          mtime_ms=excluded.mtime_ms, size=excluded.size, indexed_at=excluded.indexed_at,
          resume_offset=excluded.resume_offset, identity=excluded.identity, boundary=excluded.boundary`)
        .run(
          session.path,
          session.vendor,
          session.sessionId,
          stat.mtimeMs,
          stat.size,
          Date.now(),
          resumeOffset,
          identity,
          boundary,
        );
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
