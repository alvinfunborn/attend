import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { ScheduledItem } from "../src/core/schedules.js";
import type { ConsoleView, SessionView } from "../src/ui/console.js";
import { renderConsole } from "../src/ui/console.js";

const PORT = Number(process.env.ATTEND_DEMO_PORT || 5099);
const NOW = Date.now();
const PROJECTS = [
  "attend",
  "desktop-shell",
  "mobile-client",
  "api-gateway",
  "design-system",
  "windows-launcher",
  "release-ops",
  "search-index",
  "billing-console",
  "docs-site",
  "agent-runtime",
  "observability",
] as const;
const TAGS = [
  "release",
  "scheduler",
  "backend",
  "frontend",
  "mobile",
  "design",
  "windows",
  "reliability",
  "docs",
  "performance",
  "research",
  "customer",
  "security",
  "tests",
] as const;
const VENDORS = ["codex", "claude", "cursor"] as const;
const STATES = [
  "continue_ready",
  "needs_decision",
  "needs_input",
  "blocked",
  "needs_review",
  "followup_suggested",
  "done",
] as const;
type DemoSession = SessionView & {
  sessionId: string;
  cwd: string;
};
const TITLES = [
  "Ship scheduled messages without duplicate dispatch",
  "Review mobile sidebar tag overflow",
  "Investigate Windows vendor detection",
  "Polish the README product story",
  "Reduce transcript search latency",
  "Audit remote tunnel encryption boundaries",
  "Recover queued turns after restart",
  "Refine comment thread promotion",
  "Profile large workspace rendering",
  "Design the release preflight checklist",
  "Improve attachment error recovery",
  "Validate provider model discovery",
  "Trace an intermittent app-server disconnect",
  "Make fork lineage easier to scan",
  "Clarify first-run setup on Windows",
  "Review keyboard navigation in composers",
] as const;

function tagsFor(index: number): string[] {
  return [
    TAGS[index % TAGS.length],
    TAGS[(index * 3 + 2) % TAGS.length],
    ...(index % 5 === 0 ? [TAGS[(index * 7 + 5) % TAGS.length]] : []),
  ].filter((tag, position, all) => all.indexOf(tag) === position);
}

function makeSession(index: number): DemoSession {
  const vendor = VENDORS[index % VENDORS.length];
  const project = PROJECTS[index % PROJECTS.length];
  const title = TITLES[index % TITLES.length];
  const lastTs = NOW - index * 7 * 60_000 - (index % 9) * 13_000;
  const unread = index % 11 === 1 || index % 17 === 2;
  const seen = !unread && index % 4 !== 3;
  return {
    vendor,
    sessionId: `demo-${String(index + 1).padStart(3, "0")}`,
    title: `${title}${index >= TITLES.length ? ` · ${Math.floor(index / TITLES.length) + 1}` : ""}`,
    lastPrompt:
      index % 3 === 0
        ? "Run the full regression and call out the remaining risk."
        : index % 3 === 1
          ? "Compare the behavior across desktop and mobile."
          : "Keep the change local and preserve future extension points.",
    cwd: `/demo-vault/projects/${project}`,
    project,
    file: `/demo-vault/transcripts/${vendor}/demo-${String(index + 1).padStart(3, "0")}.jsonl`,
    ageDays: Math.floor((NOW - lastTs) / 86_400_000),
    lastTs,
    userPromptTs: Array.from({ length: 8 }, (_, n) => lastTs - n * 18 * 60_000),
    prompts: 14 + ((index * 7) % 43),
    pattern: index % 19 === 7 ? "avoidance" : "unknown",
    patternReason: index % 19 === 7 ? "reviewed several times without a follow-up" : null,
    state: STATES[index % STATES.length],
    score: Math.max(1, 9.7 - (index % 13) * 0.55),
    reason:
      index % 4 === 0
        ? "A concrete implementation is ready for review."
        : index % 4 === 1
          ? "The agent needs one product decision."
          : index % 4 === 2
            ? "A failing edge case has a narrow reproduction."
            : "The next step is small and well scoped.",
    etaMin: 4 + ((index * 3) % 28),
    brief: title,
    tags: tagsFor(index),
    unread,
    seen,
    generating: index === 0 || index === 9,
    generatingStartedAt: index === 0 ? NOW - 92_000 : index === 9 ? NOW - 38_000 : null,
    model:
      vendor === "codex" ? "gpt-5.3-codex" : vendor === "claude" ? "claude-opus-4-6" : "composer-2",
    effort: vendor === "cursor" ? "high" : index % 2 ? "high" : "medium",
    speed: index % 3 === 0 ? "fast" : "standard",
  };
}

const primary = makeSession(0);
const sessions = [primary, ...Array.from({ length: 239 }, (_, index) => makeSession(index + 1))];
primary.customTitle = "Scheduled messages — final verification";
primary.tags = ["release", "scheduler", "backend", "tests"];
primary.score = 9.8;
primary.state = "needs_review";
primary.reason = "The durable dispatcher and all UI entry points are ready for final review.";
primary.etaMin = 6;
primary.unread = false;
primary.seen = true;

const scheduledSession: ScheduledItem = {
  id: "schedule-demo-session",
  jobId: "job-demo-session",
  kind: "session",
  runAt: NOW + 3 * 60 * 60_000,
  timezone: "Asia/Shanghai",
  status: "scheduled",
  payload: {
    kind: "session",
    clientSessionId: "scheduled-demo-card",
    cwd: "/demo-vault/projects/docs-site",
    vendor: "claude",
    text: "Draft tomorrow's release announcement",
    model: "claude-opus-4-6",
    effort: "high",
    tags: ["release", "docs"],
  },
  createdAt: NOW - 4 * 60_000,
  updatedAt: NOW - 4 * 60_000,
};
const scheduledMessage: ScheduledItem = {
  id: "schedule-demo-message",
  jobId: "job-demo-message",
  kind: "message",
  runAt: NOW + 47 * 60_000,
  timezone: "Asia/Shanghai",
  status: "scheduled",
  payload: {
    kind: "message",
    sessionId: primary.sessionId,
    cwd: primary.cwd,
    vendor: primary.vendor,
    text: "Publish the release notes after the final CI window closes",
  },
  createdAt: NOW - 8 * 60_000,
  updatedAt: NOW - 8 * 60_000,
};
const schedules = [scheduledSession, scheduledMessage];

const view: ConsoleView = {
  sessions,
  schedules,
  knownDirs: PROJECTS.map((project) => `/demo-vault/projects/${project}`),
  scopeRoots: ["/demo-vault/projects"],
  defaultNewDir: "/demo-vault/projects/attend",
  pageTitle: "Attend — demo vault",
  changelogMarkdown: "",
  sessions1h: 38,
  prompts1h: 286,
  chars1h: 148_700,
  vendors: [
    { vendor: "claude", available: true, chat: true, version: "2.1.12" },
    { vendor: "codex", available: true, chat: true, version: "0.91.0" },
    { vendor: "cursor", available: true, chat: true, version: "2026.07" },
  ],
  claudeModels: [
    { value: "claude-opus-4-6", label: "Opus 4.6" },
    { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  ],
  codexModels: [
    { value: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
    { value: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
  ],
  cursorModels: [],
  tags: [...TAGS],
  vaultState: {
    theme: "light",
    pinnedTags: ["release", "scheduler", "backend", "mobile"],
    hiddenTags: ["research"],
    focusViews: [
      { id: "focus-all", name: "Product", tags: [] },
      { id: "focus-release", name: "Release", tags: ["release"] },
      { id: "focus-mobile", name: "Mobile", tags: ["mobile", "design"] },
    ],
    sessionNotes: {
      [primary.sessionId]: [
        {
          id: "note-demo",
          text: "Keep dispatch exactly-once across restarts.",
          createdAt: NOW - 60_000,
          updatedAt: NOW - 60_000,
        },
      ],
    },
    sessionTodos: {
      [primary.sessionId]: [
        {
          id: "todo-demo",
          text: "Review the README screenshot",
          createdAt: NOW - 60_000,
          updatedAt: NOW - 60_000,
          completed: false,
        },
      ],
    },
  },
};

function messagesFor(sessionId: string) {
  if (sessionId === primary.sessionId) {
    return [
      {
        role: "user",
        text: "Implement one-time scheduled messages and sessions. Keep the storage model ready for recurring tasks.",
        tools: [],
      },
      {
        role: "assistant",
        text: "I mapped the existing queue, session-card, and comment-thread paths. The durable design uses separate job and run rows, so recurrence can add occurrences without changing first-version semantics.",
        tools: [],
      },
      {
        role: "user",
        text: "No scheduled panel. A scheduled new session should create a card immediately, and scheduled chat messages belong in the queued area.",
        tools: [],
      },
      {
        role: "assistant",
        text: "Implemented the shared clock interaction across all three composers and projected each scheduled action into the existing surface.",
        tools: [
          {
            id: "tool-demo-1",
            name: "exec_command",
            input: { cmd: "npm run lint && npm run typecheck && npm test" },
            result: "52 test files passed\n631 tests passed",
          },
        ],
      },
      {
        role: "user",
        text: "Run the browser path too, especially the new-session card and comment queue.",
        tools: [],
      },
      {
        role: "assistant",
        text: "Browser coverage passes. The scheduled session appears immediately, messages stay in the chat queue, comments stay in the comment queue, and all three clock buttons reuse the same popover.",
        tools: [],
      },
    ];
  }
  const session = sessions.find((candidate) => candidate.sessionId === sessionId) ?? primary;
  return Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    text:
      index % 2 === 0
        ? `${session.title}: verify scenario ${Math.floor(index / 2) + 1} and preserve the current behavior.`
        : `Scenario ${Math.floor(index / 2) + 1} is covered. The result is deterministic and the remaining tradeoff is documented.`,
    tools: [],
  }));
}

const app = new Hono();
app.get("/", (c) => c.html(renderConsole(view)));
app.get("/chat/messages", (c) => c.json(messagesFor(c.req.query("session") || "")));
app.get("/chat/queue", (c) =>
  c.json({
    ok: true,
    parked: false,
    items:
      c.req.query("session") === primary.sessionId
        ? [
            {
              id: "queue-demo-1",
              sessionId: primary.sessionId,
              cwd: primary.cwd,
              vendor: primary.vendor,
              text: "Add dispatch latency and retry counters to the release dashboard",
              createdAt: NOW - 2 * 60_000,
            },
          ]
        : [],
  }),
);
app.get("/chat/live-stream", () => {
  const encoder = new TextEncoder();
  let keepalive: NodeJS.Timeout;
  const stream = new ReadableStream({
    start(controller) {
      const snapshot = {
        active: [primary.sessionId],
        startedAt: { [primary.sessionId]: NOW - 92_000 },
        lastAssistantAt: { [primary.sessionId]: NOW - 14_000 },
        queues: { [primary.sessionId]: { count: 1, parked: false } },
        schedules,
        stats: { sessions1h: 38, prompts1h: 286, chars1h: 148_700 },
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
      keepalive = setInterval(() => controller.enqueue(encoder.encode(": keepalive\n\n")), 15_000);
    },
    cancel() {
      clearInterval(keepalive);
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
  });
});
app.get("/models/claude", (c) => c.json({ ok: true, models: view.claudeModels }));
app.get("/models/codex", (c) => c.json({ ok: true, models: view.codexModels }));
app.get("/models/cursor", (c) => c.json({ ok: true, models: view.cursorModels }));
app.all("*", (c) => c.json({ ok: true, schedules }));

const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: PORT }, () => {
  process.stdout.write(`Attend README demo vault: http://127.0.0.1:${PORT}\n`);
  process.stdout.write("240 sessions · 12 projects · about 4,800 generated conversation turns\n");
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
