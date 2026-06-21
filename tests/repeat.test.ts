import "./setup.ts"

import { test, expect, describe } from "bun:test"

import { o } from "../src/observable"
import { Repeat } from "../src/verbs"
import { node_append, node_remove } from "../src/dom"

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
})
