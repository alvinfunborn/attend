import { describe, expect, it } from "vitest";
import { CodexEngine } from "../src/chat/codex/engine.js";
import type { CodexEvent } from "../src/chat/codex/events.js";
import type { CodexExecFn, CodexExecRequest } from "../src/chat/codex/exec.js";
import type { UiEvent } from "../src/chat/events.js";

/** A fake exec that replays one scripted event list per turn and records requests. */
function fakeExec(turns: CodexEvent[][]): { fn: CodexExecFn; calls: CodexExecRequest[] } {
  const calls: CodexExecRequest[] = [];
  let i = 0;
  const fn: CodexExecFn = (req) => {
    calls.push(req);
    const events = turns[i++] ?? [];
    return {
      events: (async function* () {
        for (const e of events) yield e;
      })(),
      kill: () => {},
    };
  };
  return { fn, calls };
}

const turn = (id: string, text: string, withThread = true): CodexEvent[] => [
  ...(withThread ? [{ type: "thread.started", thread_id: id } as CodexEvent] : []),
  { type: "turn.started" },
  { type: "item.completed", item: { type: "agent_message", text } },
  { type: "turn.completed" },
];

const currentTurn = (id: string, text: string): CodexEvent[] => [
  { type: "session_meta", payload: { id, cwd: "." } },
  {
    type: "response_item",
    payload: {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text }],
    },
  },
  { type: "event_msg", payload: { type: "task_complete" } },
];

describe("CodexEngine", () => {
  it("publishes normalized events to the global session event bus", async () => {
    const { fn } = fakeExec([turn("cx-1", "hello")]);
    const engine = new CodexEngine(fn);
    const received: Array<{ sessionId: string; event: UiEvent; clientSessionId?: string }> = [];
    engine.onEvent((sessionId, event, clientSessionId) =>
      received.push({ sessionId, event, clientSessionId }),
    );

    await engine.start({ cwd: ".", firstText: "go", clientSessionId: "branch-ui-2" });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(received).toContainEqual({
      sessionId: "cx-1",
      event: { kind: "assistant_text", text: "hello" },
      clientSessionId: "branch-ui-2",
    });
    expect(received.some(({ event }) => event.kind === "result")).toBe(true);
  });

  it("starts a new session, resolves the thread id, and does not replay finished-turn buffer to late subscribers", async () => {
    const { fn, calls } = fakeExec([turn("cx-1", "hi")]);
    const engine = new CodexEngine(fn);
    const id = await engine.start({ cwd: ".", firstText: "hello" });
    expect(id).toBe("cx-1");
    // first turn is a fresh exec (no resume), prompt is the first message
    expect(calls[0]).toMatchObject({ resume: undefined, prompt: "hello", cwd: "." });

    await new Promise((r) => setTimeout(r, 20));
    const got: UiEvent[] = [];
    engine.subscribe(id, (ev) => got.push(ev));
    expect(got).toEqual([{ kind: "sync", turnActive: false, startedAt: expect.any(Number) }]);
  });

  it("rejects a new session with no first message (Codex needs a turn to mint an id)", async () => {
    const { fn } = fakeExec([]);
    const engine = new CodexEngine(fn);
    await expect(engine.start({ cwd: "." })).rejects.toThrow(/first message/);
  });

  it("send runs a follow-up turn via exec resume, preserving the thread id", async () => {
    const { fn, calls } = fakeExec([turn("cx-1", "one"), turn("cx-1", "two")]);
    const engine = new CodexEngine(fn);
    const id = await engine.start({ cwd: ".", firstText: "first" });
    await new Promise((r) => setTimeout(r, 20));

    expect(engine.send(id, { text: "second" })).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    // the second turn resumes the same thread
    expect(calls[1]).toMatchObject({ resume: "cx-1", prompt: "second" });
  });

  it("replays only the current turn buffer to subscribers during a follow-up turn", async () => {
    let releaseSecond!: () => void;
    const secondCanFinish = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    let turnIndex = 0;
    const fn: CodexExecFn = () => {
      turnIndex += 1;
      if (turnIndex === 1) {
        return {
          events: (async function* () {
            yield { type: "thread.started", thread_id: "cx-replay" } as CodexEvent;
            yield { type: "item.completed", item: { type: "agent_message", text: "old reply" } };
            yield { type: "turn.completed" } as CodexEvent;
          })(),
          kill: () => {},
        };
      }
      return {
        events: (async function* () {
          yield { type: "turn.started" } as CodexEvent;
          yield { type: "item.completed", item: { type: "agent_message", text: "new reply" } };
          await secondCanFinish;
          yield { type: "turn.completed" } as CodexEvent;
        })(),
        kill: () => {},
      };
    };
    const engine = new CodexEngine(fn);
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

  it("accepts a queued follow-up sent immediately from a result subscriber", async () => {
    let releaseFirst!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const calls: CodexExecRequest[] = [];
    let turnIndex = 0;
    const fn: CodexExecFn = (req) => {
      calls.push(req);
      turnIndex += 1;
      if (turnIndex === 1) {
        return {
          events: (async function* () {
            yield { type: "thread.started", thread_id: "cx-queue" } as CodexEvent;
            yield { type: "turn.started" } as CodexEvent;
            await firstCanFinish;
            yield { type: "item.completed", item: { type: "agent_message", text: "one" } };
            yield { type: "turn.completed" } as CodexEvent;
          })(),
          kill: () => {},
        };
      }
      return {
        events: (async function* () {
          yield { type: "turn.started" } as CodexEvent;
          yield { type: "item.completed", item: { type: "agent_message", text: "two" } };
          yield { type: "turn.completed" } as CodexEvent;
        })(),
        kill: () => {},
      };
    };
    const engine = new CodexEngine(fn);
    const id = await engine.start({ cwd: ".", firstText: "first" });
    let sentFromResult: boolean | null = null;
    engine.subscribe(id, (ev) => {
      if (ev.kind === "result" && sentFromResult === null)
        sentFromResult = engine.send(id, { text: "queued" });
    });

    releaseFirst();
    await new Promise((r) => setTimeout(r, 20));

    expect(sentFromResult).toBe(true);
    expect(calls[1]).toMatchObject({ resume: "cx-queue", prompt: "queued" });
  });

  it("preserves model, effort, and speed across the first turn and follow-up turns", async () => {
    const { fn, calls } = fakeExec([turn("cx-1", "one"), turn("cx-1", "two")]);
    const engine = new CodexEngine(fn);
    const id = await engine.start({
      cwd: ".",
      firstText: "first",
      model: "gpt-5.2-codex",
      effort: "high",
      speed: "priority",
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(engine.send(id, { text: "second" })).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls[0]).toMatchObject({
      model: "gpt-5.2-codex",
      effort: "high",
      speed: "priority",
    });
    expect(calls[1]).toMatchObject({
      model: "gpt-5.2-codex",
      effort: "high",
      speed: "priority",
    });
  });

  it("passes high reasoning levels (max/ultra) straight through — no xhigh downgrade", async () => {
    const { fn, calls } = fakeExec([turn("cx-1", "one")]);
    const engine = new CodexEngine(fn);
    await engine.start({
      cwd: ".",
      firstText: "first",
      model: "gpt-5.6-sol",
      effort: "ultra",
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(calls[0]).toMatchObject({ model: "gpt-5.6-sol", effort: "ultra" });
  });

  it("defaults chat turns to danger-full-access", async () => {
    const { fn, calls } = fakeExec([turn("cx-1", "hi")]);
    const engine = new CodexEngine(fn);
    await engine.start({ cwd: ".", firstText: "hello" });
    expect(calls[0]).toMatchObject({ sandbox: "danger-full-access" });
  });

  it("passes attachments through to codex exec for first and follow-up turns", async () => {
    const { fn, calls } = fakeExec([turn("cx-1", "one"), turn("cx-1", "two")]);
    const engine = new CodexEngine(fn);
    const id = await engine.start({
      cwd: ".",
      firstText: "",
      firstAttachments: [{ kind: "text", name: "notes.md", text: "# hello" }],
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(
      engine.send(id, {
        text: "again",
        attachments: [{ kind: "image", name: "ui.png", mediaType: "image/png", data: "abcd" }],
      }),
    ).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls[0]?.attachments).toEqual([{ kind: "text", name: "notes.md", text: "# hello" }]);
    expect(calls[1]?.attachments).toEqual([
      { kind: "image", name: "ui.png", mediaType: "image/png", data: "abcd" },
    ]);
  });

  it("send returns false for an unknown session and while a turn is in flight", async () => {
    // a turn that never completes keeps the session busy
    const fn: CodexExecFn = () => ({
      events: (async function* () {
        yield { type: "thread.started", thread_id: "cx-busy" } as CodexEvent;
        await new Promise(() => {});
      })(),
      kill: () => {},
    });
    const engine = new CodexEngine(fn);
    expect(engine.send("nope", { text: "x" })).toBe(false);
    const id = await engine.start({ cwd: ".", firstText: "go" });
    expect(engine.send(id, { text: "again" })).toBe(false); // turn still active
  });

  it("shutdown kills the in-flight Codex exec", async () => {
    let killed = false;
    const fn: CodexExecFn = () => ({
      events: (async function* () {
        yield { type: "thread.started", thread_id: "cx-drain" } as CodexEvent;
        await new Promise(() => {});
      })(),
      kill: () => {
        killed = true;
      },
    });
    const engine = new CodexEngine(fn);
    const id = await engine.start({ cwd: ".", firstText: "go" });
    expect(engine.activeSessions()).toContain(id);

    engine.shutdown();

    expect(killed).toBe(true);
  });

  it("fires onTurnEnd with the session id when a turn completes", async () => {
    const { fn } = fakeExec([turn("cx-1", "done")]);
    const engine = new CodexEngine(fn);
    const ended: string[] = [];
    engine.onTurnEnd((sid) => ended.push(sid));
    await engine.start({ cwd: ".", firstText: "hello" });
    await new Promise((r) => setTimeout(r, 20));
    expect(ended).toContain("cx-1");
  });

  it("interrupt kills the in-flight turn's process", async () => {
    let killed = false;
    const fn: CodexExecFn = () => ({
      events: (async function* () {
        yield { type: "thread.started", thread_id: "cx-int" } as CodexEvent;
        await new Promise(() => {});
      })(),
      kill: () => {
        killed = true;
      },
    });
    const engine = new CodexEngine(fn);
    const id = await engine.start({ cwd: ".", firstText: "go" });
    const got: UiEvent[] = [];
    engine.subscribe(id, (ev) => got.push(ev));
    expect(await engine.interrupt(id)).toBe(true);
    expect(killed).toBe(true);
    expect(engine.activeSessions()).toHaveLength(0);
    expect(got).toContainEqual({ kind: "result", ok: false, text: "interrupted" });
    expect(await engine.interrupt("nope")).toBe(false);
  });

  it("interrupt reports failure and preserves active state if killing throws", async () => {
    const fn: CodexExecFn = () => ({
      events: (async function* () {
        yield { type: "thread.started", thread_id: "cx-kill-throws" } as CodexEvent;
        await new Promise(() => {});
      })(),
      kill: () => {
        throw new Error("kill failed");
      },
    });
    const engine = new CodexEngine(fn);
    const id = await engine.start({ cwd: ".", firstText: "go" });
    const got: UiEvent[] = [];
    engine.subscribe(id, (ev) => got.push(ev));

    expect(await engine.interrupt(id)).toBe(false);

    expect(engine.activeSessions()).toContain(id);
    expect(got).not.toContainEqual({ kind: "result", ok: false, text: "interrupted" });
  });

  it("drops late events from a Codex process after interrupt", async () => {
    let release!: () => void;
    const canContinue = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fn: CodexExecFn = () => ({
      events: (async function* () {
        yield { type: "thread.started", thread_id: "cx-late" } as CodexEvent;
        yield { type: "turn.started" } as CodexEvent;
        await canContinue;
        yield { type: "item.completed", item: { type: "agent_message", text: "too late" } };
        yield { type: "turn.completed" } as CodexEvent;
      })(),
      kill: () => {},
    });
    const engine = new CodexEngine(fn);
    const id = await engine.start({ cwd: ".", firstText: "go" });
    const got: UiEvent[] = [];
    engine.subscribe(id, (ev) => got.push(ev));

    expect(await engine.interrupt(id)).toBe(true);
    release();
    await new Promise((r) => setTimeout(r, 20));

    expect(got).toContainEqual({ kind: "result", ok: false, text: "interrupted" });
    expect(got).not.toContainEqual({ kind: "assistant_text", text: "too late" });
    expect(got.filter((ev) => ev.kind === "result")).toHaveLength(1);
  });

  it("stops a request_user_input turn and resumes with the submitted answer", async () => {
    let releaseKilled!: () => void;
    const killed = new Promise<void>((resolve) => {
      releaseKilled = resolve;
    });
    let killCount = 0;
    const calls: CodexExecRequest[] = [];
    let turnIndex = 0;
    const fn: CodexExecFn = (req) => {
      calls.push(req);
      turnIndex += 1;
      if (turnIndex === 1) {
        return {
          events: (async function* () {
            yield { type: "thread.started", thread_id: "cx-question" } as CodexEvent;
            yield { type: "turn.started" } as CodexEvent;
            yield {
              type: "response_item",
              payload: {
                type: "function_call",
                call_id: "call-question",
                name: "request_user_input",
                arguments: JSON.stringify({
                  questions: [
                    {
                      question: "Pick one?",
                      options: [{ label: "A", description: "first" }],
                    },
                  ],
                }),
              },
            } as CodexEvent;
            await killed;
          })(),
          kill: () => {
            killCount += 1;
            releaseKilled();
          },
        };
      }
      return {
        events: (async function* () {
          yield { type: "turn.started" } as CodexEvent;
          yield { type: "item.completed", item: { type: "agent_message", text: "continued" } };
          yield { type: "turn.completed" } as CodexEvent;
        })(),
        kill: () => {},
      };
    };

    const engine = new CodexEngine(fn);
    const id = await engine.start({ cwd: ".", firstText: "go" });
    await new Promise((r) => setTimeout(r, 20));

    expect(id).toBe("cx-question");
    expect(killCount).toBe(1);
    expect(engine.activeSessions()).toHaveLength(0);
    expect(
      engine.answer(id, {
        toolUseId: "call-question",
        text: 'Your questions have been answered: "Pick one?"="A".',
      }),
    ).toBe(true);
    await new Promise((r) => setTimeout(r, 20));

    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({
      resume: "cx-question",
      prompt: 'Your questions have been answered: "Pick one?"="A".',
    });
  });

  it("activeSessions lists a session mid-turn and drops it once the turn ends", async () => {
    const live: CodexExecFn = () => ({
      events: (async function* () {
        yield { type: "thread.started", thread_id: "cx-live" } as CodexEvent;
        await new Promise(() => {});
      })(),
      kill: () => {},
    });
    const a = new CodexEngine(live);
    const id = await a.start({ cwd: ".", firstText: "go", clientSessionId: "branch-live" });
    expect(a.activeSessions()).toContain(id);
    expect(a.activeSessionStates()).toContainEqual({
      sessionId: id,
      startedAt: expect.any(Number),
      clientSessionId: "branch-live",
    });

    const { fn } = fakeExec([turn("cx-1", "x")]);
    const b = new CodexEngine(fn);
    await b.start({ cwd: ".", firstText: "go" });
    await new Promise((r) => setTimeout(r, 20));
    expect(b.activeSessions()).toHaveLength(0);
  });

  it("forks into a new thread id (copy the parent, resume the copy) and diverges there", async () => {
    const { fn, calls } = fakeExec([turn("cx-fork-2", "branched")]);
    const forkFn = (parentId: string) => (parentId === "cx-1" ? "cx-fork-2" : null);
    const engine = new CodexEngine(fn, "workspace-write", forkFn);
    const id = await engine.start({
      resume: "cx-1",
      forkSession: true,
      clientSessionId: "branch-fork-2",
      cwd: ".",
      firstText: "diverge here",
    });
    expect(id).toBe("cx-fork-2"); // the new branch id, not the parent
    await new Promise((r) => setTimeout(r, 20));
    // the first turn resumes the forked copy, not the parent
    expect(calls[0]).toMatchObject({ resume: "cx-fork-2", prompt: "diverge here" });
    expect(engine.activeSessionStates()).toEqual([]);
  });

  it("passes the opening text to the Codex rollout fork helper", async () => {
    const { fn } = fakeExec([turn("cx-fork-2", "branched")]);
    const forkCalls: Array<[string, string | undefined]> = [];
    const engine = new CodexEngine(fn, "workspace-write", (parentId, branchText) => {
      forkCalls.push([parentId, branchText]);
      return "cx-fork-2";
    });

    await engine.start({
      resume: "cx-1",
      forkSession: true,
      cwd: ".",
      firstText: "diverge here",
    });

    expect(forkCalls).toEqual([["cx-1", "diverge here"]]);
  });

  it("rejects a fork when the parent session can't be found", async () => {
    const { fn } = fakeExec([]);
    const engine = new CodexEngine(fn, "workspace-write", () => null);
    await expect(
      engine.start({ resume: "missing", forkSession: true, cwd: ".", firstText: "x" }),
    ).rejects.toThrow(/parent/i);
  });

  it("parks a subscriber on a not-yet-live session and attaches it on resume", async () => {
    const { fn } = fakeExec([turn("cx-1", "resumed")]);
    const engine = new CodexEngine(fn);
    const got: UiEvent[] = [];
    const unsub = engine.subscribe("cx-1", (ev) => got.push(ev));
    expect(got).toHaveLength(0);

    await engine.start({ resume: "cx-1", cwd: ".", firstText: "again" });
    await new Promise((r) => setTimeout(r, 20));
    expect(got.some((e) => e.kind === "assistant_text")).toBe(true);
    expect(got.some((e) => e.kind === "result")).toBe(true);
    unsub();
  });

  it("streams the current response_item/task_complete protocol", async () => {
    const { fn } = fakeExec([currentTurn("cx-now", "done via current protocol")]);
    const engine = new CodexEngine(fn);
    const id = await engine.start({ cwd: ".", firstText: "go" });
    const got: UiEvent[] = [];
    engine.subscribe(id, (ev) => got.push(ev));
    await new Promise((r) => setTimeout(r, 20));
    expect(
      got.some((e) => e.kind === "assistant_text" && e.text === "done via current protocol"),
    ).toBe(true);
    expect(got.some((e) => e.kind === "result" && e.ok === true)).toBe(true);
  });
});
