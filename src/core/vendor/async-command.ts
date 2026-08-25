import type { ChildProcess } from "node:child_process";
import { spawnCli } from "../spawn.js";

export interface AsyncCommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Run a bounded metadata command without blocking the server event loop.
 * Provider chat processes have their own streaming drivers; this helper is only
 * for short catalog/version/help probes. It intentionally uses the same
 * cross-platform launcher as live turns so Windows npm shims are probed exactly
 * as they will be executed.
 */
export function runMetadataCommand(
  executable: string,
  args: string[],
  timeoutMs = 10_000,
  maxBuffer = 8 * 1024 * 1024,
): Promise<AsyncCommandResult> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = spawnCli(executable, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      resolve({ status: 1, stdout: "", stderr: errorText(error) });
      return;
    }

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bufferedBytes = 0;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (status: number, detail = "") => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (detail) stderr.push(Buffer.from(`${stderr.length ? "\n" : ""}${detail}`));
      resolve({
        status,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    };

    const capture = (target: Buffer[], chunk: string | Buffer) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bufferedBytes += buffer.byteLength;
      if (bufferedBytes > maxBuffer) {
        child.kill();
        finish(1, `Command output exceeded ${maxBuffer} bytes.`);
        return;
      }
      target.push(buffer);
    };

    child.stdout?.on("data", (chunk: string | Buffer) => capture(stdout, chunk));
    child.stderr?.on("data", (chunk: string | Buffer) => capture(stderr, chunk));
    child.once("error", (error) => finish(1, errorText(error)));
    child.once("close", (code, signal) =>
      finish(code ?? 1, code === null && signal ? `Command terminated by ${signal}.` : ""),
    );

    timer = setTimeout(() => {
      child.kill();
      finish(1, `Command timed out after ${timeoutMs}ms.`);
    }, timeoutMs);
    timer.unref?.();
  });
}
