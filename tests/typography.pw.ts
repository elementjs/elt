import { type Page, expect, test } from "./fixture"

// Inside <e-prose>, a run of typographic elements keeps its own rhythm, while non-typographic
// children (rows, columns, widgets) are spaced by the prose's `spacing` — padded or not. Where the
// two meet, margin collapsing keeps the larger of the two. See "Text runs" in docs/md/ui-typography.md.
test.describe("e-prose spacing between non-typographic children", () => {
  /** Builds `<e-prose {attrs}>{children}</e-prose>` and returns the vertical gap between each pair of
   * consecutive children, in px. */
  async function gaps(page: Page, attrs: Record<string, string>, tags: string[]) {
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

// A flex element directly inside an element that only accepts text can only be part of that text.
test("a flex element directly inside a text-only element is inline-flex; inside an element that accepts blocks it is not", async ({
  page,
}) => {
  const r = await page.evaluate(() => {
    const display = (parent: string) => {
      const host = document.createElement(parent)
      const row = document.createElement("e-row")
      host.appendChild(row)
      document.body.appendChild(host)
      return getComputedStyle(row).display
    }
    return {
      p: display("p"),
      h2: display("h2"),
      summary: display("summary"),
      li: display("li"),
      td: display("td"),
      blockquote: display("blockquote"),
    }
  })
  expect(r).toEqual({
    p: "inline-flex",
    h2: "inline-flex",
    summary: "inline-flex",
    li: "flex",
    td: "flex",
    blockquote: "flex",
  })
})

// Prose rhythm comes from prose containers (e-prose, article, blockquote, li, td, …), and only
// applies to their direct children. Appearance (heading sizes, …) applies everywhere.
test.describe("prose containers and text blocks", () => {
  /** Mounts `html` in a fresh host and returns `fn`'s result, evaluated in the page. */
  async function measure<T>(page: Page, html: string, fn: string) {
    return page.evaluate(
      ({ html, fn }) => {
        const host = document.createElement("div")
        host.innerHTML = html
        document.body.appendChild(host)
        return new Function("host", fn)(host)
      },
      { html, fn },
    ) as Promise<T>
  }
  const gap = `const [a, b] = host.querySelectorAll("[data-m]"); return Math.round(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom)`

  test("a text block directly in a column gets no margin; the column's gap spaces it", async ({ page }) => {
    const r = await measure<{ margin: string; gap: number }>(
      page,
      `<e-column><p data-m>a</p><p data-m>b</p></e-column>`,
      `const p = host.querySelector("p"); const [a, b] = host.querySelectorAll("p"); return { margin: getComputedStyle(p).marginBottom, gap: Math.round(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom) }`,
    )
    const component = await measure<number>(
      page,
      `<div style="height: var(--e-spacing-component)"></div>`,
      `return Math.round(host.firstElementChild.getBoundingClientRect().height)`,
    )
    expect(r.margin).toBe("0px")
    expect(r.gap).toBe(component)
  })

  test("any prose container gives the same paragraph rhythm as e-prose", async ({ page }) => {
    const prose = await measure<number>(page, `<e-prose><p data-m>a</p><p data-m>b</p></e-prose>`, gap)
    for (const tag of ["article", "blockquote", "li", "td"]) {
      const html =
        tag === "li"
          ? `<ul><li><p data-m>a</p><p data-m>b</p></li></ul>`
          : tag === "td"
            ? `<table><tr><td><p data-m>a</p><p data-m>b</p></td></tr></table>`
            : `<${tag}><p data-m>a</p><p data-m>b</p></${tag}>`
      expect(await measure<number>(page, html, gap), tag).toBe(prose)
    }
  })

  test("heading appearance applies outside prose containers", async ({ page }) => {
    const size = await measure<string>(
      page,
      `<e-column><h2>t</h2></e-column>`,
      `return getComputedStyle(host.querySelector("h2")).fontSize`,
    )
    const inProse = await measure<string>(
      page,
      `<e-prose><h2>t</h2></e-prose>`,
      `return getComputedStyle(host.querySelector("h2")).fontSize`,
    )
    expect(size).toBe(inProse)
    expect(size).not.toBe(
      await measure<string>(
        page,
        `<e-column><p>t</p></e-column>`,
        `return getComputedStyle(host.querySelector("p")).fontSize`,
      ),
    )
  })

  test("inline-level children of a prose container (a button in a cell) get no spacing margin", async ({ page }) => {
    const m = await measure<string>(
      page,
      `<table><tr><td>x <button>b</button> y</td></tr></table>`,
      `return getComputedStyle(host.querySelector("button")).marginTop`,
    )
    expect(m).toBe("0px")
  })

  test("a spaced child's margins use its container's step, not the step it sets for its own children", async ({
    page,
  }) => {
    const r = await measure<{ gap: number; section: number }>(
      page,
      `<e-prose spacing="section"><e-row data-m pad="widget" border>a</e-row><e-row data-m spacing="nudge-1">b</e-row></e-prose>`,
      `const [a, b] = host.querySelectorAll("[data-m]"); const probe = document.createElement("div"); probe.style.height = "var(--e-spacing-section)"; host.appendChild(probe); return { gap: Math.round(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom), section: Math.round(probe.getBoundingClientRect().height) }`,
    )
    expect(r.gap).toBe(r.section)
  })

  test('pad="none" on a prose container spaces nothing', async ({ page }) => {
    const g = await measure<number>(
      page,
      `<e-prose pad="none"><e-row data-m>a</e-row><e-row data-m>b</e-row></e-prose>`,
      gap,
    )
    expect(g).toBe(0)
  })

  test("a blockquote pads its content against its own background", async ({ page }) => {
    const r = await measure<{ pad: string; component: string }>(
      page,
      `<blockquote><p>q</p></blockquote><div style="width: var(--e-spacing-component)"></div>`,
      `return { pad: getComputedStyle(host.querySelector("blockquote")).paddingTop, component: getComputedStyle(host.querySelector("div")).width }`,
    )
    expect(r.pad).toBe(r.component)
  })

  // These used to be font-relative (0.15em, 0.25em 1.5em): they now read named steps, so they follow
  // the theme and no longer grow with the font size.
  test("a definition list and a fieldset's legend are spaced with named steps", async ({ page }) => {
    const r = await measure<Record<string, string>>(
      page,
      `<dl style="font-size: 40px"><dt>t</dt><dd>d</dd></dl><fieldset><legend>l</legend></fieldset><div></div>`,
      `const probe = host.querySelector("div")
       const step = (s) => { probe.style.width = "var(--e-spacing-" + s + ")"; return getComputedStyle(probe).width }
       const dl = getComputedStyle(host.querySelector("dl"))
       return {
         dt_top: getComputedStyle(host.querySelector("dt")).paddingBlockStart, nudge2: step("nudge-2"),
         row_gap: dl.rowGap, nudge4: step("nudge-4"), column_gap: dl.columnGap, section: step("section"),
         legend: getComputedStyle(host.querySelector("legend")).paddingLeft, widget: step("widget"),
       }`,
    )
    expect(r.dt_top).toBe(r.nudge2)
    expect(r.row_gap).toBe(r.nudge4)
    expect(r.column_gap).toBe(r.section)
    expect(r.legend).toBe(r.widget)
  })
})

/** Mounts `html` in a fresh host under the light theme and returns `fn(host)`'s result, evaluated in the page. */
async function mount<T>(page: Page, html: string, fn: string) {
  return page.evaluate(
    ({ html, fn }) => {
      document.body.className = String(window.__ELT__.UI.theme.class_light_scheme)
      const host = document.createElement("div")
      host.innerHTML = html
      document.body.appendChild(host)
      return new Function("host", fn)(host)
    },
    { html, fn },
  ) as Promise<T>
}

// Regression: @layer typography was missing from the layer order (ui/reset.css.tsx), so the browser
// put it last, above components: typography's zero-specificity rules won over every component rule.
test.describe("typography sits below components", () => {
  test("e-prose[inline] is inline-block", async ({ page }) => {
    const d = await mount<string>(
      page,
      `<p>a <e-prose inline>b</e-prose> c</p>`,
      `return getComputedStyle(host.querySelector("e-prose")).display`,
    )
    expect(d).toBe("inline-block")
  })

  test("a hovered link is underlined with a solid line (form.css), not typography's dotted one", async ({ page }) => {
    await mount(page, `<e-prose><p><a id="l" href="#nowhere">link</a></p></e-prose>`, `return 0`)
    await page.mouse.move(600, 600)
    expect(await page.$eval("#l", (a) => getComputedStyle(a).textDecorationStyle)).toBe("dotted")
    await page.hover("#l")
    expect(await page.$eval("#l", (a) => getComputedStyle(a).textDecorationStyle)).toBe("solid")
  })

  test("a control alone in a table cell still fills the cell, without its own border", async ({ page }) => {
    const r = await mount<{ border: string; pad: string }>(
      page,
      `<table><tr><td><button>b</button></td></tr></table>`,
      `return { border: getComputedStyle(host.querySelector("button")).borderTopStyle, pad: getComputedStyle(host.querySelector("td")).paddingTop }`,
    )
    expect(r).toEqual({ border: "none", pad: "0px" })
  })

  test("a bordered table-container keeps the theme's borderRadius", async ({ page }) => {
    const r = await mount<{ radius: string; ref: string }>(
      page,
      `<e-prose table-container border><table><tr><td>x</td></tr></table></e-prose><div id="ref"></div>`,
      `const ref = host.querySelector("#ref"); ref.style.borderRadius = window.__ELT__.UI.theme.settings.borderRadius;
       return { radius: getComputedStyle(host.querySelector("e-prose")).borderTopLeftRadius, ref: getComputedStyle(ref).borderTopLeftRadius }`,
    )
    expect(r.radius).toBe(r.ref)
  })

  // The visited color moved from typography to form.css: in typography it would now lose to form.css's
  // `a { color }`. getComputedStyle hides :visited styles on purpose and headless Chromium doesn't
  // paint them for test navigations, so this checks the rule itself: in the components layer, with
  // more specificity than `a` (a :visited selector), and tint.faded as its color.
  test("the visited link color is set in the components layer", async ({ page }) => {
    const r = await page.evaluate(() => {
      const found: string[] = []
      const walk = (rules: CSSRuleList, layer: string) => {
        for (const rule of rules) {
          const name = rule instanceof CSSLayerBlockRule ? rule.name : layer
          if (rule instanceof CSSStyleRule && rule.selectorText.includes(":visited")) {
            found.push(`${layer}|${rule.selectorText}|${rule.style.color}`)
          }
          if ("cssRules" in rule) walk((rule as CSSGroupingRule).cssRules, name)
        }
      }
      for (const sheet of document.adoptedStyleSheets) walk(sheet.cssRules, "")
      return { found, faded: window.__ELT__.UI.theme.colors.tint.faded.toString() }
    })
    expect(r.found).toEqual([`components|&:visited|${r.faded}`])
  })
})

// Regression: the rhythm rule used a descendant combinator, so a text block anywhere inside a prose
// container (a <main>, a <section>…) got typographic margins, even inside a row or a column.
test("prose margins apply to direct children only: a heading in a row in <main> gets none", async ({ page }) => {
  const r = await mount<{ h3: string; p: string; direct: string }>(
    page,
    `<main style="height:auto"><e-row><h3>t</h3></e-row><section><e-column><p>p</p></e-column></section><p id="d">d</p><p>e</p></main>`,
    `return { h3: getComputedStyle(host.querySelector("h3")).marginTop, p: getComputedStyle(host.querySelector("e-column p")).marginTop, direct: getComputedStyle(host.querySelector("#d")).marginBottom }`,
  )
  expect(r.h3).toBe("0px")
  expect(r.p).toBe("0px")
  expect(r.direct).not.toBe("0px")
})

test("code uses the theme's monospace font, like kbd", async ({ page }) => {
  const r = await mount<{ code: string; kbd: string }>(
    page,
    `<p><code>c</code> <kbd>k</kbd></p>`,
    `return { code: getComputedStyle(host.querySelector("code")).fontFamily, kbd: getComputedStyle(host.querySelector("kbd")).fontFamily }`,
  )
  expect(r.code).toBe(r.kbd)
})

// Theme values only (ui/AGENTS.md): the boxes of inline code, kbd and mark use named spacing steps,
// not em sizes, so a code in a heading has the same padding as one in a paragraph.
test("code, kbd and mark pad and round themselves with nudge steps, at any font size", async ({ page }) => {
  const r = await mount<Record<string, string[]>>(
    page,
    `<h1><code id="hc">c</code></h1><p><code id="pc">c</code> <kbd>k</kbd> <mark>m</mark></p>
     <div id="n2" style="width: var(--e-spacing-nudge-2)"></div><div id="n4" style="width: var(--e-spacing-nudge-4)"></div>`,
    `const cs = (s) => getComputedStyle(host.querySelector(s))
     const box = (s) => [cs(s).paddingTop, cs(s).paddingLeft, cs(s).borderTopLeftRadius]
     return { hc: box("#hc"), pc: box("#pc"), kbd: [cs("kbd").paddingTop, cs("kbd").paddingLeft], mark: [cs("mark").paddingLeft, cs("mark").borderTopLeftRadius], steps: [cs("#n2").width, cs("#n4").width] }`,
  )
  const [n2, n4] = r.steps
  expect(r.pc).toEqual([n2, n4, n4])
  expect(r.hc).toEqual(r.pc)
  expect(r.kbd).toEqual(["0px", n4])
  expect(r.mark).toEqual([n2, n2])
})

// The faded text (h6, blockquote, dd, figcaption) is the theme's text color made translucent. Inside an
// inverted band, which redefines the text color, it must fade the band's text color, not the page's,
// or it would be dark text on the tint fill.
test("faded text fades the text color of an inverted band it sits in", async ({ page }) => {
  const r = await mount<{ page: number[][]; band: number[][]; page_text: number[]; band_text: number[] }>(
    page,
    `<e-prose id="p"><h6>h</h6><blockquote>q</blockquote><dl><dt>t</dt><dd>d</dd></dl><figure><figcaption>c</figcaption></figure></e-prose>`,
    `const p = host.querySelector("#p")
     const band = p.cloneNode(true)
     band.className = String(window.__ELT__.UI.theme.colors.tint.class_as_inverted)
     host.appendChild(band)
     // A CSS color's sRGB channels without its alpha: paint one canvas pixel on a cleared (transparent)
     // canvas; getImageData returns the channels un-premultiplied, the alpha apart.
     const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
     const rgb = (css) => {
       ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1)
       return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)]
     }
     const faded = (root) => ["h6", "blockquote", "dd", "figcaption"].map((s) => rgb(getComputedStyle(root.querySelector(s)).color))
     return { page: faded(p), band: faded(band), page_text: rgb(getComputedStyle(p).color), band_text: rgb(getComputedStyle(band).color) }`,
  )
  expect(r.band_text).not.toEqual(r.page_text)
  // The translucent pixel loses precision once un-premultiplied: compare channels within 3 levels.
  const near = (a: number[], b: number[]) => a.every((c, i) => Math.abs(c - b[i]) <= 3)
  for (const c of r.page) expect(near(c, r.page_text), `${c} vs ${r.page_text}`).toBe(true)
  for (const c of r.band) expect(near(c, r.band_text), `${c} vs ${r.band_text}`).toBe(true)
})
