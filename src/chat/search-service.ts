import type { RawSession } from "../core/types.js";
import type { SessionSearchResult } from "./search.js";

export interface SessionSearch {
  sync?(sessions: RawSession[]): void;
  syncDelta?(upserts: RawSession[], removedPaths: string[]): void;
  search(
    sessions: RawSession[],
    query: string,
    opts?: { maxResults?: number; maxHitsPerSession?: number },
  ): Promise<SessionSearchResult[]>;
  close?(): void;
}
