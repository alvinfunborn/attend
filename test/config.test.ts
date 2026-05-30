import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";

const ENV_KEYS = [
  "ATTEND_VAULTS",
  "ATTEND_PORT",
  "ATTEND_HOST",
  "ATTEND_CLAUDE_PROJECTS",
  "ATTEND_CODEX_SESSIONS",
];

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("resolveConfig precedence", () => {
  it("falls back to platform defaults (cwd vault, port 5050, localhost)", () => {
    const c = resolveConfig({ positionals: [] });
    expect(c.port).toBe(5050);
    expect(c.host).toBe("127.0.0.1");
    expect(c.vaultRoots).toEqual([path.resolve(process.cwd())]);
    expect(c.open).toBe(true);
  });

  it("uses positional dirs as vault roots over env/defaults", () => {
    process.env.ATTEND_VAULTS = "/should/be/ignored";
    const c = resolveConfig({ positionals: ["foo", "bar"] });
    expect(c.vaultRoots).toEqual([path.resolve("foo"), path.resolve("bar")]);
  });

  it("env beats config file; CLI beats env for port", () => {
    process.env.ATTEND_PORT = "6001";
    expect(resolveConfig({ positionals: [] }).port).toBe(6001);
    expect(resolveConfig({ positionals: [], port: "7002" }).port).toBe(7002);
  });

  it("reads a config file when given, but CLI/env still win", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-cfg-"));
    const cfg = path.join(dir, "attend.config.json");
    fs.writeFileSync(cfg, JSON.stringify({ port: 8123, host: "0.0.0.0" }), "utf-8");
    try {
      const c = resolveConfig({ positionals: [], config: cfg });
      expect(c.port).toBe(8123);
      expect(c.host).toBe("0.0.0.0");
      expect(resolveConfig({ positionals: [], config: cfg, port: "9000" }).port).toBe(9000);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("--no-open disables auto-open", () => {
    expect(resolveConfig({ positionals: [], noOpen: true }).open).toBe(false);
  });
});
