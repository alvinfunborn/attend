import { describe, expect, it } from "vitest";
import { spawnCommand } from "../src/core/spawn.js";
import type { Brief } from "../src/core/types.js";

function brief(over: Partial<Brief>): Brief {
  return {
    path: "/v/p/brief.md",
    projectDir: "D:\\workspace\\proj",
    name: "proj",
    frontMatter: {},
    what: "",
    accept: "",
    next: "",
    status: "active",
    deferUntil: null,
    ...over,
  };
}

describe("spawnCommand", () => {
  it("emits a cd + vendor invocation with what and next", () => {
    const cmd = spawnCommand(brief({ what: "build it", next: "wire the API" }), "claude");
    expect(cmd).toContain('cd "D:\\workspace\\proj"');
    expect(cmd.startsWith('cd "D:\\workspace\\proj"\nclaude "build it')).toBe(true);
    expect(cmd).toContain("Next: wire the API");
  });

  it("uses the codex binary for the codex vendor", () => {
    expect(spawnCommand(brief({ what: "x" }), "codex")).toContain('codex "x"');
  });

  it("escapes embedded quotes and backslashes", () => {
    const cmd = spawnCommand(brief({ what: 'say "hi" C:\\a' }), "claude");
    expect(cmd).toContain('\\"hi\\"');
    expect(cmd).toContain("C:\\\\a");
  });
});
