import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface PackageMetadata {
  version: string;
}

const projectRoot = path.resolve(import.meta.dirname, "..");
const tsxCli = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
const packageMetadata = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
) as PackageMetadata;

describe("attend CLI", () => {
  it.each(["--version", "-v"])("prints the installed version for %s", (flag) => {
    const output = execFileSync(process.execPath, [tsxCli, "src/cli.ts", flag], {
      cwd: projectRoot,
      encoding: "utf8",
    });

    expect(output).toBe(`attend ${packageMetadata.version}\n`);
  });
});
