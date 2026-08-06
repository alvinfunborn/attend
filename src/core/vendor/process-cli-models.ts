import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ModelDefaults, ModelOption } from "../model-options.js";
import { runMetadataCommand } from "./async-command.js";

export interface ProcessCliModelInspection {
  models: ModelOption[];
  defaults: ModelDefaults;
  warning: string | null;
}

const EFFORTS = ["low", "medium", "high", "xhigh", "max"];

function clean(raw: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI SGR starts with ESC.
  return raw.replace(/\u001b\[[0-9;]*m/g, "");
}

/** Parse the line/table format used by `agy models`. */
export function parseProcessCliModels(raw: string, efforts: string[]): ModelOption[] {
  const seen = new Set<string>();
  const models: ModelOption[] = [];
  for (const sourceLine of clean(raw).split(/\r?\n/)) {
    const line = sourceLine.trim().replace(/^[*•-]\s+/, "");
    const match =
      line.match(/^([A-Za-z0-9][A-Za-z0-9._:/-]+)\s+-\s+(.+?)(?:\s+\((?:default|current)\))?$/) ??
      line.match(/^([A-Za-z0-9][A-Za-z0-9._:/-]+)\s{2,}(.+)$/);
    if (!match) continue;
    const value = match[1] ?? "";
    if (
      !value ||
      seen.has(value) ||
      ["model", "models", "usage", "options", "commands"].includes(value.toLowerCase())
    )
      continue;
    seen.add(value);
    models.push({
      value,
      label: (match[2] ?? value).replace(/\s+\((?:default|current)\)\s*$/, "").trim(),
      ...(efforts.length ? { efforts } : {}),
    });
  }
  return models;
}

/**
 * Parse only the `--model` option from Copilot help.
 *
 * Copilot 1.0.75 renders commands and Help Topics as two-column rows that look
 * like model tables. Parsing the whole help page therefore turns entries such
 * as `billing` and `permissions` into model names. The CLI has no
 * non-interactive model-list command, so use choices advertised by `--model`
 * when present and otherwise expose its universally supported `auto` value.
 */
export function parseCopilotHelpModels(raw: string): ModelOption[] {
  const lines = clean(raw).split(/\r?\n/);
  const start = lines.findIndex((line) => /^\s{2}(?:-\w,\s*)?--model(?:[=\s]|$)/.test(line));
  if (start < 0) return [{ value: "auto", label: "Auto", efforts: EFFORTS }];

  let end = start + 1;
  while (end < lines.length && !/^\s{2}(?:-\w,\s*)?--[A-Za-z0-9]/.test(lines[end] ?? "")) {
    end += 1;
  }
  const optionHelp = lines.slice(start, end).join(" ");
  const values = new Set<string>(["auto"]);
  const advertised =
    optionHelp.match(/\b(?:claude|gpt|gemini|mai|raptor|kimi)-[a-z0-9][a-z0-9.-]*\b/gi) ?? [];
  for (const value of advertised) values.add(value.toLowerCase());

  return [...values].map((value) => ({
    value,
    label: value === "auto" ? "Auto" : value,
    efforts: EFFORTS,
  }));
}

async function readDefaults(file: string): Promise<ModelDefaults> {
  const defaults: ModelDefaults = { model: "", effort: "", speed: "" };
  try {
    const settings = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    const model = settings.model ?? settings.defaultModel;
    const effort = settings.effort ?? settings.reasoningEffort ?? settings.reasoning_effort;
    if (typeof model === "string") defaults.model = model;
    if (typeof effort === "string") defaults.effort = effort;
  } catch {
    // Settings are optional; the CLI's own defaults remain authoritative.
  }
  return defaults;
}

async function inspect(
  bin: string,
  args: string[],
  settings: string,
  efforts: string[],
  label: string,
): Promise<ProcessCliModelInspection> {
  const defaults = await readDefaults(settings);
  try {
    const result = await runMetadataCommand(bin, args, 10_000);
    const models = parseProcessCliModels(`${result.stdout ?? ""}\n${result.stderr ?? ""}`, efforts);
    if (result.status === 0 && models.length) return { models, defaults, warning: null };
    return {
      models: [],
      defaults,
      warning: `${label} did not return a model catalog; Attend will use the CLI default.`,
    };
  } catch {
    return {
      models: [],
      defaults,
      warning: `${label} model discovery failed; Attend will use the CLI default.`,
    };
  }
}

export function inspectAntigravityModels(bin: string): Promise<ProcessCliModelInspection> {
  return inspect(
    bin,
    ["models"],
    path.join(os.homedir(), ".gemini", "antigravity-cli", "settings.json"),
    ["low", "medium", "high"],
    "Antigravity CLI",
  );
}

export async function inspectCopilotModels(bin: string): Promise<ProcessCliModelInspection> {
  const defaults = await readDefaults(path.join(os.homedir(), ".copilot", "settings.json"));
  try {
    const result = await runMetadataCommand(bin, ["help"], 10_000);
    if (result.status !== 0) {
      return {
        models: [{ value: "auto", label: "Auto", efforts: EFFORTS }],
        defaults,
        warning: "GitHub Copilot CLI model discovery failed; Attend will use Auto.",
      };
    }
    const models = parseCopilotHelpModels(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    return {
      models,
      defaults,
      warning:
        models.length === 1
          ? "GitHub Copilot CLI did not advertise account-specific models; Attend will use Auto."
          : null,
    };
  } catch {
    return {
      models: [{ value: "auto", label: "Auto", efforts: EFFORTS }],
      defaults,
      warning: "GitHub Copilot CLI model discovery failed; Attend will use Auto.",
    };
  }
}
