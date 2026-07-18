export interface ModelConfiguration {
  /** Exact vendor-owned value used to execute this configuration. */
  value: string;
  effort?: string;
  speed?: string;
}

export interface ModelOption {
  value: string;
  label: string;
  /** per-model reasoning levels in the exact order advertised by the vendor */
  efforts?: string[];
  /** the model's own default reasoning level, when known */
  defaultEffort?: string;
  /** Optional vendor-owned display labels for effort values. */
  effortLabels?: Record<string, string>;
  /** per-model speed tiers in the exact order advertised by the vendor */
  speeds?: string[];
  /** the model's own default speed tier, when known */
  defaultSpeed?: string;
  /** Optional vendor-owned display labels for speed tiers. */
  speedLabels?: Record<string, string>;
  /** Exact allowed combinations for vendors that publish a configuration
   * matrix. Cursor uses this to avoid inventing effort/speed combinations. */
  configurations?: ModelConfiguration[];
}

/** Effective defaults resolved by the vendor's own CLI/config engine. */
export interface ModelDefaults {
  model: string;
  effort: string;
  speed: string;
}
