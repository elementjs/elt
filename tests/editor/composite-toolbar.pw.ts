import { expect, test } from "../fixture"

test.describe("composite toolbar search", () => {
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

test.describe("filter options", () => {
  test("search: an empty query keeps every row, a plain query is a substring of the key or value, case follows Aa; a regular expression is matched on the texts, an invalid one filters nothing", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      const { row_matches_search } = window.__ELT__.Editor
      return {
        empty: row_matches_search("", false, ["name", "Ada"]),
        substring: row_matches_search("ada", false, ["name", "Ada Lovelace"]),
        substring_miss: row_matches_search("bio", false, ["name", "Ada"]),
        plain_case_miss: row_matches_search("Ada", true, ["name", "ada"]),
        plain_case_hit: row_matches_search("Ada", true, ["name", "Ada"]),
        match: row_matches_search("^Ad.$", false, ["name", "Ada"], true),
        anchored_miss: row_matches_search("^da", false, ["name", "Ada"], true),
        case_insensitive: row_matches_search("ADA", false, ["Ada"], true),
        case_sensitive: row_matches_search("ADA", true, ["Ada"], true),
        invalid: row_matches_search("(a", false, ["Ada"], true),
        // The same text is a plain substring without the option: the parenthesis is a character.
        literal: row_matches_search("a.", false, ["Ada"], false),
      }
    })
    expect(r).toEqual({
      empty: true,
      substring: true,
      substring_miss: false,
      plain_case_miss: false,
      plain_case_hit: true,
      match: true,
      anchored_miss: false,
      case_insensitive: true,
      case_sensitive: false,
      invalid: true,
      literal: false,
    })
  })

  test("the two option toggles are neutral, whatever the column's color, and filter the rows", async ({ page }) => {
    await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const shell = new window.__ELT__.Editor.ObjectEditorShell(o<unknown>(["ada", "bob", "Adam"]), { packed: true })
      shell.node.id = "shell"
      node_append(document.body, shell.node)
    })
    const color_of = (selector: string) =>
      page.locator(selector).evaluate((el) => {
        const probe = document.createElement("div")
        probe.style.color = "var(--e-color-tint)"
        el.append(probe)
        const c = getComputedStyle(probe).color
        probe.remove()
        return c
      })
    const neutral = await page.evaluate(() => {
      const probe = document.createElement("div")
      probe.style.color = window.__ELT__.UI.theme.colors.neutral.toString()
      document.body.append(probe)
      const c = getComputedStyle(probe).color
      probe.remove()
      return c
    })
    expect(await color_of('#shell label[title="Match case"]')).toBe(neutral)
    expect(await color_of('#shell label[title="Regular expression"]')).toBe(neutral)
    // The column keeps its type color.
    expect(await color_of("#shell e-column[packed]")).not.toBe(neutral)

    const rows = () => page.locator("#shell e-grid-row").count()
    expect(await rows()).toBe(3)
    const search = page.locator('#shell input[type="search"]')
    await search.fill("^a")
    // Not a regular expression yet: "^a" is a substring that no text contains.
    await expect.poll(rows).toBe(0)
    await page.locator('#shell label[title="Regular expression"]').click()
    await expect.poll(rows).toBe(2)
    await page.locator('#shell label[title="Match case"]').click()
    await expect.poll(rows).toBe(1)
    await search.fill("(a")
    await expect(search).toHaveAttribute("aria-invalid", "true")
    await expect.poll(rows).toBe(3)
  })
})
