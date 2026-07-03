# attend

> A local console for managing many Claude Code and Codex sessions.

[中文 README](README.zh-CN.md)

## Product Idea

When you run many AI coding sessions, the hard part is choosing what to pick up next.

`attend` treats every session as a piece of local working memory. It gives each thread enough signals to answer quickly:

- What was this session about?
- Is the AI still working, waiting, or done for now?
- What does the AI need from me next?
- How important is this inside this vault?
- How expensive is it to re-enter?
- Should I continue here or fork a new branch?

## Core Signals

### Breathing Light

The light shows the session's live attention status:

- `generating`: the AI is working.
- `unread`: a background reply is ready.
- `seen`: you have looked at it, and it is still being tracked.
- `read`: you parked it.

This is the quickest way to see where the machine changed state while you were elsewhere.

### `brief`

`brief` is the memory anchor for a session. It is the short label that lets you recognize the thread in a crowded list.

It should capture the durable subject or decision point, especially when a long session has moved away from its original prompt.

### `priority`

`priority` is the session's relative importance inside the current vault, scored `0-10`.

It favors work that affects users, production, deadlines, collaborators, deploys, broken builds, or the main goal of the vault.

### `etaMin`

`etaMin` estimates the minutes needed to re-enter the session, reread the latest state, and respond usefully.

Low ETA is good for quick cleanup. High ETA means the session needs a real attention block.

### `state`

`state` is the AI's handoff label: what it thinks should happen next.

- `continue_ready`: the next step is clear.
- `needs_decision`: you need to choose a direction, scope, or tradeoff.
- `needs_input`: the AI needs facts, files, credentials, environment details, or preferences.
- `blocked`: progress is stopped by tooling, auth, CI, dependencies, or an external service.
- `needs_review`: work is ready for your check.
- `followup_suggested`: the task is done, with optional follow-up.
- `done`: no next action is requested.

### `avoidance`

`avoidance` describes one engagement pattern:

- `avoidance`: you keep returning and reading, but the task does not advance.

It comes from local engagement telemetry such as visits, dwell time, scrolling, and prompts.

## Tags

Tags are built for large session lists:

- global tags and per-session tags
- automatic grouping by vendor and project directory
- OR-style filtering for fast narrowing
- assignments stored on both session id and stable `vendor + cwd + brief` keys
- inherited tags when a session is forked

## Fast Fork

Forking is a first-class action because long AI threads often split into investigation, implementation, and product decisions.

`attend` lets you branch from the browser:

- Claude uses native fork support.
- Codex forks by copying the rollout and resuming the copy.
- Cross-provider forks carry transcript context into the new provider.
- The fork starts with your first new message and inherits the parent tags.

## Quick Start

```bash
# scan the current directory
npx attend

# scan specific vault roots
npx attend "~/projects" "~/work" --port 5050
```

Run from GitHub:

```bash
npx github:alvinfunborn/attend
```

Local development:

```bash
git clone https://github.com/alvinfunborn/attend
cd attend
npm install
npm run dev
```

By default, `attend` opens `http://localhost:5050`.

Requirements:

- Node.js `>= 20`
- Claude Code and/or Codex installed to read and continue their sessions

## CLI

```text
attend [dirs...] [options]

  dirs                 Vault roots to scan (default: current directory)
  -p, --port <n>       Port (default: 5050)
      --host <addr>    Host to bind (default: 127.0.0.1)
  -c, --config <path>  Path to attend.config.json
      --no-open        Do not open the browser
  -h, --help           Help
```

Precedence:

```text
CLI args > env > config file > platform defaults
```

Common environment variables:

- `ATTEND_VAULTS`
- `ATTEND_PORT`
- `ATTEND_HOST`
- `ATTEND_CLAUDE_PROJECTS`
- `ATTEND_CODEX_SESSIONS`
- `ATTEND_TAGS`

Example `attend.config.json`:

```json
{
  "vaultRoots": ["D:\\workspace\\projects", "C:\\Users\\you\\notes"],
  "claudeProjects": "C:\\Users\\you\\.claude\\projects",
  "codexSessions": "C:\\Users\\you\\.codex\\sessions",
  "memorySources": [],
  "port": 5050
}
```

## How Signals Are Produced

Sessions created or forked inside `attend` get an analyzer daemon. After the session advances, the daemon returns:

```json
{
  "brief": "tighten tag filtering",
  "state": "needs_review",
  "priority": 7.2,
  "etaMin": 12,
  "reason": "navigation behavior changed and needs QA"
}
```

Older or externally created sessions fall back to local heuristics.

## Boundaries

- Local-first, single-user tool.
- Data stays on your machine.
- Focused on session triage, resume, and fork.
- Browser UI over a local server.

## Development

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

## License

[MIT](LICENSE)
