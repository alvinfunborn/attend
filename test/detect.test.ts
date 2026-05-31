import { describe, expect, it } from "vitest";
import { detectVendors } from "../src/core/vendor/detect.js";

describe("detectVendors", () => {
  it("reports availability per vendor from the probe, claude is chat-capable", () => {
    const installed = new Set(["claude"]);
    const vendors = detectVendors((cmd) => installed.has(cmd));
    const claude = vendors.find((v) => v.vendor === "claude");
    const codex = vendors.find((v) => v.vendor === "codex");
    expect(claude).toEqual({ vendor: "claude", available: true, chat: true });
    expect(codex).toEqual({ vendor: "codex", available: false, chat: false });
  });

  it("marks both available when both CLIs resolve", () => {
    const vendors = detectVendors(() => true);
    expect(vendors.every((v) => v.available)).toBe(true);
  });

  it("marks all unavailable when none resolve", () => {
    const vendors = detectVendors(() => false);
    expect(vendors.some((v) => v.available)).toBe(false);
  });
});
