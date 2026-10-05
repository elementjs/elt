import { type Page, expect, test } from "./fixture"

// The scheme classes set the CSS `color-scheme` (docs/md/ui-theme.md#setup), so what the browser
// draws itself (scrollbars, native parts of form controls) and `light-dark()` follow the theme.

type Force = "default" | "light" | "dark"

/** Emulates the system scheme, forces the theme through `o_force_theme` (as an app does), and waits
 * a frame for the body class to switch. */
async function setup(page: Page, system: "light" | "dark", force: Force) {
  await page.emulateMedia({ colorScheme: system })
  await page.evaluate(async (force) => {
    const { UI, frames } = window.__ELT__
    UI.o_force_theme.set(force)
    await frames(1)
  }, force)
}

test.describe("scheme classes set color-scheme", () => {
  const expected: Record<Force, string> = { default: "light dark", light: "light", dark: "dark" }
  for (const force of ["default", "light", "dark"] as const)
    test(`o_force_theme "${force}": body color-scheme is "${expected[force]}"`, async ({ page }) => {
      await setup(page, "light", force)
      expect(await page.evaluate(() => getComputedStyle(document.body).colorScheme)).toBe(expected[force])
    })

  test("a native control inside a forced-dark body is drawn dark, under a light system", async ({ page }) => {
    await setup(page, "light", "dark")
    // A system color resolves against the element's used color scheme: dark Canvas under "dark".
    const bg = await page.evaluate(() => {
      const el = document.createElement("div")
      el.style.backgroundColor = "Canvas"
      document.body.append(el)
      return getComputedStyle(el).backgroundColor
    })
    expect(bg).not.toBe("rgb(255, 255, 255)")
  })

  // The date/time picker icon used to be inverted under `prefers-color-scheme: dark`, ignoring the
  // forced theme: a forced-light field under a dark system got a white icon on white. It now only
  // depends on the forced theme. (Chromium does not report the pseudo-element's computed filter, so
  // this compares pixels.)
  for (const force of ["light", "dark"] as const)
    test(`a forced-${force} date field looks the same under both system schemes`, async ({ page }) => {
      await page.evaluate(() => {
        const input = document.createElement("input")
        input.type = "date"
        input.value = "2026-10-04"
        input.id = "d"
        document.body.append(input)
      })
      await setup(page, "light", force)
      const under_light = await page.locator("#d").screenshot()
      await setup(page, "dark", force)
      const under_dark = await page.locator("#d").screenshot()
      expect(under_dark.equals(under_light)).toBe(true)
    })
})

test.describe("docs code token colors follow the scheme through light-dark()", () => {
  const LIGHT = "rgb(215, 58, 73)" // #D73A49
  const DARK = "rgb(249, 117, 131)" // #F97583

  /** The color of a token span, placed in `body` or inside a nested scheme class. */
  async function tokenColor(page: Page, nested?: "light" | "dark") {
    return page.evaluate((nested) => {
      const { UI, Docs } = window.__ELT__
      const span = document.createElement("span")
      span.className = Docs.tokenColorClass("#D73A49", "#F97583")
      let parent: HTMLElement = document.body
      if (nested) {
        parent = document.createElement("div")
        parent.className = nested === "light" ? UI.theme.class_light_scheme : UI.theme.class_dark_scheme
        document.body.append(parent)
      }
      parent.append(span)
      return getComputedStyle(span).color
    }, nested)
  }

  const cases: [system: "light" | "dark", force: Force, color: string][] = [
    ["dark", "light", LIGHT],
    ["light", "dark", DARK],
    ["light", "default", LIGHT],
    ["dark", "default", DARK],
  ]
  for (const [system, force, color] of cases)
    test(`system ${system}, o_force_theme "${force}"`, async ({ page }) => {
      await setup(page, system, force)
      expect(await tokenColor(page)).toBe(color)
    })

  // The old ancestor selectors gave the dark color here, since the body's class matched too.
  test("a light scheme class nested in a forced-dark body gives the light color", async ({ page }) => {
    await setup(page, "light", "dark")
    expect(await tokenColor(page, "light")).toBe(LIGHT)
  })

  test("a dark scheme class nested in a forced-light body gives the dark color", async ({ page }) => {
    await setup(page, "dark", "light")
    expect(await tokenColor(page, "dark")).toBe(DARK)
  })
})
