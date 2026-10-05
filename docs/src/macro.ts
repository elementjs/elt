// Build-time markdown -> generated-JSX macro. "The spec" in comments below (and in menu.ts,
// routes.ts, app.tsx) is specs/markdown-docs-reloaded.md, deleted once implemented; read it with
// `git show 0153257^:specs/markdown-docs-reloaded.md`. It holds the design rationale (why elt_md() is a macro returning only JSON-serializable data, why per-page output is
// literal generated JSX source rather than a JSON tree interpreted at runtime, and why every page is
// statically imported by the generated router rather than lazily loaded).

import { exists, unlink } from "node:fs/promises"
// `resolve` for file-system paths; `posix` for the "/"-separated paths of docs/md and docs/src/md,
// which are also URLs and import specifiers, so they must not take the host's separator.
import { posix, resolve } from "node:path"
// Frontmatter/MenuEntry/MenuGroup/buildMenu live in ./menu.ts, not here: routes.generated.ts needs
// buildMenu as a real (non-macro) runtime import, and macro.ts has top-level Bun-only code
// (`new Bun.Glob(...)`, below) that a plain `import ... from "./macro.ts"` would otherwise drag into
// the client bundle — confirmed by testing (a live page load threw "Bun is not defined" before this split).
import type { Frontmatter } from "./menu.ts"

// Types only (erased at build time); Shiki itself is loaded by the dynamic import below.
import type { BundledLanguage, SpecialLanguage } from "shiki"

const { codeToTokens, codeToTokensWithThemes } = await import("shiki")

/** The Shiki theme of each page scheme: code colors follow the page's light/dark scheme (see
 * tokenColorClass in code-example.tsx, which picks one of the two with CSS `light-dark()`). */
const CODE_THEMES = { light: "github-light", dark: "github-dark" } as const

/** Each theme's default text color, upper-cased like token colors. A token drawn in the default
 * color of both themes gets no color of its own: it inherits the page's text color, which is
 * readable on the page's code background in either scheme, and it costs no class call in the
 * generated page (about half the tokens of a typical block are plain identifiers and punctuation). */
const CODE_DEFAULT_FG = {
  light: (await codeToTokens("", { lang: "text", theme: CODE_THEMES.light })).fg?.toUpperCase(),
  dark: (await codeToTokens("", { lang: "text", theme: CODE_THEMES.dark })).fg?.toUpperCase(),
}

export type MdNode = [type: string, meta: Record<string, any>, children: MdNode[] | string]

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
  "heading",
  "paragraph",
  "blockquote",
  "code",
  "list",
  "listItem",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "html",
  "strong",
  "emphasis",
  "link",
  "image",
  "codespan",
  "strikethrough",
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
            if (depth === 0) {
              i++
              break
            }
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

function node(type: string, meta: unknown, childrenRaw: string): string {
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

/** Valid-JS-identifier alias for a route name's import, e.g. "guide/intro" -> "md_guide_intro", or
 * "md_guide_intro_text" with `suffix` "_text". Collisions within `taken` (two names sanitizing to the
 * same alias) get a numeric suffix; each kind of import keeps its own `taken` set. */
function aliasFor(name: string, taken: Set<string>, suffix = ""): string {
  const base = `md_${name.replace(/[^A-Za-z0-9_$]/g, "_")}${suffix}`
  let alias = base
  let n = 2
  while (taken.has(alias)) alias = `${base}_${n++}`
  taken.add(alias)
  return alias
}

/**
 * Relative `.md` links (`./x.md`, `../dir/x.md`) become internal routes (the docs router runs in path mode) matching the new
 * per-file route scheme (see Routing in the spec). `fromPath` is this document's own path relative
 * to `docs/md/`, used to resolve the link's relative path into that same scheme.
 */
export function resolveMdLink(href: string, fromPath: string): string | null {
  if (!/^\.\.?\//.test(href)) return null
  // `?query` / `#hash` are carried over to the route unchanged.
  const cut = href.search(/[?#]/)
  const file = cut === -1 ? href : href.slice(0, cut)
  if (!file.endsWith(".md")) return null
  return `${urlFor(posix.join(posix.dirname(fromPath), file))}${cut === -1 ? "" : href.slice(cut)}`
}

/** `[[target]]` or `[[target|label]]`, where target is `page`, `page#heading` or `#heading`. */
const RE_WIKI_LINK = /\[\[([^\]|]+)\|?([^\]]*)\]\]/g

/** A wiki link's target resolved like the relative link `./page.md#heading` (so relative to the
 * current file's directory); `#heading` alone stays an in-page anchor. */
function wikiHref(target: string, fromPath: string): string {
  const hashAt = target.indexOf("#")
  const page = (hashAt === -1 ? target : target.slice(0, hashAt)).replace(/\.md$/, "")
  const hash = hashAt === -1 ? "" : target.slice(hashAt)
  return page === "" ? hash : (resolveMdLink(`./${page}.md${hash}`, fromPath) ?? target)
}

/**
 * Turns `[[...]]` in prose into link nodes. Bun's parser can't do it for us: with its `wikiLinks`
 * option, `render()` callbacks only get the label, never the target (see the tests). So the option
 * stays off, `[[page]]` arrives as plain text, and is rewritten here. Bun splits that text at each
 * `[`, so adjacent text nodes are merged first. A label must be plain text: `[[page|**bold**]]` spans
 * several nodes and stays literal.
 */
function expandWikiLinks(children: MdNode[], fromPath: string): MdNode[] {
  const merged: MdNode[] = []
  for (const child of children) {
    const prev = merged[merged.length - 1]
    if (child[0] === "text" && prev?.[0] === "text") prev[2] = `${prev[2]}${child[2]}`
    else merged.push(child[0] === "text" ? ["text", {}, child[2]] : child)
  }
  return merged.flatMap((child): MdNode[] => {
    if (child[0] !== "text" || typeof child[2] !== "string" || !child[2].includes("[[")) return [child]
    const text = child[2]
    const out: MdNode[] = []
    let last = 0
    for (const m of text.matchAll(RE_WIKI_LINK)) {
      const [whole, target = "", label] = m
      if (m.index > last) out.push(["text", {}, text.slice(last, m.index)])
      out.push(["link", { href: wikiHref(target, fromPath) }, [["text", {}, label || target]]])
      last = m.index + whole.length
    }
    if (last < text.length) out.push(["text", {}, text.slice(last)])
    return out
  })
}

/** Rewrites relative `.md` links and wiki links into routes, everywhere but in code and raw HTML. */
function rewriteLinks(n: MdNode, fromPath: string): void {
  const [type, meta, children] = n
  if (!Array.isArray(children) || type === "code" || type === "codespan" || type === "html") return
  if (type === "link") {
    const rewritten = typeof meta?.href === "string" ? resolveMdLink(meta.href, fromPath) : null
    if (rewritten) n[1] = { ...meta, href: rewritten }
  } else {
    n[2] = expandWikiLinks(children, fromPath)
  }
  for (const child of n[2] as MdNode[]) rewriteLinks(child, fromPath)
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

/** An `import` statement on one line, starting at column 0: an indented `import` line sits inside
 * something else (a string, a template literal) and is left in the body. */
const RE_IMPORT_LINE = /^import(?:\s+.*\bfrom\s*|\s*)["'][^"']+["'];?\s*$/

/** Splits a snippet into its top-level `import ...` lines (verbatim) and the remaining body. */
function extractImports(code: string): { importLines: string[]; body: string } {
  const importLines: string[] = []
  const bodyLines: string[] = []
  for (const line of code.split("\n")) (RE_IMPORT_LINE.test(line) ? importLines : bodyLines).push(line)
  return { importLines, body: bodyLines.join("\n") }
}

// ---------------------------------------------------------------------------
// Import-clause parsing & merging (see "Import merging" in the spec).
//
// Only these five single-line forms are recognized. Anything else — multi-line statements,
// `import type`, `import Foo, * as ns from "mod"`, dynamic `import(...)` — throws a build-time
// error citing the offending docs/md/<file>:<line>, rather than being silently mishandled.
// ---------------------------------------------------------------------------

// `type_only`: written `{ type X }` — erased at compile time, so it must stay marked as such when merged.
type ImportBinding = { imported: string; local: string; type_only: boolean }
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
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const t = s.match(/^type\s+(.*)$/)
      const type_only = t != null
      if (t) s = t[1]!
      const m = s.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/)
      if (m) return { imported: m[1]!, local: m[2]!, type_only }
      return { imported: s, local: s, type_only }
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
    `Unsupported import form at ${loc}: "${trimmed}". @inline-example imports must be a single-line ` +
      `import "mod" / import Foo from "mod" / import * as ns from "mod" / import { a, b as c } from "mod" ` +
      `/ import Foo, { a, b as c } from "mod" — no multi-line statements, "import type", or dynamic import().`,
  )
}

type ModuleBucket = {
  sideEffectOnly: boolean
  defaults: Map<string, string> // local name -> loc it was first seen at
  namespaces: Map<string, string>
  named: Map<string, { imported: string; type_only: boolean; loc: string }> // local name -> binding
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
    if (!b) {
      b = { sideEffectOnly: false, defaults: new Map(), namespaces: new Map(), named: new Map() }
      modules.set(mod, b)
    }
    return b
  }

  const claim = (local: string, rec: BindingRecord) => {
    const existing = registry.get(local)
    if (existing) {
      const same = existing.module === rec.module && existing.kind === rec.kind && existing.imported === rec.imported
      if (!same) {
        throw new ImportParseError(
          `Import conflict: local name "${local}" is bound differently at ${existing.loc} and ${rec.loc} ` +
            `— use distinct aliases for these two examples on this page.`,
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
      if (parsed.kind === "side-effect") {
        bucket.sideEffectOnly = true
        continue
      }
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
      for (const { imported, local, type_only } of names) {
        claim(local, { module: parsed.module, kind: "named", imported, loc: group.loc })
        // `{ type X }` and `{ X }` of the same binding merge into one : type-only only if every occurrence is
        const prev = bucket.named.get(local)
        bucket.named.set(local, {
          imported,
          type_only: type_only && (prev?.type_only ?? true),
          loc: prev?.loc ?? group.loc,
        })
      }
    }
  }

  const out: string[] = []
  for (const [mod, bucket] of modules) {
    const q = JSON.stringify(mod)
    if (
      bucket.sideEffectOnly &&
      bucket.defaults.size === 0 &&
      bucket.namespaces.size === 0 &&
      bucket.named.size === 0
    ) {
      out.push(`import ${q}`)
    }
    for (const local of bucket.namespaces.keys()) out.push(`import * as ${local} from ${q}`)
    const namedClause = [...bucket.named].map(
      ([local, { imported, type_only }]) =>
        `${type_only ? "type " : ""}${imported === local ? local : `${imported} as ${local}`}`,
    )
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
  blockquote: "blockquote",
  table: "table",
  thead: "thead",
  tbody: "tbody",
  tr: "tr",
  th: "th",
  td: "td",
  strong: "strong",
  emphasis: "em",
  strikethrough: "s",
  codespan: "code",
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
    case "root":
      return childrenJsx(n, relPath)
    case "heading":
      return `<h${meta.level}${jsxAttr("id", meta.id)}>${childrenJsx(n, relPath)}</h${meta.level}>`
    case "paragraph":
      return `<p>${childrenJsx(n, relPath)}</p>`
    case "list":
      return `<${meta.ordered ? "ol" : "ul"}>${childrenJsx(n, relPath)}</${meta.ordered ? "ol" : "ul"}>`
    case "listItem":
      return `<li>${childrenJsx(n, relPath)}</li>`
    case "hr":
      return "<hr/>"
    case "link":
      return `<a${jsxAttr("href", meta.href)}${jsxAttr("title", meta.title)}>${childrenJsx(n, relPath)}</a>`
    case "image":
      return `<img${jsxAttr("src", meta.src)}${jsxAttr("alt", meta.alt)}/>`
    // node() always wraps children as an array (only "text" callbacks get a raw string — see
    // splitNodes/node above), so an "html" node's own n[2] is never a string in practice; textOf
    // recovers the literal raw HTML text from its "text" descendants, spliced verbatim (unescaped —
    // see the spec's "Why" on raw HTML: this is deliberate, not a bug).
    case "html":
      return textOf(n)
    case "text":
      return jsxText(typeof n[2] === "string" ? n[2] : "")
    case "code":
      return codeNodeToJsx(n, relPath)
    default: {
      const tag = TAG_MAP[type]
      if (tag) return `<${tag}>${childrenJsx(n, relPath)}</${tag}>`
      return ""
    }
  }
}

/** One highlighted token: its text, and its color in the light and dark themes — both absent when
 * the token keeps the page's text color (see CODE_DEFAULT_FG). */
type ShikiToken = { content: string; light?: string; dark?: string }

/** Highlights `code` with both CODE_THEMES at once (one token list, each token carrying a color per
 * theme), dropping the colors of tokens drawn in both themes' default text color. */
async function highlight(code: string, lang: BundledLanguage | SpecialLanguage): Promise<ShikiToken[][]> {
  const lines = await codeToTokensWithThemes(code, { lang, themes: CODE_THEMES })
  return lines.map((line) =>
    line.map((t): ShikiToken => {
      const light = t.variants.light?.color?.toUpperCase() ?? CODE_DEFAULT_FG.light
      const dark = t.variants.dark?.color?.toUpperCase() ?? CODE_DEFAULT_FG.dark
      return light === CODE_DEFAULT_FG.light && dark === CODE_DEFAULT_FG.dark
        ? { content: t.content }
        : { content: t.content, light, dark }
    }),
  )
}

/** Compiles Shiki's structured token output (not its HTML-string output — see the spec's "Why" on
 * avoiding `.innerHTML`) into a literal JSX array-of-lines: each line a `<>`-fragment of colored
 * `<span>`s (or plain text for uncolored runs), lines separated by literal `"\n"` text children so
 * they render as separate lines inside a `<pre>`. Colors go through `tokenColorClass` (a shared,
 * memoized CSS class per distinct light/dark color pair) rather than a per-span inline `style` —
 * see its doc comment in code-example.tsx for why. */
function tokensToJsx(lines: ShikiToken[][]): string {
  const lineFrags = lines.map((line) => {
    const spans = line
      .map((t) =>
        t.light
          ? `<span class={tokenColorClass(${JSON.stringify(t.light)}, ${JSON.stringify(t.dark)})}>${jsxText(t.content)}</span>`
          : jsxText(t.content),
      )
      .join("")
    return `<>${spans}</>`
  })
  return `[${lineFrags.join(',"\\n",')}]`
}

type InlineExample = { node: MdNode; body: string; importLines: string[]; sourceLine: number }
type FullExample = { node: MdNode; index: number; importLines: string[]; body: string; sourceLine: number }

/**
 * Highlights every code node (all languages, via Shiki's token API) and classifies ts/tsx ones per
 * the spec's three fence kinds. Mutates `codeNodes` in place (stores `tokens` on each node's meta,
 * consumed later by `codeNodeToJsx`, and the route of each `@full-example`) and returns the
 * inline/full examples collected for codegen. `codeLines[i]` is the source line of `codeNodes[i]`
 * (see locateCodeBlocks); `name` is the page's route name.
 */
async function processCodeNodes(
  codeNodes: MdNode[],
  codeLines: number[],
  name: string,
): Promise<{ inline: InlineExample[]; full: FullExample[] }> {
  const inline: InlineExample[] = []
  const full: FullExample[] = []

  for (let i = 0; i < codeNodes.length; i++) {
    const n = codeNodes[i]!
    const sourceLine = codeLines[i] ?? 1
    const lang = n[1]?.language
    const raw = textOf(n)
    const isTs = lang === "ts" || lang === "tsx"
    const { annotation, body: withoutMarker } = isTs ? annotationOf(raw) : { annotation: null as Annotation, body: raw }

    const displayText = annotation ? withoutMarker.replace(/^\n/, "") : raw
    n[1] = { ...n[1], tokens: await highlight(displayText, lang || "text") }
    n[2] = displayText

    if (annotation === "inline-example") {
      const { importLines, body } = extractImports(displayText)
      inline.push({ node: n, body, importLines, sourceLine })
    } else if (annotation === "full-example") {
      const { importLines, body } = extractImports(displayText)
      const index = full.length
      n[1].fullExampleUrl = fullExampleUrl(name, index)
      full.push({ node: n, index, importLines, body, sourceLine })
    }
  }

  return { inline, full }
}

/** Route of a page's `index`-th `@full-example` block (0-based, in document order). */
function fullExampleUrl(name: string, index: number): string {
  return `/full-example/${name}/${index}`
}

/** Generated file of a page (`index` omitted) or of its `index`-th `@full-example` block, relative
 * to docs/src/md. */
function generatedFileFor(name: string, index?: number): string {
  return index == null ? `${name}.tsx` : `${name}.full-${index}.tsx`
}

/** Import specifier of `docs/src/<target>` from the generated page of `relPath` (at docs/src/md/<name>.tsx). */
function importFromPage(relPath: string, target: string): string {
  return posix.relative(posix.dirname(`md/${relPath}`), target)
}

/** Compiles a `"code"` MdNode into a literal `<CodeExample .../>` call at its exact position in the
 * generated JSX (see "Code fences" in the spec). `@inline-example` bodies become the `run` prop,
 * a closure CodeExample calls once the result area nears the viewport — not at `Content()` time, so
 * a page with many examples doesn't render them all up front. Each `Content()` call gets fresh
 * closures, so the example re-runs per rendered page rather than once at module-load time. */
function codeNodeToJsx(n: MdNode, relPath: string): string {
  const meta = n[1]
  const highlighted = tokensToJsx(meta.tokens ?? [])
  const props: string[] = [` highlighted={() => (${highlighted})}`]
  if (meta.fullExampleUrl != null) {
    props.push(jsxAttr("fullExampleUrl", meta.fullExampleUrl))
    return `<CodeExample${props.join("")} />`
  }
  if (meta.__inlineBody != null) {
    return `<CodeExample${props.join("")} run={() => {\n/* docs/md/${relPath}:${meta.__sourceLine} */\n${meta.__inlineBody}\n}} />`
  }
  return `<CodeExample${props.join("")} />`
}

/**
 * Third line of every generated page: the source line of each of its `@full-example` blocks, e.g.
 * `// full-example lines: [12,40]`. The routes and the expected `.full-N.tsx` files are rebuilt on
 * every macro call, also for pages that are up to date and not parsed again: they read this line
 * back (see readFullExampleLines) instead of scanning the markdown a second, different way. A comment
 * rather than an export, so nothing of it reaches the client bundle.
 */
const FULL_EXAMPLE_LINES_HEADER = "// full-example lines: "

/** The `@full-example` source lines recorded in a generated page (see FULL_EXAMPLE_LINES_HEADER), or
 * null when the file has no such line (written by an older macro.ts: it is then out of date anyway). */
async function readFullExampleLines(pagePath: string): Promise<number[] | null> {
  // The header is within the first few hundred bytes; the rest of a page can weigh hundreds of KB.
  const head = await Bun.file(pagePath).slice(0, 1024).text()
  const line = head.split("\n").find((l) => l.startsWith(FULL_EXAMPLE_LINES_HEADER))
  return line == null ? null : JSON.parse(line.slice(FULL_EXAMPLE_LINES_HEADER.length))
}

function genPageSource(
  relPath: string,
  frontmatter: Frontmatter,
  root: MdNode,
  inline: InlineExample[],
  full: FullExample[],
  codeNodes: MdNode[],
): string {
  const mergedImports = mergeImports(
    inline.map((e) => ({ importLines: e.importLines, loc: `docs/md/${relPath}:${e.sourceLine}` })),
  )

  for (const e of inline) {
    ;(e.node[1] as any).__inlineBody = e.body
    ;(e.node[1] as any).__sourceLine = e.sourceLine
  }

  // Compile the whole tree to JSX now (mutations above — __inlineBody/__sourceLine — must land first,
  // since codeNodeToJsx, reached via nodeToJsx's "code" case, reads them).
  const bodyJsx = nodeToJsx(root, relPath)

  const importsComment =
    inline.length > 0
      ? [
          `// Imports merged from @inline-example blocks at ${inline.map((e) => `docs/md/${relPath}:${e.sourceLine}`).join(", ")}`,
        ]
      : []

  // CodeExample/tokenColorClass are only imported when the generated JSX actually uses them:
  // CodeExample when the page has a code fence, tokenColorClass when at least one token got a color of its own (fences in a language without a
  // grammar, e.g. `text`, yield only tokens in the default text color, which stay uncolored — see highlight). An unused import is an error under noUnusedLocals,
  // which docs/tsconfig.json matches the root tsconfig on.
  const codeExampleNames = [
    "CodeExample",
    ...(codeNodes.some((n) => (n[1].tokens as ShikiToken[][] | undefined)?.some((line) => line.some((t) => t.light)))
      ? ["tokenColorClass"]
      : []),
  ]
  const codeExampleImport =
    codeNodes.length > 0
      ? [`import { ${codeExampleNames.join(", ")} } from "${importFromPage(relPath, "code-example.tsx")}"`]
      : []

  return [
    "// GENERATED by docs/src/macro.ts — do not edit by hand (gitignored).",
    `// Source: docs/md/${relPath}`,
    `${FULL_EXAMPLE_LINES_HEADER}${JSON.stringify(full.map((ex) => ex.sourceLine))}`,
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
    "// GENERATED by docs/src/macro.ts — do not edit by hand (gitignored).",
    `// Source: docs/md/${relPath}:${ex.sourceLine}`,
    'import "elt"',
    'import { Service, view } from "elt"',
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
  "// GENERATED-BEGIN (docs/src/macro.ts) — do not hand-edit until GENERATED-END."
export const ROUTES_GENERATED_END_MARKER = "// GENERATED-END"

/** One named, referenced `with { type: "text" }` import per discovered `.md` file, between the
 * markers above. Named + referenced (the trailing `void` lines) is required, not cosmetic: it's
 * what makes Bun invalidate the `{ type: "macro" }` call's cached result when a `.md` file's
 * content changes (see the spec) — dead-code-eliminated entirely from a real production build. */
function genRoutesTextImportsBlock(files: string[]): string {
  const taken = new Set<string>()
  const importLines: string[] = []
  const aliases: string[] = []
  for (const f of files) {
    const alias = aliasFor(nameFor(f), taken, "_text")
    aliases.push(alias)
    importLines.push(`import ${alias} from "../md/${f}" with { type: "text" }`)
  }
  return [
    ROUTES_GENERATED_BEGIN_MARKER,
    ...importLines,
    // one statement per alias, so the block is already as biome formats it, whatever the number of pages
    ...aliases.map((a) => `void ${a}`),
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
      "docs/src/routes.ts is missing the GENERATED-BEGIN/GENERATED-END markers required by elt_md() " +
        "— see docs/src/macro.ts.",
    )
  }
  const afterEndLineStart = routesSource.indexOf("\n", endIdx)
  const after = afterEndLineStart === -1 ? "" : routesSource.slice(afterEndLineStart + 1)
  return `${routesSource.slice(0, beginIdx)}${block}\n${after}`
}

const mdGlob = new Bun.Glob("**/*.md")
/** The generated pages and examples, under docs/src/md. */
const generatedGlob = new Bun.Glob("**/*.tsx")

/** Recursively lists every "*.md" under `mdDir`, relative to it, in a deterministic (sorted) order. */
async function scanMdFiles(mdDir: string): Promise<string[]> {
  const out: string[] = []
  for await (const relPath of mdGlob.scan(mdDir)) out.push(relPath)
  return out.sort() // deterministic order: routes.ts's generated block / routes.generated.ts content
  // must be stable across runs with the same file set, or the idempotency write-skip (see elt_md)
  // never converges.
}

/** A code block found by scanCodeBlocks: its 1-based source line, and the info string of a fence
 * (the text after the opening ``` — its first word is the language), or null for an indented block. */
type ScannedBlock = { line: number; info: string | null }

/**
 * Finds the code blocks of a markdown body by scanning its lines, since Bun.markdown.render gives
 * its callbacks no source position. Handles fences of ``` or ~~~ of any length (a fence closes
 * only on the same character, at least as long, so a ```` fence can show ``` lines), fences inside
 * blockquotes and list items, and indented code blocks (4+ spaces after a blank line, outside a
 * list). It is not a full CommonMark parser — e.g. it does not know that a fence inside a raw HTML
 * block is no fence — so locateCodeBlocks checks its result against the parser's.
 * `firstLine` is the source line of the body's first line (after the frontmatter).
 */
function scanCodeBlocks(body: string, firstLine: number): ScannedBlock[] {
  const out: ScannedBlock[] = []
  let fence: { char: string; length: number } | null = null
  let inIndented = false
  let inList = false
  let prevBlank = true
  const lines = body.split("\n")
  for (let i = 0; i < lines.length; i++) {
    // Strip blockquote markers, and expand leading tabs to the 4 columns they count for.
    const line = lines[i]!.replace(/^(?: {0,3}> ?)+/, "").replace(/^[ \t]+/, (ws) => ws.replace(/\t/g, "    "))
    const blank = line.trim() === ""
    if (fence) {
      const close = line.match(/^\s*(`{3,}|~{3,})\s*$/)
      if (close && close[1]![0] === fence.char && close[1]!.length >= fence.length) fence = null
      prevBlank = false
      continue
    }
    const indent = line.length - line.trimStart().length
    if (!blank && indent >= 4 && !inList && (prevBlank || inIndented)) {
      if (!inIndented) out.push({ line: firstLine + i, info: null })
      inIndented = true
      prevBlank = false
      continue
    }
    // A blank line may sit inside an indented block; any other line ends it.
    if (!blank) inIndented = false
    const open = line.match(/^\s*(`{3,}|~{3,})(.*)$/)
    // A backtick fence's info string can't contain a backtick (that's an inline code span).
    if (open && !(open[1]![0] === "`" && open[2]!.includes("`"))) {
      fence = { char: open[1]![0]!, length: open[1]!.length }
      out.push({ line: firstLine + i, info: open[2]!.trim() })
      prevBlank = false
      continue
    }
    // In a list, indented lines continue the item; a non-indented line after a blank line ends it.
    if (/^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:\s|$)/.test(line)) inList = true
    else if (!blank && indent === 0 && prevBlank) inList = false
    prevBlank = blank
  }
  return out
}

/** 1-based line number in `raw` (the whole file, frontmatter included) of each of `codeNodes`, used
 * to cite "docs/md/<file>:<line>" in generated output (see the spec, "Generated file provenance").
 * Throws when the scan and the parser disagree, rather than cite wrong lines. */
function locateCodeBlocks(raw: string, body: string, codeNodes: MdNode[], relPath: string): number[] {
  const firstLine = raw.slice(0, raw.length - body.length).split("\n").length
  const blocks = scanCodeBlocks(body, firstLine)
  const agree =
    blocks.length === codeNodes.length &&
    codeNodes.every((n, i) => n[1].language == null || blocks[i]?.info?.split(/\s/)[0] === n[1].language)
  if (!agree) {
    throw new Error(
      `docs/md/${relPath}: cannot find the source lines of its code blocks — the markdown parser sees ` +
        `${codeNodes.length} (${codeNodes.map((n) => n[1].language ?? "?").join(", ")}), the line scanner of ` +
        `docs/src/macro.ts sees ${blocks.length} (at lines ${blocks.map((b) => b.line).join(", ")}). ` +
        "A code fence inside raw HTML or in an unusual list layout can cause this; see scanCodeBlocks.",
    )
  }
  return blocks.map((b) => b.line)
}

/**
 * Parses a markdown body into a tree of MdNodes. Of Bun's optional syntaxes, `wikiLinks`,
 * `underline` and `latexMath` stay off: in Bun 1.4.2 the last two do nothing, and `render()` drops
 * a wiki link's target (see macro.test.ts) — wiki links are rewritten by rewriteLinks instead.
 */
export function renderMarkdownNodes(body: string): MdNode[] {
  const callbacks: Record<string, (...args: any[]) => string> = {}
  for (const type of NODE_TYPES) {
    callbacks[type] = (children: string, meta?: unknown) => node(type, meta, children)
  }
  callbacks.text = (text: string) => JSON.stringify(["text", {}, text])

  const out = Bun.markdown.render(body, callbacks as any, { autolinks: true, headings: true, hardSoftBreaks: true })

  // Bun.markdown.render's overall return has no wrapping "document" node — for any file with more
  // than one top-level block, `out` is multiple concatenated sibling JSON values, not one, so it
  // can't be JSON.parse'd directly. Scan it the same way a parent node scans its children.
  return splitNodes(out)
}

/** Writes the generated page of `relPath` and the files of its `@full-example` blocks; returns the
 * source line of each of those blocks. */
async function parseAndGenerate(
  srcDir: string,
  relPath: string,
  raw: string,
  frontmatter: Frontmatter,
  body: string,
): Promise<number[]> {
  const root: MdNode = ["root", {}, renderMarkdownNodes(body)]

  rewriteLinks(root, relPath)

  const name = nameFor(relPath)
  const codeNodes: MdNode[] = []
  collectCodeNodes(root, codeNodes)
  const { inline, full } = await processCodeNodes(codeNodes, locateCodeBlocks(raw, body, codeNodes, relPath), name)

  if (frontmatter.title == null) {
    const heading = findFirstHeading(root)
    if (heading) frontmatter.title = textOf(heading)
  }

  await Bun.write(
    resolve(srcDir, "md", generatedFileFor(name)),
    genPageSource(relPath, frontmatter, root, inline, full, codeNodes),
  )
  for (const ex of full) {
    await Bun.write(resolve(srcDir, "md", generatedFileFor(name, ex.index)), genFullExampleSource(relPath, ex))
  }
  return full.map((ex) => ex.sourceLine)
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
    importLines.push(`import * as ${p.moduleAlias} from "./md/${generatedFileFor(p.name)}"`)
    routeLines.push(`  // docs/md/${p.name}.md:1`)
    routeLines.push(`  ${JSON.stringify(p.name)}: ["${p.url}", () => ${p.moduleAlias}.PageService],`)
    menuEntryLines.push(
      `  { name: ${JSON.stringify(p.name)}, url: ${JSON.stringify(p.url)}, frontmatter: ${p.moduleAlias}.frontmatter },`,
    )
    for (let n = 0; n < p.fullExampleLines.length; n++) {
      routeLines.push(`  // docs/md/${p.name}.md:${p.fullExampleLines[n]}`)
      routeLines.push(
        `  ${JSON.stringify(`${p.name}__full-${n}`)}: ["${fullExampleUrl(p.name, n)}", () => import("./md/${generatedFileFor(p.name, n)}")],`,
      )
    }
  }

  return [
    "// GENERATED by docs/src/macro.ts — do not edit by hand (gitignored).",
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
 * for its `@full-example` blocks) — the expensive parse/highlight/codegen step — only if it is out
 * of date: missing, older than its `.md` or than macro.ts itself (whose changes change the output),
 * or missing one of its `.full-N.tsx` files. Generated files that no source accounts for any more
 * (the page of a deleted `.md`, the `.full-N.tsx` of a removed block) are deleted.
 * `docs/src/routes.generated.ts`, by contrast, is cheap (no parse — names, and the `@full-example`
 * lines each generated page records, see FULL_EXAMPLE_LINES_HEADER) and is
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
 * Returns the same page list it just wrote into `routes.generated.ts`, so tests can assert on it
 * directly. `roots` is a test-only seam (see macro.test.ts): the real call, elt_md() below, scans the
 * real `docs/md` next to this file.
 */
export async function generate_docs(roots?: { mdDir: string; srcDir: string }): Promise<{ pages: PageEntry[] }> {
  const mdDir = roots?.mdDir ?? resolve(import.meta.dir, "..", "md")
  const srcDir = roots?.srcDir ?? import.meta.dir
  const genDir = resolve(srcDir, "md")
  const files = await scanMdFiles(mdDir)
  // A change to this file can change every generated page.
  const macroModified = Bun.file(import.meta.path).lastModified

  const routesTsPath = resolve(srcDir, "routes.ts")
  const existingRoutesTs = await Bun.file(routesTsPath).text()
  const newRoutesTs = spliceGeneratedBlock(existingRoutesTs, genRoutesTextImportsBlock(files))
  if (newRoutesTs !== existingRoutesTs) await Bun.write(routesTsPath, newRoutesTs)

  const pages: PageEntry[] = []
  const takenAliases = new Set<string>()
  /** Every file under docs/src/md that some source accounts for; the others are deleted below. */
  const expected = new Set<string>()
  // Sequential, not Promise.all: the files of a page are written and read back in this iteration.
  for (const relPath of files) {
    const srcPath = resolve(mdDir, relPath)
    const name = nameFor(relPath)
    const targetPath = resolve(genDir, generatedFileFor(name))
    const target = Bun.file(targetPath)

    // Lines recorded by the generated page, when it is newer than both its .md and macro.ts.
    let fullExampleLines =
      (await target.exists()) && target.lastModified >= Math.max(Bun.file(srcPath).lastModified, macroModified)
        ? await readFullExampleLines(targetPath)
        : null
    // Up to date only if every .full-N.tsx it records is still there.
    for (let n = 0; fullExampleLines != null && n < fullExampleLines.length; n++) {
      if (!(await Bun.file(resolve(genDir, generatedFileFor(name, n))).exists())) fullExampleLines = null
    }
    if (fullExampleLines == null) {
      const raw = await Bun.file(srcPath).text()
      const { frontmatter, body } = splitFrontmatter(raw)
      fullExampleLines = await parseAndGenerate(srcDir, relPath, raw, frontmatter, body)
    }

    expected.add(generatedFileFor(name))
    for (let n = 0; n < fullExampleLines.length; n++) expected.add(generatedFileFor(name, n))
    pages.push({ name, url: urlFor(relPath), moduleAlias: aliasFor(name, takenAliases), fullExampleLines })
  }

  const routesContent = genRoutesSource(pages)
  const routesPath = resolve(srcDir, "routes.generated.ts")
  const existingRoutes = (await Bun.file(routesPath).exists()) ? await Bun.file(routesPath).text() : null
  if (existingRoutes !== routesContent) await Bun.write(routesPath, routesContent)

  // After routes.generated.ts stopped importing them. (Scanning a missing directory throws.)
  if (await exists(genDir)) {
    for await (const file of generatedGlob.scan(genDir)) {
      if (!expected.has(file)) await unlink(resolve(genDir, file))
    }
  }

  return { pages }
}

/** The macro called by `docs/src/routes.ts`: generates everything (see generate_docs) and returns
 * nothing. A Bun macro's return value is pasted as a literal at its call site, so returning the page
 * list here would put it in the client bundle, where nothing reads it. Bun waits for an async macro
 * at bundle time, so the call site needs no `await`. */
export async function elt_md(): Promise<void> {
  await generate_docs()
}
