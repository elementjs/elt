
export PATH := ./node_modules/.bin:$(PATH)

ESFLAGS = --bundle --log-limit=0 --platform=browser --target=es2017 --minify-syntax --tsconfig=./tsconfig.json --jsx-factory=E --jsx-fragment=E.Fragment --format=esm

SOURCES = $(wildcard src/*.ts) $(wildcard src/observable/*.ts) Makefile

.PHONY: all

all: dist/elt.js dist/elt.debug.js # dist/elt.min.js dist/elt.debug.min.js

dist/elt.js: $(SOURCES)
	esbuild $(ESFLAGS) --define:DEBUG=false --outfile=$@ src/index.ts

dist/elt.debug.js: $(SOURCES)
	esbuild $(ESFLAGS) --define:DEBUG=true --outfile=$@ src/index.ts
