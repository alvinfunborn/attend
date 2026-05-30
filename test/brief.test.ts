import { describe, expect, it } from "vitest";
import { parseBriefText } from "../src/core/brief.js";

describe("parseBriefText", () => {
  const sample = `---
status: deferred
defer_until: 等 X 回复
last_touch: 2026-05-30
---

## what
do the thing, why it matters

## accept
done criteria here

## next
stuck on Y
`;

  it("parses front matter, sections, and derives name from project dir", () => {
    const b = parseBriefText("D:\\workspace\\proj\\brief.md", sample);
    expect(b.status).toBe("deferred");
    expect(b.deferUntil).toBe("等 X 回复");
    expect(b.what).toBe("do the thing, why it matters");
    expect(b.accept).toBe("done criteria here");
    expect(b.next).toBe("stuck on Y");
    expect(b.name).toBe("proj");
  });

  it("defaults status to active when front matter is absent", () => {
    const b = parseBriefText("/vault/x/brief.md", "## what\nhello\n");
    expect(b.status).toBe("active");
    expect(b.deferUntil).toBeNull();
    expect(b.what).toBe("hello");
    expect(b.accept).toBe("");
  });

  it("ignores sections other than what/accept/next", () => {
    const b = parseBriefText("/v/p/brief.md", "## what\nw\n\n## notes\nignored\n");
    expect(b.what).toBe("w");
    expect(b.next).toBe("");
  });
});
