import { test as base } from "@playwright/test"

export { expect, type Page } from "@playwright/test"

/**
 * Playwright's `test`, where every test starts on the harness page (tests/browser/harness.html), which exposes
 * the library as `window.__ELT__`. A test that must act before the page loads (`page.addInitScript`) uses
 * `@playwright/test` and navigates itself.
 */
export const test = base.extend<{ harness: void }>({
  harness: [
    async ({ page }, use) => {
      await page.goto("/tests/browser/harness.html")
      await use()
    },
    { auto: true },
  ],
})
