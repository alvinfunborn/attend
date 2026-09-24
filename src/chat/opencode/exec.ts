import type { CodexEvent } from "../codex/events.js";
import { makeJsonlExec } from "../process/jsonl-exec.js";
import type { ProcessTurnFn, ProcessTurnRequest } from "../process/types.js";
import type { OpencodeTranscriptEvent } from "./transcript.js";

export interface OpencodeState {
  sessionId: string | null;
  /** Whether the first turn already announced the minted session id. */
  announced: boolean;
}

function outputText(output: unknown): string {
  if (output === undefined || output === null) return "";
  return typeof output === "string" ? output : JSON.stringify(output);
}

export function buildOpencodeArgs(request: ProcessTurnRequest, prompt = request.prompt): string[] {
  const args = ["run", "--format", "json"];
  if (request.resume) args.push("--session", request.resume);
  if (request.model) args.push("--model", request.model);
  if (request.effort) args.push("--variant", request.effort);
  // The analyzer daemon runs read-only and must not auto-approve side effects.
  if (request.sandbox !== "read-only") args.push("--auto");
  args.push(prompt);
  return args;
}

export function opencodeToProcessEvent(
  event: OpencodeTranscriptEvent,
  state: OpencodeState = { sessionId: event.sessionID ?? null, announced: true },
): CodexEvent[] {
  const out: CodexEvent[] = [];
  // OpenCode mints the session id itself and stamps it on every event. The
  // shared JSONL runner only announces a resumed id up front, so a brand-new
  // session must announce it here — otherwise the driver never learns the id
  // and `start()` fails with "opencode produced no session".
  if (!state.announced && event.sessionID) {
    state.announced = true;
    state.sessionId = event.sessionID;
    out.push({ type: "thread.started", thread_id: event.sessionID });
  }
  if (event.type === "text" && event.part?.type === "text" && event.part.text) {
    out.push({ type: "item.completed", item: { type: "agent_message", text: event.part.text } });
  } else if (event.type === "tool_use" && event.part?.type === "tool") {
    const part = event.part;
    const id = part.callID ?? part.id ?? undefined;
    const name = part.tool ?? "tool";
    out.push(
      {
        type: "item.started",
        item: { id, type: "mcp_tool_call", name, arguments: part.state?.input },
      },
      {
        type: "item.completed",
        item: {
          id,
          type: "mcp_tool_call",
          name,
          aggregated_output: outputText(part.state?.output ?? part.state?.metadata?.output),
        },
      },
    );
  } else if (event.type === "step_finish") {
    // `opencode run` signals the end of a turn with a final step-finish whose
    // reason is "stop"; intermediate steps report "tool-calls". The process can
    // outlive its terminal event, so this is what actually ends the turn.
    if (event.part?.reason === "stop") out.push({ type: "turn.completed" });
  } else if (event.type === "error") {
    const error = event.error;
    const message =
      typeof error === "string"
        ? error
        : (error?.data?.message ?? error?.name ?? "opencode turn failed");
    out.push({ type: "turn.failed", error: message });
  }
  return out;
}

function sessionIdFromStderr(stderr: string): string | null {
  return stderr.match(/\bses_[A-Za-z0-9]+/)?.[0] ?? null;
}

export function makeOpencodeExec(bin: string, sessionsDir: string): ProcessTurnFn<CodexEvent> {
  return makeJsonlExec<OpencodeTranscriptEvent, OpencodeState>({
    vendor: "opencode",
    bin,
    sessionsDir,
    createState: (request) => ({
      sessionId: request.resume ?? null,
      announced: !!request.resume,
    }),
    buildArgs: (request, prompt) => buildOpencodeArgs(request, prompt),
    initialSessionId: (request) => request.resume ?? null,
    sessionId: (event, state) => event.sessionID ?? state.sessionId,
    sessionIdFromStderr: (stderr, state) => state.sessionId ?? sessionIdFromStderr(stderr),
    normalize: opencodeToProcessEvent,
    // OpenCode resolves the project from $PWD, not the spawned cwd. Attend may
    // run from a different directory, so align $PWD with the session directory
    // or opencode can attach to the wrong project and never emit a turn.
    env: (request, base) => ({ ...base, PWD: request.cwd }),
  });
}
