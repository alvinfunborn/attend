import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SqliteDocument } from "../src/core/state-database.js";
import { THEME_COLORS } from "../src/core/theme-colors.js";
import { BUILTIN_THEMES, createThemeEngine, themeEngine } from "../src/core/themes.js";
import { VaultUiStateStore } from "../src/core/ui-state.js";

describe("themes", () => {
  it.each([false, true])(
    "preserves merged legacy libraries larger than 64 themes (SQLite=%s)",
    (sqlite) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-theme-library-"));
      try {
        const file = path.join(dir, "ui.json");
        const db = sqlite ? path.join(dir, "state.db") : undefined;
        const library = (start: number) =>
          Object.fromEntries(
            Array.from({ length: 40 }, (_, index) => [
              `theme-${start + index}`,
              { name: `Theme ${start + index}`, type: "dark", colors: {} },
            ]),
          );
        fs.writeFileSync(
          file,
          JSON.stringify({
            instances: {
              first: { theme: "theme-0", customThemes: library(0) },
              second: { theme: "theme-79", customThemes: library(40) },
            },
          }),
        );
        const first = new VaultUiStateStore(file, "first", db);
        expect(Object.keys(first.get().customThemes || {})).toHaveLength(80);
        const second = new VaultUiStateStore(file, "second", db);
        expect(second.get().theme).toBe("theme-79");
        second.patch({
          customThemes: { "theme-79": { name: "Edited", type: "light", colors: {} } },
        });
        expect(
          new VaultUiStateStore(file, "first", db).get().customThemes?.["theme-79"]?.name,
        ).toBe("Edited");
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it.each([false, true])(
    "migrates instance libraries without losing conflicting definitions (SQLite=%s)",
    (sqlite) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-theme-migration-"));
      try {
        const file = path.join(dir, "ui.json");
        const db = sqlite ? path.join(dir, "state.db") : undefined;
        const midnight = { name: "Midnight", type: "dark", colors: { background: "#102030" } };
        const paper = { name: "Paper", type: "light", colors: {} };
        fs.writeFileSync(
          file,
          JSON.stringify({
            customThemes: { saved: midnight },
            instances: {
              first: {
                theme: "saved",
                customThemes: { saved: midnight },
                layout: { sidebarWidth: 240 },
              },
              second: { theme: "saved", customThemes: { saved: paper } },
              third: { theme: "saved", customThemes: { saved: paper } },
            },
          }),
        );
        const first = new VaultUiStateStore(file, "first", db);
        const second = new VaultUiStateStore(file, "second", db);
        const third = new VaultUiStateStore(file, "third", db);
        expect(first.get()).toMatchObject({ theme: "saved", layout: { sidebarWidth: 240 } });
        expect(second.get().theme).toBe("saved-1");
        expect(third.get().theme).toBe("saved-1");
        expect(first.get().customThemes).toEqual({ saved: midnight, "saved-1": paper });
        const stored = db
          ? new SqliteDocument(db, "ui-state", file, (value) => value).read()
          : JSON.parse(fs.readFileSync(file, "utf8"));
        expect(stored).toMatchObject({
          customThemes: { saved: midnight, "saved-1": paper },
          instances: { first: { theme: "saved" }, second: { theme: "saved-1" } },
        });
        expect(JSON.stringify((stored as { instances: unknown }).instances)).not.toContain(
          "customThemes",
        );
        first.patch({ customThemes: { "saved-1": null } });
        expect(new VaultUiStateStore(file, "third", db).get().theme).toBe("light");
        expect(new VaultUiStateStore(file, "second", db).get().customThemes).toEqual({
          saved: midnight,
        });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it("uses one engine in Node and the embedded browser script", () => {
    const browserEngine = new Function(
      "definitions",
      `return (${createThemeEngine.toString()})(definitions)`,
    )(THEME_COLORS);
    const theme = themeEngine.normalize({
      name: "Custom",
      type: "dark",
      colors: { background: "#123456", foreground: "#eeeeee", "chat.background": "#112233" },
    });
    expect(browserEngine.resolve(theme)).toEqual(themeEngine.resolve(theme));
    expect(themeEngine.resolve(theme)).toMatchObject({
      canvas: "#123456",
      surface: "var(--canvas)",
      "surface-2": "var(--canvas)",
      "chat-background": "#112233",
      "ink-2": "var(--ink)",
    });
    expect(themeEngine.resolve(BUILTIN_THEMES.dark).canvas).toBe("#07101f");
    expect(themeEngine.resolve(BUILTIN_THEMES.light).canvas).toBe("#eeece4");
  });

  it("rejects unknown keys, CSS injection, and invalid definitions", () => {
    for (const colors of [
      { background: "rgb(garbage)" },
      { background: "rgb(1,2%,3)" },
      { background: "rgb(1 2 3 4)" },
      { background: "hsl(30 40 50)" },
      { background: "url(https://example.test/)" },
      { background: "#fff;display:none" },
      { background: "var(--ink)" },
      { unknown: "#fff" },
      JSON.parse('{"__proto__":"#fff"}'),
    ])
      expect(() => themeEngine.normalize({ name: "Test", type: "dark", colors })).toThrow();
    for (const value of [
      null,
      [],
      {},
      { name: "", type: "light", colors: {} },
      { name: "X", type: "auto", colors: {} },
    ])
      expect(() => themeEngine.normalize(value)).toThrow();
    expect(
      themeEngine.normalize({
        name: " Hi ",
        type: "light",
        colors: { background: "#1234", accent: "rgba(1, 2, 3, 0.5)" },
      }).name,
    ).toBe("Hi");
  });

  it("merges independent themes, persists across stores and falls back after deletion", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-themes-"));
    try {
      const file = path.join(dir, "ui.json");
      const first = new VaultUiStateStore(file);
      const second = new VaultUiStateStore(file);
      first.patch({
        customThemes: {
          midnight: { name: "Midnight", type: "dark", colors: { background: "#102030" } },
        },
        theme: "midnight",
      });
      second.patch({ customThemes: { paper: { name: "Paper", type: "light", colors: {} } } });
      expect(new VaultUiStateStore(file).get()).toMatchObject({
        theme: "midnight",
        customThemes: { midnight: { name: "Midnight" }, paper: { name: "Paper" } },
      });
      first.patch({ customThemes: { midnight: null } });
      expect(second.get()).toMatchObject({
        theme: "light",
        customThemes: { paper: { name: "Paper" } },
      });
      expect(second.get().customThemes).not.toHaveProperty("midnight");
      second.patch({ theme: "system" });
      expect(first.get().theme).toBe("system");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
