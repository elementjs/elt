import { expect, test } from "./fixture"

test("css`` rewrites a class name of one letter, as longer ones (regression: one letter gave an empty class)", async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const { CSSBuilder } = window.__ELT__
    const builder = new CSSBuilder()
    return [builder.css`.a { color: red; }`, builder.css`.ab { color: red; }`, builder.css`div { color: red; }`]
  })
  expect(result[0]).toMatch(/^a-\w+$/)
  expect(result[1]).toMatch(/^ab-\w+$/)
  expect(result[2]).toBe("")
})

test.describe("css() / CSSBuilder.adopt (regression: adoptedStyleSheets duplicate-push bug)", () => {
  test("repeated css`` calls and adopt() calls put the sheet in document.adoptedStyleSheets exactly once, however many rules are inserted", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { CSSBuilder } = window.__ELT__
      const builder = new CSSBuilder()
      builder.css`.a-${1} { color: red; }`
      builder.css`.b-${1} { color: blue; }`
      builder.css`.c-${1} { color: green; }`
      // adopt() into a target it is already in is a no-op
      builder.adopt(document)
      builder.adopt(document)
      const sheets = [...document.adoptedStyleSheets].filter((s) => s === builder.sheet)
      return { occurrences: sheets.length, ruleCount: builder.sheet.cssRules.length }
    })
    expect(result.occurrences).toBe(1)
    expect(result.ruleCount).toBe(3)
  })
})
