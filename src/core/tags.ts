import fs from "node:fs";
import path from "node:path";

interface TagFile {
  tags?: string[];
  sessions?: Record<string, string[]>;
}

function normalizeTag(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Persisted tag state: one global tag list plus per-session assignments. Global
 * deletion cascades to every session; assigning an unknown tag auto-creates it.
 */
export class TagStore {
  private tags: string[] = [];
  private bySession = new Map<string, string[]>();
  private loaded = false;

  constructor(private readonly file: string) {}

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, "utf-8")) as TagFile;
      const seen = new Set<string>();
      for (const tag of raw.tags ?? []) {
        const name = normalizeTag(tag);
        if (!name || seen.has(name)) continue;
        seen.add(name);
        this.tags.push(name);
      }
      for (const [sessionId, list] of Object.entries(raw.sessions ?? {})) {
        const next: string[] = [];
        const used = new Set<string>();
        for (const tag of list) {
          const name = normalizeTag(tag);
          if (!name || used.has(name)) continue;
          used.add(name);
          next.push(name);
          if (!seen.has(name)) {
            seen.add(name);
            this.tags.push(name);
          }
        }
        if (next.length) this.bySession.set(sessionId, next);
      }
    } catch {
      // missing/corrupt — start empty
    }
  }

  list(): string[] {
    this.load();
    return [...this.tags];
  }

  tagsFor(sessionId: string): string[] {
    this.load();
    return [...(this.bySession.get(sessionId) ?? [])];
  }

  create(name: string): string[] {
    this.load();
    const tag = normalizeTag(name);
    if (!tag) return this.list();
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.persist();
    }
    return this.list();
  }

  delete(name: string): string[] {
    this.load();
    const tag = normalizeTag(name);
    if (!tag) return this.list();
    const idx = this.tags.indexOf(tag);
    if (idx < 0) return this.list();
    this.tags.splice(idx, 1);
    for (const [sessionId, tags] of this.bySession) {
      const next = tags.filter((x) => x !== tag);
      if (next.length) this.bySession.set(sessionId, next);
      else this.bySession.delete(sessionId);
    }
    this.persist();
    return this.list();
  }

  setSessionTags(sessionId: string, tags: string[]): string[] {
    this.load();
    const next: string[] = [];
    const used = new Set<string>();
    for (const raw of tags) {
      const tag = normalizeTag(raw);
      if (!tag || used.has(tag)) continue;
      used.add(tag);
      next.push(tag);
      if (!this.tags.includes(tag)) this.tags.push(tag);
    }
    if (next.length) this.bySession.set(sessionId, next);
    else this.bySession.delete(sessionId);
    this.persist();
    return [...next];
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const obj: TagFile = {
        tags: this.tags,
        sessions: Object.fromEntries(this.bySession),
      };
      fs.writeFileSync(this.file, JSON.stringify(obj, null, 2));
    } catch {
      // best-effort persistence
    }
  }
}
