import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
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
