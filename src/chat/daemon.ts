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

  constructor(
    private readonly registry: DaemonRegistry,
    private readonly cache: AnalysisCache,
    analyzers: SessionAnalyzer[],
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

  /** Spawn a daemon for a product-created task session via its vendor's analyzer
   *  (idempotent). No-op for vendors without an analyzer (e.g. Codex stub). */
  ensureDaemon(taskId: string, vendor: string, cwd: string): Promise<string | null> {
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
  async analyzeTask(taskId: string, cwd: string): Promise<Analysis | null> {
    // wait out an in-flight spawn so the very first turn-end still analyzes
    if (!this.registry.has(taskId)) {
      const spawning = this.spawning.get(taskId);
      if (spawning) await spawning;
    }
    const entry = this.registry.get(taskId);
    if (!entry || this.analyzing.has(taskId)) return null;
    const analyzer = this.analyzers.get(entry.vendor);
    if (!analyzer) return null;
    this.analyzing.add(taskId);
    try {
      const parsed = await analyzer.analyze(entry.daemonId, entry.cwd || cwd, taskId);
      if (parsed) this.cache.set(taskId, parsed);
      return parsed;
    } finally {
      this.analyzing.delete(taskId);
    }
  }
}
