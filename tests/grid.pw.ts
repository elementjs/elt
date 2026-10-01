import { expect, test } from "@playwright/test"

// e-grid (columns, packed), e-grid-row, frame ownership, sticky and scroll — ui/layout.css.tsx,
// docs/md/ui-layout.md.

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

/** Mounts `html` in a fixed-width host and returns nothing; tests query it with `#id`s. */
async function mount(page: import("@playwright/test").Page, html: string) {
  await page.evaluate((html) => {
    const host = document.createElement("div")
    host.style.width = "300px"
    host.innerHTML = html
    document.body.appendChild(host)
  }, html)
}

/** Computed style properties of the element matching `sel`. */
function styles(page: import("@playwright/test").Page, sel: string, props: string[]) {
  return page.evaluate(
    ({ sel, props }) => {
      const st = getComputedStyle(document.querySelector(sel) as Element)
      return Object.fromEntries(props.map((p) => [p, st.getPropertyValue(p)]))
    },
    { sel, props },
  )
}

/** Resolves a CSS color expression to its computed rgb() form, through a probe element. */
function color(page: import("@playwright/test").Page, expr: string, inside = "body") {
  return page.evaluate(
    ({ expr, inside }) => {
      const probe = document.createElement("div")
      probe.style.backgroundColor = expr
      ;(document.querySelector(inside) as Element).appendChild(probe)
      const c = getComputedStyle(probe).backgroundColor
      probe.remove()
      return c
    },
    { expr, inside },
  )
}

const row3 = (id = "", attrs = "") =>
  `<e-grid-row ${id ? `id="${id}"` : ""} ${attrs}><span>a</span><span>b</span><span>c</span></e-grid-row>`

test.describe("e-grid columns", () => {
  test("columns={N} makes N equal tracks", async ({ page }) => {
    await mount(page, `<e-grid id="g" columns="3" spacing="none"><span>a</span><span>b</span><span>c</span></e-grid>`)
    const { "grid-template-columns": tpl } = await styles(page, "#g", ["grid-template-columns"])
    expect(tpl).toBe("100px 100px 100px")
  })

  test("tracks don't follow content width", async ({ page }) => {
    await mount(
      page,
      `<e-grid id="g" columns="2" spacing="none"><span style="white-space:nowrap">a very very very long unbreakable cell content</span><span>b</span></e-grid>`,
    )
    const { "grid-template-columns": tpl } = await styles(page, "#g", ["grid-template-columns"])
    expect(tpl).toBe("150px 150px")
  })

  test("a CSS template overrides columns", async ({ page }) => {
    await page.addStyleTag({ content: ".custom { grid-template-columns: 100px 1fr; }" })
    await mount(page, `<e-grid id="g" class="custom" columns="3" spacing="none"><span>a</span><span>b</span></e-grid>`)
    const { "grid-template-columns": tpl } = await styles(page, "#g", ["grid-template-columns"])
    expect(tpl).toBe("100px 200px")
  })
})

test('spacing="none" removes the gap of every layout container (regression)', async ({ page }) => {
  await mount(
    page,
    `<e-row id="r" spacing="none"></e-row><e-column id="c" spacing="none"></e-column><e-grid id="g" spacing="none"></e-grid>`,
  )
  for (const id of ["#r", "#c", "#g"]) {
    expect((await styles(page, id, ["column-gap"]))["column-gap"]).toBe("0px")
  }
})

test.describe("e-grid-row", () => {
  test("spans the whole grid and aligns its cells on the grid's columns", async ({ page }) => {
    await mount(
      page,
      `<e-grid id="g" columns="3">${row3("r1")}<e-grid-row id="r2"><span>long long long long</span><span>b</span><span>c</span></e-grid-row></e-grid>`,
    )
    const res = await page.evaluate(() => {
      const xs = (id: string) =>
        [...document.getElementById(id)!.children].map((c) => Math.round(c.getBoundingClientRect().left))
      const g = document.getElementById("g")!.getBoundingClientRect()
      const r = document.getElementById("r1")!.getBoundingClientRect()
      return { r1: xs("r1"), r2: xs("r2"), row_width: Math.round(r.width), grid_width: Math.round(g.width) }
    })
    expect(res.r1).toEqual(res.r2)
    expect(new Set(res.r1).size).toBe(3)
    expect(res.row_width).toBe(res.grid_width)
  })

  test("e-row in a grid stays an ordinary cell", async ({ page }) => {
    await mount(
      page,
      `<e-grid id="g" columns="3"><e-row id="r"><span>a</span></e-row><span>b</span><span>c</span></e-grid>`,
    )
    const { display, "grid-column-end": end } = await styles(page, "#r", ["display", "grid-column-end"])
    expect(display).toBe("flex")
    expect(end).toBe("auto")
  })
})

test.describe("packed e-grid", () => {
  test("without border: no gap, cells padded, a cell's own pad and packed=step respected", async ({ page }) => {
    await mount(
      page,
      `<e-grid id="g" columns="3" packed><e-grid-row><span id="c1">a</span><span id="c2" pad="none">b</span><span>c</span></e-grid-row><span id="loose">d</span></e-grid>
       <e-grid id="g2" columns="3" packed="section"><span id="s1">a</span></e-grid>
       <span id="ref_component" style="padding: var(--e-spacing-component)"></span>
       <span id="ref_section" style="padding: var(--e-spacing-section)"></span>`,
    )
    // No gap: "normal" is 0 in a grid.
    const g = await styles(page, "#g", ["row-gap", "column-gap"])
    expect(g).toEqual({ "row-gap": "normal", "column-gap": "normal" })
    const comp = (await styles(page, "#ref_component", ["padding-top"]))["padding-top"]
    const sect = (await styles(page, "#ref_section", ["padding-top"]))["padding-top"]
    expect(comp).not.toBe("0px")
    expect((await styles(page, "#c1", ["padding-top"]))["padding-top"]).toBe(comp)
    expect((await styles(page, "#loose", ["padding-top"]))["padding-top"]).toBe(comp)
    expect((await styles(page, "#c2", ["padding-top"]))["padding-top"]).toBe("0px")
    expect((await styles(page, "#s1", ["padding-top"]))["padding-top"]).toBe(sect)
  })

  test("with border: 1px seams in the border color, cells on the surface, rows painted with the seam color", async ({
    page,
  }) => {
    await mount(page, `<e-grid id="g" columns="3" packed border>${row3("r1")}${row3("r2")}</e-grid>`)
    const g = await styles(page, "#g", ["row-gap", "column-gap", "background-color", "border-top-color"])
    expect(g["row-gap"]).toBe("1px")
    expect(g["column-gap"]).toBe("1px")
    expect(g["background-color"]).toBe(g["border-top-color"])
    const r = await styles(page, "#r1", ["background-color"])
    expect(r["background-color"]).toBe(g["border-top-color"])
    const cell = await styles(page, "#r1 > span", ["background-color", "border-top-style"])
    expect(cell["border-top-style"]).toBe("none")
    expect(cell["background-color"]).toBe(await color(page, "var(--e-current-surface)", "#g"))
    expect(cell["background-color"]).not.toBe(g["border-top-color"])
    // The seam between the two rows is 1px.
    const seam = await page.evaluate(
      () =>
        document.getElementById("r2")!.getBoundingClientRect().top -
        document.getElementById("r1")!.getBoundingClientRect().bottom,
    )
    expect(seam).toBe(1)
  })

  test("a row's surface colors its cells while its seams still show", async ({ page }) => {
    await mount(
      page,
      `<e-grid id="g" columns="3" packed border>${row3("r1", 'surface="tint-3"')}${row3("r2")}</e-grid>`,
    )
    const g = await styles(page, "#g", ["border-top-color"])
    const r1 = await styles(page, "#r1", ["background-color"])
    const c1 = await styles(page, "#r1 > span", ["background-color"])
    const c2 = await styles(page, "#r2 > span", ["background-color"])
    expect(r1["background-color"]).toBe(g["border-top-color"])
    expect(c1["background-color"]).not.toBe(c2["background-color"])
    expect(c1["background-color"]).toBe(await color(page, "var(--e-current-surface)", "#r1"))
  })

  test("a hovered row changes its cells' color", async ({ page }) => {
    await mount(page, `<e-grid id="g" columns="3" packed border>${row3("r1", "hover")}${row3("r2")}</e-grid>`)
    const before = (await styles(page, "#r1 > span", ["background-color"]))["background-color"]
    await page.hover("#r1 > span")
    const after = (await styles(page, "#r1 > span", ["background-color"]))["background-color"]
    expect(after).not.toBe(before)
  })

  test("corner cells of the first/last rows take the grid's radius, other cells none", async ({ page }) => {
    await mount(
      page,
      `<e-grid id="g" columns="3" packed border radius="section">
        <e-grid-row id="r1"><span id="tl">a</span><span id="tm">b</span><span id="tr">c</span></e-grid-row>
        <e-grid-row id="r2"><span id="ml">a</span><span>b</span><span>c</span></e-grid-row>
        <e-grid-row id="r3"><span id="bl">a</span><span>b</span><span id="br">c</span></e-grid-row>
      </e-grid>`,
    )
    const g = (await styles(page, "#g", ["border-top-left-radius"]))["border-top-left-radius"]
    expect(g).not.toBe("0px")
    expect((await styles(page, "#tl", ["border-top-left-radius"]))["border-top-left-radius"]).toBe(g)
    expect((await styles(page, "#tr", ["border-top-right-radius"]))["border-top-right-radius"]).toBe(g)
    expect((await styles(page, "#bl", ["border-bottom-left-radius"]))["border-bottom-left-radius"]).toBe(g)
    expect((await styles(page, "#br", ["border-bottom-right-radius"]))["border-bottom-right-radius"]).toBe(g)
    expect((await styles(page, "#tl", ["border-bottom-left-radius"]))["border-bottom-left-radius"]).toBe("0px")
    expect((await styles(page, "#tm", ["border-top-left-radius"]))["border-top-left-radius"]).toBe("0px")
    expect((await styles(page, "#ml", ["border-top-left-radius"]))["border-top-left-radius"]).toBe("0px")
  })
})

test.describe("frame ownership", () => {
  test("nested packed border (column > row): the inner row keeps its seams", async ({ page }) => {
    await mount(
      page,
      `<e-column packed border><e-row id="inner" packed border><span>a</span><span>b</span></e-row><span>c</span></e-column>`,
    )
    const inner = await styles(page, "#inner", ["background-color", "border-top-style"])
    const inner_border = await page.evaluate(() =>
      getComputedStyle(document.getElementById("inner")!).getPropertyValue("--e-current-border-color"),
    )
    expect(inner["border-top-style"]).toBe("none")
    expect(inner["background-color"]).toBe(await color(page, inner_border))
  })

  test("a packed bordered child of a [scroll] drops its outer border and radius, keeps its seams", async ({ page }) => {
    await mount(
      page,
      `<e-column scroll border style="height:100px"><e-grid id="g" columns="3" packed border>${row3()}</e-grid></e-column>`,
    )
    const g = await styles(page, "#g", ["border-top-width", "border-top-left-radius", "column-gap", "background-color"])
    expect(g["border-top-width"]).toBe("0px")
    expect(g["border-top-left-radius"]).toBe("0px")
    expect(g["column-gap"]).toBe("1px")
    expect(g["background-color"]).not.toBe("rgba(0, 0, 0, 0)")
  })

  test("outside a scroll area, the packed bordered grid keeps its border", async ({ page }) => {
    await mount(page, `<e-column><e-grid id="g" columns="3" packed border>${row3()}</e-grid></e-column>`)
    expect((await styles(page, "#g", ["border-top-width"]))["border-top-width"]).toBe("1px")
  })
})

test.describe("sticky", () => {
  const scroll_area = (inner: string) =>
    `<e-column id="sc" scroll="y" spacing="none" style="height:100px">${inner}</e-column>`

  test("sticky=top stays at the top edge and sticky=bottom at the bottom edge while scrolling", async ({ page }) => {
    const rows = Array.from({ length: 20 }, (_, i) => `<div style="height:30px">${i}</div>`).join("")
    await mount(
      page,
      scroll_area(
        `<e-row id="top" sticky="top"><span>head</span></e-row>${rows}<e-row id="bottom" sticky="bottom"><span>foot</span></e-row>`,
      ),
    )
    for (const st of [0, 150, 300]) {
      const res = await page.evaluate((st) => {
        const sc = document.getElementById("sc")!
        sc.scrollTop = st
        const s = sc.getBoundingClientRect()
        return {
          top: Math.round(document.getElementById("top")!.getBoundingClientRect().top - s.top),
          bottom: Math.round(s.bottom - document.getElementById("bottom")!.getBoundingClientRect().bottom),
        }
      }, st)
      expect(res).toEqual({ top: 0, bottom: 0 })
    }
    const top = await styles(page, "#top", ["position", "z-index", "background-color"])
    expect(top.position).toBe("sticky")
    expect(top["z-index"]).toBe("1")
    expect(top["background-color"]).not.toBe("rgba(0, 0, 0, 0)")
  })

  test("a sticky row of a packed bordered grid is opaque with the seam color, and stays sticky", async ({ page }) => {
    const rows = Array.from({ length: 10 }, () => row3()).join("")
    await mount(
      page,
      scroll_area(`<e-grid id="g" columns="3" packed border>${row3("head", 'sticky="top"')}${rows}</e-grid>`),
    )
    const g = await styles(page, "#g", ["background-color"])
    const head = await styles(page, "#head", ["position", "background-color"])
    expect(head.position).toBe("sticky")
    expect(head["background-color"]).toBe(g["background-color"])
    const offset = await page.evaluate(() => {
      const sc = document.getElementById("sc")!
      sc.scrollTop = 120
      return Math.round(document.getElementById("head")!.getBoundingClientRect().top - sc.getBoundingClientRect().top)
    })
    expect(offset).toBe(0)
  })

  test("a sticky cell of a packed container keeps position: sticky over packed's position: relative", async ({
    page,
  }) => {
    await mount(
      page,
      scroll_area(`<e-column packed><e-row id="s" sticky="top"><span>a</span></e-row><span>b</span></e-column>`),
    )
    expect((await styles(page, "#s", ["position"])).position).toBe("sticky")
  })
})

test.describe("scroll", () => {
  test("scroll, scroll=x, scroll=y set overflow and overscroll-behavior, on e-prose too", async ({ page }) => {
    await mount(
      page,
      `<e-column id="b" scroll></e-column><e-row id="x" scroll="x"></e-row><e-prose id="y" scroll="y"></e-prose>`,
    )
    const props = ["overflow-x", "overflow-y", "overscroll-behavior-x", "overscroll-behavior-y"]
    expect(await styles(page, "#b", props)).toEqual({
      "overflow-x": "auto",
      "overflow-y": "auto",
      "overscroll-behavior-x": "contain",
      "overscroll-behavior-y": "contain",
    })
    expect(await styles(page, "#x", props)).toEqual({
      "overflow-x": "auto",
      "overflow-y": "hidden",
      "overscroll-behavior-x": "contain",
      "overscroll-behavior-y": "contain",
    })
    expect(await styles(page, "#y", props)).toEqual({
      "overflow-x": "hidden",
      "overflow-y": "auto",
      "overscroll-behavior-x": "contain",
      "overscroll-behavior-y": "contain",
    })
  })

  test("a flex scroll area's children keep their size along the scrolled axis instead of shrinking", async ({
    page,
  }) => {
    const rows = Array.from({ length: 10 }, () => `<div class="r" style="height:30px"></div>`).join("")
    await mount(
      page,
      `<e-column id="col" scroll spacing="none" style="height:100px">${rows}</e-column>
       <e-row id="row" scroll="y" spacing="none" style="width:100px; height:50px">${rows.replaceAll("height:30px", "width:30px")}</e-row>`,
    )
    const res = await page.evaluate(() => ({
      col_child: document.querySelector("#col > .r")!.getBoundingClientRect().height,
      col_scroll: document.getElementById("col")!.scrollHeight,
      // A row scrolling vertically still shrinks its children horizontally to fit.
      row_child: document.querySelector("#row > .r")!.getBoundingClientRect().width,
    }))
    expect(res.col_child).toBe(30)
    expect(res.col_scroll).toBe(300)
    expect(res.row_child).toBe(10)
  })

  test("the UI reset turns off overscroll on the page itself", async ({ page }) => {
    expect(await styles(page, "html", ["overscroll-behavior-y"])).toEqual({ "overscroll-behavior-y": "none" })
    expect(await styles(page, "body", ["overscroll-behavior-y"])).toEqual({ "overscroll-behavior-y": "none" })
  })
})

test.describe("[align] on layout elements (regression: the legacy HTML align attribute centered their text)", () => {
  test("align sets align-items only: text keeps the parent's text-align", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append } = window.__ELT__
      const res: Record<string, string> = {}
      for (const tag of ["e-row", "e-column", "e-flex", "e-grid", "e-grid-row"]) {
        const el = document.createElement(tag)
        el.setAttribute("align", "center")
        node_append(document.body, el)
        res[tag] = getComputedStyle(el).textAlign
      }
      const centered = document.createElement("div")
      centered.style.textAlign = "right"
      const row = document.createElement("e-row")
      row.setAttribute("align", "center")
      centered.appendChild(row)
      node_append(document.body, centered)
      res.inherited = getComputedStyle(row).textAlign
      return res
    })
    expect(result).toEqual({
      "e-row": "start",
      "e-column": "start",
      "e-flex": "start",
      "e-grid": "start",
      "e-grid-row": "start",
      inherited: "right",
    })
  })
})
