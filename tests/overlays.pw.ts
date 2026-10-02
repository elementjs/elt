import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

type W = Window & { result?: unknown; sentinel?: symbol }

test.describe("popup (docs/md/ui-overlays.md#popup)", () => {
  test("draws the returned element as given, with an arrow colored like it", async ({ page }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      document.body.innerHTML = `<button id="anchor" style="margin: 200px">open</button>`
      const content = document.createElement("e-column")
      content.id = "content"
      content.setAttribute("surface", "tint-2")
      content.setAttribute("border", "")
      content.textContent = "hello"
      UI.popup(document.getElementById("anchor")!, () => content)
    })
    await page.waitForSelector("[popover] #content")
    await page.waitForFunction(() =>
      document.querySelector<HTMLElement>("[popover]")?.style.getPropertyValue("--e-popup-max-height"),
    )
    const r = await page.evaluate(() => {
      const content = document.getElementById("content")!
      const pop = content.parentElement!
      const arrow_inner = pop.querySelector<HTMLElement>("[class*=arrow-inner]")!
      const cs = getComputedStyle(content)
      const acs = getComputedStyle(arrow_inner)
      return {
        // no wrapper between the popover and the content
        parent_is_popover: pop.hasAttribute("popover"),
        content_bg: cs.backgroundColor,
        arrow_bg: acs.backgroundColor,
        content_border: cs.borderTopColor,
        arrow_border: acs.borderTopColor,
        max_h: pop.style.getPropertyValue("--e-popup-max-height"),
        max_w: pop.style.getPropertyValue("--e-popup-max-width"),
      }
    })
    expect(r.parent_is_popover).toBe(true)
    expect(r.arrow_bg).toBe(r.content_bg)
    expect(r.arrow_border).toBe(r.content_border)
    expect(r.max_h).toMatch(/^\d+px$/)
    expect(r.max_w).toMatch(/^\d+px$/)
  })

  test("a point anchor opens below-right of the point, without an arrow", async ({ page }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      document.body.innerHTML = `<div id="zone" style="width: 600px; height: 400px"></div>`
      const content = document.createElement("e-column")
      content.id = "content"
      content.setAttribute("border", "")
      content.textContent = "menu"
      UI.popup({ x: 150, y: 120, element: document.getElementById("zone")! }, () => content)
    })
    await page.waitForSelector("[popover] #content")
    // Let floating-ui settle the position.
    await page.waitForFunction(() => document.querySelector<HTMLElement>("[popover]")!.style.left !== "")
    const r = await page.evaluate(() => {
      const pop = document.querySelector<HTMLElement>("[popover]")!
      return {
        left: Number.parseFloat(pop.style.left),
        top: Number.parseFloat(pop.style.top),
        arrow: pop.querySelector("[class*=arrow]") != null,
      }
    })
    expect(r.left).toBe(150)
    expect(r.top).toBe(120)
    expect(r.arrow).toBe(false)
  })

  test("Escape resolves with sym_closed and gives focus back", async ({ page }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      document.body.innerHTML = `<button id="anchor">open</button>`
      const anchor = document.getElementById("anchor")!
      anchor.focus()
      const w = window as W
      w.sentinel = UI.sym_closed
      UI.popup(anchor, () => {
        const c = document.createElement("e-column")
        c.innerHTML = `<button id="inside">in</button>`
        return c
      }).then((v) => {
        w.result = v
      })
    })
    await page.waitForSelector("[popover] #inside")
    await page.focus("#inside")
    await page.keyboard.press("Escape")
    await page.waitForFunction(() => (window as W).result !== undefined)
    const r = await page.evaluate(() => {
      const w = window as W
      return {
        is_closed: w.result === w.sentinel && w.result === window.__ELT__.UI.popup.closed,
        focus: document.activeElement?.id,
      }
    })
    expect(r.is_closed).toBe(true)
    expect(r.focus).toBe("anchor")
  })

  test("render must return one element", async ({ page }) => {
    const message = await page.evaluate(() => {
      const { UI } = window.__ELT__
      try {
        UI.popup(document.body, () => document.createTextNode("text"))
        return null
      } catch (e) {
        return (e as Error).message
      }
    })
    expect(message).toContain("single HTML element")
  })
})

test.describe("show_dialog (docs/md/ui-overlays.md#show_dialog)", () => {
  test("is an unstyled box around the returned element", async ({ page }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      UI.show_dialog(() => {
        const c = document.createElement("e-column")
        c.id = "content"
        c.setAttribute("surface", "background")
        c.setAttribute("border", "")
        c.textContent = "hello"
        return c
      })
    })
    await page.waitForSelector("dialog[open] > #content")
    const r = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector("dialog")!)
      return { padding: cs.paddingTop, border: cs.borderTopStyle, bg: cs.backgroundColor }
    })
    expect(r).toEqual({ padding: "0px", border: "none", bg: "rgba(0, 0, 0, 0)" })
  })

  test("Escape resolves with sym_closed, removes the dialog and gives focus back", async ({ page }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      document.body.innerHTML = `<button id="opener">open</button>`
      document.getElementById("opener")!.focus()
      const w = window as W
      UI.show_dialog(() => {
        const c = document.createElement("e-column")
        c.innerHTML = `<button id="inside">in</button>`
        return c
      }).then((v) => {
        w.result = v === UI.show_dialog.closed ? "closed" : v
      })
    })
    await page.waitForSelector("dialog[open] #inside")
    await page.keyboard.press("Escape")
    await page.waitForFunction(() => (window as W).result !== undefined)
    await page.waitForFunction(() => document.querySelector("dialog") == null)
    const r = await page.evaluate(() => ({ result: (window as W).result, focus: document.activeElement?.id }))
    expect(r).toEqual({ result: "closed", focus: "opener" })
  })

  test("resolves with the value given by the content", async ({ page }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      const w = window as W
      UI.show_dialog<string>((fut) => {
        const c = document.createElement("e-column")
        const b = document.createElement("button")
        b.id = "ok"
        b.onclick = () => fut.resolve("ok")
        c.append(b)
        return c
      }).then((v) => {
        w.result = v
      })
    })
    await page.click("dialog[open] #ok")
    await page.waitForFunction(() => (window as W).result !== undefined)
    expect(await page.evaluate(() => (window as W).result)).toBe("ok")
  })

  test("clickOutsideToClose: a backdrop click resolves with sym_closed", async ({ page }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      const w = window as W
      UI.show_dialog({ clickOutsideToClose: true }, () => {
        const c = document.createElement("e-column")
        c.style.width = "100px"
        c.style.height = "100px"
        return c
      }).then((v) => {
        w.result = v === UI.sym_closed ? "closed" : v
      })
    })
    await page.waitForSelector("dialog[open]")
    await page.mouse.click(5, 5)
    await page.waitForFunction(() => (window as W).result !== undefined)
    expect(await page.evaluate(() => (window as W).result)).toBe("closed")
  })
})
