import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

// The rail menu lists efforts computed live from the model catalog, but a pick is
// handed to the engine by assigning it onto the hidden #reffort/#rmodel <select>.
// Those selects are populated ONCE (openComposerRail only calls
// populateRunConfigControls when #rvendor has no options yet), and a late
// /models/claude response only re-populates them while the panel happens to be
// open. So the menu can offer a tier the select has no <option> for — and
// assigning an absent value to a <select> silently yields "". applyRunConfig then
// reads "" back out of the DOM and writes it onto the session as its real config.
const view: ConsoleView = {
  sessions: [
    {
      vendor: "claude",
      sessionId: "s-1",
      title: "Configured session",
      lastPrompt: "hello",
      cwd: "/tmp/project",
      project: "project",
      file: "/tmp/s-1.jsonl",
      ageDays: 0,
      lastTs: 300,
      prompts: 1,
      pattern: "unknown",
      score: 0,
      reason: "",
      etaMin: 0,
      state: null,
      brief: "Configured session",
      tags: [],
      model: "claude-sonnet",
      effort: "high",
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
  // Server-rendered catalog is empty: the first scan had not resolved Claude's
  // model list yet. This is the ordinary cold-start shape, not a contrived one.
  claudeModels: [],
  codexModels: [],
  cursorModels: [],
  modelDefaults: {},
  tags: [],
  sessionIndexEpoch: "stale-select-epoch",
  sessionIndexRevision: 0,
};

// The catalog that lands after the page is already interactive.
const lateModels = [
  {
    value: "claude-sonnet",
    label: "Claude Sonnet",
    efforts: ["low", "high", "max"],
    defaultEffort: "high",
  },
];

const railValue = (page: Page, id: string) => page.locator(`#${id} .railbtn-value`);

describe("composer rail vs. the hidden run-config selects", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("keeps the session's config when picking an effort the stale select lacks", async () => {
    const page = await browser.newPage();
    let releaseModels: () => void = () => {};
    const modelsGate = new Promise<void>((resolve) => {
      releaseModels = resolve;
    });

    await page.addInitScript(() => {
      class StubEventSource {
        static readonly CLOSED = 2;
        onmessage: ((event: { data: string }) => void) | null = null;
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(view) });
      } else if (url.pathname === "/models/claude") {
        // Hold the catalog until the hidden selects have been populated empty.
        await modelsGate;
        await route.fulfill({ json: { models: lateModels, defaults: {}, warning: null } });
      } else if (url.pathname === "/chat/messages") {
        await route.fulfill({ json: [] });
      } else {
        await route.fulfill({ json: { ok: true, items: [] } });
      }
    });

    try {
      await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
      await page.locator("#list .item", { hasText: "Configured session" }).click();

      // The session's own config is what the rail reports.
      expect(await railValue(page, "railModel").textContent()).toBe("claude-sonnet");
      expect(await railValue(page, "railEffort").textContent()).toBe("high");

      // Opening the rail once seeds #rvendor, which permanently disables the only
      // populate path — the hidden #rmodel/#reffort are filled from the EMPTY catalog.
      await page.locator("#railEffort").click();
      await page.locator("#railEffort").click();

      // Catalog arrives with the panel closed, so the selects are never refreshed.
      const delivered = page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/models/claude",
      );
      releaseModels();
      await delivered;
      await page.waitForTimeout(50);

      // The menu now offers max, computed live from the fresh catalog.
      await page.locator("#railEffort").click();
      expect(await page.locator(".rail-option", { hasText: "max" }).count()).toBe(1);
      await page.locator(".rail-option", { hasText: "max" }).click();

      // Picking max must select max — and must not destroy the model alongside it.
      // The model now renders under its catalog label, the catalog having landed.
      expect({
        effort: await railValue(page, "railEffort").textContent(),
        model: await railValue(page, "railModel").textContent(),
      }).toEqual({ effort: "max", model: "Claude Sonnet" });
    } finally {
      await page.close();
    }
  });
});
