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
      ? { ...session, model: "claude-sonnet", effort: "high", speed: "standard" }
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
    { vendor: "cursor", available: true, chat: true, version: "2026.07.09-a3815c0" },
  ],
};

describe("console browser behavior", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("selects a Pin with @, excludes tool Pins, and sends a structured reference", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
    const pageErrors: string[] = [];
    let sentBody: Record<string, unknown> | null = null;
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(pinReferenceView) });
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
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();

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

  it("keeps chars first and exposes the complete throughput data on hover", async () => {
    const page = await browser.newPage({ viewport: { width: 360, height: 720 } });
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
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole({ ...view, sessions1h: 8, prompts1h: 32, chars1h: 77_500 }),
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

  it("keeps unavailable vendors visible with English install or update guidance", async () => {
    const page = await browser.newPage();
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
    expect(await page.locator("#nvendorSug .chooser-opt").count()).toBe(3);
    expect(await page.locator("#nvendorSug .chooser-opt.unavailable").count()).toBe(2);
    const claude = page.locator('#nvendorSug .chooser-opt[data-value="claude"]');
    expect(await claude.getAttribute("aria-disabled")).toBe("true");
    expect(await claude.locator(".chooser-opt-meta").textContent()).toBe(
      "Claude CLI 2.0.99 is too old. Attend requires 2.1.0 or newer. Update Claude Code, then restart Attend.",
    );
    await page.locator("#nvendor").press("Escape");
    expect(await page.locator("#nvendorSug").isHidden()).toBe(true);
    expect(await page.locator("#newbox").getAttribute("class")).toContain("open");
    expect(
      await page.locator("#nvendor").evaluate((node) => node.ownerDocument.activeElement === node),
    ).toBe(true);
    await page.locator("#nvendor").click();
    await claude.click();
    expect(await page.locator("#nvendor").inputValue()).toBe("cursor");
    expect(await page.locator("#nmsg").textContent()).toContain("Update Claude Code");
    await page.locator("#np").focus();
    await page.locator("#np").press("Escape");
    expect(await page.locator("#newbox").getAttribute("class")).not.toContain("open");
    await page.close();
  });

  it("keeps the session title editor open when Enter confirms an IME candidate", async () => {
    const page = await browser.newPage();
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

  it("arms Goal from the new-session input and keeps its controls at bottom right", async () => {
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
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(pendingTagView) });
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
        __eventSource?: { onmessage: ((event: { data: string }) => void) | null };
      };
      class StubEventSource {
        static readonly CLOSED = 2;
        onmessage: ((event: { data: string }) => void) | null = null;
        constructor() {
          browserGlobal.__eventSource = this;
        }
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(raceView) });
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
          __eventSource?: { onmessage: ((event: { data: string }) => void) | null };
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
    expect(sentBodies[1]).toMatchObject({ text: "continue after signing in", attachments: [] });
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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(pendingTagView) });
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
            json: { ok: true, session: "new-auth-1", cwd: "/tmp/recent-project" },
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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(cursorMatrixView) });
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
        await route.fulfill({ json: { ok: true, session: "cursor-1", cwd: "/tmp/project" } });
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
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    await page.addInitScript(() => {
      localStorage.setItem("attend.sideW", "200");
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(cursorMatrixView) });
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

  it("preserves link query strings and never auto-uploads PlantUML source", async () => {
    const page = await browser.newPage();
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (/plantuml\.com|jsdelivr\.net/.test(request.url())) externalRequests.push(request.url());
    });
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as { fetch: typeof fetch; EventSource: unknown };
      browserGlobal.fetch = async () =>
        new Response("{}", { headers: { "content-type": "application/json" } });
      class StubEventSource {
        static readonly CLOSED = 2;
        onopen: (() => void) | null = null;
        onmessage: (() => void) | null = null;
        onerror: (() => void) | null = null;
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", { value: StubEventSource });
    });
    await page.setContent(renderConsole(view), { waitUntil: "domcontentloaded" });

    expect(
      await page.locator('.changelog-content a[href^="https://example.test"]').getAttribute("href"),
    ).toBe("https://example.test/?a=1&b=2");
    expect(await page.locator(".diagram-plantuml .diagram-render").isVisible()).toBe(true);
    expect(await page.locator(".diagram-plantuml img").count()).toBe(0);
    expect(externalRequests).toEqual([]);
    await page.close();
  });

  it("linkifies paths without mistaking ratios or slash-separated labels for directories", async () => {
    const page = await browser.newPage();
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
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        onopen: (() => void) | null = null;
        onmessage: (() => void) | null = null;
        onerror: (() => void) | null = null;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(view) });
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
      const rect = host.getBoundingClientRect();
      const browserWindow = host.ownerDocument.defaultView as unknown as {
        getComputedStyle(target: typeof host): { getPropertyValue(property: string): string };
      };
      const style = browserWindow.getComputedStyle((host.parentElement || host) as typeof host);
      const inset = [
        "--composer-overlay-height",
        "--queue-overlay-height",
        "--avoid-overlay-height",
      ].reduce(
        (total, property) => total + (Number.parseFloat(style.getPropertyValue(property)) || 0),
        0,
      );
      return rect.bottom - inset;
    });
    if (!bottomRailBox) throw new Error("Missing bottom-clamped action geometry");
    expect(bottomRailBox.y + bottomRailBox.height / 2).toBeCloseTo(
      visibleBottom - bottomRailBox.height / 2 - 6,
      0,
    );

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

  it("uses the same center-or-visible-edge placement in the comment panel", async () => {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(view) });
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

  it("keeps new-session and chat input geometry fixed when attachments are added", async () => {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    let sentBody: { text?: string; attachments?: unknown[] } | null = null;
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as {
        EventSource: unknown;
        __eventSource?: { onmessage: ((event: { data: string }) => void) | null };
      };
      class StubEventSource {
        static readonly CLOSED = 2;
        onmessage: ((event: { data: string }) => void) | null = null;
        constructor() {
          browserGlobal.__eventSource = this;
        }
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(pendingTagView) });
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
    await page.evaluate((attachments) => {
      const source = (
        globalThis as unknown as {
          __eventSource?: { onmessage: ((event: { data: string }) => void) | null };
        }
      ).__eventSource;
      source?.onmessage?.({
        data: JSON.stringify({
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
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    page.setDefaultTimeout(2_000);
    const uiPatches: unknown[] = [];
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(composerRailView) });
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
          return browserWindow?.getComputedStyle(item).backgroundColor;
        }),
      )
      .toBe("rgb(224, 231, 255)");
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
    const expectForkActionTheme = async (selector: string, hovered = false) => {
      const button = page.locator(selector);
      if (hovered) await button.hover();
      // Fork buttons transition into both their vendor and hover palettes.
      await page.waitForTimeout(180);
      const theme = await button.evaluate((node, useHover) => {
        const vendor = node.getAttribute("data-vendor") ?? "";
        const style = node.ownerDocument.defaultView?.getComputedStyle(node);
        const probe = node.ownerDocument.createElement("span");
        node.ownerDocument.body.appendChild(probe);
        const resolve = (name: string) => {
          probe.style.color = `var(${name})`;
          return node.ownerDocument.defaultView?.getComputedStyle(probe).color ?? "";
        };
        const expected = {
          background: resolve(`--vendor-${vendor}-${useHover ? "hover-" : ""}bg`),
          border: resolve(`--vendor-${vendor}-${useHover ? "hover-" : ""}border`),
          color: resolve(`--vendor-${vendor}-fg`),
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
    // Fork always shows the vendor it will use, including when that matches the current session.
    expect(await page.locator("#forkBtn").getAttribute("data-vendor")).toBe("claude");
    expect(await page.locator("#forkBtn").getAttribute("class")).toContain("fork-action");
    await expectForkActionTheme("#forkBtn");
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
    const todoCheckStyle = await page.locator(".rail-todo-check").evaluate((check) => {
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
    await page.locator(".rail-todo-check").check();
    expect(
      await page.locator(".rail-todo-check").evaluate((check) => {
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
          getComputedStyle(target: typeof option): { borderTopStyle: string; boxShadow: string };
        };
        const style = browserWindow.getComputedStyle(option);
        return { borderStyle: style.borderTopStyle, boxShadow: style.boxShadow };
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
    await expectForkActionTheme("#send");
    await expectForkActionTheme("#send", true);
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

  it("tab-completes the first ordered shortcut from the composer suffix", async () => {
    const page = await browser.newPage();
    const shortcutView: ConsoleView = {
      ...composerRailView,
      vaultState: {
        ...composerRailView.vaultState,
        shortcuts: [
          { id: "eager-result", text: "eager result", createdAt: 0, updatedAt: 0 },
          { id: "review-changes", text: "Review changes", createdAt: 1, updatedAt: 1 },
          { id: "review-checklist", text: "Review checklist", createdAt: 2, updatedAt: 2 },
          { id: "ship-release", text: "Ship release safely", createdAt: 3, updatedAt: 3 },
          { id: "write-tests", text: "Write tests", createdAt: 4, updatedAt: 4 },
        ],
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(shortcutView) });
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
          { id: "review-changes", text: "Review changes", createdAt: 1, updatedAt: 1 },
          { id: "review-checklist", text: "Review checklist", createdAt: 2, updatedAt: 2 },
          { id: "ship-release", text: "Ship release safely", createdAt: 3, updatedAt: 3 },
        ],
      },
    };
    let commentSendCount = 0;
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(commentShortcutView) });
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

  it("arms the Goal toggle beside attachments and submits the next message as a Goal", async () => {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    let sentBody: Record<string, unknown> | null = null;
    let cleared = false;
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(composerRailView) });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/chat/queue") {
        await route.fulfill({ json: { ok: true, items: [], parked: false } });
      } else if (url.pathname === "/chat/goal" && request.method() === "GET") {
        await route.fulfill({ json: { ok: true, supported: true, goal: null } });
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
      Array.from(row.children as unknown as ArrayLike<{ id: string }>)
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
    expect(sentBody).toMatchObject({ text: "finish and verify this change", goal: true });
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
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
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
      Object.defineProperty(browserGlobal, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(composerRailView) });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/chat/goal") {
        await route.fulfill({ json: { ok: true, supported: true, goal: null } });
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
      { id: "ship-release", text: "Ship release safely", createdAt: 30, updatedAt: 30 },
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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(shortcutView) });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else if (url.pathname === "/vault/ui-state" && request.method() === "POST") {
        const body = request.postDataJSON() as { shortcuts?: typeof initialShortcuts };
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

  it("uses the Tag close control for user-message editing and exits with Escape", async () => {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(composerRailView) });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            { role: "user", text: "Original user message" },
            { role: "assistant", text: "Original response" },
            { role: "user", text: "Later user message" },
            { role: "assistant", text: "Later response" },
          ],
        });
      } else await route.fulfill({ json: { ok: true, items: [] } });
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await expect.poll(() => page.locator("#msgs .msg.user").count()).toBe(2);

    const user = page.locator("#msgs .msg.user").first();
    await page.locator("#h-tags .it-tagadd").click();
    const tagCloseStyle = await page.locator("#h-tags .edit-cancel").evaluate((button) => {
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
    await page.locator("#h-tags .edit-cancel").click();
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
    expect(await user.locator(".inline-edit-save").getAttribute("class")).toContain("fork-action");
    expect(await user.locator(".inline-edit-save").getAttribute("data-vendor")).toBe("claude");
    expect(await user.locator(".inline-edit-save .splitbtn-ico circle").count()).toBe(3);
    await user.locator(".inline-edit-save").focus();
    await page.keyboard.press("Escape");
    await expect.poll(() => user.locator(".inline-edit").count()).toBe(0);
    expect(await user.locator(".bubble").textContent()).toContain("Original user message");

    await user.hover();
    await user.locator(".msg-edit").click();
    await user.locator(".inline-edit-ta").press("Escape");
    await expect.poll(() => user.locator(".inline-edit").count()).toBe(0);
    await page.close();
  });

  it("preserves completed tool status when forking from an edited message", async () => {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(composerRailView) });
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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(raceView) });
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

  it("keeps terminal-style message history and drafts isolated by session", async () => {
    const page = await browser.newPage();
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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
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
        return route.fulfill({ json: { dirs: [{ path: childDir, source: "folder" }] } });
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
      Object.defineProperty(browserGlobal, "EventSource", { value: StubEventSource });
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
          document: { querySelectorAll(selector: string): ArrayLike<BrowserButton> };
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

  it("opens a sidebar comment badge with one click while the composer is focused", async () => {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      const browserGlobal = globalThis as unknown as { EventSource: unknown };
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(browserGlobal, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(commentView) });
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

    const session = page.locator("#list .item", { hasText: "Avoidance session" });
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
    expect(await page.locator("#commentDrawer").isVisible()).toBe(true);
    await page.close();
  });

  it("animates generating comment badges and follows the session status colors", async () => {
    const page = await browser.newPage();
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(commentMotionView) });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [
            { role: "assistant", text: "A comment reply is still generating", tools: [] },
            { role: "assistant", text: "A comment reply is unread", tools: [] },
          ],
        });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const session = page.locator("#list .item", { hasText: "Avoidance session" });
    const sidebarBadge = session.locator(".it-comment.generating");
    await expect.poll(() => sidebarBadge.isVisible()).toBe(true);
    expect(await sidebarBadge.textContent()).toBe("1");
    expect(
      await sidebarBadge.evaluate((badge) => {
        const view = badge.ownerDocument.defaultView;
        if (!view) throw new Error("Missing browser window");
        const icon = view.getComputedStyle(badge, "::before");
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
    expect(await unreadPin.textContent()).toBe("comments");
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

  it("replaces comment history without retaining stale bubbles", async () => {
    const page = await browser.newPage();
    page.setDefaultTimeout(2_000);
    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(commentView) });
      } else if (url.pathname === "/comments/messages") {
        await route.fulfill({
          json: {
            thread: commentView.vaultState?.commentThreads?.["comment-1"],
            messages,
          },
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({
          json: [{ role: "assistant", text: "An answer with an unread comment", tools: [] }],
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
      Object.defineProperty(browserGlobal, "EventSource", { value: StubEventSource });
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
          json: [{ role: "assistant", text: "An answer with an unread comment", tools: [] }],
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(pendingTagView) });
      } else if (url.pathname === "/chat/new") {
        await newSessionGate;
        await route.fulfill({
          json: { ok: true, session: "new-provider-1", cwd: "/tmp/new-project" },
        });
      } else if (url.pathname === "/session/tags") {
        const body = route.request().postDataJSON() as { tags: string[] };
        tagRequests.push({ session: url.searchParams.get("session") ?? "", tags: body.tags });
        await route.fulfill({ json: { ok: true, sessionTags: body.tags, tags: ["work"] } });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    await page.locator("#newToggle").click();
    await page.locator("#np").fill("start pending session");
    await page.locator("#nbtn").click();
    await page.locator("#h-tags .it-tagadd").click();
    const tagEditorGeometry = await page.locator("#h-tags .tagedit").evaluate((editor) => {
      const input = editor.querySelector(".tagedit-input");
      const suggestions = editor.querySelector(".tagsug");
      const close = editor.querySelector(".edit-cancel");
      if (!input || !suggestions || !close) throw new Error("Missing tag editor controls");
      const inputBox = input.getBoundingClientRect();
      const suggestionsBox = suggestions.getBoundingClientRect();
      const closeBox = close.getBoundingClientRect();
      return {
        input: { left: inputBox.left, right: inputBox.right, width: inputBox.width },
        suggestions: {
          left: suggestionsBox.left,
          right: suggestionsBox.right,
          width: suggestionsBox.width,
        },
        close: { left: closeBox.left, right: closeBox.right },
      };
    });
    expect(
      Math.abs(tagEditorGeometry.input.width - tagEditorGeometry.suggestions.width),
    ).toBeLessThan(1);
    expect(
      Math.abs(tagEditorGeometry.input.left - tagEditorGeometry.suggestions.left),
    ).toBeLessThan(1);
    expect(
      Math.abs(tagEditorGeometry.input.right - tagEditorGeometry.suggestions.right),
    ).toBeLessThan(1);
    expect(tagEditorGeometry.close.left).toBeGreaterThan(tagEditorGeometry.input.left);
    expect(tagEditorGeometry.close.right).toBeLessThan(tagEditorGeometry.input.right);
    await page.locator("#h-tags .tagsug-opt", { hasText: "work" }).click();

    expect(await page.locator("#h-tags .it-tag", { hasText: "work" }).count()).toBe(1);
    expect(tagRequests).toEqual([]);

    releaseNewSession();
    await expect.poll(() => tagRequests).toEqual([{ session: "new-provider-1", tags: ["work"] }]);
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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(pendingTagView) });
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
    let forkRequest: { item: string | null; body: Record<string, unknown> } | null = null;
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(composerRailView) });
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
        sessionNotes: {
          s1: [{ id: "note-1", text: "Keep the parent constraint", createdAt: 1, updatedAt: 1 }],
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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(forkContextView) });
      } else if (url.pathname === "/chat/fork") {
        await forkGate;
        await route.fulfill({
          json: { ok: true, session: "fork-provider-1", parentSessionId: "s1" },
        });
      } else if (url.pathname === "/chat/goal") {
        await route.fulfill({ json: { ok: true, supported: true, goal: inheritedGoal } });
      } else if (url.pathname === "/vault/ui-state") {
        uiPatches.push(request.postDataJSON() as Record<string, unknown>);
        await route.fulfill({ json: { ok: true } });
      } else if (url.pathname === "/session/tags") {
        const body = request.postDataJSON() as { tags: string[] };
        tagRequests.push({ session: url.searchParams.get("session") ?? "", tags: body.tags });
        await route.fulfill({ json: { ok: true, sessionTags: body.tags, tags: ["work"] } });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    await page.locator("#list .item", { hasText: "Avoidance session" }).click();
    await page.locator("#input").fill("fork immediately");
    await page.locator("#forkBtn").click();
    await page.locator("#list .item", { hasText: "fork immediately" }).click();
    expect(await page.locator("#railVendor").textContent()).toContain("claude");
    expect(await page.locator("#railModel").textContent()).toContain("Claude Sonnet");
    expect(await page.locator("#railNotes .railbtn-count").textContent()).toBe("1");
    expect(await page.locator("#railTodos .railbtn-count").textContent()).toBe("1");
    expect(await page.locator("#goalToggle").getAttribute("class")).toContain("active");
    await page.locator("#h-tags .it-tagadd").click();
    await page.locator("#h-tags .tagsug-opt", { hasText: "work" }).click();

    expect(await page.locator("#h-tags .it-tag", { hasText: "work" }).count()).toBe(1);
    expect(tagRequests).toEqual([]);

    releaseFork();
    await expect.poll(() => tagRequests).toEqual([{ session: "fork-provider-1", tags: ["work"] }]);
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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(untaggedView) });
      } else if (url.pathname === "/session/tags") {
        const body = route.request().postDataJSON() as { tags: string[] };
        tagWrites.push(body.tags);
        await route.fulfill({ json: { ok: true, sessionTags: body.tags, tags: ["work"] } });
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
    const page = await browser.newPage({ viewport: { width: 480, height: 720 } });
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

  it("opens a resizable middle chats panel driven by the sidebar filters", async () => {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
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
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    expect(await page.locator("#sessionPanel").isHidden()).toBe(true);
    await page.locator("#sessionPanelToggle").click();
    expect(await page.locator("#sessionPanel").isVisible()).toBe(true);
    expect(await page.locator("#sessionPanelToggle").getAttribute("aria-expanded")).toBe("true");
    expect(await page.locator("#sessionPanelList .item").count()).toBe(2);
    expect(await page.locator("#sessionPanel input, #sessionPanel .tagbar").count()).toBe(0);

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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(untaggedView) });
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
    const visibilityWrites: Array<{ hiddenTags?: string[]; pinnedTags?: string[] }> = [];
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(hiddenTagsView) });
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
        globalThis as unknown as { DataTransfer: new () => Record<string, never> }
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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(tagPinView) });
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
      const targetBox = await target.boundingBox();
      if (!targetBox) throw new Error(`missing ${targetName} tag bounds`);
      const transfer = await page.evaluateHandle(() => {
        const BrowserDataTransfer = (
          globalThis as unknown as { DataTransfer: new () => Record<string, never> }
        ).DataTransfer;
        return new BrowserDataTransfer();
      });
      const point = {
        clientX: targetBox.x + (edge === "start" ? 1 : targetBox.width - 2),
        clientY: targetBox.y + targetBox.height / 2,
        dataTransfer: transfer,
      };
      await source.dispatchEvent("dragstart", { dataTransfer: transfer });
      await target.dispatchEvent("dragover", point);
      await target.dispatchEvent("drop", point);
      await transfer.dispose();
    };
    expect(await userOrder()).toEqual(["old", "new", "middle"]);
    expect(await tag("old").getAttribute("class")).toContain("tag-pinned");
    expect(await page.locator("#tagFilters .tag-pin-divider").count()).toBe(1);
    expect(await page.locator("#tagFilters .tag-pin-empty").count()).toBe(0);
    const middleSession = page.locator("#list .item", { hasText: "Middle session" });
    await middleSession.locator(".it-tagadd").click();
    const pinnedBindingOption = middleSession.locator(".tagsug-opt", { hasText: "old" });
    await expect.poll(() => pinnedBindingOption.locator(".tag-option-pin").count()).toBe(1);
    expect(await pinnedBindingOption.getAttribute("aria-label")).toBe("old (pinned)");
    expect(
      await middleSession
        .locator(".tagsug-opt", { hasText: "new" })
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
        globalThis as unknown as { DataTransfer: new () => Record<string, never> }
      ).DataTransfer;
      return new BrowserDataTransfer();
    });
    await tag("middle").dispatchEvent("dragstart", { dataTransfer: pinTransfer });
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
        return { borderStyle: style?.borderStyle, backgroundColor: style?.backgroundColor };
      }),
    ).toEqual(
      expect.objectContaining({ borderStyle: "dashed", backgroundColor: "rgba(0, 0, 0, 0)" }),
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

  it("pins an unpinned tag when dropped in the gap before the pin divider", async () => {
    const page = await browser.newPage();
    const pinWrites: string[][] = [];
    await page.addInitScript(() => {
      localStorage.setItem("attend.tagOrderMode.v1", "recent");
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(tagPinView) });
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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(tagPinView) });
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
        globalThis as unknown as { DataTransfer: new () => Record<string, never> }
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
        tagDragMutationObserver: { observe(node: unknown, options: unknown): void };
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
      if (wrap) browserGlobal.tagDragMutationObserver.observe(wrap, { childList: true });
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
        globalThis as unknown as { tagDragMutationObserver: { disconnect(): void } }
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
        globalThis as unknown as { DataTransfer: new () => Record<string, never> }
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

    await middle.dragTo(newer, { targetPosition: { x: 1, y: newBox.height / 2 } });

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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(untaggedView) });
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
      .toEqual([{ method: "POST", path: "/tags/clear-session-bindings", body: { name: "work" } }]);
    expect(await page.locator("#tagFilters .gtag:not(.auto)").count()).toBe(1);
    expect(await page.locator("#tagFilters .gtag:not(.auto) .gtagcount").textContent()).toBe("0");

    await page.locator("#tagFilters .gtag:not(.auto) .gtagdel").click();
    expect(await page.locator("#tagAction").isVisible()).toBe(true);
    expect(await page.locator("#tagActionClear").isHidden()).toBe(true);
    await page.locator("#tagActionDelete").click();
    await expect
      .poll(() => requests)
      .toEqual([
        { method: "POST", path: "/tags/clear-session-bindings", body: { name: "work" } },
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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(pendingTagView) });
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
      Object.defineProperty(browserGlobal, "EventSource", { value: StubEventSource });
    });
    await page.route("http://attend.test/", (route) =>
      route.fulfill({ contentType: "text/html", body: renderConsole(forkTreeView) }),
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
      const dispatcher = viewport as unknown as { dispatchEvent(event: BrowserWheel): boolean };
      const pan = doc.querySelector("#forkTreePan") as unknown as StyledNode | null;
      const stage = doc.querySelector("#forkTreeStage") as unknown as StyledNode | null;
      if (!pan || !stage) throw new Error("fork tree canvas is missing");
      const snapshot = () => ({ pan: pan.style.transform, stage: stage.style.transform });
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
      Object.defineProperty(browserGlobal, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(raceView) });
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
        data: JSON.stringify({ active: [], startedAt: {}, lastAssistantAt: {}, queues: {} }),
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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(liveView) });
      } else if (url.pathname === "/session/status") {
        const id = url.searchParams.get("session");
        const session = liveSessions.find((candidate) => candidate.sessionId === id);
        await route.fulfill({
          json: {
            ok: true,
            view: session
              ? { ...session, lastTs: 1_000, sortTs: 1_000, unread: false, seen: true }
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
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(raceView) });
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
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent(renderConsole(view), { waitUntil: "domcontentloaded" });
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
      const dispatcher = target as unknown as { dispatchEvent(event: BrowserWheel): boolean };
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
    const page = await browser.newPage({ viewport: { width: 240, height: 480 } });
    await page.setContent(renderConsole(view), { waitUntil: "domcontentloaded" });
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

  it("sizes a collapsed tool call like an assistant text block", async () => {
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent(renderConsole(view), { waitUntil: "domcontentloaded" });
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
