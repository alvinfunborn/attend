import { describe, expect, it } from "vitest";
import { buildAlignmentModel, scoreAlignment, tokenize } from "../src/core/alignment.js";

describe("tokenize", () => {
  it("lowercases latin, drops stopwords and short tokens", () => {
    expect(tokenize("The Widget and go")).toEqual(["widget"]);
  });

  it("explodes CJK runs into character bigrams", () => {
    expect(tokenize("注意力")).toEqual(["注意", "意力"]);
  });
});

describe("alignment cosine", () => {
  it("scores higher for briefs sharing memory vocabulary", () => {
    const model = buildAlignmentModel([
      "attention router brief telemetry pattern",
      "claude codex session vendor",
    ]);
    const aligned = scoreAlignment(model, "build the attention router telemetry view");
    const unaligned = scoreAlignment(model, "bake a chocolate cake recipe");
    expect(aligned.cosine).toBeGreaterThan(unaligned.cosine);
    expect(aligned.topTerms.length).toBeGreaterThan(0);
  });

  it("aligns Chinese via shared bigrams", () => {
    const model = buildAlignmentModel(["注意力管理与决策"]);
    expect(scoreAlignment(model, "这是注意力路由").cosine).toBeGreaterThan(0);
  });

  it("empty memory yields a zero, well-defined score", () => {
    const model = buildAlignmentModel([]);
    expect(model.vocabSize).toBe(0);
    expect(scoreAlignment(model, "anything").cosine).toBe(0);
  });

  it("single memory doc still produces a usable model", () => {
    const model = buildAlignmentModel(["widget pipeline tokens"]);
    expect(model.vocabSize).toBeGreaterThan(0);
    expect(scoreAlignment(model, "widget").cosine).toBeGreaterThan(0);
  });
});
