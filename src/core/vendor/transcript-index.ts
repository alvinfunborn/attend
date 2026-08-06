import type { RawSession } from "../types.js";

/** Read-only side of the transcript index consumed by vendor analyzers. */
export interface TranscriptPathLookup {
  get(vendor: string, sessionId: string): string | null;
}

/** Mutable side owned by the vendor scan pipeline. */
export interface TranscriptPathWriter extends TranscriptPathLookup {
  set(vendor: string, sessionId: string, file: string): void;
  replaceVendor(vendor: string, sessions: RawSession[]): void;
}

/**
 * Process-local session id -> transcript path index.
 *
 * Scanners already pay the cost of discovering transcript files, so analyzers
 * reuse that result instead of recursively walking the same vendor tree at the
 * end of every turn. File validation belongs to the scan/history workers; this
 * hot lookup deliberately performs no main-thread filesystem calls.
 */
export class TranscriptPathIndex implements TranscriptPathWriter {
  private readonly paths = new Map<string, Map<string, string>>();

  get(vendor: string, sessionId: string): string | null {
    const entries = this.paths.get(vendor);
    const file = entries?.get(sessionId);
    return file ?? null;
  }

  set(vendor: string, sessionId: string, file: string): void {
    let entries = this.paths.get(vendor);
    if (!entries) {
      entries = new Map();
      this.paths.set(vendor, entries);
    }
    entries.set(sessionId, file);
  }

  replaceVendor(vendor: string, sessions: RawSession[]): void {
    const entries = new Map<string, string>();
    for (const session of sessions) {
      if (session.sessionId) entries.set(session.sessionId, session.path);
    }
    if (entries.size) this.paths.set(vendor, entries);
    else this.paths.delete(vendor);
  }
}
