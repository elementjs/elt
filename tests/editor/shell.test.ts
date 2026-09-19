///<reference types="bun">
import "../setup.ts"

import { afterEach, describe, expect, test } from "bun:test"

import { node_append, node_remove, o } from "../../src"
import { dispatch_object_editor_open, ObjectEditorShell } from "../../editor/shell"
import { anything, boolean, number, object, string } from "../../editor/schema"
import { apply_type_change, type_change_actions } from "../../editor/type-change"

let mounted: HTMLElement[] = []

function mount<E extends HTMLElement>(el: E): E {
  node_append(document.body, el)
  mounted.push(el)
  return el
}

afterEach(() => {
  for (const el of mounted) node_remove(el)
  for (const popup of document.querySelectorAll("e-block[popover]")) node_remove(popup)
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

    const name_input = shell.node.querySelector('input[type="text"]') as HTMLInputElement
    const age_input = shell.node.querySelector('input[type="number"]') as HTMLInputElement
    const active_input = shell.node.querySelector('input[e-variant="switch"]') as HTMLInputElement
    expect(name_input.value).toBe("Ada")
    expect(age_input.value).toBe("36")
    expect(active_input.checked).toBe(true)
  })

  test("editing a bound input writes back through to the root observable", () => {
    const o_root = o({ name: "Ada", age: 36, active: true })
    const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
    mount(shell.node)

    const name_input = shell.node.querySelector('input[type="text"]') as HTMLInputElement
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
    const name_input = shell.node.querySelector('input[type="text"]') as HTMLInputElement
    expect(name_input.value).toBe("Ada")
  })

  test("closing the rightmost column truncates and updates the breadcrumb", () => {
    const o_root = o({ name: "Ada", age: 36, active: true })
    const o_other = o({ name: "Linus", age: 54, active: false })
    const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
    mount(shell.node)

    dispatch_object_editor_open(shell.node, { o_value: o_other, title: "other" })
    expect(shell.o_breadcrumb.get()).toEqual(["other"])

    const close_buttons = [...shell.node.querySelectorAll("button")].filter((b) => b.textContent?.trim() === "×")
    expect(close_buttons.length).toBe(1) // only the opened column gets a close button, not root
    fire(close_buttons[0] as HTMLButtonElement, "click")

    expect(shell.o_breadcrumb.get()).toEqual([])
    expect((shell.node.querySelector('input[type="text"]') as HTMLInputElement).value).toBe("Ada")
  })

  test("dead-column detection: a schema-mode root that stops matching falls back to unknown mode in place", () => {
    const o_root = o<unknown>({ name: "Ada", age: 36, active: true })
    const shell = new ObjectEditorShell(o_root as o.Observable<unknown>, { schema: profile_schema })
    mount(shell.node)
    expect((shell.node.querySelector('input[type="text"]') as HTMLInputElement).value).toBe("Ada")

    // profile_schema (a fixed ObjectFactory) can't handle a plain string --
    // re-resolving to the SAME schema would be a no-op (that's the bug this
    // regresses against); it must fall back to unknown mode instead.
    ;(o_root as o.Observable<unknown>).set("just a string now")

    const inputs = shell.node.querySelectorAll('input[type="text"]')
    expect(inputs.length).toBe(1)
    expect((inputs[0] as HTMLInputElement).value).toBe("just a string now")
  })

  test("dead-column detection: a non-root column re-resolves on resolved-kind change instead of closing", () => {
    const o_root = o({ name: "Ada", age: 36, active: true })
    const o_stats = o<unknown>({ views: 10, likes: 2 })
    const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
    mount(shell.node)

    dispatch_object_editor_open(shell.node, {
      o_value: o_stats,
      title: "stats",
      factory: object({ properties: [] }),
    })
    expect(shell.o_breadcrumb.get()).toEqual(["stats"])

    const prev_confirm = globalThis.confirm
    globalThis.confirm = () => true
    try {
      const pinned = object({ properties: [] })
      const actions = type_change_actions(pinned, o_stats.get(), {})
      const convert = actions.find((a) => a.target.kind === "array" && a.mode === "convert")
      expect(convert).toBeDefined()
      apply_type_change(o_stats, pinned, convert!)
    } finally {
      globalThis.confirm = prev_confirm
    }

    expect(o_stats.get()).toEqual([10, 2])
    expect(shell.o_breadcrumb.get()).toEqual(["stats"])
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
    expect((shell.node.querySelector('input[type="text"]') as HTMLInputElement).value).toBe("Ada")
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

    // Only "name" renders inline — "address" is a preview button, not two more text fields.
    expect(shell.node.querySelectorAll('input[type="text"]').length).toBe(1)
    const preview_button = [...shell.node.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Open"),
    ) as HTMLButtonElement
    expect(preview_button).not.toBeUndefined()
    expect(shell.o_breadcrumb.get()).toEqual([])

    fire(preview_button, "click")

    expect(shell.o_breadcrumb.get()).toEqual(["address"])
    const values = [...shell.node.querySelectorAll('input[type="text"]')].map(
      (el) => (el as HTMLInputElement).value,
    )
    expect(values).toContain("Ada")
    expect(values).toContain("12 Analytical Engine Ave")
    expect(values).toContain("London")
  })

  test("a nested composite row re-renders after its value changes kind so Open uses the new factory", () => {
    const address_schema = object({
      properties: [{ name: "street", type: string() }],
    })
    const with_address_schema = object({
      properties: [
        { name: "name", type: string() },
        { name: "address", type: address_schema },
      ],
    })
    const o_root = o({ name: "Ada", address: { street: "Main" } })
    const shell = new ObjectEditorShell(o_root, { schema: with_address_schema })
    mount(shell.node)

    expect([...shell.node.querySelectorAll("button")].some((b) => b.textContent?.includes("Open"))).toBe(true)

    const prev_confirm = globalThis.confirm
    globalThis.confirm = () => true
    try {
      apply_type_change(
        o_root.p("address"),
        address_schema,
        type_change_actions(address_schema, o_root.get().address, {}).find(
          (a) => a.target.kind === "array" && a.mode === "convert",
        )!,
      )
    } finally {
      globalThis.confirm = prev_confirm
    }

    expect(o_root.get().address).toEqual(["Main"])
    // Still a composite preview (array), not stale object drill-in state.
    expect([...shell.node.querySelectorAll("button")].some((b) => b.textContent?.includes("Open"))).toBe(true)

    const preview = [...shell.node.querySelectorAll("button")].find((b) => b.textContent?.includes("Open"))!
    fire(preview, "click")
    expect(shell.o_breadcrumb.get()).toEqual(["address"])
  })

  test("opening a sibling composite from the root replaces the prior drilled column", () => {
    const o_root = o({ meta: { revision: 1 }, stats: { views: 10, likes: 2 } })
    const shell = new ObjectEditorShell(o_root, { schema: anything })
    mount(shell.node)

    function find_open(key: string) {
      for (const span of shell.node.querySelectorAll("span")) {
        if (span.textContent?.trim() !== key) continue
        const btn = span.nextElementSibling?.querySelector("button")
        if (btn?.textContent?.includes("Open")) return btn as HTMLButtonElement
      }
      return null
    }

    fire(find_open("meta")!, "click")
    expect(shell.o_breadcrumb.get()).toEqual(["meta"])
    expect([...shell.node.querySelectorAll("span")].some((s) => s.textContent?.trim() === "revision")).toBe(true)

    fire(find_open("stats")!, "click")
    expect(shell.o_breadcrumb.get()).toEqual(["stats"])
    expect([...shell.node.querySelectorAll("span")].some((s) => s.textContent?.trim() === "views")).toBe(true)
    expect([...shell.node.querySelectorAll("span")].some((s) => s.textContent?.trim() === "revision")).toBe(false)
  })

  test("composite preview Open button shows only label text, not source comments", () => {
    const o_root = o({ meta: { revision: 1 } })
    const shell = new ObjectEditorShell(o_root, { schema: anything })
    mount(shell.node)

    const preview = [...shell.node.querySelectorAll("button")].find((b) => b.textContent?.includes("Open"))
    expect(preview?.textContent?.trim()).toBe("Open ›")
  })

  test("anything (unknown mode) resolves a bare scalar root without a schema", () => {
    const o_root = o<unknown>("hello")
    const shell = new ObjectEditorShell(o_root as o.Observable<unknown>)
    mount(shell.node)

    const input = shell.node.querySelector("input") as HTMLInputElement
    expect(input.value).toBe("hello")
    expect(anything.canHandle("hello")).toBe(true)
  })

  test("open() without factory resolves Map values through the constructor registry", () => {
    const o_root = o<unknown>({ bag: new Map([["a", 1]]) })
    const shell = new ObjectEditorShell(o_root, { schema: object({ properties: [] }) })
    mount(shell.node)

    const o_bag = o((o_root.get() as { bag: Map<string, number> }).bag)
    dispatch_object_editor_open(shell.node, { o_value: o_bag, title: "bag" })

    expect(shell.o_breadcrumb.get()).toEqual(["bag"])
    expect(shell.node.textContent).toContain("a")
  })

  test("open_as popup adds a breadcrumb segment for the opened value", async () => {
    const nested_schema = object({
      properties: [{ name: "x", type: number() }],
      open_as: "popup",
    })
    const o_root = o({ nested: { x: 1 } })
    const shell = new ObjectEditorShell(o_root, {
      schema: object({ properties: [{ name: "nested", type: nested_schema }] }),
    })
    mount(shell.node)

    const open = [...shell.node.querySelectorAll("button")].find((b) => b.textContent?.includes("Open"))
    fire(open!, "click")

    expect(shell.o_breadcrumb.get()).toEqual(["nested"])

    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
  })
})
