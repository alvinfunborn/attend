import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  inspectCodexModelCache,
  inspectCodexModels,
  readCodexModelOptions,
} from "../src/core/vendor/codex-models.js";

describe("readCodexModelOptions", () => {
  it("uses the Codex CLI effective catalog before any internal file", () => {
    const calls: string[][] = [];
    const inspection = inspectCodexModels("codex", "/missing/cache.json", (_bin, args) => {
      calls.push(args);
      return {
        status: 0,
        stdout: JSON.stringify({
          models: [
            {
              slug: "gpt-5.6-sol",
              visibility: "list",
              priority: 1,
              default_reasoning_level: "medium",
              supported_reasoning_levels: [{ effort: "low" }, { effort: "medium" }],
              service_tiers: [{ id: "priority", name: "Fast", description: "faster responses" }],
              default_service_tier: "default",
            },
          ],
        }),
      };
    });

    expect(calls).toEqual([["debug", "models"]]);
    expect(inspection).toEqual({
      models: [
        {
          value: "gpt-5.6-sol",
          label: "gpt-5.6-sol",
          efforts: ["low", "medium"],
          defaultEffort: "medium",
          speeds: ["default", "priority"],
          defaultSpeed: "default",
          speedLabels: { default: "Standard", priority: "Fast" },
        },
      ],
      warning: null,
    });
  });

  it("falls back to the catalog bundled with Codex when live discovery fails", () => {
    const inspection = inspectCodexModels("codex", "/missing/cache.json", (_bin, args) =>
      args.includes("--bundled")
        ? {
            status: 0,
            stdout: JSON.stringify({
              models: [{ slug: "gpt-5.6-sol", visibility: "list", priority: 1 }],
            }),
          }
        : { status: 1, stdout: "" },
    );

    expect(inspection.models.map((model) => model.value)).toEqual(["gpt-5.6-sol"]);
    expect(inspection.warning).toContain("catalog bundled with Codex");
  });

  it("reads visible Codex models from the local models cache in priority order", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-codex-models-"));
    const file = path.join(dir, "models_cache.json");
    fs.writeFileSync(
      file,
      JSON.stringify({
        models: [
          { slug: "hidden-review", visibility: "hide", priority: 1 },
          { slug: "gpt-5.4", display_name: "GPT-5.4", visibility: "list", priority: 16 },
          { slug: "gpt-5.5", display_name: "GPT-5.5", visibility: "list", priority: 9 },
          { slug: "", visibility: "list", priority: 0 },
        ],
      }),
    );

    expect(readCodexModelOptions(file)).toEqual([
      { value: "gpt-5.5", label: "GPT-5.5" },
      { value: "gpt-5.4", label: "GPT-5.4" },
    ]);
  });

  it("carries each model's advertised reasoning levels and default", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-codex-efforts-"));
    const file = path.join(dir, "models_cache.json");
    fs.writeFileSync(
      file,
      JSON.stringify({
        models: [
          {
            slug: "gpt-5.6-sol",
            visibility: "list",
            priority: -1,
            default_reasoning_level: "low",
            supported_reasoning_levels: [
              { effort: "low" },
              { effort: "medium" },
              { effort: "high" },
              { effort: "xhigh" },
              { effort: "max" },
              { effort: "ultra" },
            ],
          },
          // no supported_reasoning_levels → no efforts field at all
          { slug: "gpt-5.4", visibility: "list", priority: 16 },
          // default not among the advertised levels → dropped
          {
            slug: "gpt-oddball",
            visibility: "list",
            priority: 20,
            default_reasoning_level: "ludicrous",
            supported_reasoning_levels: [{ effort: "low" }, { effort: "high" }],
          },
        ],
      }),
    );

    expect(readCodexModelOptions(file)).toEqual([
      {
        value: "gpt-5.6-sol",
        label: "gpt-5.6-sol",
        efforts: ["low", "medium", "high", "xhigh", "max", "ultra"],
        defaultEffort: "low",
      },
      { value: "gpt-5.4", label: "gpt-5.4" },
      { value: "gpt-oddball", label: "gpt-oddball", efforts: ["low", "high"] },
    ]);
  });

  it("falls back to no dynamic options when the cache is missing or invalid", () => {
    expect(readCodexModelOptions(path.join(os.tmpdir(), "missing-models-cache.json"))).toEqual([]);
  });

  it("reports an explicit compatibility warning when the internal schema changes", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-codex-schema-"));
    const file = path.join(dir, "models_cache.json");
    fs.writeFileSync(file, JSON.stringify({ model_catalog: [] }));

    expect(inspectCodexModelCache(file)).toEqual({
      models: [],
      warning: "Codex internal model cache changed format; using Attend's last known models.",
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
