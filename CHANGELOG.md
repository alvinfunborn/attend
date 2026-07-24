# Changelog

All notable changes to Attend are documented in this file.

## 1.2.1 — 2026-07-24

### Changed

- Empty chat composers keep showing the analyzer's `nextStep` ghost before focus; Tab still accepts
  it only after the composer is focused.
- Session-card turn-reading rails use a logarithmic unread-tail curve so the final assistant
  paragraphs remain visually prominent instead of collapsing to a barely visible linear sliver.

### Fixed

- User turns no longer duplicate when a chat is switched or re-rendered before the matching live
  acknowledgement arrives.
- After stopping a comment response, its latest user message can be edited and resent in the same
  comment thread, including while the abort request is still completing.
- Newly created, forked, promoted, and scheduled sessions are pin-sorted before their first render,
  preventing unpinned cards from briefly appearing in the middle panel's pinned region.
- Session-card comment icons stay visible and use the attention lights' blue tracked color after
  reading, green while unread, and purple while generating; every pinned main-chat message or text
  selection exposes a neutral comment action before its first thread exists and a colored action
  afterward.
- Hovering a pinned user message shows its complete original text, including for historical Pins
  whose stored card preview was truncated.
- Terminal Codex app-server usage-limit notifications now produce the same visible, retryable
  provider error shown for Claude limits immediately, even while Codex marks the exhausted request
  as internally retrying, instead of ending or stalling without an explanation.
- Authoritative Codex model discovery can remove models that are no longer visible, so an obsolete
  in-memory snapshot no longer traps the New Session model picker behind a last-known-list warning.

## 1.2.0 — 2026-07-19

### Added

- Durable one-time scheduling for messages, frozen-context forks, comments, and new sessions
  through one shared clock and action-picker interaction, including Send/Fork scheduling from the
  main composer and user-message editor. Scheduled work stays in the existing queue/card surfaces
  instead of adding a separate scheduling panel, with job/run storage ready for future recurring
  occurrences. Pending session cards project their frozen history and opening turn; sending from
  one early materializes the real session immediately and retargets the original turn without
  changing its scheduled time.

## 1.1.6 — 2026-07-18

### Added

- Analyzer-drafted scrutiny probes that question, explain, or verify something specific in the
  latest turn and fill the composer without sending.

### Changed

- Analyzer `nextStep` drafts now appear as Tab-completable ghost text in an empty, focused composer
  instead of occupying the composer rail.
- `nextStep` and `probe` drafts are discarded when the next user turn starts, including across
  queued turns, refreshes, and late analyzer results.

## 1.1.5 — 2026-07-18

### Fixed

- Preserve the required `node:` prefix for the built-in SQLite module in the bundled CLI.
- Install and launch the actual npm tarball during every release preflight and tagged publish.

## 1.1.4 — 2026-07-18

### Fixed

- A manual Ubuntu release preflight that runs the exact clean-install and browser-test workflow
  without publishing, plus serialized native drag assertions on slower browser runners.

## 1.1.3 — 2026-07-18

### Fixed

- Generation-scoped tag drag cleanup so a delayed `dragend` from one operation cannot cancel an
  immediate second pin or unpin of the same tag.
- Monotonic comment-thread merging so stale history responses cannot replace newer live tool blocks
  or regress an actively generating thread.

## 1.1.2 — 2026-07-18

### Fixed

- Explicit Playwright Chromium and system-dependency provisioning on fresh GitHub Actions runners
  before browser-backed tests execute.

## 1.1.1 — 2026-07-18

### Fixed

- npm 12 lockfile metadata for deterministic clean installs in the publish workflow, with the
  workflow pinned to the npm version used to generate and validate the lockfile.

## 1.1.0 — 2026-07-18

This release turns Attend's first public console into a durable multi-session workspace with
explicit composer context, provider-native run controls, and concurrency-safe local state.

### Added

- A compact composer rail for machine-wide shortcuts, session notes and todos, supported-provider
  Goals, and analyzer-drafted next steps that fill the composer without sending automatically.
- Explicit `@` references to pinned messages. A referenced pin can include its complete text-only
  comment thread, while tool-output pins stay out of provider context.
- Interactive provider questions and structured forms in the chat, plus actionable authentication,
  usage-limit, compatibility, and missing-CLI errors.
- Boolean session and transcript search with phrases, exclusions, `OR`, and bounded regex terms.
- Pinned, hidden, reorderable tags; a filter-driven middle chats panel; and mobile tag scrolling.
- Documented storage and retention behavior for Attend-owned SQLite state.

### Changed

- Attend-owned state now uses one WAL-mode SQLite database with transactional documents, indexed
  event tables, safe concurrent writers, daily bounded maintenance, and idempotent legacy imports.
- Directory arguments now form a canonical multi-root display scope. Multiple Attend instances can
  share state safely while keeping their session lists and directory-scoped tag views independent.
- Model, effort, and speed are discovered from each installed provider, remembered per session, and
  preserved through new sessions, resumes, queued sends, comments, and same- or cross-provider forks.
- Queued work is server-owned and durable across tabs and restarts; queued turns can also become fork
  openers without being sent to the parent session.
- Comment threads remain isolated side conversations until promoted or explicitly referenced, and
  promoted comments/forks inherit the relevant configuration and working context.
- Analyzer verdicts, including `nextStep`, now arrive over the live event stream with polling as a
  bounded fallback.

### Fixed

- Provider transcript normalization for slash commands, metadata, stopped turns, duplicated pending
  messages, and cross-provider fork context.
- Narrow-sidebar and mobile popovers, comment/tool rendering, queue synchronization, and selected
  run-option visibility throughout the console.

## 1.0.0 — 2026-07-12

The first public release of Attend, a local attention-management console for AI coding work.

### Added

- A unified session console for Claude Code, Codex/ChatGPT, and Cursor CLI, including local model and effort discovery.
- Attention signals for every session: generated briefs, priority, state, estimated re-engagement time, and unread or generating status.
- Tags, priority filters, saved focus views, session search, tag search, and scoped bulk archiving.
- In-browser chat with file and image attachments, queued follow-up messages, editable drafts, turn stopping, and transcript refresh.
- Cross-provider session forks, editable fork openers, and a visual fork tree.
- Message pinning, completed-turn folding, response comment threads, and promotion of a comment thread into a regular session.
- Work-pattern statistics for session breadth, prompts, conversation volume, continuity, and resource pressure.
- Light and dark themes, responsive mobile navigation, encrypted browser/server payload support, and persisted UI preferences.
