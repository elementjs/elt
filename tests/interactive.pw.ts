import { expect, type Page, test } from "./fixture"

// $interactive (ui/interactive.ts): the role, focus and keys of a button on any element, with the
// handlers staying $click. Its look is tests/states.pw.ts's.

/** Mount `html`, decorate `#x` the way `how` says, and count the clicks it gets in `window.clicks`. */
async function mount(page: Page, html: string, how: "bare" | "call" | "focusless" = "bare") {
  await page.evaluate(
    ({ html, how }) => {
      const { node_append, UI } = window.__ELT__
      const host = document.createElement("div")
      host.innerHTML = html
      document.body.append(host)
      const x = host.querySelector("#x") as HTMLElement
      ;(window as any).clicks = 0
      x.addEventListener("click", () => ((window as any).clicks += 1))
      if (how === "bare") node_append(x, UI.$interactive)
      else if (how === "call") node_append(x, UI.$interactive())
      else node_append(x, UI.$interactive({ focusable: false }))
    },
    { html, how },
  )
}
const clicks = (page: Page) => page.evaluate(() => (window as any).clicks as number)

test("a bare element becomes a button: attribute, role, tab stop", async ({ page }) => {
  await mount(page, `<e-row id="x">Aa</e-row>`)
  const r = await page.evaluate(() => {
    const x = document.querySelector("#x")!
    return [x.hasAttribute("e-interactive"), x.getAttribute("role"), x.getAttribute("tabindex")]
  })
  expect(r).toEqual([true, "button", "0"])
})

test("it is usable bare, called, or with options", async ({ page }) => {
  for (const how of ["bare", "call", "focusless"] as const) {
    await page.reload()
    await mount(page, `<e-row id="x">Aa</e-row>`, how)
    const tab = await page.evaluate(() => document.querySelector("#x")!.getAttribute("tabindex"))
    expect(tab, how).toBe(how === "focusless" ? null : "0")
  }
})

test("Enter activates, once per press", async ({ page }) => {
  await mount(page, `<e-row id="x">Aa</e-row>`)
  await page.focus("#x")
  await page.keyboard.press("Enter")
  expect(await clicks(page)).toBe(1)
})

test("Space activates on release, and does not scroll the page", async ({ page }) => {
  await mount(page, `<e-row id="x">Aa</e-row>`)
  await page.focus("#x")
  // The decorator's listener is on the element, this one above it: it sees what the decorator did.
  await page.evaluate(() =>
    window.addEventListener("keydown", (ev) => ((window as any).prevented = ev.defaultPrevented), { once: true }),
  )
  await page.keyboard.down("Space")
  expect(await page.evaluate(() => (window as any).prevented)).toBe(true)
  expect(await clicks(page)).toBe(0)
  await page.keyboard.up("Space")
  expect(await clicks(page)).toBe(1)
})

test("a key pressed in a control inside it is that control's", async ({ page }) => {
  await mount(page, `<e-row id="x"><input id="in" /></e-row>`)
  await page.focus("#in")
  await page.keyboard.press("Enter")
  await page.keyboard.press("Space")
  expect(await clicks(page)).toBe(0)
})

test("aria-disabled: the keys do nothing", async ({ page }) => {
  await mount(page, `<e-row id="x" aria-disabled="true">Aa</e-row>`)
  await page.focus("#x")
  await page.keyboard.press("Enter")
  await page.keyboard.press("Space")
  expect(await clicks(page)).toBe(0)
})

test("an element with a role of its own keeps it, and its keys", async ({ page }) => {
  await mount(page, `<e-row id="x" role="option">Aa</e-row>`, "focusless")
  const r = await page.evaluate(() => {
    const x = document.querySelector("#x")!
    return [x.getAttribute("role"), x.hasAttribute("e-interactive"), x.hasAttribute("tabindex")]
  })
  expect(r).toEqual(["option", true, false])
  await page.evaluate(() => (document.querySelector("#x") as HTMLElement).focus())
  await page.keyboard.press("Enter")
  expect(await clicks(page)).toBe(0)
})

test("a native button only gets the attribute", async ({ page }) => {
  await mount(page, `<button id="x">Aa</button>`)
  const r = await page.evaluate(() => {
    const x = document.querySelector("#x")!
    return [x.hasAttribute("e-interactive"), x.hasAttribute("role"), x.hasAttribute("tabindex")]
  })
  expect(r).toEqual([true, false, false])
  await page.focus("#x")
  await page.keyboard.press("Enter")
  expect(await clicks(page)).toBe(1)
})
