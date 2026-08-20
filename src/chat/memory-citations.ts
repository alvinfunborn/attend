export interface MemoryCitationEntry {
  path: string;
  lineStart: number;
  lineEnd: number;
  note: string;
}

export interface MemoryCitationBundle {
  entries: MemoryCitationEntry[];
  rolloutIds: string[];
}

export interface ExtractedMemoryCitationTrailer {
  text: string;
  memoryCitations?: MemoryCitationBundle;
}

export const MEMORY_CITATION_OPEN = "<oai-mem-citation>";
const MEMORY_CITATION_CLOSE = "</oai-mem-citation>";
const MAX_CITATION_ENTRIES = 64;
const MAX_CITATION_PATH_LENGTH = 2_048;
const MAX_CITATION_NOTE_LENGTH = 4_096;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeRelativeMemoryPath(value: string): boolean {
  if (!value || value.length > MAX_CITATION_PATH_LENGTH || value.includes("\0")) return false;
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:[\\/]/.test(value)) {
    return false;
  }
  return !value.split(/[\\/]/).some((segment) => segment === "..");
}

function parseCitationEntries(raw: string): MemoryCitationEntry[] | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length || lines.length > MAX_CITATION_ENTRIES) return null;

  const entries: MemoryCitationEntry[] = [];
  for (const line of lines) {
    const match = /^(.+):(\d+)-(\d+)\|note=\[([^\r\n]*)\]$/.exec(line);
    if (!match) return null;
    const citationPath = match[1]?.trim() ?? "";
    const lineStart = Number(match[2]);
    const lineEnd = Number(match[3]);
    const note = match[4] ?? "";
    if (
      !safeRelativeMemoryPath(citationPath) ||
      !Number.isSafeInteger(lineStart) ||
      !Number.isSafeInteger(lineEnd) ||
      lineStart < 1 ||
      lineEnd < lineStart ||
      !note.trim() ||
      note.length > MAX_CITATION_NOTE_LENGTH
    ) {
      return null;
    }
    entries.push({ path: citationPath, lineStart, lineEnd, note });
  }
  return entries;
}

function parseRolloutIds(raw: string): string[] | null {
  const ids = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (ids.length > MAX_CITATION_ENTRIES || ids.some((id) => !UUID.test(id))) return null;
  return [...new Set(ids)];
}

/**
 * Extract Codex's local-memory provenance trailer from a completed assistant
 * message. The trailer is removed only when the whole terminal block is valid;
 * malformed or quoted examples remain ordinary visible text.
 */
export function extractMemoryCitationTrailer(text: string): ExtractedMemoryCitationTrailer {
  const source = String(text ?? "");
  const closeAt = source.lastIndexOf(MEMORY_CITATION_CLOSE);
  if (closeAt < 0 || source.slice(closeAt + MEMORY_CITATION_CLOSE.length).trim()) {
    return { text: source };
  }
  const openAt = source.lastIndexOf(MEMORY_CITATION_OPEN, closeAt);
  if (openAt < 0) return { text: source };

  const inner = source.slice(openAt + MEMORY_CITATION_OPEN.length, closeAt);
  const match =
    /^\s*<citation_entries>([\s\S]*?)<\/citation_entries>\s*<rollout_ids>([\s\S]*?)<\/rollout_ids>\s*$/.exec(
      inner,
    );
  if (!match) return { text: source };
  const entries = parseCitationEntries(match[1] ?? "");
  const rolloutIds = parseRolloutIds(match[2] ?? "");
  if (!entries || !rolloutIds) return { text: source };

  return {
    text: source.slice(0, openAt).trimEnd(),
    memoryCitations: { entries, rolloutIds },
  };
}
