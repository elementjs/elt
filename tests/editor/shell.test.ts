///<reference types="bun">
import "../setup.ts"

import { afterEach, describe, expect, test } from "bun:test"

import { node_append, node_remove, o } from "../../src"
import { dispatch_object_editor_open, ObjectEditorShell } from "../../editor/shell"
import { anything, boolean, number, object, string } from "../../editor/schema"

let mounted: HTMLElement[] = []

function mount<E extends HTMLElement>(el: E): E {
  node_append(document.body, el)
  mounted.push(el)
  return el
}

afterEach(() => {
  for (const el of mounted) node_remove(el)
  mounted = []
})

function fire(el: HTMLElement, type: string) {
  el.dispatchEvent(new Event(type, { bubbles: true }))
}

const profile_schema = object({
  properties: [
    { name: "name", type: string() },
    { name: "age", type: number({ min: 0 }) },
    { name: "active", type: boolean() },
  ],
})

describe("ObjectEditorShell", () => {
  test("mounts the root column and binds scalar widgets to the schema's properties", () => {
    const o_root = o({ name: "Ada", age: 36, active: true })
    const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
    mount(shell.node)

    const inputs = shell.node.querySelectorAll("input")
    // name (text), age (number), active (checkbox) -- in schema order.
    expect(inputs.length).toBe(3)
    expect((inputs[0] as HTMLInputElement).value).toBe("Ada")
    expect((inputs[1] as HTMLInputElement).value).toBe("36")
    expect((inputs[2] as HTMLInputElement).checked).toBe(true)
  })

  test("editing a bound input writes back through to the root observable", () => {
    const o_root = o({ name: "Ada", age: 36, active: true })
    const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
    mount(shell.node)

    const name_input = shell.node.querySelector("input") as HTMLInputElement
    name_input.value = "Grace"
    fire(name_input, "input")

    expect(o_root.get().name).toBe("Grace")
  })

  test("open() through the real event path appends a column and updates the breadcrumb", () => {
    const o_root = o({ name: "Ada", age: 36, active: true })
    const o_other = o({ name: "Linus", age: 54, active: false })
    const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
    mount(shell.node)

    expect(shell.o_breadcrumb.get()).toEqual([])

    dispatch_object_editor_open(shell.node, { o_value: o_other, title: "other" })

    expect(shell.o_breadcrumb.get()).toEqual(["other"])
    // The newly opened column resolves in unknown mode (anything): a plain
    // object matches anything's ObjectFactory branch (properties: []), but
    // unknown-mode Object rendering (one row per Object.keys) isn't wired up
    // yet -- see TODO.md "Object key rules" -- so it renders zero rows for
    // now. Root's own 3 inputs are unaffected.
    expect(shell.node.querySelectorAll("input").length).toBe(3)
  })

  test("open() from a source outside every column opens after the root, not in place of it", () => {
    // Regression: an `open()` whose `source` isn't inside any mounted
    // column host (e.g. a host-application control) used to truncate back
    // to ZERO columns, destroying the root -- fixed to fall back to "as if
    // opened from the root" instead.
    const o_root = o({ name: "Ada", age: 36, active: true })
    const o_other = o({ name: "Linus", age: 54, active: false })
    const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
    mount(shell.node)

    dispatch_object_editor_open(shell.node, { o_value: o_other, title: "other" })

    expect(shell.o_breadcrumb.get()).toEqual(["other"])
    // The root's own widgets are still there, not wiped out.
    const name_input = shell.node.querySelector("input") as HTMLInputElement
    expect(name_input.value).toBe("Ada")
  })

  test("closing the rightmost column truncates and updates the breadcrumb", () => {
    const o_root = o({ name: "Ada", age: 36, active: true })
    const o_other = o({ name: "Linus", age: 54, active: false })
    const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
    mount(shell.node)

    dispatch_object_editor_open(shell.node, { o_value: o_other, title: "other" })
    expect(shell.o_breadcrumb.get()).toEqual(["other"])

    const buttons = shell.node.querySelectorAll("button")
    expect(buttons.length).toBe(1) // only the opened column gets a close button, not root
    fire(buttons[0] as HTMLButtonElement, "click")

    expect(shell.o_breadcrumb.get()).toEqual([])
    expect(shell.node.querySelectorAll("input").length).toBe(3)
  })

  test("dead-column detection: a schema-mode root that stops matching falls back to unknown mode in place", () => {
    const o_root = o<unknown>({ name: "Ada", age: 36, active: true })
    const shell = new ObjectEditorShell(o_root as o.Observable<unknown>, { schema: profile_schema })
    mount(shell.node)
    expect(shell.node.querySelectorAll("input").length).toBe(3)

    // profile_schema (a fixed ObjectFactory) can't handle a plain string --
    // re-resolving to the SAME schema would be a no-op (that's the bug this
    // regresses against); it must fall back to unknown mode instead.
    ;(o_root as o.Observable<unknown>).set("just a string now")

    const inputs = shell.node.querySelectorAll("input")
    expect(inputs.length).toBe(1)
    expect((inputs[0] as HTMLInputElement).value).toBe("just a string now")
  })

  test("dead-column detection: a non-root column closes itself and everything to its right", () => {
    const o_root = o({ name: "Ada", age: 36, active: true })
    const o_other = o<unknown>({ name: "Linus", age: 54, active: false })
    const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
    mount(shell.node)

    dispatch_object_editor_open(shell.node, { o_value: o_other, title: "other" })
    expect(shell.o_breadcrumb.get()).toEqual(["other"])

    // The "other" column resolved via unknown mode (anything, an EitherFactory) --
    // that self-heals reactively on its own, so force the outer dead-column
    // watch to fire by handing it a value NO branch of `anything` can handle.
    ;(o_other as o.Observable<unknown>).set(Symbol("nope") as unknown as object)

    expect(shell.o_breadcrumb.get()).toEqual([])
    expect(shell.node.querySelectorAll("input").length).toBe(3)
  })

  test("a nested Object property renders as a preview button, not inline, and drills in on click", () => {
    const address_schema = object({
      properties: [
        { name: "street", type: string() },
        { name: "city", type: string() },
      ],
    })
    const with_address_schema = object({
      properties: [
        { name: "name", type: string() },
        { name: "address", type: address_schema },
      ],
    })
    const o_root = o({ name: "Ada", address: { street: "12 Analytical Engine Ave", city: "London" } })
    const shell = new ObjectEditorShell(o_root, { schema: with_address_schema })
    mount(shell.node)

    // Only "name" renders inline (1 input) -- "address" is a composite
    // property, so it's a preview button, not 2 more inline inputs.
    expect(shell.node.querySelectorAll("input").length).toBe(1)
    const preview_button = shell.node.querySelector("button") as HTMLButtonElement
    expect(preview_button).not.toBeNull()
    expect(shell.o_breadcrumb.get()).toEqual([])

    fire(preview_button, "click")

    expect(shell.o_breadcrumb.get()).toEqual(["address"])
    const inputs = shell.node.querySelectorAll("input")
    expect(inputs.length).toBe(3) // root's "name" + address's "street"/"city"
    expect((inputs[1] as HTMLInputElement).value).toBe("12 Analytical Engine Ave")
    expect((inputs[2] as HTMLInputElement).value).toBe("London")
  })

  test("anything (unknown mode) resolves a bare scalar root without a schema", () => {
    const o_root = o<unknown>("hello")
    const shell = new ObjectEditorShell(o_root as o.Observable<unknown>)
    mount(shell.node)

    const input = shell.node.querySelector("input") as HTMLInputElement
    expect(input.value).toBe("hello")
    expect(anything.canHandle("hello")).toBe(true)
  })
})
