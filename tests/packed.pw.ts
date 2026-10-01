import { expect, test } from "@playwright/test"
import { expect_seams } from "./seams"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("packed seam suppression (docs/md/ui-layout.md, per-element self-detection)", () => {
  test("row: bordered button followed by an unbordered sibling still suppresses its own trailing border", async ({
    page,
  }) => {
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

  test("column: bordered button followed by an unbordered sibling still suppresses its own trailing border", async ({
    page,
  }) => {
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

  test("row: two bordered buttons — earlier one's trailing edge suppressed, later one's leading edge stays", async ({
    page,
  }) => {
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
      const a = document.createElement("e-prose")
      a.setAttribute("border", "")
      const b = document.createElement("e-prose")
      b.setAttribute("border", "")
      row.append(a, b)
      document.body.appendChild(row)
      return getComputedStyle(a).borderRightStyle
    })
    expect(aRight).toBe("none")
  })

  test("interior corner radii are zeroed regardless of border presence, outer corners untouched — unchanged by the border-ownership rework", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      const a = document.createElement("e-prose")
      const b = document.createElement("e-prose")
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

  test("interior/outer radius handling is identical whether or not the packed container itself sets radius", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("radius", "")
      const a = document.createElement("e-prose")
      const b = document.createElement("e-prose")
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

test.describe("packed[border] (docs/md/ui-layout.md)", () => {
  test("packed[border] draws its own border and seams in that border's color", async ({ page }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.id = "packed-border"
      row.setAttribute("packed", "")
      row.setAttribute("border", "")
      document.body.appendChild(row)
      return getComputedStyle(row).borderTopStyle
    })
    expect(result).toBe("solid")
    await expect_seams(page, "#packed-border")
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

  test("packed[border] packs toggles like any child (regression: :has() out-ranked packed and kept the unchecked toggle's border)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const toggle = (checked: boolean) =>
        `<label e-variant="toggle"><input type="checkbox"${checked ? " checked" : ""}>Aa</label>`
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-row id="packed" surface="neutral-1" packed border><button>b</button>${toggle(false)}${toggle(true)}</e-row>
         <e-row id="loose">${toggle(false)}${toggle(true)}</e-row>`,
      )
      const st = (sel: string) => {
        const s = getComputedStyle(document.querySelector(sel)!)
        return { border: s.borderTopStyle, bg: s.backgroundColor }
      }
      return {
        button: st("#packed > button"),
        off: st("#packed > label:nth-of-type(1)"),
        on: st("#packed > label:nth-of-type(2)"),
        loose_off: st("#loose > label:nth-of-type(1)"),
        loose_on: st("#loose > label:nth-of-type(2)"),
      }
    })
    // Packed: no border of their own; unchecked on the group's surface, like the button; checked
    // keeps its fill.
    expect(result.off.border).toBe("none")
    expect(result.on.border).toBe("none")
    expect(result.off.bg).toBe(result.button.bg)
    expect(result.on.bg).not.toBe(result.button.bg)
    expect(result.on.bg).toBe(result.loose_on.bg)
    // Outside a packed group, the unchecked toggle keeps its own border.
    expect(result.loose_off.border).toBe("solid")
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

  test("packed[border] children have border: none on every side, even a child that itself carries [border]", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("border", "")
      const a = document.createElement("e-prose")
      a.setAttribute("border", "tint")
      row.append(a)
      document.body.appendChild(row)
      const s = getComputedStyle(a)
      return [s.borderTopStyle, s.borderRightStyle, s.borderBottomStyle, s.borderLeftStyle]
    })
    expect(result).toEqual(["none", "none", "none", "none"])
  })

  test("packed[border]'s own radius is inherited by the first/last child's outer corners, not whatever radius they'd resolve to on their own", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("border", "")
      row.setAttribute("radius", "section")
      row.setAttribute("pad", "none")
      // buttons carry a fixed "widget"-step radius of their own (ui/form.css.tsx), unrelated to
      // the container's radius — the exact mismatch this rule exists to correct.
      const a = document.createElement("button")
      const b = document.createElement("button")
      const c = document.createElement("button")
      row.append(a, b, c)
      document.body.appendChild(row)
      const rowRadius = getComputedStyle(row).borderTopLeftRadius
      const sa = getComputedStyle(a)
      const sc = getComputedStyle(c)
      const sb = getComputedStyle(b)
      return {
        rowRadius,
        aLeading: [sa.borderTopLeftRadius, sa.borderBottomLeftRadius],
        aTrailing: sa.borderTopRightRadius,
        cTrailing: [sc.borderTopRightRadius, sc.borderBottomRightRadius],
        cLeading: sc.borderTopLeftRadius,
        bAll: [sb.borderTopLeftRadius, sb.borderTopRightRadius, sb.borderBottomLeftRadius, sb.borderBottomRightRadius],
      }
    })
    expect(result.aLeading).toEqual([result.rowRadius, result.rowRadius])
    expect(result.aTrailing).toBe("0px")
    expect(result.cTrailing).toEqual([result.rowRadius, result.rowRadius])
    expect(result.cLeading).toBe("0px")
    expect(result.bAll).toEqual(["0px", "0px", "0px", "0px"])
  })

  test("packed[radius] WITHOUT its own border also owns the first/last child's outer corners", async ({ page }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("radius", "section")
      const a = document.createElement("button")
      const b = document.createElement("button")
      row.append(a, b)
      document.body.appendChild(row)
      const rowRadius = getComputedStyle(row).borderTopLeftRadius
      const sa = getComputedStyle(a)
      const sb = getComputedStyle(b)
      return {
        rowRadius,
        aLeading: [sa.borderTopLeftRadius, sa.borderBottomLeftRadius],
        bTrailing: [sb.borderTopRightRadius, sb.borderBottomRightRadius],
      }
    })
    expect(result.aLeading).toEqual([result.rowRadius, result.rowRadius])
    expect(result.bTrailing).toEqual([result.rowRadius, result.rowRadius])
  })

  test("plain packed — no [border], no [radius] on the container — leaves each child's own radius untouched at the outer edges", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      const a = document.createElement("e-prose")
      a.setAttribute("border", "")
      a.setAttribute("radius", "")
      const b = document.createElement("e-prose")
      b.setAttribute("border", "")
      b.setAttribute("radius", "")
      row.append(a, b)
      document.body.appendChild(row)
      const sa = getComputedStyle(a)
      const sb = getComputedStyle(b)
      return { aLeading: sa.borderTopLeftRadius, bTrailing: sb.borderTopRightRadius }
    })
    expect(result.aLeading).not.toBe("0px")
    expect(result.bTrailing).not.toBe("0px")
  })

  test("packed[border] does not clip its own overflow — radius is matched correctly instead (docs/md/ui-layout.md)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("border", "")
      document.body.appendChild(row)
      return getComputedStyle(row).overflowX
    })
    expect(result).toBe("visible")
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

test.describe("[surface]/[border] color-step value type (docs/md/ui-theme.md)", () => {
  test('border="neutral-surface" on an element with surface="neutral-2" resolves to neutral-3 — the level-stack offset', async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-prose")
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

  test('border="tint-surface" on an element with surface="neutral-2" resolves to tint at level 3 — the level tracks the element\'s own surface, the family is explicit', async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-prose")
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

  test("bare border ignores the element's own surface entirely — the flat widget color, not level-relative", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-prose")
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
      const el = document.createElement("e-prose")
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
      const el = document.createElement("e-prose")
      el.setAttribute("surface", "")
      document.body.appendChild(el)
      const ref = document.createElement("div")
      ref.style.backgroundColor = theme.colors.neutral.surface("n+1")
      document.body.appendChild(ref)
      return { bg: getComputedStyle(el).backgroundColor, ref: getComputedStyle(ref).backgroundColor }
    })
    expect(result.bg).toBe(result.ref)
  })

  test('border="tint-surface" with no surface on the same element resolves against the ambient surface', async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const outer = document.createElement("e-prose")
      outer.setAttribute("surface", "tint-2")
      const inner = document.createElement("e-prose")
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

test.describe("theme.css_radius own-pad vs ambient priority (docs/md/ui-layout.md)", () => {
  test('reads this element\'s own --e-pad when [pad="X"] is set on the same element', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const el = document.createElement("e-prose")
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

  test("falls back to the ambient --e-current-spacing when the element has no [pad] of its own but sits inside [spacing]", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const outer = document.createElement("e-row")
      outer.setAttribute("spacing", "section")
      const el = document.createElement("e-prose")
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

test.describe("[surface]/[border] no longer clip their own overflow (docs/md/ui-theme.md)", () => {
  test("[surface] does not set overflow at all, replacing the old unconditional overflow: hidden", async ({ page }) => {
    const overflow = await page.evaluate(() => {
      const el = document.createElement("e-prose")
      el.setAttribute("surface", "")
      document.body.appendChild(el)
      return getComputedStyle(el).overflowX
    })
    expect(overflow).toBe("visible")
  })

  test("[border] does not set overflow at all", async ({ page }) => {
    const overflow = await page.evaluate(() => {
      const el = document.createElement("e-prose")
      el.setAttribute("border", "")
      document.body.appendChild(el)
      return getComputedStyle(el).overflowX
    })
    expect(overflow).toBe("visible")
  })

  test("a focus ring inside [surface] is not clipped away", async ({ page }) => {
    const shadow = await page.evaluate(() => {
      const el = document.createElement("e-prose")
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

// packed pads the children that don't set their own [pad]; a child's own [pad] always wins, whatever
// the order of the rules in the stylesheet.
test.describe("packed and a child's own pad", () => {
  for (const packed of ["", "widget", "section"]) {
    test(`packed="${packed}": a child with pad="component" keeps it, a child without pad gets packed's`, async ({
      page,
    }) => {
      const r = await page.evaluate((packed) => {
        const col = document.createElement("e-column")
        col.setAttribute("packed", packed)
        col.setAttribute("pad", "nudge-4")
        const own = document.createElement("e-row")
        own.setAttribute("pad", "component")
        const plain = document.createElement("e-row")
        col.append(own, plain)
        document.body.appendChild(col)
        const probe = (step: string) => {
          const d = document.createElement("div")
          d.style.width = `var(--e-spacing-${step})`
          document.body.appendChild(d)
          return `${d.getBoundingClientRect().width}px`
        }
        return {
          own: getComputedStyle(own).paddingTop,
          plain: getComputedStyle(plain).paddingTop,
          component: probe("component"),
          expected_plain: probe(packed === "" ? "nudge-4" : packed),
        }
      }, packed)
      expect(r.own).toBe(r.component)
      expect(r.plain).toBe(r.expected_plain)
    })
  }
})
