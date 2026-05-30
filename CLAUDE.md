# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Onboarding

`DESIGN.md` is the source of truth for *why* this exists — read it end-to-end before changing behavior. It covers the problem, the conceptual model, every rejected path (so you don't redo them), and the research touchstones behind the design. `brief.md` holds the current `next` step. `README.md` has the user-facing contract.

## Commands

```powershell
pip install -r requirements.txt
python daemon.py          # serves http://localhost:5050
```

There is no test suite, linter, or build step — this is a single ~400-line Flask script. Verify changes by running the daemon and loading the page.

## Architecture

The entire backend is `daemon.py`; `templates/feed.html` (ranked list) and `templates/detail.html` (per-brief + spawn commands) are the only views. The pipeline, in order, all in `daemon.py`:

1. **`scan_vault()`** — `rglob("brief.md")` across `CONFIG["vault_roots"]`. Each brief is a markdown file with YAML front matter (`status`, `defer_until`, `last_touch`) plus `## what` / `## accept` / `## next` sections. Only those three sections are parsed; others are ignored. The brief lives *at the task's project dir*, not in a central folder — `project_dir = path.parent` is the matching key.
2. **`_scan_claude_sessions()`** — parses Claude Code JSONL transcripts under `~/.claude/projects/*/*.jsonl`, extracting `cwd`, timestamps, prompt count, and action count (tool_use of `Edit`/`Write`/`NotebookEdit`/`Bash`/`PowerShell`). Cached in-process for 30 s (`_SESSION_CACHE`). Codex JSONL is **not parsed in v0** (schema unknown).
3. **`telemetry_for_brief()`** — matches sessions to a brief by **cwd containment** in either direction (session cwd inside project dir, or vice versa), then aggregates sessions/prompts/actions/dwell/last-touch.
4. **`classify_pattern()`** — maps telemetry to `fresh` / `avoidance` / `stalled` / `healthy` / `active`. See the table in `DESIGN.md` / `README.md` for exact thresholds.
5. **`evaluate_priority()`** — `memory-keyword alignment ×2 + pattern weight + explicit-blocker bonus − defer/done penalty`, returning a score, a composed human-readable reason, and the pattern. Memory keywords come from `CONFIG["memory_file"]` (the user's MEMORY.md), CJK + latin tokens, cached 60 s. **Time is deliberately not a priority input** (see DESIGN.md "Rejected paths").
6. **`spawn_command()`** — emits copy-paste `cd … && claude/codex "<brief>"`. v0 never auto-spawns; it only renders commands to copy.

Vendor-specific logic is confined to exactly two seams: JSONL ingestion (step 2) and spawn command emission (step 6). Everything between is vendor-neutral.

All paths/ports live in the `CONFIG` dict at the top of `daemon.py` — there is no separate config file.

## Design invariants (do not violate without explicit cause)

1. **brief = state, session = cache** — nothing the dashboard knows may live only in a session.
2. **pull, not push** — no notifications/SSE/websockets.
3. **descriptive telemetry, never judgmental** — pattern labels and reason strings must be observation-form ("5 prompts, 0 actions"), never second-person pressure ("you again", "still stuck"). This is the Steel 2007 constraint; making output more "motivating" is a regression, not an improvement.
4. **vendor-neutral data, vendor-locked execution** — keep vendor logic inside the two seams above.
5. **single polling surface** — adding a second dashboard/tab/tool is a regression. Check new organizational layers against this.
