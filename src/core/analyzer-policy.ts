import type { AnalyzerSettings } from "./analyzer-settings.js";
import type { ModelDefaults, ModelOption } from "./model-options.js";

export interface AnalyzerExecution {
  model?: string;
  effort?: string;
  speed?: string;
  disableThinking?: boolean;
  verifyModel?: boolean;
}
export interface AnalyzerCatalog {
  models: ModelOption[];
  defaults?: ModelDefaults;
  /** Only a live, account/CLI-owned catalog authorizes economical execution. */
  live: boolean;
  source: string;
}
export interface AnalyzerPlan {
  mode: AnalyzerSettings["mode"];
  revision: number;
  fingerprint: string;
  execution?: AnalyzerExecution;
  reason?: string;
  source?: string;
  workFingerprint?: string;
  vendor?: string;
  catalogFetchedAt?: number;
}
export interface AnalyzerPolicy {
  settings(): AnalyzerSettings;
  resolve(taskId: string, vendor: string, cwd: string): Promise<AnalyzerPlan>;
  current(taskId: string, vendor: string, plan: AnalyzerPlan): boolean;
  failed?(vendor: string, cwd: string): void;
}

const EMPTY_DEFAULTS: ModelDefaults = { model: "", effort: "", speed: "" };
export function economicalExecution(
  vendor: string,
  catalog: AnalyzerCatalog,
): AnalyzerExecution | undefined {
  if (!catalog.live) return undefined;
  const models = catalog.models.filter((model) => !model.policy || model.policy === "enabled");
  if (vendor === "codex") {
    const luna = models.find((model) => model.value === "gpt-5.6-luna");
    if (luna?.efforts?.includes("low") && luna.speeds?.includes("default"))
      return { model: luna.value, effort: "low", speed: "default" };
  }
  if (vendor === "claude") {
    const haiku = models.find(
      (model) =>
        model.value === "haiku" && /^claude-haiku-4-5(?:-\d{8})?$/.test(model.resolvedModel ?? ""),
    );
    if (haiku) return { model: haiku.resolvedModel, disableThinking: true, speed: "standard" };
  }
  if (vendor === "antigravity") {
    const flash = models.find((model) => model.value === "gemini-3.8-flash-low");
    if (flash) return { model: flash.value };
  }
  if (vendor === "cursor") {
    const luna = models.find((model) => model.value === "gpt-5.6-luna");
    const variant = luna?.configurations?.find(
      (item) => item.effort === "low" && item.speed === "false" && !/max/i.test(item.value),
    );
    if (variant) return { model: variant.value };
  }
  if (vendor === "copilot") {
    const candidates = models.filter(
      (model) =>
        (["gpt-5.6-luna", "gpt-5-mini"].includes(model.value) && model.efforts?.includes("low")) ||
        model.value === "claude-haiku-4.5",
    );
    const preference = ["gpt-5.6-luna", "claude-haiku-4.5", "gpt-5-mini"];
    candidates.sort((a, b) => {
      const costA = a.billingMultiplier ?? Number.POSITIVE_INFINITY;
      const costB = b.billingMultiplier ?? Number.POSITIVE_INFINITY;
      return costA !== costB
        ? costA - costB
        : preference.indexOf(a.value) - preference.indexOf(b.value);
    });
    const selected = candidates[0];
    if (selected)
      return {
        model: selected.value,
        ...(selected.efforts?.includes("low") ? { effort: "low" } : {}),
      };
  }
  return undefined;
}

/** Catalogs are short-lived and scoped to vendor + workspace. No inference probes. */
export class AnalyzerPolicyResolver implements AnalyzerPolicy {
  private readonly catalogs = new Map<
    string,
    { until: number; fetchedAt: number; value: Promise<AnalyzerCatalog> }
  >();
  private readonly blocked = new Map<string, number>();
  constructor(
    readonly settings: () => AnalyzerSettings,
    private readonly load: (vendor: string, cwd: string) => Promise<AnalyzerCatalog>,
    private readonly workConfig: (vendor: string, taskId: string) => AnalyzerExecution,
    private readonly now = Date.now,
  ) {}
  current(taskId: string, vendor: string, plan: AnalyzerPlan): boolean {
    const settings = this.settings();
    return (
      settings.mode === plan.mode &&
      settings.revision === plan.revision &&
      (plan.mode !== "follow" ||
        plan.workFingerprint === JSON.stringify(this.workConfig(vendor, taskId)))
    );
  }
  failed(vendor: string, cwd: string): void {
    const key = JSON.stringify([vendor, cwd]);
    this.catalogs.delete(key);
    this.blocked.set(key, this.now() + 60_000);
  }
  async resolve(taskId: string, vendor: string, cwd: string): Promise<AnalyzerPlan> {
    const settings = this.settings();
    let execution: AnalyzerExecution | undefined;
    let reason: string | undefined;
    let source: string | undefined;
    let workFingerprint: string | undefined;
    let catalogFetchedAt: number | undefined;
    if (settings.mode === "legacy_vendor_default") execution = {};
    else if (settings.mode === "off") reason = "Background AI is off; using local analysis.";
    else {
      const key = JSON.stringify([vendor, cwd]);
      if ((this.blocked.get(key) ?? 0) > this.now())
        reason = "Background provider failed; using local analysis until the next catalog refresh.";
      else {
        let cached = this.catalogs.get(key);
        if (!cached || cached.until <= this.now()) {
          cached = {
            until: this.now() + 60_000,
            fetchedAt: this.now(),
            value: this.load(vendor, cwd).catch(() => ({
              models: [],
              live: false,
              source: "unavailable",
            })),
          };
          this.catalogs.set(key, cached);
        }
        const catalog = await cached.value;
        catalogFetchedAt = cached.fetchedAt;
        source = catalog.source;
        if (settings.mode === "economical") {
          const economical = economicalExecution(vendor, catalog);
          if (economical) execution = { ...economical, verifyModel: true };
        } else {
          const work = this.workConfig(vendor, taskId);
          workFingerprint = JSON.stringify(work);
          const defaults = catalog.defaults ?? EMPTY_DEFAULTS;
          const model = work.model || defaults.model;
          const selected = catalog.models.find(
            (item) =>
              item.value === model ||
              item.resolvedModel === model ||
              item.configurations?.some((variant) => variant.value === model),
          );
          const changedModel = !!work.model && work.model !== defaults.model;
          const effort =
            work.effort || (changedModel ? selected?.defaultEffort : defaults.effort) || "";
          const speed =
            work.speed || (changedModel ? selected?.defaultSpeed : defaults.speed) || "";
          if (model) {
            if (vendor === "cursor") {
              const option = selected;
              const exact = option?.configurations?.find(
                (item) =>
                  (model === option?.value || item.value === model) &&
                  (!effort || item.effort === effort) &&
                  (!speed || item.speed === speed),
              );
              if (exact) execution = { model: exact.value };
              else if (!effort && !speed) execution = { model };
            } else
              execution = { model, ...(effort ? { effort } : {}), ...(speed ? { speed } : {}) };
          }
        }
        if (!execution)
          reason =
            settings.mode === "economical"
              ? "No verified lightweight configuration; using local analysis."
              : "Work-session configuration is unresolved; using local analysis.";
      }
    }
    return {
      ...settings,
      vendor,
      catalogFetchedAt,
      execution,
      reason,
      source,
      workFingerprint,
      fingerprint: JSON.stringify([settings.mode, settings.revision, execution ?? null]),
    };
  }
}

/** Stop as soon as a provider reports a different model. Missing readback stays unknown. */
export function assertAnalyzerModel(
  execution: AnalyzerExecution | undefined,
  reported: unknown,
): void {
  if (!execution?.verifyModel || !execution.model || typeof reported !== "string" || !reported)
    return;
  const canonical = (value: string) =>
    value
      .split("[")[0]
      ?.replace(/-\d{8}$/, "")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
  if (canonical(execution.model) !== canonical(reported))
    throw new Error("Background provider reported a different model");
}
