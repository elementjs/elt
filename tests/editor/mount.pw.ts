import { expect, test } from "../fixture"

// INVALID_MOUNT is a unique symbol — it can't survive structured-clone serialization back to
// Node, so every comparison against it happens inside the page.evaluate callback and only a
// boolean crosses the wire.
test.describe("mount safe-child", () => {
  test("safe_object_child, safe_array_index and safe_map_key read INVALID_MOUNT once their entry is gone", async ({
    page,
  }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { INVALID_MOUNT, is_valid_mount, safe_object_child, safe_array_index, safe_map_key } = window.__ELT__.Editor
      const o_obj = o<unknown>({ a: 1, b: 2 })
      const o_child = safe_object_child(o_obj, "a")
      const initialIsOne = o_child.get() === 1
      o_obj.set({ b: 2 } as any)
      const afterRemove = o_child.get()

      const o_arr = o<unknown>([10, 20, 30])
      const o_row = safe_array_index(o_arr, 2)
      const initialIsThirty = o_row.get() === 30
      o_arr.set([10, 20])

      const o_map = o<unknown>(new Map([["x", 1]]))
      const o_key = safe_map_key(o_map, o("x"))
      o_map.set(new Map())
      return [
        { name: "object: initial value is 1", actual: initialIsOne, expected: true },
        { name: "object: after remove is INVALID_MOUNT", actual: afterRemove === INVALID_MOUNT, expected: true },
        { name: "is_valid_mount is false", actual: is_valid_mount(afterRemove), expected: false },
        { name: "array: initial value is 30", actual: initialIsThirty, expected: true },
        { name: "array: after shrink is INVALID_MOUNT", actual: o_row.get() === INVALID_MOUNT, expected: true },
        { name: "map: after removal is INVALID_MOUNT", actual: o_key.get() === INVALID_MOUNT, expected: true },
      ]
    })
    for (const r of results) expect(r.actual, r.name).toBe(r.expected)
  })

  test("safe_map_key renames the entry when the key value changes", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o } = window.__ELT__
      const { safe_map_key } = window.__ELT__.Editor
      const o_map = o<unknown>(new Map<string, number>([["a", 1]]))
      const o_key = safe_map_key(o_map, o("a"))
      const initial = o_key.get()
      o_key.set("b")
      const map = o_map.get()
      if (!(map instanceof Map)) throw new Error("the map was replaced by something else")
      return [
        { name: "initial key is a", actual: initial, expected: "a" },
        { name: "old key gone", actual: map.has("a"), expected: false },
        { name: "new key has value", actual: map.get("b"), expected: 1 },
      ]
    })
    for (const r of results) expect(r.actual, r.name).toBe(r.expected)
  })
})
