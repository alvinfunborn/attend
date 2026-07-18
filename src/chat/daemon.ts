import type { CollaborationStats, CollaborationStore } from "../core/collaboration.js";
import type { Analysis, AnalysisCache } from "../core/daemon/cache.js";
import type { DaemonRegistry } from "../core/daemon/registry.js";
import type { SessionAnalyzer } from "./analyzer/index.js";

/**
 * Coordinates per-task daemon sessions across vendors. It owns the registry +
 * cache + dedup; the vendor-specific work (spawning the daemon, the analysis
 * prompt/contract, parsing) lives behind a `SessionAnalyzer` — so a Claude
 * session is analyzed by a Claude daemon, a Codex session by a Codex daemon, and
 * the orchestrator stays vendor-neutral.
 */
export class DaemonOrchestrator {
  private readonly analyzers = new Map<string, SessionAnalyzer>();
  private readonly spawning = new Map<string, Promise<string | null>>();
  private readonly analyzing = new Set<string>();
  private readonly analyzeAgain = new Map<string, { cwd: string; uiContext: string }>();
  private readonly prompting = new Set<string>();
  private readonly analysisEpoch = new Map<string, number>();
  private readonly analysisOwner = crypto.randomUUID();

  constructor(
    private readonly registry: DaemonRegistry,
    private readonly cache: AnalysisCache,
    analyzers: SessionAnalyzer[],
    private readonly collaboration?: CollaborationStore,
  ) {
    for (const a of analyzers) this.analyzers.set(a.vendor, a);
  }

  /** Is this session id one of our hidden daemons (→ filter it out of the list)? */
  isDaemon(sessionId: string): boolean {
    return this.registry.daemonIds().has(sessionId);
  }

  /** Does this task session have a daemon (→ it's a product-created session)? */
  hasDaemon(taskId: string): boolean {
    return this.registry.has(taskId) || this.spawning.has(taskId);
  }

  daemonIds(): Set<string> {
    return this.registry.daemonIds();
  }

  analysis(taskId: string): Analysis | null {
    return this.cache.get(taskId);
  }

  /** A new user turn makes the previous turn's message drafts unusable. Bump the
   *  epoch as well as clearing the cache so an older in-flight analysis cannot
   *  repopulate them after the session has already advanced. */
  discardTurnDrafts(taskId: string): Analysis | null {
    this.analysisEpoch.set(taskId, (this.analysisEpoch.get(taskId) ?? 0) + 1);
    return this.cache.discardTurnDrafts(taskId);
  }

  /** Spawn a daemon for a product-created task session via its vendor's analyzer
   *  (idempotent). No-op for vendors without an analyzer (e.g. Codex stub). */
  ensureDaemon(taskId: string, vendor: string, cwd: string): Promise<string | null> {
    this.collaboration?.ensureSession(vendor, taskId, cwd);
    const existing = this.registry.get(taskId);
    if (existing) return Promise.resolve(existing.daemonId);
    const analyzer = this.analyzers.get(vendor);
    if (!analyzer) return Promise.resolve(null);
    const inflight = this.spawning.get(taskId);
    if (inflight) return inflight;
    const p = analyzer
      .spawn(cwd)
      .then((daemonId) => {
        if (daemonId) this.registry.set(taskId, { daemonId, cwd, vendor });
        return daemonId;
      })
      .finally(() => this.spawning.delete(taskId));
    this.spawning.set(taskId, p);
    return p;
  }

  /**
   * Re-run analysis for a task whose turn just ended, using its vendor's analyzer.
   * No-op for sessions without a daemon (historical / terminal-launched ones keep
   * the heuristic fallback). Coalesces concurrent turn-ends for the same task.
   */
  async analyzeTask(taskId: string, cwd: string, uiContext = ""): Promise<Analysis | null> {
    // wait out an in-flight spawn so the very first turn-end still analyzes
    if (!this.registry.has(taskId)) {
      const spawning = this.spawning.get(taskId);
      if (spawning) await spawning;
    }
    const entry = this.registry.get(taskId);
    if (!entry) return null;
    if (this.analyzing.has(taskId)) {
      this.analyzeAgain.set(taskId, { cwd, uiContext });
      return this.cache.get(taskId);
    }
    const analyzer = this.analyzers.get(entry.vendor);
    if (!analyzer) return null;
    this.collaboration?.ensureSession(entry.vendor, taskId, entry.cwd || cwd);
    if (
      this.collaboration &&
      !this.collaboration.claimAnalysis(entry.vendor, taskId, this.analysisOwner)
    )
      return this.cache.get(taskId);
    const analysisEpoch = this.analysisEpoch.get(taskId) ?? 0;
    this.analyzing.add(taskId);
    try {
      const collaborationState = this.collaboration?.analysisState(entry.vendor, taskId);
      const verdict = await analyzer.analyze(
        entry.daemonId,
        entry.cwd || cwd,
        taskId,
        collaborationState?.labeledTurnIds,
        collaborationState?.analysisFromAt,
        uiContext,
      );
      if (verdict) {
        const parsed = verdict.analysis;
        try {
          this.collaboration?.saveAnalysis(
            entry.vendor,
            taskId,
            entry.cwd || cwd,
            verdict.observedTurns,
            verdict.labels,
          );
        } catch {
          // Collaboration history is additive telemetry; session handoff analysis still wins.
        }
        // The daemon read the transcript before a newer user turn started. Its
        // whole verdict is stale; the next turn-end will schedule a fresh run.
        if ((this.analysisEpoch.get(taskId) ?? 0) !== analysisEpoch) return null;
        const prev = this.cache.get(taskId);
        const next =
          parsed.avoidancePrompt === undefined && prev?.avoidancePrompt !== undefined
            ? { ...parsed, avoidancePrompt: prev.avoidancePrompt }
            : parsed;
        this.cache.set(taskId, next);
        return next;
      }
      return null;
    } finally {
      this.collaboration?.releaseAnalysis(entry.vendor, taskId, this.analysisOwner);
      this.analyzing.delete(taskId);
      const rerun = this.analyzeAgain.get(taskId);
      if (rerun !== undefined) {
        this.analyzeAgain.delete(taskId);
        void this.analyzeTask(taskId, rerun.cwd, rerun.uiContext).catch(() => {});
      }
    }
  }

  async ensureAvoidancePrompt(taskId: string, cwd: string, uiContext = ""): Promise<string | null> {
    const cached = this.cache.get(taskId);
    if (cached?.avoidancePrompt !== undefined) return cached.avoidancePrompt ?? null;
    const entry = this.registry.get(taskId);
    if (!entry || this.prompting.has(taskId)) return null;
    const analyzer = this.analyzers.get(entry.vendor);
    if (!analyzer?.avoidancePrompt) return null;
    this.prompting.add(taskId);
    try {
      const prompt = await analyzer.avoidancePrompt(
        entry.daemonId,
        entry.cwd || cwd,
        taskId,
        uiContext,
      );
      const current = this.cache.get(taskId);
      if (current) this.cache.set(taskId, { ...current, avoidancePrompt: prompt });
      return prompt;
    } finally {
      this.prompting.delete(taskId);
    }
  }

  recordSessionRelation(
    sessionId: string,
    vendor: string,
    cwd: string,
    relation: {
      parentVendor?: string | null;
      parentSessionId?: string | null;
      kind?: "root" | "fork" | "comment" | "promoted_comment";
      createdAt?: number | null;
      analysisFromAt?: number | null;
    },
  ): void {
    this.collaboration?.ensureSession(vendor, sessionId, cwd, relation);
  }

  collaborationStats(since: number, sessionIds?: Iterable<string>): CollaborationStats | null {
    return this.collaboration?.stats(since, sessionIds) ?? null;
  }

  pruneCollaboration(now = Date.now()): number {
    return this.collaboration?.prune(now) ?? 0;
  }

  close(): void {
    this.collaboration?.close();
  }
}
import crypto from "node:crypto";
