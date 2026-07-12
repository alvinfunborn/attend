export interface ModelOption {
  value: string;
  label: string;
  /** per-model reasoning levels in the exact order advertised by the vendor */
  efforts?: string[];
  /** the model's own default reasoning level, when known */
  defaultEffort?: string;
  /** Optional display labels when an integration encodes richer variants in
   * the effort value (Cursor uses full parameterized model ids here). */
  effortLabels?: Record<string, string>;
}

/** Effective defaults resolved by the vendor's own CLI/config engine. */
export interface ModelDefaults {
  model: string;
  effort: string;
}
