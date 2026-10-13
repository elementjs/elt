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
  const r = await page.evaluate(() => {
    const host = document.createElement("div")
    host.innerHTML = `
      <e-grid packed border><e-grid-row><e-grid id="nested"></e-grid><span id="in-packed">x</span></e-grid-row></e-grid>
      <e-grid><e-grid-row><span id="loose">x</span></e-grid-row></e-grid>`
    document.body.append(host)
    const ac = (sel: string) => getComputedStyle(host.querySelector(sel)!).alignContent
    return { nested: ac("#nested"), packed: ac("#in-packed"), loose: ac("#loose") }
  })
  expect(r).toEqual({ nested: "normal", packed: "safe center", loose: "normal" })
})
