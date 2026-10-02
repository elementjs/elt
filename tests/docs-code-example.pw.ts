import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

// An @inline-example's result renders only once it nears the viewport (docs/md/about-this-documentation.md).
test.describe("docs CodeExample: lazily run inline examples", () => {
  test("runs the example only when scrolled near, once, and keeps its node across the code toggle", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const { node_append } = window.__ELT__
      const { CodeExample } = window.__ELT__.Docs
      const w = window as any
      w.__runs = 0
      const spacer = document.createElement("div")
      spacer.style.height = "300vh"
      document.body.append(spacer)
      node_append(
        document.body,
        CodeExample({
          highlighted: () => "const x = 1",
          run: () => {
            w.__runs++
            const el = document.createElement("div")
            el.id = "result"
            el.textContent = "ran"
            return el
          },
        }) as Node,
      )
    })
    // Below the fold, past the margin: not run yet.
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => (window as any).__runs)).toBe(0)
    await expect(page.locator("#result")).toHaveCount(0)

    await page.evaluate(() => document.body.lastElementChild!.scrollIntoView())
    await expect(page.locator("#result")).toHaveText("ran")
    await page.evaluate(() => {
      ;(window as any).__first = document.getElementById("result")
    })

    // Switch to the code and back: same node, not re-run.
    await page.getByRole("button", { name: "Code" }).click()
    await expect(page.locator("#result")).toHaveCount(0)
    await page.getByRole("button", { name: "Example" }).click()
    await expect(page.locator("#result")).toHaveText("ran")
    const r = await page.evaluate(() => ({
      runs: (window as any).__runs,
      same: document.getElementById("result") === (window as any).__first,
    }))
    expect(r).toEqual({ runs: 1, same: true })
  })

  test("an example that throws shows its error in place of the result", async ({ page }) => {
    await page.evaluate(() => {
      const { node_append } = window.__ELT__
      const { CodeExample } = window.__ELT__.Docs
      node_append(
        document.body,
        CodeExample({
          highlighted: () => "throw",
          run: () => {
            throw new Error("example failed")
          },
        }) as Node,
      )
    })
    await expect(page.getByText("example failed")).toBeVisible()
  })
})
