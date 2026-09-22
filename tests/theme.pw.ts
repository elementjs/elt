import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("Color.hover / Color.separator", () => {
  test("hover mixes at level n+1", async ({ page }) => {
    const expr = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.hover.toString()
    })
    expect(expr).toContain("1 + var(--e-current-surface-level, var(--e-surface-level, 0))")
    expect(expr).toContain("var(--e-surface-step, 10%)")
  })

  test("separator mixes at level n+2, one step past hover", async ({ page }) => {
    const expr = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.separator.toString()
    })
    expect(expr).toContain("2 + var(--e-current-surface-level, var(--e-surface-level, 0))")
    expect(expr).toContain("var(--e-surface-step, 10%)")
  })

  test("hover and separator resolve against bg, like the other intensity helpers", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return {
        hover: theme.colors.tint.hover.toString(),
        separator: theme.colors.tint.separator.toString(),
      }
    })
    expect(result.hover).toContain("var(--e-color-bg)")
    expect(result.separator).toContain("var(--e-color-bg)")
  })

  test("works on any named color, not just tint", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      let hover_threw = false
      let separator_threw = false
      try {
        theme.colors.red.hover.toString()
      } catch {
        hover_threw = true
      }
      try {
        theme.colors.red.separator.toString()
      } catch {
        separator_threw = true
      }
      return { hover_threw, separator_threw }
    })
    expect(result.hover_threw).toBe(false)
    expect(result.separator_threw).toBe(false)
  })
})

test.describe("Color/Mix merge", () => {
  test("a named palette entry is a Mix instance", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme, Mix } = window.__ELT__.UI
      return {
        is_mix: theme.colors.tint instanceof Mix,
        as_string: theme.colors.tint.toString(),
      }
    })
    expect(result.is_mix).toBe(true)
    expect(result.as_string).toBe("var(--e-color-tint)")
  })

  test("distinct anonymous mixes get distinct as_inverted class names (regression: they used to collide on .e-mix-inverted)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const class_a = theme.colors.tint.faded.classes.as_inverted.toString()
      const class_b = theme.colors.red.mid.classes.as_inverted.toString()
      return { class_a, class_b }
    })
    expect(result.class_a).not.toBe("")
    expect(result.class_a).not.toBe(result.class_b)
  })

  test("named colors keep readable, stable as_inverted/as_tint class names", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return {
        as_inverted: theme.colors.tint.classes.as_inverted.toString(),
        as_tint: theme.colors.tint.classes.as_tint.toString(),
      }
    })
    expect(result.as_inverted).toContain("e-color-tint-inverted")
    expect(result.as_tint).toContain("e-color-tint-tint")
  })

  test("as_inverted freezes bg to the light theme's colors, not the live (possibly dark) ones — fixes a dark-mode contrast bug in the soft-inverted chrome case (ui/layout.css.tsx text.faded.css.as_inverted)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const css = theme.colors.text.faded.css.as_inverted
      const bg_line = css.split("\n").find((l) => l.includes("--e-color-bg:"))!
      return { css, bg_line }
    })
    // bg is the light-frozen version of the mix (both operands rewritten to --e-light-color-*)
    expect(result.css).toContain("var(--e-light-color-bg)")
    expect(result.css).toContain("var(--e-light-color-text)")
    // no live, theme-dependent --e-color-* reference should remain in the bg declaration
    expect(result.bg_line).not.toContain("--e-color-bg)")
    expect(result.bg_line).not.toContain("--e-color-text)")
  })

  test("as_tint sets matching light/dark tokens via substitution, same as a hand-written named Color used to", async ({
    page,
  }) => {
    const rule = await page.evaluate(() => {
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
      const { theme } = window.__ELT__.UI
      const cls = theme.colors.red.classes.as_tint.toString()
      return find_rule_text(cls)
    })
    expect(rule).toContain("--e-color-tint: var(--e-color-red)")
    expect(rule).toContain("--e-light-color-tint: var(--e-light-color-red)")
    expect(rule).toContain("--e-dark-color-tint: var(--e-dark-color-red)")
  })

  test("light_frozen_expr replaces every live color var with its light-theme counterpart", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.light_frozen_expr
    })
    expect(result).toBe("var(--e-light-color-tint)")
  })
})

test.describe("Mix.surface / [surface] parity", () => {
  test("an absolute level ignores ambient nesting", async ({ page }) => {
    const css = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.css.as_surface(2)
    })
    expect(css).toContain("--e-current-surface-level: 2;")
    // never reads the ambient level (with its ", 0" fallback) to compute its own — only a relative n+K offset does
    expect(css).not.toContain("var(--e-surface-level,")
  })

  test("n+1 raises one level relative to whatever's ambient", async ({ page }) => {
    const css = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.css.as_surface("n+1")
    })
    expect(css).toContain("--e-current-surface-level: (1 + var(--e-surface-level, 0));")
  })

  test('n+2 raises two levels relative to whatever\'s ambient — the same offset [surface="n+2"]/.separator use', async ({
    page,
  }) => {
    const css = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.css.as_surface("n+2")
    })
    expect(css).toContain("--e-current-surface-level: (2 + var(--e-surface-level, 0));")
  })

  test("n+0 is a valid, well-defined relative offset (identity — same level as ambient)", async ({ page }) => {
    const css = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.css.as_surface("n+0")
    })
    expect(css).toContain("--e-current-surface-level: (0 + var(--e-surface-level, 0));")
  })

  test("a malformed relative offset throws instead of silently producing broken CSS", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const outcomes: boolean[] = []
      for (const fn of [
        () => theme.colors.tint.css.as_surface("n+1.5" as never),
        () => theme.colors.tint.css.as_surface("n+-1" as never),
        () => theme.colors.tint.surface("n+" as never),
      ]) {
        try {
          fn()
          outcomes.push(false)
        } catch {
          outcomes.push(true)
        }
      }
      return outcomes
    })
    expect(result).toEqual([true, true, true])
  })

  test("background is absolute level 0 — a real, visible boundary against any nonzero ambient level, not a repaint of whatever's already ambient", async ({
    page,
  }) => {
    const css = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.css.as_surface("background")
    })
    expect(css).toContain("--e-current-surface-level: 0;")
    expect(css).toContain("background-color:")
    // must not read the ambient level to decide its own color — that would just repaint the
    // parent's own color and defeat rule 1 (padding requires a *visible* boundary)
    expect(css).not.toContain("var(--e-surface-level,")
    expect(css).toContain("& > * { --e-surface-level: var(--e-surface-level-relay); }")
  })

  test("children are handed the new level via the same relay variable used to paint it", async ({ page }) => {
    const css = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.css.as_surface(3)
    })
    expect(css).toContain("--e-surface-level-relay: var(--e-current-surface-level);")
    expect(css).toContain("& > * { --e-surface-level: var(--e-surface-level-relay); }")
  })

  test(".classes.as_surface() returns a stable, cached class name per level — usable on any element, not just e-flex/e-grid/e-block", async ({
    page,
  }) => {
    // Content correctness (the CSS text) is covered by the .css.as_surface tests above. Reading the
    // generated rule back via document.adoptedStyleSheets for a class containing nested `&` selectors
    // is skipped here too (only the class-name identity/caching behavior is asserted), consistent with
    // the original happy-dom-era test which found nested-`&` rules unreliable to read back.
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const a = theme.colors.tint.classes.as_surface(2)
      const b = theme.colors.tint.classes.as_surface(2)
      const c = theme.colors.tint.classes.as_surface(3)
      return { a, b, c }
    })
    expect(result.a).toBe(result.b)
    expect(result.a).not.toBe(result.c)
    expect(result.a).toContain("e-color-tint-surface-2")
    expect(result.c).toContain("e-color-tint-surface-3")
  })

  test("surface() returns a bare color value, not a class or a ruleset", async ({ page }) => {
    const value = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.surface(2)
    })
    // a color-mix()/oklch expression, usable directly in a declaration like `border-top: 1px solid ${...}`
    expect(value).not.toContain("{")
    expect(value).not.toContain("e-color-tint-surface")
    expect(value).toContain("color-mix")
  })

  test("surface(N) computes N * the surface step, same formula .css.as_surface uses via its custom-property indirection", async ({
    page,
  }) => {
    const value = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.surface(2)
    })
    expect(value).toContain("calc(2 * var(--e-surface-step, 10%))")
  })

  test("surface('background') is absolute level 0", async ({ page }) => {
    const value = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.surface("background")
    })
    expect(value).toContain("calc(0 * var(--e-surface-step, 10%))")
  })

  test("surface('n+1') reads the ambient level, same offset as .css.as_surface('n+1')", async ({ page }) => {
    const value = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.surface("n+1")
    })
    expect(value).toContain("calc((1 + var(--e-current-surface-level, var(--e-surface-level, 0))) * var(--e-surface-step, 10%))")
  })

  test("surface('n+2') is available for arbitrary offsets, unlike the [surface] attribute which only precompiles n+1/n+2", async ({
    page,
  }) => {
    const value = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.surface("n+2")
    })
    expect(value).toContain("calc((2 + var(--e-current-surface-level, var(--e-surface-level, 0))) * var(--e-surface-step, 10%))")
  })

  test(".hover/.separator delegate to the same relative-offset expression as surface('n+1')/surface('n+2')", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return {
        hover: theme.colors.tint.hover.toString(),
        separator: theme.colors.tint.separator.toString(),
      }
    })
    expect(result.hover).toContain("(1 + var(--e-current-surface-level, var(--e-surface-level, 0))) * var(--e-surface-step, 10%)")
    expect(result.separator).toContain("(2 + var(--e-current-surface-level, var(--e-surface-level, 0))) * var(--e-surface-step, 10%)")
  })
})

test.describe("Spacing scale (regression: vertical is half of horizontal, no text-box-trim dependency)", () => {
  test("a named step has independent vertical/horizontal values, vertical = half horizontal", async ({ page }) => {
    // Tuned optical compensation for uncompensated line-height half-leading — works uniformly across
    // block, flex, grid and table-cell layout. text-box-trim was tried and dropped: it's a silent
    // no-op on flex/grid containers, so it can't be the sole mechanism (specs/elt-ui-guidelines.md).
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return {
        css_settings: theme.css_settings,
        spacing_widget: theme.settings.spacingWidget,
      }
    })
    expect(result.css_settings).toContain("--e-spacing-widget-vertical: 4px;")
    expect(result.css_settings).toContain("--e-spacing-widget-horizontal: 8px;")
    expect(result.css_settings).toContain("--e-spacing-component-vertical: 8px;")
    expect(result.css_settings).toContain("--e-spacing-component-horizontal: 16px;")
    expect(result.spacing_widget).toBe("var(--e-spacing-widget-vertical, 4px) var(--e-spacing-widget-horizontal, 8px)")
  })
})

test.describe("Theme.css.pad / Theme.css.spacing", () => {
  test("pad(step) sets --e-pad-vertical/-horizontal from the named step's paired spacing variables", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.css.pad("widget")
    })
    expect(result).toBe("--e-pad-vertical: var(--e-spacing-widget-vertical); --e-pad-horizontal: var(--e-spacing-widget-horizontal);")
  })

  test("spacing(step) sets --e-spacing-vertical/-horizontal from the named step's paired spacing variables", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.css.spacing("section")
    })
    expect(result).toBe(
      "--e-spacing-vertical: var(--e-spacing-section-vertical); --e-spacing-horizontal: var(--e-spacing-section-horizontal);",
    )
  })

  test("the three raw px nudges have no pair — both axes read the same symmetric variable", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.css.pad("4")
    })
    expect(result).toBe("--e-pad-vertical: var(--e-spacing-4); --e-pad-horizontal: var(--e-spacing-4);")
  })
})

test.describe("Theme.classes (regression: moved off Theme's top-level class_light/class_dark/class_dynamic)", () => {
  test("light_scheme/dark_scheme/dynamic_scheme are memoized and produce the expected class names", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return {
        memoized: theme.classes.light_scheme === theme.classes.light_scheme,
        light: theme.classes.light_scheme.toString(),
        dark: theme.classes.dark_scheme.toString(),
        dynamic: theme.classes.dynamic_scheme.toString(),
      }
    })
    expect(result.memoized).toBe(true)
    expect(result.light).toContain("e-light-theme")
    expect(result.dark).toContain("e-dark-theme")
    expect(result.dynamic).toContain("e-dynamic-theme")
  })

  test("toString() still drives the dynamic scheme", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return {
        theme_str: theme.toString(),
        dynamic_str: theme.classes.dynamic_scheme.toString(),
      }
    })
    expect(result.theme_str).toBe(result.dynamic_str)
  })

  test("pad(step)/spacing(step) return a stable, cached class name per step, mirroring theme.css.pad/spacing", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
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
      const { theme } = window.__ELT__.UI
      const a = theme.classes.pad("component")
      const b = theme.classes.pad("component")
      const c = theme.classes.pad("section")
      const rule = find_rule_text(a)
      return { a, b, c, rule, pad_component: theme.css.pad("component") }
    })
    expect(result.a).toBe(result.b)
    expect(result.a).not.toBe(result.c)
    expect(result.rule).toContain(result.pad_component)
    expect(result.rule).toContain("padding: var(--e-pad-vertical) var(--e-pad-horizontal)")
  })

  test("spacing(step) applies the gap property from the same --e-spacing-vertical/-horizontal custom properties [pad]/[spacing] attribute rules use", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
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
      const { theme } = window.__ELT__.UI
      const cls = theme.classes.spacing("widget")
      const rule = find_rule_text(cls)
      return { rule, spacing_widget: theme.css.spacing("widget") }
    })
    expect(result.rule).toContain(result.spacing_widget)
    expect(result.rule).toContain("gap: var(--e-spacing-vertical) var(--e-spacing-horizontal)")
  })
})
