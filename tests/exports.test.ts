/// <reference types="bun" />
// Every value (function, class, constant) an entry point of package.json exports is named somewhere in
// docs/md: what the package exports is what it documents. Types are left out: they are documented
// through the functions that take them. A name only mentioned in prose counts as documented. Names
// starting with `_` or `sym_` are internal by convention (docs/md/elt-rules.md#naming) and are skipped.
// `elt/editor` is skipped while it is unstable (docs/md/object-editor.md): put it back once its API is.
import { expect, test } from "bun:test"
import { readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const transpiler = new Bun.Transpiler({ loader: "tsx" })

/** The value exports of `file`, following `export * from` (which `scan` does not report). */
async function value_exports(file: string, seen = new Set<string>()): Promise<Set<string>> {
  const names = new Set<string>()
  if (seen.has(file)) return names
  seen.add(file)
  const code = await Bun.file(file).text()
  for (const name of transpiler.scan(code).exports) names.add(name)
  for (const [, spec] of code.matchAll(/^export \* from "(\.[^"]+)"/gm)) {
    const base = join(dirname(file), spec!)
    const target = [".ts", ".tsx", "/index.ts", "/index.tsx"].map((ext) => base + ext).find((f) => Bun.file(f).size > 0)
    if (target == null) throw new Error(`${file}: cannot resolve ${spec}`)
    for (const name of await value_exports(target, seen)) names.add(name)
  }
  return names
}

test("every value an entry point exports is named in the docs", async () => {
  const pkg = await Bun.file(join(root, "package.json")).json()
  const docs = (
    await Promise.all(
      readdirSync(join(root, "docs/md"))
        .filter((f) => f.endsWith(".md"))
        .map((f) => Bun.file(join(root, "docs/md", f)).text()),
    )
  ).join("\n")
  const missing: string[] = []
  for (const [entry, file] of Object.entries(pkg.exports as Record<string, string>)) {
    if (entry === "./editor") continue
    for (const name of await value_exports(join(root, file))) {
      if (name.startsWith("_") || name.startsWith("sym_")) continue
      // `$` is a word character in JS names, not in a regex `\b`.
      const escaped = name.replace(/\$/g, "\\$")
      if (!new RegExp(`(?<![\\w$])${escaped}(?![\\w$])`).test(docs)) missing.push(`${entry}: ${name}`)
    }
  }
  expect(missing).toEqual([])
})
