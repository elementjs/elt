import { expect, type Page, test } from "../fixture"

test.describe("RootUndoRing", () => {
  test("shell undo restores prior root snapshot", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, o } = window.__ELT__
      const { ObjectEditorShell, object, string } = window.__ELT__.Editor

      const schema = object({ properties: [{ name: "name", type: string() }] })
      const o_root = o({ name: "Ada" })
      const shell = new ObjectEditorShell(o_root, { schema })
      node_append(document.body, shell.node)

      o_root.set({ name: "Grace" })
      const afterSet = o_root.get().name

      const undo = shell.node.querySelector<HTMLButtonElement>('button[aria-label="Undo"]')
      undo?.click()
      const afterUndo = o_root.get().name

      return { afterSet, afterUndo }
    })
    expect(result.afterSet).toBe("Grace")
    expect(result.afterUndo).toBe("Ada")
  })

  // The history follows the editor through an observer on its element (regression: it was an observer of
  // its own, started at construction and never stopped).
  test("a write made after the editor was built, before it was mounted, is part of the history", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, node_remove, o } = window.__ELT__
      const { ObjectEditorShell, object, string } = window.__ELT__.Editor

      const schema = object({ properties: [{ name: "name", type: string() }] })
      const o_root = o({ name: "Ada" })
      const shell = new ObjectEditorShell(o_root, { schema })
      o_root.set({ name: "Grace" })
      node_append(document.body, shell.node)
      o_root.set({ name: "Linus" })

      const undo = shell.node.querySelector<HTMLButtonElement>('button[aria-label="Undo"]')
      undo?.click()
      const after_undo = o_root.get().name
      node_remove(shell.node)
      return { after_undo }
    })
    expect(result.after_undo).toBe("Grace")
  })

  test("the history stops recording when the editor leaves the page", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { node_append, node_remove, o } = window.__ELT__
      const { ObjectEditorShell, object, string } = window.__ELT__.Editor

      const schema = object({ properties: [{ name: "name", type: string() }] })
      const o_root = o({ name: "Ada" })
      const shell = new ObjectEditorShell(o_root, { schema })
      node_append(document.body, shell.node)
      o_root.set({ name: "Grace" })
      const entries = () => (shell as any).undo.entries.length
      const while_mounted = entries()
      node_remove(shell.node)
      o_root.set({ name: "Linus" })
      return { while_mounted, after_removal: entries() }
    })
    expect(result.while_mounted).toBe(2)
    expect(result.after_removal).toBe(2)
  })
})

test.describe("undo and redo buttons", () => {
  const mount = (page: Page) =>
    page.evaluate(() => {
      const { o, node_append } = window.__ELT__
      const { ObjectEditorShell } = window.__ELT__.Editor
      const o_root = o({ a: "x" })
      ;(window as unknown as { o_root: typeof o_root }).o_root = o_root
      const shell = new ObjectEditorShell(o_root, { packed: true })
      shell.node.id = "shell"
      node_append(document.body, shell.node)
    })

  test("they appear only when there is something to undo or redo, icon only with a tooltip, packed together", async ({
    page,
  }) => {
    await mount(page)
    const undo = page.locator('#shell button[aria-label="Undo"]')
    const redo = page.locator('#shell button[aria-label="Redo"]')
    await expect(undo).toHaveCount(0)
    await expect(redo).toHaveCount(0)
    await page.evaluate(() => (window as unknown as { o_root: { set(v: unknown): void } }).o_root.set({ a: "y" }))
    await expect(undo).toHaveCount(1)
    await expect(redo).toHaveCount(0)
    expect(await undo.getAttribute("title")).toBe("Undo")
    expect(((await undo.textContent()) ?? "").trim()).toBe("")
    expect(await undo.locator("svg").count()).toBe(1)
    await undo.click()
    await expect(undo).toHaveCount(0)
    await expect(redo).toHaveCount(1)
    expect(await redo.getAttribute("title")).toBe("Redo")
    // Both shown (an edit after one undo leaves a redo, then another undo keeps both): packed in one group.
    await page.evaluate(() => (window as unknown as { o_root: { set(v: unknown): void } }).o_root.set({ a: "z" }))
    await page.evaluate(() => (window as unknown as { o_root: { set(v: unknown): void } }).o_root.set({ a: "w" }))
    await page.locator('#shell button[aria-label="Undo"]').click()
    await expect(undo).toHaveCount(1)
    await expect(redo).toHaveCount(1)
    expect(
      await undo.evaluate((el, other) => el.parentElement === other?.parentElement, await redo.elementHandle()),
    ).toBe(true)
  })

  test("the Add button is the last button of the header line, after Undo and Redo", async ({ page }) => {
    await mount(page)
    await page.evaluate(() => (window as unknown as { o_root: { set(v: unknown): void } }).o_root.set({ a: "y" }))
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll("#shell e-column > e-row:first-child button")].map(
        (b) => b.getAttribute("aria-label") ?? b.textContent?.trim(),
      ),
    )
    expect(labels).toEqual(["More actions", "Undo", "Add key"])
  })
})
