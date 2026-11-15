import { expect, test } from "../fixture"

test.describe("constructor registry", () => {
  test("resolve_factory_from_value uses a registered constructor", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { anything, string } = window.__ELT__.Editor
      const { register_constructor, resolve_factory_from_value } = window.__ELT__.Editor
      class DemoBox {}
      const factory = string()
      register_constructor(DemoBox, factory)
      return resolve_factory_from_value(new DemoBox(), anything) === factory
    })
    expect(result).toBe(true)
  })

  test("register_constructor can override a builtin default", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { anything, map, string, register_constructor, resolve_factory_from_value } = window.__ELT__.Editor
      class TaggedMap extends Map<string, string> {}
      const custom = map({ keys: string(), values: string() })
      register_constructor(TaggedMap, custom)
      return resolve_factory_from_value(new TaggedMap([["k", "v"]]), anything) === custom
    })
    expect(result).toBe(true)
  })
})
