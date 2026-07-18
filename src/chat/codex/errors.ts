import { type PublicProviderError, errorText } from "../provider-errors.js";

export function classifyCodexError(error: unknown): PublicProviderError | null {
  const detail = errorText(error).trim();
  if (
    /(?:not logged in|login[_ ]required|authentication[_ ](?:required|failed)|unauthorized|invalid.*(?:token|credentials)|\b401\b)/i.test(
      detail,
    )
  ) {
    return {
      code: "codex_auth_required",
      vendor: "codex",
      message: "Codex sign-in is required. Run `codex login`, then retry.",
      command: "codex login",
      retryable: false,
    };
  }
  if (
    /(?:usage limit|rate[_ ]limit|limit[_ ]reached|quota exceeded|insufficient quota|too many requests|\b429\b)/i.test(
      detail,
    )
  ) {
    return {
      code: "codex_usage_limit",
      vendor: "codex",
      message: detail || "Codex usage limit reached.",
      retryable: true,
    };
  }
  return null;
}
