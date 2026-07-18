# Changelog

All notable changes to Attend are documented in this file.

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
