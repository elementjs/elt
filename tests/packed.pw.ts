import { type Page, expect, test } from "./fixture"

// The focus ring is a box-shadow: it is drawn, and none of the ancestors up to `container` cuts it
// (overflow, clip-path or paint containment clip what lies outside their padding box). A checkbox's
// ring is drawn around it, outside its box: the case a clipping container would hide.
async function ring_visible(page: Page, html: string) {
  await page.evaluate((html) => {
    document.body.innerHTML = html
    ;(document.querySelector("#focus") as HTMLElement).focus()
  }, html)
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))))
  const r = await page.evaluate(() => {
    const el = document.querySelector("#focus") as HTMLElement
    const shadow = getComputedStyle(el).boxShadow
    const inset = shadow.includes("inset")
    // "<color> 0px 0px 0px <spread>px": the last length is the spread
    const spread = Number.parseFloat(shadow.match(/(-?[\d.]+)px(?!.*px)/)?.[1] ?? "0")
    const out = inset ? 0 : spread
    const box = el.getBoundingClientRect()
    const ring = { top: box.top - out, left: box.left - out, bottom: box.bottom + out, right: box.right + out }
    const clipped: string[] = []
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a)
      const clips =
        cs.overflowX !== "visible" ||
        cs.overflowY !== "visible" ||
        cs.clipPath !== "none" ||
        /paint|strict|content/.test(cs.contain)
      if (!clips) continue
      const p = a.getBoundingClientRect()
      const bt = Number.parseFloat(cs.borderTopWidth)
      const bl = Number.parseFloat(cs.borderLeftWidth)
      const bb = Number.parseFloat(cs.borderBottomWidth)
      const br = Number.parseFloat(cs.borderRightWidth)
      if (ring.top < p.top + bt || ring.left < p.left + bl || ring.bottom > p.bottom - bb || ring.right > p.right - br)
        clipped.push(a.localName)
    }
    return { shadow, out, clipped, strip: { x: box.left, y: box.top - out, width: box.width, height: out } }
  })
  // What is painted just outside the box changes when the ring comes and goes.
  const focused = await page.screenshot({ clip: r.strip })
  await page.evaluate(() => (document.querySelector("#focus") as HTMLElement).blur())
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))))
  const blurred = await page.screenshot({ clip: r.strip })
  return { ...r, painted: !focused.equals(blurred) }
}

test.describe('packed seams="children": the children\'s own borders, never doubled (docs/md/ui-layout.md#packed)', () => {
  for (const tag of ["e-row", "e-column"] as const) {
    test(`${tag}: a bordered child drops its trailing edge, before a plain or a bordered sibling; a bordered next one keeps its leading edge`, async ({
      page,
    }) => {
      const r = await page.evaluate((tag) => {
        const [trail, lead] =
          tag === "e-row" ? ["borderRightStyle", "borderLeftStyle"] : ["borderBottomStyle", "borderTopStyle"]
        const make = (next: string) => {
          const c = document.createElement(tag)
          c.setAttribute("packed", "")
          c.setAttribute("seams", "children")
          const a = document.createElement("button")
          const b = document.createElement(next)
          c.append(a, b)
          document.body.appendChild(c)
          const st = (e: Element) => getComputedStyle(e) as unknown as Record<string, string>
          return { a_trail: st(a)[trail], b_lead: st(b)[lead] }
        }
        return { before_plain: make("div").a_trail, before_bordered: make("button") }
      }, tag)
      expect(r.before_plain).toBe("none")
      expect(r.before_bordered).toEqual({ a_trail: "none", b_lead: "solid" })
    })
  }

  // A child whose border carries meaning (ui/selectors.ts MEANINGFUL_BORDER_SELECTOR) owns the line it
  // shares with the next child: it keeps its trailing edge and the next child drops its leading one.
  test("row: a checked toggle keeps its trailing edge; the plain neighbour after it drops its leading one", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-row id="r" packed seams="children"><button>a</button><label e-widget="toggle"><input type="checkbox" checked>b</label><button>c</button></e-row>`,
      )
      const [a, b, c] = [...document.getElementById("r")!.children].map((e) => getComputedStyle(e))
      return {
        a_right: a.borderRightStyle,
        b_left: b.borderLeftStyle,
        b_right: b.borderRightStyle,
        c_left: c.borderLeftStyle,
      }
    })
    // Before the toggle: the plain button drops its trailing edge, the toggle's leading edge shows.
    expect(r.a_right).toBe("none")
    expect(r.b_left).toBe("solid")
    // After it: the toggle's trailing edge shows, the plain button's leading edge goes.
    expect(r.b_right).toBe("solid")
    expect(r.c_left).toBe("none")
  })

  test("column: a selected item keeps its bottom edge; the next one drops its top edge", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-column id="c" packed seams="children"><button aria-selected="true">a</button><button>b</button></e-column>`,
      )
      const [a, b] = [...document.getElementById("c")!.children].map((e) => getComputedStyle(e))
      return { a_bottom: a.borderBottomStyle, b_top: b.borderTopStyle }
    })
    expect(r.a_bottom).toBe("solid")
    expect(r.b_top).toBe("none")
  })

  test("row: a disabled tint button is furniture: it gives up its trailing edge like a plain one", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-row id="r" packed seams="children"><button e-emphasis="tint" disabled>a</button><button>b</button></e-row>`,
      )
      const [a, b] = [...document.getElementById("r")!.children].map((e) => getComputedStyle(e))
      return { a_right: a.borderRightStyle, b_left: b.borderLeftStyle }
    })
    expect(r.a_right).toBe("none")
    expect(r.b_left).toBe("solid")
  })

  test("two packed toggle-icon labels still dedup correctly with no BORDERED_SELECTOR lookup", async ({ page }) => {
    const [aRight, bLeft] = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("seams", "children")
      const a = document.createElement("label")
      a.setAttribute("e-widget", "toggle")
      a.innerHTML = '<input type="checkbox">'
      const b = document.createElement("label")
      b.setAttribute("e-widget", "toggle")
      b.innerHTML = '<input type="checkbox">'
      row.append(a, b)
      document.body.appendChild(row)
      return [getComputedStyle(a).borderRightStyle, getComputedStyle(b).borderLeftStyle]
    })
    expect(aRight).toBe("none")
    expect(bLeft).toBe("solid")
  })

  test("interior corner radii are zeroed regardless of border presence, outer corners untouched — unchanged by the border-ownership rework", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("seams", "children")
      const a = document.createElement("e-prose")
      const b = document.createElement("e-prose")
      a.setAttribute("border", "")
      a.setAttribute("radius", "")
      b.setAttribute("border", "")
      b.setAttribute("radius", "")
      row.append(a, b)
      document.body.appendChild(row)
      const sa = getComputedStyle(a)
      const sb = getComputedStyle(b)
      return {
        aTopRight: sa.borderTopRightRadius,
        aBottomRight: sa.borderBottomRightRadius,
        aTopLeft: sa.borderTopLeftRadius,
        bTopLeft: sb.borderTopLeftRadius,
        bBottomLeft: sb.borderBottomLeftRadius,
        bBottomRight: sb.borderBottomRightRadius,
      }
    })
    expect(result.aTopRight).toBe("0px")
    expect(result.aBottomRight).toBe("0px")
    expect(result.bTopLeft).toBe("0px")
    expect(result.bBottomLeft).toBe("0px")
    // outer corners keep their real radius (nonzero — the exact value is the spacing-widget step)
    expect(result.aTopLeft).not.toBe("0px")
    expect(result.bBottomRight).not.toBe("0px")
  })
})

test.describe("packed[border] (docs/md/ui-layout.md)", () => {
  test("packed[border] draws a frame and no gap: the lines between children are the children's own borders", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-row id="r" packed border><button>a</button><button>b</button><button>c</button></e-row>`,
      )
      const row = document.getElementById("r")!
      const sty = (e: Element) => getComputedStyle(e)
      const probe = document.createElement("div")
      probe.style.backgroundColor = "var(--e-seam-color)"
      row.appendChild(probe)
      const seam = sty(probe).backgroundColor
      probe.remove()
      const [a, b, c] = [...row.children].map(sty)
      return {
        frame: sty(row).borderTopStyle,
        gap: sty(row).columnGap,
        seam,
        a: [a.borderLeftStyle, a.borderRightStyle],
        b: [b.borderLeftStyle, b.borderRightStyle, b.borderLeftColor, b.borderLeftWidth],
        c: [c.borderLeftStyle, c.borderRightStyle],
        across: [a.borderTopStyle, a.borderBottomStyle, b.borderTopStyle, c.borderBottomStyle],
      }
    })
    expect(r.frame).toBe("solid")
    expect(r.gap).toBe("normal")
    // The frame wins the outline; the line between two children is the leading edge of the second.
    expect(r.a).toEqual(["none", "none"])
    expect(r.b.slice(0, 2)).toEqual(["solid", "none"])
    expect(r.b[2]).toBe(r.seam)
    expect(r.b[3]).toBe("1px")
    expect(r.c).toEqual(["solid", "none"])
    expect(r.across).toEqual(["none", "none", "none", "none"])
  })

  test("packed[border] children get the current-surface background by default", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("border", "")
      const a = document.createElement("button")
      row.append(a)
      document.body.appendChild(row)
      const ref = document.createElement("div")
      ref.style.backgroundColor = theme.colors.bg.toString()
      document.body.appendChild(ref)
      return { a: getComputedStyle(a).backgroundColor, ref: getComputedStyle(ref).backgroundColor }
    })
    expect(result.a).toBe(result.ref)
  })

  test("packed[border] packs toggles like any child (regression: :has() out-ranked packed and kept the unchecked toggle's border)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const toggle = (checked: boolean) =>
        `<label e-widget="toggle"><input type="checkbox"${checked ? " checked" : ""}>Aa</label>`
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-row id="packed" surface="neutral-1" packed border><button>b</button>${toggle(false)}${toggle(true)}</e-row>
         <e-row id="loose">${toggle(false)}${toggle(true)}</e-row>`,
      )
      const st = (sel: string) => {
        const s = getComputedStyle(document.querySelector(sel)!)
        return { border: s.borderTopStyle, bg: s.backgroundColor }
      }
      return {
        button: st("#packed > button"),
        off: st("#packed > label:nth-of-type(1)"),
        on: st("#packed > label:nth-of-type(2)"),
        loose_off: st("#loose > label:nth-of-type(1)"),
        loose_on: st("#loose > label:nth-of-type(2)"),
        // The checked fill is tint + 3 relative to where the toggle sits (the group's level here).
        on_ref: (() => {
          const ref = document.createElement("div")
          ref.style.backgroundColor = window.__ELT__.UI.theme.colors.tint.surface("n+3")
          document.querySelector("#packed")!.appendChild(ref)
          const bg = getComputedStyle(ref).backgroundColor
          ref.remove()
          return bg
        })(),
      }
    })
    // Packed: no border of their own; unchecked on the group's surface, like the button; checked
    // keeps its fill (tint + 3 from the group's level, docs/md/ui-theme.md, Emphasis).
    expect(result.off.border).toBe("none")
    expect(result.on.border).toBe("none")
    expect(result.off.bg).toBe(result.button.bg)
    expect(result.on.bg).not.toBe(result.button.bg)
    expect(result.on.bg).toBe(result.on_ref)
    // Outside a packed group, the unchecked toggle keeps its own border.
    expect(result.loose_off.border).toBe("solid")
  })

  test("packed[border] children have border: none on every side, even a child that itself carries [border]", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("border", "")
      const a = document.createElement("e-prose")
      a.setAttribute("border", "tint")
      row.append(a)
      document.body.appendChild(row)
      const s = getComputedStyle(a)
      return [s.borderTopStyle, s.borderRightStyle, s.borderBottomStyle, s.borderLeftStyle]
    })
    expect(result).toEqual(["none", "none", "none", "none"])
  })

  test("packed[border]'s own radius is inherited by the first/last child's outer corners, not whatever radius they'd resolve to on their own", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("border", "")
      row.setAttribute("radius", "section")
      row.setAttribute("pad", "none")
      // buttons carry a fixed "widget"-step radius of their own (ui/form.css.tsx), unrelated to
      // the container's radius — the exact mismatch this rule exists to correct.
      const a = document.createElement("button")
      const b = document.createElement("button")
      const c = document.createElement("button")
      row.append(a, b, c)
      document.body.appendChild(row)
      const rowRadius = getComputedStyle(row).borderTopLeftRadius
      const sa = getComputedStyle(a)
      const sc = getComputedStyle(c)
      const sb = getComputedStyle(b)
      return {
        rowRadius,
        aLeading: [sa.borderTopLeftRadius, sa.borderBottomLeftRadius],
        aTrailing: sa.borderTopRightRadius,
        cTrailing: [sc.borderTopRightRadius, sc.borderBottomRightRadius],
        cLeading: sc.borderTopLeftRadius,
        bAll: [sb.borderTopLeftRadius, sb.borderTopRightRadius, sb.borderBottomLeftRadius, sb.borderBottomRightRadius],
      }
    })
    expect(result.aLeading).toEqual([result.rowRadius, result.rowRadius])
    expect(result.aTrailing).toBe("0px")
    expect(result.cTrailing).toEqual([result.rowRadius, result.rowRadius])
    expect(result.cLeading).toBe("0px")
    expect(result.bAll).toEqual(["0px", "0px", "0px", "0px"])
  })

  test("packed[radius] WITHOUT its own border also owns the first/last child's outer corners", async ({ page }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      row.setAttribute("radius", "section")
      const a = document.createElement("button")
      const b = document.createElement("button")
      row.append(a, b)
      document.body.appendChild(row)
      const rowRadius = getComputedStyle(row).borderTopLeftRadius
      const sa = getComputedStyle(a)
      const sb = getComputedStyle(b)
      return {
        rowRadius,
        aLeading: [sa.borderTopLeftRadius, sa.borderBottomLeftRadius],
        bTrailing: [sb.borderTopRightRadius, sb.borderBottomRightRadius],
      }
    })
    expect(result.aLeading).toEqual([result.rowRadius, result.rowRadius])
    expect(result.bTrailing).toEqual([result.rowRadius, result.rowRadius])
  })

  test("plain packed — no [border], no [radius] on the container — leaves each child's own radius untouched at the outer edges", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("packed", "")
      const a = document.createElement("e-prose")
      a.setAttribute("border", "")
      a.setAttribute("radius", "")
      const b = document.createElement("e-prose")
      b.setAttribute("border", "")
      b.setAttribute("radius", "")
      row.append(a, b)
      document.body.appendChild(row)
      const sa = getComputedStyle(a)
      const sb = getComputedStyle(b)
      return { aLeading: sa.borderTopLeftRadius, bTrailing: sb.borderTopRightRadius }
    })
    expect(result.aLeading).not.toBe("0px")
    expect(result.bTrailing).not.toBe("0px")
  })
})

test.describe("theme.css_radius own-pad vs default priority (docs/md/ui-layout.md)", () => {
  test("falls back to widget when the element has no [pad] of its own, whatever [spacing] or [pad] sit around it", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      const outer = document.createElement("e-row")
      outer.setAttribute("spacing", "section")
      outer.setAttribute("pad", "section")
      const el = document.createElement("e-prose")
      el.setAttribute("radius", "")
      outer.append(el)
      document.body.appendChild(outer)
      const ref = document.createElement("div")
      ref.style.borderRadius = theme.settings.spacingWidget
      document.body.appendChild(ref)
      return { radius: getComputedStyle(el).borderTopLeftRadius, ref: getComputedStyle(ref).borderTopLeftRadius }
    })
    expect(result.radius).toBe(result.ref)
  })
})

// packed[border], [surface] and [border] used to set overflow: hidden, which cut the focus ring of a
// child that touches their edge (docs/md/ui-layout.md, docs/md/ui-theme.md).
test.describe("packed[border], [surface] and [border] don't clip their children", () => {
  test("none of them sets overflow", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.innerHTML = `<e-row id="a" packed border></e-row><e-prose id="b" surface></e-prose><e-prose id="c" border></e-prose>`
      return ["a", "b", "c"].map((id) => getComputedStyle(document.getElementById(id)!).overflowX)
    })
    expect(r).toEqual(["visible", "visible", "visible"])
  })

  for (const [name, html] of [
    ["packed[border]", `<e-row packed border><input id="focus" type="checkbox" /></e-row>`],
    ["[surface]", `<e-prose surface pad="none"><input id="focus" type="checkbox" /></e-prose>`],
  ]) {
    test(`a focus ring inside ${name}, at its edge, is drawn and not clipped`, async ({ page }) => {
      const r = await ring_visible(page, html)
      expect(r.shadow).not.toBe("none")
      expect(r.out).toBeGreaterThan(0)
      expect(r.clipped).toEqual([])
      expect(r.painted).toBe(true)
    })
  }
})

// packed pads the children that don't set their own [pad]; a child's own [pad] always wins, whatever
// the order of the rules in the stylesheet.
test.describe("packed and a child's own pad", () => {
  for (const packed of ["", "widget", "section"]) {
    test(`packed="${packed}": a child with pad="component" keeps it, a child without pad gets packed's`, async ({
      page,
    }) => {
      const r = await page.evaluate((packed) => {
        const col = document.createElement("e-column")
        col.setAttribute("packed", packed)
        col.setAttribute("pad", "nudge-4")
        const own = document.createElement("e-row")
        own.setAttribute("pad", "component")
        const plain = document.createElement("e-row")
        col.append(own, plain)
        document.body.appendChild(col)
        const probe = (step: string) => {
          const d = document.createElement("div")
          d.style.width = `var(--e-spacing-${step})`
          document.body.appendChild(d)
          return `${d.getBoundingClientRect().width}px`
        }
        return {
          own: getComputedStyle(own).paddingTop,
          plain: getComputedStyle(plain).paddingTop,
          component: probe("component"),
          expected_plain: probe(packed === "" ? "nudge-4" : packed),
        }
      }, packed)
      expect(r.own).toBe(r.component)
      expect(r.plain).toBe(r.expected_plain)
    })
  }
})

// `seams`: who draws the lines between the children of a packed container. Each child is reported as
// its four edges, top right bottom left, "s" for a solid border and "n" for none.
test.describe("packed seams (docs/md/ui-layout.md#packed)", () => {
  const edges = (page: Page, html: string, sel: string) =>
    page.evaluate(
      ([html, sel]) => {
        document.body.innerHTML = html
        return [...document.querySelectorAll(sel)].map((e) => {
          const st = getComputedStyle(e)
          return [st.borderTopStyle, st.borderRightStyle, st.borderBottomStyle, st.borderLeftStyle]
            .map((v) => (v === "none" ? "n" : "s"))
            .join("")
        })
      },
      [html, sel],
    )
  const color = (page: Page, sel: string, side: "Top" | "Left") =>
    page.evaluate(
      ([sel, side]) =>
        (getComputedStyle(document.querySelector(sel)!) as unknown as Record<string, string>)[`border${side}Color`],
      [sel, side],
    )
  const token = (page: Page, expr: string, sel: string) =>
    page.evaluate(
      ([expr, sel]) => {
        const probe = document.createElement("div")
        probe.style.backgroundColor = expr
        document.querySelector(sel)!.appendChild(probe)
        const c = getComputedStyle(probe).backgroundColor
        probe.remove()
        return c
      },
      [expr, sel],
    )

  test("none: the frame stays, every child's border goes, nothing is drawn between them", async ({ page }) => {
    const kids = await edges(
      page,
      `<e-column id="c" packed border seams="none"><button>a</button><button>b</button></e-column>`,
      "#c > button",
    )
    expect(kids).toEqual(["nnnn", "nnnn"])
    const frame = await page.evaluate(() => getComputedStyle(document.getElementById("c")!).borderTopStyle)
    expect(frame).toBe("solid")
  })

  test("default: a line between every two children, the leading edge of the second", async ({ page }) => {
    // A div has no border: the line is drawn all the same. Without a frame the buttons draw the outline
    // (top and bottom, the first one's leading edge, the last one's trailing edge) with their own borders.
    const kids = await edges(
      page,
      `<e-row id="r" packed seams="default"><button>a</button><div>b</div><button>c</button></e-row>`,
      "#r > *",
    )
    expect(kids).toEqual(["snss", "nnns", "ssss"])
    expect(await color(page, "#r > div", "Left")).toBe(await token(page, "var(--e-seam-color)", "#r"))
  })

  test("without seams: a frame asks for the container's lines, no frame leaves the children their borders", async ({
    page,
  }) => {
    const kids = (border: string) =>
      edges(page, `<e-row id="r" packed ${border}><button>a</button><div>b</div><button>c</button></e-row>`, "#r > *")
    // No frame (or border="none"): `children`, the container draws nothing; a shared line is drawn once.
    expect(await kids("")).toEqual(["snss", "nnnn", "ssss"])
    expect(await kids('border="none"')).toEqual(["nnnn", "nnnn", "nnns"])
    // A frame: `default`, a line between every two children, none on the frame's outline.
    expect(await kids("border")).toEqual(["nnnn", "nnns", "nnns"])
    // Nested groups follow the outermost container.
    const nested = (border: string) =>
      edges(
        page,
        `<e-column id="c" packed ${border}><e-row id="g" packed><button>a</button><button>b</button></e-row></e-column>`,
        "#g > *",
      )
    expect(await nested("")).toEqual(["snss", "ssss"])
    expect(await nested("border")).toEqual(["nnnn", "nnns"])
  })

  test("without seam-color, the lines are the frame's color; neutral-separator without a frame", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.innerHTML = `
        <e-row id="a" packed border><button>x</button></e-row>
        <e-row id="b" packed border="tint-3"><button>x</button></e-row>
        <e-row id="c" packed border seam-color="neutral-separator"><button>x</button></e-row>
        <e-row id="d" packed border="none"><button>x</button></e-row>
        <e-row id="e" packed><button>x</button></e-row>
        <e-column id="f" packed border="tint-3"><e-row id="g" packed><button>x</button></e-row></e-column>`
      const bg = (id: string, expr: string) => {
        const probe = document.createElement("div")
        probe.style.backgroundColor = expr
        document.getElementById(id)!.appendChild(probe)
        const c = getComputedStyle(probe).backgroundColor
        probe.remove()
        return c
      }
      const border = (id: string) => getComputedStyle(document.getElementById(id)!).borderTopColor
      const seam = (id: string) => bg(id, "var(--e-seam-color)")
      return {
        bare: [seam("a"), border("a")],
        tint: [seam("b"), border("b")],
        separator: [seam("c"), seam("d"), seam("e"), border("a")],
        nested: [seam("g"), border("f")],
      }
    })
    expect(r.bare[0]).toBe(r.bare[1])
    expect(r.tint[0]).toBe(r.tint[1])
    // neutral-separator is the color of border="neutral-separator"-style lines: the same without a frame, and lighter than the frame.
    expect(r.separator[0]).toBe(r.separator[1])
    expect(r.separator[0]).toBe(r.separator[2])
    expect(r.separator[0]).not.toBe(r.separator[3])
    expect(r.nested[0]).toBe(r.nested[1])
  })

  test("default: the seam color is neutral-separator, two levels above the ambient surface", async ({ page }) => {
    await edges(page, `<e-row id="r" packed><button>a</button><button>b</button></e-row>`, "#r > *")
    expect(await token(page, "var(--e-seam-color)", "#r")).toBe(
      await page.evaluate(() => {
        const probe = document.createElement("div")
        probe.style.backgroundColor = window.__ELT__.UI.theme.colors.neutral.surface("n+2")
        document.getElementById("r")!.appendChild(probe)
        return getComputedStyle(probe).backgroundColor
      }),
    )
  })

  test("default: a child whose border carries meaning keeps the edges it shares; the neighbour gives up its own", async ({
    page,
  }) => {
    const kids = await edges(
      page,
      `<e-row id="r" packed><button>a</button><button e-emphasis="tint">b</button><button>c</button><button>d</button></e-row>`,
      "#r > *",
    )
    // b keeps all of its own edges (the shared ones are its to draw); c, right after it, gives up its
    // leading edge; a and d keep the outline.
    expect(kids).toEqual(["snss", "ssss", "snsn", "ssss"])
  })

  test("a layout element with its own border is important (children and default modes), a packed group is not", async ({
    page,
  }) => {
    // seams="children": the bordered layout element keeps the line it shares, the next one drops its own.
    const kids = await edges(
      page,
      `<e-row id="r" packed seams="children"><e-prose border>a</e-prose><e-prose border>b</e-prose></e-row>`,
      "#r > *",
    )
    expect(kids[0][1]).toBe("s")
    expect(kids[1][3]).toBe("n")
    const kids_default = await edges(
      page,
      `<e-column id="c" packed seams="default"><button>a</button><e-prose border>b</e-prose><button>c</button><e-row packed border><button>d</button></e-row></e-column>`,
      "#c > *",
    )
    // b keeps its own edges (it shares top and bottom); c gives up its top; the group is a plain cell: its
    // own border is ignored, the container draws the line above it.
    expect(kids_default).toEqual(["ssns", "ssss", "nsns", "snnn"])
  })

  for (const seams of ["children", "default"]) {
    test(`${seams}: two important children side by side share one line, the first one's`, async ({ page }) => {
      const kids = await edges(
        page,
        `<e-row id="r" packed seams="${seams}"><button aria-pressed="true">a</button><button e-emphasis="tint">b</button></e-row>`,
        "#r > *",
      )
      // a keeps the line it shares (its trailing edge); b gives up its leading edge.
      expect(kids[0][1]).toBe("s")
      expect(kids[1][3]).toBe("n")
      // and keeps the rest
      if (seams === "default") expect(kids).toEqual(["ssss", "sssn"])
    })
  }

  test("forced: the container's line everywhere, important children included", async ({ page }) => {
    const kids = await edges(
      page,
      `<e-row id="r" packed seams="forced"><button>a</button><button e-emphasis="tint">b</button><button aria-invalid="true">c</button></e-row>`,
      "#r > *",
    )
    expect(kids).toEqual(["snss", "snss", "ssss"])
  })

  test("with a frame, the children's edges on its outline go in every mode, an important child's too", async ({
    page,
  }) => {
    for (const seams of ["default", "forced", "none", "children"]) {
      const kids = await edges(
        page,
        `<e-row id="r" packed border seams="${seams}"><button e-emphasis="tint">a</button><button e-emphasis="tint">b</button></e-row>`,
        "#r > *",
      )
      // Top, bottom, the first one's leading edge and the last one's trailing edge: never drawn.
      expect(kids[0][0]).toBe("n")
      expect(kids[0][2]).toBe("n")
      expect(kids[0][3]).toBe("n")
      expect(kids[1][0]).toBe("n")
      expect(kids[1][1]).toBe("n")
      expect(kids[1][2]).toBe("n")
    }
  })

  test("seam-color changes the color of the lines the container draws", async ({ page }) => {
    await edges(
      page,
      `<e-row id="r" packed seams="default" seam-color="tint-3"><button>a</button><button>b</button></e-row>`,
      "#r > *",
    )
    const ref = await page.evaluate(() => {
      const probe = document.createElement("div")
      probe.style.backgroundColor = window.__ELT__.UI.theme.colors.tint.surface(3)
      document.getElementById("r")!.appendChild(probe)
      return getComputedStyle(probe).backgroundColor
    })
    expect(await color(page, "#r > button:nth-child(2)", "Left")).toBe(ref)
  })

  test("a nested group inherits the mode and the color, and can set its own", async ({ page }) => {
    const html = `
      <e-column id="c" packed seams="forced" seam-color="tint-3">
        <e-row id="g1" packed><button e-emphasis="tint">a</button><button>b</button></e-row>
        <e-row id="g2" packed seams="none"><button>c</button><button>d</button></e-row>
      </e-column>`
    // g1 inherits forced: the tint button gets the plain line; g2 draws none between its own children.
    // The edge between g1 and g2 is the container's, not theirs; the rest is the outline, which they draw.
    expect(await edges(page, html, "#g1 > *")).toEqual(["snns", "ssns"])
    expect(await edges(page, html, "#g2 > *")).toEqual(["nnss", "nssn"])
    const tint3 = await page.evaluate(() => {
      const probe = document.createElement("div")
      probe.style.backgroundColor = window.__ELT__.UI.theme.colors.tint.surface(3)
      document.body.appendChild(probe)
      return getComputedStyle(probe).backgroundColor
    })
    expect(await color(page, "#g1 > button:nth-child(2)", "Left")).toBe(tint3)
  })

  test("a non-packed element in between breaks the inheritance", async ({ page }) => {
    const html = `
      <e-column packed seams="none">
        <div><e-row id="g" packed><button>a</button><button>b</button></e-row></div>
      </e-column>`
    expect(await edges(page, html, "#g > *")).toEqual(["snss", "ssss"])
  })

  test('without a frame, the children draw the outline in every mode; border="none" has them draw nothing', async ({
    page,
  }) => {
    for (const seams of ["default", "forced", "none", "children"]) {
      const html = (border: string) =>
        `<e-row id="r" packed ${border} seams="${seams}"><button>a</button><button>b</button></e-row>`
      const [a, b] = await edges(page, html(""), "#r > *")
      // Top and bottom of both, the first one's leading edge, the last one's trailing edge; the edges between them
      // are the lines' business (`none` draws none).
      expect([a[0], a[2], a[3], b[0], b[1], b[2]]).toEqual(Array(6).fill("s"))
      expect(a[1]).toBe("n")
      expect(b[3]).toBe(seams === "none" ? "n" : "s")
      // border="none": no frame and no outline, only what is between the children.
      expect(await edges(page, html('border="none"'), "#r > *")).toEqual(["nnnn", seams === "none" ? "nnnn" : "nnns"])
    }
  })

  test("a group is a cell of its container: the line around it is the container's, its children draw only theirs", async ({
    page,
  }) => {
    const html = `
      <e-column id="c" packed border>
        <e-row id="r1" packed border><button>a</button><button>b</button></e-row>
        <e-row id="r2" packed><button>c</button><button>d</button></e-row>
      </e-column>`
    // The group's own border is ignored (the container's frame is the only one); the second row draws the line above it.
    expect(await edges(page, html, "#c > *")).toEqual(["nnnn", "snnn"])
    // Their children: nothing across, nothing on the group's outline, one line between them.
    expect(await edges(page, html, "#r1 > *")).toEqual(["nnnn", "nnns"])
    expect(await edges(page, html, "#r2 > *")).toEqual(["nnnn", "nnns"])
  })

  test("without a frame, a group among the cells draws the outline where it touches it, and only there", async ({
    page,
  }) => {
    const html = (seams: string) => `
      <e-column id="c" packed seams="${seams}">
        <e-row id="g1" packed><button>a</button><button>b</button></e-row>
        <e-row id="g2" packed><button>c</button><button>d</button></e-row>
      </e-column>`
    // The line between g1 and g2 is the container's (g2's top edge): g2's buttons don't draw it again.
    expect(await edges(page, html("default"), "#g1 > *")).toEqual(["snns", "ssns"])
    expect(await edges(page, html("default"), "#g2 > *")).toEqual(["nnss", "nsss"])
    // With `children` it is the leading edge of the second group's buttons.
    expect(await edges(page, html("children"), "#g1 > *")).toEqual(["snns", "ssns"])
    expect(await edges(page, html("children"), "#g2 > *")).toEqual(["snss", "ssss"])
  })

  test('border="none" on the container: a group among the cells draws no outline either', async ({ page }) => {
    const html = `
      <e-column id="c" packed border="none">
        <e-row id="g1" packed><button>a</button><button>b</button></e-row>
      </e-column>`
    expect(await edges(page, html, "#g1 > *")).toEqual(["nnnn", "nnns"])
  })

  test('border="none" draws no border and implies no radius', async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.innerHTML = `<e-row id="r" border="none" packed><button>a</button></e-row><e-row id="b" border><span>x</span></e-row>`
      const st = (id: string) => getComputedStyle(document.getElementById(id)!)
      return {
        none: [st("r").borderTopStyle, st("r").borderTopLeftRadius],
        bare: [st("b").borderTopStyle, st("b").borderTopLeftRadius],
      }
    })
    expect(r.none).toEqual(["none", "0px"])
    expect(r.bare[0]).toBe("solid")
    expect(r.bare[1]).not.toBe("0px")
  })

  test("grid without a frame: the cells on its outline keep their borders", async ({ page }) => {
    const html = `
      <e-grid id="g" columns="2" packed seams="default">
        <e-grid-row id="r1"><button>a</button><button>b</button></e-grid-row>
        <e-grid-row id="r2"><button>c</button><button>d</button></e-grid-row>
      </e-grid>`
    expect(await edges(page, html, "#r1 > *")).toEqual(["snns", "ssns"])
    expect(await edges(page, html, "#r2 > *")).toEqual(["nnss", "nsss"])
  })

  test("children: a group inside keeps its own border", async ({ page }) => {
    const kids = await edges(
      page,
      `<e-column id="c" packed seams="children"><e-row packed border><button>a</button></e-row><button>b</button></e-column>`,
      "#c > *",
    )
    // The group is a child like another: it gives up its trailing edge to the next one.
    expect(kids).toEqual(["ssns", "ssss"])
  })

  test("grid: the second row draws the line above it, a row's cells the line between them", async ({ page }) => {
    const html = `
      <e-grid id="g" columns="2" packed border>
        <e-grid-row id="r1"><button>a</button><button>b</button></e-grid-row>
        <e-grid-row id="r2"><button>c</button><button>d</button></e-grid-row>
      </e-grid>`
    expect(await edges(page, html, "#g > e-grid-row")).toEqual(["nnnn", "snnn"])
    expect(await edges(page, html, "#r1 > *")).toEqual(["nnnn", "nnns"])
    expect(await edges(page, html, "#r2 > *")).toEqual(["nnnn", "nnns"])
  })

  test("grid: the rows are one box each, the lines don't change the column tracks", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.innerHTML = `
        <e-grid id="g" columns="2" packed border style="width: 300px">
          <e-grid-row><span>a</span><span>b</span></e-grid-row>
          <e-grid-row><span>c</span><span>d</span></e-grid-row>
        </e-grid>`
      const x = (e: Element) => Math.round(e.getBoundingClientRect().left)
      const [a, b, c, d] = [...document.querySelectorAll("#g span")]
      return { aligned: x(a) === x(c) && x(b) === x(d), widths: [a, b].map((e) => e.getBoundingClientRect().width) }
    })
    expect(r.aligned).toBe(true)
  })

  test("a sticky=top header carries a copy of the line under it, over the next row's top edge", async ({ page }) => {
    const html = `
      <e-column id="c" packed border>
        <e-row sticky="top" packed><b>h</b></e-row>
        <e-row><span>a</span></e-row>
      </e-column>`
    expect(await edges(page, html, "#c > *")).toEqual(["nnsn", "snnn"])
    const margin = await page.evaluate(() => getComputedStyle(document.querySelector("#c > [sticky]")!).marginBottom)
    expect(margin).toBe("-1px")
  })

  for (const [name, html] of [
    [
      "column",
      `<e-column id="c" packed="widget" border seams="none" align="stretch" style="width: 200px"><button>a</button><hr /><button>b</button></e-column>`,
    ],
    [
      "grid",
      `<e-grid id="c" packed="widget" border seams="none" style="width: 300px; grid-template-columns: auto 1fr auto"><button style="grid-column: 1 / -1">a</button><hr /><button style="grid-column: 1 / -1">b</button></e-grid>`,
    ],
  ]) {
    test(`<hr> in a packed ${name} is an unpadded 1px divider across it, in the seam color (its top border)`, async ({
      page,
    }) => {
      const r = await page.evaluate((html) => {
        document.body.innerHTML = html
        const c = document.getElementById("c")!
        const hr = c.querySelector("hr")!
        const box = hr.getBoundingClientRect()
        const cs = getComputedStyle(hr)
        const probe = document.createElement("div")
        probe.style.backgroundColor = "var(--e-seam-color)"
        c.appendChild(probe)
        const seam = getComputedStyle(probe).backgroundColor
        probe.remove()
        return {
          height: box.height,
          width: box.width,
          inner: c.clientWidth,
          pad: cs.paddingTop,
          margin: cs.marginTop,
          // the line is the hr's own top border on a zero-height box
          color: cs.borderTopColor,
          seam,
        }
      }, html)
      expect(r.height).toBe(1)
      expect(r.width).toBe(r.inner)
      expect(r.pad).toBe("0px")
      expect(r.margin).toBe("0px")
      expect(r.color).toBe(r.seam)
    })
  }

  test("<hr> in a packed row is a 1px divider down it", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.innerHTML = `<e-row id="row" packed border seams="none"><button>a</button><hr /><button>b</button></e-row>`
      const row = document.getElementById("row")!
      const hr = row.querySelector("hr")!.getBoundingClientRect()
      // Not clientHeight: it is rounded to a whole pixel.
      const st = getComputedStyle(row)
      const row_inner =
        row.getBoundingClientRect().height -
        Number.parseFloat(st.borderTopWidth) -
        Number.parseFloat(st.borderBottomWidth)
      return { width: hr.width, height: hr.height, row_inner }
    })
    expect(r.width).toBe(1)
    expect(r.height).toBeCloseTo(r.row_inner, 1)
  })

  test("the radius of the outermost container is handed down through nested groups to the corner cells", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      document.body.innerHTML = `
        <e-column id="c" packed border radius="section">
          <e-row packed id="top"><button>a</button><button>b</button></e-row>
          <e-row packed id="bottom"><button>c</button><button>d</button></e-row>
        </e-column>`
      const radius = (e: Element) => {
        const st = getComputedStyle(e)
        return [st.borderTopLeftRadius, st.borderTopRightRadius, st.borderBottomRightRadius, st.borderBottomLeftRadius]
      }
      const col = getComputedStyle(document.getElementById("c")!).borderTopLeftRadius
      const [a, b] = [...document.querySelectorAll("#top > *")].map(radius)
      const [c, d] = [...document.querySelectorAll("#bottom > *")].map(radius)
      return { col, a, b, c, d }
    })
    expect(r.a).toEqual([r.col, "0px", "0px", "0px"])
    expect(r.b).toEqual(["0px", r.col, "0px", "0px"])
    expect(r.c).toEqual(["0px", "0px", "0px", r.col])
    expect(r.d).toEqual(["0px", "0px", r.col, "0px"])
  })
})

// A `hidden` child is not displayed (the reset's `display: none`), so packed skips it when it picks
// the first, last and interior children: the visible outer children get the outer corners and
// borders, the seams stay single (docs/md/ui-layout.md#packed).
test.describe("packed and hidden children (docs/md/ui-layout.md#packed)", () => {
  /** The edges and corners of each visible child of a packed `tag` holding four buttons, one hidden. */
  const run = (page: Page, tag: string, hide: number, border: boolean) =>
    page.evaluate(
      ({ tag, hide, border }) => {
        const c = document.createElement(tag)
        c.setAttribute("packed", "")
        // With a frame the container draws the lines (leading edges); without, the children's own borders are shared.
        if (border) c.setAttribute("border", "")
        else c.setAttribute("seams", "children")
        c.setAttribute("radius", "section")
        c.id = "hc"
        for (let i = 0; i < 4; i++) {
          const b = document.createElement("button")
          b.textContent = `b${i}`
          if (i === hide) b.hidden = true
          c.append(b)
        }
        document.body.appendChild(c)
        const row = tag === "e-row"
        const visible = [...c.children].filter((e) => !(e as HTMLElement).hidden)
        return {
          radius: getComputedStyle(c).borderTopLeftRadius,
          // In flow order: leading edge, trailing edge, the two leading corners, the two trailing corners.
          kids: visible.map((e) => {
            const s = getComputedStyle(e)
            return row
              ? {
                  lead: s.borderLeftStyle,
                  trail: s.borderRightStyle,
                  lead_r: [s.borderTopLeftRadius, s.borderBottomLeftRadius],
                  trail_r: [s.borderTopRightRadius, s.borderBottomRightRadius],
                }
              : {
                  lead: s.borderTopStyle,
                  trail: s.borderBottomStyle,
                  lead_r: [s.borderTopLeftRadius, s.borderTopRightRadius],
                  trail_r: [s.borderBottomLeftRadius, s.borderBottomRightRadius],
                }
          }),
        }
      },
      { tag, hide, border },
    )

  for (const tag of ["e-row", "e-column"]) {
    // A hidden first or last child of a packed row or column still counts as first / last (skipping it
    // would cost a restyle of every earlier sibling on each insertion at the end): only the middle
    // case is checked here (docs/md/ui-layout.md#packed).
    for (const [name, hide] of [["middle", 1]] as const) {
      test(`${tag} without border, hidden ${name} child: the visible ones share single lines, outer corners kept`, async ({
        page,
      }) => {
        const r = await run(page, tag, hide, false)
        const [a, b, c] = r.kids
        // Every visible child but the last drops its trailing edge; the last keeps it.
        expect([a.trail, b.trail, c.trail]).toEqual(["none", "none", "solid"])
        expect([a.lead, b.lead, c.lead]).toEqual(["solid", "solid", "solid"])
        // Interior corners square, outer corners take the container's radius.
        expect(a.lead_r).toEqual([r.radius, r.radius])
        expect(c.trail_r).toEqual([r.radius, r.radius])
        expect([...a.trail_r, ...b.lead_r, ...b.trail_r, ...c.lead_r]).toEqual(Array(8).fill("0px"))
      })

      test(`${tag} with border, hidden ${name} child: outer corners on the visible outer children, seams drawn`, async ({
        page,
      }) => {
        const r = await run(page, tag, hide, true)
        const [a, b, c] = r.kids
        expect(r.radius).not.toBe("0px")
        expect(a.lead_r).toEqual([r.radius, r.radius])
        expect(c.trail_r).toEqual([r.radius, r.radius])
        expect([...a.trail_r, ...b.lead_r, ...b.trail_r, ...c.lead_r]).toEqual(Array(8).fill("0px"))
        // The frame has the outline; the line before each of the two later visible children is theirs.
        expect([a.lead, a.trail, b.lead, b.trail, c.lead, c.trail]).toEqual([
          "none",
          "none",
          "solid",
          "none",
          "solid",
          "none",
        ])
      })
    }
  }

  // The shared-line rules look at the previous sibling: it must be the previous *visible* one.
  const edges = (page: Page, html: string) =>
    page.evaluate((html) => {
      document.body.insertAdjacentHTML("beforeend", `<e-row id="m" packed>${html}</e-row>`)
      return [...document.getElementById("m")!.children]
        .filter((e) => !(e as HTMLElement).hidden)
        .map((e) => [getComputedStyle(e).borderLeftStyle, getComputedStyle(e).borderRightStyle])
    }, html)

  test("a hidden meaningful child does not take the next child's leading edge", async ({ page }) => {
    // Before the fix, the hidden tint button made `c` drop its leading edge while `a` dropped its
    // trailing one: no line at all between the two visible buttons.
    const [a, c] = await edges(page, `<button>a</button><button e-emphasis="tint" hidden>b</button><button>c</button>`)
    expect(a[1]).toBe("none")
    expect(c[0]).toBe("solid")
  })

  for (const n of [1, 2]) {
    test(`a meaningful child followed by ${n} hidden one(s) still owns the line it shares with the next visible child`, async ({
      page,
    }) => {
      const hidden = "<button hidden>h</button>".repeat(n)
      const [m, c] = await edges(page, `<button aria-pressed="true">m</button>${hidden}<button>c</button>`)
      expect(m[1]).toBe("solid")
      expect(c[0]).toBe("none")
    })
  }

  test("packed bordered grid: hidden first and last rows and a hidden last cell are skipped for the outer corners", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-grid id="g" columns="2" packed border radius="section">
          <e-grid-row hidden><span>h</span><span>h</span></e-grid-row>
          <e-grid-row><span>a</span><span>b</span><span hidden>h</span></e-grid-row>
          <e-grid-row><span>c</span><span>d</span></e-grid-row>
          <e-grid-row hidden><span>h</span><span>h</span></e-grid-row>
        </e-grid>`,
      )
      const g = document.getElementById("g")!
      const cell = (row: number, col: number) => getComputedStyle(g.children[row].children[col])
      return {
        radius: getComputedStyle(g).borderTopLeftRadius,
        a: cell(1, 0).borderTopLeftRadius,
        b: cell(1, 1).borderTopRightRadius,
        c: cell(2, 0).borderBottomLeftRadius,
        d: cell(2, 1).borderBottomRightRadius,
      }
    })
    expect(r.radius).not.toBe("0px")
    expect([r.a, r.b, r.c, r.d]).toEqual(Array(4).fill(r.radius))
  })

  // hidden="until-found" is left to the browser (content-visibility: hidden): the element keeps its
  // box, padding included, so packed still counts it.
  test('a hidden="until-found" child still counts: it keeps a box and the outer corners', async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-row id="u" packed border radius="section"><button>a</button><button>b</button><e-row hidden="until-found">c</e-row></e-row>`,
      )
      const row = document.getElementById("u")!
      const [, b, c] = [...row.children].map((e) => getComputedStyle(e))
      return {
        radius: getComputedStyle(row).borderTopRightRadius,
        width: row.children[2].getBoundingClientRect().width,
        b_trail: b.borderTopRightRadius,
        c_trail: c.borderTopRightRadius,
      }
    })
    expect(r.width).toBeGreaterThan(0)
    expect(r.b_trail).toBe("0px")
    expect(r.c_trail).toBe(r.radius)
  })
})
