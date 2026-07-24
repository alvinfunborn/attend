import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

const view: ConsoleView = {
  sessions: [],
  knownDirs: [],
  scopeRoots: [],
  defaultNewDir: "",
  changelogMarkdown: [
    "[query](https://example.test/?a=1&b=2)",
    "",
    "```plantuml",
    "Alice -> Bob: private source",
    "```",
  ].join("\n"),
  sessions1h: 0,
  prompts1h: 0,
  chars1h: 0,
  vendors: [],
  claudeModels: [],
  codexModels: [],
  cursorModels: [],
  tags: [],
};

const raceView: ConsoleView = {
  ...view,
  sessions: [
    {
      vendor: "claude",
      sessionId: "s1",
      title: "Avoidance session",
      lastPrompt: "old prompt",
      cwd: "/tmp/project",
      project: "project",
      file: "/tmp/session-1.jsonl",
      ageDays: 0,
      lastTs: 100,
      prompts: 1,
      pattern: "avoidance",
      patternReason: "revisited without sending",
      state: "needs_input",
      score: 8,
      reason: "needs a reply",
      etaMin: 10,
      brief: "Avoidance session",
      tags: [],
      seen: true,
    },
    {
      vendor: "claude",
      sessionId: "s2",
      title: "Other session",
      lastPrompt: "other prompt",
      cwd: "/tmp/project",
      project: "project",
      file: "/tmp/session-2.jsonl",
      ageDays: 0,
      lastTs: 90,
      prompts: 1,
      pattern: "unknown",
      state: null,
      score: 5,
      reason: "",
      etaMin: 10,
      brief: "Other session",
      tags: [],
    },
  ],
  vendors: [{ vendor: "claude", available: true, chat: true }],
};

const forkTreeView: ConsoleView = {
  ...raceView,
  sessions: raceView.sessions.map((session, index) =>
    index === 1 ? { ...session, forkParentId: "s1" } : session,
  ),
};

const pendingTagView: ConsoleView = {
  ...raceView,
  knownDirs: ["/tmp/project"],
  defaultNewDir: "/tmp/project",
  tags: ["work"],
};

const untaggedView: ConsoleView = {
  ...pendingTagView,
  sessions: pendingTagView.sessions.map((session, index) =>
    index === 1 ? { ...session, tags: ["work"] } : session,
  ),
};

const [tagPinOldSession, tagPinNewSession] = raceView.sessions as [
  ConsoleView["sessions"][number],
  ConsoleView["sessions"][number],
];

const tagPinView: ConsoleView = {
  ...raceView,
  tags: ["old", "new", "middle"],
  vaultState: { pinnedTags: ["old"] },
  sessions: [
    { ...tagPinOldSession, tags: ["old"], userPromptTs: [100] },
    { ...tagPinNewSession, tags: ["new"], userPromptTs: [300] },
    {
      ...tagPinNewSession,
      sessionId: "s3",
      title: "Middle session",
      file: "/tmp/session-3.jsonl",
      tags: ["middle"],
      userPromptTs: [200],
    },
  ],
};

const tagPickerOrderView: ConsoleView = {
  ...tagPinView,
  tags: ["old", "middle", "new"],
  sessions: [
    ...tagPinView.sessions,
    {
      ...tagPinNewSession,
      sessionId: "s4",
      title: "Tag picker target",
      file: "/tmp/session-4.jsonl",
      tags: [],
      userPromptTs: [50],
    },
  ],
};

const hiddenTagsView: ConsoleView = {
  ...tagPinView,
  vaultState: { pinnedTags: ["old"], hiddenTags: ["middle"] },
};

const commentView: ConsoleView = {
  ...raceView,
  vaultState: {
    commentThreads: {
      "comment-1": {
        id: "comment-1",
        parentSessionId: "s1",
        anchorKey: "assistant:0",
        anchorText: "An answer with an unread comment",
        providerSessionId: "comment-provider-1",
        vendor: "claude",
        cwd: "/tmp/project",
        createdAt: 101,
        status: "unread",
        messageCount: 2,
      },
    },
  },
};

const commentMotionView: ConsoleView = {
  ...raceView,
  vaultState: {
    pins: {
      "attend.pins.v1:s1": [
        {
          key: "assistant:0",
          role: "claude",
          text: "A comment reply is still generating",
          pinnedAt: 101,
        },
        {
          key: "assistant:1",
          role: "claude",
          text: "A comment reply is unread",
          pinnedAt: 102,
        },
      ],
    },
    commentThreads: {
      "comment-generating": {
        id: "comment-generating",
        parentSessionId: "s1",
        anchorKey: "assistant:0",
        anchorText: "A comment reply is still generating",
        providerSessionId: "comment-provider-generating",
        vendor: "claude",
        cwd: "/tmp/project",
        createdAt: 101,
        status: "generating",
        messageCount: 1,
      },
      "comment-unread": {
        id: "comment-unread",
        parentSessionId: "s1",
        anchorKey: "assistant:1",
        anchorText: "A comment reply is unread",
        providerSessionId: "comment-provider-unread",
        vendor: "claude",
        cwd: "/tmp/project",
        createdAt: 102,
        status: "unread",
        messageCount: 2,
      },
    },
  },
};

const pinReferenceView: ConsoleView = {
  ...raceView,
  vaultState: {
    pins: {
      "attend.pins.v1:s1": [
        {
          key: "assistant:0",
          role: "claude",
          text: "Pinned architecture decision",
          pinnedAt: 101,
        },
        {
          key: "tool:id:secret",
          role: "Bash",
          text: "Tool: Bash\nInput: private command\nResult: private output",
          pinnedAt: 102,
        },
      ],
    },
    commentThreads: {
      "pin-comment": {
        id: "pin-comment",
        parentSessionId: "s1",
        anchorKey: "assistant:0",
        anchorText: "Pinned architecture decision",
        providerSessionId: "pin-comment-provider",
        vendor: "claude",
        cwd: "/tmp/project",
        createdAt: 101,
        status: "read",
        messageCount: 4,
      },
    },
  },
};

const composerRailView: ConsoleView = {
  ...raceView,
  sessions: raceView.sessions.map((session, index) =>
    index === 0
      ? {
          ...session,
          model: "claude-sonnet",
          effort: "high",
          speed: "standard",
        }
      : session,
  ),
  vendors: [
    { vendor: "claude", available: true, chat: true },
    { vendor: "codex", available: true, chat: true },
  ],
  claudeModels: [
    {
      value: "claude-sonnet",
      label: "Claude Sonnet",
      efforts: ["high"],
      defaultEffort: "high",
      speeds: ["standard", "fast"],
      defaultSpeed: "standard",
      speedLabels: { standard: "Standard", fast: "Fast" },
    },
  ],
  codexModels: [
    {
      value: "gpt-5-codex",
      label: "GPT-5 Codex",
      efforts: ["medium"],
      defaultEffort: "medium",
      speeds: ["default", "priority"],
      defaultSpeed: "default",
      speedLabels: { default: "Standard", priority: "Fast" },
    },
  ],
  modelDefaults: {
    claude: { model: "claude-sonnet", effort: "high", speed: "standard" },
    codex: { model: "gpt-5-codex", effort: "medium", speed: "default" },
  },
  vaultState: {
    shortcuts: [{ id: "shortcut-1", text: "Review changes", createdAt: 1, updatedAt: 1 }],
  },
};

const cursorMatrixView: ConsoleView = {
  ...view,
  knownDirs: ["/tmp/project"],
  scopeRoots: ["/tmp/project"],
  defaultNewDir: "/tmp/project",
  vendors: [{ vendor: "cursor", available: true, chat: true }],
  cursorModels: [
    {
      value: "gpt-5.3-codex",
      label: "Codex 5.3",
      efforts: ["medium", "high"],
      effortLabels: { medium: "Medium", high: "High" },
      defaultEffort: "medium",
      speeds: ["false", "true"],
      speedLabels: { false: "Standard", true: "Fast" },
      defaultSpeed: "false",
      configurations: [
        {
          value: "gpt-5.3-codex[reasoning=medium,fast=false]",
          effort: "medium",
          speed: "false",
        },
        {
          value: "gpt-5.3-codex[reasoning=high,fast=true]",
          effort: "high",
          speed: "true",
        },
      ],
    },
  ],
  modelDefaults: {
    cursor: { model: "gpt-5.3-codex", effort: "medium", speed: "false" },
  },
};

const unavailableVendorView: ConsoleView = {
  ...view,
  knownDirs: ["/tmp/project"],
  defaultNewDir: "/tmp/project",
  vendors: [
    {
      vendor: "claude",
      available: false,
      chat: true,
      version: "2.0.99",
      minimumVersion: "2.1.0",
      issue: "version_too_old",
      message:
        "Claude CLI 2.0.99 is too old. Attend requires 2.1.0 or newer. Update Claude Code, then restart Attend.",
    },
    {
      vendor: "codex",
      available: false,
      chat: true,
      issue: "not_installed",
      message:
        "Codex CLI was not found. Install Codex CLI or the ChatGPT desktop app, then restart Attend.",
    },
    {
      vendor: "cursor",
      available: true,
      chat: true,
      version: "2026.07.09-a3815c0",
    },
  ],
};

const allUnavailableVendorView: ConsoleView = {
  ...unavailableVendorView,
  vendors: unavailableVendorView.vendors.map((vendor) => ({
    ...vendor,
    available: false,
    issue: vendor.issue ?? "not_installed",
    message:
      vendor.message ?? `${vendor.vendor} CLI was not found. Install it, then restart Attend.`,
  })),
};

describe("console browser behavior", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("shares one clock interaction and projects scheduled sessions/comments into existing UI", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    page.setDefaultTimeout(2_000);
    const pageErrors: string[] = [];
    const scheduledBodies: Array<Record<string, unknown>> = [];
    const scheduledItems: Array<Record<string, unknown>> = [];
    const materializedBodies: Array<Record<string, unknown>> = [];
    let currentPageView = pendingTagView;
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(currentPageView),
        });
      } else if (url.pathname === "/schedules" && request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown>;
        scheduledBodies.push(body);
        const kind = String(body.kind);
        const payload = body.payload as Record<string, unknown>;
        const item = {
          id: `run-${scheduledBodies.length}`,
          jobId: `job-${scheduledBodies.length}`,
          kind,
          runAt: body.runAt,
          timezone: body.timezone,
          status: "scheduled",
          payload: {
            ...payload,
            kind,
            ...(kind === "comment" && !payload.threadId ? { threadId: "scheduled-comment-1" } : {}),
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        scheduledItems.push(item);
        await route.fulfill({ json: { ok: true, item, schedules: [item] } });
      } else if (url.pathname === "/schedules/materialize" && request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown>;
        materializedBodies.push(body);
        const source = scheduledItems.find((item) => item.id === url.searchParams.get("id"));
        const payload = (source?.payload ?? {}) as Record<string, unknown>;
        const item = {
          ...source,
          kind: "message",
          status: "scheduled",
          payload: {
            kind: "message",
            sessionId: "materialized-session-1",
            cwd: payload.cwd,
            vendor: payload.vendor,
            text: payload.text,
            attachments: payload.attachments,
          },
        };
        await route.fulfill({
          json: {
            ok: true,
            session: "materialized-session-1",
            clientSessionId: payload.clientSessionId,
            generating: true,
            item,
            schedules: [item],
          },
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [{ role: "assistant", text: "An answer with an unread comment" }],
        });
      } else if (url.pathname === "/comments/messages") {
        await route.fulfill({
          json: {
            ok: true,
            thread: commentView.vaultState?.commentThreads?.["comment-1"],
            messages: [],
          },
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });

    await page.goto("http://attend.test/");
    await page.locator("#newToggle").click();
    await page.locator("#np").fill("start this session later");
    await page.locator("#scheduleNew").click();
    await expect.poll(() => page.locator("#schedulePop").isVisible()).toBe(true);
    await expect.poll(() => page.locator("#scheduleActions").isVisible()).toBe(true);
    expect(await page.locator('#schedulePop input[type="datetime-local"]').count()).toBe(0);
    expect(
      await page
        .locator("#scheduleDateTime,#scheduleActions")
        .evaluateAll((nodes) => nodes.map((node) => node.parentElement?.className)),
    ).toEqual(["schedulerow", "schedulerow"]);
    const directDateTime = page.locator("#scheduleDateTimeInput");
    const defaultDirectValue = await directDateTime.inputValue();
    expect(defaultDirectValue).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    await directDateTime.fill(defaultDirectValue.replace(/:\d{2}$/, ":17"));
    await directDateTime.press("ArrowDown");
    await expect.poll(() => page.locator("#schedulePicker").isVisible()).toBe(true);
    await expect
      .poll(() => page.locator("#schedulePicker .schedulepicker-day.selected").count())
      .toBe(1);
    expect(await page.locator("#scheduleHour").inputValue()).toMatch(/^\d{2}$/);
    expect(await page.locator("#scheduleMinute").inputValue()).toBe("17");
    await expect
      .poll(() => page.locator("#scheduleHourOptions .scheduletime-option").count())
      .toBe(24);
    await expect
      .poll(() => page.locator("#scheduleMinuteOptions .scheduletime-option").allTextContents())
      .toEqual(["00", "15", "30", "45"]);
    await page.locator("#scheduleMinuteOptions .scheduletime-option", { hasText: "30" }).click();
    await expect.poll(() => directDateTime.inputValue()).toMatch(/:30$/);
    await expect
      .poll(() => page.locator("#scheduleActions .scheduleaction").allTextContents())
      .toEqual(["Start session"]);
    await page.locator("#scheduleActions .scheduleaction", { hasText: "Start session" }).click();

    await expect.poll(() => scheduledBodies.length).toBe(1);
    expect(scheduledBodies[0]).toMatchObject({ kind: "session" });
    expect(new Date(Number(scheduledBodies[0]?.runAt)).getMinutes()).toBe(30);
    expect(await page.locator("#toastHost .toast").count()).toBe(0);
    await expect.poll(() => page.locator("#queue .qitem.scheduled").count()).toBe(1);
    expect(await page.locator("#queue").textContent()).toContain("start this session later");
    expect(await page.locator("#list").textContent()).toContain("start this session later");
    expect(await page.locator("#msgs").textContent()).toContain("start this session later");
    await page.locator("#input").fill("start working immediately");
    await page.locator("#send").click();
    await expect.poll(() => materializedBodies.length).toBe(1);
    expect(materializedBodies[0]).toMatchObject({
      text: "start working immediately",
    });
    await expect
      .poll(() => page.locator("#msgs").textContent())
      .toContain("start working immediately");
    expect(await page.locator("#msgs").textContent()).not.toContain("start this session later");
    expect(await page.locator("#queue").textContent()).toContain("start this session later");

    const buttonClasses = await page
      .locator("#scheduleNew,#scheduleChat,#scheduleComment")
      .evaluateAll((buttons) => buttons.map((button) => button.className));
    expect(buttonClasses).toEqual(["schedulebtn", "schedulebtn", "schedulebtn"]);
    currentPageView = pendingTagView;
    await page.goto("http://attend.test/");
    await page.locator('#list .item[data-session-id="s1"]').click();
    await page.locator("#input").fill("fork this conversation later");
    await page.locator("#scheduleChat").click();
    await expect.poll(() => page.locator("#schedulePop").isVisible()).toBe(true);
    expect(await page.locator("#schedulePop .schedulepop-title").textContent()).toBe(
      "Schedule once",
    );
    await expect.poll(() => page.locator("#scheduleActions").isVisible()).toBe(true);
    await expect
      .poll(() => page.locator("#scheduleActions .scheduleaction").allTextContents())
      .toEqual(["Fork", "Send"]);
    await page.locator("#scheduleActions .scheduleaction", { hasText: "Fork" }).click();
    await expect.poll(() => scheduledBodies.length).toBe(2);
    expect(scheduledBodies[1]).toMatchObject({
      kind: "session",
      payload: {
        mode: "fork",
        parentSessionId: "s1",
        text: "fork this conversation later",
        contextMessages: expect.any(Array),
      },
    });
    await expect
      .poll(() => page.locator("#list").textContent())
      .toContain("fork this conversation later");
    const forkClientId = String(
      (scheduledItems[1]?.payload as Record<string, unknown>)?.clientSessionId,
    );
    await page.locator(`#list .item[data-session-id="${forkClientId}"]`).click();
    await expect
      .poll(() => page.locator("#msgs").textContent())
      .toContain("An answer with an unread comment");
    expect(await page.locator("#msgs").textContent()).toContain("fork this conversation later");

    currentPageView = commentView;
    await page.goto("http://attend.test/");
    await page.locator('#list .item[data-session-id="s1"] .it-comment').click();
    await page.locator("#commentInput").fill("follow up later");
    await page.locator("#scheduleComment").click();
    await page.locator("#scheduleActions .scheduleaction", { hasText: "Send comment" }).click();
    await expect.poll(() => scheduledBodies.length).toBe(3);
    expect(scheduledBodies[2]).toMatchObject({ kind: "comment" });
    await expect.poll(() => page.locator("#commentQueue .qitem.scheduled").count()).toBe(1);
    expect(await page.locator("#commentQueue").textContent()).toContain("follow up later");
    const commentFlow = await page.locator(".commentpanel").evaluate((panel) => {
      const rect = (selector: string) => {
        const node = panel.querySelector(selector);
        if (!node) throw new Error(`Missing ${selector}`);
        const box = node.getBoundingClientRect();
        return {
          top: box.top,
          bottom: box.bottom,
          position: node.ownerDocument.defaultView?.getComputedStyle(node).position,
        };
      };
      return {
        messages: rect("#commentMsgs"),
        queue: rect("#commentQueue"),
        foot: rect(".commentfoot"),
      };
    });
    expect(commentFlow.messages.bottom).toBeCloseTo(commentFlow.queue.top, 0);
    expect(commentFlow.queue.bottom).toBeCloseTo(commentFlow.foot.top, 0);
    expect(commentFlow.messages.position).toBe("static");
    expect(commentFlow.queue.position).toBe("static");
    expect(commentFlow.foot.position).toBe("relative");
    expect(pageErrors).toEqual([]);
    await page.close();
  }, 15_000);

  it("edits scheduled user messages inline in the queued area", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    const runAt = Date.now() + 60_000;
    let patchedBody: Record<string, unknown> | null = null;
    let releaseRunNow = () => {};
    const runNowGate = new Promise<void>((resolve) => {
      releaseRunNow = resolve;
    });
    const scheduledItem = {
      id: "scheduled-message-edit",
      jobId: "scheduled-message-job",
      kind: "message" as const,
      runAt,
      timezone: "Asia/Shanghai",
      status: "scheduled" as const,
      payload: {
        kind: "message" as const,
        sessionId: "s1",
        cwd: "/tmp/project",
        vendor: "claude",
        text: "original scheduled message",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole({
            ...pendingTagView,
            schedules: [scheduledItem],
          }),
        });
      } else if (url.pathname === "/schedules" && request.method() === "PATCH") {
        patchedBody = request.postDataJSON() as Record<string, unknown>;
        const updated = {
          ...scheduledItem,
          payload: { ...scheduledItem.payload, text: String(patchedBody.text) },
          updatedAt: Date.now(),
        };
        await route.fulfill({
          json: { ok: true, item: updated, schedules: [updated] },
        });
      } else if (url.pathname === "/schedules/run" && request.method() === "POST") {
        await runNowGate;
        await route.fulfill({
          json: {
            ok: true,
            item: { ...scheduledItem, status: "dispatched" },
            schedules: [],
          },
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });

    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator('#list .item[data-session-id="s1"]').click();
    const row = page.locator("#queue .qitem.scheduled");
    await expect.poll(() => row.count()).toBe(1);
    expect(await row.locator(".qedit").getAttribute("aria-label")).toBe("Edit scheduled content");
    expect(await row.locator(".qschedule").getAttribute("aria-label")).toBe("Reschedule");
    await row.locator(".qedit").click();
    await expect.poll(() => row.locator(".qeditbox").count()).toBe(1);
    await row.locator(".qeditta").fill("updated scheduled message");
    await row.locator(".qsend").click();

    await expect.poll(() => patchedBody).toEqual({ text: "updated scheduled message" });
    await expect.poll(() => row.locator(".qeditbox").count()).toBe(0);
    await expect.poll(() => row.textContent()).toContain("updated scheduled message");
    await row.locator(".qsend", { hasText: "run now" }).click();
    await expect.poll(() => row.locator(".qtag").first().textContent()).toBe("dispatching");
    await expect.poll(() => row.locator(".qsend").isDisabled()).toBe(true);
    releaseRunNow();
    await expect.poll(() => row.count()).toBe(0);
    await page.close();
  });

  it("selects a Pin with @, excludes tool Pins, and sends a structured reference", async () => {
    const page = await browser.newPage({
      viewport: { width: 390, height: 780 },
    });
    const pageErrors: string[] = [];
    let sentBody: Record<string, unknown> | null = null;
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(pinReferenceView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/chat/send") {
        sentBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({ json: { ok: true, session: "s1" } });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    const readSessionComment = page.locator('#list .item[data-session-id="s1"] .it-comment');
    expect(await readSessionComment.isVisible()).toBe(true);
    expect(await readSessionComment.getAttribute("class")).toContain("read");
    expect(await readSessionComment.getAttribute("class")).not.toContain("unread");
    expect(await readSessionComment.getAttribute("class")).not.toContain("generating");
    expect(await readSessionComment.getAttribute("aria-label")).toBe("1 comment thread");
    expect(await readSessionComment.locator(".it-comment-icon").count()).toBe(1);
    const sessionCommentPath = await readSessionComment.locator("svg path").getAttribute("d");
    expect(
      await readSessionComment.evaluate((badge) => {
        const view = badge.ownerDocument.defaultView;
        if (!view) return null;
        const probe = badge.ownerDocument.createElement("span");
        probe.style.color = "var(--status-seen)";
        badge.appendChild(probe);
        const style = view.getComputedStyle(badge);
        const result = {
          colorMatches: style.color === view.getComputedStyle(probe).color,
          borderStyle: style.borderStyle,
          background: style.backgroundColor,
        };
        probe.remove();
        return result;
      }),
    ).toEqual({
      colorMatches: true,
      borderStyle: "none",
      background: "rgba(0, 0, 0, 0)",
    });
    await readSessionComment.hover();
    await expect
      .poll(() =>
        readSessionComment.evaluate((badge) => {
          const view = badge.ownerDocument.defaultView;
          if (!view) return false;
          const probe = badge.ownerDocument.createElement("span");
          probe.style.background = "var(--status-seen-soft)";
          probe.style.position = "fixed";
          probe.style.left = "-9999px";
          badge.ownerDocument.body.appendChild(probe);
          const expected = view.getComputedStyle(probe).backgroundColor;
          probe.remove();
          return view.getComputedStyle(badge).backgroundColor === expected;
        }),
      )
      .toBe(true);
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();

    const pinnedMessage = page.locator("#pinTray .pinitem").first();
    const pinComments = page.locator("#pinTray .pincomment");
    expect(await pinComments.count()).toBe(2);
    expect(await pinComments.first().getAttribute("aria-label")).toBe("Open comments");
    expect(await pinComments.last().getAttribute("aria-label")).toBe("Comment on this pin");
    expect(await pinComments.first().getAttribute("class")).toContain("read");
    expect(await pinComments.last().getAttribute("class")).toContain("idle");
    expect(await pinComments.locator(".pincomment-icon").count()).toBe(2);
    expect(await pinComments.first().locator("svg path").getAttribute("d")).toBe(
      sessionCommentPath,
    );
    await pinComments.last().hover();
    await expect
      .poll(() =>
        pinComments.last().evaluate((button) => {
          const view = button.ownerDocument.defaultView;
          if (!view) return false;
          const probe = button.ownerDocument.createElement("span");
          probe.style.color = "var(--status-seen)";
          probe.style.position = "fixed";
          probe.style.left = "-9999px";
          button.ownerDocument.body.appendChild(probe);
          const expected = view.getComputedStyle(probe).color;
          probe.remove();
          return view.getComputedStyle(button).color === expected;
        }),
      )
      .toBe(true);
    expect(await pinnedMessage.getAttribute("data-hover-tip")).toBe("Pinned architecture decision");
    await pinnedMessage.locator(".pintext").hover();
    await expect
      .poll(() => page.locator("#hoverTip").textContent())
      .toBe("Pinned architecture decision");

    const input = page.locator("#input");
    await input.fill("Compare @Pinned");
    await expect.poll(() => page.locator("#composerPinPicker").isVisible()).toBe(true);
    expect(await page.locator("#composerPinPicker .pinref-option").count()).toBe(1);
    expect(await page.locator("#composerPinPicker").textContent()).toContain(
      "Pinned architecture decision",
    );
    expect(await page.locator("#composerPinPicker").textContent()).not.toContain("private command");
    const pinOption = page.locator("#composerPinPicker .pinref-option");
    expect(await input.getAttribute("role")).toBe("combobox");
    expect(await input.getAttribute("aria-autocomplete")).toBe("both");
    expect(await input.getAttribute("aria-activedescendant")).toBe("pinref-option-0");
    expect(await pinOption.getAttribute("tabindex")).toBe("-1");
    expect(await pinOption.getAttribute("data-hover-tip")).toBe("Pinned architecture decision");
    await pinOption.hover();
    await expect
      .poll(() => page.locator("#hoverTip").textContent())
      .toBe("Pinned architecture decision");

    await input.evaluate((node) => {
      node.setAttribute("data-test-blurs", "0");
      node.addEventListener("blur", () => {
        node.setAttribute(
          "data-test-blurs",
          String(Number(node.getAttribute("data-test-blurs") ?? "0") + 1),
        );
      });
    });

    await input.press("Escape");
    await expect.poll(() => page.locator("#composerPinPicker").isHidden()).toBe(true);
    await page.waitForTimeout(50);
    expect(await input.evaluate((node) => node.ownerDocument.activeElement === node)).toBe(true);
    expect(await input.getAttribute("data-test-blurs")).toBe("0");
    expect(await input.inputValue()).toBe("Compare @Pinned");

    await input.fill("Compare @not-a-match");
    await expect.poll(() => page.locator("#composerPinPicker").isHidden()).toBe(true);
    expect(await input.getAttribute("aria-expanded")).toBe("false");

    await input.fill("");
    await input.fill("Compare @Pinned");
    await expect.poll(() => page.locator("#composerPinPicker").isVisible()).toBe(true);
    await page.keyboard.press("Enter");
    expect(await input.inputValue()).toBe("Compare ");
    const chip = page.locator("#attachTray .pinrefchip");
    await expect.poll(() => chip.isVisible()).toBe(true);
    expect(await chip.textContent()).toContain("Pinned architecture decision");
    expect(await chip.textContent()).toContain("comments");

    await page.locator("#backbtn").click();
    await page.locator("#list .item", { hasText: "Other session" }).click();
    expect(await page.locator("#attachTray .pinrefchip").count()).toBe(0);
    await page.locator("#backbtn").click();
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await expect.poll(() => page.locator("#attachTray .pinrefchip").isVisible()).toBe(true);
    expect(await input.inputValue()).toBe("Compare ");

    await input.focus();
    await input.press("End");
    await input.type("these options");
    await page.locator("#send").click();
    await expect.poll(() => sentBody).not.toBeNull();
    expect(sentBody).toMatchObject({
      text: "Compare these options",
      references: [{ kind: "pin", pinKey: "assistant:0", pinSessionId: "s1" }],
    });
    expect(await chip.count()).toBe(0);
    const sentReference = page.locator("#msgs > .msg.user .msgref");
    await expect.poll(() => sentReference.isVisible()).toBe(true);
    expect(await sentReference.textContent()).toContain("Pinned architecture decision");
    expect(await sentReference.textContent()).toContain("comments");

    await page.locator("#backbtn").click();
    await page.locator("#list .item", { hasText: "Other session" }).click();
    await page.locator("#backbtn").click();
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await expect.poll(() => sentReference.isVisible()).toBe(true);
    expect(pageErrors).toEqual([]);
    await page.close();
  });

  it("shows the full user message when hovering a truncated historical Pin", async () => {
    const page = await browser.newPage();
    const fullUserText = [
      "Long pinned user instruction.",
      ...Array.from({ length: 180 }, (_, index) => `Requirement ${index + 1} must remain visible.`),
      "End of the complete pinned user instruction.",
    ].join(" ");
    const preview = fullUserText.slice(0, 1200);
    const userPinView: ConsoleView = {
      ...raceView,
      vaultState: {
        pins: {
          "attend.pins.v1:s1": [
            {
              key: "user:0",
              role: "you",
              text: preview,
              pinnedAt: 101,
            },
          ],
        },
      },
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(userPinView) });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            { role: "user", text: fullUserText },
            { role: "assistant", text: "Acknowledged." },
          ],
        });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });

    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator('#list .item[data-session-id="s1"]').click();
    const pinText = page.locator("#pinTray .pinitem .pintext");
    await expect.poll(() => pinText.getAttribute("data-hover-tip")).toBe(fullUserText);
    expect(await pinText.textContent()).toBe(preview);
    await pinText.hover();
    await expect.poll(() => page.locator("#hoverTip").textContent()).toBe(fullUserText);
    await page.close();
  });

  it("starts a comment from a pinned text selection without an existing thread", async () => {
    const page = await browser.newPage();
    let commentBody: Record<string, unknown> | null = null;
    const selectionKey = "assistant:0:selection:test";
    const selectionPrefix = "Context before the selected evidence. ".repeat(180);
    const selectedPinView: ConsoleView = {
      ...raceView,
      vaultState: {
        pins: {
          "attend.pins.v1:s1": [
            {
              key: selectionKey,
              targetKey: "assistant:0",
              kind: "selection",
              role: "selected",
              text: "Option Beta needs evidence.",
              selectionStart: selectionPrefix.length,
              pinnedAt: 101,
            },
          ],
        },
      },
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(selectedPinView) });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            {
              role: "assistant",
              text: `${selectionPrefix}Option Beta needs evidence.`,
            },
          ],
        });
      } else if (url.pathname === "/comments/send") {
        commentBody = request.postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          json: {
            ok: true,
            thread: {
              id: "selected-comment-1",
              parentSessionId: "s1",
              anchorKey: selectionKey,
              anchorText: "Option Beta needs evidence.",
              providerSessionId: "selected-comment-provider-1",
              vendor: "claude",
              cwd: "/tmp/project",
              createdAt: 102,
              status: "generating",
              messageCount: 1,
            },
          },
        });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });

    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator('#list .item[data-session-id="s1"]').click();
    const pin = page.locator("#pinTray .pinitem");
    expect(await pin.locator(".pinrole").textContent()).toBe("selected");
    await pin.locator(".pintext").click();
    const selectedPosition = await page
      .locator("#msgs > .msg.assistant .bubble")
      .evaluate((bubble, selectedText) => {
        const host = bubble.closest("#msgs");
        if (!host) throw new Error("Missing message scroller");
        const fullText = bubble.textContent ?? "";
        const start = fullText.indexOf(selectedText);
        if (start < 0) throw new Error("Missing selected text");
        const walker = bubble.ownerDocument.createTreeWalker(bubble, 4);
        let consumed = 0;
        let startNode = walker.currentNode;
        let foundStart = false;
        let startOffset = 0;
        let endNode = walker.currentNode;
        let foundEnd = false;
        let endOffset = 0;
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent ?? "";
          const next = consumed + text.length;
          if (!foundStart && start < next) {
            startNode = node;
            foundStart = true;
            startOffset = start - consumed;
          }
          if (!foundEnd && start + selectedText.length <= next) {
            endNode = node;
            foundEnd = true;
            endOffset = start + selectedText.length - consumed;
            break;
          }
          consumed = next;
        }
        if (!foundStart || !foundEnd) throw new Error("Missing selection range");
        const range = bubble.ownerDocument.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        const selectedRect = range.getClientRects()[0];
        const hostRect = host.getBoundingClientRect();
        return {
          blockTop: bubble.getBoundingClientRect().top - hostRect.top,
          selectedTop: selectedRect.top - hostRect.top,
          selectedBottom: selectedRect.bottom - hostRect.top,
          viewportHeight: host.clientHeight,
        };
      }, "Option Beta needs evidence.");
    expect(selectedPosition.blockTop).toBeLessThan(-500);
    expect(selectedPosition.selectedTop).toBeGreaterThan(40);
    expect(selectedPosition.selectedBottom).toBeLessThanOrEqual(
      selectedPosition.viewportHeight - 14,
    );
    const comment = pin.locator(".pincomment");
    expect(await comment.getAttribute("aria-label")).toBe("Comment on this pin");
    expect(await comment.getAttribute("class")).toContain("idle");
    expect(
      await comment.evaluate((button) => {
        const style = button.ownerDocument.defaultView?.getComputedStyle(button);
        return { background: style?.backgroundColor, color: style?.color };
      }),
    ).toEqual({ background: "rgba(0, 0, 0, 0)", color: "rgb(156, 163, 175)" });
    await comment.click();

    expect(await page.locator("#commentDrawer").isVisible()).toBe(true);
    expect(await page.locator("#commentAnchorContent").textContent()).toContain(
      "Option Beta needs evidence.",
    );
    await page.locator("#commentInput").fill("Check the evidence for this selection.");
    await page.locator("#commentSend").click();
    await expect
      .poll(() => commentBody)
      .toMatchObject({
        parentSessionId: "s1",
        anchorKey: selectionKey,
        anchorText: "Option Beta needs evidence.",
        question: "Check the evidence for this selection.",
      });
    await page.close();
  });

  it("jumps from chat-header First and Latest prompts to their user messages", async () => {
    const page = await browser.newPage({ viewport: { width: 900, height: 720 } });
    const baseSession = raceView.sessions[0];
    if (!baseSession) throw new Error("Missing base session fixture");
    const otherSessions = raceView.sessions.slice(1);
    const promptJumpView: ConsoleView = {
      ...raceView,
      sessions: [
        {
          ...baseSession,
          title: "First user prompt",
          lastPrompt: "Latest user prompt",
        },
        ...otherSessions,
      ],
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(promptJumpView) });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            { role: "user", text: "First user prompt" },
            { role: "assistant", text: "First long response. ".repeat(220) },
            { role: "user", text: "Middle user prompt" },
            { role: "assistant", text: "Second long response. ".repeat(220) },
            { role: "user", text: "Latest user prompt" },
          ],
        });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });

    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator('#list .item[data-session-id="s1"]').click();
    await expect.poll(() => page.locator("#msgs .msg.user").count()).toBe(3);

    const firstJump = page.locator("#h-sub .prompt-line:has(.prompt-line-first)");
    const latestJump = page.locator("#h-sub .prompt-line:has(.prompt-line-latest)");
    expect(await firstJump.getAttribute("role")).toBe("button");
    expect(await firstJump.getAttribute("tabindex")).toBe("0");
    expect(await latestJump.getAttribute("aria-label")).toBe("Jump to latest user message");

    await firstJump.click();
    const firstOffset = await page
      .locator("#msgs .msg.user")
      .first()
      .evaluate((node) => {
        const host = node.closest("#msgs");
        if (!host) throw new Error("Missing message scroller");
        return node.getBoundingClientRect().top - host.getBoundingClientRect().top;
      });
    expect(firstOffset).toBeGreaterThanOrEqual(0);
    expect(firstOffset).toBeLessThan(45);

    await latestJump.focus();
    await latestJump.press("Enter");
    const latestMessage = page.locator("#msgs .msg.user").last();
    await expect
      .poll(async () =>
        latestMessage.evaluate((node) => {
          const host = node.closest("#msgs");
          if (!host) throw new Error("Missing message scroller");
          return node.getBoundingClientRect().bottom - host.getBoundingClientRect().top;
        }),
      )
      .toBeLessThanOrEqual(await page.locator("#msgs").evaluate((host) => host.clientHeight - 14));
    const latestOffset = await latestMessage.evaluate((node) => {
      const host = node.closest("#msgs");
      if (!host) throw new Error("Missing message scroller");
      return node.getBoundingClientRect().top - host.getBoundingClientRect().top;
    });
    expect(latestOffset).toBeGreaterThanOrEqual(0);
    await page.close();
  });

  it("adds selected assistant text and a review instruction to the chat composer", async () => {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    let sentBody: Record<string, unknown> | null = null;
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(raceView) });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            {
              role: "assistant",
              text: "Option Alpha is safe. Option Beta needs evidence.",
            },
          ],
        });
      } else if (url.pathname === "/chat/send") {
        sentBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({ json: { ok: true, session: "s1" } });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator('#list .item[data-session-id="s1"]').click();
    const input = page.locator("#input");
    await input.fill("Existing review");
    const assistant = page.locator("#msgs > .msg.assistant");
    const bubble = assistant.locator(".bubble");
    await bubble.hover();
    await bubble.evaluate((node) => {
      const doc = node.ownerDocument;
      const walker = doc.createTreeWalker(node, 4);
      let textNode = walker.nextNode();
      while (textNode && !String(textNode.nodeValue).includes("Option Alpha")) {
        textNode = walker.nextNode();
      }
      if (!textNode) throw new Error("missing assistant text");
      const start = String(textNode.nodeValue).indexOf("Option Alpha");
      const range = doc.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, start + "Option Alpha is safe.".length);
      const selection = doc.defaultView?.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    await page.locator("#msgFloatReference").click({ force: true });
    await expect.poll(() => page.locator("#msgReferenceComposer").isVisible()).toBe(true);
    expect(await page.locator("#msgReferenceMark").textContent()).toBe("@ selected");
    expect(await page.locator("#msgReferencePreview").textContent()).toBe("Option Alpha is safe.");
    await page.locator("#msgReferenceInput").fill("Prove this against the failure cases.");
    await page.locator("#msgReferenceInput").press("Enter");

    await expect.poll(() => page.locator("#msgReferenceComposer").isHidden()).toBe(true);
    const firstPrompt =
      "Existing review\n\n@ selected\n> Option Alpha is safe.\n\n@ comment\nProve this against the failure cases.";
    expect(await input.inputValue()).toBe(firstPrompt);
    expect(await page.locator("#attachTray .pinrefchip").count()).toBe(0);
    expect(await page.locator("#pinTray .pinitem").count()).toBe(0);

    await bubble.hover();
    await bubble.evaluate((node) => {
      const doc = node.ownerDocument;
      const walker = doc.createTreeWalker(node, 4);
      let textNode = walker.nextNode();
      while (textNode && !String(textNode.nodeValue).includes("Option Beta")) {
        textNode = walker.nextNode();
      }
      if (!textNode) throw new Error("missing second assistant text");
      const start = String(textNode.nodeValue).indexOf("Option Beta");
      const range = doc.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, start + "Option Beta needs evidence.".length);
      const selection = doc.defaultView?.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    await page.locator("#msgFloatReference").click({ force: true });
    await page.locator("#msgReferenceInput").fill("Challenge the evidence for this option.");
    await page.locator("#msgReferenceInput").press("Enter");
    const expectedPrompt = `${firstPrompt}\n\n@ selected\n> Option Beta needs evidence.\n\n@ comment\nChallenge the evidence for this option.`;
    expect(await input.inputValue()).toBe(expectedPrompt);

    await page.locator("#send").click();
    await expect.poll(() => sentBody).not.toBeNull();
    expect(sentBody).toMatchObject({
      text: expectedPrompt,
      references: [],
    });
    await page.close();
  });

  it("keeps chars first and exposes the complete throughput data on hover", async () => {
    const page = await browser.newPage({
      viewport: { width: 360, height: 720 },
    });
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole({
            ...view,
            sessions1h: 8,
            prompts1h: 32,
            chars1h: 77_500,
          }),
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const stats = page.locator("#workStatsBtn");
    expect(
      await stats.locator(".statval").evaluateAll((values) => values.map((value) => value.id)),
    ).toEqual(["chars1h", "prompts1h", "sessions1h"]);
    const summary = "77.5k chars/1h · 32 pushes/1h · 8 sessions/1h";
    expect(await stats.getAttribute("data-hover-tip")).toBe(summary);
    await stats.hover();
    await expect.poll(() => page.locator("#hoverTip").textContent()).toBe(summary);
    await page.close();
  });

  it("hides unavailable vendors when at least one vendor is installed", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(unavailableVendorView),
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#newToggle").click();
    await page.locator("#nvendor").focus();

    expect(await page.locator("#nvendor").inputValue()).toBe("cursor");
    expect(await page.locator("#nvendorSug .chooser-opt").count()).toBe(1);
    expect(await page.locator("#nvendorSug .chooser-opt.unavailable").count()).toBe(0);
    expect(await page.locator('#nvendorSug .chooser-opt[data-value="cursor"]').count()).toBe(1);
    expect(await page.locator('#nvendorSug .chooser-opt[data-value="claude"]').count()).toBe(0);
    expect(await page.locator('#nvendorSug .chooser-opt[data-value="codex"]').count()).toBe(0);
    await page.locator("#nvendor").press("Escape");
    expect(await page.locator("#nvendorSug").isHidden()).toBe(true);
    expect(await page.locator("#newbox").getAttribute("class")).toContain("open");
    expect(
      await page.locator("#nvendor").evaluate((node) => node.ownerDocument.activeElement === node),
    ).toBe(true);
    await page.locator("#np").focus();
    await page.locator("#np").press("Escape");
    expect(await page.locator("#newbox").getAttribute("class")).not.toContain("open");
    await page.close();
  });

  it("shows unavailable vendors with recovery guidance when none are installed", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(allUnavailableVendorView),
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#newToggle").click();
    await page.locator("#nvendor").focus();

    expect(await page.locator("#nvendor").inputValue()).toBe("");
    expect(await page.locator("#nvendorSug .chooser-opt").count()).toBe(3);
    expect(await page.locator("#nvendorSug .chooser-opt.unavailable").count()).toBe(3);
    const claude = page.locator('#nvendorSug .chooser-opt[data-value="claude"]');
    expect(await claude.getAttribute("aria-disabled")).toBe("true");
    expect(await claude.locator(".chooser-opt-meta").textContent()).toBe(
      "Claude CLI 2.0.99 is too old. Attend requires 2.1.0 or newer. Update Claude Code, then restart Attend.",
    );
    await claude.click();
    expect(await page.locator("#nvendor").inputValue()).toBe("");
    expect(await page.locator("#nmsg").textContent()).toContain("Update Claude Code");
    await page.close();
  });

  it("keeps the session title editor open when Enter confirms an IME candidate", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(raceView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await page.locator("#titleEditBtn").click();

    const input = page.locator(".title-edit-input");
    await input.fill("中文候选");
    await input.dispatchEvent("compositionstart", { data: "中文" });
    await input.dispatchEvent("keydown", {
      code: "Enter",
      key: "Enter",
    });
    expect(await input.count()).toBe(1);
    expect(await input.inputValue()).toBe("中文候选");

    await input.dispatchEvent("compositionend", { data: "中文候选" });
    await input.press("Enter");
    await expect.poll(() => page.locator(".title-edit-input").count()).toBe(0);
    expect(await page.locator("#h-title .session-title-main").textContent()).toBe("中文候选");
    await page.close();
  });

  it("pins and unpins the open session from the chat header beside Refresh", async () => {
    const page = await browser.newPage();
    const pinPatches: Array<Record<string, number | null>> = [];
    const pinnedView: ConsoleView = {
      ...raceView,
      vaultState: { ...raceView.vaultState, sessionPins: { s1: 1 } },
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(pinnedView),
        });
      } else if (url.pathname === "/vault/ui-state") {
        const body = request.postDataJSON() as {
          sessionPins?: Record<string, number | null>;
        };
        if (body.sessionPins) pinPatches.push(body.sessionPins);
        await route.fulfill({ json: { ok: true } });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator('#list .item[data-session-id="s1"]').click();

    const headerPin = page.locator("#headerPinBtn");
    expect(
      await page.locator(".head-actions").evaluate((actions) => {
        const refresh = actions.querySelector("#refreshBtn");
        const pin = actions.querySelector("#headerPinBtn");
        return !!(refresh && pin && refresh.compareDocumentPosition(pin) & 4);
      }),
    ).toBe(true);
    expect(await headerPin.getAttribute("aria-label")).toBe("Unpin session");
    expect(await headerPin.getAttribute("aria-pressed")).toBe("true");
    expect(await headerPin.getAttribute("class")).toContain("on");

    await headerPin.click();
    await expect.poll(() => pinPatches.some((patch) => patch.s1 === null)).toBe(true);
    expect(await headerPin.getAttribute("aria-label")).toBe("Pin session to top");
    expect(await headerPin.getAttribute("aria-pressed")).toBe("false");
    expect(
      await page.locator('#list .item[data-session-id="s1"] .it-pin').getAttribute("aria-pressed"),
    ).toBe("false");

    await headerPin.click();
    await expect
      .poll(() => pinPatches.some((patch) => typeof patch.s1 === "number" && patch.s1 > 1))
      .toBe(true);
    expect(await headerPin.getAttribute("aria-label")).toBe("Unpin session");
    expect(await headerPin.getAttribute("aria-pressed")).toBe("true");
    expect(
      await page.locator('#list .item[data-session-id="s1"] .it-pin').getAttribute("aria-pressed"),
    ).toBe("true");
    await page.close();
  });

  it("arms Goal from the new-session input and keeps its controls at bottom right", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    let sentBody: Record<string, unknown> | null = null;
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(pendingTagView),
        });
      } else if (url.pathname === "/chat/new") {
        sentBody = request.postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          json: {
            ok: true,
            session: "new-goal-1",
            cwd: "/tmp/project",
            goal: {
              objective: "finish and verify the opener",
              vendor: "claude",
              status: "active",
            },
          },
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#newToggle").click();

    const positions = await page.locator(".newmsgrow").evaluate((row) => {
      const rowRect = row.getBoundingClientRect();
      const attach = row.querySelector("#nattach");
      const goal = row.querySelector("#newGoalToggle");
      if (!attach || !goal) throw new Error("missing new-session controls");
      const attachRect = attach.getBoundingClientRect();
      const goalRect = goal.getBoundingClientRect();
      return {
        attachBeforeGoal: attachRect.right <= goalRect.left,
        attachNearBottom: rowRect.bottom - attachRect.bottom < 12,
        goalNearBottom: rowRect.bottom - goalRect.bottom < 12,
      };
    });
    expect(positions).toEqual({
      attachBeforeGoal: true,
      attachNearBottom: true,
      goalNearBottom: true,
    });

    await page.locator("#newGoalToggle").click();
    expect(await page.locator("#newGoalToggle").getAttribute("class")).toContain("armed");
    expect(await page.locator("#np").getAttribute("placeholder")).toContain("completion");
    await page.locator("#np").fill("finish and verify the opener");
    await page.locator("#nbtn").click();
    await expect
      .poll(() => sentBody)
      .toMatchObject({
        text: "finish and verify the opener",
        goal: true,
      });
    await expect.poll(() => page.locator("#goalToggle").isEnabled()).toBe(true);
    expect(await page.locator("#goalToggle").getAttribute("class")).toContain("active");
    await page.close();
  });

  it("shows an English sign-in card, copies the command, and retries the failed turn", async () => {
    const page = await browser.newPage();
    const sentBodies: Array<Record<string, unknown>> = [];
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as {
        __copiedCommand?: string;
        __eventSource?: {
          onmessage: ((event: { data: string }) => void) | null;
        };
      };
      class StubEventSource {
        static readonly CLOSED = 2;
        onmessage: ((event: { data: string }) => void) | null = null;
        constructor() {
          browserGlobal.__eventSource = this;
        }
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
      Object.defineProperty(globalThis.navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            browserGlobal.__copiedCommand = text;
          },
        },
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(raceView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/chat/send") {
        sentBodies.push(route.request().postDataJSON() as Record<string, unknown>);
        await route.fulfill({ json: { ok: true, session: "s1" } });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await page.locator("#input").fill("continue after signing in");
    await page.locator("#send").click();
    await expect.poll(() => sentBodies.length).toBe(1);

    await page.evaluate(() => {
      const source = (
        globalThis as unknown as {
          __eventSource?: {
            onmessage: ((event: { data: string }) => void) | null;
          };
        }
      ).__eventSource;
      const publish = (event: Record<string, unknown>) =>
        source?.onmessage?.({
          data: JSON.stringify({
            kind: "session_event",
            sessionId: "s1",
            emittedAt: Date.now(),
            event,
          }),
        });
      publish({ kind: "user_turn_started", text: "continue after signing in" });
      publish({
        kind: "error",
        code: "claude_auth_required",
        vendor: "claude",
        message: "Claude sign-in is required. Run `claude auth login`, then retry.",
        command: "claude auth login",
        retryable: false,
      });
    });

    const card = page.locator("#msgs .provider-error-card");
    await expect.poll(() => card.count()).toBe(1);
    expect(await card.locator(".provider-error-title").textContent()).toBe(
      "Claude sign-in required",
    );
    expect(await card.locator(".provider-error-command code").textContent()).toBe(
      "claude auth login",
    );
    expect(await card.locator(".provider-error-retry").textContent()).toBe(
      "I've signed in — retry",
    );

    await card.locator(".provider-error-copy").click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (globalThis as unknown as { __copiedCommand?: string }).__copiedCommand ?? "",
        ),
      )
      .toBe("claude auth login");

    await card.locator(".provider-error-retry").click();
    await expect.poll(() => sentBodies.length).toBe(2);
    expect(sentBodies[1]).toMatchObject({
      text: "continue after signing in",
      attachments: [],
    });
    await expect.poll(() => page.locator("#msgs .provider-error-card").count()).toBe(0);
    await page.close();
  });

  it("restores a failed new-session form and retries it after sign-in", async () => {
    const page = await browser.newPage();
    let attempts = 0;
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(pendingTagView),
        });
      } else if (url.pathname === "/chat/new") {
        attempts++;
        if (attempts === 1) {
          await route.fulfill({
            status: 401,
            json: {
              ok: false,
              code: "claude_auth_required",
              vendor: "claude",
              error: "Claude sign-in is required. Run `claude auth login`, then retry.",
              command: "claude auth login",
              retryable: false,
            },
          });
        } else {
          await route.fulfill({
            json: {
              ok: true,
              session: "new-auth-1",
              cwd: "/tmp/recent-project",
            },
          });
        }
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#newToggle").click();
    await page.locator("#np").fill("start after signing in");
    await page.locator("#nbtn").click();

    await expect.poll(() => attempts).toBe(1);
    await expect.poll(() => page.locator("#newbox").getAttribute("class")).toContain("open");
    expect(await page.locator("#np").inputValue()).toBe("start after signing in");
    expect(await page.locator("#nmsg .provider-error-title").textContent()).toBe(
      "Claude sign-in required",
    );

    await page.locator("#nmsg .provider-error-retry").click();
    await expect.poll(() => attempts).toBe(2);
    await expect.poll(() => page.locator("#newbox").getAttribute("class")).not.toContain("open");
    await page.locator("#newToggle").click();
    expect(await page.locator("#ndir").inputValue()).toBe("/tmp/recent-project");
    await page.close();
  });

  it("cascades Cursor effort and speed only through advertised matrix rows", async () => {
    const page = await browser.newPage();
    let sentBody: Record<string, unknown> | null = null;
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(cursorMatrixView),
        });
      } else if (url.pathname === "/models/cursor") {
        await route.fulfill({
          json: {
            models: cursorMatrixView.cursorModels,
            defaults: cursorMatrixView.modelDefaults?.cursor,
            warning: null,
          },
        });
      } else if (url.pathname === "/chat/new") {
        sentBody = request.postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          json: { ok: true, session: "cursor-1", cwd: "/tmp/project" },
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#newToggle").click();

    expect(await page.locator("#neffort").inputValue()).toBe("medium");
    expect(await page.locator("#nspeed").inputValue()).toBe("false");
    await page.locator("#nspeed").selectOption("true");
    expect(await page.locator("#neffort").inputValue()).toBe("high");
    await page.locator("#neffort").selectOption("medium");
    expect(await page.locator("#nspeed").inputValue()).toBe("false");
    await page.locator("#nspeed").selectOption("true");
    await page.locator("#np").fill("use the fast row");
    await page.locator("#nbtn").click();
    await expect.poll(() => sentBody).not.toBeNull();
    expect(sentBody).toMatchObject({
      model: "gpt-5.3-codex",
      effort: "high",
      speed: "true",
    });
    await page.close();
  });

  it("keeps New Session config menus readable in a narrow sidebar", async () => {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 800 },
    });
    await page.addInitScript(() => {
      localStorage.setItem("attend.sideW", "200");
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(cursorMatrixView),
        });
      } else if (url.pathname === "/models/cursor") {
        await route.fulfill({
          json: {
            models: cursorMatrixView.cursorModels,
            defaults: cursorMatrixView.modelDefaults?.cursor,
            warning: null,
          },
        });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#newToggle").click();
    await expect.poll(() => page.locator("#nmodel").inputValue()).toBe("gpt-5.3-codex");

    const vendorInputBox = await page.locator("#nvendor").boundingBox();
    await page.locator("#nvendor").focus();
    const vendorMenu = page.locator("#nvendorSug");
    const vendorMenuBox = await vendorMenu.boundingBox();
    if (!vendorInputBox || !vendorMenuBox) {
      throw new Error("New Session vendor picker layout is unavailable");
    }
    expect(vendorMenuBox.width).toBeGreaterThanOrEqual(135);
    expect(vendorMenuBox.width).toBeGreaterThan(vendorInputBox.width);
    expect(
      await vendorMenu.evaluate((menu) => menu.parentElement === menu.ownerDocument.body),
    ).toBe(true);
    const selectedVendor = vendorMenu.locator('.chooser-opt[aria-selected="true"]');
    expect(await selectedVendor.getAttribute("data-value")).toBe("cursor");
    expect(await selectedVendor.locator(".chooser-vendor-mark").count()).toBe(1);
    expect(await selectedVendor.locator(".selectopt-check").textContent()).toBe("✓");

    const formBox = await page.locator("#newbox").boundingBox();
    const modelButtonBox = await page.locator("#nmodelButton").boundingBox();
    await page.locator("#nmodelButton").click();
    const modelMenu = page.locator("#nmodelMenu");
    const modelMenuBox = await modelMenu.boundingBox();
    if (!formBox || !modelButtonBox || !modelMenuBox) {
      throw new Error("New Session model picker layout is unavailable");
    }
    expect(modelMenuBox.width).toBeGreaterThanOrEqual(167);
    expect(modelMenuBox.width).toBeGreaterThan(modelButtonBox.width);
    expect(modelMenuBox.x + modelMenuBox.width).toBeGreaterThan(formBox.x + formBox.width);
    expect(await modelMenu.evaluate((menu) => menu.parentElement === menu.ownerDocument.body)).toBe(
      true,
    );
    const surfaceStyle = await modelMenu.evaluate((menu) => {
      const style = menu.ownerDocument.defaultView?.getComputedStyle(menu);
      return {
        backdropFilter: style?.backdropFilter,
        borderStyle: style?.borderTopStyle,
        background: style?.backgroundColor,
      };
    });
    expect(surfaceStyle.backdropFilter).not.toBe("none");
    expect(surfaceStyle.borderStyle).toBe("solid");
    expect(surfaceStyle.background).not.toBe("rgba(0, 0, 0, 0)");

    await page.locator("#nmodelButton").press("Escape");
    expect(await modelMenu.isHidden()).toBe(true);
    expect(await page.locator("#newbox").getAttribute("class")).toContain("open");
    expect(
      await page
        .locator("#nmodelButton")
        .evaluate((node) => node.ownerDocument.activeElement === node),
    ).toBe(true);

    await page.locator("#neffortButton").click();
    const selected = page.locator('#neffortMenu .selectopt[aria-selected="true"]');
    const unselected = page.locator('#neffortMenu .selectopt[aria-selected="false"]').first();
    expect(await selected.locator(".selectopt-check").textContent()).toBe("✓");
    const optionBackgrounds = await Promise.all([
      selected.evaluate(
        (option) => option.ownerDocument.defaultView?.getComputedStyle(option).backgroundColor,
      ),
      unselected.evaluate(
        (option) => option.ownerDocument.defaultView?.getComputedStyle(option).backgroundColor,
      ),
    ]);
    expect(optionBackgrounds[0]).not.toBe(optionBackgrounds[1]);
    await unselected.click();
    expect(await page.locator("#neffort").inputValue()).toBe("high");
    expect(await page.locator("#neffortMenu").isHidden()).toBe(true);
    await page.close();
  });

  it("hosts the narrow New Session form in the open middle panel while keeping it button-anchored", async () => {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 800 },
    });
    const hostedNewSessionView: ConsoleView = {
      ...raceView,
      tags: ["work", "urgent"],
    };
    await page.addInitScript(() => {
      localStorage.setItem("attend.sideW", "240");
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(hostedNewSessionView),
        });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#sessionPanelToggle").click();
    await page.locator("#newToggle").click();

    const form = page.locator("#newbox");
    expect(await form.getAttribute("class")).toContain("panel-hosted");
    await page.waitForTimeout(220);
    await page.locator("#newTagAdd").click();
    expect(await page.locator("#newTagMenu").isVisible()).toBe(true);
    // Custom-select buttons stop click propagation; the tag picker still needs
    // to dismiss when any control outside it is pressed.
    await page.locator("#nmodelButton").click();
    expect(await page.locator("#newTagMenu").isHidden()).toBe(true);
    await page.locator("#nmodelButton").press("Escape");
    await page.locator("#newTagAdd").click();
    await page.locator("#newTagInput").fill("urg");
    await page.locator("#newTagInput").press("ArrowDown");
    expect(await page.locator("#newTagSug .newtagopt.on").textContent()).toContain("urgent");
    await page.locator("#newTagInput").press("Enter");
    expect(await page.locator("#newTags .newtagchip", { hasText: "urgent" }).count()).toBe(1);
    expect(await page.locator("#newTagMenu").isHidden()).toBe(true);
    const layout = await page.locator("body").evaluate((body) => {
      const box = body.querySelector("#newbox")?.getBoundingClientRect();
      const button = body.querySelector("#newToggle")?.getBoundingClientRect();
      const panel = body.querySelector("#sessionPanel")?.getBoundingClientRect();
      const side = body.querySelector(".side")?.getBoundingClientRect();
      if (!box || !button || !panel || !side)
        throw new Error("New Session panel layout is unavailable");
      const rect = (value: typeof box) => ({
        x: value.x,
        y: value.y,
        width: value.width,
        height: value.height,
      });
      return {
        box: rect(box),
        button: rect(button),
        panel: rect(panel),
        side: rect(side),
      };
    });
    expect(layout.box.width).toBeCloseTo(
      Math.min(
        576,
        layout.panel.x + layout.panel.width - 8 - (layout.button.x + layout.button.width + 6),
      ),
      0,
    );
    expect(layout.box.x).toBeCloseTo(layout.button.x + layout.button.width + 6, 0);
    expect(layout.box.y).toBeCloseTo(layout.button.y, 0);
    expect(layout.box.width).toBeGreaterThan(layout.side.width);

    await page.locator("#sessionPanelToggle").click();
    expect(await form.getAttribute("class")).not.toContain("panel-hosted");
    const restored = await form.boundingBox();
    if (!restored) throw new Error("Restored New Session form is unavailable");
    expect(restored.x + restored.width).toBeLessThanOrEqual(layout.side.x + layout.side.width);
    await page.close();
  });

  it("opens ordinary sessions independently and groups only dropped sessions and forks", async () => {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 800 },
    });
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(raceView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    await page.locator('#list .item[data-session-id="s1"]').click();
    expect(await page.locator("#chatTabs").isHidden()).toBe(true);
    expect(await page.locator("#chatTabs .chat-tab").count()).toBe(1);
    await page.locator('#list .item[data-session-id="s2"]').click();
    expect(await page.locator("#chatTabs").isHidden()).toBe(true);
    expect(await page.locator("#chatTabs .chat-tab").count()).toBe(1);
    expect(await page.locator("#h-title").textContent()).toContain("Other session");

    await page.locator('#list .item[data-session-id="s1"]').click();
    expect(await page.locator("#chatTabs").isHidden()).toBe(true);
    expect(await page.locator("#h-title").textContent()).toContain("Avoidance session");

    await page.locator('#list .item[data-session-id="s2"]').dragTo(page.locator("#msgs"));
    expect(await page.locator("#chatTabs").isVisible()).toBe(true);
    expect(await page.locator("#chatTabs .chat-tab").count()).toBe(2);
    expect(await page.locator("#chatTabs .chat-tab.on").getAttribute("data-session-id")).toBe("s2");

    await page.locator('#list .item[data-session-id="s1"]').click();
    expect(await page.locator("#chatTabs .chat-tab").count()).toBe(2);
    expect(await page.locator("#chatTabs .chat-tab.on").getAttribute("data-session-id")).toBe("s1");
    await page.locator("#forkBtn").click();
    expect(await page.locator("#chatTabs .chat-tab").count()).toBe(3);
    expect(await page.locator("#chatTabs .chat-tab-label").allTextContents()).toContain(
      "(fork) Avoidance session",
    );
    await page.close();
  });

  it("windows large session lists and transcripts without rebuilding rows on chat switches", async () => {
    const page = await browser.newPage({ viewport: { width: 1200, height: 820 } });
    page.setDefaultTimeout(4_000);
    const baseSession = raceView.sessions[0];
    if (!baseSession) throw new Error("Missing base session fixture");
    const sessions = Array.from({ length: 220 }, (_, index) => ({
      ...baseSession,
      sessionId: `large-${index}`,
      title: `Large session ${index}`,
      brief: `Large session ${index}`,
      lastPrompt: `Latest prompt ${index}`,
      file: `/tmp/large-${index}.jsonl`,
      lastTs: 10_000 - index,
      sortTs: 10_000 - index,
      seen: true,
      unread: false,
    }));
    const transcript = Array.from({ length: 170 }, (_, index) => [
      { role: "user", text: `User turn ${index}` },
      { role: "assistant", text: `Assistant turn ${index}. ${"detail ".repeat(24)}` },
    ]).flat();
    const largeView: ConsoleView = { ...raceView, sessions };
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(largeView) });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: transcript });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });

    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await expect.poll(() => page.locator("#list .item").count()).toBeLessThan(45);

    await page.locator("#sessionPanelToggle").click();
    await expect.poll(() => page.locator("#sessionPanelList .item").count()).toBeGreaterThan(0);
    expect(await page.locator("#sessionPanelList .item").count()).toBeLessThan(30);
    await page.locator("#sessionPanel").evaluate((panel) => {
      panel.scrollTop = panel.scrollHeight;
      panel.dispatchEvent(new Event("scroll"));
    });
    await expect
      .poll(() => page.locator('#sessionPanelList .item[data-session-id="large-219"]').count())
      .toBe(1);
    expect(await page.locator("#sessionPanelList .item").count()).toBeLessThan(30);

    const firstRow = page.locator('#list .item[data-session-id="large-0"]');
    await firstRow.click();
    await expect
      .poll(() => page.locator("#msgs").getAttribute("data-transcript-total-blocks"))
      .toBe("340");
    expect(await page.locator("#msgs .msg, #msgs .toolc").count()).toBeLessThan(80);
    await firstRow.evaluate((row) => row.setAttribute("data-switch-sentinel", "stable"));

    await page.locator('#list .item[data-session-id="large-1"]').click();
    await expect.poll(() => page.locator("#h-title").textContent()).toContain("Large session 1");
    expect(await firstRow.getAttribute("data-switch-sentinel")).toBe("stable");
    await expect
      .poll(() => page.locator("#msgs").getAttribute("data-transcript-total-blocks"))
      .toBe("340");
    expect(await page.locator("#msgs .msg, #msgs .toolc").count()).toBeLessThan(80);

    await page.locator("#h-sub .prompt-line:has(.prompt-line-first)").click();
    await expect
      .poll(() => page.locator("#msgs .msg.user").filter({ hasText: "User turn 0" }).count())
      .toBe(1);
    const firstOffset = await page
      .locator("#msgs .msg.user")
      .filter({ hasText: "User turn 0" })
      .evaluate((node) => {
        const host = node.closest("#msgs");
        if (!host) throw new Error("Missing message scroller");
        return node.getBoundingClientRect().top - host.getBoundingClientRect().top;
      });
    expect(firstOffset).toBeGreaterThanOrEqual(0);
    expect(firstOffset).toBeLessThan(50);
    await page
      .locator("#msgs .msg.assistant")
      .filter({ hasText: "Assistant turn 0" })
      .evaluate((node) => {
        const pageGlobal = globalThis as unknown as {
          document: {
            createRange(): { selectNodeContents(node: unknown): void };
          };
          getSelection(): {
            removeAllRanges(): void;
            addRange(range: unknown): void;
          } | null;
        };
        const bubble = node.querySelector(".bubble");
        const text = bubble?.firstChild;
        if (!bubble || !text) throw new Error("Missing assistant text");
        const range = pageGlobal.document.createRange();
        range.selectNodeContents(bubble);
        const selection = pageGlobal.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        const host = node.closest("#msgs");
        if (!host) throw new Error("Missing message scroller");
        host.scrollTop += 8_000;
        host.dispatchEvent(new Event("scroll"));
      });
    await page.waitForTimeout(50);
    expect(
      await page.evaluate(() =>
        String(
          (
            globalThis as unknown as {
              getSelection(): { toString(): string } | null;
            }
          ).getSelection(),
        ),
      ),
    ).toContain("Assistant turn 0");
    await page.evaluate(() =>
      (
        globalThis as unknown as {
          getSelection(): { removeAllRanges(): void } | null;
        }
      )
        .getSelection()
        ?.removeAllRanges(),
    );
    await page.locator("#msgs").evaluate((host) => host.dispatchEvent(new Event("scroll")));
    await expect.poll(() => page.locator("#msgs .msg, #msgs .toolc").count()).toBeLessThan(80);
    expect(pageErrors).toEqual([]);
    await page.close();
  });

  it("restores existing fork relations as a chat tab group", async () => {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 800 },
    });
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(forkTreeView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator('#list .item[data-session-id="s2"]').click();

    expect(await page.locator("#chatTabs").isVisible()).toBe(true);
    expect(await page.locator("#chatTabs .chat-tab").count()).toBe(2);
    expect(await page.locator("#chatTabs .chat-tab.on").getAttribute("data-session-id")).toBe("s2");
    await page.close();
  });

  it("uses relative prompt times on sidebar, panel, header, and fork-tree cards", async () => {
    const now = Date.now();
    const timedView: ConsoleView = {
      ...forkTreeView,
      sessions: forkTreeView.sessions.map((session, index) => ({
        ...session,
        title: index === 0 ? "Original prompt" : session.title,
        lastPrompt: index === 0 ? "Most recent prompt" : session.lastPrompt,
        lastTs: index === 0 ? now - 2 * 60_000 : now - 3 * 60_000,
        userPromptTs: index === 0 ? [now - 2 * 60 * 60_000, now - 5 * 60_000] : [now - 30 * 60_000],
      })),
    };
    const page = await browser.newPage({
      viewport: { width: 1100, height: 800 },
    });
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(timedView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const sidebarCard = page.locator('#list .item[data-session-id="s1"]');
    expect(await sidebarCard.locator(".prompt-line-label").allTextContents()).toEqual(["2h", "5m"]);
    expect(await sidebarCard.locator(".it-age").textContent()).toBe("2m");

    await page.locator("#sessionPanelToggle").click();
    const panelCard = page.locator('#sessionPanelList .item[data-session-id="s1"]');
    expect(await panelCard.locator(".prompt-line-label").allTextContents()).toEqual(["2h", "5m"]);

    await sidebarCard.click();
    expect(await page.locator("#h-sub .prompt-line-label").allTextContents()).toEqual(["2h", "5m"]);
    await page.locator("#forkTreeBtn").click();
    const treeCard = page.locator('.forktree-node[data-forktree-node-id="s1"]');
    expect(await treeCard.locator(".prompt-line-label").allTextContents()).toEqual(["2h", "5m"]);
    await page.close();
  });

  it("restores persisted chat groups and preserves members outside the launch scope", async () => {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 800 },
    });
    const uiPatches: Array<Record<string, unknown>> = [];
    const scopedView: ConsoleView = {
      ...raceView,
      scopeRoots: ["/tmp/project"],
      vaultState: {
        chatGroups: {
          persisted: {
            id: "persisted",
            members: [
              { vendor: "claude", sessionId: "s1" },
              { vendor: "codex", sessionId: "outside-this-scope" },
            ],
            updatedAt: 10,
          },
        },
      },
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(scopedView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/vault/ui-state" && route.request().method() === "POST") {
        uiPatches.push(route.request().postDataJSON() as Record<string, unknown>);
        await route.fulfill({ json: { ok: true } });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator('#list .item[data-session-id="s1"]').click();
    expect(await page.locator("#chatTabs").isHidden()).toBe(true);

    await page.locator('#list .item[data-session-id="s2"]').dragTo(page.locator("#msgs"));
    await expect.poll(() => uiPatches.length).toBeGreaterThan(0);
    expect(await page.locator("#chatTabs .chat-tab").count()).toBe(2);

    const persisted = uiPatches
      .map((patch) => patch.chatGroups as Record<string, { members?: unknown[] }> | undefined)
      .find((groups) => groups?.persisted)?.persisted;
    expect(persisted?.members).toEqual([
      { vendor: "codex", sessionId: "outside-this-scope" },
      { vendor: "claude", sessionId: "s1" },
      { vendor: "claude", sessionId: "s2" },
    ]);
    await page.close();
  });

  it("opens recent sessions for a header tag in their own chat group", async () => {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 800 },
    });
    const taggedView: ConsoleView = {
      ...raceView,
      tags: ["work"],
      sessions: raceView.sessions.map((session, index) => ({
        ...session,
        tags: ["work"],
        lastTs: index === 0 ? 100 : 300,
      })),
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(taggedView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator('#list .item[data-session-id="s1"]').click();
    const headerTag = page.locator("#h-tags .headtag-nav");
    expect(
      await headerTag.evaluate(
        (node) => node.ownerDocument.defaultView?.getComputedStyle(node, "::after").content,
      ),
    ).toBe("none");
    await headerTag.click();

    const options = page.locator("#headerTagSessionMenu .headtag-session-option");
    expect(await options.count()).toBe(2);
    expect(await options.first().textContent()).toContain("Other session");
    expect(await options.first().locator(".headtag-session-copy").count()).toBe(1);
    expect(await options.first().locator(".headtag-session-heading .chat-tab-status").count()).toBe(
      1,
    );
    expect(await options.first().locator(".headtag-session-meta").textContent()).toContain(
      "claude",
    );
    const alignment = await options.first().evaluate((option) => {
      const status = option.querySelector(".chat-tab-status")?.getBoundingClientRect();
      const title = option.querySelector(".headtag-session-title")?.getBoundingClientRect();
      if (!status || !title) return Number.POSITIVE_INFINITY;
      return Math.abs(status.y + status.height / 2 - (title.y + title.height / 2));
    });
    expect(alignment).toBeLessThanOrEqual(1);
    expect(await page.locator("#headerTagSessionMenu .headtag-session-current").count()).toBe(1);
    await options.first().click();
    expect(await page.locator("#h-title").textContent()).toContain("Other session");
    expect(await page.locator("#chatTabs").isHidden()).toBe(true);
    expect(await page.locator("#chatTabs .chat-tab").count()).toBe(1);
    expect(await page.locator("#headerTagSessionMenu").count()).toBe(0);
    await page.close();
  });

  it("preserves link query strings and never auto-uploads PlantUML source", async () => {
    const page = await browser.newPage();
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (/plantuml\.com|jsdelivr\.net/.test(request.url())) externalRequests.push(request.url());
    });
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as {
        fetch: typeof fetch;
        EventSource: unknown;
      };
      browserGlobal.fetch = async () =>
        new Response("{}", { headers: { "content-type": "application/json" } });
      class StubEventSource {
        static readonly CLOSED = 2;
        onopen: (() => void) | null = null;
        onmessage: (() => void) | null = null;
        onerror: (() => void) | null = null;
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.setContent(renderConsole(view), {
      waitUntil: "domcontentloaded",
    });

    expect(
      await page.locator('.changelog-content a[href^="https://example.test"]').getAttribute("href"),
    ).toBe("https://example.test/?a=1&b=2");
    expect(await page.locator(".diagram-plantuml .diagram-render").isVisible()).toBe(true);
    expect(await page.locator(".diagram-plantuml img").count()).toBe(0);
    expect(externalRequests).toEqual([]);
    await page.close();
  });

  it("auto-links complete bare URLs without requiring a leading boundary", async () => {
    const page = await browser.newPage();
    const linksView: ConsoleView = {
      ...view,
      changelogMarkdown: [
        "两个 PR 链接：",
        "",
        "- **ai_call（后端 #913）**：https://github.com/shaling-ai/ai_call/pull/913（后端匿名守卫 + 测试）",
        "- **ai_phone（客户端 #958）**：https://github.com/shaling-ai/ai_phone/pull/958(客户端 family 登录)",
        "- 紧贴中文https://example.test/chinese",
        "- prefixhttp://example.test/english",
        "- 合法括号：https://en.wikipedia.org/wiki/Function_(mathematics)",
        "- 多语言路径：https://example.test/путь/路径",
        "- Unicode 标点：https://example.test/release—后续说明",
        "- 多余右括号：https://example.test/foo_(bar)).",
      ].join("\n"),
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.setContent(renderConsole(linksView), {
      waitUntil: "domcontentloaded",
    });

    const links = page.locator(".changelog-content a");
    expect(await links.count()).toBe(8);
    expect(await links.nth(0).getAttribute("href")).toBe(
      "https://github.com/shaling-ai/ai_call/pull/913",
    );
    expect(await links.nth(1).getAttribute("href")).toBe(
      "https://github.com/shaling-ai/ai_phone/pull/958",
    );
    expect(await links.nth(2).getAttribute("href")).toBe("https://example.test/chinese");
    expect(await links.nth(3).getAttribute("href")).toBe("http://example.test/english");
    expect(await links.nth(4).getAttribute("href")).toBe(
      "https://en.wikipedia.org/wiki/Function_(mathematics)",
    );
    expect(await links.nth(5).getAttribute("href")).toBe("https://example.test/путь/路径");
    expect(await links.nth(6).getAttribute("href")).toBe("https://example.test/release");
    expect(await links.nth(7).getAttribute("href")).toBe("https://example.test/foo_(bar)");
    expect(await links.nth(0).textContent()).toBe("https://github.com/shaling-ai/ai_call/pull/913");
    expect(await links.nth(1).textContent()).toBe(
      "https://github.com/shaling-ai/ai_phone/pull/958",
    );
    expect(await page.locator(".changelog-content").textContent()).toContain(
      "/pull/913（后端匿名守卫 + 测试）",
    );
    expect(await page.locator(".changelog-content").textContent()).toContain("/foo_(bar)).");
    await page.close();
  });

  it("opens a long changelog at the top without changing chat history bottom pinning", async () => {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 600 },
    });
    const scrollView: ConsoleView = {
      ...raceView,
      changelogMarkdown: Array.from(
        { length: 120 },
        (_, index) => `## Change ${index + 1}\n\n- Changelog entry ${index + 1}`,
      ).join("\n\n"),
    };
    const history = Array.from({ length: 80 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      text: `History message ${index + 1}`,
    }));
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(scrollView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: history });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    await expect
      .poll(() =>
        page.locator("#msgs").evaluate((host) => ({
          top: host.scrollTop,
          overflowing: host.scrollHeight > host.clientHeight,
        })),
      )
      .toEqual({ top: 0, overflowing: true });

    await page.locator('#list .item[data-session-id="s1"]').click();
    await expect.poll(() => page.locator("#msgs .msg").count()).toBe(history.length);
    await expect
      .poll(() =>
        page.locator("#msgs").evaluate((host) => ({
          top: host.scrollTop,
          max: host.scrollHeight - host.clientHeight,
        })),
      )
      .toSatisfy(({ top, max }) => max > 0 && Math.abs(top - max) <= 1);

    await page.close();
  });

  it("restores idle reading but keeps bottom intent across background generation", async () => {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 600 },
    });
    const histories = {
      s1: [
        { role: "user", text: "First session message 1" },
        {
          role: "assistant",
          text: Array.from(
            { length: 160 },
            (_, index) => `Long answer paragraph ${index + 1}.`,
          ).join("\n\n"),
        },
      ],
      s2: Array.from({ length: 100 }, (_, index) => ({
        role: index % 2 === 0 ? "user" : "assistant",
        text: `Second session message ${index + 1}`,
      })),
    };
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as Record<string, unknown>;
      class StubEventSource {
        static readonly CLOSED = 2;
        onmessage: ((event: { data: string }) => void) | null = null;
        constructor() {
          browserGlobal.__sessionScrollEventSource = this;
        }
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(raceView),
        });
      } else if (url.pathname === "/chat/messages") {
        const sessionId = url.searchParams.get("file") === "/tmp/session-1.jsonl" ? "s1" : "s2";
        await route.fulfill({ json: histories[sessionId] });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const messages = page.locator("#msgs");
    await page.locator('#list .item[data-session-id="s1"]').click();
    await expect.poll(() => page.locator("#msgs .msg").count()).toBe(histories.s1.length);
    const reading = await messages.evaluate((host) => {
      const user = host.querySelector(".msg.user");
      const answer = host.querySelector(".msg.assistant");
      if (!user || !answer) throw new Error("Long test turn is missing");
      const hostRect = host.getBoundingClientRect();
      const visibleHeight = host.clientHeight;
      const start = user.getBoundingClientRect().top - hostRect.top + host.scrollTop;
      const end = answer.getBoundingClientRect().bottom - hostRect.top + host.scrollTop;
      const desiredReadAt = start + (end - start) * 0.45;
      host.scrollTop = desiredReadAt - visibleHeight;
      return {
        top: host.scrollTop,
        unreadRatio: (end - (host.scrollTop + visibleHeight)) / (end - start),
      };
    });
    expect(reading.top).toBeGreaterThan(0);

    await page.locator('#list .item[data-session-id="s2"]').click();
    await expect
      .poll(() => page.locator("#msgs .bubble").first().textContent())
      .toContain("Second session message 1");
    const progress = page.locator('#list .item[data-session-id="s1"] .session-read-progress');
    expect(await progress.isVisible()).toBe(true);
    expect(Number(await progress.getAttribute("data-unread-ratio"))).toBeCloseTo(
      reading.unreadRatio,
      2,
    );
    const expectedRailRatio = Math.log(1 + 9 * reading.unreadRatio) / Math.log(10);
    expect(Number(await progress.getAttribute("data-rail-ratio"))).toBeCloseTo(
      expectedRailRatio,
      4,
    );
    const [progressBox, cardBox] = await Promise.all([
      progress.boundingBox(),
      page.locator('#list .item[data-session-id="s1"]').boundingBox(),
    ]);
    if (!progressBox || !cardBox) throw new Error("Session reading progress geometry is missing");
    expect(
      Math.abs(progressBox.x + progressBox.width - (cardBox.x + cardBox.width)),
    ).toBeLessThanOrEqual(1);
    expect(progressBox.height / cardBox.height).toBeCloseTo(expectedRailRatio, 1);
    expect(progressBox.height / cardBox.height).toBeGreaterThan(reading.unreadRatio);
    await page.locator('#list .item[data-session-id="s1"]').click();
    await expect
      .poll(() => page.locator("#msgs .bubble").first().textContent())
      .toContain("First session message 1");
    await expect.poll(() => messages.evaluate((host) => host.scrollTop)).toBe(reading.top);

    await page.locator('#list .item[data-session-id="s2"]').click();
    await page.evaluate(() => {
      const source = (globalThis as unknown as Record<string, unknown>)
        .__sessionScrollEventSource as {
        onmessage: ((event: { data: string }) => void) | null;
      };
      source.onmessage?.({
        data: JSON.stringify({
          active: ["s1"],
          startedAt: { s1: Date.now() },
          queues: {},
        }),
      });
    });
    await expect
      .poll(() =>
        page.locator('#list .item[data-session-id="s1"] .it-status').getAttribute("class"),
      )
      .toContain("generating");
    expect(await progress.isHidden()).toBe(true);

    await page.locator('#list .item[data-session-id="s1"]').click();
    await expect
      .poll(() =>
        messages.evaluate((host) => ({
          top: host.scrollTop,
          max: host.scrollHeight - host.clientHeight,
        })),
      )
      .toSatisfy(({ top, max }) => max > 0 && Math.abs(top - max) <= 1);

    // Leave while the session is generating at the bottom. Its background reply
    // grows the transcript after the saved pixel offset, then finishes before we
    // return; reopening should honor the saved bottom intent, not that stale offset.
    await page.locator('#list .item[data-session-id="s2"]').click();
    await page.evaluate(() => {
      const source = (globalThis as unknown as Record<string, unknown>)
        .__sessionScrollEventSource as {
        onmessage: ((event: { data: string }) => void) | null;
      };
      const emit = (event: Record<string, unknown>) =>
        source.onmessage?.({
          data: JSON.stringify({
            kind: "session_event",
            sessionId: "s1",
            emittedAt: Date.now(),
            event,
          }),
        });
      emit({
        kind: "assistant_text",
        text: Array.from(
          { length: 160 },
          (_, index) => `Background completion paragraph ${index + 1}.`,
        ).join("\n\n"),
      });
      emit({ kind: "result", ok: true });
    });
    await expect
      .poll(() =>
        page.locator('#list .item[data-session-id="s1"] .it-status').getAttribute("class"),
      )
      .toContain("unread");

    await page.locator('#list .item[data-session-id="s1"]').click();
    await expect
      .poll(() => page.locator("#msgs .bubble").last().textContent())
      .toContain("Background completion paragraph 160");
    await expect
      .poll(() =>
        messages.evaluate((host) => ({
          top: host.scrollTop,
          max: host.scrollHeight - host.clientHeight,
        })),
      )
      .toSatisfy(({ top, max }) => max > 0 && Math.abs(top - max) <= 1);

    await page.close();
  });

  it("linkifies paths without mistaking ratios or slash-separated labels for directories", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(raceView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            {
              role: "assistant",
              text: "Todo/ETA passed 2/2 and 24/24; armed/active uses 1.8rem and 0.72rem/650; codex/模型/effort/speed and claude.ai; see src/ui, README.md, ./Components/Button, and Components/Button.tsx.",
            },
          ],
        });
      } else if (url.pathname === "/paths/exists") {
        const body = route.request().postDataJSON() as { paths: string[] };
        const existing = new Set(["src/ui", "README.md", "Components/Button.tsx"]);
        await route.fulfill({
          json: { exists: body.paths.map((item) => existing.has(item)) },
        });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item").first().click();
    const bubble = page.locator("#msgs .msg.assistant .bubble");
    await expect.poll(() => bubble.count()).toBe(1);
    await expect.poll(() => bubble.locator(".filepath").count()).toBe(4);

    expect(
      await bubble
        .locator(".filepath")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-path"))),
    ).toEqual(["src/ui", "README.md", "./Components/Button", "Components/Button.tsx"]);
    expect(await bubble.textContent()).toContain(
      "Todo/ETA passed 2/2 and 24/24; armed/active uses 1.8rem and 0.72rem/650; codex/模型/effort/speed and claude.ai",
    );
    await page.close();
  });

  it("keeps persisted state from breaking out of the bootstrap script", async () => {
    const page = await browser.newPage();
    const html = renderConsole({
      ...view,
      vaultState: { theme: '</script><img id="owned" src=x>' as "dark" },
    });
    expect(html).not.toContain('</script><img id="owned"');
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    expect(await page.locator("#owned").count()).toBe(0);
    await page.close();
  });

  it("centers message actions in the visible block without following the pointer", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        onopen: (() => void) | null = null;
        onmessage: (() => void) | null = null;
        onerror: (() => void) | null = null;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(view),
        });
      } else {
        await route.fulfill({ json: {} });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#msgs").evaluate((host) => {
      host.innerHTML =
        '<div class="msg assistant" data-msg-key="assistant:0"><div class="bubble">Assistant content</div></div>';
    });

    const bubble = page.locator("#msgs .msg.assistant .bubble");
    await bubble.hover();
    await expect
      .poll(() => page.locator("#msgFloatActions").getAttribute("aria-hidden"))
      .toBe("false");

    const bubbleBox = await bubble.boundingBox();
    const centeredRailBox = await page.locator("#msgFloatActions").boundingBox();
    if (!bubbleBox || !centeredRailBox) throw new Error("Missing centered action geometry");
    expect(
      Math.abs(
        bubbleBox.y + bubbleBox.height / 2 - (centeredRailBox.y + centeredRailBox.height / 2),
      ),
    ).toBeLessThanOrEqual(1);

    const rowBox = await page.locator("#msgs .msg.assistant").boundingBox();
    if (!rowBox) throw new Error("Missing assistant row geometry");
    await page.mouse.move(rowBox.x + rowBox.width - 4, rowBox.y + rowBox.height / 2);
    await expect
      .poll(() => page.locator("#msgFloatActions").getAttribute("aria-hidden"))
      .toBe("true");

    await page.locator("#msgs").evaluate((host) => {
      host.innerHTML =
        '<div class="msg user" data-msg-key="user:0"><div class="bubble">User content</div></div>';
    });
    await page.locator("#msgs .msg.user .bubble").hover();
    await expect
      .poll(() => page.locator("#msgFloatActions").getAttribute("aria-hidden"))
      .toBe("true");

    await page.locator("#msgs").evaluate((host) => {
      host.innerHTML =
        '<div class="msg assistant" data-msg-key="assistant:1"><div class="bubble" style="height:1600px">Long assistant content</div></div>';
      host.scrollTop = 0;
    });
    const hostBox = await page.locator("#msgs").boundingBox();
    const longBubbleBox = await page.locator("#msgs .bubble").boundingBox();
    if (!hostBox || !longBubbleBox) throw new Error("Missing long message geometry");
    await page.mouse.move(longBubbleBox.x + 20, hostBox.y + 40);
    await expect
      .poll(() => page.locator("#msgFloatActions").getAttribute("aria-hidden"))
      .toBe("false");
    const bottomRailBox = await page.locator("#msgFloatActions").boundingBox();
    const visibleBottom = await page.locator("#msgs").evaluate((host) => {
      return host.getBoundingClientRect().bottom;
    });
    if (!bottomRailBox) throw new Error("Missing bottom-clamped action geometry");
    expect(
      Math.abs(
        bottomRailBox.y + bottomRailBox.height / 2 - (visibleBottom - bottomRailBox.height / 2 - 6),
      ),
    ).toBeLessThanOrEqual(2);

    await page.locator("#msgs").evaluate((host) => {
      host.scrollTop = host.scrollHeight;
    });
    await expect
      .poll(async () => {
        const railBox = await page.locator("#msgFloatActions").boundingBox();
        return (
          railBox &&
          Math.abs(railBox.y + railBox.height / 2 - (hostBox.y + railBox.height / 2 + 6)) <= 1
        );
      })
      .toBe(true);
    await page.close();
  });

  it("aligns the composer with both message edges and keeps a clear scroll-bottom gap", async () => {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 720 },
    });
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    const history = [
      {
        role: "user",
        text: Array.from({ length: 30 }, (_, index) => `User detail ${index + 1}`).join(" "),
      },
      {
        role: "assistant",
        text: Array.from({ length: 80 }, (_, index) => `Assistant detail ${index + 1}.`).join(
          "\n\n",
        ),
      },
    ];
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(raceView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: history });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator('#list .item[data-session-id="s2"]').click();
    await expect.poll(() => page.locator("#msgs .msg").count()).toBe(history.length);
    await page.locator("#msgs").evaluate((host) => {
      host.scrollTop = host.scrollHeight;
    });

    const measureGeometry = () =>
      page.locator("#msgs").evaluate((host) => {
        const foot = host.ownerDocument.querySelector(".foot");
        const box = (selector: string) => {
          const rect = host.ownerDocument.querySelector(selector)?.getBoundingClientRect();
          if (!rect) throw new Error(`Missing geometry for ${selector}`);
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        };
        return {
          assistant: box("#msgs .msg.assistant .bubble"),
          user: box("#msgs .msg.user .bubble"),
          host: box("#msgs"),
          composer: box(".composer-surface"),
          last: box("#msgs .msg:last-child"),
          footPosition: foot
            ? (host.ownerDocument.defaultView?.getComputedStyle(foot).position ?? "")
            : "",
        };
      });
    await expect
      .poll(async () => {
        const geometry = await measureGeometry();
        return geometry.composer.top - geometry.last.bottom;
      })
      .toBeGreaterThanOrEqual(23);
    const geometry = await measureGeometry();
    const bottomGap = geometry.composer.top - geometry.last.bottom;
    expect(Math.abs(geometry.assistant.left - geometry.composer.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.user.right - geometry.composer.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.host.bottom - geometry.composer.top)).toBeLessThanOrEqual(1);
    expect(bottomGap).toBeGreaterThanOrEqual(23);
    expect(bottomGap).toBeLessThanOrEqual(26);
    expect(geometry.footPosition).toBe("relative");
    expect(geometry.composer.left).toBeLessThan(geometry.user.left);
    expect(geometry.composer.right).toBeGreaterThan(geometry.assistant.right);

    await page.close();
  });

  it("uses the same center-or-visible-edge placement in the comment panel", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(view),
        });
      } else {
        await route.fulfill({ json: {} });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      const browserGlobal = globalThis as unknown as {
        document: {
          querySelector(selector: string): {
            hidden: boolean;
            innerHTML: string;
            scrollTop: number;
          } | null;
        };
      };
      const drawer = browserGlobal.document.querySelector("#commentDrawer");
      const host = browserGlobal.document.querySelector("#commentMsgs");
      if (!drawer || !host) throw new Error("Missing comment panel");
      drawer.hidden = false;
      host.innerHTML =
        '<div class="msg assistant" data-msg-key="comment:0"><div class="bubble" style="height:2400px">Long comment</div></div>';
      host.scrollTop = 0;
    });
    // Let the initial overlay measurement finish before fixing the synthetic
    // long message at the top; opening a real thread intentionally starts at
    // the bottom, so the setup must not race that pending animation frame.
    await page.locator("#commentMsgs").evaluate(
      (host) =>
        new Promise<void>((resolve) => {
          const browserWindow = host.ownerDocument.defaultView as unknown as {
            requestAnimationFrame(callback: () => void): number;
          };
          browserWindow.requestAnimationFrame(() => {
            host.scrollTop = 0;
            browserWindow.requestAnimationFrame(() => {
              host.scrollTop = 0;
              resolve();
            });
          });
        }),
    );

    const hostBox = await page.locator("#commentMsgs").boundingBox();
    const bubbleBox = await page.locator("#commentMsgs .bubble").boundingBox();
    if (!hostBox || !bubbleBox) throw new Error("Missing comment message geometry");
    await page.mouse.move(bubbleBox.x + 20, hostBox.y + 40);
    await expect
      .poll(() => page.locator("#commentMsgFloatActions").getAttribute("aria-hidden"))
      .toBe("false");
    const bottomRailBox = await page.locator("#commentMsgFloatActions").boundingBox();
    const footBox = await page.locator(".commentfoot").boundingBox();
    if (!bottomRailBox || !footBox) throw new Error("Missing comment action geometry");
    expect(
      Math.abs(
        bottomRailBox.y + bottomRailBox.height / 2 - (footBox.y - bottomRailBox.height / 2 - 6),
      ),
    ).toBeLessThanOrEqual(1);

    await page.locator("#commentMsgs").evaluate((host) => {
      host.scrollTop = host.scrollHeight;
    });
    await expect
      .poll(async () => {
        const railBox = await page.locator("#commentMsgFloatActions").boundingBox();
        return (
          railBox &&
          Math.abs(railBox.y + railBox.height / 2 - (hostBox.y + railBox.height / 2 + 6)) <= 1
        );
      })
      .toBe(true);
    await page.close();
  });

  it("pins selected text from a comment message", async () => {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(commentView),
        });
      } else if (url.pathname === "/comments/messages") {
        await route.fulfill({
          json: {
            thread: commentView.vaultState?.commentThreads?.["comment-1"],
            messages: [
              {
                role: "assistant",
                text: "First excerpt then second excerpt",
                tools: [],
              },
            ],
          },
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    expect(pageErrors).toEqual([]);
    await page
      .locator("#list .item", { hasText: "Avoidance session" })
      .locator(".it-comment")
      .click();

    const bubble = page.locator("#commentMsgs > .msg.assistant .bubble");
    await expect.poll(() => bubble.textContent()).toContain("First excerpt then second excerpt");
    await bubble.hover();
    const pin = page.locator("#commentMsgFloatPin");
    const pinExcerpt = async (excerpt: string) => {
      await bubble.evaluate((node, selectedText) => {
        const textNode = node.querySelector("p")?.firstChild;
        const source = textNode?.textContent ?? "";
        const start = source.indexOf(selectedText);
        if (!textNode || start < 0) throw new Error(`Missing excerpt: ${selectedText}`);
        const range = node.ownerDocument.createRange();
        range.setStart(textNode, start);
        range.setEnd(textNode, start + selectedText.length);
        const selection = node.ownerDocument.defaultView?.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }, excerpt);
      await expect.poll(() => pin.getAttribute("aria-label")).toBe("Pin selected text to the top");
      await pin.click();
    };

    // Pin in reverse click order; the tray must follow text order instead.
    await pinExcerpt("second excerpt");
    await pinExcerpt("First excerpt");

    const pinnedSelection = page.locator("#commentPinTray .pinitem");
    await expect.poll(() => pinnedSelection.count()).toBe(2);
    expect(await pinnedSelection.locator(".pinrole").allTextContents()).toEqual([
      "selected",
      "selected",
    ]);
    expect(await pinnedSelection.locator(".pintext").allTextContents()).toEqual([
      "First excerpt",
      "second excerpt",
    ]);
    expect(await pinnedSelection.first().getAttribute("data-hover-tip")).toBe("First excerpt");
    await pinnedSelection.first().locator(".pintext").hover();
    await expect.poll(() => page.locator("#hoverTip").textContent()).toBe("First excerpt");
    expect(pageErrors).toEqual([]);
    await page.close();
  });

  it("adds selected comment-panel AI text to the comment composer without overlapping content", async () => {
    const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
    let sentBody: Record<string, unknown> | null = null;
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(commentView) });
      } else if (url.pathname === "/comments/messages") {
        await route.fulfill({
          json: {
            thread: commentView.vaultState?.commentThreads?.["comment-1"],
            messages: [
              {
                role: "assistant",
                text: "First excerpt then second excerpt. ".repeat(18),
                tools: [],
              },
            ],
          },
        });
      } else if (url.pathname === "/comments/send") {
        sentBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          json: {
            ok: true,
            thread: {
              ...commentView.vaultState?.commentThreads?.["comment-1"],
              status: "generating",
              messageCount: 2,
            },
          },
        });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page
      .locator("#list .item", { hasText: "Avoidance session" })
      .locator(".it-comment")
      .click();

    const bubble = page.locator("#commentMsgs > .msg.assistant .bubble");
    await expect.poll(() => bubble.textContent()).toContain("First excerpt then second excerpt");
    expect(
      await page
        .locator("#commentMsgs")
        .evaluate((host) =>
          host.ownerDocument.defaultView
            ?.getComputedStyle(host)
            .getPropertyValue("--msg-float-actions-space")
            .trim(),
        ),
    ).toBe("5rem");
    const input = page.locator("#commentInput");
    await bubble.hover();
    await bubble.evaluate((node) => {
      const textNode = node.querySelector("p")?.firstChild;
      if (!textNode) throw new Error("Missing comment assistant text");
      const range = node.ownerDocument.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, "First excerpt".length);
      const selection = node.ownerDocument.defaultView?.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    await page.locator("#commentMsgFloatReference").click({ force: true });
    await expect.poll(() => page.locator("#commentMsgReferenceComposer").isVisible()).toBe(true);
    expect(await page.locator("#commentMsgReferenceMark").textContent()).toBe("@ selected");
    await page.locator("#commentMsgReferenceInput").press("Enter");

    const expectedPrompt = "@ selected\n> First excerpt";
    expect(await input.inputValue()).toBe(expectedPrompt);

    await page.locator("#commentSend").click();
    await expect.poll(() => sentBody).not.toBeNull();
    expect(sentBody).toMatchObject({
      question: expectedPrompt,
    });
    const userMessage = page.locator("#commentMsgs > .msg.user").last();
    expect(await userMessage.locator(".bubble").textContent()).toContain("First excerpt");
    expect(await userMessage.locator(".msgref").count()).toBe(0);
    await userMessage.locator(".bubble").hover();
    await expect
      .poll(() => page.locator("#commentMsgFloatActions").getAttribute("aria-hidden"))
      .toBe("true");
    await page.close();
  });

  it("keeps new-session and chat input geometry fixed when attachments are added", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    let sentBody: { text?: string; attachments?: unknown[] } | null = null;
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as {
        EventSource: unknown;
        __eventSource?: {
          onmessage: ((event: { data: string }) => void) | null;
        };
      };
      class StubEventSource {
        static readonly CLOSED = 2;
        onmessage: ((event: { data: string }) => void) | null = null;
        constructor() {
          browserGlobal.__eventSource = this;
        }
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(pendingTagView),
        });
      } else if (url.pathname === "/chat/send") {
        sentBody = route.request().postDataJSON() as typeof sentBody;
        await route.fulfill({ json: { ok: true, session: "s1" } });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const expectSameGeometry = async (
      selector: string,
      before: Awaited<ReturnType<ReturnType<typeof page.locator>["boundingBox"]>>,
    ) => {
      const after = await page.locator(selector).boundingBox();
      if (!before || !after) throw new Error(`Missing geometry for ${selector}`);
      for (const key of ["x", "y", "width", "height"] as const) {
        // Chromium can report the same layout at slightly different sub-pixel precision
        // after a file input event, even when no rendered pixel moved.
        expect(Math.abs(after[key] - before[key])).toBeLessThan(0.1);
      }
    };

    await page.locator("#newToggle").click();
    await page.waitForTimeout(200);
    const newBefore = await page.locator("#np").boundingBox();
    await page.locator("#nfile").setInputFiles({
      name: "new-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("new session attachment"),
    });
    await expect.poll(() => page.locator("#newAttachTray .attachchip").count()).toBe(1);
    await expectSameGeometry("#np", newBefore);
    const newChip = await page.locator("#newAttachTray .attachchip").boundingBox();
    if (!newBefore || !newChip) throw new Error("Missing new-session attachment geometry");
    expect(newChip.x - newBefore.x).toBeLessThan(16);
    expect(newBefore.y + newBefore.height - newChip.y - newChip.height).toBeLessThan(12);
    await page.locator("#newClose").click();

    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await page.locator("#input").fill("please review");
    const chatBefore = await page.locator("#input").boundingBox();
    await page.locator("#file").setInputFiles({
      name: "chat-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("chat attachment"),
    });
    // Chat attachments stay in the input action row as clickable preview chips.
    await expect.poll(() => page.locator("#attachTray .attachchip").count()).toBe(1);
    expect(await page.locator("#input").inputValue()).toBe("please review");
    expect(await page.locator("#attachTray .attachchip").getAttribute("role")).toBe("button");
    await expectSameGeometry("#input", chatBefore);

    // Removing the chip detaches the file; re-attaching leaves the raw draft untouched.
    await page.locator("#attachTray .attachchip button").click();
    await expect.poll(() => page.locator("#attachTray .attachchip").count()).toBe(0);
    await page.locator("#input").fill("raw prompt");
    await page.locator("#file").setInputFiles({
      name: "chat-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("chat attachment"),
    });
    await expect.poll(() => page.locator("#attachTray .attachchip").count()).toBe(1);
    expect(await page.locator("#input").inputValue()).toBe("raw prompt");
    await page.locator("#send").click();
    await expect.poll(() => sentBody).not.toBeNull();
    const body = sentBody as { text?: string; attachments?: unknown[] } | null;
    expect(body?.text).toBe("raw prompt");
    expect(body?.attachments).toHaveLength(1);
    // Re-rendering from the optimistic transcript cache used to consume the
    // pending marker before the matching live acknowledgement arrived. The
    // acknowledgement then appended the same user turn a second time.
    await page.locator("#list .item", { hasText: "Other session" }).click();
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await page.evaluate((attachments) => {
      const source = (
        globalThis as unknown as {
          __eventSource?: {
            onmessage: ((event: { data: string }) => void) | null;
          };
        }
      ).__eventSource;
      source?.onmessage?.({
        data: JSON.stringify({
          kind: "session_event",
          sessionId: "s1",
          emittedAt: Date.now(),
          event: { kind: "user_turn_started", text: "raw prompt", attachments },
        }),
      });
    }, body?.attachments ?? []);
    await expect.poll(() => page.locator("#msgs .msg.user").count()).toBe(1);
    expect(await page.locator("#msgs .msg.user .bubble").textContent()).not.toContain(
      "Attachments:",
    );
    await page.close();
  });

  it("opens the composer rail upward without moving chat or queue and persists text items", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    page.setDefaultTimeout(2_000);
    const uiPatches: unknown[] = [];
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(composerRailView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/chat/queue") {
        await route.fulfill({
          json: {
            ok: true,
            parked: false,
            items: [
              {
                id: "queued-1",
                sessionId: "s1",
                cwd: "/tmp/project",
                vendor: "claude",
                text: "queued message",
                createdAt: 1,
              },
            ],
          },
        });
      } else if (url.pathname === "/vault/ui-state") {
        uiPatches.push(request.postDataJSON());
        await route.fulfill({ json: { ok: true } });
      } else if (url.pathname === "/models/claude") {
        await route.fulfill({
          json: {
            models: composerRailView.claudeModels,
            defaults: composerRailView.modelDefaults?.claude,
            warning: null,
          },
        });
      } else if (url.pathname === "/models/codex") {
        await route.fulfill({
          json: {
            models: composerRailView.codexModels,
            defaults: composerRailView.modelDefaults?.codex,
            warning: null,
          },
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await expect
      .poll(() =>
        page.locator("#list .item.active").evaluate((item) => {
          const browserWindow = item.ownerDocument.defaultView;
          return browserWindow?.getComputedStyle(item).backgroundImage;
        }),
      )
      .toContain("linear-gradient");
    expect(
      await page.locator("#list .item.active").evaluate((item) => {
        const browserWindow = item.ownerDocument.defaultView;
        return browserWindow?.getComputedStyle(item).boxShadow;
      }),
    ).toContain("inset");
    await expect.poll(() => page.locator("#queue .qitem").count()).toBe(1);
    await page.locator("#queue .qedit").click();
    expect(await page.locator("#queue .qeditbox .edit-cancel svg").count()).toBe(1);
    expect(await page.locator("#queue .qeditbox .edit-cancel").getAttribute("aria-label")).toBe(
      "Cancel edit (Esc)",
    );
    await page.locator("#queue .qeditbox .edit-cancel").click();
    await expect.poll(() => page.locator("#queue .qeditbox").count()).toBe(0);

    const geometry = async () => ({
      chat: await page.locator("#msgs").boundingBox(),
      queue: await page.locator("#queue").boundingBox(),
      input: await page.locator("#input").boundingBox(),
    });
    const expectRailAlignment = async (trigger: string) => {
      const composer = await page.locator("#composer").boundingBox();
      const button = await page.locator(trigger).boundingBox();
      const pop = await page.locator("#composerRailPop").boundingBox();
      if (!composer || !button || !pop) throw new Error("Missing composer rail geometry");
      const expectedX = Math.max(
        composer.x,
        Math.min(button.x, composer.x + composer.width - pop.width),
      );
      // the inset shelf adds fractional margins; allow sub-3px rounding drift
      expect(Math.abs(pop.x - expectedX)).toBeLessThanOrEqual(3);
    };
    const expectProductActionTheme = async (selector: string, hovered = false) => {
      const button = page.locator(selector);
      if (hovered) await button.hover();
      await page.waitForTimeout(180);
      const theme = await button.evaluate((node, useHover) => {
        const style = node.ownerDocument.defaultView?.getComputedStyle(node);
        const probe = node.ownerDocument.createElement("span");
        node.ownerDocument.body.appendChild(probe);
        const resolve = (name: string) => {
          probe.style.color = `var(${name})`;
          return node.ownerDocument.defaultView?.getComputedStyle(probe).color ?? "";
        };
        const expected = {
          background: resolve(useHover ? "--primary-hover" : "--primary-bg"),
          border: resolve(useHover ? "--primary-hover" : "--primary-bg"),
          color: resolve("--primary-fg"),
        };
        probe.remove();
        return {
          actual: {
            background: style?.backgroundColor ?? "",
            border: style?.borderTopColor ?? "",
            color: style?.color ?? "",
          },
          expected,
        };
      }, hovered);
      expect(theme.actual).toEqual(theme.expected);
    };
    expect(await page.locator("#railVendor").textContent()).toContain("claude");
    expect(await page.locator("#railVendor").textContent()).not.toContain("vendor ·");
    expect(await page.locator("#railModel").textContent()).not.toContain("model ·");
    expect(await page.locator("#railModel").textContent()).not.toContain("CLI default");
    expect(await page.locator("#railModel").getAttribute("data-hover-tip")).toContain(
      "Claude Sonnet",
    );
    expect(await page.locator("#railEffort").textContent()).not.toContain("effort ·");
    expect(await page.locator("#railSpeed").textContent()).toContain("Standard");
    expect(await page.locator("#railSpeed").textContent()).not.toContain("default");
    expect(await page.locator("#railShortcuts .railbtn-count").isVisible()).toBe(true);
    expect(await page.locator("#railNotes .railbtn-count").isHidden()).toBe(true);
    expect(await page.locator("#railTodos .railbtn-count").isHidden()).toBe(true);
    expect(await page.locator("#railGoal").count()).toBe(0);
    const railVendorColor = await page.locator("#railVendor").evaluate((rail) => {
      const browserWindow = rail.ownerDocument.defaultView as unknown as {
        getComputedStyle(target: typeof rail): { color: string };
      };
      return browserWindow.getComputedStyle(rail).color;
    });
    const forkTheme = await page.locator("#forkBtn").evaluate((button) => {
      const style = button.ownerDocument.defaultView?.getComputedStyle(button);
      const probe = button.ownerDocument.createElement("span");
      button.ownerDocument.body.appendChild(probe);
      probe.style.color = "var(--vendor-claude-border)";
      const claudeBorder = button.ownerDocument.defaultView?.getComputedStyle(probe).color;
      probe.remove();
      return { border: style?.borderTopColor, claudeBorder };
    });
    expect(await page.locator("#forkBtn").getAttribute("data-vendor")).toBeNull();
    expect(await page.locator("#forkBtn").getAttribute("class")).not.toContain("fork-action");
    expect(forkTheme.border).not.toBe(forkTheme.claudeBorder);
    await page.locator("#input").click();
    expect(
      await page.locator("#input").evaluate((input) => input.ownerDocument.activeElement === input),
    ).toBe(true);
    await page.waitForTimeout(180);
    const composerFocusStyle = await page.locator(".composer-surface").evaluate((surface) => {
      const browserWindow = surface.ownerDocument.defaultView as unknown as {
        getComputedStyle(target: typeof surface): {
          borderLeftColor: string;
          borderTopColor: string;
          boxShadow: string;
        };
      };
      const style = browserWindow.getComputedStyle(surface);
      return {
        borderLeftColor: style.borderLeftColor,
        borderTopColor: style.borderTopColor,
        boxShadow: style.boxShadow,
      };
    });
    expect(composerFocusStyle.borderTopColor).toBe(composerFocusStyle.borderLeftColor);
    expect(composerFocusStyle.boxShadow).not.toBe("none");
    expect(composerFocusStyle.boxShadow).toContain("inset");
    expect(composerFocusStyle.boxShadow).not.toContain("0px 0px 0px 3px");
    const railFocusStyle = await page.locator("#composerRail").evaluate((rail) => {
      const style = rail.ownerDocument.defaultView?.getComputedStyle(rail);
      return {
        backgroundColor: style?.backgroundColor ?? "",
        borderTopWidth: style?.borderTopWidth ?? "",
        boxShadow: style?.boxShadow ?? "",
        opacity: style?.opacity ?? "",
        paddingInline:
          (Number.parseFloat(style?.paddingLeft ?? "0") || 0) +
          (Number.parseFloat(style?.paddingRight ?? "0") || 0),
      };
    });
    expect(railFocusStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(railFocusStyle.borderTopWidth).toBe("0px");
    expect(railFocusStyle.boxShadow).toBe("none");
    expect(railFocusStyle.opacity).toBe("1");
    const [ribbon, controls, surface, row, sendBox] = await Promise.all([
      page.locator("#composerRail").boundingBox(),
      page.locator(".composerrail-controls").boundingBox(),
      page.locator(".composer-surface").boundingBox(),
      page.locator(".composer-surface > .composerrow").boundingBox(),
      page.locator("#send").boundingBox(),
    ]);
    if (!ribbon || !controls || !surface || !row || !sendBox) {
      throw new Error("Missing composer surfaces");
    }
    // The ribbon shrink-wraps its controls and stays wholly inside the one composer card.
    expect(ribbon.x).toBeGreaterThan(surface.x);
    expect(ribbon.width).toBeLessThan(surface.width);
    expect(
      Math.abs(ribbon.width - controls.width - railFocusStyle.paddingInline),
    ).toBeLessThanOrEqual(1);
    expect(ribbon.y).toBeGreaterThan(surface.y);
    expect(ribbon.y + ribbon.height).toBeLessThanOrEqual(row.y);
    expect(ribbon.y + ribbon.height).toBeLessThan(surface.y + surface.height);
    // actions (incl. send) stay inside the input card.
    expect(sendBox.y + sendBox.height).toBeLessThan(surface.y + surface.height);
    expect(Math.abs(surface.y + surface.height - (sendBox.y + sendBox.height))).toBeLessThanOrEqual(
      16,
    );
    const before = await geometry();
    await page.locator("#railTodos").click();
    expect(await page.locator("#railTodos").getAttribute("class")).toContain("active");
    expect(await page.locator("#railTodos").getAttribute("aria-expanded")).toBe("true");
    expect(await page.locator("#composerRailPop").isVisible()).toBe(true);
    expect(await page.locator("#composerRailPop .rail-empty").count()).toBe(0);
    expect(await page.locator("#composerRailPop .railpop-head").count()).toBe(0);
    expect(await page.locator("#composerRailPop .railpop-body > .rail-add").count()).toBe(1);
    const [addInputBox, addButtonBox] = await Promise.all([
      page.locator("#railAddInput").boundingBox(),
      page.locator(".rail-add > button").boundingBox(),
    ]);
    if (!addInputBox || !addButtonBox) throw new Error("Missing add-row controls");
    expect(Math.abs(addInputBox.y - addButtonBox.y)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(addInputBox.y + addInputBox.height - (addButtonBox.y + addButtonBox.height)),
    ).toBeLessThanOrEqual(1);
    await expectRailAlignment("#railTodos");
    const after = await geometry();
    expect(after).toEqual(before);

    expect(await page.locator(".rail-add button").isDisabled()).toBe(true);
    await page.locator("#railAddInput").fill("中文候选");
    await page.locator("#railAddInput").dispatchEvent("compositionstart", { data: "中文" });
    await page.locator("#railAddInput").dispatchEvent("keydown", {
      code: "Enter",
      isComposing: true,
      key: "Enter",
      keyCode: 229,
    });
    expect(await page.locator("#composerRailPop .rail-item").count()).toBe(0);
    expect(await page.locator("#railAddInput").inputValue()).toBe("中文候选");
    await page.locator("#railAddInput").dispatchEvent("compositionend", { data: "中文候选" });
    await page.locator("#railAddInput").fill("Verify migration");
    await page.locator(".rail-add button").click();
    expect(await page.locator(".rail-item .qdel svg").count()).toBe(1);
    await expect.poll(() => page.locator("#list .it-todo:visible").count()).toBe(1);
    expect(await page.locator("#list .it-todo:visible").textContent()).toContain("1todo");
    const todoBadgeColor = await page.locator("#list .it-todo:visible").evaluate((badge) => {
      const browserWindow = badge.ownerDocument.defaultView as unknown as {
        getComputedStyle(target: typeof badge): { color: string };
      };
      return browserWindow.getComputedStyle(badge).color;
    });
    const todoCheckStyle = await page
      .locator("#composerRailPop .rail-todo-check")
      .evaluate((check) => {
        const browserWindow = check.ownerDocument.defaultView as unknown as {
          getComputedStyle(target: typeof check): {
            backgroundColor: string;
            borderTopColor: string;
            height: string;
            width: string;
          };
        };
        const style = browserWindow.getComputedStyle(check);
        return {
          background: style.backgroundColor,
          border: style.borderTopColor,
          height: Number.parseFloat(style.height),
          width: Number.parseFloat(style.width),
        };
      });
    expect(todoCheckStyle.background).toBe("rgba(0, 0, 0, 0)");
    expect(todoCheckStyle.border).not.toBe("rgb(107, 114, 128)");
    expect(todoCheckStyle.width).toBeLessThanOrEqual(13);
    expect(todoCheckStyle.height).toBeLessThanOrEqual(13);
    await page.locator("#composerRailPop .rail-todo-check").check();
    expect(
      await page.locator("#composerRailPop .rail-todo-check").evaluate((check) => {
        const browserWindow = check.ownerDocument.defaultView as unknown as {
          getComputedStyle(target: typeof check): { backgroundColor: string };
        };
        return browserWindow.getComputedStyle(check).backgroundColor;
      }),
    ).toBe(todoBadgeColor);
    await expect.poll(() => page.locator("#list .it-todo:visible").count()).toBe(0);

    await page.locator("#railNotes").click();
    await page.locator("#railAddInput").fill("Keep schema");
    const singleLineHeight = await page
      .locator("#railAddInput")
      .evaluate((input) => input.clientHeight);
    await page.locator("#railAddInput").press("Shift+Enter");
    await page.locator("#railAddInput").pressSequentially("for rollback");
    expect(await page.locator("#railAddInput").inputValue()).toBe("Keep schema\nfor rollback");
    expect(
      await page.locator("#railAddInput").evaluate((input) => input.clientHeight),
    ).toBeGreaterThan(singleLineHeight);
    expect(await page.locator(".rail-add button").isEnabled()).toBe(true);
    await page.locator("#railAddInput").press("Enter");
    expect(await page.locator(".rail-item-text").textContent()).toBe("Keep schema\nfor rollback");
    expect(await page.locator(".rail-item .qdel svg").count()).toBe(1);
    expect(await page.locator("#composerRailPop .rail-item-insert").count()).toBe(0);
    expect(await page.locator("#list .it-todo:visible").count()).toBe(0);

    await page.locator("#railShortcuts").click();
    expect(await page.locator(".rail-item .qedit svg").count()).toBe(1);
    expect(await page.locator(".rail-item .qdel svg").count()).toBe(1);
    const [shortcutRowBox, shortcutTextBox] = await Promise.all([
      page.locator(".rail-item").first().boundingBox(),
      page.locator(".rail-item .rail-item-text").first().boundingBox(),
    ]);
    if (!shortcutRowBox || !shortcutTextBox) throw new Error("Missing shortcut row geometry");
    expect(
      Math.abs(
        shortcutRowBox.y +
          shortcutRowBox.height / 2 -
          (shortcutTextBox.y + shortcutTextBox.height / 2),
      ),
    ).toBeLessThanOrEqual(1);
    const shortcutRowStyle = await page
      .locator(".rail-item")
      .first()
      .evaluate((row) => {
        const browserWindow = row.ownerDocument.defaultView as unknown as {
          getComputedStyle(target: typeof row): {
            backgroundColor: string;
            borderTopStyle: string;
            boxShadow: string;
          };
        };
        const style = browserWindow.getComputedStyle(row);
        return {
          background: style.backgroundColor,
          borderStyle: style.borderTopStyle,
          boxShadow: style.boxShadow,
        };
      });
    expect(shortcutRowStyle.background).toBe("rgba(0, 0, 0, 0)");
    expect(shortcutRowStyle.borderStyle).toBe("none");
    expect(shortcutRowStyle.boxShadow).toBe("none");
    const sharedActionStyles = await page.locator(".rail-item").evaluate((row) => {
      const edit = row.querySelector(".qedit");
      const remove = row.querySelector(".qdel");
      if (!edit || !remove) throw new Error("Missing shared queue actions");
      const browserWindow = row.ownerDocument.defaultView;
      if (!browserWindow) throw new Error("Missing browser window");
      const editStyle = browserWindow.getComputedStyle(edit);
      const removeStyle = browserWindow.getComputedStyle(remove);
      return {
        editSize: [editStyle.width, editStyle.height],
        removeSize: [removeStyle.width, removeStyle.height],
        removeColor: removeStyle.color,
      };
    });
    expect(sharedActionStyles.editSize).toEqual(sharedActionStyles.removeSize);
    expect(sharedActionStyles.removeColor).toBe("rgb(220, 38, 38)");
    await page.locator(".rail-item .qedit").click();
    expect(await page.locator(".rail-item-edit .edit-cancel svg").count()).toBe(1);
    await page.locator("#railEditInput").fill("编辑候选");
    await page.locator("#railEditInput").dispatchEvent("compositionstart", { data: "编辑" });
    await page.locator("#railEditInput").dispatchEvent("keydown", {
      code: "Enter",
      isComposing: true,
      key: "Enter",
      keyCode: 229,
    });
    expect(await page.locator("#railEditInput").count()).toBe(1);
    expect(await page.locator("#railEditInput").inputValue()).toBe("编辑候选");
    await page.locator("#railEditInput").dispatchEvent("compositionend", { data: "编辑候选" });
    expect(await page.locator(".rail-item-edit-save").isEnabled()).toBe(true);
    await page.locator(".rail-item-edit-save").focus();
    await page.keyboard.press("Escape");
    await expect.poll(() => page.locator("#railEditInput").count()).toBe(0);
    await page.locator(".rail-item .qedit").click();
    expect(await page.locator(".rail-item-edit-save").isDisabled()).toBe(true);
    await expect
      .poll(() =>
        page
          .locator("#railEditInput")
          .evaluate((input) => input.ownerDocument.activeElement === input),
      )
      .toBe(true);
    await page.locator("#railEditInput").evaluate((input) => {
      const textarea = input as unknown as {
        value: string;
        setSelectionRange(start: number, end: number): void;
      };
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
    await page.locator("#railEditInput").press("Shift+Enter");
    await page.locator("#railEditInput").pressSequentially("Run the full suite");
    expect(await page.locator("#railEditInput").inputValue()).toBe(
      "Review changes\nRun the full suite",
    );
    await page.locator("#railEditInput").press("Enter");
    await expect.poll(() => page.locator("#railEditInput").count()).toBe(0);
    await page.locator(".rail-item-text", { hasText: "Run the full suite" }).click();
    expect(await page.locator("#input").inputValue()).toBe("Review changes\nRun the full suite");
    await page.locator("#input").fill("");

    await page.locator("#railModel").click();
    expect(await page.locator(".rail-option-note").count()).toBe(0);
    expect(await page.locator(".railpop-head").count()).toBe(0);
    expect((await page.locator("#composerRailPop").boundingBox())?.width).toBeLessThanOrEqual(169);
    const configPanelStyle = await page
      .locator("#composerRailPop .railpop-body")
      .evaluate((panel) => {
        const browserWindow = panel.ownerDocument.defaultView as unknown as {
          getComputedStyle(target: typeof panel): {
            backdropFilter: string;
            backgroundColor: string;
            borderTopStyle: string;
          };
        };
        const style = browserWindow.getComputedStyle(panel);
        return {
          backdropFilter: style.backdropFilter,
          background: style.backgroundColor,
          borderStyle: style.borderTopStyle,
        };
      });
    expect(configPanelStyle.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(configPanelStyle.backdropFilter).not.toBe("none");
    expect(configPanelStyle.borderStyle).toBe("solid");
    const configOptionStyle = await page
      .locator(".rail-option")
      .first()
      .evaluate((option) => {
        const browserWindow = option.ownerDocument.defaultView as unknown as {
          getComputedStyle(target: typeof option): {
            borderTopStyle: string;
            boxShadow: string;
          };
        };
        const style = browserWindow.getComputedStyle(option);
        return {
          borderStyle: style.borderTopStyle,
          boxShadow: style.boxShadow,
        };
      });
    expect(configOptionStyle.borderStyle).toBe("none");
    expect(configOptionStyle.boxShadow).toBe("none");
    await page.locator("#railVendor").click();
    await expectRailAlignment("#railVendor");
    expect((await page.locator("#composerRailPop").boundingBox())?.width).toBeLessThanOrEqual(137);
    expect(await page.locator(".rail-option-vendor-mark").count()).toBe(2);
    const claudeOptionColor = await page
      .locator('.rail-option[data-vendor="claude"] .rail-option-label')
      .evaluate((label) => {
        const browserWindow = label.ownerDocument.defaultView as unknown as {
          getComputedStyle(target: typeof label): { color: string };
        };
        return browserWindow.getComputedStyle(label).color;
      });
    expect(claudeOptionColor).toBe(railVendorColor);
    await page.locator(".rail-option", { hasText: "codex" }).click();
    expect(await page.locator("#railVendor").textContent()).toContain("codex");
    await page.locator("#railEffort").click();
    expect((await page.locator("#composerRailPop").boundingBox())?.width).toBeLessThanOrEqual(97);
    await page.locator("#railEffort").click();
    await page.locator("#railSpeed").click();
    expect(await page.locator(".rail-option", { hasText: "Fast" }).count()).toBe(1);
    await page.locator(".rail-option", { hasText: "Fast" }).click();
    expect(await page.locator("#railSpeed").textContent()).toContain("Fast");
    expect(await page.locator("#send").textContent()).toBe("fork with codex");
    expect(await page.locator("#send .splitbtn-ico circle").count()).toBe(3);
    expect(await page.locator("#forkBtn").isVisible()).toBe(false);
    expect(await page.locator("#send").getAttribute("data-vendor")).toBeNull();
    await expectProductActionTheme("#send");
    await expectProductActionTheme("#send", true);
    const sessionCount = await page.locator("#list .item").count();
    await page.locator("#send").click();
    await expect.poll(() => page.locator("#list .item").count()).toBe(sessionCount + 1);
    await expect
      .poll(() => uiPatches)
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sessionTodos: expect.any(Object) }),
          expect.objectContaining({ sessionNotes: expect.any(Object) }),
        ]),
      );
    await page.close();
  }, 15_000);

  it("shows the next-step ghost before the empty composer is focused", async () => {
    const page = await browser.newPage();
    const nextStepView: ConsoleView = {
      ...composerRailView,
      sessions: composerRailView.sessions.map((session, index) =>
        index === 0 ? { ...session, nextStep: "Continue and run the tests" } : session,
      ),
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(nextStepView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();

    const input = page.locator("#input");
    const ghost = page.locator("#composerShortcutGhost");
    const suffix = page.locator("#composerShortcutGhostSuffix");
    expect(await input.evaluate((node) => node.ownerDocument.activeElement === node)).toBe(false);
    await expect.poll(() => ghost.isVisible()).toBe(true);
    expect(await suffix.textContent()).toBe("Continue and run the tests");
    expect(await input.getAttribute("class")).toContain("nextstep-ghosting");

    await input.focus();
    await input.press("Tab");
    expect(await input.inputValue()).toBe("Continue and run the tests");
    expect(await ghost.isHidden()).toBe(true);

    await input.fill("");
    await page.locator("#railTodos").focus();
    expect(await input.evaluate((node) => node.ownerDocument.activeElement === node)).toBe(false);
    await expect.poll(() => ghost.isVisible()).toBe(true);
    expect(await suffix.textContent()).toBe("Continue and run the tests");
    await page.close();
  });

  it("tab-completes the first ordered shortcut from the composer suffix", async () => {
    const page = await browser.newPage();
    const shortcutView: ConsoleView = {
      ...composerRailView,
      vaultState: {
        ...composerRailView.vaultState,
        shortcuts: [
          {
            id: "eager-result",
            text: "eager result",
            createdAt: 0,
            updatedAt: 0,
          },
          {
            id: "review-changes",
            text: "Review changes",
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "review-checklist",
            text: "Review checklist",
            createdAt: 2,
            updatedAt: 2,
          },
          {
            id: "ship-release",
            text: "Ship release safely",
            createdAt: 3,
            updatedAt: 3,
          },
          {
            id: "write-tests",
            text: "Write tests",
            createdAt: 4,
            updatedAt: 4,
          },
        ],
      },
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(shortcutView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else await route.fulfill({ json: { ok: true, items: [] } });
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();

    const input = page.locator("#input");
    const shortcutGhost = page.locator("#composerShortcutGhost");
    const shortcutGhostPrefix = page.locator("#composerShortcutGhostPrefix");
    const shortcutGhostSuffix = page.locator("#composerShortcutGhostSuffix");
    const composerState = () =>
      input.evaluate((node) => {
        const control = node as unknown as {
          ownerDocument: { activeElement: unknown };
          selectionEnd: number | null;
          selectionStart: number | null;
          value: string;
        };
        return {
          focused: control.ownerDocument.activeElement === node,
          selectionEnd: control.selectionEnd,
          selectionStart: control.selectionStart,
          value: control.value,
        };
      });
    const setSelection = (start: number, end = start) =>
      input.evaluate(
        (node, range) =>
          (
            node as unknown as {
              setSelectionRange(start: number, end: number): void;
            }
          ).setSelectionRange(range.start, range.end),
        { end, start },
      );

    expect(await input.getAttribute("aria-autocomplete")).toBe("both");
    expect(await shortcutGhost.getAttribute("aria-hidden")).toBe("true");
    expect(await shortcutGhost.isHidden()).toBe(true);

    await input.fill("Ship");
    await expect.poll(() => shortcutGhost.isVisible()).toBe(true);
    expect(await shortcutGhostSuffix.textContent()).toBe(" release safely");
    expect(await shortcutGhost.locator(".composer-shortcut-ghost-key").textContent()).toBe("Tab");
    const ghostStyle = await shortcutGhost.evaluate((node) => {
      const view = node.ownerDocument.defaultView;
      const suffix = node.querySelector(".composer-shortcut-ghost-suffix");
      const input = node.parentElement?.querySelector("textarea");
      return {
        inputColor: input && view ? view.getComputedStyle(input).color : "",
        pointerEvents: view?.getComputedStyle(node).pointerEvents ?? "",
        suffixColor: suffix && view ? view.getComputedStyle(suffix).color : "",
      };
    });
    expect(ghostStyle.pointerEvents).toBe("none");
    expect(ghostStyle.suffixColor).not.toBe(ghostStyle.inputColor);
    await input.press("Tab");
    expect(await composerState()).toEqual({
      focused: true,
      selectionEnd: "Ship release safely".length,
      selectionStart: "Ship release safely".length,
      value: "Ship release safely",
    });
    expect(await shortcutGhost.isHidden()).toBe(true);

    await page.locator("#list .item", { hasText: "Other session" }).click();
    expect(await input.inputValue()).toBe("");
    expect(await shortcutGhost.isHidden()).toBe(true);
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    expect(await input.inputValue()).toBe("Ship release safely");
    expect(await shortcutGhost.isHidden()).toBe(true);

    await input.fill("Please Write");
    await expect.poll(() => shortcutGhostSuffix.textContent()).toBe(" tests");
    await input.press("Tab");
    expect(await input.inputValue()).toBe("Please Write tests");

    await input.fill("Please Sh");
    await expect.poll(() => shortcutGhostSuffix.textContent()).toBe("ip release safely");
    expect(await shortcutGhostPrefix.textContent()).toBe("Please Sh");
    await input.press("i");
    await expect.poll(() => shortcutGhostSuffix.textContent()).toBe("p release safely");
    await input.press("p");
    await expect.poll(() => shortcutGhostSuffix.textContent()).toBe(" release safely");
    await input.press("Tab");
    expect(await composerState()).toEqual({
      focused: true,
      selectionEnd: "Please Ship release safely".length,
      selectionStart: "Please Ship release safely".length,
      value: "Please Ship release safely",
    });
    expect(await shortcutGhost.isHidden()).toBe(true);

    await input.fill("Notes\nReview ch");
    await expect.poll(() => shortcutGhostSuffix.textContent()).toBe("anges");
    await input.press("Tab");
    expect(await composerState()).toEqual({
      focused: true,
      selectionEnd: "Notes\nReview changes".length,
      selectionStart: "Notes\nReview changes".length,
      value: "Notes\nReview changes",
    });
    expect(await shortcutGhost.isHidden()).toBe(true);

    await input.fill("Unknown");
    expect(await shortcutGhost.isHidden()).toBe(true);
    await input.press("Tab");
    expect(await composerState()).toEqual({
      focused: false,
      selectionEnd: "Unknown".length,
      selectionStart: "Unknown".length,
      value: "Unknown",
    });

    await input.fill("Ship");
    await expect.poll(() => shortcutGhost.isVisible()).toBe(true);
    await input.dispatchEvent("compositionstart");
    await expect.poll(() => shortcutGhost.isHidden()).toBe(true);
    await input.dispatchEvent("compositionend");
    await expect.poll(() => shortcutGhost.isVisible()).toBe(true);
    await setSelection(0, "Ship".length);
    await expect.poll(() => shortcutGhost.isHidden()).toBe(true);
    await input.press("Tab");
    expect(await composerState()).toEqual({
      focused: false,
      selectionEnd: "Ship".length,
      selectionStart: 0,
      value: "Ship",
    });

    await input.fill("Ship release");
    await expect.poll(() => shortcutGhost.isVisible()).toBe(true);
    await setSelection("Ship".length);
    await expect.poll(() => shortcutGhost.isHidden()).toBe(true);
    await input.press("Tab");
    expect(await composerState()).toEqual({
      focused: false,
      selectionEnd: "Ship".length,
      selectionStart: "Ship".length,
      value: "Ship release",
    });
    await page.close();
  });

  it("tab-completes shortcuts in the comment panel input", async () => {
    const page = await browser.newPage();
    const commentShortcutView: ConsoleView = {
      ...commentView,
      vaultState: {
        ...commentView.vaultState,
        shortcuts: [
          {
            id: "review-changes",
            text: "Review changes",
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "review-checklist",
            text: "Review checklist",
            createdAt: 2,
            updatedAt: 2,
          },
          {
            id: "ship-release",
            text: "Ship release safely",
            createdAt: 3,
            updatedAt: 3,
          },
        ],
      },
    };
    let commentSendCount = 0;
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(commentShortcutView),
        });
      } else if (url.pathname === "/comments/messages") {
        await route.fulfill({
          json: {
            thread: commentShortcutView.vaultState?.commentThreads?.["comment-1"],
            messages: [],
          },
        });
      } else if (url.pathname === "/comments/send") {
        commentSendCount++;
        await route.fulfill({ json: { ok: true } });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page
      .locator("#list .item", { hasText: "Avoidance session" })
      .locator(".it-comment")
      .click();

    const input = page.locator("#commentInput");
    const ghost = page.locator("#commentShortcutGhost");
    const suffix = page.locator("#commentShortcutGhostSuffix");
    expect(
      await page.locator(".commentcomposer-surface").evaluate((surface) => {
        const browserWindow = surface.ownerDocument.defaultView as unknown as {
          getComputedStyle(target: typeof surface): {
            borderTopStyle: string;
            borderTopWidth: string;
          };
        };
        const style = browserWindow.getComputedStyle(surface);
        return `${style.borderTopStyle} ${style.borderTopWidth}`;
      }),
    ).toBe("solid 1px");
    expect(await input.getAttribute("aria-autocomplete")).toBe("inline");
    await input.fill("Please Sh");
    await expect.poll(() => ghost.isVisible()).toBe(true);
    expect(await suffix.textContent()).toBe("ip release safely");
    expect(await ghost.locator(".composer-shortcut-ghost-key").textContent()).toBe("Tab");
    await input.press("Tab");
    expect(await input.inputValue()).toBe("Please Ship release safely");
    expect(await ghost.isHidden()).toBe(true);
    expect(commentSendCount).toBe(0);

    await input.fill("Review ch");
    await expect.poll(() => suffix.textContent()).toBe("anges");
    await input.press("Tab");
    expect(await input.inputValue()).toBe("Review changes");

    await input.fill("Ship");
    await expect.poll(() => ghost.isVisible()).toBe(true);
    await input.dispatchEvent("compositionstart");
    await expect.poll(() => ghost.isHidden()).toBe(true);
    await input.dispatchEvent("compositionend");
    await expect.poll(() => ghost.isVisible()).toBe(true);
    await input.press("Escape");
    expect(await page.locator("#commentDrawer").isVisible()).toBe(true);
    expect(await input.evaluate((node) => node.ownerDocument.activeElement === node)).toBe(true);
    expect(await input.inputValue()).toBe("Ship");
    await page.close();
  });

  it("edits and resends only the latest stopped comment user message", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    const sentBodies: Array<Record<string, unknown>> = [];
    let abortStarted = false;
    let releaseAbort = () => {};
    const abortGate = new Promise<void>((resolve) => {
      releaseAbort = resolve;
    });
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(commentView),
        });
      } else if (url.pathname === "/comments/messages") {
        await route.fulfill({
          json: {
            thread: commentView.vaultState?.commentThreads?.["comment-1"],
            messages: [
              { role: "user", text: "Earlier comment question", tools: [] },
              { role: "assistant", text: "Earlier comment answer", tools: [] },
            ],
          },
        });
      } else if (url.pathname === "/comments/send") {
        const body = request.postDataJSON() as Record<string, unknown>;
        sentBodies.push(body);
        await route.fulfill({
          json: {
            ok: true,
            thread: {
              ...commentView.vaultState?.commentThreads?.["comment-1"],
              status: "generating",
              lastUserMessageAt: Date.now(),
              lastUserText: body.question,
              messageCount: 2 + sentBodies.length,
            },
          },
        });
      } else if (url.pathname === "/chat/abort") {
        abortStarted = true;
        await abortGate;
        await route.fulfill({ json: { ok: true } });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });

    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page
      .locator("#list .item", { hasText: "Avoidance session" })
      .locator(".it-comment")
      .click();
    await expect.poll(() => page.locator("#commentMsgs .msg.user").count()).toBe(1);

    await page.locator("#commentInput").fill("Comment sent before Stop");
    await page.locator("#commentSend").click();
    await expect.poll(() => sentBodies.length).toBe(1);
    await expect.poll(() => page.locator("#commentSend").textContent()).toContain("stop");

    await page.locator("#commentSend").click();
    await expect.poll(() => abortStarted).toBe(true);

    const userMessages = page.locator("#commentMsgs .msg.user");
    expect(await userMessages.count()).toBe(2);
    const earlierUser = userMessages.nth(0);
    const latestUser = userMessages.nth(1);
    expect(await earlierUser.locator(".comment-msg-edit").isHidden()).toBe(true);
    await latestUser.hover();
    await expect.poll(() => latestUser.locator(".comment-msg-edit").isVisible()).toBe(true);
    await latestUser.locator(".comment-msg-edit").click();

    const editor = latestUser.locator(".inline-edit-ta");
    await editor.fill("Edited comment to resend");
    const save = latestUser.locator(".inline-edit-save");
    await save.click();
    expect(sentBodies).toHaveLength(1);
    expect(await save.isDisabled()).toBe(true);
    expect((await save.textContent())?.toLowerCase()).toContain("stopping");

    releaseAbort();
    await expect.poll(() => sentBodies.length).toBe(2);
    expect(sentBodies[1]).toMatchObject({
      threadId: "comment-1",
      question: "Edited comment to resend",
    });
    expect(await page.locator("#commentMsgs .msg.user").count()).toBe(2);
    expect(await latestUser.locator(".bubble").textContent()).toContain("Edited comment to resend");
    await page.close();
  });

  it("arms the Goal toggle beside attachments and submits the next message as a Goal", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    let sentBody: Record<string, unknown> | null = null;
    let cleared = false;
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(composerRailView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/chat/queue") {
        await route.fulfill({ json: { ok: true, items: [], parked: false } });
      } else if (url.pathname === "/chat/goal" && request.method() === "GET") {
        await route.fulfill({
          json: { ok: true, supported: true, goal: null },
        });
      } else if (url.pathname === "/chat/goal/clear") {
        cleared = true;
        await route.fulfill({ json: { ok: true, goal: null } });
      } else if (url.pathname === "/chat/send") {
        sentBody = request.postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          json: {
            ok: true,
            session: "s1",
            goal: {
              threadId: "s1",
              objective: "finish and verify this change",
              vendor: "claude",
              status: "active",
              updatedAt: Date.now(),
            },
          },
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();

    const order = await page.locator("#composer .composeractions").evaluate((row) =>
      Array.from(
        row.querySelectorAll("button") as unknown as ArrayLike<{
          id: string;
        }>,
      )
        .map((node) => node.id)
        .filter(Boolean),
    );
    expect(order.indexOf("attach")).toBeLessThan(order.indexOf("goalToggle"));
    expect(order.indexOf("goalToggle")).toBeLessThan(order.indexOf("forkBtn"));
    expect(order.indexOf("forkBtn")).toBeLessThan(order.indexOf("send"));

    await page.locator("#goalToggle").hover();
    const before = await page
      .locator("#goalToggle")
      .evaluate(
        (button) => button.ownerDocument.defaultView?.getComputedStyle(button).backgroundColor,
      );
    await page.locator("#goalToggle").click();
    expect(await page.locator("#goalToggle").getAttribute("class")).toContain("armed");
    await expect
      .poll(() =>
        page
          .locator("#goalToggle")
          .evaluate(
            (button) => button.ownerDocument.defaultView?.getComputedStyle(button).backgroundColor,
          ),
      )
      .not.toBe(before);
    expect(await page.locator("#input").getAttribute("placeholder")).toContain("completion");

    await page.locator("#input").fill("finish and verify this change");
    await page.locator("#send").click();
    await expect.poll(() => sentBody).not.toBeNull();
    expect(sentBody).toMatchObject({
      text: "finish and verify this change",
      goal: true,
    });
    await expect.poll(() => page.locator("#goalToggle").getAttribute("class")).toContain("active");

    await page.locator("#goalToggle").click();
    await expect.poll(() => cleared).toBe(true);
    await expect
      .poll(() => page.locator("#goalToggle").getAttribute("class"))
      .not.toContain("active");
    await expect.poll(() => page.locator("#goalToggle").isEnabled()).toBe(true);
    await page.locator("#goalToggle").click();
    expect(await page.locator("#goalToggle").getAttribute("class")).toContain("pursuing");
    await page.close();
  });

  it("arms Goal during generation for the next queued message only", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    let queuedBody: Record<string, unknown> | null = null;
    let directSendCount = 0;
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as Record<string, unknown>;
      class StubEventSource {
        static readonly CLOSED = 2;
        onmessage: ((event: { data: string }) => void) | null = null;
        constructor() {
          browserGlobal.__attendEventSource = this;
        }
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(composerRailView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/chat/goal") {
        await route.fulfill({
          json: { ok: true, supported: true, goal: null },
        });
      } else if (url.pathname === "/chat/queue" && request.method() === "POST") {
        queuedBody = request.postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          json: {
            ok: true,
            items: [
              {
                id: "queued-goal",
                text: queuedBody.text,
                attachments: [],
                goal: true,
              },
            ],
            parked: false,
          },
        });
      } else if (url.pathname === "/chat/queue") {
        await route.fulfill({ json: { ok: true, items: [], parked: false } });
      } else if (url.pathname === "/chat/send") {
        directSendCount += 1;
        await route.fulfill({ json: { ok: true, session: "s1" } });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await page.evaluate(() => {
      const source = (globalThis as unknown as Record<string, unknown>).__attendEventSource as {
        onmessage(event: { data: string }): void;
      };
      source.onmessage({
        data: JSON.stringify({
          kind: "session_event",
          sessionId: "s1",
          emittedAt: Date.now(),
          event: { kind: "user_turn_started", text: "current turn" },
        }),
      });
    });

    await expect.poll(() => page.locator("#goalToggle").isEnabled()).toBe(true);
    await page.locator("#goalToggle").click();
    expect(await page.locator("#goalToggle").getAttribute("class")).toContain("pursuing");
    await page.locator("#input").fill("becomes a goal after this turn");
    await page.locator("#input").press("Enter");

    await expect
      .poll(() => queuedBody)
      .toMatchObject({
        text: "becomes a goal after this turn",
        goal: true,
      });
    expect(directSendCount).toBe(0);
    expect(await page.locator("#goalToggle").getAttribute("class")).not.toContain("active");
    await expect.poll(() => page.locator("#queue .qitem").textContent()).toContain("goal");
    await page.close();
  });

  it("labels active queued actions as Claude append and Codex guide", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as Record<string, unknown>;
      class StubEventSource {
        static readonly CLOSED = 2;
        onmessage: ((event: { data: string }) => void) | null = null;
        constructor() {
          browserGlobal.__attendEventSource = this;
        }
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(composerRailView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/chat/queue") {
        await route.fulfill({
          json: {
            ok: true,
            items: [
              { id: "queued-claude", text: "continue this answer", vendor: "claude" },
              { id: "queued-codex", text: "focus on the tests", vendor: "codex" },
            ],
            parked: false,
            steerable: true,
          },
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await page.evaluate(() => {
      const source = (globalThis as unknown as Record<string, unknown>).__attendEventSource as {
        onmessage(event: { data: string }): void;
      };
      source.onmessage({
        data: JSON.stringify({
          kind: "session_event",
          sessionId: "s1",
          emittedAt: Date.now(),
          event: { kind: "user_turn_started", text: "current turn" },
        }),
      });
    });

    const queuedRows = page.locator("#queue .qitem");
    await expect.poll(() => queuedRows.nth(0).locator(".qsend").textContent()).toBe("append");
    expect(await queuedRows.nth(0).locator(".qsend").getAttribute("data-hover-tip")).toContain(
      "Append",
    );
    await expect.poll(() => queuedRows.nth(1).locator(".qsend").textContent()).toBe("guide");
    expect(await queuedRows.nth(1).locator(".qsend").getAttribute("data-hover-tip")).toContain(
      "Guide",
    );

    await queuedRows.nth(0).locator(".qedit").click();
    await expect.poll(() => page.locator("#queue .qeditbox .qsend").textContent()).toBe("append");
    await page.locator("#queue .qeditta").press("Escape");
    await queuedRows.nth(1).locator(".qedit").click();
    await expect.poll(() => page.locator("#queue .qeditbox .qsend").textContent()).toBe("guide");
    await page.close();
  });

  it("appends a queued Claude message without ending the active turn", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    let queuedItem: { id: string; text: string } | null = null;
    let steeredItem = "";
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as Record<string, unknown>;
      class StubEventSource {
        static readonly CLOSED = 2;
        onmessage: ((event: { data: string }) => void) | null = null;
        constructor() {
          browserGlobal.__attendEventSource = this;
        }
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(composerRailView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/chat/queue" && request.method() === "POST") {
        const body = request.postDataJSON() as { text: string };
        queuedItem = { id: "queued-steer-1", text: body.text };
        await route.fulfill({
          json: {
            ok: true,
            items: [queuedItem],
            parked: false,
            steerable: true,
          },
        });
      } else if (url.pathname === "/chat/queue/send") {
        steeredItem = url.searchParams.get("item") ?? "";
        queuedItem = null;
        await route.fulfill({
          json: {
            ok: true,
            steered: true,
            items: [],
            parked: false,
            steerable: false,
          },
        });
      } else if (url.pathname === "/chat/queue") {
        await route.fulfill({
          json: {
            ok: true,
            items: queuedItem ? [queuedItem] : [],
            parked: false,
            steerable: !!queuedItem,
          },
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    const emit = (event: Record<string, unknown>) =>
      page.evaluate((nextEvent) => {
        const source = (globalThis as unknown as Record<string, unknown>).__attendEventSource as {
          onmessage(event: { data: string }): void;
        };
        source.onmessage({
          data: JSON.stringify({
            kind: "session_event",
            sessionId: "s1",
            emittedAt: Date.now(),
            event: nextEvent,
          }),
        });
      }, event);
    await emit({ kind: "user_turn_started", text: "current turn" });

    await page.locator("#input").fill("append this to the response");
    await page.locator("#input").press("Enter");
    await expect.poll(() => page.locator("#queue .qsend").textContent()).toBe("append");
    expect(await page.locator("#queue .qsend").getAttribute("data-hover-tip")).toContain("Append");
    await page.locator("#queue .qsend").click();
    await expect.poll(() => steeredItem).toBe("queued-steer-1");
    await expect.poll(() => page.locator("#queue .qitem").count()).toBe(0);
    expect(await page.locator("#send").textContent()).toContain("stop");

    await emit({
      kind: "queued_turn_steered",
      queueId: "queued-steer-1",
      text: "append this to the response",
    });
    await expect
      .poll(() => page.locator("#msgs .msg.user .bubble").last().textContent())
      .toContain("append this to the response");
    expect(await page.locator("#send").textContent()).toContain("stop");
    await page.close();
  });

  it("keeps the latest user-message age current when the send view is transcript-stale", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    const oldPromptAt = Date.now() - 65 * 60_000;
    const baseSession = composerRailView.sessions[0];
    if (!baseSession) throw new Error("missing session fixture");
    const staleSession: ConsoleView["sessions"][number] = {
      ...baseSession,
      lastTs: oldPromptAt,
      userPromptTs: [oldPromptAt],
    };
    const staleView: ConsoleView = {
      ...composerRailView,
      sessions: [staleSession, ...composerRailView.sessions.slice(1)],
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(staleView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/chat/send") {
        await route.fulfill({
          json: {
            ok: true,
            session: "s1",
            view: {
              ...staleSession,
              lastPrompt: "latest prompt from a stale scan",
            },
          },
        });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await page.locator("#input").fill("fresh user message");
    const sendResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/chat/send",
    );
    await page.locator("#send").click();
    await sendResponse;

    const row = page.locator('#list .item[data-session-id="s1"]');
    const latest = row.locator(".prompt-line:has(.prompt-line-latest)");
    await expect.poll(() => latest.locator(".prompt-line-latest").textContent()).toBe("now");
    expect(await latest.locator(".prompt-line-text").textContent()).toBe("fresh user message");
    expect(await row.locator(".it-age").textContent()).toBe("now");
    await page.close();
  });

  it("reorders shortcut priority with persistent controls and preserves rail state", async () => {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    const reviewZebra = {
      id: "review-zebra",
      text: "Review zebra",
      createdAt: 20,
      updatedAt: 20,
    };
    const reviewAlpha = {
      id: "review-alpha",
      text: "Review alpha",
      createdAt: 10,
      updatedAt: 10,
    };
    const trailingShortcuts = [
      {
        id: "ship-release",
        text: "Ship release safely",
        createdAt: 30,
        updatedAt: 30,
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `filler-${index}`,
        text: `Filler shortcut ${index}`,
        createdAt: 100 + index,
        updatedAt: 100 + index,
      })),
    ];
    const initialShortcuts = [reviewZebra, reviewAlpha, ...trailingShortcuts];
    const movedUpShortcuts = [reviewAlpha, reviewZebra, ...trailingShortcuts];
    const shortcutWrites: Array<typeof initialShortcuts> = [];
    const shortcutView: ConsoleView = {
      ...composerRailView,
      vaultState: {
        ...composerRailView.vaultState,
        shortcuts: initialShortcuts,
      },
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(shortcutView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/vault/ui-state" && request.method() === "POST") {
        const body = request.postDataJSON() as {
          shortcuts?: typeof initialShortcuts;
        };
        if (body.shortcuts) shortcutWrites.push(body.shortcuts);
        await route.fulfill({ json: { ok: true } });
      } else await route.fulfill({ json: { ok: true, items: [] } });
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await page.locator("#railShortcuts").click();
    await expect
      .poll(() =>
        page.locator(":focus").evaluate((node) => (node as unknown as { id: string }).id || null),
      )
      .toBe("railAddInput");

    const pop = page.locator("#composerRailPop");
    const body = pop.locator(".railpop-body");
    const rows = pop.locator(".rail-item");
    const rowFor = (id: string) => pop.locator(`.rail-item[data-rail-item-id="${id}"]`);
    const shortcutOrder = () => rows.locator(".rail-item-text").allTextContents();
    const focusedRailAction = () =>
      page.locator(":focus").evaluate((node) => ({
        itemId: node.closest(".rail-item")?.getAttribute("data-rail-item-id") ?? null,
        isMoveAction: node.classList.contains("qmove"),
      }));

    await expect.poll(() => shortcutOrder()).toEqual(initialShortcuts.map((item) => item.text));
    const firstRow = rowFor(reviewZebra.id);
    const middleRow = rowFor(reviewAlpha.id);
    const lastRow = rowFor(trailingShortcuts.at(-1)?.id ?? "");
    expect(await firstRow.locator(".qmove-up").isDisabled()).toBe(true);
    expect(await firstRow.locator(".qmove-down").isDisabled()).toBe(false);
    expect(await middleRow.locator(".qmove-up").isDisabled()).toBe(false);
    expect(await middleRow.locator(".qmove-down").isDisabled()).toBe(false);
    expect(await lastRow.locator(".qmove-up").isDisabled()).toBe(false);
    expect(await lastRow.locator(".qmove-down").isDisabled()).toBe(true);

    const scrollTop = await body.evaluate((panel) => {
      const target = Math.min(96, panel.scrollHeight - panel.clientHeight);
      panel.scrollTop = target;
      return panel.scrollTop;
    });
    expect(scrollTop).toBeGreaterThan(0);
    await middleRow
      .locator(".qmove-up")
      .evaluate((button) => (button as unknown as { click(): void }).click());

    await expect.poll(() => shortcutOrder()).toEqual(movedUpShortcuts.map((item) => item.text));
    expect(await focusedRailAction()).toEqual({
      isMoveAction: true,
      itemId: reviewAlpha.id,
    });
    expect(await body.evaluate((panel) => panel.scrollTop)).toBe(scrollTop);
    expect(await rowFor(reviewAlpha.id).locator(".qmove-up").isDisabled()).toBe(true);
    await expect.poll(() => shortcutWrites).toEqual([movedUpShortcuts]);

    const input = page.locator("#input");
    await input.click();
    expect(await pop.isHidden()).toBe(true);
    await input.fill("Do: Review");
    await expect
      .poll(() => page.locator("#composerShortcutGhostSuffix").textContent())
      .toBe(" alpha");
    await input.press("Tab");
    expect(await input.inputValue()).toBe(`Do: ${reviewAlpha.text}`);
    expect(await input.evaluate((node) => node.ownerDocument.activeElement === node)).toBe(true);

    await page.locator("#railShortcuts").click();
    await expect
      .poll(() =>
        page.locator(":focus").evaluate((node) => (node as unknown as { id: string }).id || null),
      )
      .toBe("railAddInput");
    await rowFor(reviewAlpha.id).locator(".qmove-down").click();

    await expect.poll(() => shortcutOrder()).toEqual(initialShortcuts.map((item) => item.text));
    expect(await focusedRailAction()).toEqual({
      isMoveAction: true,
      itemId: reviewAlpha.id,
    });
    await expect.poll(() => shortcutWrites).toEqual([movedUpShortcuts, initialShortcuts]);
    await page.close();
  }, 10_000);

  it("keeps an immediate Stop-then-edit flow in resend mode until abort completes", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    const sentBodies: Array<Record<string, unknown>> = [];
    let abortStarted = false;
    let releaseAbort = () => {};
    const abortGate = new Promise<void>((resolve) => {
      releaseAbort = resolve;
    });
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(composerRailView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            { role: "user", text: "Earlier question" },
            { role: "assistant", text: "Earlier answer" },
          ],
        });
      } else if (url.pathname === "/chat/send") {
        sentBodies.push(request.postDataJSON() as Record<string, unknown>);
        await route.fulfill({ json: { ok: true } });
      } else if (url.pathname === "/chat/abort") {
        abortStarted = true;
        await abortGate;
        await route.fulfill({ json: { ok: true } });
      } else if (url.pathname === "/chat/queue") {
        await route.fulfill({ json: { ok: true, parked: false, items: [] } });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });

    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await expect.poll(() => page.locator("#msgs .msg.user").count()).toBe(1);
    await page.locator("#input").fill("Message sent before Stop");
    await page.locator("#send").click();
    await expect.poll(() => sentBodies.length).toBe(1);
    await expect.poll(() => page.locator("#send").textContent()).toContain("stop");

    await page.locator("#send").click();
    await expect.poll(() => abortStarted).toBe(true);
    const latestUser = page.locator("#msgs .msg.user").last();
    await latestUser.hover();
    await latestUser.locator(".msg-edit").click();
    const save = latestUser.locator(".inline-edit-save");
    expect((await save.textContent())?.toLowerCase()).toContain("send");
    expect(await save.getAttribute("class")).not.toContain("fork-action");
    const resendInput = latestUser.locator(".inline-edit-ta");
    await expect
      .poll(() => resendInput.evaluate((node) => node.ownerDocument.activeElement === node))
      .toBe(true);
    await resendInput.fill("Edited message to resend");
    await save.click();
    expect(sentBodies).toHaveLength(1);
    expect(await save.isDisabled()).toBe(true);
    expect((await save.textContent())?.toLowerCase()).toContain("stopping");

    releaseAbort();
    await expect.poll(() => sentBodies.length).toBe(2);
    expect(sentBodies[1]).toMatchObject({ text: "Edited message to resend" });
    await page.close();
  }, 10_000);

  it("uses the shared close control for user-message editing and exits with Escape", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    let scheduledEdit: Record<string, unknown> | null = null;
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(composerRailView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            { role: "user", text: "Original user message" },
            { role: "assistant", text: "Original response" },
            { role: "user", text: "Later user message" },
            { role: "assistant", text: "Later response" },
          ],
        });
      } else if (url.pathname === "/schedules" && route.request().method() === "POST") {
        scheduledEdit = route.request().postDataJSON() as Record<string, unknown>;
        const payload = scheduledEdit.payload as Record<string, unknown>;
        const item = {
          id: "scheduled-edit-fork",
          jobId: "scheduled-edit-job",
          kind: "session",
          runAt: scheduledEdit.runAt,
          timezone: scheduledEdit.timezone,
          status: "scheduled",
          payload: { ...payload, kind: "session" },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await route.fulfill({ json: { ok: true, item, schedules: [item] } });
      } else await route.fulfill({ json: { ok: true, items: [] } });
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await expect.poll(() => page.locator("#msgs .msg.user").count()).toBe(2);

    const user = page.locator("#msgs .msg.user").first();
    await page.locator("#h-tags .it-tagadd").click();
    const tagCloseStyle = await page
      .locator("#sessionTagPopover .edit-cancel")
      .evaluate((button) => {
        const style = button.ownerDocument.defaultView?.getComputedStyle(button);
        const icon = button.querySelector("svg");
        const iconStyle = icon && button.ownerDocument.defaultView?.getComputedStyle(icon);
        return {
          background: style?.backgroundColor,
          border: style?.borderTopColor,
          borderRadius: style?.borderRadius,
          color: style?.color,
          height: style?.height,
          iconHeight: iconStyle?.height,
          iconWidth: iconStyle?.width,
          opacity: style?.opacity,
          width: style?.width,
        };
      });
    await page.locator("#sessionTagPopover .edit-cancel").click();
    await user.hover();
    await user.locator(".msg-edit").click();
    expect(await user.locator(".inline-edit .edit-cancel svg").count()).toBe(1);
    const userCloseStyle = await user.locator(".inline-edit .edit-cancel").evaluate((button) => {
      const style = button.ownerDocument.defaultView?.getComputedStyle(button);
      const icon = button.querySelector("svg");
      const iconStyle = icon && button.ownerDocument.defaultView?.getComputedStyle(icon);
      return {
        background: style?.backgroundColor,
        border: style?.borderTopColor,
        borderRadius: style?.borderRadius,
        color: style?.color,
        height: style?.height,
        iconHeight: iconStyle?.height,
        iconWidth: iconStyle?.width,
        opacity: style?.opacity,
        width: style?.width,
      };
    });
    expect(userCloseStyle).toEqual(tagCloseStyle);
    expect(await user.locator(".inline-edit-save").getAttribute("class")).not.toContain(
      "fork-action",
    );
    expect(await user.locator(".inline-edit-save").getAttribute("data-vendor")).toBeNull();
    expect(await user.locator(".inline-edit-save .splitbtn-ico circle").count()).toBe(3);
    await user.locator(".inline-edit-save").focus();
    await page.keyboard.press("Escape");
    await expect.poll(() => user.locator(".inline-edit").count()).toBe(0);
    expect(await user.locator(".bubble").textContent()).toContain("Original user message");

    await user.hover();
    await user.locator(".msg-edit").click();
    const scheduledForkInput = user.locator(".inline-edit-ta");
    await expect
      .poll(() => scheduledForkInput.evaluate((node) => node.ownerDocument.activeElement === node))
      .toBe(true);
    await scheduledForkInput.fill("Scheduled edited fork");
    await user.locator(".inline-edit .schedulebtn").click();
    await expect.poll(() => page.locator("#scheduleActions").isVisible()).toBe(true);
    await page.locator("#scheduleActions .scheduleaction", { hasText: "Fork" }).click();
    await expect.poll(() => scheduledEdit).not.toBeNull();
    expect(scheduledEdit).toMatchObject({
      kind: "session",
      payload: {
        mode: "fork",
        parentSessionId: "s1",
        text: "Scheduled edited fork",
        contextMessages: [],
      },
    });
    await expect.poll(() => page.locator("#list").textContent()).toContain("Scheduled edited fork");
    await page.close();
  });

  it("shrinks a cleared multiline sent-message editor and tab-completes shortcuts", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(composerRailView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            {
              role: "user",
              text: "Original user message\nSecond line\nThird line",
            },
            { role: "assistant", text: "Original response" },
          ],
        });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await expect.poll(() => page.locator("#msgs .msg.user").count()).toBe(1);

    const user = page.locator("#msgs .msg.user");
    await user.hover();
    await user.locator(".msg-edit").click();
    const input = user.locator(".inline-edit-ta");
    const expandedHeight = await input.evaluate((node) => node.clientHeight);
    expect(await input.getAttribute("rows")).toBe("3");

    await input.fill("");
    expect(await input.getAttribute("rows")).toBe("1");
    expect(await user.locator(".inline-edit").getAttribute("class")).toContain("single-line");
    expect(await input.evaluate((node) => node.clientHeight)).toBeLessThan(expandedHeight);

    await input.fill("Rev");
    await input.press("Tab");

    expect(await input.inputValue()).toBe("Review changes");
    expect(await input.evaluate((node) => node.ownerDocument.activeElement === node)).toBe(true);
    expect(await user.locator(".inline-edit").count()).toBe(1);

    await input.press("Escape");
    await expect.poll(() => user.locator(".inline-edit").count()).toBe(0);
    expect(await user.locator(".bubble").textContent()).toContain("Original user message");
    await page.close();
  });

  it("replays a fork daemon verdict that arrives before provider binding", async () => {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 800 },
    });
    let releaseFork = () => {};
    let noteForkRequest = () => {};
    const forkGate = new Promise<void>((resolve) => {
      releaseFork = resolve;
    });
    const forkRequested = new Promise<void>((resolve) => {
      noteForkRequest = resolve;
    });
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as Record<string, unknown>;
      class StubEventSource {
        static readonly CLOSED = 2;
        onmessage: ((event: { data: string }) => void) | null = null;
        constructor() {
          browserGlobal.__forkAnalysisEventSource = this;
        }
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(composerRailView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/chat/fork") {
        noteForkRequest();
        await forkGate;
        await route.fulfill({
          json: {
            ok: true,
            session: "fork-provider-fast-analysis",
            parentSessionId: "s1",
            generating: false,
          },
        });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator('#list .item[data-session-id="s1"]').click();
    await page.locator("#input").fill("fork with an immediate daemon verdict");
    await page.locator("#forkBtn").click();
    await forkRequested;

    await page.evaluate(async () => {
      const source = (globalThis as unknown as Record<string, unknown>)
        .__forkAnalysisEventSource as {
        onmessage: ((event: { data: string }) => void) | null;
      };
      source.onmessage?.({
        data: JSON.stringify({
          kind: "analysis",
          sessionId: "fork-provider-fast-analysis",
          analysis: {
            brief: "Fork daemon brief",
            state: "needs_input",
            priority: 8,
            etaMin: 12,
            reason: "Fork daemon reason",
            nextStep: "Answer the fork",
            probe: null,
          },
        }),
      });
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    releaseFork();

    const forkCard = page.locator("#list .item", {
      hasText: "fork with an immediate daemon verdict",
    });
    await expect.poll(() => forkCard.count()).toBe(1);
    await forkCard.click();
    await expect.poll(() => page.locator("#h-title").textContent()).toContain("Fork daemon brief");
    await expect.poll(() => page.locator("#h-sig").textContent()).toContain("Fork daemon reason");
    expect(await page.locator("#h-sig").textContent()).toContain("12m");
    await page.close();
  });

  it("preserves completed tool status when forking from an edited message", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    let releaseFork = () => {};
    const forkGate = new Promise<void>((resolve) => {
      releaseFork = resolve;
    });
    type ForkBody = {
      contextMessages?: Array<{
        tools?: Array<{
          id?: string | null;
          name?: string;
          input?: unknown;
          result?: string;
          isError?: boolean;
        }>;
      }>;
    };
    let forkBody: ForkBody | null = null;
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(composerRailView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            { role: "user", text: "Original user message", tools: [] },
            {
              role: "assistant",
              text: "Checked the workspace",
              tools: [
                {
                  id: "exec-output",
                  name: "exec",
                  input: "run output command",
                  result: "done",
                },
                {
                  id: "exec-empty",
                  name: "exec",
                  input: "run silent command",
                  result: "",
                },
                {
                  id: "exec-error",
                  name: "exec",
                  input: "run failing command",
                  result: "failed",
                  isError: true,
                },
                { id: "exec-pending", name: "exec", input: "still running" },
              ],
            },
            { role: "user", text: "Later user message", tools: [] },
            { role: "assistant", text: "Later response", tools: [] },
          ],
        });
      } else if (url.pathname === "/chat/fork") {
        forkBody = request.postDataJSON() as typeof forkBody;
        await forkGate;
        await route.fulfill({
          json: {
            ok: true,
            session: "fork-provider-tools",
            parentSessionId: "s1",
            generating: true,
          },
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await expect.poll(() => page.locator("#msgs .msg.user").count()).toBe(2);

    const laterUser = page.locator("#msgs .msg.user").last();
    await laterUser.hover();
    await laterUser.locator(".msg-edit").click();
    await laterUser.locator(".inline-edit-ta").fill("Forked later user message");
    await laterUser.locator(".inline-edit-save").click();

    await expect.poll(() => forkBody).not.toBeNull();
    await expect.poll(() => page.locator("#msgs .toolc").count()).toBe(4);
    expect(
      await page
        .locator('#msgs .toolc[data-tool-id="exec-output"]')
        .getAttribute("data-tool-pending"),
    ).toBeNull();
    expect(
      await page
        .locator('#msgs .toolc[data-tool-id="exec-empty"]')
        .getAttribute("data-tool-pending"),
    ).toBeNull();
    expect(
      await page
        .locator('#msgs .toolc[data-tool-id="exec-error"]')
        .getAttribute("data-tool-pending"),
    ).toBeNull();
    expect(
      await page.locator('#msgs .toolc[data-tool-id="exec-error"]').getAttribute("data-tool-error"),
    ).toBe("true");
    expect(
      await page
        .locator('#msgs .toolc[data-tool-id="exec-pending"]')
        .getAttribute("data-tool-pending"),
    ).toBe("true");

    const capturedForkBody = forkBody as ForkBody | null;
    const contextTools =
      capturedForkBody?.contextMessages?.flatMap((message) => message.tools ?? []) ?? [];
    expect(contextTools).toEqual([
      {
        id: "exec-output",
        name: "exec",
        input: "run output command",
        result: "done",
      },
      {
        id: "exec-empty",
        name: "exec",
        input: "run silent command",
        result: "",
      },
      {
        id: "exec-error",
        name: "exec",
        input: "run failing command",
        result: "failed",
        isError: true,
      },
      { id: "exec-pending", name: "exec", input: "still running" },
    ]);

    releaseFork();
    await expect.poll(() => page.locator("#list .item.active").count()).toBe(1);
    await page.close();
  });

  it("navigates user-message history like a terminal and restores the original draft", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(raceView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            { role: "user", text: "Earlier question" },
            { role: "assistant", text: "Earlier answer" },
            { role: "user", text: "Most recent\nuser message" },
            { role: "assistant", text: "Latest answer" },
          ],
        });
      } else await route.fulfill({ json: { ok: true, items: [] } });
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await expect.poll(() => page.locator("#msgs .msg.user").count()).toBe(2);

    const input = page.locator("#input");
    await input.fill("draft in progress");
    await input.press("ArrowUp");
    expect(await input.inputValue()).toBe("Most recent\nuser message");
    await input.press("ArrowUp");
    expect(await input.inputValue()).toBe("Most recent\nuser message");
    await input.press("ArrowUp");
    expect(await input.inputValue()).toBe("Earlier question");
    await input.press("ArrowUp");
    expect(await input.inputValue()).toBe("Earlier question");
    await input.press("ArrowDown");
    expect(await input.inputValue()).toBe("Most recent\nuser message");
    await input.press("ArrowDown");
    expect(await input.inputValue()).toBe("draft in progress");
    await input.press("ArrowDown");
    expect(await input.inputValue()).toBe("draft in progress");
    expect(
      await input.evaluate(
        (node) => (node as unknown as { selectionStart: number }).selectionStart,
      ),
    ).toBe("draft in progress".length);

    await input.press("ArrowUp");
    await input.type(" edited");
    expect(await input.inputValue()).toBe("Most recent\nuser message edited");
    await input.press("ArrowDown");
    expect(await input.inputValue()).toBe("draft in progress");
    await input.press("ArrowUp");
    expect(await input.inputValue()).toBe("Most recent\nuser message edited");
    await input.press("ArrowUp");
    expect(await input.inputValue()).toBe("Most recent\nuser message edited");
    await input.press("ArrowUp");
    expect(await input.inputValue()).toBe("Earlier question");
    await input.press("ArrowDown");
    expect(await input.inputValue()).toBe("Most recent\nuser message edited");
    await input.press("ArrowDown");
    expect(await input.inputValue()).toBe("draft in progress");
    await page.close();
  });

  it("keeps arrow navigation inside soft-wrapped composer lines before traversing history", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    const latestHistory =
      "latest history message wraps across several narrow composer visual lines";
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(raceView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            { role: "user", text: "older history message" },
            { role: "assistant", text: "Earlier answer" },
            { role: "user", text: latestHistory },
          ],
        });
      } else await route.fulfill({ json: { ok: true, items: [] } });
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await expect.poll(() => page.locator("#msgs .msg.user").count()).toBe(2);

    const input = page.locator("#input");
    type ComposerTextarea = {
      scrollHeight: number;
      selectionStart: number;
      setSelectionRange(start: number, end: number): void;
      style: {
        width: string;
        maxWidth: string;
        flex: string;
        paddingLeft: string;
        paddingRight: string;
        fontFamily: string;
        fontSize: string;
        lineHeight: string;
      };
      value: string;
    };
    await input.evaluate((node) => {
      const textarea = node as unknown as ComposerTextarea;
      textarea.style.width = "140px";
      textarea.style.maxWidth = "140px";
      textarea.style.flex = "0 0 140px";
      textarea.style.paddingLeft = "0";
      textarea.style.paddingRight = "0";
      textarea.style.fontFamily = "monospace";
      textarea.style.fontSize = "16px";
      textarea.style.lineHeight = "20px";
    });
    const draft = "draft text wraps across several narrow composer visual lines";
    await input.fill(draft);
    expect(
      await input.evaluate((node) => (node as unknown as ComposerTextarea).scrollHeight > 3 * 20),
    ).toBe(true);

    await input.evaluate((node) => (node as unknown as ComposerTextarea).setSelectionRange(30, 30));
    await input.press("ArrowUp");
    expect(await input.inputValue()).toBe(draft);
    expect(
      await input.evaluate((node) => (node as unknown as ComposerTextarea).selectionStart),
    ).toBeLessThan(30);

    await input.evaluate((node) => (node as unknown as ComposerTextarea).setSelectionRange(3, 3));
    await input.press("ArrowUp");
    expect(await input.inputValue()).toBe(latestHistory);

    await input.evaluate((node) => (node as unknown as ComposerTextarea).setSelectionRange(25, 25));
    await input.press("ArrowDown");
    expect(await input.inputValue()).toBe(latestHistory);
    expect(
      await input.evaluate((node) => (node as unknown as ComposerTextarea).selectionStart),
    ).toBeGreaterThan(25);

    await input.evaluate((node) => {
      const textarea = node as unknown as ComposerTextarea;
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
    await input.press("ArrowDown");
    expect(await input.inputValue()).toBe(draft);
    await page.close();
  });

  it("keeps terminal-style message history and drafts isolated by session", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(raceView),
        });
      } else if (url.pathname === "/chat/messages") {
        const firstSession = url.searchParams.get("file") === "/tmp/session-1.jsonl";
        await route.fulfill({
          json: firstSession
            ? [
                { role: "user", text: "First session older" },
                { role: "assistant", text: "First answer" },
                { role: "user", text: "First session latest" },
              ]
            : [
                { role: "user", text: "Second session history" },
                { role: "assistant", text: "Second answer" },
              ],
        });
      } else await route.fulfill({ json: { ok: true, items: [] } });
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await expect.poll(() => page.locator("#msgs .msg.user").count()).toBe(2);
    const input = page.locator("#input");
    await input.fill("first session draft");
    await input.press("ArrowUp");
    await input.press("ArrowUp");
    expect(await input.inputValue()).toBe("First session older");

    await page.locator("#list .item", { hasText: "Other session" }).click();
    await expect.poll(() => page.locator("#msgs .msg.user").count()).toBe(1);
    expect(await input.inputValue()).toBe("");
    await input.press("ArrowUp");
    expect(await input.inputValue()).toBe("Second session history");
    await input.press("ArrowDown");
    expect(await input.inputValue()).toBe("");

    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    expect(await input.inputValue()).toBe("first session draft");
    await input.press("ArrowUp");
    expect(await input.inputValue()).toBe("First session latest");
    await page.close();
  });

  it("defaults to the latest dir while listing process-level recent and child directories", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    const rootA = "/work/vault-a";
    const rootB = "/work/vault-b";
    const recentDir = `${rootB}/recent/repo`;
    const recentDirs = Array.from({ length: 7 }, (_, index) => `${rootB}/recent/repo-${index}`);
    const childDir = `${rootB}/child-project`;
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        return route.fulfill({
          contentType: "text/html",
          body: renderConsole({
            ...view,
            knownDirs: [recentDir, `${rootA}/other`, ...recentDirs],
            scopeRoots: [rootA, rootB],
            defaultNewDir: recentDir,
          }),
        });
      }
      if (url.pathname === "/dirs/suggest") {
        return route.fulfill({
          json: { dirs: [{ path: childDir, source: "folder" }] },
        });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    expect(await page.locator("#ndir").inputValue()).toBe(recentDir);
    await page.locator("#newToggle").click();
    await page.locator("#ndir").focus();
    await expect
      .poll(() =>
        page
          .locator("#ndirSug .chooser-opt")
          .evaluateAll((options) => options.map((option) => option.getAttribute("data-value"))),
      )
      .toEqual(expect.arrayContaining([recentDir, `${rootA}/other`, childDir]));
    expect(await page.locator("#ndirSug .chooser-opt-note", { hasText: "recent" }).count()).toBe(5);
    const placement = await page.locator("#ndirSug").evaluate((drop) => {
      const browserWindow = drop.ownerDocument.defaultView as unknown as {
        getComputedStyle(target: typeof drop): { position: string };
      };
      return {
        parent: drop.parentElement?.tagName,
        position: browserWindow.getComputedStyle(drop).position,
      };
    });
    expect(placement).toEqual({ parent: "BODY", position: "fixed" });
    await page.locator(`#ndirSug .chooser-opt[data-value="${childDir}"]`).click();
    expect(await page.locator("#ndir").inputValue()).toBe(childDir);
    await page.close();
  });

  it("returns to All when the selected non-All view is clicked again", async () => {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as { EventSource: unknown };
      class StubEventSource {
        static readonly CLOSED = 2;
        onopen: (() => void) | null = null;
        onmessage: (() => void) | null = null;
        onerror: (() => void) | null = null;
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("http://attend.test/", (route) =>
      route.fulfill({ contentType: "text/html", body: renderConsole(view) }),
    );
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    expect(pageErrors).toEqual([]);

    const states = await page.evaluate(
      (labels) => {
        type BrowserButton = {
          textContent: string | null;
          firstChild: { textContent: string | null } | null;
          click(): void;
        };
        const browserGlobal = globalThis as unknown as {
          document: {
            querySelectorAll(selector: string): ArrayLike<BrowserButton>;
          };
        };
        const labelOf = (button: BrowserButton) =>
          button.firstChild?.textContent ?? button.textContent;
        const selected = () =>
          Array.from(browserGlobal.document.querySelectorAll("#viewTabs .viewtab.on")).map(labelOf);
        const click = (label: string) => {
          const button = Array.from(
            browserGlobal.document.querySelectorAll("#viewTabs button"),
          ).find((candidate) => labelOf(candidate) === label);
          if (!button) throw new Error(`Missing view tab: ${label}`);
          button.click();
        };
        return labels.map((label) => {
          click(label);
          const afterSelect = selected();
          click(label);
          return { label, afterSelect, afterToggle: selected() };
        });
      },
      ["Active", "Unread", "Focus 1"],
    );

    for (const state of states) {
      expect(state.afterSelect).toContain(state.label);
      expect(state.afterToggle).toContain("All");
    }

    await page.close();
  });

  it("opens a sidebar comment badge with one click and closes it when switching chats", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as { EventSource: unknown };
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(commentView),
        });
      } else if (url.pathname === "/comments/messages") {
        await route.fulfill({
          json: {
            thread: commentView.vaultState?.commentThreads?.["comment-1"],
            messages: [],
          },
        });
      } else {
        await route.fulfill({ json: {} });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const session = page.locator("#list .item", {
      hasText: "Avoidance session",
    });
    await page.locator("#list .item", { hasText: "Other session" }).click();
    await page.locator("#input").focus();
    await session.locator(".it-comment").click();

    expect(await page.locator("#commentDrawer").isVisible()).toBe(true);
    expect(
      await page
        .locator("#commentDrawer")
        .evaluate((drawer) => drawer.parentElement?.classList.contains("main")),
    ).toBe(true);
    const drawerBox = await page.locator("#commentDrawer").boundingBox();
    const mainBox = await page.locator(".main").boundingBox();
    if (!drawerBox || !mainBox) throw new Error("Missing comment drawer layout");
    expect(drawerBox.x).toBeCloseTo(mainBox.x, 0);
    expect(drawerBox.width).toBeCloseTo(mainBox.width, 0);
    expect(await session.getAttribute("class")).toContain("active");

    await page.locator("#sessionPanelToggle").click();
    const resizedDrawerBox = await page.locator("#commentDrawer").boundingBox();
    const resizedMainBox = await page.locator(".main").boundingBox();
    if (!resizedDrawerBox || !resizedMainBox) throw new Error("Missing resized drawer layout");
    expect(resizedDrawerBox.x).toBeCloseTo(resizedMainBox.x, 0);
    expect(resizedDrawerBox.width).toBeCloseTo(resizedMainBox.width, 0);
    await page.locator("#sessionPanelList .item", { hasText: "Other session" }).click();
    expect(await page.locator("#h-title").textContent()).toContain("Other session");
    expect(await page.locator("#commentDrawer").isHidden()).toBe(true);
    await page.close();
  });

  it("animates generating comment badges and follows the session status colors", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(commentMotionView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            {
              role: "assistant",
              text: "A comment reply is still generating",
              tools: [],
            },
            { role: "assistant", text: "A comment reply is unread", tools: [] },
          ],
        });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const session = page.locator("#list .item", {
      hasText: "Avoidance session",
    });
    const sidebarBadge = session.locator(".it-comment.generating");
    await expect.poll(() => sidebarBadge.isVisible()).toBe(true);
    expect(await sidebarBadge.textContent()).toBe("1");
    expect(await sidebarBadge.locator(".it-comment-spinner").count()).toBe(1);
    expect(
      await sidebarBadge.locator(".it-comment-spinner").evaluate((spinner) => {
        const view = spinner.ownerDocument.defaultView;
        if (!view) throw new Error("Missing browser window");
        const icon = view.getComputedStyle(spinner);
        return {
          animationName: icon.animationName,
          animationPlayState: icon.animationPlayState,
        };
      }),
    ).toEqual({ animationName: "statusSpin", animationPlayState: "running" });

    await session.locator(".it-title").click();
    const generatingPin = page.locator("#pinTray .pincomment.generating");
    const unreadPin = page.locator("#pinTray .pincomment.unread");
    await expect.poll(() => generatingPin.isVisible()).toBe(true);
    expect(await generatingPin.textContent()).toBe("");
    expect(await unreadPin.locator(".pincomment-icon").count()).toBe(1);
    expect(
      await generatingPin.locator(".pincomment-spinner").evaluate((spinner) => {
        const view = spinner.ownerDocument.defaultView;
        if (!view) throw new Error("Missing browser window");
        const style = view.getComputedStyle(spinner);
        return {
          animationName: style.animationName,
          animationPlayState: style.animationPlayState,
        };
      }),
    ).toEqual({ animationName: "statusSpin", animationPlayState: "running" });

    const generatingColors = await generatingPin.evaluate((pin) => {
      const browserWindow = pin.ownerDocument.defaultView as unknown as {
        getComputedStyle(target: unknown): { color: string };
      };
      const probe = pin.ownerDocument.createElement("span");
      probe.style.color = "var(--status-generating)";
      pin.appendChild(probe);
      const result = {
        actual: browserWindow.getComputedStyle(pin).color,
        expected: browserWindow.getComputedStyle(probe).color,
      };
      probe.remove();
      return result;
    });
    const unreadColors = await unreadPin.evaluate((pin) => {
      const browserWindow = pin.ownerDocument.defaultView as unknown as {
        getComputedStyle(target: unknown): { color: string };
      };
      const probe = pin.ownerDocument.createElement("span");
      probe.style.color = "var(--status-unread)";
      pin.appendChild(probe);
      const result = {
        actual: browserWindow.getComputedStyle(pin).color,
        expected: browserWindow.getComputedStyle(probe).color,
      };
      probe.remove();
      return result;
    });
    expect(generatingColors.actual).toBe(generatingColors.expected);
    expect(unreadColors.actual).toBe(unreadColors.expected);
    await page.close();
  });

  it("groups a promoted comment session with its parent chat", async () => {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 800 },
    });
    const uiPatches: Array<Record<string, unknown>> = [];
    let releasePromotion = () => {};
    let notePromotionRequest = () => {};
    const promotionGate = new Promise<void>((resolve) => {
      releasePromotion = resolve;
    });
    const promotionRequested = new Promise<void>((resolve) => {
      notePromotionRequest = resolve;
    });
    const promotedView = {
      ...raceView.sessions[0],
      sessionId: "comment-provider-1",
      title: "Follow this thread",
      brief: "Follow this thread",
      file: "/tmp/promoted-comment.jsonl",
      unread: true,
      seen: false,
    };
    const pinnedCommentView: ConsoleView = {
      ...commentView,
      vaultState: {
        ...commentView.vaultState,
        sessionPins: { s1: 1 },
      },
    };
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as Record<string, unknown>;
      class StubEventSource {
        static readonly CLOSED = 2;
        onmessage: ((event: { data: string }) => void) | null = null;
        constructor() {
          browserGlobal.__promoteAnalysisEventSource = this;
        }
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(pinnedCommentView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/comments/messages") {
        await route.fulfill({
          json: {
            thread: commentView.vaultState?.commentThreads?.["comment-1"],
            messages: [
              { role: "user", text: "Follow this thread" },
              { role: "assistant", text: "Ready to promote" },
            ],
          },
        });
      } else if (url.pathname === "/comments/promote") {
        notePromotionRequest();
        await promotionGate;
        await route.fulfill({
          json: {
            ok: true,
            session: promotedView.sessionId,
            vendor: promotedView.vendor,
            cwd: promotedView.cwd,
            view: promotedView,
          },
        });
      } else if (url.pathname === "/vault/ui-state" && request.method() === "POST") {
        uiPatches.push(request.postDataJSON() as Record<string, unknown>);
        await route.fulfill({ json: { ok: true } });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });

    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#sessionPanelToggle").click();
    await page.locator('#list .item[data-session-id="s1"] .it-comment').click();
    const promote = page.locator("#commentPromote");
    await expect.poll(() => promote.isEnabled()).toBe(true);
    await promote.click();
    await promotionRequested;
    await page.evaluate(async () => {
      const source = (globalThis as unknown as Record<string, unknown>)
        .__promoteAnalysisEventSource as {
        onmessage: ((event: { data: string }) => void) | null;
      };
      source.onmessage?.({
        data: JSON.stringify({
          kind: "analysis",
          sessionId: "comment-provider-1",
          analysis: {
            brief: "Promoted daemon brief",
            state: "needs_decision",
            priority: 9,
            etaMin: 7,
            reason: "Promoted daemon reason",
            nextStep: "Decide the promoted task",
            probe: null,
          },
        }),
      });
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    releasePromotion();

    await expect.poll(() => page.locator("#commentDrawer").isHidden()).toBe(true);
    const promotedCard = page.locator(
      '#sessionPanelList .item[data-session-id="comment-provider-1"]',
    );
    await expect.poll(() => promotedCard.count()).toBe(1);
    expect(
      await promotedCard.evaluate((node) =>
        node.previousElementSibling?.classList.contains("session-pin-divider"),
      ),
    ).toBe(true);
    await expect.poll(() => page.locator("#chatTabs .chat-tab").count()).toBe(2);
    expect(
      await page
        .locator("#chatTabs .chat-tab")
        .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("data-session-id"))),
    ).toEqual(["s1", "comment-provider-1"]);
    expect(await page.locator("#chatTabs .chat-tab.on").getAttribute("data-session-id")).toBe(
      "comment-provider-1",
    );
    await expect
      .poll(() => page.locator("#h-title").textContent())
      .toContain("Promoted daemon brief");
    expect(await page.locator("#h-title").getAttribute("class")).not.toContain("manual");
    expect(await page.locator("#h-title").textContent()).not.toContain("Follow this thread");
    await expect
      .poll(() => page.locator("#h-sig").textContent())
      .toContain("Promoted daemon reason");
    expect(await page.locator("#h-sig").textContent()).toContain("7m");

    await expect.poll(() => uiPatches.some((patch) => !!patch.chatGroups)).toBe(true);
    const groupRecords = uiPatches.flatMap((patch) =>
      Object.values(
        (patch.chatGroups as Record<string, { members?: unknown[] }> | undefined) ?? {},
      ),
    );
    expect(groupRecords).toContainEqual(
      expect.objectContaining({
        members: [
          { vendor: "claude", sessionId: "s1" },
          { vendor: "claude", sessionId: "comment-provider-1" },
        ],
      }),
    );
    await page.close();
  });

  it("replaces comment history without retaining stale bubbles", async () => {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    const messages = [
      { role: "user", text: "first question" },
      { role: "assistant", text: "first answer" },
      { role: "user", text: "second question" },
      { role: "assistant", text: "second answer" },
    ];
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(commentView),
        });
      } else if (url.pathname === "/comments/messages") {
        await route.fulfill({
          json: {
            thread: commentView.vaultState?.commentThreads?.["comment-1"],
            messages,
          },
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            {
              role: "assistant",
              text: "An answer with an unread comment",
              tools: [],
            },
          ],
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    await page
      .locator("#list .item", { hasText: "Avoidance session" })
      .locator(".it-comment")
      .click();
    const bubbles = page.locator("#commentMsgs > .msg.user, #commentMsgs > .msg.assistant");
    await expect.poll(() => bubbles.count()).toBe(messages.length);
    await page.locator("#commentClose").click();
    const anchorMessage = page.locator("#msgs > .msg.assistant");
    await anchorMessage.hover();
    await page.locator("#msgFloatComment").click({ force: true });

    await expect.poll(() => bubbles.count()).toBe(messages.length);
    expect(await bubbles.locator(".bubble").allTextContents()).toEqual(
      messages.map((message) => message.text),
    );
    await page.close();
  });

  it("sends only context before an assistant comment anchor", async () => {
    const testCase = {
      role: "assistant",
      target: ".msg.assistant",
      targetIndex: 0,
      anchorKey: "assistant:1",
      expectedContext: [{ role: "user", text: "earlier setup", tools: [] }],
    };
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    let sentBody: Record<string, unknown> | undefined;
    const messages = [
      { role: "user", text: "earlier setup" },
      { role: "assistant", text: "earlier answer" },
      { role: "user", text: "anchored user requirement" },
      { role: "assistant", text: "response after anchor" },
      { role: "user", text: "LATER BAIT QUESTION" },
    ];
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(raceView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: messages });
      } else if (url.pathname === "/comments/send") {
        sentBody = request.postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          json: {
            ok: true,
            thread: {
              id: sentBody.threadId,
              parentSessionId: sentBody.parentSessionId,
              anchorKey: sentBody.anchorKey,
              anchorText: sentBody.anchorText,
              anchorData: sentBody.anchorData,
              providerSessionId: `comment-${testCase.role}-provider`,
              vendor: "claude",
              cwd: "/tmp/project",
              createdAt: Date.now(),
              status: "generating",
              messageCount: 1,
            },
          },
        });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });

    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    const anchor = page.locator(`#msgs > ${testCase.target}`).nth(testCase.targetIndex);
    await expect.poll(() => anchor.isVisible()).toBe(true);
    await anchor.evaluate((node) => {
      node.querySelector(".bubble")?.dispatchEvent(new Event("pointermove", { bubbles: true }));
      (
        node.ownerDocument.querySelector("#msgFloatComment") as {
          click(): void;
        } | null
      )?.click();
    });
    await expect.poll(() => page.locator("#commentDrawer").isVisible()).toBe(true);
    await page.locator("#commentInput").fill("How should this be improved?");
    await page.locator("#commentSend").click();

    await expect.poll(() => sentBody).toBeTruthy();
    expect(sentBody).toMatchObject({
      anchorKey: testCase.anchorKey,
      anchorData: { kind: "message", role: testCase.role },
      question: "How should this be improved?",
      contextMessages: testCase.expectedContext,
    });
    expect(JSON.stringify(sentBody?.contextMessages)).not.toContain("LATER BAIT QUESTION");
    expect(JSON.stringify(sentBody?.contextMessages)).not.toContain("response after anchor");
    await page.close();
  });

  it("renders persisted and live tool blocks in the comment panel", async () => {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as Record<string, unknown>;
      class StubEventSource {
        static readonly CLOSED = 2;
        onmessage: ((event: { data: string }) => void) | null = null;
        constructor() {
          browserGlobal.__attendEventSource = this;
        }
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(commentView),
        });
      } else if (url.pathname === "/comments/messages") {
        await route.fulfill({
          json: {
            thread: commentView.vaultState?.commentThreads?.["comment-1"],
            messages: [
              { role: "user", text: "inspect it", tools: [] },
              {
                role: "assistant",
                text: "I checked it.",
                tools: [
                  {
                    id: "comment-history-tool",
                    name: "exec_command",
                    input: { cmd: "pwd" },
                    result: "/tmp/project\n",
                  },
                ],
              },
            ],
          },
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            {
              role: "assistant",
              text: "An answer with an unread comment",
              tools: [],
            },
          ],
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page
      .locator("#list .item", { hasText: "Avoidance session" })
      .locator(".it-comment")
      .click();

    const historyTool = page.locator('#commentMsgs .toolc[data-tool-id="comment-history-tool"]');
    await expect.poll(() => historyTool.count()).toBe(1);
    expect(await historyTool.locator("summary").textContent()).toContain("exec_command");
    expect(await historyTool.locator(".tool-out").textContent()).toContain("/tmp/project");
    expect(await historyTool.getAttribute("data-tool-pending")).toBeNull();

    const emit = (event: Record<string, unknown>) =>
      page.evaluate((nextEvent) => {
        const source = (globalThis as unknown as Record<string, unknown>).__attendEventSource as {
          onmessage(event: { data: string }): void;
        };
        source.onmessage({
          data: JSON.stringify({
            kind: "session_event",
            sessionId: "comment-provider-1",
            emittedAt: Date.now(),
            event: nextEvent,
          }),
        });
      }, event);
    await emit({ kind: "user_turn_started", text: "inspect it live" });
    await emit({
      kind: "tool_use",
      id: "comment-live-tool",
      name: "exec_command",
      input: { cmd: "npm test" },
    });
    const liveTool = page.locator('#commentMsgs .toolc[data-tool-id="comment-live-tool"]');
    await expect.poll(() => liveTool.count()).toBe(1);
    expect(await liveTool.getAttribute("data-tool-pending")).toBe("true");

    await emit({
      kind: "tool_result",
      id: "comment-live-tool",
      text: "tests passed",
      isError: false,
    });
    await expect.poll(() => liveTool.getAttribute("data-tool-pending")).toBeNull();
    expect(await liveTool.locator(".tool-out").textContent()).toBe("tests passed");

    await emit({ kind: "assistant_text", text: "Done after the tool." });
    await expect
      .poll(() => page.locator("#commentMsgs > .msg.assistant:not(.thinking)").last().textContent())
      .toContain("Done after the tool.");
    expect(
      await liveTool.evaluate((block) => block.parentElement?.nextElementSibling?.textContent),
    ).toContain("Done after the tool.");
    await page.locator("#commentClose").click();
    await page
      .locator("#list .item", { hasText: "Avoidance session" })
      .locator(".it-comment")
      .click();
    await expect.poll(() => liveTool.count()).toBe(1);
    expect(await liveTool.locator(".tool-out").textContent()).toBe("tests passed");
    await page.close();
  });

  it("edits and persists tags while a new session is waiting for its provider id", async () => {
    const page = await browser.newPage();
    let releaseNewSession = () => {};
    const newSessionGate = new Promise<void>((resolve) => {
      releaseNewSession = resolve;
    });
    const tagRequests: Array<{ session: string; tags: string[] }> = [];
    const pinnedPendingTagView: ConsoleView = {
      ...pendingTagView,
      vaultState: {
        ...pendingTagView.vaultState,
        sessionPins: { s1: 1 },
      },
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(pinnedPendingTagView),
        });
      } else if (url.pathname === "/chat/new") {
        await newSessionGate;
        await route.fulfill({
          json: {
            ok: true,
            session: "new-provider-1",
            cwd: "/tmp/new-project",
          },
        });
      } else if (url.pathname === "/session/tags") {
        const body = route.request().postDataJSON() as { tags: string[] };
        tagRequests.push({
          session: url.searchParams.get("session") ?? "",
          tags: body.tags,
        });
        await route.fulfill({
          json: { ok: true, sessionTags: body.tags, tags: ["work"] },
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    await page.locator("#sessionPanelToggle").click();
    await page.locator("#newToggle").click();
    await page.locator("#np").fill("start pending session");
    await page.locator("#nbtn").click();
    const pendingCard = page.locator("#sessionPanelList .item", {
      hasText: "start pending session",
    });
    await expect.poll(() => pendingCard.count()).toBe(1);
    expect(
      await pendingCard.evaluate((node) =>
        node.previousElementSibling?.classList.contains("session-pin-divider"),
      ),
    ).toBe(true);
    const headerHeightBefore = await page.locator("#h-tags").evaluate((node) => node.offsetHeight);
    await page.locator("#h-tags .it-tagadd").click();
    const tagEditorGeometry = await page.locator("#sessionTagPopover").evaluate((editor) => {
      const input = editor.querySelector(".sessiontag-input");
      const suggestions = editor.querySelector(".sessiontag-list");
      const close = editor.querySelector(".edit-cancel");
      if (!input || !suggestions || !close) throw new Error("Missing tag editor controls");
      const inputBox = input.getBoundingClientRect();
      const suggestionsBox = suggestions.getBoundingClientRect();
      const closeBox = close.getBoundingClientRect();
      return {
        position: editor.ownerDocument.defaultView?.getComputedStyle(editor).position,
        parent: editor.parentElement?.tagName,
        input: {
          left: inputBox.left,
          right: inputBox.right,
          width: inputBox.width,
        },
        suggestions: {
          left: suggestionsBox.left,
          right: suggestionsBox.right,
          width: suggestionsBox.width,
        },
        close: { left: closeBox.left, right: closeBox.right },
      };
    });
    expect(tagEditorGeometry.position).toBe("fixed");
    expect(tagEditorGeometry.parent).toBe("BODY");
    expect(await page.locator("#h-tags").evaluate((node) => node.offsetHeight)).toBe(
      headerHeightBefore,
    );
    expect(tagEditorGeometry.suggestions.left).toBeGreaterThanOrEqual(tagEditorGeometry.input.left);
    expect(tagEditorGeometry.suggestions.right).toBeLessThanOrEqual(tagEditorGeometry.input.right);
    expect(tagEditorGeometry.close.left).toBeGreaterThan(tagEditorGeometry.input.left);
    expect(tagEditorGeometry.close.right).toBeLessThan(tagEditorGeometry.input.right);
    await page.locator("#sessionTagList .sessiontag-option", { hasText: "work" }).click();

    expect(await page.locator("#h-tags .it-tag", { hasText: "work" }).count()).toBe(1);
    expect(tagRequests).toEqual([]);

    releaseNewSession();
    await expect.poll(() => tagRequests).toEqual([{ session: "new-provider-1", tags: ["work"] }]);
    expect(
      await pendingCard.evaluate((node) =>
        node.previousElementSibling?.classList.contains("session-pin-divider"),
      ),
    ).toBe(true);
    await page.locator("#newToggle").click();
    await page.locator("#ndir").fill("");
    await expect
      .poll(() =>
        page
          .locator("#ndirSug .chooser-opt")
          .evaluateAll((options) => options.map((option) => option.getAttribute("data-value"))),
      )
      .toEqual(["/tmp/new-project", "/tmp/project"]);
    await page.close();
  });

  it("reuses the new-session form while an earlier session is still starting", async () => {
    const page = await browser.newPage();
    let releaseFirst = () => {};
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const prompts: string[] = [];
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(pendingTagView),
        });
      } else if (url.pathname === "/chat/new") {
        const body = route.request().postDataJSON() as { text: string };
        prompts.push(body.text);
        if (body.text === "first session") await firstGate;
        await route.fulfill({
          json: {
            ok: true,
            session: body.text === "first session" ? "provider-first" : "provider-second",
            cwd: "/tmp/project",
          },
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    await page.locator("#newToggle").click();
    await page.locator("#np").fill("first session");
    await page.locator("#nbtn").click();
    await expect.poll(() => prompts).toEqual(["first session"]);

    await page.locator("#newToggle").click();
    expect(await page.locator("#nbtn").isEnabled()).toBe(true);
    expect(await page.locator("#nbtn").textContent()).toContain("start session");
    expect(await page.locator("#ndir").isEnabled()).toBe(true);
    await page.locator("#np").fill("second session");

    releaseFirst();
    await expect.poll(() => page.locator("#np").inputValue()).toBe("second session");
    expect(await page.locator("#ndir").isEnabled()).toBe(true);

    await page.locator("#nbtn").click();
    await expect.poll(() => prompts).toEqual(["first session", "second session"]);
    await page.close();
  });

  it("forks a queued message directly while keeping the parent session open", async () => {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    let queuePresent = true;
    let forkRequest: {
      item: string | null;
      body: Record<string, unknown>;
    } | null = null;
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(composerRailView),
        });
      } else if (url.pathname === "/chat/queue/fork") {
        forkRequest = {
          item: url.searchParams.get("item"),
          body: request.postDataJSON() as Record<string, unknown>,
        };
        queuePresent = false;
        await route.fulfill({
          json: {
            ok: true,
            session: "queued-branch-1",
            parentSessionId: "s1",
            cwd: "/tmp/project",
            project: "project",
          },
        });
      } else if (url.pathname === "/chat/queue") {
        await route.fulfill({
          json: {
            ok: true,
            parked: false,
            items: queuePresent
              ? [
                  {
                    id: "queued-1",
                    sessionId: "s1",
                    cwd: "/tmp/project",
                    vendor: "claude",
                    text: "branch this queued idea",
                    createdAt: 1,
                  },
                ]
              : [],
          },
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });

    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await expect.poll(() => page.locator("#queue .qitem").count()).toBe(1);
    expect(await page.locator("#queue .qfork").getAttribute("aria-label")).toBe(
      "Fork queued message into a new session",
    );
    expect(await page.locator("#queue .qfork circle").count()).toBe(3);
    await page.locator("#queue .qfork").click();

    await expect
      .poll(() => forkRequest)
      .toMatchObject({
        item: "queued-1",
        body: { text: "branch this queued idea", parentVendor: "claude" },
      });
    await expect.poll(() => page.locator("#queue .qitem").count()).toBe(0);
    await expect
      .poll(() => page.locator("#list .item", { hasText: "branch this queued idea" }).count())
      .toBe(1);
    expect(await page.locator("#list .item.active").textContent()).toContain("Avoidance session");
    await page.close();
  });

  it("keeps inherited session context on a pending fork and after provider binding", async () => {
    const page = await browser.newPage();
    let releaseFork = () => {};
    const forkGate = new Promise<void>((resolve) => {
      releaseFork = resolve;
    });
    const tagRequests: Array<{ session: string; tags: string[] }> = [];
    const uiPatches: Array<Record<string, unknown>> = [];
    const inheritedGoal = {
      objective: "Finish the parent objective",
      vendor: "claude" as const,
      status: "active" as const,
      updatedAt: 1,
    };
    const forkContextView: ConsoleView = {
      ...composerRailView,
      knownDirs: ["/tmp/project"],
      defaultNewDir: "/tmp/project",
      tags: ["work"],
      vaultState: {
        ...composerRailView.vaultState,
        sessionPins: { s1: 1 },
        sessionNotes: {
          s1: [
            {
              id: "note-1",
              text: "Keep the parent constraint",
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
        sessionTodos: {
          s1: [
            {
              id: "todo-1",
              text: "Verify the branch",
              createdAt: 1,
              updatedAt: 1,
              completed: false,
            },
          ],
        },
        sessionGoals: { s1: inheritedGoal },
      },
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(forkContextView),
        });
      } else if (url.pathname === "/chat/fork") {
        await forkGate;
        await route.fulfill({
          json: { ok: true, session: "fork-provider-1", parentSessionId: "s1" },
        });
      } else if (url.pathname === "/chat/goal") {
        await route.fulfill({
          json: { ok: true, supported: true, goal: inheritedGoal },
        });
      } else if (url.pathname === "/vault/ui-state") {
        uiPatches.push(request.postDataJSON() as Record<string, unknown>);
        await route.fulfill({ json: { ok: true } });
      } else if (url.pathname === "/session/tags") {
        const body = request.postDataJSON() as { tags: string[] };
        tagRequests.push({
          session: url.searchParams.get("session") ?? "",
          tags: body.tags,
        });
        await route.fulfill({
          json: { ok: true, sessionTags: body.tags, tags: ["work"] },
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    await page.locator("#sessionPanelToggle").click();
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await page.locator("#input").fill("fork immediately");
    await page.locator("#forkBtn").click();
    const pendingForkCard = page.locator("#sessionPanelList .item", {
      hasText: "fork immediately",
    });
    await expect.poll(() => pendingForkCard.count()).toBe(1);
    expect(
      await pendingForkCard.evaluate((node) =>
        node.previousElementSibling?.classList.contains("session-pin-divider"),
      ),
    ).toBe(true);
    await page.locator("#list .item", { hasText: "fork immediately" }).click();
    expect(await page.locator("#railVendor").textContent()).toContain("claude");
    expect(await page.locator("#railModel").textContent()).toContain("Claude Sonnet");
    expect(await page.locator("#railNotes .railbtn-count").textContent()).toBe("1");
    expect(await page.locator("#railTodos .railbtn-count").textContent()).toBe("1");
    expect(await page.locator("#goalToggle").getAttribute("class")).toContain("active");
    await page.locator("#h-tags .it-tagadd").click();
    await page.locator("#sessionTagList .sessiontag-option", { hasText: "work" }).click();

    expect(await page.locator("#h-tags .it-tag", { hasText: "work" }).count()).toBe(1);
    expect(tagRequests).toEqual([]);

    releaseFork();
    await expect.poll(() => tagRequests).toEqual([{ session: "fork-provider-1", tags: ["work"] }]);
    expect(
      await pendingForkCard.evaluate((node) =>
        node.previousElementSibling?.classList.contains("session-pin-divider"),
      ),
    ).toBe(true);
    await expect.poll(() => page.locator("#goalToggle").isEnabled()).toBe(true);
    expect(await page.locator("#goalToggle").getAttribute("class")).toContain("active");
    await expect
      .poll(() => uiPatches)
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sessionNotes: expect.objectContaining({
              "fork-provider-1": expect.any(Array),
            }),
          }),
          expect.objectContaining({
            sessionTodos: expect.objectContaining({
              "fork-provider-1": expect.any(Array),
            }),
          }),
          expect.objectContaining({
            sessionGoals: expect.objectContaining({
              "fork-provider-1": expect.objectContaining({
                objective: "Finish the parent objective",
                status: "active",
              }),
            }),
          }),
        ]),
      );
    await page.close();
  });

  it("keeps a global tag after it is unbound from its last session", async () => {
    const page = await browser.newPage();
    const tagWrites: string[][] = [];
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(untaggedView),
        });
      } else if (url.pathname === "/session/tags") {
        const body = route.request().postDataJSON() as { tags: string[] };
        tagWrites.push(body.tags);
        await route.fulfill({
          json: { ok: true, sessionTags: body.tags, tags: ["work"] },
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    await page
      .locator("#list .item", { hasText: "Other session" })
      .locator(".it-tag button")
      .click();

    await expect.poll(() => tagWrites).toEqual([[]]);
    expect(
      await page.locator("#list .item", { hasText: "Other session" }).locator(".it-tag").count(),
    ).toBe(0);
    expect(await page.locator("#tagFilters .gtag:not(.auto)").count()).toBe(1);
    expect(await page.locator("#tagFilters .gtag:not(.auto) .gtagcount").textContent()).toBe("0");
    await page.close();
  });

  it("wraps tag-header controls as whole buttons when the sidebar narrows", async () => {
    const page = await browser.newPage({
      viewport: { width: 480, height: 720 },
    });
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(raceView),
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    for (const width of [480, 360, 280]) {
      await page.setViewportSize({ width, height: 720 });
      const layout = await page
        .locator("#tagModeToggle, #tagOrderToggle, #bulkArchiveSeen")
        .evaluateAll((buttons) => ({
          controls: buttons.map((button) => {
            const style = button.ownerDocument.defaultView?.getComputedStyle(button);
            const text = button.ownerDocument.createRange();
            text.selectNodeContents(button);
            return {
              height: button.getBoundingClientRect().height,
              textFits:
                text.getBoundingClientRect().width <= button.getBoundingClientRect().width + 1,
              whiteSpace: style?.whiteSpace,
            };
          }),
          headerFits: (() => {
            const header = buttons[0]?.closest(".taghead");
            if (!header) return false;
            const bounds = header.getBoundingClientRect();
            return (
              Array.from(
                header.querySelectorAll(
                  ".tagttl, .tagsearchwrap, #tagModeToggle, #tagOrderToggle, #bulkArchiveSeen",
                ),
              ) as Array<{
                getBoundingClientRect(): { left: number; right: number };
              }>
            ).every((control) => {
              const box = control.getBoundingClientRect();
              return box.left >= bounds.left - 1 && box.right <= bounds.right + 1;
            });
          })(),
        }));

      expect(
        layout.headerFits,
        `tag header overflowed at ${width}px: ${JSON.stringify(layout)}`,
      ).toBe(true);
      expect(layout.controls).toHaveLength(3);
      for (const control of layout.controls) {
        expect(control.whiteSpace).toBe("nowrap");
        expect(control.textFits).toBe(true);
        expect(control.height).toBeLessThan(20);
      }
    }
    await page.close();
  });

  it("searches Today by default and switches through the custom time-range menu", async () => {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 760 },
    });
    const now = Date.now();
    const rangeView: ConsoleView = {
      ...raceView,
      sessions: raceView.sessions.map((session, index) => ({
        ...session,
        lastTs: index === 0 ? now : now - 3 * 86_400_000,
        sortTs: index === 0 ? now : now - 3 * 86_400_000,
        ageDays: index === 0 ? 0 : 3,
      })),
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(rangeView),
        });
      } else if (url.pathname === "/search") {
        await route.fulfill({ json: { results: [] } });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    expect(await page.locator("#list .item").count()).toBe(2);
    expect(await page.locator("#searchRangeText").textContent()).toBe("Today");
    await page.locator("#search").fill("session");
    expect(await page.locator("#list .item").count()).toBe(1);
    expect(await page.locator('#list .item[data-session-id="s1"]').count()).toBe(1);

    await page.locator("#searchRangeButton").click();
    expect(await page.locator("#searchRangeMenu").isVisible()).toBe(true);
    expect(await page.locator('#searchRangeMenu [aria-selected="true"]').textContent()).toContain(
      "Today",
    );
    await page.locator('.search-range-option[data-range="7d"]').click();

    expect(await page.locator("#searchRangeText").textContent()).toBe("7 days");
    expect(await page.locator("#list .item").count()).toBe(2);
    expect(await page.locator("#searchRangeMenu").isHidden()).toBe(true);

    await page.locator("#searchRangeButton").click();
    await page.locator('.search-range-option[data-range="custom"]').click();
    expect(await page.locator("#searchRangeMenu").getAttribute("role")).toBe("dialog");
    expect(await page.locator("#searchRangeCustomStart").isVisible()).toBe(true);
    expect(await page.locator("#searchRangeCustomEnd").isVisible()).toBe(true);
    expect(await page.locator(".search-range-datetime.scheduledatetime").count()).toBe(2);
    await page.locator(".search-range-custom-field:first-child .scheduledatetime-toggle").click();
    expect(await page.locator(".search-range-custom-picker.schedulepicker").isVisible()).toBe(true);
    expect(await page.locator(".search-range-custom-picker .schedulepicker-days").isVisible()).toBe(
      true,
    );
    expect(
      await page.locator(".search-range-custom-picker .scheduletime-hours button").count(),
    ).toBe(24);
    expect(
      await page.locator(".search-range-custom-picker .scheduletime-minutes button").count(),
    ).toBe(4);
    await page
      .locator(".search-range-custom-picker .scheduletime-minutes button")
      .filter({ hasText: "15" })
      .click();
    expect(await page.locator("#searchRangeCustomStart").inputValue()).toMatch(/:15$/);

    const localDateTimeValues = await page.evaluate(
      ({ start, end }) => {
        const format = (timestamp: number) => {
          const date = new Date(timestamp);
          const pad = (value: number) => String(value).padStart(2, "0");
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };
        return { start: format(start), end: format(end) };
      },
      {
        start: now - 3 * 86_400_000 - 3_600_000,
        end: now - 3 * 86_400_000 + 3_600_000,
      },
    );
    await page.locator("#searchRangeCustomStart").fill(localDateTimeValues.end);
    await page.locator("#searchRangeCustomEnd").fill(localDateTimeValues.start);
    await page.locator(".search-range-custom-apply").click();
    expect(await page.locator("#searchRangeCustomError").textContent()).toContain(
      "after the start",
    );
    expect(await page.locator("#searchRangeMenu").isVisible()).toBe(true);

    await page.locator("#searchRangeCustomStart").fill(localDateTimeValues.start);
    await page.locator("#searchRangeCustomEnd").fill(localDateTimeValues.end);
    await page.locator(".search-range-custom-apply").click();
    expect(await page.locator("#searchRangeMenu").isHidden()).toBe(true);
    expect(await page.locator("#searchRangeText").textContent()).not.toBe("Custom");
    expect(await page.locator("#list .item").count()).toBe(1);
    expect(await page.locator('#list .item[data-session-id="s2"]').count()).toBe(1);
    await page.close();
  });

  it("opens a resizable middle chats panel driven by the sidebar filters", async () => {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 900 },
    });
    const statusPanelView: ConsoleView = {
      ...raceView,
      tags: ["work", "urgent"],
      vaultState: { sessionPins: { s1: 1 } },
      sessions: raceView.sessions.map((session, index) => ({
        ...session,
        generating: index === 0,
        unread: index === 1,
        seen: index === 0,
      })),
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(statusPanelView),
        });
      } else if (url.pathname === "/session/tags") {
        const body = route.request().postDataJSON() as { tags: string[] };
        await route.fulfill({
          json: { ok: true, sessionTags: body.tags, tags: ["work", "urgent"] },
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    expect(
      await page.locator("#list").evaluate((list) =>
        Array.from(
          list.children as unknown as ArrayLike<{
            classList: { contains(value: string): boolean };
            getAttribute(name: string): string | null;
          }>,
        ).map((node) =>
          node.classList.contains("session-pin-divider")
            ? "divider"
            : node.getAttribute("data-session-id"),
        ),
      ),
    ).toEqual(["s1", "divider", "s2"]);
    expect(await page.locator("#sessionPanel").isHidden()).toBe(true);
    await page.locator("#sessionPanelToggle").click();
    expect(await page.locator("#sessionPanel").isVisible()).toBe(true);
    expect(await page.locator("#sessionPanelToggle").getAttribute("aria-expanded")).toBe("true");
    expect(await page.locator("#sessionPanelList .item").count()).toBe(2);
    expect(await page.locator("#sessionPanel input, #sessionPanel .tagbar").count()).toBe(0);
    expect(
      await page.locator("#sessionPanelList").evaluate((list) =>
        Array.from(
          list.children as unknown as ArrayLike<{
            classList: { contains(value: string): boolean };
            getAttribute(name: string): string | null;
          }>,
        ).map((node) =>
          node.classList.contains("session-pin-divider")
            ? "divider"
            : node.getAttribute("data-session-id"),
        ),
      ),
    ).toEqual(["s1", "divider", "s2"]);
    const generatingCard = page.locator('#sessionPanelList .item[data-session-id="s1"]');
    const unreadCard = page.locator('#sessionPanelList .item[data-session-id="s2"]');
    const dividerBox = await page.locator("#sessionPanelList .session-pin-divider").boundingBox();
    const cardBox = await generatingCard.boundingBox();
    if (!dividerBox || !cardBox) throw new Error("session pin divider layout is unavailable");
    expect(dividerBox.width).toBeGreaterThan(cardBox.width * 1.5);
    const unreadHeightBefore = await unreadCard.evaluate((node) => node.offsetHeight);
    await unreadCard.locator(".it-tagadd").click();
    expect(await unreadCard.evaluate((node) => node.offsetHeight)).toBe(unreadHeightBefore);
    const panelTagInput = page.locator("#sessionTagInput");
    await panelTagInput.fill("urg");
    const panelTagOption = page.locator("#sessionTagList .sessiontag-option", {
      hasText: "urgent",
    });
    expect(await panelTagOption.isVisible()).toBe(true);
    await panelTagInput.press("ArrowDown");
    await panelTagInput.press("Enter");
    expect(await unreadCard.locator(".it-tag", { hasText: "urgent" }).count()).toBe(1);
    await unreadCard.locator(".it-tagadd").click();
    const selectedUrgent = page.locator("#sessionTagList .sessiontag-option", {
      hasText: "urgent",
    });
    expect(await selectedUrgent.getAttribute("aria-selected")).toBe("true");
    expect((await selectedUrgent.locator(".sessiontag-check").textContent())?.trim()).toBe("✓");
    await selectedUrgent.click();
    expect(await unreadCard.locator(".it-tag", { hasText: "urgent" }).count()).toBe(0);
    expect(await generatingCard.getAttribute("class")).toContain("session-status-generating");
    expect(await unreadCard.getAttribute("class")).toContain("session-status-unread");
    const cardBorderMatchesStatus = (card: typeof generatingCard, variable: string) =>
      card.evaluate((node, property) => {
        const view = node.ownerDocument.defaultView;
        if (!view) return false;
        const probe = node.ownerDocument.createElement("span");
        probe.style.color = `var(${property})`;
        node.appendChild(probe);
        const expected = view.getComputedStyle(probe).color;
        probe.remove();
        return view.getComputedStyle(node).borderTopColor === expected;
      }, variable);
    expect(await cardBorderMatchesStatus(generatingCard, "--status-generating")).toBe(true);
    expect(await cardBorderMatchesStatus(unreadCard, "--status-unread")).toBe(true);
    await generatingCard.click();
    const lightActiveStyle = await generatingCard.evaluate((node) => {
      const style = node.ownerDocument.defaultView?.getComputedStyle(node);
      return {
        backgroundImage: style?.backgroundImage ?? "",
        boxShadow: style?.boxShadow ?? "",
      };
    });
    expect(lightActiveStyle.backgroundImage).not.toBe("none");
    expect(lightActiveStyle.boxShadow).toContain("inset");
    await page.locator("html").evaluate((node) => node.setAttribute("data-theme", "dark"));
    expect(await generatingCard.getAttribute("class")).toContain("active");
    const darkActiveStyle = await generatingCard.evaluate((node) => {
      const style = node.ownerDocument.defaultView?.getComputedStyle(node);
      return {
        backgroundImage: style?.backgroundImage ?? "",
        boxShadow: style?.boxShadow ?? "",
      };
    });
    expect(darkActiveStyle.backgroundImage).not.toBe("none");
    expect(darkActiveStyle.boxShadow).toContain("inset");
    expect(await generatingCard.getAttribute("class")).toContain("session-status-generating");
    await unreadCard.locator(".it-status").click();
    expect(await unreadCard.getAttribute("class")).toContain("session-status-read");
    expect(await unreadCard.getAttribute("class")).not.toContain("session-status-unread");

    const columnsBefore = await page
      .locator("#sessionPanelList")
      .evaluate(
        (node) =>
          (node.ownerDocument.defaultView?.getComputedStyle(node).gridTemplateColumns ?? "")
            .split(" ")
            .filter(Boolean).length,
      );
    expect(columnsBefore).toBe(2);

    const panelBox = await page.locator("#sessionPanel").boundingBox();
    const resizerBox = await page.locator("#sessionPanelResizer").boundingBox();
    if (!panelBox || !resizerBox) throw new Error("middle panel layout is unavailable");
    await page.mouse.move(resizerBox.x + resizerBox.width / 2, resizerBox.y + 20);
    await page.mouse.down();
    await page.mouse.move(panelBox.x + 320, resizerBox.y + 20);
    await page.mouse.up();
    const columnsAfter = await page
      .locator("#sessionPanelList")
      .evaluate(
        (node) =>
          (node.ownerDocument.defaultView?.getComputedStyle(node).gridTemplateColumns ?? "")
            .split(" ")
            .filter(Boolean).length,
      );
    expect(columnsAfter).toBe(1);

    await page.locator("#search").fill("Other session");
    expect(await page.locator("#list .item").count()).toBe(1);
    expect(await page.locator("#sessionPanelList .item").count()).toBe(1);
    expect(await page.locator(".session-pin-divider").count()).toBe(0);

    await page.locator("#search").press("Escape");
    expect(await page.locator("#search").inputValue()).toBe("");
    expect(await page.locator("#sessionPanel").isVisible()).toBe(true);
    expect(
      await page.locator("#search").evaluate((node) => node.ownerDocument.activeElement === node),
    ).toBe(true);
    await page.locator("#search").fill("Other session");

    await page.locator("#sessionPanelList .item").click();
    expect(await page.locator("#h-title").textContent()).toContain("Other session");
    expect(await page.locator("#list .item.active").count()).toBe(1);
    expect(await page.locator("#sessionPanelList .item.active").count()).toBe(1);

    await page.locator("#sessionPanelToggle").click();
    expect(await page.locator("#sessionPanel").isHidden()).toBe(true);
    await page.close();
  });

  it("shows untagged as a quiet system filter and narrows to sessions without custom tags", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(untaggedView),
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const untagged = page.locator("#tagFilters .gtag.untagged");
    expect(await untagged.locator(".gtagbtn").textContent()).toContain("untagged");
    expect(await untagged.locator(".gtagcount").textContent()).toBe("1");
    expect(await page.locator("#tagFilters .gtag.untagged + .tag-pin-empty").count()).toBe(1);
    const [untaggedBox, userTagBox] = await Promise.all([
      untagged.boundingBox(),
      page.locator("#tagFilters .gtag:not(.auto)").first().boundingBox(),
    ]);
    expect(untaggedBox?.height).toBe(userTagBox?.height);
    expect(
      await untagged.evaluate((node) => {
        const browserWindow = node.ownerDocument.defaultView as unknown as {
          getComputedStyle(target: typeof node): { borderStyle: string };
        };
        return browserWindow.getComputedStyle(node).borderStyle;
      }),
    ).toBe("dashed");
    expect(
      await page.locator("#tagFilters .tag-pin-empty").evaluate((node) => {
        const browserWindow = node.ownerDocument.defaultView as unknown as {
          getComputedStyle(target: typeof node): { borderStyle: string };
        };
        return browserWindow.getComputedStyle(node).borderStyle;
      }),
    ).toBe("none");

    await untagged.locator(".gtagbtn").click();
    expect(await untagged.getAttribute("class")).toContain("on");
    expect(
      await untagged.evaluate((node) => {
        const browserWindow = node.ownerDocument.defaultView as unknown as {
          getComputedStyle(target: typeof node): { backgroundColor: string };
        };
        return browserWindow.getComputedStyle(node).backgroundColor;
      }),
    ).toBe("rgb(71, 85, 105)");
    expect(await page.locator("#list .item", { hasText: "Avoidance session" }).count()).toBe(1);
    expect(await page.locator("#list .item", { hasText: "Other session" }).count()).toBe(0);
    await page.close();
  });

  it("keeps manually dormant tags in a collapsible hidden area", async () => {
    const page = await browser.newPage();
    const visibilityWrites: Array<{
      hiddenTags?: string[];
      pinnedTags?: string[];
    }> = [];
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(hiddenTagsView),
        });
      } else if (url.pathname === "/vault/ui-state") {
        visibilityWrites.push(route.request().postDataJSON());
        await route.fulfill({ json: { ok: true } });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const renderedTags = () =>
      page
        .locator("#tagFilters .gtag[data-tag-value]")
        .evaluateAll((chips) => chips.map((chip) => chip.getAttribute("data-tag-value")));
    const hiddenDivider = page.locator("#tagFilters .tag-hidden-divider");

    expect(await renderedTags()).toEqual(["old", "new"]);
    expect((await hiddenDivider.textContent())?.trim()).toBe("hidden 1 ▾");
    expect(await hiddenDivider.getAttribute("aria-expanded")).toBe("false");
    expect(
      await page
        .locator("#list .item", { hasText: "Middle session" })
        .locator(".it-tag")
        .textContent(),
    ).toContain("middle");

    await page.locator("#tagSearch").fill("middle");
    expect(await renderedTags()).toEqual(["middle"]);
    expect(
      await page.locator('#tagFilters .gtag[data-tag-value="middle"]').getAttribute("class"),
    ).toContain("tag-hidden");
    expect((await hiddenDivider.textContent())?.trim()).toBe("hidden 1 ▴");

    await page.locator("#tagSearch").press("Escape");
    expect(await page.locator("#tagSearch").inputValue()).toBe("");
    expect(
      await page
        .locator("#tagSearch")
        .evaluate((node) => node.ownerDocument.activeElement === node),
    ).toBe(true);
    await page.locator("#tagSearch").fill("middle");

    await page.locator("#tagSearchClear").click();
    await hiddenDivider.click();
    expect(await renderedTags()).toEqual(["old", "new", "middle"]);
    expect((await hiddenDivider.textContent())?.trim()).toBe("hidden 1 ▴");
    expect(
      await page.locator('#tagFilters .gtag[data-tag-value="middle"]').getAttribute("class"),
    ).toContain("tag-hidden");
    expect(await page.locator('#tagFilters .gtag[data-tag-value="middle"] .gtagdel').count()).toBe(
      0,
    );
    expect(visibilityWrites).toEqual([]);

    const hideTransfer = await page.evaluateHandle(() => {
      const BrowserDataTransfer = (
        globalThis as unknown as {
          DataTransfer: new () => Record<string, never>;
        }
      ).DataTransfer;
      return new BrowserDataTransfer();
    });
    const oldTag = page.locator('#tagFilters .gtag[data-tag-value="old"]');
    await oldTag.dispatchEvent("dragstart", { dataTransfer: hideTransfer });
    const hiddenBox = await hiddenDivider.boundingBox();
    if (!hiddenBox) throw new Error("missing hidden tag drop zone bounds");
    const hiddenDropPoint = {
      clientX: hiddenBox.x + hiddenBox.width / 2,
      clientY: hiddenBox.y + hiddenBox.height / 2,
      dataTransfer: hideTransfer,
    };
    await hiddenDivider.dispatchEvent("dragover", hiddenDropPoint);
    await expect.poll(() => hiddenDivider.getAttribute("class")).toContain("drag-over");
    expect(await page.locator("#tagFilters .tag-drag-placeholder").count()).toBe(0);
    await hiddenDivider.dispatchEvent("drop", hiddenDropPoint);
    await hideTransfer.dispose();
    await expect
      .poll(() => visibilityWrites)
      .toEqual([{ hiddenTags: ["middle", "old"], pinnedTags: [] }]);
    expect(
      await page.locator('#tagFilters .gtag[data-tag-value="old"]').getAttribute("class"),
    ).toContain("tag-hidden");
    expect(
      await page.locator('#tagFilters .gtag[data-tag-value="old"]').getAttribute("class"),
    ).not.toContain("tag-pinned");

    await page
      .locator('#tagFilters .gtag[data-tag-value="old"]')
      .dragTo(page.locator('#tagFilters .gtag[data-tag-value="new"]'));
    await expect
      .poll(() => visibilityWrites)
      .toEqual([
        { hiddenTags: ["middle", "old"], pinnedTags: [] },
        { hiddenTags: ["middle"], pinnedTags: [] },
      ]);
    expect(
      await page.locator('#tagFilters .gtag[data-tag-value="old"]').getAttribute("class"),
    ).not.toContain("tag-hidden");
    expect((await hiddenDivider.textContent())?.trim()).toBe("hidden 1 ▴");
    expect(
      await page
        .locator("#list .item", { hasText: "Avoidance session" })
        .locator(".it-tag")
        .textContent(),
    ).toContain("old");
    await page.close();
  });

  it("keeps pinned tags first while recent mode owns the unpinned order", async () => {
    const page = await browser.newPage();
    const pinWrites: string[][] = [];
    const orderWrites: string[][] = [];
    await page.addInitScript(() => {
      localStorage.setItem("attend.tagOrderMode.v1", "recent");
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(tagPinView),
        });
      } else if (url.pathname === "/vault/ui-state") {
        const body = request.postDataJSON() as { pinnedTags?: string[] };
        if (body.pinnedTags) pinWrites.push(body.pinnedTags);
        await route.fulfill({ json: { ok: true } });
      } else if (url.pathname === "/tags/order") {
        const body = request.postDataJSON() as { tags: string[] };
        orderWrites.push(body.tags);
        await route.fulfill({ json: { ok: true, tags: body.tags } });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const userOrder = () =>
      page
        .locator("#tagFilters .gtag[data-tag-value]")
        .evaluateAll((chips) => chips.map((chip) => chip.getAttribute("data-tag-value")));
    const tag = (name: string) => page.locator(`#tagFilters .gtag[data-tag-value="${name}"]`);
    const dropTagOn = async (sourceName: string, targetName: string, edge: "start" | "end") => {
      const source = tag(sourceName);
      const target = tag(targetName);
      const transfer = await page.evaluateHandle(() => {
        const BrowserDataTransfer = (
          globalThis as unknown as {
            DataTransfer: new () => Record<string, never>;
          }
        ).DataTransfer;
        return new BrowserDataTransfer();
      });
      await source.dispatchEvent("dragstart", { dataTransfer: transfer });
      await page.evaluate(() => {
        const browserWindow = globalThis as unknown as {
          requestAnimationFrame(callback: () => void): number;
        };
        return new Promise<void>((resolve) => {
          browserWindow.requestAnimationFrame(() => resolve());
        });
      });
      const targetBox = await target.boundingBox();
      if (!targetBox) throw new Error(`missing ${targetName} tag bounds`);
      const point = {
        clientX: targetBox.x + (edge === "start" ? 1 : targetBox.width - 2),
        clientY: targetBox.y + targetBox.height / 2,
        dataTransfer: transfer,
      };
      await page.locator("#tagFilters").dispatchEvent("dragover", point);
      await page.locator("#tagFilters").dispatchEvent("drop", point);
      await transfer.dispose();
    };
    expect(await userOrder()).toEqual(["old", "new", "middle"]);
    expect(await tag("old").getAttribute("class")).toContain("tag-pinned");
    expect(await page.locator("#tagFilters .tag-pin-divider").count()).toBe(1);
    expect(await page.locator("#tagFilters .tag-pin-empty").count()).toBe(0);
    const middleSession = page.locator("#list .item", {
      hasText: "Middle session",
    });
    await middleSession.locator(".it-tagadd").click();
    const pinnedBindingOption = page.locator("#sessionTagList .sessiontag-option", {
      hasText: "old",
    });
    await expect.poll(() => pinnedBindingOption.locator(".tag-option-pin").count()).toBe(1);
    expect(await pinnedBindingOption.getAttribute("aria-label")).toBe("old (pinned)");
    expect(
      await page
        .locator("#sessionTagList .sessiontag-option", { hasText: "new" })
        .locator(".tag-option-pin")
        .count(),
    ).toBe(0);
    await middleSession.locator(".it-tagadd").click();

    await page.locator("#newToggle").click();
    await page.locator("#newTagAdd").click();
    expect(
      await page
        .locator("#newTagSug .newtagopt", { hasText: "old" })
        .locator(".tag-option-pin")
        .count(),
    ).toBe(1);
    expect(
      await page
        .locator("#newTagSug .newtagopt", { hasText: "new" })
        .locator(".tag-option-pin")
        .count(),
    ).toBe(0);
    await page.locator("#newClose").click();

    // A delayed dragend cleanup from one operation must not clear a new drag of
    // the same chip that starts before the old zero-delay callback runs.
    await tag("middle").evaluate((chip) => {
      const browserWindow = chip.ownerDocument.defaultView;
      if (!browserWindow) throw new Error("missing browser window");
      const firstTransfer = new browserWindow.DataTransfer();
      chip.dispatchEvent(
        new browserWindow.DragEvent("dragstart", {
          bubbles: true,
          cancelable: true,
          dataTransfer: firstTransfer,
        }),
      );
      chip.dispatchEvent(new browserWindow.DragEvent("dragend", { bubbles: true }));
      const secondTransfer = new browserWindow.DataTransfer();
      chip.dispatchEvent(
        new browserWindow.DragEvent("dragstart", {
          bubbles: true,
          cancelable: true,
          dataTransfer: secondTransfer,
        }),
      );
    });
    await expect
      .poll(async () => (await tag("middle").getAttribute("class"))?.includes("drag-layout-source"))
      .toBe(true);
    await tag("middle").dispatchEvent("dragend");
    await expect
      .poll(async () => (await tag("middle").getAttribute("class"))?.includes("dragging"))
      .toBe(false);

    const unpinnedWidth = await tag("middle").evaluate(
      (chip) => chip.getBoundingClientRect().width,
    );

    const newBox = await tag("new").boundingBox();
    if (!newBox) throw new Error("missing new tag bounds");
    await tag("middle").dragTo(tag("new"), {
      targetPosition: { x: newBox.width - 2, y: newBox.height / 2 },
    });
    expect(await userOrder()).toEqual(["old", "new", "middle"]);
    expect(orderWrites).toEqual([]);

    await dropTagOn("middle", "old", "start");
    await expect.poll(() => pinWrites).toEqual([["middle", "old"]]);
    await expect.poll(() => userOrder()).toEqual(["middle", "old", "new"]);
    expect(await tag("middle").getAttribute("class")).toContain("tag-pinned");
    expect(await tag("middle").evaluate((chip) => chip.getBoundingClientRect().width)).toBe(
      unpinnedWidth,
    );

    await dropTagOn("middle", "new", "end");
    await expect.poll(() => pinWrites).toEqual([["middle", "old"], ["old"]]);
    await expect.poll(() => userOrder()).toEqual(["old", "new", "middle"]);
    expect(await tag("middle").getAttribute("class")).not.toContain("tag-pinned");
    await expect.poll(() => pinWrites).toEqual([["middle", "old"], ["old"]]);
    expect(orderWrites).toEqual([]);

    await dropTagOn("old", "new", "end");
    await expect.poll(() => pinWrites).toEqual([["middle", "old"], ["old"], []]);
    expect(await page.locator("#tagFilters .tag-pin-empty").textContent()).toBe("drag here to pin");
    expect(await page.locator("#tagFilters .tag-pin-divider").count()).toBe(1);

    const pinTransfer = await page.evaluateHandle(() => {
      const BrowserDataTransfer = (
        globalThis as unknown as {
          DataTransfer: new () => Record<string, never>;
        }
      ).DataTransfer;
      return new BrowserDataTransfer();
    });
    await tag("middle").dispatchEvent("dragstart", {
      dataTransfer: pinTransfer,
    });
    const pinBox = await page.locator("#tagFilters .tag-pin-empty").boundingBox();
    if (!pinBox) throw new Error("missing pin target bounds");
    await page.locator("#tagFilters .tag-pin-empty").dispatchEvent("dragover", {
      clientX: pinBox.x + pinBox.width / 2,
      clientY: pinBox.y + pinBox.height / 2,
      dataTransfer: pinTransfer,
    });
    const pinPreview = page.locator("#tagFilters .tag-drag-placeholder");
    expect((await pinPreview.textContent())?.trim()).toBe("middle");
    expect(
      await page
        .locator("#tagFilters .tag-pin-empty")
        .evaluate((node) => node.ownerDocument.defaultView?.getComputedStyle(node).display),
    ).toBe("none");
    const pinPreviewBox = await pinPreview.boundingBox();
    if (!pinPreviewBox) throw new Error("missing pin preview bounds");
    expect(pinPreviewBox.x).toBeCloseTo(pinBox.x, 0);
    expect(
      await pinPreview.evaluate((node) => {
        const style = node.ownerDocument.defaultView?.getComputedStyle(node);
        return {
          borderStyle: style?.borderStyle,
          backgroundColor: style?.backgroundColor,
        };
      }),
    ).toEqual(
      expect.objectContaining({
        borderStyle: "dashed",
        backgroundColor: "rgba(0, 0, 0, 0)",
      }),
    );
    expect(await pinPreview.evaluate((node) => node.nextElementSibling?.className)).toContain(
      "tag-pin-divider",
    );
    await tag("middle").dispatchEvent("dragend", { dataTransfer: pinTransfer });
    await pinTransfer.dispose();
    expect(
      await page
        .locator("#tagFilters .tag-pin-empty")
        .evaluate((node) => node.ownerDocument.defaultView?.getComputedStyle(node).display),
    ).not.toBe("none");
    expect(await pinPreview.count()).toBe(0);

    await tag("middle").dragTo(page.locator("#tagFilters .tag-pin-empty"));
    await expect.poll(() => userOrder()).toEqual(["middle", "new", "old"]);
    expect(await page.locator("#tagFilters .tag-pin-empty").count()).toBe(0);
    expect(await page.locator("#tagFilters .tag-pin-divider").count()).toBe(1);
    await expect.poll(() => pinWrites).toEqual([["middle", "old"], ["old"], [], ["middle"]]);
    await page.close();
  }, 15_000);

  it("uses the selected recent or fixed order in both tag binding lists", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("attend.tagOrderMode.v1", "recent");
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(tagPickerOrderView),
        });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const card = page.locator("#list .item", { hasText: "Tag picker target" });
    const cardOrder = () =>
      page
        .locator("#sessionTagList .sessiontag-option")
        .evaluateAll((options) => options.map((option) => option.getAttribute("data-val")));
    const newOrder = () =>
      page
        .locator("#newTagSug .newtagopt")
        .evaluateAll((options) => options.map((option) => option.getAttribute("data-val")));

    const cardHeightBefore = await card.evaluate((node) => node.offsetHeight);
    await card.locator(".it-tagadd").click();
    await expect.poll(cardOrder).toEqual(["old", "new", "middle"]);
    expect(await card.evaluate((node) => node.offsetHeight)).toBe(cardHeightBefore);
    expect(
      await page.locator("#sessionTagPopover").evaluate((node) => node.parentElement?.tagName),
    ).toBe("BODY");
    await card.locator(".it-tagadd").click();
    await page.locator("#newToggle").click();
    await page.locator("#newTagAdd").click();
    await expect.poll(newOrder).toEqual(["old", "new", "middle"]);
    await page.locator("#newClose").click();

    await page.locator("#tagOrderToggle").click();
    expect((await page.locator("#tagOrderValue").textContent())?.trim()).toBe("fixed");
    await card.locator(".it-tagadd").click();
    await expect.poll(cardOrder).toEqual(["old", "middle", "new"]);
    await card.locator(".it-tagadd").click();
    await page.locator("#newToggle").click();
    await page.locator("#newTagAdd").click();
    await expect.poll(newOrder).toEqual(["old", "middle", "new"]);
    await page.close();
  });

  it("pins an unpinned tag when dropped in the gap before the pin divider", async () => {
    const page = await browser.newPage();
    const pinWrites: string[][] = [];
    await page.addInitScript(() => {
      localStorage.setItem("attend.tagOrderMode.v1", "recent");
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(tagPinView),
        });
      } else if (url.pathname === "/vault/ui-state") {
        const body = request.postDataJSON() as { pinnedTags?: string[] };
        if (body.pinnedTags) pinWrites.push(body.pinnedTags);
        await route.fulfill({ json: { ok: true } });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const wrap = page.locator("#tagFilters");
    const old = page.locator('#tagFilters .gtag[data-tag-value="old"]');
    const middle = page.locator('#tagFilters .gtag[data-tag-value="middle"]');
    const divider = page.locator("#tagFilters .tag-pin-divider");
    const [wrapBox, oldBox, dividerBox] = await Promise.all([
      wrap.boundingBox(),
      old.boundingBox(),
      divider.boundingBox(),
    ]);
    if (!wrapBox || !oldBox || !dividerBox) throw new Error("missing occupied pin boundary bounds");
    const gapLeft = oldBox.x + oldBox.width;
    const gapRight = dividerBox.x;
    expect(gapRight).toBeGreaterThan(gapLeft);

    await middle.dragTo(wrap, {
      targetPosition: {
        x: (gapLeft + gapRight) / 2 - wrapBox.x,
        y: oldBox.y + oldBox.height / 2 - wrapBox.y,
      },
    });

    await expect.poll(() => pinWrites).toEqual([["old", "middle"]]);
    expect(await middle.getAttribute("class")).toContain("tag-pinned");
    await expect
      .poll(() =>
        page
          .locator("#tagFilters .gtag[data-tag-value]")
          .evaluateAll((chips) => chips.map((chip) => chip.getAttribute("data-tag-value"))),
      )
      .toEqual(["old", "middle", "new"]);
    await page.close();
  });

  it("manually reorders the fixed-mode unpinned region without pinning it", async () => {
    const page = await browser.newPage();
    const pinWrites: string[][] = [];
    const orderWrites: string[][] = [];
    await page.addInitScript(() => {
      localStorage.setItem("attend.tagOrderMode.v1", "fixed");
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(tagPinView),
        });
      } else if (url.pathname === "/vault/ui-state") {
        const body = request.postDataJSON() as { pinnedTags?: string[] };
        if (body.pinnedTags) pinWrites.push(body.pinnedTags);
        await route.fulfill({ json: { ok: true } });
      } else if (url.pathname === "/tags/order") {
        const body = request.postDataJSON() as { tags: string[] };
        orderWrites.push(body.tags);
        await route.fulfill({ json: { ok: true, tags: body.tags } });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const userOrder = () =>
      page
        .locator("#tagFilters .gtag[data-tag-value]")
        .evaluateAll((chips) => chips.map((chip) => chip.getAttribute("data-tag-value")));
    const middle = page.locator('#tagFilters .gtag[data-tag-value="middle"]');
    const newer = page.locator('#tagFilters .gtag[data-tag-value="new"]');
    const sourceWidth = await middle.evaluate((chip) => chip.getBoundingClientRect().width);
    const tagHeights = await page
      .locator("#tagFilters .gtag[data-tag-value]")
      .evaluateAll((chips) =>
        Object.fromEntries(
          chips.map((chip) => [
            chip.getAttribute("data-tag-value"),
            chip.getBoundingClientRect().height,
          ]),
        ),
      );
    const newBox = await newer.boundingBox();
    if (!newBox) throw new Error("missing fixed-mode tag bounds");

    const transfer = await page.evaluateHandle(() => {
      const BrowserDataTransfer = (
        globalThis as unknown as {
          DataTransfer: new () => Record<string, never>;
        }
      ).DataTransfer;
      return new BrowserDataTransfer();
    });
    await middle.dispatchEvent("dragstart", { dataTransfer: transfer });
    await newer.dispatchEvent("dragover", {
      clientX: newBox.x + 1,
      clientY: newBox.y + newBox.height / 2,
      dataTransfer: transfer,
    });
    const preview = page.locator("#tagFilters .tag-drag-placeholder");
    expect(await preview.count()).toBe(1);
    expect((await preview.textContent())?.trim()).toBe("middle");
    expect(
      await preview.evaluate((node) => node.nextElementSibling?.getAttribute("data-tag-value")),
    ).toBe("new");
    await page.evaluate(() => {
      const browserGlobal = globalThis as unknown as {
        tagDragMutationCount: number;
        tagDragMutationObserver: {
          observe(node: unknown, options: unknown): void;
        };
        MutationObserver: new (
          callback: (records: Array<{ type: string }>) => void,
        ) => { observe(node: unknown, options: unknown): void };
        document: { querySelector(selector: string): unknown };
      };
      browserGlobal.tagDragMutationCount = 0;
      browserGlobal.tagDragMutationObserver = new browserGlobal.MutationObserver((records) => {
        browserGlobal.tagDragMutationCount += records.filter(
          (record) => record.type === "childList",
        ).length;
      });
      const wrap = browserGlobal.document.querySelector("#tagFilters");
      if (wrap)
        browserGlobal.tagDragMutationObserver.observe(wrap, {
          childList: true,
        });
    });
    for (let index = 0; index < 10; index += 1) {
      await newer.dispatchEvent("dragover", {
        clientX: newBox.x + 1,
        clientY: newBox.y + newBox.height / 2,
        dataTransfer: transfer,
      });
    }
    await page.waitForTimeout(0);
    expect(
      await page.evaluate(
        () => (globalThis as unknown as { tagDragMutationCount: number }).tagDragMutationCount,
      ),
    ).toBe(0);
    await page.evaluate(() => {
      (
        globalThis as unknown as {
          tagDragMutationObserver: { disconnect(): void };
        }
      ).tagDragMutationObserver.disconnect();
    });
    for (let index = 0; index < 20; index += 1) {
      await newer.dispatchEvent("dragover", {
        clientX: newBox.x + newBox.width - 1,
        clientY: newBox.y + newBox.height / 2,
        dataTransfer: transfer,
      });
      expect(
        await preview.evaluate((node) =>
          node.previousElementSibling?.getAttribute("data-tag-value"),
        ),
      ).toBe("new");
      await newer.dispatchEvent("dragover", {
        clientX: newBox.x + 1,
        clientY: newBox.y + newBox.height / 2,
        dataTransfer: transfer,
      });
      expect(
        await preview.evaluate((node) => node.nextElementSibling?.getAttribute("data-tag-value")),
      ).toBe("new");
    }
    expect(
      await page
        .locator("#tagFilters .gtag[data-tag-value]")
        .evaluateAll((chips) =>
          Object.fromEntries(
            chips
              .filter((chip) => !chip.classList.contains("drag-layout-source"))
              .map((chip) => [
                chip.getAttribute("data-tag-value"),
                chip.getBoundingClientRect().height,
              ]),
          ),
        ),
    ).toEqual(Object.fromEntries(Object.entries(tagHeights).filter(([tag]) => tag !== "middle")));
    expect(
      await page
        .locator("#tagFilters > :not(.tag-drag-placeholder)")
        .evaluateAll((nodes) =>
          nodes.reduce((count, node) => count + node.getAnimations().length, 0),
        ),
    ).toBe(0);
    expect(
      await middle.evaluate((chip) => {
        const style = chip.ownerDocument.defaultView?.getComputedStyle(chip);
        return { position: style?.position, visibility: style?.visibility };
      }),
    ).toEqual({ position: "absolute", visibility: "hidden" });
    expect(await page.locator("#tagFilters .tag-drag-placeholder").count()).toBe(1);
    expect(
      await page
        .locator("#tagFilters > *")
        .evaluateAll((nodes) =>
          Math.max(
            0,
            ...nodes.map(
              (node) =>
                node
                  .getAnimations()
                  .filter((animation: { id: string }) => animation.id === "tag-drop-layout").length,
            ),
          ),
        ),
    ).toBe(0);
    const previewLayoutWidth = await preview.evaluate((node) => {
      const browserWindow = node.ownerDocument.defaultView as unknown as {
        getComputedStyle(target: typeof node): { width: string };
      };
      return Number.parseFloat(browserWindow.getComputedStyle(node).width);
    });
    expect(previewLayoutWidth).toBeCloseTo(sourceWidth, 1);
    expect(await preview.evaluate((node) => node.getAnimations().length)).toBe(0);
    await middle.evaluate((chip) => chip.setAttribute("data-drag-node", "original"));
    await page.locator("#tagSearch").dispatchEvent("input");
    expect(await middle.getAttribute("data-drag-node")).toBe("original");
    expect(await preview.count()).toBe(1);
    await middle.dispatchEvent("dragend", { dataTransfer: transfer });
    await transfer.dispose();
    expect(await preview.count()).toBe(0);
    await expect.poll(() => middle.getAttribute("data-drag-node")).toBeNull();
    expect(await middle.evaluate((chip) => chip.getBoundingClientRect().width)).toBeCloseTo(
      sourceWidth,
      1,
    );
    await page.waitForTimeout(200);
    expect(
      await page
        .locator("#tagFilters > *")
        .evaluateAll((nodes) =>
          nodes.reduce(
            (count, node) =>
              count +
              node
                .getAnimations()
                .filter((animation: { id: string }) => animation.id === "tag-drop-layout").length,
            0,
          ),
        ),
    ).toBe(0);

    const wrap = page.locator("#tagFilters");
    await wrap.evaluate((node) => {
      (node as unknown as { style: { width: string } }).style.width = "100px";
    });
    const old = page.locator('#tagFilters .gtag[data-tag-value="old"]');
    const [oldBox, middleBox] = await Promise.all([old.boundingBox(), middle.boundingBox()]);
    if (!oldBox || !middleBox) throw new Error("missing wrapped tag bounds");
    expect(Math.abs(oldBox.y - middleBox.y)).toBeGreaterThan(2);
    const crossRowTransfer = await page.evaluateHandle(() => {
      const BrowserDataTransfer = (
        globalThis as unknown as {
          DataTransfer: new () => Record<string, never>;
        }
      ).DataTransfer;
      return new BrowserDataTransfer();
    });
    await newer.dispatchEvent("dragstart", { dataTransfer: crossRowTransfer });
    for (let index = 0; index < 12; index += 1) {
      await wrap.dispatchEvent("dragover", {
        clientX: oldBox.x + 1,
        clientY: oldBox.y + oldBox.height / 2,
        dataTransfer: crossRowTransfer,
      });
      expect(
        await preview.evaluate((node) => node.nextElementSibling?.getAttribute("data-tag-value")),
      ).toBe("old");
      await wrap.dispatchEvent("dragover", {
        clientX: middleBox.x + middleBox.width - 1,
        clientY: middleBox.y + middleBox.height / 2,
        dataTransfer: crossRowTransfer,
      });
      expect(
        await preview.evaluate((node) =>
          node.previousElementSibling?.getAttribute("data-tag-value"),
        ),
      ).toBe("middle");
    }
    await newer.dispatchEvent("dragend", { dataTransfer: crossRowTransfer });
    await crossRowTransfer.dispose();
    await wrap.evaluate((node) => {
      (node as unknown as { style: { width: string } }).style.width = "";
    });

    await middle.dragTo(newer, {
      targetPosition: { x: 1, y: newBox.height / 2 },
    });

    await expect.poll(() => userOrder()).toEqual(["old", "middle", "new"]);
    expect(await middle.getAttribute("class")).not.toContain("tag-pinned");
    await expect.poll(() => orderWrites).toEqual([["old", "middle", "new"]]);
    expect(pinWrites).toEqual([]);
    await page.close();
  });

  it("offers binding cleanup and deletion actions for bound and unbound tags", async () => {
    const page = await browser.newPage();
    const requests: Array<{ method: string; path: string; body?: unknown }> = [];
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(untaggedView),
        });
      } else if (url.pathname === "/tags/clear-session-bindings") {
        requests.push({
          method: request.method(),
          path: url.pathname,
          body: request.postDataJSON(),
        });
        await route.fulfill({ json: { ok: true, tags: ["work"] } });
      } else if (url.pathname === "/tags" && request.method() === "DELETE") {
        requests.push({ method: request.method(), path: url.pathname });
        await route.fulfill({ json: { ok: true, tags: [] } });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    await page.locator("#tagFilters .gtag:not(.auto) .gtagdel").click();
    expect(await page.locator("#tagAction").isVisible()).toBe(true);
    await expect.poll(() => page.locator(":focus").getAttribute("id")).toBe("tagActionClear");
    expect(await page.locator("#tagActionTitle").textContent()).toBe("Manage tag “work”");
    expect(await page.locator("#tagActionVisibility").count()).toBe(0);
    expect(await page.locator("#tagActionClear").textContent()).toBe("Remove from 1 chat");
    expect(await page.locator("#tagActionClear").getAttribute("data-tooltip")).toBe(
      "Keep this tag, but remove it from all chats currently using it.",
    );
    expect(await page.locator("#tagActionClear").isDisabled()).toBe(false);
    expect(await page.locator("#tagActionDelete").textContent()).toBe("Delete tag");

    await page.locator("#tagActionClear").click();
    await expect
      .poll(() => requests)
      .toEqual([
        {
          method: "POST",
          path: "/tags/clear-session-bindings",
          body: { name: "work" },
        },
      ]);
    expect(await page.locator("#tagFilters .gtag:not(.auto)").count()).toBe(1);
    expect(await page.locator("#tagFilters .gtag:not(.auto) .gtagcount").textContent()).toBe("0");

    await page.locator("#tagFilters .gtag:not(.auto) .gtagdel").click();
    expect(await page.locator("#tagAction").isVisible()).toBe(true);
    expect(await page.locator("#tagActionClear").isHidden()).toBe(true);
    await page.locator("#tagActionDelete").click();
    await expect
      .poll(() => requests)
      .toEqual([
        {
          method: "POST",
          path: "/tags/clear-session-bindings",
          body: { name: "work" },
        },
        { method: "DELETE", path: "/tags" },
      ]);
    expect(await page.locator("#tagAction").isVisible()).toBe(false);
    expect(await page.locator("#tagFilters .gtag:not(.auto)").count()).toBe(0);
    await page.close();
  });

  it("dismisses the priority filter when another control stops click propagation", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(pendingTagView),
        });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    await page.locator("#priorityTag > .gtagbtn").click();
    expect(await page.locator("#priorityTag .prioritytagmenu").isVisible()).toBe(true);

    // This control stops propagation, so it specifically exercises capture-phase dismissal.
    await page.locator("#newToggle").click();
    await expect.poll(() => page.locator("#priorityTag .prioritytagmenu").count()).toBe(0);
    await page.close();
  });

  it("pans fork trees with two-finger scrolling and zooms only for pinch", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as { EventSource: unknown };
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("http://attend.test/", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: renderConsole(forkTreeView),
      }),
    );
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const first = page.locator("#list .item", { hasText: "Avoidance session" });
    await first.locator(".forktree-trigger").click();
    expect(await page.locator("#forkTreeViewport").isVisible()).toBe(true);
    await expect
      .poll(() => page.locator("#forkTreeStage").getAttribute("style"))
      .toContain("scale(");

    const result = await page.locator("#forkTreeViewport").evaluate((viewport) => {
      type StyledNode = { style: { transform: string } };
      type BrowserWheel = { defaultPrevented: boolean };
      const BrowserWheelEvent = (
        globalThis as unknown as {
          WheelEvent: new (type: string, init: Record<string, unknown>) => BrowserWheel;
        }
      ).WheelEvent;
      const doc = viewport.ownerDocument;
      const dispatcher = viewport as unknown as {
        dispatchEvent(event: BrowserWheel): boolean;
      };
      const pan = doc.querySelector("#forkTreePan") as unknown as StyledNode | null;
      const stage = doc.querySelector("#forkTreeStage") as unknown as StyledNode | null;
      if (!pan || !stage) throw new Error("fork tree canvas is missing");
      const snapshot = () => ({
        pan: pan.style.transform,
        stage: stage.style.transform,
      });
      const before = snapshot();
      const scroll = new BrowserWheelEvent("wheel", {
        deltaX: 30,
        deltaY: 50,
        bubbles: true,
        cancelable: true,
      });
      dispatcher.dispatchEvent(scroll);
      const afterScroll = snapshot();
      const pinch = new BrowserWheelEvent("wheel", {
        deltaY: -50,
        ctrlKey: true,
        clientX: 300,
        clientY: 240,
        bubbles: true,
        cancelable: true,
      });
      dispatcher.dispatchEvent(pinch);
      return {
        before,
        afterScroll,
        afterPinch: snapshot(),
        scrollPrevented: scroll.defaultPrevented,
        pinchPrevented: pinch.defaultPrevented,
      };
    });

    expect(result.scrollPrevented).toBe(true);
    expect(result.pinchPrevented).toBe(true);
    expect(result.afterScroll.pan).not.toBe(result.before.pan);
    expect(result.afterScroll.stage).toBe(result.before.stage);
    expect(result.afterPinch.stage).not.toBe(result.afterScroll.stage);
    await page.close();
  });

  it("shows the full truncated avoidance suggestion on hover", async () => {
    const page = await browser.newPage({
      viewport: { width: 900, height: 700 },
    });
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(raceView),
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: {} });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator('#list .item[data-session-id="s1"]').click();

    const suggestion = page.locator("#avoidPanel .avoidpanel-draft");
    const fullText = await suggestion.textContent();
    await suggestion.evaluate((node) => {
      (node as unknown as { style: { width: string } }).style.width = "120px";
    });
    await suggestion.hover();

    expect(await suggestion.getAttribute("data-hover-tip")).toBe(fullText);
    await expect.poll(() => page.locator("#hoverTip").textContent()).toBe(fullText);
    expect(await page.locator("#hoverTip").isVisible()).toBe(true);
    await page.close();
  });

  it("keeps the target session generating across an immediate tab switch and stale snapshot", async () => {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    let releaseSend = () => {};
    const sendGate = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as Record<string, unknown>;
      class StubEventSource {
        static readonly CLOSED = 2;
        onopen: (() => void) | null = null;
        onmessage: ((event: { data: string }) => void) | null = null;
        onerror: (() => void) | null = null;
        constructor() {
          browserGlobal.__attendEventSource = this;
        }
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(raceView),
        });
      } else if (url.pathname === "/chat/send") {
        await sendGate;
        await route.fulfill({ json: { ok: false, error: "late response" } });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/session/status") {
        await route.fulfill({ json: { ok: true } });
      } else {
        await route.fulfill({ json: {} });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const first = page.locator("#list .item", { hasText: "Avoidance session" });
    const second = page.locator("#list .item", { hasText: "Other session" });
    await first.click();
    expect(await page.locator("#avoidPanel").isVisible()).toBe(true);
    await page.locator("#input").fill("continue now");
    await page.locator("#send").click();

    expect(await page.locator("#avoidPanel").isHidden()).toBe(true);
    await second.click();
    await expect
      .poll(() => first.locator(".it-status").getAttribute("class"))
      .toContain("generating");

    await page.evaluate(() => {
      const source = (globalThis as unknown as Record<string, unknown>).__attendEventSource as {
        onmessage(event: { data: string }): void;
      };
      source.onmessage({
        data: JSON.stringify({
          active: [],
          startedAt: {},
          lastAssistantAt: {},
          queues: {},
        }),
      });
    });
    await expect
      .poll(() => first.locator(".it-status").getAttribute("class"))
      .toContain("generating");

    await page.evaluate(() => {
      const source = (globalThis as unknown as Record<string, unknown>).__attendEventSource as {
        onmessage(event: { data: string }): void;
      };
      source.onmessage({
        data: JSON.stringify({
          kind: "session_event",
          sessionId: "s1",
          emittedAt: Date.now(),
          event: { kind: "user_turn_started", text: "continue now" },
        }),
      });
    });
    await expect
      .poll(() => first.locator(".it-status").getAttribute("class"))
      .toContain("generating");
    const lateResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/chat/send",
    );
    releaseSend();
    await lateResponse;
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
    await expect
      .poll(() => first.locator(".it-status").getAttribute("class"))
      .toContain("generating");
    await page.evaluate(() => {
      const source = (globalThis as unknown as Record<string, unknown>).__attendEventSource as {
        onmessage(event: { data: string }): void;
      };
      source.onmessage({
        data: JSON.stringify({
          kind: "session_event",
          sessionId: "s1",
          emittedAt: Date.now(),
          event: { kind: "result", ok: true },
        }),
      });
    });
    await expect.poll(() => first.locator(".it-status").getAttribute("class")).toContain("unread");
    expect(pageErrors).toEqual([]);
    await page.close();
  });

  it("keeps recent order stable when opening generating tabs persists their status", async () => {
    const page = await browser.newPage();
    const liveSessions = raceView.sessions.map((session) => ({
      ...session,
      sortTs: session.lastTs,
      generating: true,
      unread: true,
      seen: false,
    }));
    const liveView: ConsoleView = { ...raceView, sessions: liveSessions };
    await page.addInitScript(() => {
      class StubEventSource {
        onopen: (() => void) | null = null;
        onmessage: ((event: { data: string }) => void) | null = null;
        onerror: (() => void) | null = null;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(liveView),
        });
      } else if (url.pathname === "/session/status") {
        const id = url.searchParams.get("session");
        const session = liveSessions.find((candidate) => candidate.sessionId === id);
        await route.fulfill({
          json: {
            ok: true,
            view: session
              ? {
                  ...session,
                  lastTs: 1_000,
                  sortTs: 1_000,
                  unread: false,
                  seen: true,
                }
              : null,
          },
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: {} });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const titles = () =>
      page
        .locator("#list .item .it-title")
        .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()));
    expect(await titles()).toEqual(["Avoidance session", "Other session"]);

    const statusResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/session/status" &&
        new URL(response.url()).searchParams.get("session") === "s2",
    );
    await page.locator("#list .item", { hasText: "Other session" }).click();
    await statusResponse;
    expect(await titles()).toEqual(["Avoidance session", "Other session"]);
    await page.close();
  });

  it("moves a read session to the top when its status light re-flags it", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      class StubEventSource {
        onopen: (() => void) | null = null;
        onmessage: ((event: { data: string }) => void) | null = null;
        onerror: (() => void) | null = null;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(raceView),
        });
      } else if (url.pathname === "/session/status") {
        const session = raceView.sessions.find(
          (candidate) => candidate.sessionId === url.searchParams.get("session"),
        );
        await route.fulfill({
          json: {
            ok: true,
            view: session ? { ...session, unread: false, seen: true } : null,
          },
        });
      } else {
        await route.fulfill({ json: [] });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const titles = () =>
      page
        .locator("#list .item .it-title")
        .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()));
    expect(await titles()).toEqual(["Avoidance session", "Other session"]);

    const statusResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/session/status" &&
        new URL(response.url()).searchParams.get("session") === "s2",
    );
    await page.locator("#list .item", { hasText: "Other session" }).locator(".it-status").click();
    await statusResponse;

    expect(await titles()).toEqual(["Other session", "Avoidance session"]);
    await expect
      .poll(() =>
        page
          .locator("#list .item", { hasText: "Other session" })
          .locator(".it-status")
          .getAttribute("class"),
      )
      .toContain("seen");
    await page.close();
  });

  it("hands wheel scrolling from expanded edit diffs back to the chat at both boundaries", async () => {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 600 },
    });
    await page.setContent(renderConsole(view), {
      waitUntil: "domcontentloaded",
    });
    await page.locator("#msgs").evaluate((host) => {
      const doc = host.ownerDocument;
      doc.body.classList.remove("no-session");
      doc.body.classList.add("show-chat");

      const spacer = (text: string) => {
        const node = doc.createElement("div");
        node.textContent = text;
        node.style.flex = "0 0 900px";
        return node;
      };
      const row = doc.createElement("div");
      row.className = "toolrow";
      const details = doc.createElement("details");
      details.className = "toolc";
      details.open = true;
      const summary = doc.createElement("summary");
      summary.textContent = "Edit — src/large-file.ts";
      details.appendChild(summary);
      const diff = doc.createElement("div");
      diff.className = "diff";
      for (let index = 0; index < 180; index += 1) {
        const line = doc.createElement("div");
        line.className = "dline ctx";
        const text = doc.createElement("span");
        text.className = "dtext";
        text.textContent = `unchanged edit line ${index}`;
        line.appendChild(text);
        diff.appendChild(line);
      }
      details.appendChild(diff);
      row.appendChild(details);
      host.replaceChildren(spacer("before edit"), row, spacer("after edit"));
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const browserGlobal = globalThis as unknown as {
            requestAnimationFrame(callback: () => void): number;
          };
          browserGlobal.requestAnimationFrame(resolve);
        }),
    );

    const dimensions = await page.locator(".toolc .diff").evaluate((inner) => {
      const host = inner.closest("#msgs");
      if (!host) throw new Error("chat scroll host is missing");
      return {
        innerOverflow: inner.scrollHeight - inner.clientHeight,
        outerOverflow: host.scrollHeight - host.clientHeight,
        expanded: (inner.parentElement as unknown as { open?: boolean } | null)?.open === true,
      };
    });
    expect(dimensions.expanded).toBe(true);
    expect(dimensions.innerOverflow).toBeGreaterThan(300);
    expect(dimensions.outerOverflow).toBeGreaterThan(300);

    const result = await page.locator(".toolc .diff").evaluate((inner) => {
      type BrowserWheel = { defaultPrevented: boolean };
      const BrowserWheelEvent = (
        globalThis as unknown as {
          WheelEvent: new (type: string, init: Record<string, unknown>) => BrowserWheel;
        }
      ).WheelEvent;
      const host = inner.closest("#msgs");
      const target = inner.querySelector(".dtext") || inner;
      if (!host || !target) throw new Error("nested chat scroller is missing");
      const dispatcher = target as unknown as {
        dispatchEvent(event: BrowserWheel): boolean;
      };
      const innerMax = inner.scrollHeight - inner.clientHeight;
      const outerMax = host.scrollHeight - host.clientHeight;

      const dispatchAt = (innerTop: number, deltaY: number) => {
        inner.scrollTop = innerTop;
        host.scrollTop = Math.floor(outerMax / 2);
        const before = { inner: inner.scrollTop, outer: host.scrollTop };
        const wheel = new BrowserWheelEvent("wheel", {
          deltaY,
          bubbles: true,
          cancelable: true,
        });
        dispatcher.dispatchEvent(wheel);
        return {
          before,
          after: { inner: inner.scrollTop, outer: host.scrollTop },
          prevented: wheel.defaultPrevented,
        };
      };

      return {
        innerMax,
        interior: dispatchAt(Math.floor(innerMax / 2), 120),
        top: dispatchAt(0, -120),
        bottom: dispatchAt(innerMax, 120),
      };
    });

    expect(result.interior.prevented).toBe(false);
    expect(result.interior.after).toEqual(result.interior.before);
    expect(result.top.prevented).toBe(true);
    expect(result.top.after.inner).toBe(0);
    expect(result.top.after.outer).toBeLessThan(result.top.before.outer);
    expect(result.bottom.prevented).toBe(true);
    expect(result.bottom.after.inner).toBe(result.innerMax);
    expect(result.bottom.after.outer).toBeGreaterThan(result.bottom.before.outer);
    await page.close();
  });

  it("keeps tool names visible beside the collapse control in a narrow chat", async () => {
    const page = await browser.newPage({
      viewport: { width: 240, height: 480 },
    });
    await page.setContent(renderConsole(view), {
      waitUntil: "domcontentloaded",
    });
    await page.locator("#msgs").evaluate((host) => {
      const doc = host.ownerDocument;
      doc.body.classList.remove("no-session");
      doc.body.classList.add("show-chat");
      const row = doc.createElement("div");
      row.className = "toolrow";
      const details = doc.createElement("details");
      details.className = "toolc";
      const summary = doc.createElement("summary");
      const label = doc.createElement("span");
      label.className = "tool-summary-text";
      label.textContent = "⚙ exec — npm test";
      summary.appendChild(label);
      details.appendChild(summary);
      row.appendChild(details);
      host.replaceChildren(row);
    });

    const label = page.locator(".tool-summary-text");
    expect(await label.isVisible()).toBe(true);
    expect(await label.evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThan(20);
    expect(await label.textContent()).toContain("exec");
    await page.close();
  });

  it("places a compact icon-only back button above the mobile chat title", async () => {
    const page = await browser.newPage({
      viewport: { width: 390, height: 780 },
    });
    await page.setContent(renderConsole(raceView), {
      waitUntil: "domcontentloaded",
    });
    await page
      .locator(".main")
      .evaluate((main) => main.ownerDocument.body.classList.add("show-chat"));

    const backButton = page.locator("#backbtn");
    expect(await backButton.isVisible()).toBe(true);
    expect((await backButton.textContent())?.trim()).toBe("");
    expect(await backButton.getAttribute("aria-label")).toBe("back to sessions");

    const layout = await page.locator(".head").evaluate((head) => {
      const button = head.querySelector("#backbtn")?.getBoundingClientRect();
      const title = head.querySelector(".headmain")?.getBoundingClientRect();
      if (!button || !title) throw new Error("mobile chat header is incomplete");
      return {
        buttonWidth: button.width,
        buttonBottom: button.bottom,
        titleTop: title.top,
      };
    });
    expect(layout.buttonWidth).toBeLessThan(40);
    expect(layout.buttonBottom).toBeLessThanOrEqual(layout.titleTop);
    await page.close();
  });

  it("opens a simple unfiltered Todo popover after New and keeps standalone items unbound", async () => {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 820 },
    });
    const uiPatches: Record<string, unknown>[] = [];
    const todoView: ConsoleView = {
      ...composerRailView,
      vaultState: {
        ...composerRailView.vaultState,
        inboxTodos: [
          {
            id: "inbox-1",
            text: "Triage the release",
            createdAt: 10,
            updatedAt: 10,
            completed: false,
          },
          {
            id: "inbox-done",
            text: "Archive the release notes",
            createdAt: 9,
            updatedAt: 9,
            completed: true,
          },
        ],
        sessionTodos: {
          s1: [
            {
              id: "session-1",
              text: "Verify the migration",
              createdAt: 20,
              updatedAt: 20,
              completed: false,
            },
          ],
        },
      },
    };
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", {
        value: StubEventSource,
      });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole(todoView),
        });
      } else if (url.pathname === "/vault/ui-state") {
        uiPatches.push(request.postDataJSON() as Record<string, unknown>);
        await route.fulfill({ json: { ok: true } });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    expect(
      await page.locator(".topnav").evaluate((topnav) => {
        const newButton = topnav.querySelector("#newToggle");
        const todoButton = topnav.querySelector("#todoHubToggle");
        return !!(newButton && todoButton && newButton.compareDocumentPosition(todoButton) & 4);
      }),
    ).toBe(true);
    expect(await page.locator("#todoHubCount").textContent()).toBe("2");
    await page.locator("#newToggle").click();
    expect(await page.locator("#newbox").getAttribute("class")).toContain("open");
    await page.locator("#todoHubToggle").click();
    expect(await page.locator("#newbox").getAttribute("class")).not.toContain("open");
    expect(await page.locator("#todoHub").getAttribute("class")).toContain("open");
    expect(await page.locator("#todoHub").textContent()).toContain("Triage the release");
    expect(await page.locator("#todoHub").textContent()).toContain("Verify the migration");
    expect(await page.locator("#todoHub .todohub-tools").count()).toBe(0);
    expect(await page.locator("#todoHub .todohub-filter").count()).toBe(0);
    expect(await page.locator("#todoHubSearch").count()).toBe(0);
    expect(await page.locator("#todoHub").textContent()).not.toContain("Inbox");
    expect(await page.locator("#todoHubAddInput").getAttribute("placeholder")).toBe("Add a todo…");
    expect(await page.locator('[aria-label="Clear completed todos"]').count()).toBe(1);
    await page.locator('[aria-label="Clear completed todos"]').click();
    expect(await page.locator('[aria-label="Clear completed todos"]').count()).toBe(0);
    expect(await page.locator('[data-todo-id="inbox-done"]').count()).toBe(0);
    await expect
      .poll(() =>
        uiPatches.some(
          (patch) =>
            Array.isArray(patch.inboxTodos) &&
            !patch.inboxTodos.some((item: { id?: string }) => item.id === "inbox-done"),
        ),
      )
      .toBe(true);

    await page.locator("#todoHubAddInput").fill("Document the fallback");
    await page.locator("#todoHubAddInput").press("Enter");
    await expect.poll(() => page.locator("#todoHubCount").textContent()).toBe("3");
    await expect.poll(() => uiPatches.some((patch) => Array.isArray(patch.inboxTodos))).toBe(true);

    const inboxRow = page.locator('.todohub-item[data-todo-id="inbox-1"]');
    expect(await inboxRow.locator(".todohub-check").getAttribute("class")).toContain(
      "rail-todo-check",
    );
    expect(await inboxRow.locator('[aria-label="Delete todo"]').getAttribute("class")).toContain(
      "qdel",
    );
    expect(await page.locator('#todoHub [aria-label*="Move todo"]').count()).toBe(0);
    expect(await page.locator('#todoHub [aria-label*="Attach todo"]').count()).toBe(0);
    const addedRow = page.locator(".todohub-item", { hasText: "Document the fallback" });
    await addedRow.locator('[aria-label="Delete todo"]').click();
    await expect.poll(() => page.locator("#todoHubCount").textContent()).toBe("2");

    await page.locator("#todoHubClose").click();
    await page.locator("#sessionPanelToggle").click();
    await page.locator("#todoHubToggle").click();
    expect(await page.locator("#todoHub").getAttribute("class")).toContain("panel-hosted");
    const [todoBox, sessionPanel] = await Promise.all([
      page.locator("#todoHub").boundingBox(),
      page.locator("#sessionPanel").boundingBox(),
    ]);
    if (!todoBox || !sessionPanel) throw new Error("Missing Todo popover geometry");
    expect(todoBox.x).toBeGreaterThanOrEqual(sessionPanel.x - 20);
    expect(todoBox.x + todoBox.width).toBeLessThanOrEqual(sessionPanel.x + sessionPanel.width);

    await page.locator('.todohub-item[data-todo-id="session-1"] .todohub-text').click();
    await expect.poll(() => page.locator("#h-title").textContent()).toContain("Avoidance session");
    await page.locator("#railTodos").click();
    expect(await page.locator("#composerRailPop").textContent()).toContain("Verify the migration");
    await page.close();
  });

  it("sizes a collapsed tool call like an assistant text block", async () => {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 600 },
    });
    await page.setContent(renderConsole(view), {
      waitUntil: "domcontentloaded",
    });
    await page.locator("#msgs").evaluate((host) => {
      const doc = host.ownerDocument;
      doc.body.classList.remove("no-session");
      const row = doc.createElement("div");
      row.className = "toolrow";
      const details = doc.createElement("details");
      details.className = "toolc";
      const summary = doc.createElement("summary");
      const label = doc.createElement("span");
      label.className = "tool-summary-text";
      label.textContent = "⚙ exec — pwd";
      summary.appendChild(label);
      details.appendChild(summary);
      row.appendChild(details);
      const longRow = row.cloneNode(true) as typeof row;
      const longLabel = longRow.querySelector(".tool-summary-text");
      if (longLabel) longLabel.textContent = `⚙ exec — ${"very-long-command ".repeat(100)}`;
      host.replaceChildren(row, longRow);
    });

    const widths = await page.locator(".toolrow").evaluateAll((rows) =>
      rows.map((row) => ({
        row: row.getBoundingClientRect().width,
        tool: row.querySelector(".toolc")?.getBoundingClientRect().width ?? 0,
      })),
    );
    const [shortWidth, longWidth] = widths;
    if (!shortWidth || !longWidth) throw new Error("missing rendered tool rows");
    expect(shortWidth.tool).toBeGreaterThan(0);
    expect(shortWidth.tool).toBeLessThan(shortWidth.row / 2);
    expect(longWidth.tool).toBeLessThanOrEqual(longWidth.row - 75);
    await page.close();
  });
});
