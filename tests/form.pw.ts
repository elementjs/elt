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

  test("a disabled tint button uses tint.mid", async ({ page }) => {
    const r = await probe(page, `<button e-variant="tint" disabled>b</button>`, "button", "tint.mid")
    expect(r.opacity).toBe("1")
    expect(r.color).toBe(r.ref)
  })

  test("a label around a disabled control uses text.mid and is fully opaque", async ({ page }) => {
    const r = await probe(page, `<label><input type="checkbox" disabled/> l</label>`, "label", "text.mid")
    expect(r.opacity).toBe("1")
    expect(r.color).toBe(r.ref)
  })
})
