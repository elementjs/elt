import { expect, test } from "./fixture"
import { VIRTUAL_MOUNT, type VMountOpts } from "./virtual-mount"

// The windowing along each axis and direction: vertical, horizontal, horizontal right-to-left. Rows
// vary in size, so estimates are wrong and the anchoring has to hold the view.

test.beforeEach(async ({ page }) => {
  await page.addScriptTag({ content: VIRTUAL_MOUNT })
})

const AXES: [string, Partial<VMountOpts>][] = [
  ["vertical", {}],
  ["horizontal", { horizontal: true }],
  ["horizontal right-to-left", { horizontal: true, rtl: true }],
]

for (const [name, axis] of AXES) {
  test.describe(`RepeatVirtual, ${name}`, () => {
    test("renders a window of rows, and every row once scrolled through the whole list", async ({ page }) => {
      const r = await page.evaluate(async (axis) => {
        const m = window.__vmount({ count: 300, ...axis })
        await window.__ELT__.frames(4)
        const initial = m.rendered().length
        const seen = new Set<string>()
        let max_rendered = 0
        let slices_ok = true
        for (let i = 0; i < 400 && m.scroll() < m.max_scroll() - 1; i++) {
          await m.scroll_by(120, 120)
          const labels = m.rendered()
          max_rendered = Math.max(max_rendered, labels.length)
          const first = Number(labels[0]?.split("-")[1])
          labels.forEach((l, k) => {
            seen.add(l)
            if (l !== `item-${first + k}`) slices_ok = false
          })
        }
        const last = m.last_visible()
        m.tear_down()
        return { initial, seen: seen.size, max_rendered, slices_ok, last }
      }, axis)
      expect(r.initial).toBeGreaterThan(0)
      expect(r.initial).toBeLessThan(300)
      expect(r.max_rendered).toBeLessThan(100)
      expect(r.slices_ok).toBe(true)
      expect(r.seen).toBe(300)
      expect(r.last).toBe("item-299")
    })

    test("a row under the visible area's start moves exactly with the scroll while rows come and go", async ({
      page,
    }) => {
      const drift = await page.evaluate(async (axis) => {
        const m = window.__vmount({ count: 500, ...axis })
        await window.__ELT__.frames(4)
        let worst = 0
        for (let i = 0; i < 60; i++) {
          const before = m.first_visible()
          if (before == null) return Infinity
          await m.scroll_by(25, 25)
          const after = m.offset_of(before.label)
          // The same row, 25px further towards the start; rows rendered or dropped elsewhere don't move it.
          if (after != null) worst = Math.max(worst, Math.abs(after - (before.offset - 25)))
        }
        m.tear_down()
        return worst
      }, axis)
      expect(drift).toBeLessThan(1)
    })

    test("setPosition brings the row to the visible area's start", async ({ page }) => {
      const r = await page.evaluate(async (axis) => {
        const m = window.__vmount({ count: 1000, ...axis })
        await window.__ELT__.frames(4)
        m.instance.setPosition(600)
        await window.__ELT__.frames(6)
        const first = m.first_visible()
        m.tear_down()
        return first
      }, axis)
      expect(r?.label).toBe("item-600")
      expect(Math.abs(r?.offset ?? 99)).toBeLessThan(1)
    })

    test("itemAt gives the row at an offset from the visible area's start", async ({ page }) => {
      const r = await page.evaluate(async (axis) => {
        const m = window.__vmount({ count: 1000, ...axis })
        await window.__ELT__.frames(4)
        m.instance.setPosition(200)
        await window.__ELT__.frames(6)
        // item-200 is at 0, item-201 right after it.
        const at0 = m.instance.itemAt(1)
        const next = m.instance.itemAt(m.size_of("item-200") + 1)
        m.tear_down()
        return { at0, next }
      }, axis)
      expect(r).toEqual({ at0: 200, next: 201 })
    })
  })
}
