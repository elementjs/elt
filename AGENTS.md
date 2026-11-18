# Elt - Agent Context

This file is for working **on elt itself**. It is not shipped with the package; agents using elt in another project start from the documentation instead.

- **Never do** what [`docs/md/hard-dont.md`](./docs/md/hard-dont.md) lists, and, when working with or in `ui/` or `editor/`, what [`docs/md/ui-hard-dont.md`](./docs/md/ui-hard-dont.md) lists. They matter more than everything else in this file. `just check` enforces part of them.
- Be sure to [respect elt rules](docs/md/elt-rules.md)
- If working with or in elt/ui, [respect its rules as well](docs/md/elt-ui-rules.md)

## Docs (progressive disclosure)

The documentation's entry point is [`docs/md/index.md`](./docs/md/index.md).
The rules `elt-rules.md` matter most, and `elt-ui-rules.md` when using elt/ui.

Always keep the docs up to date when changing/adding features.

## Commands

Explore the `justfile` for all project-related commands.

## Repo map

| Path | Role |
| ---- | ---- |
| `src/` | Core elt (observables, DOM, verbs, decorators, App) |
| `ui/` | `elt/ui` sub-library — maintainer rules in [`ui/AGENTS.md`](./ui/AGENTS.md) |
| `editor/` | `elt/editor`, the object editor (unstable) |
| `docs/md/` | The documentation (source of truth): guides, reference, topic pages. Every `.md` here becomes a page of the docs site |
| `docs/src/` | The docs site itself — an elt app (`app.tsx`) plus the markdown-to-page build (`macro.ts`) |
| `docs/src/adr/` | Architecture decision records |
| `tests/` | Playwright tests (`*.pw.ts`), the browser harness (`tests/browser/`) and the benchmark (`tests/bench/`, run by `just bench`) |
| `specs/` | Temporary implementation specs. Deleted once implemented and their content moved to `docs/md/`; never linked from docs |

# Instructions

- Do **NOT** wrap lines in markdown
- Write so most developers get it without knowing scoped community slang; define our terms; never reuse a common word in a special sense when “toolbar”, “header”, or “frame around the content” would do unless the term is universally understood, like "packaging" or "drill-down".
- Fix root causes instead of patching around structural problems, ask the user if the fix is structurally important
- Do NOT add dependencies by yourself
- ALWAYS Create regression and integration tests when working on new features or when features did not already have them. Only test project-specific behavior, business rules and edge cases that could realistically break; never the language, Bun, the browser or a library, trivial getters/setters, or values copied from the source. A test's title is a claim its assertions must prove. For styles, test invariants (relations between elements: packed elements share one line, every control has the same height), not choices (bold or not, a cursor, a padding value). Check the behavior isn't already tested elsewhere before adding a test
- Test your claims/assertions instead of only recalling when your confidence level is not impeccable
- DRY : keep the code simple, avoid repetitions and factorize code whenever possible. When introducing new features and code, always check existing code for similar functionality or pathways that can be adapted to suit both current behaviour and new functionality. Always check if a helper function was already implemented somewhere in the code before deciding to create another.
- Implementations MUST always be the most efficient CPU/RAM wise. If a compromise is to be made, prompt the user
- Always prompt the user whenever you deem an important architectural decision is to be made (adding/removing a library, implementation details/philosophy, performance concerns)
- Explain the code through terse comments when implementing. Only comment project-specific behaviour, business rules and edge cases. Do not explain trivial things like how the language work.
- Maintain `./docs` <-> code relevance. Do not let it drift.
- Use `biome format --write` when done writing code
- Specs are implementative works and are eventually deleted ; they can't be the source of truth. Documentation is. Documentation NEVER links to specs. When a spec is to be removed, ensure the relevant parts missing from the docs are merged there.
