import { expect, test } from "./fixture"

// How packed bordered containers draw their lines at a fractional display scale (ui/layout.css.tsx,
// docs/md/ui-layout.md "packed"). Its own file: a real 125% scale is a browser launch option, and
// Playwright's emulated `deviceScaleFactor` antialiases every edge in Chromium.
test.use({ launchOptions: { args: ["--force-device-scale-factor=1.25"] }, viewport: null })

test.describe("packed border lines at a fractional display scale (regression: some seams drew 2 screen pixels wide)", () => {
  test("every interior line of a grid is one screen pixel wide", async ({ page }) => {
    // Fractional tracks, row heights and offset: a 1px gap rounds some lines to 2; a border is snapped.
    await page.evaluate(
      (html) => {
        document.body.insertAdjacentHTML("beforeend", html)
      },
      `<e-grid id="g" packed border pad="none" inline style="margin: 3.3px 0 0 7.7px; grid-template-columns: repeat(12, 17.3px);
        --e-current-surface: #fff; --e-seam-color: #000">
        ${Array.from({ length: 12 }, () => `<e-grid-row>${"<span style='height: 13.7px'></span>".repeat(12)}</e-grid-row>`).join("")}
      </e-grid>`,
    )
    const png = (await page.locator("#g").screenshot({ scale: "device" })).toString("base64")
    const widths = await page.evaluate(async (src) => {
      const img = new Image()
      img.src = `data:image/png;base64,${src}`
      await img.decode()
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, img.width, img.height).data
      // Widths of the dark runs along one line, between the first and last light pixel (the frame
      // excluded: it's a border, snapped anyway).
      const runs = (len: number, at: (i: number) => number) => {
        const res: number[] = []
        let n = 0
        let seen_light = false
        for (let i = 0; i < len; i++) {
          if (data[at(i) * 4] < 128) n++
          else {
            if (n && seen_light) res.push(n)
            n = 0
            seen_light = true
          }
        }
        return res
      }
      // Through the middle of the first row and of the first column (13.7px and 17.3px, after a
      // 1px frame).
      const y = Math.round(8 * devicePixelRatio)
      const x = Math.round(8 * devicePixelRatio)
      return {
        columns: runs(img.width, (i) => y * img.width + i),
        rows: runs(img.height, (i) => i * img.width + x),
      }
    }, png)
    expect(widths.columns).toEqual(Array(11).fill(1))
    expect(widths.rows).toEqual(Array(11).fill(1))
  })
})
