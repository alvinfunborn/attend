import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const smokeRoot = mkdtempSync(path.join(tmpdir(), "attend-package-smoke-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

try {
  const packOutput = execFileSync(
    npm,
    ["pack", "--json", "--pack-destination", smokeRoot],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  const jsonStart = packOutput.lastIndexOf("\n[");
  const packed = JSON.parse(packOutput.slice(jsonStart >= 0 ? jsonStart + 1 : 0));
  const filename = packed?.[0]?.filename;
  if (typeof filename !== "string" || !filename.endsWith(".tgz")) {
    throw new Error("npm pack did not return a tarball filename");
  }

  const installRoot = path.join(smokeRoot, "install");
  mkdirSync(installRoot);
  execFileSync(
    npm,
    ["install", "--prefix", installRoot, "--no-audit", "--no-fund", path.join(smokeRoot, filename)],
    { stdio: "inherit" },
  );

  const bin = path.join(
    installRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "attend.cmd" : "attend",
  );
  execFileSync(bin, ["--help"], { stdio: "inherit" });
} finally {
  rmSync(smokeRoot, { recursive: true, force: true });
}
