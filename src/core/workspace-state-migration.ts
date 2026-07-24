import fs from "node:fs";
import path from "node:path";
import type { AttendConfig } from "../config.js";
import { canonicalScopePath } from "./scope.js";
import { SqliteDocument } from "./state-database.js";
import { WorkEventStore } from "./work-events.js";

type JsonObject = Record<string, unknown>;
type Merger = (target: JsonObject, source: JsonObject) => void;

interface MigrationState {
  version: 2;
  roots: Record<string, number>;
}

const objectValue = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

function migrationState(value: unknown): MigrationState {
  const input = objectValue(value);
  const roots = Number(input.version) === 2 ? objectValue(input.roots) : {};
  return {
    version: 2,
    roots: Object.fromEntries(
      Object.entries(roots)
        .map(([root, at]) => [root, Number(at)] as const)
        .filter(([, at]) => Number.isFinite(at) && at > 0),
    ),
  };
}

function record(value: unknown): JsonObject {
  return objectValue(value);
}

function mergeRecords(target: JsonObject, source: JsonObject): void {
  Object.assign(target, { ...source, ...target });
}

function mergeNestedRecords(key: string): Merger {
  return (target, source) => {
    target[key] = { ...record(source[key]), ...record(target[key]) };
  };
}

function mergeChatQueue(target: JsonObject, source: JsonObject): void {
  const targetSessions = record(target.sessions);
  for (const [sessionId, rawSourceQueue] of Object.entries(record(source.sessions))) {
    const sourceQueue = record(rawSourceQueue);
    const targetQueue = record(targetSessions[sessionId]);
    const items = new Map<string, unknown>();
    for (const item of [
      ...(Array.isArray(sourceQueue.items) ? sourceQueue.items : []),
      ...(Array.isArray(targetQueue.items) ? targetQueue.items : []),
    ]) {
      const id = String(record(item).id ?? "").trim();
      if (id) items.set(id, item);
    }
    targetSessions[sessionId] = {
      parked: targetQueue.parked ?? sourceQueue.parked === true,
      items: [...items.values()],
      ...(targetQueue.lease && typeof targetQueue.lease === "object"
        ? { lease: targetQueue.lease }
        : {}),
    };
  }
  target.sessions = targetSessions;
}

function mergeTags(target: JsonObject, source: JsonObject): void {
  const tags = [
    ...new Set([
      ...(Array.isArray(target.tags) ? target.tags : []),
      ...(Array.isArray(source.tags) ? source.tags : []),
    ]),
  ];
  const sessions = record(target.sessions);
  for (const [sessionId, raw] of Object.entries(record(source.sessions))) {
    const current = Array.isArray(sessions[sessionId]) ? sessions[sessionId] : [];
    const incoming = Array.isArray(raw) ? raw : [];
    sessions[sessionId] = [...new Set([...current, ...incoming])];
  }
  target.tags = tags;
  target.sessions = sessions;
}

function mergeTextItems(target: unknown, source: unknown): unknown[] {
  const items = new Map<string, unknown>();
  for (const raw of [
    ...(Array.isArray(source) ? source : []),
    ...(Array.isArray(target) ? target : []),
  ]) {
    const id = String(record(raw).id ?? "").trim();
    if (id) items.set(id, raw);
  }
  return [...items.values()];
}

function mergeSessionTextItems(target: JsonObject, source: JsonObject, key: string): void {
  const targetSessions = record(target[key]);
  for (const [sessionId, items] of Object.entries(record(source[key]))) {
    targetSessions[sessionId] = mergeTextItems(targetSessions[sessionId], items);
  }
  if (Object.keys(targetSessions).length) target[key] = targetSessions;
}

function mergeUiState(target: JsonObject, source: JsonObject): void {
  if (target.theme === undefined && source.theme !== undefined) target.theme = source.theme;
  if (target.focusViews === undefined && Array.isArray(source.focusViews))
    target.focusViews = source.focusViews;
  target.modelPrefs = { ...record(source.modelPrefs), ...record(target.modelPrefs) };
  target.sessionRunConfigs = {
    ...record(source.sessionRunConfigs),
    ...record(target.sessionRunConfigs),
  };
  target.shortcuts = mergeTextItems(target.shortcuts, source.shortcuts);
  mergeSessionTextItems(target, source, "sessionNotes");
  mergeSessionTextItems(target, source, "sessionTodos");
  for (const key of [
    "pins",
    "sessionPins",
    "sessionTitles",
    "forkParents",
    "chatGroups",
    "commentThreads",
  ]) {
    target[key] = { ...record(source[key]), ...record(target[key]) };
  }
  const scopes = record(target.scopes);
  for (const [scopeId, raw] of Object.entries(record(source.scopes))) {
    if (!(scopeId in scopes)) scopes[scopeId] = raw;
  }
  if (Object.keys(scopes).length) target.scopes = scopes;
}

function mergeFile(
  databaseFile: string,
  key: string,
  targetFile: string,
  sourceFile: string,
  merge: Merger,
): void {
  if (!fs.existsSync(sourceFile) || path.resolve(sourceFile) === path.resolve(targetFile)) return;
  const source = objectValue(JSON.parse(fs.readFileSync(sourceFile, "utf8")));
  const document = new SqliteDocument(databaseFile, key, targetFile, objectValue);
  try {
    document.update((target) => merge(target, source));
  } finally {
    document.close();
  }
}

/**
 * Import state written by pre-1.1 workspace-local stores into the concurrent
 * global repositories. Each root is marked only after every file has merged;
 * merges are idempotent so two Attend processes may safely race at startup.
 */
export function migrateWorkspaceState(config: AttendConfig): void {
  if (config.scopeRoots.length === 0) return;
  const markerFile = path.join(path.dirname(config.uiState), "workspace-state-migrations.json");
  const marker = new SqliteDocument(
    config.workEvents,
    "workspace-state-migrations",
    markerFile,
    migrationState,
  );
  for (const root of config.scopeRoots) {
    const canonical = canonicalScopePath(root);
    if (marker.read().roots[canonical]) continue;
    const local = path.join(canonical, ".attend");
    try {
      mergeFile(config.workEvents, "tags", config.tags, path.join(local, "tags.json"), mergeTags);
      mergeFile(
        config.workEvents,
        "overrides",
        config.overrides,
        path.join(local, "overrides.json"),
        mergeRecords,
      );
      mergeFile(
        config.workEvents,
        "engagement",
        config.engagement,
        path.join(local, "engagement.json"),
        mergeNestedRecords("sessions"),
      );
      mergeFile(
        config.workEvents,
        "session-status",
        config.sessionStatus,
        path.join(local, "session-status.json"),
        mergeNestedRecords("sessions"),
      );
      mergeFile(
        config.workEvents,
        "ui-state",
        config.uiState,
        path.join(local, "ui-state.json"),
        mergeUiState,
      );
      mergeFile(
        config.workEvents,
        "chat-queue",
        config.chatQueue,
        path.join(local, "chat-queues.json"),
        mergeChatQueue,
      );
      const workEvents = new WorkEventStore(config.workEvents);
      try {
        workEvents.importJsonFile(path.join(local, "work-events.json"));
      } finally {
        workEvents.close();
      }
      marker.update((state) => {
        state.roots[canonical] = Date.now();
      });
    } catch {
      // Leave the root unmarked so a later startup can retry the whole idempotent merge.
    }
  }
  marker.close();
}
