import { test, expect } from "./fixture"

test.describe("$bind", () => {
  test("string binds DOM <-> observable", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, $bind, node_append } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []

      const o_text = o("hello")
      const input = document.createElement("input")
      node_append(document.body, input)
      node_append(input, $bind.string(o_text))

      out.push({ name: "initial value painted", actual: input.value, expected: "hello" })

      o_text.set("world")
      out.push({ name: "value updates from observable", actual: input.value, expected: "world" })

      input.value = "typed"
      input.dispatchEvent(new Event("input"))
      out.push({ name: "observable updates from input event", actual: o_text.get(), expected: "typed" })

      input.remove()
      return out
    })
    for (const r of results) expect(r.actual, r.name).toBe(r.expected)
  })

  test("boolean binds via the change event, not input", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, $bind, node_append } = window.__ELT__
      const out: { name: string; actual: unknown; expected: unknown }[] = []

      const o_on = o(false)
      const input = document.createElement("input")
      node_append(document.body, input)
      input.type = "checkbox"
      node_append(input, $bind.boolean(o_on))

      input.checked = true
      input.dispatchEvent(new Event("input")) // boolean listens on "change", not "input" -- should not commit
      out.push({ name: "input event does not commit", actual: o_on.get(), expected: false })

      input.dispatchEvent(new Event("change"))
      out.push({ name: "change event commits", actual: o_on.get(), expected: true })

      input.remove()
      return out
    })
    for (const r of results) expect(r.actual, r.name).toBe(r.expected)
  })

  test.describe("validity", () => {
    test("o_error mirrors native constraint validity", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o, $bind, node_append } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []

        const o_text = o("ok")
        const o_error = o(null as string | null)
        const input = document.createElement("input")
        node_append(document.body, input)
        input.required = true
        node_append(input, $bind.string(o_text, { o_error }))

        input.value = ""
        input.dispatchEvent(new Event("input"))
        out.push({ name: "o_error set when invalid", actual: o_error.get() !== null, expected: true })

        input.value = "ok again"
        input.dispatchEvent(new Event("input"))
        out.push({ name: "o_error cleared when valid", actual: o_error.get(), expected: null })

        input.remove()
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("extra_check sets and clears a custom validity message", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o, $bind, node_append } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []

        const o_text = o("ok")
        const o_error = o(null as string | null)
        const input = document.createElement("input")
        node_append(document.body, input)
        node_append(
          input,
          $bind.string(o_text, {
            o_error,
            extra_check: (value: string) => (value.length < 3 ? "too short" : null),
          }),
        )

        input.value = "hi"
        input.dispatchEvent(new Event("input"))
        out.push({ name: "o_error set for short value", actual: o_error.get(), expected: "too short" })

        input.value = "hello"
        input.dispatchEvent(new Event("input"))
        out.push({ name: "o_error cleared for long enough value", actual: o_error.get(), expected: null })

        input.remove()
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("o_error is optional -- extra_check still drives native validity without it", async ({ page }) => {
      const results = await page.evaluate(() => {
        const { o, $bind, node_append } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []

        const o_text = o("ok")
        const input = document.createElement("input")
        node_append(document.body, input)
        node_append(
          input,
          $bind.string(o_text, {
            extra_check: (value: string) => (value.length < 3 ? "too short" : null),
          }),
        )

        input.value = "hi"
        input.dispatchEvent(new Event("input"))
        out.push({ name: "native validity invalid", actual: input.validity.valid, expected: false })
        out.push({ name: "native validation message", actual: input.validationMessage, expected: "too short" })

        input.value = "hello"
        input.dispatchEvent(new Event("input"))
        out.push({ name: "native validity valid again", actual: input.validity.valid, expected: true })

        input.remove()
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })
  })

  test.describe("debounce / throttle", () => {
    test("debounce_event delays writes to the observable, using only the latest value", async ({ page }) => {
      const results = await page.evaluate(async () => {
        const { o, $bind, node_append } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

        const o_text = o("")
        const input = document.createElement("input")
        node_append(document.body, input)
        node_append(input, $bind.string(o_text, { debounce_event: 30 }))

        input.value = "a"
        input.dispatchEvent(new Event("input"))
        input.value = "ab"
        input.dispatchEvent(new Event("input"))
        input.value = "abc"
        input.dispatchEvent(new Event("input"))

        out.push({ name: "nothing flushed yet", actual: o_text.get(), expected: "" })

        await wait(60)
        out.push({ name: "latest value flushed after debounce", actual: o_text.get(), expected: "abc" })

        input.remove()
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("debounce_observable delays repainting the DOM from external writes", async ({ page }) => {
      const results = await page.evaluate(async () => {
        const { o, $bind, node_append } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

        const o_text = o("start")
        const input = document.createElement("input")
        node_append(document.body, input)
        node_append(input, $bind.string(o_text, { debounce_observable: 30 }))

        // debounce_observable also delays the initial paint on mount, since it
        // wraps the same render function node_observe uses for that -- let it land first.
        await wait(60)
        out.push({ name: "initial paint lands after debounce", actual: input.value, expected: "start" })

        o_text.set("mid")
        o_text.set("final")
        out.push({ name: "not painted yet", actual: input.value, expected: "start" })

        await wait(60)
        out.push({ name: "final value painted after debounce", actual: input.value, expected: "final" })

        input.remove()
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })
  })

  test.describe("conflicting writes", () => {
    test("a pending local edit wins over an external write by default", async ({ page }) => {
      const results = await page.evaluate(async () => {
        const { o, $bind, node_append } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

        const o_text = o("start")
        const input = document.createElement("input")
        node_append(document.body, input)
        node_append(input, $bind.string(o_text, { debounce_event: 30 }))

        input.value = "typing"
        input.dispatchEvent(new Event("input")) // pending_local = true, flush scheduled ~30ms out

        o_text.set("external") // arrives while the local edit is still pending
        out.push({ name: "external write suppressed while pending", actual: input.value, expected: "typing" })

        await wait(60)
        out.push({ name: "local edit flushed, superseding external", actual: o_text.get(), expected: "typing" })

        input.remove()
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })

    test("prioritize_observable lets an external write win immediately", async ({ page }) => {
      const results = await page.evaluate(async () => {
        const { o, $bind, node_append } = window.__ELT__
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

        const o_text = o("start")
        const input = document.createElement("input")
        node_append(document.body, input)
        node_append(input, $bind.string(o_text, { debounce_event: 30, prioritize_observable: true }))

        input.value = "typing"
        input.dispatchEvent(new Event("input"))

        o_text.set("external")
        out.push({ name: "repainted immediately, no suppression", actual: input.value, expected: "external" })

        await wait(60)
        // the stale flush reads back whatever's now in the DOM ("external"), a harmless re-write
        out.push({ name: "stale flush re-writes current DOM value", actual: o_text.get(), expected: "external" })

        input.remove()
        return out
      })
      for (const r of results) expect(r.actual, r.name).toBe(r.expected)
    })
  })
})
