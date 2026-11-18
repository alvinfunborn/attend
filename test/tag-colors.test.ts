import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { createTagColorEngine } from "../src/ui/tag-colors.js";

it.each([
  "",
  "TODO",
  "P1",
  "P2",
  "数据库隔离",
  "蓝牙掉音🎧",
  "__proto__",
  "\ud800",
  "a".repeat(51),
  "a".repeat(52),
  "a".repeat(59),
  "a".repeat(60),
  "中".repeat(100),
  "x".repeat(1024),
])("matches native SHA-256 for tag %j", (name) => {
  const digest = createHash("sha256").update(`tag:${name}`).digest();
  const expected = (digest.readUInt32BE(0) / 0x100000000) * 360;
  expect(createTagColorEngine().hue(name)).toBe(expected);
});

it("depends only on normalized names across fresh engines and different tag orders", () => {
  const first = createTagColorEngine();
  const second = createTagColorEngine();
  const names = ["TODO", "P1", "P2", "数据库隔离", "蓝牙掉音🎧"];
  const colors = names.map((name) => first.hue(name));
  for (const name of [...names].reverse()) second.hue(name);
  expect(names.map((name) => second.hue(name))).toEqual(colors);
  expect(first.hue(" \t蓝牙\n 掉音  ")).toBe(second.hue("蓝牙 掉音"));
});
