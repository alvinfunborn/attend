import fs from "node:fs";
import { parseArgs } from "node:util";
import open from "open";
import { resolveConfig } from "./config.js";
import type { RunningServer } from "./server.js";

interface PackageMetadata {
  version: string;
}

const { version: VERSION } = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageMetadata;

const HELP = `attend — local attention-management console for AI coding sessions

Usage:
  attend [dirs...] [options]     Serve the dashboard

Arguments:
  dirs                 Project roots used to limit the session list (default: all sessions)

Options:
  -p, --port <n>       Port to listen on (default: 5050)
      --host <addr>    Host to bind (default: 127.0.0.1)
  -c, --config <path>  Path to attend.config.json
      --no-open        Do not open the browser on start
      --e2ee-passphrase <text>
                     Encrypt browser/server API payloads with this passphrase
  -v, --version        Show the installed version
  -h, --help           Show this help

Config precedence: CLI args > env (ATTEND_VAULTS / ATTEND_PORT / ATTEND_CLAUDE_PROJECTS
/ ATTEND_CODEX_SESSIONS / ATTEND_CURSOR_SESSIONS / ATTEND_HOST / ATTEND_E2EE_PASSPHRASE)
> attend.config.json > platform defaults.`;

function installShutdownHandlers(server: RunningServer): void {
  let closing = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (closing) return;
    closing = true;
    process.stderr.write(
      `attend: received ${signal}; closing web service and stopping active sessions.\n`,
    );
    server.close();
    process.exitCode = 0;
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: "string", short: "p" },
      host: { type: "string" },
      config: { type: "string", short: "c" },
      "no-open": { type: "boolean" },
      "e2ee-passphrase": { type: "string" },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }

  if (values.version) {
    process.stdout.write(`attend ${VERSION}\n`);
    return;
  }

  const config = resolveConfig({
    positionals,
    port: values.port,
    host: values.host,
    config: values.config,
    noOpen: values["no-open"],
    e2eePassphrase: values["e2ee-passphrase"],
  });

  const { startServer } = await import("./server.js");
  const server = await startServer(config);
  installShutdownHandlers(server);

  process.stdout.write(`attend — running at ${server.url}\n`);
  const availableVendors = server.vendors.filter((status) => status.available);
  process.stdout.write(
    `vendors: ${
      availableVendors.length
        ? availableVendors
            .map((status) => `${status.vendor}${status.version ? ` ${status.version}` : ""}`)
            .join(", ")
        : "none available"
    }\n`,
  );
  for (const status of server.vendors) {
    if (!status.available && status.message) process.stderr.write(`attend: ${status.message}\n`);
  }
  if (config.scopeRoots.length > 0) {
    process.stdout.write("scoped to sessions under:\n");
    const missing: string[] = [];
    for (const root of config.scopeRoots) {
      const exists = fs.existsSync(root);
      process.stdout.write(`  ${root}${exists ? "" : "  (does not exist)"}\n`);
      if (!exists) missing.push(root);
    }
    if (missing.length > 0) {
      const subject =
        missing.length === 1 ? "this scope dir does not exist" : "these scope dirs do not exist";
      process.stderr.write(
        `attend: warning — ${subject}; no sessions will match it (check for typos, e.g. /User vs /Users).\n`,
      );
    }
  } else {
    process.stdout.write("scope: all sessions (pass a directory to limit)\n");
  }

  if (config.open) {
    await open(server.url).catch(() => {
      /* headless / no browser — ignore */
    });
  }
}

main().catch((err: NodeJS.ErrnoException) => {
  if (err?.code === "EADDRINUSE") {
    process.stderr.write(
      "attend: no free port found near the requested one. Pass a different one, e.g. --port 15050.\n",
    );
  } else {
    process.stderr.write(`attend failed to start: ${err instanceof Error ? err.message : err}\n`);
  }
  process.exitCode = 1;
});
