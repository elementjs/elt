import { expect, test } from "./fixture"

// `class_as_tint` and the surface variables (docs/md/ui-theme.md): --e-current-surface and --e-surface-mix are
// resolved colors, so a tint change under a surface of the tint family has to repaint them (css_as_tint).

/** Builds `html` in the page ({red} stands for the red tint class) and returns the computed color of
 * `background: <expr>` on the element with id `id`, the same way for a reference element. */
async function colors(page: import("@playwright/test").Page, html: string, probes: Record<string, string>) {
  return page.evaluate(
    ({ html, probes }) => {
      const { theme } = window.__ELT__.UI
      const host = document.createElement("div")
      host.innerHTML = html.replaceAll("{red}", theme.colors.red.class_as_tint)
      document.body.append(host)
      const out: Record<string, string> = {}
      for (const [id, expr] of Object.entries(probes)) {
        const el = host.querySelector<HTMLElement>(`#${id}`)
        if (!el) throw new Error(`no #${id}`)
        // The expression may use the theme (written `theme.colors.x.y` and evaluated here).
        const value = expr.startsWith("theme.")
          ? expr
              .split(".")
              .slice(1)
              .reduce((m: any, k) => m[k], theme)
              .toString()
          : expr
        const probe = document.createElement("div")
        probe.style.background = value
        el.append(probe)
        out[id] = getComputedStyle(probe).backgroundColor
        probe.remove()
      }
      host.remove()
      return out
    },
    { html, probes },
  )
}

test.describe("a tint change under a tint-family surface", () => {
  test("repaints --e-current-surface with the new tint, at the ambient level", async ({ page }) => {
    const html = `<e-column surface="tint"><e-row id="a"><e-row id="b" class="{red}"><e-row id="c"></e-row></e-row></e-row></e-column>`
    const got = await colors(page, html, {
      a: "var(--e-current-surface)",
      b: "var(--e-current-surface)",
      c: "var(--e-current-surface)",
    })
    // The red surface at the same level (1) as the blue one it sits on.
    const want = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const probe = document.createElement("div")
      probe.style.background = theme.colors.red.surface(1)
      document.body.append(probe)
      const color = getComputedStyle(probe).backgroundColor
      probe.remove()
      return color
    })
    expect(got.b).toBe(want)
    expect(got.c).toBe(want)
    // The tinted subtree no longer shows the outer (blue) surface.
    expect(got.b).not.toBe(got.a)
  })

  test("--e-surface-mix (the hover family) follows the new tint, also on a direct child of the surface", async ({
    page,
  }) => {
    const mix = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const host = document.createElement("div")
      host.innerHTML = `<e-column surface="tint"><e-row id="direct" class="${theme.colors.red.class_as_tint}"></e-row><e-row id="plain"></e-row></e-column>`
      document.body.append(host)
      const read = (id: string) =>
        getComputedStyle(host.querySelector(`#${id}`) as Element).getPropertyValue("--e-surface-mix")
      const ref = document.createElement("div")
      ref.style.setProperty("--x", "var(--e-color-red)")
      host.append(ref)
      const out = { direct: read("direct"), plain: read("plain"), red: getComputedStyle(ref).getPropertyValue("--x") }
      host.remove()
      return out
    })
    expect(mix.direct).toBe(mix.red)
    expect(mix.plain).not.toBe(mix.red)
  })

  test("a neutral surface is left alone by a tint change", async ({ page }) => {
    const html = `<e-column surface="neutral"><e-row id="a"><e-row id="b" class="{red}"></e-row></e-row></e-column>`
    const got = await colors(page, html, { a: "var(--e-current-surface)", b: "var(--e-current-surface)" })
    expect(got.b).toBe(got.a)
  })

  test("an element that is a surface of its own keeps its own surface", async ({ page }) => {
    const html = `<e-column surface="tint"><div><e-row id="a" surface="neutral" class="{red}"></e-row><e-row id="b" surface="neutral"></e-row></div></e-column>`
    const got = await colors(page, html, { a: "var(--e-current-surface)", b: "var(--e-current-surface)" })
    expect(got.a).toBe(got.b)
  })
})
