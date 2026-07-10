import fs from "node:fs";
import path from "node:path";
import type { Analysis } from "../../core/daemon/cache.js";
import { parseAnalysis, parseAvoidancePrompt } from "../../core/daemon/parse.js";
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
import type { SessionAnalyzer } from "./index.js";

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
  ) {}

  async spawn(cwd: string): Promise<string | null> {
    if (!this.execFn) return null;
    const handle = this.execFn({ cwd, prompt: SEED });
    let sessionId: string | null = null;
    for await (const ev of handle.events) {
      for (const u of toUiEventsFromCodex(ev)) {
        if (u.kind === "session" && u.sessionId) sessionId = u.sessionId;
      }
    }
    return sessionId;
  }

  async analyze(daemonId: string, cwd: string, taskId: string): Promise<Analysis | null> {
    if (!this.execFn) return null;
    const file = this.findRollout(this.codexSessions, taskId);
    // Same rationale as ClaudeAnalyzer: keep the real opening goal available to
    // the condense step so long sessions don't collapse to their final PR/admin step.
    const transcript = file
      ? condenseTranscript(readCodexTranscript(file, Number.POSITIVE_INFINITY))
      : "";
    const handle = this.execFn({
      cwd,
      prompt: requestPrompt(transcript),
      resume: daemonId,
    });
    let text = "";
    for await (const ev of handle.events) {
      for (const u of toUiEventsFromCodex(ev)) if (u.kind === "assistant_text") text += u.text;
    }
    return parseAnalysis(text);
  }

  async avoidancePrompt(daemonId: string, cwd: string, taskId: string): Promise<string | null> {
    if (!this.execFn) return null;
    const file = this.findRollout(this.codexSessions, taskId);
    const transcript = file
      ? condenseTranscript(readCodexTranscript(file, Number.POSITIVE_INFINITY))
      : "";
    const handle = this.execFn({
      cwd,
      prompt: avoidancePromptRequest(transcript),
      resume: daemonId,
    });
    let text = "";
    for await (const ev of handle.events) {
      for (const u of toUiEventsFromCodex(ev)) if (u.kind === "assistant_text") text += u.text;
    }
    return parseAvoidancePrompt(text);
  }

  /** Locate a session's rollout file (`rollout-*-<id>.jsonl`) under the sessions dir. */
  private findRollout(dir: string, sessionId: string): string | null {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const hit = this.findRollout(full, sessionId);
        if (hit) return hit;
      } else if (e.isFile() && e.name.endsWith(".jsonl") && e.name.includes(sessionId)) {
        return full;
      }
    }
    return null;
  }
}
