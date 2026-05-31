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
});
