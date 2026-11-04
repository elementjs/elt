import { expect, test } from "./fixture"

// `Repeat` brings its rows in line with the list from a snapshot of the DOM. A reconcile requested from outside a
// flush (the internal `reconcileView`, which `RepeatVirtual.setPosition` calls) must not be re-entered by the
// observers its own work triggers. These tests make such a reconcile create rows whose index observer writes the list
// or the window while the rows are being inserted: unless the observers wait for the reconcile to end, the write
// flushes at once and the reconcile it asks for runs inside the outer one (regression: it was skipped, and the DOM
// ended up out of sync with the list).

function mount() {
  const { o, Repeat, node_append, node_observe } = window.__ELT__
  const o_lst = o(["a", "b", "c", "d", "e"])
  const o_start = o(0)
  const o_end = o(2)
  const container = document.createElement("div")
  // Called with a row's index when the row is created; a test sets it to the write it wants to make
  const state = { on_row: null as null | ((i: number) => void) }
  const repeater = Repeat(o_lst, (item: any, idx: any) => {
    const span = document.createElement("span")
    node_append(span, item)
    node_observe(span, idx, (i: number) => state.on_row?.(i))
    return span
  })
    .ForView(o_start, o_end)
    .withKeyFunction((item: string) => item)
  node_append(container, repeater)
  node_append(document.body, container)
  const texts = () => Array.from(container.querySelectorAll("span")).map((s) => s.textContent)
  return { o_lst, o_start, o_end, repeater, state, texts }
}

declare global {
  interface Window {
    __mount_reentrancy__: typeof mount
  }
}

test.beforeEach(async ({ page }) => {
  await page.evaluate(`window.__mount_reentrancy__ = ${mount.toString()}`)
})

test.describe("Repeat re-entrant reconcile", () => {
  test("a list change made while rows are inserted by a direct reconcileView is not lost", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o_lst, o_start, o_end, repeater, state, texts } = window.__mount_reentrancy__()
      const before = texts()
      // Row "d" is created by the reconcile below; its index observer removes "e" from the list, which reconciles
      // the list again while the first reconcile is still running
      state.on_row = (i) => {
        if (i === 3) {
          state.on_row = null
          o_lst.set(["a", "b", "c", "d"])
        }
      }
      ;(repeater as any).reconcileView(0, 5)
      return { before, after: texts(), list: o_lst.get(), start: o_start.get(), end: o_end.get() }
    })
    expect(r.before).toEqual(["a", "b"])
    // Whatever the explicit window showed, the rows end up as the list restricted to the window the observables
    // hold: no row for "e", which is not in the list anymore
    expect(r.after).toEqual(r.list.slice(r.start, r.end))
  })

  test("a window change made while rows are inserted by a direct reconcileView is not lost", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o_end, repeater, state, texts } = window.__mount_reentrancy__()
      state.on_row = (i) => {
        if (i === 3) {
          state.on_row = null
          o_end.set(4)
        }
      }
      ;(repeater as any).reconcileView(0, 5)
      return { after: texts(), window_end: o_end.get() }
    })
    // The window observable now says [0, 4): the rows must follow it, as they would for any later window write
    expect(r.after).toEqual(["a", "b", "c", "d"].slice(0, r.window_end))
  })
})
