import fs from "node:fs";
import path from "node:path";

export interface VaultUiState {
  theme?: "light" | "dark";
  focusViews?: unknown[];
  modelPrefs?: Record<string, unknown>;
  pins?: Record<string, unknown[]>;
  sessionTitles?: Record<string, string>;
  /** child provider session id -> parent provider session id */
  forkParents?: Record<string, string>;
}

/** Vault-owned UI data that must survive browsers without leaking across vaults. */
export class VaultUiStateStore {
  private loaded = false;
  private state: VaultUiState = {};

  constructor(private readonly file: string) {}

  get(): VaultUiState {
    this.load();
    return structuredClone(this.state);
  }

  patch(next: VaultUiState): VaultUiState {
    this.load();
    if (next.theme === "light" || next.theme === "dark") this.state.theme = next.theme;
    if (Array.isArray(next.focusViews)) this.state.focusViews = structuredClone(next.focusViews);
    if (next.modelPrefs && typeof next.modelPrefs === "object")
      this.state.modelPrefs = structuredClone(next.modelPrefs);
    if (next.pins && typeof next.pins === "object") this.state.pins = structuredClone(next.pins);
    if (next.sessionTitles && typeof next.sessionTitles === "object")
      this.state.sessionTitles = cleanStringRecord(next.sessionTitles);
    if (next.forkParents && typeof next.forkParents === "object")
      this.state.forkParents = cleanStringRecord(next.forkParents);
    this.persist();
    return this.get();
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, "utf-8")) as VaultUiState;
      if (raw && typeof raw === "object") this.state = raw;
    } catch {
      this.state = {};
    }
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
      fs.renameSync(tmp, this.file);
    } catch {
      // best-effort persistence
    }
  }
}

function cleanStringRecord(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.trim();
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (key && value) out[key] = value;
  }
  return out;
}
