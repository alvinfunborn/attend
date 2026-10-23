import { THEME_COLORS, type ThemeColor } from "./theme-colors.js";

export interface ThemeDefinition {
  name: string;
  type: "light" | "dark";
  colors: Record<string, string>;
}

/** Self-contained so server and browser share exactly the same validation and resolution. */
export function createThemeEngine(definitions: Record<string, ThemeColor>) {
  return {
    isColor(color: string): boolean {
      if (/^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|transparent)$/i.test(color)) return true;
      const match = /^(rgba?|hsla?)\(([^()]*)\)$/i.exec(color);
      if (!match) return false;
      const notation = match[1]?.toLowerCase();
      if (!notation || match[2] === undefined) return false;
      const body = match[2].trim();
      let parts: string[];
      if (body.includes(",")) {
        if (body.includes("/")) return false;
        parts = body.split(/\s*,\s*/);
      } else {
        const slash = body.split("/");
        if (slash.length > 2) return false;
        parts = (slash[0] || "").trim().split(/\s+/);
        if (parts.length !== 3) return false;
        if (slash.length === 2) parts.push((slash[1] || "").trim());
      }
      if (parts.length < 3 || parts.length > 4) return false;
      if (
        body.includes(",") &&
        notation.startsWith("rgb") &&
        parts.slice(0, 3).some((part) => part.endsWith("%") !== (parts[0] || "").endsWith("%"))
      )
        return false;
      for (const [i, part] of parts.entries()) {
        if (i === 0 && notation.startsWith("hsl")) {
          if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:deg|grad|rad|turn)?$/.test(part)) return false;
        } else if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(part)) return false;
        if (notation.startsWith("hsl") && (i === 1 || i === 2) && !part.endsWith("%")) return false;
      }
      return true;
    },
    normalize(value: unknown): ThemeDefinition {
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Theme must be a JSON object.");
      const input = value as Record<string, unknown>;
      if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 100)
        throw new Error("Theme name must contain 1–100 characters.");
      if (input.type !== "light" && input.type !== "dark")
        throw new Error('Theme type must be "light" or "dark".');
      if (!input.colors || typeof input.colors !== "object" || Array.isArray(input.colors))
        throw new Error("Theme colors must be an object.");
      if (Object.keys(input.colors).length > 1000) throw new Error("Too many theme colors.");
      const colors: Record<string, string> = {};
      for (const [key, raw] of Object.entries(input.colors)) {
        if (!Object.hasOwn(definitions, key)) throw new Error(`Unknown theme color: ${key}`);
        if (typeof raw !== "string" || raw.length > 100) throw new Error(`Invalid color: ${key}`);
        const color = raw.trim();
        if (!this.isColor(color))
          throw new Error(`Invalid color for ${key}. Use hex, rgb(), hsl(), or transparent.`);
        colors[key] = color;
      }
      return { name: input.name.trim(), type: input.type, colors };
    },
    resolve(theme: ThemeDefinition): Record<string, string> {
      const variables: Record<string, string> = {};
      for (const [key, definition] of Object.entries(definitions)) {
        let color = theme.colors[key];
        if (!color) {
          let parent = definition.fallback;
          for (let depth = 0; parent && depth < 20; depth++) {
            const target = definitions[parent];
            if (theme.colors[parent] && target) {
              color = `var(--${target.variable})`;
              break;
            }
            parent = target?.fallback;
          }
        }
        variables[definition.variable] = color || definition[theme.type];
      }
      return variables;
    },
    css(theme: ThemeDefinition): string {
      let css = `color-scheme: ${theme.type}; `;
      for (const [variable, value] of Object.entries(this.resolve(theme)))
        css += `--${variable}: ${value}; `;
      return css;
    },
  };
}

export const themeEngine = createThemeEngine(THEME_COLORS);
export const BUILTIN_THEMES: Record<"light" | "dark", ThemeDefinition> = {
  light: { name: "Light", type: "light", colors: {} },
  dark: { name: "Dark", type: "dark", colors: {} },
};
export const THEME_DEFAULT_CSS = `:root {${themeEngine.css(BUILTIN_THEMES.light)}}\nhtml[data-theme="dark"] {${themeEngine.css(BUILTIN_THEMES.dark)}}`;

export function validThemeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-zA-Z0-9][\w.-]{0,79}$/.test(value) &&
    !["constructor", "prototype"].includes(value)
  );
}

export function cleanCustomThemes(value: unknown): Record<string, ThemeDefinition> {
  const result: Record<string, ThemeDefinition> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [id, theme] of Object.entries(value).slice(0, 64)) {
    if (
      !validThemeId(id) ||
      ["light", "dark", "system", "__proto__", "constructor", "prototype"].includes(id)
    )
      continue;
    try {
      result[id] = themeEngine.normalize(theme);
    } catch {
      /* Skip corrupt persisted entries. */
    }
  }
  return result;
}
