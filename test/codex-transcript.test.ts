import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readCodexTranscript } from "../src/chat/codex/transcript.js";

// A minimal rollout transcript in the captured codex-cli 0.133 schema.
const ROLLOUT = [
  { type: "session_meta", payload: { id: "cx-1", cwd: "/tmp" } },
  {
    type: "response_item",
    payload: { type: "message", role: "developer", content: [{ type: "input_text", text: "sys" }] },
  },
  {
    type: "response_item",
    payload: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "<environment_context>noise</environment_context>" }],
    },
  },
  {
    type: "response_item",
    payload: { type: "message", role: "user", content: [{ type: "input_text", text: "run pwd" }] },
  },
  {
    type: "response_item",
    payload: {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "Running pwd." }],
    },
  },
  {
    type: "response_item",
    payload: {
      type: "function_call",
      name: "exec_command",
      arguments: '{"cmd":"pwd"}',
      call_id: "call_1",
    },
  },
  {
    type: "response_item",
    payload: { type: "function_call_output", call_id: "call_1", output: "/tmp\n" },
  },
  {
    type: "response_item",
    payload: {
      type: "custom_tool_call",
      name: "apply_patch",
      call_id: "patch_1",
      input: "*** Begin Patch\n*** End Patch\n",
    },
  },
  {
    type: "response_item",
    payload: { type: "custom_tool_call_output", call_id: "patch_1", output: "Success\n" },
  },
];

let file: string;
afterEach(() => {
  if (file) fs.rmSync(file, { force: true });
});

describe("readCodexTranscript", () => {
  it("reads user/assistant messages and correlates tool calls to their outputs", () => {
    file = path.join(os.tmpdir(), `attend-rollout-${Math.random().toString(36).slice(2)}.jsonl`);
    fs.writeFileSync(file, ROLLOUT.map((l) => JSON.stringify(l)).join("\n"));
    const msgs = readCodexTranscript(file);

    // developer turn + the synthetic <environment_context> user turn are dropped
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(msgs[0]).toMatchObject({ role: "user", text: "run pwd" });
    const asst = msgs[1];
    expect(asst?.text).toBe("Running pwd.");
    expect(asst?.tools).toHaveLength(2);
    expect(asst?.tools[0]).toMatchObject({
      name: "exec_command",
      input: { cmd: "pwd" },
      result: "/tmp\n",
    });
    expect(asst?.tools[1]).toMatchObject({
      name: "apply_patch",
      input: "*** Begin Patch\n*** End Patch\n",
      result: "Success\n",
    });
  });

  it("keeps user text from image turns serialized with leading image tags", () => {
    file = path.join(os.tmpdir(), `attend-rollout-${Math.random().toString(36).slice(2)}.jsonl`);
    fs.writeFileSync(
      file,
      [
        JSON.stringify({
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [
              { type: "input_text", text: '<image name=[Image #1] path="/tmp/ui.png">' },
              { type: "input_image", image_url: "data:image/png;base64,abcd", detail: "high" },
              { type: "input_text", text: "</image>" },
              {
                type: "input_text",
                text: "why is this reversed?\n\nAttachments:\n- image: ui.png",
              },
            ],
          },
        }),
        JSON.stringify({
          type: "response_item",
          payload: {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "Because the prompt was hidden." }],
          },
        }),
      ].join("\n"),
    );

    const msgs = readCodexTranscript(file);
    expect(msgs).toMatchObject([
      { role: "user", text: "why is this reversed?\n\nAttachments:\n- image: ui.png" },
      { role: "assistant", text: "Because the prompt was hidden." },
    ]);
  });

  it("returns [] for a missing file", () => {
    expect(readCodexTranscript("/no/such/file.jsonl")).toEqual([]);
  });

  it("does not replace real history with compacted replacement_history", () => {
    file = path.join(os.tmpdir(), `attend-rollout-${Math.random().toString(36).slice(2)}.jsonl`);
    fs.writeFileSync(
      file,
      [
        JSON.stringify({
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "first question" }],
          },
        }),
        JSON.stringify({
          type: "response_item",
          payload: {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "first answer" }],
          },
        }),
        JSON.stringify({
          type: "compacted",
          payload: {
            message: "",
            replacement_history: [
              {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: "summary user" }],
              },
              {
                type: "message",
                role: "assistant",
                content: [{ type: "output_text", text: "summary answer" }],
              },
            ],
          },
        }),
        JSON.stringify({
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "latest follow-up" }],
          },
        }),
      ].join("\n"),
    );

    const msgs = readCodexTranscript(file);
    expect(msgs).toMatchObject([
      { role: "user", text: "first question" },
      { role: "assistant", text: "first answer" },
      { role: "user", text: "latest follow-up" },
    ]);
  });

  it("uses compacted replacement_history as a fallback when no real history exists", () => {
    file = path.join(os.tmpdir(), `attend-rollout-${Math.random().toString(36).slice(2)}.jsonl`);
    fs.writeFileSync(
      file,
      [
        JSON.stringify({
          type: "compacted",
          payload: {
            message: "",
            replacement_history: [
              {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: "summary user" }],
              },
              {
                type: "message",
                role: "assistant",
                content: [{ type: "output_text", text: "summary answer" }],
              },
            ],
          },
        }),
        JSON.stringify({
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "latest follow-up" }],
          },
        }),
      ].join("\n"),
    );

    const msgs = readCodexTranscript(file);
    expect(msgs).toMatchObject([
      { role: "user", text: "summary user" },
      { role: "assistant", text: "summary answer" },
      { role: "user", text: "latest follow-up" },
    ]);
  });
});
