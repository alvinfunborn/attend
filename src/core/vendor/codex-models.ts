import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ModelOption } from "../model-options.js";

interface CachedModel {
  slug?: unknown;
  display_name?: unknown;
  visibility?: unknown;
  priority?: unknown;
  supported_reasoning_levels?: unknown;
  default_reasoning_level?: unknown;
}

/** Codex advertises per-model reasoning levels as `[{ effort, description }]`. */
function readEfforts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const effort =
      item && typeof item === "object" && typeof (item as { effort?: unknown }).effort === "string"
        ? (item as { effort: string }).effort.trim().toLowerCase()
        : "";
    if (effort && !seen.has(effort)) {
      seen.add(effort);
      out.push(effort);
    }
  }
  return out;
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
      .filter(
        (
          item,
        ): item is ModelOption & {
          efforts: string[];
          defaultEffort: string;
          priority: number;
          index: number;
        } => item !== null,
      )
      .sort(
        (a, b) => a.priority - b.priority || a.index - b.index || a.value.localeCompare(b.value),
      )
      .map(({ value, label, efforts, defaultEffort }) => ({
        value,
        label,
        ...(efforts.length ? { efforts } : {}),
        ...(defaultEffort ? { defaultEffort } : {}),
      }));
  } catch {
    return [];
  }
}

function toOption(
  model: CachedModel,
  index: number,
):
  | (ModelOption & { efforts: string[]; defaultEffort: string; priority: number; index: number })
  | null {
  const slug = typeof model.slug === "string" ? model.slug.trim() : "";
  if (!slug) return null;
  if (model.visibility !== "list") return null;
  const priority =
    typeof model.priority === "number" && Number.isFinite(model.priority)
      ? model.priority
      : Number.MAX_SAFE_INTEGER;
  const efforts = readEfforts(model.supported_reasoning_levels);
  const rawDefault =
    typeof model.default_reasoning_level === "string"
      ? model.default_reasoning_level.trim().toLowerCase()
      : "";
  const defaultEffort = efforts.includes(rawDefault) ? rawDefault : "";
  return { value: slug, label: slug, efforts, defaultEffort, priority, index };
}
