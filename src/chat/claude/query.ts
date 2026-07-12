import { query } from "@anthropic-ai/claude-agent-sdk";
import type { QueryFn } from "./driver.js";

/** Bind the Agent SDK to the user's installed Claude Code when one is resolved. */
export function claudeQueryForExecutable(
  executable: string | null | undefined,
  queryFn: QueryFn = query,
): QueryFn {
  if (!executable) return queryFn;
  return (args) =>
    queryFn({
      ...args,
      options: { ...args.options, pathToClaudeCodeExecutable: executable },
    });
}
