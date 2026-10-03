import { expect, test } from "@playwright/test"

/*
 * Contrast of text on surface levels, with the default palette.
 *
 * A surface at level N mixes N × --e-surface-step (10%) of its family into the background. The deeper
 * the level, the closer the fill gets to the text's own color in dark mode (and to a mid tone in
 * light mode), so at some level text stops being readable. This measures, for both families, both
 * schemes and every level 0–8, the WCAG contrast ratio of `text` and `text.faded` on the fill.
 */

type Row = {
  scheme: "light" | "dark"
  family: "tint" | "neutral"
  level: number
  text: number
  faded: number
  // `tint` itself on the fill: the check icon of a selected option, a checked toggle's label
  tint: number
}

type Band = { scheme: "light" | "dark"; family: "tint" | "neutral"; text: number }

async function measure(page: import("@playwright/test").Page): Promise<{ rows: Row[]; bands: Band[] }> {
  return page.evaluate(() => {
    const { theme } = window.__ELT__.UI

    // Resolve any CSS color (oklab, color-mix, …) to sRGB by painting one canvas pixel.
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!
    const rgb = (css: string) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return [r, g, b]
    }
    // WCAG 2 relative luminance and contrast ratio.
    const lum = ([r, g, b]: number[]) => {
      const lin = (c: number) => {
        const s = c / 255
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    }
    const ratio = (a: number[], b: number[]) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
    }

    const rows: Row[] = []
    const bands: Band[] = []
    for (const scheme of ["light", "dark"] as const) {
      const root = document.createElement("div")
      root.className = String(scheme === "light" ? theme.class_light_scheme : theme.class_dark_scheme)
      document.body.append(root)
      for (const family of ["tint", "neutral"] as const) {
        for (let level = 0; level <= 8; level++) {
          const el = document.createElement("div")
          el.style.background = theme.colors[family].surface(level)
          el.style.color = theme.colors.text.toString()
          el.style.borderColor = theme.colors.text.faded.toString()
          el.style.outlineColor = theme.colors.tint.toString()
          root.append(el)
          const cs = getComputedStyle(el)
          const bg = rgb(cs.backgroundColor)
          rows.push({
            scheme,
            family,
            level,
            text: ratio(rgb(cs.color), bg),
            faded: ratio(rgb(cs.borderTopColor), bg),
            tint: ratio(rgb(cs.outlineColor), bg),
          })
        }
        // The same family as an inverted band: its text is the light theme's background.
        const band = document.createElement("div")
        band.className = String(theme.colors[family].class_as_inverted)
        root.append(band)
        const bs = getComputedStyle(band)
        bands.push({ scheme, family, text: ratio(rgb(bs.color), rgb(bs.backgroundColor)) })
      }
      root.remove()
    }
    return { rows, bands }
  })
}

/*
 * Measured with the default palette (light / dark, either family — they differ by less than 0.1):
 *
 *   level   text          text.faded
 *   4       9.2 / 8.3     5.4 / 5.2
 *   6       6.5 / 5.5     3.8 / 3.4
 *   7       5.3 / 4.4     3.1 / 2.8    <- dark mode fails both from here
 *
 * Level 6 is the deepest a lasting fill can go and keep `text` at WCAG AA (4.5) and `text.faded`
 * at 3. The docs recommend stopping lasting fills at 4 (comfortable rather than merely compliant);
 * hover and pressed may go two levels past, since they only last a moment.
 */
test("text stays readable on tint- and neutral-inverted bands (default palette)", async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
  const { bands } = await measure(page)
  for (const b of bands) expect(b.text, `${b.scheme} ${b.family} inverted`).toBeGreaterThanOrEqual(4.5)
})

test("text stays readable on every surface level up to 6 (default palette)", async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
  const { rows } = await measure(page)
  for (const r of rows.filter((r) => r.level <= 6)) {
    const where = `${r.scheme} ${r.family} level ${r.level}`
    expect(r.text, `text on ${where}`).toBeGreaterThanOrEqual(4.5)
    expect(r.faded, `text.faded on ${where}`).toBeGreaterThanOrEqual(3)
  }
  // Selected is tint at ambient + 3 (+ 4 hovered): from a popup (level 0) that is level 3–4, where
  // tint itself (check icon, checked toggle label) must stay readable as a UI element (3:1).
  for (const r of rows.filter((r) => r.family === "tint" && r.level <= 4)) {
    expect(r.tint, `tint on ${r.scheme} tint level ${r.level}`).toBeGreaterThanOrEqual(3)
  }
})
