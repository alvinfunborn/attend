import { readFile } from "node:fs/promises";
import {
  type CollaborationTurnInput,
  projectCollaborationTurns,
} from "../../core/collaboration.js";
import { parseAntigravityTranscript } from "../antigravity/transcript.js";
import { parseCodexTranscriptMessages } from "../codex/transcript.js";
import { parseCopilotTranscript } from "../copilot/transcript.js";
import { parseCursorTranscript } from "../cursor/transcript.js";
import { type TranscriptMsg, parseClaudeTranscriptMessages } from "../transcript.js";
import { condenseTranscript } from "./contract.js";

export interface AnalyzerTranscriptContext {
  transcript: string;
  observedTurns: CollaborationTurnInput[];
}

export interface AnalyzerContextReader {
  readAnalyzerContext(
    file: string,
    vendor: string,
    sessionId: string,
    analysisFromAt?: number | null,
  ): Promise<AnalyzerTranscriptContext>;
}

function parseTranscript(vendor: string, raw: string): TranscriptMsg[] {
  if (vendor === "codex") return parseCodexTranscriptMessages(raw, Number.POSITIVE_INFINITY, true);
  if (vendor === "cursor") return parseCursorTranscript(raw, Number.POSITIVE_INFINITY);
  if (vendor === "antigravity") return parseAntigravityTranscript(raw, Number.POSITIVE_INFINITY);
  if (vendor === "copilot") return parseCopilotTranscript(raw, Number.POSITIVE_INFINITY);
  return parseClaudeTranscriptMessages(raw, Number.POSITIVE_INFINITY);
}

export function analyzerContextFromMessages(
  messages: TranscriptMsg[],
  vendor: string,
  sessionId: string,
  analysisFromAt: number | null = null,
): AnalyzerTranscriptContext {
  return {
    transcript: condenseTranscript(messages),
    observedTurns: projectCollaborationTurns(vendor, sessionId, messages, analysisFromAt),
  };
}

/**
 * Full transcript parsing used by daemon analysis.
 *
 * Production invokes this function inside the shared history worker. Keeping
 * the small async helper here also gives tests and custom embedders a fallback
 * without coupling analyzer implementations to provider file formats.
 */
export async function readAnalyzerContextFile(
  file: string,
  vendor: string,
  sessionId: string,
  analysisFromAt: number | null = null,
): Promise<AnalyzerTranscriptContext> {
  const raw = await readFile(file, "utf8");
  return analyzerContextFromMessages(
    parseTranscript(vendor, raw),
    vendor,
    sessionId,
    analysisFromAt,
  );
}
