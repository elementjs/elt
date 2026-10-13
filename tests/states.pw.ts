import { expect, type Page, test } from "./fixture"

/*
 * Emphasis, the selected state and interaction (docs/md/ui-states.md): written once in ui/states.css.tsx
 * and ui/form.css.tsx for every element the selectors of ui/selectors.ts match.
 */

/** Mount `html` in a fresh holder, and let transitions (hover, press, the selected fill) finish. */
async function mount(page: Page, html: string) {
  await page.evaluate(async (html) => {
    const host = document.createElement("div")
    host.id = "host"
    host.innerHTML = html
    document.body.append(host)
    await window.__ELT__.frames(3)
  }, html)
  // The pointer parks at the page's corner: whatever sits there would otherwise be hovered.
  await page.mouse.move(1000, 700)
}

const settle = (page: Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))))

/** Computed values of `selector`, and of a probe in the same place painted with `tint.surface(level)`. */
async function style(page: Page, selector: string, level?: `n+${number}`) {
  await settle(page)
  return page.evaluate(
    ({ selector, level }) => {
      const el = document.querySelector(selector) as HTMLElement
      const cs = getComputedStyle(el)
      const box = el.getBoundingClientRect()
      let ref = ""
      if (level) {
        const probe = document.createElement("div")
        probe.style.backgroundColor = window.__ELT__.UI.theme.colors.tint.surface(level)
        el.parentElement!.append(probe)
        ref = getComputedStyle(probe).backgroundColor
        probe.remove()
      }
      return {
        bg: cs.backgroundColor,
        border: cs.borderTopColor,
        border_width: cs.borderTopWidth,
        color: cs.color,
        deco: cs.textDecorationLine,
        cursor: cs.cursor,
        h: box.height,
        w: box.width,
        ref,
      }
    },
    { selector, level },
  )
}

const tint = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("div")
    probe.style.color = window.__ELT__.UI.theme.colors.tint.toString()
    document.body.append(probe)
    const c = getComputedStyle(probe).color
    probe.remove()
    return c
  })

test.describe("selected state", () => {
  const hooks: Record<string, string> = {
    "aria-pressed": `<button id="x" aria-pressed="true">a</button>`,
    "aria-selected": `<button id="x" aria-selected="true">a</button>`,
    "aria-current": `<button id="x" aria-current="page">a</button>`,
    "aria-checked": `<button id="x" aria-checked="true">a</button>`,
    "a checked toggle": `<label id="x" e-widget="toggle"><input type="checkbox" checked />a</label>`,
  }
  for (const [name, html] of Object.entries(hooks)) {
    test(`${name} paints tint + 3 with a tint border`, async ({ page }) => {
      await mount(page, html)
      const r = await style(page, "#x", "n+3")
      expect(r.bg).toBe(r.ref)
      expect(r.border).toBe(await tint(page))
    })
  }

  for (const off of [
    `<button id="x" aria-pressed="false">a</button>`,
    `<button id="x" aria-pressed="mixed">a</button>`,
    `<button id="x" aria-current="false">a</button>`,
    `<button id="x" aria-selected="false">a</button>`,
    `<label id="x" e-widget="toggle"><input type="checkbox" />a</label>`,
  ]) {
    test(`is not selected: ${off}`, async ({ page }) => {
      await mount(page, off)
      const r = await style(page, "#x", "n+3")
      expect(r.bg).not.toBe(r.ref)
    })
  }

  for (const emphasis of ["default", "bare", "tint"]) {
    test(`composes with ${emphasis}: a fill and an edge, the same size`, async ({ page }) => {
      const attr = emphasis === "default" ? "" : `e-emphasis="${emphasis}"`
      await mount(page, `<button id="off" ${attr}>Aa</button><button id="on" ${attr} aria-pressed="true">Aa</button>`)
      const on = await style(page, "#on", "n+3")
      const off = await style(page, "#off")
      expect(on.bg).toBe(on.ref)
      expect(on.border).toBe(await tint(page))
      expect(on.h).toBeCloseTo(off.h, 1)
      expect(on.w).toBeCloseTo(off.w, 1)
    })
  }

  test("a selected link stops looking like a destination, and has no fill", async ({ page }) => {
    await mount(page, `<p><button id="x" e-emphasis="link" aria-current="page">Here</button></p>`)
    const r = await style(page, "#x")
    expect(r.deco).toBe("none")
    expect(r.bg).toBe("rgba(0, 0, 0, 0)")
  })

  test("a row is filled but keeps its border", async ({ page }) => {
    await mount(
      page,
      `<e-grid columns="1"><e-grid-row id="r" aria-selected="true"><span>a</span></e-grid-row><e-grid-row id="r2"><span>b</span></e-grid-row></e-grid>`,
    )
    const r = await style(page, "#r", "n+3")
    const other = await style(page, "#r2")
    expect(r.bg).toBe(r.ref)
    expect(r.border).toBe(other.border)
  })

  test("it still paints inside a surface (a surface parent must not blank the fill)", async ({ page }) => {
    await mount(
      page,
      `<e-row surface packed border><button>b</button><button id="x" aria-pressed="true">a</button></e-row>`,
    )
    const r = await style(page, "#x")
    expect(r.bg).not.toBe("rgba(0, 0, 0, 0)")
  })

  test("hovered, it goes one level further (+ 4) and does not fall back to the hover fill", async ({ page }) => {
    await mount(page, `<button id="x" aria-pressed="true">Aa</button>`)
    await page.hover("#x")
    const r = await style(page, "#x", "n+4")
    expect(r.bg).toBe(r.ref)
  })

  test("a disabled selected control is neutral", async ({ page }) => {
    await mount(page, `<button id="x" aria-pressed="true" disabled>Aa</button>`)
    const r = await style(page, "#x", "n+3")
    expect(r.bg).not.toBe(r.ref)
    expect(r.border).not.toBe(await tint(page))
    expect(r.cursor).toBe("not-allowed")
  })

  test("an invalid selected control keeps the selected fill with the error border", async ({ page }) => {
    await mount(page, `<button id="x" aria-pressed="true" aria-invalid="true">Aa</button>`)
    const r = await style(page, "#x", "n+3")
    expect(r.bg).toBe(r.ref)
    const err = await page.evaluate(() => {
      const probe = document.createElement("div")
      probe.style.color = window.__ELT__.UI.theme.colors.error.toString()
      document.body.append(probe)
      const c = getComputedStyle(probe).color
      probe.remove()
      return c
    })
    expect(r.border).toBe(err)
  })
})

test.describe("emphasis", () => {
  test("bare is as tall as a default button, with a transparent edge", async ({ page }) => {
    await mount(
      page,
      `<e-row align="start"><button id="a">Aa</button><button id="b" e-emphasis="bare">Aa</button></e-row>`,
    )
    const a = await style(page, "#a")
    const b = await style(page, "#b")
    expect(b.h).toBeCloseTo(a.h, 1)
    expect(b.border_width).toBe(a.border_width)
    expect(b.border).toBe("rgba(0, 0, 0, 0)")
    expect(b.bg).toBe("rgba(0, 0, 0, 0)")
  })

  test("link is inline text: no padding, no border, underlined", async ({ page }) => {
    await mount(page, `<p>Some <button id="x" e-emphasis="link">link text</button> here.</p>`)
    const r = await style(page, "#x")
    expect(r.border_width).toBe("0px")
    expect(r.deco).toBe("underline")
    expect(r.h).toBeLessThan(24)
  })

  test("link text wraps over lines in an <a>, a button stays in one piece (so prose uses <a>)", async ({ page }) => {
    await mount(
      page,
      `<p style="width: 120px">Some <button id="b" e-emphasis="link">a long link text that wraps</button> and <a id="a" href="#x" e-emphasis="link">another long link text that wraps</a> end.</p>`,
    )
    const rects = (id: string) => page.evaluate((id) => document.getElementById(id)!.getClientRects().length, id)
    expect(await rects("a")).toBeGreaterThan(1)
    expect(await rects("b")).toBe(1)
  })

  test("an a without emphasis is tinted link text; with one it is a control, with no visited color", async ({
    page,
  }) => {
    await mount(
      page,
      `<a id="plain" href="#a">plain</a> <a id="nav" href="#b" e-emphasis="bare">nav</a> <a id="btn" href="#c" e-emphasis="tint">btn</a>`,
    )
    const plain = await style(page, "#plain")
    const nav = await style(page, "#nav")
    const btn = await style(page, "#btn")
    expect(plain.color).toBe(await tint(page))
    expect(plain.border_width).toBe("0px")
    expect(nav.border_width).toBe("1px")
    expect(nav.border).toBe("rgba(0, 0, 0, 0)")
    expect(nav.color).not.toBe(plain.color)
    expect(btn.border).toBe(await tint(page))
    await page.hover("#nav")
    expect((await style(page, "#nav")).deco).toBe("none")
  })

  test("a toggle takes an emphasis", async ({ page }) => {
    await mount(page, `<label id="x" e-widget="toggle" e-emphasis="bare"><input type="checkbox" />Aa</label>`)
    const r = await style(page, "#x")
    expect(r.border).toBe("rgba(0, 0, 0, 0)")
    expect(r.bg).toBe("rgba(0, 0, 0, 0)")
  })
})

test.describe("widgets", () => {
  test("a field widget looks like a text input: its edge, padding and height", async ({ page }) => {
    await mount(
      page,
      `<e-row align="start"><input id="in" value="Aa" /><div id="f" e-widget="field" contenteditable>Aa</div></e-row>`,
    )
    const input = await style(page, "#in")
    const field = await style(page, "#f")
    expect(field.border_width).toBe(input.border_width)
    expect(field.border).toBe(input.border)
    expect(field.h).toBeCloseTo(input.h, 1)
  })
})

test.describe("interaction", () => {
  test("an e-interactive element is a pointer target with a hover and a press look", async ({ page }) => {
    await mount(page, `<e-row id="x" pad e-interactive>Aa</e-row><e-row id="y" pad>Bb</e-row>`)
    const rest = await style(page, "#x")
    const plain = await style(page, "#y")
    expect(rest.cursor).toBe("pointer")
    expect(plain.cursor).not.toBe("pointer")
    await page.hover("#x")
    const hovered = await style(page, "#x", "n+1")
    expect(hovered.bg).toBe(hovered.ref)
    await page.mouse.down()
    const pressed = await style(page, "#x", "n+2")
    expect(pressed.bg).toBe(pressed.ref)
    await page.mouse.up()
  })

  test("the keyboard cursor (e-active) looks hovered", async ({ page }) => {
    await mount(page, `<e-row id="x" pad e-interactive e-active>Aa</e-row>`)
    await page.mouse.move(0, 0)
    const r = await style(page, "#x", "n+1")
    expect(r.bg).toBe(r.ref)
  })

  test("a disabled control is not a pointer target and has no hover look", async ({ page }) => {
    await mount(
      page,
      `<button id="x" disabled>Aa</button><e-row id="y" pad e-interactive aria-disabled="true">Bb</e-row>`,
    )
    await page.hover("#x", { force: true })
    const x = await style(page, "#x", "n+1")
    expect(x.cursor).toBe("not-allowed")
    expect(x.bg).not.toBe(x.ref)
    await page.hover("#y")
    const y = await style(page, "#y", "n+1")
    expect(y.cursor).toBe("not-allowed")
    expect(y.bg).not.toBe(y.ref)
  })

  test("a link emphasis has no hover fill", async ({ page }) => {
    await mount(page, `<p><button id="x" e-emphasis="link">Aa</button></p>`)
    await page.hover("#x")
    const r = await style(page, "#x")
    expect(r.bg).toBe("rgba(0, 0, 0, 0)")
  })
})

test.describe("layers", () => {
  test("interaction and state sit above components, in that order", async ({ page }) => {
    const order = await page.evaluate(() => {
      const names: string[] = []
      for (const sheet of [...document.adoptedStyleSheets, ...document.styleSheets])
        for (const rule of sheet.cssRules)
          if (rule.constructor.name === "CSSLayerStatementRule") names.push(...(rule as any).nameList)
      return names
    })
    const i = (n: string) => order.indexOf(n)
    expect(i("components")).toBeGreaterThan(-1)
    expect(i("interaction")).toBeGreaterThan(i("components"))
    expect(i("state")).toBeGreaterThan(i("interaction"))
  })
})
