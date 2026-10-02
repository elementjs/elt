import { expect, test } from "@playwright/test"

const describe = test.describe

// The windowing algorithm in a real browser, with real geometry made deterministic: rows of a fixed
// height (ITEM_HEIGHT, also the list's estimate) in a scroll area of a fixed height. Geometry can't be
// faked: the list's IntersectionObserver reads the browser's own layout.
//
// Shared mount/measurement helpers are injected once per test via `page.addScriptTag` (real script
// evaluated in the page after the harness loads) instead of being re-declared inline in every single
// `page.evaluate` callback -- avoids ~17x duplication of a 70-line mount function. `declare global`
// below only types what this file itself injects; it does not touch tests/browser/harness.ts.

const ITEM_HEIGHT = 64
const VIEWPORT_HEIGHT = 300

type VirtualMountHandle = {
  o_lst: { get: () => string[]; set: (v: string[]) => void }
  scroller: HTMLElement
  content: HTMLElement
  instance: { item_size: number }
  scroll_to: (index: number) => Promise<void>
  visible_labels: () => string[]
  visible_count: () => number
  rendered_bottom: () => number
  tear_down: () => void
}

declare global {
  interface Window {
    /** Mounts a RepeatVirtual instance with deterministic row/scroller geometry (see file header). */
    __mountVirtual: (initial: string[], display_contents?: boolean) => VirtualMountHandle
    __flushFrames: (count?: number) => Promise<void>
    __labelsFromCount: (count: number, prefix?: string) => string[]
  }
}

const SETUP_SCRIPT = `
  window.__flushFrames = async function (count) {
    count = count || 8
    for (let i = 0; i < count; i++) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    }
  }

  window.__labelsFromCount = function (count, prefix) {
    prefix = prefix || "item"
    return Array.from({ length: count }, function (_, i) { return prefix + "-" + i })
  }

  function __elementsByClass(root, class_name) {
    const out = []
    function walk(n) {
      while (n) {
        if (n instanceof HTMLElement) {
          if (n.className === class_name) out.push(n)
          walk(n.firstChild)
        }
        n = n.nextSibling
      }
    }
    walk(root)
    return out
  }

  /** Rows ITEM_HEIGHT tall in a VIEWPORT_HEIGHT scroll area, threshold 100px.
   * When display_contents is true, rows are wrapped in a display:contents element with no box of its
   * own, exercising measureElement's descend-into-children fallback. */
  window.__mountVirtual = function (initial, display_contents) {
    const ITEM_HEIGHT = ${ITEM_HEIGHT}
    const VIEWPORT_HEIGHT = ${VIEWPORT_HEIGHT}
    const { RepeatVirtual, node_append, node_remove, o } = window.__ELT__

    const o_lst = o(initial.slice())

    const scroller = document.createElement("div")
    scroller.className = "scroll-host"
    scroller.style.height = VIEWPORT_HEIGHT + "px"
    scroller.style.overflow = "auto"

    const content = document.createElement("div")

    const scroller_instance = RepeatVirtual(o_lst, function (item, idx) {
      const row = document.createElement("div")
      row.className = "virtual-row"
      row.style.height = ITEM_HEIGHT + "px"
      row.style.overflow = "hidden"
      node_append(row, item)
      if (display_contents) {
        const wrapper = document.createElement("div")
        wrapper.style.display = "contents"
        node_append(wrapper, row)
        return wrapper
      }
      return row
    }).ItemSize(ITEM_HEIGHT).Threshold(100)

    node_append(content, scroller_instance)
    node_append(scroller, content)
    node_append(document.body, scroller)

    const visible_labels = function () {
      return __elementsByClass(content, "virtual-row").map(function (row) { return row.textContent || "" })
    }

    // Scrolls a row at a time (rows are ITEM_HEIGHT tall, the estimate is exact, so a row's
    // offset is index * ITEM_HEIGHT), letting the list follow, until the target or the end.
    const scroll_to = async function (index) {
      const target = Math.max(0, index) * ITEM_HEIGHT
      for (;;) {
        const current = scroller.scrollTop
        const delta = target - current
        if (Math.abs(delta) < 1) break
        scroller.scrollTop = current + (Math.abs(delta) <= ITEM_HEIGHT ? delta : Math.sign(delta) * ITEM_HEIGHT)
        scroller.dispatchEvent(new Event("scroll"))
        await window.__flushFrames(4)
        if (Math.abs(scroller.scrollTop - current) < 1) break // clamped at an end
      }
    }

    return {
      o_lst: o_lst,
      scroller: scroller,
      content: content,
      instance: scroller_instance,
      scroll_to: scroll_to,
      visible_labels: visible_labels,
      visible_count: function () { return __elementsByClass(content, "virtual-row").length },
      // Bottom of the last rendered row (the content's own box also holds the bottom padder).
      rendered_bottom: function () {
        const rows = __elementsByClass(content, "virtual-row")
        return rows[rows.length - 1].getBoundingClientRect().bottom
      },
      tear_down: function () { node_remove(scroller) },
    }
  }
`

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
  await page.addScriptTag({ content: SETUP_SCRIPT })
})

/** Visible rows must be a contiguous slice of the list, in order, without duplicates. */
function expectVisibleSlice(list: string[], labels: string[]) {
  expect(labels.length).toBeGreaterThan(0)
  expect(new Set(labels).size).toBe(labels.length)

  const start = list.indexOf(labels[0]!)
  expect(start).toBeGreaterThanOrEqual(0)
  expect(list.slice(start, start + labels.length)).toEqual(labels)
}

describe("RepeatVirtual", () => {
  describe("virtual rendering", () => {
    test("does not render every row for a long list", async ({ page }) => {
      const result = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(200))
        await window.__flushFrames()

        const visible_count = m.visible_count()
        const list = m.o_lst.get()
        const labels = m.visible_labels()
        m.tear_down()
        return { visible_count, list, labels }
      })

      expect(result.visible_count).toBeLessThan(200)
      expect(result.visible_count).toBeGreaterThan(0)
      expectVisibleSlice(result.list, result.labels)
    })

    test("renders only a window of rows after scrolling down", async ({ page }) => {
      const result = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(100))
        await window.__flushFrames()

        const initial_count = m.visible_count()
        await m.scroll_to(40)

        const visible_count = m.visible_count()
        const list = m.o_lst.get()
        const labels = m.visible_labels()
        m.tear_down()
        return { initial_count, visible_count, list, labels }
      })

      expect(result.visible_count).toBeLessThan(100)
      expect(result.visible_count).toBeGreaterThan(0)
      expect(result.visible_count).toBeLessThanOrEqual(result.initial_count + 5)
      expect(result.labels).toContain("item-40")
      expectVisibleSlice(result.list, result.labels)
    })

    test("updates the visible window when scrolling back up", async ({ page }) => {
      const result = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(80))
        await window.__flushFrames()

        await m.scroll_to(50)
        const mid = m.visible_labels()

        await m.scroll_to(5)
        const top = m.visible_labels()

        const list = m.o_lst.get()
        m.tear_down()
        return { mid, top, list }
      })

      expect(result.top).toContain("item-5")
      expect(result.top).not.toEqual(result.mid)
      expectVisibleSlice(result.list, result.top)
    })

    test("measures rows wrapped in display:contents", async ({ page }) => {
      const result = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(100), true)
        await window.__flushFrames()

        const first_visible_count = m.visible_count()
        const list1 = m.o_lst.get()
        const labels1 = m.visible_labels()

        await m.scroll_to(40)
        const labels2 = m.visible_labels()
        const list2 = m.o_lst.get()

        // Full-coverage sweep: scroll through every index, recording each step's visible slice.
        const list = m.o_lst.get()
        const steps: { index: number; labels: string[] }[] = []
        for (let index = 0; index < list.length; index++) {
          await m.scroll_to(index)
          steps.push({ index, labels: m.visible_labels() })
        }

        m.tear_down()
        return { first_visible_count, list1, labels1, labels2, list2, list, steps }
      })

      expect(result.first_visible_count).toBeLessThan(100)
      expect(result.first_visible_count).toBeGreaterThan(0)
      expectVisibleSlice(result.list1, result.labels1)

      expect(result.labels2).toContain("item-40")
      expectVisibleSlice(result.list2, result.labels2)

      // expect_full_coverage: every entry must appear at least once across the sweep, and each step's
      // visible rows must be a contiguous, in-order, duplicate-free slice.
      const seen = new Set<string>()
      for (const step of result.steps) {
        for (const label of step.labels) {
          seen.add(label)
          expect(result.list).toContain(label)
        }
        expectVisibleSlice(result.list, step.labels)
      }
      expect([...seen].sort()).toEqual([...result.list].sort())
    })
  })

  describe("list deletion", () => {
    test("clears rows when the list becomes empty", async ({ page }) => {
      const result = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(30))
        await window.__flushFrames()

        m.o_lst.set([])
        await window.__flushFrames()

        const visible_count = m.visible_count()
        const labels = m.visible_labels()
        m.tear_down()
        return { visible_count, labels }
      })

      expect(result.visible_count).toBe(0)
      expect(result.labels).toEqual([])
    })

    test("removes trailing rows when the list shrinks", async ({ page }) => {
      const result = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(40))
        await window.__flushFrames()
        await m.scroll_to(10)

        m.o_lst.set(window.__labelsFromCount(15))
        await window.__flushFrames()
        await m.scroll_to(0)

        const list = m.o_lst.get()
        const labels = m.visible_labels()
        m.tear_down()
        return { list, labels }
      })

      expectVisibleSlice(result.list, result.labels)
      for (const label of result.labels) {
        expect(label).toMatch(/^item-(?:[0-9]|1[0-4])$/)
      }
    })

    test("handles deleting a middle item while scrolled", async ({ page }) => {
      const result = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(25))
        await window.__flushFrames()
        await m.scroll_to(12)

        const next = m.o_lst.get().filter((_, i) => i !== 10)
        m.o_lst.set(next)
        await window.__flushFrames()
        await m.scroll_to(10)

        const list = m.o_lst.get()
        const labels = m.visible_labels()

        const steps: { index: number; labels: string[] }[] = []
        for (let index = 0; index < list.length; index++) {
          await m.scroll_to(index)
          steps.push({ index, labels: m.visible_labels() })
        }

        m.tear_down()
        return { list, labels, steps }
      })

      expectVisibleSlice(result.list, result.labels)
      expect(result.list).not.toContain("item-10")

      const seen = new Set<string>()
      for (const step of result.steps) {
        for (const label of step.labels) {
          seen.add(label)
          expect(result.list).toContain(label)
        }
        expectVisibleSlice(result.list, step.labels)
      }
      expect([...seen].sort()).toEqual([...result.list].sort())
    })

    test("handles deleting several random items", async ({ page }) => {
      const result = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(50))
        await window.__flushFrames()

        const remove = new Set([3, 17, 22, 31, 44])
        const next = m.o_lst.get().filter((_, i) => !remove.has(i))
        m.o_lst.set(next)
        await window.__flushFrames()

        const list = m.o_lst.get()
        const steps: { index: number; labels: string[] }[] = []
        for (let index = 0; index < list.length; index++) {
          await m.scroll_to(index)
          steps.push({ index, labels: m.visible_labels() })
        }

        m.tear_down()
        return { list, steps }
      })

      const seen = new Set<string>()
      for (const step of result.steps) {
        for (const label of step.labels) {
          seen.add(label)
          expect(result.list).toContain(label)
        }
        expectVisibleSlice(result.list, step.labels)
      }
      expect([...seen].sort()).toEqual([...result.list].sort())
    })
  })

  describe("reordering and replacement", () => {
    test("shows reversed order after scrolling to the top", async ({ page }) => {
      const result = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(30))
        await window.__flushFrames()
        await m.scroll_to(15)

        m.o_lst.set([...m.o_lst.get()].reverse())
        await window.__flushFrames()
        await m.scroll_to(0)

        const list = m.o_lst.get()
        const labels = m.visible_labels()
        m.tear_down()
        return { list, labels }
      })

      expectVisibleSlice(result.list, result.labels)
      expect(result.labels[0]).toBe("item-29")
    })

    test("shows swapped elements in the new order", async ({ page }) => {
      const labels = await page.evaluate(async () => {
        const m = window.__mountVirtual(["a", "b", "c", "d", "e", "f"])
        await window.__flushFrames()

        m.o_lst.set(["f", "e", "d", "c", "b", "a"])
        await window.__flushFrames()
        await m.scroll_to(0)

        const labels = m.visible_labels()
        m.tear_down()
        return labels
      })

      expect(labels).toEqual(["f", "e", "d", "c", "b", "a"])
    })

    test("replaces the whole list and keeps a single visible row", async ({ page }) => {
      const result = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(20))
        await window.__flushFrames()
        await m.scroll_to(12)
        await m.scroll_to(0)

        m.o_lst.set(["solo"])
        await window.__flushFrames()

        const labels = m.visible_labels()
        const visible_count = m.visible_count()
        m.tear_down()
        return { labels, visible_count }
      })

      expect(result.labels).toEqual(["solo"])
      expect(result.visible_count).toBe(1)
    })

    test("moves an item from the head to the tail", async ({ page }) => {
      const labels = await page.evaluate(async () => {
        const m = window.__mountVirtual(["a", "b", "c", "d", "e"])
        await window.__flushFrames()

        m.o_lst.set(["b", "c", "d", "e", "a"])
        await window.__flushFrames()
        await m.scroll_to(0)

        const labels = m.visible_labels()
        m.tear_down()
        return labels
      })

      expect(labels).toEqual(["b", "c", "d", "e", "a"])
    })
  })

  describe("integrity while scrolling", () => {
    test("never shows duplicate rows in the same viewport", async ({ page }) => {
      const label_sets = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(120))
        await window.__flushFrames()

        const label_sets: string[][] = []
        for (const index of [0, 15, 40, 75, 100]) {
          await m.scroll_to(index)
          label_sets.push(m.visible_labels())
        }

        m.tear_down()
        return label_sets
      })

      for (const labels of label_sets) {
        expect(new Set(labels).size).toBe(labels.length)
      }
    })

    test("covers every list item when scrolling through the full range", async ({ page }) => {
      const result = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(60))
        await window.__flushFrames()

        const list = m.o_lst.get()
        const steps: { index: number; labels: string[] }[] = []
        for (let index = 0; index < list.length; index++) {
          await m.scroll_to(index)
          steps.push({ index, labels: m.visible_labels() })
        }

        m.tear_down()
        return { list, steps }
      })

      const seen = new Set<string>()
      for (const step of result.steps) {
        for (const label of step.labels) {
          seen.add(label)
          expect(result.list).toContain(label)
        }
        expectVisibleSlice(result.list, step.labels)
      }
      expect([...seen].sort()).toEqual([...result.list].sort())
    })

    test("reads no row while scrolling within the margins, and refills a short one in one change", async ({ page }) => {
      const res = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(200))
        await window.__flushFrames()

        // Rows read (a pass reading only the viewport and the content's two edges is fine: the
        // observer also reports an edge leaving its zone).
        let reads = 0
        const original = Element.prototype.getBoundingClientRect
        Element.prototype.getBoundingClientRect = function (this: Element) {
          if (this.classList.contains("virtual-row")) reads++
          return original.call(this)
        }
        const windows = new Set<string>()
        const record = () => windows.add(m.visible_labels()[0] + ".." + m.visible_labels().at(-1))
        record()
        const start = m.visible_labels()

        // Threshold 100: the bottom edge is reported once it comes within 50px of the viewport.
        // Scrolling by small steps until just before that point reads no row.
        const room = m.rendered_bottom() - m.scroller.getBoundingClientRect().bottom
        reads = 0
        for (let st = 8; st < room - 60; st += 8) {
          m.scroller.scrollTop = st
          m.scroller.dispatchEvent(new Event("scroll"))
          await window.__flushFrames(1)
        }
        const reads_within = reads
        const same_window = m.visible_labels().join() === start.join()

        // Crossing it refills the margin to the threshold in a single window change.
        m.scroller.scrollTop = room - 30
        m.scroller.dispatchEvent(new Event("scroll"))
        for (let i = 0; i < 6; i++) {
          await window.__flushFrames(1)
          record()
        }
        Element.prototype.getBoundingClientRect = original
        const below = m.rendered_bottom() - m.scroller.getBoundingClientRect().bottom
        m.tear_down()
        return { reads_within, same_window, windows: windows.size, below }
      })

      expect(res.reads_within).toBe(0)
      expect(res.same_window).toBe(true)
      expect(res.windows).toBe(2)
      expect(res.below).toBeGreaterThanOrEqual(100)
    })

    test("an edge stopping exactly on the observer's line still gets refilled (regression)", async ({ page }) => {
      const res = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(200))
        await window.__flushFrames()
        const below = () => m.rendered_bottom() - m.scroller.getBoundingClientRect().bottom
        // Threshold 100: the observer's line is 50px below the viewport, and it counts an edge
        // lying exactly on it as inside. Bring the content's bottom edge exactly there, in steps
        // shorter than a jump (the viewport, 300px).
        const exact = m.scroller.scrollTop + below() - 50
        for (const st of [exact - 250, exact - 120, exact]) {
          m.scroller.scrollTop = st
          m.scroller.dispatchEvent(new Event("scroll"))
          await window.__flushFrames(3)
        }
        const on_line = below()
        // Then on past it: the list must follow, not leave the viewport's bottom blank.
        for (let i = 1; i <= 6; i++) {
          m.scroller.scrollTop = exact + i * 30
          m.scroller.dispatchEvent(new Event("scroll"))
          await window.__flushFrames(3)
        }
        const after = below()
        m.tear_down()
        return { on_line, after }
      })
      expect(res.on_line).toBeGreaterThanOrEqual(50)
      expect(res.after).toBeGreaterThanOrEqual(50)
    })

    test("keeps the row-height estimate stable on uniform rows", async ({ page }) => {
      const item_sizes = await page.evaluate(async () => {
        const m = window.__mountVirtual(window.__labelsFromCount(120))
        await window.__flushFrames()

        // Rows are all exactly ITEM_HEIGHT: the damped, 1px-thresholded estimate
        // must not drift (drift is what jitters the padders and the scrollbar).
        const item_sizes: number[] = []
        for (const index of [10, 30, 60, 90, 30, 0]) {
          await m.scroll_to(index)
          item_sizes.push(m.instance.item_size)
        }

        m.tear_down()
        return item_sizes
      })

      for (const size of item_sizes) {
        expect(size).toBe(ITEM_HEIGHT)
      }
    })

    test("stays consistent after grow-shrink-update cycles", async ({ page }) => {
      const results = await page.evaluate(async () => {
        const m = window.__mountVirtual(["a"])
        await window.__flushFrames()

        const out: { list: string[]; labels: string[] }[] = []
        for (let round = 0; round < 4; round++) {
          m.o_lst.set(["a", "b", "c", "d", "e"])
          await window.__flushFrames()
          out.push({ list: m.o_lst.get(), labels: m.visible_labels() })

          m.o_lst.set(["x"])
          await window.__flushFrames()
          out.push({ list: m.o_lst.get(), labels: m.visible_labels() })

          m.o_lst.set(["p", "q", "r"])
          await window.__flushFrames()
          out.push({ list: m.o_lst.get(), labels: m.visible_labels() })
        }

        m.tear_down()
        return out
      })

      // Each round produces 3 entries: [grow-to-5, shrink-to-1, replace-with-3].
      for (let round = 0; round < 4; round++) {
        const [grown, shrunk, replaced] = results.slice(round * 3, round * 3 + 3)
        expectVisibleSlice(grown!.list, grown!.labels)
        expect(shrunk!.labels).toEqual(["x"])
        expect(replaced!.labels).toEqual(["p", "q", "r"])
      }
    })
  })
})
