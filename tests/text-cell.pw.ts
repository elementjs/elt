import { type Page, expect, test } from "./fixture"

// A text cell of a packed container is centered in its height, as a button's text is (ui/layout.css.tsx,
// "cells read at the size of controls"): a stretched row takes the height of its tallest control, and a
// text cell used to start at the top of it, a couple of pixels above the text of the controls around.
// It shows with a small step (`nudge-4`, the editor's): a text cell is then padded less than the controls,
// which keep the widget step for themselves.

// Mounts `html` and returns where the first line's baseline of the first two children of its `row`
// sits, found by a zero-size inline-block put in front of their text.
async function baselines(page: Page, html: string, row: string) {
  return page.evaluate(
    ({ html, row }) => {
      const host = document.createElement("div")
      host.innerHTML = html
      document.body.append(host)
      const baseline = (el: Element) => {
        const probe = document.createElement("span")
        probe.style.cssText = "display:inline-block;width:0;height:0"
        el.insertBefore(probe, el.firstChild)
        const y = probe.getBoundingClientRect().bottom
        probe.remove()
        return y
      }
      const [text, button] = [...host.querySelector(row)!.children]
      return { text: baseline(text!), button: baseline(button!), height: button!.getBoundingClientRect().height }
    },
    { html, row },
  )
}

const CELLS = [
  ["a plain span", `<span>Key</span>`],
  ["an ellipsis span", `<span e-ellipsis>Key</span>`],
  ["a strong", `<strong>Key</strong>`],
]

for (const [name, cell] of CELLS) {
  test(`packed grid: ${name} has its text on the baseline of the button beside it`, async ({ page }) => {
    const r = await baselines(
      page,
      `<e-grid packed="nudge-4" border style="grid-template-columns: max-content max-content">
        <e-grid-row>${cell}<button>Edit</button></e-grid-row>
      </e-grid>`,
      "e-grid-row",
    )
    expect(r.height).toBeGreaterThan(20)
    expect(Math.abs(r.text - r.button)).toBeLessThan(0.75)
  })
}

test("packed row of a stretched flex container: the same", async ({ page }) => {
  const r = await baselines(
    page,
    `<e-row packed="nudge-4" border align="stretch"><span>Key</span><button>Edit</button></e-row>`,
    "e-row",
  )
  expect(Math.abs(r.text - r.button)).toBeLessThan(0.75)
})

test("only text elements are centered: a nested grid cell and an unpacked span are left alone", async ({ page }) => {
  // Each row has a tall cell beside the one checked, which is stretched to its height. The gaps above and
  // below the checked content tell where it sits: equal when centered, none above when left at the top.
  const r = await page.evaluate(() => {
    const host = document.createElement("div")
    const tall = `<div style="height: 80px"></div>`
    host.innerHTML = `
      <e-grid packed border style="grid-template-columns: repeat(3, max-content)"><e-grid-row><e-grid id="nested"><span id="in-nested">x</span></e-grid><span id="in-packed">x</span>${tall}</e-grid-row></e-grid>
      <e-grid style="grid-template-columns: repeat(2, max-content)"><e-grid-row><span id="loose">x</span>${tall}</e-grid-row></e-grid>`
    document.body.append(host)
    // The text's line box, found by a zero-width inline-block as tall as the line, put in front of it
    const text_box = (el: Element) => {
      const probe = document.createElement("span")
      probe.style.cssText = "display: inline-block; width: 0; height: 1lh; vertical-align: top"
      el.insertBefore(probe, el.firstChild)
      const b = probe.getBoundingClientRect()
      probe.remove()
      return b
    }
    const gaps = (cell: string, content: DOMRect) => {
      const c = host.querySelector(cell)!
      const cs = getComputedStyle(c)
      const b = c.getBoundingClientRect()
      return {
        stretched: b.height > 60,
        above: Math.round(
          content.top - b.top - Number.parseFloat(cs.paddingTop) - Number.parseFloat(cs.borderTopWidth),
        ),
        below: Math.round(
          b.bottom - content.bottom - Number.parseFloat(cs.paddingBottom) - Number.parseFloat(cs.borderBottomWidth),
        ),
      }
    }
    return {
      packed: gaps("#in-packed", text_box(host.querySelector("#in-packed")!)),
      nested: gaps("#nested", host.querySelector("#in-nested")!.getBoundingClientRect()),
      loose: gaps("#loose", text_box(host.querySelector("#loose")!)),
    }
  })
  expect(r.packed.stretched).toBe(true)
  expect(Math.abs(r.packed.above - r.packed.below)).toBeLessThanOrEqual(1)
  expect(r.nested).toMatchObject({ stretched: true, above: 0 })
  expect(r.loose).toMatchObject({ stretched: true, above: 0 })
})
