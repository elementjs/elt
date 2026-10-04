import { expect, test } from "./fixture"

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

  test("the arrow touches the popup and points at the anchor, on all four sides", async ({ page }) => {
    // Wide and short: tall content can only open beside its anchor, short content above or below it.
    await page.setViewportSize({ width: 800, height: 300 })
    const cases = [
      { placement: "left", anchor: "left: 700px; top: 140px", h: 200 },
      { placement: "right", anchor: "left: 20px; top: 140px", h: 200 },
      { placement: "top", anchor: "left: 380px; top: 260px", h: 40 },
      { placement: "bottom", anchor: "left: 380px; top: 10px", h: 40 },
    ] as const
    for (const c of cases) {
      const r = await page.evaluate(async (c) => {
        const { UI } = window.__ELT__
        document.body.innerHTML = `<button id="anchor" style="position: absolute; ${c.anchor}">a</button>`
        const content = document.createElement("e-column")
        content.setAttribute("surface", "tint-2")
        content.setAttribute("border", "")
        content.style.cssText = `width: 80px; height: ${c.h}px`
        const fut = UI.popup(document.getElementById("anchor")!, () => content, { placement: c.placement })
        // Shown on the next task, then positioned by floating-ui.
        await new Promise((r) => setTimeout(r, 100))
        const p = content.getBoundingClientRect()
        const outer = content.parentElement!.querySelector("[class*=outer-arrow]")!.getBoundingClientRect()
        const inner = content.parentElement!.querySelector("[class*=arrow-inner]")!.getBoundingClientRect()
        fut.resolve(UI.sym_closed)
        const cx = (inner.left + inner.right) / 2
        const cy = (inner.top + inner.bottom) / 2
        // The arrow box lies against the popup's edge facing the anchor, and the diamond is centered
        // on the box's edge against the popup, so only its half pointing at the anchor shows.
        if (c.placement === "left") return { gap: outer.left - p.right, center: cx - outer.left }
        if (c.placement === "right") return { gap: p.left - outer.right, center: outer.right - cx }
        if (c.placement === "top") return { gap: outer.top - p.bottom, center: cy - outer.top }
        return { gap: p.top - outer.bottom, center: outer.bottom - cy }
      }, c)
      expect(Math.abs(r.gap), `${c.placement}: gap`).toBeLessThan(1)
      expect(Math.abs(r.center), `${c.placement}: diamond center`).toBeLessThan(2)
    }
  })

  test("a rejected future closes the popup without an unhandled rejection", async ({ page }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      const w = window as W
      w.result = []
      window.addEventListener("unhandledrejection", (ev) => (w.result as unknown[]).push(String(ev.reason)))
      document.body.innerHTML = `<button id="anchor">open</button>`
      const fut = UI.popup(document.getElementById("anchor")!, () => {
        const c = document.createElement("e-column")
        c.id = "content"
        return c
      })
      // Whoever awaits the future gets the rejection; nothing else may leave one unhandled.
      fut.catch(() => {})
      ;(window as W & { fut?: typeof fut }).fut = fut
    })
    await page.waitForSelector("[popover] #content", { state: "attached" })
    await page.evaluate(() => (window as W & { fut?: { reject(e: unknown): void } }).fut!.reject(new Error("boom")))
    await page.waitForFunction(() => document.querySelector("[popover]") == null)
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => (window as W).result)).toEqual([])
  })

  test("once no popup is left, Escape goes on to the page (regression: a resolved popup kept eating it)", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      const w = window as W
      w.result = 0
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") w.result = (w.result as number) + 1
      })
      document.body.innerHTML = `<button id="anchor">open</button>`
      UI.popup(document.getElementById("anchor")!, (fut) => {
        const c = document.createElement("button")
        c.id = "inside"
        c.onclick = () => fut.resolve("picked")
        return c
      })
    })
    // Resolved by its content, not dismissed: the path a Select pick takes.
    await page.click("[popover] #inside")
    await page.waitForFunction(() => document.querySelector("[popover]") == null)
    await page.keyboard.press("Escape")
    expect(await page.evaluate(() => (window as W).result)).toBe(1)
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

  test("closing disconnects the content (regression: the dialog was removed without elt's lifecycle)", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const { UI, $disconnected } = window.__ELT__
      const w = window as W
      UI.show_dialog((fut) => {
        const c = document.createElement("e-column")
        $disconnected(() => {
          w.result = "disconnected"
        })(c)
        setTimeout(() => fut.resolve(UI.sym_closed))
        return c
      })
    })
    await page.waitForFunction(() => document.querySelector("dialog") == null)
    expect(await page.evaluate(() => (window as W).result)).toBe("disconnected")
  })

  test("a rejected future closes the dialog without an unhandled rejection", async ({ page }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      const w = window as W
      w.result = []
      window.addEventListener("unhandledrejection", (ev) => (w.result as unknown[]).push(String(ev.reason)))
      const fut = UI.show_dialog(() => document.createElement("e-column"))
      fut.catch(() => {})
      ;(window as W & { fut?: typeof fut }).fut = fut
    })
    await page.waitForSelector("dialog[open]", { state: "attached" })
    await page.evaluate(() => (window as W & { fut?: { reject(e: unknown): void } }).fut!.reject(new Error("boom")))
    await page.waitForFunction(() => document.querySelector("dialog") == null)
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => (window as W).result)).toEqual([])
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
