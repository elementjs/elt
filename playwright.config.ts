import { defineConfig } from "@playwright/test"

// Port of the test harness server; set PLAYWRIGHT_PORT to run a second test session alongside one
// already serving the default port.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 5391)

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.pw\.ts/,
  fullyParallel: true,
  webServer: {
    command: `PORT=${port} bun tests/browser/harness.html`,
    port,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: `http://localhost:${port}`,
  },
})
