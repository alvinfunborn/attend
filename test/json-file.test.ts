import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { JsonFile, JsonFileLockTimeoutError } from "../src/core/json-file.js";

const execFileAsync = promisify(execFile);

describe("JsonFile", () => {
  it("preserves concurrent updates from independent Attend processes", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-json-file-"));
    const file = path.join(root, "state.json");
    const fixture = path.resolve("test/fixtures/json-file-writer.ts");
    await Promise.all(
      ["a", "b", "c", "d"].map((prefix) =>
        execFileAsync(process.execPath, ["--import", "tsx", fixture, file, prefix, "25"]),
      ),
    );
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as {
      entries: Record<string, number>;
    };
    expect(Object.keys(parsed.entries)).toHaveLength(100);
    expect(parsed.entries["a:0"]).toBe(0);
    expect(parsed.entries["d:24"]).toBe(24);
    expect(fs.existsSync(`${file}.lock`)).toBe(false);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("recovers a lock left by a terminated local process", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-dead-lock-"));
    const file = path.join(root, "state.json");
    const lock = `${file}.lock`;
    fs.mkdirSync(lock, { recursive: true });
    fs.writeFileSync(
      path.join(lock, "owner.json"),
      JSON.stringify({
        token: "terminated-owner",
        pid: 2_147_483_647,
        hostname: os.hostname(),
        createdAt: Date.now(),
      }),
    );

    const state = new JsonFile(file, (value) =>
      value && typeof value === "object" ? (value as Record<string, number>) : {},
    );
    state.update((value) => {
      value.recovered = 1;
    });

    expect(state.read()).toEqual({ recovered: 1 });
    expect(fs.existsSync(lock)).toBe(false);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("reports live-owner contention as a typed timeout", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-live-lock-"));
    const file = path.join(root, "state.json");
    const lock = `${file}.lock`;
    fs.mkdirSync(lock, { recursive: true });
    fs.writeFileSync(
      path.join(lock, "owner.json"),
      JSON.stringify({
        token: "live-owner",
        pid: process.pid,
        hostname: os.hostname(),
        createdAt: Date.now(),
      }),
    );
    let clock = Date.now();
    const now = vi.spyOn(Date, "now").mockImplementation(() => {
      clock += 10_001;
      return clock;
    });

    try {
      const state = new JsonFile(file, () => ({}));
      expect(() => state.update(() => undefined)).toThrow(JsonFileLockTimeoutError);
    } finally {
      now.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
