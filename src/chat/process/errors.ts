import {
  type ProviderErrorClassifier,
  type PublicProviderError,
  errorText,
} from "../provider-errors.js";

export function cliErrorClassifier(
  vendor: "antigravity" | "copilot",
  label: string,
  loginCommand: string,
): ProviderErrorClassifier {
  return (error: unknown): PublicProviderError | null => {
    const detail = errorText(error).trim();
    if (
      /(?:not logged in|login[_ ]required|sign.?in required|authentication[_ ](?:required|failed)|unauthorized|invalid.*(?:token|credentials|api key)|\b401\b)/i.test(
        detail,
      )
    ) {
      return {
        code: `${vendor}_auth_required`,
        vendor,
        message: `${label} sign-in is required. Run \`${loginCommand}\`, then retry.`,
        command: loginCommand,
        retryable: false,
      };
    }
    if (
      /(?:usage limit|rate[_ ]limit|limit[_ ]reached|quota exceeded|insufficient quota|too many requests|\b429\b)/i.test(
        detail,
      )
    ) {
      return {
        code: `${vendor}_usage_limit`,
        vendor,
        message: detail || `${label} usage limit reached.`,
        retryable: true,
      };
    }
    return null;
  };
}

export const classifyAntigravityError = cliErrorClassifier("antigravity", "Antigravity", "agy");
export const classifyCopilotError = cliErrorClassifier(
  "copilot",
  "GitHub Copilot",
  "copilot login",
);
