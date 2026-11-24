import { expect, test } from "./fixture"
import { VIRTUAL_MOUNT, type VMountOpts } from "./virtual-mount"

// RepeatCircular: a ring over the list, rows of varying sizes, along either axis.

test.beforeEach(async ({ page }) => {
  await page.addScriptTag({ content: VIRTUAL_MOUNT })
})

/** Whether `labels` (`item-N`) follow each other around a ring of `n` items. */
function cyclic(labels: string[], n: number) {
  for (let k = 1; k < labels.length; k++) {
    const prev = Number(labels[k - 1]!.split("-")[1])
    const next = Number(labels[k]!.split("-")[1])
    if (next !== (prev + 1) % n) return false
  }
  return labels.length > 0
}

const AXES: [string, Partial<VMountOpts>][] = [
  ["vertical", {}],
  ["horizontal", { horizontal: true }],
  ["horizontal right-to-left", { horizontal: true, rtl: true }],
]

for (const [name, axis] of AXES) {
  test(`RepeatCircular, ${name}: scrolls past the last item into the first, and back, rows staying in place`, async ({
    page,
  }) => {
    const r = await page.evaluate(async (axis) => {
      const m = window.__vmount({ count: 20, circular: true, ...axis })
      await window.__ELT__.frames(6)
      const start = m.first_visible()
      const rendered: string[][] = []
      let worst = 0
      // Forward through more than two turns, then back through more than two.
      for (const step of [...Array(60).fill(60), ...Array(120).fill(-60)]) {
        const before = m.first_visible()
        await m.scroll_by(step, 60)
        const after = before == null ? null : m.offset_of(before.label)
        if (before != null && after != null) worst = Math.max(worst, Math.abs(after - (before.offset - step)))
        rendered.push(m.rendered())
      }
      const end = m.first_visible()
      m.tear_down()
      return { start, rendered, worst, end }
    }, axis)
    expect(r.start).toEqual({ label: "item-0", offset: 0 })
    for (const labels of r.rendered) expect(cyclic(labels, 20)).toBe(true)
    // Seen past both ends of the list.
    expect(r.rendered.some((l) => l.includes("item-19") && l.includes("item-0"))).toBe(true)
    expect(r.worst).toBeLessThan(1)
    expect(r.end).not.toBeNull()
  })
}

test("RepeatCircular: a list shorter than the visible area shows its items several times, in order", async ({
  page,
}) => {
  const labels = await page.evaluate(async () => {
    const m = window.__vmount({ count: 3, circular: true, fixed: 30 })
    await window.__ELT__.frames(6)
    const out = m.rendered()
    m.tear_down()
    return out
  })
  expect(labels.filter((l) => l === "item-0").length).toBeGreaterThan(3)
  expect(cyclic(labels, 3)).toBe(true)
})

test("RepeatCircular: a long scroll lands among rows, and once scrolling stops the runway is back", async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const { frames } = window.__ELT__
    const m = window.__vmount({ count: 50, circular: true })
    await frames(6)
    const scroll_start = m.scroll()
    // A scroll farther than the visible area is a jump: the window is put back around the new
    // position. The browser reports `scrollend` after it, and the list recentres.
    m.area.scrollTop += 400_000
    await frames(6)
    await new Promise((res) => setTimeout(res, 300))
    await frames(4)
    const first = m.first_visible()
    const out = {
      first_offset: first?.offset ?? null,
      padder: m.instance.o_padding_start.get(),
      moved: Math.abs(m.scroll() - scroll_start),
    }
    m.tear_down()
    return out
  })
  expect(r.padder).toBe(1_000_000)
  expect(r.moved).toBeLessThan(2000)
  // The visible area starts on a row, not on a padder.
  expect(r.first_offset).not.toBeNull()
  expect(r.first_offset!).toBeLessThanOrEqual(0)
})

test("RepeatCircular: recentring leaves the visible rows where they are", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { frames } = window.__ELT__
    const m = window.__vmount({ count: 50, circular: true })
    await frames(6)
    // A start padder far from its runway, as after a long scroll without stopping.
    m.instance.o_padding_start.set(1_400_000)
    m.instance.scroll_by(400_000)
    await frames(2)
    const before = m.first_visible()
    m.area.dispatchEvent(new Event("scrollend"))
    await frames(2)
    const after = before == null ? null : m.offset_of(before.label)
    const out = { before, after, padder: m.instance.o_padding_start.get() }
    m.tear_down()
    return out
  })
  expect(r.padder).toBe(1_000_000)
  expect(Math.abs((r.after ?? 99) - (r.before?.offset ?? 0))).toBeLessThan(1)
})

test("RepeatCircular: setPosition lands on the nearest occurrence of the item", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { frames } = window.__ELT__
    const m = window.__vmount({ count: 10, circular: true })
    await frames(6)
    const s0 = m.scroll()
    m.instance.setPosition(9)
    await frames(6)
    const first = m.first_visible()
    const back = s0 - m.scroll()
    m.instance.setPosition(-2)
    await frames(6)
    const minus = m.first_visible()?.label
    m.tear_down()
    return { first, back, minus }
  })
  // item-9 is the one right before item-0: one row back, not nine rows on.
  expect(r.first?.label).toBe("item-9")
  expect(Math.abs(r.first?.offset ?? 99)).toBeLessThan(1)
  expect(r.back).toBeGreaterThan(0)
  // Nine rows on would be about 600px.
  expect(r.back).toBeLessThan(300)
  expect(r.minus).toBe("item-8")
})

test("RepeatCircular: items prepended or appended keep the visible rows on their items", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { frames } = window.__ELT__
    const m = window.__vmount({ count: 30, circular: true, initial: 12 })
    await frames(6)
    await m.scroll_by(23)
    const before = m.first_visible()
    m.o_lst.set([...Array.from({ length: 7 }, (_, i) => `new-${i}`), ...m.o_lst.get()])
    await frames(6)
    const after_prepend = before == null ? null : m.offset_of(before.label)
    m.o_lst.set([...m.o_lst.get(), "more-0", "more-1"])
    await frames(6)
    const after_append = before == null ? null : m.offset_of(before.label)
    const first = m.first_visible()?.label
    m.tear_down()
    return { before, after_prepend, after_append, first }
  })
  expect(r.before?.label).toBe("item-12")
  expect(Math.abs((r.after_prepend ?? 99) - (r.before?.offset ?? 0))).toBeLessThan(1)
  expect(Math.abs((r.after_append ?? 99) - (r.before?.offset ?? 0))).toBeLessThan(1)
  expect(r.first).toBe("item-12")
})

test("RepeatCircular: itemAt and the render function get the item's index in the list", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { RepeatCircular, node_append, node_remove, o, frames } = window.__ELT__
    const area = document.createElement("div")
    area.style.cssText = "height: 100px; overflow-y: auto"
    const content = document.createElement("div")
    node_append(
      content,
      RepeatCircular(o(["a", "b", "c"]), (o_item, oo_index) => {
        const row = document.createElement("div")
        row.className = "row"
        row.style.height = "20px"
        node_append(
          row,
          o.expression((get) => `${get(o_item)}${get(oo_index)}`),
        )
        return row
      }).InitialPosition(1),
    )
    node_append(area, content)
    node_append(document.body, area)
    await frames(6)
    const labels = Array.from(area.querySelectorAll(".row")).map((r) => r.textContent)
    const out = { labels }
    node_remove(area)
    return out
  })
  expect(new Set(r.labels)).toEqual(new Set(["a0", "b1", "c2"]))
})

test("RepeatCircular: an empty list shows DisplayWhenEmpty, then its rows once filled", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { frames } = window.__ELT__
    const m = window.__vmount({
      count: 0,
      circular: true,
      initial: 2,
      configure: (rv) =>
        rv.DisplayWhenEmpty(() => {
          const e = document.createElement("p")
          e.className = "empty"
          e.textContent = "nothing"
          return e
        }),
    })
    await frames(4)
    const empty = m.content.querySelector(".empty")?.textContent ?? null
    m.o_lst.set(["item-0", "item-1", "item-2", "item-3"])
    await frames(6)
    const out = { empty, gone: m.content.querySelector(".empty") == null, first: m.first_visible()?.label }
    m.tear_down()
    return out
  })
  expect(r).toEqual({ empty: "nothing", gone: true, first: "item-2" })
})

test("RepeatCircular: where the browser has no scrollend, it recentres once scroll events stop", async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { frames } = window.__ELT__
    // A browser without `scrollend` (Safari before it had it).
    delete (Window.prototype as { onscrollend?: unknown }).onscrollend
    delete (window as { onscrollend?: unknown }).onscrollend
    const supported = "onscrollend" in window
    const m = window.__vmount({ count: 50, circular: true })
    await frames(6)
    m.instance.o_padding_start.set(1_400_000)
    m.instance.scroll_by(400_000)
    await frames(2)
    const before = m.first_visible()
    m.area.dispatchEvent(new Event("scroll"))
    await new Promise((res) => setTimeout(res, 300))
    await frames(2)
    const after = before == null ? null : m.offset_of(before.label)
    const out = { supported, before, after, padder: m.instance.o_padding_start.get() }
    m.tear_down()
    return out
  })
  expect(r.supported).toBe(false)
  expect(r.padder).toBe(1_000_000)
  expect(Math.abs((r.after ?? 99) - (r.before?.offset ?? 0))).toBeLessThan(1)
})

test("RepeatCircular: writing through a row's item writes the list's item at its index, on any turn", async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const { RepeatCircular, node_append, node_remove, o, frames } = window.__ELT__
    const o_lst = o(["a", "b", "c"])
    const items: { o_item: { set(v: string): void }; label: () => string }[] = []
    const area = document.createElement("div")
    area.style.cssText = "height: 100px; overflow-y: auto"
    const content = document.createElement("div")
    node_append(
      content,
      RepeatCircular(o_lst, (o_item) => {
        const row = document.createElement("div")
        row.style.height = "20px"
        node_append(row, o_item)
        items.push({ o_item, label: () => row.textContent ?? "" })
        return row
      }),
    )
    node_append(area, content)
    node_append(document.body, area)
    await frames(6)
    // The last row made showing "b": a later turn of the ring than the first one.
    const row = [...items].reverse().find((it) => it.label() === "b")!
    row.o_item.set("B")
    await frames(2)
    const out = o_lst.get()
    node_remove(area)
    return out
  })
  expect(r).toEqual(["a", "B", "c"])
})
