import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { ClaudeAnalyzer } from "./chat/analyzer/claude.js";
import { CodexAnalyzer } from "./chat/analyzer/codex.js";
import { CodexEngine } from "./chat/codex/engine.js";
import { makeCodexExec, makeCodexFork } from "./chat/codex/exec.js";
import { readCodexTranscript } from "./chat/codex/transcript.js";
import { DaemonOrchestrator } from "./chat/daemon.js";
import type {
  ActiveSessionState,
  ChatAttachment,
  ChatDriver,
  FileAttachmentMediaType,
  SessionEffort,
} from "./chat/driver.js";
import { ChatEngine } from "./chat/engine.js";
import { searchSessions } from "./chat/search.js";
import { type TranscriptMsg, readClaudeTranscript } from "./chat/transcript.js";
import type { AttendConfig } from "./config.js";
import { type AlignmentModel, buildAlignmentModel, scoreAlignment } from "./core/alignment.js";
import { AnalysisCache, type AnalysisState } from "./core/daemon/cache.js";
import { OverrideStore } from "./core/daemon/overrides.js";
import { DaemonRegistry } from "./core/daemon/registry.js";
import { EngagementStore } from "./core/engagement.js";
import { type LaunchAction, type LaunchVendor, launchSession, revealPath } from "./core/launch.js";
import { discoverMemorySources, loadMemoryDocs } from "./core/memory.js";
import { modelOptionsFromStrings } from "./core/model-options.js";
import { evaluatePriority, patternScoreNudge } from "./core/priority.js";
import {
  type SessionAttentionState,
  type SessionStatusRecord,
  SessionStatusStore,
} from "./core/session-status.js";
import { TagStore } from "./core/tags.js";
import type { Brief, Pattern, RawSession, Telemetry } from "./core/types.js";
import { readCodexModelOptions } from "./core/vendor/codex-models.js";
import { detectVendors } from "./core/vendor/detect.js";
import { collectSessions } from "./core/vendor/index.js";
import { type ConsoleView, type SessionView, renderConsole } from "./ui/console.js";

const DAY_MS = 86_400_000;
const EXTERNAL_ACTIVE_STALE_MS = 2 * 60 * 60 * 1000;
const IMAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const EXCEL_MEDIA_BY_EXT: ReadonlyMap<string, FileAttachmentMediaType> = new Map([
  ["xls", "application/vnd.ms-excel"],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12"],
  ["xlsb", "application/vnd.ms-excel.sheet.binary.macroEnabled.12"],
  ["xltx", "application/vnd.openxmlformats-officedocument.spreadsheetml.template"],
  ["xltm", "application/vnd.ms-excel.template.macroEnabled.12"],
  ["xlam", "application/vnd.ms-excel.addin.macroEnabled.12"],
] as Array<[string, FileAttachmentMediaType]>);
const EXCEL_MEDIA_TYPES = new Set<string>(EXCEL_MEDIA_BY_EXT.values());
const PROVIDER_FORK_TRANSCRIPT_LIMIT = 60;
const PROVIDER_FORK_CONTEXT_LIMIT = 24_000;
const PROVIDER_FORK_MSG_LIMIT = 2_000;

function normalizeTagName(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function sessionTagKeys(s: RawSession, brief: string | null | undefined): string[] {
  const keys: string[] = [];
  if (s.sessionId) keys.push(s.sessionId);
  const name = brief ? normalizeTagName(brief) : "";
  if (name) keys.push(`brief:${s.vendor}:${s.cwd ?? ""}:${name}`);
  return keys;
}

function readSessionTranscript(s: RawSession | null): TranscriptMsg[] {
  if (!s?.path || !s.path.endsWith(".jsonl") || !fs.existsSync(s.path)) return [];
  const read = s.vendor === "codex" ? readCodexTranscript : readClaudeTranscript;
  return read(s.path, PROVIDER_FORK_TRANSCRIPT_LIMIT);
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function clipText(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 16)).trimEnd()}\n[truncated]`;
}

function transcriptContext(msgs: TranscriptMsg[]): string {
  let out = "";
  for (const m of msgs) {
    const role = m.role === "user" ? "User" : "Assistant";
    const parts: string[] = [];
    if (m.text.trim()) parts.push(clipText(m.text, PROVIDER_FORK_MSG_LIMIT));
    if (m.tools.length) parts.push(`[tools: ${m.tools.map((t) => t.name).join(", ")}]`);
    if (!parts.length) continue;
    const next = `${role}: ${parts.join("\n")}\n\n`;
    if (out.length + next.length > PROVIDER_FORK_CONTEXT_LIMIT) {
      out = `${out.slice(0, PROVIDER_FORK_CONTEXT_LIMIT).trimEnd()}\n\n[earlier context truncated]\n`;
      break;
    }
    out += next;
  }
  return out.trim();
}

function providerForkPrompt(
  parent: RawSession | null,
  text: string,
  attachments: ChatAttachment[],
): string {
  const transcript = transcriptContext(readSessionTranscript(parent));
  const parentVendor = parent?.vendor ?? "another provider";
  const opening = oneLine(text) || (attachments.length ? "Continue from the attached files." : "");
  const attachmentNote = attachments.length
    ? `\n\nThe user's opening turn includes ${attachments.length} attachment${attachments.length === 1 ? "" : "s"} provided with this message.`
    : "";
  return [
    `Continue a forked session that originally ran in ${parentVendor}.`,
    "Use the transcript below as context, but treat this as a new independent branch in the current workspace.",
    "",
    transcript ? `Transcript:\n${transcript}` : "Transcript: (no readable transcript was found)",
    "",
    `User's first message for this fork:\n${opening || "(no typed text)"}`,
    attachmentNote.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

function scopeTagList(
  sessions: RawSession[],
  tags: TagStore,
  orchestrator: DaemonOrchestrator,
  opts: { extraTags?: string[]; extraSessionIds?: string[] } = {},
): string[] {
  const wanted = new Set<string>();
  for (const s of sessions) {
    const a = s.sessionId ? orchestrator.analysis(s.sessionId) : null;
    for (const tag of tags.tagsFor(sessionTagKeys(s, a?.brief))) wanted.add(tag);
  }
  for (const sessionId of opts.extraSessionIds ?? []) {
    for (const tag of tags.tagsFor(sessionId)) wanted.add(tag);
  }
  for (const extra of opts.extraTags ?? []) {
    const tag = normalizeTagName(extra);
    if (tag) wanted.add(tag);
  }
  return tags.list().filter((tag) => wanted.has(tag));
}

function parseChatAttachments(input: unknown): ChatAttachment[] {
  if (!Array.isArray(input)) return [];
  const out: ChatAttachment[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const kind = typeof item.kind === "string" ? item.kind : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) continue;
    if (kind === "image") {
      const mediaType = typeof item.mediaType === "string" ? item.mediaType : "";
      const data = typeof item.data === "string" ? item.data : "";
      if (IMAGE_MEDIA_TYPES.has(mediaType) && data) {
        out.push({
          kind: "image",
          name,
          mediaType: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data,
        });
      }
      continue;
    }
    if (kind === "document") {
      const data = typeof item.data === "string" ? item.data : "";
      if (data) out.push({ kind: "document", name, mediaType: "application/pdf", data });
      continue;
    }
    if (kind === "file") {
      const data = typeof item.data === "string" ? item.data : "";
      const mediaType = typeof item.mediaType === "string" ? item.mediaType : "";
      const ext = path.extname(name).slice(1).toLowerCase();
      const inferred = EXCEL_MEDIA_BY_EXT.get(ext);
      const accepted = EXCEL_MEDIA_TYPES.has(mediaType) ? mediaType : inferred;
      if (data && accepted) {
        out.push({
          kind: "file",
          name,
          mediaType: accepted as FileAttachmentMediaType,
          data,
        });
      }
      continue;
    }
    if (kind === "text") {
      const text = typeof item.text === "string" ? item.text : "";
      if (text) out.push({ kind: "text", name, text });
    }
  }
  return out;
}

function validateCodexAttachments(attachments: ChatAttachment[]): string | null {
  return attachments.some((attachment) => attachment.kind === "document")
    ? "Codex chat does not support PDF attachments"
    : null;
}

/**
 * Bound the listed sessions so a long-lived directory doesn't render thousands of
 * tabs: keep only those active within `recentDays`, most-recent first, capped at
 * `maxSessions`. Either limit is disabled when 0. Applied to the list only — the
 * "+ new" dir picker and throughput still see the full set.
 */
export function limitSessions(
  sessions: RawSession[],
  now: number,
  recentDays: number,
  maxSessions: number,
): RawSession[] {
  let out = sessions;
  if (recentDays > 0) {
    const since = now - recentDays * DAY_MS;
    out = out.filter((s) => (s.lastTs ?? 0) >= since);
  }
  out = [...out].sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
  if (maxSessions > 0 && out.length > maxSessions) out = out.slice(0, maxSessions);
  return out;
}

/**
 * Is a session in scope? With no roots configured, everything is (the default —
 * `attend` with no dir args lists every session). With roots set, a session is
 * kept only when its cwd equals or sits under one of them; a session with no cwd
 * is excluded once a scope is active.
 */
export function withinScope(cwd: string | null, roots: string[]): boolean {
  if (roots.length === 0) return true;
  if (!cwd) return false;
  const c = path.resolve(cwd);
  return roots.some((r) => c === r || c.startsWith(r + path.sep));
}

interface SessionStatusAccess {
  get(sessionId: string, cwd: string | null): SessionStatusRecord | null;
  set(
    sessionId: string,
    cwd: string | null,
    state: SessionAttentionState,
    updatedAt?: number,
  ): SessionStatusRecord | null;
}

function createSessionStatusAccess(globalFile: string, scopeRoots: string[]): SessionStatusAccess {
  const stores = new Map<string, SessionStatusStore>();
  const storeFor = (file: string): SessionStatusStore => {
    let store = stores.get(file);
    if (!store) {
      store = new SessionStatusStore(file);
      stores.set(file, store);
    }
    return store;
  };
  const globalStore = storeFor(globalFile);
  const rootFor = (cwd: string | null): string | null => {
    if (!cwd || scopeRoots.length === 0) return null;
    const c = path.resolve(cwd);
    const matches = scopeRoots
      .map((r) => path.resolve(r))
      .filter((r) => c === r || c.startsWith(r + path.sep))
      .sort((a, b) => b.length - a.length);
    return matches[0] ?? null;
  };
  const localFile = (cwd: string | null): string | null => {
    const root = rootFor(cwd);
    return root ? path.join(root, ".attend", "session-status.json") : null;
  };
  const localStore = (cwd: string | null): SessionStatusStore | null => {
    const file = localFile(cwd);
    return file ? storeFor(file) : null;
  };

  return {
    get(sessionId, cwd) {
      return localStore(cwd)?.get(sessionId) ?? globalStore.get(sessionId);
    },
    set(sessionId, cwd, state, updatedAt) {
      const file = localFile(cwd);
      if (state === "read" && file && !fs.existsSync(file)) {
        globalStore.set(sessionId, "read", updatedAt);
        return null;
      }
      const primary = file ? storeFor(file) : globalStore;
      const record = primary.set(sessionId, state, updatedAt);
      if (primary !== globalStore) globalStore.set(sessionId, "read", updatedAt);
      return record;
    },
  };
}

/** Memoize an expensive scan so browser refreshes don't re-read every JSONL. */
function ttlCache<T>(ttlMs: number, fn: () => T): () => T {
  let stamp = 0;
  let value: T;
  let primed = false;
  return () => {
    const now = Date.now();
    if (primed && now - stamp < ttlMs) return value;
    value = fn();
    stamp = now;
    primed = true;
    return value;
  };
}

/** Injectable so tests can assert wiring without spawning terminals or hitting the SDK. */
export interface AppDeps {
  launcher: (
    action: LaunchAction,
    vendor: LaunchVendor,
    cwd: string,
    opts: { sessionId?: string; prompt?: string; model?: string; effort?: SessionEffort },
  ) => string;
  /** Reveal a local path in the OS file manager (Finder/Explorer). Defaulted at use site. */
  revealer?: (target: string) => void;
  engine: ChatEngine;
  /** Codex chat backend (driven via `codex exec`); defaulted when omitted. */
  codex?: ChatDriver;
  orchestrator: DaemonOrchestrator;
}

/**
 * Project dirs offered in the "+ new" picker, ordered by **most-recent session
 * activity** (the dir of your latest active session floats to the top) — so the
 * one you're likeliest to start in is the default.
 */
function knownDirs(sessions: RawSession[]): string[] {
  const lastTouch = new Map<string, number>();
  for (const s of sessions) {
    if (!s.cwd) continue;
    const d = path.resolve(s.cwd);
    const ts = s.lastTs ?? 0;
    const prev = lastTouch.get(d);
    if (prev === undefined || ts > prev) lastTouch.set(d, ts);
  }
  return [...lastTouch.entries()]
    .filter(([d]) => fs.existsSync(d))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([d]) => d);
}

/** Analyzer daemons should never appear as user sessions. Registry ids are the
 * primary filter, but historical/partial state can leave a daemon transcript
 * unregistered; hide those too by their standing seed / follow-up prompt shape. */
function isLikelyDaemonSession(s: RawSession): boolean {
  const title = String(s.title ?? "");
  const lastPrompt = String(s.lastPrompt ?? "");
  if (title.startsWith("You are the *attend daemon* for a single coding session.")) return true;
  if (lastPrompt.startsWith("The session advanced. Session context:")) return true;
  if (lastPrompt.includes("Reply with the JSON object only.")) return true;
  return false;
}

/**
 * Resolve a user-entered project dir. Absolute paths are kept absolute; `~/`
 * expands to the home dir; relative inputs are resolved against each scope root
 * (or `process.cwd()` when no scope is configured). The first existing hit wins;
 * otherwise we return the first candidate so callers can surface a clear
 * "directory not found" on the intended absolute path.
 */
function resolveProjectDir(input: string, scopeRoots: string[]): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const roots = scopeRoots.length > 0 ? scopeRoots : [process.cwd()];
  const candidates: string[] = [];
  if (raw.startsWith("~/")) candidates.push(path.join(os.homedir(), raw.slice(2)));
  else if (path.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw)) candidates.push(path.resolve(raw));
  else for (const root of roots) candidates.push(path.resolve(root, raw));
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0] ?? null;
}

function normalizeModel(input: unknown): string | undefined {
  const value = typeof input === "string" ? input.trim() : "";
  return value || undefined;
}

function normalizeEffort(input: unknown): SessionEffort | undefined {
  const value = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh" ||
    value === "max"
  ) {
    return value;
  }
  return undefined;
}

/** Telemetry for a single session (so pattern/priority can be computed per-session). */
function sessionTelemetry(s: RawSession, now: number, engagement: EngagementStore): Telemetry {
  const dwell = s.firstTs !== null && s.lastTs !== null ? (s.lastTs - s.firstTs) / 60_000 : null;
  const e = s.sessionId ? engagement.get(s.sessionId) : null;
  const lastTouchTs = Math.max(s.lastTs ?? 0, e?.lastViewedAt ?? 0) || null;
  const ageDays = lastTouchTs !== null ? Math.floor((now - lastTouchTs) / DAY_MS) : null;
  const lastActionAgeDays = s.lastTs !== null ? Math.floor((now - s.lastTs) / DAY_MS) : null;
  return {
    sessions: 1,
    prompts: s.prompts,
    actions: s.actions,
    visits: s.visits,
    totalMinutes: dwell ?? 0,
    avgSessionMin: dwell,
    lastActionAgeDays: s.actions > 0 ? lastActionAgeDays : null,
    lastTouch: lastTouchTs !== null ? new Date(lastTouchTs).toISOString() : null,
    lastTouchAgeDays: ageDays,
    reviewVisits: e?.reviewVisits ?? 0,
    reviewMinutes: (e?.reviewMs ?? 0) / 60_000,
  };
}

function toSessionViews(
  sessions: RawSession[],
  model: AlignmentModel | null,
  now: number,
  orchestrator: DaemonOrchestrator,
  overrides: OverrideStore,
  tags: TagStore,
  engagement: EngagementStore,
  sessionStatus: SessionStatusAccess,
  stoppedExternalActiveAt: Map<string, number>,
): SessionView[] {
  return [...sessions]
    .sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0))
    .map((s) => {
      const tel = sessionTelemetry(s, now, engagement);
      // Pattern stays a *session-derived observation* (DESIGN v2.3 #1). Brief /
      // priority / ETA come from the session's daemon when it has one; otherwise
      // (historical / terminal-launched sessions) fall back to the heuristic.
      const synthetic: Brief = {
        path: "",
        projectDir: s.cwd ?? "",
        name: s.title || (s.cwd ? path.basename(s.cwd) : "session"),
        frontMatter: {},
        what: s.title ?? "",
        accept: "",
        next: "",
        status: "active",
        deferUntil: null,
      };
      const heuristic = evaluatePriority(synthetic, tel, model);
      const a = s.sessionId ? orchestrator.analysis(s.sessionId) : null;
      const tagKeys = sessionTagKeys(s, a?.brief);
      // A manual override (clicked on the tab) wins over daemon/heuristic and is
      // never clobbered by the daemon's turn-end rewrite (separate store).
      const ov = s.sessionId ? overrides.get(s.sessionId) : null;
      const baseScore = a ? a.priority + patternScoreNudge(heuristic.pattern) : heuristic.score;
      const baseEta = a ? a.etaMin : estimateEtaFromMemory(model, synthetic.what || synthetic.name);
      const persistedStatus = s.sessionId ? sessionStatus.get(s.sessionId, s.cwd) : null;
      const externalGenerating = isExternallyActive(s, now, stoppedExternalActiveAt);
      const reason =
        a && heuristic.pattern === "avoidance" && heuristic.reason !== "no signal"
          ? `${heuristic.reason}; task: ${a.reason}`
          : a
            ? a.reason
            : heuristic.reason;
      return {
        vendor: s.vendor,
        sessionId: s.sessionId,
        title: s.title ?? "",
        lastPrompt: s.lastPrompt ?? null,
        cwd: s.cwd,
        file: s.path,
        project: s.cwd ? path.basename(s.cwd) : "—",
        ageDays: s.lastTs !== null ? Math.floor((now - s.lastTs) / DAY_MS) : null,
        lastTs: s.lastTs,
        sortTs: s.lastTs,
        prompts: s.prompts,
        pattern: ov?.pattern ?? heuristic.pattern,
        patternReason: heuristic.pattern === "avoidance" ? heuristic.reason : null,
        state: ov?.state ?? a?.state ?? null,
        score: ov?.priority ?? baseScore,
        reason: reason,
        etaMin: ov?.etaMin ?? baseEta,
        brief: a ? a.brief : null,
        tags: tags.tagsFor(tagKeys),
        priorityset: ov?.priority !== undefined,
        etaset: ov?.etaMin !== undefined,
        stateset: ov?.state !== undefined,
        patternset: ov?.pattern !== undefined,
        unread: persistedStatus?.state === "unread",
        seen: persistedStatus?.state === "seen",
        generating: externalGenerating,
        generatingStartedAt: externalGenerating ? (s.activeStartedAt ?? null) : null,
      };
    });
}

function isExternallyActive(
  s: RawSession,
  now: number,
  stoppedExternalActiveAt?: Map<string, number>,
): boolean {
  if (!s.active) return false;
  const last = s.lastTs ?? s.activeStartedAt ?? 0;
  if (s.sessionId && stoppedExternalActiveAt) {
    const stoppedAt = stoppedExternalActiveAt.get(s.sessionId);
    if (stoppedAt !== undefined) {
      const activeStartedAt = s.activeStartedAt ?? last;
      if (activeStartedAt <= stoppedAt) return false;
      stoppedExternalActiveAt.delete(s.sessionId);
    }
  }
  return last > 0 && now - last <= EXTERNAL_ACTIVE_STALE_MS;
}

function mergeActiveStates(...groups: ActiveSessionState[][]): ActiveSessionState[] {
  const bySession = new Map<string, ActiveSessionState>();
  for (const group of groups) {
    for (const state of group) {
      const prev = bySession.get(state.sessionId);
      if (!prev || state.startedAt > prev.startedAt) bySession.set(state.sessionId, state);
    }
  }
  return [...bySession.values()];
}

function externalActiveStates(
  sessions: RawSession[],
  now: number,
  stoppedExternalActiveAt: Map<string, number>,
): ActiveSessionState[] {
  return sessions.flatMap((s) =>
    s.sessionId && isExternallyActive(s, now, stoppedExternalActiveAt)
      ? [{ sessionId: s.sessionId, startedAt: s.activeStartedAt ?? s.lastTs ?? now }]
      : [],
  );
}

/**
 * Throughput readout for the console header: real activity over the trailing 24h,
 * normalized to an hourly rate. Descriptive, not judgmental (DESIGN invariant 3) —
 * it reports what flowed through, it doesn't nag about a backlog.
 */
const THROUGHPUT_WINDOW_HOURS = 24;
export function hourlyThroughput(
  sessions: RawSession[],
  now: number,
): { sessionsPerHour: number; charsPerHour: number } {
  const since = now - THROUGHPUT_WINDOW_HOURS * 60 * 60 * 1000;
  const recent = sessions.filter((s) => (s.lastTs ?? 0) >= since);
  const chars = recent.reduce((n, s) => n + s.chars, 0);
  return {
    sessionsPerHour: recent.length / THROUGHPUT_WINDOW_HOURS,
    charsPerHour: chars / THROUGHPUT_WINDOW_HOURS,
  };
}

const ETA_BASE_MIN = 2;
const ETA_DEPTH_MIN = 28;
const ETA_DEPTH_TAU = 0.12;

/**
 * Estimate minutes to re-engage a session — now *memory-derived* (user redirect
 * 2026-05-31): cost, like priority, is a judgment that needs the whole memory,
 * not one session's bytes. A session whose topic your memory is deeply invested
 * in costs more to reload + reply to thoughtfully; one your memory barely
 * mentions is cheap. The transcript-size model was deliberately dropped. The
 * exp() saturates so the estimate stays bounded for any cosine magnitude.
 */
function estimateEtaFromMemory(model: AlignmentModel | null, text: string): number {
  if (!model) return ETA_BASE_MIN;
  const { cosine } = scoreAlignment(model, text);
  const depth = 1 - Math.exp(-cosine / ETA_DEPTH_TAU);
  return Math.max(1, Math.round(ETA_BASE_MIN + ETA_DEPTH_MIN * depth));
}

export function createApp(
  config: AttendConfig,
  deps: AppDeps = {
    launcher: launchSession,
    engine: new ChatEngine(),
    orchestrator: new DaemonOrchestrator(
      new DaemonRegistry(config.daemonRegistry),
      new AnalysisCache(config.analysisCache),
      [
        new ClaudeAnalyzer(config.claudeProjects),
        new CodexAnalyzer(
          config.codexSessions,
          config.codexBin ? makeCodexExec(config.codexBin) : null,
        ),
      ],
    ),
  },
): Hono {
  const engine = deps.engine;
  // Codex chat backend. Defaulted here (not in the deps literal) so callers that
  // pass a partial `deps` — the tests — still get a working Codex route.
  const codex =
    deps.codex ??
    new CodexEngine(
      makeCodexExec(config.codexBin ?? "codex"),
      "danger-full-access",
      makeCodexFork(config.codexSessions),
    );
  /** Pick the chat backend for a vendor (anything non-codex → Claude). */
  const driverFor = (vendor: string | undefined): ChatDriver =>
    vendor === "codex" ? codex : engine;
  const abortDriversFor = (vendor: string | undefined, sessionId: string): ChatDriver[] => {
    const drivers: ChatDriver[] = [];
    const add = (driver: ChatDriver) => {
      if (!drivers.includes(driver)) drivers.push(driver);
    };
    add(driverFor(vendor));
    const sessionVendor = visibleSessions().find((s) => s.sessionId === sessionId)?.vendor;
    if (sessionVendor) add(driverFor(sessionVendor));
    add(engine);
    add(codex);
    return drivers;
  };
  /** A live session's cwd, looked up across both backends. */
  const cwdOf = (sid: string): string => engine.get(sid)?.cwd ?? codex.get(sid)?.cwd ?? "";
  const orchestrator = deps.orchestrator;
  const overrides = new OverrideStore(config.overrides);
  const tags = new TagStore(config.tags);
  const engagement = new EngagementStore(config.engagement);
  const sessionStatus = createSessionStatusAccess(config.sessionStatus, config.scopeRoots);
  const stoppedExternalActiveAt = new Map<string, number>();
  const getSessions = ttlCache(30_000, () => collectSessions(config));
  const getModel = ttlCache(60_000, (): AlignmentModel => {
    const sources = config.memorySources.length
      ? config.memorySources
      : discoverMemorySources(config.claudeProjects);
    return buildAlignmentModel(loadMemoryDocs(sources));
  });
  // Which vendor CLIs are installed locally — gates the "+ new" provider picker.
  // Cached longer than sessions: a CLI is rarely (un)installed mid-run.
  const getVendors = ttlCache(300_000, () => detectVendors());
  // Hide daemon sessions from every listing: they're real Claude sessions we
  // spawned to analyze the task sessions (DESIGN v2.3 #2 — same cwd, so filtered
  // by id, not directory).
  // Hidden daemon sessions are filtered out (by id), and — when the user launched
  // attend with directory args — the list is scoped to sessions whose cwd is under
  // one of those dirs. No dirs → no scope, every session is visible.
  const visibleSessions = (): RawSession[] => {
    const daemons = orchestrator.daemonIds();
    return getSessions().filter(
      (s) =>
        (!s.sessionId || !daemons.has(s.sessionId)) &&
        !isLikelyDaemonSession(s) &&
        withinScope(s.cwd, config.scopeRoots),
    );
  };

  // When a task turn ends, re-run its daemon analysis (DESIGN v2.3 #3 — triggered
  // on completion, not polled). Daemon turns are ignored to avoid recursion.
  // Registered on both backends so Claude and Codex sessions analyze identically.
  const onTurnEnd = (sid: string) => {
    if (orchestrator.isDaemon(sid) || !orchestrator.hasDaemon(sid)) return;
    orchestrator.analyzeTask(sid, cwdOf(sid)).catch(() => {});
  };
  engine.onTurnEnd(onTurnEnd);
  codex.onTurnEnd(onTurnEnd);

  const app = new Hono();

  // Main view: slock-style console — all sessions aggregated, chat in-browser.
  app.get("/", (c) => {
    const now = Date.now();
    const all = visibleSessions();
    // Throughput + the "+ new" dir picker see every in-scope session; the rendered
    // tab list is further bounded (recency window + count cap) so an old directory
    // isn't thousands of tabs.
    const listed = limitSessions(all, now, config.recentDays, config.maxSessions);
    const throughput = hourlyThroughput(all, now);
    const view: ConsoleView = {
      sessions: toSessionViews(
        listed,
        getModel(),
        now,
        orchestrator,
        overrides,
        tags,
        engagement,
        sessionStatus,
        stoppedExternalActiveAt,
      ),
      knownDirs: knownDirs(all),
      scopeRoots: config.scopeRoots,
      sessionsPerHour: throughput.sessionsPerHour,
      charsPerHour: throughput.charsPerHour,
      vendors: getVendors(),
      claudeModels: modelOptionsFromStrings(config.claudeModels),
      codexModels: readCodexModelOptions(config.codexModelsCache),
      tags: scopeTagList(all, tags, orchestrator),
    };
    return c.html(renderConsole(view));
  });

  const sessionView = (id: string): SessionView | null => {
    const now = Date.now();
    const found = visibleSessions().find((s) => s.sessionId === id);
    if (!found) return null;
    return (
      toSessionViews(
        [found],
        getModel(),
        now,
        orchestrator,
        overrides,
        tags,
        engagement,
        sessionStatus,
        stoppedExternalActiveAt,
      )[0] ?? null
    );
  };

  // Latest daemon analysis for a session (brief/state/priority/eta/reason), or null.
  // The console polls this shortly after a turn ends to pick up the daemon's
  // fresh verdict without a full reload.
  app.get("/session/analysis", (c) => {
    const id = c.req.query("session");
    return c.json({ analysis: id ? orchestrator.analysis(id) : null });
  });

  // Resolve a session id back to its transcript source file. This is mainly for
  // product-created sessions that were opened in the current page lifetime: the
  // browser knows the new session id immediately, but not the eventual JSONL
  // path, so reopening the tab later would otherwise show "(no history yet)".
  app.get("/session/source", (c) => {
    const id = c.req.query("session");
    const vendor = c.req.query("vendor");
    if (!id) return c.json({ session: null });
    const pick = (sessions: RawSession[]) =>
      sessions
        .filter((s) => s.sessionId === id && (!vendor || s.vendor === vendor))
        .filter((s) => !s.sessionId || !orchestrator.isDaemon(s.sessionId))
        .filter((s) => !isLikelyDaemonSession(s))
        .sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0))[0];
    const match = pick(getSessions()) ?? pick(collectSessions(config));
    if (!match) return c.json({ session: null });
    return c.json({
      session: {
        vendor: match.vendor,
        file: match.path,
        cwd: match.cwd,
        project: match.cwd ? path.basename(match.cwd) : "—",
        title: match.title,
        lastPrompt: match.lastPrompt,
        lastTs: match.lastTs,
        prompts: match.prompts,
      },
    });
  });

  // Manually pin session signals (set by clicking badges). Numeric fields are
  // clamped + pinned; an explicit null clears that pin and lets the value fall
  // back to the daemon/heuristic again.
  app.post("/session/override", async (c) => {
    const id = c.req.query("session");
    if (!id) return c.json({ ok: false, error: "missing session" }, 400);
    const body = (await c.req.json().catch(() => ({}))) as {
      priority?: number | null;
      etaMin?: number | null;
      state?: AnalysisState | null;
      pattern?: Exclude<Pattern, "unknown"> | null;
    };
    const patch: {
      priority?: number | null;
      etaMin?: number | null;
      state?: AnalysisState | null;
      pattern?: Exclude<Pattern, "unknown"> | null;
    } = {};
    if ("priority" in body) patch.priority = body.priority;
    if ("etaMin" in body) patch.etaMin = body.etaMin;
    if ("state" in body) patch.state = body.state;
    if ("pattern" in body) patch.pattern = body.pattern;
    if (
      patch.priority === undefined &&
      patch.etaMin === undefined &&
      patch.state === undefined &&
      patch.pattern === undefined
    ) {
      return c.json({ ok: false, error: "nothing to set" }, 400);
    }
    const override = overrides.set(id, patch);
    return c.json({ ok: true, override });
  });

  app.post("/tags", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { name?: string };
    const name = typeof body.name === "string" ? body.name : "";
    if (!name.trim()) return c.json({ ok: false, error: "missing tag" }, 400);
    return c.json({ ok: true, tags: tags.create(name) });
  });

  app.delete("/tags", (c) => {
    const name = c.req.query("name") ?? "";
    if (!name.trim()) return c.json({ ok: false, error: "missing tag" }, 400);
    return c.json({ ok: true, tags: tags.delete(name) });
  });

  app.post("/session/tags", async (c) => {
    const id = c.req.query("session");
    if (!id) return c.json({ ok: false, error: "missing session" }, 400);
    const body = (await c.req.json().catch(() => ({}))) as { tags?: unknown };
    if (!Array.isArray(body.tags)) return c.json({ ok: false, error: "missing tags" }, 400);
    const matched = visibleSessions().find((s) => s.sessionId === id) ?? null;
    const analysis = matched?.sessionId ? orchestrator.analysis(matched.sessionId) : null;
    const next = tags.setSessionTags(
      matched ? sessionTagKeys(matched, analysis?.brief) : id,
      body.tags.filter((x): x is string => typeof x === "string"),
    );
    return c.json({
      ok: true,
      sessionTags: next,
      tags: tags.list(),
    });
  });

  app.post("/session/engagement", async (c) => {
    const id = c.req.query("session");
    if (!id) return c.json({ ok: false, error: "missing session" }, 400);
    const body = (await c.req.json().catch(() => ({}))) as {
      viewedMs?: unknown;
      endedAt?: unknown;
      hadMeaningfulScroll?: unknown;
      hadSend?: unknown;
    };
    const record = engagement.recordVisit(id, {
      viewedMs: Number(body.viewedMs ?? 0),
      endedAt: body.endedAt == null ? null : Number(body.endedAt),
      hadMeaningfulScroll: body.hadMeaningfulScroll === true,
      hadSend: body.hadSend === true,
    });
    return c.json({ ok: true, record, view: sessionView(id) });
  });

  app.post("/session/status", async (c) => {
    const id = c.req.query("session");
    if (!id) return c.json({ ok: false, error: "missing session" }, 400);
    const requestedCwd = resolveProjectDir(c.req.query("cwd") ?? "", config.scopeRoots);
    const matchedCwd = visibleSessions().find((s) => s.sessionId === id)?.cwd ?? null;
    const statusCwd = requestedCwd ?? matchedCwd;
    const body = (await c.req.json().catch(() => ({}))) as { state?: unknown; updatedAt?: unknown };
    const state = body.state;
    if (state !== "read" && state !== "seen" && state !== "unread") {
      return c.json({ ok: false, error: "invalid state" }, 400);
    }
    const updatedAt = body.updatedAt == null ? Date.now() : Number(body.updatedAt);
    const record = sessionStatus.set(id, statusCwd, state, updatedAt);
    return c.json({ ok: true, status: record, view: sessionView(id) });
  });

  // Session ids currently generating a turn — the sidebar polls this so a tab
  // shows its live status even while you're looking at a different session.
  app.get("/chat/live", (c) => {
    const now = Date.now();
    const states = mergeActiveStates(
      engine.activeSessionStates(),
      codex.activeSessionStates(),
      externalActiveStates(visibleSessions(), now, stoppedExternalActiveAt),
    );
    return c.json({
      active: states.map((s) => s.sessionId),
      startedAt: Object.fromEntries(states.map((s) => [s.sessionId, s.startedAt])),
    });
  });

  app.get("/search", (c) => {
    const q = c.req.query("q") ?? "";
    const now = Date.now();
    const sessions = limitSessions(visibleSessions(), now, config.recentDays, config.maxSessions);
    return c.json({ results: searchSessions(sessions, q) });
  });

  // Static transcript of a session (history shown when you open it). The rollout
  // schema differs by vendor, so the reader is picked by ?vendor (default Claude).
  app.get("/chat/messages", (c) => {
    const file = c.req.query("file");
    if (!file || !file.endsWith(".jsonl") || !fs.existsSync(file)) return c.json([]);
    const read = c.req.query("vendor") === "codex" ? readCodexTranscript : readClaudeTranscript;
    return c.json(read(file));
  });

  // Live event stream for a session (SSE). Replays buffered events, then streams.
  app.get("/chat/stream", (c) => {
    const id = c.req.query("session");
    if (!id) return c.text("missing session", 400);
    const drv = driverFor(c.req.query("vendor"));
    return streamSSE(c, async (stream) => {
      await new Promise<void>((resolve) => {
        const unsub = drv.subscribe(id, (ev) => {
          stream.writeSSE({ data: JSON.stringify(ev) }).catch(() => {});
        });
        stream.onAbort(() => {
          unsub();
          resolve();
        });
      });
    });
  });

  // Send a user turn; starts (resumes) a live run if one isn't already running.
  app.post("/chat/send", async (c) => {
    const id = c.req.query("session");
    const cwd = c.req.query("cwd");
    const body = (await c.req.json().catch(() => ({}))) as {
      text?: string;
      attachments?: unknown;
      model?: string | null;
      effort?: string | null;
      runConfig?: unknown;
    };
    const text = body.text?.trim() ?? "";
    const attachments = parseChatAttachments(body.attachments);
    const model = normalizeModel(body.model);
    const effort = normalizeEffort(body.effort);
    const hasRunConfig = body.runConfig === true;
    if (!id) return c.json({ ok: false, error: "missing session" }, 400);
    if (!cwd || !fs.existsSync(cwd))
      return c.json({ ok: false, error: "directory not found" }, 400);
    if (!text && !attachments.length) return c.json({ ok: false, error: "empty message" }, 400);
    const vendor = c.req.query("vendor");
    if (vendor === "codex") {
      const err = validateCodexAttachments(attachments);
      if (err) return c.json({ ok: false, error: err }, 400);
    }
    const drv = driverFor(vendor);
    if (hasRunConfig) {
      if (drv.activeSessions().includes(id)) return c.json({ ok: false, session: id });
      try {
        await drv.start({
          resume: id,
          cwd,
          firstText: text,
          firstAttachments: attachments.length ? attachments : undefined,
          model,
          effort,
        });
        stoppedExternalActiveAt.delete(id);
        return c.json({ ok: true, session: id });
      } catch (err) {
        return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
      }
    }
    if (!drv.get(id)) drv.start({ resume: id, cwd }).catch(() => {});
    const sent = drv.send(id, { text, attachments });
    if (sent) stoppedExternalActiveAt.delete(id);
    return c.json({ ok: sent, session: id });
  });

  // Answer an interactive tool call (currently Claude's AskUserQuestion) by
  // sending a synthetic tool_result back into the live run.
  app.post("/chat/answer", async (c) => {
    const id = c.req.query("session");
    const cwd = c.req.query("cwd");
    const body = (await c.req.json().catch(() => ({}))) as {
      toolUseId?: string;
      text?: string;
      toolUseResult?: unknown;
    };
    const toolUseId = body.toolUseId?.trim();
    const text = body.text?.trim();
    if (!id) return c.json({ ok: false, error: "missing session" }, 400);
    if (!cwd || !fs.existsSync(cwd))
      return c.json({ ok: false, error: "directory not found" }, 400);
    if (!toolUseId) return c.json({ ok: false, error: "missing toolUseId" }, 400);
    if (!text) return c.json({ ok: false, error: "empty answer" }, 400);
    const drv = driverFor(c.req.query("vendor"));
    if (!drv.get(id)) drv.start({ resume: id, cwd }).catch(() => {});
    const sent = drv.answer(id, { toolUseId, text, toolUseResult: body.toolUseResult });
    if (sent) stoppedExternalActiveAt.delete(id);
    return c.json({ ok: sent, session: id, toolUseId });
  });

  // Interrupt the in-flight turn (the Stop button). No-op (ok:false) if the
  // session isn't live or its query can't be interrupted.
  app.post("/chat/abort", async (c) => {
    const id = c.req.query("session");
    if (!id) return c.json({ ok: false, error: "missing session" }, 400);
    let stopped = false;
    for (const driver of abortDriversFor(c.req.query("vendor"), id)) {
      stopped = (await driver.interrupt(id)) || stopped;
    }
    stoppedExternalActiveAt.set(id, Date.now());
    return c.json({ ok: stopped, session: id });
  });

  // Start a brand-new session in a directory.
  app.post("/chat/new", async (c) => {
    const cwd = resolveProjectDir(c.req.query("cwd") ?? "", config.scopeRoots);
    const body = (await c.req.json().catch(() => ({}))) as {
      text?: string;
      attachments?: unknown;
      model?: string;
      effort?: string;
    };
    const text = body.text?.trim() ?? "";
    const attachments = parseChatAttachments(body.attachments);
    const model = normalizeModel(body.model);
    const effort = normalizeEffort(body.effort);
    if (!cwd || !fs.existsSync(cwd))
      return c.json({ ok: false, error: "directory not found" }, 400);
    const vendor = c.req.query("vendor") === "codex" ? "codex" : "claude";
    if (vendor === "codex") {
      const err = validateCodexAttachments(attachments);
      if (err) return c.json({ ok: false, error: err }, 400);
    }
    // Claude can open empty (its init message mints the id without input); Codex
    // only mints a thread id once a turn runs, so it needs a first message —
    // default to a greeting when none was typed.
    const first = text || (vendor === "codex" && !attachments.length ? "hello" : undefined);
    try {
      const session = await driverFor(vendor).start(
        first !== undefined || attachments.length
          ? {
              cwd,
              firstText: first ?? "",
              firstAttachments: attachments.length ? attachments : undefined,
              model,
              effort,
            }
          : { cwd, model, effort },
      );
      // Product-created session → give it an analyzer daemon (DESIGN v2.3 #5).
      // No-op for vendors without an analyzer (e.g. Codex without an install).
      orchestrator.ensureDaemon(session, vendor, cwd).catch(() => {});
      return c.json({ ok: true, session, vendor, cwd });
    } catch (err) {
      return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  // Fork (split) a session into a new branch. A fork needs a first turn to
  // diverge: Claude's SDK only emits the new id once it receives input, and Codex
  // forks by copying the parent's rollout then resuming the copy — both need the
  // opening message up front.
  app.post("/chat/fork", async (c) => {
    const id = c.req.query("session");
    const cwd = c.req.query("cwd");
    const body = (await c.req.json().catch(() => ({}))) as {
      text?: string;
      attachments?: unknown;
      model?: string;
      effort?: string;
    };
    const text = body.text?.trim() ?? "";
    const attachments = parseChatAttachments(body.attachments);
    const model = normalizeModel(body.model);
    const effort = normalizeEffort(body.effort);
    if (!id) return c.json({ ok: false, error: "missing session" }, 400);
    if (!cwd || !fs.existsSync(cwd))
      return c.json({ ok: false, error: "directory not found" }, 400);
    if (!text && !attachments.length)
      return c.json({ ok: false, error: "type a message or attach a file to branch with" }, 400);
    const vendor = c.req.query("vendor") === "codex" ? "codex" : "claude";
    if (vendor === "codex") {
      const err = validateCodexAttachments(attachments);
      if (err) return c.json({ ok: false, error: err }, 400);
    }
    try {
      const parent = visibleSessions().find((s) => s.sessionId === id) ?? null;
      const parentAnalysis = parent?.sessionId ? orchestrator.analysis(parent.sessionId) : null;
      const inheritedTags = parent
        ? tags.tagsFor(sessionTagKeys(parent, parentAnalysis?.brief))
        : tags.tagsFor(id);
      const sameVendor = !parent || parent.vendor === vendor;
      const session = await driverFor(vendor).start(
        sameVendor
          ? {
              resume: id,
              forkSession: true,
              cwd,
              firstText: text,
              firstAttachments: attachments,
              model,
              effort,
            }
          : {
              cwd,
              firstText: providerForkPrompt(parent, text, attachments),
              firstAttachments: attachments,
              model,
              effort,
            },
      );
      if (inheritedTags.length) tags.setSessionTags(session, inheritedTags);
      // A fork is also a product-created session → its own analyzer daemon.
      orchestrator.ensureDaemon(session, vendor, cwd).catch(() => {});
      return c.json({
        ok: true,
        session,
        vendor,
        forkMode: sameVendor ? "native" : "provider-context",
      });
    } catch (err) {
      return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  // Launch a vendor action in a terminal: resume / fork an existing session, or start a new one.
  app.post("/launch", (c) => {
    const action = c.req.query("action");
    const vendor = c.req.query("vendor");
    const cwd =
      action === "new"
        ? resolveProjectDir(c.req.query("cwd") ?? "", config.scopeRoots)
        : c.req.query("cwd");
    const id = c.req.query("id");
    const prompt = c.req.query("prompt");
    const model = normalizeModel(c.req.query("model"));
    const effort = normalizeEffort(c.req.query("effort"));

    if (action !== "resume" && action !== "fork" && action !== "new") {
      return c.json({ ok: false, error: "unknown action" }, 400);
    }
    if (vendor !== "claude" && vendor !== "codex") {
      return c.json({ ok: false, error: "unknown vendor" }, 400);
    }
    if (!cwd || !fs.existsSync(cwd)) {
      return c.json({ ok: false, error: "directory not found" }, 400);
    }
    if ((action === "resume" || action === "fork") && (!id || !/^[A-Za-z0-9_-]+$/.test(id))) {
      return c.json({ ok: false, error: "invalid session id" }, 400);
    }
    try {
      const command = deps.launcher(action, vendor, cwd, { sessionId: id, prompt, model, effort });
      return c.json({ ok: true, command, cwd });
    } catch (err) {
      return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  function resolveRevealPath(reqPath: string, cwd: string): string | null {
    let resolved = reqPath.trim();
    if (!resolved) return null;
    if (resolved.startsWith("~/")) resolved = path.join(os.homedir(), resolved.slice(2));
    else if (!path.isAbsolute(resolved) && !/^[A-Za-z]:[\\/]/.test(resolved)) {
      if (!cwd) return null;
      resolved = path.resolve(cwd, resolved);
    }
    let candidate = resolved;
    while (candidate) {
      if (fs.existsSync(candidate)) return candidate;
      const stripped = candidate.replace(/:\d+(?::\d+)?$/, "");
      if (stripped !== candidate) {
        candidate = stripped;
        continue;
      }
      const parent = path.dirname(candidate);
      const root = path.parse(candidate).root;
      if (!parent || parent === candidate || parent === root) break;
      candidate = parent;
    }
    return null;
  }

  // Reveal a local file (clicked in a chat message) in the OS file manager. A
  // relative path is resolved against the session's cwd; `~/` against $HOME.
  // `file.md:12` / `file.md:12:4` are accepted and strip their line suffix. If
  // the file is gone, fall back to the nearest existing parent directory.
  app.post("/open", (c) => {
    const reqPath = c.req.query("path");
    const cwd = c.req.query("cwd") ?? "";
    if (!reqPath) return c.json({ ok: false, error: "no path" }, 400);
    if (
      !cwd &&
      !reqPath.startsWith("~/") &&
      !path.isAbsolute(reqPath) &&
      !/^[A-Za-z]:[\\/]/.test(reqPath)
    ) {
      return c.json({ ok: false, error: "no cwd to resolve relative path" }, 400);
    }
    const resolved = resolveRevealPath(reqPath, cwd);
    if (!resolved) return c.json({ ok: false, error: "file not found" }, 404);
    try {
      (deps.revealer ?? revealPath)(resolved);
      return c.json({ ok: true, path: resolved });
    } catch (err) {
      return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  return app;
}

export interface RunningServer {
  url: string;
  port: number;
  close: () => void;
}

/**
 * Start the HTTP server; resolves once it is listening. If the port is already
 * in use, rolls forward to the next free port (up to `maxAttempts`) instead of
 * crashing — and logs the bump so the printed URL is always the real one.
 */
export function startServer(config: AttendConfig, maxAttempts = 10): Promise<RunningServer> {
  const app = createApp(config);
  const listen = (port: number, attemptsLeft: number): Promise<RunningServer> =>
    new Promise((resolve, reject) => {
      const server = serve({ fetch: app.fetch, hostname: config.host, port }, () => {
        resolve({ url: `http://${config.host}:${port}`, port, close: () => server.close() });
      });
      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
          process.stderr.write(`port ${port} in use, trying ${port + 1}…\n`);
          resolve(listen(port + 1, attemptsLeft - 1));
        } else {
          reject(err);
        }
      });
    });
  return listen(config.port, maxAttempts - 1);
}
