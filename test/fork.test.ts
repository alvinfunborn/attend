import { describe, expect, it } from "vitest";
import { buildForkCommand, buildTerminalInvocation } from "../src/core/fork.js";

describe("buildForkCommand", () => {
  it("builds the Claude resume+fork command", () => {
    expect(buildForkCommand("claude", "abc-123")).toBe("claude --resume abc-123 --fork-session");
  });
  it("builds the Codex fork command", () => {
    expect(buildForkCommand("codex", "abc-123")).toBe("codex fork abc-123");
  });
});

describe("buildTerminalInvocation", () => {
  it("wraps the command in a new cmd window on Windows", () => {
    const inv = buildTerminalInvocation("win32", "D:\\proj", "claude --resume x --fork-session");
    expect(inv.file).toBe("cmd.exe");
    expect(inv.args).toContain("/k");
    expect(inv.args.join(" ")).toContain('cd /d "D:\\proj"');
    expect(inv.args.join(" ")).toContain("claude --resume x --fork-session");
  });

  it("uses osascript Terminal on macOS", () => {
    const inv = buildTerminalInvocation("darwin", "/home/u/proj", "codex fork x");
    expect(inv.file).toBe("osascript");
    expect(inv.args.join(" ")).toContain("Terminal");
    expect(inv.args.join(" ")).toContain("codex fork x");
  });

  it("falls back to x-terminal-emulator on linux", () => {
    const inv = buildTerminalInvocation("linux", "/p", "codex fork x");
    expect(inv.file).toBe("x-terminal-emulator");
  });
});
