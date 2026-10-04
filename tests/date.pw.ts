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
  variant?: "inverted" | "full" | "tint"
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
    await caret(page, 0)
    await page.keyboard.type("0159")
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

// "full" is the deprecated former name of "inverted".
for (const variant of ["inverted", "full"] as const) {
  test(`variant="${variant}" draws the buttons as the inverted (filled) button`, async ({ page }) => {
    await mount(page, { lang: "en-GB", model: [2026, 9, 3, 0, 0, 0], variant })
    const r = await page.evaluate(() => {
      const btn = document.querySelector('#holder button[title="Date"]') as HTMLElement
      const ref = document.createElement("button")
      ref.setAttribute("e-variant", "inverted")
      btn.parentElement!.parentElement!.appendChild(ref)
      const out = {
        attr: btn.getAttribute("e-variant"),
        bg: getComputedStyle(btn).backgroundColor,
        ref: getComputedStyle(ref).backgroundColor,
      }
      ref.remove()
      return out
    })
    expect(r).toEqual({ attr: "inverted", bg: r.ref, ref: r.ref })
  })
}

test.describe("faded text uses theme colors, not opacity", () => {
  /**
   * The computed color and opacity of `sel`, and the computed color of a reference span placed next
   * to it whose color is the theme color at `path` (e.g. "tint.faded"): the mix reads the ambient
   * `bg`, so the reference sits in the same place.
   */
  function faded(page: Page, sel: string, path: string) {
    return page.evaluate(
      ([sel, path]) => {
        const el = document.querySelector(sel) as HTMLElement
        const [family, step] = path.split(".") as ["tint" | "text", "faded"]
        const ref = document.createElement("span")
        ref.style.color = window.__ELT__.UI.theme.colors[family][step].toString()
        el.parentElement!.appendChild(ref)
        const out = {
          color: getComputedStyle(el).color,
          opacity: getComputedStyle(el).opacity,
          ref: getComputedStyle(ref).color,
        }
        ref.remove()
        return out
      },
      [sel, path] as const,
    )
  }

  test("a calendar day outside the month is tint.faded", async ({ page }) => {
    await mount(page, { lang: "en-GB", model: [2026, 9, 15, 0, 0, 0] })
    await page.click('#holder button[title="Date"]')
    await page.waitForSelector('[class^="date-day-"].outside')
    const r = await faded(page, '[class^="date-day-"].outside', "tint.faded")
    expect(r).toEqual({ color: r.ref, opacity: "1", ref: r.ref })
    // ... and it differs from a day of the month.
    const in_month = await page.evaluate(
      () => getComputedStyle(document.querySelector('[class^="date-day-"]:not(.outside)') as HTMLElement).color,
    )
    expect(in_month).not.toBe(r.color)
  })

  test("the time columns' neighbouring values are text.faded", async ({ page }) => {
    await mount(page, { lang: "en-GB", model: [2026, 9, 3, 8, 30, 0], show_date: false, show_time: true })
    await page.click('#holder button[title="Time"]')
    await page.waitForSelector('[class^="scroll-adj-"]')
    const r = await faded(page, '[class^="scroll-adj-"]', "text.faded")
    expect(r).toEqual({ color: r.ref, opacity: "1", ref: r.ref })
  })
})

test.describe("typing digits into the text field", () => {
  /** Mount an empty, clearable picker, put the caret at `pos` and type `keys`. */
  async function type_into_empty(page: Page, opts: Omit<MountOpts, "model" | "clearable">, pos: number, keys: string) {
    await mount(page, { ...opts, model: null, clearable: true })
    await caret(page, pos)
    await page.keyboard.type(keys)
    return input_state(page)
  }

  /** The selected range of the input: the segment the next digit goes to. */
  function selected(page: Page) {
    return page.evaluate(() => {
      const input = document.querySelector("#holder input") as HTMLInputElement
      return [input.selectionStart, input.selectionEnd]
    })
  }

  const time_24h = { lang: "en-GB", show_date: false, show_time: true }
  const time_12h = { lang: "en-US", show_date: false, show_time: true, am_pm: true }

  test("24-hour time: two digits fill the minutes of an empty field", async ({ page }) => {
    expect(await type_into_empty(page, time_24h, 3, "15")).toEqual({ value: "--:15", error: "Incomplete date" })
  })

  test("24-hour time: digits fill each segment in turn, then the model", async ({ page }) => {
    expect(await type_into_empty(page, time_24h, 0, "2359")).toEqual({ value: "23:59", error: "" })
    await blur(page)
    const today = new Date()
    expect(await model(page)).toEqual([today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 0])
  })

  test("a digit that no second digit could follow completes the segment at once", async ({ page }) => {
    // 24-hour: 3 can't start an hour (30 > 23), 6 can't start a minute (60 > 59).
    expect(await type_into_empty(page, time_24h, 0, "36")).toEqual({ value: "03:06", error: "" })
  })

  test("en-GB date: a whole date typed into an empty field", async ({ page }) => {
    expect(await type_into_empty(page, { lang: "en-GB" }, 0, "03102026")).toEqual({ value: "03/10/2026", error: "" })
    await blur(page)
    expect(await model(page)).toEqual([2026, 9, 3, 0, 0, 0])
  })

  test("en-GB date: a day of 4-9 and a month of 2-9 complete at once", async ({ page }) => {
    expect(await type_into_empty(page, { lang: "en-GB" }, 0, "722026")).toEqual({ value: "07/02/2026", error: "" })
  })

  test("en-CA ('-' separator): the year takes four digits", async ({ page }) => {
    expect(await type_into_empty(page, { lang: "en-CA" }, 0, "20261003")).toEqual({ value: "2026-10-03", error: "" })
    await blur(page)
    expect(await model(page)).toEqual([2026, 9, 3, 0, 0, 0])
  })

  test("en-CA: a date typed with its separators", async ({ page }) => {
    // Each '-' follows a segment that completed on its own: it doesn't skip the next one.
    expect(await type_into_empty(page, { lang: "en-CA" }, 0, "2026-10-03")).toEqual({ value: "2026-10-03", error: "" })
  })

  test("en-US date: a separator ends a one-digit segment", async ({ page }) => {
    // Month 1 and day 1 could each take a second digit: '/' ends them.
    expect(await type_into_empty(page, { lang: "en-US" }, 0, "1/1/2026")).toEqual({ value: "01/01/2026", error: "" })
  })

  test("en-US date: a separator after a segment that completed on its own does nothing", async ({ page }) => {
    // Day 5 completes at once (50 > 31) and selects the year: the '/' after it doesn't skip the year.
    expect(await type_into_empty(page, { lang: "en-US" }, 0, "1/5/2026")).toEqual({ value: "01/05/2026", error: "" })
  })

  test("a separator typed in a segment the user moved to selects the next one", async ({ page }) => {
    await mount(page, { lang: "en-GB", model: [2026, 9, 3, 0, 0, 0] })
    await caret(page, 3)
    await page.keyboard.type("/")
    expect(await selected(page)).toEqual([6, 10])
    await page.keyboard.type("2027")
    expect((await input_state(page)).value).toBe("03/10/2027")
  })

  test("12-hour time: hour, minutes, then the day period is selected", async ({ page }) => {
    // 2 can't start a 12-hour hour (20 > 12): it completes at once.
    expect((await type_into_empty(page, time_12h, 0, "245")).value).toBe("02:45 AM")
    expect(await selected(page)).toEqual([6, 8])
  })

  test("12-hour time: 1 waits for a second digit", async ({ page }) => {
    expect((await type_into_empty(page, time_12h, 0, "1")).value).toBe("01:-- AM")
    expect(await selected(page)).toEqual([0, 2])
    await page.keyboard.type("1")
    expect((await input_state(page)).value).toBe("11:-- AM")
    expect(await selected(page)).toEqual([3, 5])
  })

  test("typing into a segment that has a value replaces it", async ({ page }) => {
    await mount(page, { lang: "en-GB", model: [2026, 9, 3, 8, 47, 0], show_date: false, show_time: true })
    // One digit: the minutes become 05 (not 57, editing one character), and wait for a second one.
    await caret(page, 3)
    await page.keyboard.type("5")
    expect((await input_state(page)).value).toBe("08:05")
    await page.keyboard.type("2")
    expect((await input_state(page)).value).toBe("08:52")
    await blur(page)
    expect(await model(page)).toEqual([2026, 9, 3, 8, 52, 0])
  })

  test("moving to another segment starts a new collection", async ({ page }) => {
    await type_into_empty(page, time_24h, 0, "1")
    // ArrowRight then ArrowLeft come back to the hour: the next digit starts over.
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("ArrowLeft")
    await page.keyboard.type("2")
    expect((await input_state(page)).value).toBe("02:--")
    // A click on the segment too (it selects the segment on the next frame).
    const click_hour = async () => {
      const box = (await page.locator("#holder input").boundingBox())!
      await page.mouse.click(box.x + 12, box.y + box.height / 2)
      await page.evaluate(() => window.__ELT__.frames(2))
    }
    await click_hour()
    await page.keyboard.type("1")
    expect((await input_state(page)).value).toBe("01:--")
    await click_hour()
    await page.keyboard.type("2")
    expect((await input_state(page)).value).toBe("02:--")
  })

  test("a Shift press doesn't end the collection (layouts that type digits with Shift)", async ({ page }) => {
    await type_into_empty(page, time_24h, 3, "1")
    await page.keyboard.press("Shift")
    await page.keyboard.type("5")
    expect((await input_state(page)).value).toBe("--:15")
  })

  test("the last segment stays selected; a further digit starts it over", async ({ page }) => {
    await type_into_empty(page, time_24h, 3, "45")
    expect(await selected(page)).toEqual([3, 5])
    await page.keyboard.type("7")
    expect((await input_state(page)).value).toBe("--:07")
  })
})

test.describe("on-screen keyboards (text sent as beforeinput)", () => {
  /**
   * Type `text` as an Android on-screen keyboard does: for each character, a `keydown` whose key is
   * `Unidentified` (keyCode 229), then a cancelable `beforeinput` carrying the character. Returns, for each
   * character, whether its `beforeinput` was cancelled.
   */
  function soft_type(page: Page, text: string, inputType = "insertText") {
    return page.evaluate(
      ({ text, inputType }) => {
        const input = document.querySelector("#holder input") as HTMLInputElement
        return [...text].map((ch) => {
          input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Unidentified", keyCode: 229, bubbles: true, cancelable: true }),
          )
          const ev = new InputEvent("beforeinput", { inputType, data: ch, bubbles: true, cancelable: true })
          input.dispatchEvent(ev)
          return ev.defaultPrevented
        })
      },
      { text, inputType },
    )
  }

  const time_24h = { lang: "en-GB", model: null, clearable: true, show_date: false, show_time: true }

  test("digits fill the segments as typed keys do", async ({ page }) => {
    await mount(page, { lang: "en-GB", model: null, clearable: true })
    await caret(page, 0)
    // Each digit's keydown is `Unidentified`: it must not end the collection (month 12, not 1 then 2).
    expect(await soft_type(page, "03122026")).toEqual(Array(8).fill(true))
    expect(await input_state(page)).toEqual({ value: "03/12/2026", error: "" })
    await blur(page)
    expect(await model(page)).toEqual([2026, 11, 3, 0, 0, 0])
  })

  test("a separator ends a one-digit segment; other characters are not inserted", async ({ page }) => {
    await mount(page, { lang: "en-US", model: null, clearable: true })
    await caret(page, 0)
    expect(await soft_type(page, "1/x5/2026")).toEqual(Array(9).fill(true))
    expect((await input_state(page)).value).toBe("01/05/2026")
  })

  test("a letter ends the digits being typed", async ({ page }) => {
    await mount(page, time_24h)
    await caret(page, 3)
    await soft_type(page, "1a2")
    expect((await input_state(page)).value).toBe("--:02")
  })

  test("insertReplacementText goes through the same path", async ({ page }) => {
    await mount(page, time_24h)
    await caret(page, 0)
    await soft_type(page, "2359", "insertReplacementText")
    expect((await input_state(page)).value).toBe("23:59")
  })

  test("deleteContentBackward empties the segment, as Backspace does", async ({ page }) => {
    await mount(page, { lang: "en-GB", model: [2026, 9, 3, 8, 47, 0], show_date: false, show_time: true })
    await caret(page, 3)
    const prevented = await page.evaluate(() => {
      const input = document.querySelector("#holder input") as HTMLInputElement
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Unidentified", keyCode: 229, bubbles: true, cancelable: true }),
      )
      const ev = new InputEvent("beforeinput", { inputType: "deleteContentBackward", bubbles: true, cancelable: true })
      input.dispatchEvent(ev)
      return ev.defaultPrevented
    })
    expect(prevented).toBe(true)
    expect((await input_state(page)).value).toBe("08:--")
  })

  test("a desktop key press is handled once: its keydown is cancelled, so no beforeinput follows", async ({ page }) => {
    await mount(page, time_24h)
    await page.evaluate(() => {
      const w = window as unknown as { beforeinputs: number }
      w.beforeinputs = 0
      document.querySelector("#holder input")!.addEventListener("beforeinput", () => w.beforeinputs++)
    })
    await caret(page, 3)
    // Handled a second time, the 1 would be collected twice: minute 11.
    await page.keyboard.type("1")
    expect((await input_state(page)).value).toBe("--:01")
    expect(await page.evaluate(() => (window as unknown as { beforeinputs: number }).beforeinputs)).toBe(0)
    // A letter is not handled by keydown: its beforeinput fires and is cancelled.
    await page.keyboard.type("a")
    expect((await input_state(page)).value).toBe("--:01")
    expect(await page.evaluate(() => (window as unknown as { beforeinputs: number }).beforeinputs)).toBe(1)
  })
})
