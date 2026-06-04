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

  it("preserves model and effort across the first turn and follow-up turns", async () => {
    const { fn, calls } = fakeExec([turn("cx-1", "one"), turn("cx-1", "two")]);
    const engine = new CodexEngine(fn);
    const id = await engine.start({
      cwd: ".",
      firstText: "first",
      model: "gpt-5.2-codex",
      effort: "high",
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(engine.send(id, { text: "second" })).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls[0]).toMatchObject({ model: "gpt-5.2-codex", effort: "high" });
    expect(calls[1]).toMatchObject({ model: "gpt-5.2-codex", effort: "high" });
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
    expect(await engine.interrupt(id)).toBe(true);
    expect(killed).toBe(true);
    expect(await engine.interrupt("nope")).toBe(false);
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
    const id = await a.start({ cwd: ".", firstText: "go" });
    expect(a.activeSessions()).toContain(id);

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
      cwd: ".",
      firstText: "diverge here",
    });
    expect(id).toBe("cx-fork-2"); // the new branch id, not the parent
    await new Promise((r) => setTimeout(r, 20));
    // the first turn resumes the forked copy, not the parent
    expect(calls[0]).toMatchObject({ resume: "cx-fork-2", prompt: "diverge here" });
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
