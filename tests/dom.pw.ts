import { test, expect } from "./fixture"

test.describe("style attribute", () => {
  test("an observable style accepts a string, null and objects, and removes the properties a new object drops (regression: strings and null broke)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { o, e, node_append } = window.__ELT__
      type Style = import("elt").StyleObject | string | null
      const o_style = o<Style>({ color: "red", marginTop: "2px", "--myColor": "blue" })
      const div = e("div", { style: o_style })
      node_append(document.body, div)
      const steps: (string | null)[] = [div.getAttribute("style")]
      // a number 0 is a value, not a removal
      o_style.set({ color: "green", opacity: 0 as unknown as string })
      steps.push(div.getAttribute("style"))
      o_style.set("display: none")
      steps.push(div.getAttribute("style"))
      o_style.set({ color: "red" })
      steps.push(div.getAttribute("style"))
      o_style.set(null)
      steps.push(div.getAttribute("style"))
      div.remove()
      return steps
    })
    expect(result).toEqual([
      "color: red; margin-top: 2px; --myColor: blue;",
      "color: green; opacity: 0;",
      "display: none",
      "color: red;",
      null,
    ])
  })
  test("false is no style, static or as an observable's value, like null (regression: an observable false was read as an object)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { o, e, $style, node_append } = window.__ELT__
      const cond = false as boolean
      const steps: (string | null)[] = [
        e("div", { style: cond && { color: "red" } }).getAttribute("style"),
        e("div", {}, $style(false, null, { color: "red" })).getAttribute("style"),
      ]
      const o_on = o(true)
      const div = e("div", { style: o_on.tf((on) => on && { color: "red" }) })
      node_append(document.body, div)
      steps.push(div.getAttribute("style"))
      o_on.set(false)
      steps.push(div.getAttribute("style"))
      o_on.set(true)
      steps.push(div.getAttribute("style"))
      div.remove()
      return steps
    })
    expect(result).toEqual([null, "color: red;", "color: red;", null, "color: red;"])
  })
})

test.describe("class attribute", () => {
  test('false and null add no class, static or in arrays and maps (regression: true / false array entries added the class "true" / "false")', async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { e, $class } = window.__ELT__
      const cls = (el: Element) => el.getAttribute("class")
      const as_any = (v: unknown) => v as any
      return [
        cls(e("div", { class: false })),
        cls(e("div", { class: null })),
        cls(e("div", { class: ["a", false, null, undefined, "b"] })),
        cls(e("div", { class: { a: true, b: false, c: null, d: 0, e: "yes" } })),
        // `true` can only be a mistake (`cond || "x"`): it adds nothing, like false
        cls(e("div", { class: as_any(true) })),
        cls(e("div", { class: as_any(["a", true]) })),
        cls(e("div", {}, $class(false, null, undefined, "c"))),
      ]
    })
    expect(result).toEqual([null, null, "a b", "a e", null, "a", "c"])
  })

  test("an observable class going from names to false removes them, and back adds them", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o, e, node_append } = window.__ELT__
      const o_on = o(true)
      const o_list = o<(string | false | null)[] | false | null>(["x", false, "y z"])
      // the documented form: class={o_cond.tf(c => c && "name")}
      const div = e("div", { class: ["base", o_on.tf((on) => on && "a b"), o_list] })
      node_append(document.body, div)
      const steps: string[] = [div.className]
      o_on.set(false)
      steps.push(div.className)
      o_list.set(null)
      steps.push(div.className)
      o_on.set(true)
      o_list.set([false, "w"])
      steps.push(div.className)
      o_list.set(false)
      steps.push(div.className)
      div.remove()
      return steps
    })
    expect(result).toEqual(["base a b x y z", "base x y z", "base", "base a b w", "base a b"])
  })

  test("a class map entry going from true to false removes the class", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o, e, node_append } = window.__ELT__
      const o_v = o<boolean | null>(true)
      const div = e("div", { class: { on: o_v } })
      node_append(document.body, div)
      const steps: string[] = [div.className]
      o_v.set(false)
      steps.push(div.className)
      o_v.set(true)
      steps.push(div.className)
      o_v.set(null)
      steps.push(div.className)
      div.remove()
      return steps
    })
    expect(result).toEqual(["on", "", "on", ""])
  })
})

test.describe("decorators", () => {
  test("$once with a boolean uses it for capture (regression: any boolean meant capture)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { e, $once, node_append } = window.__ELT__
      const order: string[] = []
      // in the bubble phase, the inner listener runs first; in the capture phase, the outer one would
      const outer = e(
        "div",
        {},
        $once("click", () => order.push("outer"), false),
      )
      const inner = e("span")
      inner.addEventListener("click", () => order.push("inner"))
      node_append(outer, inner)
      node_append(document.body, outer)
      inner.click()
      inner.click()
      outer.remove()
      return order
    })
    expect(result).toEqual(["inner", "outer", "inner"])
  })

  test("$id and $title apply a constant at once, like the attributes (regression: only on connection)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { e, $id, $title } = window.__ELT__
      const div = e("div", {}, $id("x"), $title("tip"))
      return { id: div.id, title: div.title }
    })
    expect(result).toEqual({ id: "x", title: "tip" })
  })

  test("$scrollable and setup_mutation_observer register their document listener once (regression: once per call)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { e, $scrollable, setup_mutation_observer } = window.__ELT__
      const count = new Map<string, number>()
      const add = EventTarget.prototype.addEventListener
      EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: any[]) {
        if (type === "touchmove" && this === document.body) count.set(type, (count.get(type) ?? 0) + 1)
        if (type === "unload" && this === window) count.set(type, (count.get(type) ?? 0) + 1)
        return add.call(this, type, ...(rest as [any]))
      }
      try {
        // the first call of each may already have run before this test: count the calls after it
        e("div", {}, $scrollable)
        setup_mutation_observer(document.body).disconnect()
        count.clear()
        for (let i = 0; i < 3; i++) {
          e("div", {}, $scrollable)
          setup_mutation_observer(document.body).disconnect()
        }
        return { touchmove: count.get("touchmove") ?? 0, unload: count.get("unload") ?? 0 }
      } finally {
        EventTarget.prototype.addEventListener = add
      }
    })
    expect(result).toEqual({ touchmove: 0, unload: 0 })
  })
})

test.describe("event listeners", () => {
  test("a listener on the node itself is added once: $once fires once across reconnections (regression: it re-armed)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { e, $once, $on, node_append, node_remove } = window.__ELT__
      let once = 0
      let on = 0
      const div = e(
        "div",
        {},
        $once("click", () => once++),
        $on("click", () => on++),
      )
      div.click() // before it is ever in the page
      for (let i = 0; i < 3; i++) {
        node_append(document.body, div)
        div.click()
        node_remove(div)
      }
      return { once, on }
    })
    expect(result).toEqual({ once: 1, on: 4 })
  })
})

test.describe("$shadow", () => {
  test("passes every ShadowRootInit option to attachShadow (regression: only mode, delegatesFocus and slotAssignment)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { e, $shadow } = window.__ELT__
      const div = e("div", {}, $shadow({ serializable: true, delegatesFocus: false }, e("span", {}, "inside")))
      const root = div.shadowRoot as ShadowRoot & { serializable: boolean }
      return { serializable: root.serializable, delegatesFocus: root.delegatesFocus, text: root.textContent }
    })
    expect(result).toEqual({ serializable: true, delegatesFocus: false, text: "inside" })
  })
})

test.describe("unrecognized children", () => {
  test("a promise is not rendered once it resolves: it is shown as its string conversion, like any other unrecognized object (regression: node_append rendered resolved promises)", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const { e, node_append } = window.__ELT__
      const div = e("div")
      node_append(document.body, div)
      // Not a `Renderable`: the cast stands for untyped code passing one anyway
      node_append(div, Promise.resolve("resolved") as unknown as import("elt").Renderable<HTMLDivElement>)
      await new Promise((r) => setTimeout(r, 20))
      const nodes = [...div.childNodes].map((n) => [n.nodeType, n.textContent])
      div.remove()
      return nodes
    })
    expect(result).toEqual([[3 /* Node.TEXT_NODE */, "[object Promise]"]])
  })
})
