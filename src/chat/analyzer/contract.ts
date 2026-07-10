import type { TranscriptMsg } from "../transcript.js";

/**
 * The brief/state/priority/eta contract shared by every vendor's daemon (DESIGN
 * invariant 4: vendor-neutral data). Kept in one place so the Claude and Codex
 * analyzers can't drift, and — since it is re-sent on every analyze turn — so an
 * already-running daemon is re-anchored each turn even though its one-time SEED
 * is fixed.
 */
export const RESPONSE_SHAPE = `{"brief":"<≤8 word title of what this session is about>",
 "state":"<continue_ready|needs_decision|needs_input|blocked|needs_review|followup_suggested|done>",
 "priority":<0-10 number, higher = more business-important in this workspace>,
 "etaMin":<estimated minutes to re-engage: re-read the last turn + reply>,
 "reason":"<one short observation>"}`;

export const REQUEST_RULES = `- "brief" is the best glance label for a crowded session list: short, specific, and enough to recognize which thread this is among many active sessions.
- Prefer the most durable subject / decision / outcome over a bare activity word.
- An activity can be the glance label when it is the clearest way to distinguish this thread right now; make it self-contained by including its object or purpose when the transcript provides one.
- If the latest activity is only a routine step within a broader remembered subject, keep the broader subject in "brief" and put the step in "reason".
- Do not let meta/debugging about the workflow become the brief when the underlying task is visible. Repo/path corrections, "where did you change it?", branch/commit/PR, test reruns, deployment checks, or verification status belong in "reason" unless locating the repo/path is the actual task.
- For bugfix or investigation sessions, include the product/component and failure/fix target when present (for example: feature name, failing test, file/module, regression name). A vague phrase like "change location", "testing", "PR", or "fix issue" is not a useful brief.
- Use the opening goal as historical context only. If later user turns introduce a different substantive task, update "brief" to that new memory anchor.
- "state" explains why control is back with the human after the latest assistant turn:
  - "continue_ready": a planned chunk finished and the next step is obvious; the assistant is merely asking whether to continue.
  - "needs_decision": the human must choose among options, accept a tradeoff, approve scope, or make a product/business call.
  - "needs_input": missing facts, files, credentials, environment details, or user preferences are required before work can continue.
  - "blocked": progress is stopped by a resource, permission, dependency, CI, external service, install, auth, or tooling problem.
  - "needs_review": the work/result/deployment is ready and waiting for human verification, QA, approval, or acceptance.
  - "followup_suggested": the original task is complete, but the assistant found optional extra work or observations.
  - "done": the current task is complete and no human action is requested.
- "priority" is workspace-level business importance, separate from "state": production/user-facing issues, deployment validation, data loss, broken builds, deadlines, or blocked collaborators should score higher; routine cleanup or optional follow-ups should score lower.
- "reason" must be a neutral observation, never second-person pressure or a verdict.`;

/** The per-turn analyze prompt. Identical across vendors. */
export function requestPrompt(transcript: string): string {
  return `The session advanced. Analyze using these current rules even if earlier daemon instructions differ:
${REQUEST_RULES}

Session context:

${transcript || "(no text yet)"}

Reply with this JSON object only:
${RESPONSE_SHAPE}`;
}

export function avoidancePromptRequest(transcript: string): string {
  return `This session has been flagged by local telemetry as repeatedly reopened without progress.
Generate one editable USER message that lowers the friction to resume this exact session.

Rules:
- Output one JSON object only: {"avoidancePrompt":"<draft user message>"}
- Use the session's dominant language.
- Do not classify causes.
- Do not repeat generic advice.
- The message should ask the assistant to shrink manual steps, expose missing context, recommend a default decision with risks, reduce review burden, or name the smallest next action, depending on this transcript.
- Keep it under 40 words.
- Use an empty string only if no useful friction-lowering prompt can be inferred.

Session context:

${transcript || "(no text yet)"}`;
}

/** Last `n` chars of a string, marked with a leading ellipsis when truncated. */
function tailSlice(text: string, n: number): string {
  return text.length <= n ? text : `…${text.slice(-n)}`;
}

/**
 * Compact a session transcript for the daemon — optimized for BOTH the glance-
 * label contract and low token cost.
 *
 * A pivot to a new memory anchor is *always* introduced by a user turn (assistant
 * narration never starts a new task), and user turns are short and few. So we anchor
 * the window on the user turns instead of the previous "opening + last 10 mixed
 * messages" — that window silently dropped a mid-session pivot whenever later
 * assistant text pushed it out, which is exactly why a session that had moved on to
 * another task kept its original brief.
 *
 * But a user turn can be a bare answer to the assistant's question ("B", "用第二个"),
 * meaningless on its own. So for each kept user turn we also pull the assistant turn
 * right before it — the question it answers — truncated hard and tail-sliced, since a
 * multiple-choice prompt sits at the end of the message. Assistant filler is still
 * dropped, so this stays cheaper than the old fixed 10-message window.
 */
export function condenseTranscript(msgs: TranscriptMsg[]): string {
  const cleaned = msgs
    .map((m, i) => ({ i, role: m.role === "user" ? "User" : "Assistant", text: m.text.trim() }))
    .filter((m) => m.text);
  const pos = new Map(cleaned.map((m, idx) => [m.i, idx]));
  const users = cleaned.filter((m) => m.role === "User");
  const openingIdx = users[0]?.i;
  const latestIdx = users.at(-1)?.i;
  const openingUser = users[0]?.text.slice(0, 400) ?? "";
  const latestUser = users.at(-1)?.text.slice(0, 400) ?? "";
  // Keep recent user turns (anchor candidates) + the assistant question preceding each
  // (so short choice-replies stay legible) + a couple of trailing messages for context.
  const keep = new Set<number>();
  for (const u of users.slice(-8)) {
    keep.add(u.i);
    const prev = cleaned[(pos.get(u.i) ?? 0) - 1];
    if (prev?.role === "Assistant") keep.add(prev.i);
  }
  for (const m of cleaned.slice(-3)) keep.add(m.i);
  // The opening/latest user turns already appear as labeled lines below.
  if (openingIdx !== undefined) keep.delete(openingIdx);
  if (latestIdx !== undefined) keep.delete(latestIdx);
  const picked = [...keep]
    .sort((a, b) => a - b)
    .map((i) => cleaned[pos.get(i) ?? -1])
    .filter((m): m is (typeof cleaned)[number] => m !== undefined)
    // Assistant context is truncated harder and tail-sliced (questions sit at the end);
    // user turns are the signal, so they get more room.
    .map((m) =>
      m.role === "Assistant"
        ? `Assistant: ${tailSlice(m.text, 220)}`
        : `User: ${m.text.slice(0, 300)}`,
    );
  const lines = [
    latestUser ? `Current/latest user request: ${latestUser}` : "",
    openingUser && openingUser !== latestUser
      ? `Initial user goal (historical context only): ${openingUser}`
      : "",
    "Recent transcript (user turns are the memory-anchor candidates):",
    ...picked,
  ].filter(Boolean);
  return lines.join("\n").slice(0, 5000);
}
