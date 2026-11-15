import { expect, test } from "./fixture"

test.describe("RefChild", () => {
  test("observable and verb children go to a RefChild nested deeper than the root, and trigger IfChildren (regression: NotFoundError)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { e, o, If, node_append } = window.__ELT__
      function deep(_attrs: import("elt").Attrs<HTMLDivElement>, ref: import("elt").RefChild) {
        return e("div", {}, e("span", {}, "[", ref, "]"))
      }
      function scaffold(_attrs: import("elt").Attrs<HTMLDivElement>, ref: import("elt").RefChild) {
        return e(
          "div",
          {},
          e(
            "p",
            {},
            ref.IfChildren((r) => e("b", {}, r)),
          ),
        )
      }
      const o_text = o("hello")
      const a = e(deep, {}, o_text)
      const b = e(
        deep,
        {},
        If(o(true), () => "yes"),
      )
      const c = e(scaffold, {}, o_text)
      for (const n of [a, b, c]) node_append(document.body, n)
      o_text.set("bye")
      const html = [a, b, c].map((n) => `${n.textContent} ${n.querySelector("b")?.textContent}`)
      for (const n of [a, b, c]) n.remove()
      return html
    })
    expect(result).toEqual(["[bye] undefined", "[yes] undefined", "bye bye"])
  })

  test("sequential components reuse the pooled RefChild (regression: the constructor bumped the pool counter, so every call allocated a new one)", async ({
    page,
  }) => {
    const same = await page.evaluate(() => {
      const { e } = window.__ELT__
      const refs: unknown[] = []
      function comp(_attrs: import("elt").Attrs<HTMLDivElement>, ref: import("elt").RefChild) {
        refs.push(ref)
        return e("div", {}, ref)
      }
      e(comp, {})
      e(comp, {})
      e(comp, {})
      return refs[0] === refs[1] && refs[1] === refs[2]
    })
    expect(same).toBe(true)
  })

  test("IfChildren creates the container only when children are provided, and puts them all in it, in order", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { e } = window.__ELT__

      function panel(attrs: { title: string } & import("elt").Attrs<HTMLDivElement>, refchild: import("elt").RefChild) {
        return e(
          "div",
          { class: "panel" },
          e("h2", {}, attrs.title),
          refchild.IfChildren((ref) => e("div", { class: "panel-body" }, ref)),
        )
      }

      const alone = e(panel, { title: "alone" }) as HTMLDivElement
      const with_children = e(panel, { title: "T" }, e("span", {}, "a"), e("span", {}, "b")) as HTMLDivElement
      const body = with_children.querySelector(".panel-body")
      return {
        alone_body: alone.querySelector(".panel-body") !== null,
        h2_text: with_children.querySelector("h2")?.textContent,
        // Every child is inside the container, none next to it
        in_body: body ? [...body.querySelectorAll("span")].map((s) => s.textContent) : null,
        all_spans: [...with_children.querySelectorAll("span")].length,
      }
    })

    expect(result).toEqual({ alone_body: false, h2_text: "T", in_body: ["a", "b"], all_spans: 2 })
  })

  test("two-arg component without IfChildren still appends children to the root", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { e } = window.__ELT__

      function wrap(_attrs: import("elt").Attrs<HTMLDivElement>, _refchild: import("elt").RefChild) {
        return e("div", { class: "wrap" }) as HTMLDivElement
      }

      const root = e(wrap, {}, e("em", { class: "wrap-child" }, "y")) as HTMLDivElement

      return {
        class_name: root.className,
        wrap_child_text: root.querySelector(".wrap-child")?.textContent,
      }
    })

    expect(result.class_name).toBe("wrap")
    expect(result.wrap_child_text).toBe("y")
  })

  test("global attrs on a component apply to its root without manual forwarding", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { e } = window.__ELT__

      function box(_attrs: import("elt").Attrs<HTMLDivElement>) {
        return e("div", { class: "inner" }, "fixed") as HTMLDivElement
      }

      const root = e(box, { class: "outer", id: "mybox" })

      return {
        id: root.id,
        has_outer: root.classList.contains("outer"),
        has_inner: root.classList.contains("inner"),
      }
    })

    expect(result.id).toBe("mybox")
    expect(result.has_outer).toBe(true)
    expect(result.has_inner).toBe(true)
  })
})
