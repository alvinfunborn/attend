import { describe, expect, it, vi } from "vitest";
import { BoundedSseWriter } from "../src/core/sse-writer.js";

describe("bounded live stream writer", () => {
  it("disconnects a stalled reader and releases queued frames without writing them", async () => {
    let release = () => {};
    const stalled = new Promise<void>((resolve) => {
      release = resolve;
    });
    const write = vi.fn(() => stalled);
    const disconnect = vi.fn();
    const writer = new BoundedSseWriter(write, disconnect, 1000, 3);
    for (let i = 0; i < 100; i++) writer.send({ id: String(i), data: "x" });
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    release();
    await stalled;
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("counts bytes as well as frame count, including the in-flight write", () => {
    const disconnect = vi.fn();
    const writer = new BoundedSseWriter(() => new Promise(() => {}), disconnect, 100, 100);
    writer.send({ id: "1", data: "x".repeat(40) });
    expect(disconnect).not.toHaveBeenCalled();
    writer.send({ id: "2", data: "y".repeat(40) });
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("preserves event order for healthy readers and ignores sends after disconnect", async () => {
    const output: string[] = [];
    const disconnect = vi.fn();
    const writer = new BoundedSseWriter(async (frame) => {
      output.push(frame.id);
    }, disconnect);
    for (let i = 0; i < 2003; i++) writer.send({ id: String(i), data: "x" });
    await vi.waitFor(() => expect(output).toHaveLength(2003));
    expect(output).toEqual(Array.from({ length: 2003 }, (_, i) => String(i)));
    expect(disconnect).not.toHaveBeenCalled();
    writer.close();
    writer.send({ id: "closed", data: "x" });
    expect(output).toHaveLength(2003);
  });
});
