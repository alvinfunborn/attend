import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    "session-index-worker": "src/core/vendor/session-index-worker.ts",
    "history-worker": "src/chat/history-worker.ts",
    "analyzer-context-worker": "src/chat/analyzer/context-worker.ts",
    "search-worker": "src/chat/search-worker.ts",
    "alignment-model-worker": "src/core/alignment-model-worker.ts",
    "work-prompt-index-worker": "src/core/work-prompt-index-worker.ts",
  },
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  removeNodeProtocol: false,
  // `node:sqlite` has no bare `sqlite` alias. Preserve explicit builtin
  // prefixes so the packed CLI resolves it correctly on supported Node releases.
  esbuildOptions(options) {
    options.supported = {
      ...options.supported,
      "node-colon-prefix-import": true,
      "node-colon-prefix-require": true,
    };
  },
  // Keep the shebang so `attend` is directly executable after npm install.
  banner: { js: "#!/usr/bin/env node" },
});
