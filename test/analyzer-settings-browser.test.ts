import { expect, it } from "vitest";
import { type ConsoleView, renderConsole } from "../src/ui/console.js";
const view: ConsoleView = {
  sessions: [],
  knownDirs: [],
  scopeRoots: [],
  defaultNewDir: "",
  sessions1h: 0,
  prompts1h: 0,
  chars1h: 0,
  vendors: [],
  claudeModels: [],
  codexModels: [],
  cursorModels: [],
  changelogMarkdown: "",
  tags: [],
};
it("omits background analysis settings from the console", () => {
  const html = renderConsole(view);
  expect(html).not.toContain('class="analyzer-settings"');
  expect(html).not.toContain('id="analyzerMode"');
  expect(html).not.toContain("/analyzer/settings");
});
