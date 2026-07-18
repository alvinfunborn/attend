import { type PublicProviderError, errorText } from "../provider-errors.js";

export function classifyCursorError(error: unknown): PublicProviderError | null {
  const detail = errorText(error).trim();
  if (
    /(?:not logged in|login[_ ]required|authentication[_ ](?:required|failed)|unauthorized|invalid.*(?:token|credentials)|\b401\b)/i.test(
      detail,
    )
  ) {
    return {
      code: "cursor_auth_required",
      vendor: "cursor",
      message: "Cursor sign-in is required. Run `cursor-agent login`, then retry.",
      command: "cursor-agent login",
      retryable: false,
    };
  }
  if (
    /(?:usage limit|rate[_ ]limit|limit[_ ]reached|quota exceeded|insufficient quota|too many requests|\b429\b)/i.test(
      detail,
    )
  ) {
    return {
      code: "cursor_usage_limit",
      vendor: "cursor",
      message: detail || "Cursor usage limit reached.",
      retryable: true,
    };
  }
  return null;
}
