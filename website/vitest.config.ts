import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  resolve: {
    alias: {
      "@": directory,
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["node_modules/**", "tests/e2e/**"],
    setupFiles: ["./tests/setup.ts"],
  },
});
