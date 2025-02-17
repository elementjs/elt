
export PATH := ./node_modules/.bin:$(PATH)

ESFLAGS = --bundle --log-limit=0 --platform=browser --target=es2022 --minify-syntax --tsconfig=./tsconfig.json --jsx-factory=E --jsx-fragment=E.Fragment --format=esm

SOURCES = $(wildcard ./src/*.ts) $(wildcard ./src/observable/*.ts) Makefile

.PHONY: all docs types

files: src/types.ts dist/elt.js dist/elt.debug.js dist/elt.min.js dist/elt.debug.min.js dist/elt.cjs.js dist/elt.d.ts dist/elt.min.js.gz

all: files types

types:
	tsc

watch:
	tsc -w | wtsc make files

lint:
	eslint src

src/types.ts: typegen/gen.js typegen/htmlref.yml
	cd typegen && cat _types.ts > ../src/types.ts && node gen.js >> ../src/types.ts

dist/elt.js: $(SOURCES)
	esbuild $(ESFLAGS) --define:DEBUG=false --sourcemap=inline --outfile=$@ src/index.ts

dist/elt.cjs.js: $(SOURCES)
	esbuild $(ESFLAGS) --define:DEBUG=false --format=cjs --outfile=$@ src/index.ts

dist/elt.debug.js: $(SOURCES)
	esbuild $(ESFLAGS) --define:DEBUG=true --sourcemap=inline --outfile=$@ src/index.ts

dist/elt.min.js: $(SOURCES)
	esbuild $(ESFLAGS) --define:DEBUG=false --minify --outfile=$@ src/index.ts

dist/elt.min.js.gz: $(SOURCES) dist/elt.min.js
	gzip -k9f dist/elt.min.js
	wc -c dist/elt.min.js.gz

dist/elt.debug.min.js: $(SOURCES)
	esbuild $(ESFLAGS) --define:DEBUG=true --minify --outfile=$@ src/index.ts

docs:
	typedoc src/index.ts --watch
