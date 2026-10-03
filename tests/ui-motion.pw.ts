import { test, expect } from "@playwright/test"

// elt/ui motion: tokens, the defaults they drive, presets, and popup / dialog entering and leaving.
// The harness turns motion off ; these tests turn it on.

type W = Window & { result?: string }

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
  await page.evaluate(() => window.__ELT__.motion_enabled(true))
})

test.describe("tokens", () => {
  test("the default theme's tokens, as numbers in JS and as CSS custom properties", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { UI } = window.__ELT__
      const cs = getComputedStyle(document.body)
      return {
        motion: { ...UI.theme.motion },
        css: ["fast", "medium", "slow"].map((n) => cs.getPropertyValue(`--e-duration-${n}`).trim()),
        setting: UI.theme.settings.durationFast,
      }
    })
    expect(r.motion).toEqual({
      durationFast: 100,
      durationMedium: 150,
      durationSlow: 250,
      easingEnter: "cubic-bezier(0.22, 1, 0.36, 1)",
      easingLeave: "cubic-bezier(0.4, 0, 1, 1)",
    })
    expect(r.css).toEqual(["100ms", "150ms", "250ms"])
    expect(r.setting).toBe("var(--e-duration-fast, 100ms)")
  })

  test("a theme's settings take motion tokens as numbers", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { UI } = window.__ELT__
      const t = new UI.Theme({ light: { bg: "#fff", text: "#000", tint: "#00f" }, settings: { durationFast: 80 } })
      return { fast: t.motion.durationFast, medium: t.motion.durationMedium, setting: t.settings.durationFast }
    })
    expect(r).toEqual({ fast: 80, medium: 150, setting: "var(--e-duration-fast, 80ms)" })
  })

  test("motion_defaults follow the tokens, unless set explicitly", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { motion_defaults } = window.__ELT__
      const before = [motion_defaults.enter.duration, motion_defaults.enter.easing, motion_defaults.leave.easing]
      motion_defaults.leave.duration = 40
      return { before, leave: motion_defaults.leave.duration, enter: motion_defaults.enter.duration }
    })
    expect(r.before).toEqual([100, "cubic-bezier(0.22, 1, 0.36, 1)", "cubic-bezier(0.4, 0, 1, 1)"])
    expect(r).toMatchObject({ leave: 40, enter: 100 })
  })
})

test.describe("popup", () => {
  test("rises in, and sinks out before being removed ; focus goes back at once", async ({ page }) => {
    await page.evaluate(() => {
      const { UI } = window.__ELT__
      document.body.innerHTML = `<button id="opener">open</button>`
      const opener = document.getElementById("opener")!
      opener.focus()
      UI.popup(opener, () => {
        const c = document.createElement("e-column")
        c.innerHTML = `<button id="inside">in</button>`
        return c
      })
    })
    const opening = await page.evaluate(() => {
      const p = document.querySelector("[popover]")!
      const a = p.getAnimations()[0]
      return { count: p.getAnimations().length, duration: (a.effect as KeyframeEffect).getTiming().duration }
    })
    expect(opening).toEqual({ count: 1, duration: 150 })
    await page.keyboard.press("Escape")
    const closing = await page.evaluate(() => {
      const p = document.querySelector("[popover]")
      return {
        still_there: p != null,
        leaving: p?.hasAttribute("e-leaving"),
        open: p?.classList.contains("open"),
        focus: document.activeElement?.id,
      }
    })
    expect(closing).toEqual({ still_there: true, leaving: true, open: false, focus: "opener" })
    await expect(page.locator("[popover]")).toHaveCount(0)
  })

  test("under reduced motion, the popup only fades", async ({ page }) => {
    await page.evaluate(() => {
      const { UI, motion_reduced } = window.__ELT__
      motion_reduced(true)
      document.body.innerHTML = `<button id="opener">open</button>`
      UI.popup(document.getElementById("opener")!, () => {
        const c = document.createElement("e-column")
        c.textContent = "content"
        return c
      })
    })
    // The popup is inserted on the next frame
    await page.waitForSelector("[popover]")
    const kf = await page.evaluate(() => {
      const a = document.querySelector("[popover]")!.getAnimations()[0]
      return (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k))
    })
    expect(kf).toContain("opacity")
    expect(kf).not.toContain("transform")
  })
})

test.describe("dialog", () => {
  test("zooms in with its backdrop, zooms out, then is removed and gives focus back", async ({ page }) => {
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
        w.result = v === UI.show_dialog.closed ? "closed" : String(v)
      })
    })
    // Two animations on the dialog (itself and its backdrop), both durationSlow. Which one is the
    // backdrop's is told by what shows: WebKit reports its pseudoElement as "".
    const opening = await page.evaluate(async () => {
      const dialog = document.querySelector("dialog")!
      const durations = document
        .getAnimations()
        // the dialog's own motion, not transitions inside it (a focused button)
        .filter((a) => (a.effect as KeyframeEffect).target === dialog)
        .map((a) => (a.effect as KeyframeEffect).getTiming().duration)
      await new Promise((r) => setTimeout(r, 60))
      const opacity = (pseudo?: string) => Number(getComputedStyle(dialog, pseudo).opacity)
      return { durations, mid: [opacity(), opacity("::backdrop")].map((v) => v > 0 && v < 1) }
    })
    expect(opening).toEqual({ durations: [250, 250], mid: [true, true] })
    await page.keyboard.press("Escape")
    const closing = await page.evaluate(() => ({
      still_there: document.querySelector("dialog") != null,
      leaving: document.querySelector("dialog")?.hasAttribute("e-leaving"),
      result: (window as W).result,
    }))
    expect(closing).toEqual({ still_there: true, leaving: true, result: "closed" })
    await expect(page.locator("dialog")).toHaveCount(0)
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("opener")
  })
})
