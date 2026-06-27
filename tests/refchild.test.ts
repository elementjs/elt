///<reference types="bun">
import "./setup.ts"

import { test, expect, describe } from "bun:test"

import { e, RefChild, type Attrs } from "../src"
import { node_append } from "../src/dom"

function panel(attrs: { title: string } & Attrs<HTMLDivElement>, refchild: RefChild) {
  return e(
    "div",
    { class: "panel" },
    e("h2", {}, attrs.title),
    refchild.IfChildren(ref => e("div", { class: "panel-body" }, ref))
  )
}

function insert_after(_attrs: Attrs<HTMLDivElement>, ref: RefChild) {
  return e(
    "div",
    { class: "host" },
    e("span", { class: "marker" }, "insert here"),
    ref
  )
}

function box(attrs: Attrs<HTMLDivElement>) {
  return e("div", { class: "inner" }, "fixed") as HTMLDivElement
}

function wrap(_attrs: Attrs<HTMLDivElement>, _refchild: RefChild) {
  return e("div", { class: "wrap" }) as HTMLDivElement
}

describe("RefChild", () => {
  test("ref in the tree marks where JSX children are inserted", () => {
    const root = e(
      insert_after,
      {},
      e("em", { class: "child" }, "y")
    ) as HTMLDivElement

    const marker = root.querySelector(".marker")!
    const child = root.querySelector(".child")!

    expect(root.querySelector(".marker")?.textContent).toBe("insert here")
    expect(child.textContent).toBe("y")
    expect(marker.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test("IfChildren creates the container only when children are provided", () => {
    const alone = e(panel, { title: "alone" }) as HTMLDivElement
    const with_child = e(
      panel,
      { title: "x" },
      e("span", {}, "c")
    )

    expect(alone.querySelector(".panel-body")).toBeNull()
    expect(with_child.querySelector(".panel-body")).not.toBeNull()
  })

  test("IfChildren places component children in the marked container", () => {
    const root = e(
      panel,
      { title: "T" },
      e("span", { class: "panel-child" }, "hello")
    ) as HTMLDivElement

    const body = root.querySelector(".panel-body") as HTMLDivElement
    const child = root.querySelector(".panel-child") as HTMLSpanElement

    expect(body.contains(child)).toBe(true)
    expect(root.querySelector("h2")?.textContent).toBe("T")
    expect(child.textContent).toBe("hello")
  })

  test("two-arg component without IfChildren still appends children to the root", () => {
    const root = e(
      wrap,
      {},
      e("em", { class: "wrap-child" }, "y")
    ) as HTMLDivElement

    expect(root.className).toBe("wrap")
    expect(root.querySelector(".wrap-child")?.textContent).toBe("y")
  })

  test("global attrs on a component apply to its root without manual forwarding", () => {
    const root = e(box, { class: "outer", id: "mybox" })

    expect(root.id).toBe("mybox")
    expect(root.classList.contains("outer")).toBe(true)
    expect(root.classList.contains("inner")).toBe(true)
  })

  test("IfChildren container receives several children in order", () => {
    const root = e(
      panel,
      { title: "n" },
      e("span", {}, "a"),
      e("span", {}, "b")
    ) as HTMLDivElement

    const spans = root.querySelector(".panel-body")!.querySelectorAll("span")
    expect(spans.length).toBe(2)
    expect(spans[0].textContent).toBe("a")
    expect(spans[1].textContent).toBe("b")
  })

  test("works when mounted with node_append", () => {
    const host = document.createElement("section")
    node_append(
      host,
      e(panel, { title: "live" }, e("i", {}, "ok"))
    )
    expect(host.querySelector(".panel-body i")?.textContent).toBe("ok")
  })
})
