# salesway-discovery — ported from Makefile


export PATH := "./node_modules/.bin:" + env("PATH")

watch:
    tsgo -w --noEmit | wtsc

# run the docs dev server, type-checking docs/ on every (re)build. The macro that generates docs
# pages does no type-checking of its own (see specs/markdown-docs-reloaded.md, "Type-checking") —
# `bun index.html` only strips types, it never checks them — so this pipes its output through awk,
# printing it unchanged, and on every "Bundled page in ..."/"Reloaded in ..." line (a rebuild just
# happened) shells out to a real `tsgo --noEmit` pass over the whole docs/ project.
watch-docs:
    cd docs && bun index.html 2>&1 | awk '{ print; fflush(); if ($0 ~ /^(Bundled page in|(\[x[0-9]+\] )?Reloaded in)/) system("tsgo --noEmit -p tsconfig.json | wtsc") }'

check-compile:
    tsgo --noEmit | wtsc

# check typings and coding style
check:
    biome check && (tsgo --noEmit | wtsc)

# fix formatting across the whole project
format:
    biome format --write
    biome lint --write
    biome check --write --formatter-enabled=false --linter-enabled=false

# apply only safe, mechanical biome fixes (formatter + safe lint fixes, e.g.
# useConst/useArrowFunction/useTemplate) -- never --unsafe, no behavior changes
lint-fix-safe:
    biome check --write

# full strictness (incl. noExplicitAny) on files changed since the biome
# transformation baseline (see specs/biome.md) -- the backlog in older files
# doesn't block until it's deliberately paid down
lint-changed:
    biome check --changed --since=biome-baseline

# per-rule violation counts, used to update the progress table in specs/biome.md
lint-summary:
    biome check --reporter=summary --max-diagnostics=2000
