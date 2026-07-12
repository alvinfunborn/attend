import type { ModelInfo, Query } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it, vi } from "vitest";
import { inspectClaudeModels } from "../src/core/vendor/claude-models.js";

function modelQuery(models: ModelInfo[]): { query: Query; close: ReturnType<typeof vi.fn> } {
  const close = vi.fn();
  return {
    query: { supportedModels: async () => models, close } as unknown as Query,
    close,
  };
}

describe("inspectClaudeModels", () => {
  it("uses Claude's model IDs and exact per-model effort order", async () => {
    const fake = modelQuery([
      {
        value: "default",
        resolvedModel: "claude-default-resolved",
        displayName: "Default (recommended)",
        description: "vendor default",
        supportsEffort: true,
        supportedEffortLevels: ["low", "high", "max"],
      } as ModelInfo & { resolvedModel: string },
      {
        value: "future-model",
        displayName: "Future Model",
        description: "new vendor model",
        supportsEffort: true,
        supportedEffortLevels: ["low", "xhigh"],
      },
    ] as Array<ModelInfo & { resolvedModel?: string }>);

    await expect(
      inspectClaudeModels(
        "/tmp",
        () => fake.query,
        30_000,
        undefined,
        async () => ({
          effective: { effortLevel: "high" },
        }),
      ),
    ).resolves.toEqual({
      models: [{ value: "future-model", label: "Future Model", efforts: ["low", "xhigh"] }],
      defaults: { model: "claude-default-resolved", effort: "high" },
      warning: null,
    });
    expect(fake.close).toHaveBeenCalledOnce();
  });

  it("returns no invented options when Claude discovery fails", async () => {
    const close = vi.fn();
    const fake = {
      supportedModels: async () => {
        throw new Error("unavailable");
      },
      close,
    } as unknown as Query;

    await expect(inspectClaudeModels("/tmp", () => fake)).resolves.toEqual({
      models: [],
      defaults: { model: "", effort: "" },
      warning: "Claude model discovery failed; Attend will use Claude's default model.",
    });
    expect(close).toHaveBeenCalledOnce();
  });
});
