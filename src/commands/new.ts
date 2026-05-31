import fs from "node:fs";
import path from "node:path";

function template(today: string): string {
  return `---
status: active
last_touch: ${today}
defer_until:
---

## what
One line + why (why this is worth doing).

## accept
The bar for "done" (not a todo list).

## next
Where it's stuck / what to try next. Update this line before you leave the session.
`;
}

export interface ScaffoldResult {
  path: string;
  created: boolean;
}

/**
 * Scaffold `<baseDir>/<name>/brief.md` with the three-section template.
 * Never overwrites an existing brief (briefs are authoritative state).
 */
export function scaffoldBrief(
  name: string,
  baseDir: string,
  today: string = new Date().toISOString().slice(0, 10),
): ScaffoldResult {
  const dir = path.resolve(baseDir, name);
  const file = path.join(dir, "brief.md");
  if (fs.existsSync(file)) return { path: file, created: false };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, template(today), "utf-8");
  return { path: file, created: true };
}
