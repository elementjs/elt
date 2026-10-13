import { type Page, expect, test } from "../fixture"

// The index column of a table (`#`): at least four digits wide, and resizable by its heading's edge.

async function mount(page: Page, rows: number) {
  await page.evaluate((rows) => {
    const { o, node_append } = window.__ELT__
    const { ObjectEditorShell } = window.__ELT__.Editor
    const model = Array.from({ length: rows }, (_, i) => ({ a: i, b: "x" }))
    const shell = new ObjectEditorShell(o<unknown>(model), { packed: true })
    shell.node.id = "shell"
    node_append(document.body, shell.node)
  }, rows)
  await page.evaluate(() => window.__ELT__.frames(4))
}

/** The width of the index column's heading, and the width four "0"s take in its font. */
const measure = (page: Page) =>
  page.evaluate(() => {
    const head = document.querySelector<HTMLElement>("#shell e-grid-row[sticky] > strong:first-child")!
    const cs = getComputedStyle(head)
    const probe = document.createElement("span")
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`
    probe.textContent = "0000"
    document.body.append(probe)
    const four = probe.getBoundingClientRect().width
    probe.remove()
    return {
      width: head.getBoundingClientRect().width,
      four,
      pad: Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight),
    }
  })

async function drag_handle(page: Page, dx: number) {
  const box = (await page
    .locator('#shell e-grid-row[sticky] > strong:first-child > [data-resize-edge="end"]')
    .boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 4 })
  await page.mouse.up()
  await page.evaluate(() => window.__ELT__.frames(2))
}

test("with one-digit indices, the column is still four digits wide (plus the cell's padding)", async ({ page }) => {
  await mount(page, 3)
  const m = await measure(page)
  expect(m.width).toBeGreaterThanOrEqual(m.four + m.pad - 0.5)
})

test("dragging the heading's edge resizes the column", async ({ page }) => {
  await mount(page, 3)
  const before = (await measure(page)).width
  await drag_handle(page, 40)
  expect((await measure(page)).width).toBeCloseTo(before + 40, 0)
})

test("a drag can't take the column under four digits", async ({ page }) => {
  await mount(page, 3)
  await drag_handle(page, 60)
  await drag_handle(page, -400)
  const m = await measure(page)
  expect(m.width).toBeGreaterThanOrEqual(m.four + m.pad - 0.5)
  expect(m.width).toBeLessThan(m.four + m.pad + 1)
})
