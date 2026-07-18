import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ChatQueueStore } from "../src/chat/queue.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function store(): { file: string; queue: ChatQueueStore } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-queue-"));
  roots.push(root);
  const file = path.join(root, "chat-queues.json");
  return { file, queue: new ChatQueueStore(file) };
}

describe("ChatQueueStore", () => {
  it("persists ordered turns independently of the browser", () => {
    const { file, queue } = store();
    const first = queue.enqueue("s1", { cwd: "/tmp", vendor: "claude", text: "one" });
    const second = queue.enqueue("s1", {
      cwd: "/tmp",
      vendor: "claude",
      text: "two",
      goal: true,
    });

    expect(new ChatQueueStore(file).list("s1").map((item) => item.text)).toEqual(["one", "two"]);
    expect(new ChatQueueStore(file).list("s1")[1]?.goal).toBe(true);
    expect(queue.updateText("s1", second.id, "two edited")?.text).toBe("two edited");
    expect(queue.promote("s1", second.id)).toBe(true);
    expect(queue.peek("s1")?.id).toBe(second.id);
    expect(queue.remove("s1", second.id)?.id).toBe(second.id);
    expect(queue.peek("s1")?.id).toBe(first.id);
  });

  it("persists structured Pin references and their enqueue-time context snapshot", () => {
    const { file, queue } = store();
    queue.enqueue("s1", {
      cwd: "/tmp",
      vendor: "codex",
      text: "use this",
      references: [{ kind: "pin", pinKey: "msg:2", pinSessionId: "s1" }],
      referenceContext: "Pinned assistant response:\nanswer",
    });

    expect(new ChatQueueStore(file).peek("s1")).toMatchObject({
      references: [{ kind: "pin", pinKey: "msg:2", pinSessionId: "s1" }],
      referenceContext: "Pinned assistant response:\nanswer",
    });
  });

  it("persists the parked state until an explicit promotion", () => {
    const { file, queue } = store();
    const item = queue.enqueue("s1", { cwd: "/tmp", vendor: "codex", text: "later" });
    queue.setParked("s1", true);

    const restored = new ChatQueueStore(file);
    expect(restored.parked("s1")).toBe(true);
    expect(restored.summary()).toEqual({ s1: { count: 1, parked: true } });
    expect(restored.promote("s1", item.id)).toBe(true);
    expect(restored.parked("s1")).toBe(false);
  });

  it("merges writes from independent server instances", () => {
    const { file, queue: first } = store();
    const second = new ChatQueueStore(file);
    first.enqueue("s1", { cwd: "/a", vendor: "claude", text: "one" });
    second.enqueue("s2", { cwd: "/b", vendor: "codex", text: "two" });
    expect(first.list("s2").map((item) => item.text)).toEqual(["two"]);
    expect(second.list("s1").map((item) => item.text)).toEqual(["one"]);
  });

  it("leases dispatch to one server instance and allows retry after release", () => {
    const { file, queue: first } = store();
    const second = new ChatQueueStore(file);
    const item = first.enqueue("s1", { cwd: "/a", vendor: "claude", text: "one" });

    expect(first.claim("s1", "server-a")?.id).toBe(item.id);
    expect(second.claim("s1", "server-b")).toBeNull();
    first.releaseClaim("s1", item.id, "server-a");
    expect(second.claim("s1", "server-b")?.id).toBe(item.id);
    expect(second.completeClaim("s1", item.id, "server-b")?.id).toBe(item.id);
    expect(first.peek("s1")).toBeNull();
  });

  it("cleans expired leases without deleting queued turns", () => {
    const { queue } = store();
    const item = queue.enqueue("s1", { cwd: "/a", vendor: "claude", text: "keep me" });
    expect(queue.claim("s1", "server-a", 1_000)?.id).toBe(item.id);

    expect(queue.pruneExpiredLeases(Date.now() + 2_000)).toBe(1);
    expect(queue.peek("s1")?.id).toBe(item.id);
    expect(queue.claim("s1", "server-b")?.id).toBe(item.id);
  });

  it("extracts a queued turn atomically and restores it at the same position", () => {
    const { queue } = store();
    const first = queue.enqueue("s1", { cwd: "/a", vendor: "claude", text: "one" });
    const second = queue.enqueue("s1", { cwd: "/a", vendor: "claude", text: "two" });
    queue.enqueue("s1", { cwd: "/a", vendor: "claude", text: "three" });
    queue.setParked("s1", true);

    const extracted = queue.extract("s1", second.id);
    expect(extracted).toMatchObject({
      item: { id: second.id, text: "two" },
      index: 1,
      parked: true,
    });
    expect(queue.list("s1").map((item) => item.text)).toEqual(["one", "three"]);

    if (!extracted) throw new Error("expected queued turn extraction");
    queue.restore(extracted);
    expect(queue.list("s1").map((item) => item.text)).toEqual(["one", "two", "three"]);
    expect(queue.parked("s1")).toBe(true);
    expect(queue.peek("s1")?.id).toBe(first.id);
  });

  it("does not extract a queued turn already leased for dispatch", () => {
    const { queue } = store();
    const item = queue.enqueue("s1", { cwd: "/a", vendor: "claude", text: "one" });
    expect(queue.claim("s1", "server-a")?.id).toBe(item.id);
    expect(queue.extract("s1", item.id)).toBeNull();
    expect(queue.peek("s1")?.id).toBe(item.id);
  });
});
