import { expect, test } from "./fixture"
import { VIRTUAL_MOUNT } from "./virtual-mount"

// Infinite scrolling with RepeatVirtual: OnEndReached / OnStartReached, and rows added at either end
// without moving what the user sees. Rows vary in size (30 to 99px), so estimates are wrong.

test.beforeEach(async ({ page }) => {
  await page.addScriptTag({ content: VIRTUAL_MOUNT })
})

const labels = (prefix: string, from: number, n: number) => Array.from({ length: n }, (_, i) => `${prefix}-${from + i}`)

test.describe("OnEndReached / OnStartReached", () => {
  test("fires once the window touches the end, and not again while its promise is pending", async ({ page }) => {
    const calls = await page.evaluate(async () => {
      const { deferred, frames } = window.__ELT__
      let calls = 0
      const pending = deferred()
      const m = window.__vmount({
        count: 200,
        configure: (rv) =>
          rv.OnEndReached(() => {
            calls++
            return pending.promise
          }),
      })
      await frames(4)
      const before = calls
      m.instance.setPosition(-1)
      await frames(6)
      const at_end = calls
      await m.scroll_by(-200)
      await m.scroll_by(400)
      const after = calls
      m.tear_down()
      return { before, at_end, after }
    })
    expect(calls).toEqual({ before: 0, at_end: 1, after: 1 })
  })

  test("short pages load until the visible area and its margin are filled, and no further", async ({ page }) => {
    const r = await page.evaluate(async (labels_src) => {
      const labels = new Function(`return ${labels_src}`)()
      const { frames } = window.__ELT__
      let calls = 0
      const m = window.__vmount({
        count: 0,
        configure: (rv) =>
          rv.OnEndReached(async () => {
            calls++
            await frames(1)
            m.o_lst.set([...m.o_lst.get(), ...labels("item", m.o_lst.get().length, 5)])
          }),
      })
      await frames(60)
      const out = { calls, rows: m.o_lst.get().length, rendered_end: m.rendered().at(-1), scroll: m.scroll() }
      m.tear_down()
      return out
    }, labels.toString())
    // 300px visible and a 500px margin, rows of at most 99px: at least 9 rows, and at 30px at most 27,
    // so the loading stops after a few pages, with nothing scrolled.
    expect(r.rows).toBeGreaterThanOrEqual(10)
    expect(r.rows).toBeLessThanOrEqual(40)
    expect(r.calls).toBe(r.rows / 5)
    expect(r.scroll).toBe(0)
  })

  test("a page that added nothing turns that side off until the window leaves the end and comes back", async ({
    page,
  }) => {
    const r = await page.evaluate(async () => {
      const { frames } = window.__ELT__
      let calls = 0
      const m = window.__vmount({
        count: 300,
        configure: (rv) =>
          rv.OnEndReached(async () => {
            calls++
          }),
      })
      await frames(3)
      m.instance.setPosition(-1)
      await frames(10)
      const first = calls
      m.instance.setPosition(100)
      await frames(6)
      const away = calls
      m.instance.setPosition(-1)
      await frames(10)
      const back = calls
      m.tear_down()
      return { first, away, back }
    })
    expect(r).toEqual({ first: 1, away: 1, back: 2 })
  })

  test("an empty list fires OnEndReached alone when both are set, and OnStartReached when it is the only one", async ({
    page,
  }) => {
    const r = await page.evaluate(async () => {
      const { frames } = window.__ELT__
      const both = { start: 0, end: 0 }
      const m1 = window.__vmount({
        count: 0,
        configure: (rv) =>
          rv
            .OnStartReached(() => {
              both.start++
            })
            .OnEndReached(() => {
              both.end++
            }),
      })
      let start_only = 0
      const m2 = window.__vmount({
        count: 0,
        configure: (rv) =>
          rv.OnStartReached(() => {
            start_only++
          }),
      })
      await frames(4)
      m1.tear_down()
      m2.tear_down()
      return { both, start_only }
    })
    expect(r).toEqual({ both: { start: 0, end: 1 }, start_only: 1 })
  })

  test("a short first page touching both ends fires both", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { frames } = window.__ELT__
      const calls = { start: 0, end: 0 }
      const m = window.__vmount({
        count: 4,
        configure: (rv) =>
          rv
            .OnStartReached(() => {
              calls.start++
            })
            .OnEndReached(() => {
              calls.end++
            }),
      })
      await frames(4)
      m.tear_down()
      return calls
    })
    expect(r).toEqual({ start: 1, end: 1 })
  })
})

test.describe("rows added at the ends", () => {
  test("rows prepended while scrolled keep the visible rows in place", async ({ page }) => {
    const r = await page.evaluate(async (labels_src) => {
      const labels = new Function(`return ${labels_src}`)()
      const { frames } = window.__ELT__
      const m = window.__vmount({ count: 300, initial: 150 })
      await frames(6)
      await m.scroll_by(-37)
      const before = m.first_visible()
      m.o_lst.set([...labels("new", 0, 50), ...m.o_lst.get()])
      await frames(1)
      const next_frame = before == null ? null : m.offset_of(before.label)
      await frames(6)
      const settled = before == null ? null : m.offset_of(before.label)
      m.tear_down()
      return { before, next_frame, settled }
    }, labels.toString())
    expect(r.before).not.toBeNull()
    expect(Math.abs((r.next_frame ?? 99) - (r.before?.offset ?? 0))).toBeLessThan(1)
    expect(Math.abs((r.settled ?? 99) - (r.before?.offset ?? 0))).toBeLessThan(1)
  })

  test("rows prepended while the first row is shown keep it in place, and the new rows are there above it", async ({
    page,
  }) => {
    const r = await page.evaluate(async (labels_src) => {
      const labels = new Function(`return ${labels_src}`)()
      const { frames } = window.__ELT__
      const m = window.__vmount({ count: 100 })
      await frames(6)
      const before = m.first_visible()
      m.o_lst.set([...labels("new", 0, 20), ...m.o_lst.get()])
      await frames(6)
      const after = m.offset_of("item-0")
      await m.scroll_by(-100000, 200)
      const top = m.first_visible()?.label
      m.tear_down()
      return { before, after, top }
    }, labels.toString())
    expect(r.before?.label).toBe("item-0")
    expect(Math.abs((r.after ?? 99) - (r.before?.offset ?? 0))).toBeLessThan(1)
    expect(r.top).toBe("new-0")
  })

  test("a chat opened at its end loads older pages as it is scrolled up, without moving the view", async ({ page }) => {
    const r = await page.evaluate(async (labels_src) => {
      const labels = new Function(`return ${labels_src}`)()
      const { frames } = window.__ELT__
      let oldest = 1000
      let loads = 0
      const m = window.__vmount({
        count: 0,
        initial: -1,
        configure: (rv) =>
          rv.OnStartReached(async () => {
            if (oldest === 0) return
            loads++
            await frames(2)
            oldest -= 20
            m.o_lst.set([...labels("item", oldest, 20), ...m.o_lst.get()])
          }),
      })
      oldest = 980
      m.o_lst.set(labels("item", 980, 20))
      await frames(20)
      const opened_on = m.last_visible()
      let worst = 0
      for (let i = 0; i < 60; i++) {
        // Near the top, a scroll of 60px would be cut short: wait for the next page instead.
        if (m.scroll() < 100) {
          await frames(6)
          continue
        }
        const before = m.first_visible()
        await m.scroll_by(-60, 60)
        await frames(4)
        const after = before == null ? null : m.offset_of(before.label)
        if (before != null && after != null) worst = Math.max(worst, Math.abs(after - (before.offset + 60)))
      }
      const out = { opened_on, loads, worst, rows: m.o_lst.get().length }
      m.tear_down()
      return out
    }, labels.toString())
    expect(r.opened_on).toBe("item-999")
    expect(r.loads).toBeGreaterThan(2)
    expect(r.rows).toBe(20 + 20 * r.loads)
    expect(r.worst).toBeLessThan(1)
  })

  test("two changes of the list in a row (a prepend, then an edit) keep the visible rows in place", async ({
    page,
  }) => {
    const r = await page.evaluate(async (labels_src) => {
      const labels = new Function(`return ${labels_src}`)()
      const { frames } = window.__ELT__
      const m = window.__vmount({ count: 300, initial: 150 })
      await frames(6)
      await m.scroll_by(-37)
      const before = m.first_visible()
      m.o_lst.set([...labels("new", 0, 20), ...m.o_lst.get()])
      const lst = m.o_lst.get().slice()
      lst[300] = "edited-3"
      m.o_lst.set(lst)
      await frames(6)
      const after = before == null ? null : m.offset_of(before.label)
      m.tear_down()
      return { before, after }
    }, labels.toString())
    expect(Math.abs((r.after ?? 99) - (r.before?.offset ?? 0))).toBeLessThan(1)
  })

  test("scrolling back to the first row after a jump into a list of varying rows ends on it, without a jump", async ({
    page,
  }) => {
    const r = await page.evaluate(async () => {
      const { frames } = window.__ELT__
      const m = window.__vmount({ count: 1000, initial: 60 })
      await frames(6)
      let worst = 0
      for (let i = 0; i < 400 && m.scroll() > 0; i++) {
        const before = m.first_visible()
        const s0 = m.scroll()
        await m.scroll_by(-40, 40)
        const moved = s0 - m.scroll()
        const after = before == null ? null : m.offset_of(before.label)
        // A scroll cut short by the top moves the rows by what it did scroll; a correction by the list
        // (its estimate falling short) moves the scroll and the rows together, invisible.
        if (before != null && after != null && moved > 0) worst = Math.max(worst, Math.abs(after - before.offset - 40))
      }
      const out = { worst, first: m.first_visible(), scroll: m.scroll() }
      m.tear_down()
      return out
    })
    expect(r.worst).toBeLessThan(1)
    expect(r.first).toEqual({ label: "item-0", offset: 0 })
    expect(r.scroll).toBe(0)
  })

  test("rows appended while scrolled deep don't move the visible rows", async ({ page }) => {
    const r = await page.evaluate(async (labels_src) => {
      const labels = new Function(`return ${labels_src}`)()
      const { frames } = window.__ELT__
      const m = window.__vmount({ count: 1000, initial: 500 })
      await frames(6)
      await m.scroll_by(300)
      const before = m.first_visible()
      m.o_lst.set([...m.o_lst.get(), ...labels("more", 0, 10)])
      await frames(6)
      const after = before == null ? null : m.offset_of(before.label)
      m.tear_down()
      return { before, after }
    }, labels.toString())
    expect(Math.abs((r.after ?? 99) - (r.before?.offset ?? 0))).toBeLessThan(1)
  })
})
