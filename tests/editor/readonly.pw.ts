import { expect, type Page, test } from "../fixture"

// `readonly` (docs/md/object-editor.md): nothing the user does in the editor changes the model, while
// opening values, the filter and the browser's own text keys keep working.

type W = Window & { o_root: { get(): any; set(v: any): void }; o_ro: { set(v: boolean): void } }

/** Mount a shell on `value` with `schema` (built in the page from its source), read-only through `window.o_ro`. */
async function mount(page: Page, value: string, schema: string | null = null, readonly = true) {
  await page.evaluate(
    ({ value, schema, readonly }) => {
      const { o, node_append } = window.__ELT__
      const E = window.__ELT__.Editor
      const w = window as unknown as W
      const o_root = o<unknown>(new Function("E", `return ${value}`)(E))
      const o_ro = o(readonly)
      w.o_root = o_root
      w.o_ro = o_ro
      const shell = new E.ObjectEditorShell(o_root, {
        packed: true,
        readonly: o_ro,
        ...(schema ? { schema: new Function("E", `return ${schema}`)(E) } : {}),
      })
      shell.node.id = "shell"
      node_append(document.body, shell.node)
    },
    { value, schema, readonly },
  )
}

const root = (page: Page) => page.evaluate(() => (window as unknown as W).o_root.get())
const set_ro = (page: Page, v: boolean) => page.evaluate((v) => (window as unknown as W).o_ro.set(v), v)
const row = (page: Page, label: string) => page.locator("#shell e-grid-row", { hasText: label }).first()
const count = (page: Page, sel: string) => page.locator(sel).count()
/** What the fields show, the filter aside: the root refuses writes anyway, so this is what proves the controls didn't edit. */
const fields = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLInputElement>("#shell input:not([type=search]), #shell textarea")].map((el) =>
      el.type === "checkbox" ? el.checked : el.value,
    ),
  )

const RECORD = `({ name: "Ada", age: 36, active: true, role: "author", born: new Date(1815, 11, 10), note: null, sub: { city: "London" } })`
const RECORD_SCHEMA = `E.object({ properties: [
  { name: "name", type: E.string() },
  { name: "age", type: E.number() },
  { name: "active", type: E.boolean() },
  { name: "role", type: E.select({ options: ["author", "editor"] }) },
  { name: "born", type: E.date({ date: true }) },
  { name: "note", type: E.either(E.null_factory, E.string()) },
  { name: "sub", type: E.object({ properties: [{ name: "city", type: E.string() }] }) },
] })`

test.describe("readonly editor", () => {
  test("typing, arrows, the switch, the select, the date and a blur leave the model as it was", async ({ page }) => {
    await mount(page, RECORD, RECORD_SCHEMA)
    const before = await root(page)
    const shown = await fields(page)
    await row(page, "name").locator("input").click()
    await page.keyboard.type("xyz")
    await page.keyboard.press("Backspace")
    await row(page, "age").locator("input").click()
    await page.keyboard.press("ArrowUp")
    await page.keyboard.type("9")
    // Disabled controls: a forced click is what a user's click does on them.
    await row(page, "active").locator("label").click({ force: true })
    await row(page, "role").locator("button").click({ force: true })
    await row(page, "born").locator("input").click()
    await page.keyboard.type("01")
    await page.keyboard.press("ArrowUp")
    await page.locator("#shell input[type=search]").click()
    expect(await root(page)).toEqual(before)
    expect(await fields(page)).toEqual(shown)
    // The select's list never opened.
    expect(await count(page, '[popover].open [role="listbox"]')).toBe(0)
  })

  test("no Add, Undo/Redo, … button or null type button; the null shows as text", async ({ page }) => {
    await mount(page, `({ a: "x", n: null })`)
    // An edit before going read-only, so Undo would show.
    await set_ro(page, false)
    await row(page, "a").locator("input").fill("y")
    await page.locator("#shell input[type=search]").click()
    expect(await count(page, '#shell button[aria-label="Undo"]')).toBe(1)
    await set_ro(page, true)
    expect(await count(page, '#shell button[aria-label="Undo"]')).toBe(0)
    expect(await count(page, '#shell button[aria-label="Add key"]')).toBe(0)
    expect(await count(page, '#shell button[aria-label="More actions"]')).toBe(0)
    expect(await count(page, '#shell button[aria-haspopup="menu"]')).toBe(0)
    await expect(row(page, "n")).toContainText("null")
  })

  test("a row's menu is the browser's; in a text field, only Copy and Select all are available", async ({ page }) => {
    await mount(page, `({ a: "x", sub: { b: 1 } })`)
    const prevented = await row(page, "a")
      .locator("> :first-child")
      .evaluate((el) => {
        const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 })
        el.dispatchEvent(ev)
        return ev.defaultPrevented
      })
    expect(prevented).toBe(false)
    // The header line has no menu either.
    await page.locator("#shell strong").first().click({ button: "right" })
    expect(await count(page, '[popover].open [role="menu"]')).toBe(0)

    await row(page, "a")
      .locator("input")
      .evaluate((el: HTMLInputElement) => el.select())
    await row(page, "a").locator("input").click({ button: "right" })
    const items = page.locator('[popover].open [role="menuitem"]')
    await expect(items).toHaveText(["Cut", "Copy", "Paste", "Select all"])
    const enabled = await items.evaluateAll((els) => els.map((el) => !(el as HTMLButtonElement).disabled))
    expect(enabled).toEqual([false, true, false, true])
  })

  test("Ctrl+Z does not bring back a value the model had before an outside write", async ({ page }) => {
    await mount(page, `({ a: "x", sub: { b: 1 } })`, null, false)
    await row(page, "a").locator("input").fill("y")
    await page.locator("#shell input[type=search]").click()
    await set_ro(page, true)
    await page.evaluate(() => (window as unknown as W).o_root.set({ a: "outside", sub: { b: 2 } }))
    // Focus on a button inside the editor, not a text field.
    await row(page, "sub").locator("button").focus()
    await page.keyboard.press("ControlOrMeta+z")
    expect(await root(page)).toEqual({ a: "outside", sub: { b: 2 } })
    // The root refuses the write anyway: no Redo once editable again shows the shortcut did nothing.
    await set_ro(page, false)
    expect(await count(page, '#shell button[aria-label="Redo"]')).toBe(0)
  })

  test("opening a value and the filter still work; what opens is read-only too", async ({ page }) => {
    await mount(page, `({ alpha: "x", beta: "y", sub: { b: "z" } })`)
    await page.locator("#shell input[type=search]").fill("alp")
    await expect(page.locator("#shell e-grid-row")).toHaveCount(1)
    await page.locator("#shell input[type=search]").fill("")
    await row(page, "sub").locator("button").click()
    const column = page.locator("#shell e-column[packed]").nth(1)
    await expect(column).toBeVisible()
    await column.locator("e-grid-row input").click()
    await page.keyboard.type("!")
    await expect(column.locator("e-grid-row input")).toHaveValue("z")
  })

  test("turned off then on, the editor follows: Add and editing come back, then go", async ({ page }) => {
    await mount(page, `({ a: "x" })`)
    await set_ro(page, false)
    expect(await count(page, '#shell button[aria-label="Add key"]')).toBe(1)
    await row(page, "a").locator("input").fill("y")
    expect(await root(page)).toEqual({ a: "y" })
    await set_ro(page, true)
    expect(await count(page, '#shell button[aria-label="Add key"]')).toBe(0)
    await row(page, "a").locator("input").click()
    await page.keyboard.type("z")
    await expect(row(page, "a").locator("input")).toHaveValue("y")
  })

  test("a scalar root can't be edited", async ({ page }) => {
    await mount(page, `"text"`)
    await page.locator("#shell input").first().click()
    await page.keyboard.type("more")
    await expect(page.locator("#shell input").first()).toHaveValue("text")
  })

  test("a table has no Add and its cells can't be edited", async ({ page }) => {
    await mount(page, `[{ n: "a", v: 1 }, { n: "b", v: 2 }]`)
    expect(await count(page, '#shell button[aria-label="Add item"]')).toBe(0)
    await page.locator("#shell e-grid-row input").first().click()
    await page.keyboard.type("q")
    await expect(page.locator("#shell e-grid-row input").first()).toHaveValue("a")
  })
})

test.describe("readonly schema option", () => {
  test("a node's readonly holds for it and what it opens, while the rest stays editable", async ({ page }) => {
    await mount(
      page,
      `({ a: "x", locked: { b: "y", deeper: { c: "z" } } })`,
      `E.object({ properties: [
        { name: "a", type: E.string() },
        { name: "locked", type: E.object({ readonly: true, properties: [
          { name: "b", type: E.string() },
          { name: "deeper", type: E.object({ properties: [{ name: "c", type: E.string() }] }) },
        ] }) },
      ] })`,
      false,
    )
    await row(page, "locked").locator("button").click()
    const locked = page.locator("#shell e-column[packed]").nth(1)
    await locked.locator("e-grid-row", { hasText: "deeper" }).locator("button").click()
    const deeper = page.locator("#shell e-column[packed]").nth(2)
    await locked.locator("e-grid-row", { hasText: "b" }).locator("input").click()
    await page.keyboard.type("1")
    await deeper.locator("e-grid-row input").click()
    await page.keyboard.type("2")
    await row(page, "a").locator("input").fill("edited")
    expect(await root(page)).toEqual({ a: "edited", locked: { b: "y", deeper: { c: "z" } } })
  })

  test('a field\'s own readonly: "" stays read-only in an editable editor', async ({ page }) => {
    await mount(
      page,
      `({ a: "x" })`,
      `E.object({ properties: [{ name: "a", type: E.string({ readonly: "" }) }] })`,
      false,
    )
    await row(page, "a").locator("input").click()
    await page.keyboard.type("1")
    await expect(row(page, "a").locator("input")).toHaveValue("x")
  })

  test("readonly: false on a node does not undo the editor's readonly", async ({ page }) => {
    await mount(page, `({ a: "x" })`, `E.object({ readonly: false, properties: [{ name: "a", type: E.string() }] })`)
    await row(page, "a").locator("input").click()
    await page.keyboard.type("1")
    await expect(row(page, "a").locator("input")).toHaveValue("x")
  })
})

test("ObjectEditor's readonly attribute: the root refuses writes from a widget that ignores it", async ({ page }) => {
  const result = await page.evaluate(() => {
    const { o } = window.__ELT__
    const { untyped_root, anything } = window.__ELT__.Editor
    const o_model = o<unknown>({ a: 1 })
    const o_ro = o(true)
    const o_root = untyped_root(o_model, anything, o_ro)
    o_root.set({ a: 2 })
    const refused = o_model.get()
    o_ro.set(false)
    o_root.set({ a: 3 })
    return { refused, written: o_model.get() }
  })
  expect(result).toEqual({ refused: { a: 1 }, written: { a: 3 } })
})

test.describe("readonly for good: a model that can't be written", () => {
  /** Mount `<ObjectEditor readonly>` on an `o.expression` of `window.o_src`, or on the plain value itself. */
  async function mount_ro(page: Page, plain: boolean) {
    await page.evaluate((plain) => {
      const { o, node_append } = window.__ELT__
      const E = window.__ELT__.Editor
      const o_src = o<unknown>({ a: "x", sub: { b: 1 } })
      ;(window as unknown as { o_src: typeof o_src }).o_src = o_src
      const model = plain ? { a: "x", sub: { b: 1 } } : o.expression((get) => get(o_src))
      const el = E.ObjectEditor({ model, readonly: true, packed: true })
      el.id = "shell"
      node_append(document.body, el)
    }, plain)
  }
  const set_src = (page: Page, v: unknown) =>
    page.evaluate((v) => (window as unknown as { o_src: { set(v: unknown): void } }).o_src.set(v), v)

  for (const plain of [false, true]) {
    test(`over ${plain ? "a plain value" : "a ReadonlyObservable"}: shown, and typing changes nothing`, async ({
      page,
    }) => {
      await mount_ro(page, plain)
      const input = row(page, "a").locator("input")
      await expect(input).toHaveValue("x")
      await input.click()
      await page.keyboard.type("y")
      await page.locator("#shell input[type=search]").click()
      await expect(input).toHaveValue("x")
    })
  }

  test("follows its source; no Undo button, and Ctrl+Z after an outside write brings nothing back", async ({
    page,
  }) => {
    await mount_ro(page, false)
    await set_src(page, { a: "outside", sub: { b: 2 } })
    await expect(row(page, "a").locator("input")).toHaveValue("outside")
    // Focus on a button inside the editor, not a text field, whose own undo the browser keeps.
    await row(page, "sub").locator("button").focus()
    await page.keyboard.press("ControlOrMeta+z")
    await expect(row(page, "a").locator("input")).toHaveValue("outside")
    expect(await count(page, '#shell button[aria-label="Undo"]')).toBe(0)
  })

  test("the root drops a write from a widget that ignores the setting", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { untyped_root, anything } = window.__ELT__.Editor
      const o_src = o({ a: 1 })
      const o_root = untyped_root(
        o.expression((get) => get(o_src)),
        anything,
        true,
      )
      o_root.set({ a: 2 })
      const after_write = o_root.get()
      o_src.set({ a: 3 })
      return { after_write, now: o_root.get() }
    })
    expect(result).toEqual({ after_write: { a: 1 }, now: { a: 3 } })
  })
})
