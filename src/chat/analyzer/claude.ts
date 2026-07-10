import fs from "node:fs";
import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Analysis } from "../../core/daemon/cache.js";
import { parseAnalysis, parseAvoidancePrompt } from "../../core/daemon/parse.js";
import type { QueryFn } from "../engine.js";
import { toUiEvents } from "../events.js";
import { readClaudeTranscript } from "../transcript.js";
import {
  REQUEST_RULES,
  RESPONSE_SHAPE,
  avoidancePromptRequest,
  condenseTranscript,
  requestPrompt,
} from "./contract.js";
import type { SessionAnalyzer } from "./index.js";

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
 * defaults instead of a separate analyzer profile. `query` is injectable so
 * tests never hit the network.
 */
export class ClaudeAnalyzer implements SessionAnalyzer {
  readonly vendor = "claude";

  constructor(
    private readonly claudeProjects: string,
    private readonly queryFn: QueryFn = query,
  ) {}

  async spawn(cwd: string): Promise<string | null> {
    let sessionId: string | null = null;
    for await (const msg of this.queryFn({ prompt: SEED, options: this.options(cwd) })) {
      for (const ev of toUiEvents(msg))
        if (ev.kind === "session" && ev.sessionId) sessionId = ev.sessionId;
    }
    return sessionId;
  }

  async analyze(daemonId: string, cwd: string, taskId: string): Promise<Analysis | null> {
    const file = this.findSessionFile(taskId);
    // The daemon needs the true session opening, not "the first message from the
    // last 200 rows"; otherwise long sessions collapse to a late subtask such as
    // "create PR". We read the full transcript, then condense it ourselves.
    const transcript = file
      ? condenseTranscript(readClaudeTranscript(file, Number.POSITIVE_INFINITY))
      : "";
    let text = "";
    const options = { ...this.options(cwd), resume: daemonId };
    for await (const msg of this.queryFn({ prompt: requestPrompt(transcript), options })) {
      for (const ev of toUiEvents(msg)) if (ev.kind === "assistant_text") text += ev.text;
    }
    return parseAnalysis(text);
  }

  async avoidancePrompt(daemonId: string, cwd: string, taskId: string): Promise<string | null> {
    const file = this.findSessionFile(taskId);
    const transcript = file
      ? condenseTranscript(readClaudeTranscript(file, Number.POSITIVE_INFINITY))
      : "";
    let text = "";
    const options = { ...this.options(cwd), resume: daemonId };
    for await (const msg of this.queryFn({ prompt: avoidancePromptRequest(transcript), options })) {
      for (const ev of toUiEvents(msg)) if (ev.kind === "assistant_text") text += ev.text;
    }
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
