import { expect, test } from "./fixture"

// What each [surface] / [border] value resolves to (docs/md/ui-theme.md): a flat "widget" color, a level
// relative to the element's own or the ambient surface, or an absolute level. Each case is compared with a
// probe painted with the theme's expression for it.
test.describe("[border]/[surface] color-step value type (docs/md/ui-theme.md)", () => {
  // [outer surface (an ancestor), the element's surface, the element's border, the expected color as
  // [family, member, argument?] of theme.colors, why]
  const CASES: [string | null, string | null, string | null, [string, string, (string | number)?], string][] = [
    [null, null, "", ["neutral", "faded"], "bare border: the flat widget neutral"],
    [null, null, "neutral", ["neutral", "faded"], "neutral: the same as bare"],
    [null, null, "tint", ["tint", "mid"], "tint: the flat widget tint"],
    [null, null, "tint-surface", ["tint", "surface", "n+1"], "one level up from ambient"],
    [null, null, "neutral-separator", ["neutral", "surface", "n+2"], "two levels up from ambient"],
    [null, null, "tint-4", ["tint", "surface", 4], "absolute level"],
    [null, "neutral-2", "neutral-surface", ["neutral", "surface", 3], "one above the element's own surface"],
    [
      null,
      "neutral-2",
      "tint-surface",
      ["tint", "surface", 3],
      "the level tracks the own surface, the family is explicit",
    ],
    [null, "neutral-2", "", ["neutral", "faded"], "bare border ignores the own surface"],
    [null, "tint-1", "neutral-4", ["neutral", "surface", 4], "an absolute level ignores the own surface"],
    ["tint-2", null, "tint-surface", ["tint", "surface", 3], "no own surface: one above the ambient one"],
    [null, "tint-3", null, ["tint", "surface", 3], "absolute surface level"],
    [null, "neutral-3", null, ["neutral", "surface", 3], "absolute surface level"],
    [null, "background", null, ["neutral", "surface", "background"], "background is absolute level 0"],
    [null, "", null, ["neutral", "surface", "n+1"], "bare surface: neutral, one level up from ambient"],
  ]
  for (const [outer, surface, border, expected, why] of CASES) {
    const name = [
      outer != null && `inside surface="${outer}"`,
      surface != null && `surface="${surface}"`,
      border != null && `border="${border}"`,
    ]
      .filter(Boolean)
      .join(" ")
    test(`${name} resolves to ${expected.join(".")}: ${why}`, async ({ page }) => {
      const r = await page.evaluate(
        ({ outer, surface, border, expected }) => {
          const { theme } = window.__ELT__.UI
          const el = document.createElement("e-prose")
          if (surface != null) el.setAttribute("surface", surface)
          if (border != null) el.setAttribute("border", border)
          let root: HTMLElement = el
          if (outer != null) {
            root = document.createElement("e-prose")
            root.setAttribute("surface", outer)
            root.append(el)
          }
          document.body.appendChild(root)
          const [family, member, arg] = expected
          const mix = (theme.colors as any)[family]
          const color = String(arg === undefined ? mix[member] : mix[member](arg))
          const prop = border != null ? "borderTopColor" : "backgroundColor"
          const ref = document.createElement("div")
          ref.style.border = "1px solid"
          ref.style[prop] = color
          document.body.appendChild(ref)
          return { got: (getComputedStyle(el) as any)[prop], ref: (getComputedStyle(ref) as any)[prop] }
        },
        { outer, surface, border, expected },
      )
      expect(r.got).toBe(r.ref)
    })
  }
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

  test('radius="section" is a fixed override, usable even without a border, for an element that does not pad itself', async ({
    page,
  }) => {
    // "section" deliberately differs from the derived fallback an unpadded element would
    // otherwise get (--e-spacing-widget) — a step that happened to collide with the
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
      const fallback = document.createElement("div")
      fallback.style.borderRadius = theme.settings.spacingWidget
      document.body.appendChild(fallback)
      return {
        radius: getComputedStyle(el).borderTopLeftRadius,
        ref: getComputedStyle(ref).borderTopLeftRadius,
        fallback: getComputedStyle(fallback).borderTopLeftRadius,
      }
    })
    expect(result.radius).toBe(result.ref)
    expect(result.radius).not.toBe(result.fallback)
  })
})

test.describe("<pre> radius and overflow (docs/md/ui-layout.md)", () => {
  for (const rounded of [true, false]) {
    test(`<pre> ${rounded ? "inherits its immediate parent's border-radius, matching a rounded wrapper's corners" : "with no rounded wrapper stays at 0 radius"}`, async ({
      page,
    }) => {
      const result = await page.evaluate((rounded) => {
        const wrapper = document.createElement("e-prose")
        if (rounded) {
          wrapper.setAttribute("border", "")
          wrapper.setAttribute("pad", "none")
        }
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
      }, rounded)
      if (rounded) {
        expect(result.preRadius).toBe(result.wrapperRadius)
        expect(result.preRadius).not.toBe("0px")
      } else expect(result.preRadius).toBe("0px")
    })
  }
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
