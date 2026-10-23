import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AnalyzerSettings } from "../src/core/analyzer-settings.js";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

declare const window: {
  addEventListener(type: string, listener: (event: CustomEvent<string>) => void): void;
  dispatchEvent(event: CustomEvent<string>): boolean;
};

const view: ConsoleView = {
  sessions: [
    {
      vendor: "codex",
      sessionId: "task",
      title: "Task",
      lastPrompt: "Latest request",
      cwd: "/tmp/project",
      project: "project",
      file: "/tmp/task.jsonl",
      ageDays: 0,
      lastTs: 100,
      prompts: 1,
      pattern: "unknown",
      state: "needs_input",
      score: 8,
      reason: "Needs a reply",
      etaMin: 10,
      brief: "Task",
      tags: [],
    },
  ],
  knownDirs: [],
  scopeRoots: [],
  defaultNewDir: "",
  sessions1h: 0,
  prompts1h: 0,
  chars1h: 0,
  vendors: [],
  claudeModels: [],
  codexModels: [],
  cursorModels: [],
  changelogMarkdown: "",
  tags: [],
};

describe("session daemon settings", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });
  afterAll(async () => {
    await browser.close();
  });

  it("persists the switch, hides the entire row on every surface, and restores it when enabled", async () => {
    const page = await browser.newPage({ viewport: { width: 1800, height: 900 } });
    page.setDefaultTimeout(3000);
    let settings: AnalyzerSettings = { mode: "follow", revision: 1 };
    const modes: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      class StubEventSource {
        onmessage?: (event: { data: string }) => void;
        constructor() {
          window.addEventListener("test-live", (event) =>
            this.onmessage?.({ data: (event as CustomEvent).detail }),
          );
        }
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname;
      if (pathname === "/")
        return route.fulfill({
          contentType: "text/html",
          body: renderConsole({ ...view, analyzerSettings: settings }),
        });
      if (pathname === "/analyzer/settings") {
        if (req.method() === "POST") {
          const mode = req.postDataJSON().mode;
          modes.push(mode);
          settings = { mode, revision: settings.revision + 1 };
        }
        return route.fulfill({ json: settings });
      }
      if (pathname === "/chat/messages")
        return route.fulfill({ json: { messages: [], hasMore: false } });
      return route.fulfill({ json: { ok: true } });
    });
    try {
      await page.goto("http://attend.test/");
      await page.locator('#list .item[data-session-id="task"]').click();
      await expect.poll(() => page.locator("#h-sig .prilabel").count()).toBe(1);
      if (!(await page.locator("#sessionPanel").isVisible()))
        await page.locator("#sessionPanelToggle").click();
      await expect.poll(() => page.locator("#sessionPanelList .it-meta").count()).toBe(1);
      await page.locator("#settingsToggle").click();
      expect(await page.locator("#settingsDaemon").isChecked()).toBe(true);
      await page.locator("#settingsDaemon").click();
      await expect.poll(() => settings.mode).toBe("off");
      await expect
        .poll(() => page.locator("#list .it-meta, #sessionPanelList .it-meta").count())
        .toBe(0);
      await expect.poll(() => page.locator("#h-sig").isVisible()).toBe(false);
      expect(await page.locator("#priorityTag").count()).toBe(0);
      await page.reload();
      await page.locator("#settingsToggle").click();
      expect(await page.locator("#settingsDaemon").isChecked()).toBe(false);
      expect(await page.locator("#list .it-meta").count()).toBe(0);
      await page.locator("#settingsDaemon").click();
      await expect.poll(() => settings.mode).toBe("economical");
      await expect.poll(() => page.locator("#list .it-meta .prilabel").count()).toBe(1);
      expect(modes).toEqual(["off", "economical"]);
      // Another client changes the server setting; the live snapshot updates this tab.
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("test-live", {
            detail: JSON.stringify({ active: [], analyzerSettings: { mode: "off", revision: 4 } }),
          }),
        ),
      );
      await expect.poll(() => page.locator("#settingsDaemon").isChecked()).toBe(false);
      expect(await page.locator("#list .it-meta").count()).toBe(0);
      // An older live snapshot cannot undo the newer setting.
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("test-live", {
            detail: JSON.stringify({
              active: [],
              analyzerSettings: { mode: "follow", revision: 2 },
            }),
          }),
        ),
      );
      expect(await page.locator("#settingsDaemon").isChecked()).toBe(false);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it("keeps the saved setting and rows if saving fails", async () => {
    const page = await browser.newPage();
    page.setDefaultTimeout(3000);
    await page.addInitScript(() => {
      Object.defineProperty(globalThis, "EventSource", {
        value: class {
          close() {}
        },
      });
    });
    await page.route("**/*", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === "/")
        return route.fulfill({ contentType: "text/html", body: renderConsole(view) });
      if (pathname === "/analyzer/settings")
        return route.fulfill({ status: 500, json: { error: "Failed" } });
      return route.fulfill({ json: { ok: true } });
    });
    try {
      await page.goto("http://attend.test/");
      await page.locator("#settingsToggle").click();
      await page.locator("#settingsDaemon").click();
      await expect
        .poll(() => page.locator("#settingsDaemonStatus").textContent())
        .toBe("Could not save. Try again.");
      expect(await page.locator("#settingsDaemon").isChecked()).toBe(true);
      expect(await page.locator("#settingsDaemon").isEnabled()).toBe(true);
      expect(await page.locator("#list .it-meta .prilabel").count()).toBe(1);
    } finally {
      await page.close();
    }
  });
});
