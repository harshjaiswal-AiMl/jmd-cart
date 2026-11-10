import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /gates\.spec\.ts/,
  timeout: 120000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/playwright-gates-report.json" }],
  ],
  outputDir: "artifacts/playwright-results",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    channel: "chrome",
    headless: true,
    video: "on",
    trace: "on",
    viewport: { width: 1440, height: 900 },
    navigationTimeout: 30000,
    actionTimeout: 15000,
  },
  projects: [
    {
      name: "chromium-gates",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
