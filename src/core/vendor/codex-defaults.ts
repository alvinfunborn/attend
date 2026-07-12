import { spawn } from "node:child_process";
import type { ModelDefaults } from "../model-options.js";

interface RpcMessage {
  id?: number;
  result?: {
    config?: { model?: unknown; model_reasoning_effort?: unknown };
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Ask Codex's config engine for the effective, cwd-aware CLI defaults. */
export function inspectCodexDefaults(
  codexBin: string | null,
  cwd: string,
  timeoutMs = 10_000,
): Promise<ModelDefaults> {
  if (!codexBin) return Promise.resolve({ model: "", effort: "" });
  return new Promise((resolve) => {
    const child = spawn(codexBin, ["app-server", "--stdio"], {
      cwd,
      stdio: ["pipe", "pipe", "ignore"],
    });
    let settled = false;
    let buffer = "";
    const finish = (defaults: ModelDefaults) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      resolve(defaults);
    };
    const timer = setTimeout(() => finish({ model: "", effort: "" }), timeoutMs);
    timer.unref();
    child.on("error", () => finish({ model: "", effort: "" }));
    child.on("exit", () => finish({ model: "", effort: "" }));
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        let message: RpcMessage;
        try {
          message = JSON.parse(line) as RpcMessage;
        } catch {
          continue;
        }
        if (message.id === 1) {
          child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);
          child.stdin.write(
            `${JSON.stringify({ method: "config/read", id: 2, params: { cwd, includeLayers: false } })}\n`,
          );
        } else if (message.id === 2) {
          const config = message.result?.config;
          finish({
            model: text(config?.model),
            effort: text(config?.model_reasoning_effort),
          });
        }
      }
    });
    child.stdin.write(
      `${JSON.stringify({
        method: "initialize",
        id: 1,
        params: {
          clientInfo: { name: "attend", title: "Attend", version: "1" },
          capabilities: { experimentalApi: true, requestAttestation: false },
        },
      })}\n`,
    );
  });
}
