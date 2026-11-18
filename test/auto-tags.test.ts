import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { tagContext } from "../src/chat/analyzer/tag-context.js";
import { normalizeAutoTags } from "../src/core/auto-tags.js";
import { parseAnalysis } from "../src/core/daemon/parse.js";
import { TagStore } from "../src/core/tags.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function fixture(sqlite: boolean) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-auto-tags-"));
  dirs.push(dir);
  const file = path.join(dir, "tags.json");
  const db = sqlite ? path.join(dir, "state.sqlite3") : undefined;
  return { store: new TagStore(file, db), reload: () => new TagStore(file, db), file };
}

it("parses bounded short tags without altering legacy or malformed verdicts", () => {
  expect(
    normalizeAutoTags([
      " sdk ",
      "SDK",
      "自动标签",
      "this tag is too wordy",
      3,
      "x".repeat(25),
      "a\nb",
      "UI",
      "fourth",
    ]),
  ).toEqual(["sdk", "自动标签", "UI"]);
  expect(parseAnalysis('{"brief":"old"}')?.tags).toBeUndefined();
  expect(parseAnalysis('{"brief":"bad","tags":[null,99]}')?.tags).toBeUndefined();
  expect(parseAnalysis('{"brief":"clear","tags":[]}')?.tags).toEqual([]);
  expect(parseAnalysis('{"brief":"tagged","tags":["sdk","SDK","修复"]}')?.tags).toEqual([
    "sdk",
    "修复",
  ]);
});

describe.each([false, true])("automatic tag persistence (sqlite=%s)", (sqlite) => {
  it("merges equivalent spellings, limits total tags, and updates only automatic assignments", () => {
    const { store, reload } = fixture(sqlite);
    store.create("SDK");
    store.setCanonicalSessionTags("task", ["手动"]);
    expect(store.applyAutoTags("task", ["sdk", "修复", "新词"])).toEqual({
      changed: true,
      created: ["修复"],
    });
    expect(reload().tagsForSession("task")).toEqual(["SDK", "手动", "修复"]);
    expect(store.list()).not.toContain("新词");
    expect(store.manualTagsForSession("task")).toEqual(["手动"]);
    expect(store.applyAutoTags("task", ["SDK", "发布"]).changed).toBe(true);
    expect(reload().tagsForSession("task")).toEqual(["SDK", "手动", "发布"]);
    expect(store.applyAutoTags("task", []).changed).toBe(true);
    expect(reload().tagsForSession("task")).toEqual(["手动"]);
  });

  it("persists independently generated tags regardless of catalog membership", () => {
    const { store, reload } = fixture(sqlite);
    store.create("数据库");
    store.create("性能");
    expect(store.applyAutoTags("task", ["语音识别", "麦克风", "权限"])).toEqual({
      changed: true,
      created: ["语音识别", "麦克风", "权限"],
    });
    expect(reload().tagsForSession("task")).toEqual(["语音识别", "麦克风", "权限"]);
    expect(store.manualTagsForSession("task")).toEqual([]);
    // The same content-derived output is accepted when those names already exist.
    expect(store.applyAutoTags("another-task", ["语音识别", "麦克风", "权限"])).toEqual({
      changed: true,
      created: [],
    });
    expect(reload().tagsForSession("another-task")).toEqual(["语音识别", "麦克风", "权限"]);
    expect(store.list()).toEqual(["数据库", "性能", "语音识别", "麦克风", "权限"]);
  });

  it("respects concurrent manual removal, empty assignments, and later manual choices", () => {
    const { store, reload } = fixture(sqlite);
    store.applyAutoTags("task", ["SDK"]);
    const other = reload();
    other.setCanonicalSessionTags("task", ["人工"]);
    store.applyAutoTags("task", ["sdk", "UI"]);
    expect(reload().tagsForSession("task")).toEqual(["人工", "UI"]);
    other.setCanonicalSessionTags("task", []);
    expect(store.applyAutoTags("task", ["新词"]).changed).toBe(false);
    expect(reload().tagsForSession("task")).toEqual([]);
    other.setCanonicalSessionTags("task", ["SDK"]);
    store.applyAutoTags("task", ["UI", "发布"]);
    expect(reload().tagsForSession("task")).toEqual(["SDK", "发布"]);
  });

  it("does not resurrect deleted/unbound catalog tags, including stale replies", () => {
    const { store, reload } = fixture(sqlite);
    store.create("SDK");
    store.applyAutoTags("task", ["SDK"]);
    reload().delete("SDK");
    expect(store.applyAutoTags("task", ["sdk"]).changed).toBe(false);
    expect(store.list()).toEqual([]);
    store.create("SDK");
    expect(store.applyAutoTags("task", ["sdk"]).changed).toBe(true);
    reload().clearSessionBindings("SDK");
    expect(store.applyAutoTags("task", ["SDK"]).changed).toBe(false);
    expect(store.applyAutoTags("new-task", ["SDK"]).changed).toBe(false);
    expect(store.list()).toEqual(["SDK"]);
  });

  it("preserves legacy aliases, explicit clears, and fork isolation", () => {
    const { store, reload } = fixture(sqlite);
    store.setSessionTags("title:shared", ["parent"]);
    store.applyAutoTags("fork", ["UI"], ["title:shared"]);
    expect(reload().tagsForSession("fork", ["title:shared"])).toEqual(["parent", "UI"]);
    expect(store.tagsFor("title:shared")).toEqual(["parent"]);
    store.setCanonicalSessionTags("cleared", []);
    expect(store.applyAutoTags("cleared", ["UI"], ["title:shared"]).changed).toBe(false);
    expect(store.applyAutoTags("fork", [null, "too many words in this label"]).changed).toBe(false);
    expect(store.tagsForSession("fork")).toEqual(["parent", "UI"]);
  });
});

it("allows automatic tags for legacy empty defaults without restoring old aliases", () => {
  const { file, reload } = fixture(false);
  fs.writeFileSync(
    file,
    JSON.stringify({
      tags: ["old"],
      sessions: { untagged: [], manual: ["old"], "title:old": ["old"] },
    }),
  );
  const store = reload();
  expect(store.autoTagPreferences("untagged").disabled).toBe(false);
  expect(store.tagsForSession("untagged", ["title:old"])).toEqual([]);
  expect(store.applyAutoTags("untagged", ["UI"], ["title:old"]).changed).toBe(true);
  expect(store.tagsForSession("untagged")).toEqual(["UI"]);
  store.setCanonicalSessionTags("untagged", []);
  expect(reload().autoTagPreferences("untagged").disabled).toBe(true);
  expect(reload().applyAutoTags("untagged", ["UI"]).changed).toBe(false);
  expect(store.applyAutoTags("manual", ["UI"]).changed).toBe(true);
  expect(store.tagsForSession("manual")).toEqual(["old", "UI"]);
});

it("supplies same-project issue continuity separately from manual style, without a catalog", () => {
  const { store } = fixture(false);
  store.setCanonicalSessionTags("other", ["common"]);
  store.setCanonicalSessionTags("related", ["SDK"]);
  store.applyAutoTags("auto", ["蓝牙切换无声"]);
  store.applyAutoTags("current", ["订阅续费失败"]);
  store.create("unused");
  const out = tagContext(store, "current", "/sdk", [
    { sessionId: "other", cwd: "/other", title: "Other task", aliases: [] },
    { sessionId: "related", cwd: "/sdk", title: "SDK permissions", aliases: [] },
    { sessionId: "auto", cwd: "/sdk", title: "Bluetooth audio lost after switching", aliases: [] },
    { sessionId: "current", cwd: "/sdk", title: "Renewal fails", aliases: [] },
  ]);
  const data = JSON.parse(out.slice(out.indexOf("\n") + 1));
  expect(data.styleExamples[0]).toMatchObject({ sameProject: true, tags: ["SDK"] });
  expect(data.styleExamples).toHaveLength(2);
  expect(data).not.toHaveProperty("existing");
  expect(data.issueContext.current).toEqual({ subject: "Renewal fails", tags: ["订阅续费失败"] });
  expect(data.issueContext.related).toEqual([
    { subject: "SDK permissions", tags: ["SDK"] },
    { subject: "Bluetooth audio lost after switching", tags: ["蓝牙切换无声"] },
  ]);
  expect(out).not.toContain("manualUses");
  expect(JSON.stringify(data.styleExamples)).not.toContain("蓝牙切换无声");
  expect(out).not.toContain("unused");
  const sessions = Array.from({ length: 20 }, (_, i) => {
    store.setCanonicalSessionTags(`sample-${i}`, [`tag-${i}`]);
    return { sessionId: `sample-${i}`, cwd: "/sdk", title: "x".repeat(1000), aliases: [] };
  });
  const bounded = tagContext(store, "current", "/sdk", sessions);
  expect(bounded.length).toBeLessThan(6200);
  expect(JSON.parse(bounded.slice(bounded.indexOf("\n") + 1)).styleExamples).toHaveLength(8);
});

it("accepts concise issue phrases instead of forcing English labels into single topic words", () => {
  expect(normalizeAutoTags(["Bluetooth audio loss", "通话切换蓝牙后无声"])).toEqual([
    "Bluetooth audio loss",
    "通话切换蓝牙后无声",
  ]);
});

it("filters dismissed issue anchors, resolves current aliases, and avoids unknown-project matches", () => {
  const { store } = fixture(false);
  store.setSessionTags("title:legacy", ["启动白屏"]);
  store.applyAutoTags("related", ["启动白屏", "麦克风权限"]);
  store.applyAutoTags("current", ["麦克风权限"]);
  store.setCanonicalSessionTags("current", ["人工保留"]);
  const sessions = [{ sessionId: "related", cwd: "/app", title: "White screen", aliases: [] }];
  const parse = (out: string) => JSON.parse(out.slice(out.indexOf("\n") + 1));
  const data = parse(tagContext(store, "current", "/app", sessions));
  expect(data.issueContext.current.tags).toEqual(["人工保留"]);
  expect(data.issueContext.related[0].tags).toEqual(["启动白屏"]);
  expect(data.dismissed).toContain("麦克风权限");
  const legacy = parse(
    tagContext(store, "legacy", "/app", [
      { sessionId: "legacy", cwd: "/app", title: "Startup", aliases: ["title:legacy"] },
    ]),
  );
  expect(legacy.issueContext.current.tags).toEqual(["启动白屏"]);
  expect(parse(tagContext(store, "current", "", sessions)).issueContext.related).toEqual([]);
});

it("bounds issue evidence without truncating records or dropping current issue continuity", () => {
  const { store } = fixture(false);
  store.applyAutoTags("current", ["标签命名发散"]);
  const sessions = Array.from({ length: 30 }, (_, i) => {
    store.applyAutoTags(`sample-${i}`, [`Issue ${i}`, `Other ${i}`]);
    return { sessionId: `sample-${i}`, cwd: "/app", title: "x".repeat(1000), aliases: [] };
  });
  const out = tagContext(store, "current", "/app", sessions);
  const data = JSON.parse(out.slice(out.indexOf("\n") + 1));
  expect(out.length).toBeLessThan(6200);
  expect(data.issueContext.current.tags).toEqual(["标签命名发散"]);
  expect(data.issueContext.related).toHaveLength(12);
  expect(data.issueContext.related[0]).toEqual({
    subject: "x".repeat(200),
    tags: ["Issue 0", "Other 0"],
  });
});
