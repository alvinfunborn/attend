export interface PublicProviderError {
  code: `${"claude" | "codex" | "cursor"}_${"auth_required" | "usage_limit"}`;
  vendor: "claude" | "codex" | "cursor";
  message: string;
  command?: string;
  retryable: boolean;
}

export type ProviderErrorClassifier = (error: unknown) => PublicProviderError | null;
export type ProviderErrorPayload =
  | PublicProviderError
  | { message: string; code?: never; vendor?: never; command?: never; retryable?: never };

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}

export function providerErrorPayload(
  classify: ProviderErrorClassifier | undefined,
  error: unknown,
): ProviderErrorPayload {
  return classify?.(error) ?? { message: errorText(error) };
}
