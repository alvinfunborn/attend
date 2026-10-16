import type { SessionTokenUsage } from "../types.js";

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Normalize native usage without estimating tokens from transcript text. */
export function parseTokenUsage(
  value: unknown,
  cacheIncludedInInput: boolean,
): SessionTokenUsage | null {
  if (!value || typeof value !== "object") return null;
  const usage = value as Record<string, unknown>;
  const input = count(usage.input_tokens);
  const output = count(usage.output_tokens);
  if (input === null || output === null) return null;
  const cachedInput = count(usage.cached_input_tokens ?? usage.cache_read_input_tokens) ?? 0;
  const cacheWriteInput =
    count(usage.cache_write_input_tokens ?? usage.cache_creation_input_tokens) ?? 0;
  const allInput = input + (cacheIncludedInInput ? 0 : cachedInput + cacheWriteInput);
  return {
    input: allInput,
    output,
    cachedInput,
    cacheWriteInput,
    total: count(usage.total_tokens) ?? allInput + output,
  };
}
