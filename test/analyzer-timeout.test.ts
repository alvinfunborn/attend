import { describe, expect, it, vi } from "vitest";
import { consumeAnalyzerStream } from "../src/chat/analyzer/timeout.js";

describe("consumeAnalyzerStream", () => {
  it("stops a hung analyzer transport at the deadline", async () => {
    const stop = vi.fn();
    const source: AsyncIterable<string> = {
      [Symbol.asyncIterator]() {
        return {
          next: () => new Promise<IteratorResult<string>>(() => {}),
          return: async () => ({ value: undefined, done: true }),
        };
      },
    };

    await expect(consumeAnalyzerStream(source, () => {}, stop, 10)).rejects.toThrow(
      "analyzer timed out",
    );
    expect(stop).toHaveBeenCalledOnce();
  });
});
