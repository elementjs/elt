import { expect, test } from "./fixture"

declare global {
  interface Window {
    __sizes: number[]
  }
}

// $resizable (ui/resizable.tsx, docs/md/ui-widgets.md#resizable): the handle is a real element along
// one edge of the host, driven by the pointer.

/** Mount `html` and decorate the element `#host` with `$resizable(opts)`. */
async function mount(page: import("./fixture").Page, html: string, opts: Record<string, unknown> = {}) {
  await page.evaluate(
    async ({ html, opts }) => {
      const { node_append } = window.__ELT__
      const root = document.createElement("div")
      root.innerHTML = html
      const host = root.querySelector<HTMLElement>("#host")!
      const on_resize = (opts as { record?: boolean }).record ? (px: number) => window.__sizes.push(px) : undefined
      window.__sizes = []
      const { record: _record, ...rest } = opts as Record<string, unknown>
      const handle = window.__ELT__.UI.$resizable({ ...rest, ...(on_resize ? { on_resize } : {}) })(host)
      if (handle) host.append(handle as Node)
      node_append(document.body, root)
      await window.__ELT__.frames(4)
    },
    { html, opts },
  )
}

async function drag(page: import("./fixture").Page, dx: number, dy = 0) {
  const box = (await page.locator("#host [data-resize-edge]").boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 4 })
  await page.mouse.up()
}

const width = (page: import("./fixture").Page) =>
  page.evaluate(() => document.getElementById("host")!.getBoundingClientRect().width)

test.describe("$resizable", () => {
  test("locks the laid-out size on the element, which then stops shrinking in a flex row", async ({ page }) => {
    // A nav sized by its content, next to something wide: before the lock it would shrink with the row.
    await mount(
      page,
      `<e-row style="width: 300px"><nav id="host">Navigation</nav><div style="width: 400px; flex-shrink: 1">x</div></e-row>`,
    )
    const r = await page.evaluate(() => {
      const host = document.getElementById("host")!
      return { inline: host.style.width, shrink: host.style.flexShrink, laid_out: host.getBoundingClientRect().width }
    })
    expect(Number.parseFloat(r.inline)).toBeCloseTo(r.laid_out, 1)
    expect(r.shrink).toBe("0")
  })

  test("dragging the end handle grows and shrinks the element, within min and max", async ({ page }) => {
    await mount(page, `<div id="host" style="width: 200px; height: 50px"></div>`, { min: 100, max: 260 })
    const start = await width(page)
    await drag(page, 40)
    expect(await width(page)).toBeCloseTo(start + 40, 0)
    await drag(page, 500)
    expect(await width(page)).toBe(260)
    await drag(page, -1000)
    expect(await width(page)).toBe(100)
  })

  test("the start edge grows when dragged away from the element; RTL mirrors start and end", async ({ page }) => {
    await mount(page, `<div id="host" style="width: 200px; height: 50px; margin-left: 300px"></div>`, { edge: "start" })
    await drag(page, -50)
    expect(await width(page)).toBeCloseTo(250, 0)

    await page.evaluate(() => document.getElementById("host")!.parentElement!.remove())
    await mount(page, `<div dir="rtl"><div id="host" style="width: 200px; height: 50px"></div></div>`)
    // In RTL the end edge is the left one: moving left grows it.
    const box = (await page.locator("#host [data-resize-edge]").boundingBox())!
    const host_box = (await page.locator("#host").boundingBox())!
    expect(box.x).toBeCloseTo(host_box.x, 0)
    await drag(page, -30)
    expect(await width(page)).toBeCloseTo(230, 0)
  })

  test("the bottom edge resizes the height", async ({ page }) => {
    await mount(page, `<div id="host" style="width: 200px; height: 80px"></div>`, { edge: "bottom", min: 20 })
    await drag(page, 0, 25)
    const h = await page.evaluate(() => document.getElementById("host")!.getBoundingClientRect().height)
    expect(h).toBeCloseTo(105, 0)
  })

  test("with on_resize alone, the caller applies the size: nothing is written on the element", async ({ page }) => {
    await mount(page, `<div id="host" style="width: 200px; height: 50px"></div>`, { record: true })
    await drag(page, 30)
    const r = await page.evaluate(() => ({
      sizes: window.__sizes,
      inline: document.getElementById("host")!.style.width,
    }))
    expect(r.sizes.length).toBeGreaterThan(0)
    expect(r.sizes.at(-1)).toBeCloseTo(230, 0)
    expect(r.inline).toBe("200px")
  })

  test("a host that already has a position (a sticky header) keeps it", async ({ page }) => {
    await mount(
      page,
      `<div style="height: 100px; overflow: auto"><div id="host" style="position: sticky; top: 0">h</div></div>`,
    )
    const position = await page.evaluate(() => getComputedStyle(document.getElementById("host")!).position)
    expect(position).toBe("sticky")
  })

  test("the handle sits on the host's edge and shows the resize cursor", async ({ page }) => {
    await mount(page, `<div id="host" style="width: 200px; height: 50px"></div>`)
    const r = await page.evaluate(() => {
      const host = document.getElementById("host")!
      const handle = host.querySelector<HTMLElement>("[data-resize-edge]")!
      const h = handle.getBoundingClientRect()
      const b = host.getBoundingClientRect()
      return {
        right_edge: h.right === b.right,
        full_height: h.height === b.height,
        cursor: getComputedStyle(handle).cursor,
      }
    })
    expect(r).toEqual({ right_edge: true, full_height: true, cursor: "col-resize" })
  })
})
