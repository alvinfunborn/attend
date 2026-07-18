import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function comparisonKey(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

/** Resolve symlinks through the deepest existing ancestor without rejecting future paths. */
export function canonicalScopePath(value: string): string {
  const resolved = path.resolve(value);
  let existing = resolved;
  const missing: string[] = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) return resolved;
    missing.unshift(path.basename(existing));
    existing = parent;
  }
  try {
    return path.join(fs.realpathSync.native(existing), ...missing);
  } catch {
    return resolved;
  }
}

export function pathWithinScope(candidate: string, root: string): boolean {
  const child = comparisonKey(canonicalScopePath(candidate));
  const parent = comparisonKey(canonicalScopePath(root));
  return child === parent || child.startsWith(`${parent}${path.sep}`);
}

function canonicalWithin(candidate: string, root: string): boolean {
  const child = comparisonKey(candidate);
  const parent = comparisonKey(root);
  return child === parent || child.startsWith(`${parent}${path.sep}`);
}

/** Canonicalize, deduplicate, and remove descendants already covered by an ancestor root. */
export function normalizeScopeRoots(input: string[]): string[] {
  const unique = new Map<string, { canonical: string; display: string }>();
  for (const raw of input) {
    const canonical = canonicalScopePath(raw);
    const key = comparisonKey(canonical);
    if (!unique.has(key)) unique.set(key, { canonical, display: path.resolve(raw) });
  }
  const shallowFirst = [...unique.values()].sort(
    (a, b) =>
      a.canonical.split(path.sep).length - b.canonical.split(path.sep).length ||
      a.canonical.localeCompare(b.canonical),
  );
  const minimal: Array<{ canonical: string; display: string }> = [];
  for (const candidate of shallowFirst) {
    if (!minimal.some((root) => canonicalWithin(candidate.canonical, root.canonical)))
      minimal.push(candidate);
  }
  return minimal
    .sort((a, b) => a.canonical.localeCompare(b.canonical))
    .map((entry) => entry.display);
}

export function scopeIdForRoots(roots: string[]): string {
  if (!roots.length) return "scope:v1:all";
  const canonical = normalizeScopeRoots(roots)
    .map(canonicalScopePath)
    .sort((a, b) => comparisonKey(a).localeCompare(comparisonKey(b)));
  const digest = crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  return `scope:v1:${digest.slice(0, 20)}`;
}
