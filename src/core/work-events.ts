import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AnalysisState } from "./daemon/cache.js";
import type { RawSession } from "./types.js";

const RETENTION_MS = 180 * 86_400_000;
const MAX_EVENTS = 200_000;

export type WorkEventKind =
  | "user_prompt"
  | "assistant_output"
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
  /** real user prompt text length; absent on legacy persisted events */
  chars?: number;
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
  const chars = Math.max(0, Math.floor(Number(value.chars) || 0));
  return { ...value, at, sessionId, ...(chars ? { chars } : {}) };
}

function promptId(sessionId: string, at: number): string {
  return `prompt:${sessionId}:${Math.floor(at)}`;
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
    const livePrompts = new Map<string, WorkEvent[]>();
    const liveAssistantOutputs = new Map<string, WorkEvent[]>();
    for (const event of this.events) {
      if (event.source !== "live") continue;
      const target = event.kind === "user_prompt" ? livePrompts : liveAssistantOutputs;
      if (event.kind !== "user_prompt" && event.kind !== "assistant_output") continue;
      const entries = target.get(event.sessionId) ?? [];
      entries.push(event);
      target.set(event.sessionId, entries);
    }
    for (const prompts of livePrompts.values()) prompts.sort((a, b) => a.at - b.at);
    for (const outputs of liveAssistantOutputs.values()) outputs.sort((a, b) => a.at - b.at);
    for (const session of sessions) {
      if (!session.sessionId) continue;
      const promptActivity = session.userPromptActivity?.length
        ? session.userPromptActivity
        : (session.userPromptTs ?? []).map((at) => ({ at, chars: 0 }));
      for (const prompt of promptActivity) {
        const valid = validAt(prompt.at);
        if (!valid) continue;
        const id = promptId(session.sessionId, valid);
        if (this.ids.has(id)) continue;
        const nearby = (livePrompts.get(session.sessionId) ?? []).find(
          (event) => Math.abs(event.at - valid) <= 5_000,
        );
        if (nearby) {
          if (!nearby.chars && prompt.chars > 0) {
            nearby.chars = Math.floor(prompt.chars);
            added += 1;
          }
          continue;
        }
        const event: WorkEvent = {
          id,
          kind: "user_prompt",
          at: valid,
          sessionId: session.sessionId,
          vendor: session.vendor,
          ...(prompt.chars > 0 ? { chars: Math.floor(prompt.chars) } : {}),
          source: "transcript",
        };
        this.events.push(event);
        this.ids.add(id);
        added += 1;
      }
      for (const output of session.assistantTextActivity ?? []) {
        const valid = validAt(output.at);
        if (!valid || output.chars <= 0) continue;
        const nearby = (liveAssistantOutputs.get(session.sessionId) ?? []).some(
          (event) => Math.abs(event.at - valid) <= 5_000,
        );
        if (nearby) continue;
        const id = `assistant:${session.sessionId}:${Math.floor(valid)}`;
        if (this.ids.has(id)) continue;
        this.events.push({
          id,
          kind: "assistant_output",
          at: valid,
          sessionId: session.sessionId,
          vendor: session.vendor,
          chars: Math.floor(output.chars),
          source: "transcript",
        });
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
