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
  "ATTEND_CLAUDE_MODELS",
  "ATTEND_CLAUDE_MODELS_CACHE",
  "ATTEND_CODEX_SESSIONS",
  "ATTEND_CODEX_MODELS_CACHE",
  "ATTEND_TAGS",
  "ATTEND_ENGAGEMENT",
];

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("resolveConfig precedence", () => {
  it("falls back to platform defaults (no scope, port 5050, localhost)", () => {
    const c = resolveConfig({ positionals: [] });
    expect(c.port).toBe(5050);
    expect(c.host).toBe("127.0.0.1");
    expect(c.scopeRoots).toEqual([]); // no dirs → list every session
    expect(c.claudeModels).toEqual([]);
    expect(c.claudeModelsCache).toBe(
      path.join(os.homedir(), ".claude", "cache", "gateway-models.json"),
    );
    expect(c.open).toBe(true);
  });

  it("uses positional dirs as scope roots over env/defaults", () => {
    process.env.ATTEND_VAULTS = "/should/be/ignored";
    const c = resolveConfig({ positionals: ["foo", "bar"] });
    expect(c.scopeRoots).toEqual([path.resolve("foo"), path.resolve("bar")]);
  });

  it("scopes from ATTEND_VAULTS when no positional dirs are given", () => {
    process.env.ATTEND_VAULTS = ["/a", "/b"].join(path.delimiter);
    const c = resolveConfig({ positionals: [] });
    expect(c.scopeRoots).toEqual([path.resolve("/a"), path.resolve("/b")]);
  });

  it("env beats config file; CLI beats env for port", () => {
    process.env.ATTEND_PORT = "6001";
    expect(resolveConfig({ positionals: [] }).port).toBe(6001);
    expect(resolveConfig({ positionals: [], port: "7002" }).port).toBe(7002);
  });

  it("reads a config file when given, but CLI/env still win", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-cfg-"));
    const cfg = path.join(dir, "attend.config.json");
    fs.writeFileSync(
      cfg,
      JSON.stringify({
        port: 8123,
        host: "0.0.0.0",
        claudeModels: ["opus", "claude-fable-5"],
        claudeModelsCache: path.join(dir, "claude-models.json"),
      }),
      "utf-8",
    );
    try {
      const c = resolveConfig({ positionals: [], config: cfg });
      expect(c.port).toBe(8123);
      expect(c.host).toBe("0.0.0.0");
      expect(c.claudeModels).toEqual(["opus", "claude-fable-5"]);
      expect(c.claudeModelsCache).toBe(path.join(dir, "claude-models.json"));
      expect(resolveConfig({ positionals: [], config: cfg, port: "9000" }).port).toBe(9000);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lets env override Claude model options", () => {
    process.env.ATTEND_CLAUDE_MODELS = "fable, opus, claude-fable-5";
    process.env.ATTEND_CLAUDE_MODELS_CACHE = "/tmp/attend-claude-models.json";
    expect(resolveConfig({ positionals: [] }).claudeModels).toEqual([
      "fable",
      "opus",
      "claude-fable-5",
    ]);
    expect(resolveConfig({ positionals: [] }).claudeModelsCache).toBe(
      path.resolve("/tmp/attend-claude-models.json"),
    );
  });

  it("--no-open disables auto-open", () => {
    expect(resolveConfig({ positionals: [], noOpen: true }).open).toBe(false);
  });

  it("resolves the tag store path from env", () => {
    process.env.ATTEND_TAGS = "/tmp/attend-tags.json";
    expect(resolveConfig({ positionals: [] }).tags).toBe(path.resolve("/tmp/attend-tags.json"));
  });

  it("defaults tags to the scoped vault when one vault root is set", () => {
    const root = path.join(os.tmpdir(), "attend-vault-tags");
    const c = resolveConfig({ positionals: [root] });
    expect(c.tags).toBe(path.join(path.resolve(root), ".attend", "tags.json"));
  });

  it("defaults user-owned persistence to the scoped vault", () => {
    const root = path.join(os.tmpdir(), "attend-vault-state");
    const c = resolveConfig({ positionals: [root] });
    expect(c.overrides).toBe(path.join(path.resolve(root), ".attend", "overrides.json"));
    expect(c.engagement).toBe(path.join(path.resolve(root), ".attend", "engagement.json"));
    expect(c.uiState).toBe(path.join(path.resolve(root), ".attend", "ui-state.json"));
    expect(c.chatQueue).toBe(path.join(path.resolve(root), ".attend", "chat-queues.json"));
    expect(c.workEvents).toBe(path.join(path.resolve(root), ".attend", "work-events.json"));
    expect(c.daemonRegistry).toBe(path.join(os.homedir(), ".attend", "daemons.json"));
    expect(c.analysisCache).toBe(path.join(os.homedir(), ".attend", "analysis.json"));
  });

  it("keeps the legacy global tag path when no vault root is set", () => {
    const c = resolveConfig({ positionals: [] });
    expect(c.tags).toBe(path.join(os.homedir(), ".attend", "tags.json"));
  });

  it("resolves the engagement store path from env", () => {
    process.env.ATTEND_ENGAGEMENT = "/tmp/attend-engagement.json";
    expect(resolveConfig({ positionals: [] }).engagement).toBe(
      path.resolve("/tmp/attend-engagement.json"),
    );
  });
});
