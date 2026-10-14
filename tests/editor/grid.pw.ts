import { type Page, expect, test } from "../fixture"

// Composite grid layout (Layer 2 header/toolbar, Layer 3 grid, Layer 4 "a widget is its cell").
// Geometry is read from the real layout, so these run in a real browser like every other test.

/** Waits three frames: laid out on the first, columns locked on the next (observe_layout defers). */
async function settle(page: Page) {
  await page.evaluate(() => window.__ELT__.frames(3))
}

test.describe("composite chrome", () => {
  test("the header is a single line: title, type label, actions and Undo/Redo or × share one line", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const o_root = o({ name: "Ada", address: { street: "Main", city: "London" } })
      const shell = new ObjectEditorShell(o_root, { packed: true })
      shell.node.id = "shell"
      node_append(document.body, shell.node)
      shell.node.querySelector<HTMLButtonElement>('button[title="Open address"]')!.click()
    })
    await settle(page)
    const lines = await page.evaluate(() => {
      const shell = document.getElementById("shell")!
      // A header line is the first child of each column.
      return [...shell.querySelectorAll("e-column[packed] > e-row:first-child")].map((row) => {
        const rects = [...row.children].map((c) => c.getBoundingClientRect()).filter((r) => r.height > 0)
        const first = rects[0]!
        return {
          text: (row.firstElementChild as HTMLElement).textContent,
          // Every piece overlaps the first one vertically: they sit on one line.
          one_line: rects.every((r) => r.top < first.bottom && r.bottom > first.top),
          buttons: [...row.querySelectorAll("button")].map((b) => b.textContent?.trim()),
        }
      })
    })
    expect(lines).toHaveLength(2)
    expect(lines[0]!.text).toBe("Object (2)")
    expect(lines[0]!.one_line).toBe(true)
    // Nothing to undo yet: no Undo/Redo.
    expect(lines[0]!.buttons).toEqual(["…", "Add"])
    expect(lines[1]!.text).toBe("address · Object (2)")
    expect(lines[1]!.one_line).toBe(true)
    expect(lines[1]!.buttons).toEqual(["…", "×", "Add"])
  })

  test("a popup gets the same single header line, with ×", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, number } = window.__ELT__.Editor
      const nested = object({ properties: [{ name: "x", type: number() }], open_as: "popup" })
      const shell = new ObjectEditorShell(o({ nested: { x: 1 } }), {
        packed: true,
        schema: object({ properties: [{ name: "nested", type: nested }] }),
      })
      node_append(document.body, shell.node)
      shell.node.querySelector<HTMLButtonElement>('button[title="Open nested"]')!.click()
      await window.__ELT__.frames(2)
      const panel = document.querySelector("[popover] e-column[packed]")!
      const header = panel.querySelector("e-row")!
      const res = {
        text: (header.firstElementChild as HTMLElement).textContent,
        buttons: [...header.querySelectorAll("button")].map((b) => b.textContent?.trim()),
        has_footer: panel.querySelector('input[type="search"]') !== null,
      }
      // Close it: popup.tsx keeps module-level state that would leak into later tests.
      document.body.dispatchEvent(new Event("click", { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
      return res
    })
    expect(result.text).toBe("nested · Object (1)")
    // No `…`: the declared single-type slot offers no type change, and a declared key can't be deleted.
    expect(result.buttons).toEqual(["×", "Add"])
    expect(result.has_footer).toBe(true)
  })

  test("toolbar: add button and filter; absent when neither filtering nor adding is allowed", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string } = window.__ELT__.Editor
      const free = new ObjectEditorShell(o({ a: "x" }), { packed: true })
      const closed = new ObjectEditorShell(o({ a: "x" }), {
        packed: true,
        schema: object({ properties: [{ name: "a", type: string() }], free_keys: false, show_filter: false }),
      })
      node_append(document.body, free.node)
      node_append(document.body, closed.node)
      const footer_of = (node: HTMLElement) => node.querySelector('e-row[surface="neutral-1"]')
      const free_footer = footer_of(free.node)
      return {
        // The Add button is on the header line, named in full by its tooltip.
        free_add: free.node.querySelector('button[title="Add key"]')?.textContent?.trim(),
        free_search: free_footer?.querySelector('input[type="search"]') != null,
        closed_footer: footer_of(closed.node) !== null,
      }
    })
    expect(result.free_add).toBe("Add")
    expect(result.free_search).toBe(true)
    expect(result.closed_footer).toBe(false)
  })
})

test.describe("composite grid", () => {
  test("every composite's widgets are the row's own cells, with no wrapper", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const values = {
        object: { a: "x", b: 2 },
        array: ["x", "y"],
        set: new Set(["x"]),
        map: new Map([["k", "v"]]),
        table: [
          { name: "Ada", n: 1 },
          { name: "Bob", n: 2 },
        ],
      }
      const res: Record<string, boolean> = {}
      for (const [kind, value] of Object.entries(values)) {
        const shell = new ObjectEditorShell(o<unknown>(value) as any)
        node_append(document.body, shell.node)
        const inputs = [...shell.node.querySelectorAll("e-grid input:not([type=checkbox])")]
        res[kind] = inputs.length > 0 && inputs.every((i) => i.parentElement?.tagName === "E-GRID-ROW")
      }
      return res
    })
    expect(result).toEqual({ object: true, array: true, set: true, map: true, table: true })
  })

  test("in the packed bordered grid an input cell has no border of its own, only the line before it", async ({
    page,
  }) => {
    const width = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const shell = new ObjectEditorShell(o({ a: "x" }), { packed: true })
      node_append(document.body, shell.node)
      const cs = getComputedStyle(shell.node.querySelector("e-grid-row > input")!)
      return [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth]
    })
    // top, right, bottom: none; left: the line between the key and the input, drawn by the input.
    expect(width).toEqual(["0px", "0px", "0px", "1px"])
  })

  test("every cell fills its grid area, a checkbox's included: no line breaks around it", async ({ page }) => {
    await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const shell = new ObjectEditorShell(o({ active: true, bio: "x", name: "Ada" }), { packed: true })
      shell.node.id = "shell"
      node_append(document.body, shell.node)
    })
    await settle(page)
    const result = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>("#shell e-grid")!
      const tracks = getComputedStyle(grid).gridTemplateColumns.split(" ").map(Number.parseFloat)
      const mismatches: string[] = []
      for (const row of grid.querySelectorAll("e-grid-row")) {
        // The row's content box: its own line above it (a row after the first draws one) is not a cell's.
        const rr = row.getBoundingClientRect()
        const top = rr.top + row.clientTop
        const bottom = top + row.clientHeight
        ;[...row.children].forEach((cell, i) => {
          const r = cell.getBoundingClientRect()
          if (Math.abs(r.width - tracks[i]!) > 0.5) mismatches.push(`${cell.tagName} width ${r.width} != ${tracks[i]}`)
          if (Math.abs(r.top - top) > 0.5 || Math.abs(r.bottom - bottom) > 0.5)
            mismatches.push(`${cell.tagName} height`)
        })
      }
      const checkbox = grid.querySelector("input[type=checkbox]")!
      return { mismatches, checkbox_cell: checkbox.parentElement?.tagName }
    })
    expect(result.mismatches).toEqual([])
    expect(result.checkbox_cell).toBe("LABEL")
  })

  test("labels and values line up across rows", async ({ page }) => {
    await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const shell = new ObjectEditorShell(o<unknown>(["short", "a much longer value here", 3]) as any)
      shell.node.id = "shell"
      node_append(document.body, shell.node)
    })
    await settle(page)
    const columns = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("#shell e-grid-row")]
      return rows.map((row) => [...row.children].map((c) => Math.round(c.getBoundingClientRect().left)))
    })
    expect(columns.length).toBe(3)
    expect(columns[0]!.length).toBe(2) // index | value (removing goes through the row's menu)
    for (const row of columns) expect(row).toEqual(columns[0])
  })

  test("the label column's width is locked after the first layout and doesn't follow scrolled rows", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      // Short keys first (sorted), a long one at the end, far below the first rendered window.
      const value: Record<string, string> = {}
      for (let i = 0; i < 300; i++) value[`k${String(i).padStart(3, "0")}`] = "v"
      value.zz_a_much_longer_key_name = "v"
      const shell = new ObjectEditorShell(o(value), { packed: true })
      shell.node.id = "shell"
      node_append(document.body, shell.node)
    })
    await settle(page)
    const measure = () =>
      page.evaluate(() => {
        const grid = document.querySelector<HTMLElement>("#shell e-grid")!
        return {
          template: grid.style.gridTemplateColumns,
          column: document.querySelector("#shell e-column[packed]")!.getBoundingClientRect().width,
          last_label: grid.querySelector("e-grid-row:last-of-type > :first-child")?.textContent,
        }
      })
    const before = await measure()
    expect(before.template).toMatch(/^\d+(\.\d+)?px minmax\(\d+(\.\d+)?px, 1fr\)$/)
    await page.evaluate(() => {
      const area = document.querySelector<HTMLElement>("#shell e-grid")!.parentElement!
      area.scrollTop = area.scrollHeight
    })
    await page.waitForFunction(
      () =>
        document.querySelector("#shell e-grid e-grid-row:last-of-type > :first-child")?.textContent ===
        "zz_a_much_longer_key_name",
    )
    await settle(page)
    const after = await measure()
    expect(after.template).toBe(before.template)
    expect(after.column).toBe(before.column)
  })

  test("a nested composite's cell shows its preview text and opens it", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const o_root = o({ address: { city: "London" } })
      const shell = new ObjectEditorShell(o_root)
      node_append(document.body, shell.node)
      const cell = shell.node.querySelector<HTMLButtonElement>('button[title="Open address"]')!
      const is_cell = cell.parentElement?.tagName === "E-GRID-ROW"
      const text = cell.textContent
      const icons = cell.querySelectorAll("svg").length
      cell.click()
      return { is_cell, text, icons, breadcrumb: shell.o_breadcrumb.get() }
    })
    expect(result.is_cell).toBe(true)
    // The type's icon, then the members: no braces around them.
    expect(result.text).toBe("city: London›")
    expect(result.icons).toBe(1)
    expect(result.breadcrumb).toEqual(["address"])
  })

  test("the table filter matches any cell of a row, not only the row's preview", async ({ page }) => {
    const labels = await page.evaluate(async () => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const rows = [
        { a: 1, b: 2, c: "first" },
        { a: 3, b: 4, c: "second" },
      ]
      const shell = new ObjectEditorShell(o<unknown>(rows) as any)
      node_append(document.body, shell.node)
      const search = shell.node.querySelector<HTMLInputElement>('input[type="search"]')!
      search.value = "second" // third column: beyond the two-key preview text
      search.dispatchEvent(new Event("input", { bubbles: true }))
      await window.__ELT__.frames(2)
      return [...shell.node.querySelectorAll("e-grid-row:not([sticky]) > :first-child")].map((c) => c.textContent)
    })
    expect(labels).toEqual(["1"])
  })
})

test.describe("cell widgets keep their element while editing", () => {
  test("typing in an unknown-mode field keeps focus in the same input", async ({ page }) => {
    await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const shell = new ObjectEditorShell(o({ name: "Ada" }))
      node_append(document.body, shell.node)
      ;(window as any).__root_shell = shell
    })
    const input = page.locator('e-grid-row > input[type="text"]').first()
    await input.click()
    await input.evaluate((el) => {
      ;(window as any).__typed_into = el
    })
    await page.keyboard.type("xyz")
    const result = await page.evaluate(() => ({
      same: document.activeElement === (window as any).__typed_into,
      value: (document.activeElement as HTMLInputElement).value,
    }))
    expect(result.same).toBe(true)
    expect(result.value).toBe("Adaxyz")
  })

  test("an either() cell keeps its input while the value keeps its type", async ({ page }) => {
    await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, either, string, number } = window.__ELT__.Editor
      const shell = new ObjectEditorShell(o({ v: "a" }), {
        schema: object({ properties: [{ name: "v", type: either(number(), string()) }] }),
      })
      node_append(document.body, shell.node)
    })
    const input = page.locator('e-grid-row > input[type="text"]').first()
    await input.click()
    await input.evaluate((el) => {
      ;(window as any).__typed_into = el
    })
    await page.keyboard.type("bc")
    const same = await page.evaluate(() => document.activeElement === (window as any).__typed_into)
    expect(same).toBe(true)
  })
})

test.describe("unknown mode resolution", () => {
  test("Map, Set and Date values get their own widgets, not Object's", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, anything, concrete_factory } = window.__ELT__.Editor
      const label = (value: unknown) => {
        const shell = new ObjectEditorShell(o(value) as any)
        node_append(document.body, shell.node)
        return shell.node.querySelector("e-row > strong")?.textContent
      }
      return {
        map: label(new Map([["a", 1]])),
        set: label(new Set([1])),
        date: concrete_factory(anything, new Date()).kind,
        instance: concrete_factory(anything, new (class Point {})()).kind,
      }
    })
    expect(result).toEqual({ map: "Map (1)", set: "Set (1)", date: "date", instance: "object" })
  })
})

test("opening and closing nested columns leaves the root's cells and locked widths in place", async ({ page }) => {
  await page.evaluate(() => {
    const { o, node_append } = window.__ELT__
    const { ObjectEditorShell } = window.__ELT__.Editor
    const shell = new ObjectEditorShell(o({ name: "Ada", a: { x: 1 }, b: { y: 2 } }))
    shell.node.id = "shell"
    node_append(document.body, shell.node)
  })
  await settle(page)
  const result = await page.evaluate(async () => {
    const shell = document.getElementById("shell")!
    const root_input = () => shell.querySelector('e-grid-row > input[type="text"]')
    const template = () => shell.querySelector<HTMLElement>("e-grid")!.style.gridTemplateColumns
    const before = { input: root_input(), template: template() }
    const frames = () => window.__ELT__.frames(2)
    shell.querySelector<HTMLButtonElement>('button[title="Open a"]')!.click()
    await frames()
    shell.querySelector<HTMLButtonElement>('button[title="Open b"]')!.click()
    await frames()
    shell.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click()
    await frames()
    return { same_input: root_input() === before.input, same_template: template() === before.template }
  })
  expect(result).toEqual({ same_input: true, same_template: true })
})

test("$resizable freezes a <table>'s header widths once it is laid out", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { node_append } = window.__ELT__
    const { $resizable } = window.__ELT__.Editor
    const table = document.createElement("table")
    table.innerHTML = "<thead><tr><th>short</th><th>a much longer header</th></tr></thead>"
    for (const th of table.querySelectorAll("th")) $resizable(th)
    // $resizable acts on connection: append through elt so its connected callbacks run.
    node_append(document.body, table)
    const before = table.style.tableLayout
    // Laid out on the first frame, frozen on the next (observe_layout defers to the next frame).
    await window.__ELT__.frames(3)
    const ths = [...table.querySelectorAll("th")]
    return {
      before,
      after: table.style.tableLayout,
      widths: ths.map((th) => Number.parseFloat(th.style.width)),
      laid_out: ths.map((th) => th.getBoundingClientRect().width),
    }
  })
  expect(result.before).toBe("")
  expect(result.after).toBe("fixed")
  for (const [i, w] of result.widths.entries()) expect(w).toBeCloseTo(result.laid_out[i]!, 2)
})

test.describe("column layout", () => {
  test("the toolbar sits right under the header line, above the rows", async ({ page }) => {
    const order = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const shell = new ObjectEditorShell(o({ a: "x" }), { packed: true })
      node_append(document.body, shell.node)
      const column = shell.node.querySelector("e-column[packed]")!
      return [...column.children].map((c) =>
        c.tagName === "E-ROW" ? (c.hasAttribute("surface") ? "toolbar" : "header") : c.tagName.toLowerCase(),
      )
    })
    expect(order).toEqual(["header", "toolbar", "e-column"])
  })

  test("columns are separate components: spaced apart, each with its own frame", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const shell = new ObjectEditorShell(o({ a: { b: 1 } }), { packed: true })
      node_append(document.body, shell.node)
      shell.node.querySelector<HTMLButtonElement>('button[title="Open a"]')!.click()
      const [first, second] = [...shell.node.querySelectorAll("e-column[packed]")] as HTMLElement[]
      return {
        gap: second!.getBoundingClientRect().left - first!.getBoundingClientRect().right,
        borders: [first!, second!].map((c) => getComputedStyle(c).borderLeftWidth),
        strip_border: getComputedStyle(shell.node).borderLeftWidth,
      }
    })
    expect(result.gap).toBeGreaterThan(0)
    expect(result.borders).toEqual(["1px", "1px"])
    expect(result.strip_border).toBe("0px")
  })

  test("a multiline string's textarea grows with its content", async ({ page }) => {
    const heights = await page.evaluate(async () => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string } = window.__ELT__.Editor
      const o_root = o({ bio: "one line" })
      const shell = new ObjectEditorShell(o_root, {
        schema: object({ properties: [{ name: "bio", type: string({ multiline: true }) }] }),
      })
      node_append(document.body, shell.node)
      const ta = shell.node.querySelector("textarea")!
      const frames = () => window.__ELT__.frames(2)
      await frames()
      const before = ta.getBoundingClientRect().height
      o_root.set({ bio: "1\n2\n3\n4\n5" })
      await frames()
      return { before, after: ta.getBoundingClientRect().height, overflow: getComputedStyle(ta).overflowY }
    })
    expect(heights.after).toBeGreaterThan(heights.before * 2)
    expect(heights.overflow).toBe("hidden")
  })
})

test.describe("search inputs are form controls (regression: input[type=search] kept the browser's own style)", () => {
  test("same font size and text color as a text input, in dark mode too", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    const result = await page.evaluate(() => {
      const { node_append } = window.__ELT__
      const make = (type: string) => {
        const input = document.createElement("input")
        input.type = type
        node_append(document.body, input)
        const cs = getComputedStyle(input)
        return { size: cs.fontSize, color: cs.color }
      }
      return { text: make("text"), search: make("search"), email: make("email") }
    })
    expect(result.search).toEqual(result.text)
    expect(result.email).toEqual(result.text)
    expect(result.search.color).not.toBe("rgb(0, 0, 0)")
  })
})

test.describe("focus ring of the first cell", () => {
  // Regression: every composite sat in a scroll area, which clips what is outside its padding box
  // even when nothing overflows, so the ring of a focused cell at the grid's edge was cut.
  const measure = (page: import("../fixture").Page, free_keys: boolean) =>
    page.evaluate((free_keys) => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string } = window.__ELT__.Editor
      const schema = object({
        properties: [
          { name: "name", type: string() },
          { name: "city", type: string() },
        ],
        free_keys,
      })
      const shell = new ObjectEditorShell(o({ name: "Ada", city: "London" }), { schema })
      node_append(document.body, shell.node)
      const input = shell.node.querySelector("input")!
      input.focus()
      const r = input.getBoundingClientRect()
      const ring = 2
      // Every ancestor of the cell, up to the editor's own strip, that clips must contain the ring.
      // (The strip itself still clips a flush, unpacked grid: see TODO.md.)
      const clipped_by: string[] = []
      for (let el = input.parentElement; el && el !== shell.node; el = el.parentElement) {
        const cs = getComputedStyle(el)
        if (cs.overflowX === "visible" && cs.overflowY === "visible") continue
        const c = el.getBoundingClientRect()
        const left = c.left + el.clientLeft
        const top = c.top + el.clientTop
        const inside =
          r.left - ring >= left &&
          r.top - ring >= top &&
          r.right + ring <= left + el.clientWidth &&
          r.bottom + ring <= top + el.clientHeight
        if (!inside) clipped_by.push(el.tagName.toLowerCase())
      }
      return { clipped_by, scrollers: shell.node.querySelectorAll("e-column[scroll]").length }
    }, free_keys)

  test("an object with a fixed set of keys has no scroll area around its grid: the ring is not clipped", async ({
    page,
  }) => {
    const r = await measure(page, false)
    expect(r.clipped_by).toEqual([])
    expect(r.scrollers).toBe(0)
  })

  test("an object that accepts free keys keeps its windowed, scrolling grid", async ({ page }) => {
    const r = await measure(page, true)
    expect(r.scrollers).toBeGreaterThan(0)
  })
})

// Regression class: a cell's input must survive edits of its own value. A row whose nodes are rebuilt
// when its item changes (a `.tf` returning the row's content, a row identified by the edited value)
// loses focus after one keystroke. One case per editable cell of each composite; `index` is the
// cell's position among the editor's text inputs.
const typing_cases = [
  {
    name: "Object property",
    value: `{ name: "Ada", city: "London" }`,
    schema: `object({ properties: [{ name: "name", type: string() }, { name: "city", type: string() }] })`,
    index: 0,
    expected: `{ name: "Adaxyz", city: "London" }`,
  },
  {
    name: "Array item",
    value: `["one", "two"]`,
    schema: `array({ mode: "list", values: string() })`,
    index: 0,
    expected: `["onexyz", "two"]`,
  },
  {
    name: "Table cell",
    value: `[{ name: "Ada", city: "London" }, { name: "Bob", city: "Paris" }]`,
    schema: `array({ mode: "table", values: object({ properties: [{ name: "name", type: string() }, { name: "city", type: string() }] }) })`,
    index: 0,
    expected: `[{ name: "Adaxyz", city: "London" }, { name: "Bob", city: "Paris" }]`,
  },
  {
    name: "Set member",
    value: `new Set(["algorithm", "math"])`,
    schema: `set({ values: string() })`,
    index: 0,
    expected: `new Set(["algorithmxyz", "math"])`,
  },
  {
    name: "Map key",
    value: `new Map([["alpha", "one"], ["beta", "two"]])`,
    schema: `map({ keys: string(), values: string() })`,
    index: 0,
    expected: `new Map([["alphaxyz", "one"], ["beta", "two"]])`,
  },
  {
    name: "Map value",
    value: `new Map([["alpha", "one"], ["beta", "two"]])`,
    schema: `map({ keys: string(), values: string() })`,
    index: 1,
    expected: `new Map([["alpha", "onexyz"], ["beta", "two"]])`,
  },
]

test.describe("typing into a cell keeps its focus, and the row its place", () => {
  for (const c of typing_cases) {
    for (const packed of [false, true]) {
      test(`${c.name} (${packed ? "packed" : "scroll area"})`, async ({ page }) => {
        // The case's source text is evaluated in the page, where the editor's constructors live.
        await page.evaluate(
          ({ value, schema, packed }) => {
            const { o, node_append } = window.__ELT__
            const { ObjectEditorShell, object, array, set, map, string } = window.__ELT__.Editor
            const o_root = o<unknown>(new Function("return " + value)())
            ;(window as any).o_root = o_root
            const factory = new Function("object", "array", "set", "map", "string", "return " + schema)(
              object,
              array,
              set,
              map,
              string,
            )
            node_append(document.body, new ObjectEditorShell(o_root as any, { schema: factory, packed }).node)
          },
          { value: c.value, schema: c.schema, packed },
        )
        await settle(page)
        await page.locator("e-grid input[type=text], e-grid input:not([type])").nth(c.index).click()
        await page.keyboard.press("End")
        // One key at a time: each keystroke is a separate edit, a rebuilt cell fails on the second.
        for (const key of "xyz") await page.keyboard.press(key)
        const result = await page.evaluate(
          ({ expected, index }) => {
            const inputs = [...document.querySelectorAll<HTMLInputElement>("e-grid input:not([type=checkbox])")]
            const model = (window as any).o_root.get()
            const want = new Function("return " + expected)()
            return {
              model: JSON.stringify(model, (_k, v) => (v instanceof Map ? [...v] : v instanceof Set ? [...v] : v)),
              want: JSON.stringify(want, (_k, v) => (v instanceof Map ? [...v] : v instanceof Set ? [...v] : v)),
              focused_is_the_cell: document.activeElement === inputs[index],
            }
          },
          { expected: c.expected, index: c.index },
        )
        expect(result.model).toBe(result.want)
        expect(result.focused_is_the_cell).toBe(true)
      })
    }
  }
})
