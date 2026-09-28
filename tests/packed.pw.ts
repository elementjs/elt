import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("packed seam suppression (specs/borders.md, per-element self-detection)", () => {
  test("row: bordered button followed by an unbordered sibling still suppresses its own trailing border", async ({ page }) => {
    const aRight = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      const a = document.createElement("button")
      const plain = document.createElement("div")
      row.append(a, plain)
      document.body.appendChild(row)
      return getComputedStyle(a).borderRightStyle
    })
    expect(aRight).toBe("none")
  })

  test("column: bordered button followed by an unbordered sibling still suppresses its own trailing border", async ({ page }) => {
    const aBottom = await page.evaluate(() => {
      const col = document.createElement("e-column")
      col.setAttribute("packed", "")
      const a = document.createElement("button")
      const plain = document.createElement("div")
      col.append(a, plain)
      document.body.appendChild(col)
      return getComputedStyle(a).borderBottomStyle
    })
    expect(aBottom).toBe("none")
  })

  test("row: two bordered buttons — earlier one's trailing edge suppressed, later one's leading edge stays", async ({ page }) => {
    const [aRight, bLeft] = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      const a = document.createElement("button")
      const b = document.createElement("button")
      row.append(a, b)
      document.body.appendChild(row)
      return [getComputedStyle(a).borderRightStyle, getComputedStyle(b).borderLeftStyle]
    })
    expect(aRight).toBe("none")
    expect(bLeft).toBe("solid")
  })

  test("row: a bordered :last-child keeps its border on every side", async ({ page }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      const a = document.createElement("button")
      const b = document.createElement("button")
      row.append(a, b)
      document.body.appendChild(row)
      const sb = getComputedStyle(b)
      return [sb.borderTopStyle, sb.borderRightStyle, sb.borderBottomStyle, sb.borderLeftStyle]
    })
    expect(result).toEqual(["solid", "solid", "solid", "solid"])
  })

  test("column: a bordered :last-child keeps its border on every side", async ({ page }) => {
    const result = await page.evaluate(() => {
      const col = document.createElement("e-column")
      col.setAttribute("packed", "")
      const a = document.createElement("button")
      const b = document.createElement("button")
      col.append(a, b)
      document.body.appendChild(col)
      const sb = getComputedStyle(b)
      return [sb.borderTopStyle, sb.borderRightStyle, sb.borderBottomStyle, sb.borderLeftStyle]
    })
    expect(result).toEqual(["solid", "solid", "solid", "solid"])
  })

  test("two packed toggle-icon labels still dedup correctly with no BORDERED_SELECTOR lookup", async ({ page }) => {
    const [aRight, bLeft] = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      const a = document.createElement("label")
      a.setAttribute("e-variant", "toggle")
      a.innerHTML = '<input type="checkbox">'
      const b = document.createElement("label")
      b.setAttribute("e-variant", "toggle")
      b.innerHTML = '<input type="checkbox">'
      row.append(a, b)
      document.body.appendChild(row)
      return [getComputedStyle(a).borderRightStyle, getComputedStyle(b).borderLeftStyle]
    })
    expect(aRight).toBe("none")
    expect(bLeft).toBe("solid")
  })

  test("a custom [border] element is suppressed the same as any native control", async ({ page }) => {
    const aRight = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      const a = document.createElement("e-block")
      a.setAttribute("border", "")
      const b = document.createElement("e-block")
      b.setAttribute("border", "")
      row.append(a, b)
      document.body.appendChild(row)
      return getComputedStyle(a).borderRightStyle
    })
    expect(aRight).toBe("none")
  })

  test("interior corner radii are zeroed regardless of border presence, outer corners untouched — unchanged by the border-ownership rework", async ({ page }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      const a = document.createElement("e-block")
      const b = document.createElement("e-block")
      a.setAttribute("border", "")
      a.setAttribute("radius", "")
      b.setAttribute("border", "")
      b.setAttribute("radius", "")
      row.append(a, b)
      document.body.appendChild(row)
      const sa = getComputedStyle(a)
      const sb = getComputedStyle(b)
      return {
        aTopRight: sa.borderTopRightRadius,
        aBottomRight: sa.borderBottomRightRadius,
        aTopLeft: sa.borderTopLeftRadius,
        bTopLeft: sb.borderTopLeftRadius,
        bBottomLeft: sb.borderBottomLeftRadius,
        bBottomRight: sb.borderBottomRightRadius,
      }
    })
    expect(result.aTopRight).toBe("0px")
    expect(result.aBottomRight).toBe("0px")
    expect(result.bTopLeft).toBe("0px")
    expect(result.bBottomLeft).toBe("0px")
    // outer corners keep their real radius (nonzero — the exact value is the spacing-widget step)
    expect(result.aTopLeft).not.toBe("0px")
    expect(result.bBottomRight).not.toBe("0px")
  })

  test("interior/outer radius handling is identical whether or not the packed container itself sets radius", async ({ page }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("radius", "")
      const a = document.createElement("e-block")
      const b = document.createElement("e-block")
      a.setAttribute("border", "")
      a.setAttribute("radius", "")
      b.setAttribute("border", "")
      b.setAttribute("radius", "")
      row.append(a, b)
      document.body.appendChild(row)
      const sa = getComputedStyle(a)
      const sb = getComputedStyle(b)
      return {
        aTopRight: sa.borderTopRightRadius,
        aTopLeft: sa.borderTopLeftRadius,
        bBottomRight: sb.borderBottomRightRadius,
      }
    })
    expect(result.aTopRight).toBe("0px")
    expect(result.aTopLeft).not.toBe("0px")
    expect(result.bBottomRight).not.toBe("0px")
  })
})

test.describe("packed[border] (specs/borders.md)", () => {
  test("packed[border] draws its own border and its own background matches that border's color", async ({ page }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("border", "")
      document.body.appendChild(row)
      const s = getComputedStyle(row)
      return { border: s.borderTopStyle, borderColor: s.borderTopColor, background: s.backgroundColor }
    })
    expect(result.border).toBe("solid")
    expect(result.background).toBe(result.borderColor)
  })

  test("packed[border] gap between children is 1px", async ({ page }) => {
    const gap = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("border", "")
      document.body.appendChild(row)
      return getComputedStyle(row).columnGap
    })
    expect(gap).toBe("1px")
  })

  test("packed[border] children get the current-surface background by default", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("border", "")
      const a = document.createElement("button")
      row.append(a)
      document.body.appendChild(row)
      const ref = document.createElement("div")
      ref.style.backgroundColor = theme.colors.bg.toString()
      document.body.appendChild(ref)
      return { a: getComputedStyle(a).backgroundColor, ref: getComputedStyle(ref).backgroundColor }
    })
    expect(result.a).toBe(result.ref)
  })

  test("packed[border] children keep their own explicit background over the default", async ({ page }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("border", "")
      const a = document.createElement("button")
      a.style.backgroundColor = "rgb(1, 2, 3)"
      row.append(a)
      document.body.appendChild(row)
      return getComputedStyle(a).backgroundColor
    })
    expect(result).toBe("rgb(1, 2, 3)")
  })

  test("packed[border] children have border: none on every side, even a child that itself carries [border]", async ({ page }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("border", "")
      const a = document.createElement("e-block")
      a.setAttribute("border", "tint")
      row.append(a)
      document.body.appendChild(row)
      const s = getComputedStyle(a)
      return [s.borderTopStyle, s.borderRightStyle, s.borderBottomStyle, s.borderLeftStyle]
    })
    expect(result).toEqual(["none", "none", "none", "none"])
  })

  test("packed[border] sets overflow: clip with overflow-clip-margin equal to focusRingSize", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("border", "")
      document.body.appendChild(row)
      const ref = document.createElement("div")
      ref.style.width = theme.settings.focusRingSize
      document.body.appendChild(ref)
      const s = getComputedStyle(row)
      return { overflow: s.overflowX, margin: s.overflowClipMargin, expectedPx: getComputedStyle(ref).width }
    })
    expect(result.overflow).toBe("clip")
    expect(result.margin).toBe(result.expectedPx)
  })

  test("a focus ring inside packed[border] is not clipped away — box-shadow is present on focus", async ({ page }) => {
    const shadow = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("border", "")
      const a = document.createElement("button")
      row.append(a)
      document.body.appendChild(row)
      a.focus()
      return getComputedStyle(a).boxShadow
    })
    expect(shadow).not.toBe("none")
  })
})

test.describe("[surface]/[border] color-step value type (specs/borders.md)", () => {
  test('border="neutral-surface" on an element with surface="neutral-2" resolves to neutral-3 — the level-stack offset', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-block")
      el.setAttribute("surface", "neutral-2")
      el.setAttribute("border", "neutral-surface")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.neutral.surface(3)
      document.body.appendChild(ref)
      return { border: getComputedStyle(el).borderColor, ref: getComputedStyle(ref).borderColor }
    })
    expect(result.border).toBe(result.ref)
  })

  test('border="tint-surface" on an element with surface="neutral-2" resolves to tint at level 3 — the level tracks the element\'s own surface, the family is explicit', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-block")
      el.setAttribute("surface", "neutral-2")
      el.setAttribute("border", "tint-surface")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.tint.surface(3)
      document.body.appendChild(ref)
      return { border: getComputedStyle(el).borderColor, ref: getComputedStyle(ref).borderColor }
    })
    expect(result.border).toBe(result.ref)
  })

  test('bare border ignores the element\'s own surface entirely — the flat widget color, not level-relative', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-block")
      el.setAttribute("surface", "neutral-2")
      el.setAttribute("border", "")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.neutral.faded.toString()
      document.body.appendChild(ref)
      return { border: getComputedStyle(el).borderColor, ref: getComputedStyle(ref).borderColor }
    })
    expect(result.border).toBe(result.ref)
  })

  test('border="neutral-4" (absolute) ignores the element\'s own surface value', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-block")
      el.setAttribute("surface", "tint-1")
      el.setAttribute("border", "neutral-4")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.neutral.surface(4)
      document.body.appendChild(ref)
      return { border: getComputedStyle(el).borderColor, ref: getComputedStyle(ref).borderColor }
    })
    expect(result.border).toBe(result.ref)
  })

  test("bare surface (no value) resolves to the neutral family, one level up from ambient", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-block")
      el.setAttribute("surface", "")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.backgroundColor = theme.colors.neutral.surface("n+1")
      document.body.appendChild(ref)
      return { bg: getComputedStyle(el).backgroundColor, ref: getComputedStyle(ref).backgroundColor }
    })
    expect(result.bg).toBe(result.ref)
  })

  test('border="tint-surface" with no surface on the same element resolves against the ambient surface', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const outer = document.createElement("e-block")
      outer.setAttribute("surface", "tint-2")
      const inner = document.createElement("e-block")
      inner.setAttribute("border", "tint-surface")
      outer.append(inner)
      document.body.appendChild(outer)
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.tint.surface(3)
      document.body.appendChild(ref)
      return { border: getComputedStyle(inner).borderColor, ref: getComputedStyle(ref).borderColor }
    })
    expect(result.border).toBe(result.ref)
  })
})

test.describe("theme.css.radius own-pad vs ambient priority (specs/borders.md)", () => {
  test("reads this element's own --e-pad when [pad=\"X\"] is set on the same element", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-block")
      el.setAttribute("radius", "")
      el.setAttribute("pad", "section")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.borderRadius = theme.settings.spacingSection
      document.body.appendChild(ref)
      return { radius: getComputedStyle(el).borderTopLeftRadius, ref: getComputedStyle(ref).borderTopLeftRadius }
    })
    expect(result.radius).toBe(result.ref)
  })

  test("falls back to the ambient --e-current-spacing when the element has no [pad] of its own but sits inside [spacing]", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const outer = document.createElement("e-row")
      outer.setAttribute("spacing", "section")
      const el = document.createElement("e-block")
      el.setAttribute("radius", "")
      outer.append(el)
      document.body.appendChild(outer)
      const ref = document.createElement("div")
      ref.style.borderRadius = theme.settings.spacingSection
      document.body.appendChild(ref)
      return { radius: getComputedStyle(el).borderTopLeftRadius, ref: getComputedStyle(ref).borderTopLeftRadius }
    })
    expect(result.radius).toBe(result.ref)
  })
})

test.describe("[surface] overflow fix (specs/borders.md)", () => {
  test("[surface] sets overflow: clip, replacing the old unconditional overflow: hidden", async ({ page }) => {
    const overflow = await page.evaluate(() => {
      const el = document.createElement("e-block")
      el.setAttribute("surface", "")
      document.body.appendChild(el)
      return getComputedStyle(el).overflowX
    })
    expect(overflow).toBe("clip")
  })

  test("a focus ring inside [surface] is not clipped away", async ({ page }) => {
    const shadow = await page.evaluate(() => {
      const el = document.createElement("e-block")
      el.setAttribute("surface", "")
      const a = document.createElement("button")
      el.append(a)
      document.body.appendChild(el)
      a.focus()
      return getComputedStyle(a).boxShadow
    })
    expect(shadow).not.toBe("none")
  })
})
