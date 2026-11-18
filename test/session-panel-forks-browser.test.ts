import fs from "node:fs";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ConsoleView, type SessionView, renderConsole } from "../src/ui/console.js";

function session(id: string, parent?: string): SessionView {
  return {
    vendor: "claude",
    sessionId: id,
    forkParentId: parent,
    title: `First task for ${id}`,
    brief: `Task ${id}`,
    lastPrompt: `Latest progress for ${id}`,
    cwd: "/tmp/project",
    project: "project",
    file: `/tmp/${id}.jsonl`,
    ageDays: 0,
    lastTs: Date.now(),
    prompts: 2,
    pattern: "unknown",
    state: null,
    score: 5,
    reason: "",
    etaMin: 10,
    tags: ["other"],
  };
}
const members = (...ids: string[]) => ids.map((sessionId) => ({ vendor: "claude", sessionId }));
const sessions = [
  { ...session("root"), providerSessionId: "provider-root", tags: ["shared"] },
  session("child", "provider-root"),
  { ...session("leaf"), tags: ["shared"] },
  session("partner"),
  { ...session("other"), tags: ["shared"] },
  ...Array.from({ length: 11 }, (_, i) => session(`extra-${i}`)),
].map((s, i) => ({
  ...s,
  lastTs: Date.now() - i * 1000,
  generating: i < 10,
  generatingStartedAt: i < 10 ? Date.now() - 60000 : undefined,
}));
const view: ConsoleView = {
  sessions,
  knownDirs: [],
  scopeRoots: [],
  defaultNewDir: "",
  changelogMarkdown: "",
  sessions1h: 0,
  prompts1h: 0,
  chars1h: 0,
  vendors: [{ vendor: "claude", available: true, chat: true }],
  claudeModels: [],
  codexModels: [],
  cursorModels: [],
  tags: ["shared", "other"],
  sessionIndexEpoch: "relations",
  sessionIndexRevision: 1,
  vaultState: {
    sessionPins: { root: 100, child: 200, leaf: 300 },
    forkParents: { leaf: "child" },
    chatGroups: {
      alpha: { id: "alpha", members: members("provider-root", "partner"), updatedAt: 1 },
      beta: { id: "beta", members: members("child", "other"), updatedAt: 1 },
    },
    layout: {
      sessionPanelOpen: true,
      sessionPanelColumns: 2,
      sessionPanelWidth: 800,
      sidebarWidth: 260,
    },
  },
};
const card = (page: Page, id: string, host = "sessionPanelList") =>
  page.locator(`#${host} .item[data-session-id="${id}"]`);
const key = (page: Page, id: string, selector = ".it-title") =>
  card(page, id).locator(selector).getAttribute("data-session-relation-key");
const matched = (page: Page, host = "sessionPanelList") =>
  page
    .locator(`#${host} .tag-preview-match`)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-session-id")).sort());
const positions = (page: Page) =>
  page.locator("#sessionPanelList .item").evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    }),
  );

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  await browser.close();
});
async function open(fixture = view) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.setDefaultTimeout(4000);
  const errors: string[] = [];
  const writes: Array<Record<string, unknown>> = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    class StubEventSource {
      static readonly CLOSED = 2;
      onmessage: ((event: { data: string }) => void) | null = null;
      constructor() {
        (globalThis as unknown as Record<string, unknown>).__relationSource = this;
      }
      close() {}
    }
    Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/")
      await route.fulfill({ contentType: "text/html", body: renderConsole(fixture) });
    else if (url.pathname === "/chat/messages") await route.fulfill({ json: [] });
    else {
      if (url.pathname === "/vault/ui-state" && request.method() === "POST")
        writes.push(request.postDataJSON());
      await route.fulfill({ json: { ok: true, items: [] } });
    }
  });
  await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
  return { page, errors, writes };
}
async function replaceIndex(page: Page, next: SessionView[]) {
  await page.evaluate((sessions) => {
    const source = (
      globalThis as unknown as {
        __relationSource: { onmessage: (event: { data: string }) => void };
      }
    ).__relationSource;
    source.onmessage({
      data: JSON.stringify({
        kind: "session_index",
        epoch: "relations",
        revision: 2,
        pending: false,
        sessions,
        tags: ["shared", "other"],
      }),
    });
  }, next);
}

describe("session relation marks and hover", () => {
  it.each(["light", "dark"])(
    "colors titles by group, keeps first messages neutral, and previews relations with tooltips in %s",
    async (theme) => {
      const { page, errors } = await open({ ...view, vaultState: { ...view.vaultState, theme } });
      try {
        expect(await page.locator("#sessionPanelForks").count()).toBe(0);
        expect(await page.locator("#sessionPanelList .session-status-generating").count()).toBe(10);
        const colors = await page.locator("#sessionPanelList .item").evaluateAll((nodes) =>
          nodes.map((node) => {
            const style = (selector: string, pseudo?: string) => {
              const target = node.querySelector(selector);
              const win = node.ownerDocument.defaultView;
              if (!target || !win) throw new Error(`Missing ${selector}`);
              return win.getComputedStyle(target, pseudo);
            };
            return {
              title: style(".session-title-main").color,
              first: style(".it-firstmsg .prompt-line-text").color,
              firstBase: style(".it-firstmsg").color,
              decoration: style(".session-title-main").textDecorationLine,
              marker: style(".it-firstmsg", "::before").content,
            };
          }),
        );
        expect(new Set(colors.map((c) => c.title)).size).toBe(3);
        expect(new Set(colors.map((c) => c.first)).size).toBe(1);
        expect(colors.every((c) => c.first === c.firstBase)).toBe(true);
        const groupColor = await card(page, "root")
          .locator(".session-title-main")
          .evaluate((n) => n.ownerDocument.defaultView?.getComputedStyle(n).color);
        expect(
          await card(page, "partner")
            .locator(".session-title-main")
            .evaluate((n) => n.ownerDocument.defaultView?.getComputedStyle(n).color),
        ).toBe(groupColor);
        expect(
          await card(page, "child")
            .locator(".session-title-main")
            .evaluate((n) => n.ownerDocument.defaultView?.getComputedStyle(n).color),
        ).not.toBe(groupColor);
        expect(colors.every((c) => c.decoration === "none" && c.marker === "none")).toBe(true);
        expect(await page.locator(".session-tag-border").count()).toBe(0);
        await card(page, "root").click();
        await page.mouse.move(1590, 990);
        const openState = () =>
          card(page, "root").evaluate((node) => {
            const win = node.ownerDocument.defaultView;
            if (!win) throw new Error("Missing window");
            const card = win.getComputedStyle(node);
            const rail = win.getComputedStyle(node, "::before");
            const preview = win.getComputedStyle(node, "::after");
            return {
              background: card.backgroundImage,
              marker: card.boxShadow,
              rail: rail.animationName,
              preview: {
                style: preview.borderTopStyle,
                width: preview.borderTopWidth,
                color: preview.borderTopColor,
                background: preview.backgroundColor,
                inset: preview.top,
                pointer: preview.pointerEvents,
              },
            };
          });
        const baseline = await openState();
        expect(baseline.background).toContain("linear-gradient");
        expect(baseline.rail).toBe("sessionAttentionRail");
        const forkColor = await card(page, "root")
          .locator(".it-forktree")
          .evaluate((n) => n.ownerDocument.defaultView?.getComputedStyle(n).color);
        const tagColor = await card(page, "root")
          .locator(".it-tag:has(.headtag-nav)")
          .evaluate((n) => n.ownerDocument.defaultView?.getComputedStyle(n).borderBottomColor);
        expect(forkColor).not.toBe(groupColor);
        const before = await positions(page);
        for (const [selector, ids, tip, previewColor] of [
          [card(page, "root").locator(".it-title"), ["partner", "root"], "Task root", groupColor],
          [
            card(page, "child").locator(".it-forktree"),
            ["child", "leaf", "root"],
            "View fork tree",
            forkColor,
          ],
          [
            card(page, "root").locator(".headtag-nav"),
            ["leaf", "other", "root"],
            "shared",
            tagColor,
          ],
          [
            page.locator('#tagFilters [data-tag-preview-key="tag:shared"] .gtagbtn'),
            ["leaf", "other", "root"],
            "shared",
            tagColor,
          ],
        ] as const) {
          await selector.hover();
          await expect.poll(() => matched(page)).toEqual(ids);
          await expect.poll(() => matched(page, "list")).toEqual(ids);
          await expect.poll(() => page.locator("#hoverTip").isVisible()).toBe(true);
          expect(await page.locator("#hoverTip").textContent()).toContain(tip);
          expect(await page.locator("#hoverTip").textContent()).toContain(
            `${ids.length} matching sessions`,
          );
          expect(await positions(page)).toEqual(before);
          const state = await openState();
          expect(state.background).toBe(baseline.background);
          expect(state.marker).toBe(baseline.marker);
          expect(state.rail).toBe(baseline.rail);
          expect(state.preview.style).toBe("solid");
          expect(state.preview.width).toBe("2px");
          expect(state.preview.background).toBe("rgba(0, 0, 0, 0)");
          expect(state.preview.inset).toBe("3px");
          expect(state.preview.pointer).toBe("none");
          expect(state.preview.color).toBe(previewColor);
        }
        for (const host of ["list", "sessionPanelList"]) {
          await card(page, "root", host).locator(".it-firstmsg").hover();
          await expect
            .poll(() => page.locator(".tag-preview-match,.tag-preview-dim").count())
            .toBe(0);
          await expect
            .poll(() => page.locator("#hoverTip").textContent())
            .toContain("First task for root");
          expect(await page.locator("#hoverTip").textContent()).not.toContain("matching sessions");
        }
        await page.mouse.move(1590, 990);
        await expect
          .poll(() => page.locator(".tag-preview-match,.tag-preview-dim").count())
          .toBe(0);
        if (process.env.ATTEND_RELATION_SCREENSHOTS) {
          fs.mkdirSync("logs/session-relations", { recursive: true });
          await expect
            .poll(() =>
              card(page, "extra-10").evaluate(
                (n) => n.ownerDocument.defaultView?.getComputedStyle(n).opacity,
              ),
            )
            .toBe("1");
          await page.screenshot({ path: `logs/session-relations/${theme}.png` });
          await card(page, "root").screenshot({ path: `logs/session-relations/${theme}-card.png` });
          await card(page, "root").locator(".it-title").hover();
          await expect.poll(() => page.locator("#hoverTip").isVisible()).toBe(true);
          await expect
            .poll(() =>
              card(page, "extra-10").evaluate(
                (n) => n.ownerDocument.defaultView?.getComputedStyle(n).opacity,
              ),
            )
            .toBe("0.38");
          await page.screenshot({ path: `logs/session-relations/${theme}-group.png` });
        }
        await card(page, "child").locator(".it-forktree").click();
        expect(await page.locator("#forkTreeViewport").isVisible()).toBe(true);
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
  );

  it("updates marks on drag-to-group and tab removal without confusing fork ancestry", async () => {
    const { page, errors } = await open();
    try {
      await card(page, "child").click();
      await card(page, "partner").dragTo(page.locator("#msgs"));
      await expect.poll(() => key(page, "partner")).toBe("group:beta");
      expect(await key(page, "root")).toBeNull();
      await card(page, "partner").locator(".it-title").hover();
      await expect.poll(() => matched(page)).toEqual(["child", "other", "partner"]);
      await page.locator('#chatTabs .chat-tab[data-session-id="child"] .chat-tab-close').click();
      await expect.poll(() => key(page, "child")).toBeNull();
      await card(page, "partner").locator(".it-title").hover();
      await expect.poll(() => matched(page)).toEqual(["other", "partner"]);
      await card(page, "child").locator(".it-forktree").hover();
      await expect.poll(() => matched(page)).toEqual(["child", "leaf", "root"]);
      await page.locator('#chatTabs .chat-tab[data-session-id="other"] .chat-tab-close').click();
      await expect.poll(() => key(page, "partner")).toBeNull();
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it("refreshes hovered membership and tooltip after an index replacement while keeping colors stable", async () => {
    const { page, errors } = await open();
    try {
      const oldColor = await card(page, "root").evaluate((n) =>
        n.style.getPropertyValue("--session-fork-hue"),
      );
      await card(page, "root").locator(".it-forktree").hover();
      const next = view.sessions
        .map((s) => (s.sessionId === "partner" ? { ...s, forkParentId: "child" } : s))
        .reverse();
      await replaceIndex(page, next);
      await expect.poll(() => matched(page)).toEqual(["child", "leaf", "partner", "root"]);
      await expect
        .poll(() => page.locator("#hoverTip").textContent())
        .toContain("4 matching sessions");
      expect(
        await card(page, "root").evaluate((n) => n.style.getPropertyValue("--session-fork-hue")),
      ).toBe(oldColor);
      expect(
        await card(page, "partner").evaluate((n) => n.style.getPropertyValue("--session-fork-hue")),
      ).toBe(oldColor);
      await page.mouse.move(1590, 990);
      await expect.poll(() => matched(page)).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it("preserves relation previews across virtual scrolling and clears them on Escape, drag and blur", async () => {
    const many: SessionView[] = Array.from({ length: 100 }, (_, i) => ({
      ...session(`v${i}`),
      lastTs: 100000 - i,
    }));
    many[0] = { ...session("v0"), lastTs: 100000, providerSessionId: "provider-root" };
    many[99] = { ...session("v99", "provider-root"), lastTs: 99901 };
    const { page, errors } = await open({
      ...view,
      sessions: many,
      vaultState: {
        chatGroups: {
          family: { id: "family", members: members("provider-root", "v99"), updatedAt: 1 },
        },
        layout: { sessionPanelOpen: true, sessionPanelColumns: 1 },
      },
    });
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const title = card(page, "v0", "list").locator(".it-title");
      await title.hover();
      await page.locator("#sessionPanel").evaluate((n) => {
        n.scrollTop = n.scrollHeight;
      });
      await expect.poll(() => card(page, "v99").count()).toBe(1);
      await expect.poll(() => matched(page)).toEqual(["v99"]);
      expect(await key(page, "v99")).toBe("group:family");
      await card(page, "v0", "list").locator(".it-forktree").hover();
      await expect.poll(() => matched(page)).toEqual(["v99"]);
      expect(await key(page, "v99", ".it-forktree")).toBe("fork:provider-root");
      expect(await key(page, "v99", ".it-firstmsg")).toBeNull();
      expect(await page.locator("#sessionPanelList .item").count()).toBeLessThan(30);
      await page.keyboard.press("Escape");
      await expect.poll(() => page.locator(".tag-preview-match,.tag-preview-dim").count()).toBe(0);
      await page.mouse.move(1590, 990);
      const mini = card(page, "v0", "list").locator(".it-forktree");
      await page.keyboard.press("Tab");
      await mini.focus();
      await expect.poll(() => matched(page)).toEqual(["v99"]);
      await expect.poll(() => page.locator("#hoverTip").isVisible()).toBe(true);
      await mini.press("Escape");
      await title.dispatchEvent("pointerover", { pointerType: "touch" });
      expect(await matched(page)).toEqual([]);
      await title.hover();
      await card(page, "v0", "list").dispatchEvent("dragstart");
      expect(await matched(page)).toEqual([]);
      await card(page, "v0", "list").dispatchEvent("dragend");
      await page.mouse.move(1590, 990);
      await title.hover();
      await page.evaluate(() =>
        (globalThis as unknown as { dispatchEvent(event: Event): boolean }).dispatchEvent(
          new Event("blur"),
        ),
      );
      expect(await matched(page)).toEqual([]);
      await page.locator("#sessionPanel").evaluate((n) => {
        n.scrollTop = 0;
      });
      await expect.poll(() => card(page, "v0").count()).toBe(1);
      expect(await page.locator(".tag-preview-match,.tag-preview-dim").count()).toBe(0);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
