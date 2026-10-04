import { expect, test } from "./fixture"

// RepeatVirtual in a real scroll area, laid out by the components' own CSS: padders, finding the scroll
// area, prefix/suffix/empty, and an infinite e-grid with sticky rows.
// tests/virtual.pw.ts covers the windowing algorithm itself, with fixed, deterministic geometry.

declare global {
  interface Window {
    /** Mounts a 200px-high scroll area (`e-column scroll`, no gap) with `build(area)` inside, returns the area. */
    __area: (build: (area: HTMLElement) => void) => HTMLElement
    __scroll: (area: HTMLElement, top: number) => Promise<void>
    /** `item_size` is the RepeatVirtual's starting estimate (default 21, the rows' real spacing). */
    __buildGrid: (area: HTMLElement, item_size?: number) => void
  }
}

test.beforeEach(async ({ page }) => {
  await page.addScriptTag({
    content: `
      // Scrolls area to top and lets RepeatVirtual converge.
      window.__scroll = async (area, top) => {
        area.scrollTop = top
        area.dispatchEvent(new Event("scroll"))
        await window.__ELT__.frames(10)
      }
      // e-grid columns=3 packed border in a bordered area, sticky header and footer around 10 000 rows.
      // Cells clip their text: it would overflow their fixed height and lengthen the scroll content.
      window.__buildGrid = (area, item_size = 21) => {
    const { RepeatVirtual, node_append, o } = window.__ELT__
    area.setAttribute("border", "")
    const grid = document.createElement("e-grid")
    grid.setAttribute("columns", "3")
    grid.setAttribute("packed", "")
    grid.setAttribute("border", "")
    const row = (cls, a, b, c) => {
      const r = document.createElement("e-grid-row")
      r.className = cls
      for (const t of [a, b, c]) r.append(Object.assign(document.createElement("span"), { textContent: t, style: "height: 20px; display: block; overflow: hidden" }))
      return r
    }
    const head = row("head", "A", "B", "C")
    head.setAttribute("sticky", "top")
    const foot = row("foot", "x", "y", "z")
    foot.setAttribute("sticky", "bottom")
    grid.append(head)
    node_append(grid, RepeatVirtual(o(Array.from({ length: 10000 }, (_, i) => i)), (o_i) => row("row", String(o_i.get()), "b", "c")).ItemSize(item_size))
    grid.append(foot)
    node_append(area, grid)
      }
      window.__area = (build) => {
        const { node_append } = window.__ELT__
        const area = document.createElement("e-column")
        area.setAttribute("scroll", "")
        area.setAttribute("spacing", "none")
        area.setAttribute("align", "stretch")
        area.style.height = "200px"
        area.style.width = "300px"
        build(area)
        node_append(document.body, area)
        return area
      }
    `,
  })
})

test.describe("padders and scroll area", () => {
  test("the padders sit right before and after the rows, each shown only while rows are hidden on its side", async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const scroll = window.__scroll
      const { RepeatVirtual, node_append, o } = window.__ELT__
      const o_lst = o(Array.from({ length: 1000 }, (_, i) => i))
      let col!: HTMLElement
      const area = window.__area((area) => {
        col = document.createElement("div")
        node_append(
          col,
          RepeatVirtual(o_lst, (o_i) =>
            Object.assign(document.createElement("div"), {
              className: "row",
              style: "height:20px",
              textContent: String(o_i.get()),
            }),
          ).ItemSize(20),
        )
        node_append(area, col)
      })
      await window.__ELT__.frames(6)
      const elements = () => [...col.children] as HTMLElement[]
      const [top, bottom] = [elements()[0], elements().at(-1)!]
      const state = () => ({
        top: { display: getComputedStyle(top).display, height: top.getBoundingClientRect().height },
        bottom: { display: getComputedStyle(bottom).display, height: bottom.getBoundingClientRect().height },
      })
      const tags = [top.tagName, bottom.tagName, top.getAttribute("aria-hidden")]
      const rows_between = elements()
        .slice(1, -1)
        .every((e) => e.className === "row")
      const rendered = area.querySelectorAll(".row").length
      const at_top = state()
      await scroll(area, 5000)
      const middle = state()
      await scroll(area, area.scrollHeight)
      await scroll(area, area.scrollHeight)
      const at_end = state()
      return { tags, rows_between, rendered, at_top, middle, at_end, scroll_height: area.scrollHeight }
    })
    expect(res.tags).toEqual(["E-VIRTUAL-PADDER", "E-VIRTUAL-PADDER", "true"])
    expect(res.rows_between).toBe(true)
    expect(res.rendered).toBeLessThan(100)
    expect(res.at_top.top.display).toBe("none")
    expect(res.at_top.bottom.height).toBeGreaterThan(10000)
    expect(res.middle.top.display).toBe("block")
    expect(res.middle.top.height).toBeGreaterThan(4000)
    expect(res.middle.bottom.display).toBe("block")
    expect(res.at_end.bottom.display).toBe("none")
    expect(res.scroll_height).toBeGreaterThan(19000)
  })

  test("in a packed bordered container, the padders take none of the cells' padding or border", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { RepeatVirtual, node_append, o } = window.__ELT__
      let col!: HTMLElement
      const area = window.__area((area) => {
        col = document.createElement("e-column")
        col.setAttribute("packed", "")
        col.setAttribute("border", "")
        node_append(
          col,
          RepeatVirtual(o(Array.from({ length: 500 }, (_, i) => i)), (o_i) =>
            Object.assign(document.createElement("div"), { className: "row", textContent: String(o_i.get()) }),
          ),
        )
        node_append(area, col)
      })
      await window.__ELT__.frames(6)
      await window.__scroll(area, 3000)
      const padder = col.querySelector("e-virtual-padder") as HTMLElement
      const cs = getComputedStyle(padder)
      return {
        padding: cs.padding,
        border: cs.borderTopWidth,
        margin: cs.margin,
        height: padder.getBoundingClientRect().height,
        inline: Number.parseFloat(padder.style.height),
      }
    })
    expect(res.padding).toBe("0px")
    expect(res.border).toBe("0px")
    expect(res.margin).toBe("0px")
    expect(res.inline).toBeGreaterThan(1000)
    expect(res.height).toBe(res.inline)
  })

  // elt reports an exception thrown by a connection callback with console.error rather than
  // letting it reach node_append's caller, so these tests read the logged errors.
  test("RepeatVirtual finds the nearest vertically scrolling ancestor at any depth, and reports an error without one", async ({
    page,
  }) => {
    const res = await page.evaluate(() => {
      const { RepeatVirtual, node_append, o } = window.__ELT__
      const attempt = (wrap: (list: HTMLElement) => HTMLElement) => {
        const holder = document.createElement("div")
        node_append(
          holder,
          RepeatVirtual(o([1, 2]), (o_i) =>
            Object.assign(document.createElement("div"), { textContent: String(o_i.get()) }),
          ),
        )
        const errors: string[] = []
        const orig = console.error
        console.error = (...args: unknown[]) =>
          errors.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "))
        try {
          node_append(document.body, wrap(holder))
        } finally {
          console.error = orig
        }
        return errors.join("\n") || "ok"
      }
      const area_of = (child: HTMLElement, overflow = "auto") => {
        const a = document.createElement("div")
        a.style.height = "100px"
        a.style.overflowY = overflow
        a.append(child)
        return a
      }
      const nest = (child: HTMLElement, depth: number) => {
        let el = child
        for (let i = 0; i < depth; i++) {
          const mid = document.createElement("div")
          mid.append(el)
          el = mid
        }
        return el
      }
      // A scroll area holding the list through a shadow root's slot.
      const through_slot = (child: HTMLElement) => {
        const host = document.createElement("div")
        host.attachShadow({ mode: "open" }).append(document.createElement("slot"))
        host.append(child)
        return area_of(host)
      }
      return {
        outside: attempt((h) => h),
        depth1: attempt((h) => area_of(h)),
        depth3: attempt((h) => area_of(nest(h, 3))),
        slot: attempt(through_slot),
        clipped_only: attempt((h) => area_of(h, "hidden")),
      }
    })
    expect(res.outside).toContain("must be inside an element that scrolls vertically")
    expect(res.depth1).toBe("ok")
    expect(res.depth3).toBe("ok")
    expect(res.slot).toBe("ok")
    expect(res.clipped_only).toContain("must be inside an element that scrolls vertically")
  })

  test("the scroll area's overflow-anchor is none while lists use it, and restored after the last one leaves", async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const { If, RepeatVirtual, node_append, o } = window.__ELT__
      const render = (o_i: any) =>
        Object.assign(document.createElement("div"), { style: "height:20px", textContent: String(o_i.get()) })
      const o_first = o(true)
      const o_second = o(true)
      const area = window.__area((area) => {
        area.style.overflowAnchor = "auto"
        node_append(
          area,
          If(o_first, () => RepeatVirtual(o([1, 2, 3]), render)),
        )
        node_append(
          area,
          If(o_second, () => RepeatVirtual(o([4, 5, 6]), render)),
        )
      })
      await window.__ELT__.frames(6)
      const both = area.style.overflowAnchor
      o_first.set(false)
      const one = area.style.overflowAnchor
      o_second.set(false)
      const none = area.style.overflowAnchor
      return { both, one, none, padders: area.querySelectorAll("e-virtual-padder").length }
    })
    expect(res).toEqual({ both: "none", one: "none", none: "auto", padders: 0 })
  })

  test("two lists in one scroll area each keep their rows in place, and land right after a jump", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const scroll = window.__scroll
      const { RepeatVirtual, node_append, o } = window.__ELT__
      const list = (prefix: string) =>
        RepeatVirtual(o(Array.from({ length: 300 }, (_, i) => i)), (o_i) =>
          Object.assign(document.createElement("div"), {
            className: "row",
            style: "height:20px",
            textContent: `${prefix}${o_i.get()}`,
          }),
        ).ItemSize(20)
      const area = window.__area((area) => {
        for (const prefix of ["a", "b"]) {
          const holder = document.createElement("div")
          node_append(holder, list(prefix))
          node_append(area, holder)
        }
      })
      await window.__ELT__.frames(6)
      // Each list is 300 rows of 20px: list a spans 0–6000, list b 6000–12000. The row at the area's
      // top must always be the one its scroll offset designates.
      const seen: string[] = []
      const expected: string[] = []
      for (let st = 0; st <= 11000; st += 150) {
        await scroll(area, st)
        const a = area.getBoundingClientRect()
        seen.push(document.elementFromPoint(a.left + 10, a.top + 1)?.textContent ?? "")
        const i = Math.floor(st / 20)
        expected.push(i < 300 ? `a${i}` : `b${i - 300}`)
      }
      // Jumps (one scroll farther than the threshold) land from an index estimate, which must count
      // what sits above the list: list b's estimate starts after list a's 6000px.
      const jumps: string[] = []
      for (const st of [1000, 9000, 2000, 11000]) {
        await scroll(area, st)
        const a = area.getBoundingClientRect()
        jumps.push(document.elementFromPoint(a.left + 10, a.top + 1)?.textContent ?? "")
      }
      return { seen, expected, jumps, rendered: area.querySelectorAll(".row").length }
    })
    expect(res.seen).toEqual(res.expected)
    expect(res.jumps).toEqual(["a50", "b150", "a100", "b250"])
    expect(res.rendered).toBeLessThan(200)
  })

  test("among a table's rows, the padders are table rows", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const scroll = window.__scroll
      const { RepeatVirtual, node_append, o } = window.__ELT__
      let tbody!: HTMLElement
      const area = window.__area((area) => {
        const table = document.createElement("table")
        table.style.cssText = "table-layout: fixed; width: 100%; border-spacing: 0"
        tbody = document.createElement("tbody")
        node_append(
          tbody,
          RepeatVirtual(o(Array.from({ length: 1000 }, (_, i) => i)), (o_i) => {
            const tr = document.createElement("tr")
            tr.className = "row"
            tr.append(
              Object.assign(document.createElement("td"), {
                textContent: String(o_i.get()),
                style: "height:20px; padding:0",
              }),
            )
            return tr
          }).ItemSize(20),
        )
        table.append(tbody)
        node_append(area, table)
      })
      await window.__ELT__.frames(6)
      await scroll(area, 5000)
      const padder = tbody.querySelector("e-virtual-padder") as HTMLElement
      const a = area.getBoundingClientRect()
      return {
        display: getComputedStyle(padder).display,
        height: padder.getBoundingClientRect().height,
        inline: Number.parseFloat(padder.style.height),
        top_row: document.elementFromPoint(a.left + 10, a.top + 1)?.textContent,
        rendered: tbody.querySelectorAll(".row").length,
      }
    })
    expect(res.display).toBe("table-row")
    expect(res.height).toBeCloseTo(res.inline, 0)
    expect(res.top_row).toBe("250")
    expect(res.rendered).toBeLessThan(100)
  })

  test("prefix and suffix show only at the list's true start and end; empty state shows when empty", async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const scroll = window.__scroll
      const { RepeatVirtual, node_append, o } = window.__ELT__
      const o_lst = o(Array.from({ length: 500 }, (_, i) => i))
      const mk = (cls: string, text: string) =>
        Object.assign(document.createElement("div"), { className: cls, textContent: text })
      const area = window.__area((area) => {
        node_append(
          area,
          RepeatVirtual(o_lst, (o_i) => Object.assign(mk("row", String(o_i.get())), { style: "height:20px" }))
            .ItemSize(20)
            .PrefixBy(() => mk("prefix", "P"))
            .SuffixBy(() => mk("suffix", "S"))
            .DisplayWhenEmpty(() => mk("empty", "E")),
        )
      })
      await window.__ELT__.frames(6)
      const has = (cls: string) => area.querySelector(`.${cls}`) != null
      const at_top = { prefix: has("prefix"), suffix: has("suffix"), empty: has("empty") }
      await scroll(area, 4000)
      const middle = { prefix: has("prefix"), suffix: has("suffix") }
      await scroll(area, area.scrollHeight)
      await scroll(area, area.scrollHeight)
      const at_end = { prefix: has("prefix"), suffix: has("suffix") }
      o_lst.set([])
      await window.__ELT__.frames(6)
      const empty = { prefix: has("prefix"), suffix: has("suffix"), empty: has("empty") }
      return { at_top, middle, at_end, empty }
    })
    expect(res.at_top).toEqual({ prefix: true, suffix: false, empty: false })
    expect(res.middle).toEqual({ prefix: false, suffix: false })
    expect(res.at_end).toEqual({ prefix: false, suffix: true })
    expect(res.empty).toEqual({ prefix: false, suffix: false, empty: true })
  })

  test("separators are rendered with the item they precede", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { RepeatVirtual, node_append, o } = window.__ELT__
      const area = window.__area((area) => {
        node_append(
          area,
          RepeatVirtual(o(Array.from({ length: 100 }, (_, i) => i)), (o_i) =>
            Object.assign(document.createElement("div"), {
              className: "row",
              style: "height:20px",
              textContent: String(o_i.get()),
            }),
          )
            .ItemSize(20)
            .SeparateWith(() => Object.assign(document.createElement("hr"), { className: "sep" })),
        )
      })
      await window.__ELT__.frames(6)
      const rows = area.querySelectorAll(".row").length
      const seps = area.querySelectorAll(".sep").length
      return { rows, seps }
    })
    expect(res.rows).toBeGreaterThan(1)
    expect(res.seps).toBe(res.rows - 1)
  })
})

test.describe("infinite e-grid with sticky rows", () => {
  test("header and footer stay on the edges while scrolling top → middle → end → top", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const scroll = window.__scroll
      const area = window.__area(window.__buildGrid)
      await window.__ELT__.frames(6)
      const pos = () => {
        const a = area.getBoundingClientRect()
        const cs = getComputedStyle(area)
        const inner_top = a.top + Number.parseFloat(cs.borderTopWidth)
        const inner_bottom = a.bottom - Number.parseFloat(cs.borderBottomWidth)
        return {
          head: Math.round(area.querySelector(".head")!.getBoundingClientRect().top - inner_top),
          foot: Math.round(inner_bottom - area.querySelector(".foot")!.getBoundingClientRect().bottom),
        }
      }
      const out: Record<string, { head: number; foot: number }> = { top: pos() }
      await scroll(area, 50000)
      out.middle = pos()
      await scroll(area, area.scrollHeight)
      await scroll(area, area.scrollHeight)
      out.end = pos()
      await scroll(area, 0)
      out.back = pos()
      const rendered = area.querySelectorAll(".row").length
      return { out, rendered }
    })
    for (const k of ["top", "middle", "end", "back"]) expect(res.out[k], k).toEqual({ head: 0, foot: 0 })
    expect(res.rendered).toBeLessThan(200)
  })

  // The 1px seam under the header is the header's own bottom border, laid over the grid's gap
  // (ui/layout.css.tsx): row 0 starts where the header's box ends.
  test("row 0 sits right under the sticky header's 1px seam, and the grid draws no frame of its own", async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const area = window.__area(window.__buildGrid)
      await window.__ELT__.frames(6)
      const head = area.querySelector(".head")!.getBoundingClientRect()
      const row0 = area.querySelector(".row")!.getBoundingClientRect()
      const grid = getComputedStyle(area.querySelector("e-grid")!)
      return {
        seam: getComputedStyle(area.querySelector(".head")!).borderBottomWidth,
        gap: row0.top - head.bottom,
        label: area.querySelector(".row")!.textContent,
        grid_border: grid.borderTopWidth,
      }
    })
    expect(res.label).toBe("0bc")
    expect(res.seam).toBe("1px")
    expect(res.gap).toBe(0)
    expect(res.grid_border).toBe("0px")
  })

  test("the view doesn't jump while the window changes", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const scroll = window.__scroll
      const area = window.__area(window.__buildGrid)
      await window.__ELT__.frames(6)
      // Scroll down in small steps; after each, the row under a fixed point must match the
      // scroll offset (rows are 20px + 1px seam), never jump back or skip.
      const labels: number[] = []
      for (let st = 3000; st <= 6000; st += 150) {
        await scroll(area, st)
        const a = area.getBoundingClientRect()
        const el = document.elementFromPoint(a.left + 20, a.top + 100)
        labels.push(Number(el?.closest(".row")?.firstElementChild?.textContent))
      }
      return labels
    })
    for (let i = 1; i < res.length; i++) {
      expect(res[i] - res[i - 1], `step ${i}: ${res[i - 1]} → ${res[i]}`).toBeGreaterThanOrEqual(6)
      expect(res[i] - res[i - 1], `step ${i}: ${res[i - 1]} → ${res[i]}`).toBeLessThanOrEqual(8)
    }
  })
})

test.describe("sticky rows during scrolls faster than the list follows (regression: the header dropped)", () => {
  // The scroll offset changes in a requestAnimationFrame callback and the header is read right
  // after, in the same frame: what the browser draws before the list's IntersectionObserver reports.
  // A sticky row is held inside its parent's box; with the padders inside the grid, that box spans
  // the whole scroll height, so the header stays on the edge however far ahead of the list the
  // scroll is (steps above the 500px threshold, and jumps).
  for (const step of [600, 1500, 5000]) {
    test(`header and footer stay on the edges with ${step}px per frame, down then up`, async ({ page }) => {
      const res = await page.evaluate(async (step) => {
        const area = window.__area(window.__buildGrid)
        await window.__ELT__.frames(6)
        await window.__scroll(area, 100000)
        const head = area.querySelector(".head")!
        const foot = area.querySelector(".foot")!
        const cs = getComputedStyle(area)
        const off = () => {
          const a = area.getBoundingClientRect()
          return [
            Math.round(head.getBoundingClientRect().top - a.top - Number.parseFloat(cs.borderTopWidth)),
            Math.round(a.bottom - Number.parseFloat(cs.borderBottomWidth) - foot.getBoundingClientRect().bottom),
          ]
        }
        const moved: string[] = []
        for (const dir of [1, -1]) {
          for (let i = 0; i < 20; i++) {
            await window.__ELT__.frames()
            area.scrollTop += dir * step
            const [h, f] = off()
            if (h !== 0 || f !== 0) moved.push(`${dir > 0 ? "down" : "up"} #${i}: head ${h}, foot ${f}`)
          }
        }
        return moved
      }, step)
      expect(res).toEqual([])
    })
  }
})

test.describe("hiding the top padder at row 0 (no gap value is known: the padder stands for at least one row)", () => {
  // Scroll down past the margin (the top padder shows), then back up in steps to the top: every
  // rendered row must stay at the offset its index designates in the scroll content, including on
  // the step where the window reaches row 0 and the padder hides. A gap or a seam wrongly counted
  // would shift every row by that much from then on.
  const cases = {
    "packed bordered grid (1px seams)": (area: HTMLElement) => window.__buildGrid(area),
    "flex column with a 30px gap": (area: HTMLElement) => {
      const { RepeatVirtual, node_append, o } = window.__ELT__
      const col = document.createElement("div")
      col.style.cssText = "display: flex; flex-direction: column; gap: 30px"
      node_append(
        col,
        RepeatVirtual(o(Array.from({ length: 2000 }, (_, i) => i)), (o_i) =>
          Object.assign(document.createElement("div"), {
            className: "row",
            style: "height: 20px; flex: none",
            textContent: String(o_i.get()),
          }),
        ).ItemSize(50),
      )
      node_append(area, col)
    },
  }
  for (const [name, build] of Object.entries(cases)) {
    test(name, async ({ page }) => {
      const res = await page.evaluate(
        async ({ build_src }) => {
          const build = new Function(`return ${build_src}`)()
          const scroll = window.__scroll
          const area = window.__area(build)
          await window.__ELT__.frames(6)
          const rows = () => [...area.querySelectorAll(".row")] as HTMLElement[]
          const index = (row: HTMLElement) => Number.parseInt(row.textContent!, 10)
          // Offset in the scroll content, from the area's top, of a row's top.
          const offset = (row: HTMLElement) =>
            row.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop
          const [r0, r1] = rows()
          const origin = offset(r0)
          const pitch = offset(r1) - origin
          const misplaced: string[] = []
          const check = (label: string) => {
            for (const row of rows()) {
              const expected = origin + index(row) * pitch
              if (Math.abs(offset(row) - expected) > 0.5)
                misplaced.push(`${label}: row ${index(row)} at ${offset(row)}, expected ${expected}`)
            }
          }
          let shown = false
          for (let st = 0; st <= 3000; st += 100) {
            await scroll(area, st)
            shown ||= getComputedStyle(area.querySelector("e-virtual-padder")!).display !== "none"
          }
          for (let st = 3000; st >= 0; st -= 100) {
            await scroll(area, st)
            check(`at ${st}`)
          }
          const hidden_at_top = getComputedStyle(area.querySelector("e-virtual-padder")!).display === "none"
          return { shown, hidden_at_top, misplaced: misplaced.slice(0, 5) }
        },
        { build_src: build.toString() },
      )
      expect(res.shown).toBe(true)
      expect(res.hidden_at_top).toBe(true)
      expect(res.misplaced).toEqual([])
    })
  }
})

test.describe("margins after a jump (regression: a jump used to land with no rows rendered above)", () => {
  // A jump (one scroll moving more than max(threshold, viewport)) re-renders the window from an
  // index estimate. It must land with rows rendered on both sides of the viewport: with nothing
  // rendered above, a scroll back up drawn before the list catches up shows the blank top padder.
  for (const item_size of [21, 64]) {
    test(`both margins are filled at rest after jumping down then up (estimate ${item_size}px, real 21px)`, async ({
      page,
    }) => {
      const res = await page.evaluate(async (item_size) => {
        const scroll = window.__scroll
        const area = window.__area((a) => window.__buildGrid(a, item_size))
        await window.__ELT__.frames(6)
        // Rendered extent beyond the viewport, above and below.
        const margins = () => {
          const a = area.getBoundingClientRect()
          const rows = area.querySelectorAll(".row")
          return {
            above: Math.round(a.top - rows[0].getBoundingClientRect().top),
            below: Math.round(rows[rows.length - 1].getBoundingClientRect().bottom - a.bottom),
          }
        }
        await scroll(area, 100000)
        const down = margins()
        await scroll(area, 50000)
        const up = margins()
        return { down, up }
      }, item_size)
      // The threshold is 500px; one row (21px) of slack for where the edge row falls.
      for (const k of ["down", "up"] as const) {
        expect(res[k].above, `${k}: above`).toBeGreaterThanOrEqual(479)
        expect(res[k].below, `${k}: below`).toBeGreaterThanOrEqual(479)
      }
    })
  }
})

test.describe("ui Select", () => {
  test("a long option list stays virtual in the popup, with only options in its packed column", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { node_append, o, UI } = window.__ELT__
      const btn = UI.Select({
        model: o<number | undefined>(undefined),
        options: Array.from({ length: 2000 }, (_, i) => i),
      })
      node_append(document.body, btn)
      btn.click()
      await window.__ELT__.frames(10)
      const area = document.querySelector("[role=listbox]") as HTMLElement
      const col = area.querySelector("e-column")!
      const options = col.querySelectorAll("[role=option]").length
      const others = [...col.children].filter(
        (c) => c.getAttribute("role") !== "option" && c.tagName !== "E-VIRTUAL-PADDER",
      ).length
      return {
        options,
        others,
        area_height: area.getBoundingClientRect().height,
        viewport: window.innerHeight,
        scrolls: area.scrollHeight > area.clientHeight,
      }
    })
    expect(res.options).toBeGreaterThan(0)
    expect(res.options).toBeLessThan(200)
    expect(res.others).toBe(0)
    expect(res.area_height).toBeLessThanOrEqual(res.viewport * 0.8)
    expect(res.scrolls).toBe(true)
  })
})

test.describe("appending while the window reaches the end", () => {
  test("appended rows show synchronously, by one screenful at most", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { RepeatVirtual, node_append, o } = window.__ELT__
      const o_lst = o([0, 1, 2])
      const area = window.__area((area) => {
        node_append(
          area,
          RepeatVirtual(o_lst, (o_i) =>
            Object.assign(document.createElement("div"), {
              className: "row",
              style: "height:20px",
              textContent: String(o_i.get()),
            }),
          ).ItemSize(20),
        )
      })
      await window.__ELT__.frames(6)
      o_lst.set([...o_lst.get(), 3])
      const after_one = area.querySelectorAll(".row").length
      o_lst.set([...o_lst.get(), ...Array.from({ length: 10000 }, (_, i) => i + 4)])
      const after_many = area.querySelectorAll(".row").length
      return { after_one, after_many }
    })
    expect(res.after_one).toBe(4)
    expect(res.after_many).toBeGreaterThan(4)
    expect(res.after_many).toBeLessThan(100)
  })
})

test.describe("object editor table (array of objects)", () => {
  test("renders a virtual e-grid with a sticky header, columns locked after the first layout, and resizable columns", async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const { node_append, o } = window.__ELT__
      const { array, object } = window.__ELT__.Editor
      const rows = Array.from({ length: 5000 }, (_, i) => ({ name: `n${i}`, kind: "k" }))
      const widget = array({ values: object({ properties: [] }), mode: "table" } as any).render(o(rows) as any)
      node_append(document.body, widget.render() as HTMLElement)
      await window.__ELT__.frames(10)
      const grid = document.querySelector("e-grid") as HTMLElement
      const head = grid.querySelector("e-grid-row[sticky=top]") as HTMLElement
      // The template the grid sets (locked widths), not the used sizes: the last column also fills.
      const tpl_before = grid.style.gridTemplateColumns
      const head_cells = [...head.children].map((c) => c.textContent)
      const rendered = grid.querySelectorAll("e-grid-row:not([sticky])").length

      // Drag the "name" column's handle 60px to the right.
      const handle = head.children[1].querySelector("span") as HTMLElement
      const r = handle.getBoundingClientRect()
      handle.dispatchEvent(new MouseEvent("mousedown", { clientX: r.left, bubbles: true }))
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: r.left + 60, bubbles: true }))
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
      const tpl_after = grid.style.gridTemplateColumns
      return { tpl_before, tpl_after, head_cells, rendered, sticky: getComputedStyle(head).position }
    })
    expect(res.head_cells).toEqual(["#", "name", "kind"])
    expect(res.sticky).toBe("sticky")
    expect(res.rendered).toBeGreaterThan(0)
    expect(res.rendered).toBeLessThan(200)
    // "#" | name | kind (fills): every track locked to px.
    const tracks = /^([\d.]+)px ([\d.]+)px minmax\(([\d.]+)px, 1fr\)$/
    const before = res.tpl_before.match(tracks)!.slice(1).map(Number.parseFloat)
    const after = res.tpl_after.match(tracks)!.slice(1).map(Number.parseFloat)
    expect(after[0]).toBe(before[0])
    expect(after[1]).toBeCloseTo(before[1]! + 60, 0)
    expect(after[2]).toBe(before[2])
  })
})
