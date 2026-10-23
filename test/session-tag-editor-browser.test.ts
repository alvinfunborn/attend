import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

function tagEditorView(count: number): ConsoleView {
  return {
    changelogMarkdown: "",
    sessions: Array.from({ length: count }, (_, index) => ({
      vendor: "claude",
      sessionId: `s${index + 1}`,
      title: `Session ${index + 1}`,
      brief: `Session ${index + 1}`,
      lastPrompt: "Original prompt",
      cwd: "/tmp/project",
      project: "project",
      file: `/tmp/session-${index + 1}.jsonl`,
      ageDays: 0,
      lastTs: count - index,
      prompts: 1,
      pattern: "unknown",
      state: null,
      score: 1,
      reason: "",
      etaMin: 10,
      tags: [],
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
    tags: ["work", "later"],
    vaultState: { layout: { sessionPanelOpen: true } },
    sessionIndexEpoch: "tag-editor",
    sessionIndexRevision: 1,
  };
}

describe("session tag editor refreshes", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it.each([
    { surface: "sidebar", host: "#list", count: 2 },
    { surface: "panel", host: "#sessionPanelList", count: 2 },
    { surface: "virtual sidebar", host: "#list", count: 100 },
    { surface: "virtual panel", host: "#sessionPanelList", count: 100 },
  ])(
    "keeps a $surface tag draft through index patches and full refreshes",
    async ({ host, count }) => {
      const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
      page.setDefaultTimeout(3_000);
      const view = tagEditorView(count);
      const writes: { session: string | null; tags: string[] }[] = [];
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        class StubEventSource {
          static readonly CLOSED = 2;
          onmessage: ((event: { data: string }) => void) | null = null;
          constructor() {
            (globalThis as unknown as Record<string, unknown>).__tagEditorBus = this;
          }
          close() {}
        }
        Object.defineProperty(globalThis, "EventSource", { value: StubEventSource });
      });
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/") {
          await route.fulfill({ contentType: "text/html", body: renderConsole(view) });
        } else if (url.pathname === "/session/tags") {
          const { tags } = route.request().postDataJSON() as { tags: string[] };
          writes.push({ session: url.searchParams.get("session"), tags });
          await route.fulfill({
            json: { ok: true, sessionTags: tags, tags: [...view.tags, ...tags] },
          });
        } else {
          await route.fulfill({ json: { ok: true, items: [] } });
        }
      });

      try {
        await page.goto("http://attend.test/", { waitUntil: "domcontentloaded" });
        const card = page.locator(`${host} .item[data-session-id="s1"]`);
        const add = card.locator(".it-tagadd");
        const input = page.locator("#sessionTagInput");
        const popover = page.locator("#sessionTagPopover");
        await add.click();
        await input.fill("draft tag");
        await input.evaluate((node) => {
          const field = node as unknown as { setSelectionRange(start: number, end: number): void };
          field.setSelectionRange(2, 5);
          (globalThis as unknown as Record<string, unknown>).__originalTagInput = node;
          node.dispatchEvent(new Event("compositionstart", { bubbles: true }));
        });
        const draftState = () =>
          input.evaluate((node) => {
            const field = node as unknown as {
              value: string;
              selectionStart: number;
              selectionEnd: number;
            };
            return {
              value: field.value,
              start: field.selectionStart,
              end: field.selectionEnd,
              focused: node.ownerDocument.activeElement === node,
              original:
                (globalThis as unknown as Record<string, unknown>).__originalTagInput === node,
            };
          });
        const expectedDraft = {
          value: "draft tag",
          start: 2,
          end: 5,
          focused: true,
          original: true,
        };

        for (const full of [false, true]) {
          const oldButton = await add.elementHandle();
          const title = full ? "Full refresh title" : "Patched title";
          const updated = view.sessions.map((session, index) =>
            index === 0
              ? { ...session, title, brief: title }
              : { ...session, lastTs: index === 1 ? count + 1 : session.lastTs },
          );
          await page.evaluate(
            (message) => {
              const source = (globalThis as unknown as Record<string, unknown>).__tagEditorBus as {
                onmessage: ((event: { data: string }) => void) | null;
              };
              source.onmessage?.({ data: JSON.stringify(message) });
            },
            {
              kind: "session_index",
              epoch: "tag-editor",
              pending: false,
              revision: full ? 3 : 2,
              ...(full
                ? { sessions: updated }
                : { baseRevision: 1, upserts: [updated[0]], removedSessionKeys: [] }),
              tags: view.tags,
            },
          );
          await expect.poll(() => card.locator(".it-title").textContent()).toContain(title);
          expect(await oldButton?.evaluate((node) => node.isConnected)).toBe(false);
          // Both ordinary typing and viewport movement used to close the popover
          // because its anchor still pointed to the detached +tag button.
          await input.dispatchEvent("input");
          await input.evaluate((node) => {
            node.ownerDocument.defaultView?.dispatchEvent(new Event("resize"));
            node.ownerDocument.defaultView?.dispatchEvent(new Event("scroll"));
          });
          expect(await popover.isVisible()).toBe(true);
          expect(await draftState()).toEqual(expectedDraft);
          expect(await add.getAttribute("aria-expanded")).toBe("true");
        }

        if (count > 80) {
          // A reorder can move the edited session completely outside the mounted
          // window. Keep the editor usable until its card is mounted again.
          for (const offscreen of [true, false]) {
            await page.evaluate(
              (message) => {
                const source = (globalThis as unknown as Record<string, unknown>)
                  .__tagEditorBus as {
                  onmessage: ((event: { data: string }) => void) | null;
                };
                source.onmessage?.({ data: JSON.stringify(message) });
              },
              {
                kind: "session_index",
                epoch: "tag-editor",
                pending: false,
                revision: offscreen ? 4 : 5,
                sessions: view.sessions.map((session, index) =>
                  index === 0 && offscreen ? { ...session, lastTs: -1 } : session,
                ),
                tags: view.tags,
              },
            );
            await expect.poll(() => card.count()).toBe(offscreen ? 0 : 1);
            await input.dispatchEvent("input");
            expect(await popover.isVisible()).toBe(true);
            expect(await draftState()).toEqual(expectedDraft);
          }
          expect(await add.getAttribute("aria-expanded")).toBe("true");
        }

        await input.dispatchEvent("compositionend");
        await input.fill("fresh tag");
        await input.press("Enter");
        await expect.poll(() => writes).toEqual([{ session: "s1", tags: ["fresh tag"] }]);
        expect(await popover.isVisible()).toBe(false);
        await expect.poll(() => card.locator(".it-tags").textContent()).toContain("fresh tag");

        await add.click();
        await input.fill("discard this");
        await input.press("Escape");
        expect(await popover.isVisible()).toBe(false);
        expect(await input.inputValue()).toBe("");
        expect(writes).toHaveLength(1);
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
    20_000,
  );
});
