import { describe, expect, it } from "vitest";
import { claudeQueryForExecutable } from "../src/chat/claude-query.js";
import type { QueryFn } from "../src/chat/engine.js";

describe("claudeQueryForExecutable", () => {
  it("routes SDK calls through the installed Claude Code executable", () => {
    let received: Parameters<QueryFn>[0] | undefined;
    const fake = ((args: Parameters<QueryFn>[0]) => {
      received = args;
      return {};
    }) as QueryFn;
    const wrapped = claudeQueryForExecutable("/opt/bin/claude", fake);

    wrapped({ prompt: "hello", options: { cwd: "/tmp", model: "claude-fable-5[1m]" } });

    expect(received?.options).toMatchObject({
      cwd: "/tmp",
      model: "claude-fable-5[1m]",
      pathToClaudeCodeExecutable: "/opt/bin/claude",
    });
  });

  it("refuses to create an unbound SDK query instead of using its bundled CLI", () => {
    expect(() => claudeQueryForExecutable(" ")).toThrow("the Agent SDK bundled CLI is disabled");
  });
});
