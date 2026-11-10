import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /prompt09-gates\.spec\.ts/,
  timeout: 120000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/prompt09-pw-report.json" }],
  ],
  outputDir: "artifacts/prompt09-pw-results",
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
      name: "chromium-prompt09",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
