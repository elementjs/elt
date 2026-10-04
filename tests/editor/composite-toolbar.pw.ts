import { expect, test } from "../fixture"

test.describe("composite toolbar search", () => {
  test("empty query shows all rows", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { row_matches_search } = window.__ELT__.Editor
      return row_matches_search("", false, ["name", "Ada"])
    })
    expect(result).toBe(true)
  })

  test("case-insensitive match on key or value", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { row_matches_search } = window.__ELT__.Editor
      return [
        { actual: row_matches_search("ada", false, ["name", "Ada Lovelace"]), expected: true },
        { actual: row_matches_search("bio", false, ["name", "Ada"]), expected: false },
      ]
    })
    for (const r of results) expect(r.actual).toBe(r.expected)
  })

  test("case-sensitive mode", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { row_matches_search } = window.__ELT__.Editor
      return [
        { actual: row_matches_search("Ada", true, ["name", "ada"]), expected: false },
        { actual: row_matches_search("Ada", true, ["name", "Ada"]), expected: true },
      ]
    })
    for (const r of results) expect(r.actual).toBe(r.expected)
  })

  test("value_preview_text stringifies nested data shallowly", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { value_preview_text } = window.__ELT__.Editor
      return value_preview_text({ a: 1, b: 2, c: 3 })
    })
    expect(result).toBe("{a: 1, b: 2, …}")
  })
})

test.describe("type change actions", () => {
  test("offers convert and default for object → array", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { object, type_change_actions } = window.__ELT__.Editor
      const current = object({ properties: [] })
      const value = { x: 1 }
      const actions = type_change_actions(current, value, {})
      return [
        { actual: actions.some((a) => a.target.kind === "array" && a.mode === "convert"), expected: true },
        { actual: actions.some((a) => a.target.kind === "string" && a.mode === "default"), expected: true },
      ]
    })
    for (const r of results) expect(r.actual).toBe(r.expected)
  })

  test("conversions allow-list filters menu entries", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { object, type_change_actions } = window.__ELT__.Editor
      const current = object({ properties: [] })
      const actions = type_change_actions(current, { a: 1 }, { conversions: ["array"] })
      return actions.every((a) => a.target.kind === "array")
    })
    expect(result).toBe(true)
  })

  test("skips current kind when value already matches", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { string, type_change_actions } = window.__ELT__.Editor
      const current = string()
      const actions = type_change_actions(current, "hello", {})
      return actions.every((a) => a.target.kind !== "string")
    })
    expect(result).toBe(true)
  })
})
