import { spawnSync } from "node:child_process";
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
        ? (item as { effort: string }).effort.trim()
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

export interface CodexModelCacheInspection {
  models: ModelOption[];
  warning: string | null;
}

interface CodexModelCommandResult {
  status: number | null;
  stdout: string;
}

export type CodexModelCommandRunner = (codexBin: string, args: string[]) => CodexModelCommandResult;

const runCodexModelCommand: CodexModelCommandRunner = (codexBin, args) => {
  const result = spawnSync(codexBin, args, {
    encoding: "utf-8",
    timeout: 15_000,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { status: result.status, stdout: result.stdout || "" };
};

function inspectCatalogJson(raw: string): ModelOption[] {
  try {
    const parsed = JSON.parse(raw) as { models?: unknown };
    return Array.isArray(parsed.models) ? modelOptions(parsed.models) : [];
  } catch {
    return [];
  }
}

/** Discover the effective catalog through Codex-owned command surfaces first. */
export function inspectCodexModels(
  codexBin: string | null,
  cachePath = defaultCodexModelsCachePath(),
  run: CodexModelCommandRunner = runCodexModelCommand,
): CodexModelCacheInspection {
  if (codexBin) {
    const live = run(codexBin, ["debug", "models"]);
    const liveModels = live.status === 0 ? inspectCatalogJson(live.stdout) : [];
    if (liveModels.length) return { models: liveModels, warning: null };

    const bundled = run(codexBin, ["debug", "models", "--bundled"]);
    const bundledModels = bundled.status === 0 ? inspectCatalogJson(bundled.stdout) : [];
    if (bundledModels.length) {
      return {
        models: bundledModels,
        warning: "Live Codex model discovery failed; using the catalog bundled with Codex.",
      };
    }
  }

  const cached = inspectCodexModelCache(cachePath);
  if (cached.models.length) {
    return {
      models: cached.models,
      warning: "Codex CLI model discovery is unavailable; using its internal cache as fallback.",
    };
  }
  return cached;
}

export function inspectCodexModelCache(
  cachePath = defaultCodexModelsCachePath(),
): CodexModelCacheInspection {
  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as { models?: unknown };
    if (!Array.isArray(parsed.models)) {
      return {
        models: [],
        warning: "Codex internal model cache changed format; using Attend's last known models.",
      };
    }
    const models = modelOptions(parsed.models);
    return {
      models,
      warning: models.length
        ? null
        : "Codex internal model cache contains no visible models; using Attend's last known models.",
    };
  } catch (error) {
    const missing = error instanceof Error && "code" in error && error.code === "ENOENT";
    return {
      models: [],
      warning: missing
        ? "Codex internal model cache is unavailable; using Attend's last known models."
        : "Codex internal model cache could not be parsed; using Attend's last known models.",
    };
  }
}

function modelOptions(models: unknown[]): ModelOption[] {
  return models
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
    .sort((a, b) => a.priority - b.priority || a.index - b.index || a.value.localeCompare(b.value))
    .map(({ value, label, efforts, defaultEffort }) => ({
      value,
      label,
      ...(efforts.length ? { efforts } : {}),
      ...(defaultEffort ? { defaultEffort } : {}),
    }));
}

export function readCodexModelOptions(cachePath = defaultCodexModelsCachePath()): ModelOption[] {
  return inspectCodexModelCache(cachePath).models;
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
    typeof model.default_reasoning_level === "string" ? model.default_reasoning_level.trim() : "";
  const defaultEffort = efforts.includes(rawDefault) ? rawDefault : "";
  const label =
    typeof model.display_name === "string" && model.display_name.trim()
      ? model.display_name.trim()
      : slug;
  return { value: slug, label, efforts, defaultEffort, priority, index };
}
