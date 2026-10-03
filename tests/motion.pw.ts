import { test, expect } from "@playwright/test"

// Leaving (docs/md/motion.md): nodes with leave hooks stay in the page while their hooks run, every
// other removal is instant and synchronous. The harness turns motion off ; these tests turn it on.

declare global {
  interface Window {
    __motion__: {
      /** A live container holding one `div` per id (20px tall each), with `style` on the container. */
      mount: (ids: string[], style?: string) => HTMLElement
      /** A promise settled from outside, recording whether it is still pending. */
      deferred: () => { promise: Promise<void>; resolve: () => void; reject: () => void }
      tick: () => Promise<void>
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
  await page.evaluate(() => {
    const { node_append, motion_enabled } = window.__ELT__
    motion_enabled(true)
    document.body.innerHTML = ""
    window.__motion__ = {
      mount(ids, style = "") {
        const c = document.createElement("div")
        c.setAttribute("style", style)
        for (const id of ids) {
          const d = document.createElement("div")
          d.id = id
          d.style.height = "20px"
          d.textContent = id
          c.append(d)
        }
        node_append(document.body, c)
        return c
      },
      deferred() {
        let resolve!: () => void
        let reject!: () => void
        const promise = new Promise<void>((res, rej) => {
          resolve = res
          reject = rej
        })
        return { promise, resolve, reject }
      },
      tick: () => new Promise((r) => setTimeout(r)),
    }
  })
})

test.describe("leaving", () => {
  test("a node without a leave hook, or whose hook returns nothing, is removed in the same call", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { node_remove, node_on_leave, node_is_observing, $observe, o } = window.__ELT__
      const c = window.__motion__.mount(["a", "b"])
      const a = c.querySelector("#a") as HTMLElement
      const b = c.querySelector("#b") as HTMLElement
      $observe(o(0), () => {})(b)
      let observing_in_hook: boolean | null = null
      node_on_leave(b, (n) => {
        observing_in_hook = node_is_observing(n)
      })
      node_remove(a)
      node_remove(b)
      return {
        left: c.children.length,
        observing_in_hook,
        inert: b.hasAttribute("inert"),
        leaving: b.hasAttribute("e-leaving"),
      }
    })
    // The hook ran on an already disconnected node
    expect(r).toEqual({ left: 0, observing_in_hook: false, inert: false, leaving: false })
  })

  test("a hook returning a promise keeps the node, disconnected, inert and marked, until it settles", async ({
    page,
  }) => {
    const r = await page.evaluate(async () => {
      const { node_remove, node_on_leave, node_is_observing, node_is_connected, $observe, o } = window.__ELT__
      const c = window.__motion__.mount(["a"])
      const a = c.querySelector("#a") as HTMLElement
      $observe(o(0), () => {})(a)
      const d = window.__motion__.deferred()
      node_on_leave(a, () => d.promise)
      node_remove(a)
      const during = {
        in_page: a.parentNode === c,
        observing: node_is_observing(a),
        connected: node_is_connected(a),
        attrs: [a.hasAttribute("e-leaving"), a.hasAttribute("inert")],
      }
      await window.__motion__.tick()
      const before_settle = a.parentNode === c
      d.resolve()
      await window.__motion__.tick()
      return { during, before_settle, after: a.parentNode === c }
    })
    expect(r.during).toEqual({ in_page: true, observing: false, connected: false, attrs: [true, true] })
    expect(r.before_settle).toBe(true)
    expect(r.after).toBe(false)
  })

  test("a rejected promise removes the node ; a throwing hook removes it at once", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { node_remove, node_on_leave } = window.__ELT__
      const c = window.__motion__.mount(["a", "b"])
      const a = c.querySelector("#a") as HTMLElement
      const b = c.querySelector("#b") as HTMLElement
      const d = window.__motion__.deferred()
      node_on_leave(a, () => d.promise)
      node_on_leave(b, () => {
        throw new Error("boom")
      })
      node_remove(a)
      node_remove(b)
      const b_at_once = b.parentNode == null
      d.reject()
      await window.__motion__.tick()
      return { b_at_once, a_removed: a.parentNode == null }
    })
    expect(r).toEqual({ b_at_once: true, a_removed: true })
  })

  test("several hooks: the node waits for all their promises", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { node_remove, node_on_leave } = window.__ELT__
      const c = window.__motion__.mount(["a"])
      const a = c.querySelector("#a") as HTMLElement
      const d1 = window.__motion__.deferred()
      const d2 = window.__motion__.deferred()
      node_on_leave(a, () => d1.promise)
      node_on_leave(a, () => d2.promise)
      node_on_leave(a, () => {})
      node_remove(a)
      d1.resolve()
      await window.__motion__.tick()
      const after_first = a.parentNode === c
      d2.resolve()
      await window.__motion__.tick()
      return { after_first, after_both: a.parentNode === c }
    })
    expect(r).toEqual({ after_first: true, after_both: false })
  })

  test("only the removed nodes run their hooks, not their descendants ; detached nodes never do", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { node_remove, node_on_leave, node_append } = window.__ELT__
      const c = window.__motion__.mount(["a"])
      const a = c.querySelector("#a") as HTMLElement
      const inner = document.createElement("span")
      node_append(a, inner)
      const calls: string[] = []
      node_on_leave(inner, () => {
        calls.push("inner")
        return new Promise(() => {})
      })
      node_remove(a)
      const detached = document.createElement("div")
      node_on_leave(detached, () => {
        calls.push("detached")
        return new Promise(() => {})
      })
      const holder = document.createElement("div")
      node_append(holder, detached)
      node_remove(detached)
      return { calls, a_gone: a.parentNode == null, detached_gone: detached.parentNode == null }
    })
    expect(r).toEqual({ calls: [], a_gone: true, detached_gone: true })
  })

  test("with motion off, hooks don't run and removal is instant", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { node_remove, node_on_leave, motion_enabled } = window.__ELT__
      const c = window.__motion__.mount(["a"])
      const a = c.querySelector("#a") as HTMLElement
      let called = false
      node_on_leave(a, () => {
        called = true
        return new Promise(() => {})
      })
      motion_enabled(false)
      node_remove(a)
      motion_enabled(true)
      return { called, gone: a.parentNode == null }
    })
    expect(r).toEqual({ called: false, gone: true })
  })

  test("a node without a box is removed at once, without running its hook", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { node_remove, node_on_leave } = window.__ELT__
      const c = window.__motion__.mount(["a", "b"])
      const a = c.querySelector("#a") as HTMLElement
      const b = c.querySelector("#b") as HTMLElement
      a.style.display = "none"
      b.style.display = "contents"
      let called = 0
      for (const n of [a, b])
        node_on_leave(n, () => {
          called++
          return new Promise(() => {})
        })
      node_remove(a)
      node_remove(b)
      return { called, left: c.childNodes.length }
    })
    expect(r).toEqual({ called: 0, left: 0 })
  })

  test("a range keeps its leaving nodes and removes everything else", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { node_remove_range, node_on_leave } = window.__ELT__
      const c = window.__motion__.mount(["a", "b", "c", "d", "e"])
      const [, b, , d] = [...c.children] as HTMLElement[]
      for (const n of [b, d]) node_on_leave(n, () => new Promise(() => {}))
      node_remove_range(c.children[0], c.children[4])
      return [...c.children].map((e) => e.id)
    })
    expect(r).toEqual(["b", "d"])
  })
})

test.describe("condemned leaving nodes", () => {
  test("removed again (an If flipping twice), a leaving node goes at once", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, If, node_append, node_on_leave } = window.__ELT__
      const c = window.__motion__.mount([])
      const o_flag = o(true)
      const mk = (id: string) => {
        const el = document.createElement("b")
        el.id = id
        el.textContent = id
        node_on_leave(el, () => new Promise(() => {}))
        return el
      }
      node_append(
        c,
        If(
          o_flag,
          () => mk("then"),
          () => mk("else"),
        ),
      )
      o_flag.set(false)
      const after_one = [...c.querySelectorAll("b")].map((b) => `${b.id}${b.hasAttribute("e-leaving") ? "*" : ""}`)
      o_flag.set(true)
      const after_two = [...c.querySelectorAll("b")].map((b) => `${b.id}${b.hasAttribute("e-leaving") ? "*" : ""}`)
      return { after_one, after_two }
    })
    // The new branch is inserted at once, before the leaving one ; the second flip cuts the first exit.
    expect(r.after_one).toEqual(["else", "then*"])
    expect(r.after_two).toEqual(["then", "else*"])
  })

  test("a move never carries a leaving node: it is removed", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { node_remove, node_move_range, node_on_leave } = window.__ELT__
      const c = window.__motion__.mount(["a", "b", "c"])
      const other = window.__motion__.mount([])
      const [a, b, cc] = [...c.children] as HTMLElement[]
      node_on_leave(b, () => new Promise(() => {}))
      node_remove(b)
      node_move_range(a, cc, other, null)
      return { moved: [...other.children].map((e) => e.id), left: c.children.length, b_gone: b.parentNode == null }
    })
    expect(r).toEqual({ moved: ["a", "c"], left: 0, b_gone: true })
  })

  test("put back in the page with its ancestor, a leaving node is removed and never reconnected", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { node_remove, node_append, node_on_leave, node_is_observing, $observe, o } = window.__ELT__
      const c = window.__motion__.mount(["a", "b"])
      const b = c.querySelector("#b") as HTMLElement
      $observe(o(0), () => {})(b)
      const d = window.__motion__.deferred()
      node_on_leave(b, () => d.promise)
      node_remove(b)
      node_remove(c)
      node_append(document.body, c)
      const out = {
        b_gone: b.parentNode == null,
        b_observing: node_is_observing(b),
        ids: [...c.children].map((e) => e.id),
      }
      // Its final removal, after the cut, does nothing
      d.resolve()
      await window.__motion__.tick()
      return out
    })
    expect(r).toEqual({ b_gone: true, b_observing: false, ids: ["a"] })
  })

  test("a comment holder whose content is only leaving nodes has no content", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { CommentHolder, node_append, node_on_leave } = window.__ELT__
      const c = window.__motion__.mount([])
      const holder = new CommentHolder("holder")
      node_append(c, holder)
      const el = document.createElement("b")
      el.textContent = "x"
      node_on_leave(el, () => new Promise(() => {}))
      holder.updateRenderable(el)
      const before = holder.hasContent
      holder.empty()
      return { before, after: holder.hasContent, still_there: el.parentNode === c }
    })
    expect(r).toEqual({ before: true, after: false, still_there: true })
  })
})

test.describe("floating", () => {
  for (const [name, wrapper] of [
    ["in a plain container", ""],
    ["under a transformed ancestor", "transform: translate(13px, 7px)"],
    ["in a positioned container", "position: relative; margin: 11px"],
  ] as const) {
    test(`the page lays out as without the node, which stays where it was (${name})`, async ({ page }) => {
      const r = await page.evaluate((wrapper) => {
        const { node_remove, node_on_leave } = window.__ELT__
        const outer = window.__motion__.mount([], wrapper)
        const c = document.createElement("div")
        c.style.padding = "5px"
        for (const id of ["a", "b", "c"]) {
          const d = document.createElement("div")
          d.id = id
          d.style.height = "20px"
          d.style.margin = "3px"
          c.append(d)
        }
        window.__ELT__.node_append(outer, c)
        const b = c.querySelector("#b") as HTMLElement
        const cc = c.querySelector("#c") as HTMLElement
        const rect = (e: Element) => {
          const r = e.getBoundingClientRect()
          return [r.left, r.top, r.width, r.height]
        }
        const b_before = rect(b)
        const c_target = rect(b) // c will take b's place
        node_on_leave(b, () => new Promise(() => {}))
        node_remove(b)
        return { b_before, b_after: rect(b), c_target, c_after: rect(cc), position: b.style.position }
      }, wrapper)
      expect(r.position).toBe("absolute")
      expect(r.b_after).toEqual(r.b_before)
      expect(r.c_after).toEqual(r.c_target)
    })
  }

  test("flow: true keeps the node's space until it is removed", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { node_remove, node_on_leave } = window.__ELT__
      const c = window.__motion__.mount(["a", "b", "c"])
      const b = c.querySelector("#b") as HTMLElement
      const cc = c.querySelector("#c") as HTMLElement
      const top = cc.offsetTop
      const d = window.__motion__.deferred()
      node_on_leave(b, () => d.promise, { flow: true })
      node_remove(b)
      const during = cc.offsetTop
      d.resolve()
      await window.__motion__.tick()
      return { kept: during === top, after: cc.offsetTop === top - 20, position: b.style.position }
    })
    expect(r).toEqual({ kept: true, after: true, position: "" })
  })

  test("a table row stays in flow", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { node_remove, node_on_leave, node_append } = window.__ELT__
      const table = document.createElement("table")
      table.innerHTML = "<tbody><tr id=r1><td>1</td></tr><tr id=r2><td>2</td></tr><tr id=r3><td>3</td></tr></tbody>"
      node_append(document.body, table)
      const r2 = table.querySelector("#r2") as HTMLElement
      const r3 = table.querySelector("#r3") as HTMLElement
      const top = r3.offsetTop
      node_on_leave(r2, () => new Promise(() => {}))
      node_remove(r2)
      return { position: r2.style.position, r3_kept: r3.offsetTop === top }
    })
    expect(r).toEqual({ position: "", r3_kept: true })
  })

  test("a hook that returns nothing leaves the node's inline style as it was", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { node_remove, node_on_leave } = window.__ELT__
      const c = window.__motion__.mount(["a"])
      const a = c.querySelector("#a") as HTMLElement
      a.style.color = "red"
      const before = a.style.cssText
      node_on_leave(a, () => {})
      node_remove(a)
      return { same: a.style.cssText === before, gone: a.parentNode == null }
    })
    expect(r).toEqual({ same: true, gone: true })
  })
})

test.describe("Repeat", () => {
  test("a removed item with a leave hook floats out ; the others take their final place at once", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, Repeat, node_append, node_on_leave } = window.__ELT__
      const c = window.__motion__.mount([])
      const o_list = o(["a", "b", "c"])
      node_append(
        c,
        Repeat(o_list, (o_item) => {
          const d = document.createElement("div")
          d.id = o_item.get()
          d.style.height = "20px"
          node_on_leave(d, () => new Promise(() => {}))
          return d
        }).withKeyFunction((s: string) => s),
      )
      const c_el = c.querySelector("#c") as HTMLElement
      const b_top = (c.querySelector("#b") as HTMLElement).getBoundingClientRect().top
      o_list.set(["a", "c"])
      const leaving = [...c.querySelectorAll("[e-leaving]")].map((e) => e.id)
      const c_moved_up = c_el.getBoundingClientRect().top === b_top
      // Further updates leave the leaving item alone
      o_list.set(["c", "a", "d"])
      const order = [...c.children].filter((e) => !e.hasAttribute("e-leaving")).map((e) => e.id)
      return { leaving, c_moved_up, order, b_still_there: c.querySelector("#b") != null }
    })
    expect(r).toEqual({ leaving: ["b"], c_moved_up: true, order: ["c", "a", "d"], b_still_there: true })
  })
})

test.describe("entering", () => {
  // Each test records which ids had their enter hook run.
  test("a tree built offscreen then mounted: only its root enters", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, If, Switch, Repeat, node_append, node_on_enter } = window.__ELT__
      const entered: string[] = []
      const mk = (tag: string, id: string) => {
        const el = document.createElement(tag)
        el.id = id
        node_on_enter(el, () => entered.push(id))
        return el
      }
      const root = mk("div", "root")
      node_append(
        root,
        If(o(true), () => mk("b", "then")),
      )
      node_append(
        root,
        Switch(o("x")).Case("x", () => mk("em", "case")),
      )
      node_append(
        root,
        Repeat(
          o(["a", "b"]).tf((l) => l),
          (o_s) => mk("li", o_s.get()),
        ),
      )
      node_append(document.body, root)
      return entered
    })
    expect(r).toEqual(["root"])
  })

  test("updates enter: an If / Switch branch, new Repeat items (not moved ones), a resolved promise", async ({
    page,
  }) => {
    const r = await page.evaluate(async () => {
      const { o, If, Switch, Repeat, node_append, node_on_enter } = window.__ELT__
      const entered: string[] = []
      const mk = (tag: string, id: string) => {
        const el = document.createElement(tag)
        el.id = id
        node_on_enter(el, () => entered.push(id))
        return el
      }
      const o_flag = o(true)
      const o_mode = o("x")
      const o_list = o(["a", "b"])
      let resolve!: (n: Node) => void
      const root = document.createElement("div")
      node_append(
        root,
        If(
          o_flag,
          () => mk("b", "then"),
          () => mk("i", "else"),
        ),
      )
      node_append(
        root,
        Switch(o_mode)
          .Case("x", () => mk("em", "x"))
          .Case("y", () => mk("em", "y")),
      )
      node_append(
        root,
        Repeat(o_list, (o_s) => mk("li", o_s.get())).withKeyFunction((s: string) => s),
      )
      node_append(root, new Promise<Node>((res) => (resolve = res)) as any)
      node_append(document.body, root)
      const steps: Record<string, string[]> = {}
      const step = (name: string, fn: () => void) => {
        entered.length = 0
        fn()
        steps[name] = [...entered]
      }
      step("if", () => o_flag.set(false))
      step("switch", () => o_mode.set("y"))
      step("repeat add", () => o_list.set(["a", "b", "c", "d"]))
      step("repeat reorder", () => o_list.set(["d", "c", "b", "a"]))
      entered.length = 0
      resolve(mk("p", "resolved"))
      await new Promise((r) => setTimeout(r))
      steps.promise = [...entered]
      return steps
    })
    expect(r).toEqual({
      if: ["else"],
      switch: ["y"],
      "repeat add": ["c", "d"],
      "repeat reorder": [],
      promise: ["resolved"],
    })
  })

  test("each top-level node of an inserted fragment enters, not their children", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, If, node_append, node_on_enter } = window.__ELT__
      const entered: string[] = []
      const mk = (id: string) => {
        const el = document.createElement("b")
        el.id = id
        node_on_enter(el, () => entered.push(id))
        return el
      }
      const o_flag = o(false)
      const c = window.__motion__.mount([])
      node_append(
        c,
        If(o_flag, () => {
          const f = document.createDocumentFragment()
          const first = mk("f1")
          first.append(mk("child"))
          f.append(first, mk("f2"))
          return f
        }),
      )
      o_flag.set(true)
      return entered
    })
    expect(r).toEqual(["f1", "f2"])
  })

  test("a verb appended directly into a live parent: its first content enters", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, Repeat, node_append, node_on_enter } = window.__ELT__
      const entered: string[] = []
      const c = window.__motion__.mount([])
      node_append(
        c,
        Repeat(o(["p", "q"]), (o_s) => {
          const li = document.createElement("li")
          node_on_enter(li, () => entered.push(o_s.get()))
          return li
        }),
      )
      return entered
    })
    expect(r).toEqual(["p", "q"])
  })

  test("nothing enters into a detached parent, through raw DOM calls, or while motion is off", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { node_append, node_on_enter, motion_enabled } = window.__ELT__
      const entered: string[] = []
      const mk = (id: string) => {
        const el = document.createElement("b")
        node_on_enter(el, () => entered.push(id))
        return el
      }
      node_append(document.createElement("div"), mk("detached"))
      document.body.append(mk("raw"))
      motion_enabled(false)
      node_append(document.body, mk("off"))
      motion_enabled(true)
      return entered
    })
    expect(r).toEqual([])
  })

  test("always: runs on every connection, including with an ancestor, never on moves", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { node_append, node_remove, node_move_range, node_on_enter } = window.__ELT__
      let count = 0
      const root = document.createElement("div")
      const b = document.createElement("b")
      node_on_enter(b, () => count++, { always: true })
      node_append(root, b)
      node_append(document.body, root)
      const with_ancestor = count
      const other = window.__motion__.mount([])
      node_move_range(b, b, other, null)
      const after_move = count
      // b now lives in `other` : remounting it reconnects b
      node_remove(other)
      node_append(document.body, other)
      return { with_ancestor, after_move, after_remount: count }
    })
    expect(r).toEqual({ with_ancestor: 1, after_move: 1, after_remount: 2 })
  })

  test("a leaving node put back with node_append is removed and does not enter", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { node_append, node_remove, node_on_enter, node_on_leave } = window.__ELT__
      const c = window.__motion__.mount(["a"])
      const a = c.querySelector("#a") as HTMLElement
      let entered = 0
      node_on_enter(a, () => entered++)
      node_on_leave(a, () => new Promise(() => {}))
      node_remove(a)
      node_append(c, a)
      return { entered, gone: a.parentNode == null }
    })
    expect(r).toEqual({ entered: 0, gone: true })
  })
})

test.describe("$enter / $leave", () => {
  test("$leave() plays the default leave motion, then the node is removed", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { $leave, motion_defaults, node_remove } = window.__ELT__
      motion_defaults.leave.duration = 40
      const c = window.__motion__.mount(["a"])
      const a = c.querySelector("#a") as HTMLElement
      $leave()(a)
      node_remove(a)
      const anims = a.getAnimations()
      const during = {
        count: anims.length,
        duration: (anims[0]?.effect as KeyframeEffect | undefined)?.getTiming().duration,
        props: (anims[0]?.effect as KeyframeEffect | undefined)?.getKeyframes().map((k) => k.opacity),
        in_page: a.parentNode === c,
      }
      await new Promise((r) => setTimeout(r, 150))
      return { during, after: a.parentNode === c }
    })
    // A single keyframe: the exit starts from the node's current opacity
    expect(r.during).toEqual({ count: 1, duration: 40, props: ["0"], in_page: true })
    expect(r.after).toBe(false)
  })

  test("keyframes take the default duration and easing ; a spec its own ; a function decides", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { $leave, motion_defaults, node_remove } = window.__ELT__
      motion_defaults.leave.duration = 30
      motion_defaults.leave.easing = "linear"
      const c = window.__motion__.mount(["kf", "spec", "fn"])
      const [kf, spec, fn] = [...c.children] as HTMLElement[]
      $leave([{ opacity: 0.5 }, { opacity: 0 }])(kf)
      $leave({ keyframes: [{ opacity: 0 }], duration: 60, easing: "ease-in" })(spec)
      let resolve!: () => void
      $leave(() => new Promise<void>((r) => (resolve = r)))(fn)
      for (const n of [kf, spec, fn]) node_remove(n)
      const timing = (n: Element) => {
        const t = (n.getAnimations()[0]?.effect as KeyframeEffect | undefined)?.getTiming()
        return t ? [t.duration, t.easing] : null
      }
      const timings = { kf: timing(kf), spec: timing(spec), fn: timing(fn) }
      await new Promise((r) => setTimeout(r, 200))
      const after_200 = [...c.children].map((e) => e.id)
      resolve()
      await new Promise((r) => setTimeout(r))
      return { timings, after_200, after_resolve: c.children.length }
    })
    expect(r.timings).toEqual({ kf: [30, "linear"], spec: [60, "ease-in"], fn: null })
    expect(r.after_200).toEqual(["fn"])
    expect(r.after_resolve).toBe(0)
  })

  test("$enter plays on an update, not on the first render of a mounted tree", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { $enter, o, If, node_append } = window.__ELT__
      const o_flag = o(true)
      const root = document.createElement("div")
      const mk = (id: string) => {
        const el = document.createElement("b")
        el.id = id
        $enter({ keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: 500 })(el)
        return el
      }
      node_append(
        root,
        If(
          o_flag,
          () => mk("then"),
          () => mk("else"),
        ),
      )
      node_append(document.body, root)
      const first = root.querySelector("#then")!.getAnimations().length
      o_flag.set(false)
      const update = root.querySelector("#else")!.getAnimations().length
      return { first, update }
    })
    expect(r).toEqual({ first: 0, update: 1 })
  })

  test("reduced motion: movement dropped, fades kept ; `reduced` keyframes used ; null and nothing left are instant", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      const { $enter, $leave, motion_reduced, node_append, node_remove } = window.__ELT__
      motion_reduced(true)
      const c = window.__motion__.mount(["slide", "only_move", "none", "custom"])
      const [slide, only_move, none, custom] = [...c.children] as HTMLElement[]
      $leave({ keyframes: [{ opacity: 0, transform: "translateY(8px)" }], duration: 500 })(slide)
      $leave({ keyframes: [{ transform: "translateY(8px)" }], duration: 500 })(only_move)
      $leave({ keyframes: [{ opacity: 0 }], duration: 500, reduced: null })(none)
      for (const n of [slide, only_move, none]) node_remove(n)
      const entering = document.createElement("i")
      $enter({
        keyframes: [{ transform: "scale(0)" }, { transform: "none" }],
        reduced: [{ color: "red" }, { color: "blue" }],
      })(entering)
      node_append(custom, entering)
      const kfs = (n: Element) =>
        (n.getAnimations()[0]?.effect as KeyframeEffect | undefined)?.getKeyframes().map((k) =>
          Object.keys(k)
            .filter((x) => !["offset", "easing", "composite", "computedOffset"].includes(x))
            .sort()
            .join(","),
        )
      return {
        slide: { in_page: slide.parentNode === c, kfs: kfs(slide) },
        only_move: only_move.parentNode === c,
        none: none.parentNode === c,
        custom: kfs(entering),
      }
    })
    expect(r.slide).toEqual({ in_page: true, kfs: ["opacity"] })
    expect(r.only_move).toBe(false)
    expect(r.none).toBe(false)
    expect(r.custom).toEqual(["color", "color"])
  })

  test("motion_reduced(null) follows the user's setting", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    const r = await page.evaluate(() => {
      const { $leave, node_remove, motion_is_reduced } = window.__ELT__
      const c = window.__motion__.mount(["a"])
      const a = c.querySelector("#a") as HTMLElement
      $leave({ keyframes: [{ transform: "translateX(10px)" }], duration: 500 })(a)
      node_remove(a)
      return { reduced: motion_is_reduced(), gone: a.parentNode == null }
    })
    expect(r).toEqual({ reduced: true, gone: true })
  })

  test("leaving while entering cancels the entry, and the exit continues from where it was", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { $enter, $leave, node_append, node_remove } = window.__ELT__
      const c = window.__motion__.mount([])
      const el = document.createElement("div")
      el.style.height = "20px"
      $enter({ keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: 400, easing: "linear" })(el)
      $leave({ keyframes: [{ opacity: 0 }], duration: 400, easing: "linear" })(el)
      node_append(c, el)
      const enter = el.getAnimations()[0]
      await new Promise((r) => setTimeout(r, 120))
      node_remove(el)
      const leave = el.getAnimations().find((a) => a !== enter)
      return {
        enter_state: enter.playState,
        committed: Number(el.style.opacity),
        leave_running: leave?.playState === "running",
        opacity_now: Number(getComputedStyle(el).opacity),
      }
    })
    expect(r.enter_state).toBe("idle")
    expect(r.leave_running).toBe(true)
    // Mid-entry: well above 0 and below 1 ; the exit starts from there, not from 1
    expect(r.committed).toBeGreaterThan(0.1)
    expect(r.committed).toBeLessThan(0.9)
    expect(r.opacity_now).toBeLessThanOrEqual(r.committed + 0.01)
  })
})

test.describe("windowed lists", () => {
  test("Repeat with a view window (keyed): moving the window has no motion, removing an item in view does", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      const { o, Repeat, node_append, node_on_enter, node_on_leave } = window.__ELT__
      // Built offscreen, then mounted: its first rows don't enter
      const c = document.createElement("div")
      const counts = { enter: 0, leave: 0 }
      const o_list = o(Array.from({ length: 20 }, (_, i) => i))
      const o_start = o(0)
      const o_end = o(5)
      node_append(
        c,
        Repeat(o_list, (o_n) => {
          const d = document.createElement("div")
          d.style.height = "10px"
          d.textContent = String(o_n.get())
          node_on_enter(d, () => counts.enter++)
          node_on_leave(d, () => {
            counts.leave++
            return new Promise(() => {})
          })
          return d
        })
          .withKeyFunction((n: number) => n)
          .ForView(o_start, o_end),
      )
      node_append(document.body, c)
      o.transaction(() => {
        o_start.set(10)
        o_end.set(15)
      })
      const after_window = { ...counts, leaving: c.querySelectorAll("[e-leaving]").length, rows: c.children.length }
      o_list.set(o_list.get().filter((n) => n !== 12))
      return {
        after_window,
        after_remove: { ...counts, leaving: c.querySelectorAll("[e-leaving]").length },
        texts: [...c.children].map((e) => `${e.textContent}${e.hasAttribute("e-leaving") ? "*" : ""}`),
      }
    })
    expect(r.after_window).toEqual({ enter: 0, leave: 0, leaving: 0, rows: 5 })
    // 12 leaves ; 15, now in the window, gets its own fresh node (and enters)
    expect(r.after_remove).toEqual({ enter: 1, leave: 1, leaving: 1 })
    expect(r.texts).toEqual(["10", "11", "12*", "13", "14", "15"])
  })

  test("RepeatVirtual (keyed): scrolling never animates rows ; removing a rendered row does", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { o, RepeatVirtual, node_append, node_on_enter, node_on_leave } = window.__ELT__
      const frames = async (n: number) => {
        for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r))
      }
      const counts = { enter: 0, leave: 0 }
      const o_list = o(Array.from({ length: 300 }, (_, i) => i))
      const scroller = document.createElement("div")
      scroller.style.height = "100px"
      scroller.style.overflow = "auto"
      const content = document.createElement("div")
      node_append(
        content,
        RepeatVirtual(o_list, (o_n) => {
          const d = document.createElement("div")
          d.className = "row"
          d.style.height = "20px"
          node_append(d, o_n.tf(String))
          node_on_enter(d, () => counts.enter++)
          node_on_leave(d, () => {
            counts.leave++
            return new Promise(() => {})
          })
          return d
        })
          .withKeyFunction((n: number) => n)
          .ItemSize(20),
      )
      node_append(scroller, content)
      node_append(document.body, scroller)
      await frames(4)
      const first_rows = content.querySelectorAll(".row").length
      for (let y = 0; y <= 3000; y += 100) {
        scroller.scrollTop = y
        scroller.dispatchEvent(new Event("scroll"))
        await frames(2)
      }
      await frames(4)
      const after_scroll = { ...counts, leaving: content.querySelectorAll("[e-leaving]").length }
      const shown = [...content.querySelectorAll(".row")].map((e) => Number(e.textContent))
      const victim = shown[Math.floor(shown.length / 2)]
      o_list.set(o_list.get().filter((n) => n !== victim))
      return {
        first_rows,
        scrolled_to: shown[0],
        after_scroll,
        after_remove: { ...counts, leaving: content.querySelectorAll("[e-leaving]").length },
      }
    })
    expect(r.first_rows).toBeGreaterThan(0)
    expect(r.scrolled_to).toBeGreaterThan(50)
    expect(r.after_scroll).toEqual({ enter: 0, leave: 0, leaving: 0 })
    expect(r.after_remove.leave).toBe(1)
    expect(r.after_remove.leaving).toBe(1)
  })
})

test.describe("Repeat reuse of removed items", () => {
  // A filter change: banana and cherry go, date comes. Rows marked * are leaving.
  const run = (page: import("@playwright/test").Page, keyed: boolean) =>
    page.evaluate((keyed) => {
      const { o, Repeat, node_append, node_on_enter, node_on_leave } = window.__ELT__
      const c = document.createElement("div")
      const entered: string[] = []
      const o_list = o(["apple", "banana", "cherry"])
      const rep = Repeat(o_list, (o_s) => {
        const d = document.createElement("div")
        node_append(d, o_s)
        node_on_enter(d, () => entered.push(o_s.get()))
        node_on_leave(d, () => new Promise(() => {}))
        return d
      })
      node_append(c, keyed ? rep.withKeyFunction((s: string) => s) : rep)
      node_append(document.body, c)
      o_list.set(["apple", "date"])
      return {
        rows: [...c.children].map((e) => `${e.textContent}${e.hasAttribute("e-leaving") ? "*" : ""}`),
        entered,
      }
    }, keyed)

  test("keyed: removed items with a leave hook leave, the new one gets a fresh node and enters", async ({ page }) => {
    expect(await run(page, true)).toEqual({ rows: ["apple", "banana*", "cherry*", "date"], entered: ["date"] })
  })

  test("unkeyed: a removed item's node is still reused for the new one (edits of immutable items stay in place)", async ({
    page,
  }) => {
    expect(await run(page, false)).toEqual({ rows: ["apple", "date", "cherry*"], entered: [] })
  })
})
