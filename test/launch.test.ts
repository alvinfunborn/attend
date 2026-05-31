import { describe, expect, it } from "vitest";
import { buildCommand, buildTerminalInvocation } from "../src/core/launch.js";

describe("buildCommand", () => {
  it("resume", () => {
    expect(buildCommand("resume", "claude", { sessionId: "x1" })).toBe("claude --resume x1");
    expect(buildCommand("resume", "codex", { sessionId: "x1" })).toBe("codex resume x1");
  });
  it("fork", () => {
    expect(buildCommand("fork", "claude", { sessionId: "x1" })).toBe(
      "claude --resume x1 --fork-session",
    );
    expect(buildCommand("fork", "codex", { sessionId: "x1" })).toBe("codex fork x1");
  });
  it("new, with and without an initial prompt", () => {
    expect(buildCommand("new", "claude")).toBe("claude");
    expect(buildCommand("new", "codex", { prompt: "fix the bug" })).toBe('codex "fix the bug"');
    expect(buildCommand("new", "claude", { prompt: 'say "hi"' })).toBe('claude "say \\"hi\\""');
  });
});

describe("buildTerminalInvocation", () => {
  it("wraps in a new cmd window on Windows", () => {
    const inv = buildTerminalInvocation("win32", "D:\\proj", "claude --resume x");
    expect(inv.file).toBe("cmd.exe");
    expect(inv.args.join(" ")).toContain('cd /d "D:\\proj"');
    expect(inv.args.join(" ")).toContain("claude --resume x");
  });
  it("uses osascript Terminal on macOS", () => {
    const inv = buildTerminalInvocation("darwin", "/p", "codex resume x");
    expect(inv.file).toBe("osascript");
    expect(inv.args.join(" ")).toContain("Terminal");
  });
  it("falls back to x-terminal-emulator on linux", () => {
    expect(buildTerminalInvocation("linux", "/p", "codex").file).toBe("x-terminal-emulator");
  });
});
