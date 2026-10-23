import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_COLORS } from "../src/core/theme-colors.js";
import { BUILTIN_THEMES, createThemeEngine, themeEngine } from "../src/core/themes.js";
import { VaultUiStateStore } from "../src/core/ui-state.js";

describe("themes", () => {
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
