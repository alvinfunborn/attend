import { describe, expect, it } from "vitest";
import { parseCodexTranscript } from "../src/core/vendor/codex.js";

function jsonl(...lines: object[]): string {
  return lines.map((l) => JSON.stringify(l)).join("\n");
}

describe("parseCodexTranscript (RolloutLine schema)", () => {
  it("reads cwd from session_meta, counts user prompts and tool-call actions", () => {
    const raw = jsonl(
      {
        timestamp: "2026-05-01T10:00:00Z",
        type: "session_meta",
        payload: { id: "abc", cwd: "/home/u/proj", cli_version: "0.1" },
      },
      {
        timestamp: "2026-05-01T10:01:00Z",
        type: "response_item",
        payload: { type: "message", role: "user", content: [{ type: "input_text", text: "do X" }] },
      },
      {
        timestamp: "2026-05-01T10:02:00Z",
        type: "response_item",
        payload: { type: "local_shell_call", command: ["ls"] },
      },
      {
        timestamp: "2026-05-01T10:03:00Z",
        type: "response_item",
        payload: { type: "function_call", name: "apply_patch", arguments: "{}" },
      },
    );
    const s = parseCodexTranscript("rollout.jsonl", raw);
    expect(s.vendor).toBe("codex");
    expect(s.cwd).toBe("/home/u/proj");
    expect(s.prompts).toBe(1);
    expect(s.actions).toBe(2);
    expect(s.firstTs).toBe(Date.parse("2026-05-01T10:00:00Z"));
    expect(s.lastTs).toBe(Date.parse("2026-05-01T10:03:00Z"));
  });

  it("does not count assistant messages or non-action response items", () => {
    const raw = jsonl(
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "hi" }],
        },
      },
      { type: "response_item", payload: { type: "reasoning", summary: [] } },
      { type: "event_msg", payload: { type: "token_count", total: 10 } },
    );
    const s = parseCodexTranscript("r.jsonl", raw);
    expect(s.prompts).toBe(0);
    expect(s.actions).toBe(0);
  });

  it("skips synthetic <…>-wrapped user turns so title/lastPrompt are the real prompts", () => {
    const raw = jsonl(
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "<environment_context>\n <cwd>/p</cwd>\n</environment_context>",
            },
          ],
        },
      },
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "investigate this call" }],
        },
      },
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "<environment_context>again</environment_context>" },
          ],
        },
      },
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "now add the transcript" }],
        },
      },
    );
    const s = parseCodexTranscript("r.jsonl", raw);
    expect(s.prompts).toBe(2); // only the two real prompts
    expect(s.title).toBe("investigate this call"); // first REAL prompt, not the env block
    expect(s.lastPrompt).toBe("now add the transcript");
  });

  it("keeps the full prompt (no 80-char truncation) so tooltips/header show it all", () => {
    const long = `investigate ${"x".repeat(300)} done`;
    const raw = jsonl({
      type: "response_item",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: long }] },
    });
    const s = parseCodexTranscript("r.jsonl", raw);
    expect(s.title).toBe(long); // intact, not "…"-truncated
    expect(s.title?.includes("…")).toBe(false);
  });

  it("tolerates bare (pre-RolloutLine) records and malformed lines", () => {
    const raw = [
      "garbage",
      JSON.stringify({ cwd: "/bare/proj" }),
      JSON.stringify({
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "hey" }],
      }),
    ].join("\n");
    const s = parseCodexTranscript("r.jsonl", raw);
    expect(s.cwd).toBe("/bare/proj");
    expect(s.prompts).toBe(1);
  });
});
