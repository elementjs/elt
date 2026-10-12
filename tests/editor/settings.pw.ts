import { type Page, expect, test } from "../fixture"

// Presentation settings (`packed`, `show_*`, `show_undo_redo`, `undo: false`): editor-wide defaults that
// a schema node replaces for itself. `packed` also carries on to what the node opens.

async function settle(page: Page) {
  await page.evaluate(() => window.__ELT__.frames(3))
}

test.describe("packed", () => {
  test("the editor is not packed by default: no frame, no seams, no packed group anywhere", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const shell = new ObjectEditorShell(o({ a: "x" }))
      node_append(document.body, shell.node)
      return {
        packed: shell.node.querySelectorAll("[packed]").length,
        bordered: shell.node.querySelectorAll("e-column[border], e-row[border], e-grid[border]").length,
      }
    })
    expect(result).toEqual({ packed: 0, bordered: 0 })
  })

  test("packed: true gives the frame, header line, toolbar and grid their packed look", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const shell = new ObjectEditorShell(o({ a: "x" }), { packed: true })
      node_append(document.body, shell.node)
      // The column and the grid are framed; the header line and toolbar are groups inside the column's frame.
      return ["e-column[packed][border]", "e-row[packed]", "e-grid[packed][border]"].map(
        (sel) => shell.node.querySelectorAll(sel).length > 0,
      )
    })
    expect(result).toEqual([true, true, true])
  })

  test("the <ObjectEditor> attribute forwards packed", async ({ page }) => {
    const packed = await page.evaluate(() => {
      const { o, e, node_append } = window.__ELT__
      const { ObjectEditor } = window.__ELT__.Editor
      const node = e(ObjectEditor as any, { model: o({ a: "x" }), packed: true }) as HTMLElement
      node_append(document.body, node)
      return node.querySelector("e-column[packed][border]") != null
    })
    expect(packed).toBe(true)
  })

  test("a row's cells share a baseline when unpacked: the key and its input line up", async ({ page }) => {
    await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const shell = new ObjectEditorShell(o({ name: "Ada" }))
      shell.node.id = "shell"
      node_append(document.body, shell.node)
    })
    await settle(page)
    const { label, input } = await page.evaluate(() => {
      const row = document.querySelector("#shell e-grid-row")!
      // A zero-size inline-block sitting on the baseline reports it.
      const baseline = (el: Element) => {
        const probe = document.createElement("span")
        probe.style.cssText = "display:inline-block;width:0;height:0"
        const target = el.firstChild ?? el
        el.insertBefore(probe, target)
        const y = probe.getBoundingClientRect().bottom
        probe.remove()
        return y
      }
      return { label: baseline(row.children[0]!), input: row.children[1]!.getBoundingClientRect().top }
    })
    // The label's text must not sit above the input's box: rows are aligned on the baseline, not at the start.
    expect(label).toBeGreaterThan(input)
  })

  test("a packed node in an unpacked editor is packed, and the columns it opens are too", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string } = window.__ELT__.Editor
      const deeper = object({ properties: [{ name: "z", type: string() }] })
      const packed_node = object({ packed: true, properties: [{ name: "deeper", type: deeper }] })
      const shell = new ObjectEditorShell(o({ child: { deeper: { z: "1" } } }), {
        schema: object({ properties: [{ name: "child", type: packed_node }] }),
      })
      node_append(document.body, shell.node)
      shell.node.querySelector<HTMLButtonElement>('button[title="Open child"]')!.click()
      await window.__ELT__.frames(2)
      shell.node.querySelector<HTMLButtonElement>('button[title="Open deeper"]')!.click()
      await window.__ELT__.frames(2)
      // Columns, in order: root, child, deeper.
      return [...shell.node.querySelectorAll(":scope > e-row > e-column")].map((c) => c.hasAttribute("packed"))
    })
    expect(result).toEqual([false, true, true])
  })

  test("a node can opt out of a packed editor, and a packed popup works in an unpacked editor", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string } = window.__ELT__.Editor
      const loose = object({ packed: false, properties: [{ name: "x", type: string() }] })
      const popup = object({ packed: true, open_as: "popup", properties: [{ name: "y", type: string() }] })
      const shell = new ObjectEditorShell(o({ loose: { x: "1" }, popup: { y: "2" } }), {
        packed: true,
        schema: object({
          properties: [
            { name: "loose", type: loose },
            { name: "popup", type: popup },
          ],
        }),
      })
      node_append(document.body, shell.node)
      shell.node.querySelector<HTMLButtonElement>('button[title="Open loose"]')!.click()
      await window.__ELT__.frames(2)
      const columns = [...shell.node.querySelectorAll(":scope > e-row > e-column")].map((c) => c.hasAttribute("packed"))
      shell.node.querySelector<HTMLButtonElement>('button[title="Open popup"]')!.click()
      await window.__ELT__.frames(2)
      return { columns, popup_packed: document.querySelector("[popover] e-column[packed]") != null }
    })
    // The root is packed; the opted-out column is not; the popup node is packed again.
    expect(result.columns).toEqual([true, false])
    expect(result.popup_packed).toBe(true)
  })

  test("an unpacked popup is a framed panel of loose rows", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string } = window.__ELT__.Editor
      const popup = object({ open_as: "popup", properties: [{ name: "y", type: string() }] })
      const shell = new ObjectEditorShell(o({ popup: { y: "2" } }), {
        schema: object({ properties: [{ name: "popup", type: popup }] }),
      })
      node_append(document.body, shell.node)
      shell.node.querySelector<HTMLButtonElement>('button[title="Open popup"]')!.click()
      await window.__ELT__.frames(2)
      const panel = document.querySelector("[popover] > e-column, [popover] e-column")!
      return {
        border: getComputedStyle(panel).borderTopWidth,
        packed: document.querySelector("[popover] [packed]") != null,
      }
    })
    expect(result).toEqual({ border: "1px", packed: false })
  })
})

test("a table's grid is always packed, even in an unpacked editor; its frame is not", async ({ page }) => {
  const result = await page.evaluate(() => {
    const { o, node_append } = window.__ELT__
    const { ObjectEditorShell } = window.__ELT__.Editor
    const shell = new ObjectEditorShell(o<unknown>([{ n: 1 }, { n: 2 }]) as any)
    node_append(document.body, shell.node)
    return {
      grid: shell.node.querySelector("e-grid")!.matches("[packed][border]"),
      frame: shell.node.querySelector("e-column")!.hasAttribute("packed"),
    }
  })
  expect(result).toEqual({ grid: true, frame: false })
})

test.describe("show_* flags", () => {
  test("show_filter, show_add: the editor attributes are the defaults of every node", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const probe = (options: object) => {
        const shell = new ObjectEditorShell(o({ a: "x" }), options)
        node_append(document.body, shell.node)
        return {
          add: [...shell.node.querySelectorAll("button")].some((b) => b.textContent?.includes("Add key")),
          filter: shell.node.querySelector('input[type="search"]') != null,
        }
      }
      return { both: probe({}), no_filter: probe({ show_filter: false }), no_add: probe({ show_add: false }) }
    })
    expect(result.both).toEqual({ add: true, filter: true })
    expect(result.no_filter).toEqual({ add: true, filter: false })
    expect(result.no_add).toEqual({ add: false, filter: true })
  })

  test("a node's option replaces the attribute for that node only, not for what it opens", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string } = window.__ELT__.Editor
      const inner = object({ properties: [{ name: "z", type: string() }] })
      const outer = object({ show_filter: true, properties: [{ name: "inner", type: inner }] })
      const shell = new ObjectEditorShell(o({ outer: { inner: { z: "1" } } }), {
        show_filter: false,
        schema: object({ properties: [{ name: "outer", type: outer }] }),
      })
      node_append(document.body, shell.node)
      shell.node.querySelector<HTMLButtonElement>('button[title="Open outer"]')!.click()
      await window.__ELT__.frames(2)
      shell.node.querySelector<HTMLButtonElement>('button[title="Open inner"]')!.click()
      await window.__ELT__.frames(2)
      return [...shell.node.querySelectorAll(":scope > e-row > e-column")].map(
        (c) => c.querySelector('input[type="search"]') != null,
      )
    })
    // root: attribute (off); outer: its own option (on); inner: back to the attribute (off).
    expect(result).toEqual([false, true, false])
  })

  test("show_title hides the label only; the header line goes when nothing else is on it", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const mk = (options: object) => {
        const shell = new ObjectEditorShell(o({ a: "x" }), options)
        node_append(document.body, shell.node)
        const header = shell.node.querySelector("strong")
        return {
          label: header?.textContent ?? null,
          buttons: [...shell.node.querySelectorAll("button")].map((b) => b.textContent?.trim()),
        }
      }
      return {
        title_off: mk({ show_title: false }),
        bare: mk({ show_title: false, show_menu: false, show_undo_redo: false }),
      }
    })
    expect(result.title_off.label).toBe("")
    expect(result.title_off.buttons).toEqual(["…", "Undo", "Redo", "+ Add key"])
    // No header line at all: no label element, none of its buttons.
    expect(result.bare.label).toBeNull()
    expect(result.bare.buttons).toEqual(["+ Add key"])
  })

  test("show_menu: false removes the … button and the right-click menus", async ({ page }) => {
    await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const shell = new ObjectEditorShell(o({ a: 1 }), { show_menu: false })
      shell.node.id = "shell"
      node_append(document.body, shell.node)
      ;(window as any).prevented = []
      window.addEventListener("contextmenu", (ev) => (window as any).prevented.push(ev.defaultPrevented))
    })
    expect(await page.locator('#shell button[aria-label="More actions"]').count()).toBe(0)
    await page.locator("#shell e-grid-row > span").first().click({ button: "right" })
    // Nothing of ours handled it: the browser's own menu shows.
    expect(await page.evaluate(() => (window as any).prevented)).toEqual([false])
    expect(await page.locator("[popover].open").count()).toBe(0)
  })
})

test.describe("undo", () => {
  const mount = (page: Page, options: string) =>
    page.evaluate((opts) => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string } = window.__ELT__.Editor
      const o_root = o({ a: "x" })
      ;(window as any).o_root = o_root
      const shell = new ObjectEditorShell(o_root, {
        schema: object({ properties: [{ name: "a", type: string() }] }),
        ...new Function(`return ${opts}`)(),
      })
      shell.node.id = "shell"
      node_append(document.body, shell.node)
    }, options)

  test("show_undo_redo: false hides the buttons; Mod+z still undoes outside a text field", async ({ page }) => {
    await mount(page, "{ show_undo_redo: false }")
    expect(await page.locator("#shell button", { hasText: /^(Undo|Redo)$/ }).count()).toBe(0)
    await page.evaluate(() => (window as any).o_root.set({ a: "y" }))
    // Focus on the editor's header/menu button: not a text field.
    await page.locator("#shell button", { hasText: "+ Add key" }).focus()
    await page.keyboard.press("ControlOrMeta+z")
    expect(await page.evaluate(() => (window as any).o_root.get())).toEqual({ a: "x" })
    await page.keyboard.press("ControlOrMeta+Shift+z")
    expect(await page.evaluate(() => (window as any).o_root.get())).toEqual({ a: "y" })
  })

  test("in a text field Mod+z is left to the browser: the editor's history is untouched", async ({ page }) => {
    await mount(page, "{}")
    await page.evaluate(() => (window as any).o_root.set({ a: "y" }))
    await page.locator('#shell input[type="text"]').focus()
    await page.keyboard.press("ControlOrMeta+z")
    expect(await page.evaluate(() => (window as any).o_root.get())).toEqual({ a: "y" })
  })

  test("undo: false has no buttons, no history and no shortcut", async ({ page }) => {
    await mount(page, "{ undo: false }")
    expect(await page.locator("#shell button", { hasText: /^(Undo|Redo)$/ }).count()).toBe(0)
    await page.evaluate(() => (window as any).o_root.set({ a: "y" }))
    await page.locator("#shell button", { hasText: "+ Add key" }).focus()
    await page.keyboard.press("ControlOrMeta+z")
    expect(await page.evaluate(() => (window as any).o_root.get())).toEqual({ a: "y" })
  })
})
