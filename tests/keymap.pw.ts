import { test, expect } from "./fixture"

// Helpers installed on `window` in beforeEach, so that each page.evaluate stays short.
declare global {
  interface Window {
    /** Dispatch a bubbling, cancelable keydown on `target`. Returns `true` when the event was default-prevented. */
    kd: (target: EventTarget, init: KeyboardEventInit) => boolean
    /** Create a div with a `$keymap(def, opts)`, append it to `parent` (default: body) and return it. */
    mk: (def: any, opts?: any, parent?: Node) => HTMLDivElement
    /** Count console.warn / console.error calls from now on. */
    console_count: () => { warn: number; error: number }
  }
}

test.beforeEach(async ({ page }) => {
  await page.evaluate(() => {
    const { node_append, UI } = window.__ELT__
    window.kd = (target, init) =>
      !target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }))
    window.mk = (def, opts, parent = document.body) => {
      const el = document.createElement("div")
      UI.$keymap(def, opts)(el)
      node_append(parent, el)
      return el
    }
    window.console_count = () => {
      const count = { warn: 0, error: 0 }
      console.warn = () => count.warn++
      console.error = () => count.error++
      return count
    }
  })
})

type Check = { name: string; actual: unknown; expected: unknown }
function expect_all(results: Check[]) {
  for (const r of results) expect(r.actual, r.name).toEqual(r.expected)
}

test.describe("$keymap parsing", () => {
  test("reads `,`, `+` and `Space` literally, and skips invalid strings", async ({ page }) => {
    expect_all(
      await page.evaluate(() => {
        const log: string[] = []
        const count = window.console_count()
        const el = window.mk({
          "Ctrl+,": () => log.push("comma"),
          "Ctrl++": () => log.push("plus"),
          "Ctrl+Space": () => log.push("space"),
          "Ctrl+k, ,": () => log.push("k-comma"),
          "Ctrl+k,": () => log.push("bad-trailing"),
          "Ctrl+j s": () => log.push("bad-no-separator"),
          "a+b": () => log.push("bad-modifier"),
          "Ctrl+Shift": () => log.push("bad-modifier-key"),
        })
        window.kd(el, { key: ",", ctrlKey: true })
        window.kd(el, { key: "+", ctrlKey: true })
        window.kd(el, { key: " ", ctrlKey: true })
        window.kd(el, { key: "k", ctrlKey: true })
        window.kd(el, { key: "," })
        return [
          { name: "fired", actual: log, expected: ["comma", "plus", "space", "k-comma"] },
          { name: "errors", actual: count.error, expected: 4 },
        ]
      }),
    )
  })

  test("KeySequence form: empty sequence or combination without key/code is invalid", async ({ page }) => {
    expect_all(
      await page.evaluate(() => {
        const log: string[] = []
        const count = window.console_count()
        const el = window.mk([
          { sequence: [], callback: () => log.push("empty") },
          { sequence: [{ ctrl: true }], callback: () => log.push("no-key") },
          { sequence: [{ ctrl: true, key: "k" }, { code: "KeyS" }], callback: () => log.push("ok") },
        ])
        window.kd(el, { key: "k", ctrlKey: true })
        window.kd(el, { key: "s", code: "KeyS" })
        return [
          { name: "fired", actual: log, expected: ["ok"] },
          { name: "errors", actual: count.error, expected: 2 },
        ]
      }),
    )
  })
})

test.describe("$keymap matching", () => {
  test("letters, Shift and unlisted modifiers", async ({ page }) => {
    expect_all(
      await page.evaluate(() => {
        const log: string[] = []
        const el = window.mk({
          "Ctrl+s": () => log.push("ctrl-s"),
          "Ctrl+Shift+s": () => log.push("ctrl-shift-s"),
          "?": () => log.push("?"),
          k: () => log.push("k"),
        })
        const out: { name: string; actual: unknown; expected: unknown }[] = []
        const fire = (name: string, init: KeyboardEventInit, expected: string[]) => {
          log.length = 0
          window.kd(el, init)
          out.push({ name, actual: [...log], expected })
        }
        fire("Ctrl+s", { key: "s", ctrlKey: true }, ["ctrl-s"])
        fire("Ctrl+Shift+S matches Ctrl+Shift+s only", { key: "S", ctrlKey: true, shiftKey: true }, ["ctrl-shift-s"])
        fire("? with Shift", { key: "?", shiftKey: true }, ["?"])
        fire("? without Shift", { key: "?" }, ["?"])
        fire("k", { key: "k" }, ["k"])
        fire("Ctrl+k does not match k", { key: "k", ctrlKey: true }, [])
        fire("Alt+k does not match k", { key: "k", altKey: true }, [])
        fire("Shift+K does not match k", { key: "K", shiftKey: true }, [])
        return out
      }),
    )
  })

  test("code, AltGr and Mod", async ({ page }) => {
    expect_all(
      await page.evaluate(() => {
        const log: string[] = []
        const el = window.mk({
          "Ctrl+KeyZ": () => log.push("code"),
          "@": () => log.push("@"),
          "Mod+s": () => log.push("mod-s"),
        })
        // AZERTY: the key at the QWERTY "z" position types "w"
        window.kd(el, { key: "w", code: "KeyZ", ctrlKey: true })
        // Windows reports AltGr as Ctrl+Alt
        window.kd(el, { key: "@", ctrlKey: true, altKey: true, modifierAltGraph: true } as KeyboardEventInit)
        window.kd(el, { key: "@", ctrlKey: true, altKey: true })
        const is_mac = /mac|iphone|ipad/i.test(navigator.platform)
        window.kd(el, is_mac ? { key: "s", metaKey: true } : { key: "s", ctrlKey: true })
        return [{ name: "fired", actual: log, expected: ["code", "@", "mod-s"] }]
      }),
    )
  })
})

test.describe("$keymap sequences", () => {
  test("real keyboard: the Control keydown does not reset the sequence", async ({ page }) => {
    await page.evaluate(() => {
      const el = window.mk({ "Ctrl+k, s": () => ((window as any).fired = true) })
      const input = document.createElement("input")
      el.append(input)
      input.focus()
    })
    await page.keyboard.press("Control+k")
    await page.keyboard.press("s")
    expect(await page.evaluate(() => (window as any).fired)).toBe(true)
  })

  test("a key that does not continue resets without preventDefault, then is tested from the start", async ({
    page,
  }) => {
    expect_all(
      await page.evaluate(() => {
        const log: string[] = []
        const el = window.mk({ "Ctrl+k, s": () => log.push("seq"), x: () => log.push("x") })
        const p1 = window.kd(el, { key: "k", ctrlKey: true })
        const p2 = window.kd(el, { key: "y" })
        const p3 = window.kd(el, { key: "s" })
        window.kd(el, { key: "k", ctrlKey: true })
        const p4 = window.kd(el, { key: "x" })
        return [
          { name: "Ctrl+k prevented", actual: p1, expected: true },
          { name: "y not prevented", actual: p2, expected: false },
          { name: "s after reset not prevented", actual: p3, expected: false },
          { name: "x after Ctrl+k prevented (fired)", actual: p4, expected: true },
          { name: "fired", actual: log, expected: ["x"] },
        ]
      }),
    )
  })

  test("terminal: default hides longer sequences with a warning, `false` continues", async ({ page }) => {
    expect_all(
      await page.evaluate(() => {
        const log: string[] = []
        const count = window.console_count()
        const a = window.mk({ "Ctrl+k": () => log.push("a-short"), "Ctrl+k, s": () => log.push("a-long") })
        window.kd(a, { key: "k", ctrlKey: true })
        window.kd(a, { key: "s" })
        const b = window.mk([
          { sequence: "Ctrl+k", callback: () => log.push("b-short"), terminal: false },
          { "Ctrl+k, s": () => log.push("b-long") },
        ])
        window.kd(b, { key: "k", ctrlKey: true })
        window.kd(b, { key: "s" })
        return [
          { name: "fired", actual: log, expected: ["a-short", "b-short", "b-long"] },
          { name: "warnings", actual: count.warn, expected: 1 },
        ]
      }),
    )
  })

  test("duplicate sequences: the last one wins, with a warning", async ({ page }) => {
    expect_all(
      await page.evaluate(() => {
        const log: string[] = []
        const count = window.console_count()
        const el = window.mk([{ x: () => log.push("first") }, { X: () => log.push("second") }])
        window.kd(el, { key: "x" })
        return [
          { name: "fired", actual: log, expected: ["second"] },
          { name: "warnings", actual: count.warn, expected: 1 },
        ]
      }),
    )
  })

  test("time limit between steps", async ({ page }) => {
    expect_all(
      await page.evaluate(async () => {
        const log: string[] = []
        const el = window.mk({ "Ctrl+k, s": () => log.push("seq") }, { timeout: 30 })
        window.kd(el, { key: "k", ctrlKey: true })
        window.kd(el, { key: "s" })
        window.kd(el, { key: "k", ctrlKey: true })
        await new Promise((r) => setTimeout(r, 80))
        window.kd(el, { key: "s" })
        return [{ name: "fired", actual: log, expected: ["seq"] }]
      }),
    )
  })

  test("repeat fires the completed binding again, and is ignored elsewhere", async ({ page }) => {
    expect_all(
      await page.evaluate(() => {
        const log: string[] = []
        const el = window.mk({
          "Ctrl+z": () => log.push("z"),
          "Ctrl+k, s": () => log.push("seq"),
          s: () => log.push("s"),
        })
        window.kd(el, { key: "z", ctrlKey: true })
        window.kd(el, { key: "z", ctrlKey: true, repeat: true })
        window.kd(el, { key: "z", ctrlKey: true, repeat: true })
        window.kd(el, { key: "k", ctrlKey: true })
        window.kd(el, { key: "k", ctrlKey: true, repeat: true })
        window.kd(el, { key: "s" })
        // Holding the `s` of "Ctrl+k, s" repeats the sequence, not the "s" binding
        window.kd(el, { key: "s", repeat: true })
        return [{ name: "fired", actual: log, expected: ["z", "z", "z", "seq", "seq"] }]
      }),
    )
  })

  test("composing events are ignored", async ({ page }) => {
    expect(
      await page.evaluate(() => {
        let fired = false
        const el = window.mk({ x: () => (fired = true) })
        window.kd(el, { key: "x", isComposing: true })
        return fired
      }),
    ).toBe(false)
  })

  test("a new definition value resets the sequence", async ({ page }) => {
    expect_all(
      await page.evaluate(() => {
        const { o } = window.__ELT__
        const log: string[] = []
        const o_def = o<Record<string, () => unknown>>({ "Ctrl+k, s": () => log.push("a") })
        const el = window.mk(o_def)
        window.kd(el, { key: "k", ctrlKey: true })
        o_def.set({ "Ctrl+k, s": () => log.push("b") })
        window.kd(el, { key: "s" })
        window.kd(el, { key: "k", ctrlKey: true })
        window.kd(el, { key: "s" })
        return [{ name: "fired", actual: log, expected: ["b"] }]
      }),
    )
  })

  test("disconnect resets the sequence", async ({ page }) => {
    expect_all(
      await page.evaluate(() => {
        const { node_append, node_remove } = window.__ELT__
        const log: string[] = []
        const el = window.mk({ "Ctrl+k, s": () => log.push("seq"), x: () => log.push("x") })
        window.kd(el, { key: "k", ctrlKey: true })
        // A listener on the node itself lives as long as the node: only the sequence is reset
        node_remove(el)
        node_append(document.body, el)
        window.kd(el, { key: "s" })
        window.kd(el, { key: "x" })
        return [{ name: "fired", actual: log, expected: ["x"] }]
      }),
    )
  })

  test("focus leaving the listening target resets the sequence", async ({ page }) => {
    expect_all(
      await page.evaluate(() => {
        const log: string[] = []
        const el = window.mk({ "Ctrl+k, s": () => log.push("seq") })
        const in1 = document.createElement("input")
        const in2 = document.createElement("input")
        const outside = document.createElement("input")
        el.append(in1, in2)
        document.body.append(outside)

        in1.focus()
        window.kd(in1, { key: "k", ctrlKey: true })
        in2.focus()
        window.kd(in2, { key: "s" })

        window.kd(in2, { key: "k", ctrlKey: true })
        outside.focus()
        in1.focus()
        window.kd(in1, { key: "s" })
        return [{ name: "fired", actual: log, expected: ["seq"] }]
      }),
    )
  })
})

test.describe("$keymap event handling", () => {
  test("prevent_default: `last` and shared prefixes", async ({ page }) => {
    expect_all(
      await page.evaluate(() => {
        const a = window.mk({ "j, k": { callback: () => {}, prevent_default: "last" } })
        const pj = window.kd(a, { key: "j" })
        const pk = window.kd(a, { key: "k" })
        const b = window.mk([
          { sequence: "Ctrl+k, s", callback: () => {}, prevent_default: true },
          { sequence: "Ctrl+k, v", callback: () => {}, prevent_default: false },
        ])
        const p_prefix = window.kd(b, { key: "k", ctrlKey: true })
        const pv = window.kd(b, { key: "v" })
        return [
          { name: "j not prevented", actual: pj, expected: false },
          { name: "k prevented", actual: pk, expected: true },
          { name: "shared prefix prevented", actual: p_prefix, expected: true },
          { name: "v not prevented", actual: pv, expected: false },
        ]
      }),
    )
  })

  test("real keyboard: `j, k` with prevent_default `last` types the j only", async ({ page }) => {
    await page.evaluate(() => {
      const el = window.mk({ "j, k": { callback: () => ((window as any).fired = true), prevent_default: "last" } })
      const input = document.createElement("input")
      input.id = "jk"
      el.append(input)
      input.focus()
    })
    await page.keyboard.press("j")
    await page.keyboard.press("k")
    expect(await page.evaluate(() => (window as any).fired)).toBe(true)
    expect(await page.inputValue("#jk")).toBe("j")
  })

  test("callback arguments and `target` option", async ({ page }) => {
    expect_all(
      await page.evaluate(() => {
        const { node_remove } = window.__ELT__
        const calls: any[] = []
        const el = window.mk(
          { "Ctrl+x": (seq: any, node: any, ev: any) => calls.push({ seq, same_node: node === el, type: ev.type }) },
          { target: document },
        )
        window.kd(document.body, { key: "x", ctrlKey: true })
        node_remove(el)
        window.kd(document.body, { key: "x", ctrlKey: true })
        return [
          {
            name: "calls",
            actual: calls,
            expected: [{ seq: [{ ctrl: true, key: "x" }], same_node: true, type: "keydown" }],
          },
        ]
      }),
    )
  })

  test("state observable", async ({ page }) => {
    expect_all(
      await page.evaluate(() => {
        const { o } = window.__ELT__
        const o_state = o<any>(null)
        let notifications = 0
        // Braces matter: an observer that returns a value writes it back to the observable.
        o_state.addObserver(() => {
          notifications++
        })
        const el = window.mk({ "Ctrl+k, s": () => {}, "Ctrl+k, v": () => {}, x: () => {} }, { state: o_state })
        const start = o_state.get()
        const out: { name: string; actual: unknown; expected: unknown }[] = [
          { name: "start sequence", actual: start.sequence, expected: [] },
          { name: "start candidates", actual: start.candidates.length, expected: 3 },
        ]
        window.kd(el, { key: "k", ctrlKey: true })
        out.push({ name: "advanced sequence", actual: o_state.get().sequence, expected: [{ ctrl: true, key: "k" }] })
        out.push({ name: "advanced candidates", actual: o_state.get().candidates.length, expected: 2 })
        window.kd(el, { key: "y" })
        out.push({ name: "reset gives the same start object", actual: o_state.get() === start, expected: true })
        const n = notifications
        window.kd(el, { key: "y" })
        out.push({ name: "no notification when already at start", actual: notifications, expected: n })
        return out
      }),
    )
  })
})

test.describe("$keymap nested keymaps", () => {
  const rows: {
    name: string
    inner: any
    outer: any
    keys: { key: string; ctrlKey?: boolean }[]
    expected: string[]
  }[] = [
    {
      name: "shared prefix, outer continuation",
      inner: { "Ctrl+k, v": "inner" },
      outer: { "Ctrl+k, s": "outer" },
      keys: [{ key: "k", ctrlKey: true }, { key: "s" }],
      expected: ["outer"],
    },
    {
      name: "shared prefix, inner continuation",
      inner: { "Ctrl+k, v": "inner" },
      outer: { "Ctrl+k, s": "outer" },
      keys: [{ key: "k", ctrlKey: true }, { key: "v" }],
      expected: ["inner"],
    },
    {
      name: "inner advances, outer does not fire",
      inner: { "Ctrl+k, s": "inner" },
      outer: { "Ctrl+k": "outer" },
      keys: [{ key: "k", ctrlKey: true }, { key: "s" }],
      expected: ["inner"],
    },
    {
      name: "inner completes, outer resets",
      inner: { "Ctrl+k": "inner" },
      outer: { "Ctrl+k, s": "outer" },
      keys: [{ key: "k", ctrlKey: true }, { key: "s" }],
      expected: ["inner"],
    },
    {
      name: "inner non-terminal, outer advances",
      inner: [{ sequence: "Ctrl+k", callback: "inner", terminal: false }, { "Ctrl+k, v": "inner-v" }],
      outer: { "Ctrl+k, s": "outer" },
      keys: [{ key: "k", ctrlKey: true }, { key: "s" }],
      expected: ["inner", "outer"],
    },
  ]

  for (const row of rows) {
    test(row.name, async ({ page }) => {
      const log = await page.evaluate((row) => {
        const log: string[] = []
        // Callbacks cannot cross page.evaluate: the tests give a name, replaced here by a callback that logs it.
        const with_log = (def: any): any => {
          if (Array.isArray(def)) return def.map(with_log)
          if (typeof def.callback === "string") return { ...def, callback: () => log.push(def.callback) }
          return Object.fromEntries(Object.entries(def).map(([k, v]) => [k, () => log.push(v as string)]))
        }
        const outer = window.mk(with_log(row.outer))
        const inner = window.mk(with_log(row.inner), undefined, outer)
        const span = document.createElement("span")
        inner.append(span)
        for (const k of row.keys) window.kd(span, k)
        return log
      }, row)
      expect(log).toEqual(row.expected)
    })
  }

  test("keymap_used", async ({ page }) => {
    expect_all(
      await page.evaluate(() => {
        const { UI } = window.__ELT__
        const el = window.mk({ x: () => {} })
        const used: boolean[] = []
        document.body.addEventListener("keydown", (ev) => used.push(UI.keymap_used(ev)))
        window.kd(el, { key: "x" })
        window.kd(el, { key: "y" })
        return [{ name: "used", actual: used, expected: [true, false] }]
      }),
    )
  })
})
