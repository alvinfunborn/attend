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
2. **`src/core/vendor/`** — the session extension seam. `SessionSource` interface (`index.ts`) with `ClaudeSource` (JSONL parse) and `CodexSource` (deliberate empty stub — Codex schema unknown; never fabricate data). `collectSessions()` unions all sources. **A new vendor = one new `SessionSource` impl; nothing downstream changes.**
3. **`src/core/pattern.ts`** / **`priority.ts`** — classifier + `score + composed reason`. `memory.ts` provides keywords: per-project Claude memory (`~/.claude/projects/*/memory/MEMORY.md`), auto-discovered and unioned — same memory model as Claude Code. These now run only as the **no-daemon fallback** (DESIGN.md "v2.2" memory-led heuristic + `estimateEtaFromMemory`); product-created sessions get brief/priority/ETA from a per-session daemon instead (below). `pattern` is still always session-derived.
4. **`src/core/daemon/`** + **`src/chat/daemon.ts`** + **`src/chat/analyzer/`** — the **analyzer daemon** (DESIGN.md "v2.3"). Every session created in our product (`/chat/new`, `/chat/fork`) gets a paired *daemon session* — a normal session sharing the task's cwd, re-run on each turn-end (`ChatEngine.onTurnEnd`), that replies with one JSON `{brief, priority, etaMin, reason}` (parsed in `daemon/parse.ts`, cached in `daemon/cache.ts`). The analyzer is a **vendor seam** (`chat/analyzer/`: `SessionAnalyzer` + `ClaudeAnalyzer` real, `CodexAnalyzer` stub) — a session is analyzed by its own vendor's daemon. `DaemonOrchestrator` routes by vendor + owns the registry/cache. Daemons are tracked in `daemon/registry.ts` (`~/.attend/daemons.json`) and **filtered out of every listing** (`visibleSessions` in `server.ts`) by id, since they share the task's dir. `query` is injectable (tests never hit the network).
5. **`src/server.ts`** (Hono) hosts the console + chat endpoints. Sessions cached 30s, memory model 60s.

`src/core/` has **no server dependency** — that's what makes it unit-testable and is the key structural invariant. Keep vendor-specific logic confined to `src/core/vendor/`; everything else is vendor-neutral.

## v2: in-browser chat console (current shape)

The main view (`/`) is now a **slock-style chat console**, not a static list — the design pivoted through several user redirects (see DESIGN.md "v1.1"→"v2"). Read DESIGN.md for the full arc; the current shape:

- **`src/chat/engine.ts`** — `ChatEngine` drives Claude via the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`, existing login, no API key). Live runs stream `query()` output; `events.ts` normalizes to a small `UiEvent` protocol; `transcript.ts` reads a session's JSONL for history. The `query` fn is injectable (tests use a fake — never hit the network in tests).
- **`src/ui/console.ts`** — the console SPA (sidebar of all sessions + streamed chat panel + input). Each tab's title is the session daemon's **brief** (provisional first-prompt until analyzed), with two subtitles (`首` first message, `新` latest message) and **priority + ETA badges** — judgeable without opening (DESIGN.md "v2.3"). The `brief.md`/`task` concept and its feed pages were **removed entirely**.
- **Endpoints:** `/` console · `/chat/stream` (SSE) · `/chat/send|new|fork|abort` · `/chat/messages` · `/session/analysis` (daemon verdict) · `/launch` (terminal launcher, now Codex fallback only).
- **Codex** has no streaming SDK → in-browser chat is **Claude-only**; Codex sessions still list + use the terminal launcher.
- Live agent permission mode is fixed (`acceptEdits`) in v2; per-tool in-UI approval is a fast-follow.

## Design invariants (do not violate without explicit cause; see DESIGN.md)

1. **brief = state, session = cache** — nothing the dashboard knows may live only in a session.
2. **pull, not push** — no notifications. (v2 exception: chat uses SSE to stream the live conversation; that's transport for an action the user initiated, not unsolicited push.)
3. **descriptive telemetry, never judgmental** — pattern labels and reason strings must be observation-form, never second-person pressure. Steel 2007. Making output more "motivating" is a regression. The Codex stub returning nothing (vs. fake data) is part of this.
4. **vendor-neutral data, vendor-locked execution** — keep vendor logic inside `core/vendor/` and `core/spawn.ts`.
5. **single polling surface** — one localhost page. Zero-install via `npx`, browser is the UI; do NOT turn this into a downloadable native app (that's why Tauri was rejected — see DESIGN.md).

## Conventions

- Strict TS, ESM, `verbatimModuleSyntax` (use `import type` for type-only imports). Imports use `.js` extensions.
- Format/lint via biome (`biome.json`); 100-col, double quotes, 2-space.
- Tests are pure (no fs/network) — pass a fixed `now` to time-dependent functions like `telemetryForBrief`.
