import fs from "node:fs";
import path from "node:path";

const STOPWORDS = new Set([
  "the",
  "and",
  "with",
  "this",
  "that",
  "from",
  "have",
  "will",
  "name",
  "description",
  "metadata",
  "type",
  "memory",
  "file",
]);

const CJK = /[一-鿿]{2,}/g;
const LATIN = /\b[A-Za-z][A-Za-z0-9_-]{3,}\b/g;

/**
 * Discover Claude Code per-project memory files. Memory model is unchanged from
 * Claude: each project keeps its own `memory/MEMORY.md` under
 * ~/.claude/projects/<encoded-cwd>/. We union them as the user's memory corpus.
 */
export function discoverMemorySources(claudeProjects: string): string[] {
  const sources: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(claudeProjects, { withFileTypes: true });
  } catch {
    return sources;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const mem = path.join(claudeProjects, entry.name, "memory", "MEMORY.md");
    if (fs.existsSync(mem)) sources.push(mem);
  }
  return sources;
}

/** Read the raw text of each memory file (one document per file) for the alignment model. */
export function loadMemoryDocs(sources: string[]): string[] {
  const docs: string[] = [];
  for (const src of sources) {
    try {
      docs.push(fs.readFileSync(src, "utf-8"));
    } catch {
      // missing/unreadable memory file — skip
    }
  }
  return docs;
}

/** Extract a deduped keyword set (CJK runs and latin words) from memory files. */
export function loadMemoryKeywords(sources: string[]): string[] {
  const keywords = new Set<string>();
  for (const src of sources) {
    let text: string;
    try {
      text = fs.readFileSync(src, "utf-8");
    } catch {
      continue;
    }
    for (const w of text.match(CJK) ?? []) keywords.add(w);
    for (const w of text.match(LATIN) ?? []) {
      if (!STOPWORDS.has(w.toLowerCase())) keywords.add(w);
    }
  }
  return [...keywords];
}
