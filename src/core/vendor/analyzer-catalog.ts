import type { AttendConfig } from "../../config.js";
import type { AnalyzerCatalog } from "../analyzer-policy.js";
import { inspectClaudeModels } from "./claude-models.js";
import { inspectCodexDefaults } from "./codex-defaults.js";
import { inspectCodexModelsAsync } from "./codex-models.js";
import { inspectCursorModelsAsync } from "./cursor-models.js";
import { inspectAntigravityModels, inspectCopilotModels } from "./process-cli-models.js";

/** Discover using the same configured executables and credentials as work sessions. */
export async function inspectAnalyzerCatalog(
  config: AttendConfig,
  vendor: string,
  cwd: string,
): Promise<AnalyzerCatalog> {
  if (vendor === "codex" && config.codexBin) {
    const [catalog, defaults] = await Promise.all([
      inspectCodexModelsAsync(config.codexBin, config.codexModelsCache),
      inspectCodexDefaults(config.codexBin, cwd),
    ]);
    return {
      ...catalog,
      defaults,
      live: catalog.source === "live",
      source: catalog.source ?? "cache",
    };
  }
  if (vendor === "claude" && config.claudeBin) {
    const catalog = await inspectClaudeModels(cwd, undefined, 30_000, config.claudeBin);
    return { ...catalog, live: catalog.warning === null, source: "cli" };
  }
  if (vendor === "cursor" && config.cursorBin) {
    const catalog = await inspectCursorModelsAsync(config.cursorBin, config.cursorStateDb);
    return { ...catalog, live: catalog.warning === null, source: "cli+desktop" };
  }
  if (vendor === "antigravity" && config.antigravityBin) {
    const catalog = await inspectAntigravityModels(config.antigravityBin);
    return { ...catalog, live: catalog.source === "cli", source: catalog.source ?? "unavailable" };
  }
  if (vendor === "copilot" && config.copilotBin) {
    const catalog = await inspectCopilotModels(config.copilotBin, undefined, 10_000, cwd);
    return {
      ...catalog,
      live: catalog.source === "account",
      source: catalog.source ?? "unavailable",
    };
  }
  return { models: [], live: false, source: "unavailable" };
}
