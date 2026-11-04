import { expect, test } from "./fixture"

// The observable queue (`Queue.schedule` / `Queue.flush`) orders the observables that must be recomputed so that
// each one comes after everything it depends on, and recomputes it once per wave. These tests pin that down:
//
// - Fixed scenarios that read as examples (a diamond, a write made from inside an observer).
// - A randomized one that builds many random dependency graphs and checks, after every kind of write, three
//   invariants that no fixed example can cover alone. A failure names the seed and the scenario, which replay
//   the exact graph.
//
//   1. No glitch: whenever an observer is called, the value it receives is the one recomputed from scratch from
//      the current sources (an observable never shows a value built from a mix of old and new sources).
//   2. Bounded work: an observable is recomputed at most once per wave (a wave is one write, or one transaction;
//      a write made from inside an observer starts a second wave).
//   3. Convergence: at the end, every observable holds the value recomputed from scratch, and its observers
//      saw that value last.

test.describe("Observable queue ordering", () => {
  test("a diamond with a late source is recomputed once, after all its sources", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o } = window.__ELT__
      // d = b + c, b = a + s, c = a * 2. `transaction` writes `a` (queues a, b, c, d) then `s`, which is upstream of
      // the already queued `b` and `d`: they have to move behind `s`, and still be computed once.
      const a = o(1)
      const s = o(10)
      let computes = 0
      const b = o.combine([a, s] as const, ([x, y]) => {
        computes++
        return x + y
      })
      const c = o.combine([a] as const, ([x]) => {
        computes++
        return x * 2
      })
      const d = o.combine([b, c] as const, ([x, y]) => {
        computes++
        return x + y
      })
      const seen: number[] = []
      d.addObserver((v: number) => {
        seen.push(v)
      })
      computes = 0
      seen.length = 0

      o.transaction(() => {
        a.set(2)
        s.set(20)
      })
      return { computes, seen }
    })
    expect(r).toEqual({ computes: 3, seen: [26] })
  })

  test("a write made from an observer, upstream of unprocessed observables, does not make them compute twice", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      const { o } = window.__ELT__
      const a = o(1)
      const s = o(10)
      let computes = 0
      const b = o.combine([a, s] as const, ([x, y]) => {
        computes++
        return x + y
      })
      const c = o.combine([a] as const, ([x]) => {
        computes++
        return x * 2
      })
      const d = o.combine([b, c] as const, ([x, y]) => {
        computes++
        return x + y
      })
      const seen: number[] = []
      d.addObserver((v: number) => {
        seen.push(v)
      })
      // `a`'s observer runs before `b`, `c` and `d` are processed: writing `s` there moves `b` and `d` behind it
      a.addObserver((v: number) => {
        if (v === 5) s.set(100)
      })
      computes = 0
      seen.length = 0

      a.set(5)
      return { computes, seen }
    })
    // (5 + 100) + 10: `d` never shows the intermediate (5 + 10) + 10
    expect(r).toEqual({ computes: 3, seen: [115] })
  })

  test("random dependency graphs: no glitch, one computation per wave, convergence", async ({ page }) => {
    const failures = await page.evaluate(() => {
      const { o } = window.__ELT__

      // mulberry32: a small seeded generator, so that a failure can be replayed from its seed
      function rng(seed: number) {
        let t = seed >>> 0
        return () => {
          t = (t + 0x6d2b79f5) >>> 0
          let r = Math.imul(t ^ (t >>> 15), 1 | t)
          r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
          return ((r ^ (r >>> 14)) >>> 0) / 4294967296
        }
      }

      const scenarios = ["single write", "transaction", "write from an observer"] as const
      const failures: string[] = []

      for (let seed = 1; seed <= 400; seed++) {
        for (let sc = 0; sc < scenarios.length; sc++) {
          const scenario = scenarios[sc]
          const where = `${scenario}, seed ${seed}`
          const rand = rng(seed * 7 + sc)
          const pick = (n: number) => Math.floor(rand() * n)
          const fresh = () => 1 + pick(100000)

          // Nodes 0..n_src-1 are sources; the others derive from 1 to 3 earlier nodes, so the graph is a DAG
          const n_src = 2 + pick(4)
          const n_der = 3 + pick(12)
          const nodes: any[] = []
          const parents: number[][] = []
          const computes: number[] = []
          const f = (id: number, vals: number[]) => vals.reduce((acc, v, k) => acc + v * (k + 3), id) % 100003

          for (let i = 0; i < n_src; i++) {
            nodes.push(o(fresh()))
            parents.push([])
          }
          for (let i = n_src; i < n_src + n_der; i++) {
            const ps: number[] = []
            const wanted = Math.min(i, 1 + pick(3))
            while (ps.length < wanted) {
              const p = pick(i)
              if (!ps.includes(p)) ps.push(p)
            }
            parents.push(ps)
            computes.push(0)
            nodes.push(
              o.combine(ps.map((p) => nodes[p]) as any, (vals: number[]) => {
                computes[i - n_src]++
                return f(i, vals)
              }),
            )
          }

          // What node `i` must hold, recomputed from the current value of the sources only
          const expected = (i: number, memo = new Map<number, number>()): number => {
            if (i < n_src) return nodes[i].get()
            let v = memo.get(i)
            if (v === undefined) {
              v = f(
                i,
                parents[i].map((p) => expected(p, memo)),
              )
              memo.set(i, v)
            }
            return v
          }

          // `trigger` writes `second_target` once, when its observer is called: the second wave
          const trigger = pick(n_src + n_der)
          const second_target = pick(n_src)
          let fired = false
          const seen: number[] = []
          for (let i = 0; i < nodes.length; i++) {
            nodes[i].addObserver((v: number) => {
              seen[i] = v
              if (v !== expected(i))
                failures.push(`${where}: node ${i} observed ${v}, from scratch it is ${expected(i)}`)
              if (scenario === "write from an observer" && !fired && i === trigger) {
                fired = true
                nodes[second_target].set(fresh())
              }
            })
          }
          computes.fill(0)
          for (let i = 0; i < nodes.length; i++) seen[i] = expected(i)

          if (scenario === "transaction") {
            o.transaction(() => {
              for (let k = 1 + pick(n_src); k > 0; k--) nodes[pick(n_src)].set(fresh())
            })
          } else {
            nodes[pick(n_src)].set(fresh())
          }

          const max_computes = scenario === "write from an observer" ? 2 : 1
          for (let i = 0; i < computes.length; i++) {
            if (computes[i] > max_computes) {
              failures.push(`${where}: node ${i + n_src} computed ${computes[i]} times (max ${max_computes})`)
            }
          }
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].get() !== expected(i))
              failures.push(`${where}: node ${i} holds ${nodes[i].get()}, from scratch it is ${expected(i)}`)
            if (seen[i] !== expected(i))
              failures.push(`${where}: node ${i}'s observer last saw ${seen[i]}, from scratch it is ${expected(i)}`)
          }
        }
      }
      return failures.slice(0, 5)
    })
    expect(failures).toEqual([])
  })
})
