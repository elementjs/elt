///<reference types="bun">
import "../setup.ts"

import { afterEach, describe, expect, test } from "bun:test"

import { node_append, node_remove, o } from "../../src"
import { array, boolean, map, number, object, select, string, undef, UndefinedFactory } from "../../editor/schema"

let mounted: HTMLElement[] = []

function mount<E extends HTMLElement>(el: E): E {
  node_append(document.body, el)
  mounted.push(el)
  return el
}

afterEach(() => {
  for (const el of mounted) node_remove(el)
  for (const popup of document.querySelectorAll("e-box[popover]")) node_remove(popup)
  mounted = []
})

describe("schema CommonNodeOptions", () => {
  test("composite Options accept shared node config fields", () => {
    const opts: ObjectOptions = {
      properties: [],
      open_as: "popup",
      conversions: ["string", "number"],
      toolbar: { search: false },
      free_keys: false,
    }
    expect(opts.open_as).toBe("popup")
    expect(opts.conversions).toEqual(["string", "number"])
  })

  test("CommonNodeOptions shape is assignable on array/set/map options", () => {
    const common: CommonNodeOptions = { open_as: "column", conversions: ["object"] }
    expect(common.open_as).toBe("column")
  })
})

describe("schema scalar option forwarding", () => {
  test("boolean() defaults to switch presentation", () => {
    const o_val = o(true)
    const widget = boolean().render(o_val as o.Observable<unknown>)
    mount(widget.render() as HTMLElement)
    const input = document.querySelector("input[type=checkbox]") as HTMLInputElement
    expect(input.getAttribute("e-variant")).toBe("switch")
  })

  test("number() forwards step to the native input", () => {
    const o_val = o(2)
    const widget = number({ step: 0.5, min: 0 }).render(o_val as o.Observable<unknown>)
    mount(widget.render() as HTMLElement)
    const input = document.querySelector("input[type=number]") as HTMLInputElement
    expect(input.step).toBe("0.5")
    expect(input.min).toBe("0")
  })

  test("number() exposes allow_non_finite opt-in on options", () => {
    expect(number().options.allow_non_finite).toBeUndefined()
    expect(number({ allow_non_finite: true }).options.allow_non_finite).toBe(true)
  })
})

describe("schema undef combinator", () => {
  test("undef() builds a factory that handles undefined only", () => {
    const factory = undef()
    expect(factory).toBeInstanceOf(UndefinedFactory)
    expect(factory.canHandle(undefined)).toBe(true)
    expect(factory.canHandle(null)).toBe(false)
  })
})

describe("ObjectFactory keys", () => {
  test("unknown-mode object renders a row per own key", () => {
    const o_root = o({ b: "two", a: "one" })
    const widget = object({ properties: [] }).render(o_root as o.Observable<unknown>)
    const root = mount(widget.render() as HTMLElement)
    const list = root.querySelector("e-box")!
    const keys = [...list.querySelectorAll("e-flex > span")]
      .map((el) => el.textContent?.trim())
      .filter((t): t is string => !!t && t !== "+")
    expect(keys).toEqual(["a", "b"])
  })

  test("RegExp catch-all applies to unlisted keys", () => {
    const schema = object({
      properties: [{ name: /^extra_/, type: string() }],
      free_keys: true,
    })
    const o_root = o({ extra_one: "x", other: "y" })
    const widget = schema.render(o_root as o.Observable<unknown>)
    mount(widget.render() as HTMLElement)
    const inputs = document.querySelectorAll("input[type=text]")
    expect(inputs.length).toBe(2)
  })

  test("object widget includes composite toolbar search", () => {
    const o_root = o({ alpha: "one", beta: "two" })
    const widget = object({ properties: [] }).render(o_root as o.Observable<unknown>)
    mount(widget.render() as HTMLElement)
    expect(document.querySelector('input[type="search"]')).not.toBeNull()
    expect(document.querySelector('button[aria-label="More actions"]')).not.toBeNull()
  })

  test("toolbar search: false removes the search field", () => {
    const o_root = o({ only: "x" })
    const widget = object({ properties: [{ name: "only", type: string() }], toolbar: { search: false } }).render(
      o_root as o.Observable<unknown>,
    )
    mount(widget.render() as HTMLElement)
    expect(document.querySelector('input[type="search"]')).toBeNull()
  })

  test("free_keys: false hides add-key control and extra keys", () => {
    const schema = object({
      properties: [{ name: "only", type: string() }],
      free_keys: false,
    })
    const o_root = o({ only: "x", secret: "y" })
    const widget = schema.render(o_root as o.Observable<unknown>)
    mount(widget.render() as HTMLElement)
    expect([...document.querySelectorAll("button")].some((b) => b.textContent?.includes("Add key"))).toBe(false)
    expect(document.querySelectorAll("input[type=text]").length).toBe(1)
  })

  test("array table auto-detect helper matches uniform object rows", () => {
    const f = array({ values: string() })
    expect(f.eval_auto_table_for_table_mode([{ a: 1 }, { a: 2 }])).toBe(true)
    expect(f.eval_auto_table_for_table_mode([1, 2])).toBe(false)
  })

  test("array list renders add-item control and appends on transient commit", () => {
    const o_tags = o(["alpha"])
    const widget = array({ values: string(), item_default: "" }).render(o_tags as o.Observable<unknown>)
    mount(widget.render() as HTMLElement)

    const add = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Add item"))
    expect(add).toBeDefined()
    add?.click()

    const inputs = document.querySelectorAll('input[type="text"]')
    const input = inputs[inputs.length - 1] as HTMLInputElement
    input.value = "beta"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    expect(o_tags.get()).toEqual(["alpha", "beta"])
  })

  test("select() wires elt/ui Select", () => {
    const o_mood = o("happy")
    const widget = select({
      options: ["happy", "sad"],
      convert_fn: (s) => s,
    }).render(o_mood as o.Observable<unknown>)
    mount(widget.render() as HTMLElement)
    expect(document.querySelectorAll("button").length).toBeGreaterThan(0)
  })

  test("map key cells expose a type-change menu by default", () => {
    const o_flags = o(new Map([["enabled", true]]))
    const widget = map({ keys: string(), values: boolean() }).render(o_flags as o.Observable<unknown>)
    mount(widget.render() as HTMLElement)
    const menus = [...document.querySelectorAll("button")].filter(
      (b) => b.getAttribute("aria-label") === "Change type",
    )
    expect(menus.length).toBeGreaterThan(0)
  })
})
