import { describe, expect, it } from "vitest";
import { parseAnalysis } from "../src/core/daemon/parse.js";

describe("parseAnalysis", () => {
  it("extracts a fenced JSON verdict, ignoring surrounding prose", () => {
    const text =
      'Here is my read:\n```json\n{"brief":"refactor parser","priority":7,"etaMin":12,"reason":"two questions, no edits"}\n```';
    expect(parseAnalysis(text)).toEqual({
      brief: "refactor parser",
      priority: 7,
      etaMin: 12,
      reason: "two questions, no edits",
    });
  });

  it("handles braces inside string values (string-aware brace matching)", () => {
    const r = parseAnalysis('{"brief":"fix {config} loader","priority":2,"etaMin":3,"reason":""}');
    expect(r?.brief).toBe("fix {config} loader");
  });

  it("takes the last object when several appear", () => {
    const r = parseAnalysis(
      '{"brief":"old"} then {"brief":"new","priority":1,"etaMin":1,"reason":""}',
    );
    expect(r?.brief).toBe("new");
  });

  it("clamps priority and etaMin into range", () => {
    const r = parseAnalysis('{"brief":"x","priority":99,"etaMin":-5,"reason":""}');
    expect(r?.priority).toBe(10);
    expect(r?.etaMin).toBe(1); // floored to >=1 after clamping to 0
  });

  it("returns null when there is no JSON, or no brief (never fabricates)", () => {
    expect(parseAnalysis("no structure here")).toBeNull();
    expect(parseAnalysis('{"priority":5,"etaMin":2,"reason":"r"}')).toBeNull();
  });
});
