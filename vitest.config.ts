import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    globals: true,
    environment: "node",
    css: false,
    testTimeout: 20000,
    fileParallelism: false,
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
