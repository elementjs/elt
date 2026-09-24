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

For each discovered file, it writes a generated JSX module at
`docs/src/md/<path-without-.md>.tsx` (see "Generated pages") only if that target is missing or
older than the source `.md` file. Generated pages use the `.tsx` extension, not `.ts` — they
contain literal JSX, and TypeScript only parses JSX syntax in `.tsx` files.

The macro also (over)writes, as side effects, on every call:

- `docs/src/md-deps.ts`: one `import "../md/<file>" with { type: "text" }` line per discovered
  `.md` file. This is the only way to register each file as a bundler-watched dependency, since the
  macro's own `Bun.file()` reads do not count as bundler dependencies.
- `docs/src/routes.generated.ts`: the route table (see "Routing"). Building it only needs each
  page's name/URL and a cheap line-numbered scan for `@full-example` fences — not a full parse — so
  it's cheap enough to recompute from scratch on every call, regardless of whether any individual
  page's own `.tsx` file was stale this run.

Both writes are skipped when the newly generated content already matches what's on disk — this is
what stops each write from re-triggering itself, since editing either file is itself a watched
change that would otherwise call `elt_md()` again.

`docs/src/md`, `docs/src/md-deps.ts`, and `docs/src/routes.generated.ts` are gitignored.

> Why: `routes.generated.ts` no longer needs to track frontmatter at all (unlike an earlier version
> of this design). Since every page is a static import (see "Routing"), the menu reads
> `<alias>.frontmatter` live off each already-imported page module at `routes.generated.ts`'s own
> module-eval time — so a frontmatter-only edit (a title, an `order`, a `section`) is picked up the
> moment the page's own `.tsx` file regenerates, with no separate "does the route table need to
> change" staleness tracking needed for frontmatter specifically. The route table still needs
> recomputing when the file list changes, or when a page's `@full-example` count changes (that
> shapes literal route entries — see "Routing") — both cheap, non-full-parse scans.

## Router

`docs/src/routes.ts` is a small, hand-written, tracked file. It contains:

- The watching import: `import "./md-deps"`.
- The macro call: `import { elt_md } from "./macro.ts" with { type: "macro" }` followed by
  `await elt_md()`.
- A re-export of the generated route table and menu: `export { routes, menu } from
  "./routes.generated.ts"`.

`docs/src/app.tsx` imports `{ routes, menu }` from `docs/src/routes.ts` and calls
`app.setupRouter(routes)` itself.

`docs/src/menu.ts` is a small, hand-written, tracked file holding `Frontmatter`, `MenuEntry`,
`MenuGroup`, and the `buildMenu()` function — re-exported from `macro.ts` for macro-internal use,
but defined in its own file with no top-level Bun-only code.

> Why: `routes.generated.ts` needs `buildMenu` as a genuine runtime import (not a
> `{ type: "macro" }` one — see "Menu"), and `macro.ts` has top-level Bun-only code (`new
> Bun.Glob(...)`, etc, needed for the macro's own file-scanning). A plain `import { buildMenu } from
> "./macro.ts"` would pull that Bun-only code into the browser bundle too, since a normal import
> isn't limited to the one named binding it asks for at the module-graph level — confirmed by
> testing (a live page load threw `ReferenceError: Bun is not defined` before this split).

## Routing

Every discovered page is a literal, static import in `routes.generated.ts`:

```ts
import * as <alias> from "./md/<path>.tsx"
```

`<alias>` is a valid-JS-identifier form of the route name (e.g. `"guide/intro"` →
`md_guide_intro`); a name that would collide with another page's alias after sanitizing gets a
numeric suffix. Each page's route reads its service directly and synchronously:

```ts
"<name>": ["<url>", () => <alias>.PageService],
```

`@full-example` routes are the one exception: they stay lazily, dynamically imported (see "Code
fences"):

```ts
"<name>__full-<n>": ["/full-example/<name>/<n>", () => import("./md/<path>.full-<n>.tsx")],
```

> Why (static imports, not lazy per-page loading): an earlier version of this design used
> `() => import("./md/<name>.tsx")` per page — a *dynamic* import, needed at the time because Bun's
> client-side bundler only code-splits a dynamic `import()` with a static string-literal argument (a
> runtime loop building the import path from a variable doesn't resolve — confirmed by testing). A
> static top-level `import`, by contrast, isn't trying to code-split at all — every page's code
> loads eagerly, in one bundle, on first load. This is an accepted trade-off: it lets the menu read
> each page's `frontmatter` as a plain, already-resolved value (see "Menu") instead of needing to
> await every page's module just to build a nav list, and it lets each route's service be a plain
> synchronous class reference. `@full-example` blocks keep lazy loading, since nothing needs their
> code until the block is actually viewed.

Route URL, given a `.md` file's path relative to `docs/md/`:

- The root `index.md` maps to `/`.
- Any other file directly under `docs/md/` maps to `/<filename>` (extension stripped).
- A file under one or more subdirectories maps to `/<dir>/.../<file>`, nesting for however deep the
  subdirectory goes. A nested `index.md` (e.g. `guide/index.md`) is **not** special-cased the way
  the root one is — it maps to `/guide/index`, not `/guide`.

The route's *name* (its key in the route table, and the page's generated file path under
`docs/src/md/`) is the same path, dots and slashes kept as-is (e.g. `"guide/intro"`).

## Generated pages

Each generated `docs/src/md/<path>.tsx` file:

- Named-exports `PageService`, a `Service` subclass (an elt `ServiceBuilder`) whose `Content()`
  view renders the page. It is **not** a default export.
- Named-exports `frontmatter`, the page's parsed frontmatter object.

> Why (named export, not default): `routes.generated.ts` reads `<alias>.PageService` off the
> statically-imported module namespace object; a default export has no name in that object (it's
> only reachable as `<alias>.default`), so it has to be named to be addressed this way.

Relative `.md` links inside the page (`./x.md`, `../dir/x.md`) are rewritten at generation time into
hash-routes matching this same URL scheme (e.g. `./using-elt.md` from `index.md` becomes
`#/using-elt`).

### Rendering: no runtime tree-walker

The macro compiles markdown directly to literal JSX source text at generation time — a heading
becomes the literal generated text `<h1 id="...">...</h1>`, not a JSON tuple (`["heading", {...},
[...]]`) handed to a runtime interpreter. There is no `e2.tsx`, and no such runtime interpreter.

Every markdown text node is spliced as a JSON-stringified string inside a JSX expression container
(`{"some text with { and < in it"}`), never as bare JSX text — this is what makes arbitrary prose
(including literal `{`, `}`, `<`, `>`, backslashes, or quotes an author happens to type) always
safe to splice directly into generated source, regardless of content.

Markdown's raw-HTML nodes (literal HTML written directly in a `.md` file's source) are the one
exception: they are spliced **verbatim**, unescaped, as literal JSX source at that exact position.

> Why: this makes literal HTML in markdown source the docs writer's responsibility, not the macro's
> problem to work around. If that HTML isn't valid JSX (an unclosed tag, a bare `<br>` with no
> trailing slash, a non-self-closing void element), the generated file simply fails to build. This
> is deliberate — see `docs/md/about-this-documentation.md`, which explains this to docs writers in
> plain terms, not implementation detail.

Code fences are compiled to a literal `<CodeExample .../>` call at their exact position (see "Code
fences" — `CodeExample` itself, `docs/src/code-example.tsx`, is a hand-written, ordinary component,
not something this section's provenance/generation rules apply to).

Syntax highlighting uses Shiki's `codeToTokens` (structured per-line, per-token color data), not
`codeToHtml` (an HTML string). The macro compiles that token data into literal JSX: one `<span
style="color:...">` per colored token, plain text for uncolored runs, lines joined by literal
`"\n"` text children so they render as separate lines inside a `<pre>`.

> Why: this is what "plain `.tsx`, no `.innerHTML`" means concretely. `docs/src/e2.tsx` (deleted)
> and the old `code-example.tsx` both used `div.innerHTML = <html string>` to render markdown's raw
> HTML nodes and Shiki's highlighted output respectively — real DOM nodes built from an
> unauditable string, not something a strict CSP would allow inline. Every rendered node is now
> either a real DOM/JSX construction the macro or `CodeExample` builds directly, or (only for raw
> HTML in markdown source, above) literal source text compiled the same way any other JSX in the
> file is.

## Code fences

A fenced code block is handled one of four ways:

- **Non-TypeScript fences** (any language other than `ts`/`tsx`) are highlighted (via Shiki, at
  generation time) and displayed as-is. They are never treated as examples, regardless of content.
- **Plain `ts`/`tsx` fences** (no first-line annotation) are highlighted and displayed as legible
  code only — not type-checked, not executed. They don't need to be valid standalone TypeScript;
  they may be illustrative fragments.
- **`@inline-example` fences**: a `ts`/`tsx` fence whose first line is exactly `//@inline-example`.
  Its own `import` lines are merged into the generated page's top-level imports (see "Import
  merging" — not by exact-line-text dedup); its remaining body runs inside `runExample(() => {
  ...body })`, called directly at the code fence's position in the generated JSX
  (`<CodeExample ... {...runExample(() => {...})} />`). `runExample`
  (`docs/src/code-example.tsx`) tries the body and returns `{ renderResult }` on success or
  `{ renderError }` on a throw, spread onto `CodeExample`'s props — this replaces the old
  once-at-module-load JSON-tree evaluation; the example now (correctly) re-runs every time
  `Content()` is called, not just once when the page's module first loads. The code is still
  displayed verbatim (marker line stripped) as highlighted text for the "Typescript" tab.
- **`@full-example` fences**: a `ts`/`tsx` fence whose first line is exactly `//@full-example`. Its
  own generated file (`docs/src/md/<page-path>.full-<n>.tsx`, `n` = 0-based index of full-example
  blocks on that page, in document order) is a complete, standalone module — its own `import`s are
  never merged with the page's or with any other example's (no "Import merging" rules apply to
  it). Its default export is a `Service` subclass (a default export is fine here — unlike a page,
  it stays lazily dynamic-imported, so nothing ever needs to address it by name off a static
  module namespace object), registered as its own route (`/full-example/<page-name>/<n>`). It runs
  inside an `<iframe>` pointed at that route — a same-origin route served by the same running `bun`
  dev server, so no separate bundle or import map is needed; the iframe is a separate browsing
  context (its own window/document/JS realm), which is the actual isolation boundary, not a
  separate build. That route renders with no app nav chrome around it (see `app.tsx`'s
  `oo_is_full_example`).

Both `@inline-example` and `@full-example` snippet bodies are authored to end with a top-level
`return <jsx/>` — the same convention the current inline-execution model already uses.

> Why (security framing): `@inline-example` still executes first-party, trusted code with no
> sandbox — the same trust model as today, just via real module code (`runExample`) instead of
> `new Function`. Moving execution into real module code fixes the *reload freshness* and *forced
> imports* problems from the Objectives; it is not a security boundary. Only `@full-example`'s
> iframe is an actual isolation boundary (a separate browsing context).

## Import merging

`@inline-example` blocks on the same page share one set of top-level imports. Rather than
deduplicating by exact import-line text (which fails the moment two blocks import an overlapping
but not-identical set of names from the same module — e.g. `{ o, $bind }` and `{ o, node_append }`
from `"elt"` would otherwise both declare a local `o`, a real `SyntaxError`), the macro parses each
import line structurally and merges by module and by `(imported name, local name)` pair.

Only these five single-line forms are recognized:

- side-effect: `import "mod"`
- default: `import Foo from "mod"`
- namespace: `import * as ns from "mod"`
- named, with aliases: `import { a, b as c } from "mod"`
- default + named: `import Foo, { a, b as c } from "mod"`

Anything else on an `@inline-example` import line — a multi-line statement, `import type ...`,
`import Foo, * as ns from "mod"`, a dynamic `import(...)` — is a **build-time error**, citing the
exact `docs/md/<file>:<line>` of the offending example.

Merging rules, per module specifier, across every `@inline-example` block on the page:

- Identical named/namespace/default bindings (same local name, same imported name, same module)
  across two blocks collapse to one declaration.
- A genuine conflict — the same local name bound to something different (a different imported
  name, or a different module) across two blocks — is a **build-time error**, citing both
  `docs/md/<file>:<line>` locations. There is no override; the docs writer picks a different local
  name in one of the two examples.
- Two blocks requesting different local names for the same module's *default* export (e.g. `import
  Foo from "mod"` and `import Bar from "mod"`) is not a conflict (both are legal separate
  statements), but also can't merge into one `import Foo, Bar from "mod"` (only one default clause
  per statement is valid) — the merge emits two separate default-import lines instead.

> Why: this is intentionally a narrow, well-defined subset of ECMAScript's import grammar, not a
> general parser — anything outside it fails loudly (a build error naming the file and line) rather
> than being silently mishandled. `docs/md/about-this-documentation.md` documents this constraint
> for docs writers in plain terms.

## Generated file provenance

Every block the macro generates into `docs/src/md/<path>.tsx`, `docs/src/md/<path>.full-<n>.tsx`,
and `routes.generated.ts` is preceded by a comment citing its markdown source as
`docs/md/<file>:<line>` — the source `.md` file and the 1-based line number the block started at
(a fence's opening line for a code block; line 1 for frontmatter and for a page's own route entry).

This applies to macro-generated *output* — it does not apply to the macro's own hand-written source
(`macro.ts`), or to any other hand-written file (`app.tsx`, `routes.ts`, `menu.ts`,
`code-example.tsx`, …), which follow ordinary comment rules instead.

## Menu

`docs/src/menu.ts` exports `buildMenu(pages)`, grouping pages by frontmatter `section` (a page with
no `section` is ungrouped/top-level), sorted within each group by frontmatter `order` (pages with
no `order` sort last within their group, then by title). Ungrouped pages are listed before any
section group; section groups are sorted alphabetically by name.

`routes.generated.ts` calls `buildMenu()` itself, at its own module-eval time, over an array built
from each statically-imported page's live `frontmatter` export:

```ts
export const menu = buildMenu([
  { name: "<name>", url: "<url>", frontmatter: <alias>.frontmatter },
  ...
])
```

`docs/src/app.tsx`'s nav widget renders this menu directly (as a list of `<a href="#<url>">` links,
grouped the same way), rather than iterating any separately-cached list of parsed docs.

## About-this-documentation page

`docs/md/about-this-documentation.md` is a normal docs page (appears in the menu like any other,
ungrouped, `order: 0`) explaining — for a docs-writer audience, in plain non-implementation terms —
the three code-fence kinds and how to mark them, that raw HTML in markdown source must be valid
JSX, the import-merging rules for `@inline-example` blocks, and frontmatter's effect on the menu.

## Type-checking

The macro does no type-checking of code fences (the previous `tsgo`-based
snippet-type-checking machinery — temp files, wrapped snippets, line-remapped diagnostics — is
removed entirely, along with its inline error display in the UI).

Instead, `just watch-docs` runs the docs dev server (`bun run`, from `docs/`) piped through `awk`,
which passes all of the server's output through unchanged and, on every line matching `Bundled page
in` (first load) or `Reloaded in` (a rebuild just happened, optionally prefixed with a `[x<N>]`
coalesced-event count), shells out to a full, unscoped `tsgo --noEmit -p tsconfig.json | wtsc` pass
over the whole `docs/` project — regardless of which single file triggered the rebuild.

`docs/tsconfig.json`'s `compilerOptions.types` is `["bun"]` (resolving to the installed `@types/bun`
package). It must not be `["bun-types"]` — no such package is installed, and that value makes
`tsgo -p docs/tsconfig.json` fail immediately with `TS2688`, unable to check anything at all.

> Why: `bun run`'s dev server only strips TypeScript types syntactically; it never type-checks them
> (confirmed against Bun's documented behavior). There is no other type-checking net over `docs/` —
> the root `check-types` script only covers `src/`, `ui/`, `editor/`, and root `tests/`, there is no
> CI, and no pre-commit hook — so without this recipe, a type error in a doc example would pass
> through completely silently.

> Thoughts: running `tsgo -p docs/tsconfig.json` with a correct `types` value surfaces a large
> number of pre-existing type errors across `src/`/`ui/` themselves (not in `docs/` — confirmed by
> scoping a check to just `docs/src/**`, which is clean), apparently because this is the first time
> that tsconfig has ever successfully resolved far enough to walk that graph. Those errors predate
> this spec and are out of its scope; fixing them is a separate, standalone cleanup.
