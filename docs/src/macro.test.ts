import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import {
  buildMenu, elt_md, ImportParseError, mergeImports, node, parseImportLine,
  resolveMdLink, ROUTES_GENERATED_BEGIN_MARKER, ROUTES_GENERATED_END_MARKER, splitFrontmatter,
  splitNodes, urlFor,
} from "./macro.ts"

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

describe("urlFor", () => {
  test("root index.md maps to /", () => {
    expect(urlFor("index.md")).toBe("/")
  })

  test("other root-level files map to /<file>", () => {
    expect(urlFor("using-elt.md")).toBe("/using-elt")
  })

  test("files under a subdirectory map to /<dir>/<file>", () => {
    expect(urlFor("guide/intro.md")).toBe("/guide/intro")
  })

  test("nests for deeper subdirectories", () => {
    expect(urlFor("guide/advanced/intro.md")).toBe("/guide/advanced/intro")
  })

  test("a nested index.md is not special-cased (only the root one is)", () => {
    expect(urlFor("guide/index.md")).toBe("/guide/index")
  })
})

describe("resolveMdLink", () => {
  test("rewrites a same-directory relative .md link to its new path-based route", () => {
    expect(resolveMdLink("./using-elt-ui.md", "index.md")).toBe("/using-elt-ui")
  })

  test("rewrites a parent-relative .md link, resolving .. segments", () => {
    expect(resolveMdLink("../guide/intro.md", "adr/0001-x.md")).toBe("/guide/intro")
  })

  test("resolves a nested link relative to the current file's own directory", () => {
    expect(resolveMdLink("./guide/index.md", "index.md")).toBe("/guide/index")
  })

  test("preserves a hash fragment on the link", () => {
    expect(resolveMdLink("./using-elt.md#section", "index.md")).toBe("/using-elt#section")
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

describe("buildMenu", () => {
  test("groups ungrouped pages first, then sections alphabetically", () => {
    const menu = buildMenu([
      { name: "b", url: "/b", frontmatter: { title: "B", section: "Zeta" } },
      { name: "a", url: "/a", frontmatter: { title: "A" } },
      { name: "c", url: "/c", frontmatter: { title: "C", section: "Alpha" } },
    ])
    expect(menu.map(g => g.section)).toEqual([null, "Alpha", "Zeta"])
    expect(menu[0]!.items.map(i => i.title)).toEqual(["A"])
  })

  test("sorts within a group by order, then title; missing order sorts last", () => {
    const menu = buildMenu([
      { name: "z", url: "/z", frontmatter: { title: "Zebra" } },
      { name: "a", url: "/a", frontmatter: { title: "Alpha", order: 2 } },
      { name: "b", url: "/b", frontmatter: { title: "Bravo", order: 1 } },
    ])
    expect(menu[0]!.items.map(i => i.title)).toEqual(["Bravo", "Alpha", "Zebra"])
  })

  test("falls back to the route name when no title is given", () => {
    const menu = buildMenu([{ name: "no-title", url: "/no-title", frontmatter: {} }])
    expect(menu[0]!.items[0]!.title).toBe("no-title")
  })
})

describe("parseImportLine", () => {
  test("parses a side-effect-only import", () => {
    expect(parseImportLine('import "elt"', "loc")).toEqual({ kind: "side-effect", module: "elt" })
  })

  test("parses a default import", () => {
    expect(parseImportLine('import Foo from "mod"', "loc")).toEqual({ kind: "default", local: "Foo", module: "mod" })
  })

  test("parses a namespace import", () => {
    expect(parseImportLine('import * as P from "elt-phosphor"', "loc"))
      .toEqual({ kind: "namespace", local: "P", module: "elt-phosphor" })
  })

  test("parses a named import with an alias", () => {
    expect(parseImportLine('import { a, b as c } from "mod"', "loc")).toEqual({
      kind: "named", module: "mod",
      names: [{ imported: "a", local: "a", type_only: false }, { imported: "b", local: "c", type_only: false }],
    })
  })

  test("parses a default+named import", () => {
    expect(parseImportLine('import Foo, { a, b as c } from "mod"', "loc")).toEqual({
      kind: "default+named", local: "Foo", module: "mod",
      names: [{ imported: "a", local: "a", type_only: false }, { imported: "b", local: "c", type_only: false }],
    })
  })

  test("throws on a multi-line-only shape (not actually testable as one line, so: unsupported form) like 'import type'", () => {
    expect(() => parseImportLine('import type { X } from "mod"', "docs/md/x.md:3"))
      .toThrow(ImportParseError)
  })

  test("throws on dynamic import()", () => {
    expect(() => parseImportLine('const x = import("mod")', "docs/md/x.md:3")).toThrow(ImportParseError)
  })

  test("thrown error cites the file:line location", () => {
    expect(() => parseImportLine("garbage", "docs/md/x.md:5")).toThrow(/docs\/md\/x\.md:5/)
  })
})

describe("mergeImports", () => {
  test("merges the same named symbol imported by two blocks into one line, not two", () => {
    const out = mergeImports([
      { importLines: ['import { o, $bind } from "elt"'], loc: "docs/md/x.md:3" },
      { importLines: ['import { o, node_append } from "elt"'], loc: "docs/md/x.md:10" },
    ])
    expect(out).toEqual(['import { o, $bind, node_append } from "elt"'])
  })

  test("{ type X } and { X } of the same binding merge into one value import, type-only stays type-only", () => {
    const out = mergeImports([
      { importLines: ['import { type Attrs, type Renderable } from "elt"'], loc: "docs/md/x.md:3" },
      { importLines: ['import { Attrs, RefChild } from "elt"'], loc: "docs/md/x.md:10" },
      { importLines: ['import { type Renderable as R } from "elt"'], loc: "docs/md/x.md:20" },
    ])
    expect(out).toEqual(['import { Attrs, type Renderable, RefChild, type Renderable as R } from "elt"'])
  })

  test("parses the inline type modifier of a named binding", () => {
    expect(parseImportLine('import { type a, type b as c } from "mod"', "loc")).toEqual({
      kind: "named", module: "mod",
      names: [{ imported: "a", local: "a", type_only: true }, { imported: "b", local: "c", type_only: true }],
    })
  })

  test("throws when the same local name is bound to two different things", () => {
    expect(() => mergeImports([
      { importLines: ['import { a as x } from "foo"'], loc: "docs/md/x.md:3" },
      { importLines: ['import { b as x } from "bar"'], loc: "docs/md/x.md:10" },
    ])).toThrow(/docs\/md\/x\.md:3.*docs\/md\/x\.md:10|docs\/md\/x\.md:10.*docs\/md\/x\.md:3/s)
  })

  test("two different default-local-names for the same module become two separate default-import lines", () => {
    const out = mergeImports([
      { importLines: ['import Foo from "mod"'], loc: "docs/md/x.md:3" },
      { importLines: ['import Bar from "mod"'], loc: "docs/md/x.md:10" },
    ])
    expect(out.sort()).toEqual(['import Bar from "mod"', 'import Foo from "mod"'])
  })

  test("a side-effect-only import merges to a single bare import when nothing else references the module", () => {
    const out = mergeImports([
      { importLines: ['import "mod"'], loc: "docs/md/x.md:3" },
      { importLines: ['import "mod"'], loc: "docs/md/x.md:10" },
    ])
    expect(out).toEqual(['import "mod"'])
  })

  test("a namespace import merges independently of named/default imports from other modules", () => {
    const out = mergeImports([
      { importLines: ['import * as P from "elt-phosphor"'], loc: "docs/md/x.md:3" },
      { importLines: ['import { o } from "elt"'], loc: "docs/md/x.md:10" },
    ])
    expect(out.sort()).toEqual(['import * as P from "elt-phosphor"', 'import { o } from "elt"'])
  })

  test("identical namespace imports across two blocks dedupe to one line", () => {
    const out = mergeImports([
      { importLines: ['import * as P from "elt-phosphor"'], loc: "docs/md/x.md:3" },
      { importLines: ['import * as P from "elt-phosphor"'], loc: "docs/md/x.md:10" },
    ])
    expect(out).toEqual(['import * as P from "elt-phosphor"'])
  })
})

// Every real call site invokes elt_md() with no arguments, scanning docs/md next to macro.ts (see
// docs/src/macro.ts). These tests instead point it at a temporary docs/md
// tree via the `roots` test-only seam, so they don't touch the real docs/md or docs/src/md.
async function withTempDocsTree(files: Record<string, string>) {
  const root = await mkdtemp(`${tmpdir()}/elt-md-test-`)
  const mdDir = `${root}/md`
  const srcDir = `${root}/src`
  await Bun.write(`${mdDir}/.keep`, "")
  for (const [rel, content] of Object.entries(files)) {
    await Bun.write(`${mdDir}/${rel}`, content)
  }
  // Fixture routes.ts: elt_md() splices its generated import block between these markers, exactly
  // like the real (hand-written, tracked) docs/src/routes.ts — see spliceGeneratedBlock in macro.ts.
  await Bun.write(`${srcDir}/routes.ts`, [
    "// fixture: hand-written part",
    ROUTES_GENERATED_BEGIN_MARKER,
    ROUTES_GENERATED_END_MARKER,
    "// fixture: hand-written part continues",
    "",
  ].join("\n"))
  return {
    root, mdDir, srcDir,
    elt_md: () => elt_md({ mdDir, srcDir }),
  }
}

/** Confirms generated JSX source is at least syntactically valid TSX (catches escaping bugs that
 * would otherwise only surface as a build failure inside the real docs app) without needing a full
 * elt/browser runtime — Bun.Transpiler only parses/transforms, it never executes anything. */
function assertValidTsx(source: string) {
  const transpiler = new Bun.Transpiler({
    loader: "tsx",
    tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "E", jsxFragmentFactory: "E.Fragment" } },
  })
  expect(() => transpiler.transformSync(source)).not.toThrow()
}

describe("elt_md (integration)", () => {
  let tmp: { root: string } | null = null

  afterEach(async () => {
    if (tmp) await rm(tmp.root, { recursive: true, force: true })
    tmp = null
  })

  test("recursively parses every docs/md file, computing routes and generating per-page files", async () => {
    const t = await withTempDocsTree({
      "index.md": "---\ntitle: Index\n---\n# Index\n",
      "using-elt.md": "---\ntitle: Using elt\n---\n# Using elt\n",
      "guide/intro.md": "---\ntitle: Intro\nsection: Guides\norder: 1\n---\n# Intro\n",
    })
    tmp = t

    const { pages } = await t.elt_md()
    const names = pages.map((p) => p.name).sort()
    expect(names).toEqual(["guide/intro", "index", "using-elt"])

    const byName = new Map(pages.map((p) => [p.name, p]))
    expect(byName.get("index")!.url).toBe("/")
    expect(byName.get("using-elt")!.url).toBe("/using-elt")
    expect(byName.get("guide/intro")!.url).toBe("/guide/intro")
    expect(byName.get("guide/intro")!.moduleAlias).toBe("md_guide_intro")

    expect(await Bun.file(`${t.srcDir}/md/index.tsx`).exists()).toBe(true)
    expect(await Bun.file(`${t.srcDir}/md/guide/intro.tsx`).exists()).toBe(true)
  })

  test("only regenerates a page's .tsx file when its .md source is missing, or newer than, the target", async () => {
    const t = await withTempDocsTree({ "index.md": "---\ntitle: Index\n---\n# Index\n" })
    tmp = t

    await t.elt_md()
    const targetPath = `${t.srcDir}/md/index.tsx`
    const firstWrite = Bun.file(targetPath).lastModified

    await t.elt_md()
    expect(Bun.file(targetPath).lastModified).toBe(firstWrite)

    await new Promise((r) => setTimeout(r, 10))
    await Bun.write(`${t.mdDir}/index.md`, "---\ntitle: Index\n---\n# Index changed\n")
    await t.elt_md()
    expect(Bun.file(targetPath).lastModified).toBeGreaterThan(firstWrite)
  })

  test("a frontmatter-only change is reflected the moment the page's own .tsx file regenerates", async () => {
    const t = await withTempDocsTree({ "index.md": "---\ntitle: Original\n---\n# Index\n" })
    tmp = t

    await t.elt_md()
    let content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain('"title":"Original"')

    await new Promise((r) => setTimeout(r, 10))
    await Bun.write(`${t.mdDir}/index.md`, "---\ntitle: Renamed\n---\n# Index\n")
    await t.elt_md()
    content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain('"title":"Renamed"')
  })

  test("splices a named, referenced text-import block into routes.ts's GENERATED markers", async () => {
    const t = await withTempDocsTree({ "index.md": "# Index\n", "using-elt.md": "# Using elt\n" })
    tmp = t
    const routesPath = `${t.srcDir}/routes.ts`

    await t.elt_md()
    const content = await Bun.file(routesPath).text()
    expect(content).toContain('import md_index_text from "../md/index.md" with { type: "text" }')
    expect(content).toContain('import md_using_elt_text from "../md/using-elt.md" with { type: "text" }')
    // named + referenced, not side-effect-only — see spec "Macro" on why this is required.
    expect(content).toContain("void [md_index_text, md_using_elt_text]")
    expect(content).toContain("// fixture: hand-written part\n") // hand-written parts untouched
    expect(content).toContain("// fixture: hand-written part continues")
  })

  test("routes.ts generated block is stable across repeated calls with no underlying change", async () => {
    const t = await withTempDocsTree({ "index.md": "# Index\n" })
    tmp = t
    const routesPath = `${t.srcDir}/routes.ts`

    await t.elt_md()
    const before = await Bun.file(routesPath).text()
    const firstWrite = Bun.file(routesPath).lastModified

    await new Promise((r) => setTimeout(r, 10))
    await t.elt_md()
    const after = await Bun.file(routesPath).text()
    expect(after).toBe(before)
    expect(Bun.file(routesPath).lastModified).toBe(firstWrite) // no rewrite when content is unchanged
  })

  test("routes.ts generated block updates when the file set changes, leaving hand-written parts intact", async () => {
    const t = await withTempDocsTree({ "index.md": "# Index\n" })
    tmp = t
    const routesPath = `${t.srcDir}/routes.ts`
    await t.elt_md()

    await Bun.write(`${t.mdDir}/using-elt.md`, "# Using elt\n")
    await t.elt_md()
    const content = await Bun.file(routesPath).text()
    expect(content).toContain('import md_using_elt_text from "../md/using-elt.md" with { type: "text" }')
    expect(content).toContain("// fixture: hand-written part\n")
    expect(content).toContain("// fixture: hand-written part continues")
  })

  test("throws a clear error when routes.ts is missing the GENERATED markers", async () => {
    const t = await withTempDocsTree({ "index.md": "# Index\n" })
    tmp = t
    await Bun.write(`${t.srcDir}/routes.ts`, "// no markers here\n")
    expect(t.elt_md()).rejects.toThrow(/GENERATED-BEGIN\/GENERATED-END markers/)
  })

  test("generated page exports a named PageService class, not a default export", async () => {
    const t = await withTempDocsTree({ "index.md": "# Index\n" })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain("export class PageService extends Service({}, {})")
    expect(content).not.toContain("export default")
    assertValidTsx(content)
  })

  test("headings/paragraphs/lists compile to literal JSX, not a serialized MdNode tree", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Title", "", "A paragraph with **bold** text.", "", "- one", "- two"].join("\n"),
    })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain("<h1 ")
    expect(content).toContain("<p>")
    expect(content).toContain("<strong>")
    expect(content).toContain("<ul>")
    expect(content).toContain("<li>")
    expect(content).not.toContain('["heading"') // no more JSON tuple serialization
    assertValidTsx(content)
  })

  test("prose containing JSX-special characters is safely escaped, not spliced as bare JSX text", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Title", "", 'Text with { braces }, <angle> brackets, a backslash \\ and a "quote".'].join("\n"),
    })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    assertValidTsx(content) // would throw if the raw characters broke out of JSX/JS syntax
  })

  test("raw HTML in markdown source is spliced verbatim as literal JSX", async () => {
    const t = await withTempDocsTree({
      // A trailing blank line is needed for Bun.markdown.render to close the raw-HTML block.
      "index.md": ["# Title", "", '<div class="note">a note</div>', "", "more text"].join("\n"),
    })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain('<div class="note">a note</div>')
    assertValidTsx(content)
  })

  test("invalid-as-JSX raw HTML in markdown source fails to compile, by design", async () => {
    const t = await withTempDocsTree({
      // A bare, non-self-closing <br> is valid loose HTML but not valid JSX.
      "index.md": ["# Title", "", "<br>", "", "more"].join("\n"),
    })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain("<br>")
    expect(() => new Bun.Transpiler({
      loader: "tsx",
      tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "E", jsxFragmentFactory: "E.Fragment" } },
    }).transformSync(content)).toThrow()
  })

  test("plain ts/tsx fences compile to a highlighted CodeExample with no run props", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Index", "", "```ts", "const x: number = 1", "```", ""].join("\n"),
    })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain("<CodeExample")
    expect(content).not.toContain("run={() =>")
    expect(content).toContain('"const"')
    expect(content).toContain('"number"')
    assertValidTsx(content)
  })

  test("token-based highlighting produces literal colored spans via tokenColorClass, never .innerHTML, an HTML string, or a per-span inline style", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Index", "", "```ts", "const x = 1", "```", ""].join("\n"),
    })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toMatch(/<span class=\{tokenColorClass\("#/)
    expect(content).toContain("tokenColorClass")
    expect(content).not.toMatch(/<span style=/)
    expect(content).not.toContain(".innerHTML")
    expect(content).not.toContain("highlightedHtml")
  })

  test("tokenColorClass is only imported when some token is colored", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Index", "", "```text", "hello", "```", ""].join("\n"),
      "colored.md": ["# Colored", "", "```ts", "const x = 1", "```", ""].join("\n"),
    })
    tmp = t
    await t.elt_md()
    const plain = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(plain).toContain("import { CodeExample } from")
    expect(plain).not.toContain("tokenColorClass")
    assertValidTsx(plain)
    const colored = await Bun.file(`${t.srcDir}/md/colored.tsx`).text()
    expect(colored).toContain("import { CodeExample, tokenColorClass } from")
  })

  test("other-language fences are highlighted, never treated as examples", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Index", "", "```bash", "echo hi", "```", ""].join("\n"),
    })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).not.toContain("run={() =>")
    expect(content).toContain('"echo"')
    expect(content).toContain('"hi"')
  })

  test("@inline-example blocks are passed uncalled as the run prop, with imports merged to the top", async () => {
    const t = await withTempDocsTree({
      "index.md": [
        "# Index", "",
        "```tsx", "//@inline-example", "import { o } from \"elt\"", "const c = o(1)", "return <div>{c}</div>", "```", "",
      ].join("\n"),
    })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain("run={() =>")
    expect(content).toContain('import { o } from "elt"')
    expect(content).not.toContain("//@inline-example") // marker stripped before display/codegen
    assertValidTsx(content)
  })

  test("@full-example blocks generate their own standalone routed file, not spliced into the page", async () => {
    const t = await withTempDocsTree({
      "index.md": [
        "# Index", "",
        "```tsx", "//@full-example", "import { o } from \"elt\"", "const c = o(1)", "return <div>{c}</div>", "```", "",
      ].join("\n"),
    })
    tmp = t
    const { pages } = await t.elt_md()
    expect(pages[0]!.fullExampleLines).toEqual([3])

    const pageContent = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(pageContent).not.toContain("run={() =>")
    expect(pageContent).toContain("fullExampleUrl")
    expect(pageContent).toContain("/full-example/index/0")

    const exampleContent = await Bun.file(`${t.srcDir}/md/index.full-0.tsx`).text()
    expect(exampleContent).toContain('import { o } from "elt"')
    expect(exampleContent).toContain("return <div>{c}</div>")
    expect(exampleContent).toContain("export default class")
  })

  test("every generated page file cites its markdown source path", async () => {
    const t = await withTempDocsTree({ "guide/intro.md": "# Intro\n" })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/md/guide/intro.tsx`).text()
    expect(content).toContain("// Source: docs/md/guide/intro.md")
  })

  test("routes.generated.ts statically imports every page and reads its .frontmatter/.PageService live", async () => {
    const t = await withTempDocsTree({
      "index.md": "---\ntitle: Index\n---\n# Index\n",
      "guide/intro.md": [
        "# Intro", "",
        "```tsx", "//@full-example", "return <div/>", "```", "",
      ].join("\n"),
    })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/routes.generated.ts`).text()

    expect(content).toContain('import * as md_index from "./md/index.tsx"')
    expect(content).toContain('import * as md_guide_intro from "./md/guide/intro.tsx"')
    expect(content).toContain("() => md_index.PageService")
    expect(content).toContain("frontmatter: md_index.frontmatter")
    expect(content).not.toContain('import("./md/index.tsx")') // no lazy import for a regular page

    // @full-example routes stay lazily dynamic-imported.
    expect(content).toContain('import("./md/guide/intro.full-0.tsx")')
    expect(content).toContain('"/full-example/guide/intro/0"')
    expect(content).toContain("// docs/md/guide/intro.md:3")

    expect(content).toContain("buildMenu(")
    expect(content).toContain('import { buildMenu } from "./menu.ts"')
  })

  test("routes.generated.ts content is stable across repeated calls with no underlying change", async () => {
    const t = await withTempDocsTree({ "index.md": "# Index\n" })
    tmp = t
    await t.elt_md()
    const routesPath = `${t.srcDir}/routes.generated.ts`
    const before = await Bun.file(routesPath).text()

    await t.elt_md()
    const after = await Bun.file(routesPath).text()
    expect(after).toBe(before) // stable content is what makes the write-skip (see elt_md) a no-op
  })

  test("two pages whose names sanitize to the same module alias get distinct aliases", async () => {
    const t = await withTempDocsTree({
      "guide-intro.md": "# A\n",
      "guide/intro.md": "# B\n",
    })
    tmp = t
    const { pages } = await t.elt_md()
    const aliases = pages.map((p) => p.moduleAlias)
    expect(new Set(aliases).size).toBe(aliases.length) // no collision
  })
})
