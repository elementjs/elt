import { type Page, expect, test } from "./fixture"

declare global {
  interface Window {
    __tab: { get(): string; set(v: string): void }
    __closed: string[]
    __strip: ReturnType<typeof window.__ELT__.UI.tab_strip<string>>
  }
}

// tab_strip (ui/tabs.tsx, docs/md/ui-states.md#tabs): roles, links, the Tab stop and the keys of a tab strip
// built from the app's own markup.

/**
 * A strip of tabs `a`, `b` (closable, in a row of its own), `c`, each `<button id=…>` decorated with its
 * value, and a panel. `disabled` lists the tabs that are disabled; `attrs` goes on the strip.
 */
async function mount(page: Page, opts: { selected?: string; disabled?: string[]; attrs?: string } = {}) {
  await page.evaluate(({ selected, disabled, attrs }) => {
    const { o, node_append, UI } = window.__ELT__
    const root = document.createElement("div")
    root.innerHTML = `
      <e-row id="strip" packed ${attrs ?? ""}>
        <button id="a">A</button>
        <e-row id="b-row" packed seams="none"><button id="b">B</button><button id="b-x" e-widget="tab-close" aria-label="Close B">x</button></e-row>
        <button id="c">C</button>
      </e-row>
      <div id="panel"></div>`
    const o_tab = o(selected ?? "a")
    window.__tab = o_tab
    window.__closed = []
    const tabs = UI.tab_strip(o_tab)
    window.__strip = tabs
    tabs.strip(root.querySelector("#strip")!)
    for (const id of ["a", "b", "c"]) {
      const btn = root.querySelector<HTMLButtonElement>(`#${id}`)!
      btn.disabled = disabled?.includes(id) ?? false
      tabs.tab(id)(btn)
    }
    tabs.panel(root.querySelector("#panel")!)
    // Closing B removes it and selects A, as an app's close handler does.
    root.querySelector("#b-x")!.addEventListener("click", () => {
      window.__closed.push("b")
      root.querySelector("#b-row")!.remove()
      o_tab.set("a")
    })
    node_append(document.body, root)
  }, opts)
  // The links are set once the tabs are all in (a microtask).
  await page.evaluate(() => window.__ELT__.frames(1))
}

const attr = (page: Page, sel: string, name: string) =>
  page.evaluate(([sel, name]) => document.querySelector(sel)!.getAttribute(name), [sel, name] as const)

const selected = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[role="tab"]')]
      .filter((t) => t.getAttribute("aria-selected") === "true")
      .map((t) => t.id),
  )
const tab_stops = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[role="tab"]')].filter((t) => t.tabIndex === 0).map((t) => t.id),
  )
const focused = (page: Page) => page.evaluate(() => document.activeElement?.id)

test.describe("tab_strip", () => {
  test("gives the strip, the tabs and the panel their roles, and links them both ways", async ({ page }) => {
    await mount(page, { selected: "b" })
    expect(await attr(page, "#strip", "role")).toBe("tablist")
    expect(await attr(page, "#a", "role")).toBe("tab")
    expect(await attr(page, "#panel", "role")).toBe("tabpanel")
    const panel_id = await attr(page, "#panel", "id")
    for (const id of ["#a", "#b", "#c"]) expect(await attr(page, id, "aria-controls")).toBe(panel_id)
    expect(await attr(page, "#panel", "aria-labelledby")).toBe("b")
    // The row around a closable tab doesn't stand between the strip and its tab; the close button controls its tab.
    expect(await attr(page, "#b-row", "role")).toBe("none")
    expect(await attr(page, "#b-x", "aria-controls")).toBe("b")
    expect(await attr(page, "#b-x", "tabindex")).toBe("-1")
    expect(await selected(page)).toEqual(["b"])
  })

  test("follows the observable: one tab selected, the only Tab stop, and the panel named by it", async ({ page }) => {
    await mount(page)
    await page.evaluate(() => window.__tab.set("c"))
    expect(await selected(page)).toEqual(["c"])
    expect(await tab_stops(page)).toEqual(["c"])
    expect(await attr(page, "#panel", "aria-labelledby")).toBe("c")
  })

  test("with no tab selected, the first enabled tab is the Tab stop and the panel has no name", async ({ page }) => {
    await mount(page, { selected: "none", disabled: ["a"] })
    expect(await selected(page)).toEqual([])
    expect(await tab_stops(page)).toEqual(["b"])
    expect(await attr(page, "#panel", "aria-labelledby")).toBeNull()
  })

  test("a selected tab that is disabled leaves the Tab stop to the first enabled tab", async ({ page }) => {
    await mount(page, { selected: "a", disabled: ["a"] })
    expect(await selected(page)).toEqual(["a"])
    expect(await tab_stops(page)).toEqual(["b"])
  })

  test("Tab from the selected tab goes to the panel, past its close button; the panel shows a focus ring", async ({
    page,
  }) => {
    // From B: its close button, after it, isn't a Tab stop.
    await mount(page, { selected: "b" })
    await page.focus("#b")
    await page.keyboard.press("Tab")
    expect(await focused(page)).toBe(await attr(page, "#panel", "id"))
    expect(await page.evaluate(() => getComputedStyle(document.querySelector("#panel")!).boxShadow)).not.toBe("none")
  })

  test("a click selects the tab", async ({ page }) => {
    await mount(page)
    await page.click("#c")
    expect(await page.evaluate(() => window.__tab.get())).toBe("c")
  })

  test("the arrows move to the next or previous tab and select it, wrapping around; Home and End go to the ends", async ({
    page,
  }) => {
    await mount(page)
    await page.focus("#a")
    const steps: [string, string][] = [
      ["ArrowRight", "b"],
      ["ArrowRight", "c"],
      ["ArrowRight", "a"],
      ["ArrowLeft", "c"],
      ["Home", "a"],
      ["End", "c"],
    ]
    for (const [key, id] of steps) {
      await page.keyboard.press(key)
      expect(await focused(page)).toBe(id)
      expect(await page.evaluate(() => window.__tab.get())).toBe(id)
    }
  })

  test("the arrows skip disabled tabs", async ({ page }) => {
    await mount(page, { disabled: ["b"] })
    await page.focus("#a")
    await page.keyboard.press("ArrowRight")
    expect(await focused(page)).toBe("c")
  })

  test("a vertical strip moves with Up and Down, not Left and Right", async ({ page }) => {
    await mount(page, { attrs: 'aria-orientation="vertical"' })
    await page.focus("#a")
    await page.keyboard.press("ArrowRight")
    expect(await focused(page)).toBe("a")
    await page.keyboard.press("ArrowDown")
    expect(await focused(page)).toBe("b")
    await page.keyboard.press("ArrowUp")
    expect(await focused(page)).toBe("a")
  })

  test("in a right-to-left strip, ArrowLeft goes to the next tab", async ({ page }) => {
    await mount(page, { attrs: 'dir="rtl"' })
    await page.focus("#a")
    await page.keyboard.press("ArrowLeft")
    expect(await focused(page)).toBe("b")
  })

  test("Delete clicks the focused tab's close button, and focus goes to the tab now selected", async ({ page }) => {
    await mount(page, { selected: "b" })
    await page.focus("#b")
    await page.keyboard.press("Delete")
    expect(await page.evaluate(() => window.__closed)).toEqual(["b"])
    expect(await focused(page)).toBe("a")
    // A tab without a close button isn't closed.
    await page.keyboard.press("Delete")
    expect(await page.evaluate(() => window.__closed)).toEqual(["b"])
  })

  test("a tab added later is a tab of the strip: linked, and reached by the arrows", async ({ page }) => {
    await mount(page)
    await page.evaluate(async () => {
      const { node_append, frames } = window.__ELT__
      const d = document.createElement("button")
      d.id = "d"
      window.__strip.tab("d")(d)
      node_append(document.querySelector("#strip")!, d)
      await frames(1)
    })
    expect(await attr(page, "#d", "aria-controls")).toBe(await attr(page, "#panel", "id"))
    expect(await attr(page, "#d", "aria-selected")).toBe("false")
    await page.focus("#c")
    await page.keyboard.press("ArrowRight")
    expect(await focused(page)).toBe("d")
  })
})
