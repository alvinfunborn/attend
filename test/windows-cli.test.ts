import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { spawnCliSync } from "../src/core/spawn.js";
import { runMetadataCommand } from "../src/core/vendor/async-command.js";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function makeNpmStyleShim(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-windows-cli-"));
  tempRoots.push(root);
  const binDir = path.join(root, "shim with spaces");
  fs.mkdirSync(binDir);
  fs.writeFileSync(
    path.join(binDir, "echo-args.mjs"),
    "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n",
    "utf8",
  );
  const shim = path.join(binDir, "codex.cmd");
  fs.writeFileSync(shim, '@echo off\r\nnode "%~dp0\\echo-args.mjs" %*\r\n', "utf8");
  return shim;
}

describe.skipIf(process.platform !== "win32")("Windows CLI shims", () => {
  it("runs npm .cmd shims synchronously without losing or interpreting arguments", () => {
    const shim = makeNpmStyleShim();
    const args = ["alpha", "value with spaces", "x&y", 'quote"inside'];

    const result = spawnCliSync(shim, args, { encoding: "utf8", windowsHide: true });

    expect(result.status).toBe(0);
    expect(JSON.parse(String(result.stdout))).toEqual(args);
  });

  it("uses the same .cmd-safe launcher for asynchronous metadata probes", async () => {
    const shim = makeNpmStyleShim();
    const args = ["--version", "value with spaces", "x&y"];

    const result = await runMetadataCommand(shim, args);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(args);
  });
});
