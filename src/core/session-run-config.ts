/** Model/reasoning/speed values that belong to one provider session. */
export interface SessionRunConfig {
  model?: string;
  effort?: string;
  speed?: string;
}

/**
 * `provider` means the vendor persisted an exact session/turn setting.
 * `provider-observed` is a best-effort observation (for example Cursor's
 * routed/display model) and must not replace an Attend-owned exact selection.
 */
export interface ProviderSessionRunConfig extends SessionRunConfig {
  source: "provider" | "provider-observed";
  /** Timestamp of the provider record that supplied these values, when known. */
  updatedAt?: number;
}

const CONFIG_KEYS = ["model", "effort", "speed"] as const;

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/** Keep only concrete, non-empty provider values. */
export function normalizeSessionRunConfig(value: unknown): SessionRunConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const out: SessionRunConfig = {};
  for (const key of CONFIG_KEYS) {
    const next = clean(input[key]);
    if (next) out[key] = next;
  }
  return out;
}

export function hasSessionRunConfig(value: SessionRunConfig | undefined): boolean {
  return !!(value?.model || value?.effort || value?.speed);
}

/** Collision-free in practice while keeping the persisted document inspectable. */
export function sessionRunConfigKey(vendor: string, sessionId: string): string {
  const cleanVendor = vendor.trim().toLowerCase();
  const cleanSessionId = sessionId.trim();
  return cleanVendor && cleanSessionId ? `${cleanVendor}:${cleanSessionId}` : "";
}

/**
 * Merge provider history with Attend's saved selection one field at a time.
 * Exact provider state wins; an observed value only fills a missing saved field.
 */
export function mergeSessionRunConfig(
  provider: ProviderSessionRunConfig | undefined,
  saved: (SessionRunConfig & { updatedAt?: number }) | undefined,
): SessionRunConfig {
  const providerValues = normalizeSessionRunConfig(provider);
  const savedValues = normalizeSessionRunConfig(saved);
  const providerAt = Number(provider?.updatedAt) || 0;
  const savedAt = Number(saved?.updatedAt) || 0;
  const savedIsNewer = providerAt > 0 && savedAt > providerAt;
  const merged =
    provider?.source === "provider-observed" || savedIsNewer
      ? { ...providerValues, ...savedValues }
      : { ...savedValues, ...providerValues };
  return normalizeSessionRunConfig(merged);
}
