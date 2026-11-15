import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm, utimes } from "node:fs/promises"
import { tmpdir } from "node:os"
import {
  generate_docs,
  ImportParseError,
  mergeImports,
  parseImportLine,
  ROUTES_GENERATED_BEGIN_MARKER,
  ROUTES_GENERATED_END_MARKER,
  renderMarkdownNodes,
  resolveMdLink,
  splitFrontmatter,
  splitNodes,
  urlFor,
} from "./macro.ts"
import { buildMenu } from "./menu.ts"

describe("splitNodes", () => {
  test("recovers every top-level sibling from a real Bun.markdown.render pass (no wrapping document node)", () => {
    const md = [
      '# Heading *emph* **strong** ~~strike~~ [link](https://example.com "title")',
      "",
      'Text with [odd brackets like this] inside it, and "quotes \\"escaped\\"" too.',
      "",
      '<div class="raw">raw html block <b>bold</b></div>',
      "",
      "| a | b |",
      "|---|---|",
      "| 1 | 2 |",
    ].join("\n")

    // Bun.markdown.render's overall return is the raw concatenation of each top-level sibling's own
    // JSON (there is no wrapping "document" node), so renderMarkdownNodes must go through splitNodes
    // too — not JSON.parse directly — exactly like a parent node's `children` string.
    const topLevel = renderMarkdownNodes(md)

    expect(topLevel.map((n) => n[0])).toEqual(["heading", "paragraph", "html", "table"])
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
    const raw = JSON.stringify(["text", {}, 'array literal [1, 2, 3] and a "quoted [bracket]"'])
    const children = splitNodes(raw)
    expect(children).toEqual([["text", {}, 'array literal [1, 2, 3] and a "quoted [bracket]"']])
  })
})

describe("urlFor", () => {
  test("maps a docs/md path to its route: only the root index.md is /, directories are kept", () => {
    expect(
      ["index.md", "using-elt.md", "guide/intro.md", "guide/advanced/intro.md", "guide/index.md"].map(urlFor),
    ).toEqual(["/", "/using-elt", "/guide/intro", "/guide/advanced/intro", "/guide/index"])
  })
})

describe("resolveMdLink", () => {
  test("rewrites relative .md links to routes, resolved from the current file, and leaves the others alone", () => {
    const cases: [href: string, from: string, expected: string | null][] = [
      ["./using-elt-ui.md", "index.md", "/using-elt-ui"],
      ["../guide/intro.md", "adr/0001-x.md", "/guide/intro"],
      ["./guide/index.md", "index.md", "/guide/index"],
      ["./using-elt.md#section", "index.md", "/using-elt#section"],
      // external, not .md, in-page anchor: untouched
      ["https://example.com/x.md", "index.md", null],
      ["./image.png", "index.md", null],
      ["#section", "index.md", null],
    ]
    expect(cases.map(([href, from]) => resolveMdLink(href, from))).toEqual(cases.map((c) => c[2]))
  })
})

describe("splitFrontmatter", () => {
  test("parses a leading YAML block and returns the rest; without one, an empty object and the whole text", () => {
    expect(splitFrontmatter("---\ntitle: Hello\norder: 2\nsection: Guides\n---\n# Body\n")).toEqual({
      frontmatter: { title: "Hello", order: 2, section: "Guides" },
      body: "# Body\n",
    })
    expect(splitFrontmatter("# Just a heading\n")).toEqual({ frontmatter: {}, body: "# Just a heading\n" })
  })
})

describe("buildMenu", () => {
  test("groups ungrouped pages first, then sections alphabetically", () => {
    const menu = buildMenu([
      { name: "b", url: "/b", frontmatter: { title: "B", section: "Zeta" } },
      { name: "a", url: "/a", frontmatter: { title: "A" } },
      { name: "c", url: "/c", frontmatter: { title: "C", section: "Alpha" } },
    ])
    expect(menu.map((g) => g.section)).toEqual([null, "Alpha", "Zeta"])
    expect(menu[0]!.items.map((i) => i.title)).toEqual(["A"])
  })

  test("sorts within a group by order, then title; missing order sorts last", () => {
    const menu = buildMenu([
      { name: "z", url: "/z", frontmatter: { title: "Zebra" } },
      { name: "a", url: "/a", frontmatter: { title: "Alpha", order: 2 } },
      { name: "b", url: "/b", frontmatter: { title: "Bravo", order: 1 } },
    ])
    expect(menu[0]!.items.map((i) => i.title)).toEqual(["Bravo", "Alpha", "Zebra"])
  })
})

describe("parseImportLine", () => {
  test("parses every one-line import form", () => {
    const named = (type_only: boolean) => [
      { imported: "a", local: "a", type_only },
      { imported: "b", local: "c", type_only },
    ]
    expect(
      [
        'import "elt"',
        'import Foo from "mod"',
        'import * as P from "elt-phosphor"',
        'import { a, b as c } from "mod"',
        'import Foo, { a, b as c } from "mod"',
        'import { type a, type b as c } from "mod"',
      ].map((line) => parseImportLine(line, "loc")),
    ).toEqual([
      { kind: "side-effect", module: "elt" },
      { kind: "default", local: "Foo", module: "mod" },
      { kind: "namespace", local: "P", module: "elt-phosphor" },
      { kind: "named", module: "mod", names: named(false) },
      { kind: "default+named", local: "Foo", module: "mod", names: named(false) },
      { kind: "named", module: "mod", names: named(true) },
    ])
  })

  test("throws an ImportParseError citing the file:line on an unsupported form", () => {
    for (const line of ['import type { X } from "mod"', 'const x = import("mod")', "garbage"]) {
      expect(() => parseImportLine(line, "docs/md/x.md:5")).toThrow(ImportParseError)
      expect(() => parseImportLine(line, "docs/md/x.md:5")).toThrow(/docs\/md\/x\.md:5/)
    }
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

  test("throws when the same local name is bound to two different things", () => {
    expect(() =>
      mergeImports([
        { importLines: ['import { a as x } from "foo"'], loc: "docs/md/x.md:3" },
        { importLines: ['import { b as x } from "bar"'], loc: "docs/md/x.md:10" },
      ]),
    ).toThrow(/docs\/md\/x\.md:3.*docs\/md\/x\.md:10|docs\/md\/x\.md:10.*docs\/md\/x\.md:3/s)
  })

  test("two different default-local-names for the same module become two separate default-import lines", () => {
    const out = mergeImports([
      { importLines: ['import Foo from "mod"'], loc: "docs/md/x.md:3" },
      { importLines: ['import Bar from "mod"'], loc: "docs/md/x.md:10" },
    ])
    expect(out.sort()).toEqual(['import Bar from "mod"', 'import Foo from "mod"'])
  })

  test("identical side-effect and namespace imports across blocks dedupe to one line each", () => {
    const out = mergeImports([
      { importLines: ['import "mod"', 'import * as P from "elt-phosphor"'], loc: "docs/md/x.md:3" },
      { importLines: ['import "mod"', 'import * as P from "elt-phosphor"'], loc: "docs/md/x.md:10" },
    ])
    expect(out.sort()).toEqual(['import "mod"', 'import * as P from "elt-phosphor"'])
  })
})

// The real macro, elt_md(), calls generate_docs() with no arguments, scanning docs/md next to macro.ts (see
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
  // Fixture routes.ts: generate_docs() splices its generated import block between these markers, exactly
  // like the real (hand-written, tracked) docs/src/routes.ts — see spliceGeneratedBlock in macro.ts.
  await Bun.write(
    `${srcDir}/routes.ts`,
    [
      "// fixture: hand-written part",
      ROUTES_GENERATED_BEGIN_MARKER,
      ROUTES_GENERATED_END_MARKER,
      "// fixture: hand-written part continues",
      "",
    ].join("\n"),
  )
  return {
    root,
    mdDir,
    srcDir,
    generate_docs: () => generate_docs({ mdDir, srcDir }),
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

describe("generate_docs (integration)", () => {
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

    const { pages } = await t.generate_docs()
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

    await t.generate_docs()
    const targetPath = `${t.srcDir}/md/index.tsx`
    const firstWrite = Bun.file(targetPath).lastModified

    await t.generate_docs()
    expect(Bun.file(targetPath).lastModified).toBe(firstWrite)

    await new Promise((r) => setTimeout(r, 10))
    // A frontmatter-only change: the page file carries the frontmatter, so it is all that needs regenerating
    await Bun.write(`${t.mdDir}/index.md`, "---\ntitle: Renamed\n---\n# Index\n")
    await t.generate_docs()
    expect(Bun.file(targetPath).lastModified).toBeGreaterThan(firstWrite)
    expect(await Bun.file(targetPath).text()).toContain('"title":"Renamed"')
  })

  test("splices a named, referenced text-import block into routes.ts's GENERATED markers", async () => {
    const t = await withTempDocsTree({ "index.md": "# Index\n", "using-elt.md": "# Using elt\n" })
    tmp = t
    const routesPath = `${t.srcDir}/routes.ts`

    await t.generate_docs()
    const content = await Bun.file(routesPath).text()
    expect(content).toContain('import md_index_text from "../md/index.md" with { type: "text" }')
    expect(content).toContain('import md_using_elt_text from "../md/using-elt.md" with { type: "text" }')
    // named + referenced, not side-effect-only — see spec "Macro" on why this is required.
    expect(content).toContain("void md_index_text\nvoid md_using_elt_text")
    expect(content).toContain("// fixture: hand-written part\n") // hand-written parts untouched
    expect(content).toContain("// fixture: hand-written part continues")
  })

  test("routes.ts and routes.generated.ts are stable across repeated calls with no underlying change", async () => {
    const t = await withTempDocsTree({ "index.md": "# Index\n" })
    tmp = t
    const routesPath = `${t.srcDir}/routes.ts`

    await t.generate_docs()
    const before = await Bun.file(routesPath).text()
    const generated_before = await Bun.file(`${t.srcDir}/routes.generated.ts`).text()
    const firstWrite = Bun.file(routesPath).lastModified

    await new Promise((r) => setTimeout(r, 10))
    await t.generate_docs()
    const after = await Bun.file(routesPath).text()
    expect(after).toBe(before)
    expect(Bun.file(routesPath).lastModified).toBe(firstWrite) // no rewrite when content is unchanged
    // stable content is what makes the write-skip (see generate_docs) a no-op
    expect(await Bun.file(`${t.srcDir}/routes.generated.ts`).text()).toBe(generated_before)
  })

  test("routes.ts generated block updates when the file set changes, leaving hand-written parts intact", async () => {
    const t = await withTempDocsTree({ "index.md": "# Index\n" })
    tmp = t
    const routesPath = `${t.srcDir}/routes.ts`
    await t.generate_docs()

    await Bun.write(`${t.mdDir}/using-elt.md`, "# Using elt\n")
    await t.generate_docs()
    const content = await Bun.file(routesPath).text()
    expect(content).toContain('import md_using_elt_text from "../md/using-elt.md" with { type: "text" }')
    expect(content).toContain("// fixture: hand-written part\n")
    expect(content).toContain("// fixture: hand-written part continues")
  })

  test("throws a clear error when routes.ts is missing the GENERATED markers", async () => {
    const t = await withTempDocsTree({ "index.md": "# Index\n" })
    tmp = t
    await Bun.write(`${t.srcDir}/routes.ts`, "// no markers here\n")
    expect(t.generate_docs()).rejects.toThrow(/GENERATED-BEGIN\/GENERATED-END markers/)
  })

  test("headings/paragraphs/lists compile to literal JSX, not a serialized MdNode tree", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Title", "", "A paragraph with **bold** text.", "", "- one", "- two"].join("\n"),
    })
    tmp = t
    await t.generate_docs()
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
    await t.generate_docs()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    assertValidTsx(content) // would throw if the raw characters broke out of JSX/JS syntax
  })

  test("raw HTML in markdown source is spliced verbatim as literal JSX", async () => {
    const t = await withTempDocsTree({
      // A trailing blank line is needed for Bun.markdown.render to close the raw-HTML block.
      "index.md": ["# Title", "", '<div class="note">a note</div>', "", "more text"].join("\n"),
    })
    tmp = t
    await t.generate_docs()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain('<div class="note">a note</div>')
    assertValidTsx(content)
  })

  test("plain ts/tsx fences compile to a highlighted CodeExample with no run props", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Index", "", "```ts", "const x: number = 1", "```", ""].join("\n"),
    })
    tmp = t
    await t.generate_docs()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain("<CodeExample")
    expect(content).not.toContain("run={() =>")
    expect(content).toContain('"const"')
    expect(content).toContain('"number"')
    assertValidTsx(content)
  })

  test("each colored token carries its light-theme and dark-theme colors; default-colored tokens stay uncolored", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Index", "", "```ts", 'const o_user = o({ name: "Ada" })', "```", ""].join("\n"),
    })
    tmp = t
    await t.generate_docs()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    // `const` is red in github-light, pink in github-dark: one class call with both colors.
    expect(content).toContain('<span class={tokenColorClass("#D73A49", "#F97583")}>{"const"}</span>')
    // Every call passes both colors (a single-color call would leave one scheme to the other's color).
    const calls = [...content.matchAll(/tokenColorClass\("(#[0-9A-F]+)", "(#[0-9A-F]+)"\)/g)]
    expect(calls.length).toBeGreaterThan(0)
    expect(content.match(/tokenColorClass\(/g)?.length).toBe(calls.length)
    // `name` and the punctuation use the themes' default text color: plain text, the page's text color.
    expect(content).toContain('</span>{"({ name: "}<span')
    expect(content).not.toContain("#24292E")
    expect(content).not.toContain("#E1E4E8")
    // Literal JSX spans: never .innerHTML, an HTML string, or a per-span inline style
    expect(content).not.toMatch(/<span style=/)
    expect(content).not.toContain(".innerHTML")
    expect(content).not.toContain("highlightedHtml")
    assertValidTsx(content)
  })

  test("tokenColorClass is only imported when some token is colored", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Index", "", "```text", "hello", "```", ""].join("\n"),
      "colored.md": ["# Colored", "", "```ts", "const x = 1", "```", ""].join("\n"),
    })
    tmp = t
    await t.generate_docs()
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
    await t.generate_docs()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).not.toContain("run={() =>")
    expect(content).toContain('"echo"')
    expect(content).toContain('"hi"')
  })

  test("@inline-example blocks are passed uncalled as the run prop, with imports merged to the top", async () => {
    const t = await withTempDocsTree({
      "index.md": [
        "# Index",
        "",
        "```tsx",
        "//@inline-example",
        'import { o } from "elt"',
        "const c = o(1)",
        "return <div>{c}</div>",
        "```",
        "",
      ].join("\n"),
    })
    tmp = t
    await t.generate_docs()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain("run={() =>")
    expect(content).toContain('import { o } from "elt"')
    expect(content).not.toContain("//@inline-example") // marker stripped before display/codegen
    assertValidTsx(content)
  })

  test("@full-example blocks generate their own standalone routed file, not spliced into the page", async () => {
    const t = await withTempDocsTree({
      "index.md": [
        "# Index",
        "",
        "```tsx",
        "//@full-example",
        'import { o } from "elt"',
        "const c = o(1)",
        "return <div>{c}</div>",
        "```",
        "",
      ].join("\n"),
    })
    tmp = t
    const { pages } = await t.generate_docs()
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

  test("routes.generated.ts statically imports every page and reads its .frontmatter/.PageService live", async () => {
    const t = await withTempDocsTree({
      "index.md": "---\ntitle: Index\n---\n# Index\n",
      "guide/intro.md": ["# Intro", "", "```tsx", "//@full-example", "return <div/>", "```", ""].join("\n"),
    })
    tmp = t
    await t.generate_docs()
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

  test("two pages whose names sanitize to the same module alias get distinct aliases", async () => {
    const t = await withTempDocsTree({
      "guide-intro.md": "# A\n",
      "guide/intro.md": "# B\n",
    })
    tmp = t
    const { pages } = await t.generate_docs()
    const aliases = pages.map((p) => p.moduleAlias)
    expect(new Set(aliases).size).toBe(aliases.length) // no collision
  })
})

describe("generate_docs (generated files follow their sources)", () => {
  let tmp: { root: string } | null = null

  afterEach(async () => {
    if (tmp) await rm(tmp.root, { recursive: true, force: true })
    tmp = null
  })

  /** A page with `count` @full-example blocks; their opening fences are at lines 3, 8, 13... */
  const fullExamplePage = (count: number) =>
    [
      "# Index",
      "",
      ...Array.from({ length: count }, (_, i) => [
        "```tsx",
        "//@full-example",
        `return <div>${i}</div>`,
        "```",
        "",
      ]).flat(),
    ].join("\n")

  test("a page is regenerated when macro.ts is newer than its generated file, even if its .md is older", async () => {
    const t = await withTempDocsTree({ "index.md": "# Index\n" })
    tmp = t
    await t.generate_docs()
    const target = `${t.srcDir}/md/index.tsx`
    // .md at t=1000s, generated file at t=2000s: up to date with its .md, but older than macro.ts.
    await utimes(`${t.mdDir}/index.md`, 1000, 1000)
    await utimes(target, 2000, 2000)
    await t.generate_docs()
    expect(Bun.file(target).lastModified).toBeGreaterThan(2000 * 1000)
  })

  test("the generated file of a deleted .md is deleted", async () => {
    const t = await withTempDocsTree({ "index.md": "# Index\n", "guide/old.md": "# Old\n" })
    tmp = t
    await t.generate_docs()
    expect(await Bun.file(`${t.srcDir}/md/guide/old.tsx`).exists()).toBe(true)
    await rm(`${t.mdDir}/guide/old.md`)
    await t.generate_docs()
    expect(await Bun.file(`${t.srcDir}/md/guide/old.tsx`).exists()).toBe(false)
    expect(await Bun.file(`${t.srcDir}/md/index.tsx`).exists()).toBe(true)
  })

  test("the .full-N.tsx of a removed @full-example is deleted", async () => {
    const t = await withTempDocsTree({ "index.md": fullExamplePage(2) })
    tmp = t
    await t.generate_docs()
    expect(await Bun.file(`${t.srcDir}/md/index.full-1.tsx`).exists()).toBe(true)
    await Bun.write(`${t.mdDir}/index.md`, fullExamplePage(1))
    await utimes(`${t.srcDir}/md/index.tsx`, 1000, 1000) // older than the .md just written
    const { pages } = await t.generate_docs()
    expect(pages[0]?.fullExampleLines).toEqual([3])
    expect(await Bun.file(`${t.srcDir}/md/index.full-0.tsx`).exists()).toBe(true)
    expect(await Bun.file(`${t.srcDir}/md/index.full-1.tsx`).exists()).toBe(false)
  })

  test("a deleted .full-N.tsx is re-created even though the page is otherwise up to date", async () => {
    const t = await withTempDocsTree({ "index.md": fullExamplePage(1) })
    tmp = t
    await t.generate_docs()
    await rm(`${t.srcDir}/md/index.full-0.tsx`)
    await t.generate_docs()
    expect(await Bun.file(`${t.srcDir}/md/index.full-0.tsx`).exists()).toBe(true)
  })

  test("full-example routes survive a second call, when the page is up to date and not parsed again", async () => {
    const t = await withTempDocsTree({ "index.md": fullExamplePage(2) })
    tmp = t
    await t.generate_docs()
    const { pages } = await t.generate_docs()
    expect(pages[0]?.fullExampleLines).toEqual([3, 8])
  })

  test("a non-ts fence starting with //@full-example gets no route (it is a plain code block)", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Index", "", "```js", "//@full-example", "console.log(1)", "```", ""].join("\n"),
    })
    tmp = t
    const { pages } = await t.generate_docs()
    expect(pages[0]?.fullExampleLines).toEqual([])
    const routes = await Bun.file(`${t.srcDir}/routes.generated.ts`).text()
    expect(routes).not.toContain("full-example")
  })
})

describe("generate_docs (source line numbers of code blocks)", () => {
  let tmp: { root: string } | null = null

  afterEach(async () => {
    if (tmp) await rm(tmp.root, { recursive: true, force: true })
    tmp = null
  })

  const inlineExample = ["```tsx", "//@inline-example", "return <div/>", "```"]

  test("an indented code block before an @inline-example does not shift its line number", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Index", "", "    indented code", "", ...inlineExample, ""].join("\n"),
    })
    tmp = t
    await t.generate_docs()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain("/* docs/md/index.md:5 */")
  })

  test("a longer fence containing ``` lines does not shift the next block's line number", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Index", "", "````md", "```ts", "inner", "```", "````", "", ...inlineExample, ""].join("\n"),
    })
    tmp = t
    await t.generate_docs()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain("/* docs/md/index.md:9 */")
  })

  test("indented lines inside a list are not taken for an indented code block", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Index", "", "- item", "", "    continued paragraph", "", ...inlineExample, ""].join("\n"),
    })
    tmp = t
    await t.generate_docs()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain("/* docs/md/index.md:7 */")
  })
})

describe("extractImports", () => {
  let tmp: { root: string } | null = null

  afterEach(async () => {
    if (tmp) await rm(tmp.root, { recursive: true, force: true })
    tmp = null
  })

  test("only lines starting at column 0 are hoisted as imports", async () => {
    const t = await withTempDocsTree({
      "index.md": [
        "# Index",
        "",
        "```tsx",
        "//@inline-example",
        'import { o } from "elt"',
        "const src = `",
        '  import { x } from "y"',
        "`",
        "return <pre>{src}{o(1)}</pre>",
        "```",
        "",
      ].join("\n"),
    })
    tmp = t
    await t.generate_docs()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).not.toMatch(/^import \{ x \} from "y"/m)
    expect(content).toContain('  import { x } from "y"')
  })
})

describe("wiki links", () => {
  let tmp: { root: string } | null = null

  afterEach(async () => {
    if (tmp) await rm(tmp.root, { recursive: true, force: true })
    tmp = null
  })

  test("[[page]], [[page#heading]], [[page|label]] and [[#heading]] become links, resolved like ./page.md", async () => {
    const t = await withTempDocsTree({
      "guide/intro.md":
        "# Intro\n\nSee [[other]], [[other#part]], [[../index|home]], [[#here|above]] and `[[not a link]]`.\n",
    })
    tmp = t
    await t.generate_docs()
    const content = await Bun.file(`${t.srcDir}/md/guide/intro.tsx`).text()
    expect(content).toContain('<a href={"/guide/other"}>{"other"}</a>')
    expect(content).toContain('<a href={"/guide/other#part"}>{"other#part"}</a>')
    expect(content).toContain('<a href={"/"}>{"home"}</a>')
    expect(content).toContain('<a href={"#here"}>{"above"}</a>')
    expect(content).toContain("[[not a link]]")
    assertValidTsx(content)
  })
})
