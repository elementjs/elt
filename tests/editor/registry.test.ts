///<reference types="bun">
import "../setup.ts"

import { describe, expect, test } from "bun:test"

import { anything, map, string } from "../../editor/schema"
import { register_constructor, resolve_factory_from_value } from "../../editor/registry"

describe("constructor registry", () => {
  test("resolve_factory_from_value returns fallback for null and primitives", () => {
    expect(resolve_factory_from_value(null, anything)).toBe(anything)
    expect(resolve_factory_from_value("x", anything)).toBe(anything)
  })

  test("resolve_factory_from_value uses a registered constructor", () => {
    class DemoBox {}
    const factory = string()
    register_constructor(DemoBox, factory)
    expect(resolve_factory_from_value(new DemoBox(), anything)).toBe(factory)
  })

  test("builtin Map resolves to the default map factory", () => {
    const resolved = resolve_factory_from_value(new Map([["a", 1]]), anything)
    expect(resolved.kind).toBe("map")
    expect(resolved).not.toBe(anything)
  })

  test("register_constructor can override a builtin default", () => {
    class TaggedMap extends Map {}
    const custom = map({ keys: string(), values: string() })
    register_constructor(TaggedMap, custom)
    expect(resolve_factory_from_value(new TaggedMap([["k", "v"]]), anything)).toBe(custom)
  })
})
