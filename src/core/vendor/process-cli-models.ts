import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ModelDefaults, ModelOption } from "../model-options.js";
import { runMetadataCommand } from "./async-command.js";

export interface ProcessCliModelInspection {
  models: ModelOption[];
  defaults: ModelDefaults;
  warning: string | null;
  source?: "cli" | "account" | "help" | "unavailable";
}

function clean(raw: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI SGR starts with ESC.
  return raw.replace(/\u001b\[[0-9;]*m/g, "");
}

/** Parse the line/table format used by `agy models`. */
export function parseProcessCliModels(raw: string, _efforts: string[] = []): ModelOption[] {
  const seen = new Set<string>();
  const models: ModelOption[] = [];
  for (const sourceLine of clean(raw).split(/\r?\n/)) {
    const line = sourceLine.trim().replace(/^[*•-]\s+/, "");
    const match =
      line.match(/^([A-Za-z0-9][A-Za-z0-9._:/-]+)\s+-\s+(.+?)(?:\s+\((?:default|current)\))?$/) ??
      line.match(/^([A-Za-z0-9][A-Za-z0-9._:/-]+)(?:\t+| {2,})(.+)$/);
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
  if (start < 0) return [{ value: "auto", label: "Auto" }];

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
  }));
}

async function readDefaults(file: string): Promise<ModelDefaults> {
  const defaults: ModelDefaults = { model: "", effort: "", speed: "" };
  try {
    const settings = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    const model = settings.model ?? settings.defaultModel;
    const effort =
      settings.effort ??
      settings.reasoningEffort ??
      settings.reasoning_effort ??
      settings.effortLevel;
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
    if (result.status === 0 && models.length)
      return { models, defaults, warning: null, source: "cli" };
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

export interface CopilotCatalogClient {
  start(): Promise<void>;
  getAuthStatus(): Promise<{ isAuthenticated: boolean }>;
  listModels(): Promise<import("@github/copilot-sdk").ModelInfo[]>;
  forceStop(): Promise<void>;
}

export function normalizeCopilotModels(
  models: import("@github/copilot-sdk").ModelInfo[],
): ModelOption[] {
  return models
    .filter((model) => typeof model.id === "string")
    .map((model) => ({
      value: model.id,
      label: model.name || model.id,
      ...(model.capabilities?.supports?.reasoningEffort && model.supportedReasoningEfforts?.length
        ? { efforts: model.supportedReasoningEfforts, defaultEffort: model.defaultReasoningEffort }
        : {}),
      ...(model.policy ? { policy: model.policy.state } : {}),
      ...(typeof model.billing?.multiplier === "number"
        ? { billingMultiplier: model.billing.multiplier }
        : {}),
    }));
}

/** Metadata only: bind the official SDK to the user's CLI and inherited auth. */
export async function inspectCopilotModels(
  bin: string,
  createClient?: () => CopilotCatalogClient,
  timeoutMs = 10_000,
  cwd = process.cwd(),
  readHelp: () => Promise<string> = async () => {
    const result = await runMetadataCommand(bin, ["help"], timeoutMs);
    return result.status === 0 ? `${result.stdout}\n${result.stderr}` : "";
  },
): Promise<ProcessCliModelInspection> {
  const defaults = await readDefaults(
    path.join(process.env.COPILOT_HOME || path.join(os.homedir(), ".copilot"), "settings.json"),
  );
  let client: CopilotCatalogClient | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (createClient) client = createClient();
    else {
      const { CopilotClient, RuntimeConnection } = await import("@github/copilot-sdk");
      client = new CopilotClient({
        connection: RuntimeConnection.forStdio({ path: bin }),
        workingDirectory: cwd,
      });
    }
    const connected = client;
    const models = await Promise.race([
      (async () => {
        await connected.start();
        if (!(await connected.getAuthStatus()).isAuthenticated)
          throw new Error("Not authenticated");
        return normalizeCopilotModels(await connected.listModels());
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Catalog timeout")), timeoutMs);
      }),
    ]);
    return {
      models,
      defaults,
      source: "account",
      warning: models.some((m) => m.value !== "auto")
        ? null
        : "Copilot only advertises Auto; no verified lightweight model is available.",
    };
  } catch {
    clearTimeout(timer);
    await client?.forceStop().catch(() => {});
    client = undefined;
    // Keep old CLI choices usable in the work picker; help is never proof of
    // account availability for economical routing.
    const help = await readHelp().catch(() => "");
    return {
      models: parseCopilotHelpModels(help),
      defaults,
      source: help ? "help" : "unavailable",
      warning:
        "Copilot account catalog unavailable; background economical mode uses local analysis.",
    };
  } finally {
    clearTimeout(timer);
    await client?.forceStop().catch(() => {});
  }
}

function opencodeConfigPath(): string {
  const home = os.homedir();
  const base =
    process.platform === "win32"
      ? (process.env.APPDATA ?? path.join(home, "AppData", "Roaming"))
      : (process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"));
  return path.join(base, "opencode", "opencode.json");
}

const OPENCODE_MODEL = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:/-]*$/;

/**
 * Parse `opencode models` (plain) and `opencode models --verbose`.
 *
 * Plain output is one `provider/model` per line. Verbose output interleaves the
 * same lines with a pretty-printed JSON object per model; its `variants` keys
 * are exactly the values `opencode run --variant` accepts, so they become the
 * model's effort choices.
 */
export function parseOpencodeModels(raw: string): ModelOption[] {
  const lines = clean(raw).split(/\r?\n/);
  const seen = new Set<string>();
  const models: ModelOption[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const value = (lines[index] ?? "").trim();
    if (!OPENCODE_MODEL.test(value) || seen.has(value)) continue;
    seen.add(value);

    let next = index + 1;
    while (next < lines.length && !(lines[next] ?? "").trim()) next += 1;
    if (!(lines[next] ?? "").trimStart().startsWith("{")) {
      models.push({ value, label: value });
      continue;
    }
    let depth = 0;
    let json = "";
    let cursor = next;
    for (; cursor < lines.length; cursor += 1) {
      const line = lines[cursor] ?? "";
      json += line;
      for (const character of line) {
        if (character === "{") depth += 1;
        else if (character === "}") depth -= 1;
      }
      if (depth <= 0) break;
    }
    let efforts: string[] = [];
    try {
      const parsed = JSON.parse(json) as { variants?: Record<string, unknown> };
      if (parsed.variants && typeof parsed.variants === "object") {
        efforts = Object.keys(parsed.variants);
      }
    } catch {
      // Non-JSON trailing text: fall through with no effort choices.
    }
    models.push({ value, label: value, ...(efforts.length ? { efforts } : {}) });
    index = cursor;
  }
  return models;
}

export async function inspectOpencodeModels(bin: string): Promise<ProcessCliModelInspection> {
  const defaults = await readDefaults(opencodeConfigPath());
  // Verbose first: it carries each model's provider-specific variants (effort).
  try {
    const verbose = await runMetadataCommand(bin, ["models", "--verbose"], 20_000);
    const models = parseOpencodeModels(`${verbose.stdout ?? ""}\n${verbose.stderr ?? ""}`);
    if (verbose.status === 0 && models.length) return { models, defaults, warning: null };
  } catch {
    // Fall through to the plain catalog.
  }
  try {
    const result = await runMetadataCommand(bin, ["models"], 15_000);
    const models = parseOpencodeModels(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    if (result.status === 0 && models.length) return { models, defaults, warning: null };
    return {
      models: [],
      defaults,
      warning: "OpenCode did not return a model catalog; Attend will use the CLI default.",
    };
  } catch {
    return {
      models: [],
      defaults,
      warning: "OpenCode model discovery failed; Attend will use the CLI default.",
    };
  }
}
