import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const smokeRoot = mkdtempSync(path.join(tmpdir(), "attend-package-smoke-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

try {
  execFileSync(npm, ["pack", "--pack-destination", smokeRoot], {
    cwd: root,
    stdio: "inherit",
  });
  const tarballs = readdirSync(smokeRoot).filter((filename) => filename.endsWith(".tgz"));
  if (tarballs.length !== 1) throw new Error("npm pack did not create exactly one tarball");
  const [filename] = tarballs;

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
