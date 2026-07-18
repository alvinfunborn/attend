import { describe, expect, it } from "vitest";
import {
  buildCommand,
  buildTerminalInvocation,
  displayCommand,
  revealCommand,
} from "../src/core/launch.js";

describe("buildCommand", () => {
  it("resume", () => {
    expect(buildCommand("resume", "claude", { sessionId: "x1" })).toEqual({
      file: "claude",
      args: ["--resume", "x1"],
    });
    expect(displayCommand(buildCommand("resume", "codex", { sessionId: "x1" }))).toBe(
      "codex resume x1",
    );
    expect(displayCommand(buildCommand("resume", "cursor", { sessionId: "x1" }))).toBe(
      "cursor-agent --resume=x1",
    );
  });
  it("fork", () => {
    expect(displayCommand(buildCommand("fork", "claude", { sessionId: "x1" }))).toBe(
      "claude --resume x1 --fork-session",
    );
    expect(displayCommand(buildCommand("fork", "codex", { sessionId: "x1" }))).toBe(
      "codex fork x1",
    );
    expect(() => buildCommand("fork", "cursor", { sessionId: "x1" })).toThrow("interactive /fork");
  });
  it("new, with and without an initial prompt", () => {
    expect(displayCommand(buildCommand("new", "claude"))).toBe("claude");
    expect(displayCommand(buildCommand("new", "codex", { prompt: "fix the bug" }))).toBe(
      "codex 'fix the bug'",
    );
    expect(buildCommand("new", "claude", { prompt: 'say "hi"' })).toEqual({
      file: "claude",
      args: ['say "hi"'],
    });
    expect(
      displayCommand(buildCommand("new", "cursor", { model: "composer-2", prompt: "fix it" })),
    ).toBe("cursor-agent --model composer-2 'fix it'");
  });
  it("new, with model and effort overrides", () => {
    expect(displayCommand(buildCommand("new", "claude", { model: "sonnet", effort: "high" }))).toBe(
      "claude --model sonnet --effort high",
    );
    expect(
      displayCommand(
        buildCommand("new", "codex", {
          model: "gpt-5.2-codex",
          effort: "medium",
          prompt: "fix it",
        }),
      ),
    ).toBe(`codex -c 'model="gpt-5.2-codex"' -c 'model_reasoning_effort="medium"' 'fix it'`);
  });
  it("passes each vendor's native speed option", () => {
    expect(
      displayCommand(
        buildCommand("new", "claude", { model: "opus", effort: "high", speed: "fast" }),
      ),
    ).toBe(`claude --model opus --effort high --settings '{"fastMode":true}'`);
    expect(
      displayCommand(buildCommand("new", "codex", { model: "gpt-5.6", speed: "priority" })),
    ).toBe(`codex -c 'model="gpt-5.6"' -c 'service_tier="priority"'`);
    expect(
      displayCommand(
        buildCommand("new", "cursor", {
          model: "gpt-5.3-codex[reasoning=high,fast=true]",
        }),
      ),
    ).toBe(`cursor-agent --model 'gpt-5.3-codex[reasoning=high,fast=true]'`);
  });
  it("passes newer codex reasoning levels (ultra) through unchanged", () => {
    expect(
      displayCommand(buildCommand("new", "codex", { model: "gpt-5.6-sol", effort: "ultra" })),
    ).toBe(`codex -c 'model="gpt-5.6-sol"' -c 'model_reasoning_effort="ultra"'`);
  });

  it("keeps shell metacharacters inside a single argv element", () => {
    const command = buildCommand("new", "claude", { prompt: "$(touch /tmp/pwned); `id`" });
    expect(command.args).toEqual(["$(touch /tmp/pwned); `id`"]);
    expect(displayCommand(command)).toBe("claude '$(touch /tmp/pwned); `id`'");
    expect(() => buildCommand("resume", "claude", { sessionId: "x;id" })).toThrow(
      "invalid session id",
    );
    expect(() => buildCommand("new", "claude", { model: "x$(id)" })).toThrow("invalid model");
  });
});

describe("buildTerminalInvocation", () => {
  it("wraps in a new cmd window on Windows", () => {
    const inv = buildTerminalInvocation(
      "win32",
      "D:\\proj",
      buildCommand("resume", "claude", { sessionId: "x" }),
    );
    expect(inv.file).toBe("powershell.exe");
    expect(inv.args).toContain("-EncodedCommand");
  });
  it("uses osascript Terminal on macOS", () => {
    const inv = buildTerminalInvocation(
      "darwin",
      "/p",
      buildCommand("resume", "codex", { sessionId: "x" }),
    );
    expect(inv.file).toBe("osascript");
    expect(inv.args.join(" ")).toContain("Terminal");
  });
  it("falls back to x-terminal-emulator on linux", () => {
    expect(buildTerminalInvocation("linux", "/p", buildCommand("new", "codex")).file).toBe(
      "x-terminal-emulator",
    );
  });

  it("quotes cwd and prompt independently on POSIX", () => {
    const inv = buildTerminalInvocation(
      "linux",
      "/tmp/a'b; touch nope",
      buildCommand("new", "claude", { prompt: "$(touch nope)" }),
    );
    const script = inv.args.at(-1) ?? "";
    expect(script).toContain(`cd -- '/tmp/a'"'"'b; touch nope'`);
    expect(script).toContain("claude '$(touch nope)'");
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
