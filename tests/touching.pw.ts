import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("BORDERED_SELECTOR (ui/selectors.ts)", () => {
  test("native controls that render a border by default all match", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { BORDERED_SELECTOR } = window.__ELT__
      return ["<button>x</button>", '<input type="text">', "<select></select>", "<textarea></textarea>", '<input type="checkbox">'].map((html) => {
        const wrapper = document.createElement("div")
        wrapper.innerHTML = html
        return wrapper.firstElementChild!.matches(BORDERED_SELECTOR)
      })
    })
    expect(results).toEqual([true, true, true, true, true])
  })

  test("button[e-variant=link]/[e-variant=text] never match — they render no border", async ({ page }) => {
    const [link, text] = await page.evaluate(() => {
      const { BORDERED_SELECTOR } = window.__ELT__
      const link = document.createElement("button")
      link.setAttribute("e-variant", "link")
      const text = document.createElement("button")
      text.setAttribute("e-variant", "text")
      return [link.matches(BORDERED_SELECTOR), text.matches(BORDERED_SELECTOR)]
    })
    expect(link).toBe(false)
    expect(text).toBe(false)
  })

  test("[border] is the open extension point for anything else, elt-internal or a consumer's own component", async ({ page }) => {
    const [before, after] = await page.evaluate(() => {
      const { BORDERED_SELECTOR } = window.__ELT__
      const el = document.createElement("my-custom-widget")
      const before = el.matches(BORDERED_SELECTOR)
      el.setAttribute("border", "")
      return [before, el.matches(BORDERED_SELECTOR)]
    })
    expect(before).toBe(false)
    expect(after).toBe(true)
  })

  test("a toggle-icon label (label[e-variant=toggle]) matches — plain attribute, no :has(), so it stays embeddable inside the dedup rule's own :has()", async ({ page }) => {
    const matches = await page.evaluate(() => {
      const { BORDERED_SELECTOR } = window.__ELT__
      const wrapper = document.createElement("div")
      wrapper.innerHTML = '<label e-variant="toggle"><input type="checkbox"></label>'
      return wrapper.firstElementChild!.matches(BORDERED_SELECTOR)
    })
    expect(matches).toBe(true)
  })
})

test.describe("touching seam dedup (specs/elt-ui-guidelines.md, Padding and boundaries, rule 3)", () => {
  test("row: two bordered buttons — earlier one's trailing edge suppressed, later one's leading edge stays", async ({ page }) => {
    const [aRight, bLeft] = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("touching", "")
      const a = document.createElement("button")
      a.textContent = "a"
      const b = document.createElement("button")
      b.textContent = "b"
      row.append(a, b)
      document.body.appendChild(row)
      return [getComputedStyle(a).borderRightStyle, getComputedStyle(b).borderLeftStyle]
    })
    expect(aRight).toBe("none")
    expect(bLeft).toBe("solid")
  })

  test("column: two bordered buttons — earlier one's trailing edge suppressed, later one's leading edge stays", async ({ page }) => {
    const [aBottom, bTop] = await page.evaluate(() => {
      const col = document.createElement("e-column")
      col.setAttribute("touching", "")
      const a = document.createElement("button")
      const b = document.createElement("button")
      col.append(a, b)
      document.body.appendChild(col)
      return [getComputedStyle(a).borderBottomStyle, getComputedStyle(b).borderTopStyle]
    })
    expect(aBottom).toBe("none")
    expect(bTop).toBe("solid")
  })

  test("only one side bordered: it already shows through, nothing is suppressed", async ({ page }) => {
    const aRight = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("touching", "")
      const a = document.createElement("button")
      const plain = document.createElement("div")
      row.append(a, plain)
      document.body.appendChild(row)
      return getComputedStyle(a).borderRightStyle
    })
    expect(aRight).toBe("solid")
  })

  test("two touching toggle-icon labels dedup correctly — e-variant lives on the label (plain attribute), not on the checkbox (which would need :has() to detect from outside, and :has() can't nest inside :has())", async ({ page }) => {
    const [aRight, bLeft] = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("touching", "")
      const a = document.createElement("label")
      a.setAttribute("e-variant", "toggle")
      a.innerHTML = '<input type="checkbox">'
      const b = document.createElement("label")
      b.setAttribute("e-variant", "toggle")
      b.innerHTML = '<input type="checkbox">'
      row.append(a, b)
      document.body.appendChild(row)
      return [getComputedStyle(a).borderRightStyle, getComputedStyle(b).borderLeftStyle]
    })
    expect(aRight).toBe("none")
    expect(bLeft).toBe("solid")
  })

  test("interior corner radii are zeroed regardless of border presence, outer corners untouched", async ({ page }) => {
    const result = await page.evaluate(() => {
      const row = document.createElement("e-row")
      row.setAttribute("touching", "")
      const a = document.createElement("e-block")
      const b = document.createElement("e-block")
      a.setAttribute("border", "")
      a.setAttribute("border-radius", "")
      b.setAttribute("border", "")
      b.setAttribute("border-radius", "")
      row.append(a, b)
      document.body.appendChild(row)
      const sa = getComputedStyle(a)
      const sb = getComputedStyle(b)
      return {
        aTopRight: sa.borderTopRightRadius,
        aBottomRight: sa.borderBottomRightRadius,
        aTopLeft: sa.borderTopLeftRadius,
        bTopLeft: sb.borderTopLeftRadius,
        bBottomLeft: sb.borderBottomLeftRadius,
        bBottomRight: sb.borderBottomRightRadius,
      }
    })
    expect(result.aTopRight).toBe("0px")
    expect(result.aBottomRight).toBe("0px")
    expect(result.bTopLeft).toBe("0px")
    expect(result.bBottomLeft).toBe("0px")
    // outer corners keep their real radius (nonzero — the exact value is the spacing-widget step)
    expect(result.aTopLeft).not.toBe("0px")
    expect(result.bBottomRight).not.toBe("0px")
  })
})
