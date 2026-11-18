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
  // The three engines elt supports, with Playwright's default viewport and scale (no device preset: a test
  // that sets its own scale, seams-scale.pw.ts, can't have a preset's deviceScaleFactor). `just test` runs chromium, `just test-all` the three (WebKit through
  // Docker on hosts whose system libraries Playwright's WebKit lacks, `just test-webkit`); CI runs the three.
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
})
