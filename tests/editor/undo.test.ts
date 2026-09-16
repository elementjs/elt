///<reference types="bun">
import "../setup.ts"

import { afterEach, describe, expect, test } from "bun:test"

import { node_append, node_remove, o } from "../../src"
import { ObjectEditorShell } from "../../editor/shell"
import { object, string } from "../../editor/schema"

let mounted: HTMLElement[] = []

afterEach(() => {
  for (const el of mounted) node_remove(el)
  mounted = []
})

describe("RootUndoRing", () => {
  test("shell undo restores prior root snapshot", () => {
    const schema = object({ properties: [{ name: "name", type: string() }] })
    const o_root = o({ name: "Ada" })
    const shell = new ObjectEditorShell(o_root, { schema })
    node_append(document.body, shell.node)
    mounted.push(shell.node)

    o_root.set({ name: "Grace" })
    expect(o_root.get().name).toBe("Grace")

    shell.node.querySelectorAll("button")[0]?.click() // Undo
    expect(o_root.get().name).toBe("Ada")
  })
})
