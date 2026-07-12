import { describe, expect, it } from "vitest";
import {
  detectVendors,
  isVendorId,
  resolveClaudeBin,
  resolveCodexBin,
  resolveCursorBin,
} from "../src/core/vendor/detect.js";

const noBundle = () => false; // no app-bundle on the test "machine"

describe("detectVendors", () => {
  it("reports availability per vendor from the probe; both are chat-capable", () => {
    const installed = new Set(["claude"]);
    const vendors = detectVendors((cmd) => installed.has(cmd), noBundle);
    const claude = vendors.find((v) => v.vendor === "claude");
    const codex = vendors.find((v) => v.vendor === "codex");
    const cursor = vendors.find((v) => v.vendor === "cursor");
    expect(claude).toEqual({ vendor: "claude", available: true, chat: true });
    expect(codex).toEqual({ vendor: "codex", available: false, chat: true });
    expect(cursor).toEqual({ vendor: "cursor", available: false, chat: true });
  });

  it("marks both available when both CLIs resolve on PATH", () => {
    const vendors = detectVendors(() => true, noBundle);
    expect(vendors.every((v) => v.available)).toBe(true);
  });

  it("marks all unavailable when neither PATH nor the app-bundle resolve", () => {
    const vendors = detectVendors(() => false, noBundle);
    expect(vendors.some((v) => v.available)).toBe(false);
  });

  it("uses the same registry to validate server vendor ids", () => {
    expect(isVendorId("claude")).toBe(true);
    expect(isVendorId("codex")).toBe(true);
    expect(isVendorId("cursor")).toBe(true);
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

  it("resolves the concrete Claude executable for Agent SDK parity", () => {
    expect(resolveClaudeBin((command) => (command === "claude" ? "/opt/bin/claude" : null))).toBe(
      "/opt/bin/claude",
    );
    expect(resolveClaudeBin(() => null)).toBeNull();
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
