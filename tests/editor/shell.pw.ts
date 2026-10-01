import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

// Shared helper used inside every page.evaluate below: mounts an element into
// document.body and fires a real DOM event on it. Rebuilt per-test since each
// test runs in its own page.evaluate callback (no shared state across calls).

test.describe("ObjectEditorShell", () => {
  test("mounts the root column and binds scalar widgets to the schema's properties", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string, number, boolean } = window.__ELT__.Editor

      const profile_schema = object({
        properties: [
          { name: "name", type: string() },
          { name: "age", type: number({ min: 0 }) },
          { name: "active", type: boolean() },
        ],
      })

      const o_root = o({ name: "Ada", age: 36, active: true })
      const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
      node_append(document.body, shell.node)

      const name_input = shell.node.querySelector('input[type="text"]') as HTMLInputElement
      const age_input = shell.node.querySelector('input[type="number"]') as HTMLInputElement
      const active_input = shell.node.querySelector('input[e-variant="switch"]') as HTMLInputElement
      return {
        name: name_input.value,
        age: age_input.value,
        active: active_input.checked,
      }
    })
    expect(result.name).toBe("Ada")
    expect(result.age).toBe("36")
    expect(result.active).toBe(true)
  })

  test("editing a bound input writes back through to the root observable", async ({ page }) => {
    const name = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string, number, boolean } = window.__ELT__.Editor

      const profile_schema = object({
        properties: [
          { name: "name", type: string() },
          { name: "age", type: number({ min: 0 }) },
          { name: "active", type: boolean() },
        ],
      })

      const o_root = o({ name: "Ada", age: 36, active: true })
      const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
      node_append(document.body, shell.node)

      const name_input = shell.node.querySelector('input[type="text"]') as HTMLInputElement
      name_input.value = "Grace"
      name_input.dispatchEvent(new Event("input", { bubbles: true }))

      return o_root.get().name
    })
    expect(name).toBe("Grace")
  })

  test("open() through the real event path appends a column and updates the breadcrumb", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string, number, boolean, dispatch_object_editor_open } = window.__ELT__.Editor

      const profile_schema = object({
        properties: [
          { name: "name", type: string() },
          { name: "age", type: number({ min: 0 }) },
          { name: "active", type: boolean() },
        ],
      })

      const o_root = o({ name: "Ada", age: 36, active: true })
      const o_other = o({ name: "Linus", age: 54, active: false })
      const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
      node_append(document.body, shell.node)

      const before = shell.o_breadcrumb.get()

      dispatch_object_editor_open(shell.node, { o_value: o_other, title: "other" })

      const after = shell.o_breadcrumb.get()
      return { before, after }
    })
    expect(results.before).toEqual([])
    expect(results.after).toEqual(["other"])
  })

  test("open() from a source outside every column opens after the root, not in place of it", async ({ page }) => {
    // Regression: an `open()` whose `source` isn't inside any mounted
    // column host (e.g. a host-application control) used to truncate back
    // to ZERO columns, destroying the root -- fixed to fall back to "as if
    // opened from the root" instead.
    const results = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string, number, boolean, dispatch_object_editor_open } = window.__ELT__.Editor

      const profile_schema = object({
        properties: [
          { name: "name", type: string() },
          { name: "age", type: number({ min: 0 }) },
          { name: "active", type: boolean() },
        ],
      })

      const o_root = o({ name: "Ada", age: 36, active: true })
      const o_other = o({ name: "Linus", age: 54, active: false })
      const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
      node_append(document.body, shell.node)

      dispatch_object_editor_open(shell.node, { o_value: o_other, title: "other" })

      const breadcrumb = shell.o_breadcrumb.get()
      // The root's own widgets are still there, not wiped out.
      const name_input = shell.node.querySelector('input[type="text"]') as HTMLInputElement
      return { breadcrumb, name: name_input.value }
    })
    expect(results.breadcrumb).toEqual(["other"])
    expect(results.name).toBe("Ada")
  })

  test("closing the rightmost column truncates and updates the breadcrumb", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string, number, boolean, dispatch_object_editor_open } = window.__ELT__.Editor

      const profile_schema = object({
        properties: [
          { name: "name", type: string() },
          { name: "age", type: number({ min: 0 }) },
          { name: "active", type: boolean() },
        ],
      })

      const o_root = o({ name: "Ada", age: 36, active: true })
      const o_other = o({ name: "Linus", age: 54, active: false })
      const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
      node_append(document.body, shell.node)

      dispatch_object_editor_open(shell.node, { o_value: o_other, title: "other" })
      const breadcrumb_after_open = shell.o_breadcrumb.get()

      const close_buttons = [...shell.node.querySelectorAll("button")].filter((b) => b.textContent?.trim() === "×")
      const close_buttons_count = close_buttons.length // only the opened column gets a close button, not root
      close_buttons[0].dispatchEvent(new Event("click", { bubbles: true }))

      const breadcrumb_after_close = shell.o_breadcrumb.get()
      const name_input = shell.node.querySelector('input[type="text"]') as HTMLInputElement
      return { breadcrumb_after_open, close_buttons_count, breadcrumb_after_close, name: name_input.value }
    })
    expect(results.breadcrumb_after_open).toEqual(["other"])
    expect(results.close_buttons_count).toBe(1)
    expect(results.breadcrumb_after_close).toEqual([])
    expect(results.name).toBe("Ada")
  })

  test("dead-column detection: a schema-mode root that stops matching falls back to unknown mode in place", async ({
    page,
  }) => {
    const results = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string, number, boolean } = window.__ELT__.Editor

      const profile_schema = object({
        properties: [
          { name: "name", type: string() },
          { name: "age", type: number({ min: 0 }) },
          { name: "active", type: boolean() },
        ],
      })

      const o_root = o<unknown>({ name: "Ada", age: 36, active: true })
      const shell = new ObjectEditorShell(o_root as any, { schema: profile_schema })
      node_append(document.body, shell.node)
      const before_name = (shell.node.querySelector('input[type="text"]') as HTMLInputElement).value

      // profile_schema (a fixed ObjectFactory) can't handle a plain string --
      // re-resolving to the SAME schema would be a no-op (that's the bug this
      // regresses against); it must fall back to unknown mode instead.
      ;(o_root as any).set("just a string now")

      const inputs = shell.node.querySelectorAll('input[type="text"]')
      return {
        before_name,
        inputs_length: inputs.length,
        input_value: (inputs[0] as HTMLInputElement).value,
      }
    })
    expect(results.before_name).toBe("Ada")
    expect(results.inputs_length).toBe(1)
    expect(results.input_value).toBe("just a string now")
  })

  test("dead-column detection: a non-root column re-resolves on resolved-kind change instead of closing", async ({
    page,
  }) => {
    const results = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const {
        ObjectEditorShell,
        object,
        string,
        number,
        boolean,
        dispatch_object_editor_open,
        type_change_actions,
        apply_type_change,
      } = window.__ELT__.Editor

      const profile_schema = object({
        properties: [
          { name: "name", type: string() },
          { name: "age", type: number({ min: 0 }) },
          { name: "active", type: boolean() },
        ],
      })

      const o_root = o({ name: "Ada", age: 36, active: true })
      const o_stats = o<unknown>({ views: 10, likes: 2 })
      const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
      node_append(document.body, shell.node)

      dispatch_object_editor_open(shell.node, {
        o_value: o_stats,
        title: "stats",
        factory: object({ properties: [] }),
      })
      const breadcrumb_after_open = shell.o_breadcrumb.get()

      const prev_confirm = globalThis.confirm
      globalThis.confirm = () => true
      let convert_defined: boolean
      try {
        const pinned = object({ properties: [] })
        const actions = type_change_actions(pinned, o_stats.get(), {})
        const convert = actions.find((a: any) => a.target.kind === "array" && a.mode === "convert")
        convert_defined = convert !== undefined
        apply_type_change(o_stats as any, pinned, convert!)
      } finally {
        globalThis.confirm = prev_confirm
      }

      return {
        breadcrumb_after_open,
        convert_defined,
        stats_value: o_stats.get(),
        breadcrumb_after_convert: shell.o_breadcrumb.get(),
      }
    })
    expect(results.breadcrumb_after_open).toEqual(["stats"])
    expect(results.convert_defined).toBe(true)
    expect(results.stats_value).toEqual([10, 2])
    expect(results.breadcrumb_after_convert).toEqual(["stats"])
  })

  test("dead-column detection: a non-root column closes itself and everything to its right", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string, number, boolean, dispatch_object_editor_open } = window.__ELT__.Editor

      const profile_schema = object({
        properties: [
          { name: "name", type: string() },
          { name: "age", type: number({ min: 0 }) },
          { name: "active", type: boolean() },
        ],
      })

      const o_root = o({ name: "Ada", age: 36, active: true })
      const o_other = o<unknown>({ name: "Linus", age: 54, active: false })
      const shell = new ObjectEditorShell(o_root, { schema: profile_schema })
      node_append(document.body, shell.node)

      dispatch_object_editor_open(shell.node, { o_value: o_other, title: "other" })
      const breadcrumb_after_open = shell.o_breadcrumb.get()

      // The "other" column resolved via unknown mode (anything, an EitherFactory) --
      // that self-heals reactively on its own, so force the outer dead-column
      // watch to fire by handing it a value NO branch of `anything` can handle.
      ;(o_other as any).set(Symbol("nope") as unknown as object)

      return {
        breadcrumb_after_open,
        breadcrumb_after_set: shell.o_breadcrumb.get(),
        name: (shell.node.querySelector('input[type="text"]') as HTMLInputElement).value,
      }
    })
    expect(results.breadcrumb_after_open).toEqual(["other"])
    expect(results.breadcrumb_after_set).toEqual([])
    expect(results.name).toBe("Ada")
  })

  test("a nested Object property renders as a preview button, not inline, and drills in on click", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string } = window.__ELT__.Editor

      const address_schema = object({
        properties: [
          { name: "street", type: string() },
          { name: "city", type: string() },
        ],
      })
      const with_address_schema = object({
        properties: [
          { name: "name", type: string() },
          { name: "address", type: address_schema },
        ],
      })
      const o_root = o({ name: "Ada", address: { street: "12 Analytical Engine Ave", city: "London" } })
      const shell = new ObjectEditorShell(o_root, { schema: with_address_schema })
      node_append(document.body, shell.node)

      // Only "name" renders inline — "address" is a preview button, not two more text fields.
      const inline_count_before = shell.node.querySelectorAll('input[type="text"]').length
      const preview_button = shell.node.querySelector<HTMLButtonElement>('button[title="Open address"]') ?? undefined
      const breadcrumb_before = shell.o_breadcrumb.get()

      preview_button!.dispatchEvent(new Event("click", { bubbles: true }))

      const breadcrumb_after = shell.o_breadcrumb.get()
      const values = [...shell.node.querySelectorAll('input[type="text"]')].map((el) => (el as HTMLInputElement).value)
      return {
        inline_count_before,
        preview_button_found: preview_button !== undefined,
        breadcrumb_before,
        breadcrumb_after,
        values,
      }
    })
    expect(results.inline_count_before).toBe(1)
    expect(results.preview_button_found).toBe(true)
    expect(results.breadcrumb_before).toEqual([])
    expect(results.breadcrumb_after).toEqual(["address"])
    expect(results.values).toContain("Ada")
    expect(results.values).toContain("12 Analytical Engine Ave")
    expect(results.values).toContain("London")
  })

  test("a nested composite row re-renders after its value changes kind so Open uses the new factory", async ({
    page,
  }) => {
    const results = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, string, type_change_actions, apply_type_change } = window.__ELT__.Editor

      const address_schema = object({
        properties: [{ name: "street", type: string() }],
      })
      const with_address_schema = object({
        properties: [
          { name: "name", type: string() },
          { name: "address", type: address_schema },
        ],
      })
      const o_root = o({ name: "Ada", address: { street: "Main" } })
      const shell = new ObjectEditorShell(o_root, { schema: with_address_schema })
      node_append(document.body, shell.node)

      const has_open_before = shell.node.querySelector('button[title^="Open "]') !== null

      const prev_confirm = globalThis.confirm
      globalThis.confirm = () => true
      try {
        apply_type_change(
          o_root.p("address") as any,
          address_schema,
          type_change_actions(address_schema, o_root.get().address, {}).find(
            (a: any) => a.target.kind === "array" && a.mode === "convert",
          )!,
        )
      } finally {
        globalThis.confirm = prev_confirm
      }

      const address_value = o_root.get().address
      // Still a composite preview (array), not stale object drill-in state.
      const has_open_after = shell.node.querySelector('button[title^="Open "]') !== null

      const preview = shell.node.querySelector<HTMLButtonElement>('button[title^="Open "]')!
      preview.dispatchEvent(new Event("click", { bubbles: true }))
      const breadcrumb = shell.o_breadcrumb.get()

      return { has_open_before, address_value, has_open_after, breadcrumb }
    })
    expect(results.has_open_before).toBe(true)
    expect(results.address_value).toEqual(["Main"])
    expect(results.has_open_after).toBe(true)
    expect(results.breadcrumb).toEqual(["address"])
  })

  test("opening a sibling composite from the root replaces the prior drilled column", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, anything } = window.__ELT__.Editor

      const o_root = o({ meta: { revision: 1 }, stats: { views: 10, likes: 2 } })
      const shell = new ObjectEditorShell(o_root, { schema: anything })
      node_append(document.body, shell.node)

      function find_open(key: string) {
        return shell.node.querySelector<HTMLButtonElement>(`button[title="Open ${key}"]`)
      }

      find_open("meta")!.dispatchEvent(new Event("click", { bubbles: true }))
      const breadcrumb_after_meta = shell.o_breadcrumb.get()
      const has_revision_after_meta = [...shell.node.querySelectorAll("span")].some(
        (s) => s.textContent?.trim() === "revision",
      )

      find_open("stats")!.dispatchEvent(new Event("click", { bubbles: true }))
      const breadcrumb_after_stats = shell.o_breadcrumb.get()
      const has_views_after_stats = [...shell.node.querySelectorAll("span")].some(
        (s) => s.textContent?.trim() === "views",
      )
      const has_revision_after_stats = [...shell.node.querySelectorAll("span")].some(
        (s) => s.textContent?.trim() === "revision",
      )

      return {
        breadcrumb_after_meta,
        has_revision_after_meta,
        breadcrumb_after_stats,
        has_views_after_stats,
        has_revision_after_stats,
      }
    })
    expect(results.breadcrumb_after_meta).toEqual(["meta"])
    expect(results.has_revision_after_meta).toBe(true)
    expect(results.breadcrumb_after_stats).toEqual(["stats"])
    expect(results.has_views_after_stats).toBe(true)
    expect(results.has_revision_after_stats).toBe(false)
  })

  test("composite preview cell shows the value's preview text and an arrow, nothing else", async ({ page }) => {
    const text = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, anything } = window.__ELT__.Editor

      const o_root = o({ meta: { revision: 1 } })
      const shell = new ObjectEditorShell(o_root, { schema: anything })
      node_append(document.body, shell.node)

      const preview = shell.node.querySelector('button[title="Open meta"]')
      return preview?.textContent?.trim()
    })
    expect(text).toBe("{revision: 1}›")
  })

  test("anything (unknown mode) resolves a bare scalar root without a schema", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, anything } = window.__ELT__.Editor

      const o_root = o<unknown>("hello")
      const shell = new ObjectEditorShell(o_root as any)
      node_append(document.body, shell.node)

      const input = shell.node.querySelector("input") as HTMLInputElement
      return { value: input.value, can_handle: anything.canHandle("hello") }
    })
    expect(results.value).toBe("hello")
    expect(results.can_handle).toBe(true)
  })

  test("open() without factory resolves Map values through the constructor registry", async ({ page }) => {
    const results = await page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, dispatch_object_editor_open } = window.__ELT__.Editor

      const o_root = o<unknown>({ bag: new Map([["a", 1]]) })
      const shell = new ObjectEditorShell(o_root as any, { schema: object({ properties: [] }) })
      node_append(document.body, shell.node)

      const o_bag = o((o_root.get() as { bag: Map<string, number> }).bag)
      dispatch_object_editor_open(shell.node, { o_value: o_bag, title: "bag" })

      return { breadcrumb: shell.o_breadcrumb.get(), text_content: shell.node.textContent }
    })
    expect(results.breadcrumb).toEqual(["bag"])
    expect(results.text_content).toContain("a")
  })

  test("open_as popup adds a breadcrumb segment for the opened value", async ({ page }) => {
    const breadcrumb = await page.evaluate(async () => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell, object, number } = window.__ELT__.Editor

      const nested_schema = object({
        properties: [{ name: "x", type: number() }],
        open_as: "popup",
      })
      const o_root = o({ nested: { x: 1 } })
      const shell = new ObjectEditorShell(o_root, {
        schema: object({ properties: [{ name: "nested", type: nested_schema }] }),
      })
      node_append(document.body, shell.node)

      const open = shell.node.querySelector('button[title="Open nested"]')
      open!.dispatchEvent(new Event("click", { bubbles: true }))

      const breadcrumb = shell.o_breadcrumb.get()

      await new Promise((r) => setTimeout(r, 0))
      await new Promise((r) => setTimeout(r, 0))

      // ui/popup.tsx tracks open popups in module-level state (a `popups` Set
      // plus a document click/keydown listener) that isn't scoped to this
      // test's DOM subtree, so leaving the popup open here leaks a stale
      // element and a live listener into every test file that runs after this
      // one -- an unrelated click anywhere then makes popup.tsx try to animate
      // that stale, already-detached element closed, throwing an unhandled
      // AbortError. Close it the same way a real click-outside would.
      document.body.dispatchEvent(new Event("click", { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
      await new Promise((r) => setTimeout(r, 0))

      return breadcrumb
    })
    expect(breadcrumb).toEqual(["nested"])
  })
})
