import { expect, test } from "./fixture"

// The reset layer of elt/ui (ui/reset.css.tsx).
test.describe("hidden", () => {
  test("hides every element, also those elt/ui gives a display (regression: e-prose, e-row, button… stayed visible)", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      const out: Record<string, string> = {}
      for (const tag of ["div", "e-prose", "e-row", "e-column", "e-flex", "e-grid", "button", "input"]) {
        const el = document.createElement(tag)
        el.hidden = true
        document.body.append(el)
        out[tag] = getComputedStyle(el).display
        el.remove()
      }
      // until-found stays the browser's: hidden from view but searchable, not display: none
      const found = document.createElement("e-prose")
      found.setAttribute("hidden", "until-found")
      document.body.append(found)
      out.until_found = getComputedStyle(found).display
      found.remove()
      return out
    })
    const { until_found, ...rest } = r
    for (const [tag, display] of Object.entries(rest)) expect(display, tag).toBe("none")
    expect(until_found).not.toBe("none")
  })
})
