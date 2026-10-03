import { expect, type Page, test } from "@playwright/test"

// The editor's context menus (row and header): docs/md/object-editor.md.

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

type W = Window & { o_root: { get(): any }; prevented: boolean[] }

/** Mount a shell on `value` with `schema` (built in the page from its source, `null` for unknown mode). */
async function mount(page: Page, value: string, schema: string | null = null) {
  await page.evaluate(
    ({ value, schema }) => {
      const { o, node_append } = window.__ELT__
      const E = window.__ELT__.Editor
      const w = window as unknown as W
      const o_root = o<unknown>(new Function("E", `return ${value}`)(E))
      w.o_root = o_root
      const shell = new E.ObjectEditorShell(o_root, schema ? { schema: new Function("E", `return ${schema}`)(E) } : {})
      shell.node.id = "shell"
      node_append(document.body, shell.node)
      // Records, after every listener ran, whether the browser's own menu was suppressed.
      w.prevented = []
      window.addEventListener("contextmenu", (ev) => w.prevented.push(ev.defaultPrevented))
    },
    { value, schema },
  )
}

// Menus are looked up under `[popover].open`: a closed menu stays in the DOM while it fades out (no
// longer `.open`), and a menu opened right after would otherwise match twice.

/** The open menus, outermost first: each its headers and items, in order. */
function menus(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[popover].open [role="menu"]')].map((menu) =>
      [...menu.children].map((c) =>
        c.tagName === "HR" ? "---" : c.tagName === "H3" ? `# ${c.textContent}` : (c.textContent ?? "").trim(),
      ),
    ),
  )
}

const row = (page: Page, label: string) => page.locator("#shell e-grid-row", { hasText: label }).first()
const root = (page: Page) => page.evaluate(() => (window as unknown as W).o_root.get())

test.describe("row menu", () => {
  test("unknown mode: Value type change and a red Delete with the trash icon; Delete removes, Undo restores", async ({
    page,
  }) => {
    await mount(page, `({ name: "Ada", age: 36 })`)
    await row(page, "name").locator("> :first-child").click({ button: "right" })
    await expect.poll(() => menus(page)).toEqual([["# Value", "Change type…", "---", "Delete"]])
    const del = page.locator('[popover].open [role="menuitem"]', { hasText: "Delete" })
    expect(await del.locator("svg").count()).toBe(1)
    // Red-tinted: its color differs from the other items'.
    const other = page.locator('[popover].open [role="menuitem"]', { hasText: "Change type…" })
    const color = (l: typeof del) => l.evaluate((el) => getComputedStyle(el).color)
    expect(await color(del)).not.toBe(await color(other))

    await del.click()
    expect(await root(page)).toEqual({ age: 36 })
    await expect(page.locator("[popover]")).toHaveCount(0)
    await page.locator("#shell button", { hasText: "Undo" }).click()
    expect(await root(page)).toEqual({ name: "Ada", age: 36 })
  })

  test("Change type… opens the types of the slot; picking one changes the value and closes both menus", async ({
    page,
  }) => {
    await mount(page, `({ flag: "abc" })`)
    await row(page, "flag").locator("> :first-child").click({ button: "right" })
    await page.locator('[popover].open [role="menuitem"]', { hasText: "Change type…" }).click()
    await expect.poll(async () => (await menus(page)).length).toBe(2)
    const all = await menus(page)
    expect(all[1]![0]).toBe("# Value type")
    // A string can't become a boolean: reset to its default.
    expect(all[1]).toContain("boolean (reset)")
    expect(all[1]).not.toContain("string")
    await page.locator('[popover].open [role="menuitem"]', { hasText: "boolean (reset)" }).click()
    expect(await root(page)).toEqual({ flag: false })
    await expect(page.locator("[popover]")).toHaveCount(0)
  })

  test("Escape closes the submenu only, then the menu", async ({ page }) => {
    await mount(page, `({ flag: "abc" })`)
    await row(page, "flag").locator("> :first-child").click({ button: "right" })
    await page.locator('[popover].open [role="menuitem"]', { hasText: "Change type…" }).click()
    await expect.poll(async () => (await menus(page)).length).toBe(2)
    await page.keyboard.press("Escape")
    await expect.poll(async () => (await menus(page)).length).toBe(1)
    // Focus is back in the menu: the keys still drive it.
    await page.waitForFunction(() => document.activeElement?.closest('[role="menu"]') != null)
    await page.keyboard.press("Escape")
    await expect(page.locator("[popover]")).toHaveCount(0)
  })

  test("a declared either() slot offers only its other branches", async ({ page }) => {
    await mount(
      page,
      `({ v: "x" })`,
      `E.object({ properties: [{ name: "v", type: E.either(E.string(), E.number()) }], free_keys: false })`,
    )
    await row(page, "v").locator("> :first-child").click({ button: "right" })
    await expect.poll(() => menus(page)).toEqual([["# Value", "Change type…"]])
    await page.locator('[popover].open [role="menuitem"]', { hasText: "Change type…" }).click()
    await expect.poll(async () => (await menus(page))[1]).toEqual(["# Value type", "number (reset)"])
  })

  test("nothing to offer: the browser's own menu, no popup", async ({ page }) => {
    await mount(page, `({ a: "x" })`, `E.object({ properties: [{ name: "a", type: E.string() }], free_keys: false })`)
    await row(page, "a").locator("> :first-child").click({ button: "right" })
    expect(await page.evaluate(() => (window as unknown as W).prevented)).toEqual([false])
    await expect(page.locator("[popover]")).toHaveCount(0)
  })

  test("in a text field: the row's menu with an Edit section first, replacing the browser's", async ({ page }) => {
    await mount(page, `({ name: "Ada" })`)
    const input = row(page, "name").locator("input")
    await input.click({ button: "right" })
    await expect
      .poll(() => menus(page))
      .toEqual([["# Edit", "Cut", "Copy", "Paste", "Select all", "---", "# Value", "Change type…", "---", "Delete"]])
    expect(await page.evaluate(() => (window as unknown as W).prevented)).toEqual([true])
  })

  test("Edit: Copy, Cut and Paste act on the field's selection and reach the model", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await mount(page, `({ name: "Ada Lovelace" })`)
    const input = row(page, "name").locator("input")
    const item = (label: string) => page.locator('[popover].open [role="menuitem"]', { hasText: label })
    /** Select `from..to` in the field as the user would, then right click inside the selection. */
    const menu_on = async (from: number, to: number) => {
      await input.focus()
      await input.evaluate((el: HTMLInputElement, [a, b]) => el.setSelectionRange(a, b), [from, to])
      await input.click({ button: "right", position: { x: 6, y: 6 } })
    }
    // Select "Ada" (0..3), cut it.
    await menu_on(0, 3)
    await item("Cut").click()
    await expect.poll(() => root(page)).toEqual({ name: " Lovelace" })
    // Paste: a right click outside the selection moves the caret where it lands (the start), as
    // natively; the clipboard goes there.
    await menu_on(9, 9)
    await item("Paste").click()
    await expect.poll(() => root(page)).toEqual({ name: "Ada Lovelace" })
    // Nothing selected: Cut and Copy are disabled, Paste isn't.
    await menu_on(2, 2)
    await expect(item("Cut")).toBeDisabled()
    await expect(item("Copy")).toBeDisabled()
    await expect(item("Paste")).toBeEnabled()
    await page.keyboard.press("Escape")
  })

  test("Shift+F10 in a text field opens the row's menu under it", async ({ page }) => {
    await mount(page, `({ name: "Ada" })`)
    await row(page, "name").locator("input").focus()
    await page.keyboard.press("Shift+F10")
    await expect(page.locator('[popover].open [role="menu"]')).toHaveCount(1)
    // The keydown was prevented: no contextmenu event of the browser's on top.
    expect(await page.evaluate(() => (window as unknown as W).prevented)).toEqual([])
  })

  test("the keyboard drives the menu: arrows, Enter", async ({ page }) => {
    await mount(page, `({ name: "Ada", other: 1 })`)
    await row(page, "name").locator("> :first-child").click({ button: "right" })
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menu")
    await page.keyboard.press("ArrowDown") // Change type… → Delete
    await page.keyboard.press("Enter")
    expect(await root(page)).toEqual({ other: 1 })
  })

  test("Map rows: Key and Value sections", async ({ page }) => {
    await mount(page, `new Map([["k", 1]])`)
    // The key is a text field: its menu starts with Edit.
    await page.locator("#shell e-grid-row").first().locator("input").first().click({ button: "right" })
    await expect
      .poll(() => menus(page))
      .toEqual([
        [
          "# Edit",
          "Cut",
          "Copy",
          "Paste",
          "Select all",
          "---",
          "# Key",
          "Change type…",
          "---",
          "# Value",
          "Change type…",
          "---",
          "Delete",
        ],
      ])
  })

  test("Table rows: the right-clicked cell's column, then Delete; the index cell gives Delete only", async ({
    page,
  }) => {
    await mount(page, `[{ a: 1, b: "x" }, { a: 2, b: "y" }]`)
    const first = page.locator("#shell e-grid-row").nth(1) // after the sticky head row
    await first.locator("> :nth-child(3)").click({ button: "right", position: { x: 2, y: 2 } })
    await expect
      .poll(() => menus(page))
      .toEqual([["# Edit", "Cut", "Copy", "Paste", "Select all", "---", "# b", "Change type…", "---", "Delete"]])
    await page.keyboard.press("Escape")
    await first.locator("> :first-child").click({ button: "right" })
    await expect.poll(() => menus(page)).toEqual([["Delete"]])
    await page.locator('[popover].open [role="menuitem"]', { hasText: "Delete" }).click()
    expect(await root(page)).toEqual([{ a: 2, b: "y" }])
  })

  test("a row not committed yet: Delete discards it", async ({ page }) => {
    await mount(page, `[1]`)
    await page.locator("#shell button", { hasText: "Add item" }).click()
    await expect(page.locator("#shell e-grid-row")).toHaveCount(2)
    await page.locator("#shell e-grid-row").nth(1).locator("> :first-child").click({ button: "right" })
    await expect.poll(() => menus(page)).toEqual([["Delete"]])
    await page.locator('[popover].open [role="menuitem"]', { hasText: "Delete" }).click()
    await expect(page.locator("#shell e-grid-row")).toHaveCount(1)
    expect(await root(page)).toEqual([1])
  })
})

test.describe("header menu", () => {
  test("root: the … button and a right click give the type change, no Delete", async ({ page }) => {
    await mount(page, `({ a: 1 })`)
    const header = page.locator("#shell e-column[packed] > e-row").first()
    await header.locator('button[aria-label="More actions"]').click()
    await expect.poll(() => menus(page)).toEqual([["# Value", "Change type…"]])
    await page.keyboard.press("Escape")
    await header.locator("strong").click({ button: "right" })
    await expect.poll(() => menus(page)).toEqual([["# Value", "Change type…"]])
  })

  test("an opened column's Delete removes the value from its parent and closes the column", async ({ page }) => {
    await mount(page, `({ address: { city: "London" }, b: 1 })`)
    await page.locator('#shell button[title="Open address"]').click()
    const columns = page.locator("#shell e-column[packed][border]:not(e-column e-column)")
    const city_label = page.locator('#shell e-grid-row > span[title="city"]')
    await expect(city_label).toHaveCount(1)
    const header = page.locator("#shell e-row > e-column > e-row", { hasText: "address" })
    await header.locator('button[aria-label="More actions"]').click()
    await expect.poll(() => menus(page)).toEqual([["# Value", "Change type…", "---", "Delete"]])
    await page.locator('[popover].open [role="menuitem"]', { hasText: "Delete" }).click()
    expect(await root(page)).toEqual({ b: 1 })
    await expect(city_label).toHaveCount(0)
    expect(await columns.count()).toBeGreaterThan(0)
  })
})
