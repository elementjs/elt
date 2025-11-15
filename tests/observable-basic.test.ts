import { test, expect, describe } from "bun:test"

describe("Basic Observable Test", () => {
  test("addition works", () => {
    expect(1 + 1).toBe(2)
  })

  test("objects are equal", () => {
    expect({ a: 1, b: 2 }).toEqual({ a: 1, b: 2 })
  })
})
