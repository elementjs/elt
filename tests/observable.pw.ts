import { expect, test } from "@playwright/test"
// Type-only import: gives page.evaluate() callbacks below access to the `o` namespace's
// *types* (o.Observable<T>, etc.) for annotations. Erased at compile time, so this has no
// effect on the browser runtime -- the actual `o` value used inside evaluate() always comes
// from `window.__ELT__`, never from this import.
import type { o } from "../src/observable"

function assertAll(results: { name: string; actual: unknown; expected: unknown }[]) {
  for (const r of results) expect(r.actual, r.name).toEqual(r.expected)
}

// Installed once per page (via addInitScript, which must run before goto() navigates)
// so every page.evaluate() callback can use `cmp`, `Calls`, and `spyon` as real globals,
// mirroring the helpers that lived at the top of the original bun test file.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
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
        if (this.count !== times) throw new Error(`Expected to be called ${times} times but was called ${this.count} times`)
        this.count = 0
        return this
      }

      with(...args: any[]) {
        for (const call of this.calls) {
          for (let i = 0; i < args.length; i++) {
            if (!cmp(args[i], call[i])) throw new Error(`At position ${i}, expected ${JSON.stringify(args[i])} got ${JSON.stringify(call[i])}`)
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
  })
  await page.goto("/tests/browser/harness.html")
})

test.describe("Observable", () => {
  test.describe("basic operations", () => {
    test("addObserver is called immediately", async ({ page }) => {
      await page.evaluate(() => {
        const { o } = window.__ELT__
        const { spyon } = (window as any).__TEST_HELPERS__
        const obs = o(0)
        const spytest2 = spyon(obs, true)

        spytest2.was.called.once
        spytest2.was.called.with(0)

        obs.set(4)

        spytest2.was.called.once
        spytest2.was.called.with(4)
      })
    })

    test("updateOnly is not called immediately", async ({ page }) => {
      await page.evaluate(() => {
        const { o } = window.__ELT__
        const { spyon } = (window as any).__TEST_HELPERS__
        const obs = o(0)
        const spytest = spyon(obs)

        spytest.was.never.called
        obs.set(3)
        spytest.was.called.with(3)
        spytest.was.called.once
      })
    })

    test("set correctly changes the value", async ({ page }) => {
      const actual = await page.evaluate(() => {
        const { o } = window.__ELT__
        const obs = o(0)
        obs.set(4)
        return obs.get()
      })
      expect(actual).toBe(4)
    })

    test("observers are not called again when the value is the same", async ({ page }) => {
      await page.evaluate(() => {
        const { o } = window.__ELT__
        const { spyon } = (window as any).__TEST_HELPERS__
        const obs = o(0)
        const spytest = spyon(obs)
        const spytest2 = spyon(obs, true)

        obs.set(0)
        spytest.was.never.called
        spytest2.was.called.once
      })
    })
  })

  test.describe("boolean operations", () => {
    test("and/or work as expected", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o } = window.__ELT__
        const { spyon } = (window as any).__TEST_HELPERS__
        const out: { name: string; actual: unknown; expected: unknown }[] = []

        out.push({ name: "o.or(true, false)", actual: o.or(true, false).get(), expected: true })
        out.push({ name: "o.and(true, false)", actual: o.and(true, false).get(), expected: false })

        const t1 = o(true)
        const t2 = o(false)
        const t = o.and(t1, t2)
        const sp = spyon(t)
        out.push({ name: "t initial", actual: t.get(), expected: false })
        t2.set(true)
        sp.called.once.with(true)
        out.push({ name: "t after t2 set true", actual: t.get(), expected: true })
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

    test("assign() updates nested properties", async ({ page }) => {
      const actual = await page.evaluate(() => {
        const { o } = window.__ELT__
        const obs = o({ a: { b: { c: 1 } } })
        obs.assign({ a: { b: { c: 2 } } })
        return obs.get().a.b.c
      })
      expect(actual).toBe(2)
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

  test.describe("array methods", () => {})
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
  test("simple transform works", async ({ page }) => {
    const actual = await page.evaluate(() => {
      const { o } = window.__ELT__
      const tests = o(5)
      const ttf = tests.tf((a: number) => a + 10)
      return ttf.get()
    })
    expect(actual).toBe(15)
  })

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

  test("observers are fired", async ({ page }) => {
    await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const tests = o(5)
      const ttf2 = tests.tf({
        transform: (v: number) => v + 20,
        revert: (v: number) => v * 2,
      })
      const tt = spyon(ttf2)
      tests.set(8)
      tt.was.called.once
    })
  })

  // Pausing the transformer observable should stop sending reverts to
  // the original observable.
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

  test("combined observable updates when any dependency changes", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const x = o(2)
      const y = o(3)
      const z = o(4)
      const product = o.combine([x, y, z], (deps: any) => {
        const [a, b, c] = deps.map((d: any) => o.get(d))
        return a * b * c
      })

      out.push({ name: "product initial", actual: product.get(), expected: 24 })

      const spy = spyon(product)
      x.set(3)
      spy.was.called.once.with(36)
      y.set(4)
      spy.was.called.once.with(48)
      return out
    })
    assertAll(results)
  })
})

test.describe("o.merge() and o.join()", () => {
  test("o.merge() combines multiple observables into object", async ({ page }) => {
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
      return out
    })
    assertAll(results)
  })

  test("o.merge() properties can be set bidirectionally", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const a = o(5)
      const b = o("hello")
      const merged = o.merge({ a, b })

      merged.p("a").set(20)
      out.push({ name: "a after merged.p(a).set(20)", actual: a.get(), expected: 20 })

      merged.p("b").set("world")
      out.push({ name: "b after merged.p(b).set(world)", actual: b.get(), expected: "world" })
      return out
    })
    assertAll(results)
  })

  test("o.join() combines observables into array", async ({ page }) => {
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
      return out
    })
    assertAll(results)
  })
})

test.describe("o.p(fn)", () => {
  test("o.p(function) works as getter with simple expression", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ a: 1, b: 2, c: { d: 3 } })
      const sub = obj.p((x: any) => x.a)
      out.push({ name: "sub initial", actual: sub.get(), expected: 1 })
      obj.assign({ a: 10 })
      out.push({ name: "sub after assign", actual: sub.get(), expected: 10 })
      return out
    })
    assertAll(results)
  })

  test("o.p(function) works as getter with nested path", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ a: { b: { c: 42 } } })
      const sub = obj.p((x: any) => x.a.b.c)
      out.push({ name: "sub initial", actual: sub.get(), expected: 42 })
      obj.assign({ a: { b: { c: 100 } } })
      out.push({ name: "sub after assign", actual: sub.get(), expected: 100 })
      return out
    })
    assertAll(results)
  })

  test("o.p(function) works as getter with bracket access", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ key: "value", other: 0 })
      const sub = obj.p((x: any) => x["key"])
      out.push({ name: "sub initial", actual: sub.get(), expected: "value" })
      obj.assign({ key: "updated" })
      out.push({ name: "sub after assign", actual: sub.get(), expected: "updated" })
      return out
    })
    assertAll(results)
  })

  test("o.p(function) works as setter with simple expression", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ a: 1, b: 2 })
      const sub = obj.p((x: any) => x.a)
      sub.set(99)
      out.push({ name: "obj after sub.set(99)", actual: obj.get(), expected: { a: 99, b: 2 } })
      out.push({ name: "sub.get()", actual: sub.get(), expected: 99 })
      return out
    })
    assertAll(results)
  })

  test("o.p(function) works as setter with nested path", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ a: { b: { c: 1 } } })
      const sub = obj.p((x: any) => x.a.b.c)
      sub.set(88)
      out.push({ name: "obj after sub.set(88)", actual: obj.get(), expected: { a: { b: { c: 88 } } } })
      out.push({ name: "sub.get()", actual: sub.get(), expected: 88 })
      return out
    })
    assertAll(results)
  })

  test("o.p(function) works as setter with nested path and ?. chaining", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({} as { a?: { b?: { c?: number } } })
      // Built via `new Function` (not a TS arrow function) so the optional-chaining
      // syntax reaches the browser verbatim: o.p(fn) parses the getter's own
      // `fn.toString()` source to derive the path, and Playwright/esbuild would
      // otherwise downlevel `?.` into helper temp vars before this reaches Chromium,
      // mangling that source and breaking the path parser (native Chromium supports
      // `?.` fine — this is purely a source-transpilation artifact of the test tooling).
      const sub = obj.p(
        new Function("return (x) => x.a?.b?.c")() as (x: { a?: { b?: { c?: number } } }) => number | undefined,
      )
      sub.set(88)
      out.push({ name: "obj after sub.set(88)", actual: obj.get(), expected: { a: { b: { c: 88 } } } })
      out.push({ name: "sub.get()", actual: sub.get(), expected: 88 })
      return out
    })
    assertAll(results)
  })

  test("o.p(function) works as setter with bracket access", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ key: "old", other: 1 })
      const sub = obj.p((x: any) => x["key"])
      sub.set("new")
      out.push({ name: "obj after sub.set(new)", actual: obj.get(), expected: { key: "new", other: 1 } })
      out.push({ name: "sub.get()", actual: sub.get(), expected: "new" })
      return out
    })
    assertAll(results)
  })
})

test.describe("o.p(dynamic key)", () => {
  test("o.p(o(key)) follows observable key changes", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ a: 1, b: 2 })
      const o_key = o<"a" | "b">("a")
      const sub = obj.p(o_key)

      out.push({ name: "sub initial", actual: sub.get(), expected: 1 })

      const spy = spyon(sub)
      o_key.set("b")
      out.push({ name: "sub after o_key.set(b)", actual: sub.get(), expected: 2 })
      spy.was.called.once.with(2)
      return out
    })
    assertAll(results)
  })

  test("o.p(o(key)) setter writes to the active key", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ a: 1, b: 2 })
      const o_key = o<"a" | "b">("b")
      const sub = obj.p(o_key)

      sub.set(20)
      out.push({ name: "obj after sub.set(20)", actual: obj.get(), expected: { a: 1, b: 20 } })
      out.push({ name: "sub.get()", actual: sub.get(), expected: 20 })

      o_key.set("a")
      out.push({ name: "sub after o_key.set(a)", actual: sub.get(), expected: 1 })
      sub.set(10)
      out.push({ name: "obj after second sub.set(10)", actual: obj.get(), expected: { a: 10, b: 20 } })
      return out
    })
    assertAll(results)
  })

  test("o.prop(obj, o(key)) matches .p(o(key))", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ x: "a", y: "b" })
      const o_key = o<"x" | "y">("x")
      const sub = o.prop(obj, o_key)

      out.push({ name: "sub initial", actual: sub.get(), expected: "a" })
      o_key.set("y")
      out.push({ name: "sub after o_key.set(y)", actual: sub.get(), expected: "b" })
      sub.set("z")
      out.push({ name: "obj after sub.set(z)", actual: obj.get(), expected: { x: "a", y: "z" } })
      return out
    })
    assertAll(results)
  })
})

test.describe("o.p(path[])", () => {
  test("o.p([...]) works as getter with nested path", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ a: { b: { c: 42 } } })
      const sub = obj.p(["a", "b", "c"])
      out.push({ name: "sub initial", actual: sub.get(), expected: 42 })
      obj.assign({ a: { b: { c: 100 } } })
      out.push({ name: "sub after assign", actual: sub.get(), expected: 100 })
      return out
    })
    assertAll(results)
  })

  test("o.p([...]) works as setter with nested path", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ a: { b: { c: 1 } } })
      const sub = obj.p(["a", "b", "c"])
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

  test("o.p(o(path)) follows observable path changes", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ x: { v: 1 }, y: { v: 2 } })
      const o_path = o(["x", "v"])
      const sub = obj.p(o_path)

      out.push({ name: "sub initial", actual: sub.get(), expected: 1 })

      const spy = spyon(sub)
      o_path.set(["y", "v"])
      out.push({ name: "sub after o_path.set", actual: sub.get(), expected: 2 })
      spy.was.called.once.with(2)
      return out
    })
    assertAll(results)
  })

  test("o.p(o(path)) setter writes along the active path", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ x: { v: 1 }, y: { v: 2 } })
      const o_path = o(["y", "v"])
      const sub = obj.p(o_path)

      sub.set(99)
      out.push({ name: "obj after sub.set(99)", actual: obj.get(), expected: { x: { v: 1 }, y: { v: 99 } } })

      o_path.set(["x", "v"])
      out.push({ name: "sub after o_path.set(x,v)", actual: sub.get(), expected: 1 })
      sub.set(11)
      out.push({ name: "obj after second sub.set(11)", actual: obj.get(), expected: { x: { v: 11 }, y: { v: 99 } } })
      return out
    })
    assertAll(results)
  })

  test("o.prop(obj, [...]) matches .p([...])", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ a: { b: { c: 5 } } })
      const sub = o.prop(obj, ["a", "b", "c"])
      out.push({ name: "sub initial", actual: sub.get(), expected: 5 })
      sub.set(6)
      out.push({ name: "obj.get().a.b.c after sub.set(6)", actual: obj.get().a.b.c, expected: 6 })
      return out
    })
    assertAll(results)
  })

  test("o.prop(obj, o(path)) matches .p(o(path))", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ one: { n: 1 }, two: { n: 2 } })
      const o_path = o(["two", "n"])
      const sub = o.prop(obj, o_path)

      out.push({ name: "sub initial", actual: sub.get(), expected: 2 })
      o_path.set(["one", "n"])
      out.push({ name: "sub after o_path.set", actual: sub.get(), expected: 1 })
      return out
    })
    assertAll(results)
  })
})

test.describe("o.p path setter overwrite", () => {
  test("o.p([...]) replaces a string intermediate with an object chain", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      type Tested = { a: string; b: number } | { a: { b: { c: number } }; b: number }
      const obj = o({ a: "hello", b: 1 } as Tested)
      const sub = obj.p(["a", "b", "c"])

      sub.set(42)
      out.push({ name: "obj after sub.set(42)", actual: obj.get(), expected: { a: { b: { c: 42 } }, b: 1 } })
      out.push({ name: "sub.get()", actual: sub.get(), expected: 42 })
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

  test("o.p([...]) replaces a number intermediate with an object chain", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      type Tested = { a: number; b: number } | { a: { b: { c: string } }; b: number }
      const obj = o({ a: 0, b: 1 } as Tested)
      const sub = obj.p(["a", "b", "c"])

      sub.set("nested")
      out.push({ name: "obj after sub.set(nested)", actual: obj.get(), expected: { a: { b: { c: "nested" } }, b: 1 } })
      out.push({ name: "sub.get()", actual: sub.get(), expected: "nested" })
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

  test("o.prop(obj, [...]) replaces a string intermediate with an object chain", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obj = o({ a: "hello" } as { a: string | { b: { c: number } } })
      const sub = o.prop(obj, ["a", "b", "c"])

      sub.set(7)
      out.push({ name: "obj after sub.set(7)", actual: obj.get(), expected: { a: { b: { c: 7 } } } })
      out.push({ name: "sub.get()", actual: sub.get(), expected: 7 })
      return out
    })
    assertAll(results)
  })
})

test.describe("o.expression()", () => {
  test("o.expression() creates combined observable with dynamic dependencies", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const a = o(5)
      const b = o(10)
      const expr = o.expression((get: any) => get(a) + get(b))

      out.push({ name: "expr initial", actual: expr.get(), expected: 15 })

      const spy = spyon(expr)
      a.set(8)
      spy.was.called.once.with(18)
      return out
    })
    assertAll(results)
  })

  test("o.expression() with setter is bidirectional", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const a = o(5)
      const b = o(10)
      const expr = o.expression(
        (get: any) => get(a) + get(b),
        (sum: number, set: any, _: any) => {
          set(a, sum - o.get(b))
        },
      )

      expr.set(20)
      out.push({ name: "a after expr.set(20)", actual: a.get(), expected: 10 })
      out.push({ name: "b after expr.set(20)", actual: b.get(), expected: 10 })
      return out
    })
    assertAll(results)
  })

  test("o.expression() recomputes when dependencies change", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const x = o(2)
      const y = o(3)
      const expr = o.expression((get: any) => get(x) * get(y))

      out.push({ name: "expr initial", actual: expr.get(), expected: 6 })
      y.set(5)
      out.push({ name: "expr after y.set(5)", actual: expr.get(), expected: 10 })
      return out
    })
    assertAll(results)
  })
})

test.describe("Transactions", () => {
  test("o.transaction() batches multiple updates", async ({ page }) => {
    await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const a = o(1)
      const b = o(2)
      const sum = o.combine([a, b], (deps: any) => {
        const [x, y] = deps.map((d: any) => o.get(d))
        return x + y
      })

      const spy = spyon(sum)

      o.transaction(() => {
        a.set(5)
        b.set(10)
      })

      // Should only be called once despite two changes
      spy.was.called.once.with(15)
    })
  })

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
  test("o.proxy() creates changeable proxy", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const a = o(5)
      const b = o(10)
      const proxy = o.proxy(a)

      out.push({ name: "proxy initial", actual: proxy.get(), expected: 5 })

      proxy.changeTarget(b)
      out.push({ name: "proxy after changeTarget(b)", actual: proxy.get(), expected: 10 })
      return out
    })
    assertAll(results)
  })

  test("proxy updates when target changes", async ({ page }) => {
    await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const a = o(5)
      const proxy = o.proxy(a)
      const spy = spyon(proxy)

      a.set(15)
      spy.was.called.once.with(15)
    })
  })

  test("setting proxy sets target", async ({ page }) => {
    const actual = await page.evaluate(() => {
      const { o } = window.__ELT__
      const a = o(5)
      const proxy = o.proxy(a)

      proxy.set(20)
      return a.get()
    })
    expect(actual).toBe(20)
  })

  test("changing target updates observers", async ({ page }) => {
    await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const a = o(5)
      const b = o(10)
      const proxy = o.proxy(a)
      const spy = spyon(proxy)

      proxy.changeTarget(b)
      spy.was.called.once.with(10)
    })
  })

  test("unwraps nested observables to terminal value", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      const inner = o(5)
      const outer = hold(inner)
      const proxy = o.proxy(outer)

      return { value: proxy.get(), sameAsInner: proxy.get() === inner }
    })
    expect(results.value).toBe(5)
    expect(results.sameAsInner).toBe(false)
  })

  test("nested chain notifies when terminal value changes", async ({ page }) => {
    await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      const inner = o(5)
      const outer = hold(inner)
      const proxy = o.proxy(outer)
      const spy = spyon(proxy)

      inner.set(6)
      spy.was.called.once.with(6)
    })
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

  test("unwraps .p() when property holds an observable", async ({ page }) => {
    const actual = await page.evaluate(() => {
      const { o } = window.__ELT__
      const err = o("e1")
      const holder = o({ err })
      const proxy = o.proxy(holder.p("err"))
      return proxy.get()
    })
    expect(actual).toBe("e1")
  })

  test(".p() proxy follows when holder swaps observable field", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const err1 = o("e1")
      const err2 = o("e2")
      const holder = o({ err: err1 } as { err: typeof err1 })
      const proxy = o.proxy(holder.p("err"))
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

  test("proxy set does not write non-writable parents in chain", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      function hold<T>(obs: o.Observable<T>): o.Observable<unknown> {
        return new o.Observable(obs) as o.Observable<unknown>
      }
      const inner = o(5)
      const outer = hold(inner)
      const proxy = o.proxy(outer)

      proxy.set(11)
      return { innerValue: inner.get(), outerIsInner: outer.get() === inner }
    })
    expect(results.innerValue).toBe(11)
    expect(results.outerIsInner).toBe(true)
  })

  test("four-hop chain follows when a middle link is repointed", async ({ page }) => {
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

      out.push({ name: "proxy initial", actual: proxy.get(), expected: 1 })

      const d2 = o(2)
      const c2 = hold(d2)
      b.set(c2)
      out.push({ name: "proxy after b.set(c2)", actual: proxy.get(), expected: 2 })
      spy.was.called.once.with(2)

      d.set(99)
      out.push({ name: "proxy after stale d.set(99)", actual: proxy.get(), expected: 2 })

      d2.set(20)
      out.push({ name: "proxy after d2.set(20)", actual: proxy.get(), expected: 20 })
      spy.was.called.once.with(20)
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

  test("derived root follows deep mid-chain repoint", async ({ page }) => {
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
      const holder = o({ root: b })
      const proxy = o.proxy(holder.p("root"))
      const spy = spyon(proxy)

      const d2 = o(2)
      const c2 = hold(d2)
      b.set(c2)
      out.push({ name: "proxy after b.set(c2)", actual: proxy.get(), expected: 2 })
      spy.was.called.once.with(2)

      d.set(99)
      out.push({ name: "proxy after stale d.set(99)", actual: proxy.get(), expected: 2 })
      return out
    })
    assertAll(results)
  })

  test("derived root follows inner-middle repoint without holder change", async ({ page }) => {
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
      const holder = o({ root: b })
      const proxy = o.proxy(holder.p("root"))
      const spy = spyon(proxy)

      const d2 = o(3)
      const c2 = hold(d2)
      c.set(c2)
      out.push({ name: "proxy after c.set(c2)", actual: proxy.get(), expected: 3 })
      spy.was.called.once.with(3)

      d.set(99)
      out.push({ name: "proxy after stale d.set(99)", actual: proxy.get(), expected: 3 })
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

  test("four-hop chain follows when an inner-middle link is repointed", async ({ page }) => {
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

      const d2 = o(3)
      const c2 = hold(d2)
      c.set(c2)
      out.push({ name: "proxy after c.set(c2)", actual: proxy.get(), expected: 3 })
      spy.was.called.once.with(3)

      d.set(99)
      out.push({ name: "proxy after stale d.set(99)", actual: proxy.get(), expected: 3 })

      d2.set(30)
      out.push({ name: "proxy after d2.set(30)", actual: proxy.get(), expected: 30 })
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
  test("Observer can be stopped and started", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obs = o(5)
      let callCount = 0
      const observer = new o.Observer(() => {
        callCount++
      }, obs)

      observer.startObserving()
      out.push({ name: "callCount after startObserving", actual: callCount, expected: 1 }) // Initial call

      obs.set(10)
      out.push({ name: "callCount after obs.set(10)", actual: callCount, expected: 2 })

      observer.stopObserving()
      obs.set(15)
      out.push({ name: "callCount after stop + obs.set(15)", actual: callCount, expected: 2 }) // Not called after stop
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

test.describe("Boolean Combinators", () => {
  test("o.not() inverts boolean observable", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obs = o(true)
      const inverted = o.not(obs)

      const spy = spyon(inverted)
      out.push({ name: "inverted initial", actual: inverted.get(), expected: false })

      obs.set(false)
      out.push({ name: "obs after set(false)", actual: obs.get(), expected: false })
      out.push({ name: "inverted after obs.set(false)", actual: inverted.get(), expected: true })
      spy.was.called.once.with(true)
      return out
    })
    assertAll(results)
  })

  test("o.and() with multiple observables", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const a = o(true)
      const b = o(true)
      const c = o(false)
      const result = o.and(a, b, c)

      out.push({ name: "result initial", actual: result.get(), expected: false })

      c.set(true)
      out.push({ name: "result after c.set(true)", actual: result.get(), expected: true })
      return out
    })
    assertAll(results)
  })

  test("o.or() with multiple observables", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const a = o(false)
      const b = o(false)
      const c = o(false)
      const result = o.or(a, b, c)

      out.push({ name: "result initial", actual: result.get(), expected: false })

      b.set(true)
      out.push({ name: "result after b.set(true)", actual: result.get(), expected: true })
      return out
    })
    assertAll(results)
  })
})

test.describe("Additional Methods", () => {
  test(".key() accesses Map keys", async ({ page }) => {
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

      out.push({ name: "keyObs initial", actual: keyObs.get(), expected: "value1" })

      const spy = spyon(keyObs)
      const new_map = new Map(map.get())
      new_map.set("key1", "newValue")
      map.set(new_map)
      spy.was.called.once.with("newValue")
      return out
    })
    assertAll(results)
  })

  test(".apply() calls methods on the value", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obs = o("hello")
      const upper = obs.apply("toUpperCase", [])

      out.push({ name: "upper initial", actual: upper.get(), expected: "HELLO" })

      const spy = spyon(upper)
      obs.set("world")
      spy.was.called.once.with("WORLD")
      return out
    })
    assertAll(results)
  })

  test(".call() calls methods with arguments", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { spyon } = (window as any).__TEST_HELPERS__
      const out: { name: string; actual: unknown; expected: unknown }[] = []
      const obs = o("hello world")
      const sliced = obs.call("slice", 0, 5)

      out.push({ name: "sliced initial", actual: sliced.get(), expected: "hello" })

      const spy = spyon(sliced)
      obs.set("greetings everyone")
      spy.was.called.once.with("greet")
      return out
    })
    assertAll(results)
  })
})

test.describe("Utility Functions", () => {
  test("o.is_observable() checks if value is observable", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const obs = o(5)
      const plain = 5
      return { obsIsObservable: o.is_observable(obs), plainIsObservable: o.is_observable(plain) }
    })
    expect(results.obsIsObservable).toBe(true)
    expect(results.plainIsObservable).toBe(false)
  })

  test("o.get() extracts value from observable or returns plain value", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const obs = o(5)
      const plain = 10
      return { fromObs: o.get(obs), fromPlain: o.get(plain) }
    })
    expect(results.fromObs).toBe(5)
    expect(results.fromPlain).toBe(10)
  })

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

    test("sorts with custom comparator", async ({ page }) => {
      const actual = await page.evaluate(() => {
        const { o, tf_array_sort } = window.__ELT__
        const arr = o([3, 1, 4, 1, 5])
        const sorted = arr.tf(tf_array_sort((a: number, b: number) => (a < b ? 1 : a > b ? -1 : 0)))
        return sorted.get()
      })
      expect(actual).toEqual([5, 4, 3, 1, 1])
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

  test.describe("tf_array_has()", () => {
    test("checks if array contains value", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o, tf_array_has } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const arr = o([1, 2, 3, 4, 5])
        const hasThree = arr.tf(tf_array_has(3))

        out.push({ name: "hasThree initial", actual: hasThree.get(), expected: true })

        arr.set([1, 2, 4, 5])
        out.push({ name: "hasThree after arr.set", actual: hasThree.get(), expected: false })
        return out
      })
      assertAll(results)
    })
  })

  test.describe("tf_set_has()", () => {
    test("checks if set contains value", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o, tf_set_has } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const set = o(new Set([1, 2, 3, 4, 5]))
        const hasThree = set.tf(tf_set_has(3))

        out.push({ name: "hasThree initial", actual: hasThree.get(), expected: true })

        set.set(new Set([1, 2, 4, 5]))
        out.push({ name: "hasThree after set.set", actual: hasThree.get(), expected: false })
        return out
      })
      assertAll(results)
    })
  })

  test.describe("tf_map_has()", () => {
    test("checks if map contains key-value pair", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o, tf_map_has } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const map = o(
          new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
          ]),
        )
        const hasB2 = map.tf(tf_map_has(["b", 2]))

        out.push({ name: "hasB2 initial", actual: hasB2.get(), expected: true })

        const new_map = new Map(map.get())
        new_map.set("b", 3)
        map.set(new_map)
        out.push({ name: "hasB2 after map.set", actual: hasB2.get(), expected: false })
        return out
      })
      assertAll(results)
    })
  })

  test.describe("tf_entries()", () => {
    test("converts object to entries array", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, tf_entries } = window.__ELT__
        const obj = o({ a: 1, b: 2, c: 3 })
        const entries = obj.tf(tf_entries<{ a: number; b: number; c: number }>())
        return entries.get()
      })
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(3)
      expect(result).toContainEqual(["a", 1])
      expect(result).toContainEqual(["b", 2])
      expect(result).toContainEqual(["c", 3])
    })
  })

  test.describe("tf_array_to_map()", () => {
    test("converts array to map by key function", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, tf_array_to_map } = window.__ELT__
        const arr = o([
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ])
        const map = arr.tf(tf_array_to_map((item: any) => item.id))
        const m = map.get()
        return { isMap: m instanceof Map, alice: m.get(1)?.name, bob: m.get(2)?.name }
      })
      expect(result.isMap).toBe(true)
      expect(result.alice).toBe("Alice")
      expect(result.bob).toBe("Bob")
    })
  })

  test.describe("tf_array_to_object()", () => {
    test("converts array to object by key function", async ({ page }) => {
      const result = await page.evaluate(() => {
        const { o, tf_array_to_object } = window.__ELT__
        const arr = o([
          { id: "a", value: 1 },
          { id: "b", value: 2 },
        ])
        const obj = arr.tf(tf_array_to_object((item: any) => item.id))
        const r = obj.get() as any
        return { a: r.a.value, b: r.b.value }
      })
      expect(result.a).toBe(1)
      expect(result.b).toBe(2)
    })
  })
})
