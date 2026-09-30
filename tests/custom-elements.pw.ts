import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("EltCustomElement attributes", () => {
  test("an observable bound to a registered attribute forwards its values (regression: the observable itself was passed to setAttribute)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { o, attr, EltCustomElement, node_append, node_observe_attribute } = window.__ELT__

      class TestAttrForward extends EltCustomElement {
        declare label: unknown
      }
      // decorator syntax can't be serialized into page.evaluate, so apply @attr by hand
      attr(TestAttrForward.prototype, "label")
      customElements.define("test-attr-forward", TestAttrForward)

      const el = document.createElement("test-attr-forward") as TestAttrForward
      node_append(document.body, el)
      const o_label = o("first")
      node_observe_attribute(el, "label", o_label)
      const initial = el.label
      o_label.set("second")
      return { initial, updated: el.label }
    })
    expect(result).toEqual({ initial: "first", updated: "second" })
  })

  test("attrObservable() returns the observable backing a registered attribute", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { attr, EltCustomElement, node_append } = window.__ELT__

      class TestAttrObservable extends EltCustomElement {
        declare label: unknown
      }
      attr(TestAttrObservable.prototype, "label")
      customElements.define("test-attr-observable", TestAttrObservable)

      const el = document.createElement("test-attr-observable") as TestAttrObservable
      node_append(document.body, el)
      el.label = "x"
      return el.attrObservable("label").get()
    })
    expect(result).toBe("x")
  })

  test("attrObservable() throws on a key that is not a registered attribute (regression: silently returned undefined)", async ({
    page,
  }) => {
    const message = await page.evaluate(() => {
      const { EltCustomElement, node_append } = window.__ELT__

      class TestAttrMissing extends EltCustomElement {
        declare plain: unknown
      }
      customElements.define("test-attr-missing", TestAttrMissing)

      const el = document.createElement("test-attr-missing") as TestAttrMissing
      node_append(document.body, el)
      try {
        el.attrObservable("plain")
        return "no error"
      } catch (e) {
        return (e as Error).message
      }
    })
    expect(message).toContain('"plain" is not a registered attribute')
  })
})
