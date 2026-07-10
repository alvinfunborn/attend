import fs from "node:fs";
import path from "node:path";

export const REVIEW_MIN_DWELL_MS = 20_000;

export interface EngagementVisitSample {
  viewedMs: number;
  endedAt?: number | null;
  hadMeaningfulScroll?: boolean;
  hadSend?: boolean;
  wasGenerating?: boolean;
}

export interface EngagementRecord {
  opens: number;
  viewMs: number;
  reviewVisits: number;
  reviewMs: number;
  lastViewedAt: number | null;
  /** Last user-authored turn; avoidance evidence is measured from this point. */
  lastUserMessageAt: number | null;
}

interface EngagementFile {
  sessions?: Record<string, EngagementRecord>;
}

function clampMs(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function normalizeTs(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function normalizeRecord(input: Partial<EngagementRecord> | undefined): EngagementRecord {
  return {
    opens: Math.max(0, Math.floor(Number(input?.opens ?? 0) || 0)),
    viewMs: clampMs(input?.viewMs),
    reviewVisits: Math.max(0, Math.floor(Number(input?.reviewVisits ?? 0) || 0)),
    reviewMs: clampMs(input?.reviewMs),
    lastViewedAt: normalizeTs(input?.lastViewedAt),
    lastUserMessageAt: normalizeTs(input?.lastUserMessageAt),
  };
}

function qualifiesReview(sample: EngagementVisitSample): boolean {
  return (
    clampMs(sample.viewedMs) >= REVIEW_MIN_DWELL_MS &&
    sample.hadMeaningfulScroll === true &&
    sample.hadSend !== true &&
    sample.wasGenerating !== true
  );
}

export class EngagementStore {
  private bySession = new Map<string, EngagementRecord>();
  private loaded = false;

  constructor(private readonly file: string) {}

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, "utf-8")) as EngagementFile;
      for (const [sessionId, value] of Object.entries(raw.sessions ?? {})) {
        this.bySession.set(sessionId, normalizeRecord(value));
      }
    } catch {
      // missing/corrupt — start empty
    }
  }

  get(sessionId: string): EngagementRecord | null {
    this.load();
    const found = this.bySession.get(sessionId);
    return found ? { ...found } : null;
  }

  recordVisit(sessionId: string, sample: EngagementVisitSample): EngagementRecord {
    this.load();
    const prev = normalizeRecord(this.bySession.get(sessionId));
    const viewedMs = clampMs(sample.viewedMs);
    const endedAt = normalizeTs(sample.endedAt) ?? Date.now();
    if (prev.lastUserMessageAt !== null && endedAt <= prev.lastUserMessageAt) {
      return { ...prev };
    }
    const isReview = qualifiesReview(sample);
    const next: EngagementRecord = {
      opens: prev.opens + (viewedMs > 0 ? 1 : 0),
      viewMs: prev.viewMs + viewedMs,
      reviewVisits: prev.reviewVisits + (isReview ? 1 : 0),
      reviewMs: prev.reviewMs + (isReview ? viewedMs : 0),
      lastViewedAt: prev.lastViewedAt === null ? endedAt : Math.max(prev.lastViewedAt, endedAt),
      lastUserMessageAt: prev.lastUserMessageAt,
    };
    this.bySession.set(sessionId, next);
    this.persist();
    return { ...next };
  }

  recordUserMessage(sessionId: string, sentAt = Date.now()): EngagementRecord {
    this.load();
    const prev = normalizeRecord(this.bySession.get(sessionId));
    const lastUserMessageAt = Math.max(
      prev.lastUserMessageAt ?? 0,
      normalizeTs(sentAt) ?? Date.now(),
    );
    const next: EngagementRecord = {
      opens: 0,
      viewMs: 0,
      reviewVisits: 0,
      reviewMs: 0,
      lastViewedAt:
        prev.lastViewedAt !== null && prev.lastViewedAt > lastUserMessageAt
          ? prev.lastViewedAt
          : null,
      lastUserMessageAt,
    };
    this.bySession.set(sessionId, next);
    this.persist();
    return { ...next };
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(
        this.file,
        JSON.stringify({ sessions: Object.fromEntries(this.bySession) }, null, 2),
      );
    } catch {
      // best-effort persistence
    }
  }
}
