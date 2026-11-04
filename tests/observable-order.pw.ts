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
//   4. Fresh reads: an observer that reads another observable with `.get()` gets the value recomputed from scratch,
//      even when that observable is queued and not processed yet.

/**
 * A random dependency graph for the tests below, and what it must hold. Nodes `0..n_src-1` are sources; the others
 * combine 1 to 3 earlier nodes, so the graph is a DAG. `computes[i]` counts how many times node `i` was computed.
 * Runs in the page (injected below), from a seed so that a failure can be replayed.
 */
function make_graph(seed: number) {
  const { o } = window.__ELT__
  // mulberry32: a small seeded generator
  let t = seed >>> 0
  const rand = () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  const pick = (n: number) => Math.floor(rand() * n)
  const fresh = () => 1 + pick(100000)
  const n_src = 2 + pick(4)
  const n_der = 3 + pick(12)
  const nodes: any[] = []
  const parents: number[][] = []
  const computes: number[] = []
  const f = (id: number, vals: number[]) => vals.reduce((acc, v, k) => acc + v * (k + 3), id) % 100003
  for (let i = 0; i < n_src; i++) {
    nodes.push(o(fresh()))
    parents.push([])
    computes.push(0)
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
        computes[i]++
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
  return { nodes, computes, n_src, expected, pick, fresh }
}

declare global {
  interface Window {
    __make_graph__: typeof make_graph
  }
}

test.beforeEach(async ({ page }) => {
  await page.evaluate(`window.__make_graph__ = ${make_graph.toString()}`)
})

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

  test("a derived observable watched from inside an observer is computed once, from its parent's fresh value", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      const { o } = window.__ELT__
      const a = o(1)
      let parent_computes = 0
      let child_computes = 0
      const parent = o.combine([a] as const, ([x]) => {
        parent_computes++
        return x * 2
      })
      parent.addObserver(() => {})
      const child = o.combine([parent] as const, ([x]) => {
        child_computes++
        return x + 1
      })
      const seen: number[] = []
      // `a`'s observer runs before `parent` is processed: `parent` is queued, and stale, when `child` starts to watch it
      a.addObserver((v: number) => {
        if (v === 2) {
          child.addObserver((w: number) => {
            seen.push(w)
          })
        }
      })
      parent_computes = 0
      child_computes = 0

      a.set(2)
      return { parent_computes, child_computes, seen }
    })
    expect(r).toEqual({ parent_computes: 1, child_computes: 1, seen: [5] })
  })

  test("reading a queued derived observable from an observer gives its fresh value, not the stale one", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      const { o } = window.__ELT__
      const a = o(1)
      const d = o.combine([a] as const, ([x]) => x * 10)
      d.addObserver(() => {})
      let read: number | null = null
      // `a`'s observer runs before `d` is processed: `d` is queued, and has not been recomputed yet
      a.addObserver((v: number) => {
        if (v === 2) read = d.get()
      })
      a.set(2)
      return { read }
    })
    expect(r).toEqual({ read: 20 })
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
          // The trigger fires from the write below, not from the first call `addObserver` makes at once
          let armed = false
          let fired = false
          const seen: number[] = []
          for (let i = 0; i < nodes.length; i++) {
            nodes[i].addObserver((v: number) => {
              seen[i] = v
              if (v !== expected(i))
                failures.push(`${where}: node ${i} observed ${v}, from scratch it is ${expected(i)}`)
              const other = (i * 7 + seed) % nodes.length
              if (nodes[other].get() !== expected(other)) {
                failures.push(
                  `${where}: node ${i}'s observer read node ${other} as ${nodes[other].get()}, from scratch it is ${expected(other)}`,
                )
              }
              if (scenario === "write from an observer" && armed && !fired && i === trigger) {
                fired = true
                nodes[second_target].set(fresh())
              }
            })
          }
          computes.fill(0)
          for (let i = 0; i < nodes.length; i++) seen[i] = expected(i)

          armed = true
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
  // Observers that are removed, added, or retargeted while a wave is running (the first observer called does it, once).
  // The same invariants hold, plus:
  //   5. A removed observer is never called again, and an observable nobody watches anymore is not computed again.
  //   6. Nothing is left queued once the flush is over, and the next write flushes as usual.
  test("random dynamic observers: removed, added and retargeted from inside an observer", async ({ page }) => {
    const failures = await page.evaluate(() => {
      const { o } = window.__ELT__
      const scenarios = ["observers removed", "observers added", "proxy retargeted"] as const
      const failures: string[] = []

      for (let seed = 1; seed <= 300; seed++) {
        for (let sc = 0; sc < scenarios.length; sc++) {
          const scenario = scenarios[sc]
          const where = `${scenario}, seed ${seed}`
          const { nodes, computes, n_src, expected, pick, fresh } = window.__make_graph__(seed * 11 + sc)
          const n = nodes.length
          const handles: any[] = new Array(n).fill(null)
          const seen: (number | undefined)[] = new Array(n).fill(undefined)
          const removed: boolean[] = new Array(n).fill(false)
          const fail = (message: string) => failures.push(`${where}: ${message}`)

          // `action` runs once, from the observer of the `trigger` node
          // It fires from the write below, not from the first call `addObserver` makes at once
          const trigger = pick(n)
          let armed = false
          let fired = false
          let action = () => {}
          const observe = (i: number) => {
            handles[i] = nodes[i].addObserver((v: number) => {
              if (removed[i]) fail(`node ${i}'s observer was called after it was removed`)
              seen[i] = v
              if (v !== expected(i)) fail(`node ${i} observed ${v}, from scratch it is ${expected(i)}`)
              // Only a watched node: `.get()` on an unwatched one computes it, which is not what is measured below
              const other = (i * 7 + seed) % n
              if (nodes[other].is_watched && nodes[other].get() !== expected(other)) {
                fail(
                  `node ${i}'s observer read node ${other} as ${nodes[other].get()}, from scratch ${expected(other)}`,
                )
              }
              if (armed && !fired && i === trigger) {
                fired = true
                action()
              }
            })
          }

          // The proxy of the last scenario follows the node its holder holds
          const holder: any = new (o as any).Observable(nodes[pick(n)])
          const proxy: any = o.proxy(holder)
          let proxy_seen: number | undefined
          const proxy_target = () => nodes.indexOf(holder.get())

          const observed: boolean[] = nodes.map(
            (_, i) => scenario !== "observers added" || i === trigger || pick(2) === 0,
          )
          for (let i = 0; i < n; i++) if (observed[i]) observe(i)
          if (scenario === "proxy retargeted") {
            proxy.addObserver((v: number) => {
              proxy_seen = v
              if (v !== expected(proxy_target()))
                fail(`the proxy observed ${v}, its target holds ${expected(proxy_target())}`)
            })
          }
          computes.fill(0)
          for (let i = 0; i < n; i++) if (observed[i]) seen[i] = expected(i)

          // The action runs in the first write's wave, or in the second one's if the first never reached the trigger
          let wave = 1
          let action_wave = 0
          let computes_at_action: number[] = []
          if (scenario === "observers removed") {
            action = () => {
              action_wave = wave
              computes_at_action = computes.slice()
              for (let j = 0; j < n; j++) {
                if (pick(3) === 0) {
                  removed[j] = true
                  nodes[j].removeObserver(handles[j])
                }
              }
            }
          } else if (scenario === "observers added") {
            action = () => {
              action_wave = wave
              for (let j = 0; j < n; j++) {
                if (!observed[j] && pick(2) === 0) {
                  observed[j] = true
                  observe(j)
                }
              }
            }
          } else {
            action = () => holder.set(nodes[pick(n)])
          }

          armed = true
          nodes[pick(n_src)].set(fresh())

          // How many times each node was computed by the first write alone: `.get()` on an unwatched observable computes
          // it, and `settled` below reads every node
          const computes_by_first_write = computes.slice()
          const settled = (label: string) => {
            for (let i = 0; i < n; i++) {
              if (nodes[i].idx != null) fail(`${label}: node ${i} is still queued`)
              if (nodes[i].get() !== expected(i)) {
                fail(`${label}: node ${i} holds ${nodes[i].get()}, from scratch ${expected(i)}`)
              }
              if (observed[i] && !removed[i] && seen[i] !== expected(i)) {
                fail(`${label}: node ${i}'s observer last saw ${seen[i]}, from scratch ${expected(i)}`)
              }
            }
            if (scenario === "proxy retargeted") {
              if (proxy.get() !== expected(proxy_target())) fail(`${label}: the proxy holds ${proxy.get()}`)
              if (proxy_seen !== expected(proxy_target())) fail(`${label}: the proxy's observer last saw ${proxy_seen}`)
            }
          }
          settled("after the first write")
          if (scenario === "observers added") {
            for (let i = 0; i < n; i++) {
              if (observed[i] && seen[i] === undefined) fail(`node ${i}'s new observer was never called`)
              if (computes_by_first_write[i] > 1) fail(`node ${i} computed ${computes_by_first_write[i]} times (max 1)`)
            }
          }
          if (scenario === "observers removed" && action_wave === 1) {
            // Nobody watches these anymore: they were not computed after the observers went away
            for (let i = n_src; i < n; i++) {
              if (removed[i] && !nodes[i].is_watched && computes_by_first_write[i] !== computes_at_action[i]) {
                fail(
                  `node ${i} is unwatched but was computed ${computes_by_first_write[i] - computes_at_action[i]} more times`,
                )
              }
            }
          }

          // The queue still works: another write flushes, and what nobody watches is not computed by it
          const computes_before_second = computes.slice()
          wave = 2
          nodes[pick(n_src)].set(fresh())
          const computes_by_second_write = computes.slice()
          settled("after a second write")
          // What nobody watches was not computed by the second write, once the observers were gone
          const baseline =
            action_wave === 2 && scenario === "observers removed" ? computes_at_action : computes_before_second
          for (let i = n_src; i < n; i++) {
            if (
              scenario === "observers added" &&
              action_wave === 2 &&
              computes_by_second_write[i] - computes_before_second[i] > 1
            ) {
              fail(
                `node ${i} computed ${computes_by_second_write[i] - computes_before_second[i]} times in the second wave (max 1)`,
              )
            }
            if (!nodes[i].is_watched && computes_by_second_write[i] !== baseline[i]) {
              fail(
                `node ${i} is unwatched but was computed by a second write (observers ${nodes[i]._observers.real_size}, children ${nodes[i]._children.real_size}, queued ${nodes[i].idx})`,
              )
            }
          }
        }
      }
      return failures.slice(0, 6)
    })
    expect(failures).toEqual([])
  })
})
