import fs from "node:fs";
import path from "node:path";
import type { CopilotEvent } from "../../chat/copilot/exec.js";
import { parseCopilotTranscript } from "../../chat/copilot/transcript.js";
import type { RawSession } from "../types.js";
import type { SessionSource } from "./index.js";
import { type IncrementalJsonlParser, ScanCache } from "./scan-cache.js";
import {
  type TranscriptSummaryState,
  appendTranscriptSummary,
  createTranscriptSummaryState,
  restoreTranscriptSummaryState,
  transcriptSummarySnapshot,
} from "./session-summary.js";
import type { TranscriptPathWriter } from "./transcript-index.js";

function sessionFiles(dir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name, "events.jsonl"))
    .filter((file) => fs.existsSync(file));
}

interface CopilotSummaryState {
  summary: TranscriptSummaryState;
  cwd: string | null;
  sessionId: string;
}

type CopilotSummaryEvent = CopilotEvent & {
  data?: CopilotEvent["data"] & {
    cwd?: string;
    workingDirectory?: string;
    context?: { cwd?: string };
  };
};

function fallbackSessionId(file: string): string {
  return path.basename(file) === "events.jsonl"
    ? path.basename(path.dirname(file))
    : path.basename(file, ".jsonl");
}

function createCopilotState(file: string): CopilotSummaryState {
  return {
    summary: createTranscriptSummaryState(),
    cwd: null,
    sessionId: fallbackSessionId(file),
  };
}

function appendCopilotLine(state: CopilotSummaryState, line: string): void {
  const event = JSON.parse(line) as CopilotSummaryEvent;
  for (const message of parseCopilotTranscript(line, Number.POSITIVE_INFINITY)) {
    appendTranscriptSummary(state.summary, message, {
      mergeAssistantText:
        message.role === "assistant" && message.text === "" && message.tools.length > 0,
    });
  }
  const sessionId = event.data?.sessionId ?? event.sessionId;
  if (typeof sessionId === "string" && sessionId) state.sessionId = sessionId;
  const cwd =
    event._attend?.cwd ??
    event.data?.cwd ??
    event.data?.workingDirectory ??
    event.data?.context?.cwd;
  if (typeof cwd === "string" && cwd) state.cwd = cwd;
}

function restoreCopilotState(file: string, checkpoint: unknown): CopilotSummaryState | null {
  if (!checkpoint || typeof checkpoint !== "object") return null;
  const saved = checkpoint as Partial<CopilotSummaryState>;
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

const copilotJsonlParser: IncrementalJsonlParser<CopilotSummaryState> = {
  create: createCopilotState,
  restore: restoreCopilotState,
  serialize: (state) => state,
  append: appendCopilotLine,
  snapshot: (state, file, mtimeMs) =>
    transcriptSummarySnapshot("copilot", file, state.summary, {
      sessionId: state.sessionId,
      cwd: state.cwd,
      fallbackTimestamp: mtimeMs,
    }),
};

export class CopilotSource implements SessionSource {
  readonly vendor = "copilot";

  constructor(
    private readonly sessionsDir: string,
    private readonly capturedDir?: string,
    private readonly cache = new ScanCache(),
    private readonly transcriptIndex?: TranscriptPathWriter,
  ) {}

  scan(): RawSession[] {
    let captured: string[] = [];
    try {
      captured = this.capturedDir
        ? fs
            .readdirSync(this.capturedDir, { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
            .map((entry) => path.join(this.capturedDir ?? "", entry.name))
        : [];
    } catch {
      // Attend capture is optional; native Copilot sessions remain available.
    }
    const parsed = this.cache.memoizeJsonl(
      [...sessionFiles(this.sessionsDir), ...captured],
      copilotJsonlParser,
    );
    const byId = new Map<string, RawSession>();
    for (const session of parsed) {
      if (!session.sessionId) continue;
      const previous = byId.get(session.sessionId);
      if (!previous || session.cwd || !previous.cwd) byId.set(session.sessionId, session);
    }
    const sessions = [...byId.values()];
    this.transcriptIndex?.replaceVendor(this.vendor, sessions);
    return sessions;
  }
}
