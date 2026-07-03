import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readCodexModelOptions } from "../src/core/vendor/codex-models.js";

describe("readCodexModelOptions", () => {
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
      { value: "gpt-5.5", label: "gpt-5.5" },
      { value: "gpt-5.4", label: "gpt-5.4" },
    ]);
  });

  it("falls back to no dynamic options when the cache is missing or invalid", () => {
    expect(readCodexModelOptions(path.join(os.tmpdir(), "missing-models-cache.json"))).toEqual([]);
  });
});
