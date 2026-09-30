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
      const class_a = theme.colors.tint.faded.class_as_inverted.toString()
      const class_b = theme.colors.red.mid.class_as_inverted.toString()
      return { class_a, class_b }
    })
    expect(result.class_a).not.toBe("")
    expect(result.class_a).not.toBe(result.class_b)
  })

  test("a computed mix read twice yields the same Mix and the same class names (regression: each read of .faded minted a new anon class — a new stylesheet rule — every time)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const tint = theme.colors.tint
      return {
        same_mix: tint.faded === tint.faded && tint.from_bg("37%") === tint.from_bg("37%"),
        inverted: tint.faded.class_as_inverted === tint.faded.class_as_inverted,
        tint: tint.strong.class_as_tint === tint.strong.class_as_tint,
        surface: tint.mid.class_as_surface(2) === tint.mid.class_as_surface(2),
        distinct: tint.faded !== tint.mid,
      }
    })
    expect(result).toEqual({ same_mix: true, inverted: true, tint: true, surface: true, distinct: true })
  })

  test("Mix and Theme expose css_*/class_* members directly, with no css/classes sub-objects or _-prefixed forwarding helpers", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const tint = theme.colors.tint as unknown as Record<string, unknown>
      const th = theme as unknown as Record<string, unknown>
      return {
        mix_namespaces: ["css", "classes", "_css_as_tint", "_classes_as_tint", "_css_as_surface"].filter(
          (k) => k in tint,
        ),
        theme_namespaces: ["css", "classes"].filter((k) => k in th),
        mix_members: typeof tint.css_as_surface === "function" && typeof tint.class_as_inverted === "string",
        theme_members: typeof th.css_pad === "function" && typeof th.class_dynamic_scheme === "string",
      }
    })
    expect(result).toEqual({ mix_namespaces: [], theme_namespaces: [], mix_members: true, theme_members: true })
  })

  test("named colors keep readable, stable as_inverted/as_tint class names", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return {
        as_inverted: theme.colors.tint.class_as_inverted.toString(),
        as_tint: theme.colors.tint.class_as_tint.toString(),
      }
    })
    expect(result.as_inverted).toContain("e-color-tint-inverted")
    expect(result.as_tint).toContain("e-color-tint-tint")
  })

  test("as_inverted freezes bg to the light theme's colors, not the live (possibly dark) ones — fixes a dark-mode contrast bug in the soft-inverted chrome case (ui/layout.css.tsx text.faded.css_as_inverted)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const css = theme.colors.text.faded.css_as_inverted
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

  test("as_inverted also collapses neutral to the same frozen value as text/tint (text and tint coincide under inversion, so neutral needs no separate recomputation)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const css = theme.colors.tint.css_as_inverted
      const neutral_line = css.split("\n").find((l) => l.includes("--e-color-neutral:"))!
      const text_line = css.split("\n").find((l) => l.includes("--e-color-text:"))!
      const tint_line = css.split("\n").find((l) => l.includes("--e-color-tint:"))!
      return { neutral_line, text_line, tint_line }
    })
    expect(result.neutral_line).toContain("var(--e-light-color-bg)")
    // same right-hand-side as text/tint, not independently derived
    expect(result.neutral_line.split(":")[1]).toBe(result.text_line.split(":")[1])
    expect(result.neutral_line.split(":")[1]).toBe(result.tint_line.split(":")[1])
  })

  test("inside a real inverted element, neutral/text/tint resolve to the identical computed color", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      document.body.className = theme.class_light_scheme
      const el = document.createElement("div")
      el.className = theme.colors.tint.class_as_inverted
      document.body.appendChild(el)
      const probe = (expr: string) => {
        const span = document.createElement("span")
        span.style.color = expr
        el.appendChild(span)
        const value = getComputedStyle(span).color
        span.remove()
        return value
      }
      const out = {
        neutral: probe(theme.colors.neutral.toString()),
        text: probe(theme.colors.text.toString()),
        tint: probe(theme.colors.tint.toString()),
      }
      el.remove()
      return out
    })
    expect(result.neutral).toBe(result.text)
    expect(result.neutral).toBe(result.tint)
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
      const cls = theme.colors.red.class_as_tint.toString()
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
      return theme.colors.tint.css_as_surface(2)
    })
    expect(css).toContain("--e-current-surface-level: 2;")
    // never reads the ambient level (with its ", 0" fallback) to compute its own — only a relative n+K offset does
    expect(css).not.toContain("var(--e-surface-level,")
  })

  test("n+1 raises one level relative to whatever's ambient", async ({ page }) => {
    const css = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.css_as_surface("n+1")
    })
    expect(css).toContain("--e-current-surface-level: (1 + var(--e-surface-level, 0));")
  })

  test('n+2 raises two levels relative to whatever\'s ambient — the same offset [surface="n+2"]/.separator use', async ({
    page,
  }) => {
    const css = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.css_as_surface("n+2")
    })
    expect(css).toContain("--e-current-surface-level: (2 + var(--e-surface-level, 0));")
  })

  test("n+0 is a valid, well-defined relative offset (identity — same level as ambient)", async ({ page }) => {
    const css = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.css_as_surface("n+0")
    })
    expect(css).toContain("--e-current-surface-level: (0 + var(--e-surface-level, 0));")
  })

  test("a malformed relative offset throws instead of silently producing broken CSS", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const outcomes: boolean[] = []
      for (const fn of [
        () => theme.colors.tint.css_as_surface("n+1.5" as never),
        () => theme.colors.tint.css_as_surface("n+-1" as never),
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
      return theme.colors.tint.css_as_surface("background")
    })
    expect(css).toContain("--e-current-surface-level: 0;")
    expect(css).toContain("background-color:")
    // must not read the ambient level to decide its own color — that would just repaint the
    // parent's own color and defeat rule 1 (padding requires a *visible* boundary)
    expect(css).not.toContain("var(--e-surface-level,")
    // --e-surface-mix (specs/borders.md) is relayed to children alongside --e-surface-level, same rule
    expect(css).toContain(
      "& > * { --e-surface-level: var(--e-surface-level-relay); --e-surface-mix: var(--e-surface-mix-relay); }",
    )
  })

  test("children are handed the new level via the same relay variable used to paint it", async ({ page }) => {
    const css = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.css_as_surface(3)
    })
    expect(css).toContain("--e-surface-level-relay: var(--e-current-surface-level);")
    expect(css).toContain(
      "& > * { --e-surface-level: var(--e-surface-level-relay); --e-surface-mix: var(--e-surface-mix-relay); }",
    )
  })

  test(".class_as_surface() returns a stable, cached class name per level — usable on any element, not just e-flex/e-grid/e-prose", async ({
    page,
  }) => {
    // Content correctness (the CSS text) is covered by the .css_as_surface tests above. Reading the
    // generated rule back via document.adoptedStyleSheets for a class containing nested `&` selectors
    // is skipped here too (only the class-name identity/caching behavior is asserted), consistent with
    // the original happy-dom-era test which found nested-`&` rules unreliable to read back.
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const a = theme.colors.tint.class_as_surface(2)
      const b = theme.colors.tint.class_as_surface(2)
      const c = theme.colors.tint.class_as_surface(3)
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

  test("surface(N) computes N * the surface step, same formula .css_as_surface uses via its custom-property indirection", async ({
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

  test("surface('n+1') reads the ambient level, same offset as .css_as_surface('n+1')", async ({ page }) => {
    const value = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.surface("n+1")
    })
    expect(value).toContain(
      "calc((1 + var(--e-current-surface-level, var(--e-surface-level, 0))) * var(--e-surface-step, 10%))",
    )
  })

  test("surface('n+2') is available for arbitrary offsets, unlike the [surface] attribute which only precompiles n+1/n+2", async ({
    page,
  }) => {
    const value = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.colors.tint.surface("n+2")
    })
    expect(value).toContain(
      "calc((2 + var(--e-current-surface-level, var(--e-surface-level, 0))) * var(--e-surface-step, 10%))",
    )
  })

  test(".hover/.separator delegate to the same relative-offset expression as surface('n+1')/surface('n+2')", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return {
        hover: theme.colors.tint.hover.toString(),
        separator: theme.colors.tint.separator.toString(),
      }
    })
    expect(result.hover).toContain(
      "(1 + var(--e-current-surface-level, var(--e-surface-level, 0))) * var(--e-surface-step, 10%)",
    )
    expect(result.separator).toContain(
      "(2 + var(--e-current-surface-level, var(--e-surface-level, 0))) * var(--e-surface-step, 10%)",
    )
  })
})

test.describe("Theme.colors.neutral", () => {
  // Parses the "--e-<mode>-color-<name>: oklch(l c h);" entries `Theme.all_colors` emits, so tests
  // assert against whatever tint/text actually resolved to (including auto-derived dark values)
  // instead of hardcoding expected numbers.
  function parse_ok_lch(all_colors: string, mode: "light" | "dark", name: string) {
    const re = new RegExp(`--e-${mode}-color-${name}: oklch\\(([^ ]+) ([^ ]+) ([^)]+)\\);`)
    const m = re.exec(all_colors)
    if (!m) throw new Error(`no ${mode} oklch entry for "${name}" in: ${all_colors}`)
    return { l: parseFloat(m[1]), c: parseFloat(m[2]), h: parseFloat(m[3]) }
  }

  test("derives neutral's lightness from tint and chroma/hue from text, independently per mode", async ({ page }) => {
    const all_colors = await page.evaluate(() => {
      const { Theme } = window.__ELT__.UI
      const t = new Theme({
        light: { bg: "#ffffff", text: "#1c1c1b", tint: "#005FCC" },
        // A dark-mode tint distinct from light's, so a neutral that merely flipped the light
        // value (instead of recomputing per mode) would be caught matching the wrong tint.
        dark: { bg: "#1c1c1b", text: "#ffffff", tint: "#33aa66" },
      })
      return t.all_colors
    })

    for (const mode of ["light", "dark"] as const) {
      const tint = parse_ok_lch(all_colors, mode, "tint")
      const text = parse_ok_lch(all_colors, mode, "text")
      const neutral = parse_ok_lch(all_colors, mode, "neutral")
      expect(neutral.l, `${mode} neutral.l vs tint.l`).toBeCloseTo(tint.l, 3)
      expect(neutral.c, `${mode} neutral.c vs text.c`).toBeCloseTo(text.c, 3)
      expect(neutral.h, `${mode} neutral.h vs text.h`).toBeCloseTo(text.h, 1)
    }
  })

  test("an explicit neutral in the palette wins over the derived one, silently", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { Theme, Mix } = window.__ELT__.UI
      const t = new Theme({
        light: { bg: "#ffffff", text: "#1c1c1b", tint: "#005FCC", neutral: "#ff00ff" },
      })
      return {
        all_colors: t.all_colors,
        is_mix: t.colors.neutral instanceof Mix,
        expr: t.colors.neutral.toString(),
      }
    })
    expect(result.is_mix).toBe(true)
    expect(result.expr).toBe("var(--e-color-neutral)")
    const neutral = parse_ok_lch(result.all_colors, "light", "neutral")
    // The derived formula would give neutral ~text's near-zero chroma; a supplied magenta has real
    // chroma, so a high chroma here proves the explicit value wasn't overwritten by derivation.
    expect(neutral.c).toBeGreaterThan(0.1)
  })

  test("neutral supports the full Mix API, like any other named color", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const n = theme.colors.neutral
      return {
        mid: n.mid.toString(),
        faded: n.faded.toString(),
        surface: n.surface(1),
        hover: n.hover.toString(),
        separator: n.separator.toString(),
        from_bg: n.from_bg("20%").toString(),
      }
    })
    for (const value of Object.values(result)) {
      expect(value).toContain("--e-color-neutral")
    }
  })

  test("the exported singleton theme has a derived neutral", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme, Mix } = window.__ELT__.UI
      return {
        is_mix: theme.colors.neutral instanceof Mix,
        all_colors: theme.all_colors,
      }
    })
    expect(result.is_mix).toBe(true)
    expect(result.all_colors).toContain("--e-light-color-neutral: oklch(")
    expect(result.all_colors).toContain("--e-dark-color-neutral: oklch(")
  })
})

test.describe("Spacing scale (regression: no separate vertical/horizontal values — one value per step, both axes)", () => {
  test("a named step has a single value, doubling from the previous step", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return {
        css_settings: theme.css_settings,
        spacing_widget: theme.settings.spacingWidget,
      }
    })
    expect(result.css_settings).toContain("--e-spacing-widget: 6px;")
    expect(result.css_settings).toContain("--e-spacing-component: 12px;")
    expect(result.css_settings).not.toContain("--e-spacing-widget-vertical")
    expect(result.css_settings).not.toContain("--e-spacing-widget-horizontal")
    expect(result.spacing_widget).toBe("var(--e-spacing-widget, 6px)")
  })
})

test.describe("Theme.css_pad / Theme.css_spacing", () => {
  test("pad(step) sets --e-pad from the named step's single spacing variable", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.css_pad("widget")
    })
    expect(result).toBe("--e-pad: var(--e-spacing-widget);")
  })

  test("spacing(step) sets --e-spacing and --e-current-spacing from the named step's single spacing variable (specs/borders.md)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.css_spacing("section")
    })
    expect(result).toBe("--e-spacing: var(--e-spacing-section); --e-current-spacing: var(--e-spacing-section);")
  })

  test("the three raw px nudges use the same single-variable mechanism as every other step", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return theme.css_pad("nudge-4")
    })
    expect(result).toBe("--e-pad: var(--e-spacing-nudge-4);")
  })
})

test.describe("Theme class_*_scheme (regression: renamed from class_light/class_dark/class_dynamic)", () => {
  test("light_scheme/dark_scheme/dynamic_scheme are memoized and produce the expected class names", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      return {
        memoized: theme.class_light_scheme === theme.class_light_scheme,
        light: theme.class_light_scheme.toString(),
        dark: theme.class_dark_scheme.toString(),
        dynamic: theme.class_dynamic_scheme.toString(),
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
        dynamic_str: theme.class_dynamic_scheme.toString(),
      }
    })
    expect(result.theme_str).toBe(result.dynamic_str)
  })

  test("pad(step)/spacing(step) return a stable, cached class name per step, mirroring theme.css_pad/css_spacing", async ({
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
      const a = theme.class_pad("component")
      const b = theme.class_pad("component")
      const c = theme.class_pad("section")
      const rule = find_rule_text(a)
      return { a, b, c, rule, pad_component: theme.css_pad("component") }
    })
    expect(result.a).toBe(result.b)
    expect(result.a).not.toBe(result.c)
    expect(result.rule).toContain(result.pad_component)
    expect(result.rule).toContain("padding: var(--e-pad)")
  })

  test("spacing(step) applies the gap property from the same --e-spacing custom property [pad]/[spacing] attribute rules use", async ({
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
      const cls = theme.class_spacing("widget")
      const rule = find_rule_text(cls)
      return { rule, spacing_widget: theme.css_spacing("widget") }
    })
    expect(result.rule).toContain(result.spacing_widget)
    expect(result.rule).toContain("gap: var(--e-spacing)")
  })
})
