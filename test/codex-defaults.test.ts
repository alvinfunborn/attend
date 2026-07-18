import { describe, expect, it } from "vitest";
import { defaultsFromCodexRpc, inspectCodexDefaults } from "../src/core/vendor/codex-defaults.js";

describe("inspectCodexDefaults", () => {
  it("parses effective cwd-aware defaults from config/read", () => {
    expect(
      defaultsFromCodexRpc({
        id: 2,
        result: {
          config: { model: "gpt-test", model_reasoning_effort: "high", service_tier: "priority" },
        },
      }),
    ).toEqual({
      model: "gpt-test",
      effort: "high",
      speed: "priority",
    });
  });

  it("returns empty defaults when Codex is unavailable", async () => {
    await expect(inspectCodexDefaults(null, "/tmp")).resolves.toEqual({
      model: "",
      effort: "",
      speed: "",
    });
  });
});
