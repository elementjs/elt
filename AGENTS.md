# Elt - Agent Context

## What it does

Opinionated typescript DOM manipulation library. JSX code returns DOM Nodes. MVVM approach using own Observable internal micro library.

Observables are meant to be transformed/mixed with others. Setting a combined observable can revert change in all the sources. Transformed observables can be bijective. Since forgetting to unobserve an Observable leads to memory leaks, most the the library is architectured around tying observance to the presence of Nodes in the DOM ; connecting it starts observance, disconnecting it stops it.

JSX children may contain decorators that are inline callbacks called at node creation. A lot of behaviour is tied to them. Otherwise, they must be `Renderable`, or `Observable<Renderable>` to be displayed in the DOM.

Has the concept of "Verbs" ; they're not Nodes but logic that change the DOM in a more complex manner, like repeating arrays or displaying nodes conditionally, according to Observable values and changes.

This library is NOT React. There is no virtual-dom. DOM Nodes are returned and handled as they are. Verbs + observables drive updates.

## Before writing code

- tsconfig: strict, jsx react, jsxFactory E, jsxFragmentFactory E.Fragment
- import from "elt"
- typescript only : no JS to include, it's all made to be bundled

## Patterns

- Components: (attrs: Attrs<HTMLDivElement> & { ... } ) => <div></div>
  Some attrs are global and will be set on the resulting node even if not used in the Component : id, slot, part, role, tabindex, lang, inert, title, autofocus, nonce
- Forms : $bind.string | number | boolean | ...
- Dynamic UI: If / Switch / Repeat / RepeatScroll / VirtualScroll / Observable<Renderable>
- DOM updates are synchronous. Make sure UI updates are done at opportune times.

- o.* contain most of the Observable code. o(value) creates an observable or just returns the observable.
- $... indicate decorators ; functions meant to run as Node callbacks upon creation
- CapitalizedFunctions are verbs and denote dynamicity
- Attributes for components should take `o.RO<Type>` when appropriate to ensure dynamicity
- e() / E() / `<jsx.Code/>` create real DOM Nodes

## Observable Patterns

- o(value) → .get() / .set(); values treated as immutable (clone on nested updates for simple cases; see module header).
- obs.mutate(fn) via src/mutative.ts (needs mutative peer dep) for complex revert / nested edits.
- .tf(fn) read-only; .tf({ transform, revert }) or .tf(Converter) bidirectional. src/observable/transformers has pre-built .tf() converters for Map/Set/Array.
- .p('key') .p(0) for objects/array / .key() for Map.
- o.combine, o.merge, o.join for creating complex Observable depending on others, but quite low-level. o.expression() is the preferred, more readable way.
- o.RO<T> = observable | plain T — many APIs accept both, encouraged in attrs for custom elements
- Only o.RO<Renderable> belong in JSX children; observables of other types need .tf() to Renderable
- o.transaction(() => ...) to dispatch several values at once and avoid recomputing uselessly if some dependencies would get triggered several times ; Observables have an evaluation queue. Or instead of o.transaction, o.merge({dep1, dep2}).set({dep1: new_val1, dep2: newval2}) will achieve the same.
- o.clone() immutability helper

## App Patterns


## Pitfalls

- `document.appendChild()` will not work with connected/disconnected/observance. Nodes must be added with `node_append` and removed with `node_remove` or be wrapped in `<e-wrap></e-wrap>`. Most of the time, create an `App` and append a view (for example `node_append(document.body, app.DisplayView("Main"))`) as the application DOM entry point.
- $observe, $connected, $disconnected and everything that relates to nodes observing works only if they are inserted/removed using `node_append` or `node_remove`, or by wrapping in `<e-wrap></e-wrap>` (not preferred.) App views and all the verbs do so transparently. Mostly the developper using elt must insert the root-most node this way, or be sure to wrap their nodes in `<e-wrap></e-wrap>` when dealing with unaware third-party libraries that expect DOM nodes from callbacks. `setup_mutation_observer` is possible for making it entirely transparent but overkill.
- Fragment / `<> </>`, looks like a Node, but is not one, cannot have life-cycle run on them. No observance can take place on them. Decorators _are_ executed, though.
- JSX expressions are a black box per typescript limitations. Cast `<div>...</div> as HTMLDivElement` accordingly.

## Architecture

src/app.ts - micro library for complex application engineering
src/css.ts - minimal CSS-in-js, generates scoped class names, ensures CSS is valid
src/custom-elements.ts - CustomElement facilities, not favored.
src/decorators.ts - behavioural decorators, like $bind, $observe
src/dom.ts - low level implementation of DOM manipulation primitives, lots of them having to do with Observable lifecycle
src/elt.ts - the node creation function e() or E() and associated declarations
src/index.ts - Public export surface
src/mutative.ts - micro library to use mutative more transparently with Observable. Recommended for complex manipulation in revert()
src/symbols.ts - declaration of internal symbols
src/observable/indexable.ts - internal indexing for observers
src/observable/observable.ts - core Observable library, important.
src/observable/transformers.ts - useful functions to use with Observable.tf(), notably to play with Map/Set/Array.
src/types.ts - type definitions, mostly JSX related
src/utils.ts - Deferred, helpers
src/verbs.ts -  If, Repeat, RepeatScroll, Switch
src/virtual.ts - virtual repeater for endless scrolling

ui/ - A fairly big library that ships theming and widgets. Included in this repo for convenience and because it follows this library closely.

## Conventions

- No ";"
- camelCase methods
- MixedCase class names
- snake_case variables (and functions)
- Readonly observables (mostly simple transforms) are prefixed with `oo_`. Regular, writable observables (even resulting from join/merge/expression) start with `o_`.

## General instructions

- Always look for CPU/RAM efficient algorithms
- Factorize code ; DRY
- Comment non-obvious patterns. Comment introduced functions. Be terse but document enough.
- When using observables that are renderable, unless the expression is short (just `.p()/.key()` or a tf that mostly just calls a function), create `oo_`/`o_` observables outside JSX code for readability.
