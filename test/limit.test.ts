import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { RawSession } from "../src/core/types.js";
import { limitSessions, withinScope } from "../src/server.js";

const DAY = 86_400_000;
const NOW = 1_000 * DAY; // a fixed "now"

function sess(id: string, ageDays: number): RawSession {
  return {
    path: `${id}.jsonl`,
    vendor: "claude",
    sessionId: id,
    title: id,
    lastPrompt: null,
    lastTurnChars: 0,
    chars: 0,
    cwd: "/p",
    firstTs: null,
    lastTs: NOW - ageDays * DAY,
    prompts: 0,
    actions: 0,
    visits: 0,
  };
}

describe("limitSessions", () => {
  const all = [sess("today", 0), sess("d10", 10), sess("d40", 40), sess("d200", 200)];

  it("drops sessions older than the recency window", () => {
    const out = limitSessions(all, NOW, 30, 0);
    expect(out.map((s) => s.sessionId)).toEqual(["today", "d10"]);
  });

  it("caps to the N most-recent, newest first", () => {
    const out = limitSessions(all, NOW, 0, 2);
    expect(out.map((s) => s.sessionId)).toEqual(["today", "d10"]);
  });

  it("applies both limits together (filter then cap)", () => {
    const out = limitSessions(all, NOW, 30, 1);
    expect(out.map((s) => s.sessionId)).toEqual(["today"]);
  });

  it("0 disables both limits (returns all, sorted newest first)", () => {
    const out = limitSessions(all, NOW, 0, 0);
    expect(out.map((s) => s.sessionId)).toEqual(["today", "d10", "d40", "d200"]);
  });
});

describe("withinScope", () => {
  const proj = path.resolve("/Users/me/dev/proj");
  const other = path.resolve("/Users/me/dev/other");

  it("no roots → everything is in scope (the default)", () => {
    expect(withinScope("/anywhere", [])).toBe(true);
    expect(withinScope(null, [])).toBe(true);
  });

  it("keeps a cwd that equals or sits under a root", () => {
    expect(withinScope(proj, [proj])).toBe(true);
    expect(withinScope(path.join(proj, "src/core"), [proj])).toBe(true);
  });

  it("drops a cwd outside every root", () => {
    expect(withinScope(other, [proj])).toBe(false);
  });

  it("does not treat a sibling prefix as inside (proj vs proj-2)", () => {
    expect(withinScope(`${proj}-2`, [proj])).toBe(false);
  });

  it("matches any of several roots", () => {
    expect(withinScope(path.join(other, "x"), [proj, other])).toBe(true);
  });

  it("matches filesystem aliases such as macOS /tmp and /private/tmp", () => {
    const realTmp = fs.realpathSync.native("/tmp");
    expect(withinScope(path.join(realTmp, "attend-project"), ["/tmp"])).toBe(true);
  });

  it("excludes a session with no cwd once a scope is active", () => {
    expect(withinScope(null, [proj])).toBe(false);
  });
});
