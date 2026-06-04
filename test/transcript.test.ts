import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readClaudeTranscript } from "../src/chat/transcript.js";

// A Claude JSONL slice reproducing a typed slash command: the human turn is stored
// as <command-name>/<command-args>, immediately followed by an `isMeta` message
// carrying the command's expanded template. Regression for the bug where the
// template rendered as the user's message and the real command was dropped.
const LINES = [
  {
    type: "user",
    message: {
      content:
        "<command-message>check-logs</command-message>\n<command-name>/check-logs</command-name>\n<command-args>看 local logs</command-args>",
    },
  },
  {
    type: "user",
    isMeta: true,
    message: {
      content: [{ type: "text", text: "# Local Log Troubleshooting\n\nYou are helping…" }],
    },
  },
  {
    type: "user",
    message: { content: [{ type: "text", text: "<ide_opened_file>noise</ide_opened_file>" }] },
  },
  {
    type: "assistant",
    message: {
      content: [
        { type: "text", text: "On it." },
        { type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } },
      ],
    },
  },
  {
    type: "user",
    message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "out" }] },
  },
  { type: "assistant", message: { content: [{ type: "text", text: "Done." }] } },
  { type: "user", message: { content: "a normal follow-up" } },
];

let file: string;
afterEach(() => {
  if (file) fs.rmSync(file, { force: true });
});

describe("readClaudeTranscript", () => {
  it("reconstructs a typed slash command and drops the isMeta expansion", () => {
    file = path.join(os.tmpdir(), `attend-claude-${Math.random().toString(36).slice(2)}.jsonl`);
    fs.writeFileSync(file, LINES.map((l) => JSON.stringify(l)).join("\n"));
    const msgs = readClaudeTranscript(file);

    // the giant isMeta template and the <ide_opened_file> synthetic turn are gone;
    // the typed command leads, in order, as a user message.
    expect(msgs.map((m) => `${m.role}:${m.text}`)).toEqual([
      "user:/check-logs 看 local logs",
      "assistant:On it.",
      "assistant:Done.",
      "user:a normal follow-up",
    ]);
    // the tool result is correlated back onto its tool_use
    expect(msgs[1]?.tools).toMatchObject([{ name: "Bash", result: "out" }]);
  });
});
