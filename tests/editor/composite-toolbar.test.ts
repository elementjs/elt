///<reference types="bun">
import "../setup.ts"

import { describe, expect, test } from "bun:test"

// Load schema module so the unknown type-change catalog registers.
import { object, string } from "../../editor/schema"
import { row_matches_search, value_preview_text } from "../../editor/composite-toolbar"
import { type_change_actions } from "../../editor/type-change"

describe("composite toolbar search", () => {
  test("empty query shows all rows", () => {
    expect(row_matches_search("", false, ["name", "Ada"])).toBe(true)
  })

  test("case-insensitive match on key or value", () => {
    expect(row_matches_search("ada", false, ["name", "Ada Lovelace"])).toBe(true)
    expect(row_matches_search("bio", false, ["name", "Ada"])).toBe(false)
  })

  test("case-sensitive mode", () => {
    expect(row_matches_search("Ada", true, ["name", "ada"])).toBe(false)
    expect(row_matches_search("Ada", true, ["name", "Ada"])).toBe(true)
  })

  test("value_preview_text stringifies nested data shallowly", () => {
    expect(value_preview_text({ a: 1, b: 2, c: 3 })).toBe("{a: 1, b: 2, …}")
  })
})

describe("type change actions", () => {
  test("offers convert and default for object → array", () => {
    const current = object({ properties: [] })
    const value = { x: 1 }
    const actions = type_change_actions(current, value, {})
    expect(actions.some((a) => a.target.kind === "array" && a.mode === "convert")).toBe(true)
    expect(actions.some((a) => a.target.kind === "string" && a.mode === "default")).toBe(true)
  })

  test("conversions allow-list filters menu entries", () => {
    const current = object({ properties: [] })
    const actions = type_change_actions(current, { a: 1 }, { conversions: ["array"] })
    expect(actions.every((a) => a.target.kind === "array")).toBe(true)
  })

  test("skips current kind when value already matches", () => {
    const current = string()
    const actions = type_change_actions(current, "hello", {})
    expect(actions.every((a) => a.target.kind !== "string")).toBe(true)
  })
})
