import { describe, expect, it } from "vitest";
import {
  cursorModelOptionsFromState,
  parseCursorCliModels,
  resolveCursorModelConfiguration,
} from "../src/core/vendor/cursor-models.js";

describe("Cursor model discovery", () => {
  it("parses the account-visible CLI catalog", () => {
    expect(
      parseCursorCliModels(
        [
          "Available models",
          "",
          "auto - Auto (current, default)",
          "gpt-5.3-codex-high - Codex 5.3 High",
          "",
          "Tip: use --model <id>",
        ].join("\n"),
      ),
    ).toEqual([
      { id: "auto", label: "Auto" },
      { id: "gpt-5.3-codex-high", label: "Codex 5.3 High" },
    ]);
  });

  it("keeps only Desktop-enabled Agent models that the CLI account can run", () => {
    const state = {
      availableDefaultModels2: [
        {
          name: "default",
          clientDisplayName: "Auto",
          defaultOn: true,
          supportsAgent: true,
          variants: [{ variantStringRepresentation: "default[]", parameterValues: [] }],
        },
        {
          name: "gpt-5.3-codex",
          clientDisplayName: "Codex 5.3",
          defaultOn: true,
          supportsAgent: true,
          legacySlugs: ["gpt-5.3-codex-high"],
          variants: [
            {
              variantStringRepresentation: "gpt-5.3-codex[reasoning=medium,fast=false]",
              parameterValues: [
                { id: "reasoning", value: "medium" },
                { id: "fast", value: "false" },
              ],
              isDefaultNonMaxConfig: true,
            },
            {
              variantStringRepresentation: "gpt-5.3-codex[reasoning=high,fast=true]",
              parameterValues: [
                { id: "reasoning", value: "high" },
                { id: "fast", value: "true" },
              ],
            },
          ],
        },
        {
          name: "hidden-model",
          clientDisplayName: "Hidden",
          defaultOn: true,
          supportsAgent: true,
          variants: [],
        },
      ],
      aiSettings: {
        modelOverrideEnabled: [],
        modelOverrideDisabled: ["hidden-model"],
        modelConfig: { composer: { selectedModels: [{ modelId: "default", parameters: [] }] } },
      },
    };
    const inspection = cursorModelOptionsFromState(state, [
      { id: "auto", label: "Auto" },
      { id: "gpt-5.3-codex-high", label: "Codex 5.3 High" },
      { id: "hidden-model", label: "Hidden" },
      { id: "unconfigured-model", label: "Not enabled in Desktop" },
    ]);

    expect(inspection.models.map(({ value }) => value)).toEqual(["auto", "gpt-5.3-codex"]);
    expect(inspection.models[1]).toMatchObject({
      label: "Codex 5.3",
      efforts: ["medium", "high"],
      defaultEffort: "medium",
      effortLabels: {
        medium: "Medium",
        high: "High",
      },
      speeds: ["false", "true"],
      defaultSpeed: "false",
      speedLabels: { false: "Standard", true: "Fast" },
      configurations: [
        {
          value: "gpt-5.3-codex[reasoning=medium,fast=false]",
          effort: "medium",
          speed: "false",
        },
        {
          value: "gpt-5.3-codex[reasoning=high,fast=true]",
          effort: "high",
          speed: "true",
        },
      ],
    });
    expect(inspection.defaults).toEqual({ model: "auto", effort: "", speed: "" });
    expect(
      resolveCursorModelConfiguration(inspection.models, "gpt-5.3-codex", "high", "true"),
    ).toBe("gpt-5.3-codex[reasoning=high,fast=true]");
    expect(
      resolveCursorModelConfiguration(inspection.models, "gpt-5.3-codex", "medium", "true"),
    ).toBeNull();
  });
});
