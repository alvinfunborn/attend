import path from "node:path";
import type { TranscriptMsg } from "../../chat/transcript.js";
import { VISIT_GAP_MINUTES } from "../pattern.js";
import type { RawSession } from "../types.js";

function compact(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 2000 ? `${oneLine.slice(0, 1999)}…` : oneLine;
}

export function summarizeTranscript(
  vendor: string,
  file: string,
  messages: TranscriptMsg[],
  options: {
    sessionId?: string | null;
    cwd?: string | null;
    fallbackTimestamp?: number | null;
  } = {},
): RawSession {
  const user = messages.filter((message) => message.role === "user" && message.text.trim());
  const assistant = messages.filter(
    (message) => message.role === "assistant" && (message.text.trim() || message.tools.length),
  );
  const timestamps = messages
    .map((message) => message.ts)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  let visits = 0;
  let previous: number | null = null;
  for (const value of timestamps) {
    if (previous === null || value - previous > VISIT_GAP_MINUTES * 60_000) visits += 1;
    previous = value;
  }
  const firstTs = timestamps[0] ?? options.fallbackTimestamp ?? null;
  const lastTs = timestamps.at(-1) ?? options.fallbackTimestamp ?? null;
  const latestAssistant = assistant.at(-1);
  return {
    path: file,
    vendor,
    sessionId: options.sessionId ?? path.basename(file, path.extname(file)) ?? null,
    title: user[0] ? compact(user[0].text) : null,
    lastPrompt: user.at(-1) ? compact(user.at(-1)?.text ?? "") : null,
    lastTurnChars: latestAssistant?.text.length ?? 0,
    chars: messages.reduce((total, message) => total + message.text.length, 0),
    cwd: options.cwd ?? null,
    firstTs,
    lastTs,
    lastAssistantTs: latestAssistant?.ts ?? null,
    userPromptTs: user.flatMap((message) => (message.ts ? [message.ts] : [])),
    userPromptActivity: user.flatMap((message) =>
      message.ts ? [{ at: message.ts, chars: message.text.length }] : [],
    ),
    assistantTextActivity: assistant.flatMap((message) =>
      message.ts ? [{ at: message.ts, chars: message.text.length }] : [],
    ),
    prompts: user.length,
    actions: assistant.reduce((total, message) => total + message.tools.length, 0),
    visits: visits || (user.length ? 1 : 0),
  };
}

export interface TranscriptSummaryState {
  title: string | null;
  lastPrompt: string | null;
  lastTurnChars: number;
  chars: number;
  firstTs: number | null;
  lastTs: number | null;
  lastAssistantTs: number | null;
  userPromptTs: number[];
  userPromptActivity: Array<{ at: number; chars: number }>;
  assistantTextActivity: Array<{ at: number; chars: number }>;
  prompts: number;
  actions: number;
  visits: number;
  previousTs: number | null;
  lastRole: TranscriptMsg["role"] | null;
  lastText: string;
}

export function createTranscriptSummaryState(): TranscriptSummaryState {
  return {
    title: null,
    lastPrompt: null,
    lastTurnChars: 0,
    chars: 0,
    firstTs: null,
    lastTs: null,
    lastAssistantTs: null,
    userPromptTs: [],
    userPromptActivity: [],
    assistantTextActivity: [],
    prompts: 0,
    actions: 0,
    visits: 0,
    previousTs: null,
    lastRole: null,
    lastText: "",
  };
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function activity(value: unknown): value is Array<{ at: number; chars: number }> {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        !!entry &&
        typeof entry === "object" &&
        finiteNumber((entry as { at?: unknown }).at) &&
        finiteNumber((entry as { chars?: unknown }).chars),
    )
  );
}

/** Validate and detach a persisted aggregate before continuing an append scan. */
export function restoreTranscriptSummaryState(value: unknown): TranscriptSummaryState | null {
  if (!value || typeof value !== "object") return null;
  const saved = value as Partial<TranscriptSummaryState>;
  if (
    !(saved.title === null || typeof saved.title === "string") ||
    !(saved.lastPrompt === null || typeof saved.lastPrompt === "string") ||
    !finiteNumber(saved.lastTurnChars) ||
    !finiteNumber(saved.chars) ||
    !(saved.firstTs === null || finiteNumber(saved.firstTs)) ||
    !(saved.lastTs === null || finiteNumber(saved.lastTs)) ||
    !(saved.lastAssistantTs === null || finiteNumber(saved.lastAssistantTs)) ||
    !Array.isArray(saved.userPromptTs) ||
    !saved.userPromptTs.every(finiteNumber) ||
    !activity(saved.userPromptActivity) ||
    !activity(saved.assistantTextActivity) ||
    !finiteNumber(saved.prompts) ||
    !finiteNumber(saved.actions) ||
    !finiteNumber(saved.visits) ||
    !(saved.previousTs === null || finiteNumber(saved.previousTs)) ||
    !(saved.lastRole === null || saved.lastRole === "user" || saved.lastRole === "assistant") ||
    typeof saved.lastText !== "string"
  ) {
    return null;
  }
  return {
    title: saved.title,
    lastPrompt: saved.lastPrompt,
    lastTurnChars: saved.lastTurnChars,
    chars: saved.chars,
    firstTs: saved.firstTs,
    lastTs: saved.lastTs,
    lastAssistantTs: saved.lastAssistantTs,
    userPromptTs: [...saved.userPromptTs],
    userPromptActivity: saved.userPromptActivity.map((entry) => ({ ...entry })),
    assistantTextActivity: saved.assistantTextActivity.map((entry) => ({ ...entry })),
    prompts: saved.prompts,
    actions: saved.actions,
    visits: saved.visits,
    previousTs: saved.previousTs,
    lastRole: saved.lastRole,
    lastText: saved.lastText,
  };
}

export function appendTranscriptSummary(
  state: TranscriptSummaryState,
  message: TranscriptMsg,
  options: { mergeAssistantText?: boolean } = {},
): void {
  const text = message.text;
  if (message.role === "user" && state.lastRole === "user" && state.lastText === text) return;
  const mergeAssistant =
    options.mergeAssistantText === true &&
    message.role === "assistant" &&
    state.lastRole === "assistant";
  const ts =
    typeof message.ts === "number" && Number.isFinite(message.ts) && message.ts > 0
      ? message.ts
      : null;
  if (!mergeAssistant && ts !== null) {
    if (state.previousTs === null || ts - state.previousTs > VISIT_GAP_MINUTES * 60_000) {
      state.visits += 1;
    }
    state.previousTs = ts;
    state.firstTs ??= ts;
    state.lastTs = ts;
  }

  state.chars += text.length;
  state.actions += message.tools.length;
  if (message.role === "user" && text.trim()) {
    const value = compact(text);
    state.title ??= value;
    state.lastPrompt = value;
    state.prompts += 1;
    if (ts !== null) {
      state.userPromptTs.push(ts);
      state.userPromptActivity.push({ at: ts, chars: text.length });
    }
  } else if (message.role === "assistant") {
    state.lastTurnChars = mergeAssistant ? state.lastTurnChars + text.length : text.length;
    if (ts !== null && !mergeAssistant) {
      state.lastAssistantTs = ts;
      state.assistantTextActivity.push({ at: ts, chars: text.length });
    } else if (mergeAssistant && state.assistantTextActivity.length) {
      const latest = state.assistantTextActivity.at(-1);
      if (latest) latest.chars += text.length;
    }
  }
  state.lastRole = message.role;
  state.lastText = mergeAssistant ? `${state.lastText}${text}` : text;
}

export function transcriptSummarySnapshot(
  vendor: string,
  file: string,
  state: TranscriptSummaryState,
  options: {
    sessionId?: string | null;
    cwd?: string | null;
    fallbackTimestamp?: number | null;
  } = {},
): RawSession | null {
  if (state.prompts === 0 && state.actions === 0 && state.chars === 0) return null;
  return {
    path: file,
    vendor,
    sessionId: options.sessionId ?? path.basename(file, path.extname(file)) ?? null,
    title: state.title,
    lastPrompt: state.lastPrompt,
    lastTurnChars: state.lastTurnChars,
    chars: state.chars,
    cwd: options.cwd ?? null,
    firstTs: state.firstTs ?? options.fallbackTimestamp ?? null,
    lastTs: state.lastTs ?? options.fallbackTimestamp ?? null,
    lastAssistantTs: state.lastAssistantTs,
    userPromptTs: state.userPromptTs,
    userPromptActivity: state.userPromptActivity,
    assistantTextActivity: state.assistantTextActivity,
    prompts: state.prompts,
    actions: state.actions,
    visits: state.visits || (state.prompts ? 1 : 0),
  };
}
