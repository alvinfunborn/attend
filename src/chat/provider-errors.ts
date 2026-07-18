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
  return error instanceof Error ? error.message : String(error);
}

export function providerErrorPayload(
  classify: ProviderErrorClassifier | undefined,
  error: unknown,
): ProviderErrorPayload {
  return classify?.(error) ?? { message: errorText(error) };
}
