import { type Page, expect, test } from "./fixture"

// `e-widget="label"` (docs/md/ui-states.md#widgets): static text that names what is next to it. Loose,
// it has no box and sits on its neighbors' baseline; in a packed container it is a filled cell.

async function mount(page: Page, html: string) {
  await page.evaluate((html) => {
    const host = document.createElement("div")
    host.id = "host"
    host.innerHTML = html
    document.body.append(host)
  }, html)
}

const style = (page: Page, sel: string, props: string[]) =>
  page.evaluate(
    ({ sel, props }) => {
      const cs = getComputedStyle(document.querySelector(sel)!)
      return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]))
    },
    { sel, props },
  )

test.describe("loose", () => {
  test("is bold and fainter than the text around, at the controls' size, with no box", async ({ page }) => {
    await mount(page, `<e-row><span id="l" e-widget="label">Name</span><span id="t">Value</span><input id="i"></e-row>`)
    const [l, t, i] = await Promise.all(
      ["#l", "#t", "#i"].map((sel) =>
        style(page, sel, ["color", "font-size", "font-weight", "padding-top", "background-color", "border-top-width"]),
      ),
    )
    expect(l!.color).not.toBe(t!.color)
    expect(Number(l!["font-weight"])).toBeGreaterThan(Number(t!["font-weight"]))
    expect(l!["font-size"]).toBe(i!["font-size"])
    expect(l!["padding-top"]).toBe("0px")
    expect(l!["border-top-width"]).toBe("0px")
    expect(l!["background-color"]).toBe("rgba(0, 0, 0, 0)")
  })

  test("is on the baseline of the field beside it in an unpacked grid", async ({ page }) => {
    await mount(
      page,
      `<e-grid align="baseline" style="grid-template-columns: max-content 12em">
        <e-grid-row><span id="l" e-widget="label">date_of_birth</span><button id="b">Edit</button></e-grid-row>
      </e-grid>`,
    )
    const r = await page.evaluate(() => {
      const baseline = (el: Element) => {
        const probe = document.createElement("span")
        probe.style.cssText = "display:inline-block;width:0;height:0"
        el.insertBefore(probe, el.firstChild)
        const y = probe.getBoundingClientRect().bottom
        probe.remove()
        return y
      }
      return { l: baseline(document.querySelector("#l")!), b: baseline(document.querySelector("#b")!) }
    })
    expect(Math.abs(r.l - r.b)).toBeLessThan(0.75)
  })

  test("takes any element, a label element included, and is not interactive", async ({ page }) => {
    await mount(
      page,
      `<span id="s" e-widget="label">a</span><label id="l" e-widget="label">b</label><div id="d" e-widget="label">c</div>`,
    )
    for (const sel of ["#s", "#l", "#d"]) {
      const r = await style(page, sel, ["cursor", "padding-top", "background-color"])
      expect(r, sel).toEqual({ cursor: "auto", "padding-top": "0px", "background-color": "rgba(0, 0, 0, 0)" })
    }
  })
})

test("a label element naming a field does not fill when hovered, loose or packed", async ({ page }) => {
  await mount(
    page,
    `<label id="loose" e-widget="label" for="f">Name</label><input id="f">
     <e-row packed><label id="packed" e-widget="label" for="g">Name</label><input id="g"></e-row>`,
  )
  const before = await style(page, "#packed", ["background-color"])
  await page.hover("#loose")
  expect(await style(page, "#loose", ["background-color"])).toEqual({ "background-color": "rgba(0, 0, 0, 0)" })
  await page.hover("#packed")
  expect(await style(page, "#packed", ["background-color"])).toEqual(before)
})

test.describe("packed", () => {
  const CONTAINERS: Record<string, string> = {
    "framed grid": `<e-grid packed="nudge-4" border><e-grid-row><span id="l" e-widget="label">Key</span><button id="b">Edit</button></e-grid-row></e-grid>`,
    "frameless row": `<e-row packed="nudge-4"><span id="l" e-widget="label">Key</span><button id="b">Edit</button></e-row>`,
    "framed column": `<e-column packed border align="stretch"><span id="l" e-widget="label">Key</span><button id="b">Edit</button></e-column>`,
  }

  for (const [name, html] of Object.entries(CONTAINERS)) {
    test(`${name}: the label cell is filled, its neighbor is not`, async ({ page }) => {
      await mount(page, html)
      const [l, b] = await Promise.all(["#l", "#b"].map((sel) => style(page, sel, ["background-color"])))
      expect(l!["background-color"]).not.toBe("rgba(0, 0, 0, 0)")
      expect(l!["background-color"]).not.toBe(b!["background-color"])
    })
  }

  test("the fill marks it, so its text is not bold", async ({ page }) => {
    await mount(page, `<e-row packed><span id="l" e-widget="label">Key</span><input></e-row><span id="t">Value</span>`)
    const [l, t] = await Promise.all(["#l", "#t"].map((sel) => style(page, sel, ["font-weight"])))
    expect(l!["font-weight"]).toBe(t!["font-weight"])
  })

  test("the fill is one level above the ambient surface, in the neutral family", async ({ page }) => {
    await mount(
      page,
      `<e-row packed><span id="l1" e-widget="label">a</span></e-row>
       <e-column surface="neutral-2"><e-row packed><span id="l2" e-widget="label">a</span></e-row></e-column>
       <e-column surface="tint-2"><e-row packed><span id="l3" e-widget="label">a</span></e-row></e-column>`,
    )
    const [a, b, c] = await Promise.all(["#l1", "#l2", "#l3"].map((sel) => style(page, sel, ["background-color"])))
    // Higher up the stack, a different fill; a tinted ambient surface does not tint the label's.
    expect(a!["background-color"]).not.toBe(b!["background-color"])
    expect(b!["background-color"]).not.toBe("rgba(0, 0, 0, 0)")
    expect(c!["background-color"]).not.toBe("rgba(0, 0, 0, 0)")
  })

  test("the label's text is centered like a plain text cell's", async ({ page }) => {
    await mount(
      page,
      `<e-grid packed="nudge-4" border><e-grid-row><span id="l" e-widget="label">Key</span><button id="b">Edit</button></e-grid-row></e-grid>`,
    )
    const r = await style(page, "#l", ["align-content"])
    expect(r["align-content"]).toBe("safe center")
  })
})
