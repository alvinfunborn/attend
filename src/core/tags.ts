import { JsonFile, type JsonRepository } from "./json-file.js";
import { SqliteDocument } from "./state-database.js";

interface TagFile {
  tags: string[];
  sessions: Record<string, string[]>;
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
    if (assigned.length) sessions[key] = assigned;
  }
  return { tags, sessions };
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

  tagsFor(sessionId: string | string[]): string[] {
    const data = this.data.read();
    const assigned = new Set<string>();
    for (const key of this.keys(sessionId)) {
      for (const tag of data.sessions[key] ?? []) assigned.add(tag);
    }
    return data.tags.filter((tag) => assigned.has(tag));
  }

  create(name: string): string[] {
    const tag = normalizeTag(name);
    if (!tag) return this.list();
    return this.data.update((data) => {
      if (!data.tags.includes(tag)) data.tags.push(tag);
      return [...data.tags];
    });
  }

  delete(name: string): string[] {
    const tag = normalizeTag(name);
    if (!tag) return this.list();
    return this.data.update((data) => {
      data.tags = data.tags.filter((candidate) => candidate !== tag);
      for (const [key, assigned] of Object.entries(data.sessions)) {
        const next = assigned.filter((candidate) => candidate !== tag);
        if (next.length) data.sessions[key] = next;
        else delete data.sessions[key];
      }
      return [...data.tags];
    });
  }

  clearSessionBindings(name: string): string[] {
    const tag = normalizeTag(name);
    if (!tag) return this.list();
    return this.data.update((data) => {
      for (const [key, assigned] of Object.entries(data.sessions)) {
        if (key.startsWith("scope:") || key.startsWith("scope-id:")) continue;
        const next = assigned.filter((candidate) => candidate !== tag);
        if (next.length) data.sessions[key] = next;
        else delete data.sessions[key];
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
        if (next.length) data.sessions[key] = [...next];
        else delete data.sessions[key];
      }
      return [...next];
    });
  }
}
