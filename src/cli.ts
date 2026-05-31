import { parseArgs } from "node:util";
import open from "open";
import { scaffoldBrief } from "./commands/new.js";
import { resolveConfig } from "./config.js";
import { startServer } from "./server.js";

const HELP = `attend — local web dashboard for brief-based AI session management

Usage:
  attend [dirs...] [options]     Serve the dashboard (scans dirs for brief.md)
  attend new <name>              Scaffold projects/<name>/brief.md in the current dir

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

  if (positionals[0] === "new") {
    const name = positionals[1];
    if (!name) {
      process.stderr.write("usage: attend new <name>\n");
      process.exitCode = 1;
      return;
    }
    const res = scaffoldBrief(name, process.cwd());
    process.stdout.write(
      res.created ? `created ${res.path}\n` : `already exists, left untouched: ${res.path}\n`,
    );
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
