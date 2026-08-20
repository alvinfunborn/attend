/**
 * Opt-in diagnostic channel for provider RPCs that are *recovered from* rather
 * than surfaced to the user.
 *
 * Those recoveries have to stay quiet in the UI (invariant 3: descriptive, not
 * alarming), but swallowing them outright makes a whole class of vendor-protocol
 * drift invisible — a stale turn id silently disabled steer *and* interrupt for
 * a full day before anyone could tell why. Enable with `ATTEND_DEBUG=1`.
 *
 * Silent and side-effect free otherwise, so tests stay pure and the CLI quiet.
 */
export function debugLog(scope: string, message: string, error?: unknown): void {
  if (process.env.ATTEND_DEBUG !== "1") return;
  const detail =
    error === undefined ? "" : `: ${error instanceof Error ? error.message : String(error)}`;
  process.stderr.write(`[attend:${scope}] ${message}${detail}\n`);
}
