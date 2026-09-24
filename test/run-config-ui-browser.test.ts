import { type Browser, type Page, type Request, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

// Effort/model/speed belong to one session, but the rail used to read them from
// two places: the button from the session's own config, the menu from a staged
// pick that nothing ever cleared (falling back to the globally remembered "last
// used" tuple). Opening a tab could therefore show one tier on the button and
// mark a different one as "current" inside the menu.
const view: ConsoleView = {
  sessions: [
    {
      vendor: "claude",
      sessionId: "s-high",
      title: "High effort session",
      lastPrompt: "hello",
      cwd: "/tmp/project",
      project: "project",
      file: "/tmp/s-high.jsonl",
      ageDays: 0,
      lastTs: 300,
      prompts: 1,
      pattern: "unknown",
      score: 0,
      reason: "",
      etaMin: 0,
      state: null,
      brief: "High effort session",
      tags: [],
      model: "claude-sonnet",
      effort: "high",
    },
    {
      vendor: "claude",
      sessionId: "s-low",
      title: "Low effort session",
      lastPrompt: "hello",
      cwd: "/tmp/project",
      project: "project",
      file: "/tmp/s-low.jsonl",
      ageDays: 0,
      lastTs: 200,
      prompts: 1,
      pattern: "unknown",
      score: 0,
      reason: "",
      etaMin: 0,
      state: null,
      brief: "Low effort session",
      tags: [],
      model: "claude-sonnet",
      effort: "low",
    },
    {
      vendor: "claude",
      sessionId: "s-unknown",
      title: "Never configured session",
      lastPrompt: "hello",
      cwd: "/tmp/project",
      project: "project",
      file: "/tmp/s-unknown.jsonl",
      ageDays: 0,
      lastTs: 100,
      prompts: 1,
      pattern: "unknown",
      score: 0,
      reason: "",
      etaMin: 0,
      state: null,
      brief: "Never configured session",
      tags: [],
    },
  ],
  knownDirs: ["/tmp/project"],
  scopeRoots: ["/tmp/project"],
  defaultNewDir: "/tmp/project",
  changelogMarkdown: "",
  sessions1h: 0,
  prompts1h: 0,
  chars1h: 0,
  vendors: [{ vendor: "claude", available: true, chat: true }],
  claudeModels: [
    {
      value: "claude-sonnet",
      label: "Claude Sonnet",
      efforts: ["low", "high", "xhigh"],
      defaultEffort: "high",
    },
  ],
  codexModels: [],
  cursorModels: [],
  modelDefaults: { claude: { model: "claude-sonnet", effort: "high", speed: "" } },
  tags: [],
  sessionIndexEpoch: "run-config-epoch",
  sessionIndexRevision: 0,
};

const openConsole = async (
  browser: Browser,
  onRequest?: (request: Request) => void,
  consoleView: ConsoleView = view,
): Promise<Page> => {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const browserGlobal = globalThis as unknown as Record<string, unknown>;
    class StubEventSource {
      static readonly CLOSED = 2;
      onmessage: ((event: { data: string }) => void) | null = null;
      constructor() {
        browserGlobal.__runConfigEventSource = this;
      }
      close() {}
    }
    Object.defineProperty(browserGlobal, "EventSource", { value: StubEventSource });
  });
  await page.route("**/*", async (route) => {
    onRequest?.(route.request());
    const url = new URL(route.request().url());
    if (url.pathname === "/") {
      await route.fulfill({ contentType: "text/html", body: renderConsole(consoleView) });
    } else if (url.pathname === "/models/claude") {
      await route.fulfill({
        json: {
          models: consoleView.claudeModels,
          defaults: consoleView.modelDefaults?.claude,
          warning: null,
        },
      });
    } else if (url.pathname === "/chat/messages") {
      await route.fulfill({ json: [] });
    } else {
      await route.fulfill({ json: { ok: true, items: [] } });
    }
  });
  await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
  return page;
};

const railEffort = (page: Page) => page.locator("#railEffort .railbtn-value");
const markedCurrent = (page: Page) =>
  page.locator("#composerRailPop .rail-option.on .rail-option-label");

/**
 * What the menu marks as this session's current tier — "" when it marks none.
 * The CLI default option carries a "(default)" suffix that is not part of the value.
 */
const menuCurrentEffort = async (page: Page): Promise<string> => {
  await page.locator("#railEffort").click();
  const count = await markedCurrent(page).count();
  const label = count ? ((await markedCurrent(page).textContent()) ?? "") : "";
  await page.locator("#railEffort").click();
  return label.replace(" (default)", "").trim();
};

describe("per-session run config in the composer rail", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("shows each session's own effort on both the button and the menu", async () => {
    const page = await openConsole(browser);
    try {
      await page.locator("#list .item", { hasText: "High effort session" }).click();
      expect(await railEffort(page).textContent()).toBe("high");
      expect(await menuCurrentEffort(page)).toBe("high");

      // Switching tabs must not carry the previous session's tier along.
      await page.locator("#list .item", { hasText: "Low effort session" }).click();
      expect(await railEffort(page).textContent()).toBe("low");
      expect(await menuCurrentEffort(page)).toBe("low");

      await page.locator("#list .item", { hasText: "High effort session" }).click();
      expect(await railEffort(page).textContent()).toBe("high");
      expect(await menuCurrentEffort(page)).toBe("high");
    } finally {
      await page.close();
    }
  });

  it("reports an unrecorded effort as unknown instead of borrowing the last used one", async () => {
    const page = await openConsole(browser);
    try {
      // Send from a configured session first: that is what seeds the global
      // "last used" memory the unknown session must not inherit.
      await page.locator("#list .item", { hasText: "Low effort session" }).click();
      await page.locator("#input").fill("run it");
      await page.locator("#send").click();

      await page.locator("#list .item", { hasText: "Never configured session" }).click();
      expect(await railEffort(page).textContent()).toBe("unknown");
      // Nothing is truthfully "current" here, so nothing is marked.
      expect(await menuCurrentEffort(page)).toBe("");
    } finally {
      await page.close();
    }
  });

  it("retires a staged pick once the scan restates the session's config", async () => {
    const page = await openConsole(browser);
    try {
      await page.locator("#list .item", { hasText: "High effort session" }).click();
      await page.locator("#railEffort").click();
      await page.locator(".rail-option", { hasText: "xhigh" }).click();
      expect(await railEffort(page).textContent()).toBe("xhigh");
      expect(await menuCurrentEffort(page)).toBe("xhigh");

      await page.locator("#input").fill("run it");
      await page.locator("#send").click();

      // The provider ran the turn at "low"; the scan says so authoritatively.
      // The staged "xhigh" is spent — the menu must not keep offering it as
      // current while the button already shows what actually ran.
      await page.evaluate(() => {
        const source = (globalThis as unknown as Record<string, unknown>)
          .__runConfigEventSource as { onmessage: ((event: { data: string }) => void) | null };
        source.onmessage?.({
          data: JSON.stringify({
            kind: "session_index",
            epoch: "run-config-epoch",
            revision: 1,
            pending: false,
            sessions: [
              {
                vendor: "claude",
                sessionId: "s-high",
                title: "High effort session",
                lastPrompt: "run it",
                cwd: "/tmp/project",
                project: "project",
                file: "/tmp/s-high.jsonl",
                ageDays: 0,
                lastTs: 400,
                prompts: 2,
                pattern: "unknown",
                score: 0,
                reason: "",
                etaMin: 0,
                state: null,
                brief: "High effort session",
                tags: [],
                model: "claude-sonnet",
                effort: "low",
              },
            ],
            knownDirs: ["/tmp/project"],
            defaultNewDir: "/tmp/project",
            tags: [],
            sessions1h: 0,
            prompts1h: 0,
            chars1h: 0,
          }),
        });
      });

      await expect.poll(() => railEffort(page).textContent()).toBe("low");
      expect(await menuCurrentEffort(page)).toBe("low");
    } finally {
      await page.close();
    }
  });

  it("sends the staged effort when an older session index arrives before send", async () => {
    let sentBody: Record<string, unknown> | null = null;
    const page = await openConsole(browser, (request) => {
      if (new URL(request.url()).pathname === "/chat/send") {
        sentBody = request.postDataJSON() as Record<string, unknown>;
      }
    });
    try {
      await page.locator("#list .item", { hasText: "High effort session" }).click();
      await page.locator("#railEffort").click();
      await page.locator(".rail-option", { hasText: "xhigh" }).click();

      // The provider index still contains the configuration from the previous
      // turn. It may refresh while the user is typing after choosing xhigh.
      await page.evaluate(() => {
        const source = (globalThis as unknown as Record<string, unknown>)
          .__runConfigEventSource as { onmessage: ((event: { data: string }) => void) | null };
        source.onmessage?.({
          data: JSON.stringify({
            kind: "session_index",
            epoch: "run-config-epoch",
            revision: 1,
            pending: false,
            sessions: [
              {
                vendor: "claude",
                sessionId: "s-high",
                title: "High effort session",
                lastPrompt: "hello",
                cwd: "/tmp/project",
                project: "project",
                file: "/tmp/s-high.jsonl",
                ageDays: 0,
                lastTs: 350,
                prompts: 1,
                pattern: "unknown",
                score: 0,
                reason: "",
                etaMin: 0,
                state: null,
                brief: "High effort session",
                tags: [],
                model: "claude-sonnet",
                effort: "high",
              },
            ],
            knownDirs: ["/tmp/project"],
            defaultNewDir: "/tmp/project",
            tags: [],
            sessions1h: 0,
            prompts1h: 0,
            chars1h: 0,
          }),
        });
      });

      // The staged selection remains what the rail shows and what Send must use.
      expect(await railEffort(page).textContent()).toBe("xhigh");
      await page.locator("#input").fill("run it with the staged effort");
      await page.locator("#send").click();
      await expect
        .poll(() => sentBody)
        .toMatchObject({
          runConfig: true,
          model: "claude-sonnet",
          effort: "xhigh",
        });
    } finally {
      await page.close();
    }
  });

  it("opens the effort picker for trailing /effort or /e commands and removes only the command", async () => {
    let sends = 0;
    const page = await openConsole(browser, (request) => {
      if (new URL(request.url()).pathname === "/chat/send") sends += 1;
    });
    try {
      await page.locator("#list .item", { hasText: "High effort session" }).click();
      const input = page.locator("#input");
      await input.pressSequentially("Keep this draft /effort");

      expect(await input.inputValue()).toBe("Keep this draft /effort");
      expect(await page.locator("#composerRailPop").isHidden()).toBe(true);

      await input.press("Space");

      await expect.poll(() => input.inputValue()).toBe("Keep this draft ");
      expect(await page.locator("#composerRailPop").isVisible()).toBe(true);
      expect(await page.locator("#railEffort").getAttribute("aria-expanded")).toBe("true");
      expect(await page.locator("#composerRailPop .rail-option-label").allTextContents()).toEqual([
        "low",
        "high (default)",
        "xhigh",
      ]);
      expect(
        await page
          .locator('#composerRailPop .rail-option[aria-current="true"] .rail-option-label')
          .textContent(),
      ).toBe("high (default)");
      expect(
        await page.locator("#composerRailPop .rail-option:focus .rail-option-label").textContent(),
      ).toBe("high (default)");

      await page.keyboard.press("ArrowDown");
      expect(
        await page.locator("#composerRailPop .rail-option:focus .rail-option-label").textContent(),
      ).toBe("xhigh");
      await page.keyboard.press("Enter");

      expect(await railEffort(page).textContent()).toBe("xhigh");
      expect(await page.locator("#composerRailPop").isHidden()).toBe(true);
      expect(await input.evaluate((node) => node.ownerDocument.activeElement === node)).toBe(true);

      await input.pressSequentially("/e");
      await input.press("Space");
      await expect.poll(() => input.inputValue()).toBe("Keep this draft ");
      expect(
        await page.locator("#composerRailPop .rail-option:focus .rail-option-label").textContent(),
      ).toBe("xhigh");
      await page.keyboard.press("ArrowUp");
      expect(
        await page.locator("#composerRailPop .rail-option:focus .rail-option-label").textContent(),
      ).toBe("high (default)");
      await page.keyboard.press("Escape");

      expect(await page.locator("#composerRailPop").isHidden()).toBe(true);
      expect(await input.evaluate((node) => node.ownerDocument.activeElement === node)).toBe(true);
      expect(await railEffort(page).textContent()).toBe("xhigh");
      expect(sends).toBe(0);
    } finally {
      await page.close();
    }
  });
  it("opens model/vendor pickers and selects case-insensitive configuration prefixes", async () => {
    const requests: string[] = [];
    const page = await openConsole(
      browser,
      (request) => {
        if (request.method() === "POST") requests.push(new URL(request.url()).pathname);
      },
      {
        ...view,
        vendors: (["claude", "codex", "cursor"] as const).map((vendor) => ({
          vendor,
          available: true,
          chat: true,
        })),
        codexModels: [
          {
            value: "gpt-6-mini",
            label: "GPT-6 Mini",
            efforts: ["low", "medium", "high", "xhigh", "max", "ultra"],
          },
          {
            value: "gpt-6",
            label: "GPT-6",
            efforts: ["low", "medium", "high", "xhigh", "max", "ultra"],
          },
        ],
      },
    );
    try {
      await page.locator("#list .item", { hasText: "High effort session" }).click();
      const input = page.locator("#input");
      for (const [command, rail] of [
        ["M", "Model"],
        ["model", "Model"],
        ["V", "Vendor"],
        ["vendor", "Vendor"],
      ]) {
        await input.fill(`Draft /${command} `);
        expect(await input.inputValue()).toBe("Draft ");
        expect(await page.locator(`#rail${rail}`).getAttribute("aria-expanded")).toBe("true");
        await page.keyboard.press("Escape");
      }
      for (const [command, select, value] of [
        ["Lo", "reffort", "low"],
        ["XHIGH", "reffort", "xhigh"],
        ["CuR", "rvendor", "cursor"],
        ["CLAUDE", "rvendor", "claude"],
        ["CoDeX", "rvendor", "codex"],
        ["GPT-6", "rmodel", "gpt-6"],
        ["gpt-6-m", "rmodel", "gpt-6-mini"],
        ...["low", "medium", "high", "xhigh", "max", "ultra"].map((effort) => [
          effort.toUpperCase(),
          "reffort",
          effort,
        ]),
      ]) {
        await input.fill(`Draft /${command} `);
        expect(await input.inputValue()).toBe("Draft ");
        expect(await page.locator(`#${select}`).inputValue()).toBe(value);
        expect(await page.locator("#composerRailPop").isHidden()).toBe(true);
      }
      // Every command follows the same rule: the slash needs no leading space.
      await input.fill("Draft/e ");
      expect(await input.inputValue()).toBe("Draft");
      expect(await page.locator("#railEffort").getAttribute("aria-expanded")).toBe("true");
      await page.keyboard.press("Escape");

      await input.fill("Draft/high ");
      expect(await input.inputValue()).toBe("Draft");
      expect(await page.locator("#reffort").inputValue()).toBe("high");

      // Only a slash directly after another slash (a URL) stays untouched.
      for (const text of ["Draft /unknown ", "https://codex ", "/high"]) {
        await input.fill(text);
        expect(await input.inputValue()).toBe(text);
      }
      expect(requests.filter((path) => path === "/chat/send" || path === "/chat/fork")).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
