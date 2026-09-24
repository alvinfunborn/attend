import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ModelInfo } from "@github/copilot-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type CopilotCatalogClient,
  inspectCopilotModels,
  normalizeCopilotModels,
  parseProcessCliModels,
} from "../src/core/vendor/process-cli-models.js";

const capability = {
  supports: { reasoningEffort: true, vision: false },
  limits: { max_context_window_tokens: 200_000 },
};
const models: ModelInfo[] = [
  {
    id: "auto",
    name: "Auto",
    capabilities: { ...capability, supports: { ...capability.supports, reasoningEffort: false } },
  },
  {
    id: "gpt-5.6-luna",
    name: "Luna",
    capabilities: capability,
    supportedReasoningEfforts: ["low", "medium"],
    defaultReasoningEffort: "medium",
    policy: { state: "enabled", terms: "" },
    billing: { multiplier: 0.5 },
  },
  {
    id: "claude-haiku-4.5",
    name: "Haiku",
    capabilities: { ...capability, supports: { ...capability.supports, reasoningEffort: false } },
    supportedReasoningEfforts: ["high"],
  },
];
const dirs: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});
function client(): CopilotCatalogClient {
  return {
    start: vi.fn(async () => {}),
    getAuthStatus: vi.fn(async () => ({ isAuthenticated: true })),
    listModels: vi.fn(async () => models),
    forceStop: vi.fn(async () => {}),
  };
}

describe("vendor catalog compatibility", () => {
  it("accepts real Antigravity single-tab output and preserves effort-bearing model IDs", () => {
    expect(
      parseProcessCliModels(
        "\x1b[32mgemini-3.8-flash-low\tGemini 3.8 Flash (Low)\x1b[0m\ngemini-3.8-flash-high\tGemini 3.8 Flash (High)\nclaude-sonnet-4-6\tClaude Sonnet 4.6\n",
        ["low", "high"],
      ),
    ).toEqual([
      { value: "gemini-3.8-flash-low", label: "Gemini 3.8 Flash (Low)" },
      { value: "gemini-3.8-flash-high", label: "Gemini 3.8 Flash (High)" },
      { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    ]);
  });
  it("normalizes Copilot per-model capability, policy, billing, and no effort for Auto/Haiku", () => {
    const parsed = normalizeCopilotModels(models);
    expect(parsed[0]).toEqual({ value: "auto", label: "Auto" });
    expect(parsed[1]).toMatchObject({
      efforts: ["low", "medium"],
      defaultEffort: "medium",
      policy: "enabled",
      billingMultiplier: 0.5,
    });
    expect(parsed[2]).toEqual({ value: "claude-haiku-4.5", label: "Haiku" });
  });
  it("reads account metadata only and respects COPILOT_HOME and effortLevel", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "copilot-home-"));
    dirs.push(dir);
    fs.writeFileSync(
      path.join(dir, "settings.json"),
      JSON.stringify({ model: "gpt-5.6-luna", effortLevel: "low" }),
    );
    vi.stubEnv("COPILOT_HOME", dir);
    const metadata = client();
    const result = await inspectCopilotModels("/user/copilot", () => metadata);
    expect(result.source).toBe("account");
    expect(result.defaults).toEqual({ model: "gpt-5.6-luna", effort: "low", speed: "" });
    expect(metadata.start).toHaveBeenCalledOnce();
    expect(metadata.listModels).toHaveBeenCalledOnce();
    expect(metadata.forceStop).toHaveBeenCalledOnce();
  });
  it.each(["auth", "protocol", "timeout"])(
    "fails closed and closes the metadata process on %s failure",
    async (failure) => {
      const metadata = client();
      if (failure === "auth")
        vi.mocked(metadata.getAuthStatus).mockResolvedValue({ isAuthenticated: false });
      if (failure === "protocol")
        vi.mocked(metadata.start).mockRejectedValue(new Error("protocol mismatch"));
      if (failure === "timeout")
        vi.mocked(metadata.listModels).mockReturnValue(new Promise(() => {}));
      const result = await inspectCopilotModels(
        "/user/copilot",
        () => metadata,
        5,
        "/repo",
        async () => "",
      );
      expect(result.source).toBe("unavailable");
      expect(result.models).toEqual([{ value: "auto", label: "Auto" }]);
      expect(metadata.forceStop).toHaveBeenCalledOnce();
      if (failure === "auth") expect(metadata.listModels).not.toHaveBeenCalled();
    },
  );
  it("keeps an account's auto-only catalog honest", async () => {
    const metadata = client();
    vi.mocked(metadata.listModels).mockResolvedValue(models.slice(0, 1));
    const result = await inspectCopilotModels("/user/copilot", () => metadata);
    expect(result.source).toBe("account");
    expect(result.warning).toContain("only advertises Auto");
  });
});
