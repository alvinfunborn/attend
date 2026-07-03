export interface ModelOption {
  value: string;
  label: string;
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
