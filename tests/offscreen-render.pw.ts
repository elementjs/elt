import { test, expect } from "./fixture"

// Content shown through an observable (If, Switch, Repeat, an observable child, a derived
// attribute) is rendered as soon as it is built, while its tree is still offscreen, even when the
// observable is derived (`.tf`) and nobody watches it yet. Mounting the tree then renders nothing
// again: transforms only run a second time if a dependency changed in between.

test.describe("offscreen first render", () => {
  test("If, Switch and a Repeat over a derived list render before the tree is mounted (regression)", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      const { o, If, Switch, Repeat, node_append, node_remove } = window.__ELT__
      const o_flag = o(true)
      const o_mode = o("a")
      const o_list = o([1, 2, 3, 4])
      const root = document.createElement("div")
      node_append(
        root,
        If(o_flag, () => {
          const b = document.createElement("b")
          b.id = "then"
          return b
        }),
      )
      node_append(
        root,
        Switch(o_mode).Case("a", () => {
          const em = document.createElement("em")
          em.id = "case-a"
          return em
        }),
      )
      node_append(
        root,
        Repeat(
          o_list.tf((l) => l.filter((n) => n % 2 === 0)),
          (o_n) => {
            const li = document.createElement("li")
            node_append(li, o_n.tf(String))
            return li
          },
        ),
      )
      const before = {
        then_branch: root.querySelector("#then"),
        case_a: root.querySelector("#case-a"),
        items: [...root.querySelectorAll("li")].map((li) => li.textContent),
      }
      node_append(document.body, root)
      const out = {
        rendered_before: [before.then_branch != null, before.case_a != null],
        items_before: before.items,
        // Mounting reuses the nodes rendered offscreen
        same_after_mount: [
          root.querySelector("#then") === before.then_branch,
          root.querySelector("#case-a") === before.case_a,
        ],
      }
      // Still live after mounting
      o_flag.set(false)
      o_list.set([2, 6])
      const live = {
        then_gone: root.querySelector("#then") == null,
        items: [...root.querySelectorAll("li")].map((li) => li.textContent),
      }
      node_remove(root)
      return { ...out, live }
    })
    expect(r.rendered_before).toEqual([true, true])
    expect(r.items_before).toEqual(["2", "4"])
    expect(r.same_after_mount).toEqual([true, true])
    expect(r.live).toEqual({ then_gone: true, items: ["2", "6"] })
  })

  test("a transform runs once for build + mount, and again only if a dependency changed offscreen", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      const { o, If, node_append, node_remove } = window.__ELT__
      const counts = { inner: 0, outer: 0, render: 0 }
      const o_n = o(1)
      // A chain of two derived observables, neither watched by anything else
      const o_cond = o_n
        .tf((n) => {
          counts.inner++
          return n * 2
        })
        .tf((n) => {
          counts.outer++
          return n > 0
        })
      const build = () => {
        const root = document.createElement("div")
        node_append(
          root,
          If(o_cond, () => {
            counts.render++
            return document.createElement("b")
          }),
        )
        return root
      }

      const root = build()
      const after_build = { ...counts }
      node_append(document.body, root)
      const after_mount = { ...counts }
      node_remove(root)

      // A second If on the same chain, changed while offscreen: one more evaluation of the chain at
      // mount, no new render (same truthiness)
      const root2 = build()
      const after_build2 = { ...counts }
      o_n.set(5)
      node_append(document.body, root2)
      const after_mount2 = { ...counts }
      node_remove(root2)
      return { after_build, after_mount, after_build2, after_mount2 }
    })
    expect(r.after_build).toEqual({ inner: 1, outer: 1, render: 1 })
    expect(r.after_mount).toEqual({ inner: 1, outer: 1, render: 1 })
    // The chain kept its value from the first build: nothing changed since, so no new evaluation
    expect(r.after_build2).toEqual({ inner: 1, outer: 1, render: 2 })
    expect(r.after_mount2).toEqual({ inner: 2, outer: 2, render: 2 })
  })

  test("a branch that changed while offscreen is swapped when the tree is mounted", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, If, node_append, node_remove } = window.__ELT__
      const o_flag = o(true)
      const root = document.createElement("div")
      node_append(
        root,
        If(
          o_flag.tf((f) => f),
          () => document.createElement("b"),
          () => document.createElement("i"),
        ),
      )
      const before = root.firstElementChild?.tagName
      o_flag.set(false)
      const still_offscreen = root.firstElementChild?.tagName
      node_append(document.body, root)
      const mounted = root.firstElementChild?.tagName
      node_remove(root)
      return { before, still_offscreen, mounted }
    })
    // Offscreen nothing observes yet: the swap happens on mount
    expect(r).toEqual({ before: "B", still_offscreen: "B", mounted: "I" })
  })

  test("a tree that is never mounted registers nothing on its source observables", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, If, node_append } = window.__ELT__
      const o_src = o(1)
      const o_derived = o_src.tf((n) => n > 0)
      const root = document.createElement("div")
      node_append(
        root,
        If(o_derived, () => document.createElement("b")),
      )
      return {
        rendered: root.querySelector("b") != null,
        src_observed: o_src.isObserved(),
        derived_observed: o_derived.isObserved(),
      }
    })
    expect(r).toEqual({ rendered: true, src_observed: false, derived_observed: false })
  })

  test("a derived attribute, class and text are applied before mounting", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, node_append, node_remove } = window.__ELT__
      const o_n = o(3)
      const el = document.createElement("div")
      node_append(el, {
        title: o_n.tf((n) => `n=${n}`),
        class: o_n.tf((n) => (n > 2 ? "big" : "small")),
      } as any)
      node_append(
        el,
        o_n.tf((n) => `count ${n}`),
      )
      const before = { title: el.getAttribute("title"), cls: el.className, text: el.textContent }
      node_append(document.body, el)
      o_n.set(1)
      const live = { title: el.getAttribute("title"), cls: el.className, text: el.textContent }
      node_remove(el)
      return { before, live }
    })
    expect(r.before).toEqual({ title: "n=3", cls: "big", text: "count 3" })
    expect(r.live).toEqual({ title: "n=1", cls: "small", text: "count 1" })
  })

  test("DisplayPromise subscribes to its promise once across build and mount", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { o, DisplayPromise, node_append, node_remove } = window.__ELT__
      let thens = 0
      const { promise: p, resolve } = window.__ELT__.deferred<string>()
      const orig_then = p.then.bind(p)
      // biome-ignore lint/suspicious/noThenProperty: counts the subscriptions to the promise
      ;(p as any).then = (...args: any[]) => {
        thens++
        return orig_then(...args)
      }
      const root = document.createElement("div")
      node_append(
        root,
        DisplayPromise(o(p))
          .WhileWaiting(() => document.createElement("progress"))
          .WhenResolved((o_v) => {
            const b = document.createElement("b")
            b.textContent = o_v.get()
            return b
          }),
      )
      const waiting_before_mount = root.querySelector("progress") != null
      const thens_after_build = thens
      node_append(document.body, root)
      const thens_after_mount = thens
      resolve("done")
      await new Promise((r) => setTimeout(r))
      const shown = root.querySelector("b")?.textContent
      node_remove(root)
      return { waiting_before_mount, thens_after_build, thens_after_mount, shown }
    })
    expect(r.waiting_before_mount).toBe(true)
    expect(r.thens_after_mount).toBe(r.thens_after_build)
    expect(r.shown).toBe("done")
  })
})
