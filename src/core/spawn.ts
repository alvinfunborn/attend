import { createRequire } from "node:module";

type NodeSpawn = typeof import("node:child_process").spawn;
type NodeSpawnSync = typeof import("node:child_process").spawnSync;
type CrossSpawn = NodeSpawn & { sync: NodeSpawnSync };

// Node's native spawn cannot execute Windows npm `.cmd`/`.bat` shims without
// going through cmd.exe. cross-spawn performs that translation while escaping
// every argument, so prompts and paths never become shell syntax.
const loadModule = createRequire(import.meta.url);
const crossSpawn = loadModule("cross-spawn") as CrossSpawn;

/** Spawn a system CLI with native Node semantics on Unix and npm-shim support on Windows. */
export const spawnCli: NodeSpawn = crossSpawn;

/** Synchronous counterpart used only by bounded startup/compatibility probes. */
export const spawnCliSync: NodeSpawnSync = crossSpawn.sync;
