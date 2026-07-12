import { describe, expect, it } from "vitest";
import { parseClaudeTranscript } from "../src/core/vendor/claude.js";

function jsonl(...lines: object[]): string {
  return lines.map((l) => JSON.stringify(l)).join("\n");
}

describe("parseClaudeTranscript", () => {
  it("counts user text prompts and assistant action tool uses; captures cwd + ts span", () => {
    const raw = jsonl(
      {
        type: "user",
        cwd: "D:\\proj",
        timestamp: "2026-05-01T10:00:00Z",
        message: { content: "do X" },
      },
      {
        type: "assistant",
        timestamp: "2026-05-01T10:05:00Z",
        message: {
          content: [
            { type: "tool_use", name: "Edit" },
            { type: "tool_use", name: "Bash" },
          ],
        },
      },
      { type: "user", timestamp: "2026-05-01T10:10:00Z", message: { content: "do Y" } },
    );
    const s = parseClaudeTranscript("s.jsonl", raw);
    expect(s.cwd).toBe("D:\\proj");
    expect(s.prompts).toBe(2);
    expect(s.actions).toBe(2);
    expect(s.firstTs).toBe(Date.parse("2026-05-01T10:00:00Z"));
    expect(s.lastTs).toBe(Date.parse("2026-05-01T10:10:00Z"));
    expect(s.userPromptTs).toEqual([
      Date.parse("2026-05-01T10:00:00Z"),
      Date.parse("2026-05-01T10:10:00Z"),
    ]);
  });

  it("ignores command-like prompts (content starting with '<') and non-action tools", () => {
    const raw = jsonl(
      { type: "user", message: { content: "<command-name>clear</command-name>" } },
      {
        type: "user",
        isMeta: true,
        message: { content: [{ type: "text", text: "# expanded slash-command template" }] },
      },
      {
        type: "user",
        message: { content: [{ type: "text", text: "<ide_opened_file>noise</ide_opened_file>" }] },
      },
      { type: "assistant", message: { content: [{ type: "tool_use", name: "Read" }] } },
    );
    const s = parseClaudeTranscript("s.jsonl", raw);
    expect(s.prompts).toBe(0);
    expect(s.actions).toBe(0);
  });

  it("strips provider-fork context from title and latest prompt", () => {
    const raw = jsonl({
      type: "user",
      message: {
        content: [
          {
            type: "text",
            text: [
              "push prod patch to main",
              "Attend fork context: this branch originally ran in codex.",
              "Use the transcript below as prior context, but treat this as a new independent branch in the current workspace.",
              "Transcript:",
              "User: old parent task",
              "Assistant: old parent answer",
            ].join("\n"),
          },
        ],
      },
    });
    const s = parseClaudeTranscript("s.jsonl", raw);
    expect(s.prompts).toBe(1);
    expect(s.title).toBe("push prod patch to main");
    expect(s.lastPrompt).toBe("push prod patch to main");
  });

  it("does not count subagent sidechain turns toward prompts/actions", () => {
    const raw = jsonl(
      { type: "user", isSidechain: true, message: { content: "subagent task" } },
      {
        type: "assistant",
        isSidechain: true,
        message: { content: [{ type: "tool_use", name: "Write" }] },
      },
      { type: "user", message: { content: "real prompt" } },
    );
    const s = parseClaudeTranscript("s.jsonl", raw);
    expect(s.prompts).toBe(1);
    expect(s.actions).toBe(0);
  });

  it("tolerates malformed lines and non-transcript record types", () => {
    const raw = ["not json", JSON.stringify({ type: "summary" }), ""].join("\n");
    const s = parseClaudeTranscript("s.jsonl", raw);
    expect(s.prompts).toBe(0);
    expect(s.cwd).toBeNull();
  });

  it("does not let metadata rows refresh the activity timestamp", () => {
    const raw = jsonl(
      {
        type: "user",
        timestamp: "2026-05-01T10:00:00Z",
        message: { content: "open a PR" },
      },
      {
        type: "assistant",
        timestamp: "2026-05-01T10:05:00Z",
        message: { content: "done" },
      },
      { type: "pr-link", timestamp: "2026-05-02T12:00:00Z", url: "https://example.test/pr/1" },
      { type: "attachment", timestamp: "2026-05-03T12:00:00Z", fileName: "artifact.txt" },
    );
    const s = parseClaudeTranscript("s.jsonl", raw);
    expect(s.firstTs).toBe(Date.parse("2026-05-01T10:00:00Z"));
    expect(s.lastTs).toBe(Date.parse("2026-05-01T10:05:00Z"));
    expect(s.lastAssistantTs).toBe(Date.parse("2026-05-01T10:05:00Z"));
    expect(s.assistantTextActivity).toEqual([{ at: Date.parse("2026-05-01T10:05:00Z"), chars: 4 }]);
  });
});
