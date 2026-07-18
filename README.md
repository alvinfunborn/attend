# attend

A local attention-management console for AI coding tasks. Current integrations: Claude Code, Codex/ChatGPT, and Cursor CLI.

[中文 README](README.zh-CN.md)

Attend began with a simple need: **add tags to tasks**.

When AI coding work spreads across many sessions, finding a session by project or recency is not enough. Tags provide the first useful layer: group related tasks, build focused views, and return to the right work without reconstructing the whole workspace. From that starting point, Attend grew into a set of attention-management tools for answering the next questions: Which task is still running? Which one replied? What needs a decision? What can wait? Which side discussion deserves to become its own task?

Attend keeps those signals next to the actual conversations, so organizing work and advancing it happen in the same local interface. The server binds to `127.0.0.1` by default.

## From tags to attention management

- **Organize with tags.** Add tags to sessions, filter by any or all selected tags, and save reusable **Focus** views for recurring contexts.
- **See what needs attention.** Switch between **All**, **Active**, and **Unread**; track `generating`, `new reply`, `in progress`, and `read`; archive seen work in the current view.
- **Keep enough context to re-enter.** Search session metadata and transcripts, keep shortcuts, notes, todos, and Goals beside the composer, explicitly reference pinned context, and use analyzer signals as a compact handoff.
- **Separate work without losing its origin.** Fork sessions into related branches, view them as a fork tree, or start a comment thread on one response and promote that discussion into a regular session when it becomes a task of its own.
- **Advance work where it is tracked.** Continue conversations, answer provider questions, attach files, stop turns, and queue, edit, or fork follow-up messages without leaving the attention view.
- **Review the shape of the workload.** Inspect local statistics for sessions, prompts, conversation volume, generation overlap, and session breadth.

## Features

The detailed feature list follows the controls and tooltips in the current UI.

- Browse sessions under one or more project directories. Search session metadata and transcript content with plain terms, phrases, exclusions, `OR`, or bounded `%regex%` terms.
- Switch between **All**, **Active**, **Unread**, and reusable **Focus** views, with an optional filter-driven middle chats panel on desktop.
- Add, pin, hide, and reorder session tags; filter by any or all selected tags and narrow the list by priority.
- Track attention with four statuses: `generating`, `new reply`, `in progress`, and `read`. Statuses can be changed from the session list, and seen sessions in the current view can be archived together.
- Start or continue sessions from an available vendor in the browser. Choose its discovered model, effort, and speed for the next action; Attend remembers exact per-session selections when the provider exposes them.
- Attach or paste images and files, answer interactive provider questions and forms, stop a running turn, and queue, edit, send, fork, or delete follow-up messages. Queues are server-owned and survive tabs, browser reloads, and Attend restarts.
- Edit a session title and adjust its state, priority, or estimated re-entry time.
- Keep machine-wide shortcuts and session-scoped notes and todos in the composer rail. Where the provider supports it, arm the next message as a Goal; analyzer-drafted next steps can fill the composer but never send automatically.
- Comment on an AI response, including one that is still generating. Comments continue in an isolated side session, accept queued replies, and can be promoted into regular sessions with the parent configuration and working context. The first comment pins the response, and later replies can be opened from the response or its pin.
- Pin messages and type `@` in the main composer to reference a pin. If that pin owns a comment thread, Attend includes the full text-only thread; tool blocks are deliberately excluded. Queued turns snapshot their referenced context when they are enqueued.
- Collapse completed turns, refresh a chat from its transcript, preview attachments and diagrams, and reveal referenced local paths.
- Fork a session using the current draft or a queued turn as the opening message. Forks may keep the same provider or switch providers; the branch keeps its selected run configuration and copies the relevant notes and todos. Related sessions can be viewed as a fork tree.
- View local work statistics for recent sessions, prompts, conversation volume, and session breadth.
- Use light or dark theme. UI preferences and Attend-owned session metadata are stored locally.

Some sessions also show analyzer-provided fields:

- `brief`: a short description of the current thread.
- `state`: the suggested next handoff, such as `needs_input`, `needs_review`, or `done`.
- `priority`: relative priority within the current vault.
- `etaMin`: estimated minutes needed to re-enter the thread.
- `reason`: a short explanation for the current signals.
- `nextStep`: an optional ready-to-edit draft for an obvious mechanical next action.

These fields are editable where the UI provides a control. `nextStep` only fills the composer and
never sends on its own. Older or externally created sessions may use local heuristics instead of an
analyzer.

### Composer context

Shortcuts are shared across the Attend installation; notes and todos belong to a session. Comment
threads stay out of the parent session by default. To carry one into a later main-session turn, pin
its anchor and choose that pin from the composer's `@` picker. The server resolves the reference at
send time (or snapshots it when queued), sends it as hidden provider context, and keeps that context
out of the visible transcript.

## Quick Start

Requirements:

- Node.js `>= 22.13`
- At least one supported CLI installed: Claude Code, Codex/ChatGPT, or Cursor CLI (`cursor-agent`)

Attend detects those system CLIs at startup and only enables vendors it can actually run. Missing
or unreadable CLIs remain visible as unavailable with an installation hint. Claude Code must be
`2.1.0` or newer; an older version is disabled with an explicit update message.

### Claude authentication

Attend does not store a separate Claude login. Claude Agent SDK subprocesses inherit the
authentication environment of the Attend process.

For occasional local use, sign in through Claude Code before starting Attend:

```bash
claude auth login
claude auth status
attend "$PWD"
```

That is the complete setup for normal local use. Attend resolves the system `claude` command and
binds every Agent SDK call to that exact executable, so terminal and Attend share one version,
configuration, and login. The SDK-bundled Claude Code is never used as a default or fallback. Set
`ATTEND_CLAUDE_BIN` only when a managed installation explicitly needs a different executable.

`claude setup-token` is an optional advanced path for unattended servers and automation. In that
case, inject its output as `CLAUDE_CODE_OAUTH_TOKEN` through the service's secret manager and
restart Attend. Do not pass the token as a command-line option, commit it, or put it in a project
`.env` file.

Show sessions for the current project directory without installing Attend:

```bash
npx --package=@sinphife/attend attend "$PWD"
```

Limit the session list to specific project roots, or use another port:

```bash
npx --package=@sinphife/attend attend ~/projects ~/work --port 5050
```

Multiple directories are a union filter for one Attend instance; they do not create separate vaults. At startup Attend resolves symlinks, removes duplicates and descendants already covered by a parent, and derives a stable internal `scopeId` for the physical root set. To manage workspaces independently, run one instance per workspace on different ports:

```bash
attend ~/projects/product-a --port 5050
attend ~/projects/product-b --port 5051
```

The instances share Attend-owned state in `~/.attend/attend.sqlite3`, while each instance only displays sessions inside its command-line scope. The database uses WAL mode and indexed event tables; smaller structured state such as titles, statuses, pins, queues, tags, and analyzer results uses transactional document rows. A multi-directory launch is only an aggregate view: it merges directory-scoped tags, Focus views, and tag-display preferences (pinned/hidden), and writes changes directly to the individual directory scopes instead of owning a separate combined scope. Legacy global JSON and older `<workspace>/.attend/` state are imported idempotently and retained as migration backups. Original transcripts remain in each vendor CLI's own storage.

Retention is data-specific: activity and reconstructable telemetry expire, while queued work and explicit user preferences do not. See [Storage and retention](docs/storage-retention.md).

Or install the `attend` command globally:

```bash
npm install --global @sinphife/attend
attend
```

Run directly from GitHub:

```bash
npx github:alvinfunborn/attend
```

Attend opens `http://localhost:5050` unless `--no-open` is set.

## CLI

```text
attend [dirs...] [options]

  dirs                         Project roots used to scope the session list
  -p, --port <n>               Port (default: 5050)
      --host <addr>            Bind address (default: 127.0.0.1)
  -c, --config <path>          Path to attend.config.json
      --no-open                Do not open the browser
      --e2ee-passphrase <text> Encrypt browser/server API payloads
  -h, --help                   Help
```

## Development

```bash
git clone https://github.com/alvinfunborn/attend
cd attend
npm install
npm run dev
```

Checks:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## License

[MIT](LICENSE)
