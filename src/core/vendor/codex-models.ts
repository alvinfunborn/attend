import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ModelOption } from "../model-options.js";

interface CachedModel {
  slug?: unknown;
  display_name?: unknown;
  visibility?: unknown;
  priority?: unknown;
}

export function defaultCodexModelsCachePath(): string {
  return path.join(os.homedir(), ".codex", "models_cache.json");
}

export function readCodexModelOptions(cachePath = defaultCodexModelsCachePath()): ModelOption[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as { models?: unknown };
    if (!Array.isArray(parsed.models)) return [];
    return parsed.models
      .map((raw, index) => toOption(raw as CachedModel, index))
      .filter((item): item is ModelOption & { priority: number; index: number } => item !== null)
      .sort(
        (a, b) => a.priority - b.priority || a.index - b.index || a.value.localeCompare(b.value),
      )
      .map(({ value, label }) => ({ value, label }));
  } catch {
    return [];
  }
}

function toOption(
  model: CachedModel,
  index: number,
): (ModelOption & { priority: number; index: number }) | null {
  const slug = typeof model.slug === "string" ? model.slug.trim() : "";
  if (!slug) return null;
  if (model.visibility !== "list") return null;
  const priority =
    typeof model.priority === "number" && Number.isFinite(model.priority)
      ? model.priority
      : Number.MAX_SAFE_INTEGER;
  return { value: slug, label: slug, priority, index };
}
