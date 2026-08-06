import { execFile } from "node:child_process";

export interface AsyncCommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

/**
 * Run a bounded metadata command without blocking the server event loop.
 * Provider chat processes have their own streaming drivers; this helper is only
 * for short catalog/version/help probes.
 */
export function runMetadataCommand(
  executable: string,
  args: string[],
  timeoutMs = 10_000,
  maxBuffer = 8 * 1024 * 1024,
): Promise<AsyncCommandResult> {
  return new Promise((resolve) => {
    execFile(
      executable,
      args,
      {
        encoding: "utf8",
        timeout: timeoutMs,
        maxBuffer,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === "number"
            ? ((error as NodeJS.ErrnoException & { code: number }).code ?? 1)
            : error
              ? 1
              : 0;
        resolve({
          status: code,
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
        });
      },
    );
  });
}
