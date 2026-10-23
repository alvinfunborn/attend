import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { THEME_COLORS } from "../src/core/theme-colors.js";
import { themeEngine } from "../src/core/themes.js";
import {
  type ConsoleView,
  consoleAsset,
  renderConsole,
  renderConsoleShell,
} from "../src/ui/console.js";

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
let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  await browser.close();
});

describe("theme settings", () => {
  it("previews, cancels, saves, reloads, edits, imports, exports and deletes custom themes", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(3000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const state: ConsoleView = { ...view, vaultState: { theme: "light" } };
    let writes = 0;
    let failSave = false;
    await page.route("**/*", async (route) => {
      const req = route.request();
      if (new URL(req.url()).pathname === "/")
        return route.fulfill({ contentType: "text/html", body: renderConsoleShell(state) });
      if (new URL(req.url()).pathname.startsWith("/assets/"))
        return route.fulfill({
          contentType: req.url().endsWith(".css") ? "text/css" : "text/javascript",
          body: consoleAsset(new URL(req.url()).pathname.split("/").pop() || "") || "",
        });
      if (req.url().includes("/vault/ui-state") && req.method() === "POST") {
        writes++;
        if (failSave) return route.fulfill({ status: 500, json: { error: "failure" } });
        const patch = req.postDataJSON();
        state.vaultState ??= {};
        state.vaultState.customThemes ??= {};
        if (patch.theme) state.vaultState.theme = patch.theme;
        for (const [id, theme] of Object.entries(patch.customThemes || {})) {
          if (theme === null) delete state.vaultState.customThemes[id];
          else state.vaultState.customThemes[id] = theme as never;
        }
      }
      return route.fulfill({ json: { ok: true } });
    });
    try {
      await page.goto("http://theme.test/");
      await page.locator("#settingsToggle").click();
      await page.locator("#themeCopy").click();
      expect((await page.locator("#themeEditorPanel").boundingBox())?.width).toBeGreaterThan(800);
      const custom = {
        name: "Midnight",
        type: "dark",
        colors: {
          background: "#102030",
          foreground: "#eeeeee",
          "chat.user.background": "#334455",
          "diff.added.background": "#123412",
        },
      };
      await page.locator("#themeJson").fill(JSON.stringify(custom));
      expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
      expect(
        await page
          .locator("body")
          .evaluate(
            (node) => node.ownerDocument.defaultView?.getComputedStyle(node).backgroundColor,
          ),
      ).toBe("rgb(16, 32, 48)");
      expect(
        await page
          .locator(".side")
          .evaluate(
            (node) => node.ownerDocument.defaultView?.getComputedStyle(node).backgroundColor,
          ),
      ).toBe("rgb(16, 32, 48)");
      expect(writes).toBe(0);
      await page.locator("#themeJson").fill("{");
      expect(await page.locator("#themeSave").isDisabled()).toBe(true);
      expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
      await page.locator("#themeCancel").click();
      expect(await page.locator("html").getAttribute("data-theme")).toBe("light");
      expect(writes).toBe(0);
      await page.locator("#themeCopy").click();
      await page.locator("#themeJson").fill(JSON.stringify(custom));
      await page.locator("#themeSave").click();
      await expect.poll(() => page.locator("#themeEditorPanel").isVisible()).toBe(false);
      const id = state.vaultState?.theme;
      expect(id).toMatch(/^theme-/);
      await page.reload();
      expect(await page.locator("html").getAttribute("data-theme-id")).toBe(id);
      expect(
        await page
          .locator("body")
          .evaluate(
            (node) => node.ownerDocument.defaultView?.getComputedStyle(node).backgroundColor,
          ),
      ).toBe("rgb(16, 32, 48)");
      await page.locator("#settingsToggle").click();
      await page.locator("#themeEdit").click();
      await page
        .locator("#themeJson")
        .fill(JSON.stringify({ ...custom, colors: { accent: "#FF0000" } }));
      await page.locator("#themeSave").click();
      await expect.poll(() => page.locator("#themeEditorPanel").isVisible()).toBe(false);
      expect(
        await page
          .locator("body")
          .evaluate(
            (node) => node.ownerDocument.defaultView?.getComputedStyle(node).backgroundColor,
          ),
      ).toBe("rgb(7, 16, 31)");
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#themeExport").click();
      expect((await downloadPromise).suggestedFilename()).toBe("Midnight-color-theme.json");
      await page.locator("#themeImportFile").setInputFiles({
        name: "import.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({ name: "Paper", type: "light", colors: { background: "#fafafa" } }),
        ),
      });
      await expect.poll(() => page.locator("#themeEditorPanel").isVisible()).toBe(true);
      await page.locator("#themeSave").click();
      await expect.poll(() => page.locator("#themeEditorPanel").isVisible()).toBe(false);
      expect(Object.keys(state.vaultState?.customThemes || {})).toHaveLength(2);
      await page.locator("#themeDelete").click();
      await expect.poll(() => state.vaultState?.theme).toBe("light");
      expect(Object.keys(state.vaultState?.customThemes || {})).toHaveLength(1);
      await page.locator("#settingsDark").click();
      await expect.poll(() => state.vaultState?.theme).toBe("dark");
      expect(await page.locator("html").getAttribute("data-theme-id")).toBe("dark");
      failSave = true;
      await page.locator("#settingsLight").click();
      await expect
        .poll(() => page.locator("#settingsThemeStatus").textContent())
        .toContain("Could not save");
      expect(await page.locator("html").getAttribute("data-theme-id")).toBe("dark");
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator("#themeCopy").click();
      const box = await page.locator("#themeEditorPanel").boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
      await page.locator("#themeJson").press("Escape");
      expect(await page.locator("#themeEditorPanel").isVisible()).toBe(false);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  }, 30_000);
  it("follows system changes, validates imports, and exports an editable complete palette", async () => {
    const page = await browser.newPage();
    page.setDefaultTimeout(3000);
    let writes = 0;
    await page.emulateMedia({ colorScheme: "light" });
    await page.route("**/*", (route) => {
      if (new URL(route.request().url()).pathname === "/")
        return route.fulfill({ contentType: "text/html", body: renderConsole(view) });
      if (route.request().method() === "POST" && route.request().url().includes("/vault/ui-state"))
        writes++;
      return route.fulfill({ json: { ok: true } });
    });
    try {
      await page.goto("http://theme-system.test/");
      expect(await page.locator("html").getAttribute("data-theme-id")).toBe("system");
      await page.emulateMedia({ colorScheme: "dark" });
      await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("dark");
      expect(writes).toBe(0);
      await page.locator("#settingsToggle").click();
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#themeExport").click();
      const stream = await (await downloadPromise).createReadStream();
      const chunks: Buffer[] = [];
      if (!stream) throw new Error("Missing theme download stream");
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const exported = themeEngine.normalize(JSON.parse(Buffer.concat(chunks).toString()));
      expect(exported.type).toBe("dark");
      expect(Object.keys(exported.colors)).toHaveLength(Object.keys(THEME_COLORS).length);
      expect(exported.colors.background).toBe("#07101f");
      await page.locator("#themeImportFile").setInputFiles({
        name: "invalid.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"name":"Bad","type":"dark","colors":{"unknown":"#fff"}}'),
      });
      await expect
        .poll(() => page.locator("#settingsThemeStatus").textContent())
        .toContain("Unknown theme color");
      expect(await page.locator("#themeEditorPanel").isVisible()).toBe(false);
      expect(writes).toBe(0);
      await page.locator("#themeCopy").click();
      await page
        .locator("#themeJson")
        .fill(
          JSON.stringify({ name: "Preview", type: "light", colors: { background: "#aabbcc" } }),
        );
      await page.emulateMedia({ colorScheme: "light" });
      await page.emulateMedia({ colorScheme: "dark" });
      expect(await page.locator("html").getAttribute("data-theme")).toBe("light");
      await page.locator("#themeEditorPanel summary").click();
      await page.locator("#themeColorSearch").fill("diff.added.background");
      await page.locator("#themeColorReference button").click();
      expect(JSON.parse(await page.locator("#themeJson").inputValue()).colors).toHaveProperty(
        "diff.added.background",
      );
      await page.locator("#themeCancel").click();
      expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
      await page.locator("#settingsLight").click();
      await expect
        .poll(() => page.locator("#settingsLight").getAttribute("aria-checked"))
        .toBe("true");
      await page.emulateMedia({ colorScheme: "light" });
      await page.emulateMedia({ colorScheme: "dark" });
      expect(await page.locator("html").getAttribute("data-theme")).toBe("light");
      await page.locator("#settingsLight").press("ArrowDown");
      await expect
        .poll(() => page.locator("#settingsDark").getAttribute("aria-checked"))
        .toBe("true");
      expect(
        await page
          .locator("#settingsDark")
          .evaluate((node) => node === node.ownerDocument.activeElement),
      ).toBe(true);
    } finally {
      await page.close();
    }
  });

  it("paints a saved custom palette before the production application script loads", async () => {
    const page = await browser.newPage();
    page.setDefaultTimeout(3000);
    let releaseApp!: () => void;
    const appGate = new Promise<void>((resolve) => {
      releaseApp = resolve;
    });
    const state: ConsoleView = {
      ...view,
      vaultState: {
        theme: "saved",
        customThemes: {
          saved: {
            name: "<script>Custom</script>",
            type: "dark",
            colors: {
              background: "#123456",
              "chat.background": "#223344",
              "project.1.foreground": "#abcdef",
            },
          },
        },
      },
    };
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/")
        return route.fulfill({ contentType: "text/html", body: renderConsoleShell(state) });
      if (url.pathname.startsWith("/assets/")) {
        if (url.pathname.endsWith(".js")) await appGate;
        return route.fulfill({
          contentType: url.pathname.endsWith(".css") ? "text/css" : "text/javascript",
          body: consoleAsset(url.pathname.split("/").pop() || "") || "",
        });
      }
      return route.fulfill({ json: { ok: true } });
    });
    try {
      await page.goto("http://theme-paint.test/", { waitUntil: "commit" });
      await page.locator("body").waitFor({ state: "attached" });
      expect(await page.locator("html").getAttribute("data-theme-id")).toBe("saved");
      await expect
        .poll(() =>
          page
            .locator("body")
            .evaluate(
              (node) => node.ownerDocument.defaultView?.getComputedStyle(node).backgroundColor,
            ),
        )
        .toBe("rgb(18, 52, 86)");
      expect(
        await page
          .locator(".main")
          .evaluate(
            (node) => node.ownerDocument.defaultView?.getComputedStyle(node).backgroundColor,
          ),
      ).toBe("rgb(34, 51, 68)");
      expect(await page.locator("#settingsThemeList button").count()).toBe(0);
      releaseApp();
      await page.waitForLoadState("load");
      await page.locator("#settingsToggle").click();
      expect(await page.locator('[data-theme-id="saved"][role="radio"]').textContent()).toContain(
        "<script>Custom</script>",
      );
    } finally {
      releaseApp();
      await page.close();
    }
  });
});
