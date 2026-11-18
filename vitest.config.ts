import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Operational snapshots in logs/ can contain old test sources.
    include: ["test/**/*.test.ts"],
    maxWorkers: 4,
  },
});
