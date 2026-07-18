import { query } from "@anthropic-ai/claude-agent-sdk";
import type { QueryFn } from "./driver.js";

/** Bind every Agent SDK call to the user's exact system Claude Code executable. */
export function claudeQueryForExecutable(executable: string, queryFn: QueryFn = query): QueryFn {
  if (!executable.trim()) {
    throw new Error("Claude CLI is unavailable; the Agent SDK bundled CLI is disabled");
  }
  return (args) =>
    queryFn({
      ...args,
      options: { ...args.options, pathToClaudeCodeExecutable: executable },
    });
}
