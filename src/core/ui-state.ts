import { JsonFile, type JsonRepository } from "./json-file.js";
import { READ_COMMENT_RETENTION_MS } from "./retention-policy.js";
import {
  type SessionRunConfig,
  hasSessionRunConfig,
  normalizeSessionRunConfig,
  sessionRunConfigKey,
} from "./session-run-config.js";
import { SqliteDocument } from "./state-database.js";

export interface VaultUiState {
  theme?: "light" | "dark";
  focusViews?: unknown[];
  modelPrefs?: Record<string, unknown>;
  /** Exact/best-known configuration Attend used for a stable provider session. */
  sessionRunConfigs?: Record<string, UiSessionRunConfig>;
  /** Custom tags pinned in the current vault/scope ahead of the unpinned ordering. */
  pinnedTags?: string[];
  /** Scope-local dormant tags kept out of the everyday area without deleting bindings. */
  hiddenTags?: string[];
  /** Machine-global reusable text snippets inserted into any chat composer. */
  shortcuts?: UiTextItem[];
  /** User-authored notes grouped by stable session identity. */
  sessionNotes?: Record<string, UiTextItem[]>;
  /** User-authored todos grouped by stable session identity. */
  sessionTodos?: Record<string, UiTodoItem[]>;
  /** Scope-local todos that have not been attached to a session yet. */
  inboxTodos?: UiTodoItem[];
  /** Lightweight UI mirror for provider-native Goals (Claude needs this across reloads). */
  sessionGoals?: Record<string, UiSessionGoal>;
  pins?: Record<string, unknown[]>;
  /** provider session id -> time pinned in the sidebar */
  sessionPins?: Record<string, number>;
  sessionTitles?: Record<string, string>;
  /** child provider session id -> parent provider session id */
  forkParents?: Record<string, string>;
  /** User-arranged chat tab groups, keyed by a stable group id and shared across scopes. */
  chatGroups?: Record<string, UiChatGroup>;
  /** Absolute project directory -> last successful new-session launch time. */
  recentDirectories?: Record<string, number>;
  /** Hidden provider sessions attached as comment threads to transcript messages. */
  commentThreads?: Record<string, CommentThreadState>;
}

interface PersistedScopeUiState {
  focusViews?: unknown[];
  pinnedTags?: string[];
  hiddenTags?: string[];
  inboxTodos?: UiTodoItem[];
}

interface PersistedVaultUiState extends VaultUiState {
  scopes?: Record<string, PersistedScopeUiState>;
}

interface PersistedComposerTextState {
  version: 1;
  importedLegacy: boolean;
  shortcuts: UiTextItem[];
  sessionNotes: Record<string, UiTextItem[]>;
  sessionTodos: Record<string, UiTodoItem[]>;
}

export interface VaultUiStatePatch {
  theme?: "light" | "dark";
  focusViews?: unknown[];
  focusViewPatch?: Record<string, unknown | null>;
  modelPrefs?: Record<string, unknown | null>;
  sessionRunConfigs?: Record<string, UiSessionRunConfig | null>;
  pinnedTags?: string[];
  hiddenTags?: string[];
  shortcuts?: UiTextItem[];
  sessionNotes?: Record<string, UiTextItem[] | null>;
  sessionTodos?: Record<string, UiTodoItem[] | null>;
  inboxTodos?: UiTodoItem[];
  sessionGoals?: Record<string, UiSessionGoal | null>;
  pins?: Record<string, unknown[] | null>;
  sessionPins?: Record<string, number | null>;
  sessionTitles?: Record<string, string | null>;
  forkParents?: Record<string, string | null>;
  chatGroups?: Record<string, UiChatGroup | null>;
  commentThreads?: Record<string, CommentThreadState | null>;
}

export interface UiChatGroupMember {
  vendor: string;
  sessionId: string;
}

export interface UiChatGroup {
  id: string;
  members: UiChatGroupMember[];
  updatedAt: number;
}

export interface UiTextItem {
  id: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

export interface UiTodoItem extends UiTextItem {
  completed: boolean;
  completedAt?: number;
}

export interface UiSessionGoal {
  objective: string;
  vendor: "claude" | "codex";
  status: "active" | "paused" | "blocked" | "usageLimited" | "budgetLimited" | "complete";
  updatedAt: number;
}

export interface UiSessionRunConfig extends SessionRunConfig {
  updatedAt: number;
}

export interface CommentThreadState {
  id: string;
  parentSessionId: string;
  anchorKey: string;
  anchorText: string;
  anchorData?: CommentAnchorData;
  providerSessionId: string;
  vendor: string;
  cwd: string;
  createdAt: number;
  /** Latest user-authored turn in this thread; attributed to the parent for recent sorting. */
  lastUserMessageAt?: number;
  /** Latest user-authored text, used as the temporary title if this thread is promoted. */
  lastUserText?: string;
  createdWhileGenerating?: boolean;
  status?: "scheduled" | "generating" | "unread" | "read" | "failed";
  messageCount?: number;
}

export type CommentAnchorData =
  | { kind: "message"; role: "user" | "assistant"; text: string }
  | {
      kind: "tool";
      tool: { name: string; input?: unknown; result?: unknown; isError?: boolean };
    };

/** Attend-owned UI data shared safely by local server instances. */
export class VaultUiStateStore {
  private readonly data: JsonRepository<PersistedVaultUiState>;
  private readonly composerText: JsonRepository<PersistedComposerTextState> | null;
  private readonly scopeId: string;
  private readonly memberScopeIds: string[];

  constructor(
    file: string,
    scopeId = "scope:v1:all",
    databaseFile?: string,
    memberScopeIds: string[] = [],
  ) {
    this.data = databaseFile
      ? new SqliteDocument(databaseFile, "ui-state", file, normalizeUiState)
      : new JsonFile(file, normalizeUiState);
    this.composerText = databaseFile
      ? new SqliteDocument(
          databaseFile,
          "composer-text",
          `${file}.composer-text`,
          normalizeComposerTextState,
        )
      : null;
    this.scopeId = scopeId.trim() || "scope:v1:all";
    this.memberScopeIds = [
      ...new Set(memberScopeIds.map((id) => id.trim()).filter((id) => id && id !== this.scopeId)),
    ];
    if (this.memberScopeIds.length) this.flattenCombinedScope();
    if (this.composerText) {
      const legacy = this.data.read();
      this.composerText.transact((state) => {
        if (state.importedLegacy) return { result: undefined, changed: false };
        state.shortcuts = mergeTextItemLists(legacy.shortcuts, state.shortcuts, false);
        state.sessionNotes = mergeTextItemRecords(legacy.sessionNotes, state.sessionNotes, false);
        state.sessionTodos = mergeTextItemRecords(legacy.sessionTodos, state.sessionTodos, true);
        state.importedLegacy = true;
        return { result: undefined, changed: true };
      });
    }
  }

  get(): VaultUiState {
    const state = this.data.read();
    const composerText = this.composerText?.read();
    const {
      scopes: _scopes,
      focusViews: legacyFocusViews,
      pinnedTags: legacyPinnedTags,
      hiddenTags: legacyHiddenTags,
      inboxTodos: legacyInboxTodos,
      ...shared
    } = state;
    const focusViews = this.scopeFocusViews(state, legacyFocusViews);
    const pinnedTags = this.scopeTagDisplayState(state, "pinnedTags", legacyPinnedTags);
    const hiddenTags = this.scopeTagDisplayState(state, "hiddenTags", legacyHiddenTags);
    const inboxTodos = this.scopeInboxTodos(state, legacyInboxTodos);
    return structuredClone({
      ...shared,
      ...(composerText
        ? {
            shortcuts: composerText.shortcuts,
            sessionNotes: composerText.sessionNotes,
            sessionTodos: composerText.sessionTodos,
          }
        : {}),
      ...(Array.isArray(focusViews) ? { focusViews } : {}),
      ...(Array.isArray(pinnedTags) ? { pinnedTags } : {}),
      ...(Array.isArray(hiddenTags) ? { hiddenTags } : {}),
      ...(Array.isArray(inboxTodos) ? { inboxTodos } : {}),
    });
  }

  private flattenCombinedScope(): void {
    this.data.transact((state) => {
      const combined = state.scopes?.[this.scopeId];
      if (!combined || !state.scopes) return { result: undefined, changed: false };
      for (const memberScopeId of this.memberScopeIds) {
        const member = state.scopes[memberScopeId] ?? {};
        if (!Object.prototype.hasOwnProperty.call(member, "focusViews") && combined.focusViews)
          member.focusViews = structuredClone(combined.focusViews);
        if (!Object.prototype.hasOwnProperty.call(member, "pinnedTags") && combined.pinnedTags)
          member.pinnedTags = [...combined.pinnedTags];
        if (!Object.prototype.hasOwnProperty.call(member, "hiddenTags") && combined.hiddenTags)
          member.hiddenTags = [...combined.hiddenTags];
        if (!Object.prototype.hasOwnProperty.call(member, "inboxTodos") && combined.inboxTodos)
          member.inboxTodos = structuredClone(combined.inboxTodos);
        state.scopes[memberScopeId] = member;
      }
      const { [this.scopeId]: _combined, ...memberScopes } = state.scopes;
      state.scopes = memberScopes;
      return { result: undefined, changed: true };
    });
  }

  private scopeFocusViews(
    state: PersistedVaultUiState,
    legacy: unknown[] | undefined,
  ): unknown[] | undefined {
    if (!this.memberScopeIds.length) return state.scopes?.[this.scopeId]?.focusViews ?? legacy;
    const merged: unknown[] = [];
    const seen = new Set<string>();
    let found = false;
    for (const memberScopeId of this.memberScopeIds) {
      const member = state.scopes?.[memberScopeId];
      if (!member || !Object.prototype.hasOwnProperty.call(member, "focusViews")) continue;
      found = true;
      for (const view of member.focusViews ?? []) {
        const id =
          view && typeof view === "object" && !Array.isArray(view) && "id" in view
            ? String(view.id).trim()
            : "";
        if (!id || seen.has(id)) continue;
        seen.add(id);
        merged.push(structuredClone(view));
      }
    }
    return found ? merged : legacy;
  }

  private scopeTagDisplayState(
    state: PersistedVaultUiState,
    key: "pinnedTags" | "hiddenTags",
    legacy: string[] | undefined,
  ): string[] | undefined {
    const inherited: string[] = [];
    let found = false;
    for (const memberScopeId of this.memberScopeIds) {
      const fallback = state.scopes?.[memberScopeId];
      if (!fallback || !Object.prototype.hasOwnProperty.call(fallback, key)) continue;
      found = true;
      inherited.push(...(fallback[key] ?? []));
    }
    if (found) return cleanPinnedTags(inherited);

    if (this.memberScopeIds.length) return legacy;
    const scoped = state.scopes?.[this.scopeId];
    return scoped && Object.prototype.hasOwnProperty.call(scoped, key) ? scoped[key] : legacy;
  }

  private scopeInboxTodos(
    state: PersistedVaultUiState,
    legacy: UiTodoItem[] | undefined,
  ): UiTodoItem[] | undefined {
    if (!this.memberScopeIds.length) {
      const scoped = state.scopes?.[this.scopeId];
      return scoped && Object.prototype.hasOwnProperty.call(scoped, "inboxTodos")
        ? scoped.inboxTodos
        : legacy;
    }
    let found = false;
    let merged: UiTodoItem[] = [];
    for (const memberScopeId of this.memberScopeIds) {
      const member = state.scopes?.[memberScopeId];
      if (!member || !Object.prototype.hasOwnProperty.call(member, "inboxTodos")) continue;
      found = true;
      merged = mergeTextItemLists(merged, member.inboxTodos, true);
    }
    return found ? merged : legacy;
  }

  patch(next: VaultUiStatePatch): VaultUiState {
    this.data.update((state) => {
      if (next.theme === "light" || next.theme === "dark") state.theme = next.theme;
      if (
        Array.isArray(next.focusViews) ||
        next.focusViewPatch ||
        Array.isArray(next.pinnedTags) ||
        Array.isArray(next.hiddenTags) ||
        Array.isArray(next.inboxTodos)
      ) {
        state.scopes ??= {};
        if (Array.isArray(next.focusViews) || next.focusViewPatch) {
          const focusScopeIds = this.memberScopeIds.length ? this.memberScopeIds : [this.scopeId];
          for (const focusScopeId of focusScopeIds) {
            const scoped = state.scopes[focusScopeId] ?? {};
            if (Array.isArray(next.focusViews))
              scoped.focusViews = structuredClone(next.focusViews);
            if (next.focusViewPatch && typeof next.focusViewPatch === "object")
              scoped.focusViews = patchFocusViews(
                scoped.focusViews ?? state.focusViews,
                next.focusViewPatch,
              );
            state.scopes[focusScopeId] = scoped;
          }
        }
        if (Array.isArray(next.pinnedTags) || Array.isArray(next.hiddenTags)) {
          const tagScopeIds = this.memberScopeIds.length ? this.memberScopeIds : [this.scopeId];
          for (const tagScopeId of tagScopeIds) {
            const scoped = state.scopes[tagScopeId] ?? {};
            if (Array.isArray(next.pinnedTags))
              scoped.pinnedTags = cleanPinnedTags(next.pinnedTags);
            if (Array.isArray(next.hiddenTags))
              scoped.hiddenTags = cleanPinnedTags(next.hiddenTags);
            state.scopes[tagScopeId] = scoped;
          }
        }
        if (Array.isArray(next.inboxTodos)) {
          const inboxScopeIds = this.memberScopeIds.length ? this.memberScopeIds : [this.scopeId];
          for (const inboxScopeId of inboxScopeIds) {
            const scoped = state.scopes[inboxScopeId] ?? {};
            scoped.inboxTodos = cleanTodoItems(next.inboxTodos);
            state.scopes[inboxScopeId] = scoped;
          }
        }
      }
      if (next.modelPrefs && typeof next.modelPrefs === "object")
        state.modelPrefs = patchUnknownRecord(state.modelPrefs, next.modelPrefs);
      if (next.sessionRunConfigs && typeof next.sessionRunConfigs === "object")
        state.sessionRunConfigs = patchSessionRunConfigs(
          state.sessionRunConfigs,
          next.sessionRunConfigs,
        );
      if (!this.composerText && Array.isArray(next.shortcuts))
        state.shortcuts = cleanTextItems(next.shortcuts);
      if (!this.composerText && next.sessionNotes && typeof next.sessionNotes === "object")
        state.sessionNotes = patchTextItemRecord(state.sessionNotes, next.sessionNotes, false);
      if (!this.composerText && next.sessionTodos && typeof next.sessionTodos === "object")
        state.sessionTodos = patchTextItemRecord(state.sessionTodos, next.sessionTodos, true);
      if (next.sessionGoals && typeof next.sessionGoals === "object")
        state.sessionGoals = patchSessionGoals(state.sessionGoals, next.sessionGoals);
      if (next.pins && typeof next.pins === "object")
        state.pins = patchUnknownArrayRecord(state.pins, next.pins);
      if (next.sessionPins && typeof next.sessionPins === "object")
        state.sessionPins = patchNumberRecord(state.sessionPins, next.sessionPins);
      if (next.sessionTitles && typeof next.sessionTitles === "object")
        state.sessionTitles = patchStringRecord(state.sessionTitles, next.sessionTitles);
      if (next.forkParents && typeof next.forkParents === "object")
        state.forkParents = patchStringRecord(state.forkParents, next.forkParents);
      if (next.chatGroups && typeof next.chatGroups === "object")
        state.chatGroups = patchChatGroups(state.chatGroups, next.chatGroups);
      if (next.commentThreads && typeof next.commentThreads === "object")
        state.commentThreads = patchCommentThreads(state.commentThreads, next.commentThreads);
      return undefined;
    });
    if (
      this.composerText &&
      (Array.isArray(next.shortcuts) || next.sessionNotes || next.sessionTodos)
    ) {
      this.composerText.update((state) => {
        if (Array.isArray(next.shortcuts)) state.shortcuts = cleanTextItems(next.shortcuts);
        if (next.sessionNotes && typeof next.sessionNotes === "object")
          state.sessionNotes = patchTextItemRecord(state.sessionNotes, next.sessionNotes, false);
        if (next.sessionTodos && typeof next.sessionTodos === "object")
          state.sessionTodos = patchTextItemRecord(state.sessionTodos, next.sessionTodos, true);
      });
    }
    return this.get();
  }

  /**
   * Merge a session configuration atomically. Exact sources overwrite concrete
   * fields; observed provider values only fill fields Attend does not know yet.
   */
  recordSessionRunConfig(
    vendor: string,
    sessionId: string,
    next: SessionRunConfig,
    options: { observed?: boolean; at?: number } = {},
  ): UiSessionRunConfig | null {
    const key = sessionRunConfigKey(vendor, sessionId);
    const update = normalizeSessionRunConfig(next);
    if (!key || !hasSessionRunConfig(update)) return null;
    let result: UiSessionRunConfig | null = null;
    this.data.update((state) => {
      const current = cleanSessionRunConfig(state.sessionRunConfigs?.[key]);
      const values: SessionRunConfig = { ...(current ?? {}) };
      let changed = false;
      for (const field of ["model", "effort", "speed"] as const) {
        const value = update[field];
        if (!value || (options.observed && values[field])) continue;
        if (values[field] !== value) changed = true;
        values[field] = value;
      }
      const at = positiveTimestamp(options.at ?? Date.now()) ?? Date.now();
      result = {
        ...normalizeSessionRunConfig(values),
        updatedAt: changed || !current ? at : current.updatedAt,
      };
      state.sessionRunConfigs ??= {};
      state.sessionRunConfigs[key] = result;
      return undefined;
    });
    return result ? structuredClone(result) : null;
  }

  /** Record a successfully created session's directory for the new-session MRU picker. */
  recordDirectoryUse(directory: string, at = Date.now()): void {
    const cleanDirectory = directory.trim();
    const cleanAt = positiveTimestamp(at);
    if (!cleanDirectory || cleanAt === null) return;
    this.data.update((state) => {
      const entries = Object.entries({
        ...(state.recentDirectories ?? {}),
        [cleanDirectory]: cleanAt,
      })
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, MAX_RECENT_DIRECTORIES);
      state.recentDirectories = Object.fromEntries(entries);
    });
  }

  /** Expire only old read comments; unread, generating, and failed threads require user action. */
  pruneReadComments(now = Date.now()): number {
    const cutoff = now - READ_COMMENT_RETENTION_MS;
    return this.data.transact((state) => {
      let removed = 0;
      for (const [id, thread] of Object.entries(state.commentThreads ?? {})) {
        if (thread.status === "read" && thread.createdAt < cutoff) {
          delete state.commentThreads?.[id];
          removed += 1;
        }
      }
      return { result: removed, changed: removed > 0 };
    });
  }
}

function patchFocusViews(
  current: unknown[] | undefined,
  patch: Record<string, unknown | null>,
): unknown[] {
  const views = Array.isArray(current) ? structuredClone(current) : [];
  for (const [rawId, value] of Object.entries(patch)) {
    const id = rawId.trim();
    if (!id) continue;
    const index = views.findIndex(
      (view) => view && typeof view === "object" && String((view as { id?: unknown }).id) === id,
    );
    if (value === null) {
      if (index >= 0) views.splice(index, 1);
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const next = { ...(structuredClone(value) as Record<string, unknown>), id };
    if (index >= 0) views[index] = next;
    else views.push(next);
  }
  return views;
}

function patchUnknownRecord(
  current: Record<string, unknown> | undefined,
  patch: Record<string, unknown | null>,
): Record<string, unknown> {
  const out = structuredClone(current ?? {});
  for (const [rawKey, value] of Object.entries(patch)) {
    const key = rawKey.trim();
    if (!key) continue;
    if (value === null) delete out[key];
    else out[key] = structuredClone(value);
  }
  return out;
}

function patchUnknownArrayRecord(
  current: Record<string, unknown[]> | undefined,
  patch: Record<string, unknown[] | null>,
): Record<string, unknown[]> {
  const out = structuredClone(current ?? {});
  for (const [rawKey, value] of Object.entries(patch)) {
    const key = rawKey.trim();
    if (!key) continue;
    if (value === null) delete out[key];
    else if (Array.isArray(value)) out[key] = structuredClone(value);
  }
  return out;
}

function patchTextItemRecord<T extends UiTextItem>(
  current: Record<string, T[]> | undefined,
  patch: Record<string, T[] | null>,
  todos: boolean,
): Record<string, T[]> {
  const out = structuredClone(current ?? {});
  for (const [rawKey, value] of Object.entries(patch)) {
    const key = rawKey.trim();
    if (!key) continue;
    if (value === null) {
      delete out[key];
      continue;
    }
    if (!Array.isArray(value)) continue;
    const clean = (todos ? cleanTodoItems(value) : cleanTextItems(value)) as T[];
    if (clean.length) out[key] = clean;
    else delete out[key];
  }
  return out;
}

function patchStringRecord(
  current: Record<string, string> | undefined,
  patch: Record<string, string | null>,
): Record<string, string> {
  const out = { ...(current ?? {}) };
  for (const [rawKey, value] of Object.entries(patch)) {
    const key = rawKey.trim();
    const clean = typeof value === "string" ? value.trim() : "";
    if (!key) continue;
    if (!clean) delete out[key];
    else out[key] = clean;
  }
  return out;
}

function patchNumberRecord(
  current: Record<string, number> | undefined,
  patch: Record<string, number | null>,
): Record<string, number> {
  const out = { ...(current ?? {}) };
  for (const [rawKey, rawValue] of Object.entries(patch)) {
    const key = rawKey.trim();
    const value = Number(rawValue);
    if (!key) continue;
    if (rawValue === null || !Number.isFinite(value) || value <= 0) delete out[key];
    else out[key] = value;
  }
  return out;
}

function patchCommentThreads(
  current: Record<string, CommentThreadState> | undefined,
  patch: Record<string, CommentThreadState | null>,
): Record<string, CommentThreadState> {
  const out = structuredClone(current ?? {});
  for (const [rawKey, value] of Object.entries(patch)) {
    const key = rawKey.trim();
    if (!key) continue;
    if (value === null) {
      delete out[key];
      continue;
    }
    const clean = cleanCommentThreads({ [key]: value })[key];
    if (clean) out[key] = clean;
  }
  return out;
}

const GOAL_STATUSES = new Set<UiSessionGoal["status"]>([
  "active",
  "paused",
  "blocked",
  "usageLimited",
  "budgetLimited",
  "complete",
]);

function cleanSessionGoal(value: unknown): UiSessionGoal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Partial<UiSessionGoal>;
  const objective = typeof input.objective === "string" ? input.objective.trim() : "";
  const vendor = input.vendor === "claude" || input.vendor === "codex" ? input.vendor : null;
  const status = GOAL_STATUSES.has(input.status as UiSessionGoal["status"])
    ? (input.status as UiSessionGoal["status"])
    : null;
  const updatedAt = Number(input.updatedAt);
  if (!objective || !vendor || !status || !Number.isFinite(updatedAt) || updatedAt <= 0)
    return null;
  return { objective, vendor, status, updatedAt };
}

function cleanSessionGoals(input: Record<string, unknown>): Record<string, UiSessionGoal> {
  const out: Record<string, UiSessionGoal> = {};
  for (const [rawKey, value] of Object.entries(input)) {
    const key = rawKey.trim();
    const goal = cleanSessionGoal(value);
    if (key && goal) out[key] = goal;
  }
  return out;
}

function patchSessionGoals(
  current: Record<string, UiSessionGoal> | undefined,
  patch: Record<string, UiSessionGoal | null>,
): Record<string, UiSessionGoal> {
  const out = structuredClone(current ?? {});
  for (const [rawKey, value] of Object.entries(patch)) {
    const key = rawKey.trim();
    if (!key) continue;
    if (value === null) delete out[key];
    else {
      const goal = cleanSessionGoal(value);
      if (goal) out[key] = goal;
    }
  }
  return out;
}

function cleanSessionRunConfig(value: unknown): UiSessionRunConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const values = normalizeSessionRunConfig(value);
  const updatedAt = positiveTimestamp((value as { updatedAt?: unknown }).updatedAt);
  if (!updatedAt || !hasSessionRunConfig(values)) return null;
  return { ...values, updatedAt };
}

function cleanSessionRunConfigs(
  input: Record<string, unknown>,
): Record<string, UiSessionRunConfig> {
  const out: Record<string, UiSessionRunConfig> = {};
  for (const [rawKey, value] of Object.entries(input)) {
    const key = rawKey.trim();
    const config = cleanSessionRunConfig(value);
    if (key && config) out[key] = config;
  }
  return out;
}

function patchSessionRunConfigs(
  current: Record<string, UiSessionRunConfig> | undefined,
  patch: Record<string, UiSessionRunConfig | null>,
): Record<string, UiSessionRunConfig> {
  const out = structuredClone(current ?? {});
  for (const [rawKey, value] of Object.entries(patch)) {
    const key = rawKey.trim();
    if (!key) continue;
    if (value === null) delete out[key];
    else {
      const config = cleanSessionRunConfig(value);
      if (config) out[key] = config;
    }
  }
  return out;
}

const MAX_CHAT_GROUPS = 256;
const MAX_CHAT_GROUP_MEMBERS = 64;

function cleanChatGroup(rawId: string, value: unknown): UiChatGroup | null {
  const id = rawId.trim();
  if (!id || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Partial<UiChatGroup>;
  const members: UiChatGroupMember[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(input.members) ? input.members : []) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const vendor = String((raw as Partial<UiChatGroupMember>).vendor ?? "")
      .trim()
      .toLowerCase();
    const sessionId = String((raw as Partial<UiChatGroupMember>).sessionId ?? "").trim();
    const key = `${vendor}\0${sessionId}`;
    if (!vendor || !sessionId || seen.has(key)) continue;
    seen.add(key);
    members.push({ vendor, sessionId });
    if (members.length >= MAX_CHAT_GROUP_MEMBERS) break;
  }
  if (members.length < 2) return null;
  const updatedAt = Number(input.updatedAt);
  return { id, members, updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 1 };
}

function cleanChatGroups(input: Record<string, unknown>): Record<string, UiChatGroup> {
  const groups: UiChatGroup[] = [];
  for (const [rawId, value] of Object.entries(input)) {
    const group = cleanChatGroup(rawId, value);
    if (group) groups.push(group);
  }
  groups.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  return Object.fromEntries(groups.slice(0, MAX_CHAT_GROUPS).map((group) => [group.id, group]));
}

function patchChatGroups(
  current: Record<string, UiChatGroup> | undefined,
  patch: Record<string, UiChatGroup | null>,
): Record<string, UiChatGroup> {
  const out = structuredClone(current ?? {});
  for (const [rawId, value] of Object.entries(patch)) {
    const id = rawId.trim();
    if (!id) continue;
    if (value === null) delete out[id];
    else {
      const group = cleanChatGroup(id, value);
      if (group) out[id] = group;
      else delete out[id];
    }
  }
  return cleanChatGroups(out);
}

function normalizeUiState(value: unknown): PersistedVaultUiState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as VaultUiState;
  return {
    ...(input.theme === "light" || input.theme === "dark" ? { theme: input.theme } : {}),
    ...(Array.isArray(input.focusViews) ? { focusViews: structuredClone(input.focusViews) } : {}),
    ...(input.modelPrefs && typeof input.modelPrefs === "object"
      ? { modelPrefs: structuredClone(input.modelPrefs) }
      : {}),
    ...(input.sessionRunConfigs && typeof input.sessionRunConfigs === "object"
      ? { sessionRunConfigs: cleanSessionRunConfigs(input.sessionRunConfigs) }
      : {}),
    ...(Array.isArray(input.pinnedTags) && cleanPinnedTags(input.pinnedTags).length
      ? { pinnedTags: cleanPinnedTags(input.pinnedTags) }
      : {}),
    ...(Array.isArray(input.hiddenTags) && cleanPinnedTags(input.hiddenTags).length
      ? { hiddenTags: cleanPinnedTags(input.hiddenTags) }
      : {}),
    ...(Array.isArray(input.inboxTodos) ? { inboxTodos: cleanTodoItems(input.inboxTodos) } : {}),
    ...(Array.isArray(input.shortcuts) ? { shortcuts: cleanTextItems(input.shortcuts) } : {}),
    ...(input.sessionNotes && typeof input.sessionNotes === "object"
      ? { sessionNotes: cleanTextItemRecord(input.sessionNotes, false) }
      : {}),
    ...(input.sessionTodos && typeof input.sessionTodos === "object"
      ? { sessionTodos: cleanTextItemRecord(input.sessionTodos, true) }
      : {}),
    ...(input.sessionGoals && typeof input.sessionGoals === "object"
      ? { sessionGoals: cleanSessionGoals(input.sessionGoals) }
      : {}),
    ...(input.pins && typeof input.pins === "object" ? { pins: structuredClone(input.pins) } : {}),
    ...(input.sessionPins && typeof input.sessionPins === "object"
      ? { sessionPins: cleanNumberRecord(input.sessionPins) }
      : {}),
    ...(input.sessionTitles && typeof input.sessionTitles === "object"
      ? { sessionTitles: cleanStringRecord(input.sessionTitles) }
      : {}),
    ...(input.forkParents && typeof input.forkParents === "object"
      ? { forkParents: cleanStringRecord(input.forkParents) }
      : {}),
    ...(input.chatGroups && typeof input.chatGroups === "object"
      ? { chatGroups: cleanChatGroups(input.chatGroups) }
      : {}),
    ...(input.recentDirectories && typeof input.recentDirectories === "object"
      ? {
          recentDirectories: Object.fromEntries(
            Object.entries(cleanNumberRecord(input.recentDirectories))
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
              .slice(0, MAX_RECENT_DIRECTORIES),
          ),
        }
      : {}),
    ...(input.commentThreads && typeof input.commentThreads === "object"
      ? { commentThreads: cleanCommentThreads(input.commentThreads) }
      : {}),
    ...cleanScopes((input as PersistedVaultUiState).scopes),
  };
}

function normalizeComposerTextState(value: unknown): PersistedComposerTextState {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<PersistedComposerTextState>)
      : {};
  return {
    version: 1,
    importedLegacy: input.importedLegacy === true,
    shortcuts: Array.isArray(input.shortcuts) ? cleanTextItems(input.shortcuts) : [],
    sessionNotes:
      input.sessionNotes && typeof input.sessionNotes === "object"
        ? cleanTextItemRecord(input.sessionNotes, false)
        : {},
    sessionTodos:
      input.sessionTodos && typeof input.sessionTodos === "object"
        ? cleanTextItemRecord(input.sessionTodos, true)
        : {},
  };
}

function mergeTextItemLists(source: unknown, target: unknown, todos: false): UiTextItem[];
function mergeTextItemLists(source: unknown, target: unknown, todos: true): UiTodoItem[];
function mergeTextItemLists(
  source: unknown,
  target: unknown,
  todos: boolean,
): UiTextItem[] | UiTodoItem[] {
  const merged = new Map<string, unknown>();
  for (const item of [
    ...(Array.isArray(source) ? source : []),
    ...(Array.isArray(target) ? target : []),
  ]) {
    const id =
      item && typeof item === "object" && !Array.isArray(item) && "id" in item
        ? String(item.id).trim()
        : "";
    if (id) merged.set(id, item);
  }
  return todos ? cleanTodoItems([...merged.values()]) : cleanTextItems([...merged.values()]);
}

function mergeTextItemRecords(
  source: unknown,
  target: Record<string, UiTextItem[]>,
  todos: false,
): Record<string, UiTextItem[]>;
function mergeTextItemRecords(
  source: unknown,
  target: Record<string, UiTodoItem[]>,
  todos: true,
): Record<string, UiTodoItem[]>;
function mergeTextItemRecords(
  source: unknown,
  target: Record<string, UiTextItem[] | UiTodoItem[]>,
  todos: boolean,
): Record<string, UiTextItem[] | UiTodoItem[]> {
  const incoming = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  const merged: Record<string, UiTextItem[] | UiTodoItem[]> = structuredClone(target);
  for (const [sessionId, items] of Object.entries(incoming)) {
    const cleanSessionId = sessionId.trim();
    if (!cleanSessionId) continue;
    merged[cleanSessionId] = todos
      ? mergeTextItemLists(items, merged[cleanSessionId], true)
      : mergeTextItemLists(items, merged[cleanSessionId], false);
  }
  return merged;
}

function cleanPinnedTags(input: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const tag = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

const MAX_TEXT_ITEMS = 500;
const MAX_TEXT_ITEM_CHARS = 20_000;
const MAX_RECENT_DIRECTORIES = 100;

function cleanTextItems(input: unknown[]): UiTextItem[] {
  const out: UiTextItem[] = [];
  const seen = new Set<string>();
  for (const raw of input.slice(0, MAX_TEXT_ITEMS)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Partial<UiTextItem>;
    const id = typeof item.id === "string" ? item.id.trim().slice(0, 128) : "";
    const text =
      typeof item.text === "string" ? item.text.trim().slice(0, MAX_TEXT_ITEM_CHARS) : "";
    if (!id || !text || seen.has(id)) continue;
    seen.add(id);
    const createdAt = positiveTimestamp(item.createdAt) ?? Date.now();
    const updatedAt = positiveTimestamp(item.updatedAt) ?? createdAt;
    out.push({ id, text, createdAt, updatedAt });
  }
  return out;
}

function cleanTodoItems(input: unknown[]): UiTodoItem[] {
  const rawById = new Map<string, Partial<UiTodoItem>>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Partial<UiTodoItem>;
    if (typeof item.id === "string") rawById.set(item.id.trim().slice(0, 128), item);
  }
  return cleanTextItems(input).map((item) => {
    const raw = rawById.get(item.id);
    const completed = raw?.completed === true;
    const completedAt = completed ? positiveTimestamp(raw?.completedAt) : null;
    return {
      ...item,
      completed,
      ...(completedAt !== null ? { completedAt } : {}),
    };
  });
}

function cleanTextItemRecord(
  input: Record<string, unknown>,
  todos: false,
): Record<string, UiTextItem[]>;
function cleanTextItemRecord(
  input: Record<string, unknown>,
  todos: true,
): Record<string, UiTodoItem[]>;
function cleanTextItemRecord(
  input: Record<string, unknown>,
  todos: boolean,
): Record<string, UiTextItem[] | UiTodoItem[]> {
  const out: Record<string, UiTextItem[] | UiTodoItem[]> = {};
  for (const [rawKey, rawItems] of Object.entries(input)) {
    const key = rawKey.trim();
    if (!key || !Array.isArray(rawItems)) continue;
    const items = todos ? cleanTodoItems(rawItems) : cleanTextItems(rawItems);
    if (items.length) out[key] = items;
  }
  return out;
}

function positiveTimestamp(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
}

function cleanNumberRecord(input: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.trim();
    const value = Number(rawValue);
    if (key && Number.isFinite(value) && value > 0) out[key] = value;
  }
  return out;
}

function cleanScopes(
  input: PersistedVaultUiState["scopes"],
): Pick<PersistedVaultUiState, "scopes"> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const scopes: NonNullable<PersistedVaultUiState["scopes"]> = {};
  for (const [rawId, raw] of Object.entries(input)) {
    const id = rawId.trim();
    if (!id || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const scoped: PersistedScopeUiState = {};
    if (Array.isArray(raw.focusViews)) scoped.focusViews = structuredClone(raw.focusViews);
    if (Array.isArray(raw.pinnedTags)) scoped.pinnedTags = cleanPinnedTags(raw.pinnedTags);
    if (Array.isArray(raw.hiddenTags)) scoped.hiddenTags = cleanPinnedTags(raw.hiddenTags);
    if (Array.isArray(raw.inboxTodos)) scoped.inboxTodos = cleanTodoItems(raw.inboxTodos);
    if (Object.keys(scoped).length) scopes[id] = scoped;
  }
  return Object.keys(scopes).length ? { scopes } : {};
}

function cleanCommentThreads(
  input: Record<string, CommentThreadState>,
): Record<string, CommentThreadState> {
  const out: Record<string, CommentThreadState> = {};
  for (const [rawKey, raw] of Object.entries(input)) {
    if (!raw || typeof raw !== "object") continue;
    const id = String(raw.id || rawKey).trim();
    const parentSessionId = String(raw.parentSessionId || "").trim();
    const anchorKey = String(raw.anchorKey || "").trim();
    const providerSessionId = String(raw.providerSessionId || "").trim();
    const vendor = String(raw.vendor || "").trim();
    const cwd = String(raw.cwd || "").trim();
    if (!id || !parentSessionId || !anchorKey || !vendor || !cwd) continue;
    if (!providerSessionId && raw.status !== "scheduled") continue;
    out[id] = {
      id,
      parentSessionId,
      anchorKey,
      anchorText: String(raw.anchorText || "").slice(0, 20_000),
      ...(raw.anchorData && typeof raw.anchorData === "object"
        ? { anchorData: structuredClone(raw.anchorData) }
        : {}),
      providerSessionId,
      vendor,
      cwd,
      createdAt: Number(raw.createdAt) || Date.now(),
      ...(Number.isFinite(Number(raw.lastUserMessageAt)) && Number(raw.lastUserMessageAt) > 0
        ? { lastUserMessageAt: Number(raw.lastUserMessageAt) }
        : {}),
      ...(typeof raw.lastUserText === "string" && raw.lastUserText.trim()
        ? { lastUserText: raw.lastUserText.trim().slice(0, 20_000) }
        : {}),
      ...(raw.createdWhileGenerating ? { createdWhileGenerating: true } : {}),
      ...(raw.status === "scheduled" ||
      raw.status === "generating" ||
      raw.status === "unread" ||
      raw.status === "read" ||
      raw.status === "failed"
        ? { status: raw.status }
        : {}),
      messageCount: Math.max(0, Math.floor(Number(raw.messageCount) || 0)),
    };
  }
  return out;
}

function cleanStringRecord(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.trim();
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (key && value) out[key] = value;
  }
  return out;
}
