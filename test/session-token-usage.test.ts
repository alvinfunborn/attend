import { describe, expect, it } from "vitest";
import { parseClaudeTranscript } from "../src/core/vendor/claude.js";
import { parseCodexTranscript } from "../src/core/vendor/codex.js";

function jsonl(...entries: object[]): string {
  return entries.map((entry) => JSON.stringify(entry)).join("\n");
}

describe("session token usage", () => {
  it("uses Codex cumulative totals without double counting cache or reasoning", () => {
    const event = (input: number, output: number) => ({
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          total_token_usage: {
            input_tokens: input,
            cached_input_tokens: 80,
            output_tokens: output,
            reasoning_output_tokens: 5,
            total_tokens: input + output,
          },
        },
      },
    });
    const raw = jsonl(event(100, 10), event(200, 20), event(200, 20), {
      type: "event_msg", payload: { type: "token_count", info: null },
    });
    expect(parseCodexTranscript("s.jsonl", raw).tokenUsage).toEqual({
      input: 200, output: 20, cachedInput: 80, cacheWriteInput: 0, total: 220,
    });
  });

  it("sums Claude messages, includes cache, and deduplicates updated content blocks", () => {
    const event = (id: string, output: number, isSidechain = false) => ({
      type: "assistant",
      isSidechain,
      message: {
        id,
        usage: {
          input_tokens: 10,
          output_tokens: output,
          cache_read_input_tokens: 80,
          cache_creation_input_tokens: 20,
        },
      },
    });
    const raw = jsonl(
      event("one", 5), event("one", 10), event("one", 10),
      event("two", 20), event("subagent", 1000, true),
    );
    expect(parseClaudeTranscript("s.jsonl", raw).tokenUsage).toEqual({
      input: 220, output: 30, cachedInput: 160, cacheWriteInput: 40, total: 250,
    });
  });

  it("distinguishes unavailable usage from a reported zero", () => {
    expect(parseClaudeTranscript("s.jsonl", "").tokenUsage).toBeNull();
    expect(parseCodexTranscript("s.jsonl", "").tokenUsage).toBeNull();
    expect(parseClaudeTranscript("s.jsonl", jsonl({
      type: "assistant", message: { usage: { input_tokens: -1, output_tokens: 5 } },
    })).tokenUsage).toBeNull();
    expect(parseClaudeTranscript("s.jsonl", jsonl({
      type: "assistant", message: { usage: { input_tokens: 0, output_tokens: 0 } },
    })).tokenUsage?.total).toBe(0);
  });
});
