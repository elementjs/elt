import { test, expect } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("$observe", () => {
  test("starts observing when appended and stops after node_remove", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, $observe, node_append, node_remove, node_is_observing, node_is_connected } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []

      const obs = o(10)
      let count = 0
      const el = document.createElement("div")
      $observe(obs, () => {
        count++
      })(el)

      out.push({ name: "count before append", actual: count, expected: 0 })
      out.push({ name: "not observing before append", actual: node_is_observing(el), expected: false })

      node_append(document.body, el)
      out.push({ name: "count after append", actual: count, expected: 1 })
      out.push({ name: "observing after append", actual: node_is_observing(el), expected: true })
      out.push({ name: "connected after append", actual: node_is_connected(el), expected: true })

      obs.set(20)
      out.push({ name: "count after set", actual: count, expected: 2 })

      node_remove(el)
      out.push({ name: "not observing after remove", actual: node_is_observing(el), expected: false })
      out.push({ name: "not connected after remove", actual: node_is_connected(el), expected: false })

      obs.set(30)
      out.push({ name: "count unchanged after remove+set", actual: count, expected: 2 })

      return out
    })
    for (const r of results) expect(r.actual, r.name).toBe(r.expected)
  })

  test("$observe with changes_only skips the initial callback until the value changes", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, $observe, node_append, node_remove } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []

      const obs = o(1)
      let count = 0
      const el = document.createElement("div")
      $observe(obs, () => {
        count++
      }, { changes_only: true })(el)

      node_append(document.body, el)
      out.push({ name: "count after append", actual: count, expected: 0 })

      obs.set(2)
      out.push({ name: "count after first change", actual: count, expected: 1 })

      obs.set(2)
      out.push({ name: "count after same value set", actual: count, expected: 1 })

      node_remove(el)
      obs.set(3)
      out.push({ name: "count after remove+set", actual: count, expected: 1 })

      return out
    })
    for (const r of results) expect(r.actual, r.name).toBe(r.expected)
  })

  test("passes the decorated node as the third callback argument", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o, $observe, node_append, node_remove } = window.__ELT__
      const obs = o("value")
      let received: Node | null = null
      const el = document.createElement("div")
      $observe(obs, (_: unknown, __: unknown, node: Node) => {
        received = node
      })(el)

      node_append(document.body, el)
      const matches = received === el
      node_remove(el)
      return matches
    })
    expect(result).toBe(true)
  })

  test("nested observed descendants stop when an ancestor is removed", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, $observe, node_append, node_remove, node_is_observing } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []

      const obs = o(1)
      let outer = 0
      let inner = 0
      const root = document.createElement("div")
      const child = document.createElement("span")
      node_append(root, child)

      $observe(obs, () => {
        outer++
      })(root)
      $observe(obs, () => {
        inner++
      })(child)

      node_append(document.body, root)
      out.push({ name: "outer after append", actual: outer, expected: 1 })
      out.push({ name: "inner after append", actual: inner, expected: 1 })
      out.push({ name: "root observing after append", actual: node_is_observing(root), expected: true })
      out.push({ name: "child observing after append", actual: node_is_observing(child), expected: true })

      node_remove(root)
      out.push({ name: "root observing after remove", actual: node_is_observing(root), expected: false })
      out.push({ name: "child observing after remove", actual: node_is_observing(child), expected: false })

      obs.set(2)
      out.push({ name: "outer unchanged after remove+set", actual: outer, expected: 1 })
      out.push({ name: "inner unchanged after remove+set", actual: inner, expected: 1 })

      return out
    })
    for (const r of results) expect(r.actual, r.name).toBe(r.expected)
  })

  test("moving to a disconnected parent stops observation", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, $observe, node_append, node_is_observing, node_is_connected } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []

      const obs = o(1)
      let count = 0
      const el = document.createElement("div")
      $observe(obs, () => {
        count++
      })(el)

      node_append(document.body, el)
      out.push({ name: "count after append", actual: count, expected: 1 })
      out.push({ name: "observing after append", actual: node_is_observing(el), expected: true })

      const staging = document.createDocumentFragment()
      node_append(staging, el)
      out.push({ name: "not observing after move to fragment", actual: node_is_observing(el), expected: false })
      out.push({ name: "not connected (elt) after move to fragment", actual: node_is_connected(el), expected: false })
      out.push({ name: "not connected (native) after move to fragment", actual: el.isConnected, expected: false })

      obs.set(2)
      out.push({ name: "count unchanged after set", actual: count, expected: 1 })

      return out
    })
    for (const r of results) expect(r.actual, r.name).toBe(r.expected)
  })

  test("re-appending restarts observation", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, $observe, node_append, node_remove, node_is_observing } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []

      const obs = o(1)
      let count = 0
      const el = document.createElement("div")
      $observe(obs, () => {
        count++
      })(el)

      node_append(document.body, el)
      out.push({ name: "count after first append", actual: count, expected: 1 })

      node_remove(el)
      obs.set(2)
      out.push({ name: "count unchanged after remove+set", actual: count, expected: 1 })

      node_append(document.body, el)
      out.push({ name: "count after re-append", actual: count, expected: 2 })
      out.push({ name: "observing after re-append", actual: node_is_observing(el), expected: true })

      obs.set(3)
      out.push({ name: "count after set post re-append", actual: count, expected: 3 })
      node_remove(el)

      return out
    })
    for (const r of results) expect(r.actual, r.name).toBe(r.expected)
  })
})
