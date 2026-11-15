import { type Page, expect, test } from "./fixture"

// pad, spacing, packed and radius are independent attributes (docs/md/ui-layout.md, "Spacing scale",
// "Borders and radius", "packed"):
// - padding of an element: its own `pad`, never inherited;
// - gap between children: `spacing`, else `pad`, else inherited;
// - cell padding of a packed container: `packed="X"`, else (bare packed) its own `pad`, else the
//   packed container around it, else `widget`;
// - radius: `radius="X"`, else its own `pad`, else its own `packed="X"`, else `widget`.

/** The px value of each named step, resolved by the browser on a probe element. */
async function steps(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("div")
    document.body.appendChild(probe)
    const px = (step: string) => {
      probe.style.width = `var(--e-spacing-${step})`
      return getComputedStyle(probe).width
    }
    const out = { widget: px("widget"), component: px("component"), section: px("section") }
    probe.remove()
    return out
  })
}

/** Mounts `html` in a host and returns the computed values of each `#id`'s listed properties. */
async function measure(page: Page, html: string, wanted: Record<string, string[]>) {
  return page.evaluate(
    ({ html, wanted }) => {
      const host = document.createElement("div")
      host.style.width = "400px"
      host.innerHTML = html
      document.body.appendChild(host)
      return Object.fromEntries(
        Object.entries(wanted).map(([id, props]) => {
          const st = getComputedStyle(host.querySelector(`#${id}`) as Element)
          return [id, Object.fromEntries(props.map((p) => [p, st.getPropertyValue(p)]))]
        }),
      )
    },
    { html, wanted },
  )
}

test.describe("pad", () => {
  test("pads the element, spaces its children at the same step, and is not inherited", async ({ page }) => {
    const STEP_PX = await steps(page)
    const r = await measure(
      page,
      `<e-column id="a" pad="section"><i>x</i><e-row id="inner"><i>y</i><i>z</i></e-row><e-row id="b" packed><i id="cell">w</i></e-row></e-column>`,
      { a: ["padding-top", "row-gap"], inner: ["padding-top", "column-gap"], cell: ["padding-top"] },
    )
    expect(r.a).toEqual({ "padding-top": STEP_PX.section, "row-gap": STEP_PX.section })
    // A plain row below: no padding of its own, spaced like its parent.
    expect(r.inner).toEqual({ "padding-top": "0px", "column-gap": STEP_PX.section })
    // A bare packed row below pads its cells at widget, not at the pad of an ancestor.
    expect(r.cell["padding-top"]).toBe(STEP_PX.widget)
  })

  test("an explicit spacing sets the gap, the padding stays", async ({ page }) => {
    const STEP_PX = await steps(page)
    const r = await measure(page, `<e-column id="a" pad="section" spacing="widget"><i>x</i><i>y</i></e-column>`, {
      a: ["padding-top", "row-gap"],
    })
    expect(r.a).toEqual({ "padding-top": STEP_PX.section, "row-gap": STEP_PX.widget })
  })

  test('pad="none" pads nothing and spaces nothing, unless spacing is given', async ({ page }) => {
    const STEP_PX = await steps(page)
    const r = await measure(
      page,
      `<e-column id="a" pad="none"><i>x</i><i>y</i></e-column><e-column id="b" pad="none" spacing="widget"><i>x</i><i>y</i></e-column>`,
      { a: ["padding-top", "row-gap"], b: ["padding-top", "row-gap"] },
    )
    expect(r.a).toEqual({ "padding-top": "0px", "row-gap": "normal" })
    expect(r.b).toEqual({ "padding-top": "0px", "row-gap": STEP_PX.widget })
  })
})

test.describe("spacing", () => {
  test("only spaces: no padding, no change of the radius, inherited by plain layout descendants", async ({ page }) => {
    const STEP_PX = await steps(page)
    const r = await measure(
      page,
      `<e-column id="a" spacing="section" border><i>x</i><e-row id="inner"><i>y</i><i>z</i></e-row></e-column>`,
      { a: ["padding-top", "row-gap", "border-top-left-radius"], inner: ["column-gap"] },
    )
    expect(r.a).toEqual({ "padding-top": "0px", "row-gap": STEP_PX.section, "border-top-left-radius": STEP_PX.widget })
    expect(r.inner["column-gap"]).toBe(STEP_PX.section)
  })

  test("a packed container's children are not spaced, and spacing on it still passes down", async ({ page }) => {
    const STEP_PX = await steps(page)
    const r = await measure(
      page,
      `<e-column id="a" packed spacing="section"><e-row id="inner"><i>y</i><i>z</i></e-row></e-column>`,
      { a: ["row-gap"], inner: ["column-gap"] },
    )
    expect(r.a["row-gap"]).toBe("normal")
    expect(r.inner["column-gap"]).toBe(STEP_PX.section)
  })
})

test.describe("radius", () => {
  const radius = async (page: Page, attrs: string) =>
    (await measure(page, `<e-column id="a" border ${attrs}><i>x</i></e-column>`, { a: ["border-top-left-radius"] })).a[
      "border-top-left-radius"
    ]

  test("the radius comes from radius=X, else the own pad, else the own packed=X, else widget", async ({ page }) => {
    const STEP_PX = await steps(page)
    const cases: [string, string][] = [
      ["", STEP_PX.widget],
      ['pad="section"', STEP_PX.section],
      ['packed="component"', STEP_PX.component],
      ['packed="component" pad="section"', STEP_PX.section],
      ['radius="component" pad="section"', STEP_PX.component],
      ['radius="component" packed="section"', STEP_PX.component],
      ['radius="component" spacing="section"', STEP_PX.component],
    ]
    for (const [attrs, want] of cases) expect(await radius(page, attrs), attrs || "a bare border").toBe(want)
  })

  test("a bare packed doesn't take the radius from the packed container around it", async ({ page }) => {
    const STEP_PX = await steps(page)
    const r = await measure(
      page,
      `<e-column packed="section"><e-column id="a" packed border><i>x</i></e-column></e-column>`,
      {
        a: ["border-top-left-radius"],
      },
    )
    expect(r.a["border-top-left-radius"]).toBe(STEP_PX.widget)
  })

  test("a bare radius follows pad like a border does; pad=none falls back to widget", async ({ page }) => {
    const STEP_PX = await steps(page)
    const r = await measure(
      page,
      `<e-column id="a" radius pad="section"><i>x</i></e-column><e-column id="b" radius pad="none"><i>x</i></e-column>`,
      { a: ["border-top-left-radius"], b: ["border-top-left-radius"] },
    )
    expect(r.a["border-top-left-radius"]).toBe(STEP_PX.section)
    expect(r.b["border-top-left-radius"]).toBe(STEP_PX.widget)
  })
})

test.describe("packed cells", () => {
  const cell_pad = async (page: Page, html: string) =>
    (await measure(page, html, { c: ["padding-top"] })).c["padding-top"]

  test("a bare packed pads its cells at widget, whatever the spacing and the pad around it", async ({ page }) => {
    const STEP_PX = await steps(page)
    expect(await cell_pad(page, `<e-column packed><i id="c">x</i></e-column>`)).toBe(STEP_PX.widget)
    expect(
      await cell_pad(
        page,
        `<e-column spacing="section" pad="section"><e-row packed><i id="c">x</i></e-row></e-column>`,
      ),
    ).toBe(STEP_PX.widget)
  })

  test("a bare packed with its own pad pads its cells at that pad; with pad=none, at nothing", async ({ page }) => {
    const STEP_PX = await steps(page)
    expect(await cell_pad(page, `<e-column packed pad="section"><i id="c">x</i></e-column>`)).toBe(STEP_PX.section)
    expect(await cell_pad(page, `<e-column packed pad="none"><i id="c">x</i></e-column>`)).toBe("0px")
  })

  test("packed=X pads its cells at X, whatever its pad", async ({ page }) => {
    const STEP_PX = await steps(page)
    expect(await cell_pad(page, `<e-column packed="component"><i id="c">x</i></e-column>`)).toBe(STEP_PX.component)
    expect(await cell_pad(page, `<e-column packed="component" pad="section"><i id="c">x</i></e-column>`)).toBe(
      STEP_PX.component,
    )
    expect(await cell_pad(page, `<e-column packed="component" pad="none"><i id="c">x</i></e-column>`)).toBe(
      STEP_PX.component,
    )
  })

  test("a nested bare packed group inherits the step of the packed container around it, through other elements", async ({
    page,
  }) => {
    const STEP_PX = await steps(page)
    expect(
      await cell_pad(page, `<e-column packed="section"><e-column packed><i id="c">x</i></e-column></e-column>`),
    ).toBe(STEP_PX.section)
    expect(
      await cell_pad(page, `<e-column packed="section"><i><e-row packed><b id="c">x</b></e-row></i></e-column>`),
    ).toBe(STEP_PX.section)
    // The nearest packed container wins.
    expect(
      await cell_pad(
        page,
        `<e-column packed="section"><e-column packed="component"><e-row packed><i id="c">x</i></e-row></e-column></e-column>`,
      ),
    ).toBe(STEP_PX.component)
  })
})
