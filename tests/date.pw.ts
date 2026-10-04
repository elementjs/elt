import { expect, type Page, test } from "./fixture"

/*
 * DateTimePicker (ui/date.tsx), its text input (ui/date-input.ts) and the time picker columns
 * (ui/timepicker.tsx), driven through the picker as a user would.
 */

type Parts = [number, number, number, number, number, number]

interface MountOpts {
  lang: string
  /** Model value as `new Date(...parts)`, or `null` for an empty model. */
  model: Parts | null
  /** `"live"`: an observable, initially `false`, exposed as `window.o_clear`. */
  clearable?: boolean | "live"
  show_date?: boolean
  show_time?: boolean
  am_pm?: boolean
  /** `"live"`: an observable, initially 1, exposed as `window.o_step`. */
  minute_step?: number | "live"
  variant?: "full" | "tint"
}

type W = Window & {
  o_model: { get(): Date | null }
  o_clear: { set(v: boolean): void }
  o_step: { set(v: number): void }
}

async function mount(page: Page, opts: MountOpts) {
  await page.evaluate((opts) => {
    const { o, node_append, UI } = window.__ELT__
    const w = window as unknown as W
    const holder = document.createElement("div")
    holder.id = "holder"
    holder.lang = opts.lang
    node_append(document.body, holder)
    const o_model = o<Date | null>(opts.model ? new Date(...opts.model) : null)
    const o_clear = o(false)
    const o_step = o(1)
    w.o_model = o_model
    w.o_clear = o_clear
    w.o_step = o_step
    const common = {
      show_date: opts.show_date,
      show_time: opts.show_time,
      am_pm: opts.am_pm,
      minute_step: opts.minute_step === "live" ? o_step : opts.minute_step,
      variant: opts.variant,
    }
    const picker =
      opts.clearable === "live"
        ? UI.DateTimePicker({ ...common, model: o_model, clearable: o_clear })
        : opts.clearable
          ? UI.DateTimePicker({ ...common, model: o_model, clearable: true })
          : UI.DateTimePicker({ ...common, model: o_model })
    node_append(holder, picker)
  }, opts)
}

/** The model as `[y, m, d, h, min, s]`, or `null`. */
function model(page: Page) {
  return page.evaluate(() => {
    const d = (window as unknown as W).o_model.get()
    return d && [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]
  })
}

/** Focus the text input with the caret at `pos`. */
async function caret(page: Page, pos: number) {
  await page.evaluate((pos) => {
    const input = document.querySelector("#holder input") as HTMLInputElement
    input.focus()
    input.setSelectionRange(pos, pos)
  }, pos)
}

function input_state(page: Page) {
  return page.evaluate(() => {
    const input = document.querySelector("#holder input") as HTMLInputElement
    return { value: input.value, error: input.validationMessage }
  })
}

async function blur(page: Page) {
  await page.evaluate(() => (document.querySelector("#holder input") as HTMLInputElement).blur())
}

test.describe("time-only input (show_date={false})", () => {
  test("a typed time goes to the model, on the model's calendar day", async ({ page }) => {
    await mount(page, { lang: "en-GB", model: [2026, 9, 3, 8, 0, 0], show_date: false, show_time: true })
    expect((await input_state(page)).value).toBe("08:00")
    await caret(page, 0)
    await page.keyboard.type("1430")
    expect(await input_state(page)).toEqual({ value: "14:30", error: "" })
    await blur(page)
    expect(await model(page)).toEqual([2026, 9, 3, 14, 30, 0])
  })

  test("on an empty model, a typed time lands on today", async ({ page }) => {
    await mount(page, { lang: "en-GB", model: null, clearable: true, show_date: false, show_time: true })
    expect((await input_state(page)).value).toBe("--:--")
    // Arrows rather than digits, around a pre-existing bug: digits typed into an empty segment are
    // padded one by one ("1" then "5" gives 05).
    await caret(page, 0)
    await page.keyboard.press("ArrowUp")
    await caret(page, 3)
    await page.keyboard.press("ArrowDown")
    expect(await input_state(page)).toEqual({ value: "01:59", error: "" })
    await blur(page)
    // The seconds the layout doesn't show are 0, not the current time's.
    const today = new Date()
    expect(await model(page)).toEqual([today.getFullYear(), today.getMonth(), today.getDate(), 1, 59, 0])
  })

  test("12-hour time: PM is applied", async ({ page }) => {
    await mount(page, {
      lang: "en-US",
      model: [2026, 9, 3, 8, 0, 0],
      show_date: false,
      show_time: true,
      am_pm: true,
    })
    expect((await input_state(page)).value).toBe("08:00 AM")
    // Hour, minute, then the day period (one step up switches AM to PM).
    await caret(page, 0)
    await page.keyboard.type("1205")
    await caret(page, 6)
    await page.keyboard.press("ArrowUp")
    expect(await input_state(page)).toEqual({ value: "12:05 PM", error: "" })
    await blur(page)
    expect(await model(page)).toEqual([2026, 9, 3, 12, 5, 0])
  })
})

test.describe("empty check with '-' as a date separator", () => {
  for (const [lang, sample] of [
    ["en-CA", "2026-10-03"],
    ["nl", "03-10-2026"],
  ] as const) {
    test(`${lang}: a partly typed date is incomplete, even when clearable`, async ({ page }) => {
      await mount(page, { lang, model: [2026, 9, 3, 0, 0, 0], clearable: true })
      // The premise: this locale writes '-' between the date parts.
      expect((await input_state(page)).value).toBe(sample)
      // Clear the first part only: the rest of the date is still there.
      await caret(page, 0)
      await page.keyboard.press("Backspace")
      const st = await input_state(page)
      expect(st.value).toContain("-")
      expect(st.error).toBe("Incomplete date")
    })

    test(`${lang}: a fully cleared date is empty, so valid when clearable`, async ({ page }) => {
      await mount(page, { lang, model: null, clearable: true })
      expect((await input_state(page)).error).toBe("")
    })
  }
})

test.describe("props read live by the text input", () => {
  test("clearable turned on after mounting lets the text input clear the model", async ({ page }) => {
    await mount(page, { lang: "en-GB", model: [2026, 9, 3, 0, 0, 0], clearable: "live" })
    await page.evaluate(() => (window as unknown as W).o_clear.set(true))
    await caret(page, 0)
    await page.evaluate(() => {
      ;(document.querySelector("#holder input") as HTMLInputElement).value = ""
    })
    await blur(page)
    expect(await model(page)).toBeNull()
  })

  test("minute_step changed after mounting drives the arrow keys", async ({ page }) => {
    await mount(page, {
      lang: "en-GB",
      model: [2026, 9, 3, 8, 0, 0],
      show_date: false,
      show_time: true,
      minute_step: "live",
    })
    await page.evaluate(() => (window as unknown as W).o_step.set(15))
    await caret(page, 3)
    await page.keyboard.press("ArrowUp")
    expect((await input_state(page)).value).toBe("08:15")
  })

  test("a minute step above 30 is capped at 30", async ({ page }) => {
    await mount(page, {
      lang: "en-GB",
      model: [2026, 9, 3, 8, 0, 0],
      show_date: false,
      show_time: true,
      minute_step: 45,
    })
    await caret(page, 3)
    await page.keyboard.press("ArrowUp")
    expect((await input_state(page)).value).toBe("08:30")
  })
})

test.describe("time picker popup", () => {
  // css`` makes unique class names (`time-panel-<n>`).
  const PANEL = '[class^="time-panel-"]'
  async function open(page: Page) {
    await mount(page, { lang: "en-GB", model: [2026, 9, 3, 8, 30, 0], show_date: false, show_time: true })
    await page.click('#holder button[title="Time"]')
    await page.waitForSelector(PANEL)
    // Mark the hour column: a rebuilt column would lose the mark.
    await page.evaluate(() => {
      ;(document.querySelector(`[class^="time-panel-"] > e-column`) as HTMLElement).dataset.mark = "hours"
    })
  }

  /** The hour column's three values (above, current, below) and whether it is still the first one built. */
  function hours(page: Page) {
    return page.evaluate(() => {
      const col = document.querySelector(`[class^="time-panel-"] > e-column`) as HTMLElement
      return {
        same: col.dataset.mark === "hours",
        texts: [...col.querySelectorAll("span")].map((s) => s.textContent),
      }
    })
  }

  test("shows the current value and its neighbours", async ({ page }) => {
    await open(page)
    expect(await hours(page)).toEqual({ same: true, texts: ["09", "08", "07"] })
  })

  test("step buttons change the value without rebuilding the column", async ({ page }) => {
    await open(page)
    await page.click(`${PANEL} > e-column[data-mark="hours"] > button >> nth=0`)
    expect(await hours(page)).toEqual({ same: true, texts: ["08", "07", "06"] })
    expect(await model(page)).toEqual([2026, 9, 3, 7, 30, 0])
    await page.click(`${PANEL} > e-column[data-mark="hours"] > button >> nth=1`)
    await page.click(`${PANEL} > e-column[data-mark="hours"] > button >> nth=1`)
    expect(await hours(page)).toEqual({ same: true, texts: ["10", "09", "08"] })
    expect(await model(page)).toEqual([2026, 9, 3, 9, 30, 0])
  })

  test("the wheel steps the value and is not scrolled by the page", async ({ page }) => {
    await open(page)
    const prevented = await page.evaluate(() => {
      const col = document.querySelector(`[class^="time-panel-"] > e-column`) as HTMLElement
      const down = new WheelEvent("wheel", { deltaY: 100, cancelable: true, bubbles: true })
      col.dispatchEvent(down)
      const up = new WheelEvent("wheel", { deltaY: -100, cancelable: true, bubbles: true })
      col.dispatchEvent(up)
      col.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, cancelable: true, bubbles: true }))
      return down.defaultPrevented && up.defaultPrevented
    })
    expect(prevented).toBe(true)
    expect(await hours(page)).toEqual({ same: true, texts: ["10", "09", "08"] })
  })

  test("a touch drag steps once per 22px, across several moves", async ({ page }) => {
    await open(page)
    await page.evaluate(() => {
      const col = document.querySelector(`[class^="time-panel-"] > e-column`) as HTMLElement
      const touch = (y: number) => new Touch({ identifier: 7, target: col, clientY: y })
      const fire = (type: string, y: number) =>
        col.dispatchEvent(
          new TouchEvent(type, { changedTouches: [touch(y)], touches: [touch(y)], cancelable: true, bubbles: true }),
        )
      // Dragging up 44px: two steps up (later hours), split over moves that each are less than a step.
      fire("touchstart", 200)
      fire("touchmove", 185)
      fire("touchmove", 170)
      fire("touchmove", 156)
      fire("touchend", 156)
      // A move after the touch ended does nothing.
      fire("touchmove", 100)
    })
    expect(await hours(page)).toEqual({ same: true, texts: ["11", "10", "09"] })
    expect(await model(page)).toEqual([2026, 9, 3, 10, 30, 0])
  })

  test("the hour column wraps around", async ({ page }) => {
    await open(page)
    for (let i = 0; i < 9; i++) await page.click(`${PANEL} > e-column[data-mark="hours"] > button >> nth=0`)
    expect(await hours(page)).toEqual({ same: true, texts: ["00", "23", "22"] })
    expect(await model(page)).toEqual([2026, 9, 3, 23, 30, 0])
  })
})

test("ScrollColumn shows its label above the values", async ({ page }) => {
  const r = await page.evaluate(() => {
    const { o, node_append, UI } = window.__ELT__
    const o_v = o(5)
    const col = UI.ScrollColumn({
      label: "Min",
      min: 0,
      max: 59,
      value: o_v,
      format: (n) => String(n),
      on_change: (n) => o_v.set(n),
    })
    node_append(document.body, col)
    return {
      first: col.firstElementChild?.textContent,
      texts: [...col.querySelectorAll("span")].map((s) => s.textContent),
    }
  })
  expect(r.first).toBe("Min")
  expect(r.texts).toEqual(["Min", "6", "5", "4"])
})

test('variant="full" draws the buttons as the inverted (filled) button', async ({ page }) => {
  await mount(page, { lang: "en-GB", model: [2026, 9, 3, 0, 0, 0], variant: "full" })
  const r = await page.evaluate(() => {
    const btn = document.querySelector('#holder button[title="Date"]') as HTMLElement
    const ref = document.createElement("button")
    ref.setAttribute("e-variant", "inverted")
    btn.parentElement!.parentElement!.appendChild(ref)
    const out = { bg: getComputedStyle(btn).backgroundColor, ref: getComputedStyle(ref).backgroundColor }
    ref.remove()
    return out
  })
  expect(r.bg).toBe(r.ref)
})
