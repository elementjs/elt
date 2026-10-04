import { type Page, expect, test } from "./fixture"

type W = Window & { activated: string[] }

/** A menu of `labels` (null → an <hr>, "#x" → a header, "-x" → a disabled item) wired with menu_nav. */
async function mount_menu(page: Page, labels: (string | null)[]) {
  await page.evaluate((labels) => {
    const { UI, node_append } = window.__ELT__
    const w = window as unknown as W
    w.activated = []
    document.body.innerHTML = `<button id="before">before</button>`
    const menu = document.createElement("e-column")
    menu.id = "menu"
    menu.setAttribute("role", "menu")
    for (const label of labels) {
      if (label == null) {
        menu.append(document.createElement("hr"))
      } else if (label.startsWith("#")) {
        const h = document.createElement("h3")
        h.textContent = label.slice(1)
        menu.append(h)
      } else {
        const b = document.createElement("button")
        b.setAttribute("role", "menuitem")
        b.textContent = label.replace(/^-/, "")
        if (label.startsWith("-")) b.disabled = true
        b.onclick = () => w.activated.push(b.textContent!)
        menu.append(b)
      }
    }
    UI.menu_nav(menu)
    // node_append, not append: elt's lifecycle (connected callbacks, observers) runs through it.
    node_append(document.body, menu)
  }, labels)
  // menu_nav focuses the menu on the next frame.
  await page.waitForFunction(() => document.activeElement?.id === "menu")
}

async function active(page: Page) {
  return page.evaluate(() => {
    const menu = document.getElementById("menu")!
    const id = menu.getAttribute("aria-activedescendant")
    const marked = [...menu.querySelectorAll("[data-active]")].map((e) => e.textContent)
    return { by_aria: id ? document.getElementById(id)?.textContent : null, marked }
  })
}

test.describe("menu_nav / list_nav", () => {
  test("arrows skip headers, separators and disabled items; Home/End jump", async ({ page }) => {
    await mount_menu(page, ["#Key", "Copy", null, "#Value", "-Paste", "Cut", "Delete"])
    expect(await active(page)).toEqual({ by_aria: "Copy", marked: ["Copy"] })
    await page.keyboard.press("ArrowDown")
    expect((await active(page)).by_aria).toBe("Cut")
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("ArrowDown") // clamps at the end
    expect(await active(page)).toEqual({ by_aria: "Delete", marked: ["Delete"] })
    await page.keyboard.press("Home")
    expect((await active(page)).by_aria).toBe("Copy")
    await page.keyboard.press("End")
    expect((await active(page)).by_aria).toBe("Delete")
    await page.keyboard.press("ArrowUp")
    expect((await active(page)).by_aria).toBe("Cut")
  })

  test("Enter and Space activate the active item", async ({ page }) => {
    await mount_menu(page, ["One", "Two"])
    await page.keyboard.press("Enter")
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press(" ")
    expect(await page.evaluate(() => (window as unknown as W).activated)).toEqual(["One", "Two"])
  })

  test("typing letters jumps to the matching item", async ({ page }) => {
    await mount_menu(page, ["Apple", "Banana", "Apricot", "Blueberry"])
    await page.keyboard.press("b")
    expect((await active(page)).by_aria).toBe("Banana")
    await page.keyboard.press("b") // the same letter again: the next one
    expect((await active(page)).by_aria).toBe("Blueberry")
    await page.keyboard.press("Home")
    await page.keyboard.type("apr")
    expect((await active(page)).by_aria).toBe("Apricot")
  })

  test("a key press looks the items up once, and sees items added since the last one", async ({ page }) => {
    await mount_menu(page, ["Apple", "Banana", "Apricot", "Blueberry", "Cherry"])
    await page.evaluate(() => {
      const menu = document.getElementById("menu")!
      const w = window as unknown as W & { lookups: number }
      w.lookups = 0
      const qsa = menu.querySelectorAll.bind(menu)
      menu.querySelectorAll = ((sel: string) => {
        if (sel.includes("menuitem")) w.lookups++
        return qsa(sel)
      }) as typeof menu.querySelectorAll
    })
    const lookups = () => page.evaluate(() => (window as unknown as W & { lookups: number }).lookups)
    // A typed letter reads every item's text: one lookup for all of them, not one per item.
    await page.keyboard.press("c")
    expect((await active(page)).by_aria).toBe("Cherry")
    expect(await lookups()).toBe(1)
    await page.evaluate(() => {
      const b = document.createElement("button")
      b.setAttribute("role", "menuitem")
      b.textContent = "Date"
      document.getElementById("menu")!.append(b)
    })
    await page.keyboard.press("End")
    expect((await active(page)).by_aria).toBe("Date")
  })

  test("hovering an item makes it active", async ({ page }) => {
    await mount_menu(page, ["One", "Two", "Three"])
    await page.hover("#menu button:nth-of-type(3)")
    expect((await active(page)).by_aria).toBe("Three")
    await page.keyboard.press("ArrowUp")
    expect((await active(page)).by_aria).toBe("Two")
  })

  test("in a popup: focus starts in the menu and returns to the opener on Escape", async ({ page }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      document.body.innerHTML = `<button id="opener">open</button>`
      const opener = document.getElementById("opener")!
      opener.focus()
      UI.popup(opener, () => {
        const menu = document.createElement("e-column")
        menu.id = "menu"
        menu.setAttribute("role", "menu")
        menu.innerHTML = `<button role="menuitem">One</button><button role="menuitem">Two</button>`
        UI.menu_nav(menu)
        return menu
      })
    })
    await page.waitForFunction(() => document.activeElement?.id === "menu")
    await page.keyboard.press("ArrowDown")
    expect((await active(page)).by_aria).toBe("Two")
    await page.keyboard.press("Escape")
    await page.waitForFunction(() => document.activeElement?.id === "opener")
  })

  test("list_nav on a text field leaves Home/End/Space and letters to the input", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { UI, o, node_append } = window.__ELT__
      document.body.innerHTML = ""
      const input = document.createElement("input")
      input.id = "field"
      const o_active = o(-1)
      const activated: number[] = []
      UI.list_nav(input, {
        o_active,
        count: () => 50,
        activate: (i) => activated.push(i),
        id_of: (i) => `opt-${i}`,
        text_of: (i) => `item ${i}`,
      })
      node_append(document.body, input)
      input.focus()
      const key = (k: string) => {
        const ev = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })
        input.dispatchEvent(ev)
        return ev.defaultPrevented
      }
      const out: Record<string, unknown> = {}
      out.down_prevented = key("ArrowDown")
      out.after_down = o_active.get()
      out.home_prevented = key("Home")
      out.letter_prevented = key("i")
      out.space_prevented = key(" ")
      key("PageDown")
      out.page_down = o_active.get()
      out.aria = input.getAttribute("aria-activedescendant")
      key("Enter")
      out.activated = activated
      return out
    })
    expect(r).toEqual({
      down_prevented: true,
      after_down: 0,
      home_prevented: false,
      letter_prevented: false,
      space_prevented: false,
      page_down: 10,
      aria: "opt-10",
      activated: [10],
    })
  })
})

test.describe("focus_when_shown", () => {
  // A popup closed within the frame it opened in is disconnected but still fades out in the document:
  // the delayed focus must not land in it, or focus drops to the body once it is removed.
  test("does not focus an element disconnected before the next frame (regression)", async ({ page }) => {
    const focused_ghost = await page.evaluate(async () => {
      const { UI, node_append, node_do_disconnect, node_remove } = window.__ELT__
      document.body.innerHTML = `<button id="before">before</button>`
      const before = document.getElementById("before")!
      before.focus()
      const el = document.createElement("button")
      UI.focus_when_shown(el)
      node_append(document.body, el)
      node_do_disconnect(el)
      await window.__ELT__.frames(2)
      const result = document.activeElement === el
      node_remove(el)
      return result
    })
    expect(focused_ghost).toBe(false)
  })
})
