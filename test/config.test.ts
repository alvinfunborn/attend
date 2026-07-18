import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isLoopbackHost, resolveConfig } from "../src/config.js";
import { scopeIdForRoots } from "../src/core/scope.js";
import { resolveClaudeBin } from "../src/core/vendor/detect.js";

const ENV_KEYS = [
  "ATTEND_VAULTS",
  "ATTEND_PORT",
  "ATTEND_HOST",
  "ATTEND_CLAUDE_PROJECTS",
  "ATTEND_CLAUDE_BIN",
  "ATTEND_CODEX_SESSIONS",
  "ATTEND_CODEX_MODELS_CACHE",
  "ATTEND_CURSOR_SESSIONS",
  "ATTEND_CURSOR_PROJECTS",
  "ATTEND_CURSOR_STATE_DB",
  "ATTEND_CURSOR_BIN",
  "ATTEND_TAGS",
  "ATTEND_ENGAGEMENT",
];

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("isLoopbackHost", () => {
  it("accepts loopback names and the complete IPv4 loopback range", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("api.localhost")).toBe(true);
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("127.12.34.56")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
  });

  it("rejects wildcard, LAN, and public bindings", () => {
    expect(isLoopbackHost("0.0.0.0")).toBe(false);
    expect(isLoopbackHost("::")).toBe(false);
    expect(isLoopbackHost("192.168.1.2")).toBe(false);
    expect(isLoopbackHost("example.com")).toBe(false);
  });
});

describe("resolveConfig precedence", () => {
  it("falls back to platform defaults (no scope, port 5050, localhost)", () => {
    const c = resolveConfig({ positionals: [] });
    expect(c.port).toBe(5050);
    expect(c.host).toBe("127.0.0.1");
    expect(c.scopeRoots).toEqual([]); // no dirs → list every session
    expect(c.scopeId).toBe("scope:v1:all");
    expect(c.open).toBe(true);
  });

  it("uses positional dirs as scope roots over env/defaults", () => {
    process.env.ATTEND_VAULTS = "/should/be/ignored";
    const c = resolveConfig({ positionals: ["foo", "bar"] });
    expect(c.scopeRoots).toEqual([path.resolve("bar"), path.resolve("foo")]);
    expect(c.scopeId).toBe(scopeIdForRoots(c.scopeRoots));
  });

  it("canonicalizes duplicate, descendant, and symlinked scope roots", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-scope-"));
    const child = path.join(root, "packages", "app");
    const link = `${root}-link`;
    fs.mkdirSync(child, { recursive: true });
    fs.symlinkSync(root, link, "dir");
    try {
      const combined = resolveConfig({ positionals: [child, root, root, link] });
      const parentOnly = resolveConfig({ positionals: [root] });
      expect(combined.scopeRoots).toEqual([path.resolve(root)]);
      expect(combined.scopeId).toBe(parentOnly.scopeId);
    } finally {
      fs.unlinkSync(link);
      fs.rmSync(root, { recursive: true, force: true });
    }
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
      }),
      "utf-8",
    );
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

  it("resolves the tag store path from env", () => {
    process.env.ATTEND_TAGS = "/tmp/attend-tags.json";
    expect(resolveConfig({ positionals: [] }).tags).toBe(path.resolve("/tmp/attend-tags.json"));
  });

  it("uses the concrete system Claude CLI by default and never the SDK bundle", () => {
    expect(resolveConfig({ positionals: [] }).claudeBin).toBe(resolveClaudeBin());
  });

  it("allows overriding the Claude executable used by the Agent SDK", () => {
    process.env.ATTEND_CLAUDE_BIN = "/opt/claude/current/claude";
    expect(resolveConfig({ positionals: [] }).claudeBin).toBe("/opt/claude/current/claude");
  });

  it("allows overriding Cursor CLI, native projects, and captured sessions", () => {
    process.env.ATTEND_CURSOR_BIN = "/opt/cursor/cursor-agent";
    process.env.ATTEND_CURSOR_PROJECTS = "/tmp/cursor-projects";
    process.env.ATTEND_CURSOR_SESSIONS = "/tmp/attend-cursor-sessions";
    const config = resolveConfig({ positionals: [] });
    expect(config.cursorBin).toBe("/opt/cursor/cursor-agent");
    expect(config.cursorProjects).toBe(path.resolve("/tmp/cursor-projects"));
    expect(config.cursorSessions).toBe(path.resolve("/tmp/attend-cursor-sessions"));
  });

  it("keeps tags global when the session list is directory-scoped", () => {
    const root = path.join(os.tmpdir(), "attend-vault-tags");
    const c = resolveConfig({ positionals: [root] });
    expect(c.tags).toBe(path.join(os.homedir(), ".attend", "tags.json"));
  });

  it("uses one global data home independently of the directory filters", () => {
    const root = path.join(os.tmpdir(), "attend-vault-state");
    const c = resolveConfig({ positionals: [root] });
    expect(c.overrides).toBe(path.join(os.homedir(), ".attend", "overrides.json"));
    expect(c.engagement).toBe(path.join(os.homedir(), ".attend", "engagement.json"));
    expect(c.uiState).toBe(path.join(os.homedir(), ".attend", "ui-state.json"));
    expect(c.chatQueue).toBe(path.join(os.homedir(), ".attend", "chat-queues.json"));
    expect(c.workEvents).toBe(path.join(os.homedir(), ".attend", "attend.sqlite3"));
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
