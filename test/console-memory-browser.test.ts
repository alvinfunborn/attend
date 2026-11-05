import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

const view: ConsoleView = {
  changelogMarkdown: "",
  sessions: [
    {
      vendor: "claude",
      sessionId: "soak",
      title: "Long running session",
      cwd: "/tmp/attend-soak",
      project: "soak",
      file: "/tmp/attend-soak.jsonl",
      ageDays: 0,
      lastTs: 100,
      prompts: 1,
      lastPrompt: "Run the task",
      pattern: "unknown",
      state: null,
      score: 5,
      reason: "",
      etaMin: 0,
      brief: "",
      tags: [],
    },
  ],
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
  tags: [],
};

describe("long running transcript memory", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });
  afterAll(async () => {
    await browser.close();
  });

  async function open(history: unknown[], diagnostics = false, clock = false) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
    if (clock) await page.clock.install();
    await page.addInitScript(() => {
      const g = globalThis as unknown as Record<string, unknown>;
      class Source {
        constructor() {
          g.__soakSource = this;
        }
        close() {}
      }
      Object.defineProperty(globalThis, "EventSource", { value: Source });
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        let html = renderConsole(view);
        if (diagnostics)
          html = html.replace(
            "  if(E2EE.enabled) startUnlockFlow();",
            `
          window.__cachedTools = function(){ return transcriptStateRef(SESS[0]).flatMap(function(m){return m.tools||[];}); };
          window.__warmModels = function(){
            for(var i=0;i<40;i++){
              var s=Object.assign({},SESS[0],{sessionId:'model-'+i,file:'/tmp/model-'+i});
              SESS.push(s);
              var history=[{role:'assistant',text:String(i)+':'+String(i%10).repeat(600000),tools:[]}];
              cacheTranscript(s,history);
              transcriptVirtualModelFor(history,s.sessionId);
            }
            var entries=Object.values(transcriptVirtualModelCaches);
            return {count:entries.length,bytes:entries.reduce(function(n,e){return n+e.cost;},0)};
          };
          if(E2EE.enabled) startUnlockFlow();`,
          );
        await route.fulfill({ contentType: "text/html", body: html });
      } else if (url.pathname === "/chat/messages") await route.fulfill({ json: history });
      else await route.fulfill({ json: { ok: true, items: [] } });
    });
    await page.goto("http://attend.test/");
    await page.locator('#list .item[data-session-id="soak"]').click();
    await expect.poll(() => page.locator("#msgs #ph").count()).toBe(0);
    return page;
  }

  async function emit(page: Page, event: Record<string, unknown>) {
    await page.evaluate((nextEvent) => {
      const source = (globalThis as unknown as Record<string, unknown>).__soakSource as {
        onmessage(e: { data: string }): void;
      };
      source.onmessage({
        data: JSON.stringify({
          kind: "session_event",
          sessionId: "soak",
          emittedAt: Date.now(),
          event: nextEvent,
        }),
      });
    }, event);
  }

  it("bounds derived model payloads independently of the primary transcript cache", async () => {
    const page = await open([], true);
    try {
      const retained = await page.evaluate(() =>
        (
          globalThis as unknown as { __warmModels(): { count: number; bytes: number } }
        ).__warmModels(),
      );
      expect(retained.count).toBeGreaterThan(0);
      expect(retained.bytes).toBeLessThanOrEqual(16 * 1024 * 1024);
    } finally {
      await page.close();
    }
  });

  it("omits ordinary tools from history without creating hidden DOM or virtual spacers", async () => {
    const page = await open([
      { role: "user", text: "Run the task" },
      {
        role: "assistant",
        text: "Working",
        tools: Array.from({ length: 600 }, (_, i) => ({
          id: `tool-${i}`,
          name: ["exec", "functions.exec_command", "apply_patch", "update_plan"][i % 4],
          input: { command: `step ${i}` },
          result: "output".repeat(100),
        })),
      },
    ]);
    try {
      await expect.poll(() => page.locator("#msgs .msg.assistant").textContent()).toBe("Working");
      expect(
        await page
          .locator("#msgs .toolc, #msgs .toolrow, #msgs .transcript-virtual-spacer")
          .count(),
      ).toBe(0);
      expect(await page.locator("#msgs .msg").count()).toBe(2);
      expect(await page.locator("#msgs").textContent()).not.toContain("output");
    } finally {
      await page.close();
    }
  });

  it("discards ordinary payloads from history and live caches even with an older server", async () => {
    const payload = "hidden-tool-data".repeat(100_000);
    const page = await open(
      [
        {
          role: "assistant",
          text: "Working",
          tools: [
            { id: "history-tool", name: "exec", input: payload, result: payload, historyId: "t_1" },
          ],
        },
      ],
      true,
    );
    try {
      await emit(page, {
        kind: "tool_use",
        id: "live-tool",
        name: "exec",
        input: { command: payload },
      });
      await emit(page, { kind: "tool_result", id: "live-tool", text: payload, isError: true });
      const tools = await page.evaluate(() =>
        (globalThis as unknown as { __cachedTools(): unknown[] }).__cachedTools(),
      );
      expect(tools).toEqual([
        {
          id: "history-tool",
          name: "exec",
          input: null,
          result: "",
          historyId: "t_1",
          historyOrdinal: undefined,
          historyIndex: undefined,
          isError: undefined,
        },
        {
          id: "live-tool",
          name: "exec",
          input: null,
          result: "",
          isError: true,
          historyId: undefined,
          historyOrdinal: undefined,
          historyIndex: undefined,
        },
      ]);
      expect(JSON.stringify(tools).length).toBeLessThan(300);
    } finally {
      await page.close();
    }
  });

  it("windows hundreds of text blocks within a single user turn", async () => {
    const page = await open([
      { role: "user", text: "Run the task" },
      ...Array.from({ length: 600 }, (_, i) => ({
        role: "assistant",
        text: `Progress ${i}. ${"detail ".repeat(24)}`,
        tools: [
          { id: `tool-${i}`, name: "exec", input: { command: `step ${i}` }, result: "output" },
        ],
      })),
    ]);
    try {
      await expect
        .poll(() => page.locator("#msgs").getAttribute("data-transcript-total-blocks"))
        .toBe("601");
      expect(await page.locator("#msgs .msg").count()).toBeLessThan(160);
      await page.locator("#msgs").evaluate((host) => {
        host.scrollTop = 0;
        host.dispatchEvent(new Event("scroll"));
      });
      await expect
        .poll(() => page.locator("#msgs .msg.assistant", { hasText: "Progress 0." }).count())
        .toBe(1);
      expect(await page.locator("#msgs .msg").count()).toBeLessThan(160);
      expect(await page.locator("#msgs .toolc").count()).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("bounds live DOM growth without navigation and preserves subsequent streamed text", async () => {
    const page = await open([{ role: "user", text: "Run the task" }]);
    try {
      for (let batch = 0; batch < 8; batch++) {
        await page.evaluate((offset) => {
          const source = (globalThis as unknown as Record<string, unknown>).__soakSource as {
            onmessage(e: { data: string }): void;
          };
          const emit = (event: unknown) =>
            source.onmessage({
              data: JSON.stringify({ kind: "session_event", sessionId: "soak", event }),
            });
          if (offset === 0) emit({ kind: "sync", turnActive: true });
          for (let i = offset; i < offset + 40; i++) {
            emit({ kind: "assistant_text", text: `Progress ${i}` });
            emit({
              kind: "tool_use",
              id: `live-${i}`,
              name: "exec",
              input: { command: `step ${i}` },
            });
            emit({ kind: "tool_result", id: `live-${i}`, text: "output".repeat(100) });
          }
        }, batch * 40);
        await page.waitForTimeout(40);
      }
      expect(await page.locator("#msgs .toolc").count()).toBe(0);
      await expect.poll(() => page.locator("#msgs .msg").count()).toBeLessThan(200);
      await page.evaluate(() => {
        const source = (globalThis as unknown as Record<string, unknown>).__soakSource as {
          onmessage(e: { data: string }): void;
        };
        for (const text of ["Final answer ", "still streams correctly"])
          source.onmessage({
            data: JSON.stringify({
              kind: "session_event",
              sessionId: "soak",
              event: { kind: "assistant_text", text },
            }),
          });
      });
      await expect
        .poll(() =>
          page
            .locator("#msgs .msg.assistant", { hasText: "Final answer still streams correctly" })
            .count(),
        )
        .toBe(1);
    } finally {
      await page.close();
    }
  }, 30_000);

  it("resets quiet for hidden tool calls and results even without assistant text", async () => {
    const page = await open([{ role: "user", text: "Run the task" }], false, true);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
    try {
      await emit(page, { kind: "sync", turnActive: true });
      await page.clock.runFor(12_000);
      await expect
        .poll(() => page.locator("#msgs .thinking .bubble").textContent())
        .toMatch(/waiting 0:1[12]/);

      await emit(page, {
        kind: "tool_use",
        id: "quiet-tool",
        name: "exec",
        input: null,
      });
      await page.clock.runFor(1_000);
      await expect
        .poll(() => page.locator("#msgs .thinking .bubble").textContent())
        .toMatch(/quiet 0:0[01]/);
      await expect
        .poll(() => page.locator('#list [data-session-id="soak"] .it-live-quiet').textContent())
        .toMatch(/quiet0:0[01]/);

      await page.clock.runFor(12_000);
      await expect
        .poll(() => page.locator("#msgs .thinking .bubble").textContent())
        .toMatch(/quiet 0:1[23]/);
      await emit(page, { kind: "tool_result", id: "quiet-tool", text: "", isError: false });
      await page.clock.runFor(1_000);
      await expect
        .poll(() => page.locator("#msgs .thinking .bubble").textContent())
        .toMatch(/quiet 0:0[01]/);
      expect(await page.locator("#msgs .toolc, #msgs .toolrow").count()).toBe(0);
      expect(await page.locator("#msgs .msg.assistant:not(.thinking)").count()).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("keeps interactive questions visible and usable among hidden tools", async () => {
    const page = await open([
      { role: "user", text: "Run the task" },
      {
        role: "assistant",
        text: "Choose an option",
        tools: [
          { id: "hidden", name: "exec", input: { cmd: "work" }, result: "done" },
          {
            id: "question",
            name: "functions.request_user_input_async",
            input: {
              questions: [{ title: "Which option?", options: ["First", "Second"] }],
            },
          },
        ],
      },
    ]);
    try {
      const question = page.locator('#msgs [data-tool-id="question"]');
      await expect.poll(() => question.locator(".q-submit").count()).toBe(1);
      expect(await question.locator(".q-submit").isEnabled()).toBe(true);
      expect(await page.locator("#msgs .toolc").count()).toBe(1);
      await emit(page, { kind: "tool_result", id: "question", text: '{"accepted":true}' });
      expect(await question.locator(".q-submit").isEnabled()).toBe(true);
      await emit(page, {
        kind: "tool_use",
        id: "later-hidden",
        name: "exec",
        input: { cmd: "more work" },
      });
      expect(await page.locator("#msgs .toolc").count()).toBe(1);
      await emit(page, { kind: "tool_result", id: "question", text: '{"answer":"First"}' });
      expect(await question.locator(".q-submit").isDisabled()).toBe(true);
    } finally {
      await page.close();
    }
  });
});
