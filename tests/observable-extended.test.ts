import "./setup.ts"

import { test, expect, describe } from "bun:test"

import {
  o,
  tf_equals,
  tf_array_transform,
  tf_array_group_by,
  tf_map_entries,
  tf_group_by_to_object,
  tf_group_by_to_map,
  tf_array_filter,
  tf_array_has,
  tf_set_has,
  tf_map_has,
} from "../src/observable"

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

describe("Observable extended", () => {
  describe("utility and combinators", () => {
    test("o.none() is true when all arguments are falsy", () => {
      expect(o.none(false, 0, "").get()).toBe(true)
      expect(o.none(false, 1).get()).toBe(false)
    })

    test("o.str() interpolates observable parts", () => {
      const name = o("world")
      const greeting = o.str`hello ${name}!`
      expect(greeting.get()).toBe("hello world!")
      name.set("elt")
      expect(greeting.get()).toBe("hello elt!")
    })

    test("o.tf() on plain values returns transformed plain value", () => {
      const doubled = o.tf(5, (n) => n * 2)
      expect(o.is_observable(doubled)).toBe(false)
      expect(doubled).toBe(10)
    })

    test("o.isReadonlyObservable() recognizes observables", () => {
      const obs = o(1)
      expect(o.isReadonlyObservable(obs)).toBe(true)
      expect(o.isReadonlyObservable(1)).toBe(false)
    })

    test("o.clone() clones top-level object identity", () => {
      const src = { a: 1, b: { c: 2 }, d: [3, 4] }
      const copy = o.clone(src)
      expect(copy).toEqual(src)
      expect(copy).not.toBe(src)
      // Nested structures are shallow-copied for plain objects
      expect(copy.b).toBe(src.b)
      expect(copy.d).toBe(src.d)
    })

    test("o.clone() copies arrays, maps, and sets", () => {
      const arr = o.clone([1, 2, 3])
      expect(arr).toEqual([1, 2, 3])
      expect(arr).not.toBe([1, 2, 3])

      const map = o.clone(new Map([["a", 1]]))
      expect(map.get("a")).toBe(1)
      expect(map).not.toBe(new Map([["a", 1]]))

      const set = o.clone(new Set([1, 2]))
      expect(set.has(2)).toBe(true)
    })

    test("o.assign() on plain objects merges recursively", () => {
      const target = { a: 1, nested: { x: 1, y: 2 } }
      const result = o.assign(target, { nested: { x: 9 } })
      expect(result).toEqual({ a: 1, nested: { x: 9, y: 2 } })
      expect(result).not.toBe(target)
    })

    test("o.then() maps observable values through a promise", async () => {
      const obs = o(2)
      const mapped = o.then(obs, (n) => n * 10)
      expect(await mapped.get()).toBe(20)
      obs.set(3)
      expect(await mapped.get()).toBe(30)
    })
  })

  describe("o.expression() advanced", () => {
    test("skips recomputation when unrelated deps change via prev", () => {
      const heavy = o(100)
      const unrelated = o("a")
      let heavy_runs = 0

      const expr = o.expression((get, _old, updated, prev) => {
        if (updated(unrelated) !== o.NoValue) return prev
        heavy_runs++
        return get(heavy) * 2
      })

      expect(expr.get()).toBe(200)
      expect(heavy_runs).toBe(1)

      unrelated.set("b")
      expect(expr.get()).toBe(200)
      expect(heavy_runs).toBe(1)

      heavy.set(50)
      expect(expr.get()).toBe(100)
      expect(heavy_runs).toBe(2)
    })

    test("get() accepts plain values mixed with observables", () => {
      const a = o(3)
      const expr = o.expression((get) => get(a) + get(7))
      expect(expr.get()).toBe(10)
    })
  })

  describe("merge and join extended", () => {
    test("o.merge() set reverts into member observables", () => {
      const a = o(1)
      const b = o(2)
      const merged = o.merge({ a, b })

      merged.set({ a: 10, b: 20 })
      expect(a.get()).toBe(10)
      expect(b.get()).toBe(20)
    })

    test("nested o.transaction() flushes once per outer transaction", () => {
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

      expect(s.count()).toBe(1)
      expect(sum.get()).toBe(11)
    })
  })

  describe("Map.key() with dynamic keys", () => {
    test("follows observable key changes", () => {
      const map = o(
        new Map<string, number>([
          ["a", 1],
          ["b", 2],
        ])
      )
      const o_key = o<"a" | "b">("a")
      const slot = map.key(o_key)

      expect(slot.get()).toBe(1)

      const s = spy(slot)
      o_key.set("b")
      expect(slot.get()).toBe(2)
      expect(s.count()).toBe(1)
      expect(s.last()).toBe(2)
    })
  })

  describe("observer lifecycle extended", () => {
    test("removeObserver stops further notifications", () => {
      const obs = o(1)
      let count = 0
      const observer = new o.Observer(() => {
        count++
      }, obs)

      observer.startObserving()
      expect(count).toBe(1)

      obs.set(2)
      expect(count).toBe(2)

      obs.removeObserver(observer)
      obs.set(3)
      expect(count).toBe(2)
    })
  })

  describe("o.wrap_promise()", () => {
    test("tracks resolving then resolved value", async () => {
      let resolve!: (v: number) => void
      const pro = new Promise<number>((r) => {
        resolve = r
      })
      const o_pro = o(pro)
      const wrapped = o.wrap_promise(o_pro)

      expect(wrapped.get().resolving).toBe(true)

      resolve(42)
      await pro

      await new Promise((r) => setTimeout(r, 0))

      const state = wrapped.get()
      expect(state.resolving).toBe(false)
      expect(state.resolved).toBe("value")
      if (state.resolved === "value") expect(state.value).toBe(42)
    })

    test("ignores stale promise resolution after the observable changes", async () => {
      let resolve_slow!: (v: number) => void
      const slow = new Promise<number>((r) => {
        resolve_slow = r
      })
      const o_pro = o(slow)
      const wrapped = o.wrap_promise(o_pro)

      expect(wrapped.get().resolving).toBe(true)

      let resolve_fast!: (v: number) => void
      const fast = new Promise<number>((r) => {
        resolve_fast = r
      })
      o_pro.set(fast)
      expect(wrapped.get().resolving).toBe(true)

      resolve_fast(1)
      await fast

      resolve_slow(99)
      await slow

      await new Promise((r) => setTimeout(r, 10))

      const state = wrapped.get()
      expect(state.resolved).toBe("value")
      if (state.resolved === "value") expect(state.value).toBe(1)
    })
  })

  describe("o.exclusive_lock()", () => {
    test("nested calls are ignored while lock is held", () => {
      const lock = o.exclusive_lock()
      let outer = 0
      let inner = 0

      lock(() => {
        outer++
        lock(() => {
          inner++
        })
      })

      expect(outer).toBe(1)
      expect(inner).toBe(0)
    })
  })

  describe("assign on arrays", () => {
    test("assign() updates array indexes on observable", () => {
      const arr = o([1, 2, 3])
      const s = spy(arr)
      arr.assign({ 1: 99 })
      expect(arr.get()).toEqual([1, 99, 3])
      expect(s.count()).toBe(1)
    })
  })

  describe("transformers extended", () => {
    test("tf_equals() compares and reverts to sentinel value", () => {
      const obs = o("on")
      const is_on = obs.tf(tf_equals("on"))

      expect(is_on.get()).toBe(true)
      is_on.set(false)
      expect(obs.get()).toBe("on")
    })

    test("tf_array_transform() picks indices from a function", () => {
      const arr = o([10, 20, 30, 40])
      const picked = arr.tf(
        tf_array_transform((list) => list.map((_, i) => i).filter((i) => i % 2 === 0))
      )
      expect(picked.get()).toEqual([10, 30])
    })

    test("tf_array_group_by() groups items", () => {
      const arr = o([
        { type: "a", v: 1 },
        { type: "b", v: 2 },
        { type: "a", v: 3 },
      ])
      const grouped = arr.tf(tf_array_group_by((item) => item.type))
      const result = grouped.get()
      const a_group = result.find(([k]) => k === "a")
      expect(a_group?.[1].map((x) => x.v)).toEqual([1, 3])
    })

    test("tf_map_entries() round-trips map entries", () => {
      const map = o(
        new Map<string, number>([
          ["x", 1],
          ["y", 2],
        ])
      )
      const entries = map.tf(tf_map_entries())
      expect(entries.get()).toEqual([
        ["x", 1],
        ["y", 2],
      ])
    })

    test("tf_group_by_to_object() groups array into object buckets", () => {
      const arr = o([
        { kind: "a", n: 1 },
        { kind: "b", n: 2 },
        { kind: "a", n: 3 },
      ])
      const grouped = arr.tf(tf_group_by_to_object("kind"))
      const obj = grouped.get()
      expect(obj.a.map((x) => x.n)).toEqual([1, 3])
      expect(obj.b.map((x) => x.n)).toEqual([2])
    })

    test("tf_group_by_to_map() groups array into map buckets", () => {
      const arr = o([
        { kind: "a", n: 1 },
        { kind: "b", n: 2 },
      ])
      const grouped = arr.tf(tf_group_by_to_map((item) => item.kind))
      const m = grouped.get()
      expect(m.get("a")?.[0].n).toBe(1)
      expect(m.get("b")?.[0].n).toBe(2)
    })

    test("tf_array_filter() stable mode keeps indices on array growth", () => {
      const arr = o([1, 2, 3])
      const odds = arr.tf(tf_array_filter((n) => n % 2 === 1, true))
      expect(odds.get()).toEqual([1, 3])

      arr.set([1, 2, 3, 4, 5])
      expect(odds.get()).toEqual([1, 3, 5])
    })

    test("tf_array_has() adding values via true revert", () => {
      const arr = o([1, 2])
      const has = arr.tf(tf_array_has(3, 4))
      expect(has.get()).toBe(false)
      has.set(true)
      expect(arr.get()).toEqual([1, 2, 3, 4])
    })
  })

  describe("o.debounce() and o.throttle()", () => {
    test("o.debounce() delays callback invocation", async () => {
      let count = 0
      const fn = o.debounce(() => {
        count++
      }, 30)

      fn()
      fn()
      expect(count).toBe(0)

      await new Promise((r) => setTimeout(r, 40))
      expect(count).toBe(1)
    })

    test("o.throttle() limits callback invocation rate", async () => {
      let count = 0
      const fn = o.throttle(() => {
        count++
      }, 30, true)

      fn()
      fn()
      expect(count).toBe(1)

      await new Promise((r) => setTimeout(r, 40))
      fn()
      expect(count).toBe(2)
    })
  })

  describe("transformer revert paths", () => {
    test("tf_set_has() true revert adds the value", () => {
      const set = o(new Set([1]))
      const has = set.tf(tf_set_has(2))
      expect(has.get()).toBe(false)
      has.set(true)
      expect(set.get().has(2)).toBe(true)
    })

    test("tf_map_has() true revert adds the entry", () => {
      const map = o(new Map([["a", 1]]))
      const has = map.tf(tf_map_has(["b", 2]))
      expect(has.get()).toBe(false)
      has.set(true)
      expect(map.get().get("b")).toBe(2)
    })
  })

  describe("CombinedObservable disconnect", () => {
    test("disconnect stops parent dependency tracking", () => {
      const a = o(1)
      const combined = o.combine([a], ([x]) => x * 2)
      const s = spy(combined)

      combined.disconnect()
      a.set(5)
      expect(s.count()).toBe(0)
      expect(combined.get()).toBe(2)
    })
  })
})
