# salesway-discovery — ported from Makefile


export PATH := "./node_modules/.bin:" + env("PATH")

watch:
    tsc -w --noEmit | wtsc

# run the docs dev server, type-checking docs/ on every (re)build. The macro that generates docs
# pages does no type-checking of its own (see specs/markdown-docs-reloaded.md, "Type-checking") —
# `bun index.html` only strips types, it never checks them — so this pipes its output through awk,
# printing it unchanged, and on every "Bundled page in ..."/"Reloaded in ..." line (a rebuild just
# happened) shells out to a real `tsc --noEmit` pass over the whole docs/ project.
watch-docs:
    cd docs && bun index.html 2>&1 | awk '{ print; fflush(); if ($0 ~ /^(Bundled page in|(\[x[0-9]+\] )?Reloaded in)/) system("tsc --noEmit -p tsconfig.json | wtsc") }'

check-compile:
    tsc --noEmit | wtsc
    rm -rf docs/src/md/*
    bun build ./docs/index.html --outdir=/tmp
    (cd docs && tsc --noEmit) | wtsc

# run every test suite: bun unit tests, then the Playwright browser tests
test: test-bun test-pw

# Playwright browser tests (tests/**/*.pw.ts); extra arguments go to playwright, e.g. `just test-pw tests/grid.pw.ts`
test-pw *args:
    playwright test {{args}}

# bun unit tests (*.test.ts, currently docs/src/macro.test.ts)
test-bun *args:
    bun test {{args}}

# check typings and coding style
check:
    biome check && just check-compile

# fix formatting across the whole project
format:
    biome format --write
    biome lint --write
    biome check --write --formatter-enabled=false --linter-enabled=false

# apply only safe, mechanical biome fixes (formatter + safe lint fixes, e.g.
# useConst/useArrowFunction/useTemplate) -- never --unsafe, no behavior changes
lint-fix-safe:
    biome check --write

# per-rule violation counts across the whole project
lint-summary:
    biome check --reporter=summary --max-diagnostics=2000
