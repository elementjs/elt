---
title: About this documentation
order: 0
---

# About this documentation

This page is for anyone writing or editing the `.md` files under `docs/md/`. It explains, from a writer's point of view, how a markdown file becomes a docs page — not the implementation, just what you need to know to write a page that works.

## Code blocks: three kinds

A fenced code block (` ```tsx ... ``` `) can behave in one of three ways, depending on its first line:

- **A plain code block** — no special first line — is just displayed, highlighted for readability.
  It does not need to be valid, runnable code: a short illustrative fragment, a "don't do this" example, or pseudocode is fine.

- **An inline, live example** — start the block with `//@inline-example` as its very first line.
  The rest of the block runs for real, right there on the page, and its result is shown next to the code. Bring your own imports at the top of the block (e.g. `import { o } from "elt"`); end the block with `return <your JSX/>`.
  The block only runs when its result area first comes near the visible part of the page, so a page with many or heavy examples doesn't render them all when it opens. It runs once: its result stays when you scroll away or switch to the code. Keep everything the example needs inside the block, data included (generate large data at runtime rather than writing it out): readers see only the block, not other files.

- **A full, isolated example** — start the block with `//@full-example` instead. This also runs for
  real, but inside its own isolated frame on the page (not mixed in with the rest of the page). Use this for anything that shouldn't share state or styles with the surrounding page. Same convention: your own imports, ending with `return <your JSX/>`.

Any other language (bash, json, css, …) is always just displayed — there's no live/example mode for non-TypeScript blocks.

## Raw HTML/TSX in a markdown file

If you write literal HTML directly in a `.md` file (e.g. `<div class="note">...</div>`), it directly becomes typescript tsx code when the page is built — it is **not** run through a forgiving HTML parser. Write it the way you'd write JSX: close every tag, including "void" ones like `<br/>` or `<img src="..."/>` (with the trailing slash). Malformed HTML here will fail the whole page's build, not just quietly render wrong — treat it the same care you'd give to any other code you write.

## Imports across multiple `@inline-example` blocks on one page

When a page has more than one `@inline-example` block, their imports are combined into one set at the top of the generated page. Two rules keep that combination unambiguous:

- **Reuse the same name for the same thing.** If one example does `import { o } from "elt"` and
  another example on the same page also needs `o` from `"elt"`, just write `import { o } from "elt"` again in the second block — it'll be combined into one, not imported twice.
- **Don't reuse a name for two different things.** If one example imports something as `x` and
  another example on the same page imports something *different* as `x` (even from a different module), the page will fail to build. Pick a different local name in one of the two examples.

Only single-line import statements are understood (e.g. `import { a, b as c } from "mod"`, `import Foo from "mod"`, `import * as ns from "mod"`, `import "mod"`, or `import Foo, { a, b as c } from "mod"`). Don't split an import across multiple lines, and don't use `import type` inside an example — regular imports are fine even for types, since these blocks aren't separately type-checked at build time.

## Page metadata

A `.md` file can start with a frontmatter block:

```
---
title: My Page
section: Guides
order: 1
---
```

`title` sets the page's name in the nav menu (falling back to the file's first heading if omitted). `section` groups pages together in the nav menu (pages with no `section` appear ungrouped, above any sections). `order` controls a page's position within its group (lower first; pages with no `order` sort last, then alphabetically by title).
