import fs from "node:fs";
import path from "node:path";
import {
  type OpencodeTranscriptEvent,
  parseOpencodeTranscript,
} from "../../chat/opencode/transcript.js";
import type { RawSession } from "../types.js";
import type { SessionSource } from "./index.js";
import {
  type OpencodeSessionMeta,
  mirrorIsFresh,
  mirrorPath,
  readOpencodeEvents,
  readOpencodeSessionMetas,
  writeOpencodeMirror,
} from "./opencode-store.js";
import { type IncrementalJsonlParser, ScanCache } from "./scan-cache.js";
import {
  type TranscriptSummaryState,
  appendTranscriptSummary,
  createTranscriptSummaryState,
  restoreTranscriptSummaryState,
  transcriptSummarySnapshot,
} from "./session-summary.js";
import type { TranscriptPathWriter } from "./transcript-index.js";

interface OpencodeSummaryState {
  summary: TranscriptSummaryState;
  sessionId: string;
  cwd: string | null;
}

function fallbackSessionId(file: string): string {
  return path.basename(file, ".jsonl");
}

function createOpencodeState(file: string): OpencodeSummaryState {
  return {
    summary: createTranscriptSummaryState(),
    sessionId: fallbackSessionId(file),
    cwd: null,
  };
}

function appendOpencodeLine(state: OpencodeSummaryState, line: string): void {
  const event = JSON.parse(line) as OpencodeTranscriptEvent;
  if (event.type === "session") {
    if (event.sessionID) state.sessionId = event.sessionID;
    if (typeof event.text === "string" && event.text) state.cwd = event.text;
    return;
  }
  for (const message of parseOpencodeTranscript(line, Number.POSITIVE_INFINITY)) {
    appendTranscriptSummary(state.summary, message, {
      mergeAssistantText: false,
    });
  }
}

function restoreOpencodeState(file: string, checkpoint: unknown): OpencodeSummaryState | null {
  if (!checkpoint || typeof checkpoint !== "object") return null;
  const saved = checkpoint as Partial<OpencodeSummaryState>;
  const summary = restoreTranscriptSummaryState(saved.summary);
  if (
    !summary ||
    typeof saved.sessionId !== "string" ||
    !(saved.cwd === null || typeof saved.cwd === "string")
  ) {
    return null;
  }
  return {
    summary,
    sessionId: saved.sessionId || fallbackSessionId(file),
    cwd: saved.cwd,
  };
}

const opencodeJsonlParser: IncrementalJsonlParser<OpencodeSummaryState> = {
  create: createOpencodeState,
  restore: restoreOpencodeState,
  serialize: (state) => state,
  append: appendOpencodeLine,
  snapshot: (state, file, mtimeMs) =>
    transcriptSummarySnapshot("opencode", file, state.summary, {
      sessionId: state.sessionId,
      cwd: state.cwd,
      fallbackTimestamp: mtimeMs,
    }),
};

/**
 * Reads OpenCode's native store (SQLite `opencode.db`, or the legacy JSON tree)
 * and mirrors each session into `mirrorDir` as a JSONL transcript. Downstream
 * history/search/analyzer seams then treat OpenCode like any other vendor.
 */
export class OpencodeSource implements SessionSource {
  readonly vendor = "opencode";

  constructor(
    private readonly dataDir: string,
    private readonly mirrorDir: string,
    private readonly cache = new ScanCache(),
    private readonly transcriptIndex?: TranscriptPathWriter,
  ) {}

  scan(): RawSession[] {
    let metas: OpencodeSessionMeta[] = [];
    try {
      metas = readOpencodeSessionMetas(this.dataDir);
    } catch {
      metas = [];
    }
    const live = new Map(metas.map((meta) => [meta.id, meta]));

    try {
      fs.mkdirSync(this.mirrorDir, { recursive: true });
    } catch {
      // A missing mirror dir is handled by the freshness check below.
    }

    const mirrorFiles: string[] = [];
    for (const meta of metas) {
      const file = mirrorPath(this.mirrorDir, meta.id);
      try {
        if (!mirrorIsFresh(file, meta)) {
          writeOpencodeMirror(file, readOpencodeEvents(this.dataDir, meta));
        }
        if (fs.existsSync(file)) mirrorFiles.push(file);
      } catch {
        // One unreadable session must not drop the rest.
      }
    }

    try {
      // Never prune when the native store read produced nothing: a transient
      // database lock must not delete every mirror and blank the listing.
      if (metas.length) {
        for (const entry of fs.readdirSync(this.mirrorDir, { withFileTypes: true })) {
          if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
          const id = entry.name.slice(0, -".jsonl".length);
          if (!live.has(id)) fs.rmSync(path.join(this.mirrorDir, entry.name), { force: true });
        }
      }
    } catch {
      // Best-effort pruning only.
    }

    const sessions = this.cache
      .memoizeJsonl(mirrorFiles, opencodeJsonlParser)
      .filter((session) => session.sessionId && live.has(session.sessionId));
    this.transcriptIndex?.replaceVendor(this.vendor, sessions);
    return sessions;
  }
}
