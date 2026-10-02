import { test, expect } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("$context_menu", () => {
  test("right click calls the callback; preventDefault is the callback's job", async ({ page }) => {
    await page.evaluate(() => {
      const { $context_menu, node_append } = window.__ELT__
      const div = document.createElement("div")
      div.id = "target"
      div.textContent = "target"
      node_append(document.body, div)
      const w = window as unknown as { calls: { x: number; y: number; prevented: boolean }[] }
      w.calls = []
      node_append(
        div,
        $context_menu((ev) => {
          ev.preventDefault()
          w.calls.push({ x: ev.clientX, y: ev.clientY, prevented: ev.defaultPrevented })
        }),
      )
    })
    const box = (await page.locator("#target").boundingBox())!
    await page.mouse.click(box.x + 5, box.y + 5, { button: "right" })
    const calls = await page.evaluate(() => (window as unknown as { calls: unknown[] }).calls)
    expect(calls).toEqual([{ x: Math.round(box.x + 5), y: Math.round(box.y + 5), prevented: true }])
    const callout = await page.evaluate(
      () => document.getElementById("target")!.style.getPropertyValue("-webkit-touch-callout") || "unsupported",
    )
    // Chromium drops the unknown property; WebKit keeps it. Either way setting it must not throw.
    expect(["none", "unsupported"]).toContain(callout)
  })

  test("keyboard (Shift+F10) fires it on the focused element", async ({ page }) => {
    await page.evaluate(() => {
      const { $context_menu, node_append } = window.__ELT__
      const button = document.createElement("button")
      button.id = "target"
      button.textContent = "target"
      node_append(document.body, button)
      const w = window as unknown as { calls: { x: number; y: number }[] }
      w.calls = []
      node_append(
        button,
        $context_menu((ev) => {
          ev.preventDefault()
          w.calls.push({ x: ev.clientX, y: ev.clientY })
        }),
      )
      button.focus()
    })
    await page.keyboard.press("Shift+F10")
    const calls = await page.evaluate(() => (window as unknown as { calls: { x: number; y: number }[] }).calls)
    // Not every browser maps Shift+F10 to contextmenu under automation; when it does, record it.
    test.skip(calls.length === 0, "this browser doesn't fire contextmenu on Shift+F10 under automation")
    expect(calls.length).toBe(1)
    // Chromium reports the focused element's center as the position, not 0,0: a menu opened from the
    // keyboard can be placed at clientX/clientY like a mouse one.
    const box = (await page.locator("#target").boundingBox())!
    expect(calls[0].x).toBeGreaterThan(box.x)
    expect(calls[0].x).toBeLessThan(box.x + box.width)
    expect(calls[0].y).toBeGreaterThan(box.y)
    expect(calls[0].y).toBeLessThan(box.y + box.height)
  })

  test("is_ios recognizes iPhone, iPad and iPadOS", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { $context_menu } = window.__ELT__
      return [
        $context_menu.is_ios("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5),
        $context_menu.is_ios("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)", 5),
        $context_menu.is_ios("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5),
        $context_menu.is_ios("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0),
        $context_menu.is_ios("Mozilla/5.0 (Linux; Android 14)", 5),
      ]
    })
    expect(results).toEqual([true, true, true, false, false])
  })
})

test.describe("$context_menu long-press shim", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install()
    await page.evaluate(() => {
      const { $context_menu, node_append } = window.__ELT__
      $context_menu.install_long_press(document)
      document.body.innerHTML = `<div id="target" style="width:100px;height:40px">x</div><input id="field" />`
      const w = window as unknown as { menus: number; clicks: number; prevent: boolean }
      w.menus = 0
      w.clicks = 0
      w.prevent = true
      const target = document.getElementById("target")!
      node_append(
        target,
        $context_menu((ev) => {
          w.menus++
          if (w.prevent) ev.preventDefault()
        }),
      )
      target.addEventListener("click", () => w.clicks++)
      document.getElementById("field")!.addEventListener("contextmenu", () => w.menus++)
    })
  })

  /** Dispatch a touch pointer event on the element `id`, at `dx`/`dy` from its top-left. */
  async function touch(page: import("@playwright/test").Page, type: string, id: string, dx = 5, dy = 5) {
    await page.evaluate(
      ({ type, id, dx, dy }) => {
        const el = document.getElementById(id)!
        const r = el.getBoundingClientRect()
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerType: "touch",
            pointerId: 7,
            isPrimary: true,
            bubbles: true,
            cancelable: true,
            clientX: r.left + dx,
            clientY: r.top + dy,
          }),
        )
      },
      { type, id, dx, dy },
    )
  }

  async function counts(page: import("@playwright/test").Page) {
    return page.evaluate(() => {
      const w = window as unknown as { menus: number; clicks: number }
      return { menus: w.menus, clicks: w.clicks }
    })
  }

  async function click_target(page: import("@playwright/test").Page) {
    await page.evaluate(() =>
      document.getElementById("target")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
    )
  }

  test("holding still fires contextmenu, and the following click is swallowed", async ({ page }) => {
    const delay = await page.evaluate(() => window.__ELT__.$context_menu.LONG_PRESS_DELAY)
    await touch(page, "pointerdown", "target")
    await page.clock.runFor(delay - 50)
    expect(await counts(page)).toEqual({ menus: 0, clicks: 0 })
    await page.clock.runFor(100)
    expect((await counts(page)).menus).toBe(1)
    await touch(page, "pointerup", "target")
    await click_target(page)
    expect(await counts(page)).toEqual({ menus: 1, clicks: 0 })
    // Only that one click: the next one goes through.
    await click_target(page)
    expect((await counts(page)).clicks).toBe(1)
  })

  test("the click isn't swallowed when the callback didn't preventDefault", async ({ page }) => {
    await page.evaluate(() => {
      ;(window as unknown as { prevent: boolean }).prevent = false
    })
    await touch(page, "pointerdown", "target")
    await page.clock.runFor(600)
    await touch(page, "pointerup", "target")
    await click_target(page)
    expect(await counts(page)).toEqual({ menus: 1, clicks: 1 })
  })

  test("a swallow that no click consumed disarms instead of eating a later click", async ({ page }) => {
    await touch(page, "pointerdown", "target")
    await page.clock.runFor(600)
    await touch(page, "pointerup", "target")
    await page.clock.runFor(1000)
    await click_target(page)
    expect(await counts(page)).toEqual({ menus: 1, clicks: 1 })
  })

  test("pointercancel disarms the swallow", async ({ page }) => {
    await touch(page, "pointerdown", "target")
    await page.clock.runFor(600)
    await touch(page, "pointercancel", "target")
    await click_target(page)
    expect(await counts(page)).toEqual({ menus: 1, clicks: 1 })
  })

  test("moving beyond the tolerance cancels it", async ({ page }) => {
    await touch(page, "pointerdown", "target")
    await touch(page, "pointermove", "target", 30, 5)
    await page.clock.runFor(1000)
    expect((await counts(page)).menus).toBe(0)
  })

  test("a small move stays a long press", async ({ page }) => {
    await touch(page, "pointerdown", "target")
    await touch(page, "pointermove", "target", 8, 5)
    await page.clock.runFor(600)
    expect((await counts(page)).menus).toBe(1)
  })

  test("releasing early cancels it", async ({ page }) => {
    await touch(page, "pointerdown", "target")
    await page.clock.runFor(200)
    await touch(page, "pointerup", "target")
    await page.clock.runFor(1000)
    expect((await counts(page)).menus).toBe(0)
  })

  test("text fields keep their own long press", async ({ page }) => {
    await touch(page, "pointerdown", "field")
    await page.clock.runFor(1000)
    expect((await counts(page)).menus).toBe(0)
  })

  test("text_fields: true takes the long press in the node's text fields too", async ({ page }) => {
    await page.evaluate(() => {
      const { $context_menu, node_append } = window.__ELT__
      const w = window as unknown as { menus: number }
      const box = document.createElement("div")
      const field = document.createElement("input")
      field.id = "opted"
      box.append(field)
      node_append(document.body, box)
      node_append(
        box,
        $context_menu(
          (ev) => {
            w.menus++
            ev.preventDefault()
          },
          { text_fields: true },
        ),
      )
    })
    await touch(page, "pointerdown", "opted")
    await page.clock.runFor(600)
    expect((await counts(page)).menus).toBe(1)
  })

  test("mouse presses are ignored", async ({ page }) => {
    await page.evaluate(() => {
      document
        .getElementById("target")!
        .dispatchEvent(new PointerEvent("pointerdown", { pointerType: "mouse", isPrimary: true, bubbles: true }))
    })
    await page.clock.runFor(1000)
    expect((await counts(page)).menus).toBe(0)
  })
})
