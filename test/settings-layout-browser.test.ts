import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ConsoleView, consoleAsset, renderConsoleShell } from "../src/ui/console.js";

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  await browser.close();
});

describe("settings layout", () => {
  it.each(["light", "dark"] as const)(
    "keeps grouped controls, dialog actions, and keyboard access usable in %s mode",
    async (theme) => {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      page.setDefaultTimeout(3000);
      const state: ConsoleView = {
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
        vaultState: {
          theme,
          customThemes: Object.fromEntries(
            Array.from({ length: 12 }, (_, index) => [
              `custom-${index}`,
              {
                name: `Custom theme ${index}`,
                type: theme,
                colors: { background: "#123456", foreground: "#abcdef" },
              },
            ]),
          ),
        },
      };
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        class StubEventSource {
          static readonly CLOSED = 2;
          close() {}
        }
        Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
      });
      await page.route("**/*", (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (path === "/")
          return route.fulfill({ contentType: "text/html", body: renderConsoleShell(state) });
        if (path.startsWith("/assets/"))
          return route.fulfill({
            contentType: path.endsWith(".css") ? "text/css" : "text/javascript",
            body: consoleAsset(path.split("/").pop() || "") || "",
          });
        if (path === "/vault/ui-state" && request.method() === "POST")
          state.vaultState = { ...state.vaultState, ...request.postDataJSON() };
        return route.fulfill({ json: { ok: true } });
      });
      try {
        await page.goto("http://settings.test/");
        await page.getByRole("button", { name: "Settings", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
        expect((await dialog.boundingBox())?.width).toBeGreaterThanOrEqual(900);
        for (const name of ["Appearance", "Session layout", "Background analysis"])
          expect(await dialog.getByRole("region", { name }).count()).toBe(1);
        expect(
          await dialog
            .locator('[data-theme-id="custom-0"] .settings-theme-preview')
            .evaluate(
              (node) => node.ownerDocument.defaultView?.getComputedStyle(node).backgroundColor,
            ),
        ).toBe("rgb(18, 52, 86)");
        expect(
          await dialog
            .locator('[data-theme-id="custom-0"] .settings-theme-preview-side > span:nth-child(2)')
            .evaluate(
              (node) => node.ownerDocument.defaultView?.getComputedStyle(node).backgroundColor,
            ),
        ).toBe("rgb(171, 205, 239)");
        expect(await dialog.locator('[role="radio"][tabindex="0"]').count()).toBe(1);
        await page.locator("#settingsLight").press("ArrowDown");
        await expect.poll(() => state.vaultState?.theme).toBe("dark");
        await expect
          .poll(() => page.locator("#settingsDark").evaluate((node) => node.matches(":focus")))
          .toBe(true);
        expect(await page.locator("#themeDelete").isHidden()).toBe(true);

        for (const viewport of [
          { width: 1440, height: 900 },
          { width: 390, height: 844 },
          { width: 844, height: 390 },
          { width: 320, height: 568 },
        ]) {
          await page.setViewportSize(viewport);
          const bounds = await dialog.boundingBox();
          if (!bounds) throw new Error("Settings dialog is missing");
          expect(bounds.x).toBeGreaterThanOrEqual(0);
          expect(bounds.y).toBeGreaterThanOrEqual(0);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
          expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
          expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
          const header = await dialog.locator(".settings-head").boundingBox();
          const footer = await dialog.locator(".settings-footer").boundingBox();
          await dialog.locator(".settings-body").evaluate((node) => {
            node.scrollTop = node.scrollHeight;
          });
          expect(await dialog.locator(".settings-head").boundingBox()).toEqual(header);
          expect(await dialog.locator(".settings-footer").boundingBox()).toEqual(footer);
          await page.getByLabel("Middle panel columns", { exact: true }).selectOption("custom");
          const customColumns = page.getByLabel("Custom columns", { exact: true });
          expect(await customColumns.evaluate((node) => node.matches(":focus"))).toBe(true);
          await customColumns.fill("0");
          expect(await customColumns.getAttribute("aria-invalid")).toBe("true");
          expect(await page.locator("#settingsCustomColumnsNote").textContent()).toContain(
            "previous column count is unchanged",
          );
          await customColumns.fill("8");
          expect(await customColumns.getAttribute("aria-invalid")).toBe("false");
          await page.getByLabel("Middle panel columns", { exact: true }).selectOption("auto");
        }
        await page.getByRole("button", { name: "Done", exact: true }).click();
        expect(await dialog.isVisible()).toBe(false);
        expect(
          await page.locator("#settingsToggle").evaluate((node) => node.matches(":focus")),
        ).toBe(true);
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
  );
});
