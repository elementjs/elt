# elt — development commands: type-checking, linting, the docs site and the test suites.
# `just --list` shows every recipe.

# The project's own tools (tsc, wtsc, biome, playwright) before any global ones, also after a `cd`.
export PATH := justfile_directory() + "/node_modules/.bin:" + env("PATH")

watch:
    tsc -w --noEmit | wtsc

# run the docs dev server, type-checking docs/ on every (re)build. The macro that generates docs
# pages does no type-checking of its own — `bun index.html` only strips types, it never checks them
# (design notes: `git show 0153257^:specs/markdown-docs-reloaded.md`, "Type-checking") — so this
# pipes its output through awk, printing it unchanged, and on every "Bundled page in ..."/"Reloaded
# in ..." line (a rebuild just happened) shells out to a real `tsc --noEmit` pass over the whole docs/ project.
watch-docs:
    cd docs && bun index.html 2>&1 | awk '{ print; fflush(); if ($0 ~ /^(Bundled page in|(\[x[0-9]+\] )?Reloaded in)/) system("tsc --noEmit -p tsconfig.json | wtsc") }'

# A bash script with pipefail, so a tsc failure fails the recipe even though wtsc, at the end of its
# pipe, succeeds. The docs build also regenerates the out-of-date pages under docs/src/md.
# type-check src/, ui/, editor/ and docs/, and build the docs into a temporary directory, deleted afterwards
check-compile:
    #!/usr/bin/env bash
    set -euo pipefail
    tsc --noEmit | wtsc
    out=$(mktemp -d)
    trap 'rm -rf "$out"' EXIT
    bun build ./docs/index.html --outdir="$out"
    (cd docs && tsc --noEmit) | wtsc

# run every test suite: bun unit tests, then the Playwright browser tests
test: test-bun test-pw

# Playwright browser tests (tests/**/*.pw.ts); extra arguments go to playwright, e.g. `just test-pw tests/grid.pw.ts`
test-pw *args:
    playwright test {{args}}

# Playwright tests in WebKit, inside Playwright's Docker image (its WebKit build needs system libraries some hosts
# lack): the motion tests by default, or the given arguments. Uses the harness already served on port 5391, or serves it.
test-webkit *args:
    #!/usr/bin/env bash
    set -euo pipefail
    url=http://localhost:5391/tests/browser/harness.html
    if ! curl -sf -o /dev/null "$url"; then
      PORT=5391 bun tests/browser/harness.html > /dev/null 2>&1 &
      trap "kill $!" EXIT
      for _ in $(seq 50); do curl -sf -o /dev/null "$url" && break; sleep 0.2; done
    fi
    version=$(bun -e 'console.log(require("@playwright/test/package.json").version)')
    args="{{args}}"
    docker run --rm --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/work:ro -w /work \
      "mcr.microsoft.com/playwright:v$version-noble" \
      npx playwright test --config tests/browser/webkit.config.ts \
      ${args:-tests/motion.pw.ts tests/ui-motion.pw.ts tests/removal.pw.ts tests/offscreen-render.pw.ts}

# bun unit tests (*.test.ts, currently docs/src/macro.test.ts and tests/bundle.test.ts)
test-bun *args:
    bun test {{args}}

# benchmark of the observable scheduling (tests/bench/observable.bench.ts) against the current src/, in Bun then
# in Chromium; prints nanoseconds per operation, compare runs made one after the other on the same machine
bench:
    @echo "== Bun"
    bun tests/bench/bun.ts
    @echo "== Chromium"
    bun tests/bench/chromium.ts

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
