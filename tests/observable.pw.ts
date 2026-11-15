import { expect, test } from "./fixture"
// Type-only import: gives page.evaluate() callbacks below access to the `o` namespace's
// *types* (o.Observable<T>, etc.) for annotations. Erased at compile time, so this has no
// effect on the browser runtime -- the actual `o` value used inside evaluate() always comes
// from `window.__ELT__`, never from this import.
import type { o } from "../src/observable"

function assertAll(results: { name: string; actual: unknown; expected: unknown }[]) {
  for (const r of results) expect(r.actual, r.name).toEqual(r.expected)
}

// Installed on every page before its scripts run (the fixture's before_load)
// so every page.evaluate() callback can use `cmp`, `Calls`, and `spyon` as real globals,
// mirroring the helpers that lived at the top of the original bun test file.
test.use({
  before_load: {
    script: () => {
      function cmp(a: any, b: any): boolean {
        if (a === b) return true
        if (a !== b && (typeof a !== "object" || typeof b !== "object")) return false
        if (a == null || b == null) return false
        for (const x in a) {
          if (!cmp(a[x], b[x])) return false
        }
        return true
      }

      class Calls {
        count = 0
        calls = [] as any[]

        ntimes(times: number): this {
          if (this.count !== times)
            throw new Error(`Expected to be called ${times} times but was called ${this.count} times`)
          this.count = 0
          return this
        }

        with(...args: any[]) {
          for (const call of this.calls) {
            for (let i = 0; i < args.length; i++) {
              if (!cmp(args[i], call[i]))
                throw new Error(`At position ${i}, expected ${JSON.stringify(args[i])} got ${JSON.stringify(call[i])}`)
            }
          }
          this.calls = []
          return this
        }

        callback() {
          return (...args: any[]) => {
            this.call(...args)
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

      function spyon(obs: any, immediate = false) {
        const spy = new Calls()
        obs.addObserver((value: any, changes: any) => {
          if (changes !== window.__ELT__.o.NoValue || immediate) {
            spy.call(value)
          }
        })
        return spy
      }
      ;(window as any).__TEST_HELPERS__ = { cmp, Calls, spyon }
    },
  },
})

test.describe("Observable", () => {
  test.describe("basic operations", () => {
    test("an observer is called at once with o.NoValue as old value, then on each change, never on an unchanged write", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const { o } = window.__ELT__
        const { spyon } = (window as any).__TEST_HELPERS__
        const obs = o(0)
        // `changes` skips the first call (old value o.NoValue), `all` records it
        const changes = spyon(obs)
        const all = spyon(obs, true)
        changes.was.never.called
        all.was.called.once.with(0)

        obs.set(0)
        changes.was.never.called
        all.was.never.called

        obs.set(4)
        changes.was.called.once.with(4)
        all.was.called.once.with(4)
      })
    })
  })

  test.describe("boolean operations", () => {
    test("o.not(), o.and() and o.or() take observables and plain values, and follow their sources", async ({
      page,
    }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { spyon } = (window as any).__TEST_HELPERS__
        const out: { name: string; actual: unknown; expected: unknown }[] = []

        out.push({ name: "o.or(true, false)", actual: o.or(true, false).get(), expected: true })
        out.push({ name: "o.and(true, false)", actual: o.and(true, false).get(), expected: false })

        const o_on = o(true)
        const inverted = o.not(o_on)
        const sp_not = spyon(inverted)
        out.push({ name: "not initial", actual: inverted.get(), expected: false })
        o_on.set(false)
        out.push({ name: "not after source set(false)", actual: inverted.get(), expected: true })
        sp_not.was.called.once.with(true)

        const t1 = o(true)
        const t2 = o(false)
        const both = o.and(t1, t2)
        const sp_and = spyon(both)
        out.push({ name: "and of two initial", actual: both.get(), expected: false })
        t2.set(true)
        sp_and.called.once.with(true)
        out.push({ name: "and of two after t2 set true", actual: both.get(), expected: true })

        const a = o(true)
        const b = o(true)
        const c = o(false)
        const all = o.and(a, b, c)
        out.push({ name: "and of three initial", actual: all.get(), expected: false })
        c.set(true)
        out.push({ name: "and of three after c.set(true)", actual: all.get(), expected: true })

        const x = o(false)
        const y = o(false)
        const z = o(false)
        const any = o.or(x, y, z)
        out.push({ name: "or of three initial", actual: any.get(), expected: false })
        y.set(true)
        out.push({ name: "or of three after y.set(true)", actual: any.get(), expected: true })
        return out
      })
      assertAll(results)
    })
  })

  test.describe("assign()", () => {
    test("assign() recursively updates object properties", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { spyon } = (window as any).__TEST_HELPERS__
        const obs = o({ a: 1, b: { c: 2, d: 3 }, e: 4 })
        const spy = spyon(obs)
        obs.assign({ b: { c: 5 } })
        spy.was.called.once
        return obs.get()
      })
      expect(result).toEqual({ a: 1, b: { c: 5, d: 3 }, e: 4 })
    })

    test("assign() throws when merging through a string intermediate", async ({ page }) => {
      const threw = await page.evaluate(() => {
        const { o } = window.__ELT__
        const obs = o({ a: "hello" })
        try {
          ;(obs.assign as any)({ a: { b: 2 } })
          return false
        } catch {
          return true
        }
        // assign merges recursively — only valid when intermediates are objects.
        // Replace wholesale, use .p([...]).set(), or mutate() to change type at a path.
      })
      expect(threw).toBe(true)
    })
  })
})

test.describe("PropObservable", () => {
  test.describe("Basics", () => {
    // The original suite declares obs/testa/testc/testd/arr/arr0/nest/nestc once at
    // describe scope and never resets their VALUES between tests (only the spies get
    // recreated in beforeEach) -- later tests rely on state left behind by earlier ones
    // (e.g. "prop observables are not called again if their value did not change" only
    // works because a prior test already moved testd away from its initial value 1).
    // Each Playwright test gets a fresh page, so that cross-test value carryover can't
    // survive between separate test() calls -- we replicate it faithfully by running the
    // whole original sequence inside one page.evaluate(), in original order, and reporting
    // each original test's assertions as separately named entries.
    test("runs the full original sequential suite (shared observable state, see comment above)", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { spyon } = (window as any).__TEST_HELPERS__
        const out: { name: string; actual: unknown; expected: unknown }[] = []

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

        function resetSpies() {
          called_test = spyon(obs)
          called_a = spyon(testa)
          called_d = spyon(testd)
          called_0 = spyon(arr0)
          called_nest_c = spyon(nestc)
        }

        // "can get() even in deep subpaths"
        resetSpies()
        out.push({ name: "can get() even in deep subpaths: testd.get()", actual: testd.get(), expected: 1 })
        out.push({ name: "can get() even in deep subpaths: testa.get()", actual: testa.get(), expected: 1 })

        // "observers are called on the parent when modifying the child"
        resetSpies()
        called_test.was.never.called
        testa.set(5)
        called_test.was.called.once.with({ a: 5, b: 2, c: { d: 1 } })
        out.push({ name: "observers are called on the parent: obs.get().a", actual: obs.get().a, expected: 5 })

        // "observers are called on a child when set on a child"
        resetSpies()
        testa.set(6)
        called_a.with(6)
        obs.assign({ a: 7 })
        called_a.with(7)
        called_a.twice
        testd.set(9)
        called_d.once.with(9)
        arr0.set(44)
        called_0.once.with(44)
        out.push({ name: "observers are called on a child when set on a child: ok", actual: true, expected: true })

        // "observers are not called on a different child"
        resetSpies()
        obs.assign({ b: 43 })
        called_a.was.not.called
        out.push({ name: "observers are not called on a different child: ok", actual: true, expected: true })

        // "observers are called on a child when parent is set"
        resetSpies()
        obs.set({ a: 49, b: 23, c: { d: 4 } })
        called_a.with(49)
        called_d.with(4)
        out.push({ name: "observers are called on a child when parent is set: ok", actual: true, expected: true })

        // "deep nested properties observers are still called"
        resetSpies()
        testd.set(88)
        called_d.with(88)
        out.push({ name: "deep nested properties observers are still called: ok", actual: true, expected: true })

        // "prop observables are not called again if their value did not change"
        // (relies on testd currently being 88, set just above -- matches original ordering)
        resetSpies()
        testa.set(4)
        called_a.once
        testa.set(4)
        called_d.never
        testd.set(1)
        called_d.once.with(1)
        obs.assign({ c: { d: 2 } })
        called_d.once.with(2)
        out.push({ name: "prop observables are not called again if unchanged: ok", actual: true, expected: true })

        // "very deep properties still work"
        resetSpies()
        nestc.set(false)
        called_nest_c.was.called.once.with(false)
        nestc.set(true)
        out.push({ name: "very deep properties still work: nestc.get()", actual: nestc.get(), expected: true })
        called_nest_c.was.called.once.with(true)

        return out
      })
      assertAll(results)
    })
  })
})

test.describe("TransformObservable", () => {
  test("revert test", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const tests = o(5)
      const ttf2 = tests.tf({
        transform: (v: number) => v + 20,
        revert: (v: number) => v * 2,
      })
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      out.push({ name: "ttf2 initial", actual: ttf2.get(), expected: 25 })
      ttf2.set(10)
      out.push({ name: "tests after ttf2.set(10)", actual: tests.get(), expected: 20 })
      return out
    })
    assertAll(results)
  })
})

test.describe("CombinedObservable", () => {
  test("o.combine() creates readonly combined observable", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const a = o(5)
      const b = o(10)
      const combined = o.combine([a, b], (deps: any) => {
        const [aVal, bVal] = deps.map((d: any) => o.get(d))
        return aVal + bVal
      })

      out.push({ name: "combined initial", actual: combined.get(), expected: 15 })

      const spy = spyon(combined)
      a.set(10)
      spy.was.called.once.with(20)

      // Without a setter, a write is refused with an explicit error and reaches no source
      let error = "no error"
      try {
        // typed read-only, but the object is a CombinedObservable underneath: write through `any` on purpose
        ;(combined as any).set(100)
      } catch (e) {
        error = (e as Error).message
      }
      out.push({ name: "write refused as read-only", actual: error.includes("read-only"), expected: true })
      out.push({ name: "sources untouched", actual: [a.get(), b.get(), combined.get()], expected: [10, 10, 20] })
      spy.was.never.called
      return out
    })
    assertAll(results)
  })

  test("o.combine() with setter creates writable combined observable", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const a = o(5)
      const b = o(10)
      const combined = o.combine(
        [a, b],
        (deps: any) => {
          const [aVal, bVal] = deps.map((d: any) => o.get(d))
          return aVal + bVal
        },
        (sum: number, _: unknown, deps: any) => {
          return [o.NoValue, sum - deps[0]]
        },
      )

      out.push({ name: "combined initial", actual: combined.get(), expected: 15 })
      combined.set(30)
      out.push({ name: "b after combined.set(30)", actual: b.get(), expected: 25 })
      out.push({ name: "a after combined.set(30)", actual: a.get(), expected: 5 })
      return out
    })
    assertAll(results)
  })
})

test.describe("o.merge() and o.join()", () => {
  test("o.merge() combines observables and plain values into an object, and writes back into each member", async ({
    page,
  }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const a = o(5)
      const b = o("hello")
      const merged = o.merge({ a, b, c: 42 })

      out.push({ name: "merged initial", actual: merged.get(), expected: { a: 5, b: "hello", c: 42 } })

      const spy = spyon(merged)
      a.set(10)
      spy.was.called.once
      out.push({ name: "merged.get().a after a.set(10)", actual: merged.get().a, expected: 10 })

      // A merge with a plain member is typed read-only: write through one made of observables only
      const writable = o.merge({ a, b })
      writable.p("a").set(20)
      out.push({ name: "a after merged.p(a).set(20)", actual: a.get(), expected: 20 })
      writable.p("b").set("world")
      out.push({ name: "b after merged.p(b).set(world)", actual: b.get(), expected: "world" })

      const m1 = o(1)
      const m2 = o(2)
      const whole = o.merge({ m1, m2 })
      whole.set({ m1: 10, m2: 20 })
      out.push({ name: "members after merged.set", actual: [m1.get(), m2.get()], expected: [10, 20] })
      return out
    })
    assertAll(results)
  })

  test("o.join() combines observables into an array, and writes each item back to its observable", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const a = o(1)
      const b = o(2)
      const c = o(3)
      const joined = o.join(a, b, c)

      out.push({ name: "joined initial", actual: joined.get(), expected: [1, 2, 3] })

      const spy = spyon(joined)
      b.set(5)
      spy.was.called.once.with([1, 5, 3])

      const o_n = o(1)
      const o_s = o("x")
      const mixed = o.join(o_n, o_s)
      mixed.set([2, "y"])
      out.push({
        name: "items after set",
        actual: { n: o_n.get(), s: o_s.get(), joined: mixed.get() },
        expected: { n: 2, s: "y", joined: [2, "y"] },
      })
      return out
    })
    assertAll(results)
  })
})

test.describe("o.tee()", () => {
  test("o.tee() sets every target in order and skips undefined", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const a = o(0)
      const b = o(0)
      const order: string[] = []
      a.addObserver(() => order.push("a"))
      b.addObserver(() => order.push("b"))
      // addObserver calls its callback once when it is added : start counting after that.
      order.length = 0

      const both = o.tee(a, undefined, b)
      both.set(3)
      out.push({ name: "a after tee.set(3)", actual: a.get(), expected: 3 })
      out.push({ name: "b after tee.set(3)", actual: b.get(), expected: 3 })
      out.push({
        name: "observers ran once each, in the order of the targets",
        actual: order.slice(),
        expected: ["a", "b"],
      })

      // No target at all is a valid, silent Out.
      o.tee<number>().set(1)
      o.tee<number>(undefined).set(1)
      out.push({ name: "a untouched by empty tees", actual: a.get(), expected: 3 })

      // A tee is an Out like any other, so it can be nested.
      const c = o(0)
      o.tee(o.tee(a), c).set(7)
      out.push({ name: "nested tee reaches a", actual: a.get(), expected: 7 })
      out.push({ name: "nested tee reaches c", actual: c.get(), expected: 7 })
      return out
    })
    assertAll(results)
  })
})

test.describe("o.p(fn)", () => {
  test("o.p(function) reads and writes the path its getter names (simple, nested, ?. chaining)", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const cases: {
        name: string
        init: any
        fn: (x: any) => unknown
        get: unknown
        assign?: any
        after_assign?: unknown
        set: unknown
        after_set: unknown
      }[] = [
        {
          name: "simple",
          init: { a: 1, b: 2 },
          fn: (x: any) => x.a,
          get: 1,
          assign: { a: 10 },
          after_assign: 10,
          set: 99,
          after_set: { a: 99, b: 2 },
        },
        {
          name: "nested",
          init: { a: { b: { c: 42 } } },
          fn: (x: any) => x.a.b.c,
          get: 42,
          assign: { a: { b: { c: 100 } } },
          after_assign: 100,
          set: 88,
          after_set: { a: { b: { c: 88 } } },
        },
        {
          // Built via `new Function` (not a TS arrow function) so the optional-chaining
          // syntax reaches the browser verbatim: o.p(fn) parses the getter's own
          // `fn.toString()` source to derive the path, and Playwright/esbuild would
          // otherwise downlevel `?.` into helper temp vars before this reaches Chromium,
          // mangling that source and breaking the path parser.
          name: "?. chaining on missing objects",
          init: {},
          fn: new Function("return (x) => x.a?.b?.c")(),
          get: undefined,
          set: 88,
          after_set: { a: { b: { c: 88 } } },
        },
      ]
      for (const c of cases) {
        const obj = o<Record<string, unknown>>(c.init)
        const sub = obj.p(c.fn)
        out.push({ name: `${c.name}: initial`, actual: sub.get(), expected: c.get })
        if (c.assign) {
          obj.assign(c.assign)
          out.push({ name: `${c.name}: after assign`, actual: sub.get(), expected: c.after_assign })
        }
        sub.set(c.set)
        out.push({ name: `${c.name}: source after set`, actual: obj.get(), expected: c.after_set })
        out.push({ name: `${c.name}: sub after set`, actual: sub.get(), expected: c.set })
      }
      return out
    })
    assertAll(results)
  })
})

test.describe("o.p(dynamic key)", () => {
  test("o.p(o(key)) and o.p(o(path)) read and write wherever the key or path currently points", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const cases = [
        {
          name: "key",
          init: { a: 1, b: 2 },
          from: "a",
          to: "b",
          v_from: 1,
          v_to: 2,
          write_to: 20,
          after_write_to: { a: 1, b: 20 },
          write_from: 10,
          after_write_from: { a: 10, b: 20 },
        },
        {
          name: "path",
          init: { x: { v: 1 }, y: { v: 2 } },
          from: ["x", "v"],
          to: ["y", "v"],
          v_from: 1,
          v_to: 2,
          write_to: 99,
          after_write_to: { x: { v: 1 }, y: { v: 99 } },
          write_from: 11,
          after_write_from: { x: { v: 11 }, y: { v: 99 } },
        },
      ]
      for (const c of cases) {
        const obj = o<Record<string, unknown>>(c.init)
        const o_key = o<readonly PropertyKey[] | PropertyKey>(c.from)
        const sub = obj.p(o_key)
        out.push({ name: `${c.name}: initial`, actual: sub.get(), expected: c.v_from })

        const spy = spyon(sub)
        o_key.set(c.to)
        out.push({ name: `${c.name}: after switching`, actual: sub.get(), expected: c.v_to })
        spy.was.called.once.with(c.v_to)

        sub.set(c.write_to)
        out.push({ name: `${c.name}: source after write`, actual: obj.get(), expected: c.after_write_to })
        out.push({ name: `${c.name}: sub after write`, actual: sub.get(), expected: c.write_to })

        o_key.set(c.from)
        out.push({ name: `${c.name}: after switching back`, actual: sub.get(), expected: c.v_from })
        sub.set(c.write_from)
        out.push({ name: `${c.name}: source after second write`, actual: obj.get(), expected: c.after_write_from })
      }
      return out
    })
    assertAll(results)
  })
})

test.describe("o.p(path[])", () => {
  test("o.p([...]) reads and writes a nested path", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ a: { b: { c: 42 } } })
      const sub = obj.p(["a", "b", "c"])
      out.push({ name: "sub initial", actual: sub.get(), expected: 42 })
      obj.assign({ a: { b: { c: 100 } } })
      out.push({ name: "sub after assign", actual: sub.get(), expected: 100 })
      sub.set(88)
      out.push({ name: "obj after sub.set(88)", actual: obj.get(), expected: { a: { b: { c: 88 } } } })
      out.push({ name: "sub.get()", actual: sub.get(), expected: 88 })
      return out
    })
    assertAll(results)
  })

  test("o.p([...]) creates missing nested objects on set", async ({ page }) => {
    const actual = await page.evaluate(() => {
      const { o } = window.__ELT__
      const obj = o({} as { a?: { b?: { c?: number } } })
      const sub = obj.p(["a", "b", "c"])
      sub.set(7)
      return obj.get()
    })
    expect(actual).toEqual({ a: { b: { c: 7 } } })
  })
})

test.describe("o.p path setter overwrite", () => {
  test("o.p([...]) replaces a primitive intermediate (string, number) with an object chain", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      for (const [intermediate, value] of [
        ["hello", 42],
        [0, "nested"],
      ] as const) {
        const obj = o<Record<string, unknown>>({ a: intermediate, b: 1 })
        const sub = obj.p(["a", "b", "c"])
        sub.set(value)
        out.push({
          name: `${typeof intermediate}: obj after set`,
          actual: obj.get(),
          expected: { a: { b: { c: value } }, b: 1 },
        })
        out.push({ name: `${typeof intermediate}: sub.get()`, actual: sub.get(), expected: value })
      }
      return out
    })
    assertAll(results)
  })

  test("o.p(fn) replaces a string intermediate with an object chain", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      type Tested = { a: string; b: number } | { a: { b: { c: number } }; b: number }
      const obj = o({ a: "hello", b: 1 } as Tested)
      // See comment in the "?. chaining" test above re: new Function.
      const sub = obj.p(new Function("return (x) => x.a?.b?.c")() as (x: unknown) => unknown)

      out.push({ name: "sub initial (undefined)", actual: sub.get(), expected: undefined })
      sub.set(42)
      out.push({ name: "obj after sub.set(42)", actual: obj.get(), expected: { a: { b: { c: 42 } }, b: 1 } })
      out.push({ name: "sub.get()", actual: sub.get(), expected: 42 })
      return out
    })
    assertAll(results)
  })

  test("o.p([...]) builds an array branch for a numeric path segment through a primitive", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ items: "not-array" as unknown as { 0?: { name?: string } } })
      const sub = obj.p(["items", 0, "name"])

      sub.set("x")
      out.push({ name: "obj after sub.set(x)", actual: obj.get(), expected: { items: [{ name: "x" }] } })
      out.push({ name: "sub.get()", actual: sub.get(), expected: "x" })
      return out
    })
    assertAll(results)
  })

  test("o.p([...]) replaces a primitive array element with a nested object", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o(["hello", 2] as [string | { x: number }, number])
      const sub = obj.p([0, "x"])

      sub.set(1)
      out.push({ name: "obj after sub.set(1)", actual: obj.get(), expected: [{ x: 1 }, 2] })
      out.push({ name: "sub.get()", actual: sub.get(), expected: 1 })
      return out
    })
    assertAll(results)
  })

  test("o.p([...]) returns the same root reference when the value is unchanged", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const obj = o({ a: { b: { c: 1 } } })
      const sub = obj.p(["a", "b", "c"])
      const before = obj.get()

      sub.set(1)
      return { sameRef: obj.get() === before, subValue: sub.get() }
    })
    expect(results.sameRef).toBe(true)
    expect(results.subValue).toBe(1)
  })

  test("o.p([...]) preserves references on unmodified branches", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const other = { kept: true }
      const obj = o({ a: { b: { c: 1 } }, other })
      const sub = obj.p(["a", "b", "c"])

      sub.set(2)
      return { sameOtherRef: obj.get().other === other, abc: obj.get().a.b.c }
    })
    expect(results.sameOtherRef).toBe(true)
    expect(results.abc).toBe(2)
  })
})

test.describe("o.expression()", () => {
  test("o.expression() follows only the dependencies its last run read", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const o_use_a = o(true)
      const a = o(5)
      const b = o(10)
      let runs = 0
      // Reads `a` or `b`, never both
      const expr = o.expression((get: any) => {
        runs++
        return get(o_use_a) ? get(a) : get(b)
      })

      out.push({ name: "expr initial", actual: expr.get(), expected: 5 })

      const spy = spyon(expr)
      a.set(8)
      spy.was.called.once.with(8)

      o_use_a.set(false)
      spy.was.called.once.with(10)
      out.push({ name: "a is let go once b is read instead", actual: a.isObserved(), expected: false })

      // `a` is no longer read: writing it neither recomputes nor notifies
      runs = 0
      a.set(100)
      spy.was.never.called
      out.push({ name: "writing the unread a runs nothing", actual: runs, expected: 0 })

      b.set(11)
      spy.was.called.once.with(11)

      // Switching back reads `a` again, which is followed again, and `b` is let go
      o_use_a.set(true)
      spy.was.called.once.with(100)
      out.push({ name: "b is let go once a is read again", actual: b.isObserved(), expected: false })
      a.set(101)
      spy.was.called.once.with(101)
      return out
    })
    assertAll(results)
  })

  test("o.expression() with a revert writes to the dependencies it reads, after one was dropped", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const o_use_a = o(true)
      const a = o(1)
      const b = o(2)
      const c = o(3)
      // `a` sits before `b` and `c` in the dependencies; dropping it moves them down
      const o_expr = o.expression(
        (get: any) => (get(o_use_a) ? get(a) : get(b) + get(c)),
        (v: number, set: any) => {
          if (o_use_a.get()) set(a, v)
          else set(c, v - b.get())
        },
      )
      const seen: number[] = []
      o_expr.addObserver((v: number) => seen.push(v))
      o_use_a.set(false)
      o_expr.set(10)
      c.set(c.get() + 1)
      return [
        { name: "the write reached c", actual: c.get(), expected: 9 },
        { name: "b untouched", actual: b.get(), expected: 2 },
        { name: "values seen", actual: seen, expected: [1, 5, 10, 11] },
      ]
    })
    assertAll(results)
  })
})

test.describe("Transactions", () => {
  test("observers are notified after transaction completes", async ({ page }) => {
    await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
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
})

test.describe("ProxyObservable", () => {
  // Wraps `hold` (o.Observable constructor bypassing o()'s "return same ref" dedup) and
  // every test as a self-contained page.evaluate; no state shared across tests here.
  test("set() through a proxy writes to a writable terminal and throws on a read-only one", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o } = window.__ELT__
      const a = o(5)
      const writable = o.proxy(a)
      writable.set(6)
      const readonly = o.proxy(o.combine([a], ([v]) => v * 2))
      readonly.addObserver(() => {})
      let error = ""
      try {
        // the type already forbids it: force the write to check the runtime error
        ;(readonly as unknown as { set(v: number): void }).set(1)
      } catch (e) {
        error = (e as Error).message
      }
      return { a: a.get(), error }
    })
    expect(result.a).toBe(6)
    expect(result.error).not.toBe("")
  })

  test("changeTarget() points the proxy at another observable and notifies its observers", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const a = o(5)
      const b = o(10)
      const proxy = o.proxy(a)
      out.push({ name: "proxy initial", actual: proxy.get(), expected: 5 })

      const spy = spyon(proxy)
      proxy.changeTarget(b)
      spy.was.called.once.with(10)
      out.push({ name: "proxy after changeTarget(b)", actual: proxy.get(), expected: 10 })
      return out
    })
    assertAll(results)
  })

  test("nested chain set writes terminal not outer", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      const inner = o(5)
      const outer = hold(inner)
      const proxy = o.proxy(outer)

      proxy.set(9)
      return { innerValue: inner.get(), outerIsInner: outer.get() === inner }
    })
    expect(results.innerValue).toBe(9)
    expect(results.outerIsInner).toBe(true)
  })

  test("follows when outer is repointed to another observable", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      const inner1 = o(1)
      const inner2 = o(2)
      const outer = hold(inner1)
      const proxy = o.proxy(outer)
      const spy = spyon(proxy)

      outer.set(inner2)
      out.push({ name: "proxy after outer.set(inner2)", actual: proxy.get(), expected: 2 })
      spy.was.called.once.with(2)

      inner1.set(99)
      out.push({ name: "proxy after stale inner1.set(99)", actual: proxy.get(), expected: 2 })
      return out
    })
    assertAll(results)
  })

  test("three-hop chain unwraps and follows relinks", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      const a = o(7)
      const b = hold(a)
      const c = hold(b)
      const proxy = o.proxy(c)
      const spy = spyon(proxy)

      out.push({ name: "proxy initial", actual: proxy.get(), expected: 7 })
      a.set(8)
      spy.was.called.once.with(8)

      const a2 = o(30)
      const b2 = hold(a2)
      c.set(b2)
      out.push({ name: "proxy after c.set(b2)", actual: proxy.get(), expected: 30 })
      a.set(100)
      out.push({ name: "proxy after stale a.set(100)", actual: proxy.get(), expected: 30 })
      return out
    })
    assertAll(results)
  })

  test("a proxy over .p() unwraps the observable the property holds, and follows when the holder swaps it", async ({
    page,
  }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const err1 = o("e1")
      const err2 = o("e2")
      const holder = o({ err: err1 } as { err: typeof err1 })
      const proxy = o.proxy(holder.p("err"))
      out.push({ name: "proxy initial", actual: proxy.get(), expected: "e1" })
      const spy = spyon(proxy)

      holder.set({ err: err2 })
      out.push({ name: "proxy after holder.set({err: err2})", actual: proxy.get(), expected: "e2" })
      spy.was.called.once.with("e2")

      err1.set("stale")
      out.push({ name: "proxy after stale err1.set", actual: proxy.get(), expected: "e2" })
      return out
    })
    assertAll(results)
  })

  test("chain collapses when outer stops holding an observable", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      const inner = o(5)
      const outer = hold(inner)
      const proxy = o.proxy(outer)
      const spy = spyon(proxy)

      outer.set(42)
      out.push({ name: "proxy after outer.set(42)", actual: proxy.get(), expected: 42 })
      spy.was.called.once.with(42)

      inner.set(99)
      out.push({ name: "proxy after stale inner.set(99)", actual: proxy.get(), expected: 42 })
      return out
    })
    assertAll(results)
  })

  test("chain expands when outer starts holding an observable", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const outer = o(1) as any
      const proxy = o.proxy(outer)
      const spy = spyon(proxy)

      const inner = o(5)
      outer.set(inner)
      out.push({ name: "proxy after outer.set(inner)", actual: proxy.get(), expected: 5 })
      spy.was.called.once.with(5)
      return out
    })
    assertAll(results)
  })

  test("changeTarget can install a nested chain", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      const inner = o(3)
      const outer = hold(inner)
      const proxy = o.proxy(o(0))

      proxy.changeTarget(outer)
      out.push({ name: "proxy after changeTarget(outer)", actual: proxy.get(), expected: 3 })

      inner.set(4)
      out.push({ name: "proxy after inner.set(4)", actual: proxy.get(), expected: 4 })
      return out
    })
    assertAll(results)
  })

  test("unwatched get resyncs after outer relink", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      const inner1 = o(1)
      const inner2 = o(2)
      const outer = hold(inner1)
      const proxy = o.proxy(outer)

      out.push({ name: "proxy initial", actual: proxy.get(), expected: 1 })
      outer.set(inner2)
      out.push({ name: "proxy after outer.set(inner2)", actual: proxy.get(), expected: 2 })
      return out
    })
    assertAll(results)
  })

  test("four-hop chain follows when a middle or an inner-middle link is repointed", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      for (const link of ["middle", "inner-middle"]) {
        const d = o(1)
        const c = hold(d)
        const b = hold(c)
        const a = hold(b)
        const proxy = o.proxy(a)
        const spy = spyon(proxy)
        out.push({ name: `${link}: proxy initial`, actual: proxy.get(), expected: 1 })

        const d2 = o(2)
        const c2 = hold(d2)
        ;(link === "middle" ? b : c).set(c2)
        out.push({ name: `${link}: proxy after repoint`, actual: proxy.get(), expected: 2 })
        spy.was.called.once.with(2)

        d.set(99)
        out.push({ name: `${link}: proxy after stale d.set(99)`, actual: proxy.get(), expected: 2 })

        d2.set(20)
        out.push({ name: `${link}: proxy after d2.set(20)`, actual: proxy.get(), expected: 20 })
        spy.was.called.once.with(20)
      }
      return out
    })
    assertAll(results)
  })

  test("mid-chain repoint relinks when terminal value stays the same", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      const d = o(1)
      const c = hold(d)
      const b = hold(c)
      const a = hold(b)
      const proxy = o.proxy(a)
      const spy = spyon(proxy)

      const d2 = o(1)
      const c2 = hold(d2)
      b.set(c2)

      d.set(99)
      out.push({ name: "proxy after stale d.set(99)", actual: proxy.get(), expected: 1 })
      spy.was.not.called

      d2.set(5)
      out.push({ name: "proxy after d2.set(5)", actual: proxy.get(), expected: 5 })
      spy.was.called.once.with(5)
      return out
    })
    assertAll(results)
  })

  test("a proxy over .p() follows a deep mid-chain or inner-middle repoint without the holder changing", async ({
    page,
  }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      for (const link of ["mid-chain", "inner-middle"]) {
        const d = o(1)
        const c = hold(d)
        const b = hold(c)
        const holder = o({ root: b })
        const proxy = o.proxy(holder.p("root"))
        const spy = spyon(proxy)

        const d2 = o(2)
        const c2 = hold(d2)
        ;(link === "mid-chain" ? b : c).set(c2)
        out.push({ name: `${link}: proxy after repoint`, actual: proxy.get(), expected: 2 })
        spy.was.called.once.with(2)

        d.set(99)
        out.push({ name: `${link}: proxy after stale d.set(99)`, actual: proxy.get(), expected: 2 })
      }
      return out
    })
    assertAll(results)
  })

  test("unwatched proxy resyncs after mid-chain repoint", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      const d = o(1)
      const c = hold(d)
      const b = hold(c)
      const a = hold(b)
      const proxy = o.proxy(a)

      const d2 = o(1)
      const c2 = hold(d2)
      b.set(c2)

      d.set(99)
      out.push({ name: "proxy after stale d.set(99)", actual: proxy.get(), expected: 1 })

      d2.set(8)
      out.push({ name: "proxy after d2.set(8)", actual: proxy.get(), expected: 8 })
      return out
    })
    assertAll(results)
  })

  test("mid-chain repoint inside transaction still relinks before flush ends", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      const d = o(1)
      const c = hold(d)
      const b = hold(c)
      const a = hold(b)
      const proxy = o.proxy(a)
      const spy = spyon(proxy)

      const d2 = o(2)
      const c2 = hold(d2)
      o.transaction(() => {
        b.set(c2)
      })
      out.push({ name: "proxy after transaction", actual: proxy.get(), expected: 2 })
      spy.was.called.once.with(2)

      d.set(99)
      out.push({ name: "proxy after stale d.set(99)", actual: proxy.get(), expected: 2 })
      return out
    })
    assertAll(results)
  })

  test("stale terminal in same transaction as mid-chain repoint is ignored", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      const d = o(1)
      const c = hold(d)
      const b = hold(c)
      const a = hold(b)
      const proxy = o.proxy(a)
      const spy = spyon(proxy)

      const d2 = o(2)
      const c2 = hold(d2)
      o.transaction(() => {
        b.set(c2)
        d.set(99)
      })
      out.push({ name: "proxy after transaction", actual: proxy.get(), expected: 2 })
      spy.was.called.once.with(2)
      return out
    })
    assertAll(results)
  })

  test("deep chain grows when a middle link starts holding an observable", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      const b = o(5) as any
      const a = hold(b)
      const proxy = o.proxy(a)
      const spy = spyon(proxy)

      out.push({ name: "proxy initial", actual: proxy.get(), expected: 5 })

      const inner = o(9)
      b.set(inner)
      out.push({ name: "proxy after b.set(inner)", actual: proxy.get(), expected: 9 })
      spy.was.called.once.with(9)

      b.set(7)
      out.push({ name: "proxy after b.set(7)", actual: proxy.get(), expected: 7 })
      return out
    })
    assertAll(results)
  })
})

test.describe("Observer Lifecycle", () => {
  test("an Observer is no longer called once stopped, or once removed from its observable", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      for (const how of ["stopObserving", "removeObserver"]) {
        const obs = o(5)
        let calls = 0
        const observer = new o.Observer(() => {
          calls++
        }, obs)

        observer.startObserving()
        out.push({ name: `${how}: calls after startObserving`, actual: calls, expected: 1 })

        obs.set(10)
        out.push({ name: `${how}: calls after set(10)`, actual: calls, expected: 2 })

        if (how === "stopObserving") observer.stopObserving()
        else obs.removeObserver(observer)
        obs.set(15)
        out.push({ name: `${how}: calls after ${how} + set(15)`, actual: calls, expected: 2 })
      }
      return out
    })
    assertAll(results)
  })

  test("SilentObserver ignores first change", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obs = o(5)
      let callCount = 0
      let lastValue: number | undefined

      const observer = new o.SilentObserver((value: any) => {
        callCount++
        lastValue = value
      }, obs)

      observer.startObserving()
      out.push({ name: "callCount after startObserving", actual: callCount, expected: 0 }) // Not called initially

      obs.set(10)
      out.push({ name: "callCount after obs.set(10)", actual: callCount, expected: 1 })
      out.push({ name: "lastValue after obs.set(10)", actual: lastValue, expected: 10 })
      return out
    })
    assertAll(results)
  })

  test("Observer.debounce() delays notifications", async ({ page }) => {
    const results = await page.evaluate(async () => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
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
      out.push({ name: "callCount before debounce fires", actual: callCount, expected: 1 }) // Only initial call

      await new Promise((resolve) => setTimeout(resolve, 100))

      // After debounce, should be called with latest value
      out.push({ name: "callCount after debounce fires", actual: callCount, expected: 2 })
      out.push({ name: "lastValue after debounce fires", actual: lastValue, expected: 3 })
      return out
    })
    assertAll(results)
  })

  test("Observer.throttle() limits notification rate", async ({ page }) => {
    const results = await page.evaluate(async () => {
      const { o } = window.__ELT__
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

      const callCountRightAfter = callCount // Initial call + first throttled call

      await new Promise((resolve) => setTimeout(resolve, 150))

      return { callCountRightAfter, callCountAfterWait: callCount }
    })
    expect(results.callCountRightAfter).toBe(1)
    // Should have limited calls
    expect(results.callCountAfterWait).toBeLessThan(4)
  })

  test("ObserverHolder manages multiple observers", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const holder = new o.ObserverHolder()
      const obs = o(5)
      let callCount = 0

      holder.observe(
        obs,
        () => {
          callCount++
        },
        { immediate: true },
      )
      holder.startObservers()

      out.push({ name: "callCount after startObservers", actual: callCount, expected: 1 })

      obs.set(10)
      out.push({ name: "callCount after obs.set(10)", actual: callCount, expected: 2 })

      holder.stopObservers()
      obs.set(15)
      out.push({ name: "callCount after stopObservers + obs.set(15)", actual: callCount, expected: 2 }) // Not called after stop

      holder.startObservers()
      out.push({ name: "callCount after restart", actual: callCount, expected: 3 }) // Called on restart

      holder.stopObservers()
      return out
    })
    assertAll(results)
  })
})

test.describe("Additional Methods", () => {
  test(".key() follows a Map's value at a key, and an observable key as it changes", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const map = o(
        new Map([
          ["key1", "value1"],
          ["key2", "value2"],
        ]),
      )
      const keyObs = map.key("key1")
      out.push({ name: "plain key initial", actual: keyObs.get(), expected: "value1" })

      const spy = spyon(keyObs)
      const new_map = new Map(map.get())
      new_map.set("key1", "newValue")
      map.set(new_map)
      spy.was.called.once.with("newValue")

      const o_key = o<string>("key1")
      const slot = map.key(o_key)
      out.push({ name: "observable key initial", actual: slot.get(), expected: "newValue" })
      const slot_spy = spyon(slot)
      o_key.set("key2")
      out.push({ name: "after key change", actual: slot.get(), expected: "value2" })
      slot_spy.was.called.once.with("value2")
      return out
    })
    assertAll(results)
  })
})

test.describe("Utility Functions", () => {
  test("o() wraps plain values and returns observables as-is", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const plain = 5
      const obs1 = o(plain)
      const obs2 = o(obs1)
      return { obs1IsObservable: o.is_observable(obs1), sameRef: (obs1 as any) === (obs2 as any) }
    })
    expect(results.obs1IsObservable).toBe(true)
    expect(results.sameRef).toBe(true) // Should return same observable
  })
})

test.describe("Transformers", () => {
  test.describe("tf_array_filter()", () => {
    test("filters array by predicate", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o, tf_array_filter } = window.__ELT__
        const { spyon } = (window as any).__TEST_HELPERS__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const arr = o([1, 2, 3, 4, 5])
        const evens = arr.tf(tf_array_filter((n: number) => n % 2 === 0))

        out.push({ name: "evens initial", actual: evens.get(), expected: [2, 4] })

        const spy = spyon(evens)
        arr.set([1, 2, 3, 4, 5, 6])
        spy.was.called.once
        out.push({ name: "evens after arr.set", actual: evens.get(), expected: [2, 4, 6] })
        return out
      })
      assertAll(results)
    })
  })

  test.describe("tf_array_sort()", () => {
    test("sorts array", async ({ page }) => {
      const actual = await page.evaluate(() => {
        const { o, tf_array_sort } = window.__ELT__
        const arr = o([3, 1, 4, 1, 5, 9, 2, 6])
        const sorted = arr.tf(tf_array_sort((a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0)))
        return sorted.get()
      })
      expect(actual).toEqual([1, 1, 2, 3, 4, 5, 6, 9])
    })
  })

  test.describe("tf_array_sort_by()", () => {
    test("sorts array by key function", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, tf_array_sort_by } = window.__ELT__
        const arr = o([
          { name: "Charlie", age: 30 },
          { name: "Alice", age: 25 },
          { name: "Bob", age: 35 },
        ])
        const sorted = arr.tf(tf_array_sort_by([(item: any) => item.age]))
        return (sorted.get() as any[]).map((item) => item.name)
      })
      expect(result).toEqual(["Alice", "Charlie", "Bob"])
    })
  })

  test("tf_array_has(), tf_set_has() and tf_map_has() follow the collection, and writing true adds the values", async ({
    page,
  }) => {
    const results = await page.evaluate(() => {
      const { o, tf_array_has, tf_set_has, tf_map_has } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []

      const arr = o([1, 2, 3, 4, 5])
      const arr_has = arr.tf(tf_array_has(3))
      out.push({ name: "array: initial", actual: arr_has.get(), expected: true })
      arr.set([1, 2, 4, 5])
      out.push({ name: "array: after removal", actual: arr_has.get(), expected: false })
      const arr2 = o([1, 2])
      const arr2_has = arr2.tf(tf_array_has(3, 4))
      out.push({ name: "array: several values, initial", actual: arr2_has.get(), expected: false })
      arr2_has.set(true)
      out.push({ name: "array: after writing true", actual: arr2.get(), expected: [1, 2, 3, 4] })

      const set = o(new Set([1, 2, 3, 4, 5]))
      const set_has = set.tf(tf_set_has(3))
      out.push({ name: "set: initial", actual: set_has.get(), expected: true })
      set.set(new Set([1, 2, 4, 5]))
      out.push({ name: "set: after removal", actual: set_has.get(), expected: false })
      const set2 = o(new Set([1]))
      const set2_has = set2.tf(tf_set_has(2))
      out.push({ name: "set: absent initial", actual: set2_has.get(), expected: false })
      set2_has.set(true)
      out.push({ name: "set: has 2 after writing true", actual: set2.get().has(2), expected: true })

      const map = o(
        new Map([
          ["a", 1],
          ["b", 2],
          ["c", 3],
        ]),
      )
      const map_has = map.tf(tf_map_has(["b", 2]))
      out.push({ name: "map: initial", actual: map_has.get(), expected: true })
      const new_map = new Map(map.get())
      new_map.set("b", 3)
      map.set(new_map)
      out.push({ name: "map: after the value changed", actual: map_has.get(), expected: false })
      const map2 = o(new Map([["a", 1]]))
      const map2_has = map2.tf(tf_map_has(["b", 2]))
      out.push({ name: "map: absent initial", actual: map2_has.get(), expected: false })
      map2_has.set(true)
      out.push({ name: "map: get(b) after writing true", actual: map2.get().get("b"), expected: 2 })
      return out
    })
    assertAll(results)
  })

  test("tf_entries(), tf_array_to_map() and tf_array_to_object() write back what is set on them", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, tf_entries, tf_array_to_map, tf_array_to_object } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      type Item = { id: number; name: string }

      const obj = o({ a: 1, b: 2, c: 3 } as Record<string, number>)
      const entries = obj.tf(tf_entries<Record<string, number>>())
      entries.addObserver(() => {})
      out.push({
        name: "entries: forward",
        actual: entries.get(),
        expected: [
          ["a", 1],
          ["b", 2],
          ["c", 3],
        ],
      })
      entries.set([
        ["a", 10],
        ["d", 4],
      ])
      out.push({
        name: "entries: the object is rebuilt from the entries",
        actual: obj.get(),
        expected: { a: 10, d: 4 },
      })

      const list_m = o<Item[]>([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ])
      const by_id = list_m.tf(tf_array_to_map((item: Item) => item.id))
      by_id.addObserver(() => {})
      const m = new Map(by_id.get())
      m.set(2, { id: 2, name: "Bobby" })
      m.set(3, { id: 3, name: "Carol" })
      by_id.set(m)
      out.push({
        name: "to_map: the array is the map's values",
        actual: list_m.get().map((it) => it.name),
        expected: ["Alice", "Bobby", "Carol"],
      })

      const list_o = o<Item[]>([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ])
      const by_key = list_o.tf(tf_array_to_object((item: Item) => item.id))
      by_key.addObserver(() => {})
      by_key.set({ ...by_key.get(), 1: { id: 1, name: "Ann" } })
      out.push({
        name: "to_object: the array is the object's values",
        actual: list_o.get().map((it) => it.name),
        expected: ["Ann", "Bob"],
      })
      return out
    })
    assertAll(results)
  })
})
