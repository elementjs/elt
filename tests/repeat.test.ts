import "./setup.ts"

import { test, expect, describe } from "bun:test"

import { o } from "../src/observable"
import { Repeat } from "../src/verbs"
import { $observe } from "../src/decorators"
import { node_append, node_remove, node_is_observing } from "../src/dom"

type Item = { id: string; label: string }

class observe_track {
  count = 0

  constructor(
    public node: HTMLElement,
    obs: o.RO<unknown>
  ) {
    $observe(obs, () => {
      this.count++
    })(node)
  }

  observing() {
    return node_is_observing(this.node)
  }
}

type RepeatOptions = {
  keyfn?: (item: string) => string
  prefix?: boolean
  suffix?: boolean
  separator?: boolean
  empty?: boolean
}

function mount_repeat(
  lst: o.Observable<string[]>,
  options: RepeatOptions = {}
) {
  const container = document.createElement("div")
  let repeater = Repeat(lst, (item, idx) => {
    const span = document.createElement("span")
    span.className = "repeat-item"
    node_append(span, item)
    if (options.separator) {
      const sep = document.createElement("span")
      sep.className = "repeat-sep"
      node_append(sep, idx.tf(i => `#${i}`))
      return [sep, span] as unknown as HTMLSpanElement
    }
    return span
  })

  if (options.keyfn) repeater = repeater.withKeyFunction(options.keyfn)
  if (options.prefix)
    repeater = repeater.PrefixBy(o_lst => {
      const el = document.createElement("span")
      el.className = "repeat-prefix"
      node_append(el, o_lst.tf(l => `(${l.length})`))
      return el
    })
  if (options.suffix)
    repeater = repeater.SuffixBy(o_lst => {
      const el = document.createElement("span")
      el.className = "repeat-suffix"
      node_append(el, o_lst.tf(l => `/${l.length}`))
      return el
    })
  if (options.empty)
    repeater = repeater.DisplayWhenEmpty(() => {
      const el = document.createElement("span")
      el.className = "repeat-empty"
      el.textContent = "empty"
      return el
    })

  node_append(container, repeater)
  node_append(document.body, container)
  return { container, repeater }
}

function elements_by_class(root: HTMLElement, class_name: string) {
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

function item_texts(container: HTMLElement) {
  return elements_by_class(container, "repeat-item").map(s => s.textContent)
}

function query_one(container: HTMLElement, class_name: string) {
  return elements_by_class(container, class_name)[0] ?? null
}

function tear_down(container: HTMLElement) {
  node_remove(container)
}

function count_by_class(root: HTMLElement, class_name: string) {
  return elements_by_class(root, class_name).length
}

function mount_fragment_repeat(
  lst: o.Observable<Item[]>,
  tracks_by_id: Map<string, { label: observe_track; badge: observe_track }>
) {
  const container = document.createElement("div")
  const repeater = Repeat(lst, (item, idx) => {
    const frag = document.createDocumentFragment()
    const wrap = document.createElement("div")
    wrap.className = "complex-item"

    const label = document.createElement("span")
    label.className = "complex-label"
    const badge = document.createElement("span")
    badge.className = "complex-badge"
    const tail = document.createElement("span")
    tail.className = "complex-tail"

    const id = item.get().id
    tracks_by_id.set(id, {
      label: new observe_track(label, item.tf(x => x.label)),
      badge: new observe_track(badge, idx),
    })

    node_append(label, item.tf(x => x.label))
    node_append(badge, idx.tf(i => `n${i}`))
    node_append(tail, item.tf(x => `tail-${x.id}`))

    node_append(wrap, label)
    node_append(wrap, badge)
    node_append(frag, wrap)
    node_append(frag, tail)
    return frag
  }).withKeyFunction(item => item.id)

  node_append(container, repeater)
  node_append(document.body, container)
  return { container, repeater }
}

describe("Repeat", () => {
  describe("initial render", () => {
    test("renders each list element", () => {
      const { container } = mount_repeat(o(["a", "b", "c"]))
      expect(item_texts(container)).toEqual(["a", "b", "c"])
      tear_down(container)
    })

    test("renders empty list with DisplayWhenEmpty", () => {
      const { container } = mount_repeat(o([]), { empty: true })
      expect(query_one(container, "repeat-empty")?.textContent).toBe("empty")
      expect(item_texts(container)).toEqual([])
      tear_down(container)
    })

    test("renders a single element", () => {
      const { container } = mount_repeat(o(["only"]))
      expect(item_texts(container)).toEqual(["only"])
      tear_down(container)
    })
  })

  describe("element replacement", () => {
    test("replaces a single middle element", () => {
      const o_lst = o(["a", "b", "c", "d"])
      const { container } = mount_repeat(o_lst)

      expect(item_texts(container)).toEqual(["a", "b", "c", "d"])

      o_lst.set(["a", "x", "c", "d"])
      expect(item_texts(container)).toEqual(["a", "x", "c", "d"])
      tear_down(container)
    })

    test("replaces first element when rest is stable", () => {
      const o_lst = o(["a", "b", "c"])
      const { container } = mount_repeat(o_lst)

      o_lst.set(["x", "b", "c"])
      expect(item_texts(container)).toEqual(["x", "b", "c"])
      tear_down(container)
    })

    test("replaces last element when rest is stable", () => {
      const o_lst = o(["a", "b", "c"])
      const { container } = mount_repeat(o_lst)

      o_lst.set(["a", "b", "x"])
      expect(item_texts(container)).toEqual(["a", "b", "x"])
      tear_down(container)
    })

    test("replaces a single-element list with another value", () => {
      const o_lst = o(["a"])
      const { container } = mount_repeat(o_lst)

      o_lst.set(["b"])
      expect(item_texts(container)).toEqual(["b"])
      tear_down(container)
    })
  })

  describe("list length changes", () => {
    test("removes trailing elements when the array shrinks", () => {
      const o_lst = o(["a", "b", "c"])
      const { container } = mount_repeat(o_lst)

      o_lst.set(["a"])
      expect(item_texts(container)).toEqual(["a"])
      tear_down(container)
    })

    test("shrinks to a single different element", () => {
      const o_lst = o(["a", "b", "c", "d"])
      const { container } = mount_repeat(o_lst)

      o_lst.set(["z"])
      expect(item_texts(container)).toEqual(["z"])
      tear_down(container)
    })

    test("shrinks to a single existing element from the tail", () => {
      const o_lst = o(["a", "b", "c"])
      const { container } = mount_repeat(o_lst)

      o_lst.set(["c"])
      expect(item_texts(container)).toEqual(["c"])
      tear_down(container)
    })

    test("appends new elements when the array grows", () => {
      const o_lst = o(["a"])
      const { container } = mount_repeat(o_lst)

      o_lst.set(["a", "b", "c"])
      expect(item_texts(container)).toEqual(["a", "b", "c"])
      tear_down(container)
    })

    test("grows from empty to one element", () => {
      const o_lst = o<string[]>([])
      const { container } = mount_repeat(o_lst, { empty: true })

      o_lst.set(["a"])
      expect(item_texts(container)).toEqual(["a"])
      expect(query_one(container, "repeat-empty")).toBeNull()
      tear_down(container)
    })

    test("clears to empty with DisplayWhenEmpty", () => {
      const o_lst = o(["a", "b"])
      const { container } = mount_repeat(o_lst, { empty: true })

      o_lst.set([])
      expect(item_texts(container)).toEqual([])
      expect(query_one(container, "repeat-empty")?.textContent).toBe("empty")
      tear_down(container)
    })
  })

  describe("re-setting the same single element", () => {
    test("does not duplicate when setting an identical single-element array again", () => {
      const o_lst = o(["a", "b"])
      const { container } = mount_repeat(o_lst)

      o_lst.set(["x"])
      expect(item_texts(container)).toEqual(["x"])

      o_lst.set(["x"])
      expect(item_texts(container)).toEqual(["x"])
      tear_down(container)
    })

    test("handles repeated identical single-element sets after shrinking", () => {
      const o_lst = o(["a", "b", "c"])
      const { container } = mount_repeat(o_lst)

      o_lst.set(["y"])
      expect(item_texts(container)).toEqual(["y"])

      o_lst.set(["y"])
      expect(item_texts(container)).toEqual(["y"])

      o_lst.set(["y"])
      expect(item_texts(container)).toEqual(["y"])
      tear_down(container)
    })

    test("re-setting the same reference still keeps one element", () => {
      const single = ["same"]
      const o_lst = o(single)
      const { container } = mount_repeat(o_lst)

      o_lst.set(single)
      expect(item_texts(container)).toEqual(["same"])
      tear_down(container)
    })
  })

  describe("reordering", () => {
    test("swaps two elements", () => {
      const o_lst = o(["a", "b"])
      const { container } = mount_repeat(o_lst)

      o_lst.set(["b", "a"])
      expect(item_texts(container)).toEqual(["b", "a"])
      tear_down(container)
    })

    test("reverses a longer list", () => {
      const o_lst = o(["a", "b", "c", "d"])
      const { container } = mount_repeat(o_lst)

      o_lst.set(["d", "c", "b", "a"])
      expect(item_texts(container)).toEqual(["d", "c", "b", "a"])
      tear_down(container)
    })
  })

  describe("full replacement", () => {
    test("replaces the entire list with new values", () => {
      const o_lst = o(["a", "b", "c"])
      const { container } = mount_repeat(o_lst)

      o_lst.set(["x", "y", "z"])
      expect(item_texts(container)).toEqual(["x", "y", "z"])
      tear_down(container)
    })

    test("replaces many elements with a single element", () => {
      const o_lst = o(["a", "b", "c", "d", "e"])
      const { container } = mount_repeat(o_lst)

      o_lst.set(["solo"])
      expect(item_texts(container)).toEqual(["solo"])
      tear_down(container)
    })
  })

  describe("batched updates", () => {
    test("applies o.transaction as one update", () => {
      const o_lst = o(["a", "b", "c"])
      const { container } = mount_repeat(o_lst)

      o.transaction(() => {
        o_lst.set(["x"])
      })
      expect(item_texts(container)).toEqual(["x"])
      tear_down(container)
    })

    test("transaction then identical single-element set stays stable", () => {
      const o_lst = o(["a", "b"])
      const { container } = mount_repeat(o_lst)

      o.transaction(() => {
        o_lst.set(["t"])
      })
      o_lst.set(["t"])
      expect(item_texts(container)).toEqual(["t"])
      tear_down(container)
    })
  })

  describe("writable item observables", () => {
    test("updates display when a repeat item observable is set", () => {
      const o_lst = o(["a", "b"])
      let o_second: o.Observable<string> | undefined
      const container = document.createElement("div")
      node_append(
        container,
        Repeat(o_lst, (item, idx) => {
          if (o.get(idx) === 1) o_second = item as o.Observable<string>
          const span = document.createElement("span")
          span.className = "repeat-item"
          node_append(span, item)
          return span
        })
      )
      node_append(document.body, container)

      expect(o_second).toBeDefined()
      o_second!.set("B")
      expect(item_texts(container)).toEqual(["a", "B"])
      tear_down(container)
    })
  })

  describe("withKeyFunction", () => {
    test("reuses nodes when keys match across updates", () => {
      const o_lst = o(["a", "b", "c"])
      const { container } = mount_repeat(o_lst, {
        keyfn: item => item,
      })

      o_lst.set(["c", "a", "b"])
      expect(item_texts(container)).toEqual(["c", "a", "b"])
      tear_down(container)
    })

    test("shrinks keyed list to one element without stale nodes", () => {
      const o_lst = o(["a", "b", "c"])
      const { container } = mount_repeat(o_lst, {
        keyfn: item => item,
      })

      o_lst.set(["b"])
      expect(item_texts(container)).toEqual(["b"])
      o_lst.set(["b"])
      expect(item_texts(container)).toEqual(["b"])
      tear_down(container)
    })
  })

  describe("optional regions", () => {
    test("shows prefix and suffix for non-empty lists", () => {
      const { container } = mount_repeat(o(["a", "b"]), {
        prefix: true,
        suffix: true,
      })

      expect(query_one(container, "repeat-prefix")?.textContent).toBe("(2)")
      expect(query_one(container, "repeat-suffix")?.textContent).toBe("/2")
      tear_down(container)
    })

    test("hides prefix and suffix when the list becomes empty", () => {
      const o_lst = o(["a"])
      const { container } = mount_repeat(o_lst, {
        prefix: true,
        suffix: true,
        empty: true,
      })

      o_lst.set([])
      expect(query_one(container, "repeat-prefix")).toBeNull()
      expect(query_one(container, "repeat-suffix")).toBeNull()
      expect(query_one(container, "repeat-empty")?.textContent).toBe("empty")
      tear_down(container)
    })
  })

  describe("update sequences", () => {
    test("grow then shrink to single element repeatedly", () => {
      const o_lst = o(["a"])
      const { container } = mount_repeat(o_lst)

      for (let i = 0; i < 5; i++) {
        o_lst.set(["a", "b", "c"])
        expect(item_texts(container)).toEqual(["a", "b", "c"])
        o_lst.set(["b"])
        expect(item_texts(container)).toEqual(["b"])
      }
      tear_down(container)
    })

    test("many arbitrary updates keep DOM in sync", () => {
      const items = ["a", "b", "c", "d", "e"]
      const o_lst = o(items.slice(0, 2))
      const { container } = mount_repeat(o_lst)

      const sequences: string[][] = [
        ["x"],
        ["x"],
        ["a", "b", "c"],
        ["c"],
        ["c"],
        ["z"],
        ["z"],
        [],
        ["only"],
        ["only"],
      ]

      for (const seq of sequences) {
        o_lst.set([...seq])
        expect(item_texts(container)).toEqual(seq)
      }
      tear_down(container)
    })
  })

  describe("complex fragment items and observer lifecycle", () => {
    test("renders fragment roots with multiple observed subtrees", () => {
      const o_lst = o<Item[]>([
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ])
      const tracks = new Map<string, { label: observe_track; badge: observe_track }>()
      const { container } = mount_fragment_repeat(o_lst, tracks)

      expect(count_by_class(container, "complex-item")).toBe(2)
      expect(count_by_class(container, "complex-tail")).toBe(2)
      expect(elements_by_class(container, "complex-label").map(el => el.textContent)).toEqual([
        "A",
        "B",
      ])
      expect(elements_by_class(container, "complex-badge").map(el => el.textContent)).toEqual([
        "n0",
        "n1",
      ])
      expect(elements_by_class(container, "complex-tail").map(el => el.textContent)).toEqual([
        "tail-a",
        "tail-b",
      ])

      const a = tracks.get("a")!
      const b = tracks.get("b")!
      expect(a.label.count).toBe(1)
      expect(a.badge.count).toBe(1)
      expect(b.label.count).toBe(1)
      expect(b.badge.count).toBe(1)
      expect(a.label.observing()).toBe(true)
      expect(b.label.observing()).toBe(true)

      tear_down(container)
    })

    test("shrinking the list disconnects observers on removed items", () => {
      const o_lst = o<Item[]>([
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ])
      const tracks = new Map<string, { label: observe_track; badge: observe_track }>()
      const { container } = mount_fragment_repeat(o_lst, tracks)

      const b = tracks.get("b")!
      const b_label_count = b.label.count

      o_lst.set([{ id: "a", label: "A1" }])

      expect(count_by_class(container, "complex-tail")).toBe(1)
      expect(elements_by_class(container, "complex-tail")[0].textContent).toBe("tail-a")
      expect(b.label.observing()).toBe(false)
      expect(b.badge.observing()).toBe(false)

      o_lst.set([{ id: "a", label: "A2" }])
      expect(b.label.count).toBe(b_label_count)
      expect(tracks.get("a")!.label.count).toBeGreaterThan(b_label_count)

      tear_down(container)
    })

    test("clearing the list removes fragment nodes and stops all item observers", () => {
      const o_lst = o<Item[]>([
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ])
      const tracks = new Map<string, { label: observe_track; badge: observe_track }>()
      const { container } = mount_fragment_repeat(o_lst, tracks)

      o_lst.set([])
      expect(count_by_class(container, "complex-item")).toBe(0)
      expect(count_by_class(container, "complex-tail")).toBe(0)

      for (const entry of tracks.values()) {
        expect(entry.label.observing()).toBe(false)
        expect(entry.badge.observing()).toBe(false)
      }

      const a_label_count = tracks.get("a")!.label.count
      o_lst.set([{ id: "c", label: "C" }])
      expect(tracks.get("a")!.label.count).toBe(a_label_count)

      tear_down(container)
    })

    test("node_remove on the mount root stops repeat and item observers", () => {
      const o_lst = o<Item[]>([{ id: "a", label: "A" }])
      const tracks = new Map<string, { label: observe_track; badge: observe_track }>()
      const { container } = mount_fragment_repeat(o_lst, tracks)

      const a = tracks.get("a")!
      const count_before = a.label.count

      node_remove(container)
      expect(a.label.observing()).toBe(false)
      expect(a.badge.observing()).toBe(false)

      o_lst.set([{ id: "a", label: "changed" }])
      expect(a.label.count).toBe(count_before)
    })

    test("keyed reuse keeps observers on surviving fragment items", () => {
      const o_lst = o<Item[]>([
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ])
      const tracks = new Map<string, { label: observe_track; badge: observe_track }>()
      const { container } = mount_fragment_repeat(o_lst, tracks)

      const a_label_node = tracks.get("a")!.label.node
      const b_label_node = tracks.get("b")!.label.node

      o_lst.set([
        { id: "b", label: "B2" },
        { id: "a", label: "A2" },
      ])

      expect(tracks.get("a")!.label.node).toBe(a_label_node)
      expect(tracks.get("b")!.label.node).toBe(b_label_node)
      expect(elements_by_class(container, "complex-label").map(el => el.textContent)).toEqual([
        "B2",
        "A2",
      ])
      expect(tracks.get("a")!.label.observing()).toBe(true)
      expect(tracks.get("b")!.label.observing()).toBe(true)

      tear_down(container)
    })
  })
})
