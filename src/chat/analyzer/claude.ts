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
import type { QueryFn } from "../claude/driver.js";
import { toUiEventsFromClaude } from "../claude/events.js";
import { readClaudeTranscript } from "../transcript.js";
import {
  REQUEST_RULES,
  RESPONSE_SHAPE,
  avoidancePromptRequest,
  condenseTranscript,
  requestPrompt,
} from "./contract.js";
import type { AnalyzerVerdict, SessionAnalyzer } from "./index.js";
import { consumeAnalyzerStream } from "./timeout.js";

/** The Claude daemon's standing contract — sent once at spawn, then it resumes. */
const SEED = `You are the *attend daemon* for a single coding session. Your only job: each
time I send you the session's latest transcript, observe it and reply with ONE JSON object and
nothing else (no prose, no code fence):

${RESPONSE_SHAPE}

Rules:
- LANGUAGE: write "brief" and "reason" in the session's dominant language — the language the
  human predominantly uses in this transcript, NOT the language of these instructions. If the
  transcript is mostly Chinese, write them in Chinese; if mostly English, in English; and so on.
  Match the session.
${REQUEST_RULES}
You may read files in this workspace and its memory for context, but never write or run anything.
This first message has no transcript yet — reply with brief "new session", state "done", and priority/etaMin 0.`;

/**
 * Claude session analyzer: drives a real Claude session (Agent SDK) as the
 * daemon, and parses its JSON verdict. It deliberately avoids pinning
 * model/effort/tool settings so the daemon follows the user's normal Claude
 * defaults instead of a separate analyzer profile. A system-CLI-bound query is
 * required so this adapter can never fall back to the SDK-bundled executable.
 */
export class ClaudeAnalyzer implements SessionAnalyzer {
  readonly vendor = "claude";

  constructor(
    private readonly claudeProjects: string,
    private readonly queryFn: QueryFn,
  ) {}

  async spawn(cwd: string): Promise<string | null> {
    let sessionId: string | null = null;
    const stream = this.queryFn({ prompt: SEED, options: this.options(cwd) });
    await consumeAnalyzerStream(
      stream,
      (msg) => {
        for (const ev of toUiEventsFromClaude(msg))
          if (ev.kind === "session" && ev.sessionId) sessionId = ev.sessionId;
      },
      () => stream.interrupt(),
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
    const file = this.findSessionFile(taskId);
    // The daemon needs the true session opening, not "the first message from the
    // last 200 rows"; otherwise long sessions collapse to a late subtask such as
    // "create PR". We read the full transcript, then condense it ourselves.
    const messages = file ? readClaudeTranscript(file, Number.POSITIVE_INFINITY) : [];
    const transcript = condenseTranscript(messages);
    const observedTurns = projectCollaborationTurns("claude", taskId, messages, analysisFromAt);
    const pendingTurns = observedTurns
      .filter((turn) => !knownTurnIds.has(turn.turnId))
      .slice(0, MAX_PENDING_TURNS_PER_ANALYSIS);
    let text = "";
    const options = { ...this.options(cwd), resume: daemonId };
    const stream = this.queryFn({
      prompt: requestPrompt(transcript, pendingTurns, uiContext),
      options,
    });
    await consumeAnalyzerStream(
      stream,
      (msg) => {
        for (const ev of toUiEventsFromClaude(msg))
          if (ev.kind === "assistant_text") text += ev.text;
      },
      () => stream.interrupt(),
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
    const file = this.findSessionFile(taskId);
    const transcript = file
      ? condenseTranscript(readClaudeTranscript(file, Number.POSITIVE_INFINITY))
      : "";
    let text = "";
    const options = { ...this.options(cwd), resume: daemonId };
    const stream = this.queryFn({ prompt: avoidancePromptRequest(transcript, uiContext), options });
    await consumeAnalyzerStream(
      stream,
      (msg) => {
        for (const ev of toUiEventsFromClaude(msg))
          if (ev.kind === "assistant_text") text += ev.text;
      },
      () => stream.interrupt(),
    );
    return parseAvoidancePrompt(text);
  }

  private options(cwd: string): { cwd: string } {
    return { cwd: cwd && fs.existsSync(cwd) ? cwd : process.cwd() };
  }

  /** Locate a task session's JSONL by id (its cwd-encoded project dir is opaque). */
  private findSessionFile(sessionId: string): string | null {
    let dirs: fs.Dirent[];
    try {
      dirs = fs.readdirSync(this.claudeProjects, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const f = path.join(this.claudeProjects, d.name, `${sessionId}.jsonl`);
      if (fs.existsSync(f)) return f;
    }
    return null;
  }
}
