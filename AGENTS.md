# Elt - Agent Context

## What it does

Opinionated typescript DOM manipulation library. JSX code returns DOM Nodes. MVVM approach using own Observable internal micro library.

Observables are meant to be transformed, mixed with others and can be set. Transformed observables can be bijective.

JSX children may contain decorators that are inline callbacks called at node creation. A lot of behaviour is tied to them. Otherwise, they must be `Renderable`, or `Observable<Renderable>` to be displayed in the DOM.

Has the concept of "Verbs" ; they're not Nodes but logic that change the DOM in a more complex manner, like repeating arrays or displaying nodes conditionally, according to Observable values and changes.

## Architecture

src/app.ts - micro library for complex application engineering
src/css.ts - minimal CSS-in-js, supports unique class names
src/decorators.ts - behavioural decorators, like $bind, $observe
src/dom.ts - low level implementation of DOM manipulation primitives, lots of them having to do with Observable lifecycle
src/elt.ts - the node creation function e() or E() and associated declarations
src/mutative.ts - micro library to use mutative more transparently with Observable. Recommended for complex manipulation in revert()
src/symbols.ts - declaration of internal symbols
src/observable/observable.ts - core Observable library, important.
src/observable/transformers.ts - useful functions to use with Observable.tf(), notably to play with Map/Set/Array.
src/types.ts - type definitions, mostly JSX related
src/verbs.ts -  If, Repeat, RepeatScroll, Switch
src/virtual.ts - virtual repeater for endless scrolling

ui/ - A fairly big library that ships theming and widgets. Included in this repo for convenience and because it follows this library closely.

## Conventions

- No ";"
- camelCase methods
- MixedCase class names
- snake_case variables (and functions)
- ALL_CAPS constants

## General instructions

- Always look for CPU/RAM efficient algorithms
- Factorize code ; DRY