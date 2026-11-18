import { test as base } from "@playwright/test"

export { expect, type Page } from "@playwright/test"

/**
 * Playwright's `test`, where every test starts on the harness page (tests/browser/harness.html), which exposes
 * the library as `window.__ELT__`. A file that must run code before the page's own scripts (to install helpers
 * on `window`, say) passes it with `test.use({ before_load: { script: () => { … } } })`: it runs in the page, through
 * `page.addInitScript`, so it can't see the test file's variables. (It is wrapped in an object because
 * Playwright takes a function given to `test.use` for a fixture definition.)
 *
 * A test fails when the page reports an uncaught error, or logs with `console.error` or `console.warn`: code that
 * observables run must never crash, and a caught error that is only logged would otherwise pass unnoticed. A test
 * that makes something fail on purpose declares it with {@link expects_errors}.
 */
export const test = base.extend<{ before_load: { script: () => void } | undefined; harness: void }>({
  before_load: [undefined, { option: true }],
  harness: [
    async ({ page, before_load }, use, testInfo) => {
      const reported: Promise<string>[] = []
      page.on("pageerror", (e) => reported.push(Promise.resolve(`uncaught error: ${e.message.split("\n")[0]}`)))
      page.on("console", (m) => {
        if (m.type() !== "error" && m.type() !== "warning") return
        // Firefox's hint to any page that moves content on scroll (RepeatVirtual does, by design): not the page's.
        if (m.text().includes("scroll-linked positioning effect")) return
        // The text is rebuilt from the logged values: Firefox gives a logged Error's text as just "Error",
        // Chromium as "Error: <message>". A value that can't be read any more (the page went) keeps m.text().
        const text = Promise.all(
          m.args().map((arg) => arg.evaluate((v) => (v instanceof Error ? `${v.name}: ${v.message}` : String(v)))),
        ).then(
          (parts) => parts.join(" ") || m.text(),
          () => m.text(),
        )
        reported.push(text.then((t) => `console.${m.type()}: ${t.split("\n")[0]}`))
      })
      if (before_load) await page.addInitScript(before_load.script)
      await page.goto("/tests/browser/harness.html")
      await use()
      const declared = testInfo.annotations.filter((a) => a.type === expects_errors_annotation)
      // A declaration without patterns accepts anything; with patterns, only the messages that match one of them
      const accepts_all = declared.some((a) => a.description == null)
      const patterns = declared.flatMap((a) => (a.description == null ? [] : (JSON.parse(a.description) as string[])))
      const unexpected = accepts_all
        ? []
        : (await Promise.all(reported)).filter(
            (message) => !patterns.some((source) => new RegExp(source).test(message)),
          )
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
