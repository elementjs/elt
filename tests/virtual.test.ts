import "./setup.ts"

import { test, expect, describe } from "bun:test"

import { o } from "../src/observable"
import { VirtualScroll, VirtualScroller } from "../src/virtual"
import { node_append, node_remove } from "../src/dom"

const ITEM_HEIGHT = 64
const VIEWPORT_HEIGHT = 300

type MountResult = {
  o_lst: o.Observable<string[]>
  scroller: HTMLElement
  content: HTMLElement
  instance: VirtualScroller<o.Observable<string[]>>
  scroll_to: (index: number) => Promise<void>
  visible_labels: () => string[]
  visible_count: () => number
  tear_down: () => void
}

function make_rect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    left: 0,
    right: 200,
    width: 200,
    height,
    x: 0,
    y: top,
    toJSON() {
      return this
    },
  } as DOMRect
}

function elements_by_class(root: Node, class_name: string) {
  const out: HTMLElement[] = []
  const walk = (n: Node | null) => {
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

async function flush_frames(count = 8) {
  for (let i = 0; i < count; i++) {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }
}

/** Fake row layout: each item is ITEM_HEIGHT tall; scrollTop shifts viewport. */
function mount_virtual_scroll(initial: string[]): MountResult {
  const o_lst = o([...initial])

  const scroller = document.createElement("div")
  scroller.className = "scroll-host"
  Object.defineProperty(scroller, "clientHeight", {
    value: VIEWPORT_HEIGHT,
    configurable: true,
  })

  let scroll_top = 0
  Object.defineProperty(scroller, "scrollTop", {
    get: () => scroll_top,
    set: (value: number) => {
      scroll_top = value
    },
    configurable: true,
  })
  scroller.getBoundingClientRect = () => make_rect(0, VIEWPORT_HEIGHT)

  const content = document.createElement("div")

  const scroller_instance = VirtualScroll(o_lst, (item, idx) => {
    const row = document.createElement("div")
    row.className = "virtual-row"
    row.getBoundingClientRect = () => {
      const index = idx.get()
      // Item i sits at i * item_height in scroll content; padding already accounts for pos_start.
      const top = index * ITEM_HEIGHT - scroll_top
      return make_rect(top, ITEM_HEIGHT)
    }
    node_append(row, item)
    return row
  }).configure(v => {
    v.item_size = ITEM_HEIGHT
    v.threshold = 100
    v.overflow_parent = scroller
    v.prev_parent = content
  })

  node_append(content, scroller_instance)
  node_append(scroller, content)
  node_append(document.body, scroller)

  const visible_labels = () =>
    elements_by_class(content, "virtual-row").map(row => row.textContent ?? "")

  const scroll_to = async (index: number) => {
    const target = Math.max(0, index) * ITEM_HEIGHT
    while (scroll_top !== target) {
      const delta = target - scroll_top
      scroll_top += Math.abs(delta) <= ITEM_HEIGHT ? delta : Math.sign(delta) * ITEM_HEIGHT
      // VirtualScroll may ignore one scroll event while it stabilizes layout.
      scroller.dispatchEvent(new Event("scroll"))
      scroller.dispatchEvent(new Event("scroll"))
      await flush_frames(4)
    }
  }

  return {
    o_lst,
    scroller,
    content,
    instance: scroller_instance,
    scroll_to,
    visible_labels,
    visible_count: () => elements_by_class(content, "virtual-row").length,
    tear_down: () => node_remove(scroller),
  }
}

/** Same as mount_virtual_scroll but rows use a display:contents wrapper (no layout box). */
function mount_virtual_scroll_display_contents(initial: string[]): MountResult {
  const o_lst = o([...initial])

  const scroller = document.createElement("div")
  scroller.className = "scroll-host"
  Object.defineProperty(scroller, "clientHeight", {
    value: VIEWPORT_HEIGHT,
    configurable: true,
  })

  let scroll_top = 0
  Object.defineProperty(scroller, "scrollTop", {
    get: () => scroll_top,
    set: (value: number) => {
      scroll_top = value
    },
    configurable: true,
  })
  scroller.getBoundingClientRect = () => make_rect(0, VIEWPORT_HEIGHT)

  const content = document.createElement("div")

  const scroller_instance = VirtualScroll(o_lst, (item, idx) => {
    const wrapper = document.createElement("div")
    wrapper.style.display = "contents"
    wrapper.getBoundingClientRect = () => make_rect(0, 0)

    const row = document.createElement("div")
    row.className = "virtual-row"
    row.getBoundingClientRect = () => {
      const index = idx.get()
      const top = index * ITEM_HEIGHT - scroll_top
      return make_rect(top, ITEM_HEIGHT)
    }
    node_append(row, item)
    node_append(wrapper, row)
    return wrapper
  }).configure(v => {
    v.item_size = ITEM_HEIGHT
    v.threshold = 100
    v.overflow_parent = scroller
    v.prev_parent = content
  })

  node_append(content, scroller_instance)
  node_append(scroller, content)
  node_append(document.body, scroller)

  const visible_labels = () =>
    elements_by_class(content, "virtual-row").map(row => row.textContent ?? "")

  const scroll_to = async (index: number) => {
    const target = Math.max(0, index) * ITEM_HEIGHT
    while (scroll_top !== target) {
      const delta = target - scroll_top
      scroll_top += Math.abs(delta) <= ITEM_HEIGHT ? delta : Math.sign(delta) * ITEM_HEIGHT
      scroller.dispatchEvent(new Event("scroll"))
      scroller.dispatchEvent(new Event("scroll"))
      await flush_frames(4)
    }
  }

  return {
    o_lst,
    scroller,
    content,
    instance: scroller_instance,
    scroll_to,
    visible_labels,
    visible_count: () => elements_by_class(content, "virtual-row").length,
    tear_down: () => node_remove(scroller),
  }
}

function labels_from_count(count: number, prefix = "item") {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i}`)
}

/** Visible rows must be a contiguous slice of the list, in order, without duplicates. */
function expect_visible_slice(list: string[], labels: string[]) {
  expect(labels.length).toBeGreaterThan(0)
  expect(new Set(labels).size).toBe(labels.length)

  const start = list.indexOf(labels[0]!)
  expect(start).toBeGreaterThanOrEqual(0)
  expect(list.slice(start, start + labels.length)).toEqual(labels)
}

/** Scroll through the list and ensure every entry appears at least once. */
async function expect_full_coverage(mount: MountResult, list: string[]) {
  if (list.length === 0) {
    expect(mount.visible_count()).toBe(0)
    return
  }

  const seen = new Set<string>()
  for (let index = 0; index < list.length; index++) {
    await mount.scroll_to(index)
    for (const label of mount.visible_labels()) {
      seen.add(label)
      expect(list).toContain(label)
    }
    expect_visible_slice(list, mount.visible_labels())
  }
  for (const label of mount.visible_labels()) {
    seen.add(label)
  }

  expect([...seen].sort()).toEqual([...list].sort())
}

describe("VirtualScroll", () => {
  describe("virtual rendering", () => {
    test("does not render every row for a long list", async () => {
      const mount = mount_virtual_scroll(labels_from_count(200))
      await flush_frames()

      expect(mount.visible_count()).toBeLessThan(200)
      expect(mount.visible_count()).toBeGreaterThan(0)
      expect_visible_slice(mount.o_lst.get(), mount.visible_labels())

      mount.tear_down()
    })

    test("renders only a window of rows after scrolling down", async () => {
      const mount = mount_virtual_scroll(labels_from_count(100))
      await flush_frames()

      const initial_count = mount.visible_count()
      await mount.scroll_to(40)

      expect(mount.visible_count()).toBeLessThan(100)
      expect(mount.visible_count()).toBeGreaterThan(0)
      expect(mount.visible_count()).toBeLessThanOrEqual(initial_count + 5)
      expect(mount.visible_labels()).toContain("item-40")
      expect_visible_slice(mount.o_lst.get(), mount.visible_labels())

      mount.tear_down()
    })

    test("updates the visible window when scrolling back up", async () => {
      const mount = mount_virtual_scroll(labels_from_count(80))
      await flush_frames()

      await mount.scroll_to(50)
      const mid = mount.visible_labels()

      await mount.scroll_to(5)
      const top = mount.visible_labels()

      expect(top).toContain("item-5")
      expect(top).not.toEqual(mid)
      expect_visible_slice(mount.o_lst.get(), top)

      mount.tear_down()
    })

    test("measures rows wrapped in display:contents", async () => {
      const mount = mount_virtual_scroll_display_contents(labels_from_count(100))
      await flush_frames()

      expect(mount.visible_count()).toBeLessThan(100)
      expect(mount.visible_count()).toBeGreaterThan(0)
      expect_visible_slice(mount.o_lst.get(), mount.visible_labels())

      await mount.scroll_to(40)
      expect(mount.visible_labels()).toContain("item-40")
      expect_visible_slice(mount.o_lst.get(), mount.visible_labels())

      await expect_full_coverage(mount, mount.o_lst.get())

      mount.tear_down()
    })
  })

  describe("list deletion", () => {
    test("clears rows when the list becomes empty", async () => {
      const mount = mount_virtual_scroll(labels_from_count(30))
      await flush_frames()

      mount.o_lst.set([])
      await flush_frames()

      expect(mount.visible_count()).toBe(0)
      expect(mount.visible_labels()).toEqual([])

      mount.tear_down()
    })

    test("removes trailing rows when the list shrinks", async () => {
      const mount = mount_virtual_scroll(labels_from_count(40))
      await flush_frames()
      await mount.scroll_to(10)

      mount.o_lst.set(labels_from_count(15))
      await flush_frames()
      await mount.scroll_to(0)

      expect_visible_slice(mount.o_lst.get(), mount.visible_labels())
      for (const label of mount.visible_labels()) {
        expect(label).toMatch(/^item-(?:[0-9]|1[0-4])$/)
      }

      mount.tear_down()
    })

    test("handles deleting a middle item while scrolled", async () => {
      const mount = mount_virtual_scroll(labels_from_count(25))
      await flush_frames()
      await mount.scroll_to(12)

      const next = mount.o_lst.get().filter((_, i) => i !== 10)
      mount.o_lst.set(next)
      await flush_frames()
      await mount.scroll_to(10)

      expect_visible_slice(mount.o_lst.get(), mount.visible_labels())
      expect(mount.o_lst.get()).not.toContain("item-10")
      await expect_full_coverage(mount, mount.o_lst.get())

      mount.tear_down()
    })

    test("handles deleting several random items", async () => {
      const mount = mount_virtual_scroll(labels_from_count(50))
      await flush_frames()

      const remove = new Set([3, 17, 22, 31, 44])
      const next = mount.o_lst.get().filter((_, i) => !remove.has(i))
      mount.o_lst.set(next)
      await flush_frames()

      await expect_full_coverage(mount, mount.o_lst.get())

      mount.tear_down()
    })
  })

  describe("reordering and replacement", () => {
    test("shows reversed order after scrolling to the top", async () => {
      const mount = mount_virtual_scroll(labels_from_count(30))
      await flush_frames()
      await mount.scroll_to(15)

      mount.o_lst.set([...mount.o_lst.get()].reverse())
      await flush_frames()
      await mount.scroll_to(0)

      expect_visible_slice(mount.o_lst.get(), mount.visible_labels())
      expect(mount.visible_labels()[0]).toBe("item-29")

      mount.tear_down()
    })

    test("shows swapped elements in the new order", async () => {
      const mount = mount_virtual_scroll(["a", "b", "c", "d", "e", "f"])
      await flush_frames()

      mount.o_lst.set(["f", "e", "d", "c", "b", "a"])
      await flush_frames()
      await mount.scroll_to(0)

      expect(mount.visible_labels()).toEqual(["f", "e", "d", "c", "b", "a"])

      mount.tear_down()
    })

    test("replaces the whole list and keeps a single visible row", async () => {
      const mount = mount_virtual_scroll(labels_from_count(20))
      await flush_frames()
      await mount.scroll_to(12)
      await mount.scroll_to(0)

      mount.o_lst.set(["solo"])
      await flush_frames()

      expect(mount.visible_labels()).toEqual(["solo"])
      expect(mount.visible_count()).toBe(1)

      mount.tear_down()
    })

    test("moves an item from the head to the tail", async () => {
      const mount = mount_virtual_scroll(["a", "b", "c", "d", "e"])
      await flush_frames()

      mount.o_lst.set(["b", "c", "d", "e", "a"])
      await flush_frames()
      await mount.scroll_to(0)

      expect(mount.visible_labels()).toEqual(["b", "c", "d", "e", "a"])

      mount.tear_down()
    })
  })

  describe("integrity while scrolling", () => {
    test("never shows duplicate rows in the same viewport", async () => {
      const mount = mount_virtual_scroll(labels_from_count(120))
      await flush_frames()

      for (const index of [0, 15, 40, 75, 100]) {
        await mount.scroll_to(index)
        const labels = mount.visible_labels()
        expect(new Set(labels).size).toBe(labels.length)
      }

      mount.tear_down()
    })

    test("covers every list item when scrolling through the full range", async () => {
      const mount = mount_virtual_scroll(labels_from_count(60))
      await flush_frames()
      await expect_full_coverage(mount, mount.o_lst.get())
      mount.tear_down()
    })

    test("measures layout at most once per animation frame (no thrash)", async () => {
      const mount = mount_virtual_scroll(labels_from_count(200))
      await flush_frames()

      // measureWindow() is the only thing that reads the scrollport rect, so
      // counting these calls counts real_eval measurement passes. The old loop
      // re-measured after every single-row mutation; the new one measures once.
      let calls = 0
      const original = mount.scroller.getBoundingClientRect
      mount.scroller.getBoundingClientRect = function (this: HTMLElement) {
        calls++
        return original.call(this)
      }

      mount.scroller.scrollTop = ITEM_HEIGHT * 4
      mount.scroller.dispatchEvent(new Event("scroll"))

      // Advance exactly one frame; the convergence re-eval lands on later frames.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

      expect(calls).toBe(1)

      mount.scroller.getBoundingClientRect = original
      mount.tear_down()
    })

    test("keeps the row-height estimate stable on uniform rows", async () => {
      const mount = mount_virtual_scroll(labels_from_count(120))
      await flush_frames()

      // Rows are all exactly ITEM_HEIGHT: the damped, 1px-thresholded estimate
      // must not drift (drift is what jitters the padders and the scrollbar).
      for (const index of [10, 30, 60, 90, 30, 0]) {
        await mount.scroll_to(index)
        expect(mount.instance.item_size).toBe(ITEM_HEIGHT)
      }

      mount.tear_down()
    })

    test("stays consistent after grow-shrink-update cycles", async () => {
      const mount = mount_virtual_scroll(["a"])
      await flush_frames()

      for (let round = 0; round < 4; round++) {
        mount.o_lst.set(["a", "b", "c", "d", "e"])
        await flush_frames()
        expect_visible_slice(mount.o_lst.get(), mount.visible_labels())

        mount.o_lst.set(["x"])
        await flush_frames()
        expect(mount.visible_labels()).toEqual(["x"])

        mount.o_lst.set(["p", "q", "r"])
        await flush_frames()
        expect(mount.visible_labels()).toEqual(["p", "q", "r"])
      }

      mount.tear_down()
    })
  })
})
