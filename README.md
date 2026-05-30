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

```powershell
cd D:\workspace\projects\attend
pip install -r requirements.txt
python daemon.py
```

Open http://localhost:5050.

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

Only `what` / `accept` / `next` sections are read. Other sections are fine — they're ignored.

## Config

Edit `CONFIG` at the top of `daemon.py`:

- `vault_roots` — paths scanned recursively for `brief.md`
- `claude_projects` — `~/.claude/projects` (default fits Claude Code)
- `codex_sessions` — `~/.codex/sessions` (optional, currently not parsed in v0)
- `memory_file` — your Claude Code MEMORY.md for keyword extraction
- `port` — default 5050

## Pattern definitions

| Pattern | Trigger | Meaning |
|---|---|---|
| `fresh` | 0 sessions | Brief exists, no work started |
| `avoidance` | ≥5 prompts, 0 actions | Many entries without productive output — possible decision avoidance |
| `stalled` | 0 actions, last touch ≥ 7 days | Cold, no recent activity |
| `healthy` | actions > 0, avg dwell ≥ 10 min, touch ≤ 3 days | In flow, don't interrupt |
| `active` | some actions, otherwise unclassified | Generic in-progress |

Telemetry is **descriptive, never judgmental** (Steel 2007 on procrastination self-report → avoidance feedback loops). All pattern labels are observations, not verdicts.

## Priority scoring (v0 heuristic)

`score = (memory alignment × 2) + pattern weight + explicit blocker bonus − defer/done penalty`

Each brief gets a one-line reason explaining the rank. Reasons compose so you can override.

## Spawn commands

Detail page generates copy-paste commands for both Claude and Codex.
**v0 does not auto-spawn** — it copies to clipboard, you paste to your terminal.
This is intentional: auto-spawn from dashboard → 4-tab cascade.

## What this is NOT (deliberately)

- Not a chat UI — sessions stay in Claude Code / Codex
- Not push notifications — pull, manual refresh
- Not a TODO app — briefs are task-shaped, not item-shaped
- Not multi-user — single-person attention router
- Not Obsidian / Zettelkasten — flat folder scan, no bidirectional links

## v0 → v1 roadmap

- [ ] Codex JSONL telemetry (when schema known)
- [ ] Split CLI: `attend split <jsonl-path>` → N candidate briefs
- [ ] Optional LLM-based priority (env-flag, with reasons)
- [ ] `attend new <name>` to scaffold brief.md
- [ ] Activity heatmap per brief (dwell over time)
- [ ] Brief edit in-browser (currently file-system only)

## Design invariants

Touch these only with cause:

1. **brief = state, session = cache** — nothing the dashboard knows lives only in a session
2. **pull, not push** — no notifications unless user opts in later
3. **descriptive telemetry, never judgmental** — Steel constraint
4. **vendor-neutral data, vendor-locked execution** — JSONL is read; spawn is per-vendor
5. **single polling surface** — adding a second dashboard is a regression
