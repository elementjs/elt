// Build-time markdown → JSON tree macro. See specs/markdown-docs.md for the design rationale
// (why Bun.markdown.render's string-composition model needs the bracket-scan trick below, why
// file registration is split between a `with { type: "text" }` import and this macro's own
// `Bun.file()` read, and why TS type-checking/transpilation happens here rather than at runtime).

// Tiny inline replacements for node:path's resolve/basename, to avoid a @types/node dependency
// (docs/tsconfig.json only declares @types/bun) for two one-line operations.
const path = {
  /** Assumes the first part is already absolute (every call site here passes `import.meta.dir`). */
  resolve: (...parts: string[]) => {
    const out: string[] = []
    for (const part of parts.join("/").split("/")) {
      if (part === "" || part === ".") continue
      if (part === "..") out.pop()
      else out.push(part)
    }
    return `/${out.join("/")}`
  },
  basename: (p: string) => p.split("/").at(-1) ?? p,
}

export type MdNode = [type: string, meta: Record<string, any>, children: MdNode[] | string]

export type Frontmatter = {
  title?: string
  order?: number
  section?: string
  draft?: boolean
}

export type ParsedDoc = {
  frontmatter: Frontmatter
  root: MdNode
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

/**
 * Relative `.md` links (`./x.md`, `../dir/x.md`) become internal hash-routes. `fromPath` is this
 * document's own path relative to `docs/src/`, used to resolve the link's relative path the same
 * way the Routing section of the spec derives routes from file paths (including the `index.md` →
 * directory-route convention).
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
  let route = resolved.join("/").replace(/\.md$/, "")
  if (route.endsWith("/index")) route = route.slice(0, -"/index".length)
  return `#/${route}${hash ?? ""}`
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

function textOf(n: MdNode): string {
  if (n[0] === "text") return typeof n[2] === "string" ? n[2] : ""
  if (Array.isArray(n[2])) return n[2].map(textOf).join("")
  return ""
}

const IMPORT_RE = /^import\s+(?:(\*\s+as\s+\w+)|(\w+)(?:\s*,\s*\{([^}]*)\})?|\{([^}]*)\})\s+from\s+["']([^"']+)["'];?\s*$/gm

export function stripImports(src: string): string {
  return src.replace(IMPORT_RE, (_m, nsAll, def, namedAfterDef, namedOnly, mod) => {
    let decl = ""
    if (nsAll) {
      const name = nsAll.replace(/^\*\s+as\s+/, "")
      decl += `const ${name} = __imports[${JSON.stringify(mod)}];`
    }
    if (def) decl += `const ${def} = __imports[${JSON.stringify(mod)}].default;`
    const named = namedAfterDef || namedOnly
    if (named) {
      const names = named.split(",").map((s: string) => s.trim()).filter(Boolean).map((s: string) => s.replace(/\s+as\s+/, ": "))
      decl += `const { ${names.join(", ")} } = __imports[${JSON.stringify(mod)}];`
    }
    return decl
  })
}

const transpiler = new Bun.Transpiler({
  loader: "tsx",
  tsconfig: {
    compilerOptions: { jsx: "react", jsxFactory: "E", jsxFragmentFactory: "E.Fragment" },
  },
})

/** Type-checks every ts/tsx snippet on a page in one `tsgo` invocation (not one per snippet). */
async function typeCheckSnippets(snippets: string[]): Promise<string[][]> {
  if (snippets.length === 0) return []
  // Resolved (no literal ".."), since tsgo echoes back the exact path string it was given in its
  // diagnostics, and that output is matched against this same `paths` array below by string equality.
  const tmpDir = path.resolve(import.meta.dir, "..", ".tmp-snippets")
  await Bun.$`mkdir -p ${tmpDir}`.quiet()
  const paths = snippets.map((_, i) => `${tmpDir}/snippet-${i}.tsx`)
  await Promise.all(snippets.map((code, i) => Bun.write(paths[i]!, code)))

  // --ignoreConfig: tsgo refuses to run at all (error TS5112) when files are passed on the command
  // line from inside a directory that has a tsconfig.json (docs/tsconfig.json does) — confirmed by
  // testing, where this silently produced zero diagnostics for every snippet until this flag was added.
  const tsgoBin = path.resolve(import.meta.dir, "..", "..", "node_modules", ".bin", "tsgo")
  const proc = Bun.spawnSync([tsgoBin, "--noEmit", "--ignoreConfig",
    "--jsx", "react", "--jsxFactory", "E", "--jsxFragmentFactory", "E.Fragment", ...paths])
  const output = proc.stdout.toString() + proc.stderr.toString()

  // tsgo always emits diagnostic paths relative to its own cwd, regardless of the (absolute) path
  // form it was invoked with — confirmed by testing (`.tmp-snippets/snippet-0.tsx(1,7): error ...`
  // even when given an absolute path). Match by basename instead of exact path string.
  const errorsByFile = new Map<string, string[]>()
  for (const line of output.split("\n")) {
    const m = line.match(/^(?:.*[\\/])?(snippet-\d+\.tsx)\(\d+,\d+\): error/)
    if (m?.[1]) {
      const arr = errorsByFile.get(m[1]) ?? []
      arr.push(line)
      errorsByFile.set(m[1], arr)
    }
  }

  return paths.map(p => errorsByFile.get(path.basename(p)) ?? [])
}

async function processCodeNodes(codeNodes: MdNode[]): Promise<void> {
  const tsNodes = codeNodes.filter(n => n[1]?.language === "ts" || n[1]?.language === "tsx")
  const tsTexts = tsNodes.map(textOf)
  const typeErrorsByNode = await typeCheckSnippets(tsTexts)

  for (let i = 0; i < tsNodes.length; i++) {
    const n = tsNodes[i]!
    const code = tsTexts[i]!
    const compiled = transpiler.transformSync(code)
    const compiledFnSource = stripImports(compiled)
    n[1] = {
      ...n[1],
      typeErrors: typeErrorsByNode[i] ?? [],
      compiledFnSource,
    }
    n[2] = code
  }

  const otherNodes = codeNodes.filter(n => n[1]?.language !== "ts" && n[1]?.language !== "tsx")
  if (otherNodes.length > 0) {
    const { codeToHtml } = await import("shiki")
    for (const n of otherNodes) {
      const lang = n[1]?.language
      const code = textOf(n)
      n[1] = { ...n[1], highlightedHtml: await codeToHtml(code, { lang: lang || "text", theme: "github-dark" }) }
      n[2] = code
    }
  }
}

export async function elt_md(path: string): Promise<ParsedDoc> {
  const raw = await Bun.file(path).text()
  const { frontmatter, body } = splitFrontmatter(raw)

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

  const fromPath = path.replace(/^.*\/src\//, "")
  rewriteLinks(root, fromPath)

  const codeNodes: MdNode[] = []
  collectCodeNodes(root, codeNodes)
  await processCodeNodes(codeNodes)

  return { frontmatter, root }
}
