# Markdown documentation

This spec converts elt's documentation into a markdown-driven single-page application (SPA) that lives at `docs/`, replacing no existing app (`demo/` is untouched — see [Relationship to `demo/`](#relationship-to-demo)). The SPA has two audiences: an agent reading the raw `.md` files directly (full code examples inline, no build step required), and a human running `bun run docs/index.html` (Bun's auto-reloading dev server) for live, interactive examples.

## Package layout

- `docs/package.json` — a new, independent package. It has **no dependency entry on `elt` itself** — see below. It does depend on genuine external packages the pages actually use (e.g. `elt-phosphor`, `shiki`).
- `docs/tsconfig.json` declares `compilerOptions.paths`: `{"elt": ["../src/index.ts"], "elt/ui": ["../ui/index.tsx"], "*": ["./*"]}`. Source keeps writing the normal `import ... from "elt"` / `import "elt/ui"` (matching every other package in this repo — no special-cased import style in `docs/src/*`), but this resolves those specifiers directly to the actual source files, bypassing `node_modules`/package resolution for `elt` entirely. Confirmed by testing that both `tsgo` (type-checking) and Bun's own bundler (actual `bun index.html` builds) honor this mapping identically — the whole app works with `elt` entirely absent from `docs/node_modules`.
  > Why: `docs`'s relationship to the `elt`/`elt/ui` packages it lives right next to in this repo was unreliable during earlier development of this spec, but the actual root cause turned out to be unrelated to this design: the repo had a `bun.workspace.toml` file declaring workspace members, which is not a real Bun feature (confirmed directly against Bun's own docs — the only supported mechanism is the `"workspaces"` array in the root `package.json`). That file was silently inert; `docs` (and even `demo`) were never real Bun workspace members at all, which is why `bun install` never linked either of them correctly (`demo`'s `"elt": "../"` "worked" only by accident, via Bun's fallback full-directory-copy behavior for a plain relative dependency). That's fixed at the root now (`package.json`'s `"workspaces": ["demo", "docs"]`, `bun.workspace.toml` deleted) — but the `paths` mapping is kept regardless, since it's still strictly more robust for `elt` specifically: `elt` is source in this same repo, not really an external dependency, so there is no reason to route it through package resolution and `node_modules` at all when the real files are one `import` away. `elt-phosphor` and `shiki` remain genuine external packages and go through normal dependency installation, now correctly.
- `bun run docs/index.html` (from the repo root) and `bun index.html` (from inside `docs/`) must both work — this is exercised directly by testing, not assumed. Add a `"docs": "bun docs/index.html"` script to the **root** `package.json` (alongside the existing `"demo": "bun demo/index.html"`) as the documented way to launch it.
- `docs/index.html` — entry point, loads `docs/src/app.tsx` as a module script.
- `docs/tsconfig.json` — same shape as `demo/tsconfig.json` (`jsx: "react"`, `jsxFactory: "E"`, `jsxFragmentFactory: "E.Fragment"`, `moduleResolution: "bundler"`).
- `docs/src/app.tsx` — mounts the SPA, imports every markdown page (see [File registration](#file-registration)), builds the route table, renders the nav.
- `docs/src/macro.ts` — the build-time macro (see [Markdown parsing](#markdown-parsing)).
- `docs/src/*.md`, `docs/src/**/*.md` — the markdown content itself, moved here from their current locations (see [Content migration](#content-migration)).

## Relationship to `demo/`

`demo/src/*.tsx` (the hand-written component showcase — `buttons.tsx`, `screen-layout.tsx`, `screen-typography.tsx`, etc.) is the "current documentation SPA" this spec's opening line refers to. It is left untouched by this work. It will eventually be obsoleted by `docs/`, but that migration is out of scope here.

## Content migration

The existing tracked files `docs/README.md`, `docs/using-elt.md`, `docs/using-elt-agent.md`, `docs/using-elt-ui.md`, `docs/using-elt-ui-agent.md`, and `docs/adr/000{1,2,3}-*.md` move to `docs/src/` (preserving relative structure, e.g. `docs/adr/0001-x.md` → `docs/src/adr/0001-x.md`).

This spec's implementation only needs to wire up **one** of these files end-to-end as a proof of the full pipeline (macro → `e2` → route → rendered page): `docs/src/README.md`. The remaining moved files may sit unimported/unrendered until a later, separate content-migration pass gives each one frontmatter and folds it into the nav — but they must physically move now, so that path references stay accurate as of this change.

Every place that currently references the moved files by path (`AGENTS.md`'s doc-selection table, `CLAUDE.md` if it references them, any `.md`-to-`.md` links between them) must be updated to the new `docs/src/...` paths in the same change.

## File registration

Bun macro arguments must be statically known at bundle time (literals/constants) — an imported binding (e.g. a `with { type: "text" }` import's value) cannot be passed into a macro call; doing so fails to build with `Cannot convert identifier to JS. Try a statically-known value` (confirmed by testing). So `elt_md` cannot receive a file's content as its argument. It instead takes the file's **path** (a literal string, relative to `docs/src/` — e.g. `"./README.md"`) and reads the file itself via `Bun.file(path).text()`.

That path is resolved against `import.meta.dir` **inside `elt_md` itself** (i.e. `docs/src/`, since that's where `macro.ts` lives), not against `process.cwd()`. A macro always runs at bundle time regardless of what invoked the bundler, and `import.meta.dir` there is fixed to the macro file's own location on disk — so this is what makes `elt_md` work the same way whether `bun` was launched as `bun docs/index.html` from the repo root or as `bun index.html` from inside `docs/`. Resolving the path against `process.cwd()` instead (the first implementation of this spec did) fails with `ENOENT` under one of those two invocations, confirmed by testing.

But a macro reading a file directly through `Bun.file()`/`fs` does not register that file as a bundler dependency — confirmed by testing: editing a `.md` file that only a macro's internal `Bun.file()` call reads produces no rebundle and no hot-reload; the dev server's watch graph never sees the read. A `with { type: "text" }` import of the same file, sitting alongside the macro call, does register the dependency and does trigger a rebundle+reload on edit.

That import is written **bare — unbound to any name** (`import "./README.md" with { type: "text" }`, not `import readme from ...`). A named binding, even one immediately discarded (`void readme`), still gets its file content inlined as a live value in the module graph, and — confirmed by testing — that content survives into the **production** `bun build` output as genuine duplication (the same text appearing twice: once raw/unprocessed from the import, once processed from the macro's output). A bare, nameless import has no value for the bundler to keep, so a production build tree-shakes it to nothing (confirmed by testing: zero occurrences of the raw content in a `bun build` output) while a *named-but-discarded* one does not — dead-code elimination can prove a nameless import has no possible use, but proving a discarded-but-named binding is truly unreferenced is a different, apparently unperformed analysis. The bare form still registers the watch dependency identically (confirmed by testing: editing the file still triggers `Reloaded in ...: src/app.tsx + 1 more`). Only the dev server's own (unshipped) bundle keeps the redundant copy, which doesn't matter — dev builds don't optimize for size.

So `docs/src/app.tsx` carries **both** a bare text import and the macro call, per page, by hand:

```tsx
import "./README.md" with { type: "text" }
import { elt_md } from "./macro.ts" with { type: "macro" }
const readme = await elt_md("./README.md")
// one pair of lines per page, added by hand as pages are authored
```

> Why: a build-time glob/auto-discovery macro would not register newly-added files in Bun's dev-server watch graph at all (see above), so editing or adding a page wouldn't trigger a hot-reload. Explicit per-file imports keep every page's file a first-class watched dependency; the macro's own literal-path argument must name the exact same file as its neighboring `text` import, since nothing enforces that link automatically.

`elt_md`'s parsed result is added to the route table (see [Routing](#routing)) keyed by its file's path relative to `docs/src/`.

## Markdown parsing

`docs/src/macro.ts` exports the `elt_md` macro (see [File registration](#file-registration) for its `(path: string) => Promise<...>` signature) that turns a markdown file into a JSON tree consumable by `e2` (see [`e2`](#e2)). It is built on `Bun.markdown.render(input, callbacks, options)`.

### Options

Per `bun-types`' `Bun.markdown.Options` (there is no single `gfm` umbrella flag — GFM tables/strikethrough/tasklists already default to `true`): pass `autolinks: true`, `wikiLinks: true`, `underline: true`, `latexMath: true`, `headings: true` (enables both heading-id slugs and heading autolinks), `hardSoftBreaks: true`. `Bun.markdown` is an unstable API; some of these extensions produced no observable behavior difference in testing despite being enabled (no dedicated `render()` callback exists for `math`/`u`/`br`, unlike `react()`'s `ComponentOverrides` which does have `math`/`u`/`br` entries) — pass them regardless, but treat their actual effect through `render()` as unverified until exercised against real content.

### Node tree construction

`Bun.markdown.render`'s callbacks each return a **string**, which Bun concatenates (with no separators) into the `children` argument of the parent's callback — it does not natively produce a nested tree. `elt_md` gets a real tree out of this by having every callback return a real, self-contained **JSON-encoded node** (`[type, meta, children]`, matching this spec's original `[node_type, contents]` shape) instead of plain content, then having each parent scan its concatenated `children` string for the JSON values its own children produced:

- A node is JSON-encoded as `[type, meta, children]` via `JSON.stringify`.
- To recover the list of child nodes from a `children` string that is the untouched concatenation of multiple such JSON strings (with no separators — e.g. `["text",{},"a"]["strong",{},[...]]`), scan the string left to right: whenever a `[` is found, read a balanced bracket run (tracking JSON-string quoting/escaping, so a literal `[`, `]`, or `"` inside a quoted string value doesn't miscount) and `JSON.parse` that run as one child. Any run of characters between such bracket values (e.g. Bun's own literal `"\n"` insertion between two paragraph children for a line break, since no dedicated callback exists for breaks) is wrapped as a literal `["text", {}, run]` child instead of being parsed.
- Register a callback for **every** node type `Bun.markdown.render` invokes (`heading, paragraph, blockquote, code, list, listItem, hr, table, thead, tbody, tr, th, td, html, strong, emphasis, link, image, codespan, strikethrough, text`). Per `bun-types`: "If no callback is registered for an element, its children pass through unchanged" — an unhandled type doesn't corrupt the string with raw HTML, but it does silently disappear as a node (only its children's JSON survives, spliced directly into the parent's `children` string with no wrapping node of their own), which still corrupts the scan by dropping structure. Every type must be covered regardless.
- `render()`'s own overall return value is exactly the root node's JSON string (there is nothing above it to concatenate into) — `JSON.parse` it directly for the tree root.

```ts
// docs/src/macro.ts
type MdNode = [type: string, meta: Record<string, unknown>, children: MdNode[] | string]

function splitNodes(raw: string): MdNode[] {
  const out: MdNode[] = []
  let i = 0
  while (i < raw.length) {
    if (raw[i] === "[") {
      let depth = 0, inStr = false, esc = false
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
          else if (c === "]") { depth--; if (depth === 0) { i++; break } }
        }
      }
      out.push(JSON.parse(raw.slice(start, i)))
    } else {
      const start = i
      while (i < raw.length && raw[i] !== "[") i++
      out.push(["text", {}, raw.slice(start, i)])
    }
  }
  return out
}

function node(type: string, meta: unknown, childrenRaw: string): string {
  return JSON.stringify([type, meta ?? {}, splitNodes(childrenRaw)])
}

const NODE_TYPES = ["heading", "paragraph", "blockquote", "code", "list", "listItem", "hr", "table",
  "thead", "tbody", "tr", "th", "td", "html", "strong", "emphasis", "link", "image", "codespan",
  "strikethrough"]

export async function elt_md(path: string): Promise<{ frontmatter: Frontmatter; root: MdNode }> {
  const raw = await Bun.file(path).text()
  const { frontmatter, body } = splitFrontmatter(raw) // see Frontmatter, below

  const callbacks: Record<string, (children: string, meta?: unknown) => string> = {}
  for (const type of NODE_TYPES) callbacks[type] = (children, meta) => node(type, meta, children)
  callbacks.text = (children) => JSON.stringify(["text", {}, children])

  const out = Bun.markdown.render(body, callbacks, {
    autolinks: true, wikiLinks: true, underline: true, latexMath: true,
    headings: true, hardSoftBreaks: true,
  })

  return { frontmatter, root: JSON.parse(out) }
}
```

> Why: this stays entirely within `Bun.markdown.render`'s documented callback semantics (nothing relies on undefined behavior), needs no shared mutable state between callbacks, and produces the tree shape the original draft of this spec already described. Confirmed by testing against real markdown containing nested emphasis, links, tables, literal brackets/quotes inside prose, and a raw HTML block — the scan reconstructs the tree correctly in every case, including Bun's own quirk of splitting a `text` callback into multiple sibling invocations around characters that could have started other syntax (e.g. an unmatched `[`).

### Frontmatter

`splitFrontmatter(raw)` strips a leading `---`-delimited block from the file (if present) and parses it with `Bun.YAML.parse` (built into Bun — no new dependency) into `{ title?: string; order?: number; section?: string; draft?: boolean }`, returning `{ frontmatter, body }` where `body` is the remaining markdown source. `title` overrides the page title derived from the tree's first `heading` node; a missing `title` falls back to that first heading's text. `order` and `section` drive nav grouping/sorting (ascending `order` within each `section`; pages without a `section` group under a default/ungrouped section). `draft: true` excludes the page from the nav and from routing, but the file may still exist and be imported.

### `html` nodes

An `html`-type node's children are `text` nodes containing the literal HTML source (confirmed by testing: Bun wraps raw HTML blocks as an `html` node whose child is a `text` node holding the unescaped HTML string, not a further-parsed structure). `e2` (below) renders this content as raw HTML directly (an `innerHTML`-equivalent insert) rather than reprocessing it, since docs content is first-party and trusted.

### Link rewriting

While building the tree, a `link` node whose `meta.href` is a relative path ending in `.md` (e.g. `./using-elt-ui.md`, `../adr/0001-x.md`) is rewritten in place to the corresponding internal route (`#/using-elt-ui`, `#/adr/0001-x` — see [Routing](#routing)) at macro time, since the macro already has the full set of files being processed available to resolve paths against. Links that are not relative `.md` paths (external `http(s)://` URLs, in-page anchors) are left untouched.

## `e2`

`e2(node: MdNode): Renderable` is a new function (`Renderable`, elt's actual export for "a value `e`/JSX can insert" — there is no separate `Insertable` type, despite this spec's earlier draft implying one), in `docs/src/`, that recursively turns the macro's output tree (`[type, meta, children]` tuples — see [Node tree construction](#node-tree-construction)) into elt nodes using `e` (elt's hyperscript function, imported as `import { e } from "elt"` — this is the same function JSX compiles `<div>` down to, and the same thing globally aliased to `E` for the JSX factory; `e2` calls it directly since it's building elements from dynamic, data-driven tag names, not statically-known JSX). It switches on `node[0]` (the type):

- `heading` → `e(\`h${node[1].level}\`, { id: node[1].id }, ...children)` (Bun already generates a slug id per heading, used for in-page anchor links)
- `paragraph` → `e("p", null, ...children)`
- `blockquote` → `e("blockquote", null, ...children)`
- `list` → `e(node[1].ordered ? "ol" : "ul", null, ...children)`
- `listItem` → `e("li", null, ...children)`
- `hr` → `e("hr")`
- `table`/`thead`/`tbody`/`tr`/`th`/`td` → the matching HTML table elements
- `strong` → `e("strong", ...)`, `emphasis` → `e("em", ...)`, `strikethrough` → `e("s", ...)`
- `codespan` → `e("code", ...)` (inline, no highlighting)
- `link` → `e("a", { href: node[1].href, title: node[1].title }, ...children)`
- `image` → `e("img", { src: node[1].src, alt: node[1].alt })`
- `html` → raw HTML insert of the child `text` node's string value (see [`html` nodes](#html-nodes))
- `text` → the literal string, which is `node[2]` for a `text` node (its third element is a string, not an array of children — see the `MdNode` type above)
- `code` → not handled by `e2` directly; routed to the code-block widget instead (see [TypeScript code blocks](#typescript-code-blocks))

Every case recurses `e2` over `node[2]` (as an array of child nodes) for its own children, except `text`, `html`, and `code`, which are leaves.

## TypeScript code blocks

`Bun.markdown.render`'s callbacks are synchronous, but type-checking and highlighting are async (subprocess I/O, Shiki's API) — so `code` nodes are left as-is during the `Bun.markdown.render` pass, and `elt_md` does a second, async post-pass over the built tree afterward, walking it and replacing every `code`-type node in place before returning.

Snippets are authored to end with a top-level `return <jsx/>` (or any other expression) when they want a result rendered — `new Function`'s body has no implicit "last expression" completion value the way an arrow function's concise body does, so without an explicit `return` nothing is displayed in the result pane. A snippet with no trailing `return` is valid (e.g. one that only registers a click handler elsewhere) and simply renders nothing.

For a `code` node whose `meta.language` is `"ts"` or `"tsx"`, the post-pass:

1. Extracts the code text: since Bun can split a fenced block's content across multiple `text` children (confirmed by testing — Bun invoked the `text` callback separately for `"const x = 1;"` and `"\n"` within a single code fence), join all of the node's `text` children's string values.
2. Type-checks it via `tsgo` (`@typescript/native-preview` — ships only a CLI, not a programmatic API, confirmed by inspecting the installed package). All TS/TSX snippets belonging to the same page are written as temp files under a project-relative directory (e.g. `docs/.tmp-snippets/`) and batched into **one** `tsgo` invocation per page (not one process per snippet, since spawning a process per snippet on every edit would make the dev server's rebuild latency scale with snippet count). That directory gets its own generated `tsconfig.json` (not `docs/tsconfig.json` itself, and not `--ignoreConfig`) carrying the same `paths` mapping as `docs/tsconfig.json` (see [Package layout](#package-layout)) — `tsgo` refuses to run at all (`TS5112`) when given explicit file paths from a directory that also has a tsconfig.json, and the earlier `--ignoreConfig` workaround for that also threw away the `paths` mapping snippets need to resolve `elt`/`elt/ui`, confirmed by testing (removing `docs/node_modules/elt` broke snippet type-checking specifically, once "elt" had no `node_modules` fallback left). Since a snippet's top-level `return` is invalid outside a function as far as `tsgo`'s own type-checking is concerned (`TS1108`) even though it's valid once wrapped in `new Function` at runtime, the temp file wraps the snippet's non-`import` lines in a function for type-checking purposes only (imports stay outside it, since they aren't legal inside a function body) — diagnostic line numbers are corrected back to the original snippet's numbering before being attached. `tsgo`'s plain-text diagnostic output (`file.ts(line,col): error TS____: message`) is parsed per temp file (matched by basename — confirmed by testing that `tsgo` always emits paths relative to its own cwd, not the path form it was invoked with) and attached to the corresponding block as `typeErrors: string[]`.
3. Transpiles the code to JavaScript via `Bun.Transpiler` (built into Bun — no new dependency), configured with `loader: "tsx"` and `tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "E", jsxFragmentFactory: "E.Fragment" } }`, matching `docs/tsconfig.json`. Unlike the type-check pass, this step doesn't need the wrapper — `Bun.Transpiler` accepts a top-level `return` without complaint (confirmed by testing).
4. Strips `import` statements from the transpiled output (a `new Function` body cannot contain them) with a regex pass over each top-level `import ... from "<module>"` line (covering the three forms: named `{ a, b as c }`, default, and namespace `* as ns`; `Bun.Transpiler.scan()` was considered for this but only returns module specifiers, not bound names, so it isn't sufficient on its own — confirmed by testing) replacing each with the equivalent `const`/destructure read from `__imports["<module>"]`, e.g. `import { o, If } from "elt"` becomes `const { o, If } = __imports["elt"];`. The widget (below) is passed an `imports` object — `{ elt: <namespace>, "elt/ui": <namespace>, "elt-phosphor": <namespace> }` — by `e2` (which imports those namespaces itself, the same relative-to-`elt` way `docs/src/*` does). This is the general form of "`E` available at toplevel" — any snippet doing `import { E } from "elt"` (or `{ o, If, Repeat, Switch }`, or icons via `import * as P from "elt-phosphor"`) gets it this way, not just `E` specifically. This regex only needs to handle the subset of import syntax docs authors actually write (simple top-level imports), not arbitrary JS.
5. Wraps the import-stripped body in a function and stores its source as a string (for `new Function()` at runtime — a macro cannot return a function, only serializable data, so the source string is what's inlined).
6. Replaces the `code` node with a block descriptor carrying `{ code: string, language: "ts" | "tsx", typeErrors: string[], compiledFnSource: string }`.

All of this — type-checking and transpilation — happens at build time, in the macro; no TypeScript compiler is shipped to the browser.

At render time, `docs/src/app.tsx` (or `e2`, for the `code` case) passes this block data to the reusable widget in `ui/` (see below), which:

- Constructs `new Function("__imports", compiledFnSource)` and calls it with the `__imports` object described in step 4, in the main page context (no worker/iframe sandbox — this is first-party, trusted content).
- Catches any runtime error thrown during execution and renders it inline in the result pane, in place of the execution's output.
- If `typeErrors` is non-empty, renders those inline as well (e.g. above or alongside the result), rather than only logging to the browser devtools console.

Every `code` node — `ts`/`tsx` included — gets highlighted via **Shiki** (`docs/package.json` dependency, scoped to `docs/` only — not the root or `demo/` package), run in the same async post-pass to produce statically-highlighted HTML per block, so there is no client-side highlighting cost. This was missed initially (only non-ts/tsx blocks were highlighted, confirmed by testing — the "Typescript" tab of a runnable example rendered as unstyled plain text) before being corrected to cover every block unconditionally. A `code` node whose `meta.language` is anything other than `ts`/`tsx` only gets this highlighted rendering — no run/result toggle, no `tsgo`/`Bun.Transpiler` step.

## Code-example widget

A new reusable component, `ui/code-example.tsx` (not `docs/`-local, since it's generically useful to any app built on `elt/ui`), implements the toggle UI:

```tsx
<e-column>
  <e-row touching>
    <button onclick={() => o_showing_code.mutate(v => !v)}>Typescript</button>
    <button onclick={() => o_showing_code.mutate(v => !v)}>Result</button>
  </e-row>
  {If(o_showing_code,
    () => <pre><code>{highlighted_code}</code></pre>,
    () => run_result_view
  )}
</e-column>
```

`o_showing_code` is an `Observable<boolean>`, defaulting to `false` (the execution result is shown by default, per the original spec requirement). The component uses the `If` verb (not manual DOM append/remove) to switch between the two panes, per elt's reactive-idiom convention.

## Routing

`docs/src/app.tsx` builds a route table for `App.setupRouter` (the existing hash-based `Router` — no new path-based/History-API router is introduced) from the imported+parsed pages:

- A page at `docs/src/dir/sub/file.md` (any depth) maps to route path `dir/sub/file`.
- A page at `docs/src/dir/index.md` maps to route path `dir` (its directory's own landing route). `docs/src/index.md` maps to `""` (the root/default route).
- Route paths are registered the same way `demo/src/routes.tsx` registers its screens today (`key: ["/route/path", () => page_view]`), except the route table here is generated from the imported pages' known paths rather than hand-declared per page.
- Internal links produced by [link rewriting](#link-rewriting) point at these same route paths.

## Nav

`docs/src/app.tsx` renders a sidebar (as `demo/src/routes.tsx`'s `widget_menu()` does today) grouped by each page's frontmatter `section`, ordered by `order` within each section, using each page's `title`. Pages with `draft: true` are omitted from both the nav and the route table.
