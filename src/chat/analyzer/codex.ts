import fs from "node:fs";
import path from "node:path";
import {
  MAX_PENDING_TURNS_PER_ANALYSIS,
  projectCollaborationTurns,
} from "../../core/collaboration.js";
import {
  parseAnalysis,
  parseAvoidancePrompt,
  parseCollaborationLabels,
} from "../../core/daemon/parse.js";
import type { TranscriptPathWriter } from "../../core/vendor/transcript-index.js";
import { toUiEventsFromCodex } from "../codex/events.js";
import type { CodexExecFn } from "../codex/exec.js";
import { readCodexTranscript } from "../codex/transcript.js";
import {
  REQUEST_RULES,
  RESPONSE_SHAPE,
  avoidancePromptRequest,
  condenseTranscript,
  requestPrompt,
} from "./contract.js";
import type { AnalyzerVerdict, SessionAnalyzer } from "./index.js";
import { consumeAnalyzerStream } from "./timeout.js";

/** The Codex daemon's standing contract — sent once at spawn, then it resumes.
 *  Same vendor-neutral verdict shape as the Claude daemon (DESIGN invariant 4). */
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

/**
 * Codex session analyzer: drives a Codex session (`codex exec`, the same vendor
 * seam the chat engine uses) as the daemon, and parses its JSON verdict. It
 * deliberately avoids pinning model/effort/sandbox so the daemon follows the
 * same Codex defaults as a normal session instead of a separate analyzer
 * profile. The exec fn is injectable so tests never spawn; a null exec (Codex
 * not installed) degrades to no daemon — the session keeps the heuristic
 * fallback, never fake data (DESIGN invariant 3).
 */
export class CodexAnalyzer implements SessionAnalyzer {
  readonly vendor = "codex";

  constructor(
    private readonly codexSessions: string,
    private readonly execFn: CodexExecFn | null,
    private readonly transcriptIndex?: TranscriptPathWriter,
  ) {}

  async spawn(cwd: string): Promise<string | null> {
    if (!this.execFn) return null;
    const handle = this.execFn({ cwd, prompt: SEED, sandbox: "read-only" });
    let sessionId: string | null = null;
    await consumeAnalyzerStream(
      handle.events,
      (ev) => {
        for (const u of toUiEventsFromCodex(ev)) {
          if (u.kind === "session" && u.sessionId) sessionId = u.sessionId;
        }
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
  ): Promise<AnalyzerVerdict | null> {
    if (!this.execFn) return null;
    const file = this.findRollout(taskId);
    // Same rationale as ClaudeAnalyzer: keep the real opening goal available to
    // the condense step so long sessions don't collapse to their final PR/admin step.
    const messages = file ? readCodexTranscript(file, Number.POSITIVE_INFINITY) : [];
    const transcript = condenseTranscript(messages);
    const observedTurns = projectCollaborationTurns("codex", taskId, messages, analysisFromAt);
    const pendingTurns = observedTurns
      .filter((turn) => !knownTurnIds.has(turn.turnId))
      .slice(0, MAX_PENDING_TURNS_PER_ANALYSIS);
    const handle = this.execFn({
      cwd,
      prompt: requestPrompt(transcript, pendingTurns, uiContext),
      resume: daemonId,
      sandbox: "read-only",
    });
    let text = "";
    await consumeAnalyzerStream(
      handle.events,
      (ev) => {
        for (const u of toUiEventsFromCodex(ev)) if (u.kind === "assistant_text") text += u.text;
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
  ): Promise<string | null> {
    if (!this.execFn) return null;
    const file = this.findRollout(taskId);
    const transcript = file
      ? condenseTranscript(readCodexTranscript(file, Number.POSITIVE_INFINITY))
      : "";
    const handle = this.execFn({
      cwd,
      prompt: avoidancePromptRequest(transcript, uiContext),
      resume: daemonId,
      sandbox: "read-only",
    });
    let text = "";
    await consumeAnalyzerStream(
      handle.events,
      (ev) => {
        for (const u of toUiEventsFromCodex(ev)) if (u.kind === "assistant_text") text += u.text;
      },
      () => handle.kill(),
    );
    return parseAvoidancePrompt(text);
  }

  /** Resolve from the scanner-owned index; recursively discover only on a cold miss. */
  private findRollout(sessionId: string): string | null {
    const indexed = this.transcriptIndex?.get(this.vendor, sessionId);
    if (indexed) return indexed;
    const discovered = this.findRolloutIn(this.codexSessions, sessionId);
    if (discovered) this.transcriptIndex?.set(this.vendor, sessionId, discovered);
    return discovered;
  }

  private findRolloutIn(dir: string, sessionId: string): string | null {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const hit = this.findRolloutIn(full, sessionId);
        if (hit) return hit;
      } else if (e.isFile() && e.name.endsWith(".jsonl") && e.name.includes(sessionId)) {
        return full;
      }
    }
    return null;
  }
}
