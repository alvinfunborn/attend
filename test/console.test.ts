import { describe, expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";

const view: ConsoleView = {
  sessions: [],
  knownDirs: [],
  scopeRoots: [],
  sessionsPerHour: 0,
  charsPerHour: 0,
  vendors: [],
  tags: [],
};

describe("renderConsole", () => {
  it("resubmits edited messages with a concrete turn payload", () => {
    const html = renderConsole(view);
    expect(html).toContain("dispatchSend({ text:v, attachments:[] }, v);");
  });

  it("only marks AskUserQuestion as answered when a non-empty result arrives", () => {
    const html = renderConsole(view);
    expect(html).toContain(
      "if(tc.name==='AskUserQuestion' && hasQuestionAnswerResult(tc.result, tc.isError)) lockQuestionTool(d);",
    );
    expect(html).toContain("if(hasQuestionAnswerResult(ev.text, ev.isError)) lockQuestionTool(t);");
  });

  // Regression guard: the whole page (inline <script> included) is one template
  // literal, so node eats single backslashes — a regex written `/\/x/` or `/\b/`
  // in source reaches the browser as `//x/` / a backspace char and the resulting
  // SyntaxError aborts the ENTIRE script, leaving the sidebar blank ("no sessions").
  // This has shipped twice. `new Function` parses each script block without
  // executing it (no DOM touched), so any such syntax error fails the test here.
  it("emits inline scripts that parse as valid JS", () => {
    const html = renderConsole(view);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? "");
    expect(scripts.length).toBeGreaterThan(0);
    for (const body of scripts) {
      expect(() => new Function(body)).not.toThrow();
    }
  });
});
