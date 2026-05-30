import { parseArgs } from "node:util";
import open from "open";
import { resolveConfig } from "./config.js";
import { startServer } from "./server.js";

const HELP = `attend — local web dashboard for brief-based AI session management

Usage:
  attend [dirs...] [options]

Arguments:
  dirs                 Vault roots to scan for brief.md (default: current directory)

Options:
  -p, --port <n>       Port to listen on (default: 5050)
      --host <addr>    Host to bind (default: 127.0.0.1)
  -c, --config <path>  Path to attend.config.json
      --no-open        Do not open the browser on start
  -h, --help           Show this help

Config precedence: CLI args > env (ATTEND_VAULTS / ATTEND_PORT / ATTEND_CLAUDE_PROJECTS
/ ATTEND_CODEX_SESSIONS / ATTEND_HOST) > attend.config.json > platform defaults.`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: "string", short: "p" },
      host: { type: "string" },
      config: { type: "string", short: "c" },
      "no-open": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }

  const config = resolveConfig({
    positionals,
    port: values.port,
    host: values.host,
    config: values.config,
    noOpen: values["no-open"],
  });

  const server = await startServer(config);

  process.stdout.write(`attend — running at ${server.url}\n`);
  process.stdout.write("vault roots:\n");
  for (const root of config.vaultRoots) process.stdout.write(`  ${root}\n`);

  if (config.open) {
    await open(server.url).catch(() => {
      /* headless / no browser — ignore */
    });
  }
}

main().catch((err) => {
  process.stderr.write(`attend failed to start: ${err instanceof Error ? err.message : err}\n`);
  process.exitCode = 1;
});
