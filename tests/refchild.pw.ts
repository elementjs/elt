import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("RefChild", () => {
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

  test("ref in the tree marks where JSX children are inserted", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { e } = window.__ELT__

      function insert_after(_attrs: import("elt").Attrs<HTMLDivElement>, ref: import("elt").RefChild) {
        return e("div", { class: "host" }, e("span", { class: "marker" }, "insert here"), ref)
      }

      const root = e(insert_after, {}, e("em", { class: "child" }, "y")) as HTMLDivElement

      const marker = root.querySelector(".marker")!
      const child = root.querySelector(".child")!

      return {
        marker_text: root.querySelector(".marker")?.textContent,
        child_text: child.textContent,
        child_follows_marker: !!(marker.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING),
      }
    })

    expect(result.marker_text).toBe("insert here")
    expect(result.child_text).toBe("y")
    expect(result.child_follows_marker).toBeTruthy()
  })

  test("IfChildren creates the container only when children are provided", async ({ page }) => {
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
      const with_child = e(panel, { title: "x" }, e("span", {}, "c"))

      return {
        alone_body_null: alone.querySelector(".panel-body") === null,
        with_child_body_not_null: with_child.querySelector(".panel-body") !== null,
      }
    })

    expect(result.alone_body_null).toBe(true)
    expect(result.with_child_body_not_null).toBe(true)
  })

  test("IfChildren places component children in the marked container", async ({ page }) => {
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

      const root = e(panel, { title: "T" }, e("span", { class: "panel-child" }, "hello")) as HTMLDivElement

      const body = root.querySelector(".panel-body") as HTMLDivElement
      const child = root.querySelector(".panel-child") as HTMLSpanElement

      return {
        body_contains_child: body.contains(child),
        h2_text: root.querySelector("h2")?.textContent,
        child_text: child.textContent,
      }
    })

    expect(result.body_contains_child).toBe(true)
    expect(result.h2_text).toBe("T")
    expect(result.child_text).toBe("hello")
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

  test("IfChildren container receives several children in order", async ({ page }) => {
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

      const root = e(panel, { title: "n" }, e("span", {}, "a"), e("span", {}, "b")) as HTMLDivElement

      const spans = root.querySelector(".panel-body")!.querySelectorAll("span")
      return {
        length: spans.length,
        first_text: spans[0].textContent,
        second_text: spans[1].textContent,
      }
    })

    expect(result.length).toBe(2)
    expect(result.first_text).toBe("a")
    expect(result.second_text).toBe("b")
  })

  test("works when mounted with node_append", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { e, node_append } = window.__ELT__

      function panel(attrs: { title: string } & import("elt").Attrs<HTMLDivElement>, refchild: import("elt").RefChild) {
        return e(
          "div",
          { class: "panel" },
          e("h2", {}, attrs.title),
          refchild.IfChildren((ref) => e("div", { class: "panel-body" }, ref)),
        )
      }

      const host = document.createElement("section")
      node_append(host, e(panel, { title: "live" }, e("i", {}, "ok")))
      return host.querySelector(".panel-body i")?.textContent
    })

    expect(result).toBe("ok")
  })
})
