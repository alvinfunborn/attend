import fs from "node:fs";
import path from "node:path";
import type { Analysis } from "../../core/daemon/cache.js";
import { parseAnalysis } from "../../core/daemon/parse.js";
import { toUiEventsFromCodex } from "../codex/events.js";
import type { CodexExecFn } from "../codex/exec.js";
import { readCodexTranscript } from "../codex/transcript.js";
import type { TranscriptMsg } from "../transcript.js";
import type { SessionAnalyzer } from "./index.js";

/** The Codex daemon's standing contract — sent once at spawn, then it resumes.
 *  Same vendor-neutral verdict shape as the Claude daemon (DESIGN invariant 4). */
const SEED = `You are the *attend daemon* for a single coding session. Your only job: each
time I send you the session's latest transcript, observe it and reply with ONE JSON object and
nothing else (no prose, no code fence):

{"brief":"<≤8 word title of what this session is about>",
 "priority":<0-10 number, higher = more deserving of attention now>,
 "etaMin":<estimated minutes to re-engage: re-read the last turn + reply>,
 "reason":"<one short observation>"}

Rules:
- LANGUAGE: write "brief" and "reason" in the session's dominant language — the language the
  human predominantly uses in this transcript, NOT the language of these instructions. Match it.
- "brief" must name the stable MAIN work of the whole session — the thing the
  human would use to remember or reopen it tomorrow. Keep it anchored to the
  opening goal unless the session clearly pivoted to a different main task.
- Branching / commit / push / PR creation / review-reply / deploy are delivery
  steps, not the main work. If the latest activity is "create PR", keep the
  underlying bug / feature / investigation in "brief" and put the admin step in
  "reason".
- Put the latest narrow patch / subtask / detour in "reason", not in "brief".
- "reason" must be a neutral observation, never second-person pressure or a verdict
  (describe what you see, e.g. "many questions, no edits yet" — not "you are procrastinating").
You run read-only: never write or run anything. This first message has no transcript yet — reply
with brief "new session" and priority/etaMin 0.`;

function requestPrompt(transcript: string): string {
  return `The session advanced. Session context:\n\n${transcript || "(no text yet)"}\n\nReply with the JSON object only.`;
}

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
    const transcript = file ? condense(readCodexTranscript(file, Number.POSITIVE_INFINITY)) : "";
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

/** Compact the transcript for the daemon while preserving the opening goal plus
 *  recent activity, so the brief stays on the main task instead of collapsing
 *  to the latest patch-sized subtask. */
function condense(msgs: TranscriptMsg[]): string {
  const cleaned = msgs
    .filter((m) => m.text.trim())
    .map((m) => ({
      role: m.role === "user" ? "User" : "Assistant",
      text: m.text.trim().slice(0, 500),
    }));
  const openingUser = cleaned.find((m) => m.role === "User")?.text ?? "";
  const latestUser = [...cleaned].reverse().find((m) => m.role === "User")?.text ?? "";
  const recent =
    cleaned.length > 10
      ? [...cleaned.slice(0, 2), { role: "…", text: "" }, ...cleaned.slice(-8)]
      : cleaned;
  const lines = [
    openingUser ? `Opening user goal: ${openingUser}` : "",
    latestUser && latestUser !== openingUser ? `Latest user request: ${latestUser}` : "",
    "Transcript excerpts:",
    ...recent.map((m) => (m.role === "…" ? "…" : `${m.role}: ${m.text}`)),
  ].filter(Boolean);
  return lines.join("\n").slice(0, 6000);
}
