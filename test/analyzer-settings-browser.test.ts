import { chromium } from "playwright";
import { expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";
const view: ConsoleView = {
  sessions: [],
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
it("shows legacy mode and saves economical/off without changing work session settings", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let mode = "legacy_vendor_default";
    const writes: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(globalThis, "EventSource", {
        value: class {
          close() {}
        },
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/")
        return route.fulfill({ contentType: "text/html", body: renderConsole(view) });
      if (route.request().method() === "POST") writes.push(url.pathname);
      if (url.pathname === "/analyzer/settings") {
        if (route.request().method() === "POST") mode = route.request().postDataJSON().mode;
        return route.fulfill({ json: { mode, revision: writes.length } });
      }
      return route.fulfill({ json: { ok: true, items: [], models: [] } });
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
    const select = page.locator("#analyzerMode");
    await expect.poll(() => select.isEnabled()).toBe(true);
    expect(await select.inputValue()).toBe("legacy_vendor_default");
    await page.locator(".analyzer-settings summary").click();
    await select.selectOption("economical");
    await expect.poll(() => select.isEnabled()).toBe(true);
    expect(await page.locator("#analyzerModeHelp").textContent()).toContain("same provider");
    await select.selectOption("off");
    await expect.poll(() => select.isEnabled()).toBe(true);
    expect(await page.locator("#analyzerModeHelp").textContent()).toContain(
      "No new background AI calls",
    );
    expect(writes.filter((url) => url !== "/vault/ui-state")).toEqual([
      "/analyzer/settings",
      "/analyzer/settings",
    ]);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
