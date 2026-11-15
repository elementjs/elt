import { expect, test } from "./fixture"

test.describe("search inputs are form controls (regression: input[type=search] kept the browser's own style)", () => {
  test("same font size and text color as a text input, in dark mode too", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    const result = await page.evaluate(() => {
      const { node_append } = window.__ELT__
      const make = (type: string) => {
        const input = document.createElement("input")
        input.type = type
        node_append(document.body, input)
        const cs = getComputedStyle(input)
        return { size: cs.fontSize, color: cs.color }
      }
      return { text: make("text"), search: make("search"), email: make("email") }
    })
    expect(result.search).toEqual(result.text)
    expect(result.email).toEqual(result.text)
    expect(result.search.color).not.toBe("rgb(0, 0, 0)")
  })
})
