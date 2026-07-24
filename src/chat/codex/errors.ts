import { type PublicProviderError, errorText } from "../provider-errors.js";

export function classifyCodexError(error: unknown): PublicProviderError | null {
  const detail = errorText(error).trim();
  const info =
    error && typeof error === "object"
      ? String((error as { codexErrorInfo?: unknown }).codexErrorInfo ?? "")
      : "";
  if (
    info === "unauthorized" ||
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
    info === "usageLimitExceeded" ||
    /(?:usage limit|rate[_ ]limit|limit[_ ]reached|quota exceeded|insufficient quota|too many requests|(?:no|0)\s+(?:weighted\s+)?tokens?\s+(?:left|remaining)|tokens?\s+(?:exhausted|depleted)|\b429\b)/i.test(
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
