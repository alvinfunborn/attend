import { describe, expect, it } from "vitest";
import {
  MIN_CLAUDE_CLI_VERSION,
  detectVendors,
  hasStandaloneCliHelp,
  inspectVendorExecutables,
  isVendorId,
  parseCliVersion,
  resolveAntigravityBin,
  resolveClaudeBin,
  resolveCodexBin,
  resolveCopilotBin,
  resolveCursorBin,
} from "../src/core/vendor/detect.js";

const noBundle = () => false; // no app-bundle on the test "machine"

describe("detectVendors", () => {
  it("reports availability and version from the local CLI probe", () => {
    const installed = new Set(["claude"]);
    const vendors = detectVendors(
      (cmd) => installed.has(cmd),
      noBundle,
      () => "2.1.12",
    );
    const claude = vendors.find((v) => v.vendor === "claude");
    const codex = vendors.find((v) => v.vendor === "codex");
    const cursor = vendors.find((v) => v.vendor === "cursor");
    expect(claude).toMatchObject({
      vendor: "claude",
      available: true,
      chat: true,
      version: "2.1.12",
      minimumVersion: MIN_CLAUDE_CLI_VERSION,
    });
    expect(codex).toMatchObject({
      vendor: "codex",
      available: false,
      chat: true,
      issue: "not_installed",
    });
    expect(cursor).toMatchObject({
      vendor: "cursor",
      available: false,
      chat: true,
      issue: "not_installed",
    });
  });

  it("marks all available when all CLIs resolve and report versions", () => {
    const vendors = detectVendors(
      () => true,
      noBundle,
      () => "2.1.12",
      () => true,
    );
    expect(vendors.every((v) => v.available)).toBe(true);
  });

  it("rejects an agy command that resolves to the Antigravity Desktop launcher", () => {
    const vendors = inspectVendorExecutables(
      { antigravity: "/Applications/Antigravity.app/agy" },
      () => "1.107.0",
      (_executable, vendor) => vendor !== "antigravity",
    );
    expect(vendors.find((vendor) => vendor.vendor === "antigravity")).toMatchObject({
      available: false,
      issue: "wrong_command_surface",
      message: expect.stringContaining("Desktop launcher"),
    });
  });

  it("rejects an editor installer shim that shadows the standalone Copilot CLI", () => {
    expect(
      hasStandaloneCliHelp(
        "Cannot find GitHub Copilot CLI\nInstall GitHub Copilot CLI? ['y/N']",
        "copilot",
      ),
    ).toBe(false);
    expect(
      hasStandaloneCliHelp(
        "Usage: copilot -p <prompt> --output-format=json --session-id <id> --resume=<id>",
        "copilot",
      ),
    ).toBe(true);

    const vendors = inspectVendorExecutables(
      { copilot: "/editor/extensions/copilot" },
      () => {
        throw new Error("version probing should not run for the wrong command surface");
      },
      (_executable, vendor) => vendor !== "copilot",
    );
    expect(vendors.find((vendor) => vendor.vendor === "copilot")).toMatchObject({
      available: false,
      issue: "wrong_command_surface",
      message: expect.stringContaining("installer shim"),
    });
  });

  it("marks all unavailable when neither PATH nor the app-bundle resolve", () => {
    const vendors = detectVendors(() => false, noBundle);
    expect(vendors.some((v) => v.available)).toBe(false);
  });

  it("uses the same registry to validate server vendor ids", () => {
    expect(isVendorId("claude")).toBe(true);
    expect(isVendorId("codex")).toBe(true);
    expect(isVendorId("cursor")).toBe(true);
    expect(isVendorId("antigravity")).toBe(true);
    expect(isVendorId("gemini")).toBe(false);
    expect(isVendorId("copilot")).toBe(true);
    expect(isVendorId("cursor-cli")).toBe(false);
  });

  it("resolves Cursor CLI from cursor-agent on PATH", () => {
    expect(
      resolveCursorBin((command) =>
        command === "cursor-agent" ? "/home/user/.local/bin/cursor-agent" : null,
      ),
    ).toBe("/home/user/.local/bin/cursor-agent");
    expect(resolveCursorBin((command) => (command === "agent" ? "/opt/bin/agent" : null))).toBe(
      "/opt/bin/agent",
    );
    expect(resolveCursorBin(() => null)).toBeNull();
  });

  it("resolves Antigravity and Copilot from their official command names", () => {
    const resolve = (command: string) =>
      command === "agy" || command === "copilot" ? command : null;
    expect(resolveAntigravityBin(resolve)).toBe("agy");
    expect(resolveCopilotBin(resolve)).toBe("copilot");
  });

  it("resolves the concrete Claude executable for Agent SDK parity", () => {
    expect(resolveClaudeBin((command) => (command === "claude" ? "/opt/bin/claude" : null))).toBe(
      "/opt/bin/claude",
    );
    expect(resolveClaudeBin(() => null)).toBeNull();
  });

  it("checks the exact configured executable and rejects an old Claude version", () => {
    const probed: string[] = [];
    const vendors = inspectVendorExecutables(
      {
        claude: "/opt/claude/current/claude",
        codex: "/opt/codex/bin/codex",
        cursor: null,
      },
      (executable) => {
        probed.push(executable);
        return executable.includes("claude") ? "2.0.99" : "0.144.2";
      },
    );

    expect(probed).toEqual(["/opt/claude/current/claude", "/opt/codex/bin/codex"]);
    expect(vendors.find((vendor) => vendor.vendor === "claude")).toMatchObject({
      available: false,
      version: "2.0.99",
      minimumVersion: "2.1.0",
      issue: "version_too_old",
      message:
        "Claude CLI 2.0.99 is too old. Attend requires 2.1.0 or newer. Update Claude Code, then restart Attend.",
    });
  });

  it("keeps missing and non-runnable vendors visible with English recovery guidance", () => {
    const vendors = inspectVendorExecutables(
      { claude: "/broken/claude", codex: null, cursor: null },
      () => null,
    );

    expect(vendors.find((vendor) => vendor.vendor === "claude")).toMatchObject({
      available: false,
      issue: "not_runnable",
      message:
        "Attend could not run Claude Code. Check its configured path or reinstall it, then restart Attend.",
    });
    expect(vendors.find((vendor) => vendor.vendor === "codex")?.message).toContain("Install");
    expect(vendors.find((vendor) => vendor.vendor === "cursor")?.message).toContain("Install");
  });

  it("does not invent a version floor for Codex or Cursor", () => {
    const vendors = inspectVendorExecutables(
      { claude: null, codex: "/opt/bin/codex", cursor: "/opt/bin/cursor-agent" },
      () => null,
    );

    expect(vendors.find((vendor) => vendor.vendor === "codex")).toMatchObject({
      available: true,
    });
    expect(vendors.find((vendor) => vendor.vendor === "cursor")).toMatchObject({
      available: true,
    });
  });

  it("parses native vendor version output", () => {
    expect(parseCliVersion("2.1.206 (Claude Code)")).toBe("2.1.206");
    expect(parseCliVersion("codex-cli 0.144.2")).toBe("0.144.2");
    expect(parseCliVersion("2026.07.09-a3815c0")).toBe("2026.07.09-a3815c0");
    expect(parseCliVersion("unknown")).toBeNull();
  });

  it("resolves Codex from the app-bundle when it isn't on PATH, preferring ChatGPT.app", () => {
    // both bundles present → newest layout (ChatGPT.app) wins
    expect(
      resolveCodexBin(
        () => false,
        () => true,
      ),
    ).toContain("ChatGPT.app");
    // only the older Codex.app bundle present → fall back to it
    expect(
      resolveCodexBin(
        () => false,
        (p) => p.includes("Codex.app"),
      ),
    ).toContain("Codex.app");
    // PATH wins over any bundle
    expect(
      resolveCodexBin(
        () => true,
        () => false,
      ),
    ).toBe("codex");
    expect(
      resolveCodexBin(
        () => false,
        () => false,
      ),
    ).toBeNull();
  });
});
