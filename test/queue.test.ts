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
    const second = queue.enqueue("s1", { cwd: "/tmp", vendor: "claude", text: "two" });

    expect(new ChatQueueStore(file).list("s1").map((item) => item.text)).toEqual(["one", "two"]);
    expect(queue.updateText("s1", second.id, "two edited")?.text).toBe("two edited");
    expect(queue.promote("s1", second.id)).toBe(true);
    expect(queue.peek("s1")?.id).toBe(second.id);
    expect(queue.remove("s1", second.id)?.id).toBe(second.id);
    expect(queue.peek("s1")?.id).toBe(first.id);
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
});
