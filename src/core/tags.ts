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
  private loadedFileSig: string | null = null;

  constructor(private readonly file: string) {}

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

  private fileSig(): string | null {
    try {
      const st = fs.statSync(this.file);
      return `${st.mtimeMs}:${st.size}`;
    } catch {
      return null;
    }
  }

  private load(force = false): void {
    const sig = this.fileSig();
    if (!force && this.loaded && sig === this.loadedFileSig) return;
    this.loaded = true;
    this.loadedFileSig = sig;
    this.tags = [];
    this.bySession.clear();
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

  tagsFor(sessionId: string | string[]): string[] {
    this.load();
    const assigned = new Set<string>();
    for (const key of this.keys(sessionId)) {
      for (const tag of this.bySession.get(key) ?? []) assigned.add(tag);
    }
    return this.tags.filter((tag) => assigned.has(tag));
  }

  create(name: string): string[] {
    this.load(true);
    const tag = normalizeTag(name);
    if (!tag) return this.list();
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.persist();
    }
    return this.list();
  }

  delete(name: string): string[] {
    this.load(true);
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

  reorder(tags: string[]): string[] {
    this.load(true);
    const requested: string[] = [];
    const used = new Set<string>();
    for (const raw of tags) {
      const tag = normalizeTag(raw);
      if (!tag || used.has(tag) || !this.tags.includes(tag)) continue;
      used.add(tag);
      requested.push(tag);
    }
    if (requested.length < 2) return this.list();
    let i = 0;
    const next: string[] = [];
    for (const tag of this.tags) {
      if (used.has(tag)) {
        const replacement = requested[i++];
        if (replacement) next.push(replacement);
      } else {
        next.push(tag);
      }
    }
    if (next.every((tag, idx) => tag === this.tags[idx])) return this.list();
    this.tags = next;
    this.persist();
    return this.list();
  }

  setSessionTags(sessionId: string | string[], tags: string[]): string[] {
    this.load(true);
    const keys = this.keys(sessionId);
    if (!keys.length) return [];
    const next: string[] = [];
    const used = new Set<string>();
    for (const raw of tags) {
      const tag = normalizeTag(raw);
      if (!tag || used.has(tag)) continue;
      used.add(tag);
      next.push(tag);
      if (!this.tags.includes(tag)) this.tags.push(tag);
    }
    for (const key of keys) {
      if (next.length) this.bySession.set(key, next);
      else this.bySession.delete(key);
    }
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
      const tmp = path.join(
        path.dirname(this.file),
        `.${path.basename(this.file)}.${process.pid}.${Date.now()}.tmp`,
      );
      fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
      fs.renameSync(tmp, this.file);
      this.loadedFileSig = this.fileSig();
    } catch {
      // best-effort persistence
    }
  }
}
