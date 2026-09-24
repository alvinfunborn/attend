# Changelog

All notable changes to Attend are documented in this file.

## 1.3.6 — 2026-09-24

### Added

- OpenCode sessions can be browsed and searched from their native SQLite or legacy JSON store,
  and continued in the browser with streaming, stopping, mid-turn steering, and interactive
  questions through an Attend-managed server. Model variants, transcript-seeded forks, and
  same-provider analyzer daemons are supported.
- State labels support custom text and colors, with a themed editor, quick color swatches,
  and a custom color picker alongside the existing presets.
- Composer shortcuts open model, effort, and vendor settings, or select a matching value directly
  when followed by a space.

### Fixed

- The `analyzing` label remains editable when a daemon stalls. Manual labels survive delayed
  analysis results and older session snapshots, and reset when the next conversation turn starts.

## 1.3.5 — 2026-09-14

### Added

- The todo hub can be moved, resized and pinned, and individual todos can be sent or queued
  without replacing the current composer draft or marking the todo complete.
- `attend --compact-index` safely compacts the session catalog after all Attend instances stop.

### Changed

- Session indexing, search synchronization and browser updates use revisioned deltas, reducing
  repeated full-catalog reads and writes across local Attend instances.
- HTML, browser assets and JSON responses support compression. The first session list loads
  independently of the live stream, with bounded downloads and retry backoff.
- Comment threads can fulfill implementation and investigation requests immediately, using the
  same available tools and execution permissions as other workspace tasks.

### Fixed

- Slow session-index downloads survive newer revision notifications, and incremental updates
  cannot replace a missing initial snapshot. Comment-history refreshes no longer block the
  live/session handshake.
- Sidebar and middle-panel dividers support touch dragging. Page height follows the visible
  viewport so browser chrome and keyboard resizing do not leave the composer below the screen.
- Session-list updates preserve the card targeted by a pointer, and session tags remain on one
  horizontally scrollable line in the middle panel.
- Codex capacity failures retry with a bounded backoff and can be stopped while waiting. Resuming
  a thread omits redundant history and times out instead of indefinitely blocking later sends.
- Codex terminal task errors are reported as failures. Comment generation timing survives
  drawer refreshes, and queued-message edits remain synchronized.
- Folder suggestions support keyboard navigation across pages, while transcript pins resolve
  messages outside the currently rendered window.

## 1.3.3 — 2026-08-25

### Changed

- Tagged releases now verify Windows npm command shims on a native Windows runner before the npm
  publish job can begin.

### Fixed

- Windows Codex discovery skips inaccessible desktop-app aliases under `WindowsApps`, continues to
  a later standalone npm `codex.cmd`, and retains that concrete executable instead of falling back
  to the shadowed command name.
- Provider version, model, default-config, analyzer, and live-turn processes share one
  argument-safe cross-platform launcher, so Windows `.cmd` and `.bat` shims work throughout the
  complete Codex execution chain.
- Codex is no longer reported as available when its configured command cannot run, and Windows
  recovery guidance points to the standalone CLI plus `ATTEND_CODEX_BIN` override.

## 1.3.2 — 2026-08-24

### Added

- Typing the exact `/effort ` composer command opens the effort picker with focused keyboard
  navigation, including Arrow keys, Enter, and Escape.

### Changed

- The middle session panel can use the full available viewport width and restores saved widths
  beyond the previous 1200px limit.

### Fixed

- Session tags now persist under canonical session ids, keeping same-title forks isolated and
  preserving explicit empty assignments instead of falling back to legacy aliases.
- Sends use the model, effort, and speed currently staged in the composer rail even when an older
  session-index refresh arrives before submission.
- In-progress queued-message edits, including their selection, survive live queue refreshes instead
  of reverting to the last server snapshot.

## 1.3.1 — 2026-08-20

### Added

- Structured Codex memory citations are separated from assistant text and shown in a dedicated
  source popover without exposing the raw protocol trailer in conversations or work statistics.
- The sidebar list hub now browses shortcuts, notes, and todos across sessions, remembers its last
  collection, and supports the same editing and ordering controls as the composer rail.
- Per-session model, reasoning, and speed selections can be staged directly in the composer rail
  and remain stable while provider catalogs and session projections refresh.

### Changed

- Work statistics now use Attend-owned live activity instead of rebuilding prompt attribution from
  external transcript history, removing the dedicated work-prompt index worker.
- Cursor history recovery prefers the more complete Attend capture when a native transcript is
  replaced by an incomplete continuation, while preserving spacing across streamed text blocks.

### Fixed

- Codex steering and interruption recover stale provider turn ids from authoritative thread state,
  and a quiet turn can resume when the provider emits new model activity after a background task.
- Comments typed during an active response queue reliably, stopped turns remain resendable through
  delayed lifecycle events, and growing fork transcripts are resolved from one consistent read.
- Streaming session refreshes preserve focused rail inputs, staged run configuration, middle-panel
  cards, and todo controls instead of replacing the live DOM with stale projections.

## 1.3.0 — 2026-08-06

### Added

- Cursor CLI, Antigravity CLI (`agy`), and GitHub Copilot CLI are now first-class in-browser
  vendors alongside Claude Code and Codex/ChatGPT (five total): start, continue, and branch
  sessions, each with its own transcript source, live model catalog, and same-vendor analyzer
  daemon. The server publishes one capability contract for all five vendors and the browser
  consumes it instead of hard-coding provider-name checks.
- Full-text search across every session, backed by a durable FTS index built off the request path.
- On-demand, paged transcript history: `session_index` and `comment_index` carry only authoritative
  metadata plus an opaque history version, so the browser fetches transcript bodies only when a chat
  or comment panel is opened, pages older messages on demand, and jumps to a pinned message by a
  stable history id rather than a page-relative position.
- Restart-persistent session indexing: each vendor's scan cache persists parse results across
  restarts, and a genuinely uncached first scan is deferred behind the rendered shell and delivered
  as an authoritative `session_index` revision on the unified live SSE bus.
- A `/debug/performance` page reporting route latency, event-loop lag, session-index progress and
  scan bytes, worker errors, and background model-refresh state — without reading transcript bodies
  on the request path.

### Changed

- Bounded main thread: session discovery, paged history, analyzer context construction, search
  backfills, alignment scoring, and work-prompt indexing run in dedicated background workers, so a
  single large parse or analysis can no longer stall the request the user is waiting on.
- Analyzer daemons are vendor-routed: Cursor, Antigravity, and Copilot share the process analyzer
  after their native JSONL is normalized; Cursor daemons run in native read-only `ask` mode with
  sandboxing enabled. Cursor/Antigravity/Copilot branches are transcript-seeded new sessions because
  those headless CLIs expose no native fork; Claude and Codex keep native forks.

### Fixed

- `/clear` — and any provider that rolls a live session's id mid-turn — no longer splits one chat
  into two tabs that both show "generating". The shared session runtime re-keys the live run to the
  new id instead of indexing it under both; the browser tab follows the rolled id via its stable
  client identity rather than stranding on the pre-clear id and spawning a second card; and the
  analyzer daemon re-attaches to the new id so the continued session keeps receiving verdicts.
- The last-resort daemon-transcript filter now matches the current analyzer prompts (its markers had
  drifted out of sync), and is covered by a test so it cannot silently go stale again.

## 1.2.3 — 2026-07-24

### Fixed

- Stabilize browser layout tests around asynchronous session-card read-state projection.

## 1.2.2 — 2026-07-24

### Documentation

- Clarify provider-limit recovery, live provider-model discovery, and message-level comment, pin,
  and reference workflows in the README.

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
