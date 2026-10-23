import { describe, expect, it, vi } from "vitest";
import { ClaudeAnalyzer } from "../src/chat/analyzer/claude.js";
import { CodexAnalyzer } from "../src/chat/analyzer/codex.js";
import type { AnalyzerTranscriptContext } from "../src/chat/analyzer/context.js";
import type { SessionAnalyzer } from "../src/chat/analyzer/index.js";
import { ProcessAnalyzer } from "../src/chat/analyzer/process.js";
import type { QueryFn } from "../src/chat/claude/driver.js";
import type { CodexEvent } from "../src/chat/codex/events.js";
import type { CodexExecFn } from "../src/chat/codex/exec.js";
import { TranscriptPathIndex } from "../src/core/vendor/transcript-index.js";

// A transport that stays blocked until cancellation. No provider or process is used.
function transport() {
  let finished = false;
  const started = vi.fn();
  const stop = vi.fn(() => {
    finished = true;
  });
  const source: AsyncIterable<CodexEvent> = {
    [Symbol.asyncIterator]() {
      started();
      return {
        next: () =>
          finished
            ? Promise.resolve({ done: true as const, value: undefined })
            : new Promise<IteratorResult<CodexEvent>>(() => {}),
        return: async () => ({ done: true as const, value: undefined }),
      };
    },
  };
  return { source, started, stop };
}

const operations = {
  seed: (analyzer: SessionAnalyzer) => analyzer.spawn("/tmp"),
  analysis: (analyzer: SessionAnalyzer) => analyzer.analyze("daemon", "/tmp", "task"),
  avoidance: (analyzer: SessionAnalyzer) => analyzer.avoidancePrompt?.("daemon", "/tmp", "task"),
};

describe("daemon cancellation", () => {
  it.each(["claude", "codex", "process"])(
    "stops all %s background transports and can run again",
    async (vendor) => {
      for (const operation of Object.values(operations)) {
        const t = transport();
        const exec: CodexExecFn = () => ({ events: t.source, kill: t.stop });
        const query = (() => ({ ...t.source, interrupt: t.stop })) as unknown as QueryFn;
        const analyzer: SessionAnalyzer =
          vendor === "claude"
            ? new ClaudeAnalyzer("/nonexistent-attend-cancel-test", query)
            : vendor === "codex"
              ? new CodexAnalyzer("/nonexistent-attend-cancel-test", exec)
              : new ProcessAnalyzer("cursor", "/nonexistent-attend-cancel-test", exec, () => []);
        const pending = operation(analyzer);
        const rejected = expect(pending).rejects.toThrow("Session daemon is off");
        await vi.waitFor(() => expect(t.started).toHaveBeenCalledOnce());
        analyzer.cancel?.();
        await rejected;
        expect(t.stop).toHaveBeenCalledOnce();
        // Re-enabling uses a fresh cancellation generation.
        await expect(operation(analyzer)).resolves.toBeNull();
        expect(t.stop).toHaveBeenCalledOnce();
      }
    },
  );
  it.each(["claude", "codex", "process"])(
    "does not start %s after a canceled context read finishes",
    async (vendor) => {
      let finish!: (context: AnalyzerTranscriptContext) => void;
      const contextReader = {
        readAnalyzerContext: vi.fn(
          () =>
            new Promise<AnalyzerTranscriptContext>((resolve) => {
              finish = resolve;
            }),
        ),
      };
      const transcriptIndex = new TranscriptPathIndex();
      transcriptIndex.set(vendor === "process" ? "cursor" : vendor, "task", "/test/task.jsonl");
      const exec = vi.fn<CodexExecFn>();
      const query = vi.fn<QueryFn>();
      const analyzer: SessionAnalyzer =
        vendor === "claude"
          ? new ClaudeAnalyzer("/tmp", query, transcriptIndex, contextReader)
          : vendor === "codex"
            ? new CodexAnalyzer("/tmp", exec, transcriptIndex, contextReader)
            : new ProcessAnalyzer("cursor", "/tmp", exec, () => [], transcriptIndex, contextReader);
      const pending = analyzer.analyze("daemon", "/tmp", "task");
      const rejected = expect(pending).rejects.toThrow("Session daemon is off");
      await vi.waitFor(() => expect(contextReader.readAnalyzerContext).toHaveBeenCalledOnce());
      analyzer.cancel?.();
      finish({ transcript: "task context", observedTurns: [] });
      await rejected;
      expect(exec).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    },
  );
});
