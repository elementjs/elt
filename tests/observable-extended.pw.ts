import { expect, test } from "@playwright/test"
// Type-only import: brings in the `o` namespace (for `o.ReadonlyObservable<T>` etc.) used to type
// the local `spy()` helpers below. The actual runtime `o` used inside `page.evaluate` always comes
// from `window.__ELT__`, never from this import.
import type { o } from "elt"

// Ported from tests/observable-extended.test.ts (bun:test + happy-dom) to Playwright driving real
// headless Chromium. This file is pure Observable-logic testing with no real DOM interaction, so
// conversion is mostly mechanical: each test body runs inside `page.evaluate`, using
// `window.__ELT__` instead of a direct `../src/observable` import, and pushes
// `{ name, actual, expected }` entries into a results array that's returned and then asserted with
// real `expect()` in Node so Playwright's reporter shows per-assertion pass/fail.

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("Observable extended", () => {
  test.describe("utility and combinators", () => {
    test("o.none() is true when all arguments are falsy", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        out.push({ name: "none(false,0,'')", actual: o.none(false, 0, "").get(), expected: true })
        out.push({ name: "none(false,1)", actual: o.none(false, 1).get(), expected: false })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("o.str() interpolates observable parts", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const name = o("world")
        const greeting = o.str`hello ${name}!`
        out.push({ name: "initial", actual: greeting.get(), expected: "hello world!" })
        name.set("elt")
        out.push({ name: "after set", actual: greeting.get(), expected: "hello elt!" })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("o.tf() on plain values returns transformed plain value", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const doubled = o.tf(5, (n) => n * 2)
        out.push({ name: "is_observable", actual: o.is_observable(doubled), expected: false })
        out.push({ name: "value", actual: doubled, expected: 10 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("o.isReadonlyObservable() recognizes observables", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const obs = o(1)
        out.push({ name: "obs is observable", actual: o.isReadonlyObservable(obs), expected: true })
        out.push({ name: "1 is not observable", actual: o.isReadonlyObservable(1), expected: false })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("o.clone() clones top-level object identity", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const src = { a: 1, b: { c: 2 }, d: [3, 4] }
        const copy = o.clone(src)
        out.push({ name: "copy equals src", actual: copy, expected: src })
        out.push({ name: "copy !== src", actual: copy === src, expected: false })
        // Nested structures are shallow-copied for plain objects
        out.push({ name: "copy.b === src.b", actual: copy.b === src.b, expected: true })
        out.push({ name: "copy.d === src.d", actual: copy.d === src.d, expected: true })
        return out
      })
      for (const r of results) {
        if (r.name === "copy !== src" || r.name.includes("===")) expect(r.actual, r.name).toBe(r.expected)
        else expect(r.actual, r.name).toEqual(r.expected)
      }
    })

    test("o.clone() copies arrays, maps, and sets", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown; kind?: string }[] = []
        const arr = o.clone([1, 2, 3])
        out.push({ name: "arr equals", actual: arr, expected: [1, 2, 3], kind: "equal" })
        out.push({ name: "arr not same ref", actual: arr === ([1, 2, 3] as any), expected: false, kind: "be" })

        const map = o.clone(new Map([["a", 1]]))
        out.push({ name: "map.get(a)", actual: map.get("a"), expected: 1, kind: "be" })
        out.push({
          name: "map not same ref",
          actual: map === (new Map([["a", 1]]) as any),
          expected: false,
          kind: "be",
        })

        const set = o.clone(new Set([1, 2]))
        out.push({ name: "set.has(2)", actual: set.has(2), expected: true, kind: "be" })
        return out
      })
      for (const r of results) {
        if (r.kind === "equal") expect(r.actual, r.name).toEqual(r.expected)
        else expect(r.actual, r.name).toBe(r.expected)
      }
    })

    test('o.clone() keeps every RegExp flag (regression: flags collapsed to a lone "g")', async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const src = /a.b/imsuy
        const copy = o.clone(src)
        return { same: copy === src, source: copy.source, flags: copy.flags }
      })
      expect(result).toEqual({ same: false, source: "a.b", flags: "imsuy" })
    })

    test("o.clone() keeps the prototype and enumerable symbol keys, shallowly", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        class Vec {
          constructor(
            public x: number,
            public inner: { y: number },
          ) {}
          len() {
            return this.x
          }
        }
        // The object editor stamps row ids as enumerable symbol keys and relies on them surviving a clone
        const sym = Symbol("row")
        const src = new Vec(3, { y: 1 }) as Vec & { [sym]?: number }
        src[sym] = 42
        const copy = o.clone(src)
        return {
          same: copy === src,
          is_vec: copy instanceof Vec,
          len: copy.len(),
          sym: copy[sym],
          inner_shared: copy.inner === src.inner,
        }
      })
      expect(result).toEqual({ same: false, is_vec: true, len: 3, sym: 42, inner_shared: true })
    })

    test("o.debounce(ms, leading) used as a decorator honors leading (regression: two-argument decorator form was treated as a plain call, and leading was dropped)", async ({
      page,
    }) => {
      const result = await page.evaluate(async () => {
        const { o } = window.__ELT__
        let calls = 0
        const desc: PropertyDescriptor = {
          value: () => {
            calls++
          },
        }
        // decorator syntax can't be serialized into page.evaluate, so apply the decorator by hand
        o.debounce(20, true)(null, "method", desc)
        const self = {}
        desc.value.call(self)
        const after_first_call = calls
        desc.value.call(self)
        const after_second_call = calls
        await new Promise((r) => setTimeout(r, 40))
        return { after_first_call, after_second_call, after_wait: calls }
      })
      // leading: the first call runs immediately, the second is debounced into the trailing timer
      expect(result).toEqual({ after_first_call: 1, after_second_call: 1, after_wait: 2 })
    })

    test("o.expression() reading old() of an observable before get() of another returns the right value (regression: old() registered a dependency without an index)", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const o_a = o("A")
        const o_b = o("B")
        const ex = o.expression((get, old) => {
          old(o_a)
          return get(o_b)
        })
        const values: unknown[] = []
        const obs = new o.Observer((v) => {
          values.push(v)
        }, ex)
        obs.startObserving()
        o_b.set("B2")
        obs.stopObserving()
        return values
      })
      expect(result).toEqual(["B", "B2"])
    })

    test("o.combine() without a setter throws an explicit error when written to", async ({ page }) => {
      const message = await page.evaluate(() => {
        const { o } = window.__ELT__
        const combined = o.combine([o(1), o(2)] as const, ([a, b]) => a + b)
        try {
          // typed read-only, but the object is a CombinedObservable underneath: write through `any` on purpose
          ;(combined as any).set(10)
          return "no error"
        } catch (e) {
          return (e as Error).message
        }
      })
      expect(message).toContain("read-only")
    })

    test("o.assign() on plain objects merges recursively", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const target = { a: 1, nested: { x: 1, y: 2 } }
        const result = o.assign(target, { nested: { x: 9 } })
        out.push({ name: "result equals", actual: result, expected: { a: 1, nested: { x: 9, y: 2 } } })
        out.push({ name: "result !== target", actual: result === target, expected: false })
        return out
      })
      expect(results[0].actual, results[0].name).toEqual(results[0].expected)
      expect(results[1].actual, results[1].name).toBe(results[1].expected)
    })

    test("o.then() maps observable values through a promise", async ({ page }) => {
      const results = await page.evaluate(async () => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const obs = o(2)
        const mapped = o.then(obs, (n) => n * 10)
        out.push({ name: "initial", actual: await mapped.get(), expected: 20 })
        obs.set(3)
        out.push({ name: "after set", actual: await mapped.get(), expected: 30 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("o.then() rejects when the source rejects or the function throws, with no unhandled rejection (regression: it never settled)", async ({
      page,
    }) => {
      const result = await page.evaluate(async () => {
        const { o } = window.__ELT__
        const unhandled: unknown[] = []
        const on_unhandled = (e: PromiseRejectionEvent) => unhandled.push(String(e.reason))
        window.addEventListener("unhandledrejection", on_unhandled)
        const settle = (p: Promise<unknown>) =>
          Promise.race([
            p.then(
              (v) => `value ${v}`,
              (e) => `error ${e.message}`,
            ),
            new Promise((r) => setTimeout(() => r("pending"), 50)),
          ])
        const from_source = await settle(o.then(o(Promise.reject(new Error("E1"))), (n: number) => n).get())
        const from_fn = await settle(
          o
            .then(o(Promise.resolve(1)), () => {
              throw new Error("E2")
            })
            .get(),
        )
        await new Promise((r) => setTimeout(r, 20))
        window.removeEventListener("unhandledrejection", on_unhandled)
        return { from_source, from_fn, unhandled }
      })
      expect(result).toEqual({ from_source: "error E1", from_fn: "error E2", unhandled: [] })
    })

    test("o.prop() applies def with a plain key, as with an observable key (regression: def was ignored)", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const obj = o<{ a?: number }>({ a: undefined })
        return [o.prop(obj, "a", () => 42).get(), o.prop(obj, o("a" as const), () => 42).get()]
      })
      expect(result).toEqual([42, 42])
    })

    test(".p(fn) writes through index access, and throws when it cannot guess the path (regression: it wrote to the wrong place)", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const obj = o({ items: [{ name: "x" }], a: { b: 1 } })
        obj.p((v) => v.items[0].name).set("y")
        // biome-ignore lint/complexity/useArrowFunction: the `function` form is the shape under test
        const getter = function (v: { a: { b: number } }) {
          return v.a.b
        }
        obj.p(getter).set(2)
        let error = ""
        try {
          obj.p((v) => v.a.b + 1).set(10)
        } catch (e) {
          error = (e as Error).message.startsWith("o.prop: cannot write through") ? "thrown" : (e as Error).message
        }
        return { value: obj.get(), error }
      })
      expect(result).toEqual({ value: { items: [{ name: "y" }], a: { b: 2 } }, error: "thrown" })
    })
  })

  test("a read-only .tf(fn) throws on set, as a read-only combine does (regression: the write was silently ignored)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { o } = window.__ELT__
      const o_n = o(1)
      const oo_double = o_n.tf((n) => n * 2) as unknown as { set(v: number): void }
      try {
        oo_double.set(10)
        return "no error"
      } catch (e) {
        return (e as Error).message
      }
    })
    expect(result).toBe("tf: this observable is read-only, no revert function was given")
  })

  test.describe("mutate()", () => {
    test("edits a draft, replaces the value with a returned one, and writes nothing on o.NoValue", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const o_user = o({ tags: ["a"] })
        let calls = 0
        o_user.addObserver(() => {
          calls++
        })
        o_user.mutate((draft) => {
          draft.tags.push("b")
        })
        const edited = o_user.get().tags.join(",")
        o_user.mutate(() => ({ tags: ["z"] }))
        const replaced = o_user.get().tags.join(",")
        o_user.mutate(() => o.NoValue)
        return { edited, replaced, after_novalue: o_user.get().tags.join(","), calls }
      })
      expect(result).toEqual({ edited: "a,b", replaced: "z", after_novalue: "z", calls: 3 })
    })
  })

  test.describe("o.expression() advanced", () => {
    test("o.expression() gives prev only to a callback that declares it", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const o_n = o(1)
        const seen: { three: unknown[]; four: unknown[] } = { three: [], four: [] }
        const three = o.expression(function (get, _old, _updated) {
          // biome-ignore lint/complexity/noArguments: reads the 4th argument without declaring it, which is the case under test
          const prev = arguments[3]
          seen.three.push(prev === o.NoValue ? "none" : prev)
          return get(o_n)
        })
        const four = o.expression((get, _old, _updated, prev) => {
          seen.four.push(prev === o.NoValue ? "none" : prev)
          return get(o_n)
        })
        three.addObserver(() => {})
        four.addObserver(() => {})
        o_n.set(2)
        return seen
      })
      expect(result).toEqual({ three: ["none", "none"], four: ["none", 1] })
    })

    test("updated() of a plain value gives o.NoValue, as for an unchanged observable (regression: it gave false)", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const o_n = o(1)
        let plain: unknown = null
        const ex = o.expression((get, _old, updated) => {
          plain = updated(5)
          return get(o_n)
        })
        ex.addObserver(() => {})
        return plain === o.NoValue
      })
      expect(result).toBe(true)
    })

    test("skips recomputation when unrelated deps change via prev", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const heavy = o(100)
        const unrelated = o("a")
        let heavy_runs = 0

        const expr = o.expression((get, _old, updated, prev) => {
          if (updated(unrelated) !== o.NoValue) return prev
          heavy_runs++
          return get(heavy) * 2
        })

        out.push({ name: "initial value", actual: expr.get(), expected: 200 })
        out.push({ name: "initial runs", actual: heavy_runs, expected: 1 })

        unrelated.set("b")
        out.push({ name: "value after unrelated change", actual: expr.get(), expected: 200 })
        out.push({ name: "runs after unrelated change", actual: heavy_runs, expected: 1 })

        heavy.set(50)
        out.push({ name: "value after heavy change", actual: expr.get(), expected: 100 })
        out.push({ name: "runs after heavy change", actual: heavy_runs, expected: 2 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("get() accepts plain values mixed with observables", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const a = o(3)
        const expr = o.expression((get) => get(a) + get(7))
        return expr.get()
      })
      expect(result).toBe(10)
    })

    test("writable expression reverts through fn_revert", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const o_a = o(1)
        const o_b = o(10)
        const sum = o.expression(
          (get) => get(o_a) + get(o_b),
          (value, set) => {
            set(o_a, value - o_b.get())
          },
        )

        out.push({ name: "initial sum", actual: sum.get(), expected: 11 })
        sum.set(20)
        out.push({ name: "o_a after set", actual: o_a.get(), expected: 10 })
        out.push({ name: "o_b after set", actual: o_b.get(), expected: 10 })
        out.push({ name: "sum after set", actual: sum.get(), expected: 20 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("writable expression can split a set across several sources", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const o_x = o(3)
        const o_y = o(7)
        const total = o.expression(
          (get) => get(o_x) + get(o_y),
          (value, set) => {
            set(o_x, Math.floor(value / 2))
            set(o_y, value - Math.floor(value / 2))
          },
        )

        total.set(11)
        out.push({ name: "sum of parts", actual: o_x.get() + o_y.get(), expected: 11 })
        out.push({ name: "total", actual: total.get(), expected: 11 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })
  })

  test.describe("merge and join extended", () => {
    test("o.merge() set reverts into member observables", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const a = o(1)
        const b = o(2)
        const merged = o.merge({ a, b })

        merged.set({ a: 10, b: 20 })
        out.push({ name: "a", actual: a.get(), expected: 10 })
        out.push({ name: "b", actual: b.get(), expected: 20 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("nested o.transaction() flushes once per outer transaction", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []

        function spy<T>(obs: o.ReadonlyObservable<T>, immediate = false) {
          let count = 0
          let last: T | undefined
          obs.addObserver((v, old) => {
            if (old !== o.NoValue || immediate) {
              count++
              last = v
            }
          })
          return {
            count: () => count,
            last: () => last,
            reset: () => {
              count = 0
              last = undefined
            },
          }
        }

        const a = o(1)
        const b = o(2)
        const sum = o.combine([a, b], ([x, y]) => x + y)
        const s = spy(sum)

        o.transaction(() => {
          o.transaction(() => {
            a.set(5)
            b.set(6)
          })
          a.set(5)
        })

        out.push({ name: "count", actual: s.count(), expected: 1 })
        out.push({ name: "sum", actual: sum.get(), expected: 11 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })
  })

  test.describe("Map.key() with dynamic keys", () => {
    test("follows observable key changes", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []

        function spy<T>(obs: o.ReadonlyObservable<T>, immediate = false) {
          let count = 0
          let last: T | undefined
          obs.addObserver((v, old) => {
            if (old !== o.NoValue || immediate) {
              count++
              last = v
            }
          })
          return {
            count: () => count,
            last: () => last,
            reset: () => {
              count = 0
              last = undefined
            },
          }
        }

        const map = o(
          new Map<string, number>([
            ["a", 1],
            ["b", 2],
          ]),
        )
        const o_key = o<"a" | "b">("a")
        const slot = map.key(o_key)

        out.push({ name: "initial", actual: slot.get(), expected: 1 })

        const s = spy(slot)
        o_key.set("b")
        out.push({ name: "after key change", actual: slot.get(), expected: 2 })
        out.push({ name: "spy count", actual: s.count(), expected: 1 })
        out.push({ name: "spy last", actual: s.last(), expected: 2 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })
  })

  test.describe("observer lifecycle extended", () => {
    test("an observer that throws does not stop the other observers of the same observable", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const errors: unknown[] = []
        const console_error = console.error
        console.error = (e: unknown) => errors.push(e)
        try {
          const o_n = o(1)
          const seen: number[] = []
          o_n.addObserver((v) => {
            if (v === 2) throw new Error("boom")
          })
          o_n.addObserver((v) => {
            seen.push(v)
          })
          o_n.set(2)
          return { seen, errors: errors.length }
        } finally {
          console.error = console_error
        }
      })
      expect(result).toEqual({ seen: [1, 2], errors: 1 })
    })

    test("ObserverHolder.observe follows the node_observe rule for plain values (regression: changes_only still fired)", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const calls: string[] = []
        const holder = new o.ObserverHolder()
        holder.observeChanges(5, () => {
          calls.push("changes_only")
        })
        holder.observe(
          6,
          () => {
            calls.push("immediate")
          },
          { immediate: true },
        )
        holder.observe(7, () => {
          calls.push("deferred")
        })
        calls.push("start")
        holder.startObservers()
        return calls
      })
      expect(result).toEqual(["immediate", "start", "deferred"])
    })

    test("observer and child arrays stay small when observers come and go (regression: removals left holes forever)", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const o_src = o(0)
        o_src.addObserver(() => {})
        const oo_derived = o_src.tf((v) => v)
        const keep = [0, 1, 2].map(() => oo_derived.addObserver(() => {}))
        for (let i = 0; i < 1000; i++) {
          const ob = oo_derived.addObserver(() => {})
          oo_derived.removeObserver(ob)
          const oo_tmp = o_src.tf((v) => v + 1)
          oo_tmp.removeObserver(oo_tmp.addObserver(() => {}))
        }
        for (const ob of keep) oo_derived.removeObserver(ob)
        return { children: o_src._children.arr.length, observers: oo_derived._observers.arr.length }
      })
      expect(result.children).toBeLessThanOrEqual(8)
      expect(result.observers).toBeLessThanOrEqual(8)
    })

    test("a chain of diamonds is scheduled in linear time, and each node sees consistent values (regression: exponential walk)", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const o_src = o(0)
        let top: o.ReadonlyObservable<number> = o_src
        let runs = 0
        for (let i = 0; i < 24; i++) {
          // b and c both derive from top, d combines them: d must run after both
          const b = top.tf((v) => v + 1)
          const c = top.tf((v) => v - 1)
          top = o.combine([b, c] as const, ([x, y]) => {
            runs++
            return (x + y) / 2
          })
        }
        const seen: number[] = []
        top.addObserver((v) => {
          seen.push(v)
        })
        runs = 0
        const t0 = performance.now()
        o_src.set(5)
        return { ms: performance.now() - t0, runs, seen }
      })
      // 24 layers would be 2^24 paths for a walk that does not skip visited nodes
      expect(result.ms).toBeLessThan(50)
      expect(result.runs).toBe(24)
      expect(result.seen).toEqual([0, 5])
    })

    test("an observable whose computation threw once leaves the queue usable after it is unwatched (regression: its stale queue index made later flushes never run)", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const errors: unknown[] = []
        const console_error = console.error
        console.error = (e: unknown) => errors.push(e)
        try {
          const o_src = o(1)
          const oo_bad = o_src.tf((v) => {
            if (v === 2) throw new Error("boom")
            return v
          })
          const bad_observer = oo_bad.addObserver(() => {})
          o_src.set(2) // the computation throws during the flush
          oo_bad.removeObserver(bad_observer) // unwatched while its queue index is stale

          const o_other = o("a")
          const seen: string[] = []
          o_other.addObserver((v) => {
            seen.push(v)
          })
          o_other.set("b")
          return { seen, errors: errors.length }
        } finally {
          console.error = console_error
        }
      })
      expect(result).toEqual({ seen: ["a", "b"], errors: 1 })
    })

    test("removeObserver stops further notifications", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const obs = o(1)
        let count = 0
        const observer = new o.Observer(() => {
          count++
        }, obs)

        observer.startObserving()
        out.push({ name: "count after start", actual: count, expected: 1 })

        obs.set(2)
        out.push({ name: "count after set(2)", actual: count, expected: 2 })

        obs.removeObserver(observer)
        obs.set(3)
        out.push({ name: "count after removeObserver + set(3)", actual: count, expected: 2 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })
  })

  test.describe("o.wrap_promise()", () => {
    test("tracks resolving then resolved value", async ({ page }) => {
      const results = await page.evaluate(async () => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        let resolve!: (v: number) => void
        const pro = new Promise<number>((r) => {
          resolve = r
        })
        const o_pro = o(pro)
        const wrapped = o.wrap_promise(o_pro)

        out.push({ name: "resolving before resolve", actual: wrapped.get().resolving, expected: true })

        resolve(42)
        await pro

        await new Promise((r) => setTimeout(r, 0))

        const state = wrapped.get()
        out.push({ name: "resolving after resolve", actual: state.resolving, expected: false })
        out.push({ name: "resolved kind", actual: state.resolved, expected: "value" })
        if (state.resolved === "value") out.push({ name: "resolved value", actual: state.value, expected: 42 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("ignores stale promise resolution after the observable changes", async ({ page }) => {
      const results = await page.evaluate(async () => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        let resolve_slow!: (v: number) => void
        const slow = new Promise<number>((r) => {
          resolve_slow = r
        })
        const o_pro = o(slow)
        const wrapped = o.wrap_promise(o_pro)

        out.push({ name: "resolving before any resolve", actual: wrapped.get().resolving, expected: true })

        let resolve_fast!: (v: number) => void
        const fast = new Promise<number>((r) => {
          resolve_fast = r
        })
        o_pro.set(fast)
        out.push({ name: "resolving after swapping promise", actual: wrapped.get().resolving, expected: true })

        resolve_fast(1)
        await fast

        resolve_slow(99)
        await slow

        await new Promise((r) => setTimeout(r, 10))

        const state = wrapped.get()
        out.push({ name: "resolved kind", actual: state.resolved, expected: "value" })
        if (state.resolved === "value") out.push({ name: "resolved value", actual: state.value, expected: 1 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("o.wrap_promise() reports a rejection with no unhandled rejection (regression: .then and .catch were separate)", async ({
      page,
    }) => {
      const result = await page.evaluate(async () => {
        const { o } = window.__ELT__
        const unhandled: unknown[] = []
        const on_unhandled = (e: PromiseRejectionEvent) => unhandled.push(String(e.reason))
        window.addEventListener("unhandledrejection", on_unhandled)
        const wrapped = o.wrap_promise(o(Promise.reject(new Error("E1"))))
        wrapped.addObserver(() => {})
        await new Promise((r) => setTimeout(r, 20))
        window.removeEventListener("unhandledrejection", on_unhandled)
        return { resolved: wrapped.get().resolved, unhandled }
      })
      expect(result).toEqual({ resolved: "error", unhandled: [] })
    })
  })

  test.describe("o.exclusive_lock()", () => {
    test("nested calls are ignored while lock is held", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const lock = o.exclusive_lock()
        let outer = 0
        let inner = 0

        lock(() => {
          outer++
          lock(() => {
            inner++
          })
        })

        out.push({ name: "outer", actual: outer, expected: 1 })
        out.push({ name: "inner", actual: inner, expected: 0 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })
  })

  test.describe("assign on arrays", () => {
    test("assign() updates array indexes on observable", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []

        function spy<T>(obs: o.ReadonlyObservable<T>, immediate = false) {
          let count = 0
          obs.addObserver((_v, old) => {
            if (old !== o.NoValue || immediate) count++
          })
          return { count: () => count }
        }

        const arr = o([1, 2, 3])
        const s = spy(arr)
        arr.assign({ 1: 99 })
        out.push({ name: "array", actual: arr.get(), expected: [1, 99, 3] })
        out.push({ name: "spy count", actual: s.count(), expected: 1 })
        return out
      })
      expect(results[0].actual, results[0].name).toEqual(results[0].expected)
      expect(results[1].actual, results[1].name).toBe(results[1].expected)
    })
  })

  test.describe("transformers extended", () => {
    test("tf_equals() compares and reverts to sentinel value", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o, tf_equals } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const obs = o("on")
        const is_on = obs.tf(tf_equals("on"))

        out.push({ name: "initial", actual: is_on.get(), expected: true })
        is_on.set(false)
        out.push({ name: "obs after revert", actual: obs.get(), expected: "on" })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("tf_array_transform() picks indices from a function", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, tf_array_transform } = window.__ELT__
        const arr = o([10, 20, 30, 40])
        const picked = arr.tf(tf_array_transform((list) => list.map((_, i) => i).filter((i) => i % 2 === 0)))
        return picked.get()
      })
      expect(result).toEqual([10, 30])
    })

    test("tf_array_group_by() groups items", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, tf_array_group_by } = window.__ELT__
        const arr = o([
          { type: "a", v: 1 },
          { type: "b", v: 2 },
          { type: "a", v: 3 },
        ])
        const grouped = arr.tf(tf_array_group_by((item: { type: string; v: number }) => item.type))
        const result = grouped.get()
        const a_group = result.find(([k]) => k === "a")
        return a_group?.[1].map((x) => x.v)
      })
      expect(result).toEqual([1, 3])
    })

    test("tf_array_group_by() writes a changed group back to the source positions", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, tf_array_group_by } = window.__ELT__
        type Item = { type: string; v: number }
        const arr = o<Item[]>([
          { type: "a", v: 1 },
          { type: "b", v: 2 },
          { type: "a", v: 3 },
        ])
        const grouped = arr.tf(tf_array_group_by((item: Item) => item.type))
        grouped.addObserver(() => {})
        grouped.set(grouped.get().map(([k, items]) => [k, items.map((it) => ({ ...it, v: it.v * 10 }))]))
        return arr.get().map((x) => `${x.type}${x.v}`)
      })
      expect(result).toEqual(["a10", "b20", "a30"])
    })

    test("tf_map_entries() round-trips map entries", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, tf_map_entries } = window.__ELT__
        const map = o(
          new Map<string, number>([
            ["x", 1],
            ["y", 2],
          ]),
        )
        const entries = map.tf(tf_map_entries())
        return entries.get()
      })
      expect(result).toEqual([
        ["x", 1],
        ["y", 2],
      ])
    })

    test("tf_group_by_to_object() groups array into object buckets", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, tf_group_by_to_object } = window.__ELT__
        const arr = o([
          { kind: "a", n: 1 },
          { kind: "b", n: 2 },
          { kind: "a", n: 3 },
        ])
        const grouped = arr.tf(tf_group_by_to_object<{ kind: string; n: number }>("kind"))
        const obj = grouped.get()
        return { a: obj.a.map((x) => x.n), b: obj.b.map((x) => x.n) }
      })
      expect(result.a).toEqual([1, 3])
      expect(result.b).toEqual([2])
    })

    test("tf_group_by_to_map() groups array into map buckets", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, tf_group_by_to_map } = window.__ELT__
        const arr = o([
          { kind: "a", n: 1 },
          { kind: "b", n: 2 },
        ])
        const grouped = arr.tf(tf_group_by_to_map((item: { kind: string; n: number }) => item.kind))
        const m = grouped.get()
        return { a: m.get("a")?.[0].n, b: m.get("b")?.[0].n }
      })
      expect(result.a).toBe(1)
      expect(result.b).toBe(2)
    })

    test("tf_array_filter() stable mode keeps indices on array growth", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o, tf_array_filter } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const arr = o([1, 2, 3])
        const odds = arr.tf(tf_array_filter((n: number) => n % 2 === 1, true))
        out.push({ name: "initial", actual: odds.get(), expected: [1, 3] })

        arr.set([1, 2, 3, 4, 5])
        out.push({ name: "after growth", actual: odds.get(), expected: [1, 3, 5] })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toEqual(r.expected)
    })

    test("tf_array_filter() stable mode refilters everything when the condition changes (regression: it kept only the items added after the change)", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const { o, tf_array_filter } = window.__ELT__
        const arr = o([1, 2, 3, 4, 5, 6])
        const o_cond = o((n: number) => n % 2 === 0)
        const filtered = arr.tf(tf_array_filter(o_cond, true))
        filtered.addObserver(() => {})
        const even = filtered.get()
        o_cond.set((n: number) => n % 2 === 1)
        const odd = filtered.get()
        // stable: the kept indices stay, only the new items are checked; a shrink drops the indices past the end
        arr.set([1, 20, 3, 4, 5, 6, 7, 8])
        const grown = filtered.get()
        arr.set([1, 20, 3])
        return { even, odd, grown, shrunk: filtered.get() }
      })
      expect(result).toEqual({ even: [2, 4, 6], odd: [1, 3, 5], grown: [1, 3, 5, 7], shrunk: [1, 3] })
    })

    test("group writes put each item back at its source position, and append added items", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, tf_group_by_to_object, tf_group_by_to_map, tf_array_group_by } = window.__ELT__
        type Item = { k: string; v: number }
        const make = () =>
          o<Item[]>([
            { k: "a", v: 1 },
            { k: "b", v: 2 },
            { k: "a", v: 3 },
          ])
        const to_object = make()
        const obj = to_object.tf(tf_group_by_to_object<Item>("k"))
        obj.addObserver(() => {})
        obj.set({ ...obj.get(), a: [...obj.get().a, { k: "a", v: 4 }] })
        const to_map = make()
        const map = to_map.tf(tf_group_by_to_map((it: Item) => it.k))
        map.addObserver(() => {})
        map.set(new Map([...map.get()].map(([k, items]) => [k, items.map((it) => ({ ...it, v: it.v * 10 }))])))
        const to_array = make()
        const groups = to_array.tf(tf_array_group_by((it: Item) => it.k))
        groups.addObserver(() => {})
        groups.set(groups.get().map(([k, items]) => [k, k === "b" ? [...items, { k: "b", v: 5 }] : items]))
        const vs = (o_list: typeof to_object) => o_list.get().map((it) => it.v)
        return { object: vs(to_object), map: vs(to_map), array: vs(to_array) }
      })
      expect(result).toEqual({ object: [1, 2, 3, 4], map: [10, 20, 30], array: [1, 2, 3, 5] })
    })

    test("tf_array_has() adding values via true revert", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o, tf_array_has } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown; kind?: string }[] = []
        const arr = o([1, 2])
        const has = arr.tf(tf_array_has(3, 4))
        out.push({ name: "initial", actual: has.get(), expected: false, kind: "be" })
        has.set(true)
        out.push({ name: "array after revert", actual: arr.get(), expected: [1, 2, 3, 4], kind: "equal" })
        return out
      })
      for (const r of results) {
        if (r.kind === "equal") expect(r.actual, r.name).toEqual(r.expected)
        else expect(r.actual, r.name).toBe(r.expected)
      }
    })
  })

  test.describe("o.debounce() and o.throttle()", () => {
    test("o.debounce() delays callback invocation", async ({ page }) => {
      const results = await page.evaluate(async () => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        let count = 0
        const fn = o.debounce(() => {
          count++
        }, 30)

        fn()
        fn()
        out.push({ name: "before delay", actual: count, expected: 0 })

        await new Promise((r) => setTimeout(r, 40))
        out.push({ name: "after delay", actual: count, expected: 1 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("o.throttle() limits callback invocation rate", async ({ page }) => {
      const results = await page.evaluate(async () => {
        const { o } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        let count = 0
        const fn = o.throttle(
          () => {
            count++
          },
          30,
          true,
        )

        fn()
        fn()
        out.push({ name: "after first burst", actual: count, expected: 1 })

        await new Promise((r) => setTimeout(r, 40))
        fn()
        out.push({ name: "after cooldown + call", actual: count, expected: 2 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("o.debounce() and o.throttle() decorators keep one timer per instance (regression: all instances shared one timer)", async ({
      page,
    }) => {
      const result = await page.evaluate(async () => {
        const { o } = window.__ELT__
        const hits: string[] = []
        // decorator syntax can't be serialized into page.evaluate, so apply the decorators by hand
        const deb: PropertyDescriptor = {
          value(this: { name: string }) {
            hits.push(`deb ${this.name}`)
          },
        }
        const thr: PropertyDescriptor = {
          value(this: { name: string }) {
            hits.push(`thr ${this.name}`)
          },
        }
        o.debounce(20)(null, "deb", deb)
        o.throttle(20)(null, "thr", thr)
        const c1 = { name: "c1" }
        const c2 = { name: "c2" }
        deb.value.call(c1)
        deb.value.call(c2)
        thr.value.call(c1)
        thr.value.call(c2)
        await new Promise((r) => setTimeout(r, 50))
        return hits.sort()
      })
      expect(result).toEqual(["deb c1", "deb c2", "thr c1", "thr c2"])
    })
  })

  test.describe("transformer revert paths", () => {
    test("tf_set_has() true revert adds the value", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o, tf_set_has } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const set = o(new Set([1]))
        const has = set.tf(tf_set_has(2))
        out.push({ name: "initial", actual: has.get(), expected: false })
        has.set(true)
        out.push({ name: "set has 2 after revert", actual: set.get().has(2), expected: true })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("tf_map_has() true revert adds the entry", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o, tf_map_has } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const map = o(new Map([["a", 1]]))
        const has = map.tf(tf_map_has(["b", 2]))
        out.push({ name: "initial", actual: has.get(), expected: false })
        has.set(true)
        out.push({ name: "map.get(b) after revert", actual: map.get().get("b"), expected: 2 })
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })
  })
})
