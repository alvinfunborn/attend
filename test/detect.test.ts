import { describe, expect, it } from "vitest";
import { detectVendors, isVendorId, resolveCodexBin } from "../src/core/vendor/detect.js";

const noBundle = () => false; // no app-bundle on the test "machine"

describe("detectVendors", () => {
  it("reports availability per vendor from the probe; both are chat-capable", () => {
    const installed = new Set(["claude"]);
    const vendors = detectVendors((cmd) => installed.has(cmd), noBundle);
    const claude = vendors.find((v) => v.vendor === "claude");
    const codex = vendors.find((v) => v.vendor === "codex");
    expect(claude).toEqual({ vendor: "claude", available: true, chat: true });
    expect(codex).toEqual({ vendor: "codex", available: false, chat: true });
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
    expect(isVendorId("cursor-cli")).toBe(false);
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
