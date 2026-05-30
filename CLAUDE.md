# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Onboarding

`DESIGN.md` is the source of truth for *why* this exists — read it end-to-end, including the **"v1: Node/npx pivot"** section, which records why this was rewritten from Python/Flask to a Node CLI and why Tauri was rejected. `brief.md` holds the current `next` step. `README.md` has the user-facing contract and the file map.

As of v1 (2026-05) `attend` is a **Node + TypeScript** package, distributed zero-install via `npx` (boots a local web server, opens the browser). The original Python implementation lives in `legacy/` for reference only — do not extend it.

## Commands

```bash
npm install
npm run dev          # tsx — run from source, no build
npm start            # node dist/cli.js (requires build first)
npm test             # vitest
npx vitest run test/priority.test.ts   # single test file
npm run typecheck    # tsc --noEmit
npm run lint         # biome check src test  (use --write to fix)
npm run build        # tsup → dist/cli.js (single bundled ESM file)
```

Run the CLI directly: `node dist/cli.js [dirs...] --no-open --port 5071`. Requires Node ≥ 20.

## Architecture

The pipeline, all faithfully ported from `legacy/daemon.py`:

1. **`src/config.ts`** — `resolveConfig()` merges CLI args > env > `attend.config.json` > platform defaults (`os.homedir()`-based, no hardcoded paths). This is how "指定目录" works.
2. **`src/core/brief.ts`** — `scanVault()` recursively finds `brief.md`; `parseBriefText()` splits flat YAML front matter + `## what/accept/next` sections (a tiny parser, no YAML dep — the format is flat).
3. **`src/core/vendor/`** — the extension seam. `SessionSource` interface (`index.ts`) with `ClaudeSource` (JSONL parse) and `CodexSource` (deliberate empty stub — Codex schema unknown; never fabricate data). `collectSessions()` unions all sources. **A new vendor = one new `SessionSource` impl; nothing downstream changes.**
4. **`src/core/telemetry.ts`** — `matchSessions()` ties sessions to a brief by **bidirectional cwd containment** (normalizes `\` vs `/`); `telemetryForBrief()` aggregates sessions/prompts/actions/dwell/ages.
5. **`src/core/pattern.ts`** / **`priority.ts`** — classifier + `score + composed reason`. `memory.ts` provides keywords: per-project Claude memory (`~/.claude/projects/*/memory/MEMORY.md`), auto-discovered and unioned — same memory model as Claude Code.
6. **`src/server.ts`** (Hono) renders feed (`/`) + detail (`/brief?path=`) as server-rendered HTML from `src/ui/`. Sessions cached 30s, memory keywords 60s, to keep refresh cheap.

`src/core/` has **no server dependency** — that's what makes it unit-testable and is the key structural invariant. Keep vendor-specific logic confined to `src/core/vendor/` and spawn-command emission (`core/spawn.ts`); everything else is vendor-neutral.

## Design invariants (do not violate without explicit cause; see DESIGN.md)

1. **brief = state, session = cache** — nothing the dashboard knows may live only in a session.
2. **pull, not push** — no notifications/SSE/websockets.
3. **descriptive telemetry, never judgmental** — pattern labels and reason strings must be observation-form, never second-person pressure. Steel 2007. Making output more "motivating" is a regression. The Codex stub returning nothing (vs. fake data) is part of this.
4. **vendor-neutral data, vendor-locked execution** — keep vendor logic inside `core/vendor/` and `core/spawn.ts`.
5. **single polling surface** — one localhost page. Zero-install via `npx`, browser is the UI; do NOT turn this into a downloadable native app (that's why Tauri was rejected — see DESIGN.md).

## Conventions

- Strict TS, ESM, `verbatimModuleSyntax` (use `import type` for type-only imports). Imports use `.js` extensions.
- Format/lint via biome (`biome.json`); 100-col, double quotes, 2-space.
- Tests are pure (no fs/network) — pass a fixed `now` to time-dependent functions like `telemetryForBrief`.
