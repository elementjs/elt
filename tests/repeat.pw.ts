import { test, expect } from "@playwright/test"

// Shared helpers, installed on `window` before the harness script runs (see addInitScript below),
// so every test's page.evaluate() can reuse them instead of redefining them inline. They only
// touch `window.__ELT__` lazily (i.e. inside function bodies, not at definition time), since
// __ELT__ isn't set yet when addInitScript's own script runs.
declare global {
  interface Window {
    __repeat_helpers__: {
      elements_by_class: (root: HTMLElement, class_name: string) => HTMLElement[]
      item_texts: (container: HTMLElement) => (string | null)[]
      query_one: (container: HTMLElement, class_name: string) => HTMLElement | null
      count_by_class: (root: HTMLElement, class_name: string) => number
      tear_down: (container: HTMLElement) => void
      make_observe_track: (node: HTMLElement, obs: any) => { node: HTMLElement; readonly count: number; observing: () => boolean }
      mount_repeat: (
        lst: any,
        options?: { keyfn?: (item: string) => string; prefix?: boolean; suffix?: boolean; separator?: boolean; empty?: boolean },
      ) => { container: HTMLElement; repeater: any }
      mount_fragment_repeat: (lst: any, tracks_by_id: Map<string, { label: any; badge: any }>) => { container: HTMLElement; repeater: any }
      mount_view_repeat: (lst: any, o_start: any, o_end: any) => { container: HTMLElement; repeater: any; o_start: any; o_end: any }
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
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
      return elements_by_class(container, "repeat-item").map((s) => s.textContent)
    }

    function query_one(container: HTMLElement, class_name: string) {
      return elements_by_class(container, class_name)[0] ?? null
    }

    function count_by_class(root: HTMLElement, class_name: string) {
      return elements_by_class(root, class_name).length
    }

    function tear_down(container: HTMLElement) {
      window.__ELT__.node_remove(container)
    }

    function make_observe_track(node: HTMLElement, obs: any) {
      const state = { count: 0 }
      window.__ELT__.$observe(obs, () => {
        state.count++
      })(node)
      return {
        node,
        get count() {
          return state.count
        },
        observing() {
          return window.__ELT__.node_is_observing(node)
        },
      }
    }

    function mount_repeat(
      lst: any,
      options: { keyfn?: (item: string) => string; prefix?: boolean; suffix?: boolean; separator?: boolean; empty?: boolean } = {},
    ) {
      const { Repeat, node_append } = window.__ELT__
      const container = document.createElement("div")
      let repeater = Repeat(lst, (item: any, idx: any) => {
        const span = document.createElement("span")
        span.className = "repeat-item"
        node_append(span, item)
        if (options.separator) {
          const sep = document.createElement("span")
          sep.className = "repeat-sep"
          node_append(
            sep,
            idx.tf((i: number) => `#${i}`),
          )
          return [sep, span] as unknown as HTMLSpanElement
        }
        return span
      })

      if (options.keyfn) repeater = repeater.withKeyFunction(options.keyfn)
      if (options.prefix)
        repeater = repeater.PrefixBy((o_lst: any) => {
          const el = document.createElement("span")
          el.className = "repeat-prefix"
          node_append(
            el,
            o_lst.tf((l: unknown[]) => `(${l.length})`),
          )
          return el
        })
      if (options.suffix)
        repeater = repeater.SuffixBy((o_lst: any) => {
          const el = document.createElement("span")
          el.className = "repeat-suffix"
          node_append(
            el,
            o_lst.tf((l: unknown[]) => `/${l.length}`),
          )
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

    function mount_fragment_repeat(lst: any, tracks_by_id: Map<string, { label: any; badge: any }>) {
      const { Repeat, node_append } = window.__ELT__
      const container = document.createElement("div")
      const repeater = Repeat(lst, (item: any, idx: any) => {
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
          label: make_observe_track(
            label,
            item.tf((x: { label: string }) => x.label),
          ),
          badge: make_observe_track(badge, idx),
        })

        node_append(
          label,
          item.tf((x: { label: string }) => x.label),
        )
        node_append(
          badge,
          idx.tf((i: number) => `n${i}`),
        )
        node_append(
          tail,
          item.tf((x: { id: string }) => `tail-${x.id}`),
        )

        node_append(wrap, label)
        node_append(wrap, badge)
        node_append(frag, wrap)
        node_append(frag, tail)
        return frag
      }).withKeyFunction((item: { id: string }) => item.id)

      node_append(container, repeater)
      node_append(document.body, container)
      return { container, repeater }
    }

    function mount_view_repeat(lst: any, o_start: any, o_end: any) {
      const { Repeat, node_append } = window.__ELT__
      const container = document.createElement("div")
      const repeater = Repeat(lst, (item: any) => {
        const span = document.createElement("span")
        span.className = "repeat-item"
        node_append(span, item)
        return span
      })
        .ForView(o_start, o_end)
        .withKeyFunction((item: string) => item)

      node_append(container, repeater)
      node_append(document.body, container)
      return { container, repeater, o_start, o_end }
    }

    window.__repeat_helpers__ = {
      elements_by_class,
      item_texts,
      query_one,
      count_by_class,
      tear_down,
      make_observe_track,
      mount_repeat,
      mount_fragment_repeat,
      mount_view_repeat,
    }
  })
  await page.goto("/tests/browser/harness.html")
})

test.describe("Repeat", () => {
  test.describe("initial render", () => {
    test("renders each list element", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const { container } = mount_repeat(o(["a", "b", "c"]))
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["a", "b", "c"])
    })

    test("renders empty list with DisplayWhenEmpty", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, query_one, tear_down } = window.__repeat_helpers__
        const { container } = mount_repeat(o([]), { empty: true })
        const out = {
          empty_text: query_one(container, "repeat-empty")?.textContent,
          items: item_texts(container),
        }
        tear_down(container)
        return out
      })
      expect(result.empty_text).toBe("empty")
      expect(result.items).toEqual([])
    })

    test("renders a single element", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const { container } = mount_repeat(o(["only"]))
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["only"])
    })
  })

  test.describe("element replacement", () => {
    test("replaces a single middle element", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c", "d"])
        const { container } = mount_repeat(o_lst)
        const out: unknown[][] = []
        out.push(item_texts(container))
        o_lst.set(["a", "x", "c", "d"])
        out.push(item_texts(container))
        tear_down(container)
        return out
      })
      expect(results[0]).toEqual(["a", "b", "c", "d"])
      expect(results[1]).toEqual(["a", "x", "c", "d"])
    })

    test("replaces first element when rest is stable", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c"])
        const { container } = mount_repeat(o_lst)
        o_lst.set(["x", "b", "c"])
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["x", "b", "c"])
    })

    test("replaces last element when rest is stable", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c"])
        const { container } = mount_repeat(o_lst)
        o_lst.set(["a", "b", "x"])
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["a", "b", "x"])
    })

    test("replaces a single-element list with another value", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a"])
        const { container } = mount_repeat(o_lst)
        o_lst.set(["b"])
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["b"])
    })
  })

  test.describe("list length changes", () => {
    test("removes trailing elements when the array shrinks", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c"])
        const { container } = mount_repeat(o_lst)
        o_lst.set(["a"])
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["a"])
    })

    test("shrinks to a single different element", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c", "d"])
        const { container } = mount_repeat(o_lst)
        o_lst.set(["z"])
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["z"])
    })

    test("shrinks to a single existing element from the tail", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c"])
        const { container } = mount_repeat(o_lst)
        o_lst.set(["c"])
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["c"])
    })

    test("appends new elements when the array grows", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a"])
        const { container } = mount_repeat(o_lst)
        o_lst.set(["a", "b", "c"])
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["a", "b", "c"])
    })

    test("grows from empty to one element", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, query_one, tear_down } = window.__repeat_helpers__
        const o_lst = o<string[]>([])
        const { container } = mount_repeat(o_lst, { empty: true })
        o_lst.set(["a"])
        const out = {
          texts: item_texts(container),
          empty: query_one(container, "repeat-empty"),
        }
        tear_down(container)
        return out
      })
      expect(result.texts).toEqual(["a"])
      expect(result.empty).toBeNull()
    })

    test("clears to empty with DisplayWhenEmpty", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, query_one, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b"])
        const { container } = mount_repeat(o_lst, { empty: true })
        o_lst.set([])
        const out = {
          texts: item_texts(container),
          empty_text: query_one(container, "repeat-empty")?.textContent,
        }
        tear_down(container)
        return out
      })
      expect(result.texts).toEqual([])
      expect(result.empty_text).toBe("empty")
    })
  })

  test.describe("re-setting the same single element", () => {
    test("does not duplicate when setting an identical single-element array again", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b"])
        const { container } = mount_repeat(o_lst)
        const out: unknown[][] = []
        o_lst.set(["x"])
        out.push(item_texts(container))
        o_lst.set(["x"])
        out.push(item_texts(container))
        tear_down(container)
        return out
      })
      expect(results[0]).toEqual(["x"])
      expect(results[1]).toEqual(["x"])
    })

    test("handles repeated identical single-element sets after shrinking", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c"])
        const { container } = mount_repeat(o_lst)
        const out: unknown[][] = []
        o_lst.set(["y"])
        out.push(item_texts(container))
        o_lst.set(["y"])
        out.push(item_texts(container))
        o_lst.set(["y"])
        out.push(item_texts(container))
        tear_down(container)
        return out
      })
      expect(results[0]).toEqual(["y"])
      expect(results[1]).toEqual(["y"])
      expect(results[2]).toEqual(["y"])
    })

    test("re-setting the same reference still keeps one element", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const single = ["same"]
        const o_lst = o(single)
        const { container } = mount_repeat(o_lst)
        o_lst.set(single)
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["same"])
    })
  })

  test.describe("reordering", () => {
    test("swaps two elements", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b"])
        const { container } = mount_repeat(o_lst)
        o_lst.set(["b", "a"])
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["b", "a"])
    })

    test("reverses a longer list", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c", "d"])
        const { container } = mount_repeat(o_lst)
        o_lst.set(["d", "c", "b", "a"])
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["d", "c", "b", "a"])
    })
  })

  test.describe("full replacement", () => {
    test("replaces the entire list with new values", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c"])
        const { container } = mount_repeat(o_lst)
        o_lst.set(["x", "y", "z"])
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["x", "y", "z"])
    })

    test("replaces many elements with a single element", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c", "d", "e"])
        const { container } = mount_repeat(o_lst)
        o_lst.set(["solo"])
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["solo"])
    })
  })

  test.describe("batched updates", () => {
    test("applies o.transaction as one update", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c"])
        const { container } = mount_repeat(o_lst)
        o.transaction(() => {
          o_lst.set(["x"])
        })
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["x"])
    })

    test("transaction then identical single-element set stays stable", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b"])
        const { container } = mount_repeat(o_lst)
        o.transaction(() => {
          o_lst.set(["t"])
        })
        o_lst.set(["t"])
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["t"])
    })
  })

  test.describe("writable item observables", () => {
    test("updates display when a repeat item observable is set", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, Repeat, node_append } = window.__ELT__
        const { item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b"])
        let o_second: any
        const container = document.createElement("div")
        node_append(
          container,
          Repeat(o_lst, (item: any, idx: any) => {
            if (o.get(idx) === 1) o_second = item
            const span = document.createElement("span")
            span.className = "repeat-item"
            node_append(span, item)
            return span
          }),
        )
        node_append(document.body, container)

        const defined = o_second !== undefined
        o_second!.set("B")
        const texts = item_texts(container)
        tear_down(container)
        return { defined, texts }
      })
      expect(result.defined).toBe(true)
      expect(result.texts).toEqual(["a", "B"])
    })
  })

  test.describe("withKeyFunction", () => {
    test("reuses nodes when keys match across updates", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c"])
        const { container } = mount_repeat(o_lst, { keyfn: (item: string) => item })
        o_lst.set(["c", "a", "b"])
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["c", "a", "b"])
    })

    test("shrinks keyed list to one element without stale nodes", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c"])
        const { container } = mount_repeat(o_lst, { keyfn: (item: string) => item })
        const out: unknown[][] = []
        o_lst.set(["b"])
        out.push(item_texts(container))
        o_lst.set(["b"])
        out.push(item_texts(container))
        tear_down(container)
        return out
      })
      expect(results[0]).toEqual(["b"])
      expect(results[1]).toEqual(["b"])
    })
  })

  test.describe("optional regions", () => {
    test("shows prefix and suffix for non-empty lists", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, query_one, tear_down } = window.__repeat_helpers__
        const { container } = mount_repeat(o(["a", "b"]), { prefix: true, suffix: true })
        const out = {
          prefix: query_one(container, "repeat-prefix")?.textContent,
          suffix: query_one(container, "repeat-suffix")?.textContent,
        }
        tear_down(container)
        return out
      })
      expect(result.prefix).toBe("(2)")
      expect(result.suffix).toBe("/2")
    })

    test("hides prefix and suffix when the list becomes empty", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, query_one, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a"])
        const { container } = mount_repeat(o_lst, { prefix: true, suffix: true, empty: true })
        o_lst.set([])
        const out = {
          prefix: query_one(container, "repeat-prefix"),
          suffix: query_one(container, "repeat-suffix"),
          empty_text: query_one(container, "repeat-empty")?.textContent,
        }
        tear_down(container)
        return out
      })
      expect(result.prefix).toBeNull()
      expect(result.suffix).toBeNull()
      expect(result.empty_text).toBe("empty")
    })
  })

  test.describe("update sequences", () => {
    test("grow then shrink to single element repeatedly", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a"])
        const { container } = mount_repeat(o_lst)
        const out: unknown[][] = []
        for (let i = 0; i < 5; i++) {
          o_lst.set(["a", "b", "c"])
          out.push(item_texts(container))
          o_lst.set(["b"])
          out.push(item_texts(container))
        }
        tear_down(container)
        return out
      })
      for (let i = 0; i < 5; i++) {
        expect(results[i * 2]).toEqual(["a", "b", "c"])
        expect(results[i * 2 + 1]).toEqual(["b"])
      }
    })

    test("many arbitrary updates keep DOM in sync", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const items = ["a", "b", "c", "d", "e"]
        const o_lst = o(items.slice(0, 2))
        const { container } = mount_repeat(o_lst)

        const sequences: string[][] = [["x"], ["x"], ["a", "b", "c"], ["c"], ["c"], ["z"], ["z"], [], ["only"], ["only"]]
        const out: unknown[][] = []
        for (const seq of sequences) {
          o_lst.set([...seq])
          out.push(item_texts(container))
        }
        tear_down(container)
        return { out, sequences }
      })
      for (let i = 0; i < results.sequences.length; i++) {
        expect(results.out[i]).toEqual(results.sequences[i])
      }
    })
  })

  test.describe("complex fragment items and observer lifecycle", () => {
    test("renders fragment roots with multiple observed subtrees", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_fragment_repeat, count_by_class, elements_by_class, tear_down } = window.__repeat_helpers__
        const o_lst = o([
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ])
        const tracks = new Map<string, { label: any; badge: any }>()
        const { container } = mount_fragment_repeat(o_lst, tracks)

        const out = {
          complex_item_count: count_by_class(container, "complex-item"),
          complex_tail_count: count_by_class(container, "complex-tail"),
          labels: elements_by_class(container, "complex-label").map((el) => el.textContent),
          badges: elements_by_class(container, "complex-badge").map((el) => el.textContent),
          tails: elements_by_class(container, "complex-tail").map((el) => el.textContent),
          a_label_count: tracks.get("a")!.label.count,
          a_badge_count: tracks.get("a")!.badge.count,
          b_label_count: tracks.get("b")!.label.count,
          b_badge_count: tracks.get("b")!.badge.count,
          a_label_observing: tracks.get("a")!.label.observing(),
          b_label_observing: tracks.get("b")!.label.observing(),
        }
        tear_down(container)
        return out
      })
      expect(result.complex_item_count).toBe(2)
      expect(result.complex_tail_count).toBe(2)
      expect(result.labels).toEqual(["A", "B"])
      expect(result.badges).toEqual(["n0", "n1"])
      expect(result.tails).toEqual(["tail-a", "tail-b"])
      expect(result.a_label_count).toBe(1)
      expect(result.a_badge_count).toBe(1)
      expect(result.b_label_count).toBe(1)
      expect(result.b_badge_count).toBe(1)
      expect(result.a_label_observing).toBe(true)
      expect(result.b_label_observing).toBe(true)
    })

    test("shrinking the list disconnects observers on removed items", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_fragment_repeat, count_by_class, elements_by_class, tear_down } = window.__repeat_helpers__
        const o_lst = o([
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ])
        const tracks = new Map<string, { label: any; badge: any }>()
        const { container } = mount_fragment_repeat(o_lst, tracks)

        const b = tracks.get("b")!
        const b_label_count = b.label.count

        o_lst.set([{ id: "a", label: "A1" }])

        const after_shrink = {
          complex_tail_count: count_by_class(container, "complex-tail"),
          tail_text: elements_by_class(container, "complex-tail")[0].textContent,
          b_label_observing: b.label.observing(),
          b_badge_observing: b.badge.observing(),
        }

        o_lst.set([{ id: "a", label: "A2" }])
        const after_second_set = {
          b_label_count: b.label.count,
          a_label_count: tracks.get("a")!.label.count,
        }

        tear_down(container)
        return { b_label_count, after_shrink, after_second_set }
      })
      expect(result.after_shrink.complex_tail_count).toBe(1)
      expect(result.after_shrink.tail_text).toBe("tail-a")
      expect(result.after_shrink.b_label_observing).toBe(false)
      expect(result.after_shrink.b_badge_observing).toBe(false)
      expect(result.after_second_set.b_label_count).toBe(result.b_label_count)
      expect(result.after_second_set.a_label_count).toBeGreaterThan(result.b_label_count)
    })

    test("clearing the list removes fragment nodes and stops all item observers", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_fragment_repeat, count_by_class, tear_down } = window.__repeat_helpers__
        const o_lst = o([
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ])
        const tracks = new Map<string, { label: any; badge: any }>()
        const { container } = mount_fragment_repeat(o_lst, tracks)

        o_lst.set([])
        const after_clear = {
          complex_item_count: count_by_class(container, "complex-item"),
          complex_tail_count: count_by_class(container, "complex-tail"),
          observing: Array.from(tracks.values()).map((entry) => ({
            label: entry.label.observing(),
            badge: entry.badge.observing(),
          })),
        }

        const a_label_count = tracks.get("a")!.label.count
        o_lst.set([{ id: "c", label: "C" }])
        const a_label_count_after = tracks.get("a")!.label.count

        tear_down(container)
        return { after_clear, a_label_count, a_label_count_after }
      })
      expect(result.after_clear.complex_item_count).toBe(0)
      expect(result.after_clear.complex_tail_count).toBe(0)
      for (const entry of result.after_clear.observing) {
        expect(entry.label).toBe(false)
        expect(entry.badge).toBe(false)
      }
      expect(result.a_label_count_after).toBe(result.a_label_count)
    })

    test("node_remove on the mount root stops repeat and item observers", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, node_remove } = window.__ELT__
        const { mount_fragment_repeat } = window.__repeat_helpers__
        const o_lst = o([{ id: "a", label: "A" }])
        const tracks = new Map<string, { label: any; badge: any }>()
        const { container } = mount_fragment_repeat(o_lst, tracks)

        const a = tracks.get("a")!
        const count_before = a.label.count

        node_remove(container)
        const after_remove = {
          label_observing: a.label.observing(),
          badge_observing: a.badge.observing(),
        }

        o_lst.set([{ id: "a", label: "changed" }])
        const count_after = a.label.count

        return { count_before, after_remove, count_after }
      })
      expect(result.after_remove.label_observing).toBe(false)
      expect(result.after_remove.badge_observing).toBe(false)
      expect(result.count_after).toBe(result.count_before)
    })

    test("keyed reuse keeps observers on surviving fragment items", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_fragment_repeat, elements_by_class, tear_down } = window.__repeat_helpers__
        const o_lst = o([
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ])
        const tracks = new Map<string, { label: any; badge: any }>()
        const { container } = mount_fragment_repeat(o_lst, tracks)

        const a_label_node = tracks.get("a")!.label.node
        const b_label_node = tracks.get("b")!.label.node

        o_lst.set([
          { id: "b", label: "B2" },
          { id: "a", label: "A2" },
        ])

        const out = {
          a_node_same: tracks.get("a")!.label.node === a_label_node,
          b_node_same: tracks.get("b")!.label.node === b_label_node,
          labels: elements_by_class(container, "complex-label").map((el) => el.textContent),
          a_observing: tracks.get("a")!.label.observing(),
          b_observing: tracks.get("b")!.label.observing(),
        }
        tear_down(container)
        return out
      })
      expect(result.a_node_same).toBe(true)
      expect(result.b_node_same).toBe(true)
      expect(result.labels).toEqual(["B2", "A2"])
      expect(result.a_observing).toBe(true)
      expect(result.b_observing).toBe(true)
    })
  })

  test.describe("ForView", () => {
    test("renders only indices in the view window", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_view_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c", "d", "e"])
        const { container } = mount_view_repeat(o_lst, o(1), o(4))
        const texts = item_texts(container)
        tear_down(container)
        return texts
      })
      expect(result).toEqual(["b", "c", "d"])
    })

    test("updates when the view window shifts", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_view_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c", "d", "e"])
        const o_start = o(0)
        const o_end = o(2)
        const { container } = mount_view_repeat(o_lst, o_start, o_end)

        const out: unknown[][] = []
        out.push(item_texts(container))

        o_start.set(2)
        o_end.set(5)
        out.push(item_texts(container))

        tear_down(container)
        return out
      })
      expect(results[0]).toEqual(["a", "b"])
      expect(results[1]).toEqual(["c", "d", "e"])
    })

    test("reuses keyed nodes when the view slides over stable items", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_view_repeat, elements_by_class, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c", "d", "e"])
        const o_start = o(0)
        const o_end = o(3)
        const { container } = mount_view_repeat(o_lst, o_start, o_end)

        const first_b = elements_by_class(container, "repeat-item").find((el) => el.textContent === "b")!

        o_start.set(1)
        o_end.set(4)
        const second_b = elements_by_class(container, "repeat-item").find((el) => el.textContent === "b")!

        const out = {
          same_node: second_b === first_b,
          texts: item_texts(container),
        }
        tear_down(container)
        return out
      })
      expect(result.same_node).toBe(true)
      expect(result.texts).toEqual(["b", "c", "d"])
    })

    test("reconcileView updates an explicit window imperatively", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_view_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c", "d", "e"])
        const { container, repeater } = mount_view_repeat(o_lst, o(0), o(5))

        const out: unknown[][] = []
        out.push(item_texts(container))

        repeater.reconcileView(2, 4)
        out.push(item_texts(container))

        tear_down(container)
        return out
      })
      expect(results[0]).toEqual(["a", "b", "c", "d", "e"])
      expect(results[1]).toEqual(["c", "d"])
    })

    test("list mutations inside the view stay in sync", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_view_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c", "d", "e"])
        const { container } = mount_view_repeat(o_lst, o(1), o(4))

        const out: unknown[][] = []
        o_lst.set(["x", "b", "y", "d", "e"])
        out.push(item_texts(container))

        o_lst.set(["x", "b"])
        out.push(item_texts(container))

        tear_down(container)
        return out
      })
      expect(results[0]).toEqual(["b", "y", "d"])
      expect(results[1]).toEqual(["b"])
    })
  })
})
