import { type PublicProviderError, errorText } from "../provider-errors.js";

export const CLAUDE_AUTH_COMMAND = "claude auth login";
export const CLAUDE_AUTH_ERROR_MESSAGE =
  "Claude sign-in is required. Run `claude auth login`, then retry.";

export function classifyClaudeError(error: unknown): PublicProviderError | null {
  const detail = errorText(error).trim();
  if (
    /(?:failed to authenticate|authentication[_ ]failed|oauth session expired|invalid authentication credentials|not logged in|claude (?:login|authentication) expired|claude sign-in is required)/i.test(
      detail,
    )
  ) {
    return {
      code: "claude_auth_required",
      vendor: "claude",
      message: CLAUDE_AUTH_ERROR_MESSAGE,
      command: CLAUDE_AUTH_COMMAND,
      retryable: false,
    };
  }
  if (
    /(?:usage limit|rate[_ ]limit|limit reached|quota exceeded|insufficient quota|too many requests|\b429\b)/i.test(
      detail,
    )
  ) {
    return {
      code: "claude_usage_limit",
      vendor: "claude",
      message:
        detail === "rate_limit"
          ? "Claude usage limit reached. Wait for the limit to reset, then retry."
          : detail || "Claude usage limit reached.",
      retryable: true,
    };
  }
  return null;
}
