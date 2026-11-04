import { test as base } from "@playwright/test"

export { expect, type Page } from "@playwright/test"

/**
 * Playwright's `test`, where every test starts on the harness page (tests/browser/harness.html), which exposes
 * the library as `window.__ELT__`. A test that must act before the page loads (`page.addInitScript`) uses
 * `@playwright/test` and navigates itself.
 *
 * A test fails when the page reports an uncaught error, or logs with `console.error` or `console.warn`: code that
 * observables run must never crash, and a caught error that is only logged would otherwise pass unnoticed. A test
 * that makes something fail on purpose declares it with {@link expects_errors}.
 */
export const test = base.extend<{ harness: void }>({
  harness: [
    async ({ page }, use, testInfo) => {
      const reported: string[] = []
      page.on("pageerror", (e) => reported.push(`uncaught error: ${e.message.split("\n")[0]}`))
      page.on("console", (m) => {
        if (m.type() === "error" || m.type() === "warning")
          reported.push(`console.${m.type()}: ${m.text().split("\n")[0]}`)
      })
      await page.goto("/tests/browser/harness.html")
      await use()
      const declared = testInfo.annotations.filter((a) => a.type === expects_errors_annotation)
      // A declaration without patterns accepts anything; with patterns, only the messages that match one of them
      const accepts_all = declared.some((a) => a.description == null)
      const patterns = declared.flatMap((a) => (a.description == null ? [] : (JSON.parse(a.description) as string[])))
      const unexpected = accepts_all
        ? []
        : reported.filter((message) => !patterns.some((source) => new RegExp(source).test(message)))
      if (unexpected.length > 0) {
        throw new Error(
          `the page reported errors or warnings the test did not declare (declare them with expects_errors(/pattern/) if they are the point of the test):\n  ${unexpected.join("\n  ")}`,
        )
      }
    },
    { auto: true },
  ],
})

const expects_errors_annotation = "expects-errors"

/**
 * Declare, from inside a test (or a `beforeEach`), that it makes the page report errors or warnings on purpose:
 * those whose message (`"uncaught error: …"`, `"console.error: …"` or `"console.warning: …"`) matches one of
 * `patterns`. With no pattern, every message is accepted.
 */
export function expects_errors(...patterns: RegExp[]) {
  test.info().annotations.push({
    type: expects_errors_annotation,
    description: patterns.length > 0 ? JSON.stringify(patterns.map((p) => p.source)) : undefined,
  })
}
