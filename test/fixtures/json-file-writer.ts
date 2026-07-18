import { JsonFile } from "../../src/core/json-file.js";

const [file, prefix, rawCount] = process.argv.slice(2);
if (!file || !prefix) process.exit(2);
const count = Math.max(1, Number(rawCount) || 1);
const store = new JsonFile<{ entries: Record<string, number> }>(file, (value) => {
  const input = value && typeof value === "object" ? (value as { entries?: unknown }) : {};
  return {
    entries:
      input.entries && typeof input.entries === "object"
        ? (input.entries as Record<string, number>)
        : {},
  };
});
for (let index = 0; index < count; index += 1) {
  store.update((data) => {
    data.entries[`${prefix}:${index}`] = index;
  });
}
