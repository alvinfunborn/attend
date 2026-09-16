import type { AnalyzerPlan, AnalyzerPolicy } from "../core/analyzer-policy.js";
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
  private readonly registrationListeners = new Set<
    (taskId: string, daemonId: string, vendor: string, cwd: string) => void
  >();
  private readonly analyzing = new Set<string>();
  private readonly analyzeAgain = new Map<string, { cwd: string; uiContext: string }>();
  private readonly prompting = new Set<string>();
  private readonly analysisEpoch = new Map<string, number>();
  private policy?: AnalyzerPolicy;
  private readonly plans = new Map<string, AnalyzerPlan>();
  private readonly analysisOwner = crypto.randomUUID();

  constructor(
    private readonly registry: DaemonRegistry,
    private readonly cache: AnalysisCache,
    analyzers: SessionAnalyzer[],
    private readonly collaboration?: CollaborationStore,
  ) {
    for (const a of analyzers) this.analyzers.set(a.vendor, a);
  }

  configurePolicy(policy: AnalyzerPolicy): void {
    this.policy = policy;
  }

  executionStatus(taskId: string): AnalyzerPlan | null {
    const plan = this.plans.get(taskId);
    const entry = this.registry.get(taskId);
    return plan && entry && this.policy?.current(taskId, entry.vendor, plan) ? plan : null;
  }

  private failed(taskId: string, vendor: string, cwd: string, plan: AnalyzerPlan): void {
    if (!this.policy?.current(taskId, vendor, plan)) return;
    const entry = this.registry.get(taskId);
    if (entry?.profile !== plan.fingerprint) return;
    this.policy?.failed?.(vendor, cwd);
    this.plans.set(taskId, {
      ...plan,
      execution: undefined,
      reason: "Background provider failed; using local analysis.",
    });
    this.cache.delete(taskId);
    if (entry) this.registry.set(taskId, { ...entry, profile: `failed:${plan.fingerprint}` });
  }

  private validPlan(taskId: string, plan?: AnalyzerPlan): boolean {
    const entry = this.registry.get(taskId);
    return (
      !this.policy ||
      !!(
        plan &&
        entry &&
        this.policy.current(taskId, entry.vendor, plan) &&
        entry.profile === plan.fingerprint
      )
    );
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

  /**
   * Follow a task session whose provider id rolled mid-session — Claude /clear resets the
   * conversation and the SDK reinitializes with a fresh session id (and a fresh transcript).
   * Move the daemon pairing + cached verdict to the new id so the SAME daemon keeps analyzing
   * the continued session. Without this, the rolled id has no daemon (`hasDaemon` → false), so
   * `onTurnEnd` short-circuits and analysis silently stops after a /clear.
   *
   * Only the durable + closure-safe state is migrated. `spawning` is intentionally left alone:
   * its cleanup closure captured the old id, and a rollover on an established session (the only
   * time /clear happens) is never mid-spawn — so a spawn race is skipped rather than corrupted.
   */
  rekeyTask(oldTaskId: string, newTaskId: string): boolean {
    if (!oldTaskId || !newTaskId || oldTaskId === newTaskId) return false;
    if (this.spawning.has(oldTaskId)) return false;
    if (!this.registry.rename(oldTaskId, newTaskId)) return false;
    this.cache.move(oldTaskId, newTaskId);
    const moveMapEntry = <V>(m: Map<string, V>) => {
      if (!m.has(oldTaskId)) return;
      const value = m.get(oldTaskId) as V;
      m.delete(oldTaskId);
      m.set(newTaskId, value);
    };
    moveMapEntry(this.analysisEpoch);
    moveMapEntry(this.plans);
    moveMapEntry(this.analyzeAgain);
    if (this.analyzing.delete(oldTaskId)) this.analyzing.add(newTaskId);
    if (this.prompting.delete(oldTaskId)) this.prompting.add(newTaskId);
    return true;
  }

  onDaemonRegistered(
    listener: (taskId: string, daemonId: string, vendor: string, cwd: string) => void,
  ): () => void {
    this.registrationListeners.add(listener);
    return () => this.registrationListeners.delete(listener);
  }

  analysis(taskId: string): Analysis | null {
    const cached = this.cache.get(taskId);
    if (!cached) return null;
    if (this.policy) {
      const settings = this.policy.settings();
      const plan = this.plans.get(taskId);
      if (settings.mode === "off") return null;
      if (plan && (!plan.execution || !this.validPlan(taskId, plan))) return null;
      if (
        settings.mode !== "legacy_vendor_default" &&
        (!plan || cached?.analyzerProfile !== plan.fingerprint)
      )
        return null;
    }
    return cached;
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
    const inflight = this.spawning.get(taskId);
    if (inflight) return inflight;
    if (this.policy && (this.analyzing.has(taskId) || this.prompting.has(taskId)))
      return Promise.resolve(null);
    const pending = (async () => {
      const plan = this.policy ? await this.policy.resolve(taskId, vendor, cwd) : undefined;
      if (plan && !this.policy?.current(taskId, vendor, plan)) return null;
      if (plan) this.plans.set(taskId, plan);
      let existing = this.registry.get(taskId);
      if (plan && !plan.execution) {
        if (!existing) this.registry.set(taskId, { daemonId: "", cwd, vendor });
        return null;
      }
      const profile = plan?.fingerprint;
      if (
        existing?.daemonId &&
        (!plan ||
          existing.profile === profile ||
          (plan.mode === "legacy_vendor_default" && !existing.profile))
      ) {
        if (plan && !existing.profile) this.registry.set(taskId, { ...existing, profile });
        return existing.daemonId;
      }
      if (
        this.collaboration &&
        !this.collaboration.claimAnalysis(vendor, taskId, this.analysisOwner)
      )
        return null;
      try {
        existing = this.registry.get(taskId);
        if (existing?.daemonId && plan && existing.profile === profile) return existing.daemonId;
        const retiredIds = [
          ...new Set([
            ...(existing?.retiredIds ?? []),
            ...(existing?.daemonId ? [existing.daemonId] : []),
          ]),
        ];
        if (plan) {
          this.cache.delete(taskId);
          this.registry.set(taskId, { daemonId: "", cwd, vendor, profile, retiredIds });
        }
        return await this.spawnDaemon(taskId, vendor, cwd, plan, retiredIds);
      } finally {
        this.collaboration?.releaseAnalysis(vendor, taskId, this.analysisOwner);
      }
    })().finally(() => this.spawning.delete(taskId));
    this.spawning.set(taskId, pending);
    return pending;
  }

  private async spawnDaemon(
    taskId: string,
    vendor: string,
    cwd: string,
    plan?: AnalyzerPlan,
    retiredIds: string[] = [],
  ): Promise<string | null> {
    const analyzer = this.analyzers.get(vendor);
    if (!analyzer) return null;
    let observedId: string | null = null;
    const register = (daemonId: string): boolean => {
      // A daemon must be a separate provider session. Refuse a broken adapter
      // (or test fake) that echoes the task id, otherwise the real task would be
      // hidden and its remaining events suppressed as daemon traffic.
      if (!daemonId || daemonId === taskId || observedId) return false;
      observedId = daemonId;
      this.registry.set(taskId, {
        daemonId,
        cwd,
        vendor,
        ...(plan ? { profile: plan.fingerprint, retiredIds } : {}),
      });
      for (const listener of this.registrationListeners) {
        try {
          listener(taskId, daemonId, vendor, cwd);
        } catch {
          // Filtering is already durable; a failed observer cannot undo it.
        }
      }
      return true;
    };
    try {
      const daemonId = await analyzer.spawn(cwd, register, plan?.execution);
      if (daemonId) register(daemonId);
      if (!observedId && plan) this.failed(taskId, vendor, cwd, plan);
      return this.validPlan(taskId, plan) ? observedId : null;
    } catch (error) {
      if (!plan || plan.mode === "legacy_vendor_default") throw error;
      this.failed(taskId, vendor, cwd, plan);
      return null;
    }
  }

  /**
   * Re-run analysis for a task whose turn just ended, using its vendor's analyzer.
   * No-op for sessions without a daemon (historical / terminal-launched ones keep
   * the heuristic fallback). Coalesces concurrent turn-ends for the same task.
   */
  async analyzeTask(taskId: string, cwd: string, uiContext = ""): Promise<Analysis | null> {
    // Registration is deliberately earlier than seed completion so scanners can
    // hide the daemon. Do not resume it until that original spawn has settled.
    const spawning = this.spawning.get(taskId);
    if (spawning) await spawning;
    let entry = this.registry.get(taskId);
    if (!entry) return null;
    if (this.analyzing.has(taskId) || this.prompting.has(taskId)) {
      this.analyzeAgain.set(taskId, { cwd, uiContext });
      return this.analysis(taskId);
    }
    if (this.policy && !(await this.ensureDaemon(taskId, entry.vendor, entry.cwd || cwd)))
      return null;
    entry = this.registry.get(taskId);
    if (!entry?.daemonId) return null;
    if (this.analyzing.has(taskId) || this.prompting.has(taskId)) {
      this.analyzeAgain.set(taskId, { cwd, uiContext });
      return this.analysis(taskId);
    }
    const plan = this.plans.get(taskId);
    const analyzer = this.analyzers.get(entry.vendor);
    if (!analyzer) return null;
    this.collaboration?.ensureSession(entry.vendor, taskId, entry.cwd || cwd);
    if (
      this.collaboration &&
      !this.collaboration.claimAnalysis(entry.vendor, taskId, this.analysisOwner)
    )
      return this.analysis(taskId);
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
        plan?.execution,
      );
      if (!this.validPlan(taskId, plan)) return null;
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
        if (plan) next.analyzerProfile = plan.fingerprint;
        this.cache.set(taskId, next);
        return next;
      }
      return null;
    } catch (error) {
      if (!plan || plan.mode === "legacy_vendor_default") throw error;
      this.failed(taskId, entry.vendor, entry.cwd || cwd, plan);
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
    let entry = this.registry.get(taskId);
    if (!entry || this.prompting.has(taskId) || this.analyzing.has(taskId)) return null;
    if (this.policy && !(await this.ensureDaemon(taskId, entry.vendor, entry.cwd || cwd)))
      return null;
    entry = this.registry.get(taskId);
    if (!entry?.daemonId) return null;
    if (this.prompting.has(taskId) || this.analyzing.has(taskId)) return null;
    const plan = this.plans.get(taskId);
    const epoch = this.analysisEpoch.get(taskId) ?? 0;
    const cached = this.analysis(taskId);
    if (cached?.avoidancePrompt !== undefined) return cached.avoidancePrompt ?? null;
    const analyzer = this.analyzers.get(entry.vendor);
    if (!analyzer?.avoidancePrompt) return null;
    if (
      this.collaboration &&
      !this.collaboration.claimAnalysis(entry.vendor, taskId, this.analysisOwner)
    )
      return null;
    this.prompting.add(taskId);
    try {
      const prompt = await analyzer.avoidancePrompt(
        entry.daemonId,
        entry.cwd || cwd,
        taskId,
        uiContext,
        plan?.execution,
      );
      if (!this.validPlan(taskId, plan) || epoch !== (this.analysisEpoch.get(taskId) ?? 0))
        return null;
      const current = this.cache.get(taskId);
      if (current) this.cache.set(taskId, { ...current, avoidancePrompt: prompt });
      return prompt;
    } catch (error) {
      if (!plan || plan.mode === "legacy_vendor_default") throw error;
      this.failed(taskId, entry.vendor, entry.cwd || cwd, plan);
      return null;
    } finally {
      this.collaboration?.releaseAnalysis(entry.vendor, taskId, this.analysisOwner);
      this.prompting.delete(taskId);
      const rerun = this.analyzeAgain.get(taskId);
      if (rerun) {
        this.analyzeAgain.delete(taskId);
        void this.analyzeTask(taskId, rerun.cwd, rerun.uiContext).catch(() => {});
      }
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
