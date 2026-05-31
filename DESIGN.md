# attend — design

This document captures the design context that led to v0. Subsequent sessions opened in this project should read this first to onboard.

## Problem

A single person collaborating with AI faces four compounding costs:

1. **Concurrency** — 10+ active sessions across Claude Code (multiple VS Code projects) + Codex CLI is normal, not pathological. Reducing the count is not the goal.
2. **Vendor isolation** — Claude Code and Codex are separate ecosystems. `/fork` exists in each (Codex CLI has it, Claude Code CLI has it but the VS Code panel does not). Neither is cross-vendor. Manual copy-paste is the current state.
3. **Decision avoidance** — when a session needs a hard decision, the user switches to easier completed sessions to "verify and push." Classic Steel-type *avoidant procrastination*. Self-report doesn't detect it (gets rationalized as "efficient batching"). Behavioral telemetry would.
4. **Polling overhead** — N IDE tabs × re-orientation cost on each switch (UC Irvine: 23 min 15 s to refocus; APA: 40% productivity loss from switching). Adding more organization tools makes this worse, not better.

## Conceptual model — the invariant

```
session = cache       (transient, vendor-bound, may die)
brief   = state       (persistent, vendor-neutral, survives session death)
vendor  = replaceable backend
vault   = substrate
```

A task may use 0..N sessions over its life. Sessions are vehicles; briefs are passengers. **A cold 3-day-old session is usually more expensive to resume than spawning a fresh session from a brief** — chat history accumulates dead context, summarization loses fidelity, and the user's own working memory of the session has decayed.

Concrete consequence: don't try to keep sessions alive across attention gaps. Externalize state to brief; kill the session; spawn fresh when ready.

## Four components

### 1. Brief

- **Granularity**: per-task, not per-session
- **Location**: `projects/<name>/brief.md` — physically colocated with work, not in a separate "briefs/" directory. Found by `ls`, not by remembering.
- **Three sections**:
  - `what` — one sentence + *why* this is worth doing
  - `accept` — done criteria (not a TODO list)
  - `next` — **where you are stuck / what to try next**. Update this line before every session-leave. Gollwitzer's implementation-intention research: the meta-decision ("what should I do?") is where cost concentrates; pre-committing it at cheap time pays off massively.
- **Front matter**: `status` (active/deferred/done), `defer_until` (a *condition*, not a date — "等 X 回复"), `last_touch`
- **Lifecycle**: created manually or via split; killed only by explicit `status: done`. Cold sessions are killed; their briefs persist.

### 2. Telemetry

- **Data sources**: vendor JSONL transcripts
  - Claude Code: `~/.claude/projects/<encoded-cwd>/*.jsonl`
  - Codex CLI: `~/.codex/sessions/YYYY/MM/DD/*.jsonl` (not parsed in v0)
- **Session-to-brief matching**: by `cwd` field in JSONL. A session's cwd contains (or equals) the brief's project directory.
- **Per-brief signals**: sessions count, prompts count, action count (Edit/Write/Bash tool uses), dwell distribution, last_touch_age, last_action_age
- **Pattern classifier**:

| Pattern | Trigger | What it means |
|---|---|---|
| `fresh` | 0 sessions | Brief exists, no work started |
| `avoidance` | ≥5 prompts, 0 actions | Many entries, no productive output — decision is what's needed, not more "work" |
| `stalled` | 0 actions, last touch ≥ 7 days | Cold — needs unblock or kill |
| `healthy` | actions > 0, avg dwell ≥ 10 min, touch ≤ 3 days | In flow, don't interrupt |
| `active` | actions > 0, otherwise | Generic in-progress |

- **Hard constraint** — descriptive, never judgmental (Steel 2007: judgmental feedback on procrastination behavior *worsens* it via self-esteem mediation). Output strings must avoid second-person pressure verbs ("you again," "still stuck"). Use observation-form: "X count, Y duration, Z actions."

### 3. Priority evaluator

- **Inputs**: brief × user-memory keywords (extracted from MEMORY.md) × telemetry pattern × explicit blockers in `next`
- **Output**: ranked list + **one-line reason per rank** (no opaque scores; user must be able to override)
- **Time NOT used as input** — explicitly rejected (see below). Semantic alignment with memory is the real axis; pattern signals action implication.
- v0: heuristic scoring (memory keyword hits × 2 + pattern bonus + blocker bonus − defer penalty)
- v1+: LLM-based, env-flagged (`ATTEND_LLM=anthropic|openai`)

### 4. Split (not in v0)

- **Purpose**: when a session organically grows N follow-up threads, factor them out into N new briefs
- **Flow**: read transcript → LLM "identify open follow-up threads" → N candidate briefs in 3-line format → user reviews → commits selected to vault
- **Intentional limitation**: does NOT auto-spawn sessions. spawn is a separate user decision. Auto-spawn from split would create a 4-tab cascade — exactly the load problem we're solving.
- **Distinction from fork**: fork = duplicate-and-diverge (Warp, Claude SDK, Codex CLI); split = factor-out. Fork copies state; split extracts task specs. They're different operations.
- **Cross-vendor**: split reads JSONL on disk — vendor-neutral input → vendor-neutral brief output. Vendor only re-enters at spawn time.

## Product form

**Local web app at `http://localhost:5050`. Python + Flask + server-side HTML.** Daemon scans vault, reads vendor JSONL, renders ranked feed. Polled by browser refresh.

### Why this form

- **Single polling surface** — one tab, one URL. Replaces N IDE tabs.
- **Vendor-neutral** — not bound to VS Code or any terminal. Treats Claude and Codex equally.
- **Data in local vault** — daemon is view-only; if it dies the vault is still authoritative.
- **Incremental enrichment** — start static HTML, add buttons (spawn, defer, split) as needed.

### Forms rejected

- **VS Code plugin** — locks one IDE; can't span Claude + Codex
- **TUI** — multi-window management collapses back to the tab-bounce problem
- **Desktop app** — engineering overhead without benefit
- **Push notifications** — user confirmed: when polling = idle moments, push doesn't help (can't act when not idle). Pull-only.

### Inspirational reference

Slock.ai's structural primitives — channel/thread (persistent, task-shaped) vs. message stream (transient) — directly informed brief/session separation. We use the structural insight without copying the multi-agent collaboration features.

## Design invariants

Touch these only with explicit cause:

1. **brief = state, session = cache** — nothing the dashboard knows lives only in a session
2. **pull, not push** — no notifications unless user opts in
3. **descriptive telemetry, never judgmental** — Steel constraint, see telemetry section
4. **vendor-neutral data, vendor-locked execution** — JSONL is read; spawn is per-vendor
5. **single polling surface** — adding a second dashboard is a regression

## Rejected paths (don't redo)

- **4-bucket organization** (TODO / 进行中 / 已完成 / 长期保留 in separate locations). Asks user to remember N locations. Replaced by brief sidecar at task location, found by `ls`.
- **Obsidian bidirectional links / Zettelkasten-style PKM**. Explicitly deferred — user judgment was that base models + memory + agent platforms will deliver this upstream over time. Don't preempt; revisit if upstream stalls.
- **Hot/warm/cold by time**. Session state changes fast but total count stays high; recency doesn't track priority. Replaced by memory-aligned semantic priority + pattern-based action implication.
- **LangChain Agent Inbox / push notifications**. User's diagnostic cost when polling is already near-zero; push adds noise without enabling action.
- **Cap to 2-5 concurrent sessions**. Open ≠ active. Goal isn't reducing tab count, it's reducing re-warming cost via durable briefs.
- **Fork as cross-vendor primitive**. Each vendor's fork is locked to its transcript format and API. Brief is the cross-vendor abstraction; fork lives one level below.
- **Auto-spawn from dashboard**. Auto-spawning new sessions from priority list would recreate the cascade we just dismantled. Spawn buttons copy commands only. *(Partially overridden in v1.2 — see below: a manual per-session "split ⑂" button now actively launches a vendor `fork` in a terminal. The override is narrow — one explicit click forks one existing session — and does not auto-spawn from the ranked list, so the cascade concern stays addressed.)*

## Cross-vendor data layer

Both vendors store transcripts as local JSONL with a `cwd` field. Daemon reads both, matches sessions to briefs by cwd-vs-project-dir containment, derives signals per brief, renders vendor-neutral output. Vendor only re-appears at:

1. **Transcript ingestion** (per-vendor JSONL parser)
2. **Spawn command** (per-vendor CLI invocation)

Everything in between (briefs, dashboard, priority, telemetry) is vendor-agnostic markdown/HTML.

## Research touchstones

- **Steel, P. (2007)** — *Arousal, avoidant, and decisional procrastinators: do they exist?* Three procrastination types; foundational for the avoidance pattern definition. Identified behavioral-measurement gap: most procrastination research is self-report, telemetry is largely unexplored. This is the niche the telemetry component fills.
- **Gollwitzer, P. (1999)** — *Implementation intentions.* Pre-committing "if X then Y" at cheap time reduces decision-point friction. Direct rationale for the `next` line discipline.
- **Rosenbaum (2014)** — *Pre-crastination.* Doing the easy thing first to free working memory is a real mechanism, not always avoidance. Distinguishes by whether the easy task ends in 1-2 hours; if longer, it's likely the avoidance pattern.
- **Karpathy LLM Wiki pattern** — `wiki/hot.md` of ~500 words auto-loaded at session start. Brief is our hot-cache analog.
- **Slock.ai** — Persistent channels with transient message streams. Structural inspiration for brief/session split.

## v0 → v1 roadmap

Shipped (see "v1.1" section below):
- [x] Codex JSONL parser (`src/core/vendor/codex.ts`, against the documented rollout schema)
- [x] `attend new <project>` scaffold
- [x] Refined blocker regex (`等[具体内容]`, not bare `等`)
- [x] Trust hardening: sustained-dwell avoidance, TF-IDF cosine memory alignment

Still open:
- [ ] `attend split <jsonl-path>` CLI: LLM extracts open follow-up threads → N candidate briefs to review (the next high-leverage item; keep output = candidates, user gate non-optional)

Deferred (do not build yet):
- [ ] LLM-based priority option (env-flag) — **deferred** until the legible heuristic is demonstrably insufficient on real briefs; do not trade the auditable one-line reason for an opaque score.

Killed (PM review, 2026-05; both reviewers, emphatically):
- ~~Dwell distribution heatmap per brief~~ — analytics theater; visualizing "time spent" *is* judgmental feedback (invariant 3 / Steel) and adds a second thing to scan (invariant 5).
- ~~In-browser brief edit~~ — pulls state-authoring into the dashboard, eroding "daemon is view-only; vault is authoritative" (invariant 1). The user already lives in an editor.

## Out of scope (likely permanently)

- Multi-user collaboration (Slock-style server/channel/DM)
- Real-time push / SSE / websocket
- Chat UI in the dashboard (sessions live in Claude Code / Codex)
- Hierarchical task trees (briefs are flat; relations live in the `next` line as references)
- Cloud sync (vault is local; OneDrive sync of the vault is incidental, not a feature)

## How a future session onboards

If you (Claude / Codex / human) are picking this up cold:

1. Read this document end-to-end (including the v1 pivot section below).
2. Read `README.md` for run instructions.
3. Read `brief.md` for current `next`.
4. Open http://localhost:5050 if the app is running (`npx attend` or `npm start`).
5. Pick from the brief's `next` and start.

Do not add organizational layers unless you've checked them against invariant 5. Do not change telemetry output to be more "motivating" — that's invariant 3 violation; see Steel research.

## v1: Node/npx pivot (2026-05)

v0 was a single-file Python/Flask `daemon.py` run via `python daemon.py`. v1 reimplements it as a **Node + TypeScript** package distributable via `npx` (zero-install: `npx attend` / `npx github:you/attend`, boots a local server, opens the browser). The original is preserved under `legacy/` for reference.

**Why the change.** The goal was cross-platform (Win + macOS) zero-install distribution. Two product forms were weighed:

- **Tauri (rejected).** Considered, then rejected: Tauri bundles a native installer you *download and install* — the opposite of zero-install. It also renders into an embedded WebView, not a localhost page you open in any browser, so it would have broken the "single localhost polling surface" form. (Note: this supersedes the older "desktop app — engineering overhead" rejection note above for the same reason, just made concrete.)
- **Node CLI + local web server (chosen).** Matches `npx serve`-style distribution: publish once (or run from GitHub), `npx` fetches-and-runs, no permanent install, browser is the UI. Node runs on Win/macOS uniformly. This *restores* the original localhost single-surface form — only the runtime changed (Python → Node), to make `npx` distribution possible.

**What did NOT change.** All five design invariants hold. The memory model is unchanged — still Claude Code's per-project memory (`~/.claude/projects/*/memory/MEMORY.md`), just generalized from one hardcoded file to auto-discovering and unioning all per-project memories. The pattern definitions, priority heuristic, descriptive-telemetry constraint, and spawn-by-copy behavior are ported 1:1 (one refinement: the bare-"等" blocker false-positive from the roadmap is fixed in `priority.ts`).

**Architecture.** `src/core/` is pure domain logic with no server dependency (unit-tested with vitest); `src/server.ts` (Hono) and `src/ui/` are a thin render layer; `src/core/vendor/` holds the `SessionSource` extension point (Claude + Codex impls). Adding a vendor = one new `SessionSource` — the rest stays vendor-neutral (invariant 4). See `README.md` for the file map and dev commands.

## v1.1: trust + cross-vendor (PM review, 2026-05)

A two-PM requirements review (workflow/behavioral lens + strategy/scope lens) researched the 2025–26 landscape and converged on three findings that drove this round:

**1. The wedge, sharpened.** The market exploded into *agent-throughput orchestration* (vibe-kanban, Conductor, Crystal, Claude Squad) and *session-status boards* — and the platform itself now ships the naive version: **Claude Code "Agent View" (May 2026)** is a single-surface, durable, "needs-you-first" session list. That commoditizes attend's *session-dashboard* framing. attend's only defensible ground is the **union no vendor will build: cross-vendor + task-durable + behavioral attention routing.** Consequences:
- **The brief (task) is the primary object; sessions are derived.** This is the structural difference from session-centric Agent View — not a slogan.
- **brief ≠ spec.** A Spec-Driven-Development spec is *upstream of execution* ("build this"); a brief is *resume/attention state* ("where I'm stuck, what to try next" — the Gollwitzer `next` line). Don't let attend drift into an SDD/spec tool.
- **Cross-vendor (Codex) is load-bearing**, not optional — hence the Codex parser shipped this round.

**2. Trust before surface.** The two signals carrying the whole product — the `avoidance` badge and memory-alignment ranking — were the two crudest heuristics (a single blunt prompt threshold; bag-of-words keyword hits). One false call and the user stops opening the page. Fixed this round:
- `avoidance` now requires *sustained* dwell (operationalizing Rosenbaum's "did the easy detour end in 1–2h" test) and its reason carries the evidence.
- memory alignment is now **TF-IDF cosine** (local, no model/API), reported with its top matched terms so the rank stays auditable and overridable.

**3. Invariants are the brand, not constraints to relax.** Pull-only + descriptive-telemetry + single-surface are exactly the choices Conductor/Crystal/Agent View did *not* make (they are push + diff-review + session-centric). The review's one framing correction: the premise "10+ live sessions is normal" is softening (async/cloud delegation lowers live-session count), but "tasks outlive sessions" is *strengthening* — re-weight the pitch toward durable cross-vendor task state, keep the rule. A once-daily opt-in "needs-you" digest was considered and **rejected** (still invariant 2 / the Agent-Inbox rejected path).

## v1.2: manual split = fork (2026-05)

`split` was originally specced as an LLM step (transcript → N candidate briefs). The user redefined it: **no LLM** — a manual per-session **"split ⑂" button** on the brief detail page that branches that session via the vendor's own fork command, run in a new terminal:
- Claude: `claude --resume <id> --fork-session`
- Codex: `codex fork <id>`

The forked session writes a new transcript, so it "splits out" on the next feed refresh — staying within the brief=state / JSONL-is-truth model. `src/core/fork.ts` holds the pure command builders (per-vendor command + platform terminal invocation: `cmd /k` on Windows, `osascript` Terminal on macOS, `x-terminal-emulator` on Linux); `POST /fork` validates `vendor ∈ {claude,codex}`, a safe `[\w-]+` session id, and an existing cwd before launching (the launcher is injectable, so it's unit-tested without spawning).

**Invariant override (deliberate, user-requested).** This is the one place attend actively spawns a vendor process, overriding "spawn buttons copy commands only." The override is narrow: one explicit click forks one *existing* session — it does not auto-spawn from the ranked list, so the 4-tab-cascade concern that motivated the original rule still holds. The fresh-spawn-from-brief commands remain copy-only. `sessionId` is now captured per transcript (Claude `sessionId`; Codex `session_meta.id` or the rollout filename UUID) to target the fork.

## v1.3: sessions-primary command center (2026-05)

The user clarified the product they actually want, and it differs from the original brief-centric pull dashboard: **a session command center** — open it and see *all my chats aggregated across vendors*, with brief + priority attached, and act on them directly (continue / split / new). This is a real reversal of two original stances ("brief is the primary object, session is the derived cache"; "not a chat UI / not a launcher"). The user owns the design; we followed the redirect.

What changed:
- **Main view (`/`) is now sessions-primary.** It lists every session from `~/.claude/projects` and `~/.codex/sessions` (not just brief-matched ones), newest first, each showing a title (first user prompt), vendor, project dir, prompts/actions, age, and — when its cwd matches a brief — that brief's name + priority score + pattern (linking to the brief detail). The brief-priority feed moved to `/briefs`.
- **Direct actions per session:** `continue ▸` (resume) and `split ⑂` (fork), plus a **new session** bar (vendor + a dropdown of known project dirs + a free-text absolute path + optional first prompt). All go through `POST /launch` (`action ∈ resume|fork|new`), which validates vendor / action / safe session id / existing cwd, then opens a terminal via `src/core/launch.ts` (`buildCommand` + `buildTerminalInvocation`).

What is retained: briefs, priority, telemetry, the descriptive-not-judgmental constraint, cross-vendor neutrality, and the single localhost surface all still hold — sessions are now the lens, briefs the attached signal. The launcher is the v1.2 invariant override, generalized: attend now actively starts/continues/forks sessions (still one explicit click each; no auto-spawn of a queue).

**Tension to keep in mind (PM-B):** a sessions-list + launcher overlaps Claude Code's Agent View / Conductor. attend's remaining differentiation is the *union* — cross-vendor + behavioral brief/priority attached to each session — not the session list itself.

## v2: in-browser chat console (2026-05)

The user's final clarification: **the chat itself runs in the page — continue / new / fork all in-browser, never a terminal** (slock.ai-style). This fully reverses the original "not a chat UI / sessions live in the CLI" stance. attend now *hosts* the agent.

- **Backend:** the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) drives Claude headlessly using the existing Claude login (no API key); `query()` streams messages, with built-in `resume`/`forkSession`. Verified end-to-end (init→assistant→result streamed). `src/chat/engine.ts` tracks live runs (streaming-input queue + buffered fan-out); `src/chat/events.ts` normalizes the SDK's large message union into a small UiEvent protocol.
- **Transport (localhost):** `GET /chat/stream` (SSE, replays the run's buffer then streams live), `POST /chat/send` (resume + feed a turn), `/chat/new` (dir + first message), `/chat/fork` (split). `GET /chat/messages` reads a session's JSONL for history.
- **UI:** `src/ui/console.ts` — slock-style sidebar (all sessions) + chat panel (streamed user/assistant/tool-use bubbles) + input; vanilla JS over `EventSource` + `fetch`.
- **Codex** has no streaming SDK yet (`codex exec` is one-shot), so in-browser chat is **Claude-only**; Codex sessions stay listed and fall back to the terminal launcher.

This is the largest invariant reversal; what still holds: cross-vendor session aggregation, brief/priority attached to each session, single localhost surface, descriptive telemetry. Permissions: the live agent runs with **full CLI-parity** (`bypassPermissions` + `allowDangerouslySkipPermissions`) so it can actually execute — `acceptEdits` auto-denied Bash and looked "sandboxed" (the user's bug report); per-tool in-UI approval is the fast-follow that would let us tighten this. Cost: after 2026-06-15, Agent-SDK usage on subscription plans draws a separate monthly Agent SDK credit.

## v2.1: signals follow the session (2026-05)

The original model computed pattern / priority / telemetry **per brief** (a task bucket) and surfaced them on a separate `/briefs` page. In the session-first console that was confusing ("brief 是什么 UX，这些不应该跟着 session 走吗"). So the signals now hang off **each session**: `toSessionViews` builds a single-session `Telemetry` and runs the same `evaluatePriority` against the session (title as its "what"), giving every session its own pattern badge + score + one-line reason in the sidebar, plus a recency/"needs you" sort. `brief` is demoted to an optional tag (a session shows the brief.md its cwd matches, if any); `/briefs` survives as an optional "tasks" rollup. The brief abstraction is no longer something the user must understand to use attend.
