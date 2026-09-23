import { describe, expect, test } from "bun:test"
import { elt_md, node, resolveMdLink, splitFrontmatter, splitNodes, stripImports } from "./macro.ts"

describe("splitNodes", () => {
  test("recovers every top-level sibling from a real Bun.markdown.render pass (no wrapping document node)", () => {
    const md = [
      "# Heading *emph* **strong** ~~strike~~ [link](https://example.com \"title\")",
      "",
      "Text with [odd brackets like this] inside it, and \"quotes \\\"escaped\\\"\" too.",
      "",
      "<div class=\"raw\">raw html block <b>bold</b></div>",
      "",
      "| a | b |",
      "|---|---|",
      "| 1 | 2 |",
    ].join("\n")

    const NODE_TYPES = ["heading", "paragraph", "blockquote", "code", "list", "listItem", "hr", "table",
      "thead", "tbody", "tr", "th", "td", "html", "strong", "emphasis", "link", "image", "codespan",
      "strikethrough"]
    const callbacks: Record<string, (...a: any[]) => string> = {}
    for (const t of NODE_TYPES) callbacks[t] = (children: string, meta?: unknown) => node(t, meta, children)
    callbacks.text = (text: string) => JSON.stringify(["text", {}, text])

    const out = Bun.markdown.render(md, callbacks as any, { autolinks: true })
    // Bun.markdown.render's overall return is the raw concatenation of each top-level sibling's own
    // JSON (there is no wrapping "document" node), so it must go through splitNodes too — not
    // JSON.parse directly — exactly like a parent node's `children` string. See elt_md in macro.ts.
    const topLevel = splitNodes(out)

    expect(topLevel.map(n => n[0])).toEqual(["heading", "paragraph", "html", "table"])
  })

  test("splits concatenated sibling JSON with no separator", () => {
    const a = node("text", {}, "")
    // simulate two already-encoded siblings with a raw literal line-break between them, as Bun inserts for hardSoftBreaks
    const raw = `${JSON.stringify(["text", {}, "a"])}\n${JSON.stringify(["strong", {}, [["text", {}, "b"]]])}`
    const children = splitNodes(raw)
    expect(children).toEqual([
      ["text", {}, "a"],
      ["text", {}, "\n"],
      ["strong", {}, [["text", {}, "b"]]],
    ])
  })

  test("does not miscount brackets/quotes inside a text node's own JSON string value", () => {
    const raw = JSON.stringify(["text", {}, "array literal [1, 2, 3] and a \"quoted [bracket]\""])
    const children = splitNodes(raw)
    expect(children).toEqual([["text", {}, "array literal [1, 2, 3] and a \"quoted [bracket]\""]])
  })
})

describe("resolveMdLink", () => {
  test("rewrites a same-directory relative .md link to the /docs/:name hash route", () => {
    expect(resolveMdLink("./using-elt-ui.md", "index.md")).toBe("#/docs/using-elt-ui")
  })

  test("rewrites a parent-relative .md link, resolving .. segments and joining dirs with __", () => {
    expect(resolveMdLink("../guide/intro.md", "adr/0001-x.md")).toBe("#/docs/guide__intro")
  })

  test("joins a nested link's own dir segments with __, with no index.md special-casing", () => {
    expect(resolveMdLink("./guide/index.md", "index.md")).toBe("#/docs/guide__index")
  })

  test("preserves a hash fragment on the link", () => {
    expect(resolveMdLink("./using-elt.md#section", "index.md")).toBe("#/docs/using-elt#section")
  })

  test("leaves external links untouched", () => {
    expect(resolveMdLink("https://example.com/x.md", "index.md")).toBeNull()
  })

  test("leaves non-.md relative links untouched", () => {
    expect(resolveMdLink("./image.png", "index.md")).toBeNull()
  })

  test("leaves in-page anchors untouched", () => {
    expect(resolveMdLink("#section", "index.md")).toBeNull()
  })
})

describe("splitFrontmatter", () => {
  test("parses a leading YAML block and returns the remaining body", () => {
    const raw = "---\ntitle: Hello\norder: 2\nsection: Guides\n---\n# Body\n"
    const { frontmatter, body } = splitFrontmatter(raw)
    expect(frontmatter).toEqual({ title: "Hello", order: 2, section: "Guides" })
    expect(body).toBe("# Body\n")
  })

  test("returns an empty frontmatter object and the original body when there is no frontmatter", () => {
    const raw = "# Just a heading\n"
    const { frontmatter, body } = splitFrontmatter(raw)
    expect(frontmatter).toEqual({})
    expect(body).toBe(raw)
  })
})

describe("stripImports", () => {
  test("rewrites named, namespace, and default imports to __imports destructures", () => {
    const src = [
      "import { o, If } from \"elt\"",
      "import * as ui from \"elt/ui\"",
      "import Default from \"elt/thing\"",
      "const x = o(1)",
    ].join("\n")

    const { stripped } = { stripped: stripImports(src) }
    expect(stripped).toContain("const { o, If } = __imports[\"elt\"];")
    expect(stripped).toContain("const ui = __imports[\"elt/ui\"];")
    expect(stripped).toContain("const Default = __imports[\"elt/thing\"].default;")
    expect(stripped).toContain("const x = o(1)")
    expect(stripped).not.toContain("import ")
  })

  test("handles an aliased named import", () => {
    const stripped = stripImports("import { a as b } from \"elt\"")
    expect(stripped).toBe("const { a: b } = __imports[\"elt\"];")
  })
})

// elt_md() takes no arguments by design (see specs/markdown-docs.md, "File registration") — it
// always scans the real docs/md next to this macro, so these tests exercise it against that real
// tree rather than an injectable fixture directory.
describe("elt_md (integration)", () => {
  test("recursively parses every docs/md file: name, frontmatter, tree, link rewriting", async () => {
    const docs = await elt_md()
    expect(docs.length).toBeGreaterThan(0)

    const names = docs.map((d) => d.name)
    expect(names).toContain("index")
    expect(names).toContain("using-elt")

    for (const doc of docs) {
      expect(doc.root[0]).toBe("root")
      expect(typeof doc.frontmatter.title).toBe("string")
    }
  })

  test("does not rewrite deps.ts when its content already matches the current scan", async () => {
    await elt_md() // ensure deps.ts exists and is up to date before measuring
    const depsPath = `${import.meta.dir}/deps.ts`
    const before = Bun.file(depsPath).lastModified

    await elt_md()
    const after = Bun.file(depsPath).lastModified
    expect(after).toBe(before)
  })

  test("(re)writes deps.ts to match the current file set when it's missing or stale", async () => {
    const depsPath = `${import.meta.dir}/deps.ts`
    await Bun.write(depsPath, "// stale\n")

    await elt_md()
    const content = await Bun.file(depsPath).text()
    expect(content).toContain('import "../md/index.md" with { type: "text" }')
    expect(content).not.toContain("// stale")
  })
})
