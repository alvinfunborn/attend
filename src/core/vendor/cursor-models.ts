import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ModelConfiguration, ModelDefaults, ModelOption } from "../model-options.js";

const CURSOR_STORAGE_KEY =
  "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser";

interface CliModel {
  id: string;
  label: string;
}

interface CursorParameter {
  id?: string;
  value?: string;
}

interface CursorVariant {
  variantStringRepresentation?: string;
  parameterValues?: CursorParameter[];
  isDefaultNonMaxConfig?: boolean;
}

interface CursorCatalogModel {
  name?: string;
  clientDisplayName?: string;
  serverModelName?: string;
  defaultOn?: boolean;
  supportsAgent?: boolean;
  legacySlugs?: string[];
  idAliases?: string[];
  variants?: CursorVariant[];
}

interface CursorIdeState {
  availableDefaultModels2?: CursorCatalogModel[];
  aiSettings?: {
    modelOverrideEnabled?: string[];
    modelOverrideDisabled?: string[];
    modelConfig?: {
      composer?: {
        modelName?: string;
        selectedModels?: Array<{ modelId?: string; parameters?: CursorParameter[] }>;
      };
    };
  };
}

export interface CursorModelInspection {
  models: ModelOption[];
  defaults: ModelDefaults;
  warning: string | null;
}

export function defaultCursorStateDbPath(): string {
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Cursor",
      "User",
      "globalStorage",
      "state.vscdb",
    );
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
      "Cursor",
      "User",
      "globalStorage",
      "state.vscdb",
    );
  }
  return path.join(os.homedir(), ".config", "Cursor", "User", "globalStorage", "state.vscdb");
}

export function parseCursorCliModels(raw: string): CliModel[] {
  const models: CliModel[] = [];
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI SGR starts with ESC.
  const ansiSgr = /\u001b\[[0-9;]*m/g;
  for (const line of raw.replace(ansiSgr, "").split(/\r?\n/)) {
    const match = line.trim().match(/^(\S+)\s+-\s+(.+?)(?:\s+\((?:current|default)[^)]*\))?$/);
    if (!match) continue;
    models.push({ id: match[1] ?? "", label: match[2]?.trim() ?? match[1] ?? "" });
  }
  return models;
}

function sameParameters(a: CursorParameter[] = [], b: CursorParameter[] = []): boolean {
  const normalize = (values: CursorParameter[]) =>
    values
      .map(({ id, value }) => `${id ?? ""}=${value ?? ""}`)
      .sort()
      .join("&");
  return normalize(a) === normalize(b);
}

function effortLabel(value: string): string {
  const labels: Record<string, string> = {
    none: "None",
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "Extra High",
    "extra-high": "Extra High",
    max: "Max",
  };
  return labels[value] ?? value;
}

function fixedParameters(parameters: CursorParameter[] = []): CursorParameter[] {
  return parameters.filter(({ id }) => id !== "reasoning" && id !== "effort" && id !== "fast");
}

function parametersKey(parameters: CursorParameter[] = []): string {
  return parameters
    .map(({ id, value }) => `${id ?? ""}=${value ?? ""}`)
    .sort()
    .join("&");
}

function parameterValue(parameters: CursorParameter[], ...ids: string[]): string {
  for (const id of ids) {
    const match = parameters.find((parameter) => parameter.id === id);
    if (typeof match?.value === "string") return match.value;
  }
  return "";
}

function fixedVariantLabel(parameters: CursorParameter[] = []): string {
  const parts: string[] = [];
  for (const { id = "", value = "" } of parameters) {
    if (id === "context" && value === "1m") parts.push("1M");
    else if (id === "thinking" && value === "true") parts.push("Thinking");
    else if (id === "thinking" && value === "false") continue;
    else if (id === "context" && (value === "200k" || value === "272k")) continue;
    else if (id && value) parts.push(`${id} ${value}`);
  }
  return parts.join(" · ");
}

function parameterizedModel(base: string, parameters: CursorParameter[]): string {
  if (!parameters.length) return base;
  return `${base}[${parameters.map(({ id, value }) => `${id ?? ""}=${value ?? ""}`).join(",")}]`;
}

function isFamilyAvailable(model: CursorCatalogModel, cli: CliModel[]): boolean {
  const candidates = [
    model.name,
    model.serverModelName,
    ...(model.legacySlugs ?? []),
    ...(model.idAliases ?? []),
  ].filter((value): value is string => !!value);
  if (model.name === "default") candidates.push("auto");
  return cli.some(({ id }) =>
    candidates.some(
      (candidate) =>
        id === candidate ||
        id.startsWith(`${candidate}-`) ||
        (candidate === "composer-2" && id.startsWith("composer-2.")),
    ),
  );
}

function executableBase(model: CursorCatalogModel, cli: CliModel[]): string {
  if (model.name === "default") return "auto";
  if (model.name === "composer-2") {
    return (
      cli.find(({ id }) => /^composer-2(?:\.|$)/.test(id) && !id.endsWith("-fast"))?.id ??
      "composer-2"
    );
  }
  return model.name ?? model.serverModelName ?? "auto";
}

export function cursorModelOptionsFromState(
  state: CursorIdeState,
  cliModels: CliModel[],
): CursorModelInspection {
  const enabled = new Set(state.aiSettings?.modelOverrideEnabled ?? []);
  const disabled = new Set(state.aiSettings?.modelOverrideDisabled ?? []);
  const catalog = state.availableDefaultModels2 ?? [];
  const visible = catalog.filter((model) => {
    const name = model.name ?? "";
    return (
      !!name &&
      model.supportsAgent !== false &&
      !disabled.has(name) &&
      (model.defaultOn === true || enabled.has(name)) &&
      isFamilyAvailable(model, cliModels)
    );
  });

  const groups: Array<{
    catalog: CursorCatalogModel;
    fixedKey: string;
    variants: Array<CursorVariant & { variantStringRepresentation: string }>;
    option: ModelOption;
  }> = [];
  for (const model of visible) {
    const base = executableBase(model, cliModels);
    const variants = (model.variants ?? []).filter(
      (variant): variant is CursorVariant & { variantStringRepresentation: string } =>
        !!variant.variantStringRepresentation,
    );
    const variantValue = (variant: CursorVariant & { variantStringRepresentation: string }) =>
      model.name
        ? variant.variantStringRepresentation.replace(
            new RegExp(`^${model.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\[)`),
            base,
          )
        : variant.variantStringRepresentation;
    const grouped = new Map<
      string,
      Array<CursorVariant & { variantStringRepresentation: string }>
    >();
    for (const variant of variants) {
      const key = parametersKey(fixedParameters(variant.parameterValues));
      const list = grouped.get(key) ?? [];
      list.push(variant);
      grouped.set(key, list);
    }
    if (!grouped.size) grouped.set("", []);

    for (const [fixedKey, groupVariants] of grouped) {
      const fixed = fixedParameters(groupVariants[0]?.parameterValues);
      const modelValue = parameterizedModel(base, fixed);
      const fixedLabel = fixedVariantLabel(fixed);
      const efforts = Array.from(
        new Set(
          groupVariants
            .map((variant) => parameterValue(variant.parameterValues ?? [], "reasoning", "effort"))
            .filter(Boolean),
        ),
      );
      // A true entry is Cursor's capability signal. False/absent entries are
      // retained only as exact matrix rows once the fast axis exists.
      const hasFast = groupVariants.some(
        (variant) => parameterValue(variant.parameterValues ?? [], "fast") === "true",
      );
      const speeds = hasFast
        ? Array.from(
            new Set(
              groupVariants.map(
                (variant) => parameterValue(variant.parameterValues ?? [], "fast") || "false",
              ),
            ),
          )
        : [];
      const configurations: ModelConfiguration[] = groupVariants.map((variant) => {
        const effort = parameterValue(variant.parameterValues ?? [], "reasoning", "effort");
        const speed = hasFast
          ? parameterValue(variant.parameterValues ?? [], "fast") || "false"
          : "";
        return {
          value: variantValue(variant),
          ...(effort ? { effort } : {}),
          ...(speed ? { speed } : {}),
        };
      });
      const defaultVariant =
        groupVariants.find((variant) => variant.isDefaultNonMaxConfig) ?? groupVariants[0];
      const defaultEffort = defaultVariant
        ? parameterValue(defaultVariant.parameterValues ?? [], "reasoning", "effort")
        : "";
      const defaultSpeed =
        defaultVariant && hasFast
          ? parameterValue(defaultVariant.parameterValues ?? [], "fast") || "false"
          : "";
      const option: ModelOption = {
        value: modelValue,
        label: [model.clientDisplayName ?? model.name ?? "Cursor model", fixedLabel]
          .filter(Boolean)
          .join(" · "),
        ...(efforts.length
          ? {
              efforts,
              effortLabels: Object.fromEntries(
                efforts.map((effort) => [effort, effortLabel(effort)]),
              ),
            }
          : {}),
        ...(defaultEffort ? { defaultEffort } : {}),
        ...(speeds.length
          ? {
              speeds,
              speedLabels: Object.fromEntries(
                speeds.map((speed) => [speed, speed === "true" ? "Fast" : "Standard"]),
              ),
            }
          : {}),
        ...(defaultSpeed ? { defaultSpeed } : {}),
        ...(efforts.length || speeds.length ? { configurations } : {}),
      };
      groups.push({ catalog: model, fixedKey, variants: groupVariants, option });
    }
  }
  const models = groups.map(({ option }) => option);

  const selected = state.aiSettings?.modelConfig?.composer?.selectedModels?.[0];
  const selectedId =
    selected?.modelId ?? state.aiSettings?.modelConfig?.composer?.modelName ?? "default";
  const selectedCatalog = visible.find((model) => model.name === selectedId);
  const selectedVariant = selectedCatalog?.variants?.find((variant) =>
    sameParameters(variant.parameterValues, selected?.parameters),
  );
  const selectedFixedKey = parametersKey(fixedParameters(selected?.parameters));
  const selectedGroup = selectedCatalog
    ? (groups.find(
        (group) => group.catalog === selectedCatalog && group.fixedKey === selectedFixedKey,
      ) ?? groups.find((group) => group.catalog === selectedCatalog))
    : groups.find((group) => group.option.value === "auto");
  const selectedConfiguration = selectedVariant
    ? selectedGroup?.option.configurations?.find((configuration) =>
        configuration.value.endsWith(
          selectedVariant.variantStringRepresentation?.slice(
            selectedVariant.variantStringRepresentation.indexOf("["),
          ) ?? "",
        ),
      )
    : undefined;
  return {
    models,
    defaults: {
      model: selectedGroup?.option.value ?? "auto",
      effort: selectedConfiguration?.effort ?? selectedGroup?.option.defaultEffort ?? "",
      speed: selectedConfiguration?.speed ?? selectedGroup?.option.defaultSpeed ?? "",
    },
    warning: null,
  };
}

/** Resolve a UI selection through Cursor's exact advertised variant matrix.
 * Returns null for an impossible combination instead of synthesizing one. */
export function resolveCursorModelConfiguration(
  models: ModelOption[],
  model: string,
  effort = "",
  speed = "",
): string | null {
  const option = models.find((candidate) => candidate.value === model);
  if (!option?.configurations?.length) return model;
  const selectedEffort = effort || option.defaultEffort || "";
  const selectedSpeed = speed || option.defaultSpeed || "";
  const configuration = option.configurations.find(
    (candidate) =>
      (candidate.effort ?? "") === selectedEffort && (candidate.speed ?? "") === selectedSpeed,
  );
  return configuration?.value ?? null;
}

function cliFallback(cliModels: CliModel[], warning: string): CursorModelInspection {
  return {
    models: cliModels.map(({ id, label }) => ({ value: id, label })),
    defaults: {
      model: cliModels.some(({ id }) => id === "auto") ? "auto" : "",
      effort: "",
      speed: "",
    },
    warning,
  };
}

/** Read Cursor's account-visible CLI catalog and intersect it with the model
 * toggles stored by Cursor Desktop. The SQLite schema is private, so every
 * failure degrades to the public CLI list without blocking chat. */
export function inspectCursorModels(
  cursorBin: string | null,
  stateDb = defaultCursorStateDbPath(),
  timeoutMs = 15_000,
): CursorModelInspection {
  if (!cursorBin) {
    return {
      models: [],
      defaults: { model: "", effort: "", speed: "" },
      warning: "Cursor CLI not found.",
    };
  }
  const listed = spawnSync(cursorBin, ["models"], {
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
  });
  const cliModels = parseCursorCliModels(String(listed.stdout ?? ""));
  if (!cliModels.length) {
    const detail = String(listed.stderr ?? "").trim();
    return {
      models: [],
      defaults: { model: "", effort: "", speed: "" },
      warning: detail || "Cursor did not return a model catalog.",
    };
  }
  if (!fs.existsSync(stateDb)) {
    return cliFallback(
      cliModels,
      "Cursor Desktop settings were not found; showing the CLI catalog.",
    );
  }
  const escapedKey = CURSOR_STORAGE_KEY.replace(/'/g, "''");
  const read = spawnSync(
    "sqlite3",
    [stateDb, `select value from ItemTable where key='${escapedKey}';`],
    { encoding: "utf8", timeout: 5_000, windowsHide: true },
  );
  try {
    const state = JSON.parse(String(read.stdout ?? "")) as CursorIdeState;
    const inspection = cursorModelOptionsFromState(state, cliModels);
    if (inspection.models.length) return inspection;
    return cliFallback(
      cliModels,
      "Cursor Desktop model settings could not be matched to the CLI catalog; showing the CLI catalog.",
    );
  } catch {
    return cliFallback(
      cliModels,
      "Cursor Desktop settings could not be read; showing the CLI catalog.",
    );
  }
}
