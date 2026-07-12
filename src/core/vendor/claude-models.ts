import {
  type ModelInfo,
  type Query,
  type SDKUserMessage,
  query,
  resolveSettings,
} from "@anthropic-ai/claude-agent-sdk";
import type { ModelDefaults, ModelOption } from "../model-options.js";

export interface ClaudeModelCatalogInspection {
  models: ModelOption[];
  defaults: ModelDefaults;
  warning: string | null;
}

export type ClaudeModelQueryFactory = (cwd: string) => Query;
export type ClaudeSettingsResolver = (cwd: string) => Promise<{
  effective: { model?: unknown; effortLevel?: unknown };
}>;

async function* emptyPrompt(): AsyncGenerator<SDKUserMessage> {}

function createModelQuery(cwd: string, executable?: string | null): Query {
  return query({
    prompt: emptyPrompt(),
    options: {
      cwd,
      permissionMode: "plan",
      persistSession: false,
      ...(executable ? { pathToClaudeCodeExecutable: executable } : {}),
    },
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolvedDefaultModel(models: ModelInfo[], configured: string): string {
  const selected = configured
    ? models.find((model) => text(model.value) === configured)
    : models.find((model) => text(model.value) === "default");
  return (
    text((selected as (ModelInfo & { resolvedModel?: unknown }) | undefined)?.resolvedModel) ||
    configured
  );
}

function modelOptions(models: ModelInfo[]): ModelOption[] {
  const seen = new Set<string>();
  const out: ModelOption[] = [];
  for (const model of models) {
    const value = typeof model.value === "string" ? model.value.trim() : "";
    // Claude advertises a synthetic `default` entry. Attend represents the same
    // no-override choice with an empty value and labels it with resolvedModel.
    if (!value || value === "default" || seen.has(value)) continue;
    seen.add(value);
    const label =
      typeof model.displayName === "string" && model.displayName.trim()
        ? model.displayName.trim()
        : value;
    const efforts = Array.isArray(model.supportedEffortLevels)
      ? model.supportedEffortLevels.filter(
          (effort, index, all) =>
            typeof effort === "string" && effort.trim() && all.indexOf(effort) === index,
        )
      : [];
    out.push({ value, label, ...(efforts.length ? { efforts } : {}) });
  }
  return out;
}

/**
 * Ask Claude's own Agent SDK for the effective model catalog. The query is only
 * initialized; no user message is sent and the subprocess is closed immediately
 * after `supportedModels()` resolves.
 */
export async function inspectClaudeModels(
  cwd: string,
  createQuery?: ClaudeModelQueryFactory,
  timeoutMs = 30_000,
  executable?: string | null,
  settingsResolver: ClaudeSettingsResolver = (settingsCwd) => resolveSettings({ cwd: settingsCwd }),
): Promise<ClaudeModelCatalogInspection> {
  const modelQuery = createQuery ? createQuery(cwd) : createModelQuery(cwd, executable);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const [models, settings] = await Promise.all([
      Promise.race([
        modelQuery.supportedModels(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Claude model discovery timed out")),
            timeoutMs,
          );
          timer.unref();
        }),
      ]),
      settingsResolver(cwd).catch(() => null),
    ]);
    const options = modelOptions(models);
    const configuredModel = text(settings?.effective.model);
    const configuredEffort = text(
      (settings?.effective as { effortLevel?: unknown } | undefined)?.effortLevel,
    );
    return {
      models: options,
      defaults: {
        model: resolvedDefaultModel(models, configuredModel),
        effort: configuredEffort,
      },
      warning: options.length
        ? null
        : "Claude returned no available models; Attend will use Claude's default model.",
    };
  } catch {
    return {
      models: [],
      defaults: { model: "", effort: "" },
      warning: "Claude model discovery failed; Attend will use Claude's default model.",
    };
  } finally {
    if (timer) clearTimeout(timer);
    modelQuery.close();
  }
}
