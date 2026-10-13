import { type Page, expect, test } from "../fixture"

// The label column of the object editor's grids: an object's keys, array indices and a table's row
// numbers are `e-widget="label"` (docs/md/ui-forms.md#labels-and-fieldsets).

/** Waits three frames: laid out on the first, columns locked on the next (observe_layout defers). */
async function settle(page: Page) {
  await page.evaluate(() => window.__ELT__.frames(3))
}

test.describe("label cells", () => {
  async function mount(page: Page, model: unknown, packed: boolean) {
    await page.evaluate(
      ({ model, packed }) => {
        const { o, node_append } = window.__ELT__
        const { ObjectEditorShell } = window.__ELT__.Editor
        const shell = new ObjectEditorShell(o<unknown>(model), { packed })
        shell.node.id = "shell"
        node_append(document.body, shell.node)
      },
      { model, packed },
    )
    await settle(page)
  }

  const fill = (page: Page, sel: string) =>
    page.evaluate((sel) => getComputedStyle(document.querySelector(sel)!).backgroundColor, sel)

  test("an object's keys are labels, filled when packed, bare when not", async ({ page }) => {
    await mount(page, { name: "Ada" }, true)
    expect(await page.locator('#shell e-grid-row > [e-widget="label"]').count()).toBe(1)
    expect(await fill(page, '#shell [e-widget="label"]')).not.toBe("rgba(0, 0, 0, 0)")
  })

  test("unpacked, a key has no fill", async ({ page }) => {
    await mount(page, { name: "Ada" }, false)
    expect(await fill(page, '#shell [e-widget="label"]')).toBe("rgba(0, 0, 0, 0)")
  })

  test("a table's row numbers are labels, its header cell is not (it keeps the header's fill)", async ({ page }) => {
    await mount(page, [{ a: 1 }, { a: 2 }], false)
    const r = await page.evaluate(() => {
      const head = document.querySelector("#shell e-grid-row[sticky] > *")!
      return {
        rows: document.querySelectorAll('#shell e-grid-row:not([sticky]) > [e-widget="label"]').length,
        head_is_label: head.matches('[e-widget="label"]'),
      }
    })
    expect(r).toEqual({ rows: 2, head_is_label: false })
  })

  test("a Map's keys are editors, not labels", async ({ page }) => {
    await mount(page, new Map([["k", 1]]), true)
    expect(await page.locator('#shell [e-widget="label"]').count()).toBe(0)
  })
})
