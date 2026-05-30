import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scaffoldBrief } from "../src/commands/new.js";

let dir: string;
afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

describe("scaffoldBrief", () => {
  it("creates projects/<name>/brief.md with the three sections", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-new-"));
    const res = scaffoldBrief("widget", dir, "2026-05-31");
    expect(res.created).toBe(true);
    expect(res.path).toBe(path.join(dir, "widget", "brief.md"));
    const text = fs.readFileSync(res.path, "utf-8");
    expect(text).toContain("status: active");
    expect(text).toContain("last_touch: 2026-05-31");
    expect(text).toMatch(/## what[\s\S]*## accept[\s\S]*## next/);
  });

  it("never overwrites an existing brief", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-new-"));
    scaffoldBrief("widget", dir);
    fs.writeFileSync(path.join(dir, "widget", "brief.md"), "MINE", "utf-8");
    const res = scaffoldBrief("widget", dir);
    expect(res.created).toBe(false);
    expect(fs.readFileSync(res.path, "utf-8")).toBe("MINE");
  });
});
