import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CodexEvent } from "../src/chat/codex/events.js";
import {
  buildArgs,
  makeCodexExec,
  makeCodexFork,
  prepareCodexExecInput,
} from "../src/chat/codex/exec.js";
import { readCodexTranscript } from "../src/chat/codex/transcript.js";

const cleanup: Array<() => void> = [];

afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

describe("prepareCodexExecInput", () => {
  it("concatenates text attachments into the prompt and materializes images to temp files", () => {
    const prepared = prepareCodexExecInput({
      cwd: ".",
      prompt: "Describe this change",
      attachments: [
        { kind: "text", name: "notes.md", text: "# hello" },
        { kind: "image", name: "diagram.png", mediaType: "image/png", data: "aGVsbG8=" },
      ],
    });
    cleanup.push(prepared.cleanup);

    expect(prepared.prompt).toContain("Describe this change");
    expect(prepared.prompt).toContain("[Attached text: notes.md]");
    expect(prepared.prompt).toContain("# hello");
    expect(prepared.imagePaths).toHaveLength(1);
    expect(fs.existsSync(prepared.imagePaths[0] ?? "")).toBe(true);
    expect(fs.readFileSync(prepared.imagePaths[0] ?? "", "utf-8")).toBe("hello");
  });

  it("materializes Excel attachments and points the prompt at the local file", () => {
    const prepared = prepareCodexExecInput({
      cwd: ".",
      prompt: "Review this sheet",
      attachments: [
        {
          kind: "file",
          name: "budget.xlsx",
          mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          data: "aGVsbG8=",
        },
      ],
    });
    cleanup.push(prepared.cleanup);

    expect(prepared.prompt).toContain("[Attached file: budget.xlsx]");
    expect(prepared.prompt).toContain(
      "MIME type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const filePath = prepared.prompt.match(/Local path: (.+)/)?.[1]?.trim() ?? "";
    expect(filePath).toBeTruthy();
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("hello");
    expect(prepared.imagePaths).toHaveLength(0);
  });

  it("rejects PDF attachments with a clear error", () => {
    expect(() =>
      prepareCodexExecInput({
        cwd: ".",
        prompt: "Review this",
        attachments: [
          { kind: "document", name: "brief.pdf", mediaType: "application/pdf", data: "abcd" },
        ],
      }),
    ).toThrow(/PDF attachments/);
  });
});

describe("buildArgs", () => {
  it("passes image paths through --image for exec and resume", () => {
    expect(
      buildArgs({
        cwd: "/tmp/proj",
        prompt: "hello",
        imagePaths: ["/tmp/a.png", "/tmp/b.jpg"],
      }),
    ).toEqual([
      "exec",
      "--json",
      "--skip-git-repo-check",
      "-C",
      "/tmp/proj",
      "--image",
      "/tmp/a.png",
      "--image",
      "/tmp/b.jpg",
      "--",
      "hello",
    ]);

    expect(
      buildArgs({
        cwd: "/tmp/proj",
        prompt: "again",
        resume: "cx-1",
        imagePaths: ["/tmp/c.png"],
      }),
    ).toEqual([
      "exec",
      "resume",
      "cx-1",
      "--json",
      "--skip-git-repo-check",
      "--image",
      "/tmp/c.png",
      "--",
      "again",
    ]);
  });
});

describe("makeCodexExec", () => {
  it("surfaces a missing codex binary as an error event instead of crashing the process", async () => {
    const exec = makeCodexExec("attend-nonexistent-codex-binary-xyz");
    const handle = exec({ cwd: process.cwd(), prompt: "hello", resume: "cx-1" });
    const events: CodexEvent[] = [];
    for await (const event of handle.events) events.push(event);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("error");
    expect((events[0] as { error: string }).error).toMatch(/not found/i);
  });
});

describe("makeCodexFork", () => {
  it("rewrites every session id field in the copied rollout metadata", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-codex-fork-"));
    cleanup.push(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(
      path.join(dir, "rollout-2026-06-01T00-00-00-parent-1.jsonl"),
      `${JSON.stringify({
        type: "session_meta",
        payload: { id: "parent-1", session_id: "parent-1", cwd: dir },
      })}\n`,
    );

    const child = makeCodexFork(dir)("parent-1");
    expect(child).toBeTruthy();
    const forkFile = fs.readdirSync(dir).find((name) => child && name.endsWith(`${child}.jsonl`));
    expect(forkFile).toBeTruthy();
    const meta = JSON.parse(fs.readFileSync(path.join(dir, forkFile ?? ""), "utf-8"));
    expect(meta.payload).toMatchObject({ id: child, session_id: child });
  });

  it("forks before the parent's latest user turn when it is reused as the branch opener", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-codex-fork-"));
    cleanup.push(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(
      path.join(dir, "rollout-2026-06-01T00-00-00-parent-1.jsonl"),
      [
        {
          type: "session_meta",
          payload: { id: "parent-1", session_id: "parent-1", cwd: dir },
        },
        {
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "setup context" }],
          },
        },
        {
          type: "response_item",
          payload: {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "context reply" }],
          },
        },
        {
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "branch here" }],
          },
        },
        {
          type: "response_item",
          payload: {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "old answer" }],
          },
        },
      ]
        .map((line) => JSON.stringify(line))
        .join("\n"),
    );

    const child = makeCodexFork(dir)("parent-1", "branch here");
    expect(child).toBeTruthy();
    const forkFile = fs.readdirSync(dir).find((name) => child && name.endsWith(`${child}.jsonl`));
    expect(forkFile).toBeTruthy();
    expect(readCodexTranscript(path.join(dir, forkFile ?? ""))).toMatchObject([
      { role: "user", text: "setup context" },
      { role: "assistant", text: "context reply" },
    ]);
  });
});
