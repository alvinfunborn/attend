# attend

A local attention-management console for AI coding tasks. Current integrations: Claude Code, Codex/ChatGPT, and Cursor CLI.

[中文 README](README.zh-CN.md)

Attend began with a simple need: **add tags to tasks**.

When AI coding work spreads across many sessions, finding a session by project or recency is not enough. Tags provide the first useful layer: group related tasks, build focused views, and return to the right work without reconstructing the whole workspace. From that starting point, Attend grew into a set of attention-management tools for answering the next questions: Which task is still running? Which one replied? What needs a decision? What can wait? Which side discussion deserves to become its own task?

Attend keeps those signals next to the actual conversations, so organizing work and advancing it happen in the same local interface. The server binds to `127.0.0.1` by default.

## From tags to attention management

- **Organize with tags.** Add tags to sessions, filter by any or all selected tags, and save reusable **Focus** views for recurring contexts.
- **See what needs attention.** Switch between **All**, **Active**, and **Unread**; track `generating`, `new reply`, `in progress`, and `read`; archive seen work in the current view.
- **Keep enough context to re-enter.** Search session metadata and transcripts, edit titles, pin important messages, and use `brief`, `state`, `priority`, `etaMin`, and `reason` as compact handoff signals.
- **Separate work without losing its origin.** Fork sessions into related branches, view them as a fork tree, or start a comment thread on one response and promote that discussion into a regular session when it becomes a task of its own.
- **Advance work where it is tracked.** Continue conversations, attach files, stop turns, and queue or edit follow-up messages without leaving the attention view.
- **Review the shape of the workload.** Inspect local statistics for sessions, prompts, conversation volume, generation overlap, and session breadth.

## Features

The detailed feature list follows the controls and tooltips in the current UI.

- Browse sessions under one or more project directories. Search session metadata and transcript content.
- Switch between **All**, **Active**, **Unread**, and reusable **Focus** views.
- Add session tags, filter by any or all selected tags, and narrow the list by priority.
- Track attention with four statuses: `generating`, `new reply`, `in progress`, and `read`. Statuses can be changed from the session list, and seen sessions in the current view can be archived together.
- Start or continue sessions from an available vendor in the browser. Choose the vendor and its supported run options for the next action.
- Attach or paste images and files, stop a running turn, and queue, edit, send, or delete follow-up messages.
- Edit a session title and adjust its state, priority, or estimated re-entry time.
- Comment on an AI response, including one that is still generating. Comments continue in a hidden side session, accept queued replies, and can be promoted into regular sessions. The first comment pins the response, and later replies can be opened from the response or its pin.
- Pin messages, collapse completed turns, refresh a chat from its transcript, preview attachments and diagrams, and reveal referenced local paths.
- Fork a session using the current draft as the opening turn. Forks may keep the same provider or switch providers, and related sessions can be viewed as a fork tree.
- View local work statistics for recent sessions, prompts, conversation volume, and session breadth.
- Use light or dark theme. UI preferences and Attend-owned session metadata are stored locally.

Some sessions also show analyzer-provided fields:

- `brief`: a short description of the current thread.
- `state`: the suggested next handoff, such as `needs_input`, `needs_review`, or `done`.
- `priority`: relative priority within the current vault.
- `etaMin`: estimated minutes needed to re-enter the thread.
- `reason`: a short explanation for the current signals.

These fields are editable where the UI provides a control. Older or externally created sessions may use local heuristics instead of an analyzer.

## Quick Start

Requirements:

- Node.js `>= 20`
- At least one supported CLI installed: Claude Code, Codex/ChatGPT, or Cursor CLI (`cursor-agent`)

Scan the current directory:

```bash
npx attend
```

Scan specific project roots or use another port:

```bash
npx attend ~/projects ~/work --port 5050
```

Run directly from GitHub:

```bash
npx github:alvinfunborn/attend
```

Attend opens `http://localhost:5050` unless `--no-open` is set.

## CLI

```text
attend [dirs...] [options]
attend new <name>

  dirs                         Project roots used to scope the session list
  new <name>                   Create projects/<name>/brief.md
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
