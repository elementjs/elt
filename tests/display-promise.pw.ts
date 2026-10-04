import { type Page, test, expect } from "./fixture"

// DisplayPromise (docs/md/verbs.md#displaypromise-a-promises-lifecycle): each arm shows on its own,
// in the order the arms were declared. The waiting arm shows while a promise resolves, the first one
// or a later one ; the resolved / rejected arm shows the last outcome, kept while a new promise
// resolves.

/** Mount a DisplayPromise with arms declared in `order`, drive it through `steps`, and record what shows. */
async function run(page: Page, order: string[], motion = false) {
  return page.evaluate(
    async ({ order, motion }) => {
      const { o, DisplayPromise, node_append, motion_enabled, $enter } = window.__ELT__
      motion_enabled(motion)
      const entered: string[] = []
      const p = (text: Parameters<typeof node_append>[1]) => {
        const e = document.createElement("p")
        node_append(e, text)
        $enter([{ opacity: 0 }, { opacity: 1 }])(e)
        $enter((n) => {
          entered.push(n.textContent ?? "")
        })(e)
        return e
      }
      const settle: { resolve?: (v: string) => void; reject?: (e: any) => void } = {}
      const next = () =>
        new Promise<string>((resolve, reject) => {
          settle.resolve = resolve
          settle.reject = reject
        })
      const o_promise = o(next())
      const d = DisplayPromise(o_promise)
      for (const arm of order) {
        if (arm === "waiting") d.WhileWaiting(() => p("waiting"))
        // The result arm stays in place across promises: it follows its value
        if (arm === "resolved") d.WhenResolved((o_v) => p(o_v.tf((v) => `value ${v}`)))
        if (arm === "rejected") d.UponRejection((o_e) => p(o_e.tf((e) => `error ${e}`)))
      }
      const c = document.createElement("div")
      node_append(c, d)
      node_append(document.body, c)
      const tick = () => new Promise((r) => setTimeout(r))
      const shown = () =>
        [...c.querySelectorAll("p")].filter((e) => !e.hasAttribute("e-leaving")).map((e) => e.textContent)
      const steps: Record<string, string[] | null> = { first: shown() }
      settle.resolve!("1")
      await tick()
      steps.resolved = shown()
      o_promise.set(next())
      await tick()
      steps.again = shown()
      settle.resolve!("2")
      await tick()
      steps.resolved_again = shown()
      o_promise.set(next())
      await tick()
      settle.reject!("bad")
      await tick()
      steps.rejected = shown()
      steps.entered = entered
      return steps
    },
    { order, motion },
  )
}

test.describe("DisplayPromise", () => {
  test("waiting shows for the first promise, and again next to the previous result for a new one (declared first: above)", async ({
    page,
  }) => {
    const r = await run(page, ["waiting", "resolved", "rejected"])
    expect(r.first).toEqual(["waiting"])
    expect(r.resolved).toEqual(["value 1"])
    expect(r.again).toEqual(["waiting", "value 1"])
    // The result arm stays and follows the new value
    expect(r.resolved_again).toEqual(["value 2"])
    expect(r.rejected).toEqual(["error bad"])
  })

  test("declared after the result arm, waiting shows below it", async ({ page }) => {
    const r = await run(page, ["resolved", "waiting", "rejected"])
    expect(r.again).toEqual(["value 1", "waiting"])
  })

  test("declared between the arms, waiting shows below the result and above an error", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { o, DisplayPromise, node_append } = window.__ELT__
      const p = (text: string) => {
        const e = document.createElement("p")
        e.textContent = text
        return e
      }
      let reject!: (e: any) => void
      const o_promise = o(new Promise<string>((_, rej) => (reject = rej)))
      const c = document.createElement("div")
      node_append(
        c,
        DisplayPromise(o_promise)
          .WhenResolved((o_v) => p(`value ${o_v.get()}`))
          .WhileWaiting(() => p("waiting"))
          .UponRejection((o_e) => p(`error ${o_e.get()}`)),
      )
      node_append(document.body, c)
      reject("bad")
      await new Promise((r) => setTimeout(r))
      o_promise.set(new Promise<string>(() => {}))
      await new Promise((r) => setTimeout(r))
      return [...c.querySelectorAll("p")].map((e) => e.textContent)
    })
    expect(r).toEqual(["waiting", "error bad"])
  })

  test("its changes are updates: waiting and outcomes enter, not on the first render", async ({ page }) => {
    const r = await run(page, ["waiting", "resolved", "rejected"], true)
    // value 1, then a waiting per new promise, then the error replacing the value
    expect(r.entered).toEqual(["value 1", "waiting", "waiting", "error bad"])
  })
})
