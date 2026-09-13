import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

const view: ConsoleView = {
  sessions: [
    {
      vendor: "claude",
      sessionId: "mobile-session",
      title: "Mobile session",
      lastPrompt: "hello",
      cwd: "/tmp/mobile",
      project: "mobile",
      file: "/tmp/mobile.jsonl",
      ageDays: 0,
      lastTs: 100,
      prompts: 1,
      pattern: "unknown",
      state: null,
      score: 5,
      reason: "",
      etaMin: 10,
      brief: "Mobile session",
      tags: [],
    },
  ],
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
  tags: [],
};

async function stubLiveStream(page: Page) {
  await page.addInitScript(() => {
    const target = globalThis as unknown as Record<string, unknown>;
    class StubEventSource {
      onmessage: ((event: { data: string }) => void) | null = null;
      constructor() {
        target.__mobileLive = this;
      }
      close() {}
    }
    Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
  });
}

async function announce(page: Page, message: Record<string, unknown>) {
  await page.evaluate((data) => {
    const source = (globalThis as unknown as Record<string, unknown>).__mobileLive as {
      onmessage: ((event: { data: string }) => void) | null;
    };
    source.onmessage?.({ data: JSON.stringify(data) });
  }, message);
}

describe("mobile console initialization and layout", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });
  afterAll(async () => {
    await browser.close();
  });

  it("loads the first list without SSE and retains a slow snapshot across newer deltas", async () => {
    const page = await browser.newPage();
    await stubLiveStream(page);
    let requests = 0;
    let release = () => {};
    const slowSnapshot = new Promise<void>((resolve) => {
      release = resolve;
    });
    const snapshot = { kind: "session_index", epoch: "mobile", revision: 7, pending: false };
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole({
            ...view,
            sessions: [],
            sessionsPending: true,
            sessionIndexEpoch: "mobile",
            sessionIndexRevision: 7,
          }),
        });
      } else if (url.pathname === "/session-index") {
        requests++;
        const first = requests === 1;
        if (first) await slowSnapshot;
        await route.fulfill({
          json: {
            ...snapshot,
            revision: first ? 7 : 9,
            sessions: view.sessions.map((s) => ({ ...s, title: first ? s.title : "Caught up" })),
          },
        });
      } else await route.fulfill({ json: { ok: true, items: [] } });
    });
    try {
      await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
      await expect.poll(() => requests).toBe(1);
      for (const revision of [8, 9]) {
        await announce(page, {
          ...snapshot,
          revision,
          baseRevision: revision - 1,
          upserts: [],
          removedSessionKeys: [],
        });
      }
      // A delta whose base matches the shell still cannot supply its missing list.
      expect(await page.locator("#list").textContent()).toContain("Indexing sessions");
      expect(requests).toBe(1);
      release();
      await expect.poll(() => page.locator("#list .item").count()).toBe(1);
      await expect.poll(() => page.locator("#list").textContent()).toContain("Caught up");
      expect(requests).toBe(2);
    } finally {
      release();
      await page.close();
    }
  });

  it("retries a failed initial snapshot without requiring another live event", async () => {
    const page = await browser.newPage();
    await stubLiveStream(page);
    let requests = 0;
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: renderConsole({ ...view, sessions: [], sessionsPending: true }),
        });
      } else if (url.pathname === "/session-index") {
        requests++;
        await route.fulfill(
          requests === 1
            ? { status: 503, json: { error: "temporary outage" } }
            : {
                json: {
                  kind: "session_index",
                  epoch: "recovered",
                  revision: 1,
                  pending: false,
                  sessions: view.sessions,
                },
              },
        );
      } else await route.fulfill({ json: { ok: true, items: [] } });
    });
    try {
      await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
      await expect.poll(() => page.locator("#list .item").count(), { timeout: 5_000 }).toBe(1);
      expect(requests).toBe(2);
    } finally {
      await page.close();
    }
  });

  it("resizes both dividers with real touch pointers and releases a cancelled drag", async () => {
    const page = await browser.newPage({ viewport: { width: 1400, height: 800 }, hasTouch: true });
    await stubLiveStream(page);
    await page.route("**/*", async (route) => {
      if (new URL(route.request().url()).pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(view) });
      } else await route.fulfill({ json: { ok: true, items: [] } });
    });
    try {
      await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
      const cdp = await page.context().newCDPSession(page);
      const drag = async (selector: string, endX: number, cancel = false) => {
        const box = await page.locator(selector).boundingBox();
        if (!box) throw new Error("Missing divider");
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: box.x + box.width / 2, y: 100 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: endX, y: 100 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: cancel ? "touchCancel" : "touchEnd",
          touchPoints: [],
        });
      };
      await drag("#resizer", 250);
      await expect
        .poll(() => page.locator(".side").evaluate((n) => n.getBoundingClientRect().width))
        .toBe(250);
      await page.locator("#sessionPanelToggle").click();
      const panel = await page.locator("#sessionPanel").boundingBox();
      if (!panel) throw new Error("Missing middle panel");
      await drag("#sessionPanelResizer", panel.x + 380, true);
      await expect
        .poll(() => page.locator("#sessionPanel").evaluate((n) => n.getBoundingClientRect().width))
        .toBe(380);
      expect(await page.locator(".dragging").count()).toBe(0);
      expect(await page.locator("body").evaluate((n) => n.style.userSelect)).toBe("");
      await page.reload({ waitUntil: "domcontentloaded" });
      expect(await page.locator(".side").evaluate((n) => n.getBoundingClientRect().width)).toBe(
        250,
      );
      expect(
        await page.locator("#sessionPanel").evaluate((n) => n.getBoundingClientRect().width),
      ).toBe(380);
    } finally {
      await page.close();
    }
  });

  for (const width of [390, 980]) {
    it(`keeps the composer reachable when the visual viewport shrinks at width ${width}`, async () => {
      const page = await browser.newPage({ viewport: { width, height: 800 }, hasTouch: true });
      await stubLiveStream(page);
      await page.addInitScript((viewportWidth) => {
        const viewport = Object.assign(new EventTarget(), {
          width: viewportWidth,
          height: 800,
          offsetTop: 0,
        });
        Object.defineProperty(globalThis, "visualViewport", { value: viewport });
      }, width);
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/") {
          await route.fulfill({ contentType: "text/html", body: renderConsole(view) });
        } else if (url.pathname === "/chat/messages") {
          await route.fulfill({ json: [] });
        } else await route.fulfill({ json: { ok: true, items: [] } });
      });
      const resizeVisualViewport = (height: number, offsetTop: number, visualWidth = width) =>
        page.evaluate(
          (next) => {
            const viewport = (globalThis as unknown as { visualViewport: EventTarget })
              .visualViewport;
            Object.assign(viewport, next);
            viewport.dispatchEvent(new Event("resize"));
          },
          { height, offsetTop, width: visualWidth },
        );
      try {
        await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
        await page.locator("#list .item").click();
        await resizeVisualViewport(460, 35);
        await expect
          .poll(() => page.locator("body").evaluate((n) => n.getBoundingClientRect().height))
          .toBe(460);
        const foot = await page.locator(".foot").boundingBox();
        const input = await page.locator("#input").boundingBox();
        if (!foot || !input) throw new Error("Missing composer");
        expect(foot.y + foot.height).toBeLessThanOrEqual(495);
        expect(input.y).toBeGreaterThanOrEqual(35);
        expect(input.y + input.height).toBeLessThanOrEqual(495);
        await page.locator("#msgs").evaluate((host) => {
          const item = host.ownerDocument.createElement("div");
          item.style.cssText = "height:2000px;flex-shrink:0";
          host.appendChild(item);
          host.scrollTop = host.scrollHeight;
        });
        expect(
          await page
            .locator("#msgs")
            .evaluate((n) => n.scrollHeight - n.clientHeight - n.scrollTop),
        ).toBeLessThanOrEqual(1);
        // Pinch zoom preserves the layout dimensions and native panning.
        await resizeVisualViewport(230, 60, width / 2);
        expect(await page.locator("body").evaluate((n) => n.getBoundingClientRect().height)).toBe(
          460,
        );
        await resizeVisualViewport(800, 0);
        await expect
          .poll(() => page.locator("body").evaluate((n) => n.getBoundingClientRect().height))
          .toBe(800);
      } finally {
        await page.close();
      }
    });
  }
});
