import { JsonFile, type JsonRepository } from "./json-file.js";
import { TRANSIENT_SESSION_RETENTION_MS } from "./retention-policy.js";
import { SqliteDocument } from "./state-database.js";

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
  private readonly data: JsonRepository<Required<EngagementFile>>;

  constructor(file: string, databaseFile?: string) {
    this.data = databaseFile
      ? new SqliteDocument(databaseFile, "engagement", file, normalizeFile)
      : new JsonFile(file, normalizeFile);
  }

  get(sessionId: string): EngagementRecord | null {
    const found = this.data.read().sessions[sessionId];
    return found ? { ...found } : null;
  }

  recordVisit(sessionId: string, sample: EngagementVisitSample): EngagementRecord {
    return this.data.update((data) => {
      const prev = normalizeRecord(data.sessions[sessionId]);
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
      data.sessions[sessionId] = next;
      return { ...next };
    });
  }

  recordUserMessage(sessionId: string, sentAt = Date.now()): EngagementRecord {
    return this.data.update((data) => {
      const prev = normalizeRecord(data.sessions[sessionId]);
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
      data.sessions[sessionId] = next;
      return { ...next };
    });
  }

  /** Remove reconstructable telemetry only when its latest timestamp is definitively old. */
  prune(now = Date.now()): number {
    const cutoff = now - TRANSIENT_SESSION_RETENTION_MS;
    return this.data.transact((data) => {
      let removed = 0;
      for (const [sessionId, record] of Object.entries(data.sessions)) {
        const latest = Math.max(record.lastViewedAt ?? 0, record.lastUserMessageAt ?? 0);
        if (latest > 0 && latest < cutoff) {
          delete data.sessions[sessionId];
          removed += 1;
        }
      }
      return { result: removed, changed: removed > 0 };
    });
  }
}

function normalizeFile(value: unknown): Required<EngagementFile> {
  const input = value && typeof value === "object" ? (value as EngagementFile) : {};
  const sessions: Record<string, EngagementRecord> = {};
  for (const [sessionId, record] of Object.entries(input.sessions ?? {})) {
    sessions[sessionId] = normalizeRecord(record);
  }
  return { sessions };
}
