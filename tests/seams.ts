import { expect, type Page } from "@playwright/test"

// How a `packed border` container (or a row of a packed bordered grid) paints its seams
// (ui/layout.css.tsx, docs/md/ui-layout.md "packed"): with gap decorations, 1px rules in the
// border color over a surface background; without them, a background in the border color
// showing through the 1px gaps.

/** True when the browser supports gap decorations (`row-rule`/`column-rule` on grid and flex). */
export function gap_rules_supported(page: Page) {
  return page.evaluate(() => CSS.supports("row-rule", "1px solid"))
}

/** Asserts that the element matching `sel` paints its seams the way this browser should. */
export async function expect_seams(page: Page, sel: string) {
  const res = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement
    // Resolves a color expression in `el`'s context, through a probe child (its inline background
    // out-ranks any packed cell rule).
    const resolve = (expr: string) => {
      const probe = document.createElement("div")
      probe.style.backgroundColor = expr
      el.appendChild(probe)
      const c = getComputedStyle(probe).backgroundColor
      probe.remove()
      return c
    }
    const st = getComputedStyle(el)
    return {
      rules: CSS.supports("row-rule", "1px solid"),
      background: st.backgroundColor,
      row_rule: st.getPropertyValue("row-rule-style") + " " + st.getPropertyValue("row-rule-width"),
      column_rule: st.getPropertyValue("column-rule-style") + " " + st.getPropertyValue("column-rule-width"),
      row_rule_color: st.getPropertyValue("row-rule-color"),
      column_rule_color: st.getPropertyValue("column-rule-color"),
      surface: resolve("var(--e-current-surface)"),
      seam: resolve("var(--e-current-border-color)"),
    }
  }, sel)
  if (res.rules) {
    expect(res.background).toBe(res.surface)
    expect(res.row_rule).toBe("solid 1px")
    expect(res.column_rule).toBe("solid 1px")
    expect(res.row_rule_color).toBe(res.seam)
    expect(res.column_rule_color).toBe(res.seam)
  } else {
    expect(res.background).toBe(res.seam)
  }
}
