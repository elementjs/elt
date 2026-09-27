import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("[border] value resolution (specs/elt-ui-guidelines.md, Surfaces and borders)", () => {
  test("bare [border] resolves to text.mid — a clear boundary, replacing the old border=\"widget\"", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-block")
      el.setAttribute("border", "")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.text.mid.toString()
      document.body.appendChild(ref)
      return {
        border: getComputedStyle(el).borderColor,
        ref: getComputedStyle(ref).borderColor,
      }
    })
    expect(result.border).toBe(result.ref)
  })

  test('[border="tint"] resolves to tint.mid instead of text.mid', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-block")
      el.setAttribute("border", "tint")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.tint.mid.toString()
      document.body.appendChild(ref)
      return {
        border: getComputedStyle(el).borderColor,
        ref: getComputedStyle(ref).borderColor,
        text_mid: getComputedStyle(el).borderColor === theme.colors.text.mid.toString(),
      }
    })
    expect(result.border).toBe(result.ref)
  })

  test('[border="n+2"] resolves to the surface-relative separator color, the old bare-[border] default', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-block")
      el.setAttribute("border", "n+2")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.tint.surface("n+2")
      document.body.appendChild(ref)
      return {
        border: getComputedStyle(el).borderColor,
        ref: getComputedStyle(ref).borderColor,
      }
    })
    expect(result.border).toBe(result.ref)
  })

  test('[border="n+K"] generalizes past n+2, matching [surface]\'s own relative-offset mechanism', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-block")
      el.setAttribute("border", "n+4")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.tint.surface("n+4")
      document.body.appendChild(ref)
      return {
        border: getComputedStyle(el).borderColor,
        ref: getComputedStyle(ref).borderColor,
      }
    })
    expect(result.border).toBe(result.ref)
  })
})

test.describe("[border] implies [radius] (specs/elt-ui-guidelines.md, Border radius is derived)", () => {
  test("a bordered element gets a nonzero radius by default, derived from its own padding step", async ({ page }) => {
    const result = await page.evaluate(() => {
      const el = document.createElement("e-block")
      el.setAttribute("border", "")
      el.setAttribute("pad", "component")
      document.body.appendChild(el)
      return getComputedStyle(el).borderTopLeftRadius
    })
    expect(result).not.toBe("0px")
  })

  test('radius="none" opts out even though a border is present', async ({ page }) => {
    const result = await page.evaluate(() => {
      const el = document.createElement("e-block")
      el.setAttribute("border", "")
      el.setAttribute("pad", "component")
      el.setAttribute("radius", "none")
      document.body.appendChild(el)
      return getComputedStyle(el).borderTopLeftRadius
    })
    expect(result).toBe("0px")
  })

  test("the implied radius applies uniformly across border values, including a divider's (n+2)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const el = document.createElement("e-block")
      el.setAttribute("border", "n+2")
      el.setAttribute("pad", "component")
      document.body.appendChild(el)
      return getComputedStyle(el).borderTopLeftRadius
    })
    expect(result).not.toBe("0px")
  })

  test('radius="section" is a fixed override, usable even without a border, for an element that does not pad itself', async ({ page }) => {
    // "section" (32px, halved to 16px) deliberately differs from the derived fallback an unpadded
    // element would otherwise get (--e-spacing-widget/2, 4px) — a step that happened to collide
    // with the fallback's value would pass even if the override selector never actually applied
    // (regression: [radius="${sp}"] used to be silently outranked by the general
    // :not([radius="none"]) rule's higher specificity — see ui/layout.css.tsx).
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-block")
      el.setAttribute("radius", "section")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderRadius = `calc(${theme.settings.spacingSection} / 2)`
      document.body.appendChild(ref)
      return {
        radius: getComputedStyle(el).borderTopLeftRadius,
        ref: getComputedStyle(ref).borderTopLeftRadius,
      }
    })
    expect(result.radius).toBe(result.ref)
    expect(result.radius).not.toBe("4px")
  })
})

test.describe("Theme.css.radius (ui/theme.tsx)", () => {
  test("no step: derives from the element's own padding, halved — the same expression [border]/[radius] fall back to", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.css.radius()
    })
    expect(result).toBe("border-radius: calc(var(--e-pad, var(--e-spacing-widget)) / 2);")
  })

  test("a named step overrides with that step's own value, halved", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.css.radius("component")
    })
    expect(result).toBe("border-radius: calc(var(--e-spacing-component) / 2);")
  })

  test("a raw nudge step reads its symmetric variable, not a -vertical suffix", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.css.radius("nudge-4")
    })
    expect(result).toBe("border-radius: var(--e-spacing-nudge-4);")
  })
})

test.describe("Spacing scale nudge rename (regression: '1'/'2'/'4' -> 'nudge-1'/'nudge-2'/'nudge-4')", () => {
  test("spacing_steps only contains the new named nudges", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { spacing_steps } = window.__ELT__.UI
      return spacing_steps
    })
    expect(result).toContain("nudge-1")
    expect(result).toContain("nudge-2")
    expect(result).toContain("nudge-4")
    expect(result).not.toContain("1")
    expect(result).not.toContain("2")
    expect(result).not.toContain("4")
  })

  test("the renamed nudge custom properties are emitted with their expected px values", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.css_settings
    })
    expect(result).toContain("--e-spacing-nudge-1: 1px;")
    expect(result).toContain("--e-spacing-nudge-2: 2px;")
    expect(result).toContain("--e-spacing-nudge-4: 4px;")
  })
})
