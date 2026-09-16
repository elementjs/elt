///<reference types="bun">
import "../setup.ts"

import { describe, expect, test } from "bun:test"

import { o } from "../../src"
import { INVALID_MOUNT, is_valid_mount, safe_array_index, safe_map_key, safe_object_child } from "../../editor/mount"

describe("mount safe-child", () => {
  test("safe_object_child returns INVALID_MOUNT when key is removed", () => {
    const o_obj = o({ a: 1, b: 2 })
    const o_child = safe_object_child(o_obj, "a")
    expect(o_child.get()).toBe(1)
    o_obj.set({ b: 2 })
    expect(o_child.get()).toBe(INVALID_MOUNT)
    expect(is_valid_mount(o_child.get())).toBe(false)
  })

  test("safe_array_index returns INVALID_MOUNT when index falls off the array", () => {
    const o_arr = o([10, 20, 30])
    const o_row = safe_array_index(o_arr, 2)
    expect(o_row.get()).toBe(30)
    o_arr.set([10, 20])
    expect(o_row.get()).toBe(INVALID_MOUNT)
  })

  test("safe_object_child writes back through the parent", () => {
    const o_obj = o({ name: "Ada" })
    const o_name = safe_object_child(o_obj, "name")
    o_name.set("Grace")
    expect(o_obj.get().name).toBe("Grace")
  })

  test("safe_map_key renames the entry when the key value changes", () => {
    const o_map = o(new Map<string, number>([["a", 1]]))
    const o_key = safe_map_key(o_map, "a")
    expect(o_key.get()).toBe("a")
    o_key.set("b")
    expect(o_map.get().has("a")).toBe(false)
    expect(o_map.get().get("b")).toBe(1)
  })

  test("safe_map_key returns INVALID_MOUNT when the entry is removed", () => {
    const o_map = o(new Map([["x", 1]]))
    const o_key = safe_map_key(o_map, "x")
    o_map.set(new Map())
    expect(o_key.get()).toBe(INVALID_MOUNT)
  })
})
