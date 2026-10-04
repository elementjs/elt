import { expect, type Page, test } from "./fixture"

/*
 * Selected items and checked toggles are a choice, drawn as a tint surface jump (ambient + 3, + 4 when
 * hovered or keyboard-active), never as an inversion (docs/md/ui-theme.md, Emphasis).
 */

/** The background of `selector`, and of a probe painted with `tint.surface(level)` in the same place. */
async function fill(page: Page, selector: string, level: `n+${number}`) {
  return page.evaluate(
    ({ selector, level }) => {
      const { theme } = window.__ELT__.UI
      const el = document.querySelector(selector) as HTMLElement
      const ref = document.createElement("div")
      ref.style.backgroundColor = theme.colors.tint.surface(level)
      el.parentElement!.appendChild(ref)
      const out = { bg: getComputedStyle(el).backgroundColor, ref: getComputedStyle(ref).backgroundColor }
      ref.remove()
      return out
    },
    { selector, level },
  )
}

test.describe("selected", () => {
  async function open_select(page: Page) {
    await page.evaluate(() => {
      const { o, node_append, UI } = window.__ELT__
      const select = UI.Select<string, string>({ model: o("Banana"), options: ["Apple", "Banana", "Cherry"] })
      const holder = document.createElement("div")
      holder.id = "holder"
      node_append(document.body, holder)
      node_append(holder, select)
    })
    await page.click("#holder button")
    await page.waitForSelector('[role="listbox"]')
  }

  test("a selected Select option is tint + 3, not inverted; its text keeps the text color", async ({ page }) => {
    await open_select(page)
    // Opening makes the selected option active: move the keyboard away to see it at rest.
    await page.keyboard.press("ArrowDown")
    const r = await fill(page, '[role="option"][aria-selected="true"]', "n+3")
    expect(r.bg).toBe(r.ref)
    const colors = await page.evaluate(() => {
      const el = document.querySelector('[role="option"][aria-selected="true"]')!
      const ref = document.createElement("span")
      ref.style.color = window.__ELT__.UI.theme.colors.text.toString()
      el.parentElement!.appendChild(ref)
      return { color: getComputedStyle(el).color, ref: getComputedStyle(ref).color }
    })
    expect(colors.color).toBe(colors.ref)
  })

  test("a selected option that is also keyboard-active goes one level further (+ 4)", async ({ page }) => {
    await open_select(page)
    await page.mouse.move(0, 0)
    const r = await fill(page, '[role="option"][aria-selected="true"][data-active]', "n+4")
    expect(r.bg).toBe(r.ref)
  })

  test("a hovered selected option goes one level further (+ 4)", async ({ page }) => {
    await open_select(page)
    await page.hover('[role="option"][aria-selected="true"]')
    const r = await fill(page, '[role="option"][aria-selected="true"]', "n+4")
    expect(r.bg).toBe(r.ref)
  })

  test("a selected day of the date picker is tint + 3", async ({ page }) => {
    await page.evaluate(() => {
      const { o, node_append, UI } = window.__ELT__
      const holder = document.createElement("div")
      holder.id = "holder"
      node_append(document.body, holder)
      node_append(holder, UI.DateTimePicker({ model: o<Date | null>(new Date(2026, 9, 3)) }))
    })
    await page.click("#holder button")
    await page.waitForSelector(".selected")
    await page.mouse.move(0, 0)
    const r = await fill(page, ".selected", "n+3")
    expect(r.bg).toBe(r.ref)
  })
})

test.describe("checked toggle", () => {
  test("is tint + 3 with a full tint border, not the inverted fill of the dominant action", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-row id="row"><label e-variant="toggle"><input type="checkbox" checked>Aa</label><button e-variant="inverted">Go</button></e-row>`,
      )
      const label = document.querySelector("#row > label")!
      const ref = document.createElement("div")
      ref.style.backgroundColor = theme.colors.tint.surface("n+3")
      ref.style.borderColor = theme.colors.tint.toString()
      document.querySelector("#row")!.appendChild(ref)
      const cs = getComputedStyle(label)
      return {
        bg: cs.backgroundColor,
        border: cs.borderTopColor,
        ref_bg: getComputedStyle(ref).backgroundColor,
        ref_border: getComputedStyle(ref).borderTopColor,
        inverted_bg: getComputedStyle(document.querySelector("#row > button")!).backgroundColor,
      }
    })
    expect(r.bg).toBe(r.ref_bg)
    expect(r.border).toBe(r.ref_border)
    expect(r.bg).not.toBe(r.inverted_bg)
  })
})

test.describe("e-ellipsis", () => {
  test("cuts a title that doesn't fit in a one-line bar, without growing the bar", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-row id="bar" style="width: 200px"><h2 e-ellipsis>${"A very long title ".repeat(10)}</h2><button>Save</button></e-row>`,
      )
      const bar = document.getElementById("bar")!
      const h2 = bar.querySelector("h2")!
      const button = bar.querySelector("button")!
      const cs = getComputedStyle(h2)
      return {
        overflowing: h2.scrollWidth > h2.clientWidth,
        text_overflow: cs.textOverflow,
        // Cut sideways only: a vertical cut would clip the descenders of a tightly set heading.
        overflow_y: cs.overflowY,
        bar_overflow: bar.scrollWidth > bar.clientWidth,
        button_in_bar: button.getBoundingClientRect().right <= bar.getBoundingClientRect().right,
        // The button keeps its label's width: the title takes the shrinking.
        button_fits: button.scrollWidth <= Math.ceil(button.getBoundingClientRect().width),
        one_line:
          h2.getBoundingClientRect().height < 2 * Number.parseFloat(cs.lineHeight || "0") || cs.whiteSpace === "nowrap",
      }
    })
    expect(r.overflowing).toBe(true)
    expect(r.text_overflow).toBe("ellipsis")
    expect(r.overflow_y).toBe("visible")
    expect(r.bar_overflow).toBe(false)
    expect(r.button_in_bar).toBe(true)
    expect(r.button_fits).toBe(true)
    expect(r.one_line).toBe(true)
  })

  test("in a <header> (not a layout element): the title is cut and the buttons go to the end", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<div style="width: 320px"><header id="h"><h2 e-ellipsis>${"A long title ".repeat(10)}</h2><button>Share</button></header></div>
         <div style="width: 900px"><header id="wide"><h2 e-ellipsis>Short</h2><button>Share</button></header></div>`,
      )
      const h = document.getElementById("h")!
      const wide = document.getElementById("wide")!
      const end = (bar: HTMLElement) =>
        Math.round(bar.getBoundingClientRect().right - bar.querySelector("button")!.getBoundingClientRect().right)
      return {
        bar_overflow: h.scrollWidth > h.clientWidth,
        title_cut: h.querySelector("h2")!.scrollWidth > h.querySelector("h2")!.clientWidth,
        // distance from the button to the bar's edge: its padding only, whatever the title's length
        end_narrow: end(h),
        end_wide: end(wide),
      }
    })
    expect(r.bar_overflow).toBe(false)
    expect(r.title_cut).toBe(true)
    expect(r.end_wide).toBe(r.end_narrow)
  })

  test("works on an inline element outside a flex container", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<div id="box" style="width: 120px"><span e-ellipsis>${"word ".repeat(40)}</span></div>`,
      )
      const span = document.querySelector("#box > span") as HTMLElement
      return { overflowing: span.scrollWidth > span.clientWidth, width: span.getBoundingClientRect().width }
    })
    expect(r.overflowing).toBe(true)
    expect(r.width).toBeLessThanOrEqual(120)
  })
})

test.describe("bands", () => {
  test("a <header> in a packed bordered column (a dialog's frame) keeps its tint-inverted fill", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-column id="frame" surface="background" border packed><header><h1 e-ellipsis>Title</h1></header><e-prose pad="component">Body</e-prose></e-column>`,
      )
      const ref = document.createElement("div")
      ref.style.backgroundColor = "var(--e-light-color-tint)"
      document.body.appendChild(ref)
      return {
        header: getComputedStyle(document.querySelector("#frame > header")!).backgroundColor,
        ref: getComputedStyle(ref).backgroundColor,
      }
    })
    expect(r.header).toBe(r.ref)
  })
})
