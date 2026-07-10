import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AnalysisState } from "./daemon/cache.js";
import type { RawSession } from "./types.js";

const RETENTION_MS = 180 * 86_400_000;
const MAX_EVENTS = 200_000;

export type WorkEventKind =
  | "user_prompt"
  | "turn_started"
  | "turn_finished"
  | "queue_enqueued"
  | "daemon_state";

export interface WorkEvent {
  id: string;
  kind: WorkEventKind;
  at: number;
  sessionId: string;
  vendor?: string;
  queueId?: string;
  ok?: boolean;
  state?: AnalysisState | null;
  source: "transcript" | "live";
}

interface WorkEventFile {
  version: 1;
  events: WorkEvent[];
}

function validAt(value: unknown): number | null {
  const at = Number(value);
  return Number.isFinite(at) && at > 0 ? Math.floor(at) : null;
}

function normalizeEvent(value: WorkEvent): WorkEvent | null {
  const at = validAt(value.at);
  const sessionId = typeof value.sessionId === "string" ? value.sessionId.trim() : "";
  if (!at || !sessionId || !value.id || !value.kind) return null;
  return { ...value, at, sessionId };
}

function promptId(sessionId: string, at: number): string {
  return `prompt:${sessionId}:${Math.floor(at)}`;
}

function hasNearby(sorted: number[], at: number, tolerance: number): boolean {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((sorted[middle] ?? 0) < at) low = middle + 1;
    else high = middle;
  }
  return (
    Math.abs((sorted[low] ?? Number.POSITIVE_INFINITY) - at) <= tolerance ||
    Math.abs((sorted[low - 1] ?? Number.NEGATIVE_INFINITY) - at) <= tolerance
  );
}

export class WorkEventStore {
  private events: WorkEvent[] = [];
  private ids = new Set<string>();
  private loaded = false;

  constructor(private readonly file: string) {}

  list(): WorkEvent[] {
    this.load();
    return this.events.map((event) => ({ ...event }));
  }

  record(
    event: Omit<WorkEvent, "id"> & { id?: string },
    opts: { dedupeWithinMs?: number } = {},
  ): WorkEvent {
    this.load();
    const at = validAt(event.at) ?? Date.now();
    const dedupeWithinMs = Math.max(0, opts.dedupeWithinMs ?? 0);
    if (dedupeWithinMs > 0) {
      let existing: WorkEvent | undefined;
      for (let index = this.events.length - 1; index >= 0; index -= 1) {
        const candidate = this.events[index];
        if (
          candidate &&
          candidate.kind === event.kind &&
          candidate.sessionId === event.sessionId &&
          Math.abs(candidate.at - at) <= dedupeWithinMs
        ) {
          existing = candidate;
          break;
        }
      }
      if (existing) return { ...existing };
    }
    const id = event.id ?? `${event.kind}:${crypto.randomUUID()}`;
    const normalized = normalizeEvent({ ...event, id, at });
    if (!normalized) throw new Error("invalid work event");
    if (this.ids.has(id)) return { ...(this.events.find((item) => item.id === id) as WorkEvent) };
    this.events.push(normalized);
    this.ids.add(id);
    this.prune(at);
    this.persist();
    return { ...normalized };
  }

  backfillPrompts(sessions: RawSession[]): number {
    this.load();
    let added = 0;
    const livePromptTimes = new Map<string, number[]>();
    for (const event of this.events) {
      if (event.kind !== "user_prompt" || event.source !== "live") continue;
      const times = livePromptTimes.get(event.sessionId) ?? [];
      times.push(event.at);
      livePromptTimes.set(event.sessionId, times);
    }
    for (const times of livePromptTimes.values()) times.sort((a, b) => a - b);
    for (const session of sessions) {
      if (!session.sessionId) continue;
      for (const at of session.userPromptTs ?? []) {
        const valid = validAt(at);
        if (!valid) continue;
        const id = promptId(session.sessionId, valid);
        if (this.ids.has(id)) continue;
        const nearby = hasNearby(livePromptTimes.get(session.sessionId) ?? [], valid, 5_000);
        if (nearby) continue;
        const event: WorkEvent = {
          id,
          kind: "user_prompt",
          at: valid,
          sessionId: session.sessionId,
          vendor: session.vendor,
          source: "transcript",
        };
        this.events.push(event);
        this.ids.add(id);
        added += 1;
      }
    }
    if (added > 0) {
      this.events.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
      this.prune(Date.now());
      this.persist();
    }
    return added;
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, "utf-8")) as WorkEventFile;
      for (const raw of parsed.events ?? []) {
        const event = normalizeEvent(raw);
        if (!event || this.ids.has(event.id)) continue;
        this.events.push(event);
        this.ids.add(event.id);
      }
      this.events.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    } catch {
      this.events = [];
      this.ids.clear();
    }
  }

  private prune(now: number): void {
    const since = now - RETENTION_MS;
    if (this.events.length <= MAX_EVENTS && (this.events[0]?.at ?? now) >= since) return;
    this.events = this.events.filter((event) => event.at >= since).slice(-MAX_EVENTS);
    this.ids = new Set(this.events.map((event) => event.id));
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp-${process.pid}`;
      fs.writeFileSync(
        tmp,
        JSON.stringify({ version: 1, events: this.events } satisfies WorkEventFile),
      );
      fs.renameSync(tmp, this.file);
    } catch {
      // Telemetry is best effort and must never block chat execution.
    }
  }
}
