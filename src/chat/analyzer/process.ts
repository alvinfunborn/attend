import fs from "node:fs";
import path from "node:path";
import { type AnalyzerExecution, assertAnalyzerModel } from "../../core/analyzer-policy.js";
import { MAX_PENDING_TURNS_PER_ANALYSIS } from "../../core/collaboration.js";
import {
  parseAnalysis,
  parseAvoidancePrompt,
  parseCollaborationLabels,
} from "../../core/daemon/parse.js";
import type { TranscriptPathWriter } from "../../core/vendor/transcript-index.js";
import type { CodexEvent } from "../codex/events.js";
import { toUiEventsFromCodex } from "../codex/events.js";
import type { ProcessTurnFn } from "../process/types.js";
import type { TranscriptMsg } from "../transcript.js";
import { type AnalyzerContextReader, analyzerContextFromMessages } from "./context.js";
import {
  REQUEST_RULES,
  RESPONSE_SHAPE,
  avoidancePromptRequest,
  requestPrompt,
} from "./contract.js";
import type { AnalyzerVerdict, SessionAnalyzer } from "./index.js";
import { consumeAnalyzerStream } from "./timeout.js";

const SEED = `You are the *attend daemon* for a single coding session. Your only job: each
time I send you the session's latest transcript, observe it and reply with ONE JSON object and
nothing else (no prose, no code fence):

${RESPONSE_SHAPE}

Rules:
- LANGUAGE: write "brief" and "reason" in the session's dominant language — the language the
  human predominantly uses in this transcript, NOT the language of these instructions. Match it.
${REQUEST_RULES}
You run read-only: never write or run anything. This first message has no transcript yet — reply
with brief "new session", state "done", and priority/etaMin 0.`;

export type ProcessTranscriptReader = (file: string, limit?: number) => TranscriptMsg[];

/**
 * Analyzer for JSONL, process-per-turn CLIs. Cursor, Antigravity, and Copilot all
 * expose the same primitives after their native events are normalized to the
 * Codex compatibility protocol used by ProcessChatDriver.
 */
export class ProcessAnalyzer implements SessionAnalyzer {
  constructor(
    readonly vendor: string,
    private readonly sessionsDir: string,
    private readonly execFn: ProcessTurnFn<CodexEvent> | null,
    private readonly readTranscript: ProcessTranscriptReader,
    private readonly transcriptIndex?: TranscriptPathWriter,
    private readonly contextReader?: AnalyzerContextReader,
  ) {}

  async spawn(
    cwd: string,
    onSessionId?: (sessionId: string) => void,
    execution?: AnalyzerExecution,
  ): Promise<string | null> {
    if (!this.execFn) return null;
    const handle = this.execFn({ cwd, prompt: SEED, sandbox: "read-only", ...execution });
    let sessionId: string | null = null;
    await consumeAnalyzerStream(
      handle.events,
      (event) => {
        for (const uiEvent of toUiEventsFromCodex(event)) {
          if (uiEvent.kind !== "session" || !uiEvent.sessionId) continue;
          if (sessionId !== uiEvent.sessionId) onSessionId?.(uiEvent.sessionId);
          sessionId = uiEvent.sessionId;
        }
        assertAnalyzerModel(execution, event.model);
      },
      () => handle.kill(),
    );
    return sessionId;
  }

  async analyze(
    daemonId: string,
    cwd: string,
    taskId: string,
    knownTurnIds: ReadonlySet<string> = new Set(),
    analysisFromAt: number | null = null,
    uiContext = "",
    execution?: AnalyzerExecution,
  ): Promise<AnalyzerVerdict | null> {
    if (!this.execFn) return null;
    const file = await this.findTranscript(taskId);
    const context = file
      ? await this.readContext(file, taskId, analysisFromAt)
      : { transcript: "", observedTurns: [] };
    const { transcript, observedTurns } = context;
    const pendingTurns = observedTurns
      .filter((turn) => !knownTurnIds.has(turn.turnId))
      .slice(0, MAX_PENDING_TURNS_PER_ANALYSIS);
    const handle = this.execFn({
      cwd,
      prompt: requestPrompt(transcript, pendingTurns, uiContext),
      resume: daemonId,
      sandbox: "read-only",
      ...execution,
    });
    let text = "";
    await consumeAnalyzerStream(
      handle.events,
      (event) => {
        assertAnalyzerModel(execution, event.model);
        for (const uiEvent of toUiEventsFromCodex(event)) {
          if (uiEvent.kind === "assistant_text") text += uiEvent.text;
        }
      },
      () => handle.kill(),
    );
    const analysis = parseAnalysis(text);
    if (!analysis) return null;
    return {
      analysis,
      observedTurns,
      labels: parseCollaborationLabels(text, new Set(pendingTurns.map((turn) => turn.turnId))),
    };
  }

  async avoidancePrompt(
    daemonId: string,
    cwd: string,
    taskId: string,
    uiContext = "",
    execution?: AnalyzerExecution,
  ): Promise<string | null> {
    if (!this.execFn) return null;
    const file = await this.findTranscript(taskId);
    const transcript = file ? (await this.readContext(file, taskId)).transcript : "";
    const handle = this.execFn({
      cwd,
      prompt: avoidancePromptRequest(transcript, uiContext),
      resume: daemonId,
      sandbox: "read-only",
      ...execution,
    });
    let text = "";
    await consumeAnalyzerStream(
      handle.events,
      (event) => {
        assertAnalyzerModel(execution, event.model);
        for (const uiEvent of toUiEventsFromCodex(event)) {
          if (uiEvent.kind === "assistant_text") text += uiEvent.text;
        }
      },
      () => handle.kill(),
    );
    return parseAvoidancePrompt(text);
  }

  private async findTranscript(sessionId: string): Promise<string | null> {
    const indexed = this.transcriptIndex?.get(this.vendor, sessionId);
    if (indexed) return indexed;
    const direct = path.join(this.sessionsDir, `${sessionId}.jsonl`);
    try {
      await fs.promises.access(direct);
      this.transcriptIndex?.set(this.vendor, sessionId, direct);
      return direct;
    } catch {
      // Some CLIs store a session as <id>/events.jsonl instead.
    }
    const nested = path.join(this.sessionsDir, sessionId, "events.jsonl");
    try {
      await fs.promises.access(nested);
      this.transcriptIndex?.set(this.vendor, sessionId, nested);
      return nested;
    } catch {
      return null;
    }
  }

  private async readContext(file: string, sessionId: string, analysisFromAt: number | null = null) {
    if (this.contextReader) {
      return this.contextReader.readAnalyzerContext(file, this.vendor, sessionId, analysisFromAt);
    }
    return analyzerContextFromMessages(
      this.readTranscript(file, Number.POSITIVE_INFINITY),
      this.vendor,
      sessionId,
      analysisFromAt,
    );
  }
}
