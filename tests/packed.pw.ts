import { type Page, expect, test } from "./fixture"
import { expect_seams } from "./seams"

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

  // A child whose border carries meaning (ui/selectors.ts MEANINGFUL_BORDER_SELECTOR) owns the line it
  // shares with the next child: it keeps its trailing edge and the next child drops its leading one.
  test("row: a checked toggle keeps its trailing edge; the plain neighbour after it drops its leading one", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-row id="r" packed><button>a</button><label e-variant="toggle"><input type="checkbox" checked>b</label><button>c</button></e-row>`,
      )
      const [a, b, c] = [...document.getElementById("r")!.children].map((e) => getComputedStyle(e))
      return {
        a_right: a.borderRightStyle,
        b_left: b.borderLeftStyle,
        b_right: b.borderRightStyle,
        c_left: c.borderLeftStyle,
      }
    })
    // Before the toggle: the plain button drops its trailing edge, the toggle's leading edge shows.
    expect(r.a_right).toBe("none")
    expect(r.b_left).toBe("solid")
    // After it: the toggle's trailing edge shows, the plain button's leading edge goes.
    expect(r.b_right).toBe("solid")
    expect(r.c_left).toBe("none")
  })

  test("row: two meaningful children side by side share one line, the first one's", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-row id="r" packed><button aria-pressed="true">a</button><button e-variant="tint">b</button></e-row>`,
      )
      const [a, b] = [...document.getElementById("r")!.children].map((e) => getComputedStyle(e))
      return { a_right: a.borderRightStyle, b_left: b.borderLeftStyle }
    })
    expect(r.a_right).toBe("solid")
    expect(r.b_left).toBe("none")
  })

  test("column: a selected item keeps its bottom edge; the next one drops its top edge", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-column id="c" packed><button aria-selected="true">a</button><button>b</button></e-column>`,
      )
      const [a, b] = [...document.getElementById("c")!.children].map((e) => getComputedStyle(e))
      return { a_bottom: a.borderBottomStyle, b_top: b.borderTopStyle }
    })
    expect(r.a_bottom).toBe("solid")
    expect(r.b_top).toBe("none")
  })

  test("row: a disabled tint button is furniture: it gives up its trailing edge like a plain one", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-row id="r" packed><button e-variant="tint" disabled>a</button><button>b</button></e-row>`,
      )
      const [a, b] = [...document.getElementById("r")!.children].map((e) => getComputedStyle(e))
      return { a_right: a.borderRightStyle, b_left: b.borderLeftStyle }
    })
    expect(r.a_right).toBe("none")
    expect(r.b_left).toBe("solid")
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
        // The checked fill is tint + 3 relative to where the toggle sits (the group's level here).
        on_ref: (() => {
          const ref = document.createElement("div")
          ref.style.backgroundColor = window.__ELT__.UI.theme.colors.tint.surface("n+3")
          document.querySelector("#packed")!.appendChild(ref)
          const bg = getComputedStyle(ref).backgroundColor
          ref.remove()
          return bg
        })(),
      }
    })
    // Packed: no border of their own; unchecked on the group's surface, like the button; checked
    // keeps its fill (tint + 3 from the group's level, docs/md/ui-theme.md, Emphasis).
    expect(result.off.border).toBe("none")
    expect(result.on.border).toBe("none")
    expect(result.off.bg).toBe(result.button.bg)
    expect(result.on.bg).not.toBe(result.button.bg)
    expect(result.on.bg).toBe(result.on_ref)
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

test.describe("packed border seamless (docs/md/ui-layout.md#packed)", () => {
  test("keeps the frame, drops the gap, seam color and gap rules", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.innerHTML = `
        <e-column id="plain" packed border><button>a</button><button>b</button></e-column>
        <e-column id="seamless" packed border seamless><button>a</button><button>b</button></e-column>`
      const plain = document.getElementById("plain")!
      const seamless = document.getElementById("seamless")!
      const cs = getComputedStyle(seamless)
      const [a, b] = seamless.querySelectorAll("button")
      return {
        plain_gap: getComputedStyle(plain).rowGap,
        gap: cs.rowGap,
        border: cs.borderTopStyle,
        radius: cs.borderTopLeftRadius,
        // the buttons touch: no seam between them
        touching: Math.abs(a.getBoundingClientRect().bottom - b.getBoundingClientRect().top) < 0.01,
        child_border: getComputedStyle(a).borderBottomStyle,
        rule: (cs as unknown as { rowRuleStyle?: string }).rowRuleStyle ?? "none",
      }
    })
    expect(r.plain_gap).toBe("1px")
    expect(r.gap).toBe("0px")
    expect(r.border).toBe("solid")
    expect(r.radius).not.toBe("0px")
    expect(r.touching).toBe(true)
    expect(r.child_border).toBe("none")
    expect(r.rule).toBe("none")
  })

  test("its background is the surface, not the seam color, even nested in a packed bordered parent", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      document.body.innerHTML = `
        <e-column packed border>
          <e-column id="inner" packed border seamless><button>a</button><button>b</button></e-column>
        </e-column>
        <e-column id="top" packed border seamless><button>a</button></e-column>`
      const inner = getComputedStyle(document.getElementById("inner")!)
      const top = getComputedStyle(document.getElementById("top")!)
      return {
        inner_bg: inner.backgroundColor,
        inner_gap: inner.rowGap,
        top_bg: top.backgroundColor,
        top_border: top.borderTopColor,
      }
    })
    expect(r.inner_gap).toBe("0px")
    expect(r.top_bg).not.toBe(r.top_border)
    expect(r.inner_bg).not.toBe(r.top_border)
  })

  test("<hr> in a packed column is an unpadded 1px divider across it", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.innerHTML = `
        <e-column id="col" packed="widget" border seamless align="stretch" style="width: 200px">
          <button>a</button><hr /><button>b</button>
        </e-column>`
      const col = document.getElementById("col")!
      const hr = col.querySelector("hr")!
      const box = hr.getBoundingClientRect()
      const cs = getComputedStyle(hr)
      return {
        height: box.height,
        width: box.width,
        col_inner: col.clientWidth,
        pad: cs.paddingTop,
        margin: cs.marginTop,
      }
    })
    expect(r.height).toBe(1)
    expect(r.width).toBe(r.col_inner)
    expect(r.pad).toBe("0px")
    expect(r.margin).toBe("0px")
  })

  test("<hr> in a packed row is a 1px divider down it", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.innerHTML = `<e-row id="row" packed border seamless><button>a</button><hr /><button>b</button></e-row>`
      const row = document.getElementById("row")!
      const hr = row.querySelector("hr")!.getBoundingClientRect()
      return { width: hr.width, height: hr.height, row_inner: row.clientHeight }
    })
    expect(r.width).toBe(1)
    expect(r.height).toBeCloseTo(r.row_inner, 0)
  })
})

// A packed container's step is the step of what it packs: packed="X" sets the container's own step to
// X, so a bare border's radius matches its children's padding instead of the inherited step.
test.describe('packed="X" is the container\'s own step (docs/md/ui-layout.md#packed)', () => {
  const run = (page: Page, attrs: Record<string, string>) =>
    page.evaluate((attrs) => {
      const outer = document.createElement("e-column")
      outer.setAttribute("spacing", "section")
      const col = document.createElement("e-column")
      for (const [k, v] of Object.entries(attrs)) col.setAttribute(k, v)
      // A grandchild: a packed[border] child's outer corners take the container's radius on purpose,
      // so the inherited step is read one level down.
      const child = document.createElement("e-row")
      const inner = document.createElement("e-row")
      inner.setAttribute("radius", "")
      child.append(inner)
      col.append(child, document.createElement("button"))
      outer.append(col)
      document.body.appendChild(outer)
      const probe = (step: string) => {
        const d = document.createElement("div")
        d.style.width = `var(--e-spacing-${step})`
        document.body.appendChild(d)
        return `${d.getBoundingClientRect().width}px`
      }
      return {
        radius: getComputedStyle(col).borderTopLeftRadius,
        gap: getComputedStyle(col).rowGap,
        inherited: getComputedStyle(inner).borderTopLeftRadius,
        widget: probe("widget"),
        component: probe("component"),
      }
    }, attrs)

  test("its border radius and the step its descendants inherit are X, not the inherited step; still no gap", async ({
    page,
  }) => {
    const r = await run(page, { packed: "widget", border: "" })
    expect(r.radius).toBe(r.widget)
    expect(r.inherited).toBe(r.widget)
    expect(r.gap).toBe("1px") // the seam drawn by border, not the widget step
  })

  test("an explicit spacing wins over it", async ({ page }) => {
    const r = await run(page, { packed: "widget", border: "", spacing: "component" })
    expect(r.radius).toBe(r.component)
  })

  test("an own pad still sets the radius", async ({ page }) => {
    const r = await run(page, { packed: "widget", border: "", pad: "component" })
    expect(r.radius).toBe(r.component)
    expect(r.inherited).toBe(r.widget)
  })
})

// A `hidden` child is not displayed (the reset's `display: none`), so packed skips it when it picks
// the first, last and interior children: the visible outer children get the outer corners and
// borders, the seams stay single (docs/md/ui-layout.md#packed).
test.describe("packed and hidden children (docs/md/ui-layout.md#packed)", () => {
  /** The edges and corners of each visible child of a packed `tag` holding four buttons, one hidden. */
  const run = (page: Page, tag: string, hide: number, border: boolean) =>
    page.evaluate(
      ({ tag, hide, border }) => {
        const c = document.createElement(tag)
        c.setAttribute("packed", "")
        if (border) c.setAttribute("border", "")
        c.setAttribute("radius", "section")
        c.id = "hc"
        for (let i = 0; i < 4; i++) {
          const b = document.createElement("button")
          b.textContent = `b${i}`
          if (i === hide) b.hidden = true
          c.append(b)
        }
        document.body.appendChild(c)
        const row = tag === "e-row"
        const visible = [...c.children].filter((e) => !(e as HTMLElement).hidden)
        return {
          radius: getComputedStyle(c).borderTopLeftRadius,
          // In flow order: leading edge, trailing edge, the two leading corners, the two trailing corners.
          kids: visible.map((e) => {
            const s = getComputedStyle(e)
            return row
              ? {
                  lead: s.borderLeftStyle,
                  trail: s.borderRightStyle,
                  lead_r: [s.borderTopLeftRadius, s.borderBottomLeftRadius],
                  trail_r: [s.borderTopRightRadius, s.borderBottomRightRadius],
                }
              : {
                  lead: s.borderTopStyle,
                  trail: s.borderBottomStyle,
                  lead_r: [s.borderTopLeftRadius, s.borderTopRightRadius],
                  trail_r: [s.borderBottomLeftRadius, s.borderBottomRightRadius],
                }
          }),
        }
      },
      { tag, hide, border },
    )

  for (const tag of ["e-row", "e-column"]) {
    // A hidden first or last child of a packed row or column still counts as first / last (skipping it
    // would cost a restyle of every earlier sibling on each insertion at the end): only the middle
    // case is checked here (docs/md/ui-layout.md#packed).
    for (const [name, hide] of [["middle", 1]] as const) {
      test(`${tag} without border, hidden ${name} child: the visible ones share single lines, outer corners kept`, async ({
        page,
      }) => {
        const r = await run(page, tag, hide, false)
        const [a, b, c] = r.kids
        // Every visible child but the last drops its trailing edge; the last keeps it.
        expect([a.trail, b.trail, c.trail]).toEqual(["none", "none", "solid"])
        expect([a.lead, b.lead, c.lead]).toEqual(["solid", "solid", "solid"])
        // Interior corners square, outer corners take the container's radius.
        expect(a.lead_r).toEqual([r.radius, r.radius])
        expect(c.trail_r).toEqual([r.radius, r.radius])
        expect([...a.trail_r, ...b.lead_r, ...b.trail_r, ...c.lead_r]).toEqual(Array(8).fill("0px"))
      })

      test(`${tag} with border, hidden ${name} child: outer corners on the visible outer children, seams drawn`, async ({
        page,
      }) => {
        const r = await run(page, tag, hide, true)
        const [a, b, c] = r.kids
        expect(r.radius).not.toBe("0px")
        expect(a.lead_r).toEqual([r.radius, r.radius])
        expect(c.trail_r).toEqual([r.radius, r.radius])
        expect([...a.trail_r, ...b.lead_r, ...b.trail_r, ...c.lead_r]).toEqual(Array(8).fill("0px"))
        expect([a.lead, a.trail, b.lead, b.trail, c.lead, c.trail]).toEqual(Array(6).fill("none"))
        await expect_seams(page, "#hc")
      })
    }
  }

  // The shared-line rules look at the previous sibling: it must be the previous *visible* one.
  const edges = (page: Page, html: string) =>
    page.evaluate((html) => {
      document.body.insertAdjacentHTML("beforeend", `<e-row id="m" packed>${html}</e-row>`)
      return [...document.getElementById("m")!.children]
        .filter((e) => !(e as HTMLElement).hidden)
        .map((e) => [getComputedStyle(e).borderLeftStyle, getComputedStyle(e).borderRightStyle])
    }, html)

  test("a hidden meaningful child does not take the next child's leading edge", async ({ page }) => {
    // Before the fix, the hidden tint button made `c` drop its leading edge while `a` dropped its
    // trailing one: no line at all between the two visible buttons.
    const [a, c] = await edges(page, `<button>a</button><button e-variant="tint" hidden>b</button><button>c</button>`)
    expect(a[1]).toBe("none")
    expect(c[0]).toBe("solid")
  })

  for (const n of [1, 2]) {
    test(`a meaningful child followed by ${n} hidden one(s) still owns the line it shares with the next visible child`, async ({
      page,
    }) => {
      const hidden = "<button hidden>h</button>".repeat(n)
      const [m, c] = await edges(page, `<button aria-pressed="true">m</button>${hidden}<button>c</button>`)
      expect(m[1]).toBe("solid")
      expect(c[0]).toBe("none")
    })
  }

  test("packed bordered grid: hidden first and last rows and a hidden last cell are skipped for the outer corners", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-grid id="g" columns="2" packed border radius="section">
          <e-grid-row hidden><span>h</span><span>h</span></e-grid-row>
          <e-grid-row><span>a</span><span>b</span><span hidden>h</span></e-grid-row>
          <e-grid-row><span>c</span><span>d</span></e-grid-row>
          <e-grid-row hidden><span>h</span><span>h</span></e-grid-row>
        </e-grid>`,
      )
      const g = document.getElementById("g")!
      const cell = (row: number, col: number) => getComputedStyle(g.children[row].children[col])
      return {
        radius: getComputedStyle(g).borderTopLeftRadius,
        a: cell(1, 0).borderTopLeftRadius,
        b: cell(1, 1).borderTopRightRadius,
        c: cell(2, 0).borderBottomLeftRadius,
        d: cell(2, 1).borderBottomRightRadius,
      }
    })
    expect(r.radius).not.toBe("0px")
    expect([r.a, r.b, r.c, r.d]).toEqual(Array(4).fill(r.radius))
  })

  // hidden="until-found" is left to the browser (content-visibility: hidden): the element keeps its
  // box, padding included, so packed still counts it.
  test('a hidden="until-found" child still counts: it keeps a box and the outer corners', async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-row id="u" packed border radius="section"><button>a</button><button>b</button><e-row hidden="until-found">c</e-row></e-row>`,
      )
      const row = document.getElementById("u")!
      const [, b, c] = [...row.children].map((e) => getComputedStyle(e))
      return {
        radius: getComputedStyle(row).borderTopRightRadius,
        width: row.children[2].getBoundingClientRect().width,
        b_trail: b.borderTopRightRadius,
        c_trail: c.borderTopRightRadius,
      }
    })
    expect(r.width).toBeGreaterThan(0)
    expect(r.b_trail).toBe("0px")
    expect(r.c_trail).toBe(r.radius)
  })
})
