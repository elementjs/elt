import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.pw\.ts/,
  fullyParallel: true,
  webServer: {
    command: "PORT=5391 bun tests/browser/harness.html",
    port: 5391,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:5391",
  },
})
