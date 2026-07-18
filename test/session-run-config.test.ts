import { describe, expect, it } from "vitest";
import { mergeSessionRunConfig, sessionRunConfigKey } from "../src/core/session-run-config.js";

describe("session run configuration", () => {
  it("lets exact provider fields win while retaining Attend-only fields", () => {
    expect(
      mergeSessionRunConfig(
        { source: "provider", model: "provider-model", effort: "high" },
        { model: "saved-model", effort: "medium", speed: "priority" },
      ),
    ).toEqual({ model: "provider-model", effort: "high", speed: "priority" });
  });

  it("uses observed provider values only to fill missing saved fields", () => {
    expect(
      mergeSessionRunConfig(
        { source: "provider-observed", model: "routed-model", speed: "fast" },
        { model: "selected-model", effort: "high" },
      ),
    ).toEqual({ model: "selected-model", effort: "high", speed: "fast" });
  });

  it("does not let a stale provider transcript replace a newer applied selection", () => {
    expect(
      mergeSessionRunConfig(
        { source: "provider", model: "old-model", effort: "medium", updatedAt: 100 },
        { model: "new-model", effort: "xhigh", speed: "priority", updatedAt: 200 },
      ),
    ).toEqual({ model: "new-model", effort: "xhigh", speed: "priority" });
  });

  it("keys the same provider id separately per vendor", () => {
    expect(sessionRunConfigKey("codex", "same-id")).toBe("codex:same-id");
    expect(sessionRunConfigKey("claude", "same-id")).toBe("claude:same-id");
  });
});
