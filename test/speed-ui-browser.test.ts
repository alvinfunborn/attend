import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

const view: ConsoleView = {
  sessions: [
    {
      vendor: "claude",
      sessionId: "no-speed-session",
      title: "No speed session",
      lastPrompt: "hello",
      cwd: "/tmp/project",
      project: "project",
      file: "/tmp/no-speed.jsonl",
      ageDays: 0,
      lastTs: 1,
      prompts: 1,
      pattern: "unknown",
      score: 0,
      reason: "",
      etaMin: 0,
      state: null,
      brief: "No speed session",
      tags: [],
      model: "claude-haiku",
      effort: "high",
    },
    {
      vendor: "claude",
      sessionId: "unknown-config-session",
      title: "Unknown historical config",
      lastPrompt: "hello",
      cwd: "/tmp/project",
      project: "project",
      file: "/tmp/unknown-config.jsonl",
      ageDays: 0,
      lastTs: 0,
      prompts: 1,
      pattern: "unknown",
      score: 0,
      reason: "",
      etaMin: 0,
      state: null,
      brief: "Unknown historical config",
      tags: [],
      model: "claude-sonnet",
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
      value: "claude-haiku",
      label: "Claude Haiku",
      efforts: ["high"],
      defaultEffort: "high",
    },
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
  codexModels: [],
  cursorModels: [],
  modelDefaults: {
    claude: { model: "claude-haiku", effort: "high", speed: "" },
  },
  tags: [],
};

describe("optional Speed controls", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("keeps Speed visible but disabled when the model has no speed options", async () => {
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
        await route.fulfill({ contentType: "text/html", body: renderConsole(view) });
      } else if (url.pathname === "/models/claude") {
        await route.fulfill({
          json: {
            models: view.claudeModels,
            defaults: view.modelDefaults?.claude,
            warning: null,
          },
        });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    await page.locator("#list .item", { hasText: "No speed session" }).click();

    expect(await page.locator("#railSpeed").isVisible()).toBe(true);
    expect(await page.locator("#railSpeed").isDisabled()).toBe(true);
    expect(await page.locator("#railSpeed .railbtn-value").textContent()).toBe("—");

    await page.locator("#newToggle").click();
    const newSpeedButton = page.locator("#nspeed + .selectwrap .selectbtn");
    expect(await newSpeedButton.isVisible()).toBe(true);
    expect(await newSpeedButton.isDisabled()).toBe(true);
    expect(await newSpeedButton.textContent()).toBe("—");

    await page.locator("#nmodel").selectOption("claude-sonnet");
    expect(await newSpeedButton.isEnabled()).toBe(true);
    expect(await newSpeedButton.textContent()).toContain("Standard");

    await page.locator("#nmodel").selectOption("claude-haiku");
    expect(await newSpeedButton.isDisabled()).toBe(true);
    expect(await newSpeedButton.textContent()).toBe("—");

    await page.locator("#newClose").click();
    await page.locator("#list .item", { hasText: "Unknown historical config" }).click();
    expect((await page.locator("#railEffort").textContent())?.toLowerCase()).toContain("unknown");
    expect((await page.locator("#railSpeed").textContent())?.toLowerCase()).toContain("unknown");
    expect(await page.locator("#railEffort").textContent()).not.toContain("High");
    expect(await page.locator("#railSpeed").textContent()).not.toContain("Standard");
    await page.close();
  });
});
