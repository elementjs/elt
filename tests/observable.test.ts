import "./setup.ts"

import { test, expect, describe, beforeEach } from "bun:test"

import {
  o,
  tf_array_filter,
  tf_array_sort,
  tf_array_sort_by,
  tf_array_has,
  tf_set_has,
  tf_map_has,
  tf_entries,
  tf_array_to_map,
  tf_array_to_object,
} from "../src/observable"

function cmp(a: any, b: any) {
  if (a === b) return true
  if (a !== b && (typeof a !== "object" || typeof b !== "object")) return false
  if (a == null || b == null) return false

  for (var x in a) {
    if (!cmp(a[x], b[x])) return false
  }

  return true
}

class Calls {
  count = 0
  calls = [] as any[]

  ntimes(times: number): this {
    if (this.count !== times)
      throw new Error(
        `Expected to be called ${times} times but was called ${this.count} times`
      )
    this.count = 0
    return this
  }

  with(...args: any[]) {
    for (var call of this.calls) {
      for (var i = 0; i < args.length; i++) {
        if (!cmp(args[i], call[i]))
          throw new Error(
            `At position ${i}, expected ${JSON.stringify(
              args[i]
            )} got ${JSON.stringify(call[i])}`
          )
      }
    }
    this.calls = []
    return this
  }

  callback() {
    let self = this
    return () => {
      ;(this.call as any).apply(self, arguments)
    }
  }

  call(...args: any[]) {
    this.count++
    this.calls.push(args)
  }

  get was() {
    return this
  }
  get called() {
    return this
  }

  get once() {
    return this.ntimes(1)
  }
  get twice() {
    return this.ntimes(2)
  }
  get never() {
    return this.ntimes(0)
  }
  get not() {
    return this.ntimes(0)
  }
}

////////////////////////////////////////////////////////////////////

function spyon<T>(obs: o.ReadonlyObservable<T>, immediate = false) {
  let spy = new Calls()

  obs.addObserver(function (value, changes) {
    if (changes !== o.NoValue || immediate) {
      spy.call(value) // , changes.new_value, changes.old_value)
    }
  })
  return spy
}

describe("Observable", function () {
  describe("basic operations", function () {
    let obs = o(0)

    let spytest = spyon(obs)
    let spytest2 = spyon(obs, true)

    beforeEach(() => {
      obs.set(0)
      spytest = spyon(obs)
      spytest2 = spyon(obs, true)
    })

    test("addObserver is called immediately", () => {
      spytest2.was.called.once
      spytest2.was.called.with(0)

      obs.set(4)

      spytest2.was.called.once
      spytest2.was.called.with(4)
    })

    test("updateOnly is not called immediately", () => {
      spytest.was.never.called
      obs.set(3)
      spytest.was.called.with(3)
      spytest.was.called.once
    })

    test("set correctly changes the value", () => {
      obs.set(4)
      expect(obs.get()).toBe(4)
    })

    test("observers are not called again when the value is the same", () => {
      obs.set(0)
      spytest.was.never.called
      spytest2.was.called.once
    })
  })

  describe("boolean operations", function () {
    test("and/or work as expected", () => {
      expect(o.or(true, false).get()).toBe(true)
      expect(o.and(true, false).get()).toBe(false)

      const t1 = o(true)
      const t2 = o(false)
      const t = o.and(t1, t2)
      const sp = spyon(t)
      expect(t.get()).toBe(false)
      t2.set(true)
      sp.called.once.with(true)
      expect(t.get()).toBe(true)
    })
  })

  describe("mutate() and assign()", function () {
    test("mutate() updates based on current value", () => {
      const obs = o(5)
      const spy = spyon(obs)
      obs.mutate((v) => v * 2)
      expect(obs.get()).toBe(10)
      spy.was.called.once.with(10)
    })

    test("mutate() works with objects", () => {
      const obs = o({ a: 1, b: 2 })
      obs.mutate((v) => ({ ...v, a: v.a + 1 }))
      expect(obs.get()).toEqual({ a: 2, b: 2 })
    })

    test("assign() recursively updates object properties", () => {
      const obs = o({ a: 1, b: { c: 2, d: 3 }, e: 4 })
      const spy = spyon(obs)
      obs.assign({ b: { c: 5 } })
      expect(obs.get()).toEqual({ a: 1, b: { c: 5, d: 3 }, e: 4 })
      spy.was.called.once
    })

    test("assign() updates nested properties", () => {
      const obs = o({ a: { b: { c: 1 } } })
      obs.assign({ a: { b: { c: 2 } } })
      expect(obs.get().a.b.c).toBe(2)
    })
  })

  describe("array methods", function () {})
})

describe("PropObservable", function () {
  describe("Basics", () => {
    const obs = o({ a: 1, b: 2, c: { d: 1 } })
    const testa = obs.p("a")
    const testc = obs.p("c")
    const testd = testc.p("d")
    const arr = o<number[]>([1, 2, 3])
    const arr0 = arr.p(0)
    const nest = o({ a: { b: { c: true } } })
    const nestc = nest.p("a").p("b").p("c")

    let called_a = spyon(testa)
    let called_d = spyon(testd)
    let called_test = spyon(obs)
    let called_0 = spyon(arr0)
    let called_nest_c = spyon(nestc)

    beforeEach(() => {
      called_test = spyon(obs)
      called_a = spyon(testa)
      called_d = spyon(testd)
      called_0 = spyon(arr0)
      called_nest_c = spyon(nestc)
    })

    test("can get() even in deep subpaths", () => {
      expect(testd.get()).toBe(1)
      expect(testa.get()).toBe(1)
    })

    test("observers are called on the parent when modifying the child", () => {
      called_test.was.never.called
      testa.set(5)
      called_test.was.called.once.with({ a: 5, b: 2, c: { d: 1 } })

      expect(obs.get().a).toBe(5)
    })

    test("observers are called on a child when set on a child", () => {
      testa.set(6)

      called_a.with(6)

      obs.assign({ a: 7 })

      called_a.with(7)
      called_a.twice

      testd.set(9)
      called_d.once.with(9, 9, 1)

      arr0.set(44)
      called_0.once.with(44)
    })

    test("observers are not called on a different child", () => {
      obs.assign({ b: 43 })
      called_a.was.not.called
    })

    test("observers are called on a child when parent is set", () => {
      obs.set({ a: 49, b: 23, c: { d: 4 } })

      called_a.with(49)
      called_d.with(4)
    })

    test("deep nested properties observers are still called", () => {
      testd.set(88)

      called_d.with(88)
    })

    test("prop observables are not called again if their value did not change", () => {
      testa.set(4)
      called_a.once
      testa.set(4)
      called_d.never
      testd.set(1)
      called_d.once.with(1)
      obs.assign({ c: { d: 2 } })
      called_d.once.with(2)
    })

    test("very deep properties still work", () => {
      nestc.set(false)
      called_nest_c.was.called.once.with(false)
      nestc.set(true)
      expect(nestc.get()).toBe(true)
      called_nest_c.was.called.once.with(true)
    })
  })
})

describe("TransformObservable", function () {
  let tests = o(5)
  let ttf = tests.tf((a) => a + 10)
  let ttf2 = tests.tf({
    transform: (v) => v + 20,
    revert: (v) => v * 2,
  })

  test("simple transform works", () => {
    expect(ttf.get()).toBe(15)
  })

  test("revert test", () => {
    expect(ttf2.get()).toBe(25)
    ttf2.set(10)
    expect(tests.get()).toBe(20)
  })

  test("observers are fired", () => {
    let tt = spyon(ttf2)
    tests.set(8)
    tt.was.called.once
  })

  // Pausing the transformer observable should stop sending reverts to
  // the original observable.
})

describe("CombinedObservable", function () {
  test("o.combine() creates readonly combined observable", () => {
    const a = o(5)
    const b = o(10)
    const combined = o.combine([a, b], (deps) => {
      const [aVal, bVal] = deps.map((d) => o.get(d))
      return aVal + bVal
    })

    expect(combined.get()).toBe(15)

    const spy = spyon(combined)
    a.set(10)
    spy.was.called.once.with(20)
  })

  test("o.combine() with setter creates writable combined observable", () => {
    const a = o(5)
    const b = o(10)
    const combined = o.combine(
      [a, b],
      (deps) => {
        const [aVal, bVal] = deps.map((d) => o.get(d))
        return aVal + bVal
      },
      (sum, _, deps) => {
        return [o.NoValue, sum - deps[0]]
      }
    )

    expect(combined.get()).toBe(15)
    combined.set(30)
    expect(b.get()).toBe(25)
    expect(a.get()).toBe(5)
  })

  test("combined observable updates when any dependency changes", () => {
    const x = o(2)
    const y = o(3)
    const z = o(4)
    const product = o.combine([x, y, z], (deps) => {
      const [a, b, c] = deps.map((d) => o.get(d))
      return a * b * c
    })

    expect(product.get()).toBe(24)

    const spy = spyon(product)
    x.set(3)
    spy.was.called.once.with(36)
    y.set(4)
    spy.was.called.once.with(48)
  })
})

describe("o.merge() and o.join()", function () {
  test("o.merge() combines multiple observables into object", () => {
    const a = o(5)
    const b = o("hello")
    const merged = o.merge({ a, b, c: 42 })

    expect(merged.get()).toEqual({ a: 5, b: "hello", c: 42 })

    const spy = spyon(merged)
    a.set(10)
    spy.was.called.once
    expect(merged.get().a).toBe(10)
  })

  test("o.merge() properties can be set bidirectionally", () => {
    const a = o(5)
    const b = o("hello")
    const merged = o.merge({ a, b })

    merged.p("a").set(20)
    expect(a.get()).toBe(20)

    merged.p("b").set("world")
    expect(b.get()).toBe("world")
  })

  test("o.join() combines observables into array", () => {
    const a = o(1)
    const b = o(2)
    const c = o(3)
    const joined = o.join(a, b, c)

    expect(joined.get()).toEqual([1, 2, 3])

    const spy = spyon(joined)
    b.set(5)
    spy.was.called.once.with([1, 5, 3])
  })
})

describe("o.expression()", function () {
  test("o.expression() creates combined observable with dynamic dependencies", () => {
    const a = o(5)
    const b = o(10)
    const expr = o.expression((get) => get(a) + get(b))

    expect(expr.get()).toBe(15)

    const spy = spyon(expr)
    a.set(8)
    spy.was.called.once.with(18)
  })

  test("o.expression() with setter is bidirectional", () => {
    const a = o(5)
    const b = o(10)
    const expr = o.expression(
      (get) => get(a) + get(b),
      (sum, set, _, get) => {
        set(a, sum - get(b))
      }
    )

    expr.set(20)
    expect(a.get()).toBe(10)
    expect(b.get()).toBe(10)
  })

  test("o.expression() recomputes when dependencies change", () => {
    const x = o(2)
    const y = o(3)
    const expr = o.expression((get) => get(x) * get(y))

    expect(expr.get()).toBe(6)
    y.set(5)
    expect(expr.get()).toBe(10)
  })
})

describe("Transactions", function () {
  test("o.transaction() batches multiple updates", () => {
    const a = o(1)
    const b = o(2)
    const sum = o.combine([a, b], ([x, y]) => x + y)

    const spy = spyon(sum)

    o.transaction(() => {
      a.set(5)
      b.set(10)
    })

    // Should only be called once despite two changes
    spy.was.called.once.with(15)
  })

  test("observers are notified after transaction completes", () => {
    const obs = o(1)
    const spy = spyon(obs)

    o.transaction(() => {
      obs.set(2)
      obs.set(3)
      obs.set(4)
    })

    // Only notified of final value
    spy.was.called.once.with(4)
  })
})

describe("ProxyObservable", function () {
  test("o.proxy() creates changeable proxy", () => {
    const a = o(5)
    const b = o(10)
    const proxy = o.proxy(a)

    expect(proxy.get()).toBe(5)

    proxy.changeTarget(b)
    expect(proxy.get()).toBe(10)
  })

  test("proxy updates when target changes", () => {
    const a = o(5)
    const proxy = o.proxy(a)
    const spy = spyon(proxy)

    a.set(15)
    spy.was.called.once.with(15)
  })

  test("setting proxy sets target", () => {
    const a = o(5)
    const proxy = o.proxy(a)

    proxy.set(20)
    expect(a.get()).toBe(20)
  })

  test("changing target updates observers", () => {
    const a = o(5)
    const b = o(10)
    const proxy = o.proxy(a)
    const spy = spyon(proxy)

    proxy.changeTarget(b)
    spy.was.called.once.with(10)
  })
})

describe("Observer Lifecycle", function () {
  test("Observer can be stopped and started", () => {
    const obs = o(5)
    let callCount = 0
    const observer = new o.Observer(() => {
      callCount++
    }, obs)

    observer.startObserving()
    expect(callCount).toBe(1) // Initial call

    obs.set(10)
    expect(callCount).toBe(2)

    observer.stopObserving()
    obs.set(15)
    expect(callCount).toBe(2) // Not called after stop
  })

  test("SilentObserver ignores first change", () => {
    const obs = o(5)
    let callCount = 0
    let lastValue: number | undefined

    const observer = new o.SilentObserver((value: any) => {
      callCount++
      lastValue = value
    }, obs)

    observer.startObserving()
    expect(callCount).toBe(0) // Not called initially

    obs.set(10)
    expect(callCount).toBe(1)
    expect(lastValue).toBe(10)
  })

  test("Observer.debounce() delays notifications", async () => {
    const obs = o(0)
    let callCount = 0
    let lastValue = 0

    const observer = new o.Observer((value: any) => {
      callCount++
      lastValue = value
    }, obs)

    observer.startObserving()
    observer.debounce(50)

    obs.set(1)
    obs.set(2)
    obs.set(3)

    // Should not be called immediately
    expect(callCount).toBe(1) // Only initial call

    await new Promise((resolve) => setTimeout(resolve, 100))

    // After debounce, should be called with latest value
    expect(callCount).toBe(2)
    expect(lastValue).toBe(3)
  })

  test("Observer.throttle() limits notification rate", async () => {
    const obs = o(0)
    let callCount = 0

    const observer = new o.Observer(() => {
      callCount++
    }, obs)

    observer.startObserving()
    observer.throttle(50)

    obs.set(1)
    obs.set(2)
    obs.set(3)

    // Initial call + first throttled call
    expect(callCount).toBe(1)

    await new Promise((resolve) => setTimeout(resolve, 150))

    // Should have limited calls
    expect(callCount).toBeLessThan(4)
  })

  test("ObserverHolder manages multiple observers", () => {
    const holder = new o.ObserverHolder()
    const obs = o(5)
    let callCount = 0

    holder.observe(
      obs,
      () => {
        callCount++
      },
      { immediate: true }
    )
    holder.startObservers()

    expect(callCount).toBe(1)

    obs.set(10)
    expect(callCount).toBe(2)

    holder.stopObservers()
    obs.set(15)
    expect(callCount).toBe(2) // Not called after stop

    holder.startObservers()
    expect(callCount).toBe(3) // Called on restart

    holder.stopObservers()
  })
})

describe("Boolean Combinators", function () {
  test("o.not() inverts boolean observable", () => {
    const obs = o(true)
    const inverted = o.not(obs)

    const spy = spyon(inverted)
    expect(inverted.get()).toBe(false)

    obs.set(false)
    expect(obs.get()).toBe(false)
    expect(inverted.get()).toBe(true)
    spy.was.called.once.with(true)
  })

  test("o.and() with multiple observables", () => {
    const a = o(true)
    const b = o(true)
    const c = o(false)
    const result = o.and(a, b, c)

    expect(result.get()).toBe(false)

    c.set(true)
    expect(result.get()).toBe(true)
  })

  test("o.or() with multiple observables", () => {
    const a = o(false)
    const b = o(false)
    const c = o(false)
    const result = o.or(a, b, c)

    expect(result.get()).toBe(false)

    b.set(true)
    expect(result.get()).toBe(true)
  })
})

describe("Additional Methods", function () {
  test(".path() accesses nested properties", () => {
    const obs = o({ a: { b: { c: 42 } } })
    const pathObs = obs.path("a", "b", "c")

    expect(pathObs.get()).toBe(42)

    const spy = spyon(pathObs)
    obs.set({ a: { b: { c: 100 } } })
    spy.was.called.once.with(100)
  })

  test(".path() is bidirectional", () => {
    const obs = o({ a: { b: { c: 42 } } })
    const pathObs = obs.path("a", "b", "c")

    pathObs.set(100)
    expect(obs.get().a.b.c).toBe(100)
  })

  test(".key() accesses Map keys", () => {
    const map = o(
      new Map([
        ["key1", "value1"],
        ["key2", "value2"],
      ])
    )
    const keyObs = map.key("key1")

    expect(keyObs.get()).toBe("value1")

    const spy = spyon(keyObs)
    map.mutate((m) => {
      const newMap = new Map(m)
      newMap.set("key1", "newValue")
      return newMap
    })
    spy.was.called.once.with("newValue")
  })

  test(".apply() calls methods on the value", () => {
    const obs = o("hello")
    const upper = obs.apply("toUpperCase", [])

    expect(upper.get()).toBe("HELLO")

    const spy = spyon(upper)
    obs.set("world")
    spy.was.called.once.with("WORLD")
  })

  test(".call() calls methods with arguments", () => {
    const obs = o("hello world")
    const sliced = obs.call("slice", 0, 5)

    expect(sliced.get()).toBe("hello")

    const spy = spyon(sliced)
    obs.set("greetings everyone")
    spy.was.called.once.with("greet")
  })
})

describe("Utility Functions", function () {
  test("o.is_observable() checks if value is observable", () => {
    const obs = o(5)
    const plain = 5

    expect(o.is_observable(obs)).toBe(true)
    expect(o.is_observable(plain)).toBe(false)
  })

  test("o.get() extracts value from observable or returns plain value", () => {
    const obs = o(5)
    const plain = 10

    expect(o.get(obs)).toBe(5)
    expect(o.get(plain)).toBe(10)
  })

  test("o() wraps plain values and returns observables as-is", () => {
    const plain = 5
    const obs1 = o(plain)
    const obs2 = o(obs1)

    expect(o.is_observable(obs1)).toBe(true)
    expect(obs1).toBe(obs2) // Should return same observable
  })
})

describe("Transformers", function () {
  describe("tf_array_filter()", function () {
    test("filters array by predicate", () => {
      const arr = o([1, 2, 3, 4, 5])
      const evens = arr.tf(tf_array_filter((n: number) => n % 2 === 0))

      expect(evens.get()).toEqual([2, 4])

      const spy = spyon(evens)
      arr.set([1, 2, 3, 4, 5, 6])
      spy.was.called.once
      expect(evens.get()).toEqual([2, 4, 6])
    })
  })

  describe("tf_array_sort()", function () {
    test("sorts array", () => {
      const arr = o([3, 1, 4, 1, 5, 9, 2, 6])
      const sorted = arr.tf(
        tf_array_sort((a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0))
      )

      expect(sorted.get()).toEqual([1, 1, 2, 3, 4, 5, 6, 9])
    })

    test("sorts with custom comparator", () => {
      const arr = o([3, 1, 4, 1, 5])
      const sorted = arr.tf(
        tf_array_sort((a: number, b: number) => (a < b ? 1 : a > b ? -1 : 0))
      )

      expect(sorted.get()).toEqual([5, 4, 3, 1, 1])
    })
  })

  describe("tf_array_sort_by()", function () {
    test("sorts array by key function", () => {
      const arr = o([
        { name: "Charlie", age: 30 },
        { name: "Alice", age: 25 },
        { name: "Bob", age: 35 },
      ])
      const sorted = arr.tf(tf_array_sort_by([(item: any) => item.age]))

      const result = sorted.get() as any[]
      expect(result[0].name).toBe("Alice")
      expect(result[1].name).toBe("Charlie")
      expect(result[2].name).toBe("Bob")
    })
  })

  describe("tf_array_has()", function () {
    test("checks if array contains value", () => {
      const arr = o([1, 2, 3, 4, 5])
      const hasThree = arr.tf(tf_array_has(3))

      expect(hasThree.get()).toBe(true)

      arr.set([1, 2, 4, 5])
      expect(hasThree.get()).toBe(false)
    })
  })

  describe("tf_set_has()", function () {
    test("checks if set contains value", () => {
      const set = o(new Set([1, 2, 3, 4, 5]))
      const hasThree = set.tf(tf_set_has(3))

      expect(hasThree.get()).toBe(true)

      set.set(new Set([1, 2, 4, 5]))
      expect(hasThree.get()).toBe(false)
    })
  })

  describe("tf_map_has()", function () {
    test("checks if map contains key-value pair", () => {
      const map = o(
        new Map([
          ["a", 1],
          ["b", 2],
          ["c", 3],
        ])
      )
      const hasB2 = map.tf(tf_map_has(["b", 2]))

      expect(hasB2.get()).toBe(true)

      map.mutate((m) => {
        const newMap = new Map(m)
        newMap.set("b", 3)
        return newMap
      })
      expect(hasB2.get()).toBe(false)
    })
  })

  describe("tf_entries()", function () {
    test("converts object to entries array", () => {
      const obj = o({ a: 1, b: 2, c: 3 })
      const entries = obj.tf(tf_entries())

      const result = entries.get()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(3)
      expect(result).toContainEqual(["a", 1])
      expect(result).toContainEqual(["b", 2])
      expect(result).toContainEqual(["c", 3])
    })
  })

  describe("tf_array_to_map()", function () {
    test("converts array to map by key function", () => {
      const arr = o([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ])
      const map = arr.tf(tf_array_to_map((item: any) => item.id))

      const result = map.get()
      expect(result).toBeInstanceOf(Map)
      expect(result.get(1)?.name).toBe("Alice")
      expect(result.get(2)?.name).toBe("Bob")
    })
  })

  describe("tf_array_to_object()", function () {
    test("converts array to object by key function", () => {
      const arr = o([
        { id: "a", value: 1 },
        { id: "b", value: 2 },
      ])
      const obj = arr.tf(tf_array_to_object((item: any) => item.id))

      const result = obj.get() as any
      expect(result.a.value).toBe(1)
      expect(result.b.value).toBe(2)
    })
  })
})
