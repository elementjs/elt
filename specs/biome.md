# Biome transformation — tracking

Adopting `biome.json`'s stricter rules (`noExplicitAny: error`, plus biome's recommended set) across a codebase that predates it. Not a spec — a living log of where the paydown stands. Update the table below after each phase using `just lint-summary`.

Baseline: git tag `biome-baseline` → commit `6e887ba` (before any biome-driven changes landed).

## Commands (`justfile`)

- `just lint-fix-safe` — formatter + safe lint fixes only (`biome check --write`, never `--unsafe`). No behavior changes; safe to run anytime.
- `just lint-changed` — full strictness, including `noExplicitAny`, on files changed since `biome-baseline` (`biome check --changed --since=biome-baseline`). This is the ratchet: new/touched code must be clean; the untouched backlog doesn't block it.
- `just lint-summary` — per-rule violation counts across the whole project (`biome check --reporter=summary`), used to refresh the table below.
- `just check` (pre-existing) — full biome check + `tsgo --noEmit`.

## The ratchet

Old files are not held to `noExplicitAny`/etc. until deliberately paid down (Phase 2 below). Any file touched for unrelated work should still pass `just lint-changed` before landing — don't add new debt to files while passing through them, even if the file isn't part of a dedicated paydown pass yet.

## Phase plan

- [ ] **Phase 1 — the small real-correctness tail.** `noAssignInExpressions` (13), `noInnerDeclarations` (14), `noConstantCondition` (3), `noDoubleEquals` (5), `noThenProperty` (2), `noUnsafeFinally` (1), `noUnsafeDeclarationMerging` (1), `noNonNullAssertedOptionalChain` (1) — ~40 total, each a genuine "is this a bug" question, not a style nit. Worth going through individually before touching `any` at scale.
- [ ] **Phase 2 — `noExplicitAny` (346), file by file, ordered by risk × test coverage, not by count:**
  1. Small, already-tested files first (e.g. `src/decorators.ts` — 9 `any`s, covered by `tests/bind.test.ts`) — establish the workflow.
  2. `ui/*` — **zero test files exist for anything in this folder**. Add a minimal smoke test per file before touching its types, not after.
  3. Mid-size, partially-tested files (`src/dom.ts`, `src/app/*`, `src/virtual.ts`).
  4. `src/custom-elements.ts` (39, untested) — same rule as `ui/*`: tests first.
  5. `src/observable/observable.ts` last, on purpose — 191 of the ~540 remaining diagnostics, the single riskiest and most central file in the repo. Do it once the process is well-practiced elsewhere; add targeted unit tests around whatever specific `any`-typed internals get touched before changing them.

  Each file/small group: fix → `bun test` → `bun x tsc --noEmit` → review → its own commit.
  Where a real type isn't cheaply expressible: `unknown` + narrowing, or `// biome-ignore lint/suspicious/noExplicitAny: <reason>` — a visible, deliberate exception, not a silent one.
- [ ] **Phase 3 — `noNonNullAssertion` (71).** Folded into the same per-file passes as Phase 2, not a separate sweep — same file, same commit, since the type reasoning is already happening there.

## Decisions made

- `noExplicitAny` stays `"error"` in `biome.json` throughout (not downgraded to `"warn"`) — the ratchet (`lint-changed`) is what keeps it from being blocking noise on untouched files, so there's no need to soften the rule itself.
- Baseline tag lives at the start of the transformation, before Phase 0 — Phase 0's own diff is safe by construction (introduces no new `any`s) so it doesn't matter that it postdates the tag.

## Progress

Re-run `just lint-summary` and update this table after each phase.

| Date | Milestone | Errors | Warnings | Infos | Total |
| --- | --- | --- | --- | --- | --- |
| 2026-09-01 | Before any biome work (`biome-baseline`) | 434 | 282 | 34 | 750 |
| 2026-09-01 | After Phase 0 (safe fixes) | 389 | 126 | 25 | 540 |

### By rule, after Phase 0

| Rule | Count | Phase |
| --- | --- | --- |
| `suspicious/noExplicitAny` | 346 | 2 |
| `style/noNonNullAssertion` | 71 | 3 |
| `correctness/noUnusedFunctionParameters` | 21 | unscoped — likely folds into whichever phase touches that file |
| `correctness/noInnerDeclarations` | 14 | 1 |
| `suspicious/noAssignInExpressions` | 13 | 1 |
| `correctness/noUnusedVariables` | 13 | unscoped |
| `complexity/noBannedTypes` | 13 | 2 (usually goes with `any` cleanup) |
| `style/useTemplate` | 18 | unscoped, cheap, low-risk |
| `complexity/useLiteralKeys` | 6 | unscoped, cheap, low-risk |
| `suspicious/noDoubleEquals` | 5 | 1 |
| `suspicious/noConfusingVoidType` | 3 | unscoped |
| `correctness/noConstantCondition` | 3 | 1 |
| `complexity/noArguments` | 3 | unscoped |
| `suspicious/noThenProperty` | 2 | 1 |
| `a11y/useButtonType` | 2 | unscoped, `ui/*` |
| `suspicious/noUnsafeFinally` | 1 | 1 |
| `suspicious/noUnsafeDeclarationMerging` | 1 | 1 |
| `suspicious/noNonNullAssertedOptionalChain` | 1 | 1 |
| `correctness/noUnusedImports` | 1 | unscoped, cheap |
| `complexity/noCommaOperator` | 1 | unscoped, cheap |
| `complexity/noUselessLoneBlockStatements` | 1 | unscoped, cheap |
| `a11y/noSvgWithoutTitle` | 1 | unscoped, `ui/icons.tsx` presumably |

### By file (diagnostic count before Phase 0 — biome doesn't cheaply re-report per-file totals, only per-rule; re-derive with `biome check --max-diagnostics=2000 | grep -oE '^(src|ui|tests)/[^:]+' | sort | uniq -c | sort -rn` if a fresh per-file view is needed)

| File | Count | Tested? |
| --- | --- | --- |
| `src/observable/observable.ts` | 191 | yes (extensively) |
| `tests/observable.test.ts` | 58 | n/a (is a test file) |
| `src/verbs.ts` | 58 | yes (via Repeat/VirtualScroll tests) |
| `src/app/service.ts` | 53 | yes |
| `src/dom.ts` | 43 | indirectly (foundational, exercised by most tests) |
| `src/custom-elements.ts` | 39 | **no** |
| `ui/icons.tsx` | 30 | **no** |
| `tests/typings.ts` | 29 | n/a |
| `tests/repeat.test.ts` | 17 | n/a |
| `src/app/route.ts` | 17 | yes |
| `src/app/app.ts` | 17 | yes |
| `src/virtual.ts` | 16 | yes |
| `src/app/state.ts` | 15 | yes |
| `src/elt.ts` | 13 | indirectly |
| `src/utils.ts` | 11 | indirectly |
| `src/app/router.ts` | 11 | yes |
| `src/observable/transformers.ts` | 10 | yes |
| `src/decorators.ts` | 9 | yes (`tests/bind.test.ts`, `repeat.test.ts`) |
| `ui/layout.css.tsx` and everything else in `ui/*` | 1–8 each | **no — none of `ui/*` has a dedicated test file** |
