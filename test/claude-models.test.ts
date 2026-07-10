import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readClaudeModelOptions } from "../src/core/vendor/claude-models.js";

describe("readClaudeModelOptions", () => {
  it("reads Claude models from the local gateway cache", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-claude-models-"));
    const file = path.join(dir, "gateway-models.json");
    fs.writeFileSync(
      file,
      JSON.stringify({
        models: [
          { id: "claude-sonnet-5", priority: 2 },
          { id: "provider.claude-sonnet-5", priority: 0 },
          { apiName: "claude-fable-5", priority: 1 },
          { id: "claude-hidden-1", visibility: "hidden", priority: -1 },
        ],
      }),
    );

    expect(readClaudeModelOptions(file, [])).toEqual([
      { value: "claude-fable-5", label: "claude-fable-5" },
      { value: "claude-sonnet-5", label: "claude-sonnet-5" },
    ]);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reads availableModels from Claude settings and prefers family aliases over full ids", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-claude-settings-"));
    const cache = path.join(dir, "gateway-models.json");
    const settings = path.join(dir, "settings.json");
    fs.writeFileSync(
      cache,
      JSON.stringify({ models: [{ id: "claude-fable-5" }, { id: "claude-opus-4-8" }] }),
    );
    fs.writeFileSync(
      settings,
      JSON.stringify({ policy: { availableModels: ["fable", "not-a-model", "claude-fable-5"] } }),
    );

    expect(readClaudeModelOptions(cache, [settings])).toEqual([
      { value: "fable", label: "fable" },
      { value: "claude-opus-4-8", label: "claude-opus-4-8" },
    ]);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("falls back to no dynamic options when local sources are missing or invalid", () => {
    expect(
      readClaudeModelOptions(path.join(os.tmpdir(), "missing-gateway-models.json"), []),
    ).toEqual([]);
  });
});
