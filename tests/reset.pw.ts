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
      // The browser reads the value case-insensitively: "Until-Found" is until-found too
      const found_upper = document.createElement("e-prose")
      found_upper.setAttribute("hidden", "Until-Found")
      document.body.append(found_upper)
      out.until_found_upper = getComputedStyle(found_upper).display
      found_upper.remove()
      return out
    })
    const { until_found, until_found_upper, ...rest } = r
    for (const [tag, display] of Object.entries(rest)) expect(display, tag).toBe("none")
    expect(until_found).not.toBe("none")
    expect(until_found_upper).not.toBe("none")
  })
})
