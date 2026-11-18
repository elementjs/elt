import { type Page, test, expect } from "./fixture"

// Shared helpers, installed on `window` before the harness script runs (the fixture's before_load, below),
// so every test's page.evaluate() can reuse them instead of redefining them inline. They only
// touch `window.__ELT__` lazily (i.e. inside function bodies, not at definition time), since
// __ELT__ isn't set yet when before_load runs.
declare global {
  interface Window {
    __repeat_helpers__: {
      elements_by_class: (root: HTMLElement, class_name: string) => HTMLElement[]
      item_texts: (container: HTMLElement) => (string | null)[]
      query_one: (container: HTMLElement, class_name: string) => HTMLElement | null
      count_by_class: (root: HTMLElement, class_name: string) => number
      tear_down: (container: HTMLElement) => void
      make_observe_track: (
        node: HTMLElement,
        obs: any,
      ) => { node: HTMLElement; readonly count: number; observing: () => boolean }
      mount_repeat: (
        lst: any,
        options?: {
          keyfn?: (item: string) => string
          prefix?: boolean
          suffix?: boolean
          separator?: boolean
          empty?: boolean
        },
      ) => { container: HTMLElement; repeater: any }
      mount_fragment_repeat: (
        lst: any,
        tracks_by_id: Map<string, { label: any; badge: any }>,
      ) => { container: HTMLElement; repeater: any }
      mount_view_repeat: (
        lst: any,
        o_start: any,
        o_end: any,
      ) => { container: HTMLElement; repeater: any; o_start: any; o_end: any }
    }
  }
}

test.use({
  before_load: {
    script: () => {
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
        options: {
          keyfn?: (item: string) => string
          prefix?: boolean
          suffix?: boolean
          separator?: boolean
          empty?: boolean
        } = {},
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
    },
  },
})

test.describe("Repeat", () => {
  test.describe("list transitions", () => {
    // Each case mounts `initial`, then applies its steps in order and records the item texts after each one. A step
    // is the next list, "same" (set the very array the observable already holds) or { tx } (that list, set inside
    // o.transaction). The single-element cases are regressions (f45fa49: re-setting a one-element list duplicated it).
    type Step = string[] | "same" | { tx: string[] }
    const cases: Record<string, { initial: string[]; steps: Step[]; keyed?: boolean }> = {
      "replaces a single middle element": { initial: ["a", "b", "c", "d"], steps: [["a", "x", "c", "d"]] },
      "replaces first element when rest is stable": { initial: ["a", "b", "c"], steps: [["x", "b", "c"]] },
      "replaces last element when rest is stable": { initial: ["a", "b", "c"], steps: [["a", "b", "x"]] },
      "replaces a single-element list with another value": { initial: ["a"], steps: [["b"]] },
      "removes trailing elements when the array shrinks": { initial: ["a", "b", "c"], steps: [["a"]] },
      "shrinks to a single different element": { initial: ["a", "b", "c", "d"], steps: [["z"]] },
      "shrinks to a single existing element from the tail": { initial: ["a", "b", "c"], steps: [["c"]] },
      "appends new elements when the array grows": { initial: ["a"], steps: [["a", "b", "c"]] },
      "does not duplicate when setting an identical single-element array again": {
        initial: ["a", "b"],
        steps: [["x"], ["x"]],
      },
      "handles repeated identical single-element sets after shrinking": {
        initial: ["a", "b", "c"],
        steps: [["y"], ["y"], ["y"]],
      },
      "re-setting the same reference still keeps one element": { initial: ["same"], steps: ["same"] },
      "swaps two elements": { initial: ["a", "b"], steps: [["b", "a"]] },
      "reverses a longer list": { initial: ["a", "b", "c", "d"], steps: [["d", "c", "b", "a"]] },
      "replaces the entire list with new values": { initial: ["a", "b", "c"], steps: [["x", "y", "z"]] },
      "replaces many elements with a single element": { initial: ["a", "b", "c", "d", "e"], steps: [["solo"]] },
      "transaction then identical single-element set stays stable": {
        initial: ["a", "b"],
        steps: [{ tx: ["t"] }, ["t"]],
      },
      "grow then shrink to single element repeatedly": {
        initial: ["a"],
        steps: Array.from({ length: 5 }, () => [["a", "b", "c"], ["b"]]).flat(),
      },
      "many arbitrary updates": {
        initial: ["a", "b"],
        steps: [["x"], ["x"], ["a", "b", "c"], ["c"], ["c"], ["z"], ["z"], [], ["only"], ["only"]],
      },
      "shrinks keyed list to one element without stale nodes": {
        initial: ["a", "b", "c"],
        steps: [["b"], ["b"]],
        keyed: true,
      },
    }

    test("the rows follow the list through every transition, without and with a key function", async ({ page }) => {
      const result = await page.evaluate((cases) => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const out: Record<string, (string | null)[][]> = {}
        for (const [name, c] of Object.entries(cases)) {
          // A case marked keyed runs keyed only; the others run both ways
          for (const keyed of c.keyed ? [true] : [false, true]) {
            const o_lst = o<string[]>(c.initial)
            const { container } = mount_repeat(o_lst, keyed ? { keyfn: (s: string) => s } : {})
            const texts = [item_texts(container)]
            for (const step of c.steps) {
              if (step === "same") o_lst.set(o_lst.get())
              else if (Array.isArray(step)) o_lst.set([...step])
              else o.transaction(() => o_lst.set([...step.tx]))
              texts.push(item_texts(container))
            }
            tear_down(container)
            out[`${name}${keyed ? " (keyed)" : ""}`] = texts
          }
        }
        return out
      }, cases)
      const expected: Record<string, string[][]> = {}
      for (const [name, c] of Object.entries(cases)) {
        const texts = [c.initial, ...c.steps.map((s) => (s === "same" ? c.initial : Array.isArray(s) ? s : s.tx))]
        for (const keyed of c.keyed ? [true] : [false, true]) expected[`${name}${keyed ? " (keyed)" : ""}`] = texts
      }
      expect(result).toEqual(expected)
    })

    test("o.transaction applies several writes as one update", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, Repeat, node_append, node_observe } = window.__ELT__
        const { item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c"])
        // Every value a row's item observable takes: a reconcile per write would show "p" and "q" before "r"
        const seen: string[] = []
        const container = document.createElement("div")
        node_append(
          container,
          Repeat(o_lst, (item: any) => {
            const span = document.createElement("span")
            span.className = "repeat-item"
            node_append(span, item)
            node_observe(span, item, (v: string) => {
              seen.push(v)
            })
            return span
          }),
        )
        node_append(document.body, container)
        seen.length = 0
        o.transaction(() => {
          o_lst.set(["p", "q"])
          o_lst.set(["r"])
        })
        const texts = item_texts(container)
        tear_down(container)
        return { texts, seen }
      })
      expect(result.texts).toEqual(["r"])
      expect(result.seen).toEqual(["r"])
    })

    test("DisplayWhenEmpty shows on an empty list, initially or after a change, and goes away with the first item", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, query_one, tear_down } = window.__repeat_helpers__
        const o_lst = o<string[]>([])
        const { container } = mount_repeat(o_lst, { empty: true })
        const state = () => ({
          texts: item_texts(container),
          empty: query_one(container, "repeat-empty")?.textContent ?? null,
        })
        const steps = [state()]
        o_lst.set(["a"])
        steps.push(state())
        o_lst.set(["a", "b"])
        steps.push(state())
        o_lst.set([])
        steps.push(state())
        tear_down(container)
        return steps
      })
      expect(result).toEqual([
        { texts: [], empty: "empty" },
        { texts: ["a"], empty: null },
        { texts: ["a", "b"], empty: null },
        { texts: [], empty: "empty" },
      ])
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

    // Regression: without a key function the key is the item itself, so editing an item clones it
    // and changes its key. The reconciler used to detach that item's nodes and re-insert them,
    // which blurred the input after the first typed character.
    for (const kind of ["objects", "strings"] as const) {
      test(`typing into an input bound to an unkeyed item keeps focus (${kind})`, async ({ page }) => {
        await page.evaluate((kind) => {
          const { o, Repeat, node_append, $bind } = window.__ELT__
          const o_lst: any = o(kind === "objects" ? [{ name: "a" }, { name: "b" }, { name: "c" }] : ["a", "b", "c"])
          const container = document.createElement("div")
          node_append(
            container,
            Repeat(o_lst, (item: any) => {
              const input = document.createElement("input")
              input.className = "repeat-input"
              node_append(input, $bind.string(kind === "objects" ? item.p("name") : item))
              return input
            }),
          )
          node_append(document.body, container)
          ;(window as any).__test__ = { o_lst, container, inputs: [...container.querySelectorAll("input")] }
        }, kind)

        await page.locator(".repeat-input").nth(1).click()
        await page.keyboard.press("End")
        await page.keyboard.type("xyz")

        const result = await page.evaluate(() => {
          const { o_lst, container, inputs } = (window as any).__test__
          const now = [...container.querySelectorAll("input")]
          return {
            same_nodes: now.length === inputs.length && now.every((n: Element, i: number) => n === inputs[i]),
            focused: document.activeElement === inputs[1],
            value: inputs[1].value,
            model: o_lst.get(),
          }
        })
        expect(result.same_nodes).toBe(true)
        expect(result.focused).toBe(true)
        expect(result.value).toBe("bxyz")
        expect(result.model).toEqual(
          kind === "objects" ? [{ name: "a" }, { name: "bxyz" }, { name: "c" }] : ["a", "bxyz", "c"],
        )
      })
    }

    test("re-keying an unkeyed item in place performs no child list mutation", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c", "d"])
        const { container } = mount_repeat(o_lst)
        const before = [...container.querySelectorAll(".repeat-item")]

        const mo = new MutationObserver(() => {})
        mo.observe(container, { childList: true, subtree: true })
        // Two slots change identity at once, both with brand new keys.
        o_lst.set(["a", "x", "y", "d"])
        const records = mo.takeRecords()
        mo.disconnect()

        const after = [...container.querySelectorAll(".repeat-item")]
        const out = {
          texts: item_texts(container),
          same_nodes: after.every((n, i) => n === before[i]),
          // Only the text nodes inside the re-keyed spans may change, never the item nodes themselves.
          moved: records.filter((r) => r.target === container).length,
        }
        tear_down(container)
        return out
      })
      expect(result.texts).toEqual(["a", "x", "y", "d"])
      expect(result.same_nodes).toBe(true)
      expect(result.moved).toBe(0)
    })
  })

  test.describe("withKeyFunction", () => {
    test("reuses nodes when keys match across updates", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, elements_by_class, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c"])
        const { container } = mount_repeat(o_lst, { keyfn: (item: string) => item })
        const by_key = new Map(elements_by_class(container, "repeat-item").map((n) => [n.textContent, n]))
        o_lst.set(["c", "a", "b"])
        const out = {
          texts: item_texts(container),
          same_nodes: elements_by_class(container, "repeat-item").every((n) => by_key.get(n.textContent) === n),
        }
        tear_down(container)
        return out
      })
      expect(result).toEqual({ texts: ["c", "a", "b"], same_nodes: true })
    })
  })

  test.describe("optional regions", () => {
    test("prefix and suffix show for a non-empty list and go away when it becomes empty", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, query_one, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b"])
        const { container } = mount_repeat(o_lst, { prefix: true, suffix: true, empty: true })
        const state = () => ({
          prefix: query_one(container, "repeat-prefix")?.textContent ?? null,
          suffix: query_one(container, "repeat-suffix")?.textContent ?? null,
          empty: query_one(container, "repeat-empty")?.textContent ?? null,
        })
        const shown = state()
        o_lst.set([])
        const hidden = state()
        tear_down(container)
        return { shown, hidden }
      })
      expect(result.shown).toEqual({ prefix: "(2)", suffix: "/2", empty: null })
      expect(result.hidden).toEqual({ prefix: null, suffix: null, empty: "empty" })
    })
  })

  test.describe("inserted again", () => {
    test("a Repeat inserted again renders anew where it is inserted, prefix included, and follows its list there; its previous rendering goes (regression: it rendered nothing)", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const { o, node_append, node_remove } = window.__ELT__
        const { mount_repeat, item_texts, query_one, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b"])
        const { container, repeater } = mount_repeat(o_lst, { prefix: true })
        o_lst.set(["a", "b", "c"])
        const other = document.createElement("div")
        node_append(document.body, other)
        node_append(other, repeater)
        const state = () => ({
          // `item_texts` also walks the siblings after its root, which `other` is
          first: container.querySelectorAll(".repeat-item").length,
          other: item_texts(other),
          prefix: query_one(other, "repeat-prefix")?.textContent ?? null,
        })
        const moved = state()
        o_lst.set(["d"])
        const updated = state()
        // Inserted again from a detached place: the docs' case, where its rendering sat in a removed element
        node_remove(other)
        const third = document.createElement("div")
        node_append(document.body, third)
        node_append(third, repeater)
        o_lst.set(["e", "f"])
        const third_items = item_texts(third)
        tear_down(container)
        tear_down(third)
        return { moved, updated, third_items }
      })
      expect(result.moved).toEqual({ first: 0, other: ["a", "b", "c"], prefix: "(3)" })
      expect(result.updated).toEqual({ first: 0, other: ["d"], prefix: "(1)" })
      expect(result.third_items).toEqual(["e", "f"])
    })
  })

  test.describe("update sequences", () => {
    // Regression: with one slot per key, an old duplicate whose key also matched the common head
    // was neither placed nor removed, and stayed in the DOM showing list[its stale index].
    test("removing one of several equal items leaves no stale node", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, elements_by_class, tear_down } = window.__repeat_helpers__
        const o_lst = o(["b", "d", "d", "d", "e"])
        const { container } = mount_repeat(o_lst, { separator: true })
        o_lst.set(["b", "d", "d", "e"])
        const out = {
          texts: item_texts(container),
          idx: elements_by_class(container, "repeat-sep").map((s) => s.textContent),
        }
        tear_down(container)
        return out
      })
      expect(result.texts).toEqual(["b", "d", "d", "e"])
      expect(result.idx).toEqual(["#0", "#1", "#2", "#3"])
    })

    test("random adds and removals with equal items keep items and indices in sync", async ({ page }) => {
      const mismatch = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_repeat, item_texts, elements_by_class, tear_down } = window.__repeat_helpers__
        const o_lst = o<string[]>([])
        const { container } = mount_repeat(o_lst, { separator: true })
        let seed = 1
        const rnd = () => {
          seed = (seed * 16807) % 2147483647
          return seed / 2147483647
        }
        let found: unknown = null
        for (let step = 0; step < 2000 && found == null; step++) {
          const lst = o_lst.get()
          if (lst.length > 0 && rnd() < 0.5) {
            const d = Math.floor(rnd() * lst.length)
            o_lst.set(lst.filter((_, i) => i !== d))
          } else {
            // Few distinct values, inserted anywhere, so that equal items are frequent
            const at = Math.floor(rnd() * (lst.length + 1))
            o_lst.set([...lst.slice(0, at), `v${Math.floor(rnd() * 4)}`, ...lst.slice(at)])
          }
          const texts = item_texts(container)
          const idx = elements_by_class(container, "repeat-sep").map((s) => s.textContent)
          const want = o_lst.get()
          if (JSON.stringify(texts) !== JSON.stringify(want) || idx.some((t, i) => t !== `#${i}`)) {
            found = { step, want, texts, idx }
          }
        }
        tear_down(container)
        return found
      })
      expect(mismatch).toBeNull()
    })
  })

  test.describe("SeparateWith", () => {
    test("separates items and follows reorders, insertions and removals", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, Repeat, node_append, node_remove } = window.__ELT__
        const o_lst = o(["a", "b", "c"])
        const container = document.createElement("div")
        node_append(
          container,
          Repeat(o_lst, (item: any) => item)
            .SeparateWith((idx: any) => idx.tf((i: number) => `|${i}|`))
            .withKeyFunction((s: string) => s),
        )
        node_append(document.body, container)

        const out: string[] = [container.textContent!]
        for (const next of [["c", "a", "b"], ["a", "b"], ["x", "a", "b"], ["b"], ["b", "a"]]) {
          o_lst.set(next)
          out.push(container.textContent!)
        }
        node_remove(container)
        return out
      })
      expect(result).toEqual(["a|1|b|2|c", "c|1|a|2|b", "a|1|b", "x|1|a|2|b", "b", "b|1|a"])
    })
  })

  test.describe("minimal DOM operations", () => {
    // Mounts a keyed list of inputs, one per string, and records the child list mutations of the
    // container during `o_lst.set(next)`.
    const run_update = (page: Page, initial: string[], next: string[], focus?: string) =>
      page.evaluate(
        ({ initial, next, focus }) => {
          const { o, Repeat, node_append } = window.__ELT__
          const o_lst = o(initial)
          const container = document.createElement("div")
          node_append(
            container,
            Repeat(o_lst, (item: any) => {
              const input = document.createElement("input")
              input.className = "repeat-input"
              input.value = item.get()
              return input
            }).withKeyFunction((s: string) => s),
          )
          node_append(document.body, container)
          const by_key = new Map<string, HTMLInputElement>()
          for (const input of container.querySelectorAll("input")) by_key.set(input.value, input)
          if (focus) by_key.get(focus)!.focus()

          const mo = new MutationObserver(() => {})
          mo.observe(container, { childList: true })
          o_lst.set(next)
          const records = mo.takeRecords()
          mo.disconnect()

          const inputs = [...container.querySelectorAll("input")]
          const out = {
            values: inputs.map((i) => i.value),
            // Surviving keys must keep their input
            kept: next.filter((k) => by_key.has(k)).every((k) => inputs[next.indexOf(k)] === by_key.get(k)),
            focused: focus ? document.activeElement === by_key.get(focus) : true,
            // Elements that were (re)inserted, by value
            added: records.flatMap((r) =>
              [...r.addedNodes].filter((n) => n instanceof HTMLInputElement).map((n) => (n as HTMLInputElement).value),
            ),
            insert_records: records.filter((r) => r.addedNodes.length > 0).length,
            removed: records.flatMap((r) =>
              [...r.removedNodes]
                .filter((n) => n instanceof HTMLInputElement)
                .map((n) => (n as HTMLInputElement).value),
            ),
          }
          window.__ELT__.node_remove(container)
          return out
        },
        { initial, next, focus },
      )

    test("rotating the head to the tail moves only that item", async ({ page }) => {
      const r = await run_update(page, ["a", "b", "c", "d"], ["b", "c", "d", "a"], "b")
      expect(r.values).toEqual(["b", "c", "d", "a"])
      expect(r.kept).toBe(true)
      expect(r.added).toEqual(["a"])
      expect(r.focused).toBe(true)
    })

    // With moveBefore it is kept; without (WebKit), it is given back after the move.
    test("a focused item that has to move keeps its focus", async ({ page }) => {
      const r = await run_update(page, ["a", "b", "c"], ["b", "c", "a"], "a")
      expect(r.values).toEqual(["b", "c", "a"])
      expect(r.added).toEqual(["a"])
      expect(r.focused).toBe(true)
    })

    test("a reversal moves all but one item", async ({ page }) => {
      const r = await run_update(page, ["a", "b", "c", "d", "e"], ["e", "d", "c", "b", "a"])
      expect(r.values).toEqual(["e", "d", "c", "b", "a"])
      expect(r.kept).toBe(true)
      expect(r.added.length).toBe(4)
    })

    test("consecutive new items are inserted with a single operation", async ({ page }) => {
      const r = await run_update(page, ["a", "e"], ["a", "b", "c", "d", "e"])
      expect(r.values).toEqual(["a", "b", "c", "d", "e"])
      expect(r.kept).toBe(true)
      expect(r.added).toEqual(["b", "c", "d"])
      expect(r.insert_records).toBe(1)
    })

    // A Range removal still yields one mutation per node (DOM spec), so only check what was touched.
    test("removing items touches only the removed nodes", async ({ page }) => {
      const r = await run_update(page, ["a", "b", "c", "d", "e"], ["a", "e"])
      expect(r.values).toEqual(["a", "e"])
      expect(r.kept).toBe(true)
      expect(r.added).toEqual([])
      expect(r.removed).toEqual(["b", "c", "d"])
    })

    test("random keyed updates keep order, node identity and observers consistent", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, Repeat, node_append, node_is_observing } = window.__ELT__
        // Deterministic pseudo random generator, so a failure can be replayed
        let seed = 42
        const rand = (n: number) => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff
          return seed % n
        }
        const o_lst = o<string[]>([])
        const container = document.createElement("div")
        node_append(
          container,
          Repeat(o_lst, (item: any) => {
            const span = document.createElement("span")
            span.className = "repeat-item"
            node_append(span, item)
            return span
          }).withKeyFunction((s: string) => s),
        )
        node_append(document.body, container)

        const errors: string[] = []
        let prev = new Map<string, Element>()
        for (let step = 0; step < 300; step++) {
          // Random subset of a 12 letter pool, shuffled
          const pool = "abcdefghijkl".split("").filter(() => rand(3) > 0)
          for (let i = pool.length - 1; i > 0; i--) {
            const j = rand(i + 1)
            ;[pool[i], pool[j]] = [pool[j], pool[i]]
          }
          o_lst.set(pool)

          const spans = [...container.querySelectorAll(".repeat-item")]
          const texts = spans.map((s) => s.textContent)
          if (texts.join() !== pool.join()) errors.push(`step ${step}: ${texts.join()} != ${pool.join()}`)
          for (const [k, el] of prev) {
            const idx = pool.indexOf(k)
            if (idx >= 0 && spans[idx] !== el) errors.push(`step ${step}: ${k} lost its node`)
            // A removed key's node may have been re-keyed for a new key ; only detached nodes must stop.
            if (!el.isConnected && node_is_observing(el as HTMLElement))
              errors.push(`step ${step}: ${k} still observing`)
          }
          prev = new Map(pool.map((k, i) => [k, spans[i]]))
        }
        window.__ELT__.node_remove(container)
        return errors.slice(0, 5)
      })
      expect(result).toEqual([])
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

    test("items leaving the view are dropped, then rendered again when they come back", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, node_is_observing } = window.__ELT__
        const { mount_view_repeat, elements_by_class, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c", "d", "e"])
        const o_start = o(0)
        const o_end = o(2)
        const { container } = mount_view_repeat(o_lst, o_start, o_end)
        const first_a = elements_by_class(container, "repeat-item")[0]

        o_start.set(3)
        o_end.set(5)
        const evicted = {
          connected: first_a.isConnected,
          observing: node_is_observing(first_a),
          texts: item_texts(container),
        }

        o_start.set(0)
        o_end.set(2)
        const back_a = elements_by_class(container, "repeat-item")[0]
        const out = { evicted, texts: item_texts(container), new_node: back_a !== first_a }
        tear_down(container)
        return out
      })
      expect(result.evicted).toEqual({ connected: false, observing: false, texts: ["d", "e"] })
      expect(result.texts).toEqual(["a", "b"])
      expect(result.new_node).toBe(true)
    })

    test("an explicit window can be applied imperatively (internal reconcileView, used by RepeatVirtual)", async ({
      page,
    }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { mount_view_repeat, item_texts, tear_down } = window.__repeat_helpers__
        const o_lst = o(["a", "b", "c", "d", "e"])
        const { container, repeater } = mount_view_repeat(o_lst, o(0), o(5))

        const out: unknown[][] = []
        out.push(item_texts(container))

        // Internal (protected): RepeatVirtual calls it to apply an explicit window
        ;(repeater as any).reconcileView(2, 4)
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
