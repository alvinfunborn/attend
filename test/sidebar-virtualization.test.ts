import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

const sessions: ConsoleView["sessions"] = Array.from({ length: 500 }, (_, index) => ({
  vendor: "claude",
  sessionId: `session-${index}`,
  title: `Session ${String(index).padStart(4, "0")}`,
  lastPrompt: `latest prompt ${index}`,
  cwd: "/tmp/project",
  project: "project",
  file: `/tmp/session-${index}.jsonl`,
  ageDays: 0,
  lastTs: 500 - index,
  prompts: 1,
  pattern: "unknown",
  state: null,
  score: 1,
  reason: "",
  etaMin: 10,
  brief: `Session ${String(index).padStart(4, "0")}`,
  tags: [],
}));

const view: ConsoleView = {
  sessions,
  knownDirs: ["/tmp/project"],
  scopeRoots: [],
  defaultNewDir: "/tmp/project",
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

describe("sidebar virtualization", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it("mounts a bounded window, reuses rows, and searches the full client set", async () => {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.addInitScript(() => {
      class StubEventSource {
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: renderConsole(view) });
      } else if (url.pathname === "/search") {
        await route.fulfill({ json: { results: [] } });
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    });
    await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });

    const list = page.locator("#list");
    await expect.poll(() => list.getAttribute("class")).toContain("virtualized");
    expect(await page.locator("#list .item").count()).toBeLessThan(80);
    expect(await list.evaluate((node) => node.scrollHeight > node.clientHeight * 20)).toBe(true);

    const first = await page.locator("#list .item").first().elementHandle();
    if (!first) throw new Error("missing first virtual row");
    await first.evaluate((node) => {
      (node as unknown as { reuseMarker?: string }).reuseMarker = "kept";
    });

    await list.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
      node.dispatchEvent(new Event("scroll"));
    });
    await expect
      .poll(() => page.locator("#list .item", { hasText: "Session 0499" }).count())
      .toBe(1);
    expect(await page.locator("#list .item").count()).toBeLessThan(80);

    await list.evaluate((node) => {
      node.scrollTop = 0;
      node.dispatchEvent(new Event("scroll"));
    });
    await expect
      .poll(() =>
        first.evaluate((node) => ({
          connected: node.isConnected,
          marker: (node as unknown as { reuseMarker?: string }).reuseMarker,
        })),
      )
      .toEqual({ connected: true, marker: "kept" });

    await page.locator("#search").fill("Session 0499");
    await expect.poll(() => page.locator("#list .item").count()).toBe(1);
    expect(await page.locator("#list .item").textContent()).toContain("Session 0499");
    await page.close();
  });
});
