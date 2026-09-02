import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    maxWorkers: 1,
    env: {
      NEXT_PHASE: "phase-production-build",
    },
    include: [
      "lib/agent-engine/contracts/**/*.test.ts",
      "tests/unit/agent-product-*.test.ts",
      "tests/unit/agent-evals-*.test.ts",
      "tests/unit/durable-benchmark-*.test.ts",
    ],
    exclude: ["**/node_modules/**", ".next", "dist"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
