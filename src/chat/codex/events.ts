import type { UiEvent } from "../events.js";

/**
 * The `codex exec --json` event stream (codex-cli 0.133). One JSON object per
 * line; the shapes below were captured from a real run (never fabricated —
 * DESIGN invariant 3):
 *
 *   {"type":"thread.started","thread_id":"<uuid>"}
 *   {"type":"turn.started"}
 *   {"type":"item.started","item":{"id":"item_1","type":"command_execution",
 *      "command":"/bin/zsh -lc 'echo hi'","aggregated_output":"","exit_code":null,"status":"in_progress"}}
 *   {"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"pong"}}
 *   {"type":"item.completed","item":{"id":"item_1","type":"command_execution",
 *      "command":"…","aggregated_output":"hi\n","exit_code":0,"status":"completed"}}
 *   {"type":"turn.completed","usage":{...}}
 *
 * We map only the items we can render unambiguously and ignore the rest (e.g.
 * reasoning), keeping the browser protocol (`UiEvent`) small and stable.
 */
export interface CodexItem {
  id?: string;
  type?: string;
  text?: string;
  command?: string;
  aggregated_output?: string;
  exit_code?: number | null;
  status?: string;
  /** mcp_tool_call */
  name?: string;
  arguments?: unknown;
  call_id?: string;
  input?: unknown;
  output?: unknown;
  cwd?: string;
  content?: unknown;
  role?: string;
}

export interface CodexEvent {
  type?: string;
  thread_id?: string;
  item?: CodexItem;
  payload?: CodexItem;
  error?: { message?: string } | string;
}

function errMessage(error: CodexEvent["error"]): string {
  if (!error) return "codex turn failed";
  return typeof error === "string" ? error : (error.message ?? "codex turn failed");
}

function textOf(content: unknown, kind: string): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b && typeof b === "object" && (b as { type?: string }).type === kind)
    .map((b) => (b as { text?: string }).text ?? "")
    .join("");
}

function outputText(output: unknown): string {
  if (typeof output === "string") return output;
  return JSON.stringify(output ?? "");
}

function parseToolInput(input: unknown): unknown {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

/**
 * Normalize one Codex exec event into zero or more `UiEvent`s — the same protocol
 * the Claude engine emits, so the console renders both vendors identically. A
 * terminal event (`turn.completed` → result ok; `turn.failed`/`error` → result
 * not-ok) is what the engine keys turn-end on, so we emit exactly one per turn.
 */
export function toUiEventsFromCodex(ev: CodexEvent): UiEvent[] {
  const out: UiEvent[] = [];
  switch (ev.type) {
    case "session_meta":
      if (ev.payload?.id) out.push({ kind: "session", sessionId: ev.payload.id });
      break;

    case "response_item": {
      const p = ev.payload;
      if (!p) break;
      if (p.type === "message" && p.role === "assistant") {
        const text = textOf(p.content, "output_text").trim();
        if (text) out.push({ kind: "assistant_text", text });
      } else if (
        p.type === "function_call" ||
        p.type === "custom_tool_call" ||
        p.type === "local_shell_call"
      ) {
        out.push({
          kind: "tool_use",
          id: p.call_id ?? p.id ?? null,
          name: p.name ?? p.type ?? "tool",
          input: parseToolInput(p.arguments ?? p.input),
        });
      } else if (
        (p.type === "function_call_output" || p.type === "custom_tool_call_output") &&
        p.call_id
      ) {
        out.push({
          kind: "tool_result",
          id: p.call_id,
          text: outputText(p.output),
          isError: false,
        });
      }
      break;
    }

    case "event_msg":
      if (ev.payload?.type === "task_complete") out.push({ kind: "result", ok: true });
      break;

    case "thread.started":
      if (ev.thread_id) out.push({ kind: "session", sessionId: ev.thread_id });
      break;

    case "item.started":
    case "item.completed": {
      const it = ev.item;
      if (!it) break;
      const done = ev.type === "item.completed";
      if (it.type === "agent_message") {
        // text is only final on completion; the started variant carries none.
        if (done && it.text) out.push({ kind: "assistant_text", text: it.text });
      } else if (it.type === "command_execution") {
        if (done) {
          out.push({
            kind: "tool_result",
            id: it.id ?? null,
            text: it.aggregated_output ?? "",
            isError: (it.exit_code ?? 0) !== 0,
          });
        } else {
          out.push({
            kind: "tool_use",
            id: it.id ?? null,
            name: "shell",
            input: { command: it.command },
          });
        }
      } else if (it.type === "mcp_tool_call") {
        if (done) {
          out.push({
            kind: "tool_result",
            id: it.id ?? null,
            text: it.aggregated_output ?? "",
            isError: false,
          });
        } else {
          out.push({
            kind: "tool_use",
            id: it.id ?? null,
            name: it.name ?? "mcp",
            input: it.arguments,
          });
        }
      } else if (it.type === "file_change" && done) {
        out.push({ kind: "tool_use", id: it.id ?? null, name: "edit", input: it });
      }
      break;
    }

    case "turn.completed":
      out.push({ kind: "result", ok: true });
      break;

    case "turn.failed":
    case "error":
      out.push({ kind: "result", ok: false, text: errMessage(ev.error) });
      break;
  }
  return out;
}
