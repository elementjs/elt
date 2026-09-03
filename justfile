# salesway-discovery — ported from Makefile


export PATH := "./node_modules/.bin:" + env("PATH")

watch:
    tsgo -w --noEmit | wtsc

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
