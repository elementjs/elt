import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("css() / CSSBuilder.adopt (regression: adoptedStyleSheets duplicate-push bug)", () => {
  test("repeated css`` calls adopt the sheet into document exactly once, however many rules are inserted", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { CSSBuilder } = window.__ELT__
      const builder = new CSSBuilder()
      builder.css`.a-${1} { color: red; }`
      builder.css`.b-${1} { color: blue; }`
      builder.css`.c-${1} { color: green; }`
      const sheets = [...document.adoptedStyleSheets].filter((s) => s === builder.sheet)
      return { occurrences: sheets.length, ruleCount: builder.sheet.cssRules.length }
    })
    expect(result.occurrences).toBe(1)
    expect(result.ruleCount).toBe(3)
  })

  test("adopt() into the same target twice is a no-op the second time", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { CSSBuilder } = window.__ELT__
      const builder = new CSSBuilder()
      builder.adopt(document)
      builder.adopt(document)
      builder.adopt(document)
      return [...document.adoptedStyleSheets].filter((s) => s === builder.sheet).length
    })
    expect(result).toBe(1)
  })

  test("the global css export never produces duplicate document.adoptedStyleSheets entries", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { css } = window.__ELT__
      const before = document.adoptedStyleSheets.length
      css`.x-${1} { color: red; }`
      css`.y-${1} { color: blue; }`
      const after = document.adoptedStyleSheets
      const distinct = new Set(after).size
      return { grewBy: after.length - before, totalEntries: after.length, distinctEntries: distinct }
    })
    // css() may adopt at most one new sheet (its own), regardless of how many rules were inserted.
    expect(result.grewBy).toBeLessThanOrEqual(1)
    expect(result.distinctEntries).toBe(result.totalEntries)
  })
})
