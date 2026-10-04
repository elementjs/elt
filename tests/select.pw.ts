import { expect, type Page, test } from "./fixture"

type W = Window & {
  o_model: { get(): unknown; set(v: unknown): void }
  o_query: { get(): string }
  resolvers: ((v: string[]) => void)[]
  rejecters: ((e: unknown) => void)[]
  o_options: { set(v: unknown): void }
}

const FRUITS = ["Apple", "Banana", "Cherry", "Crème brûlée", "Date", "Elderberry"]

/** Mount a Select on `model`'s initial value; `completion` turns completion on. */
async function mount(page: Page, opts: { completion?: boolean; initial?: string | null; remote?: boolean }) {
  await page.evaluate(
    ({ FRUITS, opts }) => {
      const { o, node_append, UI } = window.__ELT__
      const w = window as unknown as W
      document.body.innerHTML = `<button id="before">before</button>`
      const o_model = o<string | null>(opts.initial ?? null)
      const o_query = o("")
      w.o_model = o_model
      w.o_query = o_query
      w.resolvers = []
      w.rejecters = []
      // Remote: one pending promise per query, resolved by the test.
      const o_options = o<Iterable<string> | Promise<Iterable<string>>>(
        opts.remote
          ? new Promise<string[]>((res, rej) => {
              w.resolvers.push(res)
              w.rejecters.push(rej)
            })
          : FRUITS,
      )
      w.o_options = o_options
      const select = UI.Select<string | null, string>({
        model: o_model,
        options: o_options,
        completion: opts.completion,
        query: o_query,
        placeholder: "Pick…",
        label_fn: (opt, query) => (query ? `${opt} [${query}]` : opt),
      })
      const holder = document.createElement("div")
      holder.id = "holder"
      node_append(document.body, holder)
      node_append(holder, select)
    },
    { FRUITS, opts },
  )
}

const options = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll('[role="listbox"] [role="option"]')].map((e) => e.textContent))
const active = (page: Page) => page.evaluate(() => document.querySelector('[role="option"][data-active]')?.textContent)
const model = (page: Page) => page.evaluate(() => (window as unknown as W).o_model.get())

test.describe("Select", () => {
  test("shows the selected option's label, or the placeholder", async ({ page }) => {
    await mount(page, { initial: "Banana" })
    await expect(page.locator("#holder button")).toHaveText("\u200cBanana")
    await page.evaluate(() => (window as unknown as W).o_model.set(null))
    await expect(page.locator("#holder button")).toHaveText("\u200cPick…")
  })

  test("keyboard: open, move, pick; focus comes back to the button", async ({ page }) => {
    await mount(page, { initial: "Banana" })
    await page.focus("#holder button")
    await page.keyboard.press("ArrowDown")
    await page.waitForSelector('[role="listbox"]')
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "listbox")
    // The selected option starts active.
    expect(await active(page)).toBe("Banana")
    await page.keyboard.press("ArrowDown")
    expect(await active(page)).toBe("Cherry")
    await page.keyboard.press("e") // typing jumps by first letter
    expect(await active(page)).toBe("Elderberry")
    await page.keyboard.press("Enter")
    expect(await model(page)).toBe("Elderberry")
    await page.waitForFunction(() => document.querySelector('[role="listbox"]') == null)
    await page.waitForFunction(() => document.activeElement?.closest("#holder") != null)
  })

  test("a click on an option picks it", async ({ page }) => {
    await mount(page, {})
    await page.click("#holder button")
    await page.click('[role="option"]:has-text("Date")')
    expect(await model(page)).toBe("Date")
  })

  test("after a pick, Escape goes on to the page (regression: the closed list kept eating it)", async ({ page }) => {
    await mount(page, {})
    await page.evaluate(() => {
      const w = window as unknown as W & { escapes: number }
      w.escapes = 0
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") w.escapes++
      })
    })
    await page.click("#holder button")
    await page.click('[role="option"]:has-text("Date")')
    await page.waitForFunction(() => document.querySelector('[role="listbox"]') == null)
    await page.keyboard.press("Escape")
    expect(await page.evaluate(() => (window as unknown as W & { escapes: number }).escapes)).toBe(1)
  })
})

test.describe("Select completion", () => {
  test("a click turns it into an input holding the option's text, all selected, with the full list", async ({
    page,
  }) => {
    await mount(page, { completion: true, initial: "Cherry" })
    await page.click("#holder button")
    const input = page.locator('#holder input[role="combobox"]')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()
    expect(await input.inputValue()).toBe("Cherry")
    const selection = await input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])
    expect(selection).toEqual([0, 6])
    await page.waitForSelector('[role="listbox"]')
    // Until edited, the query is "": every option, the current one active.
    expect(await options(page)).toEqual(FRUITS)
    expect(await active(page)).toBe("Cherry")
  })

  test("typing filters ignoring case and accents, label_fn gets the query, Enter picks the first", async ({ page }) => {
    await mount(page, { completion: true })
    await page.click("#holder button")
    await page.keyboard.type("CREME")
    await expect.poll(() => options(page)).toEqual(["Crème brûlée [CREME]"])
    expect(await page.evaluate(() => (window as unknown as W).o_query.get())).toBe("CREME")
    await page.keyboard.press("Enter")
    expect(await model(page)).toBe("Crème brûlée")
    // Back to the button, showing the label; the query is dropped.
    await expect(page.locator('#holder input[role="combobox"]')).toBeHidden()
    await expect(page.locator("#holder button")).toHaveText("\u200cCrème brûlée")
    expect(await page.evaluate(() => (window as unknown as W).o_query.get())).toBe("")
  })

  test("arrows move through the filtered options while focus stays in the input", async ({ page }) => {
    await mount(page, { completion: true })
    await page.click("#holder button")
    await page.keyboard.type("e")
    await expect.poll(() => options(page)).toHaveLength(5)
    await page.keyboard.press("ArrowDown")
    expect(await active(page)).toMatch(/^Cherry/)
    const r = await page.evaluate(() => {
      const input = document.activeElement as HTMLInputElement
      const id = input.getAttribute("aria-activedescendant")
      return { role: input.getAttribute("role"), named: id ? document.getElementById(id)?.textContent : null }
    })
    expect(r.role).toBe("combobox")
    expect(r.named).toMatch(/^Cherry/)
  })

  test("Escape and blur drop the typing and keep the model", async ({ page }) => {
    await mount(page, { completion: true, initial: "Apple" })
    await page.click("#holder button")
    await page.keyboard.type("Ban")
    await page.keyboard.press("Escape")
    await expect(page.locator('#holder input[role="combobox"]')).toBeHidden()
    expect(await model(page)).toBe("Apple")
    await expect(page.locator("#holder button")).toBeFocused()

    await page.click("#holder button")
    await page.keyboard.type("Dat")
    await page.click("#before")
    await expect(page.locator('#holder input[role="combobox"]')).toBeHidden()
    expect(await model(page)).toBe("Apple")
  })

  test("object options without text_fn throw in completion mode", async ({ page }) => {
    const message = await page.evaluate(() => {
      const { o, node_append, UI } = window.__ELT__
      try {
        const select = UI.Select({ model: o<{ id: number } | null>(null), options: [{ id: 1 }], completion: true })
        node_append(document.body, select)
        return null
      } catch (e) {
        return (e as Error).message
      }
    })
    expect(message).toContain("text_fn")
  })
})

test.describe("Select with promise options", () => {
  test("shows a loading row, then the results unfiltered; a stale reply is ignored", async ({ page }) => {
    await mount(page, { completion: true, remote: true })
    await page.click("#holder button")
    await page.waitForSelector('[role="listbox"] [aria-live]') // the spinner row
    // The caller derives a new promise from the query: replace the pending one.
    await page.keyboard.type("x")
    await page.evaluate(() => {
      const w = window as unknown as W
      w.o_options.set(
        new Promise<string[]>((res) => {
          w.resolvers.push(res)
        }),
      )
    })
    // The first (now stale) promise resolves after the second was made: ignored.
    await page.evaluate(() => (window as unknown as W).resolvers[0](["Stale"]))
    await page.evaluate(() => (window as unknown as W).resolvers[1](["Remote one", "Remote two"]))
    // Not filtered by "x": the server already filtered.
    await expect.poll(() => options(page)).toEqual(["Remote one [x]", "Remote two [x]"])
    await expect(page.locator('[role="listbox"] [aria-live]')).toHaveCount(0)
  })

  test("a rejected promise keeps the last options and adds an error row", async ({ page }) => {
    await mount(page, { remote: true })
    await page.evaluate(() => (window as unknown as W).resolvers[0](["One", "Two"]))
    await page.click("#holder button")
    await expect.poll(() => options(page)).toEqual(["One", "Two"])
    await page.evaluate(() => {
      const w = window as unknown as W
      const p = new Promise<string[]>((_, rej) => {
        w.rejecters.push(rej)
      })
      p.catch(() => {})
      w.o_options.set(p)
    })
    await page.evaluate(() => (window as unknown as W).rejecters[1](new Error("down")))
    await expect(page.locator('[role="listbox"]')).toContainText("Couldn't load the options")
    expect(await options(page)).toEqual(["One", "Two"])
  })

  test("the selected value shows before the options load (the value is the option)", async ({ page }) => {
    await mount(page, { remote: true, initial: "Preset" })
    await expect(page.locator("#holder button")).toHaveText("\u200cPreset")
  })
})
