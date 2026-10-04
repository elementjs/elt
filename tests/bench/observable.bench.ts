// Benchmark of the observable scheduling (setting an observable, the queue walk, calling the observers).
// Not a test: it asserts nothing, it prints the median time per operation of each case. Importing this
// module runs it and prints through `console.log`; `just bench` runs it in Bun (bun.ts) and in Chromium
// (chromium.ts). The timings depend on the machine and its load: only compare runs made one after the other.
import { o } from "../../src/observable/observable"

/** One case: `setup` builds the observables and returns the operation that is timed, run `ops` times. */
type Case = { name: string; ops: number; setup: () => () => void }

/** The median, in nanoseconds per operation, of 7 timed runs of `ops` operations, after one untimed run (warm-up). */
function measure(c: Case) {
  const step = c.setup()
  for (let i = 0; i < c.ops; i++) step()
  const runs: number[] = []
  for (let r = 0; r < 7; r++) {
    const t0 = performance.now()
    for (let i = 0; i < c.ops; i++) step()
    runs.push(((performance.now() - t0) * 1e6) / c.ops)
  }
  runs.sort((a, b) => a - b)
  return runs[3]!
}

/** The operation that sets `src` to a new number each time. */
function setter(src: o.Observable<number>) {
  let n = 0
  return () => src.set(++n)
}

/** One observable with `count` observers on it: each `set` calls all of them from the same queue entry. */
function observers(count: number) {
  const a = o(0)
  for (let i = 0; i < count; i++) a.addObserver(() => {})
  return setter(a)
}

/** One observable with `count` derived observables (`tf`), each with one observer: `count` queue entries per `set`. */
function fan_out(count: number) {
  const a = o(0)
  for (let i = 0; i < count; i++) a.tf((v) => v + i).addObserver(() => {})
  return setter(a)
}

/** `layers` diamonds stacked: each layer derives two observables from the one above and combines them. */
function diamonds(layers: number) {
  const src = o(0)
  let top: o.ReadonlyObservable<number> = src
  for (let i = 0; i < layers; i++) {
    const b = top.tf((v) => v + 1)
    const c = top.tf((v) => v + 2)
    top = o.combine([b, c], ([x, y]) => x + y)
  }
  top.addObserver(() => {})
  return setter(src)
}

/** An observable `a` with one observer, and a derived `d` that saw `churn` observers added then removed. */
function churned(churn: number) {
  const a = o(0)
  a.addObserver(() => {})
  const d = a.tf((v) => v)
  for (let i = 0; i < churn; i++) d.removeObserver(d.addObserver(() => {}))
  return { a, d }
}

const cases: Case[] = [
  { name: "1 observable, 1 observer", ops: 200000, setup: () => observers(1) },
  { name: "1 observable, 10 observers", ops: 100000, setup: () => observers(10) },
  { name: "1 observable, 100 observers", ops: 20000, setup: () => observers(100) },
  {
    name: "chain of 3 tf",
    ops: 200000,
    setup: () => {
      const a = o(0)
      a.tf((v) => v + 1)
        .tf((v) => v + 1)
        .tf((v) => v + 1)
        .addObserver(() => {})
      return setter(a)
    },
  },
  { name: "fan-out 10 tf", ops: 50000, setup: () => fan_out(10) },
  { name: "fan-out 100 tf", ops: 5000, setup: () => fan_out(100) },
  {
    name: "tree 3 levels x 5",
    ops: 5000,
    setup: () => {
      const a = o(0)
      const grow = (p: o.ReadonlyObservable<number>, depth: number) => {
        for (let i = 0; i < 5; i++) {
          const c = p.tf((v) => v + i)
          if (depth > 1) grow(c, depth - 1)
          else c.addObserver(() => {})
        }
      }
      grow(a, 3)
      return setter(a)
    },
  },
  { name: "1 diamond", ops: 100000, setup: () => diamonds(1) },
  { name: "3 diamonds", ops: 50000, setup: () => diamonds(3) },
  { name: "10 diamonds", ops: 20000, setup: () => diamonds(10) },
  { name: "14 diamonds", ops: 20000, setup: () => diamonds(14) },
  {
    name: "transaction of 5 sets, shared child",
    ops: 50000,
    setup: () => {
      const xs = [0, 1, 2, 3, 4].map(() => o(0))
      o.combine(xs, (v) => v.length).addObserver(() => {})
      let n = 0
      return () =>
        o.transaction(() => {
          n++
          for (const x of xs) x.set(n)
        })
    },
  },
  { name: "set after 100k observer churn on a derived", ops: 20000, setup: () => setter(churned(100000).a) },
  {
    name: "observer add+remove on a derived",
    ops: 100000,
    setup: () => {
      const { d } = churned(0)
      return () => d.removeObserver(d.addObserver(() => {}))
    },
  },
]

for (const c of cases) console.log(`${c.name.padEnd(44)} ${measure(c).toFixed(0).padStart(9)} ns/op`)
