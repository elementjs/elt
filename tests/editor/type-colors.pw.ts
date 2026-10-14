import { expect, type Page, test } from "../fixture"

// The editor's type colors and icons (editor/type-style.ts): a column's frame, header line and toolbar,
// the drill-in buttons, the leaf widgets and the Change type menu all take the color of the type they show.

type W = Window & { o_root: { get(): any } }

async function mount(page: Page, value: string) {
  await page.emulateMedia({ colorScheme: "light" })
  await page.evaluate((value) => {
    const { o, node_append } = window.__ELT__
    const E = window.__ELT__.Editor
    const o_root = o<unknown>(new Function("E", `return ${value}`)(E))
    ;(window as unknown as W).o_root = o_root
    const shell = new E.ObjectEditorShell(o_root, { packed: true })
    shell.node.id = "shell"
    node_append(document.body, shell.node)
  }, value)
}

/** The theme color `expr` (e.g. `cyan`, `cyan.mid`, `tint.ink` under `tint_of`) as the browser computes it, next to the shell. */
function resolve(page: Page, expr: string, tint_of?: string) {
  return page.evaluate(
    ({ expr, tint_of }) => {
      const { theme } = window.__ELT__.UI
      const colors = theme.colors as unknown as Record<string, any>
      const mix = expr.split(".").reduce((m, k) => m[k], colors)
      const probe = document.createElement("div")
      if (tint_of) probe.classList.add(colors[tint_of].class_as_tint)
      probe.style.color = mix.toString()
      document.getElementById("shell")?.after(probe)
      const result = getComputedStyle(probe).color
      probe.remove()
      return result
    },
    { expr, tint_of },
  )
}

const header = (page: Page) => page.locator("#shell e-column > e-row").first()
const style_of = (loc: ReturnType<typeof header>, prop: "backgroundColor" | "borderTopColor" | "color") =>
  loc.evaluate((el, prop) => getComputedStyle(el)[prop], prop)

/** The tint (`--e-color-tint`) in force on the element, as a color. */
const tint_of = (loc: ReturnType<typeof header>) =>
  loc.evaluate((el) => {
    const probe = document.createElement("div")
    probe.style.color = "var(--e-color-tint)"
    el.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  })

/** The type colors: a root value's column is tinted with it, framed with it, and its title is at its ink. */
const COLUMNS: [string, string, string][] = [
  ["a plain object", `({ a: 1 })`, "cyan"],
  ["an array", `[1, 2]`, "green"],
  ["a set", `new Set([1])`, "yellow_green"],
  ["a map", `new Map([["k", 1]])`, "cyan_green"],
  ["a class instance", `new (class Foo { a = 1 })()`, "orange"],
]

test.describe("columns", () => {
  for (const [name, value, color] of COLUMNS) {
    test(`${name}: the column is tinted ${color}, framed in ${color}.mid, its title is ${color} ink`, async ({
      page,
    }) => {
      await mount(page, value)
      const column = page.locator("#shell e-column").first()
      expect(await tint_of(column)).toBe(await resolve(page, color))
      expect(await style_of(column, "borderTopColor")).toBe(await resolve(page, `${color}.mid`))
      expect(await style_of(header(page).locator("> strong"), "color")).toBe(await resolve(page, "tint.ink", color))
      // Not an inverted band any more: the header keeps the surface of the column.
      expect(await style_of(header(page), "backgroundColor")).not.toBe(await resolve(page, color))
    })
  }

  test("the header line has the type's icon before the title and the number of entries in parentheses", async ({
    page,
  }) => {
    await mount(page, `({ a: 1, b: 2, c: 3 })`)
    const title = header(page).locator("> strong")
    expect(await title.locator("svg").count()).toBe(1)
    expect(((await title.textContent()) ?? "").trim()).toBe("Object (3)")
    // The icon comes before the text.
    expect(await title.evaluate((el) => el.firstElementChild?.tagName.toLowerCase() === "span")).toBe(true)
  })

  test("changing the type recolors the column (a plain object becomes an array)", async ({ page }) => {
    await mount(page, `({ a: 1 })`)
    await page.evaluate(() => (window as unknown as { o_root: { set(v: unknown): void } }).o_root.set([1]))
    const column = page.locator("#shell e-column").first()
    await expect.poll(() => tint_of(column)).toBe(await resolve(page, "green"))
  })

  test("a table's header and seams follow the column's type color, not the theme's", async ({ page }) => {
    await mount(page, `[{ a: 1 }, { a: 2 }]`)
    const head = page.locator("#shell e-grid-row[sticky='top']").first()
    expect(await tint_of(head)).toBe(await resolve(page, "green"))
  })

  test("the buttons of the header line have the type's ink color", async ({ page }) => {
    await mount(page, `[1]`)
    const more = page.locator("#shell button[aria-label='More actions']")
    expect(await style_of(more, "color")).toBe(await resolve(page, "tint.ink", "green"))
  })

  test("an unpacked column is tinted too", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" })
    await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const shell = new window.__ELT__.Editor.ObjectEditorShell(o<unknown>([1]), { packed: false })
      shell.node.id = "shell"
      node_append(document.body, shell.node)
    })
    expect(await tint_of(page.locator("#shell e-column").first())).toBe(await resolve(page, "green"))
  })
})

test.describe("nested values", () => {
  test("a drill-in button is of its value's type: tinted, its text at ink, no border of its own", async ({ page }) => {
    await mount(page, `({ o: { x: 1 }, l: [1], s: new Set([1]), m: new Map([["k", 1]]) })`)
    for (const [key, color] of [
      ["o", "cyan"],
      ["l", "green"],
      ["s", "yellow_green"],
      ["m", "cyan_green"],
    ]) {
      const button = page.locator("#shell e-grid-row", { hasText: key }).first().locator("button[title^='Open']")
      expect(await style_of(button, "color"), key).toBe(await resolve(page, "tint.ink", color))
      expect(await tint_of(button), key).toBe(await resolve(page, color))
    }
  })

  test("leaf widgets: null is a lowercase literal and a number is text at their type's ink, a string is plain", async ({
    page,
  }) => {
    await mount(page, `({ n: null, x: 3, s: "hi", b: true })`)
    const row = (key: string) => page.locator("#shell e-grid-row", { hasText: key }).first()
    const literal = row("n").locator("span", { hasText: /^null$/ })
    await expect(literal).toHaveCount(1)
    expect(await style_of(literal, "color")).toBe(await resolve(page, "tint.ink", "magenta"))
    const number = row("x").locator("input[type=number]")
    expect(await style_of(number, "color")).toBe(await resolve(page, "tint.ink", "purple"))
    // No border of its own in a packed grid: cells draw none.
    expect(await number.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("0px")
    expect(await style_of(row("s").locator("input[type=text]"), "color")).toBe(await resolve(page, "text"))
    // A switch writes no text: it follows the column's tint, not magenta.
    expect(await tint_of(row("b").locator("label"))).toBe(await resolve(page, "cyan"))
  })
})

test.describe("menus", () => {
  test("Change type… lists the types with their icons, in their color, the text mixed into the text color", async ({
    page,
  }) => {
    await mount(page, `({ flag: "abc" })`)
    await page
      .locator("#shell e-grid-row", { hasText: "flag" })
      .first()
      .locator("> :first-child")
      .click({ button: "right" })
    await page.locator('[popover].open [role="menuitem"]', { hasText: "Change type…" }).click()
    await expect(page.locator('[popover].open [role="menu"]')).toHaveCount(2)
    const items = page.locator('[popover].open [role="menu"]').nth(1).locator('[role="menuitem"]')
    expect(await items.count()).toBeGreaterThan(3)
    const expected: Record<string, string> = {
      null: "magenta",
      number: "purple",
      boolean: "magenta",
      object: "cyan",
      array: "green",
    }
    for (const [label, color] of Object.entries(expected)) {
      const item = items.filter({ hasText: new RegExp(`^${label}`) }).first()
      expect(await item.locator("svg").count(), `${label} has an icon`).toBe(1)
      expect(await style_of(item.locator("svg"), "color"), `${label} icon`).toBe(await resolve(page, color))
      expect(await style_of(item, "color"), `${label} text`).toBe(await resolve(page, "tint.ink", color))
    }
    // A string has no color of its own: the plain text color, still with its icon.
    const string_item = items.filter({ hasText: /^string/ })
    if ((await string_item.count()) > 0) expect(await string_item.locator("svg").count()).toBe(1)
  })

  test("the Edit section of a text field has an icon on each item", async ({ page }) => {
    await mount(page, `new Map([["k", "v"]])`)
    await page.locator("#shell e-grid-row").first().locator("input").first().click({ button: "right" })
    const items = page.locator('[popover].open [role="menuitem"]')
    await expect(items.first()).toBeVisible()
    for (const label of ["Cut", "Copy", "Paste", "Select all"]) {
      expect(
        await items
          .filter({ hasText: new RegExp(`^${label}$`) })
          .locator("svg")
          .count(),
        label,
      ).toBe(1)
    }
  })
})
