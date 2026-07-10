import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ModelOption } from "../model-options.js";

type Source = "cache" | "settings";

interface Candidate {
  value: string;
  priority: number;
  index: number;
  source: Source;
}

const FAMILY_ALIASES = new Set(["fable", "opus", "sonnet", "haiku"]);

/**
 * Claude Code's optional gateway discovery writes this cache when enabled by the
 * CLI. Attend only reads it; it does not trigger network discovery itself.
 */
export function defaultClaudeModelsCachePath(): string {
  return path.join(os.homedir(), ".claude", "cache", "gateway-models.json");
}

export function defaultClaudeSettingsPaths(): string[] {
  const root = path.join(os.homedir(), ".claude");
  return [path.join(root, "settings.json"), path.join(root, "settings.local.json")];
}

export function readClaudeModelOptions(
  cachePath = defaultClaudeModelsCachePath(),
  settingsPaths = defaultClaudeSettingsPaths(),
): ModelOption[] {
  const candidates = [
    ...readGatewayCache(cachePath),
    ...settingsPaths.flatMap((settingsPath) => readAvailableModels(settingsPath)),
  ];
  return dedupeClaudeModels(candidates).map(({ value }) => ({ value, label: value }));
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function readGatewayCache(file: string): Candidate[] {
  const parsed = readJson(file);
  const items = modelItems(parsed);
  return items
    .map((raw, index) => toCacheCandidate(raw, index))
    .filter((item): item is Candidate => item !== null);
}

function readAvailableModels(file: string): Candidate[] {
  const parsed = readJson(file);
  const values: string[] = [];
  collectAvailableModels(parsed, values);
  return values
    .map((raw, index) => toModelValue(raw))
    .filter((value): value is string => value !== null)
    .map((value, index) => ({
      value,
      priority: 0,
      index,
      source: "settings" as const,
    }));
}

function modelItems(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;
  for (const key of ["models", "data", "items"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value as Record<string, unknown>);
  }
  return [];
}

function toCacheCandidate(raw: unknown, index: number): Candidate | null {
  if (typeof raw === "string") {
    const value = toModelValue(raw);
    return value ? { value, priority: index, index, source: "cache" } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.disabled === true || obj.available === false) return null;
  if (
    typeof obj.visibility === "string" &&
    ["hide", "hidden", "disabled"].includes(obj.visibility)
  ) {
    return null;
  }
  const rawValue = firstString(obj, ["id", "slug", "model", "name", "apiName", "api_name"]);
  const value = rawValue ? toModelValue(rawValue) : null;
  if (!value) return null;
  const priority =
    typeof obj.priority === "number" && Number.isFinite(obj.priority) ? obj.priority : index;
  return { value, priority, index, source: "cache" };
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function collectAvailableModels(raw: unknown, out: string[]): void {
  if (!raw || typeof raw !== "object") return;
  if (Array.isArray(raw)) {
    for (const item of raw) collectAvailableModels(item, out);
    return;
  }
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.availableModels)) {
    for (const item of obj.availableModels) {
      if (typeof item === "string") out.push(item);
    }
  }
  for (const value of Object.values(obj)) collectAvailableModels(value, out);
}

function toModelValue(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if (FAMILY_ALIASES.has(lower)) return lower;
  if (
    /^claude-[a-z0-9]+(?:-[a-z0-9]+)*(?:[-@]\d{8})?(?:-v\d+(?::\d+)?)?(?:\[[12]m\])?$/.test(lower)
  ) {
    return lower;
  }
  return null;
}

function familyAlias(value: string): string | null {
  if (FAMILY_ALIASES.has(value)) return value;
  return value.match(/^claude-(fable|opus|sonnet|haiku)-/)?.[1] ?? null;
}

function dedupeClaudeModels(candidates: Candidate[]): Candidate[] {
  const aliasValues = new Set(
    candidates.map((item) => item.value).filter((value) => FAMILY_ALIASES.has(value)),
  );
  const seen = new Set<string>();
  return candidates
    .filter((item) => {
      const alias = familyAlias(item.value);
      return !(alias && item.value !== alias && aliasValues.has(alias));
    })
    .sort((a, b) => a.priority - b.priority || a.index - b.index || a.value.localeCompare(b.value))
    .filter((item) => {
      if (seen.has(item.value)) return false;
      seen.add(item.value);
      return true;
    });
}
