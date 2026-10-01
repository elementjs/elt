import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

// Inside <e-prose>, a run of typographic elements keeps its own rhythm, while non-typographic
// children (rows, columns, widgets) are spaced by the prose's `spacing` — padded or not. Where the
// two meet, margin collapsing keeps the larger of the two. See "Text runs" in docs/md/ui-guidelines.md.
test.describe("e-prose spacing between non-typographic children", () => {
  /** Builds `<e-prose {attrs}>{children}</e-prose>` and returns the vertical gap between each pair of
   * consecutive children, in px. */
  async function gaps(page: import("@playwright/test").Page, attrs: Record<string, string>, tags: string[]) {
    return page.evaluate(
      ({ attrs, tags }) => {
        const prose = document.createElement("e-prose")
        for (const [k, v] of Object.entries(attrs)) prose.setAttribute(k, v)
        const kids = tags.map((t) => {
          const el = document.createElement(t)
          el.textContent = "x"
          return el
        })
        prose.append(...kids)
        document.body.appendChild(prose)
        const out: number[] = []
        for (let i = 1; i < kids.length; i++) {
          out.push(Math.round(kids[i].getBoundingClientRect().top - kids[i - 1].getBoundingClientRect().bottom))
        }
        // Reference values, resolved by the browser itself.
        const probe = document.createElement("div")
        probe.style.height = "var(--e-spacing-section)"
        document.body.appendChild(probe)
        const section = Math.round(probe.getBoundingClientRect().height)
        probe.style.height = "var(--e-spacing-component)"
        const component = Math.round(probe.getBoundingClientRect().height)
        return { gaps: out, section, component }
      },
      { attrs, tags },
    )
  }

  test("two widgets in an un-padded prose are spaced at the ambient (component) step", async ({ page }) => {
    const r = await gaps(page, {}, ["e-row", "e-row"])
    expect(r.gaps[0]).toBe(r.component)
  })

  test("two widgets in a padded prose are spaced at the pad's step", async ({ page }) => {
    const r = await gaps(page, { pad: "section" }, ["e-row", "e-row"])
    expect(r.gaps[0]).toBe(r.section)
  })

  test("explicit spacing applies between widgets", async ({ page }) => {
    const r = await gaps(page, { spacing: "section" }, ["e-row", "div", "e-column"])
    expect(r.gaps).toEqual([r.section, r.section])
  })

  test("a text run keeps its typographic rhythm regardless of spacing", async ({ page }) => {
    const plain = await gaps(page, {}, ["p", "p"])
    const spaced = await gaps(page, { spacing: "stage-4" }, ["p", "p"])
    expect(spaced.gaps[0]).toBe(plain.gaps[0])
  })

  test("where text meets a widget, the larger of the two margins wins", async ({ page }) => {
    // stage-4 is far larger than a paragraph's 1em margin, so spacing wins on both sides.
    const big = await page.evaluate(() => {
      const probe = document.createElement("div")
      probe.style.height = "var(--e-spacing-stage-4)"
      document.body.appendChild(probe)
      return Math.round(probe.getBoundingClientRect().height)
    })
    const r = await gaps(page, { spacing: "stage-4" }, ["p", "e-row", "p"])
    expect(r.gaps).toEqual([big, big])
    // nudge-1 is far smaller than 1em, so the paragraph's own margin wins.
    const plain = await gaps(page, {}, ["p", "p"])
    const small = await gaps(page, { spacing: "nudge-1" }, ["p", "e-row", "p"])
    expect(small.gaps[0]).toBe(plain.gaps[0])
  })
})

// Regression: the ambient spacing default used to be declared on :root, where --e-spacing-* is not
// defined (only the theme class defines it), so it resolved to an empty value and every
// attribute-less layout element ended up with no gap at all.
test("an attribute-less layout element spaces its children at the ambient (component) step", async ({ page }) => {
  const r = await page.evaluate(() => {
    const row = document.createElement("e-row")
    document.body.appendChild(row)
    const probe = document.createElement("div")
    probe.style.width = "var(--e-spacing-component)"
    document.body.appendChild(probe)
    return { gap: getComputedStyle(row).columnGap, component: `${probe.getBoundingClientRect().width}px` }
  })
  expect(r.gap).toBe(r.component)
})
