import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ModelDefaults, ModelOption } from "../model-options.js";

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
  for (const line of raw.replace(/\x1b\[[0-9;]*m/g, "").split(/\r?\n/)) {
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

function variantLabel(parameters: CursorParameter[] = []): string {
  const values = new Map(parameters.map(({ id, value }) => [id, value]));
  const parts: string[] = [];
  if (values.get("context") === "1m") parts.push("1M");
  if (values.get("thinking") === "true") parts.push("Thinking");
  const depth = values.get("reasoning") ?? values.get("effort");
  if (depth) {
    const labels: Record<string, string> = {
      none: "None",
      low: "Low",
      medium: "Medium",
      high: "High",
      xhigh: "Extra High",
      "extra-high": "Extra High",
      max: "Max",
    };
    parts.push(labels[depth] ?? depth);
  }
  if (values.get("fast") === "true") parts.push("Fast");
  return parts.join(" · ") || "Default";
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
    return cli.find(({ id }) => /^composer-2(?:\.|$)/.test(id) && !id.endsWith("-fast"))?.id ?? "composer-2";
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

  const models = visible.map((model): ModelOption => {
    const base = executableBase(model, cliModels);
    const variants = (model.variants ?? []).filter(
      (variant): variant is CursorVariant & { variantStringRepresentation: string } =>
        !!variant.variantStringRepresentation,
    );
    const defaultVariant =
      variants.find((variant) => variant.isDefaultNonMaxConfig) ?? variants[0];
    const variantValue = (variant: CursorVariant & { variantStringRepresentation: string }) =>
      model.name
        ? variant.variantStringRepresentation.replace(
            new RegExp(`^${model.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\[)`),
            base,
          )
        : variant.variantStringRepresentation;
    return {
      value: base,
      label: model.clientDisplayName ?? model.name ?? "Cursor model",
      ...(variants.length > 1
        ? {
            efforts: variants.map(variantValue),
            effortLabels: Object.fromEntries(
              variants.map((variant) => [
                variantValue(variant),
                variantLabel(variant.parameterValues),
              ]),
            ),
            defaultEffort: defaultVariant ? variantValue(defaultVariant) : undefined,
          }
        : {}),
    };
  });

  const selected = state.aiSettings?.modelConfig?.composer?.selectedModels?.[0];
  const selectedId = selected?.modelId ?? state.aiSettings?.modelConfig?.composer?.modelName ?? "default";
  const selectedCatalog = visible.find((model) => model.name === selectedId);
  const selectedOption = selectedCatalog
    ? models[visible.indexOf(selectedCatalog)]
    : models.find((model) => model.value === "auto");
  const selectedVariant = selectedCatalog?.variants?.find((variant) =>
    sameParameters(variant.parameterValues, selected?.parameters),
  );
  return {
    models,
    defaults: {
      model: selectedOption?.value ?? "auto",
      effort:
        selectedVariant && selectedOption?.efforts
          ? (selectedOption.efforts.find((value) =>
              value.endsWith(
                selectedVariant.variantStringRepresentation?.slice(
                  selectedVariant.variantStringRepresentation.indexOf("["),
                ) ?? "",
              ),
            ) ?? selectedOption.defaultEffort ?? "")
          : (selectedOption?.defaultEffort ?? ""),
    },
    warning: null,
  };
}

function cliFallback(cliModels: CliModel[], warning: string): CursorModelInspection {
  return {
    models: cliModels.map(({ id, label }) => ({ value: id, label })),
    defaults: { model: cliModels.some(({ id }) => id === "auto") ? "auto" : "", effort: "" },
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
    return { models: [], defaults: { model: "", effort: "" }, warning: "Cursor CLI not found." };
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
      defaults: { model: "", effort: "" },
      warning: detail || "Cursor did not return a model catalog.",
    };
  }
  if (!fs.existsSync(stateDb)) {
    return cliFallback(cliModels, "Cursor Desktop settings were not found; showing the CLI catalog.");
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
    return cliFallback(cliModels, "Cursor Desktop settings could not be read; showing the CLI catalog.");
  }
}
