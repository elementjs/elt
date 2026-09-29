import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("schema CommonNodeOptions", () => {
  test("composite Options accept shared node config fields", async ({ page }) => {
    const result = await page.evaluate(() => {
      const opts: import("../../editor/schema").ObjectOptions = {
        properties: [],
        open_as: "popup",
        conversions: ["string", "number"],
        toolbar: { search: false },
        free_keys: false,
      }
      return { open_as: opts.open_as, conversions: opts.conversions }
    })
    expect(result.open_as).toBe("popup")
    expect(result.conversions).toEqual(["string", "number"])
  })

  test("CommonNodeOptions shape is assignable on array/set/map options", async ({ page }) => {
    const result = await page.evaluate(() => {
      const common: import("../../editor/schema").CommonNodeOptions = { open_as: "column", conversions: ["object"] }
      return common.open_as
    })
    expect(result).toBe("column")
  })
})

test.describe("schema scalar option forwarding", () => {
  test("boolean() defaults to switch presentation", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { boolean } = window.__ELT__.Editor
      const o_val = o(true)
      const widget = boolean().render(o_val as any)
      node_append(document.body, widget.render() as HTMLElement)
      const input = document.querySelector("input[type=checkbox]") as HTMLInputElement
      return input.getAttribute("e-variant")
    })
    expect(result).toBe("switch")
  })

  test("number() forwards step to the native input", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { number } = window.__ELT__.Editor
      const o_val = o(2)
      const widget = number({ step: 0.5, min: 0 }).render(o_val as any)
      node_append(document.body, widget.render() as HTMLElement)
      const input = document.querySelector("input[type=number]") as HTMLInputElement
      return { step: input.step, min: input.min }
    })
    expect(result.step).toBe("0.5")
    expect(result.min).toBe("0")
  })

  test("number() exposes allow_non_finite opt-in on options", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { number } = window.__ELT__.Editor
      return {
        default_allow_non_finite: number().options.allow_non_finite,
        opted_in_allow_non_finite: number({ allow_non_finite: true }).options.allow_non_finite,
      }
    })
    expect(result.default_allow_non_finite).toBeUndefined()
    expect(result.opted_in_allow_non_finite).toBe(true)
  })
})

test.describe("schema undef combinator", () => {
  test("undef() builds a factory that handles undefined only", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { undef, UndefinedFactory } = window.__ELT__.Editor
      const factory = undef()
      return {
        isUndefinedFactory: factory instanceof UndefinedFactory,
        canHandleUndefined: factory.canHandle(undefined),
        canHandleNull: factory.canHandle(null),
      }
    })
    expect(result.isUndefinedFactory).toBe(true)
    expect(result.canHandleUndefined).toBe(true)
    expect(result.canHandleNull).toBe(false)
  })
})

test.describe("ObjectFactory keys", () => {
  test("unknown-mode object renders a row per own key", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { object } = window.__ELT__.Editor
      const o_root = o({ b: "two", a: "one" })
      const widget = object({ properties: [] }).render(o_root as any)
      const root = widget.render() as HTMLElement
      node_append(document.body, root)
      const list = root.querySelector("e-prose")!
      return [...list.querySelectorAll("e-flex > span")]
        .map((el) => el.textContent?.trim())
        .filter((t): t is string => !!t && t !== "+")
    })
    expect(result).toEqual(["a", "b"])
  })

  test("RegExp catch-all applies to unlisted keys", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { object, string } = window.__ELT__.Editor
      const schema = object({
        properties: [{ name: /^extra_/, type: string() }],
        free_keys: true,
      })
      const o_root = o({ extra_one: "x", other: "y" })
      const widget = schema.render(o_root as any)
      node_append(document.body, widget.render() as HTMLElement)
      return document.querySelectorAll("input[type=text]").length
    })
    expect(result).toBe(2)
  })

  test("object widget includes composite toolbar search", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { object } = window.__ELT__.Editor
      const o_root = o({ alpha: "one", beta: "two" })
      const widget = object({ properties: [] }).render(o_root as any)
      node_append(document.body, widget.header)
      node_append(document.body, widget.render() as HTMLElement)
      return {
        hasSearch: document.querySelector('input[type="search"]') !== null,
        hasMoreActions: document.querySelector('button[aria-label="More actions"]') !== null,
      }
    })
    expect(result.hasSearch).toBe(true)
    expect(result.hasMoreActions).toBe(true)
  })

  test("toolbar search: false removes the search field", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { object, string } = window.__ELT__.Editor
      const o_root = o({ only: "x" })
      const widget = object({ properties: [{ name: "only", type: string() }], toolbar: { search: false } }).render(
        o_root as any,
      )
      node_append(document.body, widget.header)
      node_append(document.body, widget.render() as HTMLElement)
      return document.querySelector('input[type="search"]') === null
    })
    expect(result).toBe(true)
  })

  test("free_keys: false hides add-key control and extra keys", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { object, string } = window.__ELT__.Editor
      const schema = object({
        properties: [{ name: "only", type: string() }],
        free_keys: false,
      })
      const o_root = o({ only: "x", secret: "y" })
      const widget = schema.render(o_root as any)
      node_append(document.body, widget.render() as HTMLElement)
      return {
        hasAddKey: [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("Add key")),
        textInputCount: document.querySelectorAll("input[type=text]").length,
      }
    })
    expect(result.hasAddKey).toBe(false)
    expect(result.textInputCount).toBe(1)
  })

  test("array table auto-detect helper matches uniform object rows", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { array, string } = window.__ELT__.Editor
      const f = array({ values: string() })
      return {
        uniform: f.eval_auto_table_for_table_mode([{ a: 1 }, { a: 2 }]),
        nonUniform: f.eval_auto_table_for_table_mode([1, 2]),
      }
    })
    expect(result.uniform).toBe(true)
    expect(result.nonUniform).toBe(false)
  })

  test("array list renders add-item control and appends on transient commit", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { array, string } = window.__ELT__.Editor
      const o_tags = o(["alpha"])
      const widget = array({ values: string(), item_default: "" }).render(o_tags as any)
      node_append(document.body, widget.render() as HTMLElement)

      const add = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Add item"))
      const addDefined = add !== undefined
      add?.click()

      const inputs = document.querySelectorAll('input[type="text"]')
      const input = inputs[inputs.length - 1] as HTMLInputElement
      input.value = "beta"
      input.dispatchEvent(new Event("input", { bubbles: true }))

      return { addDefined, tags: o_tags.get() }
    })
    expect(result.addDefined).toBe(true)
    expect(result.tags).toEqual(["alpha", "beta"])
  })

  test("select() wires elt/ui Select", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { select } = window.__ELT__.Editor
      const o_mood = o("happy")
      const widget = select({
        options: ["happy", "sad"],
        convert_fn: (s: string) => s,
      }).render(o_mood as any)
      node_append(document.body, widget.render() as HTMLElement)
      return document.querySelectorAll("button").length
    })
    expect(result).toBeGreaterThan(0)
  })

  test("map key cells expose a type-change menu by default", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { map, string, boolean } = window.__ELT__.Editor
      const o_flags = o(new Map([["enabled", true]]))
      const widget = map({ keys: string(), values: boolean() }).render(o_flags as any)
      node_append(document.body, widget.render() as HTMLElement)
      return [...document.querySelectorAll("button")].filter(
        (b) => b.getAttribute("aria-label") === "Change type",
      ).length
    })
    expect(result).toBeGreaterThan(0)
  })
})
