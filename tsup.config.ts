import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  // Keep the shebang so `attend` is directly executable after npm install.
  banner: { js: "#!/usr/bin/env node" },
});
