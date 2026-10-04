import { expect, test } from "../fixture"

// INVALID_MOUNT is a unique symbol — it can't survive structured-clone serialization back to
// Node, so every comparison against it happens inside the page.evaluate callback and only a
// boolean crosses the wire.
test.describe("mount safe-child", () => {
  test("safe_object_child returns INVALID_MOUNT when key is removed", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { INVALID_MOUNT, is_valid_mount, safe_object_child } = window.__ELT__.Editor
      const o_obj = o({ a: 1, b: 2 })
      const o_child = safe_object_child(o_obj, "a")
      const initialIsOne = o_child.get() === 1
      o_obj.set({ b: 2 } as any)
      const afterRemove = o_child.get()
      return [
        { name: "initial value is 1", actual: initialIsOne, expected: true },
        { name: "after remove is INVALID_MOUNT", actual: afterRemove === INVALID_MOUNT, expected: true },
        { name: "is_valid_mount is false", actual: is_valid_mount(afterRemove), expected: false },
      ]
    })
    for (const r of results) expect(r.actual, r.name).toBe(r.expected)
  })

  test("safe_array_index returns INVALID_MOUNT when index falls off the array", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { INVALID_MOUNT, safe_array_index } = window.__ELT__.Editor
      const o_arr = o([10, 20, 30])
      const o_row = safe_array_index(o_arr, 2)
      const initialIsThirty = o_row.get() === 30
      o_arr.set([10, 20])
      const afterShrinkIsInvalid = o_row.get() === INVALID_MOUNT
      return [
        { name: "initial value is 30", actual: initialIsThirty, expected: true },
        { name: "after shrink is INVALID_MOUNT", actual: afterShrinkIsInvalid, expected: true },
      ]
    })
    for (const r of results) expect(r.actual, r.name).toBe(r.expected)
  })

  test("safe_object_child writes back through the parent", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { safe_object_child } = window.__ELT__.Editor
      const o_obj = o({ name: "Ada" })
      const o_name = safe_object_child(o_obj, "name")
      o_name.set("Grace")
      return o_obj.get().name
    })
    expect(result).toBe("Grace")
  })

  test("safe_map_key renames the entry when the key value changes", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { safe_map_key } = window.__ELT__.Editor
      const o_map = o(new Map<string, number>([["a", 1]]))
      const o_key = safe_map_key(o_map, "a")
      const initial = o_key.get()
      o_key.set("b")
      return [
        { name: "initial key is a", actual: initial, expected: "a" },
        { name: "old key gone", actual: o_map.get().has("a"), expected: false },
        { name: "new key has value", actual: o_map.get().get("b"), expected: 1 },
      ]
    })
    for (const r of results) expect(r.actual, r.name).toBe(r.expected)
  })

  test("safe_map_key returns INVALID_MOUNT when the entry is removed", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { INVALID_MOUNT, safe_map_key } = window.__ELT__.Editor
      const o_map = o(new Map([["x", 1]]))
      const o_key = safe_map_key(o_map, "x")
      o_map.set(new Map())
      return o_key.get() === INVALID_MOUNT
    })
    expect(result).toBe(true)
  })
})
