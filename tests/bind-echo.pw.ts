import { expect, test } from "./fixture"

// A `$bind` writes the node's value into its observable when the user edits it. The observable then tells the bind
// about that very change, and the bind must not write it back into the node: that rewrites what the user is typing
// (text, caret) for nothing. `setup_bind` (src/decorators.ts) skips a value that equals what the node shows or what
// the observable held right after its own write, whether the observers ran inside the event handler or after it.
//
// These tests count the writes made to `input.value` by the bind (the user's own edit is made before counting
// starts). They describe the wanted behaviour whatever mechanism provides it.

/** Counts the writes made to `input.value` from now on. */
function spy_value_writes(input: HTMLInputElement) {
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value") as PropertyDescriptor
  let writes = 0
  Object.defineProperty(input, "value", {
    configurable: true,
    get() {
      return desc.get?.call(this)
    },
    set(v) {
      writes++
      desc.set?.call(this, v)
    },
  })
  return {
    writes: () => writes,
    reset: () => {
      writes = 0
    },
  }
}

declare global {
  interface Window {
    __spy_value_writes__: typeof spy_value_writes
  }
}

test.beforeEach(async ({ page }) => {
  await page.evaluate(`window.__spy_value_writes__ = ${spy_value_writes.toString()}`)
})

test.describe("$bind does not echo the user's edit back into the node", () => {
  test("text: the event handler's own write is not written back", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, $bind, node_append } = window.__ELT__
      const o_text = o("hello")
      const input = document.createElement("input")
      node_append(document.body, input)
      node_append(input, $bind.string(o_text))
      const spy = window.__spy_value_writes__(input)

      input.value = "typed"
      spy.reset()
      input.dispatchEvent(new Event("input"))
      const res = { model: o_text.get(), writes: spy.writes() }
      input.remove()
      return res
    })
    expect(r).toEqual({ model: "typed", writes: 0 })
  })

  test("number: typing 1.0 keeps the text 1.0 (the model is 1)", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, $bind, node_append } = window.__ELT__
      const o_num = o(0)
      const input = document.createElement("input")
      input.type = "number"
      node_append(document.body, input)
      node_append(input, $bind.number(o_num))
      const spy = window.__spy_value_writes__(input)

      input.value = "1.0"
      spy.reset()
      input.dispatchEvent(new Event("input"))
      const res = { model: o_num.get(), text: input.value, writes: spy.writes() }
      input.remove()
      return res
    })
    expect(r).toEqual({ model: 1, text: "1.0", writes: 0 })
  })

  test("an event dispatched from inside an observer (the flush is deferred) is not echoed either", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, $bind, node_append } = window.__ELT__
      const o_text = o("hello")
      const input = document.createElement("input")
      node_append(document.body, input)
      node_append(input, $bind.string(o_text))
      const spy = window.__spy_value_writes__(input)

      // Inside this observer a flush is running: the `set` made by the bind's handler is queued and its observers
      // run after this one returns, when a lock held during the handler is long released
      const trigger = o(0)
      trigger.addObserver((v: number) => {
        if (v !== 1) return
        input.value = "typed"
        spy.reset()
        input.dispatchEvent(new Event("input"))
      })
      trigger.set(1)

      const res = { model: o_text.get(), writes: spy.writes() }
      input.remove()
      return res
    })
    expect(r).toEqual({ model: "typed", writes: 0 })
  })

  // The observable may store something else than what the node holds, for a good reason (it trims, clamps, parses).
  // While the user is typing in a text control that must not rewrite the text (a trailing space, "1."): the node
  // is brought in line when the edit is committed (change, blur).
  test("a value stored differently is not written back while the user types, and is at commit", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, $bind, node_append } = window.__ELT__
      const o_source = o("hello")
      // Writes are trimmed on their way to the source
      const o_view = o_source.tf({ transform: (s: string) => s, revert: (s: string) => s.trim() })
      const input = document.createElement("input")
      node_append(document.body, input)
      node_append(input, $bind.string(o_view))
      const spy = window.__spy_value_writes__(input)

      input.focus()
      input.value = "ab "
      spy.reset()
      input.dispatchEvent(new Event("input"))
      const typing = {
        source: o_source.get(),
        text: input.value,
        writes: spy.writes(),
        focused: input.matches(":focus"),
      }

      input.blur()
      const committed = { source: o_source.get(), text: input.value, writes: spy.writes() }
      input.remove()
      return { typing, committed }
    })
    expect(r).toEqual({
      typing: { source: "ab", text: "ab ", writes: 0, focused: true },
      committed: { source: "ab", text: "ab", writes: 1 },
    })
  })

  test("a value stored differently is written back at once when nobody is typing in the control", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, $bind, node_append } = window.__ELT__
      const o_source = o("hello")
      const o_view = o_source.tf({ transform: (s: string) => s, revert: (s: string) => s.trim() })
      const input = document.createElement("input")
      node_append(document.body, input)
      node_append(input, $bind.string(o_view))
      const spy = window.__spy_value_writes__(input)

      input.value = "ab "
      spy.reset()
      input.dispatchEvent(new Event("input")) // not focused: set from code
      const res = { source: o_source.get(), text: input.value, writes: spy.writes() }
      input.remove()
      return res
    })
    expect(r).toEqual({ source: "ab", text: "ab", writes: 1 })
  })

  test("a write from elsewhere while the user types still reaches the node", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, $bind, node_append } = window.__ELT__
      const o_source = o("hello")
      const o_view = o_source.tf({ transform: (s: string) => s, revert: (s: string) => s.trim() })
      const input = document.createElement("input")
      node_append(document.body, input)
      node_append(input, $bind.string(o_view))

      input.focus()
      input.value = "ab "
      input.dispatchEvent(new Event("input"))
      o_source.set("elsewhere")
      const res = { text: input.value }
      input.remove()
      return res
    })
    expect(r).toEqual({ text: "elsewhere" })
  })

  test("a checkbox is not edited key by key: a refused value is shown at once, even while focused", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      const { o, $bind, node_append } = window.__ELT__
      const o_source = o(false)
      // The source refuses to become true
      const o_view = o_source.tf({ transform: (b: boolean) => b, revert: () => false })
      const input = document.createElement("input")
      input.type = "checkbox"
      node_append(document.body, input)
      node_append(input, $bind.boolean(o_view))

      input.focus()
      input.checked = true
      input.dispatchEvent(new Event("change"))
      const res = { source: o_source.get(), checked: input.checked }
      input.remove()
      return res
    })
    expect(r).toEqual({ source: false, checked: false })
  })

  test("a write that does not come from the node reaches the node, once", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, $bind, node_append } = window.__ELT__
      const o_text = o("hello")
      const input = document.createElement("input")
      node_append(document.body, input)
      node_append(input, $bind.string(o_text))
      const spy = window.__spy_value_writes__(input)

      spy.reset()
      o_text.set("world")
      const res = { text: input.value, writes: spy.writes() }
      input.remove()
      return res
    })
    expect(r).toEqual({ text: "world", writes: 1 })
  })
})
