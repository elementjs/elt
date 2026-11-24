import { expect, test } from "./fixture"
import { VIRTUAL_MOUNT } from "./virtual-mount"

// RepeatVirtual's explicit positioning: InitialPosition and setPosition scroll to the row, with rows
// whose sizes differ from the estimate.

test.beforeEach(async ({ page }) => {
  await page.addScriptTag({ content: VIRTUAL_MOUNT })
})

test.describe("RepeatVirtual positioning", () => {
  test("InitialPosition shows that row at the top of the visible area", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const m = window.__vmount({ count: 1000, initial: 500 })
      await window.__ELT__.frames(6)
      const first = m.first_visible()
      m.tear_down()
      return first
    })
    expect(r?.label).toBe("item-500")
    expect(Math.abs(r?.offset ?? 99)).toBeLessThan(1)
  })

  test("setPosition jumps to that row and stays there", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const m = window.__vmount({ count: 1000 })
      await window.__ELT__.frames(4)
      m.instance.setPosition(800)
      await window.__ELT__.frames(6)
      const first = m.first_visible()
      m.tear_down()
      return first
    })
    expect(r?.label).toBe("item-800")
    expect(Math.abs(r?.offset ?? 99)).toBeLessThan(1)
  })

  test("a negative position counts from the end: -1 shows the last row, scrolled to the end", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const m = window.__vmount({ count: 1000, initial: -1 })
      await window.__ELT__.frames(8)
      const out = { last: m.last_visible(), scroll: m.scroll(), max: m.max_scroll() }
      m.instance.setPosition(-10)
      await window.__ELT__.frames(6)
      const after = m.first_visible()?.label
      m.tear_down()
      return { ...out, after }
    })
    expect(r.last).toBe("item-999")
    expect(Math.abs(r.max - r.scroll)).toBeLessThan(1)
    expect(r.after).toBe("item-990")
  })

  test("the initial position applies when the rows arrive after connection", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const m = window.__vmount({ count: 0, initial: -1 })
      await window.__ELT__.frames(3)
      m.o_lst.set(Array.from({ length: 200 }, (_, i) => `item-${i}`))
      await window.__ELT__.frames(8)
      const out = { last: m.last_visible(), scroll: m.scroll(), max: m.max_scroll() }
      m.tear_down()
      return out
    })
    expect(r.last).toBe("item-199")
    expect(Math.abs(r.max - r.scroll)).toBeLessThan(1)
  })

  test("a list connected in a hidden scroll area lands on its initial position once shown", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const m = window.__vmount({ count: 1000, initial: 300, hidden: true })
      await window.__ELT__.frames(4)
      m.area.style.display = ""
      await window.__ELT__.frames(8)
      const first = m.first_visible()
      m.tear_down()
      return first
    })
    expect(r?.label).toBe("item-300")
  })

  test("an explicit jump leaves the scroll area's scroll-padding uncovered (room for a sticky header)", async ({
    page,
  }) => {
    const offset = await page.evaluate(async () => {
      const m = window.__vmount({ count: 1000 })
      m.area.style.scrollPaddingTop = "40px"
      await window.__ELT__.frames(4)
      m.instance.setPosition(100)
      await window.__ELT__.frames(6)
      const offset = m.offset_of("item-100")
      m.tear_down()
      return offset
    })
    expect(Math.abs((offset ?? 0) - 40)).toBeLessThan(1)
  })

  test("after a setPosition, rows refilled from empty show the first row as laid out, under a sticky header", async ({
    page,
  }) => {
    const r = await page.evaluate(async () => {
      const { frames } = window.__ELT__
      const m = window.__vmount({ count: 200 })
      const header = document.createElement("div")
      header.style.cssText = "position: sticky; top: 0; height: 30px; background: white; z-index: 1"
      m.area.prepend(header)
      await frames(4)
      m.instance.setPosition(120)
      await frames(6)
      m.o_lst.set([])
      await frames(3)
      m.o_lst.set(Array.from({ length: 200 }, (_, i) => `item-${i}`))
      await frames(6)
      const out = { scroll: m.scroll(), row0: m.offset_of("item-0") }
      m.tear_down()
      return out
    })
    expect(r).toEqual({ scroll: 0, row0: 30 })
  })
})
