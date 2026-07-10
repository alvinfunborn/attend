export interface ModelOption {
  value: string;
  label: string;
  /** per-model reasoning levels, when the vendor advertises them (Codex models cache) */
  efforts?: string[];
  /** the model's own default reasoning level, when known */
  defaultEffort?: string;
}

export function modelOptionsFromStrings(models: string[]): ModelOption[] {
  const seen = new Set<string>();
  const options: ModelOption[] = [];
  for (const raw of models) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label: value });
  }
  return options;
}
