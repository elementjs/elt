import { type Page, expect, test } from "./fixture"

// Controls are one height whatever they hold (text, icon, number field, select, 1-line textarea), side
// by side, loose or packed, at any zoom. A text field's text line must never be taller than the room
// it is given: its inner editor is a scroll container, and an overflow of a fraction of a pixel (what
// fractional zoom produces) makes it swallow the first wheel ticks meant for the scroll area around it.
// Clicking where the field's vertical padding used to be must still put the caret where the click was.

const ZOOMS = [0.8, 1, 1.1, 1.25, 1.5, 1.75, 2, 3]

const CONTROLS = `
  <input type="text" value="Some text" />
  <input type="number" value="42" />
  <input type="search" value="find" />
  <input type="date" />
  <select><option>One</option></select>
  <textarea rows="1">one line</textarea>
  <button>Text</button>
  <button id="icon-button"></button>
  <button e-variant="tint">Tint</button>
  <label e-variant="toggle"><input type="checkbox" />Toggle</label>`

const CONTEXTS: Record<string, string> = {
  loose: `<e-row align="start" spacing="widget">${CONTROLS}</e-row>`,
  packed: `<e-row align="start" packed border>${CONTROLS}</e-row>`,
  "packed, small step": `<e-row align="start" packed="nudge-4" border>${CONTROLS}</e-row>`,
  // Stacked cells share their lines (the leading border of the one below): the lines are not part of the
  // cell's height.
  "packed column": `<e-column align="start" packed border>${CONTROLS}</e-column>`,
}

async function mount(page: Page, html: string, zoom: number) {
  await page.evaluate(
    async ({ html, zoom }) => {
      const Icons = window.__ELT__.UI as any
      document.documentElement.style.zoom = String(zoom)
      const host = document.createElement("div")
      host.id = "host"
      host.innerHTML = html
      document.body.append(host)
      const icon_button = host.querySelector("#icon-button")
      icon_button?.append(Icons.Check(), " Icon")
      await window.__ELT__.frames(3)
    },
    { html, zoom },
  )
}

for (const [name, html] of Object.entries(CONTEXTS)) {
  for (const zoom of ZOOMS) {
    test(`same height, ${name}, zoom ${zoom}`, async ({ page }) => {
      await mount(page, html, zoom)
      const heights = await page.evaluate(() => {
        // Stacked in a column, cells share their lines: the lines are not part of a height.
        if (document.querySelector("#host e-column"))
          for (const el of document.querySelectorAll<HTMLElement>("#host *")) el.style.borderWidth = "0"
        return [
          ...document.querySelectorAll("#host :is(input:not([type=checkbox]), select, textarea, button, label)"),
        ].map((el) => ({
          el: `${el.tagName.toLowerCase()}${(el as HTMLInputElement).type ? `[${(el as HTMLInputElement).type}]` : ""}`,
          h: el.getBoundingClientRect().height,
        }))
      })
      expect(heights.length).toBeGreaterThan(8)
      const first = heights[0]!.h
      // Layout rounds sizes to 1/64 px.
      for (const { el, h } of heights)
        expect(Math.abs(h - first), `${el} is ${h}, the first is ${first}`).toBeLessThan(0.05)
    })
  }
}

// Chromium only: reads the field's inner editor (a user-agent shadow tree) through the DevTools protocol.
for (const zoom of ZOOMS) {
  test(`text fields' inner editor has nothing to scroll, zoom ${zoom}`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "reads the user-agent shadow tree through CDP")
    await mount(page, CONTEXTS.loose!, zoom)
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("#host input, #host select")) el.setAttribute("data-probe", "")
    })
    const cdp = await page.context().newCDPSession(page)
    await cdp.send("DOM.enable")
    const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true })
    const probes: any[] = []
    const collect = (n: any) => {
      if (n.attributes?.includes("data-probe")) probes.push(n)
      for (const c of [...(n.children ?? []), ...(n.shadowRoots ?? [])]) collect(c)
    }
    collect(root)
    expect(probes.length).toBeGreaterThan(3)
    const overflows: string[] = []
    const walk = async (n: any, label: string) => {
      if (n.nodeType === 1) {
        const { object } = await cdp.send("DOM.resolveNode", { backendNodeId: n.backendNodeId })
        const r: any = await cdp.send("Runtime.callFunctionOn", {
          objectId: object.objectId,
          functionDeclaration: `function(){ const before = this.scrollTop; this.scrollTop = 100; const max = this.scrollTop; this.scrollTop = before; return max }`,
          returnByValue: true,
        })
        if (r.result.value > 0) overflows.push(`${label} scrolls by ${r.result.value}`)
        void 0
      }
      for (const c of n.children ?? []) await walk(c, label)
    }
    for (const p of probes)
      for (const sr of p.shadowRoots ?? [])
        await walk(sr, `${p.localName}[${p.attributes[p.attributes.indexOf("type") + 1] ?? ""}]`)
    expect(overflows).toEqual([])
  })
}

for (const zoom of ZOOMS) {
  test(`the first wheel tick over a text field scrolls the area around it, zoom ${zoom}`, async ({ page }) => {
    await mount(
      page,
      `<e-column scroll style="height: 120px; width: 300px" spacing="none" align="stretch">${Array.from({ length: 50 }, () => `<input type="text" value="row" />`).join("")}</e-column>`,
      zoom,
    )
    const pos = await page.evaluate(() => {
      const r = document.querySelector("#host input")!.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    await page.mouse.move(pos.x, pos.y)
    await page.mouse.wheel(0, 3)
    await page.waitForTimeout(200)
    const top = await page.evaluate(() => document.querySelector<HTMLElement>("#host e-column")!.scrollTop)
    expect(top).toBeGreaterThan(0)
  })
}

test.describe("clicking a text field", () => {
  for (const zoom of [1, 1.25]) {
    test(`next to the text puts the caret there, wherever on the height, zoom ${zoom}`, async ({
      page,
      browserName,
    }) => {
      await mount(page, `<e-row align="start"><input type="text" value="abcdefghijklmnopqrstuvwxyz" /></e-row>`, zoom)
      const box = await page.evaluate(() => {
        const r = document.querySelector("#host input")!.getBoundingClientRect()
        return { x: r.x, y: r.y, w: r.width, h: r.height }
      })
      // WebKit only hit-tests a text field down to the bottom of its text's line box (a click below it
      // goes to the end of the text), whatever the field's height: its lower part is not checked.
      for (const y of browserName === "webkit" ? [3, box.h / 2] : [3, box.h / 2, box.h - 3]) {
        // Left edge: some letters in, not the start and not the end.
        await page.mouse.click(box.x + 40, box.y + y)
        const caret = await page.evaluate(
          () => (document.querySelector("#host input") as HTMLInputElement).selectionStart,
        )
        expect(caret, `click ${y}px from the top`).toBeGreaterThan(1)
        expect(caret, `click ${y}px from the top`).toBeLessThan(26)
      }
    })
  }
})

// The Select widget is a button; in completion mode a text field lies over it, at its size.
for (const zoom of [1, 1.25, 2]) {
  test(`the Select widget, and its completion field, are as tall as a text field, zoom ${zoom}`, async ({ page }) => {
    await mount(page, `<e-row id="row" align="start" spacing="widget"><input type="text" value="x" /></e-row>`, zoom)
    const r = await page.evaluate(async () => {
      const { o, node_append } = window.__ELT__
      const { Select } = window.__ELT__.UI as any
      const row = document.getElementById("row")!
      const plain = Select({ model: o("a"), options: ["a", "b"] })
      const completion = Select({ model: o("a"), options: ["a", "b"], completion: true })
      node_append(row, plain)
      node_append(row, completion)
      await window.__ELT__.frames(3)
      const h = (el: Element) => el.getBoundingClientRect().height
      const field = row.querySelector("input")!
      const button = completion.matches("button") ? completion : completion.querySelector("button")!
      button.click()
      await window.__ELT__.frames(3)
      return {
        field: h(field),
        plain: h(plain.matches("button") ? plain : plain.querySelector("button")!),
        completion_button: h(button),
        completion_input: h(completion.querySelector("input")!),
      }
    })
    expect(Math.abs(r.plain - r.field)).toBeLessThan(0.05)
    expect(Math.abs(r.completion_button - r.field)).toBeLessThan(0.05)
    expect(Math.abs(r.completion_input - r.field)).toBeLessThan(0.05)
  })
}
