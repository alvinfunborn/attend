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
  it("starts a run, resolves the session id, and buffers events for late subscribers", async () => {
    const engine = new ChatEngine(fakeQuery);
    const id = await engine.start({ cwd: ".", firstText: "hello" });
    expect(id).toBe("sess-9");

    // start() resolves at the init event; let the rest of the stream drain
    await new Promise((r) => setTimeout(r, 50));

    // a late subscriber should still replay the full buffer
    const got: UiEvent[] = [];
    engine.subscribe(id, (ev) => got.push(ev));
    expect(got).toContainEqual({ kind: "assistant_text", text: "hi" });
    expect(got.some((e) => e.kind === "result")).toBe(true);
  });

  it("send returns false for an unknown session", () => {
    const engine = new ChatEngine(fakeQuery);
    expect(engine.send("nope", "x")).toBe(false);
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
