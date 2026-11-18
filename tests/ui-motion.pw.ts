import { test, expect } from "./fixture"

// elt/ui motion: tokens, presets, and popup / dialog entering and leaving.
// The harness turns motion off ; these tests turn it on.

type W = Window & { result?: string }

test.beforeEach(async ({ page }) => {
  await page.evaluate(() => window.__ELT__.motion_enabled(true))
})

test.describe("tokens", () => {
  test("a theme's settings take motion tokens as numbers", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { UI } = window.__ELT__
      const t = new UI.Theme({ light: { bg: "#fff", text: "#000", tint: "#00f" }, settings: { durationFast: 80 } })
      return {
        fast: t.motion.durationFast,
        // Tokens left out keep the default theme's
        medium: t.motion.durationMedium === UI.theme.motion.durationMedium,
        setting: t.settings.durationFast,
      }
    })
    expect(r).toEqual({ fast: 80, medium: true, setting: "var(--e-duration-fast, 80ms)" })
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
      return {
        count: p.getAnimations().length,
        // The popup's motion follows the theme's medium duration token
        duration: (a.effect as KeyframeEffect).getTiming().duration === window.__ELT__.UI.theme.motion.durationMedium,
      }
    })
    expect(opening).toEqual({ count: 1, duration: true })
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
      UI.show_dialog({ label: "Test" }, () => {
        const c = document.createElement("e-column")
        c.innerHTML = `<button id="inside">in</button>`
        return c
      }).then((v) => {
        w.result = v === undefined ? "closed" : String(v)
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
      const slow = window.__ELT__.UI.theme.motion.durationSlow
      return {
        durations: durations.map((d) => d === slow),
        mid: [opacity(), opacity("::backdrop")].map((v) => v > 0 && v < 1),
      }
    })
    expect(opening).toEqual({ durations: [true, true], mid: [true, true] })
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
