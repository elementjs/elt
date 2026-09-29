// Build-time markdown -> generated-JSX macro. See specs/markdown-docs-reloaded.md for the design
// rationale (why elt_md() is a macro returning only JSON-serializable data, why per-page output is
// literal generated JSX source rather than a JSON tree interpreted at runtime, and why every page is
// statically imported by the generated router rather than lazily loaded).

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

const { codeToTokens } = await import("shiki")

export type MdNode = [type: string, meta: Record<string, any>, children: MdNode[] | string]

// Frontmatter/MenuEntry/MenuGroup/buildMenu live in ./menu.ts, not here: routes.generated.ts needs
// buildMenu as a real (non-macro) runtime import, and macro.ts has top-level Bun-only code
// (`new Bun.Glob(...)`, below) that a plain `import ... from "./macro.ts"` would otherwise drag into
// the client bundle — confirmed by testing (a live page load threw "Bun is not defined" before this
// split). Re-exported here so macro.ts's own call sites don't need two import lines.
export { buildMenu, type Frontmatter, type MenuEntry, type MenuGroup } from "./menu.ts"
import type { Frontmatter } from "./menu.ts"

/** One discovered page, as returned by the macro (JSON-serializable only — see elt_md). Frontmatter
 * is deliberately NOT included: the menu reads it live off each page's own statically-imported
 * module (see "Menu" in the spec), so the macro no longer needs to gather or cache it separately. */
export type PageEntry = {
  /** Route key / generated-file path (no ".tsx"), e.g. "using-elt" or "guide/intro". */
  name: string
  /** URL path this page is served at, e.g. "/" or "/using-elt" or "/guide/intro". */
  url: string
  /** Valid-JS-identifier alias for this page's static import in routes.generated.ts. */
  moduleAlias: string
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

/** Valid-JS-identifier module alias for a route name's static import, e.g. "guide/intro" ->
 * "md_guide_intro". Collisions (two names sanitizing to the same alias) get a numeric suffix. */
function moduleAliasFor(name: string, taken: Set<string>): string {
  const base = `md_${name.replace(/[^A-Za-z0-9_$]/g, "_")}`
  let alias = base
  let n = 2
  while (taken.has(alias)) alias = `${base}_${n++}`
  taken.add(alias)
  return alias
}

/** Same shape as moduleAliasFor, `_text` suffixed and tracked in its own taken-set — used for the
 * named `with { type: "text" }` imports spliced into docs/src/routes.ts (see genRoutesTextImportsBlock). */
function textImportAliasFor(name: string, taken: Set<string>): string {
  const base = `md_${name.replace(/[^A-Za-z0-9_$]/g, "_")}_text`
  let alias = base
  let n = 2
  while (taken.has(alias)) alias = `${base}_${n++}`
  taken.add(alias)
  return alias
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
  const importLines = lines.filter((l) => /^import\s+.*\bfrom\s*["'][^"']+["'];?\s*$/.test(l.trim()) || /^import\s*["'][^"']+["'];?\s*$/.test(l.trim()))
  const body = lines.filter((l) => !importLines.includes(l)).join("\n")
  return { importLines, body }
}

// ---------------------------------------------------------------------------
// Import-clause parsing & merging (see "Import merging" in the spec).
//
// Only these five single-line forms are recognized. Anything else — multi-line statements,
// `import type`, `import Foo, * as ns from "mod"`, dynamic `import(...)` — throws a build-time
// error citing the offending docs/md/<file>:<line>, rather than being silently mishandled.
// ---------------------------------------------------------------------------

type ImportBinding = { imported: string; local: string }
type ParsedImportLine =
  | { kind: "side-effect"; module: string }
  | { kind: "default"; module: string; local: string }
  | { kind: "namespace"; module: string; local: string }
  | { kind: "named"; module: string; names: ImportBinding[] }
  | { kind: "default+named"; module: string; local: string; names: ImportBinding[] }

const RE_SIDE_EFFECT = /^import\s*["']([^"']+)["'];?$/
const RE_NAMESPACE = /^import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from\s*["']([^"']+)["'];?$/
const RE_DEFAULT_NAMED = /^import\s+([A-Za-z_$][\w$]*)\s*,\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?$/
const RE_NAMED = /^import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?$/
const RE_DEFAULT = /^import\s+([A-Za-z_$][\w$]*)\s+from\s*["']([^"']+)["'];?$/

function parseNamedList(raw: string): ImportBinding[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = s.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/)
    if (m) return { imported: m[1]!, local: m[2]! }
    return { imported: s, local: s }
  })
}

export class ImportParseError extends Error {}

/** Parses one `@inline-example` import line into a structured form, or throws `ImportParseError`
 * citing `loc` (a "docs/md/<file>:<line>" string) when the line isn't one of the five recognized
 * forms — see the spec's "Import merging" for exactly which forms are supported and why. */
export function parseImportLine(line: string, loc: string): ParsedImportLine {
  const trimmed = line.trim()
  let m = trimmed.match(RE_DEFAULT_NAMED)
  if (m) return { kind: "default+named", local: m[1]!, names: parseNamedList(m[2]!), module: m[3]! }
  m = trimmed.match(RE_NAMESPACE)
  if (m) return { kind: "namespace", local: m[1]!, module: m[2]! }
  m = trimmed.match(RE_NAMED)
  if (m) return { kind: "named", names: parseNamedList(m[1]!), module: m[2]! }
  m = trimmed.match(RE_DEFAULT)
  if (m) return { kind: "default", local: m[1]!, module: m[2]! }
  m = trimmed.match(RE_SIDE_EFFECT)
  if (m) return { kind: "side-effect", module: m[1]! }
  throw new ImportParseError(
    `Unsupported import form at ${loc}: "${trimmed}". @inline-example imports must be a single-line `
    + `import "mod" / import Foo from "mod" / import * as ns from "mod" / import { a, b as c } from "mod" `
    + `/ import Foo, { a, b as c } from "mod" — no multi-line statements, "import type", or dynamic import().`,
  )
}

type ModuleBucket = {
  sideEffectOnly: boolean
  defaults: Map<string, string> // local name -> loc it was first seen at
  namespaces: Map<string, string>
  named: Map<string, { imported: string; loc: string }> // local name -> binding
}

type BindingRecord = { module: string; kind: "default" | "namespace" | "named"; imported?: string; loc: string }

/** Merges `@inline-example` import lines from every block on a page into the minimal correct set of
 * import statements: named imports from the same module merge into one `{ a, b, c }` clause by
 * `(imported, local)` pair (see the spec) instead of two statements that would both declare the same
 * local binding; a genuine local-name conflict (the same local name bound to something different
 * across two examples) throws `ImportParseError` citing both locations. */
export function mergeImports(groups: { importLines: string[]; loc: string }[]): string[] {
  const registry = new Map<string, BindingRecord>()
  const modules = new Map<string, ModuleBucket>()

  const bucketFor = (mod: string): ModuleBucket => {
    let b = modules.get(mod)
    if (!b) { b = { sideEffectOnly: false, defaults: new Map(), namespaces: new Map(), named: new Map() }; modules.set(mod, b) }
    return b
  }

  const claim = (local: string, rec: BindingRecord) => {
    const existing = registry.get(local)
    if (existing) {
      const same = existing.module === rec.module && existing.kind === rec.kind && existing.imported === rec.imported
      if (!same) {
        throw new ImportParseError(
          `Import conflict: local name "${local}" is bound differently at ${existing.loc} and ${rec.loc} `
          + `— use distinct aliases for these two examples on this page.`,
        )
      }
      return
    }
    registry.set(local, rec)
  }

  for (const group of groups) {
    for (const rawLine of group.importLines) {
      const parsed = parseImportLine(rawLine, group.loc)
      const bucket = bucketFor(parsed.module)
      if (parsed.kind === "side-effect") { bucket.sideEffectOnly = true; continue }
      if (parsed.kind === "namespace") {
        claim(parsed.local, { module: parsed.module, kind: "namespace", loc: group.loc })
        bucket.namespaces.set(parsed.local, group.loc)
        continue
      }
      if (parsed.kind === "default" || parsed.kind === "default+named") {
        claim(parsed.local, { module: parsed.module, kind: "default", loc: group.loc })
        bucket.defaults.set(parsed.local, group.loc)
      }
      const names = parsed.kind === "named" || parsed.kind === "default+named" ? parsed.names : []
      for (const { imported, local } of names) {
        claim(local, { module: parsed.module, kind: "named", imported, loc: group.loc })
        bucket.named.set(local, { imported, loc: group.loc })
      }
    }
  }

  const out: string[] = []
  for (const [mod, bucket] of modules) {
    const q = JSON.stringify(mod)
    if (bucket.sideEffectOnly && bucket.defaults.size === 0 && bucket.namespaces.size === 0 && bucket.named.size === 0) {
      out.push(`import ${q}`)
    }
    for (const local of bucket.namespaces.keys()) out.push(`import * as ${local} from ${q}`)
    const namedClause = [...bucket.named].map(([local, { imported }]) => (imported === local ? local : `${imported} as ${local}`))
    const defaultLocals = [...bucket.defaults.keys()]
    if (defaultLocals.length === 0) {
      if (namedClause.length > 0) out.push(`import { ${namedClause.join(", ")} } from ${q}`)
    } else {
      out.push(`import ${defaultLocals[0]}${namedClause.length > 0 ? `, { ${namedClause.join(", ")} }` : ""} from ${q}`)
      for (const extra of defaultLocals.slice(1)) out.push(`import ${extra} from ${q}`)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Markdown -> literal JSX source compilation (see "Generated pages" in the spec — no e2.tsx runtime
// interpreter, no MdNode-as-JSON-in-the-output; every construct becomes real JSX text at build time).
// ---------------------------------------------------------------------------

/** A JSON.stringify'd string is always a valid, safely-escaped JS string literal — used for every
 * piece of markdown prose text spliced into generated JSX, so stray `{`, `}`, `<`, `>`, backslashes
 * or quotes in an author's prose can never be misparsed as JSX/JS syntax (see the spec). */
function jsxText(s: string): string {
  return `{${JSON.stringify(s)}}`
}

function jsxAttr(name: string, value: unknown): string {
  if (value == null) return ""
  return ` ${name}={${JSON.stringify(value)}}`
}

const TAG_MAP: Record<string, string> = {
  blockquote: "blockquote", table: "table", thead: "thead", tbody: "tbody",
  tr: "tr", th: "th", td: "td", strong: "strong", emphasis: "em",
  strikethrough: "s", codespan: "code",
}

function childrenJsx(n: MdNode, relPath: string): string {
  const c = n[2]
  if (!Array.isArray(c)) return ""
  return c.map((child) => nodeToJsx(child, relPath)).join("")
}

/** Compiles one MdNode into literal JSX source text, recursively — the sole replacement for
 * e2.tsx's runtime tree-walker. `"html"` nodes (literal HTML in the markdown source) are spliced
 * verbatim as real JSX: if that HTML isn't valid JSX, the generated file fails to build — see the
 * spec's "Why" on raw HTML, this is deliberate, not a bug. `relPath` is only actually used by
 * `"code"` nodes (provenance comments — see `codeNodeToJsx`), threaded through everywhere else
 * purely to keep this one recursive walker instead of a second copy of it. */
function nodeToJsx(n: MdNode, relPath: string): string {
  const [type, meta] = n
  switch (type) {
    case "root": return childrenJsx(n, relPath)
    case "heading": return `<h${meta.level}${jsxAttr("id", meta.id)}>${childrenJsx(n, relPath)}</h${meta.level}>`
    case "paragraph": return `<p>${childrenJsx(n, relPath)}</p>`
    case "list": return `<${meta.ordered ? "ol" : "ul"}>${childrenJsx(n, relPath)}</${meta.ordered ? "ol" : "ul"}>`
    case "listItem": return `<li>${childrenJsx(n, relPath)}</li>`
    case "hr": return "<hr/>"
    case "link": return `<a${jsxAttr("href", meta.href)}${jsxAttr("title", meta.title)}>${childrenJsx(n, relPath)}</a>`
    case "image": return `<img${jsxAttr("src", meta.src)}${jsxAttr("alt", meta.alt)}/>`
    // node() always wraps children as an array (only "text" callbacks get a raw string — see
    // splitNodes/node above), so an "html" node's own n[2] is never a string in practice; textOf
    // recovers the literal raw HTML text from its "text" descendants, spliced verbatim (unescaped —
    // see the spec's "Why" on raw HTML: this is deliberate, not a bug).
    case "html": return textOf(n)
    case "text": return jsxText(typeof n[2] === "string" ? n[2] : "")
    case "code": return codeNodeToJsx(n, relPath)
    default: {
      const tag = TAG_MAP[type]
      if (tag) return `<${tag}>${childrenJsx(n, relPath)}</${tag}>`
      return ""
    }
  }
}

type ShikiToken = { content: string; color?: string }

/** Compiles Shiki's structured token output (not its HTML-string output — see the spec's "Why" on
 * avoiding `.innerHTML`) into a literal JSX array-of-lines: each line a `<>`-fragment of colored
 * `<span>`s (or plain text for uncolored runs), lines separated by literal `"\n"` text children so
 * they render as separate lines inside a `<pre>`. Colors go through `tokenColorClass` (a shared,
 * memoized CSS class per distinct color) rather than a per-span inline `style` — see its doc comment
 * in code-example.tsx for why. */
function tokensToJsx(lines: ShikiToken[][]): string {
  const lineFrags = lines.map((line) => {
    const spans = line.map((t) => (t.color ? `<span class={tokenColorClass(${JSON.stringify(t.color)})}>${jsxText(t.content)}</span>` : jsxText(t.content))).join("")
    return `<>${spans}</>`
  })
  return `[${lineFrags.join(',"\\n",')}]`
}

type InlineExample = { node: MdNode; body: string; importLines: string[]; sourceLine: number }
type FullExample = { node: MdNode; index: number; importLines: string[]; body: string; sourceLine: number }

/**
 * Highlights every code node (all languages, via Shiki's token API) and classifies ts/tsx ones per
 * the spec's three fence kinds. Mutates `codeNodes` in place (stores `tokens` on each node's meta,
 * consumed later by `codeNodeToJsx`) and returns the inline/full examples collected for codegen.
 * `fenceLines[i]` is the source line of `codeNodes[i]`'s opening fence (see computeFenceLines).
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
    const { tokens } = await codeToTokens(displayText, { lang: lang || "text", theme: "github-dark" })
    n[1] = { ...n[1], tokens }
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

/** Cheap, parse-free line numbers of every `@full-example` fence's opening ` ``` ` — used to size
 * and comment the routes generated on every macro call, even for pages whose generated .tsx file is
 * up to date and not being re-parsed (see computeFenceLines for why a full parse isn't needed). */
function findFullExampleLines(raw: string): number[] {
  const lines = raw.split("\n")
  const out: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i]!) && lines[i + 1]?.trim() === "//@full-example") out.push(i + 1)
  }
  return out
}

/** "../".repeat(n) up to `docs/src/` from a generated file at `docs/src/md/<segments...>.tsx`. */
function upsFromMdDir(relPath: string): string {
  return "../".repeat(relPath.replace(/\.md$/, "").split("/").length)
}

/** Compiles a `"code"` MdNode into a literal `<CodeExample .../>` call at its exact position in the
 * generated JSX (see "Code fences" in the spec). `@inline-example` bodies run inside
 * `runExample(() => {...})`, spread onto the props — this replaces the old JSON-tree
 * `renderResult`/`__renderError` dance, and re-runs the example on every `Content()` call rather
 * than once at module-load time, which is the correct/expected behavior for a rendered component. */
function codeNodeToJsx(n: MdNode, relPath: string): string {
  const meta = n[1]
  const highlighted = tokensToJsx(meta.tokens ?? [])
  const props: string[] = [` highlighted={() => (${highlighted})}`]
  if (meta.fullExampleUrl != null) {
    props.push(jsxAttr("fullExampleUrl", meta.fullExampleUrl))
    return `<CodeExample${props.join("")} />`
  }
  if (meta.__inlineBody != null) {
    return `<CodeExample${props.join("")} {...runExample(() => {\n/* docs/md/${relPath}:${meta.__sourceLine} */\n${meta.__inlineBody}\n})} />`
  }
  return `<CodeExample${props.join("")} />`
}

function genPageSource(relPath: string, frontmatter: Frontmatter, root: MdNode, inline: InlineExample[], hasCode: boolean): string {
  const ups = upsFromMdDir(relPath)
  const mergedImports = mergeImports(inline.map((e) => ({ importLines: e.importLines, loc: `docs/md/${relPath}:${e.sourceLine}` })))

  for (const e of inline) {
    ;(e.node[1] as any).__inlineBody = e.body
    ;(e.node[1] as any).__sourceLine = e.sourceLine
  }

  // Compile the whole tree to JSX now (mutations above — __inlineBody/__sourceLine — must land first,
  // since codeNodeToJsx, reached via nodeToJsx's "code" case, reads them).
  const bodyJsx = nodeToJsx(root, relPath)

  const importsComment = inline.length > 0
    ? [`// Imports merged from @inline-example blocks at ${inline.map((e) => `docs/md/${relPath}:${e.sourceLine}`).join(", ")}`]
    : []

  // CodeExample/runExample/tokenColorClass are only imported when this page actually has a code
  // fence / an @inline-example — an unconditional import left an unused binding on pages with
  // neither (caught by noUnusedLocals, which docs/tsconfig.json now matches the root tsconfig on).
  const codeExampleImport = hasCode
    ? [`import { CodeExample, tokenColorClass${inline.length > 0 ? ", runExample" : ""} } from "${ups}code-example.tsx"`]
    : []

  return [
    "// GENERATED by docs/src/macro.ts — do not edit by hand (gitignored). See",
    "// specs/markdown-docs-reloaded.md.",
    `// Source: docs/md/${relPath}`,
    'import "elt"',
    `import { Service, view } from "elt"`,
    ...codeExampleImport,
    ...importsComment,
    ...mergedImports,
    "",
    `// docs/md/${relPath}:1 (frontmatter)`,
    `export const frontmatter = ${JSON.stringify(frontmatter)} as const`,
    "",
    "export class PageService extends Service({}, {}) {",
    "  @view",
    "  Content() {",
    `    return <e-prose pad>${bodyJsx}</e-prose>`,
    "  }",
    "}",
    "",
  ].join("\n")
}

/**
 * A `@full-example` block's own generated module — a complete, standalone route target (its
 * default export is a real `Service` subclass; unlike a page, it's still lazily dynamic-imported —
 * see "Routing"/"@full-example fences" in the spec — so a default export, not a named one, is fine
 * here). Its imports are never merged with the page's or with any other example's.
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

// ---------------------------------------------------------------------------
// docs/src/routes.ts's generated import block (see "Macro" in the spec — why this must be a NAMED,
// referenced import living directly in routes.ts, not a bare side-effect import one file removed).
// ---------------------------------------------------------------------------

export const ROUTES_GENERATED_BEGIN_MARKER =
  '// GENERATED-BEGIN (docs/src/macro.ts) — do not hand-edit until GENERATED-END; see specs/markdown-docs-reloaded.md "Macro".'
export const ROUTES_GENERATED_END_MARKER = "// GENERATED-END"

/** One named, referenced `with { type: "text" }` import per discovered `.md` file, between the
 * markers above. Named + referenced (the trailing `void [...]`) is required, not cosmetic: it's
 * what makes Bun invalidate the `{ type: "macro" }` call's cached result when a `.md` file's
 * content changes (see the spec) — dead-code-eliminated entirely from a real production build. */
function genRoutesTextImportsBlock(files: string[]): string {
  const taken = new Set<string>()
  const importLines: string[] = []
  const aliases: string[] = []
  for (const f of files) {
    const alias = textImportAliasFor(nameFor(f), taken)
    aliases.push(alias)
    importLines.push(`import ${alias} from "../md/${f}" with { type: "text" }`)
  }
  return [
    ROUTES_GENERATED_BEGIN_MARKER,
    ...importLines,
    `void [${aliases.join(", ")}]`,
    ROUTES_GENERATED_END_MARKER,
  ].join("\n")
}

/** Splices a freshly generated import block into `routesSource`'s existing GENERATED-BEGIN/END
 * region, leaving everything else in the (hand-written, tracked) file untouched. Throws if the
 * markers are missing — `docs/src/routes.ts` must always carry them (see the spec). */
function spliceGeneratedBlock(routesSource: string, block: string): string {
  const beginIdx = routesSource.indexOf(ROUTES_GENERATED_BEGIN_MARKER)
  const endIdx = routesSource.indexOf(ROUTES_GENERATED_END_MARKER)
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(
      "docs/src/routes.ts is missing the GENERATED-BEGIN/GENERATED-END markers required by elt_md() "
      + "— see specs/markdown-docs-reloaded.md, \"Macro\".",
    )
  }
  const afterEndLineStart = routesSource.indexOf("\n", endIdx)
  const after = afterEndLineStart === -1 ? "" : routesSource.slice(afterEndLineStart + 1)
  return routesSource.slice(0, beginIdx) + block + "\n" + after
}

const mdGlob = new Bun.Glob("**/*.md")

/** Recursively lists every "*.md" under `mdDir`, relative to it, in a deterministic (sorted) order. */
async function scanMdFiles(mdDir: string): Promise<string[]> {
  const out: string[] = []
  for await (const relPath of mdGlob.scan(mdDir)) out.push(relPath)
  return out.sort() // deterministic order: routes.ts's generated block / routes.generated.ts content
  // must be stable across runs with the same file set, or the idempotency write-skip (see elt_md)
  // never converges.
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
  await Bun.write(pageTargetPath, genPageSource(relPath, frontmatter, root, inline, codeNodes.length > 0))

  for (const ex of full) {
    const exPath = path.resolve(srcDir, "md", `${nameFor(relPath)}.full-${ex.index}.tsx`)
    await Bun.write(exPath, genFullExampleSource(relPath, ex))
  }
}

/**
 * The route table and menu, as generated TEXT: every page is a literal, static
 * `import * as <alias> from "./md/<name>.tsx"` (see "Routing" in the spec — Bun's client-side
 * bundler only code-splits a *dynamic* `import()` with a static string literal argument, but a
 * static top-level `import` isn't trying to code-split at all; it's simply eager, which is the
 * accepted trade-off here). `@full-example` routes are the one case that keeps a lazy, dynamic
 * `() => import("./md/<name>.full-<n>.tsx")`, since nothing needs them until visited.
 */
function genRoutesSource(pages: PageEntry[]): string {
  const importLines: string[] = []
  const routeLines: string[] = []
  const menuEntryLines: string[] = []

  for (const p of pages) {
    importLines.push(`import * as ${p.moduleAlias} from "./md/${p.name}.tsx"`)
    routeLines.push(`  // docs/md/${p.name}.md:1`)
    routeLines.push(`  ${JSON.stringify(p.name)}: ["${p.url}", () => ${p.moduleAlias}.PageService],`)
    menuEntryLines.push(`  { name: ${JSON.stringify(p.name)}, url: ${JSON.stringify(p.url)}, frontmatter: ${p.moduleAlias}.frontmatter },`)
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
    'import { buildMenu } from "./menu.ts"',
    ...importLines,
    "",
    "export const routes: RouteDef = {",
    ...routeLines,
    "}",
    "",
    "export const menu = buildMenu([",
    ...menuEntryLines,
    "])",
    "",
  ].join("\n")
}

/**
 * Scans `docs/md/**\/*.md` (resolved against this macro FILE's own directory via `import.meta.dir`
 * — Bun's equivalent of `__dirname` — rather than `process.cwd()`, since a macro always runs at
 * bundle time regardless of what invoked the bundler, so this works the same way no matter which
 * directory `bun` was launched from).
 *
 * For each file, regenerates the corresponding `docs/src/md/<path>.tsx` (and any `.full-N.tsx` files
 * for its `@full-example` blocks) only if that target is missing or older than the source — the
 * expensive parse/highlight/codegen step. `docs/src/routes.generated.ts`, by contrast, is cheap
 * (no full parse — just names and a line-numbered scan for `@full-example` fences) and is
 * recomputed — and rewritten — from scratch on every call. It no longer needs to track frontmatter
 * at all: since every page is now a static import, the menu just reads `<alias>.frontmatter` live
 * off each already-imported module at that generated file's own module-eval time, so a
 * frontmatter-only edit is picked up automatically the moment the page's own `.tsx` file is
 * regenerated — no separate "does the router need to change" staleness tracking is needed for it.
 *
 * As a side effect, (over)writes the GENERATED-BEGIN/END block inside `docs/src/routes.ts` itself
 * — the file that calls this macro — with one named, referenced `with { type: "text" }` import per
 * discovered file (see genRoutesTextImportsBlock). This is the only way that's been empirically
 * confirmed to make Bun re-run this `{ type: "macro" }` call when only a `.md` file's *content*
 * changes: a bare side-effect-only import one file removed does not invalidate the macro's cached
 * result, even though it does still trigger a reload (see "Macro" in the spec). That write, and the
 * `routes.generated.ts` write below, are both skipped when the generated content already matches
 * what's on disk, which is what stops them from re-triggering themselves (editing either is itself
 * a watched change that would otherwise call `elt_md()` again).
 *
 * Returns the same page list it just wrote into `routes.generated.ts`, mainly so tests can assert
 * on it directly — a Bun macro's return value is inlined as a literal at its call site, so in the
 * real (non-test) call from `docs/src/routes.ts` this return value is JSON-serializable data,
 * discarded in favor of the fresh `routes.generated.ts` file being imported separately right after.
 *
 * `roots` is a test-only seam (see macro.test.ts): every real call site invokes `elt_md()` with no
 * arguments, scanning the real `docs/md` next to this file.
 */
export async function elt_md(roots?: { mdDir: string; srcDir: string }): Promise<{ pages: PageEntry[] }> {
  const mdDir = roots?.mdDir ?? path.resolve(import.meta.dir, "..", "md")
  const srcDir = roots?.srcDir ?? path.resolve(import.meta.dir)
  const files = await scanMdFiles(mdDir)

  const routesTsPath = path.resolve(srcDir, "routes.ts")
  const existingRoutesTs = await Bun.file(routesTsPath).text()
  const newRoutesTs = spliceGeneratedBlock(existingRoutesTs, genRoutesTextImportsBlock(files))
  if (newRoutesTs !== existingRoutesTs) await Bun.write(routesTsPath, newRoutesTs)

  const pages: PageEntry[] = []
  const takenAliases = new Set<string>()
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

    pages.push({
      name, url: urlFor(relPath), moduleAlias: moduleAliasFor(name, takenAliases),
      fullExampleLines: findFullExampleLines(raw),
    })
  }

  const routesContent = genRoutesSource(pages)
  const routesPath = path.resolve(srcDir, "routes.generated.ts")
  const existingRoutes = (await Bun.file(routesPath).exists()) ? await Bun.file(routesPath).text() : null
  if (existingRoutes !== routesContent) await Bun.write(routesPath, routesContent)

  return { pages }
}
