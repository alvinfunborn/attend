# attend

Local web dashboard for brief-based AI session management across Claude Code + Codex.

> session = cache, brief = state. vendor = replaceable backend, vault = substrate.

## What it does

- Scans your vaults for `brief.md` files (one per task)
- Reads Claude Code JSONL transcripts and matches them to briefs via `cwd`
- Derives per-brief telemetry: sessions / prompts / actions / dwell / last touch
- Classifies each brief into a behavioral pattern (avoidance / stalled / active / healthy / fresh)
- Ranks briefs by `memory-alignment × pattern × explicit blocker`
- Serves one localhost page you can poll instead of N IDE tabs

## Quick start

`attend` is a zero-install Node CLI — it boots a local web server and opens your browser. No app to download.

```bash
# run against the current directory (and below) without installing anything
npx attend

# scan specific vault roots, pick a port
npx attend "D:\workspace\projects" "~/OneDrive/notes" --port 5050
```

Run straight from the repo (no npm publish required):

```bash
npx github:<you>/attend
```

Or clone and run locally:

```bash
git clone <repo> attend && cd attend
npm install
npm start              # = node dist/cli.js
```

Then open `http://localhost:5050` (opened automatically unless `--no-open`).

> Requires Node ≥ 20. Works on Windows and macOS — paths and defaults are platform-aware.

### Publishing (optional, later)

The package is already structured for npm (`bin` entry + `dist/` build). If you ever want the short `npx attend` form to resolve from the public registry, that's a one-time `npm publish`. Until then, GitHub-`npx` and local `npm start` both work unchanged.

## CLI / config

```
attend [dirs...] [options]

  dirs                 Vault roots to scan for brief.md (default: current dir)
  -p, --port <n>       Port (default: 5050)
      --host <addr>    Host to bind (default: 127.0.0.1)
  -c, --config <path>  Path to attend.config.json
      --no-open        Don't open the browser
  -h, --help           Help
```

**Precedence:** CLI args > env > config file > platform defaults.

Env vars: `ATTEND_VAULTS` (path-separator-delimited), `ATTEND_PORT`, `ATTEND_HOST`, `ATTEND_CLAUDE_PROJECTS`, `ATTEND_CODEX_SESSIONS`.

Optional `attend.config.json` (in the cwd, or via `--config`):

```json
{
  "vaultRoots": ["D:\\workspace\\projects", "C:\\Users\\you\\OneDrive\\notes"],
  "claudeProjects": "C:\\Users\\you\\.claude\\projects",
  "codexSessions": "C:\\Users\\you\\.codex\\sessions",
  "memorySources": [],
  "port": 5050
}
```

`memorySources` empty → per-project Claude memory (`~/.claude/projects/*/memory/MEMORY.md`) is auto-discovered and unioned. Same memory model as Claude Code.

## Brief format

Each task gets a `brief.md` at `projects/<name>/brief.md`:

```markdown
---
status: active            # active | deferred | done
last_touch: 2026-05-30
defer_until:              # condition, not date — e.g. "等 X 回复"
---

## what
一句话, 加 why (为什么这事值得做).

## accept
done 的判据 (不是 todo list).

## next
现在卡在哪 / 下一步该试什么.
每次离开 session 前更新这一行.
```

Only `what` / `accept` / `next` sections are read. Other sections are ignored.

## Pattern definitions

| Pattern | Trigger | Meaning |
|---|---|---|
| `fresh` | 0 sessions | Brief exists, no work started |
| `avoidance` | ≥5 prompts, 0 actions | Many entries without productive output — possible decision avoidance |
| `stalled` | 0 actions, last touch ≥ 7 days | Cold, no recent activity |
| `healthy` | actions > 0, avg dwell ≥ 10 min, touch ≤ 3 days | In flow, don't interrupt |
| `active` | some actions, otherwise unclassified | Generic in-progress |

Telemetry is **descriptive, never judgmental** (Steel 2007 on procrastination self-report → avoidance feedback loops). All pattern labels are observations, not verdicts.

## Priority scoring (v1 heuristic)

`score = (memory alignment × 2) + pattern weight + explicit blocker bonus − defer/done penalty`

Each brief gets a one-line reason explaining the rank. Reasons compose so you can override.

## Spawn commands

Detail page generates copy-paste commands for both Claude and Codex.
**Does not auto-spawn** — it copies to clipboard, you paste to your terminal.
This is intentional: auto-spawn from dashboard → 4-tab cascade.

## Architecture

```
src/
  cli.ts            CLI entry: parse args, resolve config, boot server, open browser
  server.ts         Hono HTTP server: feed + detail routes (server-rendered HTML)
  config.ts         config resolution + platform defaults
  core/             pure domain logic (no server deps) — unit-tested
    brief.ts        parse brief.md + scan vaults
    vendor/         SessionSource interface + claude (JSONL) + codex (stub)
    telemetry.ts    cwd-containment match + aggregation
    pattern.ts      behavioral classifier
    memory.ts       Claude-convention per-project memory keywords
    priority.ts     scoring + reasons
  ui/               server-rendered feed/detail HTML
legacy/             original Python/Flask daemon (reference)
```

`core/` is decoupled from the server so it's testable in isolation. New vendors plug in via the `SessionSource` interface (`src/core/vendor/`) — everything downstream is vendor-neutral.

## Develop

```bash
npm run dev          # tsx, no build
npm test             # vitest
npm run typecheck    # tsc --noEmit
npm run lint         # biome
npm run build        # tsup → dist/cli.js
```

## What this is NOT (deliberately)

- Not a chat UI — sessions stay in Claude Code / Codex
- Not push notifications — pull, manual refresh
- Not a TODO app — briefs are task-shaped, not item-shaped
- Not multi-user — single-person attention router
- Not a downloadable native app — zero-install via `npx`, runs in your browser

## Design invariants

Touch these only with cause (see `DESIGN.md`):

1. **brief = state, session = cache** — nothing the dashboard knows lives only in a session
2. **pull, not push** — no notifications unless user opts in later
3. **descriptive telemetry, never judgmental** — Steel constraint
4. **vendor-neutral data, vendor-locked execution** — JSONL is read; spawn is per-vendor
5. **single polling surface** — adding a second dashboard is a regression
