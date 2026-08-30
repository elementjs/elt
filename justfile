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
