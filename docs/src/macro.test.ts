import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import {
  elt_md, node, resolveMdLink, splitFrontmatter, splitNodes, urlFor,
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
    expect(resolveMdLink("./using-elt-ui.md", "index.md")).toBe("#/using-elt-ui")
  })

  test("rewrites a parent-relative .md link, resolving .. segments", () => {
    expect(resolveMdLink("../guide/intro.md", "adr/0001-x.md")).toBe("#/guide/intro")
  })

  test("resolves a nested link relative to the current file's own directory", () => {
    expect(resolveMdLink("./guide/index.md", "index.md")).toBe("#/guide/index")
  })

  test("preserves a hash fragment on the link", () => {
    expect(resolveMdLink("./using-elt.md#section", "index.md")).toBe("#/using-elt#section")
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

// Every real call site invokes elt_md() with no arguments, scanning docs/md next to macro.ts (see
// specs/markdown-docs-reloaded.md, "Macro"). These tests instead point it at a temporary docs/md
// tree via the `roots` test-only seam, so they don't touch the real docs/md or docs/src/md.
async function withTempDocsTree(files: Record<string, string>) {
  const root = await mkdtemp(`${tmpdir()}/elt-md-test-`)
  const mdDir = `${root}/md`
  const srcDir = `${root}/src`
  await Bun.write(`${mdDir}/.keep`, "")
  for (const [rel, content] of Object.entries(files)) {
    await Bun.write(`${mdDir}/${rel}`, content)
  }
  return {
    root, mdDir, srcDir,
    elt_md: () => elt_md({ mdDir, srcDir }),
  }
}

describe("elt_md (integration)", () => {
  let tmp: { root: string } | null = null

  afterEach(async () => {
    if (tmp) await rm(tmp.root, { recursive: true, force: true })
    tmp = null
  })

  test("recursively parses every docs/md file, computing routes/menu and generating per-page files", async () => {
    const t = await withTempDocsTree({
      "index.md": "---\ntitle: Index\n---\n# Index\n",
      "using-elt.md": "---\ntitle: Using elt\n---\n# Using elt\n",
      "guide/intro.md": "---\ntitle: Intro\nsection: Guides\norder: 1\n---\n# Intro\n",
    })
    tmp = t

    const { pages, menu } = await t.elt_md()
    const names = pages.map((p) => p.name).sort()
    expect(names).toEqual(["guide/intro", "index", "using-elt"])

    const byName = new Map(pages.map((p) => [p.name, p]))
    expect(byName.get("index")!.url).toBe("/")
    expect(byName.get("using-elt")!.url).toBe("/using-elt")
    expect(byName.get("guide/intro")!.url).toBe("/guide/intro")

    expect(await Bun.file(`${t.srcDir}/md/index.tsx`).exists()).toBe(true)
    expect(await Bun.file(`${t.srcDir}/md/guide/intro.tsx`).exists()).toBe(true)

    // menu: ungrouped ("Index", "Using elt") first, then the "Guides" section.
    expect(menu[0]!.section).toBeNull()
    expect(menu[0]!.items.map((i) => i.title).sort()).toEqual(["Index", "Using elt"])
    expect(menu[1]).toEqual({ section: "Guides", items: [{ name: "guide/intro", title: "Intro", url: "/guide/intro", order: 1 }] })
  })

  test("only regenerates a page's .ts file when its .md source is missing, or newer than, the target", async () => {
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

  test("menu/routes reflect a frontmatter-only change immediately, without touching the file list", async () => {
    const t = await withTempDocsTree({ "index.md": "---\ntitle: Original\n---\n# Index\n" })
    tmp = t

    const first = await t.elt_md()
    expect(first.menu[0]!.items[0]!.title).toBe("Original")

    await Bun.write(`${t.mdDir}/index.md`, "---\ntitle: Renamed\n---\n# Index\n")
    const second = await t.elt_md()
    expect(second.menu[0]!.items[0]!.title).toBe("Renamed")
  })

  test("(re)writes md-deps.ts to match the current file set when it's missing or stale", async () => {
    const t = await withTempDocsTree({ "index.md": "# Index\n", "using-elt.md": "# Using elt\n" })
    tmp = t
    const depsPath = `${t.srcDir}/md-deps.ts`
    await Bun.write(depsPath, "// stale\n")

    await t.elt_md()
    const content = await Bun.file(depsPath).text()
    expect(content).toContain('import "../md/index.md" with { type: "text" }')
    expect(content).toContain('import "../md/using-elt.md" with { type: "text" }')
    expect(content).not.toContain("// stale")
  })

  test("plain ts/tsx fences generate no renderResult (highlight-only, no execution)", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Index", "", "```ts", "const x: number = 1", "```", ""].join("\n"),
    })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).not.toContain("renderResult")
    expect(content).toContain("const x: number = 1")
  })

  test("other-language fences are highlighted, never treated as examples", async () => {
    const t = await withTempDocsTree({
      "index.md": ["# Index", "", "```bash", "echo hi", "```", ""].join("\n"),
    })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).not.toContain("renderResult")
    expect(content).toContain("echo hi")
  })

  test("@inline-example blocks splice their body as a live renderResult, with imports merged to the top", async () => {
    const t = await withTempDocsTree({
      "index.md": [
        "# Index", "",
        "```tsx", "//@inline-example", "import { o } from \"elt\"", "const c = o(1)", "return <div>{c}</div>", "```", "",
      ].join("\n"),
    })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/md/index.tsx`).text()
    expect(content).toContain("renderResult:")
    expect(content).toContain('import { o } from "elt"')
    expect(content).not.toContain("//@inline-example") // marker stripped before display/codegen
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
    expect(pageContent).not.toContain("renderResult")
    expect(pageContent).toContain("fullExampleUrl")
    expect(pageContent).toContain("#/full-example/index/0")

    const exampleContent = await Bun.file(`${t.srcDir}/md/index.full-0.tsx`).text()
    expect(exampleContent).toContain('import { o } from "elt"')
    expect(exampleContent).toContain("return <div>{c}</div>")
  })

  test("every generated page file cites its markdown source path", async () => {
    const t = await withTempDocsTree({ "guide/intro.md": "# Intro\n" })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/md/guide/intro.tsx`).text()
    expect(content).toContain("// Source: docs/md/guide/intro.md")
  })

  test("routes.generated.ts uses a static import() literal per page and cites its source, since a computed template-literal import() does not code-split at runtime", async () => {
    const t = await withTempDocsTree({
      "index.md": "# Index\n",
      "guide/intro.md": [
        "# Intro", "",
        "```tsx", "//@full-example", "return <div/>", "```", "",
      ].join("\n"),
    })
    tmp = t
    await t.elt_md()
    const content = await Bun.file(`${t.srcDir}/routes.generated.ts`).text()

    expect(content).toContain('import("./md/index.tsx")')
    expect(content).toContain("// docs/md/index.md:1")
    expect(content).toContain('import("./md/guide/intro.tsx")')
    expect(content).toContain('import("./md/guide/intro.full-0.tsx")')
    expect(content).toContain("// docs/md/guide/intro.md:3")
    expect(content).toContain('"/full-example/guide/intro/0"')
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
})
