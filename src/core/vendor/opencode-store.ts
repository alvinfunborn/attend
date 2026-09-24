import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  type OpencodeTranscriptEvent,
  parseOpencodeTranscript,
} from "../../chat/opencode/transcript.js";
import type { TranscriptMsg } from "../../chat/transcript.js";

/**
 * OpenCode native storage.
 *
 * 1.18+ uses a SQLite database at `<dataDir>/opencode.db` (`session` / `message`
 * / `part` tables). Older releases used a JSON tree under `<dataDir>/storage/`.
 * Both are read here; Attend mirrors each session into a small JSONL transcript
 * so the existing history/search/analyzer seams stay file-based.
 */
export interface OpencodeSessionMeta {
  id: string;
  directory: string | null;
  title: string | null;
  timeCreated: number | null;
  timeUpdated: number | null;
  source: "database" | "legacy";
  /** mtime source used to decide whether the mirror is stale. */
  freshnessMs: number | null;
}

const SESSION_QUERY =
  "SELECT id, directory, title, time_created, time_updated, parent_id FROM session";

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/** Open the native SQLite database read-only, tolerating unrelated schemas. */
function openDatabase(dbPath: string): DatabaseSync | null {
  try {
    if (!fs.existsSync(dbPath)) return null;
    const db = new DatabaseSync(dbPath, { readOnly: true });
    db.exec("PRAGMA busy_timeout = 3000");
    return db;
  } catch {
    return null;
  }
}

function readDatabaseMetas(dbPath: string): OpencodeSessionMeta[] {
  const db = openDatabase(dbPath);
  if (!db) return [];
  try {
    const rows = db.prepare(SESSION_QUERY).all() as Array<Record<string, unknown>>;
    const metas: OpencodeSessionMeta[] = [];
    for (const row of rows) {
      const id = safeString(row.id);
      if (!id) continue;
      // Subagent/task sessions carry a parent id and are not user-facing.
      if (safeString(row.parent_id)) continue;
      const timeUpdated = safeNumber(row.time_updated);
      metas.push({
        id,
        directory: safeString(row.directory),
        title: safeString(row.title),
        timeCreated: safeNumber(row.time_created),
        timeUpdated,
        source: "database",
        freshnessMs: timeUpdated,
      });
    }
    return metas;
  } catch {
    return [];
  } finally {
    try {
      db.close();
    } catch {
      // Already closed.
    }
  }
}

function walkFiles(dir: string, suffix: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, suffix));
    else if (entry.isFile() && entry.name.endsWith(suffix)) out.push(full);
  }
  return out;
}

function readLegacyMetas(storageDir: string): OpencodeSessionMeta[] {
  const sessionsDir = path.join(storageDir, "session");
  const metas: OpencodeSessionMeta[] = [];
  for (const file of walkFiles(sessionsDir, ".json")) {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
      const id = safeString(data.id) ?? path.basename(file, ".json");
      if (!id || safeString(data.parentID)) continue;
      if (typeof data.parentID === "string" && data.parentID) continue;
      const time = (data.time ?? {}) as Record<string, unknown>;
      const timeUpdated = safeNumber(time.updated) ?? safeNumber(time.created);
      metas.push({
        id,
        directory: safeString(data.directory),
        title: safeString(data.title),
        timeCreated: safeNumber(time.created),
        timeUpdated,
        source: "legacy",
        freshnessMs: fs.statSync(file).mtimeMs,
      });
    } catch {
      // Skip unreadable session files.
    }
  }
  return metas;
}

/** Session metadata from whichever native store exists (database wins). */
export function readOpencodeSessionMetas(dataDir: string): OpencodeSessionMeta[] {
  const database = readDatabaseMetas(path.join(dataDir, "opencode.db"));
  if (database.length) return database;
  return readLegacyMetas(path.join(dataDir, "storage"));
}

function databaseEvents(dbPath: string, sessionId: string): OpencodeTranscriptEvent[] {
  const db = openDatabase(dbPath);
  if (!db) return [];
  try {
    const messages = db
      .prepare(
        "SELECT id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created, id",
      )
      .all(sessionId) as Array<Record<string, unknown>>;
    const parts = db
      .prepare(
        "SELECT message_id, time_created, id, data FROM part WHERE session_id = ? ORDER BY time_created, id",
      )
      .all(sessionId) as Array<Record<string, unknown>>;
    return assembleEvents(messages, parts);
  } catch {
    return [];
  } finally {
    try {
      db.close();
    } catch {
      // Already closed.
    }
  }
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function legacyEvents(storageDir: string, sessionId: string): OpencodeTranscriptEvent[] {
  const messagesDir = path.join(storageDir, "message", sessionId);
  const messages: Array<Record<string, unknown>> = [];
  for (const file of walkFiles(messagesDir, ".json")) {
    const data = readJson(file);
    if (!data) continue;
    const time = (data.time ?? {}) as Record<string, unknown>;
    messages.push({
      id: data.id ?? path.basename(file, ".json"),
      time_created: safeNumber(time.created) ?? 0,
      data: JSON.stringify(data),
    });
  }
  messages.sort((a, b) => (safeNumber(a.time_created) ?? 0) - (safeNumber(b.time_created) ?? 0));
  const parts: Array<Record<string, unknown>> = [];
  for (const message of messages) {
    const messageId = safeString(message.id);
    if (!messageId) continue;
    const partsDir = path.join(storageDir, "part", messageId);
    for (const file of walkFiles(partsDir, ".json")) {
      const data = readJson(file);
      if (!data) continue;
      const time = (data.time ?? {}) as Record<string, unknown>;
      parts.push({
        message_id: messageId,
        id: data.id ?? path.basename(file, ".json"),
        time_created: safeNumber(time.start) ?? safeNumber(time.created) ?? 0,
        data: JSON.stringify(data),
      });
    }
  }
  return assembleEvents(messages, parts);
}

/**
 * Turn raw `message`/`part` rows into the same event stream
 * `opencode run --format json` produces, so one parser handles both stores.
 */
function assembleEvents(
  messages: Array<Record<string, unknown>>,
  parts: Array<Record<string, unknown>>,
): OpencodeTranscriptEvent[] {
  const partsByMessage = new Map<string, Array<Record<string, unknown>>>();
  for (const part of parts) {
    const messageId = safeString(part.message_id);
    if (!messageId) continue;
    const list = partsByMessage.get(messageId) ?? [];
    list.push(part);
    partsByMessage.set(messageId, list);
  }

  const events: OpencodeTranscriptEvent[] = [];
  for (const message of messages) {
    const messageId = safeString(message.id);
    if (!messageId) continue;
    let info: Record<string, unknown> = {};
    try {
      info = JSON.parse(String(message.data ?? "{}")) as Record<string, unknown>;
    } catch {
      info = {};
    }
    const role = safeString(info.role);
    const time = (info.time ?? {}) as Record<string, unknown>;
    const ts = safeNumber(message.time_created) ?? safeNumber(time.created) ?? undefined;
    const messageParts = partsByMessage.get(messageId) ?? [];

    if (role === "user") {
      const text = messageParts
        .map((part) => parsePart(part))
        .filter((part): part is Record<string, unknown> => !!part && part.type === "text")
        .map((part) => safeString(part.text) ?? "")
        .filter(Boolean)
        .join("\n");
      if (text) events.push({ type: "user", text, ...(ts ? { time: ts } : {}) });
      continue;
    }
    if (role !== "assistant") continue;
    for (const raw of messageParts) {
      const part = parsePart(raw);
      if (!part) continue;
      const partTs =
        safeNumber((part.time as Record<string, unknown> | undefined)?.end) ??
        safeNumber((part.time as Record<string, unknown> | undefined)?.start) ??
        ts;
      if (part.type === "text" && safeString(part.text)) {
        events.push({ type: "text", part, ...(partTs ? { time: partTs } : {}) });
      } else if (part.type === "tool") {
        events.push({ type: "tool_use", part, ...(partTs ? { time: partTs } : {}) });
      }
    }
  }
  return events;
}

function parsePart(raw: Record<string, unknown>): OpencodeTranscriptEvent["part"] | null {
  try {
    return JSON.parse(String(raw.data ?? "null")) as OpencodeTranscriptEvent["part"];
  } catch {
    return null;
  }
}

/** Native events for one session, as JSONL-parsable strings plus a session header. */
export function readOpencodeEvents(dataDir: string, meta: OpencodeSessionMeta): string[] {
  const events =
    meta.source === "database"
      ? databaseEvents(path.join(dataDir, "opencode.db"), meta.id)
      : legacyEvents(path.join(dataDir, "storage"), meta.id);
  const header: OpencodeTranscriptEvent & { type: string } = {
    type: "session",
    sessionID: meta.id,
    ...(meta.directory ? { text: meta.directory } : {}),
  };
  return [JSON.stringify(header), ...events.map((event) => JSON.stringify(event))];
}

export function readOpencodeMessages(dataDir: string, meta: OpencodeSessionMeta): TranscriptMsg[] {
  return parseOpencodeTranscript(
    readOpencodeEvents(dataDir, meta).join("\n"),
    Number.POSITIVE_INFINITY,
  );
}

export function mirrorPath(mirrorDir: string, sessionId: string): string {
  return path.join(mirrorDir, `${sessionId}.jsonl`);
}

/** A mirror is current when it was written at or after the session's last update. */
export function mirrorIsFresh(mirrorFile: string, meta: OpencodeSessionMeta): boolean {
  if (meta.source === "legacy") {
    try {
      return fs.statSync(mirrorFile).mtimeMs >= (meta.freshnessMs ?? 0);
    } catch {
      return false;
    }
  }
  if (meta.timeUpdated === null) {
    return fs.existsSync(mirrorFile);
  }
  try {
    return fs.statSync(mirrorFile).mtimeMs >= meta.timeUpdated;
  } catch {
    return false;
  }
}

/** Write a mirror atomically so a concurrent history read never sees a partial file. */
export function writeOpencodeMirror(mirrorFile: string, lines: string[]): void {
  const temp = `${mirrorFile}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${lines.join("\n")}\n`);
  fs.renameSync(temp, mirrorFile);
}
