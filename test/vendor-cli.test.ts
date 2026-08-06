import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ProcessAnalyzer } from "../src/chat/analyzer/process.js";
import { antigravityToProcessEvent, buildAntigravityArgs } from "../src/chat/antigravity/exec.js";
import { parseAntigravityTranscript } from "../src/chat/antigravity/transcript.js";
import type { CodexEvent } from "../src/chat/codex/events.js";
import { buildCopilotArgs, copilotToProcessEvent } from "../src/chat/copilot/exec.js";
import { parseCopilotTranscript } from "../src/chat/copilot/transcript.js";
import { readCursorTranscript } from "../src/chat/cursor/transcript.js";
import { classifyAntigravityError, classifyCopilotError } from "../src/chat/process/errors.js";
import { makeJsonlExec } from "../src/chat/process/jsonl-exec.js";
import type { ProcessTurnFn } from "../src/chat/process/types.js";
import { AntigravitySource } from "../src/core/vendor/antigravity.js";
import { capabilityUnavailable, vendorCapabilities } from "../src/core/vendor/capabilities.js";
import { CopilotSource } from "../src/core/vendor/copilot.js";
import {
  parseCopilotHelpModels,
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

  it("parses Antigravity/Copilot model tables with their advertised effort levels", () => {
    expect(
      parseProcessCliModels(
        "gemini-3-pro  Gemini 3 Pro\nclaude-sonnet-4-5 - Claude Sonnet 4.5 (default)",
        ["low", "medium", "high"],
      ),
    ).toEqual([
      {
        value: "gemini-3-pro",
        label: "Gemini 3 Pro",
        efforts: ["low", "medium", "high"],
      },
      {
        value: "claude-sonnet-4-5",
        label: "Claude Sonnet 4.5",
        efforts: ["low", "medium", "high"],
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
        efforts: ["low", "medium", "high", "xhigh", "max"],
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

describe("process vendor daemon", () => {
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
