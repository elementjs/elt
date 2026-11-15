import { expect, test } from "../fixture"

test.describe("ObjectFactory keys", () => {
  test("unknown-mode object renders a row per own key", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { object } = window.__ELT__.Editor
      const o_root = o({ b: "two", a: "one" })
      const widget = object({ properties: [] }).render(o_root as any)
      const root = widget.render() as HTMLElement
      node_append(document.body, root)
      // The label cell is each row's first cell.
      return [...root.querySelectorAll("e-grid-row > :first-child")].map((el) => el.textContent?.trim())
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

  test("object widget's chrome: filter in its toolbar; the … menu is the shell's, not the widget's", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { object } = window.__ELT__.Editor
      const o_root = o({ alpha: "one", beta: "two" })
      const widget = object({ properties: [] }).render(o_root as any)
      const header = document.createElement("div")
      const toolbar = document.createElement("div")
      node_append(header, widget.header!.actions)
      node_append(toolbar, widget.toolbar!)
      node_append(document.body, header)
      node_append(document.body, toolbar)
      return {
        hasSearch: toolbar.querySelector('input[type="search"]') !== null,
        hasMoreActions: header.querySelector('button[aria-label="More actions"]') !== null,
      }
    })
    expect(result.hasSearch).toBe(true)
    expect(result.hasMoreActions).toBe(false)
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
        hasAddKey: [...document.querySelectorAll("button")].some((b) => b.getAttribute("aria-label") === "Add key"),
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
      node_append(document.body, widget.toolbar!)
      node_append(document.body, widget.header!.add as HTMLElement)

      const add = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Add item")
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

  // The transient rows of a composite commit on the first edit, through an observer on the row's own element
  // (regression: they were observed by hand, from the moment the row was added).
  test("set adds a member as soon as its transient row is edited", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { set, string } = window.__ELT__.Editor
      const o_tags = o(new Set(["alpha"]))
      const widget = set({ values: string(), item_default: "" }).render(o_tags as any)
      node_append(document.body, widget.render() as HTMLElement)
      node_append(document.body, widget.toolbar!)
      node_append(document.body, widget.header!.add as HTMLElement)

      const add = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Add member")
      add?.click()
      // Adding the row is not an edit: nothing is committed yet.
      const after_add = [...o_tags.get()]

      const inputs = document.querySelectorAll('input[type="text"]')
      const input = inputs[inputs.length - 1] as HTMLInputElement
      input.value = "beta"
      input.dispatchEvent(new Event("input", { bubbles: true }))

      return { after_add, tags: [...o_tags.get()] }
    })
    expect(result.after_add).toEqual(["alpha"])
    expect(result.tags).toEqual(["alpha", "beta"])
  })

  test("map adds an entry once its transient row has a valid key", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { map, string } = window.__ELT__.Editor
      const o_dict = o(new Map([["a", "1"]]))
      const widget = map({ keys: string(), values: string() }).render(o_dict as any)
      node_append(document.body, widget.render() as HTMLElement)
      node_append(document.body, widget.toolbar!)
      node_append(document.body, widget.header!.add as HTMLElement)

      const add = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Add entry")
      add?.click()
      const after_add = [...o_dict.get().entries()]

      // The first text field of the new row is its key.
      const inputs = document.querySelectorAll('input[type="text"]')
      const key_input = inputs[inputs.length - 2] as HTMLInputElement
      key_input.value = "b"
      key_input.dispatchEvent(new Event("input", { bubbles: true }))

      return { after_add, entries: [...o_dict.get().entries()] }
    })
    expect(result.after_add).toEqual([["a", "1"]])
    expect(result.entries.map(([k]) => k)).toEqual(["a", "b"])
  })
})
