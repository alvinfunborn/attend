import { describe, expect, it } from "vitest";
import { CLAUDE_AUTH_ERROR_MESSAGE, classifyClaudeError } from "../src/chat/claude/errors.js";
import { classifyCodexError } from "../src/chat/codex/errors.js";
import type { CodexEvent } from "../src/chat/codex/events.js";
import { classifyCursorError } from "../src/chat/cursor/errors.js";
import { ProcessChatDriver } from "../src/chat/process/driver.js";
import type { ProcessTurnFn } from "../src/chat/process/types.js";
import { providerErrorPayload } from "../src/chat/provider-errors.js";

describe("provider errors", () => {
  it("turns an expired Claude OAuth session into an actionable public error", () => {
    const error = new Error(
      "Failed to authenticate: OAuth session expired and could not be refreshed",
    );

    expect(classifyClaudeError(error)).toEqual({
      code: "claude_auth_required",
      vendor: "claude",
      message: CLAUDE_AUTH_ERROR_MESSAGE,
      command: "claude auth login",
      retryable: false,
    });
    expect(providerErrorPayload(classifyClaudeError, error).message).toBe(
      CLAUDE_AUTH_ERROR_MESSAGE,
    );
    expect(classifyClaudeError(new Error(CLAUDE_AUTH_ERROR_MESSAGE))?.code).toBe(
      "claude_auth_required",
    );
    expect(classifyClaudeError("authentication_failed")).toMatchObject({
      code: "claude_auth_required",
      command: "claude auth login",
      retryable: false,
    });
    expect(classifyClaudeError("rate_limit")).toMatchObject({
      code: "claude_usage_limit",
      retryable: true,
    });
  });

  it("classifies Codex authentication and usage-limit errors", () => {
    expect(classifyCodexError(new Error("401 Unauthorized: login required"))).toMatchObject({
      code: "codex_auth_required",
      command: "codex login",
      retryable: false,
    });
    expect(
      classifyCodexError(new Error("You've hit your usage limit. Try again tomorrow.")),
    ).toEqual({
      code: "codex_usage_limit",
      vendor: "codex",
      message: "You've hit your usage limit. Try again tomorrow.",
      retryable: true,
    });
  });

  it("classifies Cursor authentication and usage-limit errors", () => {
    expect(classifyCursorError(new Error("Authentication required: not logged in"))).toMatchObject({
      code: "cursor_auth_required",
      command: "cursor-agent login",
      retryable: false,
    });
    expect(classifyCursorError(new Error("Usage limit reached"))).toMatchObject({
      code: "cursor_usage_limit",
      retryable: true,
    });
  });

  it("preserves unknown failures", () => {
    const error = new Error("private upstream detail");
    expect(classifyClaudeError(error)).toBeNull();
    expect(classifyCodexError(error)).toBeNull();
    expect(classifyCursorError(error)).toBeNull();
    expect(providerErrorPayload(classifyClaudeError, error)).toEqual({
      message: "private upstream detail",
    });
  });

  it("applies the Cursor classifier inside the shared process adapter", async () => {
    const exec = (() => ({
      events: (async function* () {
        yield { type: "thread.started", thread_id: "cursor-1" };
        yield { type: "turn.failed", error: "Authentication required: not logged in" };
      })(),
      kill: () => {},
    })) as ProcessTurnFn<CodexEvent>;
    const driver = new ProcessChatDriver(
      exec,
      "danger-full-access",
      () => null,
      "cursor",
      classifyCursorError,
    );
    const events: Array<{ event: { kind: string; message?: string } }> = [];
    driver.onEvent((_sessionId, event) => events.push({ event }));

    await driver.start({ cwd: ".", firstText: "hello" });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(events).toContainEqual({
      event: {
        kind: "error",
        message: "Cursor sign-in is required. Run `cursor-agent login`, then retry.",
        code: "cursor_auth_required",
        vendor: "cursor",
        command: "cursor-agent login",
        retryable: false,
      },
    });
  });
});
