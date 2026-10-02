import { expect, test } from "@playwright/test"

// RepeatVirtual in a real <e-virtual-scroll> (real layout, no mocked geometry): padders, the
// structural rule, prefix/suffix/empty, and an infinite e-grid with sticky rows.
// tests/virtual.pw.ts covers the windowing algorithm itself, with mocked geometry.

declare global {
  interface Window {
    __frames: (count?: number) => Promise<void>
    /** Mounts `<e-virtual-scroll style="height:200px">` with `build(area)` inside, returns the area. */
    __area: (build: (area: HTMLElement) => void) => HTMLElement
    __scroll: (area: HTMLElement, top: number) => Promise<void>
    /** `item_size` is the RepeatVirtual's starting estimate (default 21, the rows' real spacing). */
    __buildGrid: (area: HTMLElement, item_size?: number) => void
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
  await page.addScriptTag({
    content: `
      window.__frames = async (count = 6) => {
        for (let i = 0; i < count; i++) await new Promise((r) => requestAnimationFrame(r))
      }
      // Scrolls area to top and lets RepeatVirtual converge.
      window.__scroll = async (area, top) => {
        area.scrollTop = top
        area.dispatchEvent(new Event("scroll"))
        await window.__frames(10)
      }
      // e-grid columns=3 packed border in a bordered area, sticky header and footer around 10 000 rows.
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
      for (const t of [a, b, c]) r.append(Object.assign(document.createElement("span"), { textContent: t, style: "height: 20px; display: block" }))
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
        const area = document.createElement("e-virtual-scroll")
        area.style.height = "200px"
        area.style.width = "300px"
        build(area)
        node_append(document.body, area)
        return area
      }
    `,
  })
})

test.describe("e-virtual-scroll", () => {
  test("leaves overscroll-behavior at auto, so the page scrolls past its end", async ({ page }) => {
    const res = await page.evaluate(() => {
      const area = window.__area(() => {})
      return getComputedStyle(area).overscrollBehaviorY
    })
    expect(res).toBe("auto")
  })

  test("its padders live in its shadow root and stand for the rows that aren't rendered", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const scroll = window.__scroll
      const { RepeatVirtual, node_append, o } = window.__ELT__
      const o_lst = o(Array.from({ length: 1000 }, (_, i) => i))
      const area = window.__area((area) => {
        const col = document.createElement("div")
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
      await window.__frames()
      const shadow = area.shadowRoot!
      const [top, bottom] = [...shadow.querySelectorAll("div")] as HTMLElement[]
      const rendered = area.querySelectorAll(".row").length
      const before = { top: top.getBoundingClientRect().height, bottom: bottom.getBoundingClientRect().height }
      await scroll(area, 5000)
      const after = { top: top.getBoundingClientRect().height, bottom: bottom.getBoundingClientRect().height }
      const light_divs = [...area.children].map((c) => c.tagName)
      return { rendered, before, after, scroll_height: area.scrollHeight, light_divs }
    })
    expect(res.rendered).toBeLessThan(100)
    expect(res.before.top).toBe(0)
    expect(res.before.bottom).toBeGreaterThan(10000)
    expect(res.after.top).toBeGreaterThan(4000)
    expect(res.scroll_height).toBeGreaterThan(19000)
    // Nothing but the user's own element in the light DOM.
    expect(res.light_divs).toEqual(["DIV"])
  })

  test("a packed container around the list gets no padders among its children", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { RepeatVirtual, node_append, o } = window.__ELT__
      let col!: HTMLElement
      window.__area((area) => {
        col = document.createElement("e-column")
        col.setAttribute("packed", "")
        node_append(
          col,
          RepeatVirtual(o(Array.from({ length: 50 }, (_, i) => i)), (o_i) =>
            Object.assign(document.createElement("div"), { className: "row", textContent: String(o_i.get()) }),
          ),
        )
        node_append(area, col)
      })
      await window.__frames()
      return [...col.children].every((c) => c.className === "row")
    })
    expect(res).toBe(true)
  })

  // elt reports an exception thrown by a connection callback with console.error rather than
  // letting it reach node_append's caller, so these tests read the logged errors.
  test("RepeatVirtual outside an e-virtual-scroll, or deeper than one level, reports an error", async ({ page }) => {
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
      const area_of = (child: HTMLElement) => {
        const a = document.createElement("e-virtual-scroll")
        a.style.height = "100px"
        a.append(child)
        return a
      }
      return {
        outside: attempt((h) => h),
        depth1: attempt((h) => area_of(h)),
        depth2: attempt((h) => {
          const mid = document.createElement("div")
          mid.append(h)
          return area_of(mid)
        }),
      }
    })
    expect(res.outside).toContain("must be a child of an <e-virtual-scroll>")
    expect(res.depth1).toBe("ok")
    expect(res.depth2).toContain("must be a child of an <e-virtual-scroll>")
  })

  test("a second RepeatVirtual in the same e-virtual-scroll reports an error", async ({ page }) => {
    const res = await page.evaluate(() => {
      const { RepeatVirtual, node_append, o } = window.__ELT__
      const area = document.createElement("e-virtual-scroll")
      area.style.height = "100px"
      const render = (o_i: any) => Object.assign(document.createElement("div"), { textContent: String(o_i.get()) })
      node_append(area, RepeatVirtual(o([1, 2]), render))
      node_append(area, RepeatVirtual(o([3, 4]), render))
      const errors: string[] = []
      const orig = console.error
      console.error = (...args: unknown[]) =>
        errors.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "))
      try {
        node_append(document.body, area)
      } finally {
        console.error = orig
      }
      return errors.join("\n") || "ok"
    })
    expect(res).toContain("already holds another RepeatVirtual")
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
      await window.__frames()
      const has = (cls: string) => area.querySelector(`.${cls}`) != null
      const at_top = { prefix: has("prefix"), suffix: has("suffix"), empty: has("empty") }
      await scroll(area, 4000)
      const middle = { prefix: has("prefix"), suffix: has("suffix") }
      await scroll(area, area.scrollHeight)
      await scroll(area, area.scrollHeight)
      const at_end = { prefix: has("prefix"), suffix: has("suffix") }
      o_lst.set([])
      await window.__frames()
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
      await window.__frames()
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
      await window.__frames()
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

  test("row 0 sits one 1px seam below the sticky header, and the grid draws no frame of its own", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const area = window.__area(window.__buildGrid)
      await window.__frames()
      const head = area.querySelector(".head")!.getBoundingClientRect()
      const row0 = area.querySelector(".row")!.getBoundingClientRect()
      const grid = getComputedStyle(area.querySelector("e-grid")!)
      return {
        seam: row0.top - head.bottom,
        label: area.querySelector(".row")!.textContent,
        grid_border: grid.borderTopWidth,
      }
    })
    expect(res.label).toBe("0bc")
    expect(res.seam).toBe(1)
    expect(res.grid_border).toBe("0px")
  })

  test("the view doesn't jump while the window changes", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const scroll = window.__scroll
      const area = window.__area(window.__buildGrid)
      await window.__frames()
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

test.describe("margins after a jump (regression: a jump used to land with no rows rendered above)", () => {
  // A jump (one scroll moving more than max(threshold, viewport)) re-renders the window from an
  // index estimate. It must land with rows rendered on both sides of the viewport: the sticky header
  // is held inside the grid's box, so with nothing rendered above, a scroll back up drawn before the
  // list catches up shows the header in the middle of the viewport.
  for (const item_size of [21, 64]) {
    test(`both margins are filled at rest after jumping down then up (estimate ${item_size}px, real 21px)`, async ({
      page,
    }) => {
      const res = await page.evaluate(async (item_size) => {
        const scroll = window.__scroll
        const area = window.__area((a) => window.__buildGrid(a, item_size))
        await window.__frames()
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

test.describe("ui Select (regression: its list used to get padders among its packed options)", () => {
  test("a long option list stays virtual in the popup, with only options in its packed column", async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { node_append, o, UI } = window.__ELT__
      const btn = UI.Select({
        model: o<number | undefined>(undefined),
        options: Array.from({ length: 2000 }, (_, i) => i),
      })
      node_append(document.body, btn)
      btn.click()
      await window.__frames(10)
      const area = document.querySelector("e-virtual-scroll[role=listbox]") as HTMLElement
      const col = area.querySelector("e-column")!
      const options = col.querySelectorAll("[role=option]").length
      const others = [...col.children].filter((c) => c.getAttribute("role") !== "option").length
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
      await window.__frames()
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
      await window.__frames(10)
      const area = document.querySelector("e-virtual-scroll") as HTMLElement
      const grid = area.querySelector("e-grid") as HTMLElement
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

test("removing the list from its e-virtual-scroll resets the padders", async ({ page }) => {
  const res = await page.evaluate(async () => {
    const { If, RepeatVirtual, node_append, o } = window.__ELT__
    const o_show = o(true)
    const area = window.__area((area) => {
      node_append(
        area,
        If(o_show, () =>
          RepeatVirtual(o(Array.from({ length: 1000 }, (_, i) => i)), (o_i) =>
            Object.assign(document.createElement("div"), { style: "height:20px", textContent: String(o_i.get()) }),
          ).ItemSize(20),
        ),
      )
    })
    await window.__frames()
    const [top, bottom] = [...area.shadowRoot!.querySelectorAll("div")] as HTMLElement[]
    const before = bottom.getBoundingClientRect().height
    o_show.set(false)
    return { before, top: top.getBoundingClientRect().height, bottom: bottom.getBoundingClientRect().height }
  })
  expect(res.before).toBeGreaterThan(1000)
  expect(res).toMatchObject({ top: 0, bottom: 0 })
})
