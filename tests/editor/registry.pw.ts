import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("constructor registry", () => {
  test("resolve_factory_from_value returns fallback for null and primitives", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { anything, resolve_factory_from_value } = window.__ELT__.Editor
      return [
        { actual: resolve_factory_from_value(null, anything) === anything, expected: true },
        { actual: resolve_factory_from_value("x", anything) === anything, expected: true },
      ]
    })
    for (const r of results) expect(r.actual).toBe(r.expected)
  })

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

  test("builtin Map resolves to the default map factory", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { anything, resolve_factory_from_value } = window.__ELT__.Editor
      const resolved = resolve_factory_from_value(new Map([["a", 1]]), anything)
      return { kind: resolved.kind, isAnything: resolved === anything }
    })
    expect(result.kind).toBe("map")
    expect(result.isAnything).toBe(false)
  })

  test("register_constructor can override a builtin default", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { anything, map, string, register_constructor, resolve_factory_from_value } = window.__ELT__.Editor
      class TaggedMap extends Map {}
      const custom = map({ keys: string(), values: string() })
      register_constructor(TaggedMap, custom)
      return resolve_factory_from_value(new TaggedMap([["k", "v"]]), anything) === custom
    })
    expect(result).toBe(true)
  })
})
