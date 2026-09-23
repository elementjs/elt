# Markdown docs, reloaded

## Objectives

- The docs must run with a simple `bun run ./docs/index.html`.
- They must reload whenever a markdown file of the docs changes, **with the updated content**.

> Why: today, typescript examples compile and execute directly inline in markdown files at build
> time, requiring every example to declare all its own imports even for illustrative snippets.
> Reloading also doesn't pick up new content: the macro call that transforms a `.md` file lives in
> `app.tsx`, which doesn't get re-evaluated when only the `.md` file changed, so the app reloads but
> shows stale content.

## Macro

The macro (`docs/src/macro.ts`, exported as `elt_md()`) recursively globs `docs/md/**/*.md`
(resolved from `import.meta.dir`, not `process.cwd()`, so it works regardless of the directory
`bun` was launched from).

For each discovered file, it writes a generated TypeScript module at
`docs/src/md/<path-without-.md>.tsx` (see "Generated pages") only if that target is missing or
older than the source `.md` file. Generated pages use the `.tsx` extension, not `.ts` — they
contain literal JSX, and TypeScript only parses JSX syntax in `.tsx` files.

The macro also (over)writes, as side effects, on every call:

- `docs/src/md-deps.ts`: one `import "../md/<file>" with { type: "text" }` line per discovered
  `.md` file. This is the only way to register each file as a bundler-watched dependency, since the
  macro's own `Bun.file()` reads do not count as bundler dependencies.
- `docs/src/routes.generated.ts`: the route table and menu (see "Routing" and "Menu").

Both writes are skipped when the newly generated content already matches what's on disk — this is
what stops each write from re-triggering itself, since editing either file is itself a watched
change that would otherwise call `elt_md()` again.

`docs/src/md`, `docs/src/md-deps.ts`, and `docs/src/routes.generated.ts` are gitignored.

The route table and menu are recomputed from scratch on every `elt_md()` call, regardless of
whether any individual page's `.tsx` file was stale — computing them only needs frontmatter and a
line-numbered scan for `@full-example` fences, not a full parse, so they are cheap enough to never
be stale even when the underlying page file itself was skipped this run.

> Why: the router file recomputing routes/menu on every call, rather than being conditionally
> regenerated, means a frontmatter-only edit (a title, an `order`, a `section`) is reflected
> immediately, without needing a separate "does the route table need to change" staleness check.

## Router

`docs/src/routes.ts` is a small, hand-written, tracked file. It contains:

- The watching import: `import "./md-deps"`.
- The macro call: `import { elt_md } from "./macro.ts" with { type: "macro" }` followed by
  `await elt_md()`.
- A re-export of the generated route table and menu: `export { routes, menu } from
  "./routes.generated.ts"`.

`docs/src/app.tsx` imports `{ routes, menu }` from `docs/src/routes.ts` and calls
`app.setupRouter(routes)` itself.

## Routing

Each generated page gets its own literal, static route entry in `routes.generated.ts` — not a
runtime loop building `() => import(`./md/${name}.tsx`)` from a computed path.

> Why: Bun's client-side bundler only code-splits a dynamic `import()` when its argument is a
> static string literal. A runtime loop computing the import path from a variable does not resolve
> at runtime — the browser fetches a URL Bun never registered as a chunk and gets the SPA's HTML
> fallback back, with a "MIME type" error, instead of the module (confirmed by testing).

Route URL, given a `.md` file's path relative to `docs/md/`:

- The root `index.md` maps to `/`.
- Any other file directly under `docs/md/` maps to `/<filename>` (extension stripped).
- A file under one or more subdirectories maps to `/<dir>/.../<file>`, nesting for however deep the
  subdirectory goes. A nested `index.md` (e.g. `guide/index.md`) is **not** special-cased the way
  the root one is — it maps to `/guide/index`, not `/guide`.

The route's *name* (its key in the route table, and the page's generated file path under
`docs/src/md/`) is the same path, dots and slashes kept as-is (e.g. `"guide/intro"`).

Each route entry in `routes.generated.ts` is preceded by a comment citing its markdown source (see
"Generated file provenance"), and reads:

```ts
// docs/md/<path>.md:1
"<name>": ["<url>", () => import("./md/<path>.tsx")],
```

## Generated pages

Each generated `docs/src/md/<path>.tsx` file:

- Default-exports a `Service` subclass (an elt `ServiceBuilder`) whose `Content()` view renders the
  page.
- Named-exports `frontmatter`, the page's parsed frontmatter object.

Relative `.md` links inside the page (`./x.md`, `../dir/x.md`) are rewritten at generation time into
hash-routes matching this same URL scheme (e.g. `./using-elt.md` from `index.md` becomes
`#/using-elt`).

## Code fences

A fenced code block is handled one of four ways:

- **Non-TypeScript fences** (any language other than `ts`/`tsx`) are highlighted (via Shiki, at
  generation time) and displayed as-is. They are never treated as examples, regardless of content.
- **Plain `ts`/`tsx` fences** (no first-line annotation) are highlighted and displayed as legible
  code only — not type-checked, not executed. They don't need to be valid standalone TypeScript;
  they may be illustrative fragments.
- **`@inline-example` fences**: a `ts`/`tsx` fence whose first line is exactly `//@inline-example`.
  Its own `import` lines are merged (deduplicated by exact line text) into the generated page's
  top-level imports; its remaining body is spliced into the page as a real function, executed at
  page-module-load time — not via `new Function`, not via any hardcoded/stripped import mechanism.
  Its result (or a caught error) is passed to `CodeExample` as `renderResult`/`renderError`. The
  code is still displayed verbatim (marker line stripped) as highlighted text for the "Typescript"
  tab.
- **`@full-example` fences**: a `ts`/`tsx` fence whose first line is exactly `//@full-example`. Its
  own generated file (`docs/src/md/<page-path>.full-<n>.tsx`, `n` = 0-based index of full-example
  blocks on that page, in document order) is a complete, standalone module — its own `import`s are
  never merged with the page's or with any other example's. Its default export is a `Service`
  subclass, exactly like a page's, registered as its own route
  (`/full-example/<page-name>/<n>`). It runs inside an `<iframe>` pointed at that route — a
  same-origin route served by the same running `bun` dev server, so no separate bundle or import
  map is needed; the iframe is a separate browsing context (its own window/document/JS realm), which
  is the actual isolation boundary, not a separate build. That route renders with no app nav chrome
  around it (see `app.tsx`'s `oo_is_full_example`).

Both `@inline-example` and `@full-example` snippet bodies are authored to end with a top-level
`return <jsx/>` — the same convention the current inline-execution model already uses.

> Why (security framing): `@inline-example` still executes first-party, trusted code with no
> sandbox — the same trust model as today, just via a real module import instead of `new Function`.
> Moving execution into real module code fixes the *reload freshness* and *forced imports* problems
> from the Objectives; it is not a security boundary. Only `@full-example`'s iframe is an actual
> isolation boundary (a separate browsing context).

## Generated file provenance

Every block the macro generates into `docs/src/md/<path>.tsx`, `docs/src/md/<path>.full-<n>.tsx`,
and `routes.generated.ts` is preceded by a comment citing its markdown source as
`docs/md/<file>:<line>` — the source `.md` file and the 1-based line number the block started at
(a fence's opening line for a code block; line 1 for frontmatter and for a page's own route entry).

This applies to macro-generated *output* — it does not apply to the macro's own hand-written source
(`macro.ts`), or to any other hand-written file (`app.tsx`, `routes.ts`, `code-example.tsx`, …),
which follow ordinary comment rules instead.

`routes.ts` (the hand-written loader, not the generated route table) does not itself carry
per-route provenance comments — each page's own generated file carries its own instead. A
route-table entry built from live, always-current macro output (see "Macro") rather than from
static text would make a per-entry comment either meaningless or, if it forced the route table back
into being regenerated text elsewhere, would reintroduce the staleness problem described in the
Macro section's "Why". `routes.generated.ts`, which *is* generated text, carries the comments.

## Menu

`elt_md()` returns (and `routes.generated.ts` exports) a menu: pages grouped by frontmatter
`section` (a page with no `section` is ungrouped/top-level), sorted within each group by
frontmatter `order` (pages with no `order` sort last within their group, then by title). Ungrouped
pages are listed before any section group; section groups are sorted alphabetically by name.

`docs/src/app.tsx`'s nav widget renders this menu directly (as a list of `<a href="#<url>">` links,
grouped the same way), rather than iterating any in-memory list of parsed docs — no such in-memory
list exists anymore; every page is a separately lazy-loaded module.

## Type-checking

The macro does no type-checking of code fences (the previous `tsgo`-based
snippet-type-checking machinery — temp files, wrapped snippets, line-remapped diagnostics — is
removed entirely, along with its inline error display in the UI).

Instead, `just watch-docs` runs the docs dev server (`bun run`, from `docs/`) piped through `awk`,
which passes all of the server's output through unchanged and, on every line matching `Bundled page
in` (first load) or `Reloaded in` (a rebuild just happened, optionally prefixed with a `[x<N>]`
coalesced-event count), shells out to a full, unscoped `tsgo --noEmit -p tsconfig.json | wtsc` pass
over the whole `docs/` project — regardless of which single file triggered the rebuild.

> Why: `bun run`'s dev server only strips TypeScript types syntactically; it never type-checks them
> (confirmed against Bun's documented behavior). There is no other type-checking net over `docs/` —
> the root `check-types` script only covers `src/`, `ui/`, `editor/`, and root `tests/`, there is no
> CI, and no pre-commit hook — so without this recipe, a type error in a doc example would pass
> through completely silently.
