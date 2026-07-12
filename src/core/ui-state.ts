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
  /** Hidden provider sessions attached as comment threads to transcript messages. */
  commentThreads?: Record<string, CommentThreadState>;
}

export interface CommentThreadState {
  id: string;
  parentSessionId: string;
  anchorKey: string;
  anchorText: string;
  anchorData?: CommentAnchorData;
  providerSessionId: string;
  vendor: string;
  cwd: string;
  createdAt: number;
  createdWhileGenerating?: boolean;
  status?: "generating" | "unread" | "read" | "failed";
  messageCount?: number;
}

export type CommentAnchorData =
  | { kind: "message"; role: "user" | "assistant"; text: string }
  | {
      kind: "tool";
      tool: { name: string; input?: unknown; result?: unknown; isError?: boolean };
    };

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
    if (next.commentThreads && typeof next.commentThreads === "object")
      this.state.commentThreads = cleanCommentThreads(next.commentThreads);
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

function cleanCommentThreads(
  input: Record<string, CommentThreadState>,
): Record<string, CommentThreadState> {
  const out: Record<string, CommentThreadState> = {};
  for (const [rawKey, raw] of Object.entries(input)) {
    if (!raw || typeof raw !== "object") continue;
    const id = String(raw.id || rawKey).trim();
    const parentSessionId = String(raw.parentSessionId || "").trim();
    const anchorKey = String(raw.anchorKey || "").trim();
    const providerSessionId = String(raw.providerSessionId || "").trim();
    const vendor = String(raw.vendor || "").trim();
    const cwd = String(raw.cwd || "").trim();
    if (!id || !parentSessionId || !anchorKey || !providerSessionId || !vendor || !cwd) continue;
    out[id] = {
      id,
      parentSessionId,
      anchorKey,
      anchorText: String(raw.anchorText || "").slice(0, 20_000),
      ...(raw.anchorData && typeof raw.anchorData === "object"
        ? { anchorData: structuredClone(raw.anchorData) }
        : {}),
      providerSessionId,
      vendor,
      cwd,
      createdAt: Number(raw.createdAt) || Date.now(),
      ...(raw.createdWhileGenerating ? { createdWhileGenerating: true } : {}),
      ...(raw.status === "generating" ||
      raw.status === "unread" ||
      raw.status === "read" ||
      raw.status === "failed"
        ? { status: raw.status }
        : {}),
      messageCount: Math.max(0, Math.floor(Number(raw.messageCount) || 0)),
    };
  }
  return out;
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
