import { type Page, expect, test } from "./fixture"

// `e-widget="tab"` and `e-widget="tab-close"` (docs/md/ui-states.md#tabs): a line along the bottom edge,
// dim at rest and full color in the selected state, drawn as an inset shadow so the box never changes
// size; a focused tab has its focus ring under the line.

async function mount(page: Page, html: string) {
  await page.evaluate((html) => {
    const host = document.createElement("div")
    host.id = "host"
    host.innerHTML = html
    document.body.append(host)
  }, html)
}

const image = (page: Page, sel: string) =>
  page.evaluate((sel) => getComputedStyle(document.querySelector(sel)!).boxShadow, sel)

const strip = `
  <e-row packed>
    <button id="a" e-widget="tab" aria-pressed="true">A</button>
    <button id="a-x" e-widget="tab-close" aria-label="Close A">x</button>
    <button id="b" e-widget="tab" aria-pressed="false">B</button>
    <button id="b-x" e-widget="tab-close" aria-label="Close B">x</button>
    <button id="c" e-widget="tab" aria-pressed="false">C</button>
  </e-row>`

test.describe("line", () => {
  test("every tab draws a line; the selected one is drawn in another color than the others", async ({ page }) => {
    await mount(page, strip)
    const [a, b, c] = await Promise.all(["#a", "#b", "#c"].map((s) => image(page, s)))
    expect(a).not.toBe("none")
    expect(b).not.toBe("none")
    expect(a).not.toBe(b)
    expect(b).toBe(c)
  })

  test("the selected tab's line is the color of its selected border", async ({ page }) => {
    await mount(page, strip)
    const [line, border] = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector("#a")!)
      return [cs.boxShadow, cs.borderTopColor]
    })
    expect(line).toContain(border!)
  })

  test("the close button follows its tab: full line after the selected tab, dim after another, and only it", async ({
    page,
  }) => {
    await mount(page, strip)
    const img = Object.fromEntries(
      await Promise.all(["#a", "#a-x", "#b", "#b-x", "#c"].map(async (s) => [s, await image(page, s)])),
    )
    expect(img["#a-x"]).toBe(img["#a"])
    expect(img["#b-x"]).toBe(img["#b"])
    // The tab that comes after the selected tab's close button is not drawn as selected.
    expect(img["#b"]).not.toBe(img["#a"])
  })

  test("a tab right after the selected tab is not drawn as its close button", async ({ page }) => {
    await mount(
      page,
      `<e-row packed><button id="a" e-widget="tab" aria-pressed="true">A</button><button id="b" e-widget="tab" aria-pressed="false">B</button></e-row>`,
    )
    expect(await image(page, "#b")).not.toBe(await image(page, "#a"))
  })

  test("the tint emphasis draws its dim line in the tint family", async ({ page }) => {
    await mount(
      page,
      `<e-row><button id="n" e-widget="tab">N</button><button id="t" e-widget="tab" e-emphasis="tint">T</button></e-row>`,
    )
    expect(await image(page, "#n")).not.toBe(await image(page, "#t"))
  })

  test("link and inverted tabs draw no line", async ({ page }) => {
    await mount(
      page,
      `<e-row><button id="l" e-widget="tab" e-emphasis="link" aria-pressed="true">L</button><button id="i" e-widget="tab" e-emphasis="inverted" aria-pressed="true">I</button></e-row>`,
    )
    expect(await image(page, "#l")).toBe("none")
    expect(await image(page, "#i")).toBe("none")
  })

  test("a bare tab draws it too, and a selected disabled tab's close button is neutral like it", async ({ page }) => {
    await mount(
      page,
      `<e-row><button id="b" e-widget="tab" e-emphasis="bare" aria-pressed="true">B</button>
       <button id="d" e-widget="tab" aria-pressed="true" disabled>D</button><button id="d-x" e-widget="tab-close" aria-label="x">x</button></e-row>`,
    )
    expect(await image(page, "#b")).not.toBe("none")
    expect(await image(page, "#d-x")).toBe(await image(page, "#d"))
  })
})

test.describe("the close button is selected with its tab", () => {
  const style = (page: Page, sel: string) =>
    page.evaluate((sel) => {
      const cs = getComputedStyle(document.querySelector(sel)!)
      return { fill: cs.backgroundColor, border: cs.borderTopColor }
    }, sel)

  test("it has the tab's fill and border; the close button of another tab and the next tab do not", async ({
    page,
  }) => {
    await mount(page, strip)
    const [a, ax, b, bx] = await Promise.all(["#a", "#a-x", "#b", "#b-x"].map((s) => style(page, s)))
    expect(ax).toEqual(a)
    expect(bx).toEqual(b)
    expect(b!.fill).not.toBe(a!.fill)
  })

  test("it follows the tab when the selection moves", async ({ page }) => {
    await mount(page, strip)
    const before = await style(page, "#b-x")
    await page.evaluate(() => {
      document.querySelector("#a")!.setAttribute("aria-pressed", "false")
      document.querySelector("#b")!.setAttribute("aria-pressed", "true")
    })
    expect(await style(page, "#b-x")).not.toEqual(before)
    expect(await style(page, "#b-x")).toEqual(await style(page, "#b"))
    expect(await style(page, "#a-x")).toEqual(await style(page, "#a"))
  })

  test("it is neutral like its disabled tab, and unfilled for a link tab", async ({ page }) => {
    await mount(
      page,
      `<e-row><button id="d" e-widget="tab" aria-pressed="true" disabled>D</button><button id="d-x" e-widget="tab-close" aria-label="x">x</button>
       <button id="l" e-widget="tab" e-emphasis="link" aria-pressed="true">L</button><button id="l-x" e-widget="tab-close" aria-label="x">x</button>
       <button id="o" e-widget="tab-close" aria-label="x">x</button></e-row>`,
    )
    expect(await style(page, "#d-x")).toEqual(await style(page, "#d"))
    expect(await style(page, "#l-x")).toEqual(await style(page, "#o"))
  })
})

test.describe("closable tab in a row of its own", () => {
  const pairs = `
    <e-row packed>
      <e-row packed seams="none"><button id="a" e-widget="tab" aria-pressed="true">A</button><button id="a-x" e-widget="tab-close" aria-label="x">x</button></e-row>
      <e-row packed seams="none"><button id="b" e-widget="tab" aria-pressed="false">B</button><button id="b-x" e-widget="tab-close" aria-label="x">x</button></e-row>
    </e-row>`

  test("no line shows between a tab and its close button, selected or not", async ({ page }) => {
    await mount(page, pairs)
    const edge = (sel: string, side: string) =>
      page.evaluate(
        ({ sel, side }) => getComputedStyle(document.querySelector(sel)!).getPropertyValue(`border-${side}-width`),
        { sel, side },
      )
    for (const t of ["#a", "#b"]) expect(await edge(t, "right")).toBe("0px")
    for (const x of ["#a-x", "#b-x"]) expect(await edge(x, "left")).toBe("0px")
  })

  test("the close button still takes its tab's fill and line, and a pair after the selected one does not", async ({
    page,
  }) => {
    await mount(page, pairs)
    expect(await image(page, "#a-x")).toBe(await image(page, "#a"))
    expect(await image(page, "#b-x")).toBe(await image(page, "#b"))
    expect(await image(page, "#b")).not.toBe(await image(page, "#a"))
    const fill = (sel: string) =>
      page.evaluate((sel) => getComputedStyle(document.querySelector(sel)!).backgroundColor, sel)
    expect(await fill("#a-x")).toBe(await fill("#a"))
    expect(await fill("#b-x")).toBe(await fill("#b"))
  })
})

test.describe("stays through interaction", () => {
  test("hover and press keep the line of a selected tab", async ({ page }) => {
    await mount(page, strip)
    const rest = await image(page, "#a")
    await page.hover("#a")
    expect(await image(page, "#a")).toBe(rest)
    await page.mouse.down()
    expect(await image(page, "#a")).toBe(rest)
    await page.mouse.up()
  })

  test("hover keeps the dim line of an inactive tab", async ({ page }) => {
    await mount(page, strip)
    const rest = await image(page, "#c")
    await page.hover("#c")
    expect(await image(page, "#c")).toBe(rest)
  })

  // Shadows paint first-on-top: the line must be the first, or the inset ring would hide it along the bottom edge.
  test("a focused tab has the focus ring under its unchanged line", async ({ page }) => {
    await mount(page, strip)
    const rest = await image(page, "#a")
    await page.keyboard.press("Tab")
    const r = await page.evaluate(async () => {
      const el = document.querySelector("#a")!
      // The shadow transitions in; read it once it has settled.
      await Promise.all(document.getAnimations().map((a) => a.finished))
      return { focused: document.activeElement === el, shadow: getComputedStyle(el).boxShadow }
    })
    expect(r.focused).toBe(true)
    expect(r.shadow.startsWith(rest)).toBe(true)
    expect(r.shadow.length).toBeGreaterThan(rest.length)
    expect(r.shadow.match(/inset/g)).toHaveLength(2)
  })
})

// The line is a background, so it adds nothing to the boxes. (Inside a packed row, the selected child
// keeps the border it shares with its neighbor, so single widths move by a pixel between neighbors: that
// is the packed container's, docs/md/ui-layout.md#packed. The row as a whole and the heights stay.)
test("selecting a tab does not change the row's size or its tabs' height", async ({ page }) => {
  await mount(page, strip)
  const sizes = () =>
    page.evaluate(() => {
      const heights = ["#a", "#a-x", "#b", "#b-x", "#c"].map(
        (s) => document.querySelector(s)!.getBoundingClientRect().height,
      )
      const row = document.querySelector("#host > e-row")!.getBoundingClientRect()
      return { heights, row: [row.width, row.height] }
    })
  const before = await sizes()
  await page.evaluate(() => {
    document.querySelector("#a")!.setAttribute("aria-pressed", "false")
    document.querySelector("#b")!.setAttribute("aria-pressed", "true")
  })
  expect(await sizes()).toEqual(before)
})

test("the tab is also selected through aria-selected", async ({ page }) => {
  await mount(
    page,
    `<e-row><button id="a" e-widget="tab" aria-selected="true">A</button><button id="b" e-widget="tab" aria-selected="false">B</button></e-row>`,
  )
  expect(await image(page, "#a")).not.toBe(await image(page, "#b"))
})
