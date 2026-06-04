import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { buildArgs, prepareCodexExecInput } from "../src/chat/codex/exec.js";

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
      "/tmp/a.png,/tmp/b.jpg",
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
      "again",
    ]);
  });
});
