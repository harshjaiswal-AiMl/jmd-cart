import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    fileParallelism: false,
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/integration/**", "tests/e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
