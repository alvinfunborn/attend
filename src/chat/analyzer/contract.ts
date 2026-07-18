import type { CollaborationTurnInput } from "../../core/collaboration.js";
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
 "reason":"<one short current observation explaining the state, priority, or immediate step>",
 "nextStep":"<the single most likely next USER message that moves this session forward, ready to send; empty only if none can be inferred>",
 "turns":[{"turnId":"<exact supplied turnId>",
   "intent":"<ask|learn|inspect_code|research|design|implement|debug|verify|operate|decide>",
   "researchSource":"<official|community|repository|other, only for research>",
   "steering":"<initiate|continue|accept|clarify|challenge|correct|redirect|reject_partial|reject_full|repeat_instruction>",
   "feedbackTarget":"<none|answer|plan|design|code_change|scope|verification|process>",
   "handoff":"<continue_ready|needs_decision|needs_input|blocked|needs_review|followup_suggested|done>",
   "confidence":<0-1>} ]}`;

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
- "reason" is volatile current context, not a second title: briefly explain the latest state/priority, evidence, or immediate routine step without repeating "brief".
- "reason" must be a neutral observation, never second-person pressure or a verdict.
- "nextStep" is your single best PREDICTION of the message the human will most likely send next to move this session forward, drafted so they can send it verbatim (or lightly edit) instead of typing. Write it in the session's dominant language, ≤30 words, imperative, ready to send with no placeholders.
- ALWAYS fill "nextStep" with the most probable next message, INCLUDING when a decision is pending — draft the most likely choice as an editable starting point (for "needs_decision"/"needs_input"/"blocked"/"needs_review", pick the option or answer the transcript makes most probable and phrase it as the human's reply). You are predicting the human's next move, not deciding for them: it is fill-not-send, so they confirm or edit before it is sent. Leave it an empty string only when no next message can reasonably be inferred (the task is finished, or there is no transcript yet).
- When the human's own notes/todos/shortcuts are supplied below, use them to make "nextStep" concrete (for example point at the next open todo), but never invent tasks that are not grounded in the transcript or that context.`;

/** The per-turn analyze prompt. Identical across vendors. */
export function requestPrompt(
  transcript: string,
  pendingTurns: CollaborationTurnInput[] = [],
  uiContext = "",
): string {
  const turnBatch = pendingTurns.map((turn) => ({
    turnId: turn.turnId,
    user: turn.userText.slice(0, 600),
    assistant: turn.assistantText.slice(-800),
    tools: {
      read: turn.readCalls,
      write: turn.writeCalls,
      shell: turn.shellCalls,
      search: turn.searchCalls,
      web: turn.webCalls,
      test: turn.testCalls,
      errors: turn.toolErrors,
    },
  }));
  return `The session advanced. Analyze using these current rules even if earlier daemon instructions differ:
${REQUEST_RULES}

Session context:

${transcript || "(no text yet)"}
${uiContext ? `\n${uiContext}\n` : ""}
Unclassified turns:
${turnBatch.length ? JSON.stringify(turnBatch) : "[]"}

For every supplied unclassified turn, return exactly one item in "turns" using its exact turnId.
"steering" describes how that user message responds to the preceding assistant result; use
"initiate" when it begins a task or no prior result is being evaluated. Keep all classifications
descriptive. If no turns were supplied, return an empty array.

Reply with this JSON object only:
${RESPONSE_SHAPE}`;
}

export function avoidancePromptRequest(transcript: string, uiContext = ""): string {
  return `This session has been flagged by local telemetry as repeatedly reopened without progress.
Generate one editable USER message that lowers the friction to resume this exact session.

Rules:
- Output one JSON object only: {"avoidancePrompt":"<draft user message>"}
- Use the session's dominant language.
- Do not classify causes.
- Do not repeat generic advice.
- The message should ask the assistant to shrink manual steps, expose missing context, recommend a default decision with risks, reduce review burden, or name the smallest next action, depending on this transcript.
- If the human's own notes/todos/shortcuts are supplied below, ground the message in them (for example the next open todo) instead of generic phrasing.
- Keep it under 40 words.
- Use an empty string only if no useful friction-lowering prompt can be inferred.

Session context:

${transcript || "(no text yet)"}
${uiContext ? `\n${uiContext}\n` : ""}`;
}

/** The human's own per-session notes/todos + global shortcuts, fed to the daemon
 *  so its drafted "nextStep"/avoidance message can point at the user's real work. */
export interface DaemonUiContext {
  shortcuts: string[];
  notes: string[];
  todos: { text: string; completed: boolean }[];
}

/**
 * Compact the human's notes/todos/shortcuts into a short prompt block. Returns ""
 * when there is nothing to add, so the prompt stays unchanged for sessions without
 * any of this context. Kept vendor-neutral (invariant 4) and bounded so it can be
 * re-sent every analyze turn cheaply.
 */
export function condenseUiContext(ctx: DaemonUiContext): string {
  const lines: string[] = [];
  const todos = ctx.todos.filter((t) => t.text.trim());
  if (todos.length) {
    lines.push("Todos (the human's own checklist for this session):");
    for (const t of todos.slice(0, 20))
      lines.push(`- [${t.completed ? "x" : " "}] ${t.text.trim().slice(0, 200)}`);
  }
  const notes = ctx.notes.map((n) => n.trim()).filter(Boolean);
  if (notes.length) {
    lines.push("Notes (the human's own notes for this session):");
    for (const n of notes.slice(0, 20)) lines.push(`- ${n.slice(0, 200)}`);
  }
  const shortcuts = ctx.shortcuts.map((s) => s.trim()).filter(Boolean);
  if (shortcuts.length) {
    lines.push("Shortcuts (reusable snippets the human keeps handy):");
    for (const s of shortcuts.slice(0, 20)) lines.push(`- ${s.slice(0, 200)}`);
  }
  if (!lines.length) return "";
  return `The human's private context for this session (use it to ground "nextStep"; it is NOT part of the transcript):\n${lines.join(
    "\n",
  )}`.slice(0, 1800);
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
