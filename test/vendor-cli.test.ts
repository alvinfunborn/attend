import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { ProcessAnalyzer } from "../src/chat/analyzer/process.js";
import { antigravityToProcessEvent, buildAntigravityArgs } from "../src/chat/antigravity/exec.js";
import { parseAntigravityTranscript } from "../src/chat/antigravity/transcript.js";
import type { CodexEvent } from "../src/chat/codex/events.js";
import { buildCopilotArgs, copilotToProcessEvent } from "../src/chat/copilot/exec.js";
import { parseCopilotTranscript } from "../src/chat/copilot/transcript.js";
import { readCursorTranscript } from "../src/chat/cursor/transcript.js";
import { buildOpencodeArgs, opencodeToProcessEvent } from "../src/chat/opencode/exec.js";
import { parseOpencodeTranscript } from "../src/chat/opencode/transcript.js";
import {
  classifyAntigravityError,
  classifyCopilotError,
  classifyOpencodeError,
} from "../src/chat/process/errors.js";
import { makeJsonlExec } from "../src/chat/process/jsonl-exec.js";
import type { ProcessTurnFn } from "../src/chat/process/types.js";
import { AntigravitySource } from "../src/core/vendor/antigravity.js";
import { capabilityUnavailable, vendorCapabilities } from "../src/core/vendor/capabilities.js";
import { CopilotSource } from "../src/core/vendor/copilot.js";
import { OpencodeSource } from "../src/core/vendor/opencode.js";
import {
  parseCopilotHelpModels,
  parseOpencodeModels,
  parseProcessCliModels,
} from "../src/core/vendor/process-cli-models.js";
import { TranscriptPathIndex } from "../src/core/vendor/transcript-index.js";

describe("Antigravity CLI integration", () => {
  it("builds headless stream-json, resume, model, and sandbox arguments", () => {
    expect(
      buildAntigravityArgs({
        cwd: "/work/repo",
        prompt: "inspect",
        resume: "antigravity-session",
        model: "gemini-2.5-pro",
        sandbox: "read-only",
      }),
    ).toEqual([
      "--output-format",
      "stream-json",
      "--conversation",
      "antigravity-session",
      "--model",
      "gemini-2.5-pro",
      "--mode",
      "plan",
      "--sandbox",
      "--print",
      "inspect",
    ]);
  });

  it("normalizes and renders Antigravity stream-json events", () => {
    const state = { assistantText: "" };
    expect(
      antigravityToProcessEvent(
        { type: "conversation_started", conversation_id: "a-1", model: "gemini-2.5-pro" },
        state,
      ),
    ).toEqual([{ type: "thread.started", thread_id: "a-1", model: "gemini-2.5-pro" }]);
    expect(
      antigravityToProcessEvent(
        { type: "message", role: "assistant", content: "done", delta: true },
        state,
      ),
    ).toEqual([{ type: "item.completed", item: { type: "agent_message", text: "done" } }]);
    expect(antigravityToProcessEvent({ type: "result", status: "success" }, state)).toEqual([]);

    const raw = [
      JSON.stringify({
        type: "message",
        role: "user",
        content: "Fix login",
        timestamp: "2026-07-26T00:00:00Z",
      }),
      JSON.stringify({
        type: "message",
        role: "assistant",
        content: "Inspecting ",
        delta: true,
        timestamp: "2026-07-26T00:00:01Z",
      }),
      JSON.stringify({
        type: "message",
        role: "assistant",
        content: "auth.",
        delta: true,
        timestamp: "2026-07-26T00:00:02Z",
      }),
    ].join("\n");
    expect(parseAntigravityTranscript(raw)).toMatchObject([
      { role: "user", text: "Fix login" },
      { role: "assistant", text: "Inspecting auth." },
    ]);
  });

  it("discovers native Antigravity brain transcripts and Attend captures", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-antigravity-"));
    const native = path.join(root, "native", "antigravity-native", ".system_generated", "logs");
    const captured = path.join(root, "captured");
    fs.mkdirSync(native, { recursive: true });
    fs.mkdirSync(captured, { recursive: true });
    fs.writeFileSync(
      path.join(native, "transcript.jsonl"),
      [
        JSON.stringify({ role: "user", content: "Native Antigravity task" }),
        JSON.stringify({ role: "assistant", content: "Done" }),
      ].join("\n"),
    );
    const capturedId = "12345678-1234-4234-8234-123456789abc";
    fs.writeFileSync(
      path.join(captured, `${capturedId}.jsonl`),
      [
        JSON.stringify({
          type: "attend.user",
          role: "user",
          content: "Captured task",
          _attend: { cwd: "/work/captured", timestamp: 1 },
        }),
        JSON.stringify({ type: "assistant.message", content: "Captured result" }),
      ].join("\n"),
    );
    try {
      const sessions = new AntigravitySource(path.join(root, "native"), captured).scan();
      expect(sessions.find((session) => session.sessionId === "antigravity-native")).toMatchObject({
        vendor: "antigravity",
        sessionId: "antigravity-native",
        title: "Native Antigravity task",
        prompts: 1,
      });
      expect(sessions.find((session) => session.sessionId === capturedId)).toMatchObject({
        vendor: "antigravity",
        cwd: "/work/captured",
        title: "Captured task",
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("process CLI capability degradation", () => {
  it("publishes native effort/catalog support and explicit non-native fallbacks", () => {
    expect(vendorCapabilities("antigravity")).toMatchObject({
      modelCatalog: { support: "native" },
      effort: { support: "native" },
      attachments: { support: "emulated" },
      fork: { support: "emulated" },
      goal: { support: "unsupported" },
      steer: { support: "unsupported" },
      speed: { support: "unsupported" },
    });
    expect(capabilityUnavailable("antigravity", "fork")).toMatchObject({
      code: "capability_unavailable",
      vendor: "antigravity",
      capability: "fork",
      fallback: expect.stringContaining("seeded with the parent transcript"),
    });
    expect(capabilityUnavailable("antigravity", "goal")).toMatchObject({
      code: "capability_unavailable",
      capability: "goal",
      fallback: null,
    });
    expect(capabilityUnavailable("antigravity", "steer")).toMatchObject({
      code: "capability_unavailable",
      capability: "steer",
      fallback: null,
    });
  });

  it("parses CLI model tables without inventing per-model efforts", () => {
    expect(
      parseProcessCliModels(
        "gemini-3-pro  Gemini 3 Pro\nclaude-sonnet-4-5 - Claude Sonnet 4.5 (default)",
        ["low", "medium", "high"],
      ),
    ).toEqual([
      {
        value: "gemini-3-pro",
        label: "Gemini 3 Pro",
      },
      {
        value: "claude-sonnet-4-5",
        label: "Claude Sonnet 4.5",
      },
    ]);
  });

  it("does not parse Copilot 1.0.75 commands and Help Topics as models", () => {
    const help = [
      "Options:",
      "  --model <model>                       Set the AI model to use (use 'auto' to",
      "                                        let Copilot pick automatically)",
      "  --mouse[=value]                       Enable mouse support",
      "Commands:",
      "  version                               Display version information",
      "Help Topics:",
      "  billing      AI credit usage",
      "  config       Configuration Settings",
      "  logging      Logging",
      "  permissions  Permissions",
    ].join("\n");

    expect(parseCopilotHelpModels(help)).toEqual([
      {
        value: "auto",
        label: "Auto",
      },
    ]);
  });

  it("accepts model identifiers only when Copilot advertises them in --model help", () => {
    expect(
      parseCopilotHelpModels(
        [
          "Options:",
          "  --model <model>  Model choice: auto, claude-sonnet-4.6, gpt-5.4",
          "  --mouse          Enable mouse support",
          "Help Topics:",
          "  billing         AI credit usage",
        ].join("\n"),
      ).map(({ value }) => value),
    ).toEqual(["auto", "claude-sonnet-4.6", "gpt-5.4"]);
  });
});

describe("GitHub Copilot CLI integration", () => {
  it("builds deterministic prompt-mode JSONL sessions and read-only daemon permissions", () => {
    expect(
      buildCopilotArgs(
        {
          cwd: "/work/repo",
          prompt: "analyze",
          model: "gpt-5.3-codex",
          effort: "high",
          sandbox: "read-only",
        },
        "12345678-1234-4234-8234-123456789abc",
      ),
    ).toEqual([
      "-p",
      "analyze",
      "--output-format=json",
      "--no-ask-user",
      "--session-id",
      "12345678-1234-4234-8234-123456789abc",
      "--model",
      "gpt-5.3-codex",
      "--reasoning-effort",
      "high",
      "--allow-tool=read",
      "--deny-tool=write,shell,url",
    ]);
  });

  it("normalizes SDK-style Copilot JSONL without duplicating final assistant text", () => {
    const state = {
      sessionId: "copilot-1",
      sawAssistantDelta: false,
    };
    expect(
      copilotToProcessEvent({ type: "assistant.message_delta", data: { content: "hello" } }, state),
    ).toEqual([{ type: "item.completed", item: { type: "agent_message", text: "hello" } }]);
    expect(
      copilotToProcessEvent({ type: "assistant.message", data: { content: "hello" } }, state),
    ).toEqual([]);
    expect(copilotToProcessEvent({ type: "session.idle", data: {} }, state)).toEqual([
      { type: "turn.completed" },
    ]);
  });

  it.each([
    {
      name: "an installer shim with stderr",
      script: "process.stderr.write('Cannot find GitHub Copilot CLI')",
      error: "Cannot find GitHub Copilot CLI",
    },
    {
      name: "an unrecognized JSON protocol",
      script: "console.log(JSON.stringify({type:'unknown.event'}))",
      error: "copilot produced no recognized response events",
    },
  ])("fails visibly when Copilot exits zero after $name", async ({ script, error }) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-copilot-empty-"));
    const exec = makeJsonlExec<{ type?: string }, Record<string, never>>({
      vendor: "copilot",
      bin: process.execPath,
      sessionsDir: root,
      createState: () => ({}),
      buildArgs: () => ["-e", script],
      initialSessionId: () => "12345678-1234-4234-8234-123456789abc",
      sessionId: () => null,
      normalize: () => [],
    });
    try {
      const events: CodexEvent[] = [];
      for await (const event of exec({
        cwd: root,
        prompt: "hello",
        sandbox: "danger-full-access",
      }).events) {
        events.push(event);
      }
      expect(events).toEqual([
        { type: "thread.started", thread_id: "12345678-1234-4234-8234-123456789abc" },
        { type: "turn.failed", error },
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("discovers Copilot session-state event logs", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-copilot-"));
    const sessionDir = path.join(root, "native", "copilot-1");
    fs.mkdirSync(sessionDir, { recursive: true });
    const raw = [
      JSON.stringify({
        type: "session.start",
        timestamp: "2026-07-26T00:00:00Z",
        data: { sessionId: "copilot-1", cwd: "/work/repo" },
      }),
      JSON.stringify({
        type: "user.message",
        timestamp: "2026-07-26T00:00:01Z",
        data: { content: "Review the API" },
      }),
      JSON.stringify({
        type: "assistant.message",
        timestamp: "2026-07-26T00:00:02Z",
        data: { content: "Reviewed." },
      }),
    ].join("\n");
    fs.writeFileSync(path.join(sessionDir, "events.jsonl"), raw);
    expect(parseCopilotTranscript(raw)).toMatchObject([
      { role: "user", text: "Review the API" },
      { role: "assistant", text: "Reviewed." },
    ]);
    try {
      expect(new CopilotSource(path.join(root, "native")).scan()).toMatchObject([
        {
          vendor: "copilot",
          sessionId: "copilot-1",
          cwd: "/work/repo",
          title: "Review the API",
        },
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("OpenCode CLI integration", () => {
  it("builds json run, resume, model, and read-only daemon arguments", () => {
    expect(
      buildOpencodeArgs({
        cwd: "/work/repo",
        prompt: "inspect",
        resume: "ses_abc",
        model: "deepseek/deepseek-v4-flash",
        effort: "high",
        sandbox: "read-only",
      }),
    ).toEqual([
      "run",
      "--format",
      "json",
      "--session",
      "ses_abc",
      "--model",
      "deepseek/deepseek-v4-flash",
      "--variant",
      "high",
      "inspect",
    ]);
    expect(
      buildOpencodeArgs({ cwd: "/work/repo", prompt: "go", sandbox: "danger-full-access" }),
    ).toEqual(["run", "--format", "json", "--auto", "go"]);
  });

  it("normalizes run JSON events into the shared process protocol", () => {
    const state = { sessionId: null, announced: false };
    expect(
      opencodeToProcessEvent(
        { type: "step_start", sessionID: "ses_a", part: { type: "step-start" } },
        state,
      ),
    ).toEqual([{ type: "thread.started", thread_id: "ses_a" }]);
    expect(
      opencodeToProcessEvent(
        { type: "text", sessionID: "ses_a", part: { type: "text", text: "done" } },
        state,
      ),
    ).toEqual([{ type: "item.completed", item: { type: "agent_message", text: "done" } }]);
    expect(
      opencodeToProcessEvent({
        type: "tool_use",
        part: {
          type: "tool",
          tool: "bash",
          callID: "call_1",
          state: { status: "completed", input: { command: "ls" }, output: "a\nb\n" },
        },
      }),
    ).toEqual([
      {
        type: "item.started",
        item: { id: "call_1", type: "mcp_tool_call", name: "bash", arguments: { command: "ls" } },
      },
      {
        type: "item.completed",
        item: { id: "call_1", type: "mcp_tool_call", name: "bash", aggregated_output: "a\nb\n" },
      },
    ]);
    expect(
      opencodeToProcessEvent({
        type: "error",
        error: { name: "UnknownError", data: { message: "no location" } },
      }),
    ).toEqual([{ type: "turn.failed", error: "no location" }]);
    expect(opencodeToProcessEvent({ type: "step_finish", part: { reason: "tool-calls" } })).toEqual(
      [],
    );
    expect(opencodeToProcessEvent({ type: "step_finish", part: { reason: "stop" } })).toEqual([
      { type: "turn.completed" },
    ]);
    expect(opencodeToProcessEvent({ type: "step_finish" })).toEqual([]);
  });

  it("aligns the child environment with the session directory", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-oc-env-"));
    const sessionDir = path.join(root, "session-dir");
    fs.mkdirSync(sessionDir, { recursive: true });
    const exec = makeJsonlExec<{ type?: string; pwd?: string }, Record<string, never>>({
      vendor: "opencode",
      bin: process.execPath,
      sessionsDir: root,
      createState: () => ({}),
      buildArgs: () => ["-e", "console.log(JSON.stringify({type:'pwd',pwd:process.env.PWD}))"],
      initialSessionId: () => "ses_env",
      sessionId: () => "ses_env",
      env: (request, base) => ({ ...base, PWD: request.cwd }),
      normalize: (event) =>
        event.type === "pwd"
          ? [{ type: "item.completed", item: { type: "agent_message", text: event.pwd ?? "" } }]
          : [],
    });
    try {
      const events: CodexEvent[] = [];
      for await (const event of exec({
        cwd: sessionDir,
        prompt: "hello",
        sandbox: "read-only",
      }).events) {
        events.push(event);
      }
      expect(events).toContainEqual({
        type: "item.completed",
        item: { type: "agent_message", text: sessionDir },
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("ends the turn when a provider prints a terminal event but never exits", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-oc-lingering-"));
    const exec = makeJsonlExec<{ type?: string }, Record<string, never>>({
      vendor: "opencode",
      bin: process.execPath,
      sessionsDir: root,
      createState: () => ({}),
      buildArgs: () => [
        "-e",
        "console.log(JSON.stringify({type:'text',text:'done'})); console.log(JSON.stringify({type:'done'})); setInterval(function(){}, 100000)",
      ],
      initialSessionId: () => "ses_lingering",
      sessionId: () => "ses_lingering",
      normalize: (event) =>
        event.type === "done"
          ? [{ type: "turn.completed" }]
          : event.type === "text"
            ? [{ type: "item.completed", item: { type: "agent_message", text: "done" } }]
            : [],
    });
    try {
      const events: CodexEvent[] = [];
      const consume = (async () => {
        for await (const event of exec({
          cwd: root,
          prompt: "hello",
          sandbox: "danger-full-access",
        }).events) {
          events.push(event);
        }
      })();
      const timeout = new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), 4000),
      );
      expect(await Promise.race([consume.then(() => "done" as const), timeout])).toBe("done");
      expect(events).toContainEqual({ type: "turn.completed" });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not re-announce an id on a resumed session", () => {
    const state = { sessionId: "ses_a", announced: true };
    expect(
      opencodeToProcessEvent(
        { type: "step_start", sessionID: "ses_a", part: { type: "step-start" } },
        state,
      ),
    ).toEqual([]);
  });

  it("reads per-model effort variants from `opencode models --verbose`", () => {
    const plain = parseOpencodeModels("opencode-go/deepseek-v4.1-flash\nopencode/big-pickle");
    expect(plain.map((model) => model.value)).toEqual([
      "opencode-go/deepseek-v4.1-flash",
      "opencode/big-pickle",
    ]);
    expect(plain[0]?.efforts).toBeUndefined();

    const verbose = [
      "opencode-go/deepseek-v4.1-flash",
      "{",
      '  "id": "deepseek-v4.1-flash",',
      '  "name": "DeepSeek V4.1 Flash",',
      '  "variants": { "low": { "reasoningEffort": "low" }, "high": { "reasoningEffort": "high" } }',
      "}",
      "opencode/big-pickle",
      "{",
      '  "id": "big-pickle",',
      '  "variants": {}',
      "}",
    ].join("\n");
    const models = parseOpencodeModels(verbose);
    expect(models).toMatchObject([
      { value: "opencode-go/deepseek-v4.1-flash", efforts: ["low", "high"] },
      { value: "opencode/big-pickle" },
    ]);
  });

  it("parses both mirrored TranscriptMsg lines and raw run events", () => {
    const raw = [
      JSON.stringify({ role: "user", text: "Explain closures", ts: 10 }),
      JSON.stringify({
        type: "text",
        time: 20,
        part: { type: "text", text: "A closure captures scope." },
      }),
      JSON.stringify({
        type: "tool_use",
        time: 21,
        part: {
          type: "tool",
          tool: "read",
          callID: "call_9",
          state: { status: "completed", input: { path: "a.ts" }, output: "ok" },
        },
      }),
    ].join("\n");
    expect(parseOpencodeTranscript(raw)).toMatchObject([
      { role: "user", text: "Explain closures" },
      { role: "assistant", text: "A closure captures scope." },
      { role: "assistant", text: "", tools: [{ name: "read", result: "ok" }] },
    ]);
  });

  it("mirrors legacy JSON-tree sessions into a readable transcript", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-opencode-"));
    const storage = path.join(root, "storage");
    const write = (file: string, value: unknown) => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(value));
    };
    write(path.join(storage, "session", "proj", "ses_1.json"), {
      id: "ses_1",
      directory: "/work/repo",
      title: "Fix login",
      time: { created: 1, updated: 3 },
    });
    write(path.join(storage, "message", "ses_1", "msg_user.json"), {
      id: "msg_user",
      role: "user",
      time: { created: 2 },
    });
    write(path.join(storage, "part", "msg_user", "prt_1.json"), {
      id: "prt_1",
      type: "text",
      text: "Fix login",
      time: { start: 2 },
    });
    write(path.join(storage, "message", "ses_1", "msg_ai.json"), {
      id: "msg_ai",
      role: "assistant",
      time: { created: 3 },
    });
    write(path.join(storage, "part", "msg_ai", "prt_2.json"), {
      id: "prt_2",
      type: "text",
      text: "Fixed.",
      time: { start: 3 },
    });
    try {
      const sessions = new OpencodeSource(root, path.join(root, "mirror")).scan();
      expect(sessions).toMatchObject([
        {
          vendor: "opencode",
          sessionId: "ses_1",
          cwd: "/work/repo",
          title: "Fix login",
          lastPrompt: "Fix login",
        },
      ]);
      const mirrored = parseOpencodeTranscript(fs.readFileSync(sessions[0]?.path ?? "", "utf8"));
      expect(mirrored).toMatchObject([
        { role: "user", text: "Fix login" },
        { role: "assistant", text: "Fixed." },
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("mirrors SQLite database sessions into a readable transcript", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-opencode-db-"));
    const db = new DatabaseSync(path.join(root, "opencode.db"));
    try {
      db.exec(
        [
          "CREATE TABLE session (id text PRIMARY KEY, directory text, title text, time_created integer, time_updated integer, parent_id text)",
          "CREATE TABLE message (id text PRIMARY KEY, session_id text, time_created integer, data text)",
          "CREATE TABLE part (id text PRIMARY KEY, message_id text, session_id text, time_created integer, data text)",
        ].join("; "),
      );
      const insertSession = db.prepare(
        "INSERT INTO session (id, directory, title, time_created, time_updated, parent_id) VALUES (?, ?, ?, ?, ?, NULL)",
      );
      insertSession.run("ses_db", "/work/repo", "Add tests", 100, 200);
      const insertMessage = db.prepare(
        "INSERT INTO message (id, session_id, time_created, data) VALUES (?, ?, ?, ?)",
      );
      insertMessage.run("msg_u", "ses_db", 110, JSON.stringify({ role: "user" }));
      insertMessage.run("msg_a", "ses_db", 120, JSON.stringify({ role: "assistant" }));
      const insertPart = db.prepare(
        "INSERT INTO part (id, message_id, session_id, time_created, data) VALUES (?, ?, ?, ?, ?)",
      );
      insertPart.run(
        "prt_1",
        "msg_u",
        "ses_db",
        111,
        JSON.stringify({ type: "text", text: "Add tests" }),
      );
      insertPart.run(
        "prt_2",
        "msg_a",
        "ses_db",
        121,
        JSON.stringify({
          type: "tool",
          tool: "read",
          callID: "c1",
          state: { status: "completed", input: { path: "a.ts" }, output: "ok" },
        }),
      );
      insertPart.run(
        "prt_3",
        "msg_a",
        "ses_db",
        122,
        JSON.stringify({ type: "text", text: "Done." }),
      );
    } finally {
      db.close();
    }
    try {
      const sessions = new OpencodeSource(root, path.join(root, "mirror")).scan();
      expect(sessions).toMatchObject([
        { vendor: "opencode", sessionId: "ses_db", cwd: "/work/repo", title: "Add tests" },
      ]);
      expect(
        parseOpencodeTranscript(fs.readFileSync(sessions[0]?.path ?? "", "utf8")),
      ).toMatchObject([
        { role: "user", text: "Add tests" },
        { role: "assistant", text: "", tools: [{ name: "read", result: "ok" }] },
        { role: "assistant", text: "Done." },
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("classifies OpenCode auth and usage-limit failures", () => {
    expect(classifyOpencodeError(new Error("401 unauthorized: bad api key"))).toMatchObject({
      code: "opencode_auth_required",
      vendor: "opencode",
    });
    expect(classifyOpencodeError(new Error("429 too many requests"))).toMatchObject({
      code: "opencode_usage_limit",
      retryable: true,
    });
  });
});

describe("Copilot model readback", () => {
  it("preserves initial model and fallback changes for the background model guard", () => {
    const state = { sessionId: "copilot", sawAssistantDelta: false };
    expect(
      copilotToProcessEvent(
        { type: "session.start", data: { selectedModel: "gpt-5.6-luna" } },
        state,
      ),
    ).toEqual([{ type: "thread.started", thread_id: "copilot", model: "gpt-5.6-luna" }]);
    expect(
      copilotToProcessEvent(
        { type: "session.model_change", data: { newModel: "gpt-5.6-astra" } },
        state,
      ),
    ).toEqual([{ type: "model.changed", model: "gpt-5.6-astra" }]);
  });
});

describe("process vendor daemon", () => {
  it.each(["cursor", "antigravity", "copilot"])(
    "passes explicit settings through every %s background turn",
    async (vendor) => {
      const requests: Array<Record<string, unknown>> = [];
      const execution = { model: "exact-provider-variant", effort: "low", speed: "default" };
      const analyzer = new ProcessAnalyzer(
        vendor,
        "/missing-transcripts",
        (request) => {
          requests.push({ ...request });
          return {
            events: (async function* () {
              yield { type: "thread.started", thread_id: "daemon" };
            })(),
            kill: () => {},
          };
        },
        () => [],
      );
      await analyzer.spawn("/repo", undefined, execution);
      await analyzer.analyze("daemon", "/repo", "task", undefined, undefined, "", execution);
      await analyzer.avoidancePrompt("daemon", "/repo", "task", "", execution);
      expect(requests).toHaveLength(3);
      for (const request of requests)
        expect(request).toMatchObject({ ...execution, sandbox: "read-only" });
    },
  );

  it("spawns and resumes a Cursor analyzer using the shared daemon contract", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-cursor-daemon-"));
    const taskId = "cursor-task";
    const taskFile = path.join(root, `${taskId}.jsonl`);
    fs.writeFileSync(
      taskFile,
      [
        JSON.stringify({
          type: "user",
          message: { content: "完善 Cursor daemon" },
          _attend: { timestamp: 1, cwd: root },
        }),
        JSON.stringify({
          type: "assistant",
          message: { content: "已完成接线。" },
          _attend: { timestamp: 2, cwd: root },
        }),
      ].join("\n"),
    );
    const calls: Array<{ resume?: string; prompt: string }> = [];
    const exec: ProcessTurnFn<CodexEvent> = (request) => {
      calls.push({ resume: request.resume, prompt: request.prompt });
      return {
        events: (async function* () {
          if (!request.resume) {
            yield { type: "thread.started", thread_id: "cursor-daemon" };
          } else {
            yield {
              type: "item.completed",
              item: {
                type: "agent_message",
                text: JSON.stringify({
                  brief: "Cursor daemon",
                  state: "done",
                  priority: 5,
                  etaMin: 0,
                  reason: "daemon 已接通",
                  nextStep: "",
                  probe: "",
                  turns: [],
                }),
              },
            };
            yield { type: "turn.completed" };
          }
        })(),
        kill: () => {},
      };
    };
    const index = new TranscriptPathIndex();
    index.set("cursor", taskId, taskFile);
    const analyzer = new ProcessAnalyzer("cursor", root, exec, readCursorTranscript, index);
    try {
      expect(await analyzer.spawn(root)).toBe("cursor-daemon");
      expect(await analyzer.analyze("cursor-daemon", root, taskId)).toMatchObject({
        analysis: { brief: "Cursor daemon", state: "done", reason: "daemon 已接通" },
      });
      expect(calls[1]).toMatchObject({ resume: "cursor-daemon" });
      expect(calls[1]?.prompt).toContain("完善 Cursor daemon");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("classifies Antigravity and Copilot authentication and quota failures", () => {
    expect(classifyAntigravityError("Authentication required")).toMatchObject({
      code: "antigravity_auth_required",
      command: "agy",
    });
    expect(classifyCopilotError("429 too many requests")).toMatchObject({
      code: "copilot_usage_limit",
      retryable: true,
    });
  });
});
