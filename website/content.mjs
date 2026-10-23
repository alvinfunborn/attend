export const content = {
  en: {
    lang: "en",
    title: "Attend — A local command center for AI coding sessions",
    description:
      "Organize parallel AI coding sessions across six CLIs. Inspect handoff analysis, fork trees, comments, queues, and Work patterns in the actual Attend interface.",
    nav: ["Live demo", "Sessions & analysis", "Work patterns", "Get started"],
    eyebrow: "YOUR WORK, WITH A PLACE TO RETURN TO",
    heading: "Find the task.<br>Keep your place.",
    intro:
      "A local command center for parallel AI coding work. Find sessions across projects and CLIs, see what needs your attention, follow the branches of a discussion, and understand how your work is moving.",
    start: "Start locally",
    github: "View on GitHub",
    meta: "Open source · Local state · Your existing CLIs",
    heroNote:
      "Current Attend interface. Explore sessions, analysis, relationships, and work patterns.",
    tools: "ONE LOCAL CONSOLE. SIX CODING CLIs.",
    demoEyebrow: "01 / THE REAL WORKSPACE",
    demoTitle: "Your sessions, with their full working context.",
    demoBody:
      "This demo runs Attend’s own interface and styles with synthetic data. Explore the session list, tags and Focus views; inspect analysis, comments, fork relationships, queues, and Work patterns. The same controls live in the local app.",
    demoNote: "Actual Attend UI · Synthetic data · No CLI execution or model calls",
    filter: "Filter by tag",
    search: "Search sample tasks",
    any: "Any tag",
    all: "All tags",
    reset: "Reset demo",
    count: "tasks in view",
    empty: "No matching tasks. Try another tag or search.",
    tags: ["release", "backend", "research", "mobile"],
    taskTitles: [
      "Prepare the next release",
      "Check queue recovery after restart",
      "Compare two implementation paths",
      "Investigate keyboard overlap",
      "Review the release notes",
      "Validate the session index",
    ],
    labels: [
      "Waiting for device test",
      "Ready to review",
      "Decision needed",
      "Reproduce on mobile",
      "Draft ready",
      "Waiting for benchmark",
    ],
    project: [
      "desktop-app",
      "agent-runtime",
      "agent-runtime",
      "mobile-app",
      "docs-site",
      "desktop-app",
    ],
    labelHint: "Click a task label to rename it and choose a color.",
    labelEyebrow: "02 / NAME THE HANDOFF",
    labelTitle: "“In progress” is rarely the whole story.",
    labelBody:
      "Waiting for a device. Choosing a direction. Ready for one final check. Put your own words and color on the current state, so returning to a task starts with recognition.",
    labelPoints: [
      "Use preset states, or write a custom label with your own color.",
      "A manual label takes precedence over delayed analyzer results.",
      "Labels describe this turn. Starting the next turn clears that handoff state; tags stay.",
    ],
    labelSample: "Waiting for device test",
    labelCaption: "Your words. Your color. The next thing you need to know.",
    labelEdit: "Edit sample label",
    labelInput: "Label text",
    colorInput: "Label color",
    save: "Apply label",
    cancel: "Cancel",
    focusTitle: "Make a view you can return to.",
    focusBody:
      "Combine tags with any/all matching. Keep multiple Focus views for different threads of work. Pin, hide, and reorder tags as your attention changes. Active and Unread keep their own filters.",
    focusExample: "Focus: release + backend",
    screenEyebrow: "THE ACTUAL CONSOLE",
    screenTitle: "The conversation stays beside the work.",
    screenBody:
      "Scan task cards, open a conversation, and continue in the same browser tab. Titles, first and latest prompts, attention signals, tags, and current state help you choose what to open.",
    screenCaption:
      "Current Attend source UI, with 12 synthetic sessions across six providers. Sample activity and analysis, not real user data or performance claims.",
    screenAlt:
      "Attend console showing a tag sidebar, multi-project session cards and a conversation with queued work",
    workflowEyebrow: "05 / KEEP THE THREAD",
    workflowTitle: "A place for the things that happen between prompts.",
    workflows: [
      [
        "Triage without losing your place",
        "Read is not the same as handled.",
        "An unopened reply and a reply you have looked at carry different attention signals. Reading a conversation does not silently mark its follow-up handled. Reply, dismiss, or flag it again when needed.",
        ["Generating", "New reply", "Seen · follow-up pending", "Handled"],
      ],
      [
        "Let a side question become its own work",
        "Follow the tangent. Keep the parent.",
        "Comment on an answer or a selected passage, including during generation. Continue the discussion in its drawer, then promote it to a task. Fork with the same provider or seed a branch in another; inspect the lineage later.",
        ["Selected passage", "Comment thread", "Promote to task", "Fork lineage"],
      ],
      [
        "Capture the next instruction now",
        "Your thought does not need to wait.",
        "Queue follow-ups while a turn runs. Edit or remove them, send a selected instruction now, or turn it into a branch. Stopping a turn holds the remaining queue. Use a one-time schedule for a message, new session, fork, or comment. The local service must be running to execute scheduled work.",
        ["Running turn", "Editable queue", "One-time schedule", "Continue later"],
      ],
      [
        "Return with the right context",
        "Keep useful context within reach.",
        "Save notes and todos beside the composer. Pin a message or selected passage, reference it with @, and reuse shortcuts or model presets. Analyzer suggestions can draft a likely next message or a specific question to verify; you choose what to send.",
        ["Notes & todos", "Pins & @ references", "Reusable shortcuts", "Draft suggestions"],
      ],
    ],
    referenceTitle: "Small details, made for daily use.",
    referenceBody:
      "The organizing surface is only the beginning. Open a group to see how the rest supports the same workflow.",
    features: [
      [
        "Find & organize",
        "Search session metadata and transcripts with terms, phrases, exclusions, OR, and bounded regex. Use custom tags alongside provider/project tags, tag counts, any/all matching, priority filtering, multiple Focus views, and All / Active / Unread. Pin, hide, reorder, bulk-delete tags or remove session bindings. Edit titles and jump to related tagged chats.",
      ],
      [
        "Read & continue",
        "Start and resume supported CLIs in the browser. Stream responses, stop a turn, attach or paste files and images, and answer supported provider questions. Collapse completed turns, load older history on demand, jump to pinned passages, preview diagrams and attachments, and reveal local file paths.",
      ],
      [
        "Decide & follow up",
        "See brief summaries, priority with a reason, and an estimated time to re-enter a task. Choose preset or custom colored state labels. Distinguish generation, new replies, seen follow-ups, and handled work. Background analysis offers next-message completion and a separate probe for a concrete claim or evidence gap. Suggestions remain drafts.",
      ],
      [
        "Queue & schedule",
        "Durable queues preserve follow-up instructions beyond a browser reload. Edit or remove queued work, choose an instruction to send now, or fork it. Stopping a turn preserves and holds the remaining queue. One-time schedules cover messages, new sessions, forks, and comments. Scheduled session/fork cards appear in the session list; manage queued and scheduled messages in the conversation. This is not a recurring scheduler.",
      ],
      [
        "Branch & carry context",
        "Comment on messages or text selections, queue comment replies, and promote a discussion into its own task. Fork from a draft or queued turn, keep or switch providers, and inspect the fork tree. Pin passages and reference them with @; queued references keep a snapshot of the selected context. Native fork support differs by CLI.",
      ],
      [
        "Make the console yours",
        "Choose system, light, dark, or custom themes. Edit theme JSON with live preview, import/export palettes, and search available colors. Customize panel layout and responsive settings. Save reusable provider/model/effort presets. Directory scopes retain their preferences across restarts and port changes. Review recent local work statistics.",
      ],
    ],
    compatibilityEyebrow: "06 / KEEP YOUR TOOLS",
    compatibilityTitle: "One way to organize. Honest differences underneath.",
    compatibilityBody:
      "All six integrations support browsing, search, in-browser conversations, and analysis. Execution uses the installed CLI and its account. Some capabilities depend on the provider and version.",
    columns: ["CLI", "Fork", "Steer a running turn", "Interactive questions", "Goals"],
    native: "Native",
    seeded: "Transcript-seeded",
    nextTurn: "Reply next turn",
    unsupported: "—",
    compatibilityNote:
      "Transcript-seeded branches start a new session with visible parent history; they are not native provider forks. Cursor, Antigravity, Copilot, and OpenCode attachments are passed as local file paths. Attachment types vary by provider; Codex does not accept PDF attachments. “Goals” refers to Attend’s supported goal mode, not a guarantee of autonomous completion.",
    localTitle: "Local state. Explicit model calls.",
    localParagraphs: [
      "Attend binds to 127.0.0.1 by default. Its tags, labels, notes, queues, and preferences live in your local Attend database; original transcripts remain managed by their CLIs. Organizing your work does not require an Attend cloud account.",
      "Running coding sessions uses the selected provider. Background analysis can also make model calls and consume your provider allowance or incur charges. Economical mode may fall back to the work-session model; choose Off in Settings to stop new background AI analysis. Local storage does not mean all inference is offline.",
    ],
    installEyebrow: "07 / START WHERE YOU WORK",
    installTitle: "One command. Your own workspace.",
    installBody:
      "Requires Node.js 22.13+ and a supported CLI installed and authenticated. Attend detects your available CLIs and opens the local console.",
    scoped: "Open one project",
    global: "Install the command",
    copy: "Copy command",
    copied: "Copied",
    copyFail: "Select and copy the command below.",
    installNotes: [
      "Pass several directories to see their combined sessions. Run separate instances on different ports for independent workspace views.",
      "On Windows, Codex needs the standalone terminal CLI. Its desktop app alias alone is not sufficient.",
    ],
    docs: "Read setup & troubleshooting",
    changelog: "See what changed",
    faq: [
      [
        "Can I use Attend here in the browser?",
        "The embedded demo uses the real Attend interface with a synthetic workspace and an in-memory backend. You can explore organization, analysis, relationships and statistics. Sending prompts and starting CLI work are disabled. The full app runs locally with your installed CLIs and session history.",
      ],
      [
        "Will all my old conversations get AI analysis?",
        "Historical sessions can be browsed and searched. Paired analyzer sessions are created for supported sessions started or forked in Attend; older external sessions may use local heuristics instead.",
      ],
      [
        "Do custom labels stay forever?",
        "Tags are persistent organization. A custom state label describes the current handoff and overrides delayed analysis for that turn. Beginning a new conversation turn clears turn-specific state and color so they do not describe the new work incorrectly.",
      ],
      [
        "What happens if I close the browser?",
        "Attend-owned queues and scheduled jobs are durable. Closing a tab does not itself stop the local service. Scheduled work needs the service to be running; stopping Attend stops active work.",
      ],
    ],
    closing: "Leave yourself a way back in.",
    closingBody: "Start with one tag and a label that means something to you.",
    support: "Support Attend on Ko-fi",
    footer: "Built for many threads of work. MIT licensed.",
    privacy: "No analytics or tracking scripts on this site.",
    tour: [
      ["overview", "Workspace"],
      ["analysis", "Session analysis"],
      ["structure", "Fork tree"],
      ["comments", "Comments"],
      ["queue", "Queued work"],
      ["statistics", "Work patterns"],
    ],
    tourHint:
      "Try a tag, open a task, edit its label, or choose a view above. Edits are temporary. This static workspace uses fixture metadata search; the installed app indexes real transcripts. Sending and CLI execution are disabled.",
    anatomyTitle: "A session card carries more than a title.",
    anatomyBody:
      "Choose what deserves attention before rereading the conversation. Human organization, live execution signals, and model-assisted handoff analysis sit together—but mean different things.",
    anatomy: [
      [
        "Identity & intent",
        "Custom title or evolving brief, project, provider, first prompt, and latest prompt. See what started the conversation and where it has moved.",
      ],
      [
        "Attention & execution",
        "Generating, a new reply, seen but still pending, or handled. Turn duration, last output and quiet time distinguish active work from a turn that needs a closer look.",
      ],
      [
        "Priority & handoff",
        "A priority with its reason; a preset or custom-colored label naming what is needed now. Your manual label wins over delayed analysis for that turn.",
      ],
      [
        "Re-entry cost",
        "ETA estimates how long you need to understand and respond—not how long the model will take to finish. Useful when there is only a small gap between other work.",
      ],
      [
        "Usage & configuration",
        "Cumulative token usage and available input/output/cache detail, prompt count, provider, model, effort, and speed. Unknown provider data stays unknown.",
      ],
      [
        "Context & next actions",
        "Tags, notes, todos, Pins, comment threads, queued messages, schedules and fork relationships are accessible around the same session.",
      ],
    ],
    analysisEyebrow: "02 / UNDERSTAND THE HANDOFF",
    analysisTitle: "When the agent stops, what does it need from you?",
    analysisBody:
      "A finished turn might be ready to continue, waiting for a choice, missing input, blocked elsewhere, or ready for review. Attend separates that handoff state from importance, unread status, and runtime activity.",
    handoff: [
      ["continue_ready", "Continue ready", "A concrete next action can proceed."],
      ["needs_decision", "Needs decision", "Choose a direction or tradeoff."],
      ["needs_input", "Needs input", "Provide a specific missing detail."],
      ["blocked", "Blocked", "An external dependency must change."],
      ["needs_review", "Needs review", "Check the result against your criteria."],
      ["followup_suggested", "Follow-up suggested", "There is a useful optional next step."],
      ["done", "Done", "The current task has a completed handoff."],
    ],
    suggestions: [
      [
        "nextStep / Tab completion",
        "A draft of the most likely next message",
        "Predict the next move using the latest turn and your notes, todos, and shortcuts. Accept, edit, or ignore it.",
      ],
      [
        "probe / scrutiny",
        "A question worth asking before continuing",
        "Question a specific claim, assumption, command, or evidence gap in the latest answer. It is a separate lane, not a generic “are you sure?” prompt.",
      ],
      [
        "Local review signals",
        "Notice when rereading is not advancing the work",
        "Sustained reviews or revisits without another message can surface a descriptive observation and a smaller suggested next step. Checking a generating turn is treated differently. This is not a psychological diagnosis.",
      ],
      [
        "Manual control",
        "Keep the final judgment yours",
        "Set priority, re-entry time and the current label yourself. Hand-written state takes precedence over delayed analysis for that turn; priority and turn-scoped handoff state have different lifetimes.",
      ],
    ],
    analysisNote:
      "Suggestions fill the composer; they never send themselves. Custom labels describe the current turn and reset when the next turn begins. Historical sessions may use local heuristics instead of a paired analyzer.",
    structureEyebrow: "03 / FOLLOW THE STRUCTURE",
    structureTitle: "One task can develop into many conversations.",
    structureBody:
      "Sessions are not just a flat history. Keep the main line running, investigate a passage in a comment, branch to test another direction, and bring selected context back deliberately.",
    relations: [
      [
        "Session → fork",
        "Keep the parent; explore another direction",
        "Fork from a draft, queued message, or past point in the discussion. Keep the provider or seed a new session in another. The fork tree preserves parent/child relationships.",
      ],
      [
        "Message or passage → comment",
        "Ask at the point that raised the question",
        "A comment has its own conversation and attention state. It can investigate or act in the shared workspace without automatically adding its discussion to the main transcript.",
      ],
      [
        "Comment → task",
        "Let a side discussion become real work",
        "Promote a finished side discussion into an ordinary session, retaining its relationship and relevant context instead of copying everything into a new blank chat.",
      ],
      [
        "Pin → next turn",
        "Carry a chosen conclusion back",
        "Pin a message or passage and reference it with @. A queued message keeps a snapshot of that context; a sidebar discussion only joins the main thread when you explicitly include it.",
      ],
    ],
    metricsEyebrow: "04 / SEE THE WORK PATTERN",
    metricsTitle: "Not just how much you used. How the work moved.",
    metricsBody:
      "Open Work patterns from the throughput counters. Inspect session breadth, continuity, collaboration flow and resource pressure over selectable time ranges—from the last hour to 15 days.",
    metrics: [
      [
        "Throughput",
        "Sessions touched, pushes per elapsed hour, completed turns per elapsed hour, and tracked model busy time.",
      ],
      [
        "Live pressure",
        "Generating sessions, queued work, overlap during busy time, peak concurrency, median turn duration and queue wait.",
      ],
      [
        "Collaboration flow",
        "Semantic coverage, straight-through and rework rates, completed handoffs, plus work-intent and steering distributions.",
      ],
      [
        "Hourly breadth",
        "An hourly timeline of Narrow (1–2), Mixed (3–5), and Wide (6+) sessions per prompted hour.",
      ],
      [
        "Breadth comparison",
        "Prompted hours, sessions and completed turns per hour, median turn, switch rate, and resolved/advanced outcomes within 72 hours.",
      ],
      [
        "Coverage & limits",
        "Recorded-history start times, sessions with and without state analysis, sample counts, and the evidence behind a comparison.",
      ],
    ],
    metricsNote:
      "All demo figures are synthetic. Real statistics describe recorded Attend activity; coverage and minimum sample requirements are shown in the product. They are observations, not a productivity score or a claim that more parallelism is better.",
    gallery: [
      [
        "attend-console-demo.jpg",
        "Dark / workspace",
        "The full session workspace",
        "Tags, Focus, first/latest prompts, state and priority, token usage, Pins, related chat tabs, queued and scheduled work.",
      ],
      [
        "attend-label-light.jpg",
        "Light / labels",
        "Your own handoff labels",
        "The native state editor with custom text, presets, color swatches, and an arbitrary color picker.",
      ],
      [
        "attend-comments-midnight.jpg",
        "Midnight / comments",
        "A question beside its source",
        "An anchored comment drawer beside the parent conversation; independent discussion with a promotion path.",
      ],
      [
        "attend-fork-tree-dark.jpg",
        "Dark / fork tree",
        "Follow the branching work",
        "Native parent/child session cards retain their analysis and working context inside the zoomable fork tree.",
      ],
      [
        "attend-work-patterns-light.jpg",
        "Light / Work patterns",
        "Understand how the work moved",
        "Throughput, resource overlap, queue wait, collaboration flow, breadth timeline, mode comparisons, and coverage.",
      ],
      [
        "attend-notes-light.jpg",
        "Light / notes",
        "Keep your own context nearby",
        "Notes and todos beside the composer, alongside Pin context, model controls, suggestions, and scheduled follow-ups.",
      ],
      [
        "attend-settings-midnight.jpg",
        "Midnight / settings",
        "Make the workspace yours",
        "System, Light, Dark and a custom Midnight theme, panel columns, and background-analysis visibility.",
      ],
      [
        "attend-theme-editor-midnight.jpg",
        "Midnight / theme JSON",
        "Customize the real theme system",
        "Edit a custom theme with live preview, searchable color IDs, import/export, and an explicit Save & use action.",
      ],
    ],
  },
};
