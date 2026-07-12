import { describe, expect, it } from "vitest";
import { buildCommand, buildTerminalInvocation, revealCommand } from "../src/core/launch.js";

describe("buildCommand", () => {
  it("resume", () => {
    expect(buildCommand("resume", "claude", { sessionId: "x1" })).toBe("claude --resume x1");
    expect(buildCommand("resume", "codex", { sessionId: "x1" })).toBe("codex resume x1");
    expect(buildCommand("resume", "cursor", { sessionId: "x1" })).toBe("cursor-agent --resume=x1");
  });
  it("fork", () => {
    expect(buildCommand("fork", "claude", { sessionId: "x1" })).toBe(
      "claude --resume x1 --fork-session",
    );
    expect(buildCommand("fork", "codex", { sessionId: "x1" })).toBe("codex fork x1");
    expect(() => buildCommand("fork", "cursor", { sessionId: "x1" })).toThrow("interactive /fork");
  });
  it("new, with and without an initial prompt", () => {
    expect(buildCommand("new", "claude")).toBe("claude");
    expect(buildCommand("new", "codex", { prompt: "fix the bug" })).toBe('codex "fix the bug"');
    expect(buildCommand("new", "claude", { prompt: 'say "hi"' })).toBe('claude "say \\"hi\\""');
    expect(buildCommand("new", "cursor", { model: "composer-2", prompt: "fix it" })).toBe(
      'cursor-agent --model "composer-2" "fix it"',
    );
  });
  it("new, with model and effort overrides", () => {
    expect(buildCommand("new", "claude", { model: "sonnet", effort: "high" })).toBe(
      'claude --model "sonnet" --effort "high"',
    );
    expect(
      buildCommand("new", "codex", { model: "gpt-5.2-codex", effort: "medium", prompt: "fix it" }),
    ).toBe(
      'codex -c "model=\\"gpt-5.2-codex\\"" -c "model_reasoning_effort=\\"medium\\"" "fix it"',
    );
  });
  it("passes newer codex reasoning levels (ultra) through unchanged", () => {
    expect(buildCommand("new", "codex", { model: "gpt-5.6-sol", effort: "ultra" })).toBe(
      'codex -c "model=\\"gpt-5.6-sol\\"" -c "model_reasoning_effort=\\"ultra\\""',
    );
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

describe("revealCommand", () => {
  it("reveals (selects) the file in Finder on macOS", () => {
    expect(revealCommand("darwin", "/p/report.md")).toEqual({
      file: "open",
      args: ["-R", "/p/report.md"],
    });
  });
  it("selects the file in Explorer on Windows", () => {
    expect(revealCommand("win32", "D:\\proj\\a.ogg")).toEqual({
      file: "explorer.exe",
      args: ["/select,D:\\proj\\a.ogg"],
    });
  });
  it("opens the containing folder on linux", () => {
    expect(revealCommand("linux", "/p/sub/a.md")).toEqual({
      file: "xdg-open",
      args: ["/p/sub"],
    });
  });
});
