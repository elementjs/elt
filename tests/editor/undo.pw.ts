import { expect, test } from "../fixture"

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

      const undo = [...shell.node.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Undo")
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

      const undo = [...shell.node.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Undo")
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
