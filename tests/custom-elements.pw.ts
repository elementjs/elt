import { expect, test } from "./fixture"

test.describe("EltCustomElement attributes", () => {
  test("an attribute written in the HTML is converted on connection (regression: the raw string was copied)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { attr, EltCustomElement, node_append } = window.__ELT__

      class TestAttrConvert extends EltCustomElement {
        declare count: unknown
      }
      // decorator syntax can't be serialized into page.evaluate, so apply @attr by hand
      attr({ convert: Number })(TestAttrConvert.prototype, "count")
      customElements.define("test-attr-convert", TestAttrConvert)

      const holder = document.createElement("div")
      holder.innerHTML = `<test-attr-convert count="3"></test-attr-convert>`
      const el = holder.firstElementChild as TestAttrConvert
      node_append(document.body, holder)
      const value = el.count
      holder.remove()
      return { type: typeof value, value }
    })
    expect(result).toEqual({ type: "number", value: 3 })
  })

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

  test("a write to the attribute's observable reaches the property (regression: the setter and the observer shared one lock, so the observer was a no-op)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { attr, EltCustomElement, node_append } = window.__ELT__

      class TestAttrObservableWrite extends EltCustomElement {
        declare label: unknown
      }
      attr(TestAttrObservableWrite.prototype, "label")
      customElements.define("test-attr-observable-write", TestAttrObservableWrite)

      const el = document.createElement("test-attr-observable-write") as TestAttrObservableWrite
      node_append(document.body, el)
      el.label = "a"
      const obs = el.attrObservable("label")
      obs.set("b")
      const after_observable_write = { property: el.label, observable: obs.get() }
      el.label = "c"
      return { after_observable_write, after_property_write: { property: el.label, observable: obs.get() } }
    })
    expect(result).toEqual({
      after_observable_write: { property: "b", observable: "b" },
      after_property_write: { property: "c", observable: "c" },
    })
  })

  test("property, observable and reflected HTML attribute stay in sync, each change observed once", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const { attr, EltCustomElement, node_append } = window.__ELT__

      class TestAttrReflect extends EltCustomElement {
        declare label: string
      }
      attr({ revert: true })(TestAttrReflect.prototype, "label")
      customElements.define("test-attr-reflect", TestAttrReflect)

      const el = document.createElement("test-attr-reflect") as TestAttrReflect
      node_append(document.body, el)
      const obs = el.attrObservable("label") as any
      const seen: string[] = []
      obs.addObserver((v: string) => {
        seen.push(v)
      })
      seen.length = 0
      const state = () => ({ property: el.label, observable: obs.get(), attribute: el.getAttribute("label") })

      el.label = "from property"
      const after_property = state()
      obs.set("from observable")
      const after_observable = state()
      el.setAttribute("label", "from attribute")
      const after_attribute = state()
      return { after_property, after_observable, after_attribute, seen }
    })
    expect(result).toEqual({
      after_property: { property: "from property", observable: "from property", attribute: "from property" },
      after_observable: { property: "from observable", observable: "from observable", attribute: "from observable" },
      after_attribute: { property: "from attribute", observable: "from attribute", attribute: "from attribute" },
      seen: ["from property", "from observable", "from attribute"],
    })
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
