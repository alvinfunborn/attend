import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { expect, it } from "vitest";
import { AnalyzerSettingsStore } from "../src/core/analyzer-settings.js";
import { VaultUiStateStore } from "../src/core/ui-state.js";
import { type ConsoleView, consoleAsset, renderConsoleShell } from "../src/ui/console.js";

it("restores instance settings in a fresh browser and ignores another instance's browser storage", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-instance-browser-"));
  const db = path.join(dir, "state.db");
  const file = path.join(dir, "ui.json");
  const states = ["first", "second"].map((id) => ({
    ui: new VaultUiStateStore(file, `scope:${id}`, db),
    daemon: new AnalyzerSettingsStore(db, [], `scope:${id}`),
  }));
  const browser = await chromium.launch({ headless: true });
  let active = 0;
  const view: ConsoleView = {
    sessions: [],
    knownDirs: [],
    scopeRoots: [],
    defaultNewDir: "",
    changelogMarkdown: "",
    sessions1h: 0,
    prompts1h: 0,
    chars1h: 0,
    vendors: [],
    claudeModels: [],
    codexModels: [],
    cursorModels: [],
    tags: [],
  };
  const [first, second] = states;
  if (!first || !second) throw new Error("Missing instance fixture");
  second.ui.patch({ theme: "light", layout: { sessionPanelColumns: 2 } });
  try {
    // Each context has its own storage, while both instances intentionally use
    // the same browser origin and the same SQLite file.
    for (const fresh of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 1800, height: 900 } });
      await context.addInitScript(() => {
        localStorage.setItem("attend.sessionPanelColumns", "6");
        localStorage.setItem("attend.sessionPanelOpen", "1");
        localStorage.setItem("attend.sessionPanelW", "999");
        localStorage.setItem("attend.sideW", "700");
        class StubEventSource {
          close() {}
        }
        Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
      });
      await context.route("**/*", async (route) => {
        const request = route.request();
        const pathname = new URL(request.url()).pathname;
        const state = states[active];
        if (!state) throw new Error("Missing active instance");
        if (pathname === "/")
          return route.fulfill({
            contentType: "text/html",
            body: renderConsoleShell({
              ...view,
              vaultState: state.ui.get(),
              analyzerSettings: state.daemon.get(),
            }),
          });
        if (pathname.startsWith("/assets/"))
          return route.fulfill({
            contentType: pathname.endsWith(".css") ? "text/css" : "text/javascript",
            body: consoleAsset(pathname.split("/").pop() || "") || "",
          });
        if (pathname === "/vault/ui-state" && request.method() === "POST")
          return route.fulfill({
            json: { ok: true, state: state.ui.patch(request.postDataJSON()) },
          });
        if (pathname === "/analyzer/settings" && request.method() === "POST")
          return route.fulfill({ json: state.daemon.set(request.postDataJSON().mode) });
        return route.fulfill({ json: { ok: true, items: [] } });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(3000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      active = 0;
      await page.goto("http://instance.test/");
      if (!fresh) {
        expect(await page.locator("#sessionPanel").isHidden()).toBe(true);
        await page.locator("#sessionPanelToggle").click();
        await page.locator("#settingsToggle").click();
        await page.locator("#settingsDark").click();
        await page.locator("#settingsColumns").selectOption("3");
        await page.locator("#settingsDaemon").uncheck();
        await expect.poll(() => first.daemon.get().mode).toBe("off");
        await expect
          .poll(() => first.ui.get())
          .toMatchObject({
            theme: "dark",
            layout: { sessionPanelColumns: 3, sessionPanelOpen: true },
          });
      } else {
        expect(await page.locator("#sessionPanel").isVisible()).toBe(true);
        await page.locator("#settingsToggle").click();
      }
      expect(await page.locator("#settingsColumns").inputValue()).toBe("3");
      expect(await page.locator("#settingsDaemon").isChecked()).toBe(false);
      expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
      active = 1;
      await page.reload();
      expect(await page.locator("#sessionPanel").isHidden()).toBe(true);
      await page.locator("#settingsToggle").click();
      expect(await page.locator("#settingsColumns").inputValue()).toBe("2");
      expect(await page.locator("#settingsDaemon").isChecked()).toBe(true);
      expect(await page.locator("html").getAttribute("data-theme")).toBe("light");
      expect(
        await page.locator(".side").evaluate((node) => node.getBoundingClientRect().width),
      ).toBeLessThan(700);
      expect(errors).toEqual([]);
      await context.close();
    }
  } finally {
    await browser.close();
    for (const state of states) state.daemon.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
