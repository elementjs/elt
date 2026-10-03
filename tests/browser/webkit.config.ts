import { defineConfig, devices } from "@playwright/test"

// `just test-webkit`: WebKit, run inside Playwright's Docker image (its WebKit build needs system
// libraries some hosts lack), against the harness served on the host: the container shares the
// host's network. The repository is mounted read-only, so results go to /tmp.
export default defineConfig({
  testDir: "..",
  testMatch: /.*\.pw\.ts/,
  fullyParallel: true,
  outputDir: "/tmp/test-results",
  use: { ...devices["Desktop Safari"], baseURL: "http://localhost:5391" },
})
