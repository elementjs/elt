// Build-time markdown -> generated-TypeScript macro. See specs/markdown-docs-reloaded.md for the
// design rationale (why elt_md() is a macro returning only JSON-serializable data, why per-page
// output is a real generated .ts file instead of an in-memory tree, and why routing/menu data is
// recomputed on every call rather than cached on disk the way the per-page files are).

// Tiny inline replacement for node:path's resolve, to avoid a @types/node dependency (docs/tsconfig.json
// only declares @types/bun) for a single one-line operation.
const path = {
  /** Like node:path's resolve: a later absolute segment resets everything before it. */
  resolve: (...parts: string[]) => {
    let out: string[] = []
    for (const part of parts) {
      if (part.startsWith("/")) out = []
      for (const seg of part.split("/")) {
        if (seg === "" || seg === ".") continue
        if (seg === "..") out.pop()
        else out.push(seg)
      }
    }
    return `/${out.join("/")}`
  },
}

export type MdNode = [type: string, meta: Record<string, any>, children: MdNode[] | string]

export type Frontmatter = {
  title?: string
  order?: number
  section?: string
  draft?: boolean
}

/** One entry of the generated menu, grouped by section (see buildMenu). */
export type MenuEntry = { name: string; title: string; url: string; order: number }
export type MenuGroup = { section: string | null; items: MenuEntry[] }

/** One discovered page, as returned by the macro (JSON-serializable only — see elt_md). */
export type PageEntry = {
  /** Route key / generated-file path (no ".ts"), e.g. "using-elt" or "guide/intro". */
  name: string
  /** URL path this page is served at, e.g. "/" or "/using-elt" or "/guide/intro". */
  url: string
  frontmatter: Frontmatter
  /** Source line of each `@full-example` block's opening fence, in document order — see Routing. */
  fullExampleLines: number[]
}

const NODE_TYPES = [
  "heading", "paragraph", "blockquote", "code", "list", "listItem", "hr", "table",
  "thead", "tbody", "tr", "th", "td", "html", "strong", "emphasis", "link", "image",
  "codespan", "strikethrough",
] as const

/**
 * Recover the list of child nodes from a `children` string that is the raw concatenation of
 * each child's own `JSON.stringify([type, meta, children])` output (Bun.markdown.render gives
 * callbacks no separator between siblings). Scans for balanced, quote/escape-aware `[...]` runs;
 * anything between them (e.g. Bun's own literal "\n" for a line break) becomes a literal text node.
 */
export function splitNodes(raw: string): MdNode[] {
  const out: MdNode[] = []
  let i = 0
  while (i < raw.length) {
    if (raw[i] === "[") {
      let depth = 0
      let inStr = false
      let esc = false
      const start = i
      for (; i < raw.length; i++) {
        const c = raw[i]
        if (inStr) {
          if (esc) esc = false
          else if (c === "\\") esc = true
          else if (c === '"') inStr = false
        } else {
          if (c === '"') inStr = true
          else if (c === "[") depth++
          else if (c === "]") {
            depth--
            if (depth === 0) { i++; break }
          }
        }
      }
      out.push(JSON.parse(raw.slice(start, i)))
    } else {
      const start = i
      while (i < raw.length && raw[i] !== "[") i++
      const literal = raw.slice(start, i)
      if (literal.length > 0) out.push(["text", {}, literal])
    }
  }
  return out
}

export function node(type: string, meta: unknown, childrenRaw: string): string {
  return JSON.stringify([type, meta ?? {}, splitNodes(childrenRaw)])
}

export function splitFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { frontmatter: {}, body: raw }
  const [, yaml, body] = m
  const frontmatter = (Bun.YAML.parse(yaml ?? "") ?? {}) as Frontmatter
  return { frontmatter, body: body ?? "" }
}

/** Route name: `.md` path relative to docs/md, extension stripped, dir segments kept as-is. */
function nameFor(relPath: string): string {
  return relPath.replace(/\.md$/, "")
}

/** Root `index.md` -> "/"; other root files -> "/<file>"; nested files -> "/<dir>/.../<file>". */
export function urlFor(relPath: string): string {
  const name = nameFor(relPath)
  return name === "index" ? "/" : `/${name}`
}

/**
 * Relative `.md` links (`./x.md`, `../dir/x.md`) become internal hash-routes matching the new
 * per-file route scheme (see Routing in the spec). `fromPath` is this document's own path relative
 * to `docs/md/`, used to resolve the link's relative path into that same scheme.
 */
export function resolveMdLink(href: string, fromPath: string): string | null {
  if (!/^\.\.?\//.test(href)) return null
  if (!href.replace(/[?#].*$/, "").endsWith(".md")) return null
  const [cleanHref, hash] = href.split(/(?=[?#])/, 2)
  const fromDir = fromPath.split("/").slice(0, -1)
  const parts = [...fromDir, ...(cleanHref ?? href).split("/")]
  const resolved: string[] = []
  for (const part of parts) {
    if (part === "." || part === "") continue
    if (part === "..") resolved.pop()
    else resolved.push(part)
  }
  return `#${urlFor(resolved.join("/"))}${hash ?? ""}`
}

function rewriteLinks(n: MdNode, fromPath: string): void {
  if (n[0] === "link" && typeof n[1]?.href === "string") {
    const rewritten = resolveMdLink(n[1].href, fromPath)
    if (rewritten) n[1] = { ...n[1], href: rewritten }
  }
  if (Array.isArray(n[2])) {
    for (const child of n[2]) rewriteLinks(child, fromPath)
  }
}

function collectCodeNodes(n: MdNode, out: MdNode[]): void {
  if (n[0] === "code") out.push(n)
  if (Array.isArray(n[2])) {
    for (const child of n[2]) collectCodeNodes(child, out)
  }
}

function findFirstHeading(n: MdNode): MdNode | null {
  if (n[0] === "heading") return n
  if (Array.isArray(n[2])) {
    for (const child of n[2]) {
      const found = findFirstHeading(child)
      if (found) return found
    }
  }
  return null
}

function textOf(n: MdNode): string {
  if (n[0] === "text") return typeof n[2] === "string" ? n[2] : ""
  if (Array.isArray(n[2])) return n[2].map(textOf).join("")
  return ""
}

type Annotation = "inline-example" | "full-example" | null

/** First line `//@inline-example` / `//@full-example` selects a code fence's kind (see the spec). */
function annotationOf(code: string): { annotation: Annotation; body: string } {
  const nl = code.indexOf("\n")
  const firstLine = (nl === -1 ? code : code.slice(0, nl)).trim()
  if (firstLine === "//@inline-example") return { annotation: "inline-example", body: code.slice(nl + 1) }
  if (firstLine === "//@full-example") return { annotation: "full-example", body: code.slice(nl + 1) }
  return { annotation: null, body: code }
}

/** Splits a snippet into its top-level `import ...` lines (verbatim) and the remaining body. */
function extractImports(code: string): { importLines: string[]; body: string } {
  const lines = code.split("\n")
  const importLines = lines.filter((l) => /^import\s+.*\bfrom\s*["'][^"']+["'];?\s*$/.test(l.trim()))
  const body = lines.filter((l) => !importLines.includes(l)).join("\n")
  return { importLines, body }
}

const { codeToHtml } = await import("shiki")

type InlineExample = { node: MdNode; body: string; importLines: string[]; sourceLine: number }
type FullExample = { node: MdNode; index: number; importLines: string[]; body: string; sourceLine: number }

/**
 * Highlights every code node (all languages) and classifies ts/tsx ones per the spec's three
 * fence kinds. Plain ts/tsx and non-ts/tsx fences are left as highlight-only display data. Mutates
 * `codeNodes` in place and returns the inline/full examples collected for codegen. `fenceLines[i]`
 * is the source line of `codeNodes[i]`'s opening fence (see computeFenceLines).
 */
async function processCodeNodes(codeNodes: MdNode[], fenceLines: number[]): Promise<{ inline: InlineExample[]; full: FullExample[] }> {
  const inline: InlineExample[] = []
  const full: FullExample[] = []
  let fullIndex = 0

  for (let i = 0; i < codeNodes.length; i++) {
    const n = codeNodes[i]!
    const sourceLine = fenceLines[i] ?? 1
    const lang = n[1]?.language
    const raw = textOf(n)
    const isTs = lang === "ts" || lang === "tsx"
    const { annotation, body: withoutMarker } = isTs ? annotationOf(raw) : { annotation: null as Annotation, body: raw }

    const displayText = annotation ? withoutMarker.replace(/^\n/, "") : raw
    const highlightedHtml = await codeToHtml(displayText, { lang: lang || "text", theme: "github-dark" })
    n[1] = { ...n[1], highlightedHtml }
    n[2] = displayText

    if (annotation === "inline-example") {
      const { importLines, body } = extractImports(displayText)
      inline.push({ node: n, body, importLines, sourceLine })
    } else if (annotation === "full-example") {
      const { importLines, body } = extractImports(displayText)
      const index = fullIndex++
      n[1].fullExampleIndex = index
      full.push({ node: n, index, importLines, body, sourceLine })
    }
  }

  return { inline, full }
}

/** Cheap, parse-free first-heading text (e.g. "# Title" -> "Title") — the same fallback
 * parseAndGenerate computes via a full parse, recomputed here without one for the menu (see the
 * `stale` branch above: elt_md must give the same title every call, not just on a page's first
 * [re]build, or the menu would silently revert to the bare filename on every later, non-stale run). */
function firstHeadingText(body: string): string | null {
  const m = body.match(/^#{1,6}\s+(.+?)\s*$/m)
  return m?.[1]?.replace(/[*_`]/g, "") ?? null
}

/** Cheap, parse-free line numbers of every `@full-example` fence's opening ` ``` ` — used to size
 * and comment the routes generated on every macro call, even for pages whose generated .ts file is
 * up to date and not being re-parsed (see computeFenceLines for why a full parse isn't needed). */
function findFullExampleLines(raw: string): number[] {
  const lines = raw.split("\n")
  const out: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i]!) && lines[i + 1]?.trim() === "//@full-example") out.push(i + 1)
  }
  return out
}

/** Dedupe by exact line text — multiple identical `import` lines across merged snippets collapse
 * to one; different clauses from the same specifier are kept as separate lines (valid ESM). */
function mergeImportLines(groups: string[][]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const lines of groups) {
    for (const line of lines) {
      if (seen.has(line)) continue
      seen.add(line)
      out.push(line)
    }
  }
  return out
}

/** Serializes an MdNode tree as executable TS source (not JSON): inline-example nodes splice in a
 * live IIFE literal so their JSX executes as real module code when the generated page loads.
 * `relPath` is cited in a provenance comment on each spliced block (see genPageSource). */
function serializeTree(n: MdNode, relPath: string): string {
  const [type, meta, children] = n
  const childrenSrc = typeof children === "string"
    ? JSON.stringify(children)
    : `[${(children as MdNode[]).map((c) => serializeTree(c, relPath)).join(",")}]`
  return `[${JSON.stringify(type)},${serializeMeta(meta, relPath)},${childrenSrc}]`
}

function serializeMeta(meta: Record<string, any>, relPath: string): string {
  const { __inlineBody, __sourceLine, ...rest } = meta
  const parts = Object.entries(rest).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`)
  if (__inlineBody != null) {
    // Wrapped in try/catch so one bad example doesn't take the whole page's module evaluation down
    // with it (see CodeExample's `renderResult`/`renderError` handling in the spec).
    parts.push(
      `renderResult:/* docs/md/${relPath}:${__sourceLine} */(function(){try{\n${__inlineBody}\n}catch(e){return {__renderError:String(e&&e.stack||e)}}})()`,
    )
  }
  return `{${parts.join(",")}}`
}

/** "../".repeat(n) up to `docs/src/` from a generated file at `docs/src/md/<segments...>.ts`. */
function upsFromMdDir(relPath: string): string {
  return "../".repeat(relPath.replace(/\.md$/, "").split("/").length)
}

function genPageSource(relPath: string, frontmatter: Frontmatter, root: MdNode, inline: InlineExample[]): string {
  const ups = upsFromMdDir(relPath)
  const mergedImports = mergeImportLines(inline.map((e) => e.importLines))

  for (const e of inline) {
    ;(e.node[1] as any).__inlineBody = e.body
    ;(e.node[1] as any).__sourceLine = e.sourceLine
  }

  const importsComment = inline.length > 0
    ? [`// Imports merged from @inline-example blocks at ${inline.map((e) => `docs/md/${relPath}:${e.sourceLine}`).join(", ")}`]
    : []

  return [
    "// GENERATED by docs/src/macro.ts — do not edit by hand (gitignored). See",
    "// specs/markdown-docs-reloaded.md.",
    `// Source: docs/md/${relPath}`,
    'import "elt"',
    `import { Service, view } from "elt"`,
    `import { renderMdPage } from "${ups}e2.tsx"`,
    `import type { MdNode } from "${ups}macro.ts"`,
    ...importsComment,
    ...mergedImports,
    "",
    `// docs/md/${relPath}:1 (frontmatter)`,
    `export const frontmatter = ${JSON.stringify(frontmatter)} as const`,
    "",
    `// docs/md/${relPath} (full document tree)`,
    `const __root: MdNode = ${serializeTree(root, relPath)}`,
    "",
    "export default class extends Service({}, {}) {",
    "  @view",
    "  Content() {",
    "    return renderMdPage(__root)",
    "  }",
    "}",
    "",
  ].join("\n")
}

/**
 * A `@full-example` block's own generated module — a complete, standalone route target (its
 * default export is a real `Service` subclass, exactly like a page's, so it can be used directly
 * as a route's `srv` factory via `() => import(...)`; no shared wrapper Service is needed). Its
 * imports are never merged with the page's or with any other example's (see the spec).
 */
function genFullExampleSource(relPath: string, ex: FullExample): string {
  return [
    "// GENERATED by docs/src/macro.ts — do not edit by hand (gitignored). See",
    "// specs/markdown-docs-reloaded.md.",
    `// Source: docs/md/${relPath}:${ex.sourceLine}`,
    'import "elt"',
    "import { Service, view } from \"elt\"",
    ...ex.importLines,
    "",
    "export default class extends Service({}, {}) {",
    "  @view",
    "  Content() {",
    ex.body,
    "  }",
    "}",
    "",
  ].join("\n")
}

const mdGlob = new Bun.Glob("**/*.md")

/** Recursively lists every "*.md" under `mdDir`, relative to it, in a deterministic (sorted) order. */
async function scanMdFiles(mdDir: string): Promise<string[]> {
  const out: string[] = []
  for await (const relPath of mdGlob.scan(mdDir)) out.push(relPath)
  return out.sort() // deterministic order: md-deps.ts content must be stable across runs with the
  // same file set, or the idempotency check below (File registration in the spec) never converges.
}

/** 1-based line number, in `raw` (the *whole* source file, frontmatter included), of every opening
 * ` ``` ` fence, in document order — used to cite "docs/md/<file>:<line>" in generated output (see
 * the spec, "Generated file provenance"). Bun.markdown.render's node tree carries no position info. */
function computeFenceLines(raw: string): number[] {
  const lines: number[] = []
  let open = false
  const rawLines = raw.split("\n")
  for (let i = 0; i < rawLines.length; i++) {
    if (/^\s*```/.test(rawLines[i]!)) {
      if (!open) lines.push(i + 1)
      open = !open
    }
  }
  return lines
}

async function parseAndGenerate(srcDir: string, relPath: string, raw: string, frontmatter: Frontmatter, body: string): Promise<void> {
  const callbacks: Record<string, (...args: any[]) => string> = {}
  for (const type of NODE_TYPES) {
    callbacks[type] = (children: string, meta?: unknown) => node(type, meta, children)
  }
  callbacks.text = (text: string) => JSON.stringify(["text", {}, text])

  const out = Bun.markdown.render(body, callbacks as any, {
    autolinks: true, wikiLinks: true, underline: true, latexMath: true,
    headings: true, hardSoftBreaks: true,
  })

  // Bun.markdown.render's overall return has no wrapping "document" node — for any file with more
  // than one top-level block, `out` is multiple concatenated sibling JSON values, not one, so it
  // can't be JSON.parse'd directly. Scan it the same way a parent node scans its children.
  const root: MdNode = ["root", {}, splitNodes(out)]

  rewriteLinks(root, relPath)

  const codeNodes: MdNode[] = []
  collectCodeNodes(root, codeNodes)
  const fenceLines = computeFenceLines(raw)
  const { inline, full } = await processCodeNodes(codeNodes, fenceLines)
  const name = nameFor(relPath)
  for (const ex of full) {
    ex.node[1].fullExampleUrl = `#/full-example/${name}/${ex.index}`
    delete ex.node[1].fullExampleIndex
  }

  if (frontmatter.title == null) {
    const heading = findFirstHeading(root)
    if (heading) frontmatter.title = textOf(heading)
  }

  const pageTargetPath = path.resolve(srcDir, "md", `${nameFor(relPath)}.tsx`)
  await Bun.write(pageTargetPath, genPageSource(relPath, frontmatter, root, inline))

  for (const ex of full) {
    const exPath = path.resolve(srcDir, "md", `${nameFor(relPath)}.full-${ex.index}.tsx`)
    await Bun.write(exPath, genFullExampleSource(relPath, ex))
  }
}

/** section=null (ungrouped) first, then sections alphabetically; each group sorted by order, then title. */
function buildMenu(pages: PageEntry[]): MenuGroup[] {
  const groups = new Map<string | null, MenuEntry[]>()
  for (const p of pages) {
    const section = p.frontmatter.section ?? null
    const entry: MenuEntry = {
      name: p.name,
      title: p.frontmatter.title ?? p.name,
      url: p.url,
      order: p.frontmatter.order ?? Number.MAX_SAFE_INTEGER,
    }
    const arr = groups.get(section) ?? []
    arr.push(entry)
    groups.set(section, arr)
  }
  for (const items of groups.values()) {
    items.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  }
  const sections = [...groups.keys()].filter((s): s is string => s != null).sort()
  const out: MenuGroup[] = []
  if (groups.has(null)) out.push({ section: null, items: groups.get(null)! })
  for (const s of sections) out.push({ section: s, items: groups.get(s)! })
  return out
}

/**
 * The route table itself, as generated TEXT (not runtime-built data): Bun's client-side bundler
 * only code-splits a dynamic `import()` when its argument is a static string literal — a loop
 * building `() => import(`./md/${name}.ts`)` from a computed `name` does not resolve at runtime
 * (confirmed by testing: the browser fetches a URL Bun never registered as a chunk, and gets the
 * SPA's HTML fallback back with a "MIME type" error instead of the module). So every page's route
 * gets its own literal `import("./md/<name>.ts")` call, written out by the macro — which is also
 * exactly where a "docs/md/<file>:<line>" provenance comment per block belongs (see the spec,
 * "Generated file provenance").
 */
function genRoutesSource(pages: PageEntry[], menu: MenuGroup[]): string {
  const routeLines: string[] = []
  for (const p of pages) {
    routeLines.push(`  // docs/md/${p.name}.md:1`)
    routeLines.push(`  ${JSON.stringify(p.name)}: ["${p.url}", () => import("./md/${p.name}.tsx")],`)
    for (let n = 0; n < p.fullExampleLines.length; n++) {
      routeLines.push(`  // docs/md/${p.name}.md:${p.fullExampleLines[n]}`)
      routeLines.push(
        `  ${JSON.stringify(`${p.name}__full-${n}`)}: ["/full-example/${p.name}/${n}", () => import("./md/${p.name}.full-${n}.tsx")],`,
      )
    }
  }

  return [
    "// GENERATED by docs/src/macro.ts — do not edit by hand (gitignored). See",
    "// specs/markdown-docs-reloaded.md.",
    'import type { RouteDef } from "elt"',
    'import type { MenuGroup } from "./macro.ts"',
    "",
    "export const routes: RouteDef = {",
    ...routeLines,
    "}",
    "",
    `export const menu: MenuGroup[] = ${JSON.stringify(menu, null, 2)}`,
    "",
  ].join("\n")
}

/**
 * Scans `docs/md/**\/*.md` (resolved against this macro FILE's own directory via `import.meta.dir`
 * — Bun's equivalent of `__dirname` — rather than `process.cwd()`, since a macro always runs at
 * bundle time regardless of what invoked the bundler, so this works the same way no matter which
 * directory `bun` was launched from).
 *
 * For each file, regenerates the corresponding `docs/src/md/<path>.ts` (and any `.full-N.ts` files
 * for its `@full-example` blocks) only if that target is missing or older than the source — the
 * expensive parse/highlight/codegen step. Routes and the menu, by contrast, are cheap (frontmatter
 * + fence line-scanning, not a full parse) and are recomputed — and `docs/src/routes.generated.ts`
 * rewritten — from scratch on every call, so they are never stale even when the underlying page
 * file itself was skipped this run.
 *
 * As a side effect, (over)writes `docs/src/md-deps.ts` with one bare `with { type: "text" }` import
 * per discovered file — the only way to register each of them as a bundler-watched dependency,
 * since a macro's own `Bun.file()` reads do not (see File registration in the spec). That write, and
 * the `routes.generated.ts` write, are both skipped when the generated content already matches
 * what's on disk, which is what stops them from re-triggering themselves (editing either is itself
 * a watched change that would otherwise call `elt_md()` again).
 *
 * Returns the same data it just wrote to `routes.generated.ts`, mainly so tests can assert on it
 * directly — a Bun macro's return value is inlined as a literal at its call site, so in the real
 * (non-test) call from `docs/src/routes.ts` this return value is JSON-serializable data, discarded
 * in favor of the fresh `routes.generated.ts` file being imported separately right after.
 *
 * `roots` is a test-only seam (see macro.test.ts): every real call site invokes `elt_md()` with no
 * arguments, scanning the real `docs/md` next to this file.
 */
export async function elt_md(roots?: { mdDir: string; srcDir: string }): Promise<{ pages: PageEntry[]; menu: MenuGroup[] }> {
  const mdDir = roots?.mdDir ?? path.resolve(import.meta.dir, "..", "md")
  const srcDir = roots?.srcDir ?? path.resolve(import.meta.dir)
  const files = await scanMdFiles(mdDir)

  const depsContent = files.map((f) => `import "../md/${f}" with { type: "text" }\n`).join("")
  const depsPath = path.resolve(srcDir, "md-deps.ts")
  const existingDeps = (await Bun.file(depsPath).exists()) ? await Bun.file(depsPath).text() : null
  if (existingDeps !== depsContent) await Bun.write(depsPath, depsContent)

  const pages: PageEntry[] = []
  // Sequential, not Promise.all: full-example index assignment and target-file writes for a given
  // page must not interleave with another page's.
  for (const relPath of files) {
    const srcPath = path.resolve(mdDir, relPath)
    const raw = await Bun.file(srcPath).text()
    const { frontmatter, body } = splitFrontmatter(raw)
    const name = nameFor(relPath)

    const targetPath = path.resolve(srcDir, "md", `${name}.tsx`)
    const targetFile = Bun.file(targetPath)
    const stale = !(await targetFile.exists()) || targetFile.lastModified < Bun.file(srcPath).lastModified
    if (stale) {
      await parseAndGenerate(srcDir, relPath, raw, frontmatter, body)
    }

    // Cheap fallback for the menu, matching parseAndGenerate's own heading fallback closely enough
    // for a plain-text heading — a full markdown parse isn't run here for a page that isn't being
    // rebuilt this call, so this can't reuse parseAndGenerate's real (inline-formatting-aware) title.
    const menuFrontmatter = frontmatter.title != null
      ? frontmatter
      : { ...frontmatter, title: firstHeadingText(body) ?? name }

    pages.push({ name, url: urlFor(relPath), frontmatter: menuFrontmatter, fullExampleLines: findFullExampleLines(raw) })
  }

  const menu = buildMenu(pages)
  const routesContent = genRoutesSource(pages, menu)
  const routesPath = path.resolve(srcDir, "routes.generated.ts")
  const existingRoutes = (await Bun.file(routesPath).exists()) ? await Bun.file(routesPath).text() : null
  if (existingRoutes !== routesContent) await Bun.write(routesPath, routesContent)

  return { pages, menu }
}
