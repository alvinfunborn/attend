export const AUTO_TAG_LIMIT = 3;
export const AUTO_TAG_MAX_LENGTH = 24;
export const AUTO_TAG_MAX_WORDS = 4;

/** Reject long labels rather than truncating them into ambiguous new catalog entries. */
export function normalizeAutoTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string" || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(raw)) continue;
    const tag = raw.trim().replace(/\s+/gu, " ");
    const key = tag.toLowerCase();
    if (
      !tag ||
      [...tag].length > AUTO_TAG_MAX_LENGTH ||
      tag.split(" ").length > AUTO_TAG_MAX_WORDS ||
      seen.has(key)
    )
      continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === AUTO_TAG_LIMIT) break;
  }
  return tags;
}
