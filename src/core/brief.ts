import fs from "node:fs";
import path from "node:path";
import type { Brief, BriefFrontMatter } from "./types.js";

/**
 * Minimal flat YAML front-matter parser. The brief format only uses flat
 * `key: value` pairs (status / defer_until / last_touch), so a full YAML
 * dependency is unnecessary. Mirrors daemon.py's `yaml.safe_load` for that shape.
 */
function parseFrontMatter(raw: string): BriefFrontMatter {
  const fm: BriefFrontMatter = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1] as string;
    let value = (m[2] ?? "").trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fm[key] = value === "" ? null : value;
  }
  return fm;
}

/** Split markdown body into sections keyed by the first token of each heading. */
function parseSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let current: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (current !== null) sections[current] = buf.join("\n").trim();
  };
  for (const line of body.split(/\r?\n/)) {
    const m = /^#+\s+(\S+)/.exec(line);
    if (m) {
      flush();
      current = (m[1] as string).toLowerCase();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

/** Parse a brief.md from its text. Only what/accept/next sections are surfaced. */
export function parseBriefText(filePath: string, text: string): Brief {
  let fm: BriefFrontMatter = {};
  let body = text;
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end > 0) {
      fm = parseFrontMatter(text.slice(3, end));
      body = text.slice(end + 4).replace(/^\s+/, "");
    }
  }
  const sections = parseSections(body);
  const projectDir = path.dirname(filePath);
  const statusRaw = fm.status;
  return {
    path: filePath,
    projectDir,
    name: path.basename(projectDir),
    frontMatter: fm,
    what: sections.what ?? "",
    accept: sections.accept ?? "",
    next: sections.next ?? "",
    status: typeof statusRaw === "string" && statusRaw ? statusRaw : "active",
    deferUntil: (fm.defer_until as string | null | undefined) ?? null,
  };
}

export function parseBrief(filePath: string): Brief | null {
  try {
    return parseBriefText(filePath, fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".specstory",
  ".venv",
  "__pycache__",
  ".next",
  "target",
]);

/** Recursively find files named `filename` under `root`, skipping noisy dirs. */
export function walkFor(root: string, filename: string, maxDepth: number): string[] {
  const found: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(full, depth + 1);
      } else if (entry.isFile() && entry.name === filename) {
        found.push(full);
      }
    }
  };
  walk(root, 0);
  return found;
}

/** Scan every vault root for brief.md files (de-duped, case-insensitive path). */
export function scanVault(vaultRoots: string[], maxDepth = 8): Brief[] {
  const briefs: Brief[] = [];
  const seen = new Set<string>();
  for (const root of vaultRoots) {
    if (!fs.existsSync(root)) continue;
    for (const file of walkFor(root, "brief.md", maxDepth)) {
      const key = file.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const b = parseBrief(file);
      if (b) briefs.push(b);
    }
  }
  return briefs;
}
