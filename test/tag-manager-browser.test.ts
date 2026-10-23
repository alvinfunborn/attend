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
      { names: ["work", "urgent"], action: "delete" },
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
