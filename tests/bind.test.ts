///<reference types="bun">
import "./setup.ts"

import { test, expect, describe, afterEach } from "bun:test"

import { o } from "../src/observable"
import { $bind } from "../src/decorators"
import { node_append, node_remove } from "../src/dom"

let mounted: HTMLElement[] = []

function mount<E extends HTMLElement>(el: E): E {
  node_append(document.body, el)
  mounted.push(el)
  return el
}

afterEach(() => {
  for (const el of mounted) node_remove(el)
  mounted = []
})

function fire(el: HTMLElement, type: string) {
  el.dispatchEvent(new Event(type))
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

describe("$bind", () => {
  test("string binds DOM <-> observable", () => {
    const o_text = o("hello")
    const input = mount(document.createElement("input"))
    node_append(input, $bind.string(o_text))

    expect(input.value).toBe("hello")

    o_text.set("world")
    expect(input.value).toBe("world")

    input.value = "typed"
    fire(input, "input")
    expect(o_text.get()).toBe("typed")
  })

  test("boolean binds via the change event, not input", () => {
    const o_on = o(false)
    const input = mount(document.createElement("input"))
    input.type = "checkbox"
    node_append(input, $bind.boolean(o_on))

    input.checked = true
    fire(input, "input") // boolean listens on "change", not "input" -- should not commit
    expect(o_on.get()).toBe(false)

    fire(input, "change")
    expect(o_on.get()).toBe(true)
  })

  describe("validity", () => {
    test("o_error mirrors native constraint validity", () => {
      const o_text = o("ok")
      const o_error = o(null as string | null)
      const input = mount(document.createElement("input"))
      input.required = true
      node_append(input, $bind.string(o_text, { o_error }))

      input.value = ""
      fire(input, "input")
      expect(o_error.get()).not.toBeNull()

      input.value = "ok again"
      fire(input, "input")
      expect(o_error.get()).toBeNull()
    })

    test("extra_check sets and clears a custom validity message", () => {
      const o_text = o("ok")
      const o_error = o(null as string | null)
      const input = mount(document.createElement("input"))
      node_append(
        input,
        $bind.string(o_text, {
          o_error,
          extra_check: (value) => (value.length < 3 ? "too short" : null),
        })
      )

      input.value = "hi"
      fire(input, "input")
      expect(o_error.get()).toBe("too short")

      input.value = "hello"
      fire(input, "input")
      expect(o_error.get()).toBeNull()
    })

    test("o_error is optional -- extra_check still drives native validity without it", () => {
      const o_text = o("ok")
      const input = mount(document.createElement("input"))
      node_append(
        input,
        $bind.string(o_text, {
          extra_check: (value) => (value.length < 3 ? "too short" : null),
        })
      )

      input.value = "hi"
      fire(input, "input")
      expect(input.validity.valid).toBe(false)
      expect(input.validationMessage).toBe("too short")

      input.value = "hello"
      fire(input, "input")
      expect(input.validity.valid).toBe(true)
    })
  })

  describe("debounce / throttle", () => {
    test("debounce_event delays writes to the observable, using only the latest value", async () => {
      const o_text = o("")
      const input = mount(document.createElement("input"))
      node_append(input, $bind.string(o_text, { debounce_event: 30 }))

      input.value = "a"
      fire(input, "input")
      input.value = "ab"
      fire(input, "input")
      input.value = "abc"
      fire(input, "input")

      expect(o_text.get()).toBe("") // nothing flushed yet

      await wait(60)
      expect(o_text.get()).toBe("abc")
    })

    test("debounce_observable delays repainting the DOM from external writes", async () => {
      const o_text = o("start")
      const input = mount(document.createElement("input"))
      node_append(input, $bind.string(o_text, { debounce_observable: 30 }))

      // debounce_observable also delays the initial paint on mount, since it
      // wraps the same render function node_observe uses for that -- let it land first.
      await wait(60)
      expect(input.value).toBe("start")

      o_text.set("mid")
      o_text.set("final")
      expect(input.value).toBe("start") // not painted yet

      await wait(60)
      expect(input.value).toBe("final")
    })
  })

  describe("conflicting writes", () => {
    test("a pending local edit wins over an external write by default", async () => {
      const o_text = o("start")
      const input = mount(document.createElement("input"))
      node_append(input, $bind.string(o_text, { debounce_event: 30 }))

      input.value = "typing"
      fire(input, "input") // pending_local = true, flush scheduled ~30ms out

      o_text.set("external") // arrives while the local edit is still pending
      expect(input.value).toBe("typing") // suppressed, not overwritten

      await wait(60)
      expect(o_text.get()).toBe("typing") // local edit flushed, superseding "external"
    })

    test("prioritize_observable lets an external write win immediately", async () => {
      const o_text = o("start")
      const input = mount(document.createElement("input"))
      node_append(
        input,
        $bind.string(o_text, { debounce_event: 30, prioritize_observable: true })
      )

      input.value = "typing"
      fire(input, "input")

      o_text.set("external")
      expect(input.value).toBe("external") // repainted immediately, no suppression

      await wait(60)
      // the stale flush reads back whatever's now in the DOM ("external"), a harmless re-write
      expect(o_text.get()).toBe("external")
    })
  })
})
