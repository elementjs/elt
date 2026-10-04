import { expect, test } from "./fixture"

const ICONS = ["CaretDown", "CaretLeft", "CaretRight", "Calendar", "Clock", "MagnifyingGlass", "X", "Trash", "Check"]

// Every shape of every icon gets the shared stroke attributes from the icon builder (ui/icons.tsx),
// and the icon is 1em square, set by its 256×256 view box — phosphor's invisible 256×256 bounding
// rect isn't needed for that (it painted nothing and took no clicks).
test("icons: 1em square, every shape stroked with the shared attributes", async ({ page }) => {
  const r = await page.evaluate((names) => {
    const UI = window.__ELT__.UI as unknown as Record<string, () => HTMLElement>
    const out: Record<string, unknown> = {}
    for (const name of names) {
      const icon = UI[name]()
      icon.style.fontSize = "32px"
      document.body.appendChild(icon)
      const svg = icon.querySelector("svg")!
      const box = svg.getBoundingClientRect()
      const shapes = [...svg.children]
      out[name] = {
        size: [box.width, box.height],
        viewBox: svg.getAttribute("viewBox"),
        stroked: shapes.every(
          (s) =>
            s.getAttribute("fill") === "none" &&
            s.getAttribute("stroke") === "currentColor" &&
            s.getAttribute("stroke-width") === "16" &&
            s.getAttribute("stroke-linecap") === "round" &&
            s.getAttribute("stroke-linejoin") === "round",
        ),
        shapes: shapes.length,
      }
    }
    return out
  }, ICONS)
  for (const name of ICONS) {
    expect(r[name], name).toMatchObject({ size: [32, 32], viewBox: "0 0 256 256", stroked: true })
  }
})
