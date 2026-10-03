import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

// Disabled controls move their full-strength colors halfway toward the background (`.mid`), with no
// transparency (docs/md/ui-theme.md, "State").
test.describe("disabled controls", () => {
  /** Mounts `html`, returns the computed color/opacity of `selector`, and the reference value of `mix`
   * (a theme.colors expression such as "text.mid") resolved through the same element's context. */
  async function probe(page: import("@playwright/test").Page, html: string, selector: string, mix: string) {
    return page.evaluate(
      ({ html, selector, mix }) => {
        const { theme } = window.__ELT__.UI
        const host = document.createElement("div")
        host.innerHTML = html
        document.body.appendChild(host)
        const el = host.querySelector(selector) as HTMLElement
        const [family, step] = mix.split(".")
        const ref = document.createElement("span")
        ref.style.color = (theme.colors as any)[family][step].toString()
        el.parentElement!.appendChild(ref)
        const cs = getComputedStyle(el)
        return { color: cs.color, opacity: cs.opacity, ref: getComputedStyle(ref).color }
      },
      { html, selector, mix },
    )
  }

  test("a disabled default button uses text.mid and is fully opaque", async ({ page }) => {
    const r = await probe(page, `<button disabled>b</button>`, "button", "text.mid")
    expect(r.opacity).toBe("1")
    expect(r.color).toBe(r.ref)
  })

  // A disabled control is furniture, whatever its variant: it loses its tint for neutral.
  test("a disabled tint button uses text.mid, like the default one", async ({ page }) => {
    const r = await probe(page, `<button e-variant="tint" disabled>b</button>`, "button", "text.mid")
    expect(r.opacity).toBe("1")
    expect(r.color).toBe(r.ref)
  })

  test("a disabled tint button's border is neutral.mid", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      document.body.insertAdjacentHTML("beforeend", `<div id="h"><button e-variant="tint" disabled>b</button></div>`)
      const ref = document.createElement("span")
      ref.style.borderColor = theme.colors.neutral.mid.toString()
      document.getElementById("h")!.appendChild(ref)
      return {
        border: getComputedStyle(document.querySelector("#h > button")!).borderTopColor,
        ref: getComputedStyle(ref).borderTopColor,
      }
    })
    expect(r.border).toBe(r.ref)
  })

  test("a disabled inverted button's fill is mixed with neutral, not tint", async ({ page }) => {
    const r = await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<button id="d" e-variant="inverted" disabled>b</button>
         <div id="n" style="background: color-mix(in oklab, var(--e-light-color-bg) 50%, var(--e-light-color-neutral) 50%)"></div>`,
      )
      const bg = (id: string) => getComputedStyle(document.getElementById(id)!).backgroundColor
      return { d: bg("d"), n: bg("n") }
    })
    expect(r.d).toBe(r.n)
  })

  test("a disabled toggle is neutral: border neutral.mid, checked fill neutral + 3", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { theme } = window.__ELT__.UI
      document.body.insertAdjacentHTML(
        "beforeend",
        `<e-row id="r"><label e-variant="toggle"><input type="checkbox" disabled>a</label><label e-variant="toggle"><input type="checkbox" checked disabled>b</label></e-row>`,
      )
      const row = document.getElementById("r")!
      const ref = document.createElement("div")
      ref.style.borderColor = theme.colors.neutral.mid.toString()
      ref.style.backgroundColor = theme.colors.neutral.surface("n+3")
      row.appendChild(ref)
      const [off, on] = [...row.querySelectorAll("label")].map((l) => getComputedStyle(l))
      const rs = getComputedStyle(ref)
      return {
        off_border: off.borderTopColor,
        on_border: on.borderTopColor,
        on_bg: on.backgroundColor,
        ref_border: rs.borderTopColor,
        ref_bg: rs.backgroundColor,
      }
    })
    expect(r.off_border).toBe(r.ref_border)
    expect(r.on_border).toBe(r.ref_border)
    expect(r.on_bg).toBe(r.ref_bg)
  })

  test("a label around a disabled control uses text.mid and is fully opaque", async ({ page }) => {
    const r = await probe(page, `<label><input type="checkbox" disabled/> l</label>`, "label", "text.mid")
    expect(r.opacity).toBe("1")
    expect(r.color).toBe(r.ref)
  })
})

test.describe("$auto_grow (regression: resizing inside its ResizeObserver raised 'ResizeObserver loop completed with undelivered notifications')", () => {
  test("rewraps when its width changes, without a ResizeObserver loop error", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { node_append } = window.__ELT__
      const { $auto_grow } = window.__ELT__.UI
      let errors = 0
      window.addEventListener("error", (e) => {
        if (e.message.includes("ResizeObserver")) errors++
      })
      // An observed container around the textarea, like a grid whose columns are watched.
      const box = document.createElement("div")
      box.style.width = "600px"
      new ResizeObserver(() => {}).observe(box)
      const ta = document.createElement("textarea")
      ta.value = "word ".repeat(40)
      ta.style.width = "100%" // follows the box, like a grid cell
      node_append(ta, $auto_grow())
      box.appendChild(ta)
      node_append(document.body, box)
      const frames = (n: number) =>
        new Promise<void>((r) => {
          const step = (k: number) => (k === 0 ? r() : requestAnimationFrame(() => step(k - 1)))
          step(n)
        })
      await frames(3)
      const wide = ta.getBoundingClientRect().height
      box.style.width = "150px" // narrower: more lines
      await frames(3)
      const narrow = ta.getBoundingClientRect().height
      await new Promise((r) => setTimeout(r, 50))
      return { wide, narrow, errors }
    })
    expect(result.narrow).toBeGreaterThan(result.wide)
    expect(result.errors).toBe(0)
  })
})
