import { expect, test } from "./fixture"

type W = Window & { result?: unknown }

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
      document.querySelector<HTMLElement>("[popover]")?.style.getPropertyValue("--e-popup-room-height"),
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
        max_h: pop.style.getPropertyValue("--e-popup-room-height"),
        max_w: pop.style.getPropertyValue("--e-popup-room-width"),
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

  test("Escape resolves with undefined and gives focus back", async ({ page }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      document.body.innerHTML = `<button id="anchor">open</button>`
      const anchor = document.getElementById("anchor")!
      anchor.focus()
      const w = window as W
      w.result = "pending"
      UI.popup(anchor, () => {
        const c = document.createElement("e-column")
        c.innerHTML = `<button id="inside">in</button>`
        return c
      }).then((v) => {
        w.result = v === undefined ? "closed" : v
      })
    })
    await page.waitForSelector("[popover] #inside")
    await page.focus("#inside")
    await page.keyboard.press("Escape")
    await page.waitForFunction(() => (window as W).result !== "pending")
    const r = await page.evaluate(() => ({ result: (window as W).result, focus: document.activeElement?.id }))
    expect(r).toEqual({ result: "closed", focus: "anchor" })
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
        fut.resolve(undefined)
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

  test("the arrow prolongs the frame: the border width and color of the edge it sits on, clear of rounded corners", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 300 })
    // Only the bottom edge has a border (3px, red): a popup above its anchor puts the arrow there; one
    // below its anchor puts it on the borderless top edge.
    const cases = [
      { anchor: "left: 380px; top: 260px", side: "bottom", width: "3px", color: "rgb(255, 0, 0)" },
      { anchor: "left: 380px; top: 10px", side: "top", width: "0px", color: "rgba(0, 0, 0, 0)" },
    ] as const
    for (const c of cases) {
      const r = await page.evaluate(async (c) => {
        const { UI } = window.__ELT__
        document.body.innerHTML = `<button id="anchor" style="position: absolute; ${c.anchor}">a</button>`
        const content = document.createElement("e-column")
        content.style.cssText =
          "width: 200px; height: 40px; border: 0 solid red; border-bottom-width: 3px; border-radius: 20px"
        const fut = UI.popup(document.getElementById("anchor")!, () => content)
        await new Promise((r) => setTimeout(r, 100))
        const outer = content.parentElement!.querySelector<HTMLElement>("[class*=outer-arrow]")!
        const inner = outer.querySelector<HTMLElement>("[class*=arrow-inner]")!
        const ics = getComputedStyle(inner)
        const p = content.getBoundingClientRect()
        const i = inner.getBoundingClientRect()
        const res = {
          width: ics.borderTopWidth,
          color: ics.borderTopColor,
          // Distance from the arrow's center to the nearest end of the edge.
          to_end: Math.min((i.left + i.right) / 2 - p.left, p.right - (i.left + i.right) / 2),
          // The part of the arrow clipped away is on the content's side only: the base is covered.
          clip: getComputedStyle(outer).clipPath,
        }
        fut.resolve(undefined)
        return res
      }, c)
      expect(r.width, `${c.side}: stroke width`).toBe(c.width)
      expect(r.color, `${c.side}: stroke color`).toBe(c.color)
      // The 20px corner radius plus half the arrow's base (6px).
      expect(r.to_end, `${c.side}: clear of the corner`).toBeGreaterThanOrEqual(26 - 1)
      expect(r.clip, `${c.side}: base covered`).toContain("inset(")
    }
  })

  test("exact_placement opens on the requested side, or the opposite one, never above or below the anchor", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 600 })
    // Room on the right: beside it. Little room on the right but much below: flipped to the left, not moved below.
    const cases = [
      { anchor: "left: 20px; top: 100px", side: "right" },
      { anchor: "left: 700px; top: 100px", side: "left" },
    ] as const
    for (const c of cases) {
      const r = await page.evaluate(async (c) => {
        const { UI } = window.__ELT__
        document.body.innerHTML = `<button id="anchor" style="position: absolute; ${c.anchor}">anchor</button>`
        const content = document.createElement("e-column")
        content.setAttribute("border", "")
        content.style.cssText = "width: 150px; height: 80px"
        const fut = UI.popup(document.getElementById("anchor")!, () => content, {
          placement: "right-start",
          exact_placement: true,
          arrow: false,
        })
        await new Promise((r) => setTimeout(r, 100))
        const p = content.getBoundingClientRect()
        const a = document.getElementById("anchor")!.getBoundingClientRect()
        fut.resolve(undefined)
        return {
          beside: p.left >= a.right - 1 ? "right" : p.right <= a.left + 1 ? "left" : "overlap",
          top: p.top - a.top,
        }
      }, c)
      expect(r.beside, c.anchor).toBe(c.side)
      // "-start": the popup's top edge is the anchor's.
      expect(Math.abs(r.top), c.anchor).toBeLessThan(1)
    }
  })

  test("the future is rejected with an AbortError when the popup's parent leaves the page", async ({ page }) => {
    await page.evaluate(() => {
      const { UI, node_append } = window.__ELT__
      const w = window as W
      document.body.innerHTML = ""
      const host = document.createElement("div")
      host.id = "host"
      node_append(document.body, host)
      const anchor = document.createElement("button")
      anchor.id = "anchor"
      host.append(anchor)
      const fut = UI.popup(
        anchor,
        () => {
          const c = document.createElement("e-column")
          c.id = "content"
          return c
        },
        { parent: host },
      )
      w.result = "pending"
      fut.then(
        () => (w.result = "resolved"),
        (e: DOMException) => (w.result = e.name),
      )
    })
    await page.waitForSelector("#host #content", { state: "attached" })
    await page.evaluate(() => window.__ELT__.node_remove(document.getElementById("host")!))
    await page.waitForFunction(() => (window as W).result !== "pending")
    expect(await page.evaluate(() => (window as W).result)).toBe("AbortError")
  })

  test("a popup opened from inside another: closing the parent resolves the child with undefined", async ({ page }) => {
    const log = await page.evaluate(async () => {
      const { UI } = window.__ELT__
      document.body.innerHTML = `<button id="anchor">open</button>`
      const log: string[] = []
      let child_anchor!: HTMLElement
      const parent = UI.popup<string>(document.getElementById("anchor")!, () => {
        const c = document.createElement("e-column")
        child_anchor = document.createElement("button")
        c.append(child_anchor)
        return c
      })
      parent.then((v) => log.push(`parent ${v}`))
      await new Promise((r) => setTimeout(r, 100))
      UI.popup(child_anchor, () => document.createElement("e-column")).then((v) => log.push(`child ${v}`))
      await new Promise((r) => setTimeout(r, 100))
      parent.resolve("x")
      await new Promise((r) => setTimeout(r, 300))
      return log
    })
    expect(log.sort()).toEqual(["child undefined", "parent x"])
  })

  test("a popup opened from inside another: both futures reject with AbortError when the parent's host leaves the page", async ({
    page,
  }) => {
    const log = await page.evaluate(async () => {
      const { UI, node_append, node_remove } = window.__ELT__
      document.body.innerHTML = ""
      const host = document.createElement("div")
      node_append(document.body, host)
      const anchor = document.createElement("button")
      host.append(anchor)
      const log: string[] = []
      let child_anchor!: HTMLElement
      const parent = UI.popup(
        anchor,
        () => {
          const c = document.createElement("e-column")
          child_anchor = document.createElement("button")
          c.append(child_anchor)
          return c
        },
        { parent: host },
      )
      parent.then(
        () => log.push("parent resolved"),
        (e: DOMException) => log.push(`parent ${e.name}`),
      )
      await new Promise((r) => setTimeout(r, 100))
      UI.popup(child_anchor, () => document.createElement("e-column")).then(
        () => log.push("child resolved"),
        (e: DOMException) => log.push(`child ${e.name}`),
      )
      await new Promise((r) => setTimeout(r, 100))
      node_remove(host)
      await new Promise((r) => setTimeout(r, 300))
      return log
    })
    expect(log.sort()).toEqual(["child AbortError", "parent AbortError"])
  })

  test("a parent that is not in the page rejects the future instead of throwing later", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { UI } = window.__ELT__
      document.body.innerHTML = `<button id="anchor">open</button>`
      const detached = document.createElement("div")
      const fut = UI.popup(document.getElementById("anchor")!, () => document.createElement("e-column"), {
        parent: detached,
      })
      return fut.then(
        () => "resolved",
        (e: Error) => e.message,
      )
    })
    expect(result).toContain("parent must be in the page")
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
        c.onclick = () => fut.resolve(true)
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

  test("Escape resolves with undefined, removes the dialog and gives focus back", async ({ page }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      document.body.innerHTML = `<button id="opener">open</button>`
      document.getElementById("opener")!.focus()
      const w = window as W
      w.result = "pending"
      UI.show_dialog(() => {
        const c = document.createElement("e-column")
        c.innerHTML = `<button id="inside">in</button>`
        return c
      }).then((v) => {
        w.result = v === undefined ? "closed" : v
      })
    })
    await page.waitForSelector("dialog[open] #inside")
    await page.keyboard.press("Escape")
    await page.waitForFunction(() => (window as W).result !== "pending")
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
        setTimeout(() => fut.resolve(undefined))
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

  test("clickOutsideToClose: a backdrop click resolves with undefined", async ({ page }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      const w = window as W
      w.result = "pending"
      UI.show_dialog({ clickOutsideToClose: true }, () => {
        const c = document.createElement("e-column")
        c.style.width = "100px"
        c.style.height = "100px"
        return c
      }).then((v) => {
        w.result = v === undefined ? "closed" : v
      })
    })
    await page.waitForSelector("dialog[open]")
    await page.mouse.click(5, 5)
    await page.waitForFunction(() => (window as W).result !== "pending")
    expect(await page.evaluate(() => (window as W).result)).toBe("closed")
  })
})

test.describe("popup size limits", () => {
  test("theme tokens and per-popup options set the content's min width and max size, within the room by the anchor", async ({
    page,
  }) => {
    const r = await page.evaluate(async () => {
      const UI = window.__ELT__.UI
      document.body.insertAdjacentHTML("beforeend", '<button id="anchor">anchor</button>')
      const open = async (opts?: Record<string, unknown>, style = "") => {
        const content = document.createElement("e-column")
        content.setAttribute("border", "")
        content.setAttribute("style", style)
        content.textContent = "x"
        UI.popup(document.getElementById("anchor")!, () => content, opts)
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const cs = getComputedStyle(content)
        return {
          min: cs.minWidth,
          max_w: cs.maxWidth,
          max_h: cs.maxHeight,
          width: content.getBoundingClientRect().width,
        }
      }
      const by_default = await open()
      const by_option = await open({ min_width: 300, max_width: "320px", max_height: 100 })
      // A token set on the content wins over the theme's, an option over the token.
      const by_token = await open(undefined, "--e-popup-min-width: 200px")
      return { by_default, by_option, by_token, vh: innerHeight, vw: innerWidth }
    })
    expect(r.by_default.min).toBe("0px")
    expect(Number.parseFloat(r.by_default.max_h)).toBeLessThanOrEqual(r.vh * 0.8 + 1)
    expect(r.by_option).toMatchObject({ min: "300px", max_w: "320px", max_h: "100px" })
    expect(r.by_option.width).toBe(300)
    expect(r.by_token.min).toBe("200px")
    expect(r.by_token.width).toBe(200)
  })
})
