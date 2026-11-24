// Benchmark of `Repeat`'s reconciliation (the diff of a new list against the rendered rows), in the
// browser. Not a test: it prints the median time per operation of each case, like observable.bench.ts.
// `just bench` runs it in Chromium (chromium.ts). Only compare runs made one after the other.
import { node_append, node_remove, o, Repeat } from "../../src"

type Item = { id: number; label: string }

/** One case: `setup` renders the list and returns the operation that is timed, run `ops` times. */
type Case = { name: string; ops: number; setup: (o_lst: o.Observable<Item[]>) => () => void }

const items = (n: number, from = 0): Item[] =>
  Array.from({ length: n }, (_, i) => ({ id: from + i, label: `${from + i}` }))

function measure(c: Case, keyed: boolean) {
  const o_lst = o(items(1000))
  const host = document.createElement("div")
  const repeat = Repeat(o_lst, (o_item) => <span>{o_item.p("label")}</span>)
  if (keyed) repeat.withKeyFunction((it) => it.id)
  node_append(host, repeat)
  node_append(document.body, host)
  const step = c.setup(o_lst)
  for (let i = 0; i < c.ops; i++) step()
  const runs: number[] = []
  for (let r = 0; r < 7; r++) {
    const t0 = performance.now()
    for (let i = 0; i < c.ops; i++) step()
    runs.push(((performance.now() - t0) * 1e6) / c.ops)
  }
  node_remove(host)
  runs.sort((a, b) => a - b)
  return runs[3]!
}

const cases: Case[] = [
  {
    name: "edit one item of 1000",
    ops: 300,
    setup: (o_lst) => {
      let n = 0
      return () => {
        const lst = o_lst.get().slice()
        const k = n++ % lst.length
        lst[k] = { ...lst[k]!, label: `${n}` }
        o_lst.set(lst)
      }
    },
  },
  {
    name: "reverse 1000",
    ops: 50,
    setup: (o_lst) => () => o_lst.set(o_lst.get().slice().reverse()),
  },
  {
    name: "append and drop one of 1000",
    ops: 300,
    setup: (o_lst) => {
      let n = 1000
      return () => {
        const lst = o_lst.get()
        o_lst.set([...lst.slice(1), { id: n, label: `${n++}` }])
      }
    },
  },
  {
    name: "replace all 1000",
    ops: 50,
    setup: (o_lst) => {
      let n = 0
      return () => {
        n += 1000
        o_lst.set(items(1000, n))
      }
    },
  },
]

for (const keyed of [false, true]) {
  for (const c of cases) {
    const name = `Repeat ${keyed ? "keyed, " : ""}${c.name}`
    console.log(`${name.padEnd(48)} ${String(Math.round(measure(c, keyed))).padStart(9)} ns/op`)
  }
}
