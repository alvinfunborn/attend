import type { Analysis, AnalysisState } from "./daemon/cache.js";
import type { RawSession } from "./types.js";
import type { WorkEvent } from "./work-events.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const OUTCOME_WINDOW_MS = 72 * HOUR_MS;
const DORMANT_AFTER_MS = 72 * HOUR_MS;

export type WorkMode = "focus" | "balanced" | "parallel";
export type WorkStatsRange = "1h" | "3h" | "6h" | "12h" | "today" | "24h" | "3d" | "7d" | "15d";

export interface WorkStatsTimelineBucket {
  start: number;
  end: number;
  sessions: number;
  prompts: number;
  promptedHours: number;
  switches: number;
  modeHours: Record<WorkMode, number>;
}

export interface WorkModeStats {
  mode: WorkMode;
  promptedHours: number;
  sessionsPerPromptedHour: number;
  promptsPerPromptedHour: number;
  switchRate: number | null;
  completedTurns: number;
  completedTurnsPerPromptedHour: number;
  medianTurnMinutes: number | null;
  resolvedOrAdvanced72hRate: number | null;
  outcomeSamples: number;
}

export interface DormantSessionStats {
  sessionId: string;
  title: string;
  project: string;
  vendor: string;
  lastUserAt: number;
  ageDays: number;
  state: AnalysisState;
  priority: number;
  etaMin: number;
}

export interface WorkStats {
  generatedAt: number;
  range: WorkStatsRange;
  windowStart: number;
  elapsedHours: number;
  timelineUnit: "hour";
  summary: {
    sessionsTouched: number;
    prompts: number;
    promptedHours: number;
    promptsPerElapsedHour: number;
    completedTurns: number;
    completedTurnsPerElapsedHour: number;
    modelBusyRate: number | null;
    overlapRate: number | null;
    peakConcurrency: number | null;
    medianTurnMinutes: number | null;
    medianQueueWaitMinutes: number | null;
    resourceObservedHours: number;
  };
  timeline: WorkStatsTimelineBucket[];
  modes: WorkModeStats[];
  dormant: {
    attention: { count: number; items: DormantSessionStats[] };
    blocked: { count: number; items: DormantSessionStats[] };
  };
  live: {
    generating: number;
    queuedTurns: number;
    queuedSessions: number;
  };
  coverage: {
    ledgerSince: number | null;
    promptSince: number | null;
    turnSince: number | null;
    stateSince: number | null;
    sessionsWithPromptHistory: number;
    sessionsWithState: number;
    sessionsWithoutState: number;
  };
}

export interface WorkStatsOptions {
  analysisFor?: (sessionId: string) => Analysis | null;
  customTitles?: Record<string, unknown>;
  activeSessionIds?: Iterable<string>;
  queues?: Record<string, { count: number; parked: boolean }>;
  events?: WorkEvent[];
}

interface HourSample {
  start: number;
  end: number;
  observedStart: number;
  observedEnd: number;
  prompts: WorkEvent[];
  sessionKeys: Set<string>;
  switches: number;
}

interface TurnInterval {
  sessionId: string;
  vendor?: string;
  queueId?: string;
  start: number;
  end: number;
  ok: boolean | null;
  complete: boolean;
}

const VALID_RANGES: WorkStatsRange[] = ["1h", "3h", "6h", "12h", "today", "24h", "3d", "7d", "15d"];

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 1
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return round(value);
}

function localDayStart(value: number): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function localHourStart(value: number): number {
  const date = new Date(value);
  date.setMinutes(0, 0, 0);
  return date.getTime();
}

function addLocalDays(value: number, days: number): number {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function normalizeRange(value: string): WorkStatsRange {
  return VALID_RANGES.includes(value as WorkStatsRange) ? (value as WorkStatsRange) : "today";
}

function rangeStart(now: number, range: WorkStatsRange): number {
  const hours = range.endsWith("h") ? Number.parseInt(range, 10) : 0;
  if (hours > 0) return now - hours * HOUR_MS;
  if (range === "today") return localDayStart(now);
  return addLocalDays(localDayStart(now), -(Number.parseInt(range, 10) - 1));
}

function hourSamples(windowStart: number, now: number): HourSample[] {
  const samples: HourSample[] = [];
  let cursor = localHourStart(windowStart);
  while (cursor < now) {
    const end = cursor + HOUR_MS;
    samples.push({
      start: cursor,
      end,
      observedStart: Math.max(cursor, windowStart),
      observedEnd: Math.min(end, now),
      prompts: [],
      sessionKeys: new Set<string>(),
      switches: 0,
    });
    cursor = end;
  }
  return samples.length
    ? samples
    : [
        {
          start: localHourStart(now),
          end: localHourStart(now) + HOUR_MS,
          observedStart: windowStart,
          observedEnd: now,
          prompts: [],
          sessionKeys: new Set<string>(),
          switches: 0,
        },
      ];
}

function modeFor(sessionCount: number): WorkMode | null {
  if (sessionCount <= 0) return null;
  if (sessionCount <= 2) return "focus";
  if (sessionCount <= 5) return "balanced";
  return "parallel";
}

function sampleFor(samples: HourSample[], at: number): HourSample | null {
  let low = 0;
  let high = samples.length - 1;
  while (low <= high) {
    const index = (low + high) >> 1;
    const sample = samples[index];
    if (!sample) return null;
    if (at < sample.observedStart) high = index - 1;
    else if (at > sample.observedEnd) low = index + 1;
    else return sample;
  }
  return null;
}

function openWorkState(state: AnalysisState | null): state is AnalysisState {
  return (
    state === "continue_ready" ||
    state === "needs_decision" ||
    state === "needs_input" ||
    state === "needs_review"
  );
}

function terminalState(state: AnalysisState | null | undefined): boolean {
  return state === "done" || state === "followup_suggested";
}

function lastEventAtOrBefore(events: WorkEvent[], at: number): WorkEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event && event.at <= at) return event;
  }
  return null;
}

function eventSince(events: WorkEvent[], kinds: WorkEvent["kind"][]): number | null {
  return events.find((event) => kinds.includes(event.kind))?.at ?? null;
}

function buildTurnIntervals(events: WorkEvent[], now: number): TurnInterval[] {
  const open = new Map<string, WorkEvent>();
  const intervals: TurnInterval[] = [];
  for (const event of events) {
    if (event.kind === "turn_started") {
      const previous = open.get(event.sessionId);
      if (previous) {
        intervals.push({
          sessionId: previous.sessionId,
          vendor: previous.vendor,
          queueId: previous.queueId,
          start: previous.at,
          end: event.at,
          ok: false,
          complete: false,
        });
      }
      open.set(event.sessionId, event);
    } else if (event.kind === "turn_finished") {
      const start = open.get(event.sessionId);
      if (!start || event.at < start.at) continue;
      intervals.push({
        sessionId: event.sessionId,
        vendor: start.vendor ?? event.vendor,
        queueId: start.queueId,
        start: start.at,
        end: event.at,
        ok: event.ok ?? null,
        complete: true,
      });
      open.delete(event.sessionId);
    }
  }
  for (const start of open.values()) {
    intervals.push({
      sessionId: start.sessionId,
      vendor: start.vendor,
      queueId: start.queueId,
      start: start.at,
      end: now,
      ok: null,
      complete: false,
    });
  }
  return intervals;
}

function concurrencyStats(
  turns: TurnInterval[],
  windowStart: number,
  now: number,
): { busyRate: number | null; overlapRate: number | null; peak: number | null } {
  const tracked = turns.filter((turn) => turn.end >= windowStart && turn.start <= now);
  if (!tracked.length) return { busyRate: null, overlapRate: null, peak: null };
  const points = new Map<number, number>();
  for (const turn of tracked) {
    const start = Math.max(windowStart, turn.start);
    const end = Math.min(now, turn.end);
    if (end <= start) continue;
    points.set(start, (points.get(start) ?? 0) + 1);
    points.set(end, (points.get(end) ?? 0) - 1);
  }
  let active = 0;
  let peak = 0;
  let previous = windowStart;
  let busyMs = 0;
  let overlapMs = 0;
  for (const [at, delta] of [...points.entries()].sort((a, b) => a[0] - b[0])) {
    const duration = Math.max(0, at - previous);
    if (active > 0) busyMs += duration;
    if (active > 1) overlapMs += duration;
    active += delta;
    peak = Math.max(peak, active);
    previous = at;
  }
  const elapsed = Math.max(1, now - windowStart);
  return {
    busyRate: round(busyMs / elapsed, 3),
    overlapRate: busyMs > 0 ? round(overlapMs / busyMs, 3) : 0,
    peak,
  };
}

function modeHours(samples: HourSample[]): Record<WorkMode, number> {
  const out = { focus: 0, balanced: 0, parallel: 0 };
  for (const sample of samples) {
    const mode = modeFor(sample.sessionKeys.size);
    if (mode) out[mode] += 1;
  }
  return out;
}

function timelineBuckets(samples: HourSample[]): {
  unit: "hour";
  buckets: WorkStatsTimelineBucket[];
} {
  return {
    unit: "hour",
    buckets: samples.map((sample) => ({
      start: sample.start,
      end: sample.end,
      sessions: sample.sessionKeys.size,
      prompts: sample.prompts.length,
      promptedHours: sample.prompts.length ? 1 : 0,
      switches: sample.switches,
      modeHours: modeHours([sample]),
    })),
  };
}

function latestUserAt(session: RawSession): number | null {
  const exact = (session.userPromptTs ?? []).filter((at) => Number.isFinite(at) && at > 0);
  return exact.length ? Math.max(...exact) : null;
}

function customTitle(sessionId: string, titles: Record<string, unknown> | undefined): string {
  const value = titles?.[sessionId];
  return typeof value === "string" ? value.trim() : "";
}

function dormantItem(
  session: RawSession,
  analysis: Analysis,
  lastUserAt: number,
  now: number,
  titles: Record<string, unknown> | undefined,
): DormantSessionStats {
  return {
    sessionId: session.sessionId as string,
    title:
      customTitle(session.sessionId as string, titles) ||
      analysis.brief.trim() ||
      session.title?.trim() ||
      (session.cwd ? session.cwd.split(/[\\/]/).at(-1) || "session" : "session"),
    project: session.cwd ? session.cwd.split(/[\\/]/).at(-1) || "—" : "—",
    vendor: session.vendor,
    lastUserAt,
    ageDays: Math.floor((now - lastUserAt) / DAY_MS),
    state: analysis.state as AnalysisState,
    priority: analysis.priority,
    etaMin: analysis.etaMin,
  };
}

export function trailingPromptActivity(
  events: WorkEvent[],
  now: number,
  hours = 24,
): { sessions: number; prompts: number; chars: number } {
  const since = now - Math.max(1, hours) * HOUR_MS;
  const prompts = events.filter(
    (event) => event.kind === "user_prompt" && event.at >= since && event.at <= now,
  );
  return {
    sessions: new Set(prompts.map((event) => event.sessionId)).size,
    prompts: prompts.length,
    chars: events
      .filter(
        (event) =>
          (event.kind === "user_prompt" || event.kind === "assistant_output") &&
          event.at >= since &&
          event.at <= now,
      )
      .reduce((total, event) => total + Math.max(0, Number(event.chars) || 0), 0),
  };
}

export function buildWorkStats(
  sessions: RawSession[],
  now: number,
  requestedRange: string,
  options: WorkStatsOptions = {},
): WorkStats {
  const range = normalizeRange(requestedRange);
  const windowStart = rangeStart(now, range);
  const elapsedHours = Math.max((now - windowStart) / HOUR_MS, 1 / 60);
  const samples = hourSamples(windowStart, now);
  const eventFloor = windowStart - OUTCOME_WINDOW_MS;
  const events = (options.events ?? [])
    .filter((event) => event.at >= eventFloor && event.at <= now)
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const promptEvents = events.filter(
    (event) => event.kind === "user_prompt" && event.at >= windowStart && event.at <= now,
  );
  for (const event of promptEvents) {
    const sample = sampleFor(samples, event.at);
    if (!sample) continue;
    sample.prompts.push(event);
    sample.sessionKeys.add(event.sessionId);
  }

  for (let index = 1; index < promptEvents.length; index += 1) {
    const event = promptEvents[index];
    const previous = promptEvents[index - 1];
    if (!event || !previous || event.sessionId === previous.sessionId) continue;
    const sample = sampleFor(samples, event.at);
    if (sample) sample.switches += 1;
  }

  const activeSamples = samples.filter((sample) => sample.prompts.length > 0);
  const comparableSamples = activeSamples.filter(
    (sample) => sample.observedStart === sample.start && sample.observedEnd === sample.end,
  );
  const turns = buildTurnIntervals(events, now);
  const liveTurnEvents = events.filter(
    (event) =>
      event.source === "live" && (event.kind === "turn_started" || event.kind === "turn_finished"),
  );
  const turnTrackingSince = liveTurnEvents[0]?.at ?? null;
  const completedTurns = turns.filter(
    (turn) => turn.complete && turn.end >= windowStart && turn.end <= now,
  );
  const resourceWindowStart = turnTrackingSince ? Math.max(windowStart, turnTrackingSince) : now;
  const concurrency = concurrencyStats(turns, resourceWindowStart, now);
  const queueEnqueued = new Map(
    events.flatMap((event) =>
      event.kind === "queue_enqueued" && event.queueId ? [[event.queueId, event] as const] : [],
    ),
  );
  const queueWaitMinutes = events.flatMap((event) => {
    if (event.kind !== "turn_started" || !event.queueId || event.at < windowStart || event.at > now)
      return [];
    const queued = queueEnqueued.get(event.queueId);
    return queued && queued.at <= event.at ? [(event.at - queued.at) / 60_000] : [];
  });

  const stateEvents = events.filter((event) => event.kind === "daemon_state");
  const promptsBySession = new Map<string, WorkEvent[]>();
  for (const event of events) {
    if (event.kind !== "user_prompt") continue;
    const list = promptsBySession.get(event.sessionId) ?? [];
    list.push(event);
    promptsBySession.set(event.sessionId, list);
  }

  const outcomesBySample = new Map<number, boolean[]>();
  for (const stateEvent of stateEvents) {
    const sessionPrompts = promptsBySession.get(stateEvent.sessionId) ?? [];
    const prompt = lastEventAtOrBefore(sessionPrompts, stateEvent.at);
    if (!prompt || prompt.at < windowStart || prompt.at > now) continue;
    const sample = sampleFor(samples, prompt.at);
    if (!sample) continue;
    const outcomes = outcomesBySample.get(sample.start) ?? [];
    if (terminalState(stateEvent.state)) {
      outcomes.push(true);
    } else if (
      stateEvent.state !== "blocked" &&
      openWorkState(stateEvent.state ?? null) &&
      prompt.at <= now - OUTCOME_WINDOW_MS
    ) {
      outcomes.push(
        sessionPrompts.some(
          (candidate) =>
            candidate.at > stateEvent.at && candidate.at <= stateEvent.at + OUTCOME_WINDOW_MS,
        ),
      );
    }
    outcomesBySample.set(sample.start, outcomes);
  }

  const modeStats = (["focus", "balanced", "parallel"] as const).map((mode): WorkModeStats => {
    const matchingSamples = comparableSamples.filter(
      (sample) => modeFor(sample.sessionKeys.size) === mode,
    );
    const sampleStarts = new Set(matchingSamples.map((sample) => sample.start));
    const modePrompts = matchingSamples.flatMap((sample) => sample.prompts);
    const modeSwitches = matchingSamples.reduce((sum, sample) => sum + sample.switches, 0);
    const possibleSwitches = matchingSamples.reduce(
      (sum, sample) => sum + Math.max(0, sample.prompts.length - 1),
      0,
    );
    const modeTurns = completedTurns.filter((turn) => {
      const sample = sampleFor(samples, turn.start);
      return sample ? sampleStarts.has(sample.start) : false;
    });
    const outcomes = [...sampleStarts].flatMap((start) => outcomesBySample.get(start) ?? []);
    const succeeded = outcomes.filter(Boolean).length;
    return {
      mode,
      promptedHours: matchingSamples.length,
      sessionsPerPromptedHour: matchingSamples.length
        ? round(
            matchingSamples.reduce((sum, sample) => sum + sample.sessionKeys.size, 0) /
              matchingSamples.length,
          )
        : 0,
      promptsPerPromptedHour: matchingSamples.length
        ? round(modePrompts.length / matchingSamples.length)
        : 0,
      switchRate: possibleSwitches > 0 ? round(modeSwitches / possibleSwitches, 3) : null,
      completedTurns: modeTurns.length,
      completedTurnsPerPromptedHour: matchingSamples.length
        ? round(modeTurns.length / matchingSamples.length)
        : 0,
      medianTurnMinutes: median(modeTurns.map((turn) => (turn.end - turn.start) / 60_000)),
      resolvedOrAdvanced72hRate: outcomes.length ? round(succeeded / outcomes.length, 3) : null,
      outcomeSamples: outcomes.length,
    };
  });

  const attentionItems: DormantSessionStats[] = [];
  const blockedItems: DormantSessionStats[] = [];
  let sessionsWithState = 0;
  let sessionsWithoutState = 0;
  for (const session of sessions) {
    if (!session.sessionId) continue;
    const analysis = options.analysisFor?.(session.sessionId) ?? null;
    if (analysis?.state) sessionsWithState += 1;
    else sessionsWithoutState += 1;
    const userAt = latestUserAt(session);
    if (!userAt || now - userAt < DORMANT_AFTER_MS || !analysis?.state) continue;
    if (openWorkState(analysis.state)) {
      attentionItems.push(dormantItem(session, analysis, userAt, now, options.customTitles));
    } else if (analysis.state === "blocked") {
      blockedItems.push(dormantItem(session, analysis, userAt, now, options.customTitles));
    }
  }
  const sortDormant = (a: DormantSessionStats, b: DormantSessionStats) =>
    b.priority - a.priority || a.lastUserAt - b.lastUserAt;
  attentionItems.sort(sortDormant);
  blockedItems.sort(sortDormant);

  const timeline = timelineBuckets(samples);
  const queues = Object.values(options.queues ?? {});
  return {
    generatedAt: now,
    range,
    windowStart,
    elapsedHours: round(elapsedHours),
    timelineUnit: timeline.unit,
    summary: {
      sessionsTouched: new Set(promptEvents.map((event) => event.sessionId)).size,
      prompts: promptEvents.length,
      promptedHours: activeSamples.length,
      promptsPerElapsedHour: round(promptEvents.length / elapsedHours),
      completedTurns: completedTurns.length,
      completedTurnsPerElapsedHour: round(completedTurns.length / elapsedHours),
      modelBusyRate: concurrency.busyRate,
      overlapRate: concurrency.overlapRate,
      peakConcurrency: concurrency.peak,
      medianTurnMinutes: median(completedTurns.map((turn) => (turn.end - turn.start) / 60_000)),
      medianQueueWaitMinutes: median(queueWaitMinutes),
      resourceObservedHours: turnTrackingSince
        ? round(Math.max(0, now - resourceWindowStart) / HOUR_MS)
        : 0,
    },
    timeline: timeline.buckets,
    modes: modeStats,
    dormant: {
      attention: { count: attentionItems.length, items: attentionItems.slice(0, 10) },
      blocked: { count: blockedItems.length, items: blockedItems.slice(0, 10) },
    },
    live: {
      generating: new Set(options.activeSessionIds ?? []).size,
      queuedTurns: queues.reduce((sum, queue) => sum + Math.max(0, Number(queue.count) || 0), 0),
      queuedSessions: queues.length,
    },
    coverage: {
      ledgerSince: events[0]?.at ?? null,
      promptSince: eventSince(events, ["user_prompt"]),
      turnSince: turnTrackingSince,
      stateSince: eventSince(events, ["daemon_state"]),
      sessionsWithPromptHistory: new Set(
        events.filter((event) => event.kind === "user_prompt").map((event) => event.sessionId),
      ).size,
      sessionsWithState,
      sessionsWithoutState,
    },
  };
}
