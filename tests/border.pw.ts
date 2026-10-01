import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("[border]/[surface] color-step value type (docs/md/ui-theme.md)", () => {
  test('bare [border] resolves to the flat "widget" neutral color (neutral.faded), independent of ambient surface', async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-prose")
      el.setAttribute("border", "")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.neutral.faded.toString()
      document.body.appendChild(ref)
      return { border: getComputedStyle(el).borderColor, ref: getComputedStyle(ref).borderColor }
    })
    expect(result.border).toBe(result.ref)
  })

  test('[border="tint"] resolves to the flat "widget" tint color (tint.mid)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-prose")
      el.setAttribute("border", "tint")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.tint.mid.toString()
      document.body.appendChild(ref)
      return { border: getComputedStyle(el).borderColor, ref: getComputedStyle(ref).borderColor }
    })
    expect(result.border).toBe(result.ref)
  })

  test('[border="neutral"] resolves to the same flat neutral.faded as bare [border]', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-prose")
      el.setAttribute("border", "neutral")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.neutral.faded.toString()
      document.body.appendChild(ref)
      return { border: getComputedStyle(el).borderColor, ref: getComputedStyle(ref).borderColor }
    })
    expect(result.border).toBe(result.ref)
  })

  test('[border="tint-surface"] resolves to the tint family, one level up from ambient — the level-stack offset, not the flat widget color', async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-prose")
      el.setAttribute("border", "tint-surface")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.tint.surface("n+1")
      document.body.appendChild(ref)
      return { border: getComputedStyle(el).borderColor, ref: getComputedStyle(ref).borderColor }
    })
    expect(result.border).toBe(result.ref)
  })

  test('[border="neutral-separator"] resolves to the neutral family, two levels up from ambient', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-prose")
      el.setAttribute("border", "neutral-separator")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.neutral.surface("n+2")
      document.body.appendChild(ref)
      return { border: getComputedStyle(el).borderColor, ref: getComputedStyle(ref).borderColor }
    })
    expect(result.border).toBe(result.ref)
  })

  test('[border="tint-4"] resolves to the tint family at the absolute level 4', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-prose")
      el.setAttribute("border", "tint-4")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.tint.surface(4)
      document.body.appendChild(ref)
      return { border: getComputedStyle(el).borderColor, ref: getComputedStyle(ref).borderColor }
    })
    expect(result.border).toBe(result.ref)
  })

  test('[surface="tint-3"] resolves to the tint family at the absolute level 3', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-prose")
      el.setAttribute("surface", "tint-3")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.backgroundColor = theme.colors.tint.surface(3)
      document.body.appendChild(ref)
      return { bg: getComputedStyle(el).backgroundColor, ref: getComputedStyle(ref).backgroundColor }
    })
    expect(result.bg).toBe(result.ref)
  })

  test('[surface="neutral-3"] resolves to the neutral family at the absolute level 3', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-prose")
      el.setAttribute("surface", "neutral-3")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.backgroundColor = theme.colors.neutral.surface(3)
      document.body.appendChild(ref)
      return { bg: getComputedStyle(el).backgroundColor, ref: getComputedStyle(ref).backgroundColor }
    })
    expect(result.bg).toBe(result.ref)
  })

  test('[surface="background"] is absolute level 0', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-prose")
      el.setAttribute("surface", "background")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.backgroundColor = theme.colors.neutral.surface("background")
      document.body.appendChild(ref)
      return { bg: getComputedStyle(el).backgroundColor, ref: getComputedStyle(ref).backgroundColor }
    })
    expect(result.bg).toBe(result.ref)
  })
})

test.describe("[hover] follows the ambient surface family (docs/md/ui-theme.md)", () => {
  test("on a neutral-family surface, hover fill is neutral, not the old hardcoded tint", async ({ page }) => {
    await page.evaluate(() => {
      const outer = document.createElement("e-prose")
      outer.setAttribute("surface", "neutral-2")
      outer.id = "hover-test-outer"
      const inner = document.createElement("e-prose")
      inner.setAttribute("hover", "")
      inner.id = "hover-test-inner"
      inner.style.width = "40px"
      inner.style.height = "40px"
      outer.append(inner)
      document.body.appendChild(outer)
    })
    await page.locator("#hover-test-inner").hover()
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const inner = document.getElementById("hover-test-inner")!
      const ref = document.createElement("div")
      ref.style.backgroundColor = theme.colors.neutral.surface(3)
      document.body.appendChild(ref)
      const tintRef = document.createElement("div")
      tintRef.style.backgroundColor = theme.colors.tint.surface(3)
      document.body.appendChild(tintRef)
      return {
        hover: getComputedStyle(inner).backgroundColor,
        neutralRef: getComputedStyle(ref).backgroundColor,
        tintRef: getComputedStyle(tintRef).backgroundColor,
      }
    })
    expect(result.hover).toBe(result.neutralRef)
    expect(result.hover).not.toBe(result.tintRef)
  })
})

test.describe("[border] implies [radius] (docs/md/ui-layout.md, Borders and radius)", () => {
  test("a bordered element gets a nonzero radius by default, derived from its own padding step", async ({ page }) => {
    const result = await page.evaluate(() => {
      const el = document.createElement("e-prose")
      el.setAttribute("border", "")
      el.setAttribute("pad", "component")
      document.body.appendChild(el)
      return getComputedStyle(el).borderTopLeftRadius
    })
    expect(result).not.toBe("0px")
  })

  test('radius="none" opts out even though a border is present', async ({ page }) => {
    const result = await page.evaluate(() => {
      const el = document.createElement("e-prose")
      el.setAttribute("border", "")
      el.setAttribute("pad", "component")
      el.setAttribute("radius", "none")
      document.body.appendChild(el)
      return getComputedStyle(el).borderTopLeftRadius
    })
    expect(result).toBe("0px")
  })

  test("the implied radius applies uniformly across border values, including an absolute one (tint-2)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const el = document.createElement("e-prose")
      el.setAttribute("border", "tint-2")
      el.setAttribute("pad", "component")
      document.body.appendChild(el)
      return getComputedStyle(el).borderTopLeftRadius
    })
    expect(result).not.toBe("0px")
  })

  test('radius="section" is a fixed override, usable even without a border, for an element that does not pad itself', async ({
    page,
  }) => {
    // "section" (32px) deliberately differs from the derived fallback an unpadded element would
    // otherwise get (--e-spacing-widget, 6px) — a step that happened to collide with the
    // fallback's value would pass even if the override selector never actually applied
    // (regression: [radius="${sp}"] used to be silently outranked by the general
    // :not([radius="none"]) rule's higher specificity — see ui/layout.css.tsx).
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-prose")
      el.setAttribute("radius", "section")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderRadius = theme.settings.spacingSection
      document.body.appendChild(ref)
      return {
        radius: getComputedStyle(el).borderTopLeftRadius,
        ref: getComputedStyle(ref).borderTopLeftRadius,
      }
    })
    expect(result.radius).toBe(result.ref)
    expect(result.radius).not.toBe("6px")
  })
})

test.describe("Theme.css_radius (ui/theme.tsx)", () => {
  test("no step: derives from the ambient --e-current-spacing, falling back to --e-spacing-widget", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.css_radius()
    })
    expect(result).toBe("border-radius: calc(var(--e-current-spacing, var(--e-spacing-widget)));")
  })

  test("a named step overrides with that step's own value", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.css_radius("component")
    })
    expect(result).toBe("border-radius: calc(var(--e-spacing-component));")
  })

  test("a raw nudge step reads its symmetric variable, not a -vertical suffix", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.css_radius("nudge-4")
    })
    expect(result).toBe("border-radius: var(--e-spacing-nudge-4);")
  })
})

test.describe("theme.class_radius/current_surface (docs/md/ui-theme.md)", () => {
  test("theme.class_radius() produces a class equivalent to theme.css_radius()'s declaration", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const cls = theme.class_radius("component")
      const el = document.createElement("div")
      el.className = cls
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderRadius = theme.settings.spacingComponent
      document.body.appendChild(ref)
      return { radius: getComputedStyle(el).borderTopLeftRadius, ref: getComputedStyle(ref).borderTopLeftRadius }
    })
    expect(result.radius).toBe(result.ref)
  })

  test("theme.class_current_surface applies background: var(--e-current-surface)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("div")
      el.className = theme.class_current_surface
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.backgroundColor = theme.colors.bg.toString()
      document.body.appendChild(ref)
      return { bg: getComputedStyle(el).backgroundColor, ref: getComputedStyle(ref).backgroundColor }
    })
    expect(result.bg).toBe(result.ref)
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

test.describe("<pre> radius and overflow (docs/md/ui-layout.md)", () => {
  test("<pre> inherits its immediate parent's border-radius, matching a rounded wrapper's corners", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const wrapper = document.createElement("e-prose")
      wrapper.setAttribute("border", "")
      wrapper.setAttribute("pad", "none")
      const pre = document.createElement("pre")
      const code = document.createElement("code")
      code.textContent = "const x = 1"
      pre.appendChild(code)
      wrapper.appendChild(pre)
      document.body.appendChild(wrapper)
      return {
        wrapperRadius: getComputedStyle(wrapper).borderTopLeftRadius,
        preRadius: getComputedStyle(pre).borderTopLeftRadius,
      }
    })
    expect(result.preRadius).toBe(result.wrapperRadius)
    expect(result.preRadius).not.toBe("0px")
  })

  test("<pre> with no rounded wrapper stays at 0 radius, unchanged from before", async ({ page }) => {
    const result = await page.evaluate(() => {
      const wrapper = document.createElement("e-prose")
      const pre = document.createElement("pre")
      pre.textContent = "const x = 1"
      wrapper.appendChild(pre)
      document.body.appendChild(wrapper)
      return getComputedStyle(pre).borderTopLeftRadius
    })
    expect(result).toBe("0px")
  })

  test("<pre> does not show a phantom vertical scrollbar on content that fits", async ({ page }) => {
    // overflow-x: auto alone forces overflow-y's used value to auto too (CSS spec: computed
    // "visible" on one axis becomes "auto" when the other axis isn't "visible"), which then
    // reports a small phantom scrollHeight > clientHeight on <pre> even though the box renders at
    // its full natural height either way (clientHeight matches an unconstrained overflow:visible
    // baseline in both cases) — pinning overflow-y explicitly avoids the coercion so no scrollbar
    // shows. This asserts the visible-scrollbar-relevant property (overflow-y itself), not
    // scrollHeight, which can still legitimately differ as a harmless measurement artifact.
    const result = await page.evaluate(() => {
      const wrapper = document.createElement("e-prose")
      const pre = document.createElement("pre")
      const code = document.createElement("code")
      code.textContent = "const x = 1"
      pre.appendChild(code)
      wrapper.appendChild(pre)
      document.body.appendChild(wrapper)
      return { clientHeight: pre.clientHeight, overflowY: getComputedStyle(pre).overflowY }
    })
    expect(result.overflowY).not.toBe("auto")
    expect(result.clientHeight).toBeGreaterThan(0)
  })

  test("<pre> still scrolls horizontally when a line is too wide", async ({ page }) => {
    const overflowX = await page.evaluate(() => {
      const wrapper = document.createElement("e-prose")
      const pre = document.createElement("pre")
      wrapper.appendChild(pre)
      document.body.appendChild(wrapper)
      return getComputedStyle(pre).overflowX
    })
    expect(overflowX).toBe("auto")
  })

  test('<pre> scrolls itself instead of pushing an align="stretch" flex ancestor past the page width', async ({
    page,
  }) => {
    // A flex column's own cross-axis (width) sizing for a non-stretched item is unbounded by the
    // container's width — it uses the item's own max-content, not fit-content capped at available
    // space (unlike the container's main axis, which min-width: 0 alone fixes). "stretch" (either
    // the container's align="stretch", used here, or self-align="stretch" on just the one child
    // that needs it, as docs/src/code-example.tsx's CodeExample does — a plain align="stretch" on
    // that column would also stretch its unrelated tab-button row) is what actually constrains a
    // block child's width to the column's own width; without it, an unbreakable <pre> line still
    // pushes the item past the column instead of scrolling internally at its own overflow-x: auto
    // boundary. Not something layout.css.tsx can default for every child, since e-column's own
    // default alignment (baseline) is deliberate for other, non-stretch-shaped content.
    const result = await page.evaluate(() => {
      const column = document.createElement("e-column")
      column.setAttribute("align", "stretch")
      column.style.width = "300px"
      const wrapper = document.createElement("e-prose")
      wrapper.setAttribute("border", "")
      wrapper.setAttribute("pad", "none")
      const pre = document.createElement("pre")
      const code = document.createElement("code")
      code.textContent = "x".repeat(300)
      pre.appendChild(code)
      wrapper.appendChild(pre)
      column.appendChild(wrapper)
      document.body.appendChild(column)
      return {
        columnClientWidth: column.clientWidth,
        columnScrollWidth: column.scrollWidth,
        preScrollWidth: pre.scrollWidth,
        preClientWidth: pre.clientWidth,
      }
    })
    expect(result.columnScrollWidth).toBe(result.columnClientWidth)
    expect(result.preScrollWidth).toBeGreaterThan(result.preClientWidth)
  })
})
