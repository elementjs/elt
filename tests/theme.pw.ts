import { type Page, expect, test } from "./fixture"

test.describe("Color/Mix merge", () => {
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
      // evaluates `read` twice and checks both reads return the very same object (memoization)
      const same = (read: () => unknown) => {
        const first = read()
        return first === read()
      }
      return {
        same_mix: same(() => tint.faded) && same(() => tint.from_bg("37%")),
        inverted: same(() => tint.faded.class_as_inverted),
        tint: same(() => tint.ink.class_as_tint),
        surface: same(() => tint.mid.class_as_surface(2)),
        distinct: tint.faded !== tint.mid,
      }
    })
    expect(result).toEqual({ same_mix: true, inverted: true, tint: true, surface: true, distinct: true })
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
})

test.describe("Mix.surface offsets", () => {
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
})

// Parses the "--e-<mode>-color-<name>: oklch(l c h);" entries `Theme.all_colors` emits, so tests
// assert against whatever tint/text actually resolved to (including auto-derived dark values)
// instead of hardcoding expected numbers.
function parse_ok_lch(all_colors: string, mode: "light" | "dark", name: string) {
  const re = new RegExp(`--e-${mode}-color-${name}: oklch\\(([^ ]+) ([^ ]+) ([^)]+)\\);`)
  const m = re.exec(all_colors)
  if (!m) throw new Error(`no ${mode} oklch entry for "${name}" in: ${all_colors}`)
  return { l: parseFloat(m[1]), c: parseFloat(m[2]), h: parseFloat(m[3]) }
}

test.describe("Theme.colors.neutral", () => {
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
})

// `error`: invalid fields and error messages. Palette `error` > palette `red` > a red at tint's
// lightness and chroma (docs/md/ui-theme.md#colors).
test.describe("Theme.colors.error", () => {
  test("is the palette's red when there is one (the default theme)", async ({ page }) => {
    const all_colors = await page.evaluate(() => window.__ELT__.UI.theme.all_colors)
    for (const mode of ["light", "dark"] as const) {
      expect(parse_ok_lch(all_colors, mode, "error"), mode).toEqual(parse_ok_lch(all_colors, mode, "red"))
    }
  })

  test("without red, is derived per mode: tint's lightness, a red hue, a chroma floor", async ({ page }) => {
    const all_colors = await page.evaluate(() => {
      const { Theme } = window.__ELT__.UI
      // A nearly grey tint: its own chroma is below the floor.
      return new Theme({
        light: { bg: "#ffffff", text: "#1c1c1b", tint: "#55606a" },
        dark: { bg: "#1c1c1b", text: "#ffffff", tint: "#33aa66" },
      }).all_colors
    })
    for (const mode of ["light", "dark"] as const) {
      const tint = parse_ok_lch(all_colors, mode, "tint")
      const error = parse_ok_lch(all_colors, mode, "error")
      expect(error.l, `${mode} lightness`).toBeCloseTo(tint.l, 3)
      expect(error.h, `${mode} hue`).toBeCloseTo(25, 1)
      expect(error.c, `${mode} chroma`).toBeGreaterThanOrEqual(0.15)
    }
  })

  test("an explicit error in the palette wins over red", async ({ page }) => {
    const all_colors = await page.evaluate(() => {
      const { Theme } = window.__ELT__.UI
      return new Theme({ light: { bg: "#ffffff", text: "#1c1c1b", tint: "#005FCC", red: "#ff0000", error: "#ff00ff" } })
        .all_colors
    })
    // magenta's hue (~328) rather than red's (~29)
    expect(parse_ok_lch(all_colors, "light", "error").h).toBeGreaterThan(300)
  })
})

test.describe("Theme palette reading", () => {
  test("a hue the browser writes as `none` reads as 0, not NaN (regression: Chromium 157+ writes the hue of white, black and greys as `none`, which made the theme's bg and text invalid)", async ({
    page,
  }) => {
    const all_colors = await page.evaluate(() => {
      const { Theme } = window.__ELT__.UI
      // Chromium 156 and below write a number for that hue: write `none` as 157 does, for colors with
      // (almost) no chroma
      const real = window.getComputedStyle
      window.getComputedStyle = (el, pseudo) => {
        const cs = real(el, pseudo)
        const color = cs.color.replace(/^oklch\(([^ ]+) ([^ ]+) [^)]+\)$/, (all, l, c) =>
          parseFloat(c) < 0.001 ? `oklch(${l} ${c} none)` : all,
        )
        return new Proxy(cs, {
          get: (t, k) => {
            if (k === "color") return color
            const v = Reflect.get(t, k)
            return typeof v === "function" ? v.bind(t) : v
          },
        })
      }
      try {
        return new Theme({ light: { bg: "#ffffff", text: "#1c1c1c", tint: "#005FCC" } }).all_colors
      } finally {
        window.getComputedStyle = real
      }
    })
    expect(all_colors).not.toContain("NaN")
    expect(parse_ok_lch(all_colors, "light", "bg").h).toBe(0)
    expect(parse_ok_lch(all_colors, "light", "text").h).toBe(0)
  })

  test("under forced colors, the theme still reads the palette's own colors (regression: it threw on the first one, read as a system color)", async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: "active" })
    const all_colors = await page.evaluate(() => {
      const { Theme } = window.__ELT__.UI
      return new Theme({ light: { bg: "#ffffff", text: "#1c1c1b", tint: "#005FCC" } }).all_colors
    })
    // the tint's own blue, not a system color
    const tint = parse_ok_lch(all_colors, "light", "tint")
    expect(tint.h).toBeGreaterThan(250)
    expect(tint.h).toBeLessThan(270)
  })
})

// Regression: the guard used `||`, so it threw only when all three colors were missing; one missing
// color, or one the browser can't read, surfaced later as an unrelated TypeError.
test.describe("Theme validation", () => {
  async function construct(page: Page, light: Record<string, string>) {
    return page.evaluate((light) => {
      const { Theme } = window.__ELT__.UI
      const before = document.body.childElementCount
      try {
        new Theme({ light: light as never })
        return { error: null, leftover: document.body.childElementCount - before }
      } catch (e) {
        return { error: (e as Error).message, leftover: document.body.childElementCount - before }
      }
    }, light)
  }

  test("a missing bg, text or tint throws a clear error", async ({ page }) => {
    for (const missing of ["bg", "text", "tint"]) {
      const light: Record<string, string> = { bg: "#ffffff", text: "#1c1c1b", tint: "#005FCC" }
      delete light[missing]
      const r = await construct(page, light)
      expect(r.error, missing).toBe("Light theme must have a bg, text, and tint color")
    }
  })

  test("a color the browser can't read throws an error naming it, and leaves no probe element behind", async ({
    page,
  }) => {
    const r = await construct(page, { bg: "#ffffff", text: "#1c1c1b", tint: "not-a-color" })
    expect(r.error).toContain(`"tint"`)
    expect(r.error).toContain("not-a-color")
    expect(r.leftover).toBe(0)
  })
})

// The three scheme classes are built by one function: the dynamic one switches to the dark palette
// under prefers-color-scheme: dark, the light and dark ones never do.
test("class_dynamic_scheme follows prefers-color-scheme; class_light_scheme / class_dark_scheme don't", async ({
  page,
}) => {
  const read = () =>
    page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const out: Record<string, string> = {}
      for (const name of ["class_light_scheme", "class_dark_scheme", "class_dynamic_scheme"] as const) {
        const el = document.createElement("div")
        el.className = theme[name]
        document.body.appendChild(el)
        out[name] = getComputedStyle(el).backgroundColor
        el.remove()
      }
      return out
    })
  await page.emulateMedia({ colorScheme: "light" })
  const light = await read()
  await page.emulateMedia({ colorScheme: "dark" })
  const dark = await read()
  expect(light.class_dynamic_scheme).toBe(light.class_light_scheme)
  expect(dark.class_dynamic_scheme).toBe(dark.class_dark_scheme)
  expect(dark.class_light_scheme).toBe(light.class_light_scheme)
  expect(light.class_dark_scheme).toBe(dark.class_dark_scheme)
  expect(light.class_light_scheme).not.toBe(light.class_dark_scheme)
})

test.describe("Mix.alpha", () => {
  test("gives the color at an opacity, one instance per expression", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const text = theme.colors.text
      return {
        // The browser's own resolution of the color and of its translucent form: same channels, alpha 0.7.
        ...(() => {
          const probe = document.createElement("div")
          document.body.appendChild(probe)
          probe.style.color = text.toString()
          const opaque = getComputedStyle(probe).color
          probe.style.color = text.alpha(0.7).toString()
          const translucent = getComputedStyle(probe).color
          probe.remove()
          return { opaque, translucent }
        })(),
        same_instance: text.alpha(0.7) === theme.colors.text.alpha(0.7),
        opaque_is_itself: text.alpha(1) === text,
        // `from`'s alpha argument goes through `alpha`: same instance as chaining it by hand.
        from_with_alpha: text.from_bg("50%", 0.5) === text.from_bg("50%").alpha(0.5),
      }
    })
    expect(r.translucent).not.toBe(r.opaque)
    expect(r.translucent).toBe(r.opaque.replace(/\)$/, " / 0.7)"))
    expect(r.same_instance).toBe(true)
    expect(r.opaque_is_itself).toBe(true)
    expect(r.from_with_alpha).toBe(true)
  })
})

test.describe('surface="invert-tint" / "invert-neutral"', () => {
  for (const family of ["tint", "neutral"] as const) {
    test(`the attribute paints the same as the ${family} inverted class, and no other surface rule wins`, async ({
      page,
    }) => {
      const r = await page.evaluate((family) => {
        const { theme } = window.__ELT__.UI
        const attr = document.createElement("e-row")
        attr.setAttribute("surface", `invert-${family}`)
        const cls = document.createElement("e-row")
        cls.className = theme.colors[family].class_as_inverted
        document.body.append(attr, cls)
        const pick = (el: Element) => {
          const cs = getComputedStyle(el)
          return [cs.backgroundColor, cs.color, cs.borderTopColor, cs.getPropertyValue("--e-color-tint")]
        }
        const res = { attr: pick(attr), cls: pick(cls) }
        attr.remove()
        cls.remove()
        return res
      }, family)
      expect(r.attr).toEqual(r.cls)
      // not transparent: the band really has a fill
      expect(r.attr[0]).not.toBe("rgba(0, 0, 0, 0)")
    })
  }
})
