import { AUTO_TAG_LIMIT, normalizeAutoTags } from "./auto-tags.js";
import { JsonFile, type JsonRepository } from "./json-file.js";
import { SqliteDocument } from "./state-database.js";

interface TagFile {
  tags: string[];
  sessions: Record<string, string[]>;
  automation: Record<string, { tags: string[]; dismissed: string[]; disabled: boolean }>;
  autoBlocked: string[];
}

function normalizeTag(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeTagFile(value: unknown): TagFile {
  const input = value && typeof value === "object" ? (value as Partial<TagFile>) : {};
  const tags: string[] = [];
  const seen = new Set<string>();
  const add = (raw: unknown): string | null => {
    const tag = typeof raw === "string" ? normalizeTag(raw) : "";
    if (!tag) return null;
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
    return tag;
  };
  for (const raw of Array.isArray(input.tags) ? input.tags : []) add(raw);
  const sessions: Record<string, string[]> = {};
  for (const [rawKey, rawList] of Object.entries(input.sessions ?? {})) {
    const key = rawKey.trim();
    if (!key || !Array.isArray(rawList)) continue;
    const assigned: string[] = [];
    const used = new Set<string>();
    for (const raw of rawList) {
      const tag = add(raw);
      if (!tag || used.has(tag)) continue;
      used.add(tag);
      assigned.push(tag);
    }
    // Preserve an explicit empty assignment. A stable session id with no tags
    // must still override any older title / brief / path aliases.
    sessions[key] = assigned;
  }
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === "string"))] : [];
  const automation: TagFile["automation"] = {};
  for (const [key, raw] of Object.entries(input.automation ?? {})) {
    if (!raw || typeof raw !== "object") continue;
    automation[key] = {
      tags: strings(raw.tags).filter((tag) => sessions[key]?.includes(tag)),
      dismissed: strings(raw.dismissed),
      disabled: raw.disabled === true,
    };
  }
  return { tags, sessions, automation, autoBlocked: strings(input.autoBlocked) };
}

/** Persisted global tag catalog plus assignments keyed by stable session aliases. */
export class TagStore {
  private readonly data: JsonRepository<TagFile>;

  constructor(file: string, databaseFile?: string) {
    this.data = databaseFile
      ? new SqliteDocument(databaseFile, "tags", file, normalizeTagFile)
      : new JsonFile(file, normalizeTagFile);
  }

  private keys(input: string | string[]): string[] {
    const raw = Array.isArray(input) ? input : [input];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const key of raw) {
      const next = key.trim();
      if (!next || seen.has(next)) continue;
      seen.add(next);
      out.push(next);
    }
    return out;
  }

  list(): string[] {
    return [...this.data.read().tags];
  }

  /** Manual assignments are preference evidence; auto suggestions must not reinforce themselves. */
  manualTagsForSession(sessionId: string, legacyAliases: string[] = []): string[] {
    const automatic = new Set(this.data.read().automation[sessionId]?.tags ?? []);
    return this.tagsForSession(sessionId, legacyAliases).filter((tag) => !automatic.has(tag));
  }

  autoTagPreferences(sessionId: string): {
    disabled: boolean;
    dismissed: string[];
  } {
    const data = this.data.read();
    const meta = data.automation[sessionId];
    return {
      // Older clients also saved [] when creating an untagged session. Only
      // recorded manual intent can distinguish a clear from that default.
      disabled: meta?.disabled === true,
      dismissed: [...new Set([...data.autoBlocked, ...(meta?.dismissed ?? [])])],
    };
  }

  /** Reconcile only daemon-owned tags, under the same transaction as manual edits. */
  applyAutoTags(
    sessionId: string,
    suggestions: unknown,
    legacyAliases: string[] = [],
  ): { changed: boolean; created: string[] } {
    const unchanged = { changed: false, created: [] as string[] };
    const key = sessionId.trim();
    if (!key || !Array.isArray(suggestions)) return unchanged;
    const normalized = normalizeAutoTags(suggestions);
    if (suggestions.length && !normalized.length) return unchanged;
    return this.data.transact((data) => {
      const meta = data.automation[key];
      const canonical = Object.prototype.hasOwnProperty.call(data.sessions, key);
      if (meta?.disabled) return { result: unchanged, changed: false };
      const current = canonical
        ? (data.sessions[key] ?? [])
        : [...new Set(legacyAliases.flatMap((alias) => data.sessions[alias] ?? []))];
      const manual = current.filter((tag) => !meta?.tags.includes(tag));
      const blocked = new Set(
        [...data.autoBlocked, ...(meta?.dismissed ?? [])].map((tag) => tag.toLowerCase()),
      );
      // Only reconcile equivalent spellings after the daemon has generated tags.
      // Catalog membership never limits which concepts can be assigned.
      const catalog = new Map(data.tags.map((tag) => [tag.toLowerCase(), tag]));
      const automatic: string[] = [];
      const created: string[] = [];
      for (const proposed of normalized) {
        const lower = proposed.toLowerCase();
        if (blocked.has(lower) || manual.some((tag) => tag.toLowerCase() === lower)) continue;
        const existing = catalog.get(lower);
        if (manual.length + automatic.length >= AUTO_TAG_LIMIT) break;
        const tag = existing ?? proposed;
        automatic.push(tag);
        if (!existing) {
          data.tags.push(tag);
          created.push(tag);
          catalog.set(lower, tag);
        }
      }
      const next = [...manual, ...automatic];
      if (next.length === current.length && next.every((tag, i) => tag === current[i]))
        return { result: unchanged, changed: false };
      data.sessions[key] = next;
      data.automation[key] = { tags: automatic, dismissed: meta?.dismissed ?? [], disabled: false };
      return { result: { changed: true, created }, changed: true };
    });
  }

  private recordManualEdit(data: TagFile, key: string, next: string[]): void {
    const previous = data.sessions[key] ?? [];
    const dismissed = new Set(data.automation[key]?.dismissed ?? []);
    for (const tag of previous) if (!next.includes(tag)) dismissed.add(tag);
    for (const tag of next) dismissed.delete(tag);
    data.automation[key] = { tags: [], dismissed: [...dismissed], disabled: next.length === 0 };
  }

  tagsFor(sessionId: string | string[]): string[] {
    const data = this.data.read();
    const assigned = new Set<string>();
    for (const key of this.keys(sessionId)) {
      for (const tag of data.sessions[key] ?? []) assigned.add(tag);
    }
    return data.tags.filter((tag) => assigned.has(tag));
  }

  /** Use the stable session id when present, with aliases as legacy fallback. */
  tagsForSession(sessionId: string, legacyAliases: string[] = []): string[] {
    const data = this.data.read();
    const canonical = sessionId.trim();
    if (canonical && Object.prototype.hasOwnProperty.call(data.sessions, canonical)) {
      const assigned = new Set(data.sessions[canonical] ?? []);
      return data.tags.filter((tag) => assigned.has(tag));
    }
    const assigned = new Set<string>();
    for (const key of this.keys([canonical, ...legacyAliases])) {
      for (const tag of data.sessions[key] ?? []) assigned.add(tag);
    }
    return data.tags.filter((tag) => assigned.has(tag));
  }

  create(name: string): string[] {
    const tag = normalizeTag(name);
    if (!tag) return this.list();
    return this.data.update((data) => {
      if (!data.tags.includes(tag)) data.tags.push(tag);
      data.autoBlocked = data.autoBlocked.filter(
        (blocked) => blocked.toLowerCase() !== tag.toLowerCase(),
      );
      return [...data.tags];
    });
  }

  delete(name: string): string[] {
    return this.manageMany([name], "delete");
  }

  clearSessionBindings(name: string): string[] {
    return this.manageMany([name], "unbind");
  }

  /** Scope catalog entries keep tags discoverable, but are not session bindings. */
  pruneUnbound(names: string[]): string[] {
    const candidates = new Set(names.map(normalizeTag).filter(Boolean));
    if (!candidates.size) return [];
    return this.data.transact((data) => {
      for (const tag of candidates) if (!data.tags.includes(tag)) candidates.delete(tag);
      for (const [key, assigned] of Object.entries(data.sessions)) {
        if (key.startsWith("scope:") || key.startsWith("scope-id:")) continue;
        for (const tag of assigned) candidates.delete(tag);
      }
      if (!candidates.size) return { result: [], changed: false };
      data.tags = data.tags.filter((tag) => !candidates.has(tag));
      for (const [key, assigned] of Object.entries(data.sessions)) {
        data.sessions[key] = assigned.filter((tag) => !candidates.has(tag));
      }
      // Automatic cleanup is not a manual dismissal: a later suggestion may
      // legitimately recreate the same issue tag.
      return { result: [...candidates], changed: true };
    });
  }

  /** Apply a catalog operation in one persisted update, including legacy aliases. */
  manageMany(names: string[], action: "delete" | "unbind"): string[] {
    const selected = new Set(names.map(normalizeTag).filter(Boolean));
    return this.data.update((data) => {
      data.autoBlocked = [...new Set([...data.autoBlocked, ...selected])];
      if (action === "delete") data.tags = data.tags.filter((tag) => !selected.has(tag));
      for (const [key, assigned] of Object.entries(data.sessions)) {
        if (action === "unbind" && (key.startsWith("scope:") || key.startsWith("scope-id:")))
          continue;
        // Keep explicit empty canonical assignments to prevent legacy alias fallback.
        data.sessions[key] = assigned.filter((tag) => !selected.has(tag));
        const meta = data.automation[key];
        if (meta) meta.tags = meta.tags.filter((tag) => !selected.has(tag));
      }
      return [...data.tags];
    });
  }

  reorder(tags: string[]): string[] {
    return this.data.update((data) => {
      const requested: string[] = [];
      const used = new Set<string>();
      for (const raw of tags) {
        const tag = normalizeTag(raw);
        if (!tag || used.has(tag) || !data.tags.includes(tag)) continue;
        used.add(tag);
        requested.push(tag);
      }
      if (requested.length < 2) return [...data.tags];
      let index = 0;
      data.tags = data.tags.map((tag) => {
        if (!used.has(tag)) return tag;
        return requested[index++] ?? tag;
      });
      return [...data.tags];
    });
  }

  setSessionTags(sessionId: string | string[], tags: string[]): string[] {
    const keys = this.keys(sessionId);
    if (!keys.length) return [];
    return this.data.update((data) => {
      const next: string[] = [];
      const used = new Set<string>();
      for (const raw of tags) {
        const tag = normalizeTag(raw);
        if (!tag || used.has(tag)) continue;
        used.add(tag);
        next.push(tag);
        if (!data.tags.includes(tag)) data.tags.push(tag);
      }
      for (const key of keys) {
        if (!key.startsWith("scope:") && !key.startsWith("scope-id:"))
          this.recordManualEdit(data, key, next);
        if (next.length) data.sessions[key] = [...next];
        else delete data.sessions[key];
      }
      return [...next];
    });
  }

  /** Persist the exact assignment under the stable session id, including none. */
  setCanonicalSessionTags(sessionId: string, tags: string[]): string[] {
    const key = sessionId.trim();
    if (!key) return [];
    return this.data.update((data) => {
      const next: string[] = [];
      const used = new Set<string>();
      for (const raw of tags) {
        const tag = normalizeTag(raw);
        if (!tag || used.has(tag)) continue;
        used.add(tag);
        next.push(tag);
        if (!data.tags.includes(tag)) data.tags.push(tag);
      }
      this.recordManualEdit(data, key, next);
      data.sessions[key] = [...next];
      return [...next];
    });
  }
}
