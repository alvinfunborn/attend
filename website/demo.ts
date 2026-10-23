import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderConsole, type ConsoleView, type SessionView } from "../src/ui/console.js";
import { buildWorkStats, trailingPromptActivity } from "../src/core/work-stats.js";
import type { WorkEvent } from "../src/core/work-events.js";
import type { RawSession } from "../src/core/types.js";
import { vendorCapabilities } from "../src/core/vendor/capabilities.js";
import type { VendorId } from "../src/core/vendor/detect.js";
import { themeEngine } from "../src/core/themes.js";
import { THEME_COLORS } from "../src/core/theme-colors.js";

// This build imports only pure rendering/statistics code. No config, native CLI,
// session discovery, server startup, or user-owned database is consulted.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const now = Date.now();
const hour = 3_600_000;
const vendors: VendorId[] = ["codex", "claude", "cursor", "antigravity", "copilot", "opencode"];
const scenarios = [
  [
    "Release: durable queue recovery",
    "The dispatcher preserves pending work across restart. Review the ambiguous-dispatch boundary.",
    "needs_review",
    ["release", "backend", "reliability"],
  ],
  [
    "Queue recovery: compare two designs",
    "Choose a lease policy before implementing recovery.",
    "needs_decision",
    ["release", "backend", "research"],
  ],
  [
    "Mobile: keyboard and composer",
    "A device recording is needed to reproduce the viewport shift.",
    "needs_input",
    ["mobile", "frontend"],
  ],
  [
    "Search: avoid full transcript rescans",
    "The incremental index is ready for the benchmark pass.",
    "continue_ready",
    ["performance", "backend"],
  ],
  [
    "Docs: explain background analysis",
    "The setup guide is complete; a small example could help.",
    "followup_suggested",
    ["docs", "release"],
  ],
  [
    "Provider: recover interrupted streams",
    "The native CLI needs authentication before the run can continue.",
    "blocked",
    ["reliability", "backend"],
  ],
  [
    "Queue recovery: verify the branch",
    "A narrower regression covers the reviewed failure mode.",
    "needs_review",
    ["tests", "release"],
  ],
  [
    "Design: compare empty states",
    "Repeated review without a reply. Reduce this to one decision.",
    "needs_decision",
    ["frontend", "research"],
  ],
  [
    "Windows: resolve standalone CLI",
    "The path resolution change is implemented and verified.",
    "done",
    ["windows", "reliability"],
  ],
  [
    "Comments: preserve the parent context",
    "Check that promotion preserves the selected passage.",
    "needs_review",
    ["frontend", "tests"],
  ],
  [
    "Telemetry: separate breadth and overlap",
    "The observed interval is complete; inspect the distribution.",
    "continue_ready",
    ["performance", "research"],
  ],
  [
    "Release notes: final editorial pass",
    "Summarize the final behavior in the release announcement.",
    "continue_ready",
    ["docs", "release"],
  ],
] as const;
const sessions: SessionView[] = scenarios.map(([title, reason, state, tags], i) => ({
  sessionId: `sample-${String(i + 1).padStart(2, "0")}`,
  vendor: vendors[i % 6],
  title: `Help me ${title.toLowerCase()}. Preserve the existing behavior and verify the edge cases.`,
  customTitle: i === 0 ? "Release: durable queue recovery" : undefined,
  brief: title,
  lastPrompt: i === 0 ? "Review the uncertain-dispatch case before we publish." : reason,
  cwd: `/sample/projects/${i < 2 || i === 6 ? "attend" : ["mobile-client", "search-index", "docs-site", "agent-runtime"][i % 4]}`,
  project:
    i < 2 || i === 6
      ? "attend"
      : ["mobile-client", "search-index", "docs-site", "agent-runtime"][i % 4],
  file: `/sample/transcripts/${i + 1}.jsonl`,
  lastTs: now - (i + 1) * 180_000,
  sortTs: now - i * 180_000,
  ageDays: 0,
  prompts: 18 + i * 3,
  userPromptTs: [now - (i + 1) * 180_000, now - 2 * hour, now - 5 * hour],
  score: [9.7, 8.5, 8.1, 7.8, 4, 8.8, 9.1, 5.5, 2, 7.6, 6.5, 6][i],
  state,
  reason,
  etaMin: [6, 4, 3, 8, 2, 5, 4, 3, 1, 5, 7, 3][i],
  tags: [...tags],
  unread: [0, 2, 6, 9].includes(i),
  seen: ![0, 2, 6, 8, 9].includes(i),
  pattern: i === 7 ? "avoidance" : "unknown",
  patternData: i === 7 ? { kind: "review", visits: 3, minutes: 27, prompts: null } : null,
  patternReason: i === 7 ? "3 review visits over 27 minutes, without another user message" : null,
  avoidancePrompt:
    i === 7
      ? "Compare the two options in three points and recommend the smallest reversible next step."
      : null,
  nextStep:
    i === 0
      ? "Verify recovery after a dispatch lease expires, then summarize the remaining release risk."
      : `Continue with the smallest next step for ${title.toLowerCase()}.`,
  probe:
    i === 0
      ? "Show the evidence that an uncertain dispatch cannot silently run twice."
      : i === 6
        ? "Explain which behavior this regression protects."
        : null,
  tokenUsage: {
    input: 125_000 + i * 4300,
    output: 19_200 + i * 810,
    cachedInput: 84_000,
    cacheWriteInput: 0,
    total: 144_200 + i * 5110,
  },
  model: [
    "gpt-example",
    "claude-example",
    "composer-example",
    "gemini-example",
    "copilot-example",
    "provider/example",
  ][i % 6],
  effort: "high",
  lastGenerationDurationMs: 73_000 + i * 12_000,
  lastGenerationOutcome: "generated",
  forkParentId: i === 1 ? "sample-01" : i === 6 ? "sample-02" : null,
}));
sessions[3].generating = true;
sessions[3].generatingStartedAt = now - 95_000;
sessions[3].lastAssistantOutputAt = now - 11_000;

const histories: Record<string, any[]> = {};
for (const [i, s] of sessions.entries()) {
  const id = s.sessionId!;
  const texts =
    i === 0
      ? [
          [
            "user",
            "Implement durable follow-up queues. A browser reload or service restart must not lose instructions.",
          ],
          [
            "assistant",
            "I separated the queued instruction from its dispatch lease. Pending work survives restart; only one local instance can claim its head.",
          ],
          [
            "user",
            "What happens if the service exits after dispatch starts, before the acknowledgement is saved?",
          ],
          [
            "assistant",
            "An expired claim is marked **uncertain**, rather than silently retried. This is a deliberate boundary: the user reviews whether the action ran before scheduling a retry.\n\n| Situation | Result |\n| --- | --- |\n| Pending instruction | Retained |\n| Expired dispatch claim | Needs review |\n| Browser tab closed | Local service keeps ownership |",
          ],
          ["user", "Review the uncertain-dispatch case before we publish."],
          [
            "assistant",
            "The implementation and regression scenarios are ready for review.\n\n- Queue entries remain ordered and durable.\n- A lease prevents two instances dispatching the same head.\n- The uncertain state remains visible until reviewed.\n\n**Next:** inspect the crash boundary, then accept or refine the release scope.\n\nThis conversation and its test output are synthetic demonstration data.",
          ],
        ]
      : [
          ["user", s.title],
          [
            "assistant",
            `I mapped the relevant behavior for **${s.brief}**. The proposed change keeps the existing contract and isolates the edge case.`,
          ],
          ["user", s.lastPrompt!],
          [
            "assistant",
            `${s.reason}\n\n1. Inspect the current result.\n2. Confirm the tradeoff.\n3. Continue with a narrow, reviewable step.\n\n_Synthetic sample conversation. No provider has been called._`,
          ],
        ];
  histories[id] = texts.map(([role, text], n) => ({
    role,
    text,
    tools: [],
    ts: now - (texts.length - n) * 80_000,
    historyId: `${id}-m${n}`,
    historyIndex: n,
    historyOrdinal: n,
  }));
}
histories["sample-01"][3].tools = [
  {
    id: "sample-test",
    name: "exec_command",
    input: { cmd: "npm test -- queue schedules" },
    result: "Synthetic test output · 13 scenarios illustrated; no tests are executed in this demo.",
    historyId: "sample-tool-1",
  },
];
const anchor = histories["sample-01"][3];
const thread = {
  id: "sample-comment",
  parentSessionId: "sample-01",
  anchorKey: "assistant:3",
  anchorText: anchor.text,
  anchorData: { kind: "message", role: "assistant", text: anchor.text },
  providerSessionId: "sample-comment-provider",
  vendor: "codex",
  cwd: "/sample/projects/attend",
  createdAt: now - 20 * 60_000,
  status: "unread",
  messageCount: 3,
  lastUserText: "Should we automatically retry uncertain dispatch?",
  lastUserMessageAt: now - 12 * 60_000,
};
histories["sample-comment-provider"] = [
  { role: "user", text: "Should we automatically retry uncertain dispatch?", tools: [] },
  {
    role: "assistant",
    text: "A timeout does not prove dispatch failed. Keep the occurrence visible and ask the human to review it. This side question stays attached to the parent passage and can be promoted when it becomes separate work.",
    tools: [],
  },
];
const item = (id: string, text: string) => ({
  id,
  text,
  createdAt: now - 50_000,
  updatedAt: now - 50_000,
});
const queue = {
  "sample-01": {
    parked: true,
    items: [
      {
        ...item("sample-q1", "After review, update the recovery documentation."),
        sessionId: "sample-01",
        vendor: "codex",
        cwd: "/sample/projects/attend",
      },
      {
        ...item("sample-q2", "Compare this behavior against the restart regression checklist."),
        sessionId: "sample-01",
        vendor: "codex",
        cwd: "/sample/projects/attend",
      },
    ],
  },
  "sample-04": {
    parked: true,
    items: [
      {
        ...item("sample-q3", "Run the larger fixture after the current benchmark."),
        sessionId: "sample-04",
        vendor: "antigravity",
        cwd: "/sample/projects/search-index",
      },
    ],
  },
};
const view: ConsoleView = {
  sessions,
  schedules: [
    {
      id: "sample-scheduled-message",
      jobId: "sample-job-message",
      kind: "message",
      status: "scheduled",
      runAt: now + 45 * 60_000,
      timezone: "UTC",
      createdAt: now - 60_000,
      updatedAt: now - 60_000,
      payload: {
        kind: "message",
        sessionId: "sample-01",
        cwd: "/sample/projects/attend",
        vendor: "codex",
        text: "Review the release checklist after the verification window.",
      },
    },
    {
      id: "sample-scheduled-session",
      jobId: "sample-job-session",
      kind: "session",
      status: "scheduled",
      runAt: now + 2 * hour,
      timezone: "UTC",
      createdAt: now - 60_000,
      updatedAt: now - 60_000,
      payload: {
        kind: "session",
        clientSessionId: "sample-planned-review",
        cwd: "/sample/projects/attend",
        vendor: "claude",
        text: "Prepare a final release review",
        tags: ["release", "tests"],
      },
    },
  ],
  sessionIndexEpoch: "sample",
  sessionIndexRevision: 1,
  knownDirs: [...new Set(sessions.map((s) => s.cwd!))],
  scopeRoots: ["/sample/projects"],
  defaultNewDir: "/sample/projects/attend",
  pageTitle: "Attend · Sample workspace",
  changelogMarkdown:
    "# Interactive sample workspace\nSynthetic data. No local files, CLI processes, or model calls.",
  sessions1h: 8,
  prompts1h: 26,
  chars1h: 38_600,
  analyzerSettings: { mode: "economical", revision: 1 },
  vendors: vendors.map((vendor) => ({
    vendor,
    available: true,
    chat: true,
    capabilities: vendorCapabilities(vendor),
  })),
  claudeModels: [],
  codexModels: [],
  cursorModels: [],
  tags: [...new Set(sessions.flatMap((s) => s.tags))],
  vaultState: {
    theme: "dark",
    customThemes: {
      midnight: themeEngine.normalize({
        name: "Midnight",
        type: "dark",
        colors: {
          background: "#080b1b",
          "panel.background": "#10162b",
          "sideBar.background": "#0c1125",
          foreground: "#eef2ff",
          "text.foreground": "#d8def5",
          descriptionForeground: "#a9b5d9",
          disabledForeground: "#7886af",
          border: "#293450",
          strongBorder: "#435379",
          accent: "#a5b4fc",
          "accent.background": "#222c55",
          focusBorder: "#6366f180",
        },
      }),
    },
    layout: {
      sidebarWidth: 275,
      sessionPanelOpen: true,
      sessionPanelWidth: 380,
      sessionPanelColumns: 1,
    },
    pinnedTags: ["release", "backend", "reliability"],
    hiddenTags: ["windows"],
    focusViews: [
      { id: "sample-all", name: "Workspace", tags: [] },
      { id: "sample-release", name: "Release", tags: ["release"] },
      { id: "sample-research", name: "Investigations", tags: ["research"] },
    ],
    sessionPins: { "sample-01": 1, "sample-02": 2 },
    forkParents: { "sample-02": "sample-01", "sample-07": "sample-02" },
    shortcuts: [
      item("sample-shortcut", "Show the evidence, remaining risk, and smallest next action."),
    ],
    sessionNotes: {
      "sample-01": [
        item(
          "sample-note",
          "A timeout does not prove the provider failed to receive the action. Preserve user intent.",
        ),
      ],
    },
    sessionTodos: {
      "sample-01": [
        {
          ...item("sample-todo", "Inspect the uncertain-dispatch test boundary"),
          completed: false,
        },
        { ...item("sample-todo-done", "Review queue lease ownership"), completed: true },
      ],
    },
    inboxTodos: [{ ...item("sample-inbox", "Compare the mobile review flow"), completed: false }],
    pins: {
      "attend.pins.v1:sample-01": [
        {
          key: "assistant:3",
          kind: "message",
          role: "assistant",
          text: anchor.text,
          historyId: anchor.historyId,
          ordinal: 3,
          createdAt: now - 30_000,
        },
      ],
    },
    commentThreads: { [thread.id]: thread as any },
  },
};

// Generate the real statistics projection from synthetic event facts, including
// enough complete prompted hours for Narrow/Mixed/Wide comparisons.
const events: WorkEvent[] = [];
let seq = 0;
const endHour = new Date(now);
endHour.setMinutes(0, 0, 0);
for (let h = 0; h < 30; h++) {
  const width = [2, 4, 7][Math.floor(h / 5) % 3];
  for (let j = 0; j < width; j++)
    for (let k = 0; k < 2; k++) {
      const s = sessions[j],
        at = endHour.getTime() - (30 - h) * hour + 90_000 + j * 420_000 + k * 200_000;
      const common = { sessionId: s.sessionId!, vendor: s.vendor, source: "live" as const };
      events.push({
        ...common,
        id: `event-${++seq}`,
        kind: "user_prompt",
        at,
        chars: 160 + j * 10,
      });
      events.push({ ...common, id: `event-${++seq}`, kind: "turn_started", at: at + 1000 });
      events.push({
        ...common,
        id: `event-${++seq}`,
        kind: "turn_finished",
        at: at + 180_000 + j * 5000,
        ok: true,
      });
      events.push({
        ...common,
        id: `event-${++seq}`,
        kind: "daemon_state",
        at: at + 185_000 + j * 5000,
        state: "done",
      });
    }
}
// Recent completed turns keep the trailing-hour overview and every range live.
// Assistant output is counted as characters by the same production projection.
for (let j = 0; j < 4; j++) {
  const s = sessions[j],
    at = now - (24 - j * 3) * 60_000;
  const common = {
    sessionId: s.sessionId!,
    vendor: s.vendor,
    source: "live" as const,
    queueId: `sample-observed-q${j}`,
  };
  events.push({
    ...common,
    id: `event-${++seq}`,
    kind: "queue_enqueued",
    at: at - (j + 2) * 60_000,
  });
  events.push({ ...common, id: `event-${++seq}`, kind: "user_prompt", at, chars: 340 + j * 30 });
  events.push({ ...common, id: `event-${++seq}`, kind: "turn_started", at: at + 1000 });
  events.push({
    ...common,
    id: `event-${++seq}`,
    kind: "assistant_output",
    at: at + 150_000,
    chars: 2100 + j * 280,
  });
  events.push({
    ...common,
    id: `event-${++seq}`,
    kind: "turn_finished",
    at: at + 300_000,
    ok: true,
  });
  events.push({
    ...common,
    id: `event-${++seq}`,
    kind: "daemon_state",
    at: at + 305_000,
    state: "done",
  });
}
events.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
const rawSessions = sessions.map((s) => ({
  ...s,
  actions: 32,
  chars: 24_000,
  visits: 3,
  firstTs: now - 5 * 86_400_000,
  lastTurnChars: 1200,
})) as RawSession[];
const stats: Record<string, any> = {};
for (const range of ["1h", "3h", "6h", "12h", "today", "24h", "3d", "7d", "15d"]) {
  const computed = buildWorkStats(rawSessions, now, range, {
    events,
    analysisFor: (id) => {
      const s = sessions.find((s) => s.sessionId === id)!;
      return {
        brief: s.brief!,
        state: s.state as any,
        priority: s.score,
        etaMin: s.etaMin,
        reason: s.reason,
      };
    },
    activeSessionIds: ["sample-04"],
    queues: Object.fromEntries(
      Object.entries(queue).map(([id, q]) => [id, { count: q.items.length, parked: q.parked }]),
    ),
  });
  const total = computed.summary.prompts;
  stats[range] = {
    ...computed,
    collaboration: {
      totalTurns: total,
      labeledTurns: total,
      coverageRate: total ? 1 : null,
      feedbackSamples: Math.max(0, total - 12),
      straightThroughRate: total ? 0.72 : null,
      reworkRate: total ? 0.18 : null,
      completedHandoffRate: total ? 0.64 : null,
      intents: [
        { key: "implement", count: Math.round(total * 0.45), rate: 0.45 },
        { key: "verify", count: Math.round(total * 0.32), rate: 0.32 },
        { key: "design", count: Math.round(total * 0.23), rate: 0.23 },
      ],
      steering: [
        { key: "continue", count: Math.round(total * 0.45), rate: 0.45 },
        { key: "accept", count: Math.round(total * 0.27), rate: 0.27 },
        { key: "correct", count: Math.round(total * 0.18), rate: 0.18 },
        { key: "clarify", count: Math.round(total * 0.1), rate: 0.1 },
      ],
    },
  };
}
const activity = trailingPromptActivity(events, now, 1);
view.sessions1h = activity.sessions;
view.prompts1h = activity.prompts;
view.chars1h = activity.chars;
const runtime = fs.readFileSync(path.join(root, "website/demo-runtime.js"), "utf8");
export function renderDemo(theme: "dark" | "light" | "midnight"): string {
  const themedView: ConsoleView = { ...view, vaultState: { ...view.vaultState, theme } };
  const fixtures = {
    now,
    view: themedView,
    histories,
    queue,
    stats,
    activity,
    initial: "sample-01",
  };
  const json = JSON.stringify(fixtures).replace(/</g, "\\u003c");
  let html = renderConsole(themedView);
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`;
  html = html.replace("<head>", `<head>${csp}<meta name="robots" content="noindex">`);
  html = html.replace("<body", '<body data-attend-demo="true"');
  html = html.replace(
    "<script>\n(function(){",
    `<script>window.ATTEND_DEMO_FIXTURES=${json};\n${runtime}</script>\n<script>\n(function(){`,
  );
  if (!html.includes("window.ATTEND_DEMO_FIXTURES="))
    throw new Error("Native console script injection point changed");
  return html;
}
const output = path.join(root, "_site/demo");
fs.mkdirSync(output, { recursive: true });
for (const [file, theme] of [
  ["index.html", "dark"],
  ["light.html", "light"],
  ["midnight.html", "midnight"],
] as const) {
  fs.writeFileSync(path.join(output, file), renderDemo(theme));
}
const productVariables = new Set([
  "canvas",
  "surface",
  "surface-2",
  "ink",
  "ink-2",
  "ink-3",
  "ink-4",
  "line",
  "line-2",
  "accent",
  "accent-soft",
  "accent-ring",
  "primary-bg",
  "primary-fg",
  "button-hover",
]);
const palette = (theme: "light" | "dark") =>
  Object.values(THEME_COLORS)
    .filter((color) => productVariables.has(color.variable))
    .map((color) => `  --${color.variable}: ${color[theme]};`)
    .join("\n");
fs.writeFileSync(
  path.join(root, "_site/product-theme.css"),
  `/* Generated from Attend's native theme registry. */\n:root,html[data-theme="light"]{\n  color-scheme:light;\n${palette("light")}\n}\nhtml[data-theme="dark"]{\n  color-scheme:dark;\n${palette("dark")}\n}\n`,
);
console.log(
  "Built native Attend demos (dark, light, midnight) and product-theme.css · synthetic data · no network or model calls",
);
