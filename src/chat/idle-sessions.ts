export const SESSION_IDLE_TTL_MS = 24 * 60 * 60 * 1000;

/** One resettable idle timeout per provider session, with no session-count limit. */
export class IdleSessionTimers {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly idleTtlMs = SESSION_IDLE_TTL_MS) {}

  arm(sessionId: string, expire: () => void): void {
    this.cancel(sessionId);
    const timer = setTimeout(() => {
      if (this.timers.get(sessionId) !== timer) return;
      this.timers.delete(sessionId);
      expire();
    }, this.idleTtlMs);
    timer.unref?.();
    this.timers.set(sessionId, timer);
  }

  cancel(sessionId: string): void {
    const timer = this.timers.get(sessionId);
    if (!timer) return;
    clearTimeout(timer);
    this.timers.delete(sessionId);
  }

  clear(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
