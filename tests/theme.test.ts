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
    const class_a = theme.colors.tint.faded.classes.as_inverted.toString()
    const class_b = theme.colors.red.mid.classes.as_inverted.toString()
    expect(class_a).not.toBe("")
    expect(class_a).not.toBe(class_b)
  })

  test("named colors keep readable, stable as_inverted/as_tint class names", () => {
    expect(theme.colors.tint.classes.as_inverted.toString()).toContain("e-color-tint-inverted")
    expect(theme.colors.tint.classes.as_tint.toString()).toContain("e-color-tint-tint")
  })

  test("as_inverted freezes bg to the light theme's colors, not the live (possibly dark) ones — fixes a dark-mode contrast bug in the soft-inverted chrome case (ui/layout.css.tsx text.faded.css.as_inverted)", () => {
    const css = theme.colors.text.faded.css.as_inverted
    // bg is the light-frozen version of the mix (both operands rewritten to --e-light-color-*)
    expect(css).toContain("var(--e-light-color-bg)")
    expect(css).toContain("var(--e-light-color-text)")
    // no live, theme-dependent --e-color-* reference should remain in the bg declaration
    const bg_line = css.split("\n").find((l) => l.includes("--e-color-bg:"))!
    expect(bg_line).not.toContain("--e-color-bg)")
    expect(bg_line).not.toContain("--e-color-text)")
  })

  test("as_tint sets matching light/dark tokens via substitution, same as a hand-written named Color used to", () => {
    const cls = theme.colors.red.classes.as_tint.toString()
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
    const css = theme.colors.tint.css.as_surface(2)
    expect(css).toContain("--e-current-surface-level: 2;")
    // never reads the ambient level (with its ", 0" fallback) to compute its own — only "increment" does
    expect(css).not.toContain("var(--e-surface-level,")
  })

  test("increment raises one level relative to whatever's ambient", () => {
    const css = theme.colors.tint.css.as_surface("increment")
    expect(css).toContain("calc(1 + var(--e-surface-level, 0))")
  })

  test("background is absolute level 0 — a real, visible boundary against any nonzero ambient level, not a repaint of whatever's already ambient", () => {
    const css = theme.colors.tint.css.as_surface("background")
    expect(css).toContain("--e-current-surface-level: 0;")
    expect(css).toContain("background-color:")
    // must not read the ambient level to decide its own color — that would just repaint the
    // parent's own color and defeat rule 1 (padding requires a *visible* boundary)
    expect(css).not.toContain("var(--e-surface-level,")
    expect(css).toContain("& > * { --e-surface-level: var(--e-surface-level-swap); }")
  })

  test("none is a true no-op — no paint, no level change, same as [surface] being absent", () => {
    expect(theme.colors.tint.css.as_surface("none")).toBe("")
  })

  test("children are handed the new level via the same swap variable used to paint it", () => {
    const css = theme.colors.tint.css.as_surface(3)
    expect(css).toContain("--e-surface-level-swap: var(--e-current-surface-level);")
    expect(css).toContain("& > * { --e-surface-level: var(--e-surface-level-swap); }")
  })

  test(".classes.as_surface() returns a stable, cached class name per level — usable on any element, not just e-flex/e-grid/e-block", () => {
    // Content correctness (the CSS text) is covered by the .css.as_surface tests above — happy-dom's
    // CSSStyleSheet parser drops rules containing nested `&` selectors entirely (verified: a
    // minimal `.foo { color: red; & > * { color: blue } }` round-trips as `.foo {  }`), so reading
    // this rule back via document.adoptedStyleSheets isn't reliable here even though it renders
    // correctly in a real browser (confirmed separately against Chromium).
    const a = theme.colors.tint.classes.as_surface(2)
    const b = theme.colors.tint.classes.as_surface(2)
    const c = theme.colors.tint.classes.as_surface(3)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toContain("e-color-tint-surface-2")
    expect(c).toContain("e-color-tint-surface-3")
  })

  test("surface() returns a bare color value, not a class or a ruleset", () => {
    const value = theme.colors.tint.surface(2)
    // a color-mix()/oklch expression, usable directly in a declaration like `border-top: 1px solid ${...}`
    expect(value).not.toContain("{")
    expect(value).not.toContain("e-color-tint-surface")
    expect(value).toContain("color-mix")
  })

  test("surface(N) computes N * the surface step, same formula .css.as_surface uses via its custom-property indirection", () => {
    expect(theme.colors.tint.surface(2)).toContain("calc(2 * var(--e-surface-step, 10%))")
  })

  test("surface('background') is absolute level 0", () => {
    expect(theme.colors.tint.surface("background")).toContain("calc(0 * var(--e-surface-step, 10%))")
  })

  test("surface('increment') reads the ambient level, same as .css.as_surface('increment')", () => {
    const value = theme.colors.tint.surface("increment")
    expect(value).toContain("calc((1 + var(--e-surface-level, 0)) * var(--e-surface-step, 10%))")
  })
})

describe("Spacing scale (regression: vertical is half of horizontal, no text-box-trim dependency)", () => {
  test("a named step has independent vertical/horizontal values, vertical = half horizontal", () => {
    // Tuned optical compensation for uncompensated line-height half-leading — works uniformly across
    // block, flex, grid and table-cell layout. text-box-trim was tried and dropped: it's a silent
    // no-op on flex/grid containers, so it can't be the sole mechanism (specs/elt-ui-guidelines.md).
    expect(theme.css_settings).toContain("--e-spacing-widget-vertical: 4px;")
    expect(theme.css_settings).toContain("--e-spacing-widget-horizontal: 8px;")
    expect(theme.css_settings).toContain("--e-spacing-component-vertical: 8px;")
    expect(theme.css_settings).toContain("--e-spacing-component-horizontal: 16px;")
    expect(theme.settings.spacingWidget).toBe("var(--e-spacing-widget-vertical, 4px) var(--e-spacing-widget-horizontal, 8px)")
  })
})

describe("Theme.css.pad / Theme.css.spacing", () => {
  test("pad(step) sets --e-pad-vertical/-horizontal from the named step's paired spacing variables", () => {
    expect(theme.css.pad("widget")).toBe(
      "--e-pad-vertical: var(--e-spacing-widget-vertical); --e-pad-horizontal: var(--e-spacing-widget-horizontal);",
    )
  })

  test("spacing(step) sets --e-spacing-vertical/-horizontal from the named step's paired spacing variables", () => {
    expect(theme.css.spacing("section")).toBe(
      "--e-spacing-vertical: var(--e-spacing-section-vertical); --e-spacing-horizontal: var(--e-spacing-section-horizontal);",
    )
  })

  test("the three raw px nudges have no pair — both axes read the same symmetric variable", () => {
    expect(theme.css.pad("4")).toBe("--e-pad-vertical: var(--e-spacing-4); --e-pad-horizontal: var(--e-spacing-4);")
  })
})

describe("Theme.classes (regression: moved off Theme's top-level class_light/class_dark/class_dynamic)", () => {
  test("light_scheme/dark_scheme/dynamic_scheme are memoized and produce the expected class names", () => {
    expect(theme.classes.light_scheme).toBe(theme.classes.light_scheme)
    expect(theme.classes.light_scheme.toString()).toContain("e-light-theme")
    expect(theme.classes.dark_scheme.toString()).toContain("e-dark-theme")
    expect(theme.classes.dynamic_scheme.toString()).toContain("e-dynamic-theme")
  })

  test("toString() still drives the dynamic scheme", () => {
    expect(theme.toString()).toBe(theme.classes.dynamic_scheme.toString())
  })

  test("pad(step)/spacing(step) return a stable, cached class name per step, mirroring theme.css.pad/spacing", () => {
    const a = theme.classes.pad("component")
    const b = theme.classes.pad("component")
    const c = theme.classes.pad("section")
    expect(a).toBe(b)
    expect(a).not.toBe(c)

    const rule = find_rule_text(a)
    expect(rule).toContain(theme.css.pad("component"))
    expect(rule).toContain("padding: var(--e-pad-vertical) var(--e-pad-horizontal)")
  })

  test("spacing(step) applies the gap property from the same --e-spacing-vertical/-horizontal custom properties [pad]/[spacing] attribute rules use", () => {
    const cls = theme.classes.spacing("widget")
    const rule = find_rule_text(cls)
    expect(rule).toContain(theme.css.spacing("widget"))
    expect(rule).toContain("gap: var(--e-spacing-vertical) var(--e-spacing-horizontal)")
  })
})
