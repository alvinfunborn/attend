import fs from "node:fs";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

const view: ConsoleView = {
  sessions: ["work", "other", "WORK", "ops", "other"].map((tag, index) => ({
    vendor: "claude",
    sessionId: `s${index + 1}`,
    title:
      [
        "Tag navigation",
        "Release checklist",
        "Sidebar polish",
        "Running checks",
        "Billing follow-up",
      ][index] || "Task",
    lastPrompt: "Review the implementation and check the result",
    cwd: "/tmp/attend-preview",
    project: "Attend",
    file: `/tmp/hover-${index}.jsonl`,
    tags: [tag],
    ageDays: 0,
    lastTs: Date.now() - index * 1000,
    prompts: 2,
    score: 5,
    reason: "",
    pattern: "unknown" as const,
    state: null,
    brief: null,
    etaMin: 3,
    generating: index === 3,
    generatingStartedAt: index === 3 ? Date.now() : undefined,
  })),
  knownDirs: [],
  scopeRoots: [],
  defaultNewDir: "",
  changelogMarkdown: "",
  sessions1h: 5,
  prompts1h: 10,
  chars1h: 100,
  vendors: [],
  claudeModels: [],
  codexModels: [],
  cursorModels: [],
  tags: ["work", "other", "ops"],
  sessionIndexEpoch: "hover",
  sessionIndexRevision: 1,
  vaultState: { layout: { sessionPanelColumns: 2, sessionPanelWidth: 740, sidebarWidth: 290 } },
};

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  await browser?.close();
});

async function openPage(fixture: ConsoleView = view): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.setDefaultTimeout(4000);
  await page.addInitScript(() => {
    class StubEventSource {
      static readonly CLOSED = 2;
      onmessage: ((event: { data: string }) => void) | null = null;
      constructor() {
        (globalThis as unknown as Record<string, unknown>).__tagHoverSource = this;
      }
      close() {}
    }
    Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/")
      await route.fulfill({ contentType: "text/html", body: renderConsole(fixture) });
    else if (url.pathname === "/chat/messages") await route.fulfill({ json: [] });
    else await route.fulfill({ json: { ok: true, items: [] } });
  });
  await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
  return page;
}

const cards = "#list .item, #sessionPanelList .item";
const opacity = (page: Page, id: string) =>
  page
    .locator(`#list .item[data-session-id="${id}"]`)
    .evaluate((node) => Number(node.ownerDocument.defaultView?.getComputedStyle(node).opacity));

describe("tag hover preview", () => {
  it.each(["filter", "header", "sidebar", "panel"])(
    "previews both lists from a %s tag without moving or filtering cards",
    async (surface) => {
      const dark = surface === "panel" || surface === "header";
      const page = await openPage({
        ...view,
        vaultState: { ...view.vaultState, theme: dark ? "dark" : "light" },
      });
      try {
        await page
          .locator(`#list .item[data-session-id="${surface === "header" ? "s1" : "s2"}"]`)
          .click();
        await page.locator("#sessionPanelToggle").click();
        const selector =
          surface === "filter"
            ? '#tagFilters [data-tag-preview-key="tag:work"] .gtagbtn'
            : surface === "header"
              ? "#h-tags .headtag-nav"
              : `${surface === "sidebar" ? "#list" : "#sessionPanelList"} .item[data-session-id="s1"] .headtag-nav`;
        const trigger = page.locator(selector);
        const positions = () =>
          page.locator(cards).evaluateAll((nodes) =>
            nodes.map((node) => {
              const r = node.getBoundingClientRect();
              return [r.x, r.y, r.width, r.height];
            }),
          );
        const before = await positions();
        await trigger.hover();
        await expect.poll(() => page.locator(".item.tag-preview-match").count()).toBe(4);
        expect(await page.locator(".item.tag-preview-dim").count()).toBe(6);
        await expect.poll(() => opacity(page, "s5")).toBeCloseTo(0.38);
        await expect.poll(() => opacity(page, "s4")).toBeCloseTo(0.68);
        if (surface !== "header") await expect.poll(() => opacity(page, "s2")).toBeCloseTo(0.68);
        expect(await positions()).toEqual(before);
        await expect.poll(() => page.locator("#hoverTip").isVisible()).toBe(true);
        expect(await page.locator("#hoverTip").textContent()).toContain("2 matching sessions");
        expect(await page.locator("#hoverTip").textContent()).toContain(
          surface === "filter" ? "Click to filter" : "Click to view recent sessions",
        );
        // Capture representative light/dark frames only when explicitly requested.
        if (process.env.ATTEND_TAG_HOVER_SCREENSHOTS && ["filter", "panel"].includes(surface)) {
          fs.mkdirSync("logs", { recursive: true });
          await page.screenshot({ path: `logs/tag-hover-${dark ? "dark" : "light"}.png` });
        }
        // A real index replacement changes membership and replaces the hovered DOM.
        await page.evaluate(
          (sessions) => {
            const source = (
              globalThis as unknown as {
                __tagHoverSource: { onmessage: (event: { data: string }) => void };
              }
            ).__tagHoverSource;
            source.onmessage({
              data: JSON.stringify({
                kind: "session_index",
                epoch: "hover",
                revision: 2,
                pending: false,
                sessions,
                tags: ["work", "other", "ops"],
              }),
            });
          },
          view.sessions.map((s, i) => ({
            ...s,
            tags: i === 2 ? ["other"] : i === 4 ? ["work"] : s.tags,
          })),
        );
        await expect
          .poll(() => page.locator('#list .item[data-session-id="s5"]').getAttribute("class"))
          .toContain("tag-preview-match");
        expect(
          await page.locator('#sessionPanelList .item[data-session-id="s3"]').getAttribute("class"),
        ).toContain("tag-preview-dim");
        await page.mouse.move(1490, 990);
        await expect
          .poll(() => page.locator(".tag-preview-match, .tag-preview-dim").count())
          .toBe(0);
        await expect.poll(() => opacity(page, "s5")).toBe(1);
        expect(await page.locator(cards).count()).toBe(10);
      } finally {
        await page.close();
      }
    },
  );

  it("supports keyboard preview, Escape, recent-session navigation and touch without sticky dimming", async () => {
    const page = await openPage();
    try {
      await page.locator('#list .item[data-session-id="s1"]').click();
      const tag = page.locator("#h-tags .headtag-nav");
      await page.mouse.move(1490, 990);
      await page.keyboard.press("Tab");
      await tag.focus();
      await expect.poll(() => page.locator(".tag-preview-match").count()).toBe(2);
      await tag.press("Escape");
      expect(await page.locator(".tag-preview-match, .tag-preview-dim").count()).toBe(0);
      await tag.press("ArrowDown");
      expect(await page.locator("#headerTagSessionMenu button").count()).toBe(2);
      await page.keyboard.press("Escape");
      await page.mouse.click(1490, 990);
      await tag.dispatchEvent("pointerover", { pointerType: "touch" });
      expect(await page.locator(".tag-preview-match, .tag-preview-dim").count()).toBe(0);
      await tag.hover();
      await expect.poll(() => page.locator(".tag-preview-match").count()).toBe(2);
      await page.evaluate(() => {
        (globalThis as unknown as { dispatchEvent(event: Event): boolean }).dispatchEvent(
          new Event("blur"),
        );
      });
      expect(await page.locator(".tag-preview-match, .tag-preview-dim").count()).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("keeps virtualized cards correct through scrolling and restores cached cards with reduced motion", async () => {
    const first = view.sessions[0];
    if (!first) throw new Error("missing session fixture");
    const many: ConsoleView = {
      ...view,
      sessions: Array.from({ length: 100 }, (_, i) => ({
        ...first,
        sessionId: `v${i}`,
        tags: [i % 2 ? "other" : "work"],
        title: `Task ${i}`,
        lastTs: 2000 - i,
      })),
    };
    const page = await openPage(many);
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.locator('#list .item[data-session-id="v0"]').click();
      await page.locator("#sessionPanelToggle").click();
      await page.locator("#h-tags .headtag-nav").hover();
      const classifications = () =>
        page.locator(cards).evaluateAll((nodes) =>
          nodes.every((node) => {
            const id = Number(node.getAttribute("data-session-id")?.slice(1));
            return node.classList.contains(id % 2 ? "tag-preview-dim" : "tag-preview-match");
          }),
        );
      await expect.poll(classifications).toBe(true);
      await page.locator("#list, #sessionPanel").evaluateAll((nodes) => {
        for (const node of nodes) {
          node.scrollTop = node.scrollHeight;
        }
      });
      await expect
        .poll(() => page.locator('#sessionPanelList .item[data-session-id="v99"]').count())
        .toBe(1);
      await expect.poll(classifications).toBe(true);
      await page.mouse.move(1490, 990);
      await page.locator("#list, #sessionPanel").evaluateAll((nodes) => {
        for (const node of nodes) {
          node.scrollTop = 0;
        }
      });
      await expect
        .poll(() => page.locator('#sessionPanelList .item[data-session-id="v0"]').count())
        .toBe(1);
      expect(await page.locator(".tag-preview-match, .tag-preview-dim").count()).toBe(0);
      expect(
        await page
          .locator("#list .item")
          .first()
          .evaluate(
            (node) => node.ownerDocument.defaultView?.getComputedStyle(node).transitionDuration,
          ),
      ).toBe("0s");
    } finally {
      await page.close();
    }
  });
});
