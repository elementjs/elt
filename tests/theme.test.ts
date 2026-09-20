///<reference types="bun">
import "./setup.ts"

import { describe, expect, test } from "bun:test"

import { Mix, theme } from "../ui/theme"

/** Finds the generated stylesheet rule for a class name emitted by `css` (src/css.ts). */
function find_rule_text(class_name: string): string {
  for (const sheet of document.adoptedStyleSheets) {
    for (const rule of Array.from(sheet.cssRules)) {
      if ((rule as CSSStyleRule).selectorText === `.${class_name}`) {
        return (rule as CSSStyleRule).cssText
      }
    }
  }
  throw new Error(`No rule found for .${class_name}`)
}

describe("Color.hover / Color.separator", () => {
  test("hover mixes at level n+1", () => {
    const expr = theme.colors.tint.hover.toString()
    expect(expr).toContain("var(--e-surface-level, 0) + 1")
    expect(expr).toContain("var(--e-surface-step, 10%)")
  })

  test("separator mixes at level n+2, one step past hover", () => {
    const expr = theme.colors.tint.separator.toString()
    expect(expr).toContain("var(--e-surface-level, 0) + 2")
    expect(expr).toContain("var(--e-surface-step, 10%)")
  })

  test("hover and separator resolve against bg, like the other intensity helpers", () => {
    expect(theme.colors.tint.hover.toString()).toContain("var(--e-color-bg)")
    expect(theme.colors.tint.separator.toString()).toContain("var(--e-color-bg)")
  })

  test("works on any named color, not just tint", () => {
    expect(() => theme.colors.red.hover.toString()).not.toThrow()
    expect(() => theme.colors.red.separator.toString()).not.toThrow()
  })
})

describe("Color/Mix merge", () => {
  test("a named palette entry is a Mix instance", () => {
    expect(theme.colors.tint).toBeInstanceOf(Mix)
    expect(theme.colors.tint.toString()).toBe("var(--e-color-tint)")
  })

  test("distinct anonymous mixes get distinct as_inverted class names (regression: they used to collide on .e-mix-inverted)", () => {
    const class_a = theme.colors.tint.faded.as_inverted.toString()
    const class_b = theme.colors.red.mid.as_inverted.toString()
    expect(class_a).not.toBe("")
    expect(class_a).not.toBe(class_b)
  })

  test("named colors keep readable, stable as_inverted/as_tint class names", () => {
    expect(theme.colors.tint.as_inverted.toString()).toContain("e-color-tint-inverted")
    expect(theme.colors.tint.as_tint.toString()).toContain("e-color-tint-tint")
  })

  test("as_inverted freezes bg to the light theme's colors, not the live (possibly dark) ones — fixes a dark-mode contrast bug in the soft-inverted chrome case (ui/layout.css.tsx text.faded.css_as_inverted)", () => {
    const css = theme.colors.text.faded.css_as_inverted
    // bg is the light-frozen version of the mix (both operands rewritten to --e-light-color-*)
    expect(css).toContain("var(--e-light-color-bg)")
    expect(css).toContain("var(--e-light-color-text)")
    // no live, theme-dependent --e-color-* reference should remain in the bg declaration
    const bg_line = css.split("\n").find((l) => l.includes("--e-color-bg:"))!
    expect(bg_line).not.toContain("--e-color-bg)")
    expect(bg_line).not.toContain("--e-color-text)")
  })

  test("as_tint sets matching light/dark tokens via substitution, same as a hand-written named Color used to", () => {
    const cls = theme.colors.red.as_tint.toString()
    const rule = find_rule_text(cls)
    expect(rule).toContain("--e-color-tint: var(--e-color-red)")
    expect(rule).toContain("--e-light-color-tint: var(--e-light-color-red)")
    expect(rule).toContain("--e-dark-color-tint: var(--e-dark-color-red)")
  })

  test("light_frozen_expr replaces every live color var with its light-theme counterpart", () => {
    expect(theme.colors.tint.light_frozen_expr).toBe("var(--e-light-color-tint)")
  })
})

describe("Mix.surface / [surface] parity", () => {
  test("an absolute level ignores ambient nesting", () => {
    const css = theme.colors.tint.css_as_surface(2)
    expect(css).toContain("--e-current-surface-level: 2;")
    // never reads the ambient level (with its ", 0" fallback) to compute its own — only "increment" does
    expect(css).not.toContain("var(--e-surface-level,")
  })

  test("increment raises one level relative to whatever's ambient", () => {
    const css = theme.colors.tint.css_as_surface("increment")
    expect(css).toContain("calc(1 + var(--e-surface-level, 0))")
  })

  test("background is absolute level 0 — a real, visible boundary against any nonzero ambient level, not a repaint of whatever's already ambient", () => {
    const css = theme.colors.tint.css_as_surface("background")
    expect(css).toContain("--e-current-surface-level: 0;")
    expect(css).toContain("background-color:")
    // must not read the ambient level to decide its own color — that would just repaint the
    // parent's own color and defeat rule 1 (padding requires a *visible* boundary)
    expect(css).not.toContain("var(--e-surface-level,")
    expect(css).toContain("& > * { --e-surface-level: var(--e-surface-level-swap); }")
  })

  test("none is a true no-op — no paint, no level change, same as [surface] being absent", () => {
    expect(theme.colors.tint.css_as_surface("none")).toBe("")
  })

  test("children are handed the new level via the same swap variable used to paint it", () => {
    const css = theme.colors.tint.css_as_surface(3)
    expect(css).toContain("--e-surface-level-swap: var(--e-current-surface-level);")
    expect(css).toContain("& > * { --e-surface-level: var(--e-surface-level-swap); }")
  })

  test(".surface() returns a stable, cached class name per level — usable on any element, not just e-flex/e-grid/e-block", () => {
    // Content correctness (the CSS text) is covered by the css_as_surface tests above — happy-dom's
    // CSSStyleSheet parser drops rules containing nested `&` selectors entirely (verified: a
    // minimal `.foo { color: red; & > * { color: blue } }` round-trips as `.foo {  }`), so reading
    // this rule back via document.adoptedStyleSheets isn't reliable here even though it renders
    // correctly in a real browser (confirmed separately against Chromium).
    const a = theme.colors.tint.surface(2)
    const b = theme.colors.tint.surface(2)
    const c = theme.colors.tint.surface(3)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toContain("e-color-tint-surface-2")
    expect(c).toContain("e-color-tint-surface-3")
  })
})
