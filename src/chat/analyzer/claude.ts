import fs from "node:fs";
import path from "node:path";
import { type Options, query } from "@anthropic-ai/claude-agent-sdk";
import type { Analysis } from "../../core/daemon/cache.js";
import { parseAnalysis } from "../../core/daemon/parse.js";
import type { QueryFn } from "../engine.js";
import { toUiEvents } from "../events.js";
import { readClaudeTranscript } from "../transcript.js";
import type { SessionAnalyzer } from "./index.js";

/** The Claude daemon's standing contract — sent once at spawn, then it resumes. */
const SEED = `You are the *attend daemon* for a single coding session. Your only job: each
time I send you the session's latest transcript, observe it and reply with ONE JSON object and
nothing else (no prose, no code fence):

{"brief":"<≤8 word title of what this session is about>",
 "priority":<0-10 number, higher = more deserving of attention now>,
 "etaMin":<estimated minutes to re-engage: re-read the last turn + reply>,
 "reason":"<one short observation>"}

Rules:
- LANGUAGE: write "brief" and "reason" in the session's dominant language — the language the
  human predominantly uses in this transcript, NOT the language of these instructions. If the
  transcript is mostly Chinese, write them in Chinese; if mostly English, in English; and so on.
  Match the session.
- "reason" must be a neutral observation, never second-person pressure or a verdict
  (describe what you see, e.g. "many questions, no edits yet" — not "you are procrastinating").
You may read files in this workspace and its memory for context, but never write or run anything.
This first message has no transcript yet — reply with brief "new session" and priority/etaMin 0.`;

function requestPrompt(transcript: string): string {
  return `The session advanced. Latest transcript:\n\n${transcript || "(no text yet)"}\n\nReply with the JSON object only.`;
}

/**
 * Claude session analyzer: drives a real Claude session (Agent SDK, cheap model,
 * read-only tools) as the daemon, and parses its JSON verdict. `query` is
 * injectable so tests never hit the network.
 */
export class ClaudeAnalyzer implements SessionAnalyzer {
  readonly vendor = "claude";

  constructor(
    private readonly claudeProjects: string,
    private readonly queryFn: QueryFn = query,
    private readonly model = "haiku",
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
    const transcript = file ? condense(readClaudeTranscript(file)) : "";
    let text = "";
    const options: Options = { ...this.options(cwd), resume: daemonId };
    for await (const msg of this.queryFn({ prompt: requestPrompt(transcript), options })) {
      for (const ev of toUiEvents(msg)) if (ev.kind === "assistant_text") text += ev.text;
    }
    return parseAnalysis(text);
  }

  private options(cwd: string): Options {
    return {
      cwd: cwd && fs.existsSync(cwd) ? cwd : process.cwd(),
      model: this.model,
      // read-only: the daemon observes, it never mutates the workspace
      allowedTools: ["Read", "Grep", "Glob"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 8,
    } as Options;
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

/** Compact the transcript for the daemon: role-tagged, first 2 + last 8 turns. */
function condense(msgs: Array<{ role: string; text: string }>): string {
  const parts = msgs
    .filter((m) => m.text.trim())
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text.trim().slice(0, 500)}`);
  const kept = parts.length > 10 ? [...parts.slice(0, 2), "…", ...parts.slice(-8)] : parts;
  return kept.join("\n").slice(0, 6000);
}
