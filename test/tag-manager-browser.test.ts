import { chromium } from "playwright";
import { expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

it("opens TAGS management and supports batch unbind, failure retry, and deletion", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const requests: unknown[] = [];
  let fail = true;
  const view: ConsoleView = {
    changelogMarkdown: "",
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
    tags: ["work", "urgent", "later"],
  };
  try {
    await page.addInitScript(() => {
      Object.defineProperty(globalThis, "EventSource", {
        value: class {
          static CLOSED = 2;
          close() {}
        },
      });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(view) });
      } else if (url.pathname === "/tags/batch") {
        const body = route.request().postDataJSON();
        requests.push(body);
        if (fail) {
          await route.fulfill({ status: 500, json: { ok: false } });
        } else {
          await route.fulfill({
            json: { ok: true, tags: body.action === "delete" ? ["later"] : view.tags },
          });
        }
      } else await route.fulfill({ json: { ok: true } });
    });
    await page.goto("http://attend.test/");
    await page.locator("#tagManagerOpen").click();
    const dialog = page.locator("#tagManager");
    expect(await dialog.isVisible()).toBe(true);
    const boxes = await dialog.locator(".tagmanager-row").evaluateAll((nodes) =>
      nodes.map((node) => ({
        x: node.getBoundingClientRect().x,
        y: node.getBoundingClientRect().y,
      })),
    );
    expect(boxes[0]?.y).toBe(boxes[1]?.y);
    expect(boxes[0]?.x).not.toBe(boxes[1]?.x);
    await dialog.getByRole("button", { name: /^work\b/ }).click();
    await page.locator("#tagManagerSearch").fill("URG");
    expect(await dialog.locator(".tagmanager-row").count()).toBe(1);
    await dialog.getByRole("button", { name: "Select all shown", exact: true }).click();
    await page.locator("#tagManagerSearch").fill("");
    expect(await dialog.getByRole("button", { name: /^work\b/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await page.locator("#tagManagerUnbind").click();
    await expect.poll(() => page.locator("#tagManagerStatus").textContent()).toBe("2 selected");
    expect(await dialog.getByRole("button", { name: /^work\b/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fail = false;
    await page.locator("#tagManagerUnbind").click();
    await expect.poll(() => page.locator("#tagManagerStatus").textContent()).toBe("0 selected");
    expect(await dialog.locator(".tagmanager-row").count()).toBe(3);
    await dialog.getByRole("button", { name: "Select all shown", exact: true }).click();
    expect(await dialog.locator('.tagmanager-row[aria-pressed="true"]').count()).toBe(3);
    await dialog.getByRole("button", { name: /^later\b/ }).click();
    await page.locator("#tagManagerDelete").click();
    await expect.poll(() => dialog.locator(".tagmanager-row").count()).toBe(1);
    expect(requests).toEqual([
      { names: ["work", "urgent"], action: "unbind" },
      { names: ["work", "urgent"], action: "unbind" },
      { names: ["urgent", "work"], action: "delete" },
    ]);
    await page.keyboard.press("Escape");
    expect(await dialog.isHidden()).toBe(true);
    expect(
      await page
        .locator("#tagManagerOpen")
        .evaluate((node) => node === node.ownerDocument.activeElement),
    ).toBe(true);
  } finally {
    await browser.close();
  }
});

function filterView(): ConsoleView {
  return {
    changelogMarkdown: "",
    sessions: [0, 1, 2].map((index) => ({
      vendor: "claude",
      sessionId: `s${index}`,
      title: `Session ${index}`,
      brief: "",
      lastPrompt: "",
      cwd: "/tmp/project",
      project: "project",
      file: `/tmp/session-${index}.jsonl`,
      ageDays: 0,
      lastTs: 100 - index,
      prompts: 1,
      pattern: "unknown",
      state: null,
      score: 1,
      reason: "",
      etaMin: 10,
      tags: index === 0 ? ["once", "twice", "many"] : index === 1 ? ["twice", "many"] : ["many"],
    })),
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
    tags: ["zero", "zero-other", "once", "twice", "many"],
  };
}

it("combines name and bind filters, preserves hidden selections, and refreshes counts after unbind", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(3000);
  const view = filterView();
  const requests: unknown[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.route("**/*", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/")
        return route.fulfill({ contentType: "text/html", body: renderConsole(view) });
      if (path === "/tags/batch") {
        requests.push(route.request().postDataJSON());
        return route.fulfill({ json: { ok: true, tags: view.tags } });
      }
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto("http://tag-filter.test/");
    // Sidebar search must not affect the bind counts in the manager.
    await page.locator("#search").fill("Session 2");
    await page.locator("#tagManagerOpen").click();
    const dialog = page.locator("#tagManager");
    const names = () => dialog.locator(".tagmanager-name").allTextContents();
    const binds = page.locator("#tagManagerBinds");
    await binds.getByRole("button", { name: "0 binds · 2", exact: true }).click();
    expect(await names()).toEqual(["zero", "zero-other"]);
    await page.locator("#tagManagerAll").click();
    await binds.getByRole("button", { name: "1 bind · 1", exact: true }).click();
    expect(await names()).toEqual(["once", "zero", "zero-other"]);
    await page.locator("#tagManagerAll").click();
    expect(await dialog.locator('.tagmanager-row[aria-pressed="true"]').count()).toBe(3);
    await page.locator("#tagManagerSearch").fill("ON");
    expect(await names()).toEqual(["once"]);
    expect(await page.locator("#tagManagerStatus").textContent()).toBe(
      "3 selected (2 hidden by filters)",
    );
    await page.locator("#tagManagerAll").click();
    expect(await page.locator("#tagManagerStatus").textContent()).toBe(
      "2 selected (2 hidden by filters)",
    );
    await page.locator("#tagManagerResetFilters").click();
    expect(await names()).toEqual(["many", "once", "twice", "zero", "zero-other"]);
    expect(await dialog.locator('.tagmanager-row[aria-pressed="true"]').count()).toBe(2);
    await page.locator("#tagManagerClearSelection").click();
    await binds.getByRole("button", { name: "Range…", exact: true }).click();
    await page.locator("#tagManagerMin").fill("2");
    expect(await names()).toEqual(["many", "twice"]);
    await page.locator("#tagManagerMax").fill("2");
    expect(await names()).toEqual(["twice"]);
    await page.locator("#tagManagerMin").fill("");
    expect(await names()).toEqual(["once", "twice", "zero", "zero-other"]);
    await page.locator("#tagManagerAll").click();
    await page.locator("#tagManagerMin").fill("3");
    expect(await names()).toEqual([]);
    expect(await page.locator("#tagManagerMax").getAttribute("aria-invalid")).toBe("true");
    expect(await page.locator("#tagManagerDelete").isDisabled()).toBe(true);
    await page.locator("#tagManagerMin").fill("0.5");
    expect(await page.locator("#tagManagerMin").getAttribute("aria-invalid")).toBe("true");
    await page.locator("#tagManagerMin").fill("-1");
    expect(await names()).toEqual([]);
    await page.locator("#tagManagerResetFilters").click();
    await page.locator("#tagManagerClearSelection").click();
    await page.locator("#tagManagerSort").selectOption("bind-desc");
    expect(await names()).toEqual(["many", "twice", "once", "zero", "zero-other"]);
    await page.locator("#tagManagerSort").selectOption("bind-asc");
    expect(await names()).toEqual(["zero", "zero-other", "once", "twice", "many"]);
    await binds.getByRole("button", { name: "1 bind · 1", exact: true }).click();
    await page.locator("#tagManagerAll").click();
    await page.locator("#tagManagerUnbind").click();
    await expect.poll(() => names()).toEqual([]);
    expect(await binds.getByRole("button", { name: "0 binds · 3", exact: true }).count()).toBe(1);
    expect(requests).toEqual([{ names: ["once"], action: "unbind" }]);
    await binds.getByRole("button", { name: "0 binds · 3", exact: true }).click();
    expect(await names()).toEqual(["once", "zero", "zero-other"]);
    await page.locator("#tagManagerSearch").fill("absent");
    expect(await names()).toEqual([]);
    expect(await page.locator("#tagManagerAll").isDisabled()).toBe(true);
    await page.keyboard.press("Escape");
    expect(await dialog.isVisible()).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});

it.each(["light", "dark"] as const)(
  "shares themed dialog surfaces and stays within a mobile viewport in %s",
  async (type) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 650 } });
    page.setDefaultTimeout(3000);
    const view = filterView();
    view.tags.push(...Array.from({ length: 120 }, (_, index) => `tag-${index}`));
    view.vaultState = {
      theme: "custom:surfaces",
      customThemes: {
        "custom:surfaces": {
          name: "Surfaces",
          type,
          colors: {
            "floatingPanel.background": "#213243",
            "floatingPanel.border": "#657687",
            "floatingPanel.shadow": "rgba(12,24,36,0.5)",
            "overlay.background": "rgba(20,30,40,0.6)",
          },
        },
      },
    };
    try {
      await page.route("**/*", (route) =>
        new URL(route.request().url()).pathname === "/"
          ? route.fulfill({ contentType: "text/html", body: renderConsole(view) })
          : route.fulfill({ json: { ok: true } }),
      );
      await page.goto("http://tag-dialog.test/");
      await page.locator("#tagManagerOpen").click();
      const dialog = page.locator("#tagManager");
      const style = await dialog.evaluate((node) => {
        const win = node.ownerDocument.defaultView;
        if (!win) throw new Error("Missing window");
        const css = win.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {
          modal: node.matches(":modal"),
          background: css.backgroundColor,
          border: css.borderColor,
          shadow: css.boxShadow,
          backdrop: win.getComputedStyle(node, "::backdrop").backgroundColor,
          x: rect.x,
          y: rect.y,
          right: rect.right,
          bottom: rect.bottom,
          overflow: node.scrollWidth > node.clientWidth,
        };
      });
      expect(style).toMatchObject({
        modal: true,
        background: "rgb(33, 50, 67)",
        border: "rgb(101, 118, 135)",
        backdrop: "rgba(20, 30, 40, 0.6)",
        overflow: false,
      });
      expect(style.shadow).toContain("rgba(12, 24, 36, 0.5)");
      expect(style.x).toBeGreaterThanOrEqual(0);
      expect(style.y).toBeGreaterThanOrEqual(0);
      expect(style.right).toBeLessThanOrEqual(390);
      expect(style.bottom).toBeLessThanOrEqual(650);
      expect(await page.locator("#tagManagerClose").isVisible()).toBe(true);
      expect(await page.locator("#tagManagerDelete").isVisible()).toBe(true);
      await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((node) => node.contains(node.ownerDocument.activeElement))).toBe(
        true,
      );
      await page.mouse.click(2, 2);
      expect(await dialog.isVisible()).toBe(false);
      await page.locator("#settingsToggle").click();
      expect(
        await page
          .locator("#settingsPanel")
          .evaluate(
            (node) => node.ownerDocument.defaultView?.getComputedStyle(node).backgroundColor,
          ),
      ).toBe(style.background);
    } finally {
      await browser.close();
    }
  },
);
