import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

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

      shell.node.querySelectorAll("button")[0]?.click() // Undo
      const afterUndo = o_root.get().name

      return { afterSet, afterUndo }
    })
    expect(result.afterSet).toBe("Grace")
    expect(result.afterUndo).toBe("Ada")
  })
})
