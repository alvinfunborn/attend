import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { ChatEngine, type QueryFn } from "../src/chat/engine.js";
import type { UiEvent } from "../src/chat/events.js";

// Fresh generator per call: init → assistant → result.
const fakeQuery = ((_args: unknown) => {
  async function* gen() {
    yield { type: "system", subtype: "init", session_id: "sess-9" };
    yield {
      type: "assistant",
      message: { content: [{ type: "text", text: "hi" }] },
      session_id: "sess-9",
    };
    yield { type: "result", subtype: "success", result: "hi" };
  }
  return gen();
}) as unknown as QueryFn;

describe("ChatEngine", () => {
  it("starts a run, resolves the session id, and does not replay finished-turn buffer to late subscribers", async () => {
    const engine = new ChatEngine(fakeQuery);
    const id = await engine.start({ cwd: ".", firstText: "hello" });
    expect(id).toBe("sess-9");

    // start() resolves at the init event; let the rest of the stream drain
    await new Promise((r) => setTimeout(r, 50));

    // Finished turns should come from the persisted transcript, not be replayed
    // again over SSE when a tab re-opens later.
    const got: UiEvent[] = [];
    engine.subscribe(id, (ev) => got.push(ev));
    expect(got).toEqual([{ kind: "sync", turnActive: false, startedAt: expect.any(Number) }]);
  });

  it("send returns false for an unknown session", () => {
    const engine = new ChatEngine(fakeQuery);
    expect(engine.send("nope", { text: "x" })).toBe(false);
  });

  it("sends Claude attachment blocks alongside the text summary", async () => {
    const seen: unknown[] = [];
    const attachmentQuery = ((args: { prompt: AsyncIterable<unknown> }) => {
      async function* gen() {
        yield { type: "system", subtype: "init", session_id: "sess-att" };
        for await (const msg of args.prompt) {
          seen.push(msg);
          yield { type: "result", subtype: "success", result: "ok", session_id: "sess-att" };
          return;
        }
      }
      return gen();
    }) as unknown as QueryFn;

    const engine = new ChatEngine(attachmentQuery);
    const id = await engine.start({ cwd: "." });
    await new Promise((r) => setTimeout(r, 20));

    expect(
      engine.send(id, {
        text: "See attachments",
        attachments: [
          { kind: "image", name: "diagram.png", mediaType: "image/png", data: "abcd" },
          { kind: "document", name: "brief.pdf", mediaType: "application/pdf", data: "efgh" },
          { kind: "text", name: "notes.md", text: "# hello" },
        ],
      }),
    ).toBe(true);
    await new Promise((r) => setTimeout(r, 20));

    expect(seen[0]).toMatchObject({
      type: "user",
      message: {
        role: "user",
        content: [
          { type: "text", text: "See attachments" },
          { type: "image", source: { type: "base64", media_type: "image/png", data: "abcd" } },
          {
            type: "document",
            title: "brief.pdf",
            source: { type: "base64", media_type: "application/pdf", data: "efgh" },
          },
          {
            type: "document",
            title: "notes.md",
            source: { type: "text", media_type: "text/plain", data: "# hello" },
          },
        ],
      },
      parent_tool_use_id: null,
    });
  });

  it("replays only the current turn buffer to subscribers during a follow-up turn", async () => {
    let releaseSecond!: () => void;
    const secondCanFinish = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const replayQuery = ((args: { prompt: AsyncIterable<unknown> }) => {
      async function* gen() {
        yield { type: "system", subtype: "init", session_id: "sess-replay" };
        let n = 0;
        for await (const _msg of args.prompt) {
          n += 1;
          if (n === 1) {
            yield {
              type: "assistant",
              message: { content: [{ type: "text", text: "old reply" }] },
              session_id: "sess-replay",
            };
            yield { type: "result", subtype: "success", result: "old", session_id: "sess-replay" };
          } else {
            yield {
              type: "assistant",
              message: { content: [{ type: "text", text: "new reply" }] },
              session_id: "sess-replay",
            };
            await secondCanFinish;
            yield { type: "result", subtype: "success", result: "new", session_id: "sess-replay" };
            return;
          }
        }
      }
      return gen();
    }) as unknown as QueryFn;
    const engine = new ChatEngine(replayQuery);
    const id = await engine.start({ cwd: ".", firstText: "first" });
    await new Promise((r) => setTimeout(r, 20));

    expect(engine.send(id, { text: "second" })).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    const got: UiEvent[] = [];
    const unsub = engine.subscribe(id, (ev) => got.push(ev));
    releaseSecond();
    await new Promise((r) => setTimeout(r, 20));
    unsub();

    expect(got).toContainEqual({ kind: "assistant_text", text: "new reply" });
    expect(got).not.toContainEqual({ kind: "assistant_text", text: "old reply" });
  });

  it("materializes Excel attachments for Claude and sends the local path as text", async () => {
    const seen: unknown[] = [];
    const fileChecks: boolean[] = [];
    const attachmentQuery = ((args: { prompt: AsyncIterable<unknown> }) => {
      async function* gen() {
        yield { type: "system", subtype: "init", session_id: "sess-xlsx" };
        for await (const msg of args.prompt) {
          seen.push(msg);
          const text = String(
            ((msg as { message?: { content?: Array<{ text?: string }> } }).message?.content?.[0]
              ?.text ?? ""),
          );
          const filePath = text.match(/Local path: (.+)/)?.[1]?.trim() ?? "";
          fileChecks.push(!!filePath && fs.existsSync(filePath));
          yield { type: "result", subtype: "success", result: "ok", session_id: "sess-xlsx" };
          return;
        }
      }
      return gen();
    }) as unknown as QueryFn;

    const engine = new ChatEngine(attachmentQuery);
    const id = await engine.start({ cwd: "." });
    await new Promise((r) => setTimeout(r, 20));

    expect(
      engine.send(id, {
        text: "See sheet",
        attachments: [
          {
            kind: "file",
            name: "budget.xlsx",
            mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            data: "aGVsbG8=",
          },
        ],
      }),
    ).toBe(true);
    await new Promise((r) => setTimeout(r, 20));

    expect(seen[0]).toMatchObject({
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "text",
            text: expect.stringContaining("[Attached file: budget.xlsx]"),
          },
        ],
      },
      parent_tool_use_id: null,
    });
    expect(fileChecks).toEqual([true]);
  });

  it("sends Claude attachment blocks on the very first turn too", async () => {
    const seen: unknown[] = [];
    const attachmentQuery = ((args: { prompt: AsyncIterable<unknown> }) => {
      async function* gen() {
        yield { type: "system", subtype: "init", session_id: "sess-att-first" };
        for await (const msg of args.prompt) {
          seen.push(msg);
          yield {
            type: "result",
            subtype: "success",
            result: "ok",
            session_id: "sess-att-first",
          };
          return;
        }
      }
      return gen();
    }) as unknown as QueryFn;

    const engine = new ChatEngine(attachmentQuery);
    const id = await engine.start({
      cwd: ".",
      firstText: "",
      firstAttachments: [{ kind: "text", name: "notes.md", text: "# hello fork" }],
    });
    expect(id).toBe("sess-att-first");
    await new Promise((r) => setTimeout(r, 20));

    expect(seen[0]).toMatchObject({
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "document",
            title: "notes.md",
            source: { type: "text", media_type: "text/plain", data: "# hello fork" },
          },
        ],
      },
      parent_tool_use_id: null,
    });
  });

  it("answers AskUserQuestion with a tool_result payload and clears activeSessions while waiting", async () => {
    const seen: unknown[] = [];
    const questionQuery = ((args: { prompt: AsyncIterable<unknown> }) => {
      async function* gen() {
        yield { type: "system", subtype: "init", session_id: "sess-q" };
        yield {
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                id: "toolu-q1",
                name: "AskUserQuestion",
                input: {
                  questions: [
                    {
                      question: "Pick one?",
                      header: "Choice",
                      multiSelect: false,
                      options: [
                        { label: "A", description: "first" },
                        { label: "B", description: "second" },
                      ],
                    },
                  ],
                },
              },
            ],
          },
          session_id: "sess-q",
        };
        for await (const msg of args.prompt) {
          seen.push(msg);
          if (seen.length === 2) {
            yield { type: "result", subtype: "success", result: "done", session_id: "sess-q" };
            return;
          }
        }
      }
      return gen();
    }) as unknown as QueryFn;

    const engine = new ChatEngine(questionQuery);
    const id = await engine.start({ cwd: ".", firstText: "hello" });
    await new Promise((r) => setTimeout(r, 20));

    expect(engine.activeSessions()).toHaveLength(0);
    expect(
      engine.answer(id, {
        toolUseId: "toolu-q1",
        text: 'Your questions have been answered: "Pick one?"="A".',
        toolUseResult: {
          questions: [
            {
              question: "Pick one?",
              header: "Choice",
              multiSelect: false,
              options: [
                { label: "A", description: "first" },
                { label: "B", description: "second" },
              ],
            },
          ],
          answers: { "Pick one?": "A" },
        },
      }),
    ).toBe(true);
    await new Promise((r) => setTimeout(r, 20));

    expect(seen[0]).toMatchObject({
      type: "user",
      message: { role: "user", content: "hello" },
      parent_tool_use_id: null,
    });
    expect(seen[1]).toMatchObject({
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            content: 'Your questions have been answered: "Pick one?"="A".',
            tool_use_id: "toolu-q1",
          },
        ],
      },
      parent_tool_use_id: "toolu-q1",
      tool_use_result: { answers: { "Pick one?": "A" } },
    });
  });

  it("does not interrupt the SDK stream while waiting for an AskUserQuestion answer", async () => {
    let interrupted = false;
    const questionQuery = (() => {
      const it = (async function* () {
        yield { type: "system", subtype: "init", session_id: "sess-q-no-interrupt" };
        yield {
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                id: "toolu-q-no-interrupt",
                name: "AskUserQuestion",
                input: {
                  questions: [
                    {
                      question: "Pick one?",
                      options: [{ label: "A", description: "first" }],
                    },
                  ],
                },
              },
            ],
          },
          session_id: "sess-q-no-interrupt",
        };
        await new Promise(() => {});
      })() as AsyncGenerator<unknown> & { interrupt: () => Promise<void> };
      it.interrupt = async () => {
        interrupted = true;
      };
      return it;
    }) as unknown as QueryFn;

    const engine = new ChatEngine(questionQuery);
    await engine.start({ cwd: ".", firstText: "hello" });
    await new Promise((r) => setTimeout(r, 20));

    expect(interrupted).toBe(false);
    expect(engine.activeSessions()).toHaveLength(0);
  });

  it("does not surface continuation after AskUserQuestion until the user answers", async () => {
    const questionQuery = (() => {
      async function* gen() {
        yield { type: "system", subtype: "init", session_id: "sess-q-wait" };
        yield {
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                id: "toolu-q-wait",
                name: "AskUserQuestion",
                input: {
                  questions: [
                    {
                      question: "Pick one?",
                      header: "Choice",
                      multiSelect: false,
                      options: [
                        { label: "A", description: "first" },
                        { label: "B", description: "second" },
                      ],
                    },
                  ],
                },
              },
            ],
          },
          session_id: "sess-q-wait",
        };
        yield {
          type: "user",
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                content: "Answer questions?",
                tool_use_id: "toolu-q-wait",
                is_error: true,
              },
            ],
          },
          session_id: "sess-q-wait",
        };
        yield {
          type: "assistant",
          message: { content: [{ type: "text", text: "continuing without the answer" }] },
          session_id: "sess-q-wait",
        };
        yield { type: "result", subtype: "success", result: "done", session_id: "sess-q-wait" };
      }
      return gen();
    }) as unknown as QueryFn;

    const engine = new ChatEngine(questionQuery);
    const id = await engine.start({ cwd: ".", firstText: "hello" });
    await new Promise((r) => setTimeout(r, 20));

    const replayed: unknown[] = [];
    engine.subscribe(id, (ev) => replayed.push(ev));

    expect(replayed).toContainEqual({
      kind: "tool_use",
      id: "toolu-q-wait",
      name: "AskUserQuestion",
      input: expect.any(Object),
    });
    expect(replayed).not.toContainEqual(
      expect.objectContaining({ kind: "tool_result", text: "Answer questions?" }),
    );
    expect(replayed).not.toContainEqual(
      expect.objectContaining({ kind: "assistant_text", text: "continuing without the answer" }),
    );
    expect(replayed).not.toContainEqual(expect.objectContaining({ kind: "result" }));
  });

  it("fires onTurnEnd with the session id when a turn completes", async () => {
    const engine = new ChatEngine(fakeQuery);
    const ended: string[] = [];
    engine.onTurnEnd((sid) => ended.push(sid));
    await engine.start({ cwd: ".", firstText: "hello" });
    await new Promise((r) => setTimeout(r, 50));
    expect(ended).toContain("sess-9");
  });

  it("interrupt() calls the SDK stream's interrupt for a live run", async () => {
    let interrupted = false;
    // A query that opens (emits init) then stays live, exposing interrupt().
    const interruptible = ((_args: unknown) => {
      const it = (async function* () {
        yield { type: "system", subtype: "init", session_id: "sess-int" };
        await new Promise(() => {}); // keep the run live (never completes)
      })() as AsyncGenerator<unknown> & { interrupt: () => Promise<void> };
      it.interrupt = async () => {
        interrupted = true;
      };
      return it;
    }) as unknown as QueryFn;

    const engine = new ChatEngine(interruptible);
    const id = await engine.start({ cwd: ".", firstText: "go" });
    expect(await engine.interrupt(id)).toBe(true);
    expect(interrupted).toBe(true);
    expect(engine.activeSessions()).toHaveLength(0);
  });

  it("interrupt() emits one local terminal event and ignores a late SDK result", async () => {
    let interrupted = false;
    let releaseLateResult!: () => void;
    const lateResult = new Promise<void>((resolve) => {
      releaseLateResult = resolve;
    });
    const interruptible = ((_args: unknown) => {
      const it = (async function* () {
        yield { type: "system", subtype: "init", session_id: "sess-late-int" };
        await lateResult;
        yield {
          type: "result",
          subtype: "success",
          result: "late",
          session_id: "sess-late-int",
        };
      })() as AsyncGenerator<unknown> & { interrupt: () => Promise<void> };
      it.interrupt = async () => {
        interrupted = true;
      };
      return it;
    }) as unknown as QueryFn;

    const engine = new ChatEngine(interruptible);
    const ended: string[] = [];
    engine.onTurnEnd((sid) => ended.push(sid));
    const id = await engine.start({ cwd: ".", firstText: "go" });
    const got: UiEvent[] = [];
    const unsub = engine.subscribe(id, (ev) => got.push(ev));

    expect(await engine.interrupt(id)).toBe(true);
    releaseLateResult();
    await new Promise((r) => setTimeout(r, 20));
    unsub();

    expect(interrupted).toBe(true);
    expect(got.filter((ev) => ev.kind === "result")).toHaveLength(1);
    expect(ended).toEqual(["sess-late-int"]);
  });

  it("interrupt() clears active state even when the SDK interrupt rejects", async () => {
    const interruptible = (() => {
      const it = (async function* () {
        yield { type: "system", subtype: "init", session_id: "sess-reject-int" };
        await new Promise(() => {});
      })() as AsyncGenerator<unknown> & { interrupt: () => Promise<void> };
      it.interrupt = async () => {
        throw new Error("sdk interrupt failed");
      };
      return it;
    }) as unknown as QueryFn;

    const engine = new ChatEngine(interruptible);
    const id = await engine.start({ cwd: ".", firstText: "go" });
    const got: UiEvent[] = [];
    engine.subscribe(id, (ev) => got.push(ev));

    expect(await engine.interrupt(id)).toBe(true);

    expect(engine.activeSessions()).toHaveLength(0);
    expect(got).toContainEqual({ kind: "result", ok: false, text: "interrupted" });
  });

  it("interrupt() returns false for an unknown or non-interruptible session", async () => {
    const engine = new ChatEngine(fakeQuery);
    expect(await engine.interrupt("nope")).toBe(false);
  });

  it("parks a subscriber on a not-yet-live run and attaches it on resume", async () => {
    // Mirrors a server restart: the SSE reconnects (subscribes) before the run
    // exists, then a send resumes it. The parked subscriber must catch the stream.
    const engine = new ChatEngine(fakeQuery);
    const got: UiEvent[] = [];
    const unsub = engine.subscribe("sess-9", (ev) => got.push(ev));
    expect(got).toHaveLength(0); // nothing live yet

    await engine.start({ resume: "sess-9", cwd: ".", firstText: "again" });
    await new Promise((r) => setTimeout(r, 50));

    expect(got.some((e) => e.kind === "assistant_text")).toBe(true);
    expect(got.some((e) => e.kind === "result")).toBe(true);
    unsub(); // must not throw whether parked or attached
  });

  it("activeSessions lists sessions mid-turn and drops them once the turn ends", async () => {
    // A run that stays live (turn never completes) reports as active…
    const liveForever = ((_args: unknown) => {
      const it = (async function* () {
        yield { type: "system", subtype: "init", session_id: "sess-live" };
        await new Promise(() => {});
      })() as AsyncGenerator<unknown> & { interrupt: () => Promise<void> };
      it.interrupt = async () => {};
      return it;
    }) as unknown as QueryFn;

    const live = new ChatEngine(liveForever);
    const id = await live.start({ cwd: ".", firstText: "go" });
    expect(live.activeSessions()).toContain(id);

    // …while a run that completes (fakeQuery emits result) drops off the list.
    const done = new ChatEngine(fakeQuery);
    await done.start({ cwd: ".", firstText: "hello" });
    await new Promise((r) => setTimeout(r, 50));
    expect(done.activeSessions()).toHaveLength(0);
  });

  it("finishes a turn whose SDK stream streams the answer then hangs silently (stall watchdog)", async () => {
    // The exact stuck-"Generating…" bug: full answer arrives, but the closing
    // `result` frame never does and the stream never closes (dropped socket /
    // orphaned subprocess). Without the watchdog turnActive stays true forever.
    let interrupted = false;
    const stalls = ((_args: unknown) => {
      const it = (async function* () {
        yield { type: "system", subtype: "init", session_id: "sess-stall" };
        yield {
          type: "assistant",
          message: { content: [{ type: "text", text: "here is the full answer" }] },
          session_id: "sess-stall",
        };
        await new Promise(() => {}); // never yields result, never closes
      })() as AsyncGenerator<unknown> & { interrupt: () => Promise<void> };
      it.interrupt = async () => {
        interrupted = true;
      };
      return it;
    }) as unknown as QueryFn;

    const engine = new ChatEngine(stalls, 30); // 30ms watchdog for the test
    const ended: string[] = [];
    engine.onTurnEnd((sid) => ended.push(sid));
    const got: UiEvent[] = [];
    const id = await engine.start({ cwd: ".", firstText: "go" });
    engine.subscribe(id, (ev) => got.push(ev));
    expect(engine.activeSessions()).toContain(id);

    await new Promise((r) => setTimeout(r, 80)); // past the watchdog

    expect(engine.activeSessions()).toHaveLength(0); // turnActive cleared server-side
    expect(ended).toEqual(["sess-stall"]); // daemon turn-end still fires
    expect(interrupted).toBe(true); // orphaned query torn down
    expect(got).toContainEqual({ kind: "result", ok: false, text: "stalled" });
  });

  it("does not trip the watchdog while events keep streaming (reset on activity)", async () => {
    // Gaps (25ms) stay under the watchdog (40ms), so it keeps resetting and the
    // real result — not a synthetic stall — ends the turn.
    const steady = ((_args: unknown) => {
      async function* gen() {
        yield { type: "system", subtype: "init", session_id: "sess-steady" };
        yield {
          type: "assistant",
          message: { content: [{ type: "text", text: "a" }] },
          session_id: "sess-steady",
        };
        await new Promise((r) => setTimeout(r, 25));
        yield {
          type: "assistant",
          message: { content: [{ type: "text", text: "b" }] },
          session_id: "sess-steady",
        };
        await new Promise((r) => setTimeout(r, 25));
        yield { type: "result", subtype: "success", result: "ok", session_id: "sess-steady" };
      }
      return gen();
    }) as unknown as QueryFn;

    const engine = new ChatEngine(steady, 40);
    const got: UiEvent[] = [];
    const id = await engine.start({ cwd: ".", firstText: "go" });
    engine.subscribe(id, (ev) => got.push(ev));

    await new Promise((r) => setTimeout(r, 140));

    expect(engine.activeSessions()).toHaveLength(0);
    // The genuine result closed the turn; the watchdog never manufactured one.
    expect(got.filter((e) => e.kind === "result")).toEqual([
      { kind: "result", ok: true, text: "ok" },
    ]);
  });

  it("emits a sync snapshot so a reconnecting subscriber learns the turn state", async () => {
    const engine = new ChatEngine(fakeQuery);
    await engine.start({ cwd: ".", firstText: "hello" });
    await new Promise((r) => setTimeout(r, 50)); // turn completes (result emitted)

    const got: UiEvent[] = [];
    engine.subscribe("sess-9", (ev) => got.push(ev));
    const sync = got.find((e) => e.kind === "sync");
    // finished → not generating (startedAt may linger but the client ignores it
    // unless turnActive, so assert the fields that matter)
    expect(sync).toMatchObject({ kind: "sync", turnActive: false });
  });
});
