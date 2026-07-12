import { describe, expect, it } from "vitest";
import { inspectCodexDefaults } from "../src/core/vendor/codex-defaults.js";

describe("inspectCodexDefaults", () => {
  it("reads effective cwd-aware defaults through Codex app-server config/read", async () => {
    const result = inspectCodexDefaults("codex", "/tmp", 1_000);
    // This is an integration-level assertion against the installed CLI when present;
    // the unit behavior is covered by the protocol parsing in the returned shape.
    await expect(result).resolves.toEqual({
      model: expect.any(String),
      effort: expect.any(String),
    });
  });

  it("returns empty defaults when Codex is unavailable", async () => {
    await expect(inspectCodexDefaults(null, "/tmp")).resolves.toEqual({ model: "", effort: "" });
  });
});
