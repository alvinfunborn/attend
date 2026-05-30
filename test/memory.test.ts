import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadMemoryKeywords } from "../src/core/memory.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-mem-"));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

function tmp(name: string, content: string): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, content, "utf-8");
  return p;
}

describe("loadMemoryKeywords", () => {
  it("extracts CJK bigrams and latin words, dropping stopwords", () => {
    const f = tmp("a.md", "the project tauri 注意力 管理\nwith webview");
    const kw = loadMemoryKeywords([f]);
    expect(kw).toContain("tauri");
    expect(kw).toContain("webview");
    expect(kw).toContain("注意力");
    expect(kw).toContain("管理");
    expect(kw).not.toContain("the");
    expect(kw).not.toContain("with");
  });

  it("ignores short latin tokens", () => {
    expect(loadMemoryKeywords([tmp("b.md", "go ts api")])).not.toContain("go");
  });

  it("unions and dedupes across sources, tolerating missing files", () => {
    const f1 = tmp("c.md", "alpha beta");
    const kw = loadMemoryKeywords([f1, path.join(dir, "missing.md"), tmp("d.md", "beta gamma")]);
    expect(kw.filter((k) => k === "beta")).toHaveLength(1);
    expect(kw).toEqual(expect.arrayContaining(["alpha", "beta", "gamma"]));
  });
});
